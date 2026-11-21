// Automated measurement of the delivery configurations (thesis, section 4).
//
// For each configuration x experiment x device profile, loads the page N times in a fresh
// browser context and records: when the variant first became visible, FCP, LCP, CLS,
// console errors, and whether the variant is still on screen at the end.
//
// Usage:  node measure/run.mjs [runs=20] [port=4123]
// Needs:  npm run build (the SSR server is started by this script), Chrome installed.
// Output: measure/results/raw-<date>.csv and summary-<date>.json

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.argv[2] ?? 20);
const PORT = Number(process.argv[3] ?? 4123);
const BASE = `http://localhost:${PORT}`;
const SETTLE_MS = 4000; // time left for hydration, scripts and SDKs before reading results

const PROFILES = [
  { id: 'desktop', cpu: 1 },
  { id: 'mobile', cpu: 4 }, // CPU 4x slower, as Lighthouse's mobile preset
];

// Configurations of Table 2 (thesis section 4.2). Every run uses variant B, except the
// reference, which loads the same script with variant A (nothing changes).
const CONFIGS = {
  '0':  { fk_mode: 'client', fk_variant: 'A', fk_timing: 'early' },
  'A1': { fk_mode: 'client', fk_variant: 'B', fk_timing: 'early', fk_reapply: '1' },
  'A2': { fk_mode: 'client', fk_variant: 'B', fk_timing: 'stable' },
  'B':  { fk_mode: 'client', fk_variant: 'B', fk_timing: 'stable', fk_antiflicker: '1', fk_timeout: '3000' },
  'C':  { fk_mode: 'client', fk_variant: 'B', fk_timing: 'early', fk_reapply: '1', fk_skiphydration: '1' },
  'D':  { fk_mode: 'browser', fk_variant: 'B' },
  'E':  { fk_mode: 'server', fk_variant: 'B' },
};

// What "variant visible" means for each experiment, evaluated in the page.
const EXPERIMENTS = {
  E2: {
    path: '/product/rh-22',
    params: { fk_exp: 'E2' },
    configs: ['0', 'A1', 'A2', 'B', 'D', 'E'],
    probe: `(() => { const el = document.getElementById('pdp-price');
      if (!el) return null; return el.textContent.includes('−10%') ? 'B' : 'A'; })()`,
  },
  E3E4: {
    path: '/',
    params: { fk_exp: 'E3,E4' },
    configs: ['0', 'A1', 'A2', 'C', 'D', 'E'],
    probe: `(() => { const cards = [...document.querySelectorAll('app-popular-products .card')];
      if (!cards.length) return null;
      const ids = cards.map(c => c.getAttribute('data-product-id'));
      const dup = new Set(ids).size !== ids.length;
      const badges = cards.every(c => c.querySelector('.fk-badge'));
      const reversed = ids[0] !== 'fm-200'; // control order starts with the most reviewed product
      if (dup) return 'broken';
      return badges && reversed ? 'B' : (!badges && !reversed ? 'A' : 'partial'); })()`,
  },
};

const BASE_PARAMS = {
  fk_delay: '1000', fk_reapply: '0', fk_reapply_delay: '300', fk_antiflicker: '0',
  fk_timeout: '2000', fk_slow: '0', fk_debug: '0', fk_skiphydration: '0', fk_sdk_delay: '200',
};

// Injected before any page script: samples the probe on every frame, and collects paint,
// LCP and layout-shift entries.
function initScript(probe) {
  return `
    window.__m = { states: [], fcp: null, lcp: null, cls: 0 };
    const sample = () => {
      let s = null; try { s = ${probe}; } catch (e) {}
      const last = window.__m.states[window.__m.states.length - 1];
      const hidden = document.documentElement && getComputedStyle(document.documentElement).opacity === '0';
      const key = s + (hidden ? ':hidden' : '');
      if (!last || last.key !== key) window.__m.states.push({ t: performance.now(), key, s, hidden });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    new PerformanceObserver(l => l.getEntries().forEach(e => {
      if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; })).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.lcp = e.startTime; }))
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__m.cls += e.value; }))
      .observe({ type: 'layout-shift', buffered: true });
  `;
}

// From the frame-by-frame states: how long the control version was visible (after first
// paint) before the variant appeared, and how many visible switches happened.
function analyse(m) {
  const visible = m.states.filter(s => !s.hidden && s.s !== null && m.fcp !== null && s.t >= m.fcp - 1);
  // State at first paint = last state recorded before or at FCP.
  const before = m.states.filter(s => m.fcp !== null && s.t <= m.fcp + 1);
  const atPaint = before.length ? before[before.length - 1] : null;
  const seq = [];
  if (atPaint && !atPaint.hidden && atPaint.s !== null) seq.push(atPaint);
  for (const s of visible) if (!seq.length || seq[seq.length - 1].s !== s.s) seq.push(s);
  const firstB = seq.find(s => s.s === 'B');
  const controlShown = seq.length && seq[0].s !== 'B';
  const flickerMs = controlShown && firstB ? Math.round(firstB.t - Math.max(seq[0].t, m.fcp)) : 0;
  return {
    flicker_ms: flickerMs,
    switches: Math.max(0, seq.length - 1),
    first_variant_ms: firstB ? Math.round(firstB.t) : null,
    final: m.states.length ? m.states[m.states.length - 1].s : null,
  };
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + '/')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null;
  const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return s[lo] + (s[hi] - s[lo]) * (p - lo); };

async function main() {
  const server = spawn(process.execPath, [join(here, '../dist/ng-hydration/server/server.mjs')],
    { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const rows = [];
    for (const [expId, exp] of Object.entries(EXPERIMENTS)) {
      for (const profile of PROFILES) {
        for (const cfgId of exp.configs) {
          for (let run = 1; run <= RUNS; run++) {
            const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
            await context.addInitScript(initScript(exp.probe));
            const page = await context.newPage();
            const errors = [];
            page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
            page.on('pageerror', err => errors.push(String(err)));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
            const params = new URLSearchParams({ ...BASE_PARAMS, ...exp.params, ...CONFIGS[cfgId] });
            await page.goto(`${BASE}${exp.path}?${params}`, { waitUntil: 'load' });
            await page.waitForTimeout(SETTLE_MS);
            const m = await page.evaluate(() => window.__m);
            const a = analyse(m);
            rows.push({
              experiment: expId, profile: profile.id, config: cfgId, run,
              fcp_ms: m.fcp === null ? null : Math.round(m.fcp),
              lcp_ms: m.lcp === null ? null : Math.round(m.lcp),
              cls: Number(m.cls.toFixed(4)),
              ...a,
              errors: errors.length,
              error_sample: errors[0]?.slice(0, 120).replace(/[\r\n,]/g, ' ') ?? '',
            });
            await context.close();
          }
          process.stdout.write(`${expId} ${profile.id} ${cfgId} done\n`);
        }
      }
    }
    await browser.close();

    const date = new Date().toISOString().slice(0, 10);
    const out = join(here, 'results');
    mkdirSync(out, { recursive: true });
    const cols = Object.keys(rows[0]);
    writeFileSync(join(out, `raw-${date}.csv`),
      [cols.join(','), ...rows.map(r => cols.map(c => r[c] ?? '').join(','))].join('\n'));

    const summary = [];
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.experiment}|${r.profile}|${r.config}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    for (const [k, g] of groups) {
      const [experiment, profile, config] = k.split('|');
      const col = c => g.map(r => r[c]).filter(v => v !== null);
      const stat = c => ({ median: median(col(c)), q1: quantile(col(c), 0.25), q3: quantile(col(c), 0.75) });
      const finals = {};
      for (const r of g) finals[r.final] = (finals[r.final] ?? 0) + 1;
      summary.push({
        experiment, profile, config, runs: g.length,
        flicker_ms: stat('flicker_ms'),
        flicker_rate: g.filter(r => r.flicker_ms > 0).length / g.length,
        switches: stat('switches'), fcp_ms: stat('fcp_ms'), lcp_ms: stat('lcp_ms'), cls: stat('cls'),
        runs_with_errors: g.filter(r => r.errors > 0).length,
        error_sample: g.find(r => r.error_sample)?.error_sample ?? '',
        final_state: finals,
      });
    }
    writeFileSync(join(out, `summary-${date}.json`), JSON.stringify(summary, null, 2));
    console.log(`Wrote ${rows.length} runs to ${out}`);
  } finally {
    server.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

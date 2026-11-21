// Prints the frame-by-frame states of one run, to check what the analysis sees.
// Usage: node measure/debug-states.mjs "<path?query>" [cpu=4]
import { chromium } from 'playwright-core';
const [, , url, cpu = '4'] = process.argv;
const probe = `(() => { const cards = [...document.querySelectorAll('app-popular-products .card')];
  if (!cards.length) return null;
  const ids = cards.map(c => c.getAttribute('data-product-id'));
  return ids.join(' ') + ' badges=' + cards.filter(c => c.querySelector('.fk-badge')).length; })()`;
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext();
await context.addInitScript(`window.__s=[];const f=()=>{let s=null;try{s=${probe}}catch(e){}
  const l=window.__s[window.__s.length-1];if(!l||l.s!==s)window.__s.push({t:Math.round(performance.now()),s});requestAnimationFrame(f)};requestAnimationFrame(f);
  new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(e.name==='first-contentful-paint')window.__fcp=Math.round(e.startTime)})).observe({type:'paint',buffered:true});`);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(cpu) });
await page.goto('http://localhost:4125' + url);
await page.waitForTimeout(4000);
console.log('FCP', await page.evaluate(() => window.__fcp));
console.log(await page.evaluate(() => window.__s));
await browser.close();

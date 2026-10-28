/*
 * Fake Kameleoon: stands in for a client-side A/B testing script so we can
 * reproduce the flicker it causes with Angular SSR + hydration.
 *
 * Like the real thing it runs outside Angular, buckets the visitor with a
 * cookie, and edits the server-rendered DOM directly through CSS selectors.
 *
 * Switches (URL params, remembered for the tab in sessionStorage):
 *   fk_mode=client|server   client: this script edits the page (the flicker-prone setup)
 *                           server: the SDK in server.ts picks the variant and Angular renders
 *                           it; this script changes nothing and only reports later changes
 *   fk_variant=A|B          force a variant (default: bucketed from the fk_visitor cookie)
 *   fk_timing=early|late    early: edit the HTML before Angular hydrates
 *                           late: edit it fk_delay ms after load, like a slow script
 *   fk_delay=1000           delay used by late timing
 *   fk_reapply=0|1          re-apply changes Angular reverted (MutationObserver)
 *   fk_reapply_delay=300    how long the reverted (control) state stays visible
 *   fk_nav_delay=400        how long the script takes to re-evaluate after an SPA navigation
 *   fk_antiflicker=0|1      hide the page until experiments are applied
 *   fk_timeout=2000         anti-flicker timeout
 *   fk_exp=E1,E2,E5,E6      experiments to run (E3 and E4 break hydration)
 *   fk_slow=0|1500          simulate a slow device: Angular starts this many ms late (src/main.ts)
 *   fk_debug=0|1            timeline overlay
 */
(function () {
  'use strict';

  var DEFAULTS = {
    mode: 'client',
    variant: '',
    timing: 'early',
    delay: 1000,
    reapply: 0,
    reapply_delay: 300,
    nav_delay: 400,
    antiflicker: 0,
    timeout: 2000,
    exp: 'E1,E2,E5,E6',
    slow: 0,
    debug: 1,
  };

  var settings = loadSettings();
  var serverMode = settings.mode === 'server';
  var variant = getVariant();
  var enabled = String(settings.exp).split(',');
  var state = {};
  var armed = false;
  var flickers = 0;
  var cls = 0;
  var entries = [];
  var overlay = null;
  var hider = null;

  // ---------------------------------------------------------------------------
  // Experiments. Each one: where it runs, what it targets, how it changes the
  // DOM, and how to tell whether the change is still there.
  // ---------------------------------------------------------------------------

  var EXPERIMENTS = [
    {
      id: 'E1',
      name: 'Hero headline + background (static text)',
      matches: function (path) { return path === '/'; },
      target: function () { return document.querySelector('#home-hero .hero__title'); },
      apply: function (el) {
        el.textContent = 'Power through every job. 30% faster drilling.';
        el.closest('#home-hero').style.background = 'linear-gradient(110deg, #7a0010 55%, #d2051e)';
      },
      isApplied: function (el) { return el.textContent.indexOf('30% faster') !== -1; },
    },
    {
      id: 'E2',
      name: 'Product page price -10% (bound text)',
      matches: function (path) { return path.indexOf('/product/') === 0; },
      target: function () {
        var el = document.getElementById('pdp-price');
        return el && el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE ? el.firstChild : null;
      },
      apply: function (node) {
        var price = parseFloat(node.nodeValue.replace(/[^\d.]/g, ''));
        node.nodeValue = '€' + (price * 0.9).toFixed(2) + ' (−10% today) ';
      },
      isApplied: function (node) { return node.nodeValue.indexOf('−10%') !== -1; },
    },
    {
      id: 'E3',
      name: 'Badge inserted into product cards (structural)',
      matches: function (path) { return path === '/' || path.indexOf('/products') === 0; },
      target: function () { return document.querySelector('.card__link'); },
      apply: function () {
        document.querySelectorAll('.card__link').forEach(function (link) {
          if (!link.querySelector('.fk-badge')) {
            link.insertAdjacentHTML('afterbegin', '<span class="fk-badge">Free shipping</span>');
          }
        });
      },
      isApplied: function () {
        return Array.prototype.every.call(document.querySelectorAll('.card__link'), function (link) {
          return !!link.querySelector('.fk-badge');
        });
      },
    },
    {
      id: 'E4',
      name: 'Popular products reordered (inside @for)',
      matches: function (path) { return path === '/'; },
      target: function () { return document.querySelector('.section .grid'); },
      apply: function (grid) {
        var cards = Array.prototype.slice.call(grid.children).reverse();
        cards.forEach(function (card) { grid.appendChild(card); });
        grid.setAttribute('data-fk-first', firstProductId(grid));
      },
      isApplied: function (grid) { return firstProductId(grid) === grid.getAttribute('data-fk-first'); },
    },
    {
      id: 'E5',
      name: 'Header cart total → delivery message (bound text)',
      matches: function () { return true; },
      target: function () {
        var el = document.querySelector('#header-cart small');
        return el && el.firstChild;
      },
      apply: function (node) { node.nodeValue = 'Free delivery over €100'; },
      isApplied: function (node) { return node.nodeValue === 'Free delivery over €100'; },
    },
    {
      id: 'E6',
      name: 'Hero CTA replaced via outerHTML',
      matches: function (path) { return path === '/'; },
      target: function () { return document.getElementById('hero-cta'); },
      apply: function (el) {
        el.outerHTML =
          '<a href="/products/drilling" id="hero-cta" class="btn btn--primary btn--lg fk-cta">Get 20% off cordless →</a>';
      },
      isApplied: function (el) { return el.classList.contains('fk-cta'); },
    },
  ];

  function firstProductId(grid) {
    var card = grid.querySelector('[data-product-id]');
    return card ? card.getAttribute('data-product-id') : null;
  }

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------

  function activeExperiments() {
    var path = location.pathname;
    return EXPERIMENTS.filter(function (exp) {
      return enabled.indexOf(exp.id) !== -1 && exp.matches(path);
    });
  }

  function tryApply() {
    if (!armed || variant !== 'B') return;
    if (serverMode) return watchRendered();

    activeExperiments().forEach(function (exp) {
      var target = exp.target();
      if (!target) return;
      var st = state[exp.id] || (state[exp.id] = { applied: false, reverted: false });

      if (!st.applied) {
        st.applied = true;
        // Still applied from before an SPA navigation (e.g. the header): nothing to do.
        if (exp.isApplied(target)) return;
        exp.apply(target);
        countIfVisible();
        log(exp.id + ' applied: ' + exp.name, 'apply');
        return;
      }

      var stillApplied = exp.isApplied(exp.target() || target);
      if (st.reverted && stillApplied) st.reverted = false;
      if (st.reverted || stillApplied) return;

      st.reverted = true;
      countIfVisible();
      log(exp.id + ' REVERTED by Angular, control is showing again', 'revert');

      if (num('reapply')) {
        setTimeout(function () {
          var t = exp.target();
          if (t && !exp.isApplied(t)) {
            exp.apply(t);
            countIfVisible();
            log(exp.id + ' re-applied', 'apply');
          }
          st.reverted = false;
        }, num('reapply_delay'));
      }
    });

    maybeReveal();
  }

  // Server mode: Angular renders the variant and this script changes nothing. It records
  // what each target first looked like and reports any later change as a flicker.
  var snapshots = {};

  function watchRendered() {
    activeExperiments().forEach(function (exp) {
      var target = exp.target();
      if (!target) return;
      var now = fingerprint(target);
      if (!(exp.id in snapshots)) {
        snapshots[exp.id] = now;
        log(exp.id + ' rendered by Angular: "' + now.slice(0, 60) + '"', 'ng');
      } else if (snapshots[exp.id] !== now) {
        snapshots[exp.id] = now;
        countIfVisible();
        log(exp.id + ' CHANGED after render: "' + now.slice(0, 60) + '"', 'revert');
      }
    });
  }

  function fingerprint(target) {
    var text = (target.textContent || '').replace(/\s+/g, ' ').trim();
    return target.className ? text + ' .' + target.className : text;
  }

  function arm(reason) {
    armed = true;
    log('Script evaluating experiments (' + reason + ')', 'info');
    tryApply();
    maybeReveal();
  }

  // Count a DOM swap as a visible flicker only once the page has painted. Paint timing
  // entries are reported late, so track the first frame directly: a task queued from
  // the first animation frame runs after that frame is painted.
  var painted = false;
  requestAnimationFrame(function () { setTimeout(function () { painted = true; }); });

  function countIfVisible() {
    if (painted && !hider) flickers++;
  }

  // Watch everything, like the real script does to catch late-rendered elements.
  new MutationObserver(function (records) {
    var external = records.some(function (r) { return !overlay || !overlay.contains(r.target); });
    if (external) tryApply();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-product-id'],
  });

  if (serverMode) {
    onParsed(function () { arm('server mode, watching only'); });
  } else if (settings.timing === 'late') {
    setTimeout(function () { arm('late, after ' + num('delay') + ' ms'); }, num('delay'));
  } else {
    // A real script edits elements as soon as they exist. We wait until the parser has
    // finished the document, which is still before Angular's module script runs.
    onParsed(function () { arm('early, before Angular boots'); });
  }

  // SPA navigation: Angular renders the new page (control), the script catches up later.
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var before = location.pathname;
      var result = original.apply(this, arguments);
      if (location.pathname !== before) onNavigate();
      return result;
    };
  });
  window.addEventListener('popstate', onNavigate);

  function onNavigate() {
    state = {};
    snapshots = {};
    if (serverMode) {
      log('SPA navigation to ' + location.pathname + ', Angular renders the variant itself', 'nav');
      return;
    }
    armed = false;
    log('SPA navigation to ' + location.pathname + ', Angular renders control', 'nav');
    setTimeout(function () { arm('after navigation, ' + num('nav_delay') + ' ms'); }, num('nav_delay'));
  }

  // ---------------------------------------------------------------------------
  // Anti-flicker snippet
  // ---------------------------------------------------------------------------

  if (num('antiflicker') && !serverMode) {
    hider = document.createElement('style');
    hider.textContent = 'html { opacity: 0 !important; }';
    document.head.appendChild(hider);
    log('Anti-flicker: page hidden', 'info');
    setTimeout(function () { reveal('timeout ' + num('timeout') + ' ms'); }, num('timeout'));
  }

  function maybeReveal() {
    if (!hider || !armed) return;
    var pending = variant === 'B' && activeExperiments().some(function (exp) {
      return !(state[exp.id] && state[exp.id].applied);
    });
    if (!pending) reveal('experiments applied');
  }

  function reveal(reason) {
    if (!hider) return;
    hider.remove();
    hider = null;
    log('Anti-flicker: page shown (' + reason + ')', 'info');
  }

  // ---------------------------------------------------------------------------
  // Timeline: paints, layout shifts, Angular hydration and errors
  // ---------------------------------------------------------------------------

  log(
    'Script loaded. Mode ' + settings.mode + ', variant ' + variant +
      (variant === 'A' ? ' (control, nothing will change)' : ''),
    'info'
  );
  if (num('slow')) log('Slow device: Angular starts ' + num('slow') + ' ms late', 'info');

  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.name === 'first-contentful-paint') log('First contentful paint', 'paint', e.startTime);
      });
    }).observe({ type: 'paint', buffered: true });

    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (!e.hadRecentInput) cls += e.value;
      });
      render();
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}

  window.addEventListener('ng:hydrated', function () { log('Angular hydrated', 'ng'); });

  var consoleError = console.error;
  console.error = function () {
    // Angular logs errors as console.error('ERROR', error).
    var error = arguments[0] === 'ERROR' ? arguments[1] : arguments[0];
    var message = String(error && error.message ? error.message : error);
    log('Angular error: ' + message.split('\n')[0].slice(0, 140), 'error');
    return consoleError.apply(console, arguments);
  };

  // ---------------------------------------------------------------------------
  // Debug overlay
  // ---------------------------------------------------------------------------

  onParsed(createOverlay);

  function createOverlay() {
    var style = document.createElement('style');
    style.textContent = [
      '.fk-badge{display:inline-block;margin-bottom:6px;padding:2px 8px;background:#ffd400;color:#222;font-size:.75rem;font-weight:700}',
      '.fk-cta{background:#0a7d3b!important}',
      '.fk-panel{position:fixed;right:12px;bottom:12px;z-index:2147483647;width:min(420px,calc(100vw - 24px));max-height:50vh;display:flex;flex-direction:column;background:#111;color:#eee;font:12px/1.4 ui-monospace,Consolas,monospace;box-shadow:0 8px 24px rgb(0 0 0/.4)}',
      '.fk-panel.collapsed{width:auto}.fk-panel.collapsed .fk-body{display:none}',
      '.fk-head{display:flex;gap:8px;align-items:center;padding:8px;background:#000;cursor:pointer}',
      '.fk-head b{color:#ffd400}.fk-head .fk-stat{margin-left:auto}',
      '.fk-body{display:flex;flex-direction:column;min-height:0}',
      '.fk-controls{display:flex;flex-wrap:wrap;gap:4px;padding:8px;border-bottom:1px solid #333}',
      '.fk-controls button{padding:2px 6px;border:1px solid #555;background:#222;color:#ccc;font:inherit;cursor:pointer}',
      '.fk-controls button.on{background:#ffd400;border-color:#ffd400;color:#000}',
      '.fk-log{margin:0;padding:8px;overflow:auto;list-style:none}',
      '.fk-log li{white-space:pre-wrap}.fk-log .t{color:#888}',
      '.fk-apply{color:#7ee787}.fk-revert{color:#ff7b72;font-weight:700}.fk-ng{color:#79c0ff}',
      '.fk-error{color:#ff7b72}.fk-paint{color:#d2a8ff}.fk-nav{color:#ffa657}',
    ].join('');
    document.head.appendChild(style);

    if (!num('debug')) return;

    overlay = document.createElement('div');
    overlay.className = 'fk-panel';
    try { if (sessionStorage.getItem('fk_collapsed') === '1') overlay.classList.add('collapsed'); } catch (e) {}
    overlay.innerHTML =
      '<div class="fk-head"><b>Fake Kameleoon</b><span class="fk-variant"></span><span class="fk-stat"></span></div>' +
      '<div class="fk-body"><div class="fk-controls"></div><ul class="fk-log"></ul></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.fk-head').addEventListener('click', function () {
      overlay.classList.toggle('collapsed');
      try { sessionStorage.setItem('fk_collapsed', overlay.classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
    });

    var controls = overlay.querySelector('.fk-controls');
    // [label, setting, value, tooltip]
    var buttons = [
      ['client script', 'mode', 'client', 'A script in the browser edits the page after it arrives (the way that flickers)'],
      ['server SDK', 'mode', 'server', 'The server sends a page that is already in the right version'],
      ['Variant A', 'variant', 'A', 'The original page'],
      ['Variant B', 'variant', 'B', 'The new version being tested'],
      ['early', 'timing', 'early', 'Fast script: changes the page before the website wakes up'],
      ['late', 'timing', 'late', 'Slow script: changes the page after visitors already see the original'],
      ['re-apply', 'reapply', '1', 'Put changes back when the website undoes them'],
      ['anti-flicker', 'antiflicker', '1', 'Hide the page until the script is done'],
    ];
    buttons.forEach(function (b) {
      var isToggle = b[2] === '1';
      var on = isToggle ? !!num(b[1]) : (b[1] === 'variant' ? variant : String(settings[b[1]])) === b[2];
      addButton(controls, b[0], on, function () {
        settings[b[1]] = isToggle ? (on ? 0 : 1) : b[2];
      }, b[3]);
    });
    EXPERIMENTS.forEach(function (exp) {
      var on = enabled.indexOf(exp.id) !== -1;
      addButton(controls, exp.id, on, function () {
        settings.exp = (on
          ? enabled.filter(function (id) { return id !== exp.id; })
          : enabled.concat(exp.id)
        ).sort().join(',');
      }, exp.name);
    });
    addButton(controls, 'slow device', !!num('slow'), function () {
      settings.slow = num('slow') ? 0 : 1500;
    }, 'Pretend to be a slow phone: the website wakes up 1.5 s later');
    addButton(controls, 'reset', false, function () {
      settings = Object.assign({}, DEFAULTS);
    }, 'Put every setting back to its starting value');

    render();
  }

  function addButton(parent, label, on, change, title) {
    var button = document.createElement('button');
    button.textContent = label;
    if (title) button.title = title;
    if (on) button.className = 'on';
    button.addEventListener('click', function () {
      change();
      saveSettings();
      // Drop fk_ params from the URL so the saved settings win on reload.
      location.href = location.pathname;
    });
    parent.appendChild(button);
  }

  function log(message, kind, time) {
    entries.push({ t: Math.round(time === undefined ? performance.now() : time), message: message, kind: kind });
    entries.sort(function (a, b) { return a.t - b.t; });
    render();
  }

  function render() {
    if (!overlay) return;
    overlay.querySelector('.fk-variant').textContent =
      'Variant ' + variant + ' · ' + (serverMode ? 'server SDK' : 'client ' + settings.timing);
    overlay.querySelector('.fk-stat').textContent = 'flickers ' + flickers + ' · CLS ' + cls.toFixed(3);
    overlay.querySelector('.fk-log').innerHTML = entries.map(function (e) {
      return '<li class="fk-' + e.kind + '"><span class="t">' + String(e.t).padStart(5) + ' ms</span>  ' +
        escapeHtml(e.message) + '</li>';
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function loadSettings() {
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('fk_settings') || '{}'); } catch (e) {}
    var params = new URLSearchParams(location.search);
    Object.keys(DEFAULTS).forEach(function (key) {
      if (params.has('fk_' + key)) saved[key] = params.get('fk_' + key);
      if (saved[key] === undefined) saved[key] = DEFAULTS[key];
    });
    try { sessionStorage.setItem('fk_settings', JSON.stringify(saved)); } catch (e) {}
    syncCookies(saved);
    return saved;
  }

  function saveSettings() {
    try { sessionStorage.setItem('fk_settings', JSON.stringify(settings)); } catch (e) {}
    syncCookies(settings);
  }

  // server.ts reads these to decide, before rendering, what the SDK should do.
  function syncCookies(values) {
    ['mode', 'variant', 'exp'].forEach(function (key) {
      document.cookie = 'fk_' + key + '=' + encodeURIComponent(values[key]) + '; path=/; SameSite=Lax';
    });
  }

  function num(key) {
    return Number(settings[key]) || 0;
  }

  function getVariant() {
    if (settings.variant === 'A' || settings.variant === 'B') return settings.variant;
    var match = document.cookie.match(/(?:^|; )fk_visitor=([^;]+)/);
    var code = match ? match[1] : Math.random().toString(36).slice(2, 12);
    if (!match) document.cookie = 'fk_visitor=' + code + '; path=/; max-age=31536000; SameSite=Lax';
    var hash = 0;
    for (var i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) | 0;
    return Math.abs(hash) % 2 ? 'B' : 'A';
  }

  function onParsed(callback) {
    if (document.readyState !== 'loading') return callback();
    document.addEventListener('readystatechange', function handler() {
      document.removeEventListener('readystatechange', handler);
      callback();
    });
  }

  function escapeHtml(text) {
    return text.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }
})();

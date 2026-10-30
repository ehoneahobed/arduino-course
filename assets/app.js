/* IoT at BIH: works with no internet, and installs as an app. Website only.
   - Registers the service worker (sw.js at the site root, next to index.html). Never from
     file:// (a USB stick already works with no internet) and never where the browser has
     no service workers: then this file only shows the "already works offline" line.
   - The "Save the whole course on this device" panel (<div data-offline> on the course home
     and My progress): a button, a progress bar and a message when done.
   - A calm "Updated" note when a new version of the site takes over an open page.
   - "Install this course" where the browser offers it (beforeinstallprompt): inside the panel,
     and as a small dismissible note on pages whose script tag has data-install="chip" (the
     site home). An iPhone / iPad note ("Share, then Add to Home Screen") in the panel only.
   Loaded with "defer" on every page; the tags are added by tools/inject_head.py. */
(function () {
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/assets\/app\.js([?#].*)?$/, '') : '';
  var chipWanted = !!(me && me.getAttribute('data-install') === 'chip');
  var web = /^https?:$/.test(location.protocol);
  var sw = web && 'serviceWorker' in navigator && !!window.Promise;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function show(el, on) { if (el) el.hidden = !on; }

  var CSS = '' +
    '.iot-toast{position:fixed; left:50%; bottom:max(1rem, env(safe-area-inset-bottom)); transform:translateX(-50%); z-index:9000; display:flex; align-items:center; gap:.7rem; width:max-content; max-width:calc(100vw - 2rem); padding:.6rem .6rem .6rem 1rem; border-radius:14px; background:#24182E; color:#fff; border:1px solid rgba(255,255,255,.16); box-shadow:0 12px 30px -12px rgba(0,0,0,.45); font:400 .92rem/1.35 var(--text, system-ui, sans-serif)}' +
    '.iot-toast p{margin:0}' +
    '.iot-toast button{font:500 .88rem/1 var(--display, system-ui, sans-serif); border-radius:99px; min-height:36px; padding:.45rem .9rem; cursor:pointer; border:1px solid rgba(255,255,255,.3); background:none; color:#fff}' +
    '.iot-toast button.go{background:#FFBE00; border-color:#FFBE00; color:#24182E}' +
    '.iot-toast button.x{min-width:36px; padding:.45rem; font-size:1.1rem; border-color:transparent; opacity:.8}' +
    '.iot-toast button:hover,.iot-toast button:focus-visible{border-color:#FFBE00; outline:none}' +
    '@media (prefers-reduced-motion:no-preference){.iot-toast{animation:iot-in .35s ease-out}@keyframes iot-in{from{opacity:0; transform:translate(-50%, 8px)}}}' +
    '@media print{.iot-toast{display:none}}' +
    '[data-offline] [hidden]{display:none !important}' +
    '.offline-bar{height:8px; border-radius:99px; background:var(--surface-2, #F4F0F6); border:1px solid var(--line, #E4DEE9); overflow:hidden; max-width:28rem}' +
    '.offline-bar span{display:block; height:100%; width:0; background:var(--good, #17705A); transition:width .2s}' +
    '.offline-status:empty{display:none}' +
    '.offline-status{font-size:.95em; color:var(--ink-2); border-left:2px solid var(--good, #17705A); padding:.1rem 0 .1rem .85rem}' +
    '.offline-status.bad{border-left-color:var(--danger, #CA1F3F)}';
  function addStyle() {
    if ($('#iot-app-css')) return;
    var s = document.createElement('style');
    s.id = 'iot-app-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // A small note at the bottom of the window, with an action and a close button.
  function toast(id, text, action, onAction, onClose) {
    addStyle();
    var old = document.getElementById(id);
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'iot-toast';
    t.id = id;
    t.setAttribute('role', 'status');
    t.innerHTML = '<p></p><button type="button" class="go"></button><button type="button" class="x" aria-label="Close">&times;</button>';
    t.firstChild.textContent = text;
    t.children[1].textContent = action;
    t.children[1].addEventListener('click', function () { t.remove(); onAction(); });
    t.children[2].addEventListener('click', function () { t.remove(); if (onClose) onClose(); });
    document.body.appendChild(t);
    return t;
  }

  var fmtDay = function (d) {
    try { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d.toDateString(); }
  };
  var mb = function (b) { return b ? ' (about ' + Math.max(1, Math.round(b / 1048576)) + ' MB)' : ''; };

  // ---------- The "Save the whole course" panel ----------
  var panels = [];
  function setupPanels() {
    panels = $$('[data-offline]');
    if (!panels.length) return;
    addStyle();
    panels.forEach(function (p) {
      show(p, sw || !web);
      $$('[data-offline] [data-offline-web]').forEach(function (el) { show(el, sw); });
      show($('[data-offline-file]', p), !web);
      show($('[data-ios]', p), sw && ios && !standalone);
      var btn = $('[data-save-all]', p);
      if (btn && sw) btn.addEventListener('click', function () {
        btn.disabled = true;
        status('Starting…');
        bar(0);
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
        navigator.serviceWorker.ready.then(function (reg) { reg.active.postMessage('save-all'); });
      });
    });
    var saved = store('iot-offline-saved');
    if (sw && saved) status('✓ The whole course is saved on this device (' + saved + '). It works with no internet.');
  }
  function status(text, bad) {
    panels.forEach(function (p) {
      var out = $('[data-save-status]', p);
      if (!out) return;
      out.textContent = text;
      out.className = 'offline-status' + (bad ? ' bad' : '');
    });
  }
  function bar(f) {
    panels.forEach(function (p) {
      var b = $('[data-save-bar]', p);
      if (!b) return;
      show(b, f !== null);
      if (f !== null) b.firstChild.style.width = Math.round(f * 100) + '%';
    });
  }
  function busy(on) { panels.forEach(function (p) { var b = $('[data-save-all]', p); if (b) b.disabled = on; }); }
  function onMessage(e) {
    var m = e.data || {};
    if (m.type === 'info') {
      $$('[data-offline-size]').forEach(function (el) { el.textContent = mb(m.bytes); });
      if (m.saving) onMessage({ data: { type: 'save-progress', done: m.saving.done, total: m.saving.total } });
      else if (!m.full && store('iot-offline-saved')) { store('iot-offline-saved', null); status(''); }
    } else if (m.type === 'save-progress') {
      busy(true);
      bar(m.total ? m.done / m.total : 0);
      status('Saving… ' + m.done + ' of ' + m.total + ' files. You can keep reading while it works.');
    } else if (m.type === 'save-done') {
      busy(false);
      bar(null);
      if (m.failed) {
        status(m.failed + ' of ' + m.total + ' files did not download. The rest are saved. Check the internet and press the button again.', true);
        return;
      }
      var day = fmtDay(new Date());
      store('iot-offline-saved', 'saved ' + day);
      status('✓ Done. The whole course is saved on this device (saved ' + day + '). Every page, 3D build and sketch now works with no internet.');
    }
  }

  // ---------- Install ----------
  var deferred = null;
  function canOfferInstall() { return !!deferred && !standalone; }
  function install() {
    if (!deferred) return;
    var d = deferred;
    deferred = null;
    d.prompt();
    if (d.userChoice) d.userChoice.then(function () { refreshInstall(); }, function () {});
    refreshInstall();
  }
  function refreshInstall() {
    $$('[data-offline] [data-install]').forEach(function (el) { show(el, canOfferInstall()); });
    var chip = document.getElementById('iot-install');
    if (!canOfferInstall() || store('iot-install-hide')) { if (chip) chip.remove(); return; }
    if (chipWanted && !chip) {
      toast('iot-install', 'Install IoT at BIH as an app. It opens in its own window and works with no internet.', 'Install', install,
        function () { store('iot-install-hide', '1'); });
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshInstall); else refreshInstall();
  });
  window.addEventListener('appinstalled', function () { deferred = null; refreshInstall(); });

  function ready() {
    setupPanels();
    $$('[data-install-btn]').forEach(function (b) { b.addEventListener('click', install); });
    refreshInstall();
    if (!sw) return;
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.active) return;
      if (panels.length) reg.active.postMessage('info');
      // Once per visit: let the worker bring saved files up to date after an update.
      var nudged = null;
      try { nudged = sessionStorage.getItem('iot-top-up'); sessionStorage.setItem('iot-top-up', '1'); } catch (e) {}
      if (!nudged) reg.active.postMessage('top-up');
    });
  }

  if (!sw) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
    return;
  }

  // ---------- The service worker ----------
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (hadController) {
      toast('iot-updated', 'Updated — reload for the latest version.', 'Reload', function () { location.reload(); });
      navigator.serviceWorker.ready.then(function (reg) {
        if (!reg.active) return;
        reg.active.postMessage('top-up');
        if (panels.length) reg.active.postMessage('info');
      });
    }
    hadController = true;
  });
  navigator.serviceWorker.register(base + 'sw.js').catch(function () {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

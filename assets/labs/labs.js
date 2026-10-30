/* Arduino Ladder: the small loader for the 3D labs.
   Pages carry this file (a few KB), not the 3D bundle. The bundle
   (labs.bundle.js, three.js and every lab, about 1 MB) is fetched only
   when someone opens a lab, or straight away if the page has a
   <div class="lab" data-lab="…"> to fill. Works from file:// too.
   It also makes the "3D lab" pill in a band's section bar open a small menu
   of every 3D view on the page, and opens the one a link points at
   (#try-3d, or #3d-b1p5 for a build).
   Without JavaScript the "View in 3D" buttons stay hidden, the pill is a
   plain link to the lab's section, and the flat diagrams teach exactly as
   before. */
(function () {
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/labs\.js([?#].*)?$/, '') : '';
  var src = base + 'labs.bundle.js';
  var loading = null;
  var watchers = [];
  var gl = !!window.WebGLRenderingContext;

  function tell(f) { for (var i = 0; i < watchers.length; i++) watchers[i](f); }
  // Load the bundle. Over the web it comes by XMLHttpRequest so a progress
  // bar can show; from a USB stick (file://) by a plain <script>, which is fast.
  function load(onProgress) {
    if (window.ArduinoLabs) return Promise.resolve();
    if (onProgress) watchers.push(onProgress);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        function tag() {
          tell(-1);
          var s = document.createElement('script');
          s.src = src;
          s.onload = function () { tell(1); resolve(); };
          s.onerror = function () { reject(new Error('could not load ' + src)); };
          document.head.appendChild(s);
        }
        if (!/^https?:$/.test(location.protocol) || !window.XMLHttpRequest) return tag();
        try {
          var x = new XMLHttpRequest();
          x.open('GET', src);
          x.onprogress = function (e) { tell(e.lengthComputable && e.total ? e.loaded / e.total : Math.min(0.95, e.loaded / 1100000)); };
          x.onload = function () {
            if (x.status >= 200 && x.status < 300 && x.responseText) {
              tell(1);
              var s = document.createElement('script');
              s.text = x.responseText + '\n//# sourceURL=' + src;
              document.head.appendChild(s);
              if (window.ArduinoLabs) resolve(); else tag();
            } else tag();
          };
          x.onerror = tag;
          x.send();
        } catch (e) { tag(); }
      });
      loading.then(function () { watchers = []; }, function () { loading = null; watchers = []; });
    }
    return loading;
  }

  // A placeholder the size of a lab, with a progress bar, while the bundle comes.
  var CUBE = '<svg class="lab-skel-cube" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/></svg>';
  function skeleton(after) {
    if (window.ArduinoLabs) return { done: function () {} };
    var d = document.createElement('div');
    d.className = 'lab-skel';
    d.setAttribute('role', 'status');
    d.innerHTML = '<div class="lab-skel-in">' + CUBE + '<b>Loading the 3D lab…</b><div class="meter busy"><span></span></div><small>About 1 MB to download, the first time. Then it opens straight away.</small></div>';
    after.insertAdjacentElement('afterend', d);
    var bar = d.querySelector('.meter'), fill = bar.firstChild;
    function onP(f) {
      if (f < 0) { bar.className = 'meter busy'; return; }
      bar.className = 'meter';
      fill.style.width = Math.round(Math.max(0.04, f) * 100) + '%';
    }
    return { onProgress: onP, done: function () { d.remove(); } };
  }
  function failed(btn, what) {
    btn.removeAttribute('aria-busy');
    btn.textContent = 'The 3D ' + what + ' could not load';
    btn.disabled = true;
  }

  // "View in 3D" beside each wiring diagram.
  function init() {
    if (document.querySelector('.lab[data-lab]:not([data-lazy])')) load();
    if (!gl) return;
    var btns = document.querySelectorAll('.view3d-btn[data-build]');
    for (var i = 0; i < btns.length; i++) (function (btn) {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      var wrap = btn.closest('.view3d') || btn;
      wrap.hidden = false;
      btn.hidden = false;
      var warm = function () { load().catch(function () {}); };
      btn.addEventListener('pointerenter', warm, { once: true });
      btn.addEventListener('focus', warm, { once: true });
      btn.addEventListener('click', function () {
        if (window.ArduinoLabs) { window.ArduinoLabs.toggle(btn); return; }
        btn.setAttribute('aria-busy', 'true');
        var sk = skeleton(wrap);
        load(sk.onProgress).then(function () {
          sk.done();
          btn.removeAttribute('aria-busy');
          window.ArduinoLabs.toggle(btn);
        }, function () { sk.done(); failed(btn, 'view'); });
      });
    })(btns[i]);
  }

  // "Open the 3D lab": a <div class="lab" data-lab="…" data-lazy hidden> waits,
  // with no bundle fetched, until its button (data-lab-open="…") is pressed.
  function initLazy() {
    if (!gl) return;
    var opens = document.querySelectorAll('button[data-lab-open]');
    for (var i = 0; i < opens.length; i++) (function (btn) {
      if (btn.dataset.wired) return;
      var host = document.querySelector('.lab[data-lab="' + btn.dataset.labOpen + '"]');
      if (!host) return;
      btn.dataset.wired = '1';
      var wrap = btn.closest('.view3d') || btn;
      wrap.hidden = false;
      btn.hidden = false;
      var label = btn.textContent;
      var warm = function () { load().catch(function () {}); };
      btn.addEventListener('pointerenter', warm, { once: true });
      btn.addEventListener('focus', warm, { once: true });
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        if (!open) {
          if (host.labStage && host.labStage.fullscreen.on) host.labStage.fullscreen.exit();
          host.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = label;
          if (window.ArduinoLabs) window.ArduinoLabs.fullButton(btn, host, false);
          return;
        }
        btn.setAttribute('aria-busy', 'true');
        btn.setAttribute('aria-expanded', 'true');
        var sk = skeleton(wrap);
        load(sk.onProgress).then(function () {
          sk.done();
          btn.removeAttribute('aria-busy');
          host.hidden = false;
          btn.setAttribute('aria-pressed', 'true');
          btn.textContent = 'Close the 3D lab';
          window.ArduinoLabs.fullButton(btn, host, true);
          var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
          Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { window.ArduinoLabs.mount(host); });
        }, function () { sk.done(); btn.setAttribute('aria-expanded', 'false'); failed(btn, 'lab'); });
      });
    })(opens[i]);
  }

  // ---- the "3D lab" pill and its menu: every 3D view on this page ----
  function text(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  var ICO = {
    cube: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h.01M11 8h.01M15 8h.01M19 8h.01M7 12h.01M11 12h.01M15 12h.01M19 12h.01M7 16h.01M11 16h.01M15 16h.01M19 16h.01"/>',
    all: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  };
  function ico(n) { return '<span class="ix-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICO[n] + '</svg></span>'; }
  function items() {
    var out = [];
    var lazy = document.querySelectorAll('button[data-lab-open]');
    for (var i = 0; i < lazy.length; i++) {
      var sec = lazy[i].closest('.concept, section, div[id]');
      var h = document.getElementById('try-3d') || (sec && sec.querySelector('h3, h2'));
      var t = text(h).replace(/^Try it in 3D:\s*/i, '');
      out.push({ main: true, title: t ? t.charAt(0).toUpperCase() + t.slice(1) : 'The concept lab', sub: 'The band’s 3D lab, with missions', target: lazy[i] });
    }
    var bs = document.querySelectorAll('.view3d-btn[data-build]');
    for (var j = 0; j < bs.length; j++) {
      var fig = bs[j].closest('figure');
      var svg = fig && fig.querySelector('svg[aria-label], img[alt]');
      var name = svg ? (svg.getAttribute('aria-label') || svg.getAttribute('alt')) : bs[j].dataset.build;
      var m = /^Band \d+ (Part .*)$/.exec(name);
      out.push({ title: m ? m[1] : name, sub: 'The wiring, in 3D', target: bs[j], hash: '#3d-' + bs[j].dataset.build });
    }
    return out;
  }
  function go(target, full) {
    // One section at a time: open the section that holds this lab first.
    if (window.ArduinoPager) window.ArduinoPager.reveal(target);
    var host = target.closest('.view3d') || target;
    var sk = skeleton(host);
    return load(sk.onProgress).then(function () {
      sk.done();
      return window.ArduinoLabs.open(target, { full: !!full });
    }, function () { sk.done(); });
  }
  function initNav() {
    var pill = document.querySelector('nav[aria-label="Sections"] a.nav-3d');
    if (!pill || !gl) return;
    var list = items();
    if (!list.length) return;
    if (!pill.querySelector('.n3')) pill.insertAdjacentHTML('beforeend', ' <span class="n3" aria-hidden="true">' + list.length + '</span>');
    pill.setAttribute('aria-haspopup', 'true');
    pill.setAttribute('aria-expanded', 'false');
    var menu = document.createElement('div');
    menu.className = 'lab-index';
    menu.id = 'lab-index';
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', '3D on this page');
    pill.setAttribute('aria-controls', 'lab-index');
    var html = '<h2>3D on this page</h2><ul>';
    list.forEach(function (it, i) {
      html += '<li' + (it.main ? ' class="ix-main"' : '') + '><a href="' + (it.hash || pill.getAttribute('href')) + '" data-i="' + i + '">' + ico(it.main ? 'cube' : 'grid') + '<span>' + it.title.replace(/</g, '&lt;') + '<small>' + it.sub + '</small></span></a></li>';
    });
    html += '</ul><ul class="ix-all"><li><a href="' + base + '../../arduino/labs.html">' + ico('all') + '<span>Every 3D lab in the course<small>The 3D Workshop: all nine bands</small></span></a></li></ul>';
    menu.innerHTML = html;
    document.body.appendChild(menu);
    function place() {
      var r = pill.getBoundingClientRect();
      var w = menu.offsetWidth;
      menu.style.top = Math.round(r.bottom + 8) + 'px';
      menu.style.left = Math.round(Math.max(12, Math.min(r.left, document.documentElement.clientWidth - w - 12))) + 'px';
    }
    function show(on) {
      menu.hidden = !on;
      pill.setAttribute('aria-expanded', String(on));
      if (on) { place(); load().catch(function () {}); var f = menu.querySelector('a'); if (f) f.focus(); }
    }
    pill.addEventListener('click', function (e) { e.preventDefault(); show(menu.hidden); });
    pill.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); show(true); } });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-i]');
      if (!a) return;
      e.preventDefault();
      show(false);
      go(list[+a.dataset.i].target);
    });
    menu.addEventListener('keydown', function (e) {
      var as = [].slice.call(menu.querySelectorAll('a'));
      var i = as.indexOf(document.activeElement);
      if (e.key === 'Escape') { show(false); pill.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); as[(i + 1) % as.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); as[(i - 1 + as.length) % as.length].focus(); }
      else if (e.key === 'Tab' && ((e.shiftKey && i === 0) || (!e.shiftKey && i === as.length - 1))) show(false);
    });
    document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !menu.contains(e.target) && !pill.contains(e.target)) show(false); });
    window.addEventListener('resize', function () { if (!menu.hidden) place(); });
    window.addEventListener('scroll', function () { if (!menu.hidden) place(); }, { passive: true });
  }

  // A link straight to a lab (#try-3d, the lab's own section, or #3d-b1p5) opens it.
  function initHash() {
    if (!gl) return;
    var h = location.hash.slice(1);
    if (!h) return;
    var m = /^3d-(.+)$/.exec(h);
    var target = m ? document.querySelector('.view3d-btn[data-build="' + m[1] + '"]') : null;
    if (!target) {
      var el = document.getElementById(h);
      if (el && (el.id === 'try-3d' || el.querySelector('button[data-lab-open]') || el.matches('.lab[data-lab]'))) {
        target = el.querySelector('button[data-lab-open]') || (el.id === 'try-3d' ? document.querySelector('button[data-lab-open]') : el);
      }
    }
    if (target) go(target);
  }

  function start() { init(); initLazy(); initNav(); initHash(); }
  window.ArduinoLabsLoader = { load: load, go: go };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

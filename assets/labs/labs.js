/* Arduino Ladder: the small loader for the 3D build viewer.
   Pages carry this file (about 2 KB), not the 3D bundle. The bundle
   (labs.bundle.js, three.js and every build, about 800 KB) is fetched only
   when someone presses "View in 3D", or straight away if the page has a
   <div class="lab" data-lab="…"> to fill. Works from file:// too.
   Without JavaScript the "View in 3D" buttons stay hidden and the flat
   diagrams teach exactly as before. */
(function () {
  var me = document.currentScript;
  var src = me && me.src ? me.src.replace(/labs\.js(\?[^#]*)?$/, 'labs.bundle.js') : 'labs.bundle.js';
  var loading = null;
  function load() {
    if (window.ArduinoLabs) return Promise.resolve();
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { loading = null; reject(new Error('could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }
  function init() {
    if (document.querySelector('.lab[data-lab]:not([data-lazy])')) load();
    if (!window.WebGLRenderingContext) return;
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
        btn.setAttribute('aria-busy', 'true');
        load().then(function () {
          btn.removeAttribute('aria-busy');
          window.ArduinoLabs.toggle(btn);
        }, function () {
          btn.removeAttribute('aria-busy');
          btn.textContent = 'The 3D view could not load';
          btn.disabled = true;
        });
      });
    })(btns[i]);
  }
  // "Open the 3D lab": a <div class="lab" data-lab="…" data-lazy hidden> waits,
  // with no bundle fetched, until its button (data-lab-open="…") is pressed.
  function initLazy() {
    if (!window.WebGLRenderingContext) return;
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
          host.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = label;
          return;
        }
        btn.setAttribute('aria-busy', 'true');
        load().then(function () {
          btn.removeAttribute('aria-busy');
          host.hidden = false;
          btn.setAttribute('aria-expanded', 'true');
          btn.setAttribute('aria-pressed', 'true');
          btn.textContent = 'Close the 3D lab';
          var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
          Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { window.ArduinoLabs.mount(host); });
        }, function () {
          btn.removeAttribute('aria-busy');
          btn.textContent = 'The 3D lab could not load';
          btn.disabled = true;
        });
      });
    })(opens[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); initLazy(); });
  else { init(); initLazy(); }
})();

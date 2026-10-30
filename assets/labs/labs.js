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
    if (document.querySelector('.lab[data-lab]')) load();
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

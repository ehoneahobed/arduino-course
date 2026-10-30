/* One section at a time.
   A band page is a long list of <section class="part" id="…"> blocks. With this
   script the learner sees one at a time, with Previous / Next, a progress bar,
   and ticks in the section bar for every section they have read. The choice and
   the progress are kept in this browser only (localStorage).
   Without JavaScript, or when printing, the whole band shows on one page as before.
   Links to anything inside a section (#idea-4-2, #try-3d, #3d-b1p5) open that section. */
(function () {
  var wrap = document.getElementById('main');
  var bar = document.querySelector('nav[aria-label="Sections"]');
  if (!wrap || !bar) return;
  var sections = [].slice.call(wrap.querySelectorAll(':scope > section.part[id]'));
  if (sections.length < 3) return;

  var band = document.documentElement.getAttribute('data-band') || location.pathname;
  var KEY = 'ladder-read-' + band;
  var PREF = 'ladder-one-page';
  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var state = load(KEY, { read: [], last: null });

  // What belongs to the first and the last page besides the numbered sections.
  var intro = [], outro = [];
  var kids = [].slice.call(wrap.children);
  var first = kids.indexOf(sections[0]), last = kids.indexOf(sections[sections.length - 1]);
  kids.forEach(function (el, i) {
    if (el === bar || el.tagName === 'HEADER') return;
    if (i < first) intro.push(el);
    else if (i > last) outro.push(el);
  });

  var titles = sections.map(function (s) {
    var a = bar.querySelector('a[href="#' + s.id + '"]');
    var h = s.querySelector('h2');
    return (a && a.textContent.trim()) || (h && h.textContent.trim()) || s.id;
  });

  // Controls: a progress strip under the section bar, and Previous / Next at the foot.
  var strip = document.createElement('div');
  strip.className = 'pg-strip';
  strip.innerHTML = '<div class="pg-meter" aria-hidden="true"><span></span></div>' +
    '<p class="pg-count" aria-live="polite"></p>' +
    '<button type="button" class="pg-mode"></button>';
  bar.insertAdjacentElement('afterend', strip);
  var foot = document.createElement('nav');
  foot.className = 'pg-foot';
  foot.setAttribute('aria-label', 'Section pages');
  bar.parentNode.insertBefore(foot, outro[0] || null);

  var cur = 0, paged = load(PREF, true) !== false;

  function indexOfTarget(id) {
    if (!id) return -1;
    var m = /^3d-(.+)$/.exec(id);
    var el = m ? document.querySelector('[data-build="' + m[1] + '"]') : document.getElementById(id);
    if (!el) return -1;
    for (var i = 0; i < sections.length; i++) if (sections[i] === el || sections[i].contains(el)) return i;
    return intro.some(function (x) { return x === el || x.contains(el); }) ? 0 : -1;
  }

  function markBar() {
    sections.forEach(function (s, i) {
      var a = bar.querySelector('a[href="#' + s.id + '"]');
      if (!a) return;
      a.classList.toggle('pg-done', state.read.indexOf(s.id) >= 0);
      if (paged && i === cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    var c = bar.querySelector('a[aria-current="step"]');
    if (c && c.scrollIntoView && bar.scrollWidth > bar.clientWidth) c.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function link(i, dir) {
    if (i < 0 || i >= sections.length) return '<span></span>';
    return '<a class="pg-' + dir + '" href="#' + sections[i].id + '"><small>' + (dir === 'prev' ? '← Previous' : 'Next →') +
      '</small><b>' + titles[i].replace(/</g, '&lt;') + '</b></a>';
  }

  function render() {
    document.documentElement.classList.toggle('pg-on', paged);
    strip.querySelector('.pg-mode').textContent = paged ? 'Show the whole band on one page' : 'Show one section at a time';
    var done = state.read.length;
    strip.querySelector('.pg-meter span').style.width = Math.round(100 * done / sections.length) + '%';
    if (!paged) {
      sections.concat(intro, outro).forEach(function (el) { el.hidden = false; });
      foot.hidden = true;
      strip.querySelector('.pg-count').textContent = done + ' of ' + sections.length + ' sections read';
      markBar();
      return;
    }
    sections.forEach(function (s, i) { s.hidden = i !== cur; });
    intro.forEach(function (el) { el.hidden = cur !== 0; });
    outro.forEach(function (el) { el.hidden = cur !== sections.length - 1; });
    foot.hidden = false;
    foot.innerHTML = link(cur - 1, 'prev') + link(cur + 1, 'next');
    strip.querySelector('.pg-count').textContent = 'Section ' + (cur + 1) + ' of ' + sections.length + ': ' + titles[cur] +
      ' · ' + done + ' read';
    markBar();
    // A 3D lab that was laid out while hidden needs to measure itself again.
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  function show(i, targetId, focus) {
    cur = Math.max(0, Math.min(sections.length - 1, i));
    var id = sections[cur].id;
    if (state.read.indexOf(id) < 0) state.read.push(id);
    state.last = id;
    save(KEY, state);
    render();
    var target = targetId && targetId !== id ? document.getElementById(targetId) : null;
    if (paged) {
      if (target) target.scrollIntoView();
      else (document.querySelector('header') || sections[cur]).scrollIntoView();
      if (focus) {
        var h = sections[cur].querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      }
    } else if (target || targetId) {
      (target || sections[cur]).scrollIntoView();
    }
  }

  function fromHash(focus) {
    var id = decodeURIComponent(location.hash.slice(1));
    var i = indexOfTarget(id);
    if (i >= 0) return show(i, id, focus);
    if (!id && state.last && indexOfTarget(state.last) >= 0) return show(indexOfTarget(state.last), null, false);
    show(0, null, false);
  }

  strip.querySelector('.pg-mode').addEventListener('click', function () {
    paged = !paged;
    save(PREF, paged);
    render();
    sections[cur].scrollIntoView();
  });
  window.addEventListener('hashchange', function () { fromHash(true); });
  // Printing always shows everything.
  window.addEventListener('beforeprint', function () { sections.concat(intro, outro).forEach(function (el) { el.hidden = false; }); });
  window.addEventListener('afterprint', render);

  // Other scripts (the 3D menu) call this before jumping to something inside a section.
  window.ArduinoPager = {
    reveal: function (el) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].contains(el)) { if (paged && i !== cur) show(i, null, false); break; }
      }
    }
  };

  fromHash(false);
})();

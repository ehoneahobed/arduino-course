/* Progress, badges and the course dashboard.
   Everything is kept in this browser only (localStorage). Nothing is sent anywhere.

   What a band needs for its badge:
     1. every section read          pager.js:  <course>-read-<band>  = {read:[ids], last}
     2. its Check yourself done     check.js:  <course>-check-<band> = {n, kinds, q:{…}}
        (every question answered; the ones with one right answer answered right;
        the open ones marked "Got it" or "Not yet" by the learner)
   Concept-lab missions (3D) are a bonus and never required: some computers cannot show 3D.
     runtime.js: ard-lab-concept-b<band> = [mission ids done]
   When a band is first found complete, <course>-badge-<band> = {at: ISO date} is kept.

   Pages use it like this:
     <div id="ladder-dash" data-base="bands/"></div>          the course home dashboard
     <a … data-ladder-card data-base="arduino/">               the site home course card
     <a class="bandcard" data-band="3" …>                      gets a quiet progress line
   The Arduino Ladder's keys start "ladder-" (pager.js, theme.js); other courses set
   <html data-course="…">. */
(function () {
  var COURSE = document.documentElement.getAttribute('data-course') || 'ladder';

  // The Arduino Ladder's bands. Section counts are only a fallback: once a band page has
  // been opened, check.js stores that page's own list of sections (<course>-meta-<band>).
  var BANDS = [
    { n: 0, colour: 'Black', title: 'Bench Ready', sections: 13 },
    { n: 1, colour: 'Brown', title: 'Signal Tower', sections: 13 },
    { n: 2, colour: 'Red', title: 'Mood Lamp', sections: 14 },
    { n: 3, colour: 'Orange', title: 'Combination Lock', sections: 18 },
    { n: 4, colour: 'Yellow', title: 'Night Guard', sections: 17 },
    { n: 5, colour: 'Green', title: 'Simon Says', sections: 16 },
    { n: 6, colour: 'Blue', title: 'Things That Move', sections: 17 },
    { n: 7, colour: 'Violet', title: 'Distance and Display', sections: 16 },
    { n: 8, colour: 'Grey', title: 'Build for Nzemaland', sections: 18 }
  ];
  var MISSIONS = 3; // every concept lab has three

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function key(name, band) { return COURSE + '-' + name + (band == null ? '' : '-' + band); }

  function status(n) {
    var b = BANDS[n] || { n: n, sections: 0 };
    var read = load(key('read', n), { read: [], last: null }) || {};
    var readIds = read.read || [];
    var meta = load(key('meta', n), null);
    var ids = meta && meta.ids && meta.ids.length ? meta.ids : null;
    var total = ids ? ids.length : b.sections;
    var nRead = ids ? ids.filter(function (id) { return readIds.indexOf(id) >= 0; }).length : Math.min(readIds.length, total);
    var missing = ids ? ids.filter(function (id) { return readIds.indexOf(id) < 0; }) : [];
    var ck = load(key('check', n), null);
    var c = { n: 0, done: 0, checkable: 0, right: 0, first: 0, self: 0, got: 0, not: 0, complete: false };
    if (ck && ck.n) {
      c.n = ck.n;
      var kinds = ck.kinds || '';
      for (var i = 1; i <= ck.n; i++) {
        var q = (ck.q || {})[i] || {};
        if (kinds.charAt(i - 1) === 'o') {
          c.self++;
          if (q.mark === 'got') c.got++;
          if (q.mark === 'not') c.not++;
          if (q.mark) c.done++;
        } else {
          c.checkable++;
          if (q.ok) { c.right++; c.done++; }
          if (q.first) c.first++;
        }
      }
      c.complete = c.done === c.n;
    }
    var m = load('ard-lab-concept-b' + n, []);
    var missions = Array.isArray(m) ? m.length : 0;
    var readDone = total > 0 && nRead >= total && (ids ? missing.length === 0 : true);
    var badge = load(key('badge', n), null);
    var complete = readDone && c.complete;
    if (complete && !badge) { badge = { at: new Date().toISOString() }; save(key('badge', n), badge); }
    return {
      n: n, band: b, read: nRead, total: total, missing: missing, readDone: readDone,
      check: c, missions: missions, missionsTotal: MISSIONS,
      started: nRead > 0 || c.done > 0 || missions > 0,
      complete: complete || !!badge, badge: badge
    };
  }

  function all() { return BANDS.map(function (b) { return status(b.n); }); }

  // A small resistor: leads, a body, three stripes in the band's colour and a gold one.
  // Not earned yet: an outline only.
  function badge(n, earned, size) {
    var w = size || 46, h = Math.round(w * 18 / 46);
    var c = 'var(--b' + n + ')';
    var name = (BANDS[n] ? BANDS[n].colour : '') + ' badge' + (earned ? '' : ' (not earned yet)');
    return '<svg class="lp-badge' + (earned ? ' on' : '') + '" viewBox="0 0 46 18" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(name) + '">' +
      '<path d="M1 9h8M37 9h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>' +
      '<rect x="8.5" y="2" width="29" height="14" rx="6" fill="' + (earned ? 'var(--lp-body)' : 'none') + '" stroke="' + (earned ? c : 'currentColor') + '" stroke-width="1.4"' + (earned ? '' : ' stroke-dasharray="2.4 2" opacity=".5"') + '/>' +
      (earned
        ? '<rect x="13" y="2.7" width="3.2" height="12.6" fill="' + c + '"/><rect x="18.5" y="2.7" width="3.2" height="12.6" fill="' + c + '"/><rect x="24" y="2.7" width="3.2" height="12.6" fill="' + c + '"/><rect x="31" y="2.7" width="2.4" height="12.6" fill="#C9A227"/>'
        : '') + '</svg>';
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }

  // Where to go next: the section last opened, or the next band if that one is finished.
  function next(base) {
    base = base || '';
    var w = load(key('where'), null);
    var list = all();
    if (w && w.band !== '' && BANDS[+w.band]) {
      var s = list[+w.band];
      if (s.complete && BANDS[+w.band + 1] && !list[+w.band + 1].started) {
        var b = BANDS[+w.band + 1];
        return { band: b.n, title: 'Start here', href: base + 'band-' + b.n + '.html', label: 'Next: Band ' + b.n + ' · ' + b.title, fresh: true };
      }
      return { band: +w.band, id: w.id, title: w.title || '', href: base + 'band-' + w.band + '.html#' + encodeURIComponent(w.id || ''),
        label: 'Band ' + w.band + ' · ' + BANDS[+w.band].title };
    }
    for (var i = list.length - 1; i >= 0; i--) if (list[i].started) return { band: i, title: '', href: base + 'band-' + i + '.html', label: 'Band ' + i + ' · ' + BANDS[i].title };
    return null;
  }

  function overall() {
    var list = all(), read = 0, total = 0, done = 0;
    list.forEach(function (s) { read += s.read; total += s.total; if (s.complete) done++; });
    return { list: list, read: read, total: total, done: done, started: list.some(function (s) { return s.started; }) };
  }

  // ---------- 3D builds run (any page with a 3D build) ----------
  // (Builds wired right in a build's Build tab, "Build it yourself", are recorded by the 3D bundle itself
  // in <course>-builds-wired = { <build id>: { title, n, first, last } }; profile.js shows them.)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.sim-run');
    if (!btn) return;
    if (!/^Run/.test(btn.getAttribute('aria-label') || '')) return; // not Pause or Carry on
    var host = btn.closest('.lab');
    var id = host && (host.dataset.build || host.dataset.lab);
    if (!id) return;
    var runs = load(key('3d-runs'), {}) || {};
    var r = runs[id] || { n: 0, first: new Date().toISOString() };
    r.n++;
    r.last = new Date().toISOString();
    r.title = (host.getAttribute('aria-label') || '').replace(/^3D (view|lab):\s*/i, '') || r.title || id;
    runs[id] = r;
    save(key('3d-runs'), runs);
  }, true);

  // ---------- the course home: a dashboard above the band list ----------
  function dash(el) {
    var base = el.getAttribute('data-base') || '';
    var o = overall();
    var nx = next(base);
    var prof = el.getAttribute('data-profile') || 'profile.html';
    var html;
    if (!o.started) {
      html = '<div class="lp-dash-main"><p class="lp-k">Your progress</p>' +
        '<p class="lp-line">You have not started yet. As you read, answer the Check yourself questions and finish bands, your progress and badges show here.</p>' +
        '<p class="lp-acts"><a class="lp-go" href="' + base + 'band-0.html">Start with Band 0 &rarr;</a></p></div>';
    } else {
      var pct = o.total ? Math.round(100 * o.read / o.total) : 0;
      html = '<div class="lp-dash-main"><p class="lp-k">Continue where you left off</p>' +
        (nx ? '<a class="lp-cont" href="' + esc(nx.href) + '"><span class="lp-dot" style="background:var(--b' + nx.band + ')"></span><span><b>' + esc(nx.label) + '</b>' +
          (nx.title ? '<small>' + esc(nx.title) + '</small>' : '') + '</span><span class="lp-arr" aria-hidden="true">&rarr;</span></a>' : '') +
        '<div class="lp-meter" role="img" aria-label="' + pct + ' percent of the course read"><span style="width:' + pct + '%"></span></div>' +
        '<p class="lp-line">' + o.done + ' of 9 bands complete &middot; ' + o.read + ' of ' + o.total + ' sections read</p></div>' +
        '<div class="lp-dash-side"><div class="lp-badges">' + o.list.map(function (s) { return badge(s.n, s.complete, 40); }).join('') + '</div>' +
        '<a class="lp-small" href="' + esc(prof) + '">My progress and badges &rarr;</a></div>';
    }
    el.innerHTML = html;
    el.hidden = false;
    // a quiet line on each band card
    [].slice.call(document.querySelectorAll('.bandcard[data-band]')).forEach(function (card) {
      var s = o.list[+card.getAttribute('data-band')];
      var old = card.querySelector('.lp-card');
      if (old) old.remove();
      if (!s || !s.started) return;
      var p = document.createElement('span');
      p.className = 'lp-card';
      p.innerHTML = s.complete
        ? badge(s.n, true, 34) + '<span>Complete' + (s.badge && s.badge.at ? ', ' + esc(fmtDate(s.badge.at)) : '') + '</span>'
        : '<span>' + s.read + '/' + s.total + ' read</span><span aria-hidden="true">&middot;</span><span>check ' + s.check.done + '/' + (s.check.n || 6) + '</span>' +
          (s.missions ? '<span aria-hidden="true">&middot;</span><span>3D ' + s.missions + '/' + s.missionsTotal + '</span>' : '');
      var go = card.querySelector('.go');
      card.insertBefore(p, go || null);
    });
  }

  // ---------- the site home: one line and Continue on the course card ----------
  function card(el) {
    var base = el.getAttribute('data-base') || '';
    var o = overall();
    if (!o.started) return;
    var nx = next(base + 'bands/');
    var line = el.querySelector('.lp-hub') || document.createElement('span');
    line.className = 'lp-hub';
    line.innerHTML = '<span class="lp-hub-b">' + o.list.map(function (s) { return badge(s.n, s.complete, 26); }).join('') + '</span>' +
      '<span>' + o.done + ' of 9 bands complete &middot; ' + o.read + ' of ' + o.total + ' sections read</span>';
    var go = el.querySelector('.c-go');
    el.insertBefore(line, go || null);
    if (nx && go) {
      el.setAttribute('href', nx.href);
      go.innerHTML = 'Continue: ' + esc(nx.label) + ' &rarr;';
    }
  }

  window.LadderProgress = {
    course: COURSE, bands: BANDS, load: load, save: save, key: key, esc: esc,
    status: status, all: all, overall: overall, next: next, badge: badge, fmtDate: fmtDate
  };

  function boot() {
    var d = document.getElementById('ladder-dash');
    if (d) dash(d);
    [].slice.call(document.querySelectorAll('[data-ladder-card]')).forEach(card);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // Coming back with the Back button shows the page from memory: bring it up to date.
  window.addEventListener('pageshow', function (e) { if (e.persisted) boot(); });
})();

/* "Check yourself", made interactive, and the band's badge.
   Progressive enhancement: the band page keeps its plain list of questions and its
   <details> answers, so it still works without JavaScript and prints as before.
   With this script each question becomes one of three kinds, read from data attributes
   on its <li> (inside <ol class="num" data-check>):

     data-kind="choice"  data-choices="A|B|`code`|D"  data-correct="2"   (1 = first choice)
     data-kind="number"  data-correct="1250|1.25"  data-unit="milliseconds"
     data-kind="list"    data-correct="0,40,80,120,160"                  (a list of numbers)
     data-kind="open"    the learner writes, compares with the model answer, and marks
                         themself "Got it" or "Not yet"
   and for every kind:
     data-see="means"    the section that teaches it (or "band-3.html#pullup" + data-see-label)
     data-hint="…"       optional extra hint after a wrong answer
     data-why-<k>="…"    optional note for one particular wrong answer (a choice number,
                         or a number someone types)
   The model answers come from the <details>: each "<strong>N.</strong>" starts answer N.
   Answers and results are kept in this browser only: <course>-check-<band>. */
(function () {
  var P = window.LadderProgress;
  var root = document.documentElement;
  var band = root.getAttribute('data-band');
  if (!P || band === null) return;
  var me = document.currentScript;
  var PROFILE = (me && me.getAttribute('data-profile')) || '../profile.html';
  var esc = P.esc;
  var bandInfo = P.bands[+band] || { colour: '', title: '' };

  // This page's own list of sections, so the badge always matches the page.
  var wrap = document.getElementById('main');
  var sections = wrap ? [].slice.call(wrap.querySelectorAll(':scope > section.part[id]')) : [];
  if (sections.length) P.save(P.key('meta', band), { ids: sections.map(function (s) { return s.id; }) });

  function sectionLabel(id) {
    var s = document.getElementById(id);
    if (!s) return id;
    var sec = s.closest('section.part[id]') || s;
    var tag = sec.querySelector('.parthead .tag'), h = sec.querySelector('h2');
    var t = (tag ? tag.textContent.trim() : ''), title = h ? h.textContent.trim() : id;
    return /^Part\b/.test(t) ? t + ': ' + title : title;
  }
  function seeLink(li, lead) {
    var see = li.getAttribute('data-see');
    if (!see) return '';
    var href = see.indexOf('.html') >= 0 ? see : '#' + see;
    var label = li.getAttribute('data-see-label') || sectionLabel(see);
    return (lead || 'Look again at') + ' <a href="' + esc(href) + '">' + esc(label) + '</a>.';
  }
  // Choice text: plain words, with `backticks` for code.
  function fmt(s) {
    return String(s).split('`').map(function (part, i) { return i % 2 ? '<code>' + esc(part) + '</code>' : esc(part); }).join('');
  }

  // ---------------- Check yourself ----------------
  var sec = document.getElementById('check');
  var ol = sec && sec.querySelector('ol.num[data-check]');
  var details = sec && sec.querySelector('details');
  var KEY = P.key('check', band);
  var lis = ol ? [].slice.call(ol.children).filter(function (x) { return x.tagName === 'LI'; }) : [];
  var data = P.load(KEY, null);
  if (!data || typeof data !== 'object') data = {};
  data.q = data.q || {};
  data.n = lis.length;
  data.kinds = lis.map(function (li) { return li.getAttribute('data-kind') === 'open' ? 'o' : 'c'; }).join('');
  function store() { P.save(KEY, data); refresh(); }
  if (lis.length) P.save(KEY, data);

  // the model answers, by number
  var answers = {};
  if (details) {
    var inner = details.querySelector('.inner') || details, cur = null;
    [].slice.call(inner.children).forEach(function (p) {
      var s = p.firstElementChild, m = null;
      if (s && s.tagName === 'STRONG' && p.firstChild === s) m = /^(\d+)\.$/.exec(s.textContent.trim());
      var c = p.cloneNode(true);
      if (m) {
        cur = m[1];
        c.removeChild(c.firstElementChild);
        if (c.firstChild && c.firstChild.nodeType === 3) c.firstChild.nodeValue = c.firstChild.nodeValue.replace(/^\s+/, '');
        answers[cur] = '';
      }
      if (cur) answers[cur] += c.outerHTML;
    });
  }

  var box = null, sum = null;
  if (ol && lis.length) {
    ol.classList.add('ck-hide');
    if (details) details.classList.add('ck-hide');
    box = document.createElement('div');
    box.className = 'ck';
    sum = document.createElement('p');
    sum.className = 'ck-sum';
    sum.setAttribute('aria-live', 'polite');
    box.appendChild(sum);
    lis.forEach(function (li, i) { box.appendChild(build(li, i + 1)); });
    var note = document.createElement('p');
    note.className = 'ck-note';
    note.innerHTML = 'Your answers are kept in this browser only. <a href="' + esc(PROFILE) + '">My progress</a>';
    box.appendChild(note);
    (details || ol).insertAdjacentElement('afterend', box);
  }

  function qstate(n) { return data.q[n] || (data.q[n] = {}); }

  function build(li, n) {
    var kind = li.getAttribute('data-kind') || 'open';
    var el = document.createElement('div');
    el.className = 'ck-q';
    el.setAttribute('data-kind', kind);
    el.id = 'check-q' + n;
    var body = '';
    var aid = 'ck-a' + n;
    if (kind === 'choice') {
      var ch = (li.getAttribute('data-choices') || '').split('|');
      body = '<div class="ck-opts" role="group" aria-label="Choose one answer">' + ch.map(function (c, i) {
        return '<button type="button" class="ck-opt" data-i="' + (i + 1) + '">' + fmt(c) + '</button>';
      }).join('') + '</div>';
    } else if (kind === 'number' || kind === 'list') {
      var unit = li.getAttribute('data-unit');
      body = '<form class="ck-form" novalidate><label class="ck-lab" for="ck-in' + n + '">Your answer</label><span class="ck-row">' +
        '<input id="ck-in' + n + '" class="ck-in' + (kind === 'list' ? ' wide' : '') + '" type="text" autocomplete="off" spellcheck="false" inputmode="' + (kind === 'number' ? 'decimal' : 'text') + '"' +
        (kind === 'list' ? ' placeholder="for example 1, 2, 3"' : '') + '>' +
        (unit ? '<span class="ck-unit">' + esc(unit) + '</span>' : '') +
        '<button type="submit" class="ck-btn">Check</button></span></form>';
    } else {
      body = '<label class="ck-lab" for="ck-in' + n + '">Your answer</label>' +
        '<textarea id="ck-in' + n + '" class="ck-text" rows="3" placeholder="Type your answer here, or write it on paper. Then compare."></textarea>' +
        '<div class="ck-acts"><button type="button" class="ck-btn ck-reveal">Compare with the model answer</button></div>' +
        '<div class="ck-mark" hidden><span>How did you do?</span><button type="button" class="ck-btn ck-got" aria-pressed="false">Got it</button><button type="button" class="ck-btn ck-not" aria-pressed="false">Not yet</button></div>';
    }
    el.innerHTML = '<div class="ck-head"><span class="ck-n" aria-hidden="true">' + n + '</span><div class="ck-qt"><span class="sr">Question ' + n + '. </span>' + li.innerHTML + '</div><span class="ck-st"></span></div>' +
      '<div class="ck-body">' + body + '<div class="ck-fb" aria-live="polite"></div>' +
      (kind === 'open' ? '' : '<button type="button" class="ck-show" aria-controls="' + aid + '">Show me the answer</button>') +
      '<div class="ck-ans" id="' + aid + '" hidden><p class="ck-ans-k">' + (kind === 'open' ? 'Model answer' : 'The answer') + '</p>' + (answers[n] || '') + '</div></div>';
    el._li = li;
    el._n = n;
    wire(el, li, n, kind);
    paint(el);
    return el;
  }

  function judge(li, kind, raw) {
    var acc = (li.getAttribute('data-correct') || '').split('|').map(function (s) { return s.trim().toLowerCase(); });
    var t = String(raw).trim().toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1');
    if (kind === 'list') {
      var got = (t.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      var want = acc[0].split(',').map(Number);
      var ok = got.length === want.length && got.slice().sort(function (a, b) { return a - b; }).every(function (v, i) {
        return v === want.slice().sort(function (a, b) { return a - b; })[i];
      });
      var extra = got.filter(function (v) { return want.indexOf(v) < 0; });
      return { ok: ok, why: extra.map(function (v) { return li.getAttribute('data-why-' + String(v).replace('.', '-')); }).filter(Boolean)[0] };
    }
    var word = t.replace(/[.!]+$/, '');
    var num = /-?\d+(\.\d+)?/.exec(t);
    for (var i = 0; i < acc.length; i++) {
      if (/^-?\d+(\.\d+)?$/.test(acc[i])) { if (num && Math.abs(parseFloat(num[0]) - parseFloat(acc[i])) < 1e-9) return { ok: true }; }
      else if (word === acc[i]) return { ok: true };
    }
    return { ok: false, why: num ? li.getAttribute('data-why-' + num[0].replace('.', '-')) : null };
  }

  function wire(el, li, n, kind) {
    var q = qstate(n);
    function answered(ok, why) {
      q.tries = (q.tries || 0) + 1;
      if (ok) { if (q.tries === 1 && !q.shown) q.first = true; q.ok = true; q.at = Date.now(); q.why = null; }
      else { q.ok = false; q.why = why || null; }
      store();
      paint(el, true);
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('ck-opt')) {
        if (q.ok) return;
        var i = +b.getAttribute('data-i');
        q.a = i;
        q.wrong = q.wrong || [];
        var right = i === +li.getAttribute('data-correct');
        if (!right && q.wrong.indexOf(i) < 0) q.wrong.push(i);
        answered(right, right ? null : li.getAttribute('data-why-' + i));
        var nb = el.querySelector('.ck-opt[data-i="' + i + '"]');
        if (nb) nb.focus();
      } else if (b.classList.contains('ck-show')) {
        q.shown = true;
        store();
        paint(el);
        var a = el.querySelector('.ck-ans');
        if (a) { a.setAttribute('tabindex', '-1'); a.focus(); }
      } else if (b.classList.contains('ck-reveal')) {
        q.shown = true;
        store();
        paint(el);
        var g = el.querySelector('.ck-got');
        if (g) g.focus();
      } else if (b.classList.contains('ck-got') || b.classList.contains('ck-not')) {
        q.mark = b.classList.contains('ck-got') ? 'got' : 'not';
        q.at = Date.now();
        store();
        paint(el, true);
      } else if (b.classList.contains('ck-again')) {
        delete data.q[n];
        q = qstate(n);
        store();
        var inp = el.querySelector('.ck-in,.ck-text');
        if (inp) inp.value = '';
        paint(el);
        if (inp) inp.focus(); else { var f = el.querySelector('.ck-opt'); if (f) f.focus(); }
      }
    });
    var form = el.querySelector('.ck-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = el.querySelector('.ck-in').value;
      if (!v.trim()) { el.querySelector('.ck-fb').innerHTML = '<p class="ck-say">Type your answer first, then press Check.</p>'; return; }
      q.a = v;
      var r = judge(li, kind, v);
      answered(r.ok, r.why);
    });
    var ta = el.querySelector('.ck-text');
    if (ta) {
      var t;
      ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { q.a = ta.value; P.save(KEY, data); }, 300); });
    }
  }

  function paint(el, fresh) {
    var n = el._n, li = el._li, kind = el.getAttribute('data-kind'), q = qstate(n);
    var fb = el.querySelector('.ck-fb'), ans = el.querySelector('.ck-ans'), show = el.querySelector('.ck-show'), st = el.querySelector('.ck-st');
    var hint = li.getAttribute('data-hint');
    var html = '';
    if (kind === 'open') {
      var ta = el.querySelector('.ck-text');
      if (ta && document.activeElement !== ta && q.a != null) ta.value = q.a;
      ans.hidden = !q.shown;
      el.querySelector('.ck-reveal').hidden = !!q.shown;
      el.querySelector('.ck-mark').hidden = !q.shown;
      el.querySelector('.ck-got').setAttribute('aria-pressed', q.mark === 'got' ? 'true' : 'false');
      el.querySelector('.ck-not').setAttribute('aria-pressed', q.mark === 'not' ? 'true' : 'false');
      if (q.mark === 'got') html = '<p class="ck-say ok">Good. Marked as got it.</p>';
      else if (q.mark === 'not') html = '<p class="ck-say">That is an honest mark, and that is how this works. ' + seeLink(li, 'Read') + ' Then come back and try this one again.</p>';
      el.setAttribute('data-state', q.mark || (q.shown ? 'shown' : ''));
      st.textContent = q.mark === 'got' ? '✓' : q.mark === 'not' ? 'Not yet' : '';
    } else {
      if (kind === 'choice') {
        var right = +li.getAttribute('data-correct');
        [].slice.call(el.querySelectorAll('.ck-opt')).forEach(function (b) {
          var i = +b.getAttribute('data-i');
          var isRight = !!q.ok && i === right, isWrong = (q.wrong || []).indexOf(i) >= 0;
          b.classList.toggle('is-right', isRight);
          b.classList.toggle('is-wrong', isWrong && !q.ok);
          b.setAttribute('aria-pressed', q.a === i ? 'true' : 'false');
          b.disabled = !!q.ok && !isRight;
          b.setAttribute('aria-label', b.textContent + (isRight ? ' (right)' : isWrong && !q.ok ? ' (not this one)' : ''));
        });
      } else {
        var inp = el.querySelector('.ck-in');
        if (inp && document.activeElement !== inp && q.a != null) inp.value = q.a;
        if (inp) inp.classList.toggle('is-right', !!q.ok);
      }
      if (q.ok) html = '<p class="ck-say ok"><b>Right.</b>' + (q.first ? ' First time.' : '') + '</p>';
      else if (q.tries) html = '<p class="ck-say"><b>Not quite.</b> ' + (q.why ? fmt(q.why) + ' ' : '') + (hint ? fmt(hint) + ' ' : '') + seeLink(li) + ' Then try again' + (q.shown ? '.' : ', or show the answer.') + '</p>';
      ans.hidden = !(q.ok || q.shown);
      show.hidden = !ans.hidden;
      el.setAttribute('data-state', q.ok ? 'right' : q.tries ? 'wrong' : '');
      st.textContent = q.ok ? '✓' : '';
    }
    var again = (q.ok || q.mark) ? '<button type="button" class="ck-again">Answer it again</button>' : '';
    fb.innerHTML = html + again;
    if (fresh) { fb.classList.remove('ck-pop'); void fb.offsetWidth; fb.classList.add('ck-pop'); }
  }

  // ---------------- the band's badge ----------------
  var cards = [];
  if (box) cards.push(mkCard(box, 'afterend'));
  var lastSec = sections[sections.length - 1];
  if (lastSec && lastSec !== sec) {
    var col = lastSec.querySelector(':scope > .col') || lastSec;
    cards.push(mkCard(col, 'beforeend'));
  }
  function mkCard(ref, where) {
    var d = document.createElement('div');
    d.className = 'ck-done';
    d.setAttribute('aria-live', 'polite');
    ref.insertAdjacentElement(where, d);
    return d;
  }
  var wasComplete = P.status(+band).complete;

  function titleOf(id) {
    var a = document.querySelector('nav[aria-label="Sections"] > a[href="#' + id + '"]');
    return a ? a.textContent.replace(/✓/g, '').trim() : sectionLabel(id);
  }

  function refresh() {
    var s = P.status(+band);
    if (sum) {
      var c = s.check;
      sum.textContent = c.done === c.n ? 'All ' + c.n + ' done.' : c.done + ' of ' + c.n + ' done';
    }
    var nextBand = P.bands[+band + 1];
    var html;
    if (s.complete) {
      html = '<div class="ck-done-in done">' + P.badge(+band, true, 72) + '<div><p class="ck-done-k">Band ' + esc(band) + ' complete</p>' +
        '<p>You earned the ' + esc(bandInfo.colour) + ' badge' + (s.badge && s.badge.at ? ' on ' + esc(P.fmtDate(s.badge.at)) : '') + '.' +
        (s.missions >= s.missionsTotal ? ' Every 3D mission done too.' : '') + '</p>' +
        '<p class="ck-done-acts">' + (nextBand ? '<a class="ck-next" href="band-' + nextBand.n + '.html">Next: Band ' + nextBand.n + ' · ' + esc(nextBand.title) + ' &rarr;</a>' : '<a class="ck-next" href="' + esc(PROFILE) + '">See all your badges &rarr;</a>') +
        (nextBand ? '<a href="' + esc(PROFILE) + '">My progress</a>' : '') + '</p></div></div>';
    } else {
      var miss = s.missing.slice(0, 6).map(function (id) { return '<a href="#' + esc(id) + '">' + esc(titleOf(id)) + '</a>'; }).join(', ');
      if (s.missing.length > 6) miss += ' and ' + (s.missing.length - 6) + ' more';
      html = '<div class="ck-done-in">' + P.badge(+band, false, 56) + '<div><p class="ck-done-k">For the ' + esc(bandInfo.colour) + ' badge</p><ul class="ck-list">' +
        '<li class="' + (s.readDone ? 'ok' : '') + '">Read every section <span>(' + s.read + ' of ' + s.total + ')</span>' + (!s.readDone && miss ? '<small>Not opened yet: ' + miss + '</small>' : '') + '</li>' +
        '<li class="' + (s.check.complete ? 'ok' : '') + '"><a href="#check">Check yourself</a> <span>(' + s.check.done + ' of ' + (s.check.n || lis.length) + ' done)</span></li>' +
        '<li class="bonus' + (s.missions >= s.missionsTotal ? ' ok' : '') + '">3D missions <span>(' + s.missions + ' of ' + s.missionsTotal + ', a bonus, not needed)</span></li>' +
        '</ul></div></div>';
    }
    cards.forEach(function (d) {
      d.innerHTML = html;
      if (s.complete && !wasComplete) d.classList.add('ck-new');
    });
    if (s.complete && !wasComplete) wasComplete = true;
  }
  refresh();
  document.addEventListener('pager:read', refresh);
  document.addEventListener('lab-missions', function () { setTimeout(refresh, 0); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });

  // ---------------- a quiet "My progress" link at the top of the sidebar ----------------
  var strip = document.querySelector('.side-head .pg-strip');
  if (strip && !strip.querySelector('.side-prof')) {
    var a = document.createElement('a');
    a.className = 'side-prof';
    a.href = PROFILE;
    a.textContent = 'My progress';
    strip.appendChild(a);
  }
})();

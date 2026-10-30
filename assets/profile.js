/* The learner's profile page (arduino/profile.html): name, badges, scores, 3D,
   a printable record, and moving progress between computers.
   Everything stays in this browser (localStorage) unless the learner exports it. */
(function () {
  var P = window.LadderProgress;
  if (!P) return;
  var esc = P.esc, C = P.course;
  var $ = function (s) { return document.querySelector(s); };
  var NAME = P.key('name');
  // What "my progress" is: the course's keys (but not the light/dark or layout choices),
  // the 3D missions and the learner's own edited sketches.
  var PREFS = [C + '-theme', C + '-one-page', C + '-side-hidden'];
  function mine(k) {
    if (PREFS.indexOf(k) >= 0) return false;
    if (k.indexOf(C + '-') === 0) return true;
    return C === 'ladder' && (k.indexOf('ard-lab-') === 0 || k.indexOf('ard-sketch-edit:') === 0);
  }
  function keys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (mine(k)) out.push(k); } } catch (e) {}
    return out.sort();
  }
  function stamp(iso) { return iso ? P.fmtDate(iso) : ''; }

  function render() {
    var o = P.overall();
    var name = P.load(NAME, '') || '';
    var inp = $('#pf-name');
    if (inp && document.activeElement !== inp) inp.value = name;

    // badges
    $('#pf-badges').innerHTML = o.list.map(function (s) {
      var b = s.band;
      var line = s.complete ? 'Complete' + (s.badge && s.badge.at ? ', ' + esc(stamp(s.badge.at)) : '')
        : s.started ? s.read + ' of ' + s.total + ' read · check ' + s.check.done + ' of ' + (s.check.n || 6) : 'Not started';
      return '<a class="pf-b' + (s.complete ? '' : ' off') + '" href="bands/band-' + s.n + '.html">' + P.badge(s.n, s.complete, 46) +
        '<span><b>Band ' + s.n + ' · ' + esc(b.colour) + '</b><small>' + esc(b.title) + '</small><small>' + line + '</small></span></a>';
    }).join('');
    $('#pf-summary').textContent = o.done + ' of 9 bands complete · ' + o.read + ' of ' + o.total + ' sections read';

    // the table
    var rows = o.list.map(function (s) {
      var c = s.check;
      var checked = c.n ? (c.checkable ? c.right + ' of ' + c.checkable + ' right' + (c.first ? ' (' + c.first + ' first time)' : '') : 'none in this band') : '<span class="dim">not opened</span>';
      var self = c.n ? c.got + ' got it' + (c.not ? ', ' + c.not + ' not yet' : '') + ' <span class="dim">of ' + c.self + '</span>' : '<span class="dim">–</span>';
      return '<tr><td>Band ' + s.n + ' · ' + esc(s.band.title) + '</td><td>' + s.read + ' of ' + s.total + '</td><td>' + checked + '</td><td>' + self + '</td>' +
        '<td>' + (s.missions ? s.missions + ' of ' + s.missionsTotal : '<span class="dim">0 of ' + s.missionsTotal + '</span>') + '</td>' +
        '<td>' + (s.complete ? esc(stamp(s.badge && s.badge.at)) || 'Yes' : '<span class="dim">not yet</span>') + '</td></tr>';
    }).join('');
    $('#pf-rows').innerHTML = rows;

    // 3D builds run
    var runs = P.load(P.key('3d-runs'), {}) || {};
    var ids = Object.keys(runs).sort();
    $('#pf-runs').innerHTML = ids.length
      ? '<ul class="plain pf-runs">' + ids.map(function (id) { var r = runs[id]; return '<li>' + esc(r.title || id) + ' <span>(' + r.n + (r.n === 1 ? ' run' : ' runs') + ')</span></li>'; }).join('') + '</ul>'
      : '<p class="note">None yet. On a band page, press <b>View in 3D</b> beside a wiring picture, then <b>Run</b> in the panel.</p>';
    // builds wired in "Build it yourself" (the Build tab of a 3D build) and checked right
    var wired = P.load(P.key('builds-wired'), {}) || {};
    var wids = Object.keys(wired).sort();
    var wEl = $('#pf-wired');
    if (wEl) wEl.innerHTML = wids.length
      ? '<ul class="plain pf-runs">' + wids.map(function (id) { var r = wired[id]; return '<li>' + esc(r.title || id) + ' <span>(' + (r.last ? 'right on ' + esc(stamp(r.last)) : 'right') + ')</span></li>'; }).join('') + '</ul>'
      : '<p class="note">None yet. In a 3D build, open the <b>Build</b> tab and choose <b>Build it yourself</b>: place the parts and wires on an empty board, then press <b>Check my wiring</b>.</p>';
    var edits = keys().filter(function (k) { return k.indexOf('ard-sketch-edit:') === 0; }).length;
    $('#pf-edits').textContent = edits ? 'You have changed ' + edits + (edits === 1 ? ' sketch' : ' sketches') + ' in the 3D code editor. Those are kept here too, and travel with Export.' : '';

    // the certificate
    var who = $('#pf-cert-name');
    who.textContent = name || 'Type your name above';
    who.classList.toggle('empty', !name);
    $('#pf-cert-line').textContent = o.done === 9 ? 'has completed every band of the Arduino Ladder.'
      : 'has completed ' + o.done + ' of the nine bands of the Arduino Ladder.';
    $('#pf-cert-b').innerHTML = o.list.map(function (s) {
      var c = s.check;
      return '<div>' + P.badge(s.n, s.complete, 40) + '<span>Band ' + s.n + ' · ' + esc(s.band.colour) +
        '<small>' + (s.complete ? 'Complete ' + esc(stamp(s.badge && s.badge.at)) : s.started ? s.read + '/' + s.total + ' read, check ' + c.done + '/' + (c.n || 6) : 'Not started') + '</small></span></div>';
    }).join('');
    var tr = 0, tc = 0, tg = 0, ts = 0;
    o.list.forEach(function (s) { tr += s.check.right; tc += s.check.checkable; tg += s.check.got; ts += s.check.self; });
    var m = 0; o.list.forEach(function (s) { m += s.missions; });
    $('#pf-cert-score').textContent = 'Check yourself: ' + tr + (tr === 1 ? ' answer' : ' answers') + ' checked right, ' + tg + (tg === 1 ? ' open answer' : ' open answers') + ' marked "got it". ' +
      (m ? '3D missions done: ' + m + ' of 27. ' : '') + (wids.length ? 'Builds wired right in 3D: ' + wids.length + '. ' : '') + o.read + ' of ' + o.total + ' sections read.';
    $('#pf-cert-date').textContent = 'Printed ' + P.fmtDate(new Date().toISOString());
  }

  // name
  var nameIn = $('#pf-name'), saved = $('#pf-saved'), t;
  nameIn.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      var v = nameIn.value.trim().slice(0, 80);
      if (v) P.save(NAME, v); else { try { localStorage.removeItem(NAME); } catch (e) {} }
      saved.textContent = v ? 'Saved on this computer.' : '';
      render();
    }, 250);
  });

  $('#pf-print').addEventListener('click', function () { render(); window.print(); });

  var msg = $('#pf-msg');
  function say(text, bad) { msg.textContent = text; msg.classList.toggle('bad', !!bad); }

  // export: a small JSON file
  $('#pf-export').addEventListener('click', function () {
    var data = {};
    keys().forEach(function (k) { try { data[k] = localStorage.getItem(k); } catch (e) {} });
    var file = { format: 'bih-progress', course: C, version: 1, exported: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    var who = (P.load(NAME, '') || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    a.download = 'arduino-ladder-progress' + (who ? '-' + who : '') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    say('Saved a file called ' + a.download + ' (look in your Downloads folder). Copy it to the other computer and press Import there.');
  });

  // import: read the file, then ask before replacing anything
  var pending = null;
  var file = $('#pf-file');
  $('#pf-import').addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var j = null;
      try { j = JSON.parse(r.result); } catch (e) {}
      if (!j || j.format !== 'bih-progress' || j.course !== C || !j.data || typeof j.data !== 'object') {
        say('That file is not an Arduino Ladder progress file. Choose the .json file that Export made.', true);
        return;
      }
      var ks = Object.keys(j.data).filter(function (k) { return mine(k) && typeof j.data[k] === 'string'; });
      pending = { keys: ks, data: j.data };
      $('#pf-import-what').textContent = 'This file was exported on ' + P.fmtDate(j.exported) + ' and holds ' + ks.length + ' saved items. Importing replaces the progress on this computer with the progress in the file.';
      say('');
      $('#pf-import-ask').hidden = false;
      $('#pf-import-yes').focus();
    };
    r.readAsText(f);
  });
  $('#pf-import-yes').addEventListener('click', function () {
    if (!pending) return;
    try {
      keys().forEach(function (k) { localStorage.removeItem(k); });
      pending.keys.forEach(function (k) { localStorage.setItem(k, pending.data[k]); });
      say('Imported. Your progress from the file is now on this computer.');
    } catch (e) { say('Could not save here: this browser may be full or in private mode.', true); }
    pending = null;
    $('#pf-import-ask').hidden = true;
    render();
  });
  $('#pf-import-no').addEventListener('click', function () { pending = null; $('#pf-import-ask').hidden = true; say('Nothing was changed.'); });

  // clear, after asking
  $('#pf-clear').addEventListener('click', function () { $('#pf-clear-ask').hidden = false; $('#pf-clear-no').focus(); });
  $('#pf-clear-no').addEventListener('click', function () { $('#pf-clear-ask').hidden = true; say('Nothing was changed.'); $('#pf-clear').focus(); });
  $('#pf-clear-yes').addEventListener('click', function () {
    keys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    $('#pf-clear-ask').hidden = true;
    nameIn.value = '';
    saved.textContent = '';
    say('Your progress has been cleared from this computer.');
    render();
  });

  render();
  window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  window.addEventListener('beforeprint', render);
})();

// The Build tab of every 3D build: a guided build, and "Build it yourself".
//
// Guided build: the build one part at a time, in the order the page's own
// steps place them (read from the steps and tables after the wiring picture;
// the course's usual order when the page cannot say). Each part drops into its
// holes, the holes light up and are named, with the page's "You should see".
//
// Build it yourself: an empty breadboard and the Uno, a tray of this build's
// parts, and as many jumper wires as you like. Tap a hole (or move the gold
// ring with the arrow keys and press Enter) for each leg. "Check my wiring"
// runs the course's rules and compares what is joined to what with the
// build's own wiring (practice-rules.js), so any equivalent placement passes.
// When it is right (or wrong but safe), "Run the sketch on your build" opens
// the same 3D view on the learner's own wiring, with the virtual Arduino.
//
// Nothing here rebuilds the scene while parts are placed: each placed part is
// one small group, and holes are lit through the board's instanced colours.
// The learner's build is kept per build in localStorage (<course>-build-<id>);
// a right build is recorded in <course>-builds-wired (My progress shows it).
import { THREE, label, setLabel, icon, inkScene } from './runtime.js';
import * as P from './parts.js';
import DATA from './builds.json';
import * as R from './practice-rules.js';

const { V } = P;
const BT = 1.3;
const HOUSE = 1.5;
const GOLD = 0xffbe00;
const BAD = 0xe0475f;
const SOFT = 0xf3d27a;
const PAL = ['#FFBE00', '#1FB5A6', '#E0479E', '#FF7A1A', '#4FA3F0', '#8BC34A'];
const ROWS = ['+top', '-top', 'j', 'i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a', '-bot', '+bot', 'dig', 'pwr'];
const COLOURS = [
  ['auto', 'As the course draws it'], ['#2E7D46', 'Green'], ['#C8452F', 'Red'], ['#3D6FA8', 'Blue'], ['#2B2F31', 'Black'],
  ['#E8B21C', 'Yellow'], ['#E07B1F', 'Orange'], ['#F2F0EA', 'White'],
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const course = () => document.documentElement.getAttribute('data-course') || 'ladder';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function attachBuildMode(stage, ui, host, W) {
  if (!ui.pane || !W.uno) return null;
  addCss();
  const { b, L, board, uno } = W;
  const pins = DATA.pins;
  const id = host.dataset.build;
  const target0 = DATA.builds[id] || b; // the course's build (b is the learner's when running theirs)
  const mine = !!b.mine;
  const pane = ui.pane('build', 'Build', 'build');
  const KEY = `${course()}-build-${id}`;
  const WIRED = `${course()}-builds-wired`;
  const holeMesh = board.holes;
  const sockIdx = new Map(uno.socks.map((s, k) => [`${s.hdr}:${s.i}`, k]));
  const scene = stage.scene;
  let mode = null; // 'guided' | 'practice'
  let suspended = null;

  // ---------- where things are ----------
  const sockOf = (e) => R.sockOf(e, pins);
  const pos = (e) => {
    if (R.isHole(e)) return L.hole(e);
    if (R.isRail(e)) return L.railHole(R.railOf(e), R.railCol(e));
    const s = sockOf(e);
    return uno.sockPos(s);
  };
  const short = (e) => R.shortEnd(e, pins);
  const say = (e) => {
    if (R.isHole(e)) { const p = R.parseHole(e); return `hole ${e}, column ${p.col}`; }
    if (R.isRail(e)) return `${R.railWords(R.railOf(e))}, column ${R.railCol(e)}`;
    const n = sockOf(e).name;
    return /^\d+$/.test(n) ? `Arduino pin ${n}` : `the Arduino’s ${n} socket`;
  };

  // ---------- lighting holes and sockets (instanced colours) ----------
  const tints = new Map(); // 'h<k>' | 's<k>' -> hex
  const col3 = new THREE.Color();
  const instOf = (e) => {
    if (R.isHole(e)) return board.holeIndex[e] != null ? ['h', board.holeIndex[e]] : null;
    if (R.isRail(e)) { const k = board.railIndex[R.railOf(e) + R.railCol(e)]; return k != null ? ['h', k] : null; }
    const k = sockIdx.get(e.slice(2));
    return k != null ? ['s', k] : null;
  };
  let netPaint = []; // [{ nodes, colour }] for X-ray in practice
  let netsShown = false;
  function applyTints() {
    for (const [key, hex] of tints) {
      col3.setHex(hex);
      if (key[0] === 'h') holeMesh.setColorAt(+key.slice(1), col3); else uno.sockMesh.setColorAt(+key.slice(1), col3);
    }
    for (const { nodes, colour } of netPaint) {
      col3.set(colour);
      for (const n of nodes) {
        if (R.RAILS.includes(n)) {
          board.railStrips[n].material.color.copy(col3);
          for (let c = b.c0; c <= b.c1; c++) holeMesh.setColorAt(board.railIndex[n + c], col3);
        } else if (/^[TB]\d+$/.test(n)) {
          const k = board.stripIndex[n];
          if (k != null) board.colStrips.setColorAt(k, col3);
          for (const r of n[0] === 'T' ? 'fghij' : 'abcde') { const h = board.holeIndex[r + n.slice(1)]; if (h != null) holeMesh.setColorAt(h, col3); }
        } else if (n === 'GND' || n.startsWith('P:')) {
          uno.socks.forEach((s, k) => { if ((s.name === 'GND' ? 'GND' : 'P:' + s.name) === n) uno.sockMesh.setColorAt(k, col3); });
        }
      }
    }
    holeMesh.instanceColor.needsUpdate = true;
    uno.sockMesh.instanceColor.needsUpdate = true;
    board.colStrips.instanceColor.needsUpdate = true;
  }
  function setTints(list) {
    // back to plain first, then light the new ones
    for (const key of tints.keys()) {
      if (key[0] === 'h') holeMesh.setColorAt(+key.slice(1), board.base); else uno.sockMesh.setColorAt(+key.slice(1), uno.sockBase);
    }
    tints.clear();
    for (const [e, hex] of list) { const k = e && instOf(e); if (k) tints.set(k[0] + k[1], hex); }
    if (netsShown || W.isX()) W.refresh(); else applyTints();
    netsShown = netPaint.length > 0;
    stage.invalidate();
  }
  // after the view repaints (X-ray on or off, say), the mode's own colours go back on
  W.afterPaint = () => { if (!mode) return; computeNets(); applyTints(); };

  // ---------- floating names for holes ----------
  let tags = [];
  function clearTags() { tags.forEach((t) => scene.remove(t)); tags = []; }
  // a name beside a hole, pushed away from the part's middle (c) so two names never sit on each other
  function tag(e, text, c = null) {
    const a = label(text, { always: true, min: 11, scale: 0.8 });
    const p = pos(e);
    let dx = 0, dz = 1.1;
    if (c) {
      const vx = p.x - c.x, vz = p.z - c.z, d = Math.hypot(vx, vz);
      if (d > 0.2) { dx = (vx / d) * 1.5; dz = (vz / d) * 1.5 + 0.5; }
    }
    a.position.set(p.x + dx, p.y + 0.3, p.z + dz);
    scene.add(a);
    tags.push(a);
    return a;
  }

  // ---------- the parts, with their names ----------
  const tray = R.trayOf(target0);
  const trayById = Object.fromEntries(tray.map((t) => [t.id, t]));
  const partOf = (i) => W.parts.find((p) => p.i === i);
  const names = Object.fromEntries(W.parts.map((p) => [p.i, p.title]));
  const titleOf = (t) => (t.lead ? cap(t.title) : names[t.src] && !mine ? names[t.src] : cap(t.title));
  const railColOf = (i, k) => {
    const d = target0.parts[i];
    const p = mine ? null : partOf(i);
    const idx = d?.type === 'blk' ? d.holes.length + k : k;
    const e = p?.ends?.[idx];
    return e && R.isRail(e) ? R.railCol(e) : null;
  };
  const targetItems = R.itemsFromBuild(target0, railColOf);

  // ---------- the panel ----------
  const root = document.createElement('div');
  root.className = 'bm';
  pane.appendChild(root);
  const done = () => !!load(WIRED, {})?.[id];

  function home() {
    leaveMode();
    if (mine) return showMine();
    const st = load(KEY, null);
    const n = st?.items?.length || 0;
    root.innerHTML = `<p class="bm-lead">Build this on your own breadboard, one part at a time, or practise it here first.</p>
      <button type="button" class="bm-choice" data-go="guided">${icon('flow')}<span><b>Guided build</b><small>Step through it part by part, in the page’s order, and follow along on your real board.</small></span></button>
      <button type="button" class="bm-choice" data-go="practice">${icon('build')}<span><b>Build it yourself</b><small>Start from an empty board. Place every part and wire, then check your wiring.${n ? ` <em>Your build so far is saved (${n} ${n === 1 ? 'thing' : 'things'} placed).</em>` : ''}</small></span></button>
      ${done() ? `<p class="bm-done">${icon('check')} You have wired this build correctly before.</p>` : ''}`;
    root.querySelector('[data-go="guided"]').addEventListener('click', () => startGuided());
    root.querySelector('[data-go="practice"]').addEventListener('click', () => startPractice());
  }

  // ---------- modes: what the scene looks like ----------
  function showTarget(on) { for (const p of W.parts) { p.group.visible = on; p.group.position.y = 0; } }
  function enterScene(m) {
    mode = m;
    W.mode = m;
    W.sim?.unplug?.();
    W.select?.(null);
    if (m === 'practice') {
      showTarget(false);
      practiceRoot.visible = true;
      if (!board.blankPrint) {
        board.blankPrint = board.makePrint(new Set(), []);
        board.group.add(board.blankPrint);
      }
      board.print.visible = false;
      board.blankPrint.visible = true;
      cursorMesh.visible = true;
      cursorTag.visible = true;
      W.pick = practicePick;
      W.modeKey = practiceKey;
    } else {
      W.pick = () => true;
      W.modeKey = guidedKey;
    }
    stage.invalidate();
  }
  function leaveScene() {
    if (!mode) return;
    showTarget(true);
    practiceRoot.visible = false;
    if (board.blankPrint) board.blankPrint.visible = false;
    board.print.visible = true;
    cursorMesh.visible = false;
    cursorTag.visible = false;
    floatEl.hidden = true;
    clearTags();
    netPaint = [];
    setTints([]);
    setRings([]);
    unglow();
    W.pick = null;
    W.modeKey = null;
    mode = null;
    W.mode = null;
    W.refresh();
    stage.invalidate();
  }
  function leaveMode() { suspended = null; leaveScene(); }
  // leaving the Build tab puts the whole build back; coming back carries on
  // listeners on the host go when the lab is made again (Run the sketch on your build)
  const ac = new AbortController();
  host.addEventListener('lab-tab', (e) => {
    if (e.detail.was === 'build' && mode) { suspended = mode; leaveScene(); W.select?.(null); }
    else if (e.detail.tab === 'build' && suspended) { const m = suspended; suspended = null; m === 'guided' ? startGuided(gStep) : startPractice(); }
  }, { signal: ac.signal });

  // =====================================================================
  // Guided build
  // =====================================================================
  let steps = null;
  let gStep = 0;
  let before = null;
  function makeSteps() {
    const chunks = readChunks(host);
    before = chunks.before || null;
    const found = R.orderFromChunks(target0, chunks);
    const any = found.some(Boolean);
    const list = W.parts.map((p) => ({ p, f: found[p.i] }));
    const rank = (x) => R.defaultRank(target0.parts[x.p.i]);
    const lex = (a, c) => (a[0] - c[0]) || (a[1] - c[1]);
    const unmatched = list.filter((x) => !x.f).sort((x, y) => lex(rank(x), rank(y)));
    const matched = list.filter((x) => x.f).sort((x, y) => (x.f.chunk - y.f.chunk) || (x.f.pos - y.f.pos));
    const out = [...unmatched.map((x) => ({ ...x, already: any ? 'page' : '' })), ...matched.map((x) => ({ ...x, already: chunks[x.f.chunk].before ? 'before' : '' }))];
    // the page's "You should see" goes with the last part its step places; a step that places
    // nothing but has one (plug in, test) follows the part before it
    const lastOfStep = new Map();
    out.forEach((x, k) => { const st = x.f && chunks[x.f.chunk]?.step; if (st) lastOfStep.set(st, k); });
    out.forEach((x, k) => {
      const ch = x.f && chunks[x.f.chunk];
      x.see = ch?.step && lastOfStep.get(ch.step) === k ? ch.see : null;
      x.then = [];
    });
    const stepsSeen = new Set(out.map((x) => x.f && chunks[x.f.chunk]?.step).filter(Boolean));
    chunks.forEach((c, k) => {
      if (!c.step || !c.see || stepsSeen.has(c.step)) return;
      stepsSeen.add(c.step);
      let at = -1;
      out.forEach((x, j) => { if (x.f && x.f.chunk < k) at = j; });
      if (at < 0 && out.length) at = out.length - 1;
      if (at >= 0) out[at].then.push({ what: c.strong, see: c.see });
    });
    return out;
  }
  const legsOf = (p) => {
    const t = tray.find((x) => x.src === p.i && !x.lead);
    return t ? t.legs.map((l) => l.name) : null;
  };
  function whereOf(p) {
    const d = p.data, E = p.ends || [];
    const legs = legsOf(p);
    if (p.isWire) {
      if (d.type === 'power') return `A wire from the Arduino’s <b>${esc(d.socket.name)}</b> socket to any hole of ${R.railWords(d.rail)}.`;
      if (d.type === 'link') return `A wire from ${R.railWords(d.a)} to ${R.railWords(d.b)}.`;
      return `Wire: <code>${d.a}</code> to ${R.isHole(E[1]) ? `<code>${E[1]}</code>` : R.isRail(E[1]) ? `any hole of ${R.railWords(R.railOf(E[1]))}` : `<b>${esc(short(E[1]))}</b> on the Arduino`}.`;
    }
    if (d.type === 'mod') return `${esc(cap(p.title))}: ${d.pins.filter((q) => q.to).map((q) => `${esc(q.name)} lead to ${q.to === 'rail' ? R.railWords(q.rail) : `<b>${esc(short('S:' + q.socket.hdr + ':' + q.socket.i))}</b>`}`).join(', ')}.`;
    if (d.type === 'batt') return `Battery pack: red lead to ${R.railWords(d.plus)}, black lead to ${R.railWords(d.minus)}.`;
    if (!legs) return p.where;
    const shortName = (n) => n.replace(/ \(.*\)$/, '').replace(/^(.)/, (m) => m);
    if (d.type === 'btn') return `Push button: legs in ${d.holes.map((h) => `<code>${h}</code>`).join(', ')}, across the middle channel.`;
    if (legs.length > 6) return `${esc(cap(p.title))}: pins in <code>${E[0]}</code> to <code>${E[d.holes.length - 1]}</code>, one per column${E.length > d.holes.length ? `, and a lead to ${R.railWords(R.railOf(E[E.length - 1]))}` : ''}.`;
    return `${esc(cap(p.title.replace(/\s*\(.*\)$/, '')))}: ${E.map((e, k) => `${esc(shortName(legs[k] || 'leg'))} ${R.isHole(e) ? `<code>${e}</code>` : esc(short(e))}`).join(', ')}.`;
  }
  function seeOf(p) {
    const d = p.data, E = p.ends || [];
    switch (d.type) {
      case 'led': return `The LED standing up on its own, long leg in ${E[0]}, short leg in ${E[1]}. The flat edge of its rim is on the ${E[1]} side.`;
      case 'res': return `The resistor lying flat, its legs in ${E[0]} and ${E[1]}, pushed right down. Either way round is fine.`;
      case 'buz': return `The buzzer standing firm, its + leg in ${E[0]} and its other leg in ${E[1]}.`;
      case 'pot': return `The knob standing upright in ${E.join(', ')}, with its middle leg in ${E[1]}.`;
      case 'npn': return `The transistor in ${E.join(', ')}, its flat face towards you.`;
      case 'btn': return 'The button sitting flat across the middle channel, all four legs in. Nudge it: it should not wobble.';
      case 'wire':
        if (d.to === 'rail') return `A wire from ${d.a} into the ${d.b[0] === '+' ? '+' : '−'} rail. Any hole along that rail is the same: a rail is one long strip.`;
        if (d.to === 'socket') return `A wire from ${d.a} to ${short(E[1])} on the Arduino, firm at both ends. Give each end a gentle tug: it stays in.`;
        return `A wire from ${d.a} to ${d.b}, joining column ${R.parseHole(d.a).col} to column ${R.parseHole(d.b).col}.`;
      case 'power': return `A wire from the Arduino’s ${d.socket.name} socket into ${R.railWords(d.rail)}. This one feeds the rail: without it, the rail is dead metal.`;
      case 'link': return 'A wire joining the two rails, so both carry the same thing.';
      case 'mod': return `The ${esc(p.title.toLowerCase())}’s leads plugged in as named above, each pushed fully on.`;
      case 'batt': return 'The battery pack’s red lead in the + rail and its black lead in the − rail. Leave it switched off until you have checked everything.';
      default: return `All its pins in, one per column, as named above.`;
    }
  }

  function startGuided(at = 0) {
    leaveScene();
    steps ??= makeSteps();
    enterScene('guided');
    ui.info('Guided build', '<p>The build, one part at a time, in the order the page gives. Follow along on your own breadboard: the lit holes are where the next part goes.</p>');
    gStep = Math.max(0, Math.min(at, steps.length + 1));
    showStep(gStep, true);
  }
  let anim = 0;
  function showStep(k, jump = false) {
    gStep = k;
    const N = steps.length;
    clearTags();
    unglow();
    const cur = k >= 1 && k <= N ? steps[k - 1] : null;
    steps.forEach((s, j) => {
      const on = k > N || j < k;
      s.p.group.visible = on;
      s.p.group.position.y = 0;
    });
    const token = ++anim;
    if (cur && !jump && !reduced()) {
      const g = cur.p.group;
      g.position.y = 6;
      stage.tween((t) => { if (token === anim) g.position.y = 6 * (1 - t); }, 0.6);
    }
    let lit = [];
    if (cur) {
      const E = (cur.p.ends || []).filter(Boolean);
      lit = E.map((e) => [e, GOLD]);
      const legs = legsOf(cur.p);
      const many = E.length > 6;
      const ps = E.map(pos);
      const c = ps.length ? ps.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / ps.length) : cur.p.focus.clone();
      E.forEach((e, j) => {
        if (many && j !== 0 && j !== E.length - 1) return;
        const leg = legs?.[j];
        const nm = R.isHole(e) ? e : R.isRail(e) ? `${R.railOf(e)[0] === '+' ? '+' : '−'} rail` : short(e);
        tag(e, leg && E.length <= 4 && /[+−]/.test(leg) ? `${nm} ${leg.includes('+') ? '+' : '−'}` : nm, ps.length > 1 && !R.isSock(e) ? c : null);
      });
      glow(cur.p.group);
      const ext = ps.reduce((m, p) => Math.max(m, p.distanceTo(c)), 0) * 2;
      const zoom = Math.max(1, Math.min(W.fitW / (ext + 16), Math.min(4, Math.max(1.6, W.fitW / 26))));
      stage.lookAt(c.setY(BT), zoom);
    } else if (k > N) {
      stage.view?.reset?.();
    }
    setTints(lit);
    renderGuide();
    stage.invalidate();
  }
  function renderGuide() {
    const N = steps.length;
    const k = gStep;
    const cur = k >= 1 && k <= N ? steps[k - 1] : null;
    const pct = Math.round((Math.min(k, N) / N) * 100);
    let body;
    if (k === 0) {
      body = `<h5 class="bm-title">${esc(before?.title || 'Before you start')}</h5>
        ${before ? `<div class="bm-before">${before.html}</div>` : '<p>Clear your breadboard and unplug the USB cable. Build the whole thing with no power, check it, then plug in.</p>'}
        <div class="see bm-see"><b>What you should see</b>An empty breadboard and the Arduino, with the USB cable unplugged.</div>
        <p class="bm-small">${N} ${N === 1 ? 'part or wire' : 'parts and wires'} to place, one at a time.</p>`;
    } else if (cur) {
      body = `<h5 class="bm-title">${esc(cap(cur.p.title))}</h5>
        <p class="bm-where">${whereOf(cur.p)}</p>
        ${cur.already === 'page' ? '<p class="bm-note">The steps on this page do not place this one: it may already be on your board from an earlier part. Check it is there, where it is lit.</p>' : cur.already === 'before' ? '<p class="bm-note">The page says this one is already on your board from before. Check it is there, where it is lit.</p>' : ''}
        <div class="see bm-see"><b>What you should see</b>${cur.see ? esc(cur.see) : seeOf(cur.p)}</div>
        ${cur.then.map((t) => `<div class="bm-then"><b>Then</b>${t.what ? esc(t.what) + ' ' : ''}${t.see ? `<span>You should see: ${esc(t.see)}</span>` : ''}</div>`).join('')}`;
    } else {
      body = `<h5 class="bm-title">That is the whole build</h5>
        <p>Every part and wire is in. Before you plug in, say each connection out loud and check it against the picture.</p>
        <div class="see bm-see"><b>What you should see</b>Your board looking just like this one, every leg pushed right down.</div>
        <p><button type="button" class="lab-btn" data-act="practice">Now try it yourself: Build it yourself</button></p>`;
    }
    root.innerHTML = `<div class="bm-head"><span class="bm-k">${k === 0 ? 'Getting ready' : k > N ? 'Done' : `Step ${k} of ${N}`}</span><button type="button" class="lab-btn bm-leave">Leave</button></div>
      <div class="meter bm-meter" role="img" aria-label="${Math.min(k, N)} of ${N} placed"><span style="width:${pct}%"></span></div>
      <div class="bm-step" aria-live="polite">${body}</div>
      <div class="bm-nav"><button type="button" class="lab-btn bm-back" ${k === 0 ? 'disabled' : ''}>Back</button><button type="button" class="lab-btn primary bm-next" ${k > N ? 'disabled' : ''}>${k === 0 ? 'Start' : k === N ? 'Finish' : 'Next'}</button></div>
      <p class="bm-hint">On the model: <kbd>N</kbd> next, <kbd>B</kbd> back.</p>`;
    root.querySelector('.bm-leave').addEventListener('click', home);
    root.querySelector('.bm-back').addEventListener('click', () => showStep(Math.max(0, gStep - 1)));
    root.querySelector('.bm-next').addEventListener('click', () => showStep(Math.min(N + 1, gStep + 1)));
    root.querySelector('[data-act="practice"]')?.addEventListener('click', () => startPractice());
  }
  function guidedKey(e) {
    if (e.shiftKey) return false;
    const N = steps.length;
    if (e.key === 'n' || e.key === 'N' || e.key === 'PageDown') { showStep(Math.min(N + 1, gStep + 1)); return true; }
    if (e.key === 'b' || e.key === 'B' || e.key === 'PageUp') { showStep(Math.max(0, gStep - 1)); return true; }
    return false;
  }
  let glowing = null;
  function glow(g) {
    unglow();
    glowing = g;
    g.traverse((m) => {
      if (!m.isMesh || m.userData.isInk || !m.material || !('emissive' in m.material)) return;
      m.userData.bmEm ??= m.material.emissive.getHex();
      m.material.emissive.setHex(0x5a3f00);
    });
  }
  function unglow() {
    glowing?.traverse((m) => { if (m.userData.bmEm !== undefined) { m.material.emissive.setHex(m.userData.bmEm); delete m.userData.bmEm; } });
    glowing = null;
  }

  // =====================================================================
  // Build it yourself
  // =====================================================================
  const practiceRoot = new THREE.Group();
  practiceRoot.visible = false;
  W.world.add(practiceRoot);
  // the gold ring: where a tap (or Enter) will put the next leg
  const cursorMesh = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: GOLD, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }));
  cursorMesh.rotation.x = -Math.PI / 2;
  cursorMesh.renderOrder = 20;
  cursorMesh.userData.noInk = true;
  cursorMesh.raycast = () => {};
  cursorMesh.visible = false;
  scene.add(cursorMesh);
  // rings that show through parts: red where a check found a problem, gold for the legs placed so far
  const ringGeo = new THREE.TorusGeometry(0.4, 0.085, 8, 24);
  const rings = [];
  function setRings(list) {
    list.forEach(([e, hex], k) => {
      let m = rings[k];
      if (!m) {
        m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 19;
        m.userData.noInk = true;
        m.raycast = () => {};
        scene.add(m);
        rings.push(m);
      }
      const p = pos(e);
      m.position.set(p.x, p.y + 0.1, p.z);
      m.material.color.setHex(hex);
      m.visible = true;
    });
    for (let k = list.length; k < rings.length; k++) rings[k].visible = false;
  }
  const cursorTag = label('', { always: true, min: 11, scale: 0.8, bg: 'rgba(36,24,46,0.88)', color: '#ffffff' });
  cursorTag.visible = false;
  scene.add(cursorTag);
  const digs = uno.socks.filter((s) => s.hdr === 'dig').sort((a, c) => a.i - c.i);
  const pwrs = uno.socks.filter((s) => s.hdr === 'pwr').sort((a, c) => a.i - c.i);
  const cur = { r: ROWS.indexOf('f'), c: b.c0 };
  const endAtCursor = () => {
    const row = ROWS[cur.r];
    if (row === 'dig' || row === 'pwr') { const s = (row === 'dig' ? digs : pwrs)[cur.c]; return `S:${s.hdr}:${s.i}`; }
    if (R.RAILS.includes(row)) return R.railEnd(row, cur.c);
    return row + cur.c;
  };
  const xOfCursor = () => pos(endAtCursor()).x;
  function setCursorTo(e) {
    if (R.isHole(e)) { const p = R.parseHole(e); cur.r = ROWS.indexOf(p.row); cur.c = p.col; }
    else if (R.isRail(e)) { cur.r = ROWS.indexOf(R.railOf(e)); cur.c = R.railCol(e); }
    else { const s = sockOf(e); cur.r = ROWS.indexOf(s.hdr); cur.c = (s.hdr === 'dig' ? digs : pwrs).findIndex((q) => q.i === s.i); }
    drawCursor();
  }
  function moveCursor(dr, dc) {
    const was = ROWS[cur.r];
    const wasHdr = was === 'dig' || was === 'pwr';
    if (dr) {
      const x = xOfCursor();
      cur.r = Math.max(0, Math.min(ROWS.length - 1, cur.r + dr));
      const now = ROWS[cur.r];
      const isHdr = now === 'dig' || now === 'pwr';
      if (isHdr) {
        const list = now === 'dig' ? digs : pwrs;
        let best = 0;
        list.forEach((s, k) => { if (Math.abs(uno.sockPos(s).x - x) < Math.abs(uno.sockPos(list[best]).x - x)) best = k; });
        cur.c = best;
      } else if (wasHdr) {
        let best = b.c0;
        for (let c = b.c0; c <= b.c1; c++) if (Math.abs(L.hole('a' + c).x - x) < Math.abs(L.hole('a' + best).x - x)) best = c;
        cur.c = best;
      }
    }
    if (dc) {
      const now = ROWS[cur.r];
      const max = now === 'dig' ? digs.length - 1 : now === 'pwr' ? pwrs.length - 1 : b.c1;
      const min = now === 'dig' || now === 'pwr' ? 0 : b.c0;
      cur.c = Math.max(min, Math.min(max, cur.c + dc));
    }
    drawCursor(true);
  }
  function drawCursor(announce = false) {
    const e = endAtCursor();
    const p = pos(e);
    cursorMesh.position.set(p.x, p.y + 0.12, p.z);
    setLabel(cursorTag, short(e));
    cursorTag.position.set(p.x, p.y + 1.6, p.z);
    if (announce) {
      const who = whoIsAt(e);
      liveEl.textContent = `${cap(say(e))}. ${who.length ? 'Has ' + who.join(' and ') + '.' : 'Empty.'}`;
    }
    stage.invalidate();
  }

  // ---- the learner's build ----
  let items = [];
  let selId = null;
  let pending = null; // { t, ends, flip, colour, move }
  let wireColour = 'auto';
  let lastCheck = null;
  let seq = 1;
  const groups = new Map(); // item id -> THREE.Group
  const tOf = (it) => (it.tray ? trayById[it.tray] : null);
  function whoIsAt(e) {
    const out = [];
    for (const it of items) it.ends.forEach((x, k) => {
      if (x !== e) return;
      const t = tOf(it);
      out.push(t ? (t.lead ? titleOf(t) : `the ${titleOf(t).replace(/^[A-Z](?=[a-z])/, (m) => m.toLowerCase())}’s ${t.legs[k].name}`) : 'a wire end');
    });
    return out;
  }
  function persist() {
    save(KEY, { v: 1, items: items.map(({ id: i, tray: t, ends, colour }) => ({ id: i, tray: t, ends, colour })), at: new Date().toISOString() });
  }
  function restore() {
    const st = load(KEY, null);
    items = [];
    if (!st || !Array.isArray(st.items)) return;
    const okEnd = (e) => {
      if (R.isHole(e)) { const p = R.parseHole(e); return p.col >= b.c0 && p.col <= b.c1; }
      if (R.isRail(e)) return R.RAILS.includes(R.railOf(e)) && R.railCol(e) >= b.c0 && R.railCol(e) <= b.c1;
      if (R.isSock(e)) return sockIdx.has(e.slice(2));
      return false;
    };
    for (const it of st.items) {
      if (!it || !Array.isArray(it.ends) || !it.ends.every(okEnd)) continue;
      if (it.tray && !trayById[it.tray]) continue;
      if (it.tray && items.some((x) => x.tray === it.tray)) continue;
      items.push({ id: 'p' + seq++, tray: it.tray || null, ends: it.ends, colour: it.colour || 'auto' });
    }
  }

  // ---- models of placed things ----
  const up = (p, h) => V(p.x, p.y + h, p.z);
  const topOf = (e) => (R.isSock(e) ? up(pos(e), HOUSE) : up(pos(e), HOUSE));
  const arch = (a, c, peak) => {
    const d = Math.hypot(c.x - a.x, c.z - a.z);
    const rise = Math.max(0.5, Math.min(1.2, d * 0.2));
    const top = Math.max(peak, a.y + rise + 0.2, c.y + rise + 0.2);
    const pts = [a, up(a, rise * 0.8)];
    if (d > 1.2) {
      pts.push(V(a.x + (c.x - a.x) * 0.2, top - (top - a.y) * 0.12, a.z + (c.z - a.z) * 0.2));
      pts.push(V((a.x + c.x) / 2, top, (a.z + c.z) / 2));
      pts.push(V(a.x + (c.x - a.x) * 0.8, top - (top - c.y) * 0.12, a.z + (c.z - a.z) * 0.8));
    } else pts.push(V((a.x + c.x) / 2, top, (a.z + c.z) / 2));
    pts.push(up(c, rise * 0.8), c);
    return pts;
  };
  const inkHex = () => {
    const m = (getComputedStyle(host).color || '').match(/\d+(\.\d+)?/g);
    if (!m) return 0x2b2f31;
    const [r, g, bb] = m.map(Number);
    return (0.3 * r + 0.59 * g + 0.11 * bb) / 255 < 0.2 ? 0x2b2f31 : (r << 16) | (g << 8) | bb;
  };
  function jumperOf(path, colour, opts) {
    const g = P.jumper(path, 0, opts);
    const c = g.userData.cable;
    c.material.dispose();
    c.material = P.plasticMat(0, { rough: 0.42, gloss: 0.4 });
    if (colour === 'ink') c.material.color.setHex(inkHex()); else c.material.color.set(colour);
    return g;
  }
  // module bodies stand where the build's own picture has them
  const bodies = new Map(); // part index -> { group, tips, ... }
  function bodyOf(i) {
    if (bodies.has(i)) return bodies.get(i);
    const d = target0.parts[i];
    const tp = mine ? null : partOf(i);
    let mm = null;
    if (d.type === 'mod') mm = P.moduleModel(d.label, d.pins.map((q) => q.name));
    else if (d.type === 'batt') mm = P.batteryPack();
    else if (d.type === 'blk' && /^motor/.test(d.label)) mm = P.moduleModel(d.label, ['', '']);
    else if (d.type === 'blk' && !/^(RGB LED|light sensor)/.test(d.label)) mm = P.moduleModel(d.label, R.pinNamesOf(d.label, d.holes.length));
    if (!mm) return null;
    const at = tp?.model?.group?.position;
    if (at) mm.group.position.copy(at);
    else mm.group.position.set(L.n / 2, 0, 21);
    mm.group.updateMatrixWorld(true);
    inkScene(mm.group);
    bodies.set(i, mm);
    return mm;
  }
  const tipOf = (mm, k) => mm.tips[k].clone().add(mm.group.position);
  function modelOf(it) {
    const g = new THREE.Group();
    const t = tOf(it);
    const E = it.ends;
    if (!t) {
      const colour = it.colour && it.colour !== 'auto' ? it.colour : R.autoColour(E, pins);
      const [a, c] = E.map(topOf);
      const d = Math.hypot(c.x - a.x, c.z - a.z);
      const toUno = E.some(R.isSock);
      g.add(jumperOf(arch(a, c, BT + HOUSE + (toUno ? 3.2 + Math.min(3, d * 0.06) : 1 + Math.min(4, d * 0.14))), colour));
      return g;
    }
    const d = target0.parts[t.src];
    const ps = E.map(pos);
    switch (t.type) {
      case 'led': g.add(P.led(ps[0], ps[1], d.colour, BT)); break;
      case 'res': g.add(P.resistor(ps[0], ps[1], P.ohms(d.value), BT)); break;
      case 'buz': g.add(P.buzzer(ps[0], ps[1], BT, R.topHalf(E[0]) ? 1 : -1)); break;
      case 'pot': g.add(P.pot(ps, BT, R.topHalf(E[0]) ? -1 : 1)); break;
      case 'npn': g.add(P.transistor(ps[0], ps[1], ps[2], BT)); break;
      case 'btn': g.add(P.button(ps, BT)); break;
      case 'blk': {
        if (/^RGB LED/.test(d.label)) { g.add(P.rgbLed(ps, BT, 1)); break; }
        if (/^light sensor/.test(d.label)) { g.add(P.ldr(ps[0], ps[1], BT)); break; }
        const mm = bodyOf(t.src);
        if (/^motor/.test(d.label)) {
          g.add(jumperOf(arch(tipOf(mm, 0), topOf(E[0]), BT + HOUSE + 2.2), 'ink', { ends: [false, true] }));
          g.add(jumperOf(arch(tipOf(mm, 1), topOf(E[2]), BT + HOUSE + 3), '#C8452F', { ends: [false, true] }));
          const col = Math.min(b.c1, R.railCol(E[2]) + 1);
          g.add(P.diode(ps[1], L.railHole(R.railOf(E[2]), col), BT, 3.0));
          break;
        }
        const n = d.holes.length;
        mm.tips.forEach((tp, k) => {
          if (k >= n) return;
          const tip = tipOf(mm, k);
          const h = topOf(E[k]);
          const dist = Math.hypot(h.x - tip.x, h.z - tip.z);
          g.add(jumperOf(arch(tip, h, Math.max(tip.y, h.y) + 1.0 + Math.min(2.5, dist * 0.1)), 'ink', { r: 0.16, ends: [!mm.standing, true] }));
        });
        E.slice(n).forEach((e) => g.add(jumperOf(arch(tipOf(mm, mm.tips.length - 1), topOf(e), 5), R.railOf(e)[0] === '+' ? '#C8452F' : '#3D6FA8')));
        break;
      }
      case 'mod': {
        const mm = bodyOf(t.src);
        const q = d.pins[t.sub];
        const tip = tipOf(mm, t.sub);
        const s = topOf(E[0]);
        const dist = Math.hypot(s.x - tip.x, s.z - tip.z);
        g.add(jumperOf(arch(tip, s, Math.max(tip.y, s.y) + 1.6 + Math.min(2.5, dist * 0.08)), q.colour || R.autoColour(E, pins), { ends: [!mm.plugTips, true] }));
        break;
      }
      case 'batt': {
        const mm = bodyOf(t.src);
        const tip = tipOf(mm, t.sub);
        g.add(jumperOf(arch(tip, topOf(E[0]), Math.max(tip.y, BT) + 3), t.battery === '+' ? '#C8452F' : '#3D6FA8', { ends: [false, true] }));
        break;
      }
      default: break;
    }
    return g;
  }
  function draw(it) {
    undraw(it.id);
    const g = modelOf(it);
    g.userData.item = it.id;
    practiceRoot.add(g);
    g.updateMatrixWorld(true);
    inkScene(g);
    groups.set(it.id, g);
    stage.clickable(g, (o, e, hit) => onItemClick(it.id, hit));
  }
  function undraw(iid) {
    const g = groups.get(iid);
    if (!g) return;
    if (glowing === g) unglow();
    stage.unclickable(g);
    practiceRoot.remove(g);
    g.traverse((m) => { if (m.isMesh && m.geometry?.type === 'TubeGeometry') m.geometry.dispose(); });
    groups.delete(iid);
  }
  function drawBodies() {
    target0.parts.forEach((d, i) => {
      if (d.type === 'mod' || d.type === 'batt' || (d.type === 'blk' && !/^(RGB LED|light sensor)/.test(d.label))) {
        const mm = bodyOf(i);
        if (mm && !mm.group.parent) {
          practiceRoot.add(mm.group);
          // a module stays where it is: tapping it does nothing
          stage.clickable(mm.group, (o, e, hit) => { if (pending) placeNear(hit); });
        }
      }
    });
  }

  // ---- the panel for Build it yourself ----
  let liveEl = document.createElement('span');
  function startPractice() {
    leaveScene();
    restore();
    enterScene('practice');
    drawBodies();
    for (const g of [...groups.keys()]) undraw(g);
    items.forEach(draw);
    pending = null;
    selId = null;
    lastCheck = null;
    ui.info('Build it yourself', '<p>An empty breadboard and the Arduino. Pick a part from the tray in the <b>Build</b> tab, then tap the hole for each leg. Wires go between any two holes, rails or Arduino sockets.</p><p class="lab-tip">Turn on <b>X-ray</b> and tap a part to see what it is joined to.</p>');
    renderPractice();
    drawCursor();
    refreshTints();
    // the breadboard fills most of the view, the Uno's sockets still in sight
    const mid = L.hole('e' + Math.round((b.c0 + b.c1) / 2)).clone().setY(BT);
    mid.z += 0.5;
    stage.lookAt(mid, Math.max(1, Math.min(3, (W.fitW || 40) / (L.n + 20))));
  }
  function renderPractice() {
    const placed = new Set(items.map((it) => it.tray).filter(Boolean));
    const nWires = items.filter((it) => !it.tray).length;
    const want = R.wireCount(target0);
    root.innerHTML = `<div class="bm-head"><b>Build it yourself</b><button type="button" class="lab-btn bm-leave">Leave</button></div>
      <p class="bm-status" role="status"></p>
      <span class="sr-only bm-live" aria-live="polite"></span>
      <div class="bm-pend" hidden></div>
      <div class="bm-sec"><span class="bm-sec-t">Parts tray</span>
        <div class="bm-tray" role="group" aria-label="Parts tray">${tray.map((t) => `<button type="button" class="bm-chip${placed.has(t.id) ? ' placed' : ''}" data-t="${t.id}" aria-pressed="${pending?.t?.id === t.id}">${placed.has(t.id) ? icon('check') : ''}<span>${esc(titleOf(t))}</span></button>`).join('')}</div>
        <div class="bm-wirebar"><button type="button" class="bm-chip bm-wire" aria-pressed="${!!pending && !pending.t}">${icon('wire')}<span>Add a wire</span></button>
          <label class="bm-col">Colour <select aria-label="Colour for new wires">${COLOURS.map(([v, n]) => `<option value="${v}"${v === wireColour ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <span class="bm-small">${nWires} placed · the course uses ${want}</span></div>
      </div>
      <div class="bm-sel" hidden></div>
      <form class="bm-type" autocomplete="off"><label>Or type where <input name="w" size="9" spellcheck="false" placeholder="f5, pin 8, GND" aria-describedby="bm-type-hint"></label><button type="submit" class="lab-btn">Place</button>
        <small id="bm-type-hint">A hole (f5), an Arduino socket (pin 8, GND, 5V, A0) or a rail (−top, +bottom).</small></form>
      <div class="bm-checkbar"><button type="button" class="lab-btn primary bm-check">${icon('check')}<span>Check my wiring</span></button><button type="button" class="lab-btn bm-reset">Start again</button></div>
      <div class="bm-result" aria-live="polite"></div>
      <p class="bm-hint">Tap a hole to put a leg in it. With the keyboard: click the model, then the arrow keys move the gold ring, <kbd>Enter</kbd> places, <kbd>Delete</kbd> removes, <kbd>Esc</kbd> cancels. ${'ontouchstart' in window ? 'Pinch to zoom in on the holes.' : 'Scroll to zoom in on the holes.'}</p>`;
    liveEl = root.querySelector('.bm-live');
    const $ = (s) => root.querySelector(s);
    $('.bm-leave').addEventListener('click', home);
    root.querySelectorAll('.bm-chip[data-t]').forEach((bt) => bt.addEventListener('click', () => {
      const t = trayById[bt.dataset.t];
      const it = items.find((x) => x.tray === t.id);
      if (it) select(it.id, true); else beginPlace(t);
    }));
    $('.bm-wire').addEventListener('click', () => beginPlace(null));
    $('.bm-col select').addEventListener('change', (e) => { wireColour = e.target.value; if (pending && !pending.t) pending.colour = wireColour; });
    $('.bm-type').addEventListener('submit', (e) => { e.preventDefault(); typed(e.target.w.value); });
    $('.bm-check').addEventListener('click', runCheck);
    $('.bm-reset').addEventListener('click', () => {
      if (items.length && !window.confirm('Take every part and wire off the board and start again?')) return;
      for (const it of items) undraw(it.id);
      items = [];
      persist();
      pending = null;
      selId = null;
      lastCheck = null;
      renderPractice();
      refreshTints();
      status('The board is empty. Pick a part from the tray.');
    });
    renderPending();
    renderSel();
    if (lastCheck) renderResult(lastCheck);
    status(pending ? promptFor() : items.length ? 'Pick another part, add a wire, or check your wiring.' : 'Pick a part from the tray to start.');
  }
  function status(t) { const s = root.querySelector('.bm-status'); if (s) s.innerHTML = t; syncFloat(t); }
  // the same words on the model itself, for a phone (the panel is below, or a closed drawer)
  const wrap = host.querySelector('.lab-canvas');
  const floatEl = document.createElement('div');
  floatEl.className = 'bm-float';
  floatEl.hidden = true;
  floatEl.setAttribute('aria-hidden', 'true'); // the panel's status says it for screen readers
  wrap?.appendChild(floatEl);
  let floatTimer = 0;
  function syncFloat(t) {
    clearTimeout(floatTimer);
    if (mode !== 'practice' || !t) { floatEl.hidden = true; return; }
    floatEl.hidden = false;
    floatEl.innerHTML = `<span>${t.replace(/<br>.*$/, '')}</span>${pending ? '<button type="button" data-a="x">Cancel</button>' : !stage.drawer?.open ? '<button type="button" data-a="tray">Tray</button>' : ''}`;
    if (!pending) floatTimer = setTimeout(() => { floatEl.hidden = true; }, 4000);
  }
  floatEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'x') cancelPlace();
    if (a === 'tray') { stage.drawer?.toggle(true); floatEl.hidden = true; }
  });
  // after picking a part on a phone: the model into view, or the drawer out of the way
  function showModel() {
    if (!wrap) return;
    const side = host.querySelector('.lab-side')?.getBoundingClientRect();
    const r = wrap.getBoundingClientRect();
    if (!side || !r.width) return;
    const overlap = Math.max(0, Math.min(r.right, side.right) - Math.max(r.left, side.left)) * Math.max(0, Math.min(r.bottom, side.bottom) - Math.max(r.top, side.top));
    if (stage.drawer?.open && overlap > 0.3 * r.width * r.height) stage.drawer.toggle(false);
    else if (side.top >= r.bottom - 8 && (r.top < 0 || r.bottom > window.innerHeight)) wrap.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }

  // ---- placing ----
  function beginPlace(t, move = null) {
    deselect();
    pending = { t, ends: [], flip: false, colour: move?.colour ?? wireColour, move: move?.id ?? null };
    renderPractice();
    refreshTints();
    status(promptFor());
    liveEl.textContent = stripTags(promptFor());
    showModel();
  }
  function cancelPlace() {
    if (!pending) return false;
    pending = null;
    floatEl.hidden = true;
    renderPractice();
    refreshTints();
    status('Cancelled. Pick a part from the tray.');
    return true;
  }
  const stripTags = (s) => s.replace(/<[^>]+>/g, '');
  function legNow() {
    if (!pending) return null;
    const t = pending.t;
    if (!t) return { name: pending.ends.length ? 'the other end' : 'one end', accept: 'any' };
    if (t.shape !== 'free' && pending.ends.length === 0) return { name: t.shape === 'button' ? 'its top-left leg (the button sits across the middle channel)' : `its ${t.legs[0].name} (the others follow, one column each)`, accept: 'hole', rigid: true };
    return t.legs[pending.ends.length];
  }
  function promptFor() {
    const t = pending?.t;
    const leg = legNow();
    if (!leg) return '';
    const what = t ? `<b>${esc(cap(titleOf(t)))}</b>` : '<b>Wire</b>';
    const where = leg.accept === 'rail' ? 'a hole in a rail' : leg.accept === 'rs' ? 'an Arduino socket or a rail' : leg.accept === 'any' ? 'a hole, a rail or an Arduino socket' : 'a hole';
    return `${what}: tap ${where} for ${t && !leg.rigid ? 'its ' + esc(leg.name) : esc(leg.name)}.`;
  }
  function renderPending() {
    const box = root.querySelector('.bm-pend');
    if (!box) return;
    box.hidden = !pending;
    if (!pending) return;
    const t = pending.t;
    const canFlip = t && t.shape === 'row' && !pending.ends.length;
    box.innerHTML = `${pending.ends.length ? `<span class="bm-small">So far: ${pending.ends.map((e) => esc(short(e))).join(', ')}</span>` : ''}
      ${canFlip ? `<button type="button" class="lab-btn bm-pflip" aria-pressed="${pending.flip}" title="Its first leg goes in the hole you tap, the others to the left instead of the right">Turn it round</button>` : ''}
      <button type="button" class="lab-btn bm-pcancel">Cancel</button>`;
    box.querySelector('.bm-pcancel').addEventListener('click', cancelPlace);
    box.querySelector('.bm-pflip')?.addEventListener('click', (e) => { pending.flip = !pending.flip; e.target.setAttribute('aria-pressed', String(pending.flip)); });
  }
  function accepts(leg, e) {
    if (leg.accept === 'any') return true;
    if (leg.accept === 'hole') return R.isHole(e);
    if (leg.accept === 'rail') return R.isRail(e);
    if (leg.accept === 'rs') return R.isRail(e) || R.isSock(e);
    return false;
  }
  function place(e) {
    if (!pending) {
      const it = items.find((x) => x.ends.includes(e));
      setCursorTo(e);
      if (it) select(it.id); else status(`${cap(say(e))}: empty. Pick a part from the tray first.`);
      return;
    }
    setCursorTo(e);
    const leg = legNow();
    if (!accepts(leg, e)) {
      const need = leg.accept === 'hole' ? 'a breadboard hole (rows a to j)' : leg.accept === 'rail' ? 'one of the long rails along the edges' : 'an Arduino socket or a rail';
      status(`That is ${say(e)}. ${cap(stripTags(leg.name))} goes in ${need}.`);
      liveEl.textContent = stripTags(root.querySelector('.bm-status').innerHTML);
      return;
    }
    const t = pending.t;
    if (!t && pending.ends.length === 1 && pending.ends[0] === e) { status('That is where the first end is. Tap a different place for the other end.'); return; }
    let note = '';
    if (t && leg.rigid) {
      const hs = R.rigidHoles(t, e, pending.flip, b);
      if (!hs) { status(`From ${e} its legs would run off the end of the board. Try a hole further in.`); return; }
      pending.ends = hs;
    } else {
      pending.ends.push(e);
    }
    const taken = whoIsAt(e).filter(Boolean);
    if (taken.length && !(pending.move && items.find((x) => x.id === pending.move)?.ends.includes(e))) note = ` (${R.isSock(e) ? 'that socket' : 'that hole'} already has ${taken[0]} in it)`;
    const total = t ? t.legs.length : 2;
    if (pending.ends.length < total) {
      refreshTints();
      renderPending();
      status(promptFor() + (note ? `<br><small>${esc(note.trim())}</small>` : ''));
      liveEl.textContent = stripTags(promptFor());
      return;
    }
    // done: a new item, or the moved one in its new place
    const ends = pending.ends;
    let it;
    if (pending.move) {
      it = items.find((x) => x.id === pending.move);
      it.ends = ends;
      if (!t) it.colour = pending.colour;
    } else {
      it = { id: 'p' + seq++, tray: t ? t.id : null, ends, colour: t ? undefined : pending.colour };
      items.push(it);
    }
    pending = null;
    draw(it);
    persist();
    lastCheck = null;
    renderPractice();
    refreshTints();
    const nm = t ? cap(titleOf(t)) : 'Wire';
    status(`${esc(nm)} placed: ${ends.map((x) => esc(short(x))).join(', ')}.${note ? `<br><small>${esc(note.trim())}</small>` : ''} ${items.filter((x) => x.tray).length === tray.length ? 'Every part is out of the tray. Add any wires still to go, then press <b>Check my wiring</b>.' : 'Pick the next part.'}`);
    liveEl.textContent = `${nm} placed.`;
    stage.invalidate();
  }
  function placeNear(hit) {
    const e = nearestEnd(hit?.point);
    if (e) place(e);
  }
  function nearestEnd(p) {
    if (!p) return null;
    let best = null, bd = 1.1;
    const tryE = (e) => { const q = pos(e); const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = e; } };
    for (let c = b.c0; c <= b.c1; c++) {
      for (const r of 'abcdefghij') tryE(r + c);
      for (const r of R.RAILS) tryE(R.railEnd(r, c));
    }
    for (const s of uno.socks) tryE(`S:${s.hdr}:${s.i}`);
    return best;
  }
  function practicePick(kind, info, hit) {
    if (mode !== 'practice') return true;
    if (kind === 'hole') place(info.kind === 'hole' ? info.name : R.railEnd(info.rail, info.col));
    else if (kind === 'sock') place(`S:${info.hdr}:${info.i}`);
    else if (kind === 'board' || kind === 'uno') { const e = nearestEnd(hit?.point); if (e) place(e); }
    return true;
  }
  function onItemClick(iid, hit) {
    if (mode !== 'practice') return;
    if (pending) { placeNear(hit); return; }
    select(selId === iid ? null : iid);
  }
  function typed(v) {
    const s = String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const msg = (t) => status(t);
    if (!s) return;
    let e = null;
    const h = s.replace(/\s/g, '');
    const free = (name) => uno.socks.filter((q) => q.name === name).map((q) => `S:${q.hdr}:${q.i}`).sort((x, y) => (whoIsAt(x).length - whoIsAt(y).length) || (y.startsWith('S:pwr') - x.startsWith('S:pwr')))[0];
    let m;
    if (/^[a-j]\d{1,2}$/.test(h)) {
      const p = R.parseHole(h);
      if (p.col < b.c0 || p.col > b.c1) return msg(`This board shows columns ${b.c0} to ${b.c1}.`);
      e = h;
    } else if ((m = /^(?:pin|d)?(\d{1,2})$/.exec(h))) {
      if (+m[1] > 13) return msg('The Uno’s digital pins go from 0 to 13.');
      e = free(String(+m[1]));
    } else if (/^a[0-5]$/.test(h)) e = free(h.toUpperCase());
    else if (h === 'gnd' || h === 'ground') e = free('GND');
    else if (h === '5v') e = free('5V');
    else if (h === '3v3' || h === '3.3v') e = free('3V3');
    else if (h === 'vin') e = free('VIN');
    else if ((m = /^(?:(\+|-|−|plus|minus)(top|bottom|bot)|(top|bottom|bot)(\+|-|−|plus|minus))(?:rail)?$/.exec(h.replace(/rail/, '')))) {
      const sign = /^(\+|plus)$/.test(m[1] || m[4]) ? '+' : '-';
      const side = /^top$/.test(m[2] || m[3]) ? 'top' : 'bot';
      const rail = sign + side;
      let c = ROWS[cur.r] === rail ? cur.c : b.c0;
      const used = new Set(items.flatMap((it) => it.ends).filter((x) => R.isRail(x) && R.railOf(x) === rail).map(R.railCol));
      for (let k = 0; k <= b.c1 - b.c0 && used.has(c); k++) c = c >= b.c1 ? b.c0 : c + 1;
      e = R.railEnd(rail, c);
    } else return msg('Type a hole like <code>f5</code>, a socket like <code>pin 8</code>, <code>GND</code> or <code>5V</code>, or a rail like <code>-top</code> or <code>+bottom</code>.');
    if (!e) return msg('That socket is not on this Arduino.');
    root.querySelector('.bm-type input').value = '';
    place(e);
  }

  // ---- choosing a placed thing ----
  function select(iid, glide = false) {
    selId = iid;
    unglow();
    const g = iid && groups.get(iid);
    if (g) glow(g);
    renderSel();
    refreshTints();
    if (g && glide) {
      const it = items.find((x) => x.id === iid);
      const c = it.ends.map(pos).reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / it.ends.length);
      stage.lookAt(c.setY(BT), Math.max(stage.camera.zoom, 1.6));
    }
    stage.invalidate();
  }
  function deselect() { if (selId) select(null); }
  function renderSel() {
    const box = root.querySelector('.bm-sel');
    if (!box) return;
    const it = items.find((x) => x.id === selId);
    box.hidden = !it;
    if (!it) return;
    const t = tOf(it);
    const nm = t ? cap(titleOf(t)) : 'Wire';
    const legs = t ? (t.lead ? [t.legs[0].name] : t.legs.map((l) => l.name)) : ['one end', 'other end'];
    const canFlip = t && (t.polar || t.shape === 'row');
    box.innerHTML = `<span class="bm-sec-t">Selected</span><b>${esc(nm)}</b>
      <ul class="bm-legs">${it.ends.map((e, k) => `<li>${esc(cap(legs[k] || 'leg'))}: <b>${esc(short(e))}</b></li>`).join('')}</ul>
      <div class="bm-selbar"><button type="button" class="lab-btn bm-move">Move</button>
      ${canFlip ? `<button type="button" class="lab-btn bm-flip">${t.polar ? 'Flip it round' : 'Turn it round'}</button>` : ''}
      ${!t ? `<label class="bm-col">Colour <select aria-label="This wire's colour">${COLOURS.map(([v, n]) => `<option value="${v}"${v === (it.colour || 'auto') ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      <button type="button" class="lab-btn bm-remove">${t ? 'Back to the tray' : 'Remove'}</button><button type="button" class="lab-btn bm-unsel">Done</button></div>`;
    box.querySelector('.bm-move').addEventListener('click', () => beginPlace(t, it));
    box.querySelector('.bm-flip')?.addEventListener('click', () => flip(it));
    box.querySelector('.bm-remove').addEventListener('click', () => remove(it.id));
    box.querySelector('.bm-unsel').addEventListener('click', () => select(null));
    box.querySelector('select')?.addEventListener('change', (e) => { it.colour = e.target.value; draw(it); glow(groups.get(it.id)); persist(); stage.invalidate(); });
  }
  function flip(it) {
    const t = tOf(it);
    if (!t) return;
    if (t.polar) it.ends = [it.ends[1], it.ends[0]];
    else if (t.shape === 'row') { const n = t.rowLegs ?? t.legs.length; it.ends = [...it.ends.slice(0, n).reverse(), ...it.ends.slice(n)]; }
    draw(it);
    glow(groups.get(it.id));
    persist();
    lastCheck = null;
    renderSel();
    const r = root.querySelector('.bm-result');
    if (r) r.innerHTML = '';
    status(`${esc(cap(titleOf(t)))} turned round: ${it.ends.map((x) => esc(short(x))).join(', ')}.`);
    stage.invalidate();
  }
  function remove(iid) {
    const it = items.find((x) => x.id === iid);
    if (!it) return;
    undraw(iid);
    items = items.filter((x) => x.id !== iid);
    selId = null;
    persist();
    lastCheck = null;
    renderPractice();
    refreshTints();
    status(it.tray ? `${esc(cap(titleOf(tOf(it))))} is back in the tray.` : 'Wire removed.');
  }
  function practiceKey(e) {
    if (mode !== 'practice' || e.shiftKey) return false;
    const k = e.key;
    if (k === 'ArrowUp') { moveCursor(-1, 0); return true; }
    if (k === 'ArrowDown') { moveCursor(1, 0); return true; }
    if (k === 'ArrowLeft') { moveCursor(0, -1); return true; }
    if (k === 'ArrowRight') { moveCursor(0, 1); return true; }
    if (k === 'Enter' || k === ' ') { place(endAtCursor()); return true; }
    if ((k === 'Delete' || k === 'Backspace') && selId) { remove(selId); return true; }
    if (k === 'Escape') return cancelPlace() || (selId ? (select(null), true) : false);
    return false;
  }

  // ---- which holes are lit ----
  function refreshTints() {
    if (mode !== 'practice') return;
    const list = [];
    if (pending) pending.ends.forEach((e) => list.push([e, GOLD]));
    const it = items.find((x) => x.id === selId);
    if (it) it.ends.forEach((e) => list.push([e, SOFT]));
    const ring = [];
    if (pending) pending.ends.forEach((e) => ring.push([e, GOLD]));
    if (lastCheck && !lastCheck.ok) for (const p of lastCheck.problems) for (const e of p.ends) { list.push([e, BAD]); ring.push([e, BAD]); }
    setRings(mode === 'practice' ? ring.slice(0, 40) : []);
    setTints(list);
  }
  // X-ray: what the selected thing is joined to, in the learner's own wiring
  function computeNets() {
    netPaint = [];
    const it = mode === 'practice' && W.isX() && items.find((x) => x.id === selId);
    if (!it) return;
    const N = R.netsOf(items, tray, pins);
    const seen = new Map();
    it.ends.forEach((e) => {
      const rt = N.find(R.nodeOf(e, pins));
      if (!seen.has(rt)) seen.set(rt, PAL[seen.size % PAL.length]);
    });
    for (const [rt, colour] of seen) netPaint.push({ nodes: N.nodes().filter((n) => N.find(n) === rt), colour });
  }

  // ---- the check ----
  function runCheck() {
    cancelPlace();
    const res = R.check(target0, items, pins, { names, target: targetItems });
    lastCheck = res;
    renderResult(res);
    refreshTints();
    const n = res.problems.length;
    status(res.ok ? '<b>Your wiring is right.</b> Well done.' : `Checked: ${n === 1 ? 'one thing' : n + ' things'} to look at, in the panel.${res.problems.some((q) => q.ends.length) ? ' The red rings show where.' : ''}`);
    root.querySelector('.bm-result')?.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    if (res.ok) record();
    else {
      // look at the first problem that has a place
      const p = res.problems.find((q) => q.ends.length);
      if (p) {
        const c = p.ends.map(pos).reduce((a, q) => a.add(q), V(0, 0, 0)).multiplyScalar(1 / p.ends.length);
        stage.lookAt(c.setY(BT), Math.max(stage.camera.zoom, 1.6));
      }
    }
  }
  function renderResult(res) {
    const box = root.querySelector('.bm-result');
    if (!box) return;
    if (res.ok) {
      const same = items.every((it) => !it.tray || (() => { const tgt = targetItems.find((x) => x.tray === it.tray); return tgt && [...tgt.ends].sort().join() === [...it.ends].sort().join(); })());
      box.innerHTML = `<div class="bm-ok">${icon('check')}<div><b>Your wiring is right.</b><p>Every leg and wire is joined just as this build needs${same ? '' : ', in your own holes: a different layout, the same circuit'}. You could build it like this on your real board.</p>
        <button type="button" class="lab-btn primary bm-run">${icon('play')}<span>Run the sketch on your build</span></button></div></div>`;
    } else {
      const items2 = res.problems.slice(0, 6);
      const runnable = res.runnable && !res.problems.some((p) => p.sev === 'missing');
      box.innerHTML = `<div class="bm-bad"><p><b>${res.problems.some((p) => p.sev === 'missing') ? 'Not finished yet.' : 'Nearly. Here is what to look at.'}</b> ${res.problems.some((p) => p.sev === 'rule' || p.sev === 'short') ? 'The red holes on the model show where.' : ''}</p>
        <ol class="bm-probs">${items2.map((p, k) => `<li class="bm-p ${p.sev}"><p>${p.text}</p>${p.ends.length ? `<button type="button" class="lab-link-btn" data-k="${k}">Show me</button>` : ''}</li>`).join('')}</ol>
        ${res.problems.length > items2.length ? `<p class="bm-small">And ${res.problems.length - items2.length} more. Fix these first, then check again.</p>` : ''}
        ${runnable ? `<p class="bm-small">Your wiring is safe to power, just not what this build needs. <button type="button" class="lab-link-btn bm-run">Run the sketch on it anyway, and see what happens</button></p>` : ''}</div>`;
      box.querySelectorAll('[data-k]').forEach((bt) => bt.addEventListener('click', () => {
        const p = items2[+bt.dataset.k];
        const c = p.ends.map(pos).reduce((a, q) => a.add(q), V(0, 0, 0)).multiplyScalar(1 / p.ends.length);
        stage.lookAt(c.setY(BT), Math.max(stage.camera.zoom, 2));
        setCursorTo(p.ends[0]);
      }));
    }
    box.querySelector('.bm-run')?.addEventListener('click', runMine);
  }
  function record() {
    const all = load(WIRED, {}) || {};
    const r = all[id] || { n: 0, first: new Date().toISOString() };
    r.n++;
    r.last = new Date().toISOString();
    r.title = target0.title || id;
    all[id] = r;
    save(WIRED, all);
    host.dispatchEvent(new CustomEvent('lab-wired', { bubbles: true, detail: { build: id } }));
    stage.toast?.(`${icon('check')}<span><b>Wired correctly</b><small>${esc(target0.title || '')}</small></span>`);
  }
  function runMine() {
    const data = R.buildFromItems(target0, items, pins, { title: `Your wiring: ${target0.title}` });
    remount(data, 'mine');
  }

  // ---------- your own wiring, running ----------
  function showMine() {
    root.innerHTML = `<div class="bm-mine">${icon('play')}<div><b>This is your own wiring.</b>
      <p>The board runs the sketch on the wiring you built, just as it would on a real Uno. Its controls are in the Explore tab. If it does not do what the page says, look at what is different from the course’s build.</p>
      <div class="bm-selbar"><button type="button" class="lab-btn primary bm-back">Back to Build it yourself</button><button type="button" class="lab-btn bm-course">Show the course’s build</button></div></div></div>`;
    root.querySelector('.bm-back').addEventListener('click', () => remount(null, 'practice'));
    root.querySelector('.bm-course').addEventListener('click', () => remount(null, null));
  }
  function remount(data, then) {
    const go = window.ArduinoLabs?.mount;
    if (!go) return;
    const wasFull = !!stage.fullscreen?.on;
    try { W.sim?.unplug?.(); } catch {}
    ac.abort();
    try { stage.dispose(); } catch {}
    if (data) host.labBuild = data; else delete host.labBuild;
    if (then) host.dataset.buildStart = then; else delete host.dataset.buildStart;
    host.classList.remove('lab-live', 'lab-ready', 'lab-full', 'lab-fs', 'drawer-closed');
    host.innerHTML = '';
    delete host.dataset.mounted;
    go(host).then(() => { if (wasFull) host.labStage?.fullscreen.enter(); });
  }

  // ---------- start ----------
  const start = host.dataset.buildStart;
  delete host.dataset.buildStart;
  home();
  if (mine) {
    ui.info('Your wiring', '<p>This is the wiring you built, on the virtual Arduino, with the sketch running on it as if you had uploaded it. If it does not do what the page says, your wiring is why. The <b>Build</b> tab takes you back.</p>');
    // start it, as an upload would
    let tries = 0;
    const t = setInterval(() => {
      const bt = host.querySelector('.sim-run');
      if (++tries > 100 || !host.isConnected) clearInterval(t);
      else if (bt && !bt.disabled) { clearInterval(t); bt.click(); }
    }, 100);
  } else if (start === 'practice') {
    ui.tab('build');
    startPractice();
  }

  return {
    get mode() { return mode; },
    get items() { return items; },
    get steps() { return steps; },
    get step() { return gStep; },
    guided: startGuided,
    practice: startPractice,
    next: () => showStep(Math.min(steps.length + 1, gStep + 1)),
    back: () => showStep(Math.max(0, gStep - 1)),
    place, typed, check: runCheck, flip: (iid) => flip(items.find((x) => x.id === iid)), remove, select,
    begin: (trayId) => beginPlace(trayId ? trayById[trayId] : null),
    cursor: () => endAtCursor(),
    // where an end is on the screen (for the test bench)
    screen(e) {
      const v = pos(e).clone().project(stage.camera);
      const r = stage.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    key: (k) => practiceKey({ key: k }),
    lastCheck: () => lastCheck,
    home,
  };
}

// ---------- the page's own steps after the wiring picture ----------
// Chunks in page order: each paragraph, list item, table row, note and
// "If not" box between this figure and the next wiring figure. A chunk inside a
// numbered step carries that step's "You should see".
function readChunks(host) {
  const out = [];
  const fig = host.closest('figure');
  if (!fig) return out;
  const els = [];
  for (let n = fig.nextElementSibling; n; n = n.nextElementSibling) {
    if (n.matches('figure.wiring, section') || n.querySelector('figure.wiring')) break;
    els.push(n);
  }
  const SEL = 'p, li, tr, .ifnot, .note, h4, h5';
  const outermost = (el, scope) => { for (let a = el.parentElement; a && a !== scope; a = a.parentElement) if (a.matches(SEL)) return false; return true; };
  const seeText = (s) => (s ? s.textContent.replace(/^\s*You should see\s*/i, '').replace(/\s+/g, ' ').trim() : null);
  for (const el of els) {
    const cands = el.matches(SEL) ? [el] : [...el.querySelectorAll(SEL)].filter((c) => outermost(c, el) && !c.closest('.see, details'));
    for (const c of cands) {
      const step = c.closest('.step');
      // table cells and line breaks become spaces, so "VSS" and "f1" stay two words
      const text = (c.matches('tr') ? [...c.cells].map((x) => x.textContent).join(' | ') : c.textContent).replace(/\s+/g, ' ');
      const isBefore = !step && c.matches('.ifnot') && /^\s*before you start/i.test(text);
      if (isBefore && !out.before) {
        const head = c.querySelector('b');
        out.before = { title: head ? head.textContent.trim() : 'Before you start', html: head ? c.innerHTML.replace(head.outerHTML, '').trim() : c.innerHTML };
      }
      out.push({ text, step, before: isBefore, see: seeText(step?.querySelector('.see')), strong: step?.querySelector('strong')?.textContent.trim() || '' });
    }
  }
  return out;
}

const CSS = `
.bm { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 16px; font-size: 13.5px; line-height: 1.45; color: var(--lab-text); }
.bm-lead { margin: 0; }
.bm-choice { display: flex; gap: 12px; align-items: flex-start; text-align: left; font: inherit; color: var(--lab-ink); background: var(--lab-paper); border: 1.5px solid var(--lab-line); border-radius: 12px; padding: 12px 14px; cursor: pointer; }
.bm-choice:hover { border-color: var(--lab-ink); }
.bm-choice:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 2px; }
.bm-choice .lab-ico { flex: none; width: 22px; height: 22px; margin-top: 2px; color: var(--lab-accent); }
.bm-choice b { display: block; font: 600 15px/1.3 var(--lab-display); }
.bm-choice small { display: block; color: var(--lab-muted); font-size: 12.5px; margin-top: 2px; }
.bm-choice em { font-style: normal; color: var(--lab-good); }
.bm-done { margin: 0; color: var(--lab-good); display: flex; gap: 6px; align-items: center; font-weight: 600; }
.bm-done .lab-ico { width: 16px; height: 16px; }
.bm-head { display: flex; align-items: center; gap: 8px; }
.bm-head .lab-btn { margin-left: auto; padding: 4px 12px; }
.bm-k { font: 700 11.5px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: .12em; color: var(--lab-muted); }
.bm-meter { height: 6px; border-radius: 3px; background: var(--lab-line); overflow: hidden; }
.bm-meter span { display: block; height: 100%; background: var(--lab-gold); transition: width .3s; }
.bm-title { margin: 0; font: 600 16px/1.3 var(--lab-display); color: var(--lab-ink); }
.bm-step { display: flex; flex-direction: column; gap: 8px; }
.bm-step p { margin: 0; }
.bm-where code, .bm code { font: 600 12.5px/1.3 var(--lab-mono); background: var(--lab-tint); color: var(--lab-ink); border-radius: 5px; padding: 1px 5px; }
.bm-see { border-left: 4px solid var(--lab-good); background: rgba(31, 138, 112, 0.08); border-radius: 0 10px 10px 0; padding: 8px 10px; }
.bm-see b { display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--lab-good); margin-bottom: 2px; }
.bm-then { border-left: 4px solid var(--lab-gold); background: rgba(255, 190, 0, 0.1); border-radius: 0 10px 10px 0; padding: 8px 10px; }
.bm-then b { display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--lab-gold-ink, #8a5c00); margin-bottom: 2px; }
.bm-then span { display: block; margin-top: 3px; }
.bm-note { color: var(--lab-muted); font-size: 12.5px; }
.bm-before { font-size: 12.5px; color: var(--lab-text); max-height: 14em; overflow: auto; border: 1px solid var(--lab-line); border-radius: 10px; padding: 8px 10px; background: var(--lab-panel); }
.bm-nav { display: flex; gap: 8px; }
.bm-nav .lab-btn { flex: 1; min-height: 40px; }
.bm-hint, .bm-small { margin: 0; font-size: 12px; color: var(--lab-muted); }
.bm kbd { font: 600 11px/1 var(--lab-mono); border: 1px solid var(--lab-line); border-bottom-width: 2px; border-radius: 4px; padding: 1px 4px; background: var(--lab-paper); color: var(--lab-ink); }
.bm-status { margin: 0; min-height: 2.9em; padding: 8px 10px; border-radius: 10px; background: var(--lab-tint); color: var(--lab-ink); }
.bm-status small { color: var(--lab-muted); }
.bm-sec { display: flex; flex-direction: column; gap: 6px; }
.bm-sec-t { font: 700 11px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: .12em; color: var(--lab-muted); }
.bm-tray { display: flex; flex-wrap: wrap; gap: 6px; }
.bm-chip { display: inline-flex; align-items: center; gap: 5px; font: 500 13px/1.25 var(--lab-font); color: var(--lab-ink); background: var(--lab-paper); border: 1.5px dashed var(--lab-line); border-radius: 999px; padding: 6px 12px; min-height: 36px; cursor: pointer; text-align: left; }
.bm-chip:hover { border-color: var(--lab-ink); }
.bm-chip:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 2px; }
.bm-chip .lab-ico { width: 15px; height: 15px; flex: none; }
.bm-chip.placed { border-style: solid; color: var(--lab-muted); }
.bm-chip.placed .lab-ico { color: var(--lab-good); }
.bm-chip[aria-pressed="true"] { border: 1.5px solid var(--lab-gold); background: rgba(255, 190, 0, 0.18); color: var(--lab-ink); }
.bm-wirebar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bm-col { display: inline-flex; gap: 5px; align-items: center; font-size: 12.5px; color: var(--lab-muted); }
.bm select, .bm input { font: 500 13px/1.3 var(--lab-font); color: var(--lab-ink); background: var(--lab-paper); border: 1.5px solid var(--lab-line); border-radius: 8px; padding: 5px 8px; min-height: 34px; }
.bm-pend, .bm-sel { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; border: 1.5px solid var(--lab-gold); border-radius: 12px; padding: 8px 10px; background: rgba(255, 190, 0, 0.08); }
.bm-pend[hidden], .bm-sel[hidden] { display: none; }
.bm-sel { flex-direction: column; align-items: stretch; border-color: var(--lab-line); background: var(--lab-panel); }
.bm-legs { margin: 0; padding: 0 0 0 18px; font-size: 12.5px; }
.bm-selbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bm-type { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bm-type label { display: inline-flex; gap: 6px; align-items: center; color: var(--lab-muted); font-size: 12.5px; }
.bm-type input { font-family: var(--lab-mono); width: 8.5em; }
.bm-type small { flex-basis: 100%; color: var(--lab-muted); font-size: 11.5px; }
.bm-checkbar { display: flex; flex-wrap: wrap; gap: 8px; }
.bm-checkbar .lab-btn, .bm-ok .lab-btn, .bm-mine .lab-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; }
.bm-checkbar .lab-ico, .bm-ok .lab-btn .lab-ico { width: 15px; height: 15px; }
.bm-result:empty { display: none; }
.bm-ok, .bm-mine { display: flex; gap: 10px; align-items: flex-start; border: 1.5px solid var(--lab-good); border-radius: 12px; padding: 10px 12px; background: rgba(31, 138, 112, 0.08); }
.bm-ok > .lab-ico, .bm-mine > .lab-ico { flex: none; width: 22px; height: 22px; color: var(--lab-good); margin-top: 1px; }
.bm-ok p, .bm-mine p { margin: 4px 0 8px; }
.bm-bad p { margin: 0; }
.bm-probs { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.bm-p { border: 1.5px solid var(--lab-line); border-left-width: 4px; border-radius: 10px; padding: 8px 10px; background: var(--lab-paper); }
.bm-p.rule, .bm-p.short { border-left-color: var(--lab-accent); }
.bm-p.wiring { border-left-color: var(--lab-gold); }
.bm-p.missing { border-left-color: var(--lab-muted); }
.bm-p code { font: 600 12px/1.3 var(--lab-mono); }
.bm-float { position: absolute; z-index: 6; bottom: 70px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 24px); width: max-content; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 999px; background: var(--lab-hud); color: #fff; font: 500 13px/1.35 var(--lab-font); box-shadow: var(--lab-shadow); }
.bm-float[hidden] { display: none; }
.bm-float b { color: #ffd760; }
.bm-float code { font: 600 12px/1 var(--lab-mono); color: #fff; }
.bm-float button { flex: none; font: 600 12.5px/1 var(--lab-font); color: #24182e; background: #ffbe00; border: 0; border-radius: 999px; padding: 7px 12px; min-height: 32px; cursor: pointer; }
.bm-float button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.bm .lab-link-btn { font: inherit; font-size: 12.5px; color: var(--lab-accent); background: none; border: 0; padding: 4px 0 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
`;
let cssDone = false;
function addCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

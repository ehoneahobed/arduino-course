// "Run the sketch": a virtual Arduino inside a build's 3D view.
//
// The course's real sketches, compiled for the Uno's ATmega328P by
// tools/compile_sketches.mjs (assets/labs/hex/<sketch>.js, fetched when a
// build opens), run instruction by instruction in avr8js (uno.js) at the
// chip's own speed. What the chip does to its pins is joined to the 3D parts
// through the build's own wiring (the same wires, strips and rails as the
// X-ray view), so a light lights only if the sketch drives the pin its wire
// goes to:
//   - lights (and the RGB light, and the modules) from each pin's time high,
//     so analogWrite's PWM shows as brightness
//   - the buzzer from the pin's frequency (WebAudio, off until asked for)
//   - the servo from the length of its pulses
//   - buttons, knobs, the light sensor, rain sensor, distance sensor,
//     temperature sensor and keypad as inputs you set in the panel
//   - the 16x2 screen from its pins (HD44780, 4-bit) or over I2C (backpack)
//   - the serial monitor from the chip's USART
// Which sketches go with which build: sketches.json.
//
// The Code tab holds an editor. A learner's edited sketch cannot go through
// the real compiler in the browser, so it is checked and run by the course's
// own Arduino C++ interpreter (cpp-parse.js, cpp-compile.js, vboard.js) on
// a virtual board with the same outside as the emulated chip: the same parts,
// wiring and inputs work for both. tools/interp_check.mjs checks that every
// course sketch behaves the same both ways.
import { Uno, HZ, PinState, pinNumber, pinLabel, decodeProgram } from './uno.js';
import { HD44780, Backpack } from './hd44780.js';
import { siteUrl, icon, label, setLabel, THREE } from './runtime.js';
import { compileSketch } from './cpp-compile.js';
import { VBoard } from './vboard.js';
import { codeEditor } from './editor.js';
import { wireSonar, wireLcd, dhtStart, dhtWatch as dhtWatch1, tmMake, tmWatch as tmWatch1, tmText, padResolve as padResolve1 } from './devices.js';
import * as P from './parts.js';
import MAP from './sketches.json';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const OUT = (m) => m === PinState.High || m === PinState.Low;

// ---------- fetching a compiled sketch (a classic script: works from file://) ----------
const loading = {};
export function loadSketch(name) {
  const have = window.ArduinoSketches?.[name];
  if (have) return Promise.resolve(have);
  return (loading[name] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = siteUrl(`assets/labs/hex/${name}.js`);
    s.onload = () => (window.ArduinoSketches?.[name] ? resolve(window.ArduinoSketches[name]) : reject(new Error('empty')));
    s.onerror = () => { delete loading[name]; reject(new Error('could not load ' + name)); };
    document.head.appendChild(s);
  }));
}

// The "WHAT IT DOES" paragraph of a sketch's header, in plain words.
function whatItDoes(src) {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => /^\/\/\s+WHAT IT DOES/.test(l));
  if (i < 0) return '';
  const out = [];
  for (let k = i + 1; k < lines.length; k++) {
    const m = /^\/\/(\s*)(.*)$/.exec(lines[k]);
    if (!m || /^={6,}|^-{6,}/.test(m[2])) break;
    if (/^[A-Z][A-Z ,'()-]{3,}$/.test(m[2].trim()) && m[1].length <= 4) break; // the next heading
    if (!m[2].trim()) { if (out.length) break; continue; }
    out.push(m[2].trim());
  }
  return out.join(' ');
}

// ---------- the circuit: which nodes are joined, given the buttons ----------
function circuit(W) {
  const links = W.conductors.map((c) => [c.a, c.b]);
  const switches = [];
  const termsOf = (i) => W.terms.filter((t) => t.part === i);
  for (const p of W.parts) {
    if (p.kind !== 'btn') continue;
    // a push button's legs on the same column are one piece of metal; pressing joins the two columns
    const cols = new Map();
    for (const t of termsOf(p.i)) { const c = +t.at.slice(1); if (!cols.has(c)) cols.set(c, []); cols.get(c).push(t.node); }
    const groups = [...cols.values()];
    for (const g of groups) for (let k = 1; k < g.length; k++) links.push([g[0], g[k]]);
    if (groups.length === 2) switches.push({ part: p, a: groups[0][0], b: groups[1][0], down: false });
  }
  const nodes = new Set();
  links.forEach(([a, b]) => { nodes.add(a); nodes.add(b); });
  W.terms.forEach((t) => nodes.add(t.node));
  // two-legged parts that carry current (for the analog readings and pull resistors)
  const edges = [];
  for (const p of W.parts) {
    const ts = termsOf(p.i);
    if (p.kind === 'res') edges.push({ a: ts[0].node, b: ts[1].node, r: () => P.ohms(p.data.value) });
    else if (p.kind === 'blk' && /^light sensor/.test(p.data.label)) edges.push({ a: ts[0].node, b: ts[1].node, r: () => p.ldrOhms ?? 2e4, ldr: p });
    else if (p.kind === 'pot') {
      const R = 1e4;
      edges.push({ a: ts[0].node, b: ts[1].node, r: () => Math.max(1, (p.knob ?? 0.5) * R) });
      edges.push({ a: ts[1].node, b: ts[2].node, r: () => Math.max(1, (1 - (p.knob ?? 0.5)) * R) });
    }
  }
  return { links, switches, nodes: [...nodes], edges, termsOf };
}

function joinNets(C) {
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  const unite = (a, b) => parent.set(find(a), find(b));
  C.links.forEach(([a, b]) => unite(a, b));
  C.switches.forEach((s) => { if (s.down) unite(s.a, s.b); });
  return find;
}

// ---------- the panel's look (kept here, like the concept labs' own styles) ----------
const CSS = `
.sim { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.sim-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sim-head label { font-size: 13px; color: var(--lab-muted); display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 200px; }
.sim select { font: 500 13px/1.3 var(--lab-mono); color: var(--lab-ink); background: var(--lab-paper); border: 1.5px solid var(--lab-line); border-radius: 8px; padding: 5px 8px; min-width: 0; flex: 1; max-width: 100%; }
.sim-file { font: 600 13px/1.3 var(--lab-mono); color: var(--lab-ink); }
.sim-about { margin: 0; font-size: 13px; line-height: 1.45; color: var(--lab-text); }
.sim-real { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--lab-muted); }
.sim-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sim-bar .lab-btn { display: inline-flex; align-items: center; gap: 6px; }
.sim-bar .lab-btn .lab-ico { width: 15px; height: 15px; }
.sim-state { font-size: 12.5px; color: var(--lab-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.sim-state.on { color: var(--lab-good); }
.sim-err { border: 1.5px solid var(--lab-accent); border-radius: 10px; padding: 8px 10px; background: rgba(202, 31, 63, 0.06); font-size: 13px; }
.sim-err pre { margin: 6px 0 0; font: 12px/1.45 var(--lab-mono); white-space: pre-wrap; color: var(--lab-ink); }
.sim-ins { display: flex; flex-direction: column; gap: 8px; }
.sim-ins:empty { display: none; }
.sim-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.sim-row > span { color: var(--lab-text); }
.sim-row > .sim-hint { color: var(--lab-muted); font-size: 12.5px; }
.sim-press { touch-action: none; user-select: none; -webkit-user-select: none; min-height: 36px; }
.sim-press[aria-pressed="true"] { transform: translateY(1px); }
.sim-slide { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font-size: 13px; color: var(--lab-text); }
.sim-slide output { font: 600 12.5px/1.3 var(--lab-mono); color: var(--lab-ink); text-align: right; }
.sim-slide input { grid-column: 1 / -1; width: 100%; accent-color: var(--lab-accent); min-height: 28px; }
.sim-pad { display: grid; grid-template-columns: repeat(4, 44px); gap: 5px; }
.sim-pad .lab-btn { padding: 8px 0; font: 600 15px/1 var(--lab-mono); border-radius: 8px; }
.sim-mon { border: 1px solid var(--lab-line); border-radius: 10px; background: var(--lab-panel); padding: 8px 10px; }
.sim-mon h5 { margin: 0 0 6px; font: 700 11.5px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: 0.12em; color: var(--lab-muted); display: flex; gap: 8px; align-items: center; }
.sim-mon h5 span { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 500; }
.sim-log { font: 12.5px/1.45 var(--lab-mono); background: var(--lab-paper); color: var(--lab-ink); border: 1px solid var(--lab-line); border-radius: 8px; height: 140px; overflow: auto; padding: 6px 9px; white-space: pre; margin: 0; }
.sim-log:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 1px; }
.sim-log .sim-sys { color: var(--lab-muted); font-style: italic; }
.sim-send { display: flex; gap: 6px; margin-top: 6px; }
.sim-send input { flex: 1; min-width: 0; font: 12.5px/1.3 var(--lab-mono); padding: 5px 8px; border: 1.5px solid var(--lab-line); border-radius: 8px; background: var(--lab-paper); color: var(--lab-ink); }
.sim-screen { font: 600 13px/1.35 var(--lab-mono); background: #8cc44c; color: #1f3a12; border-radius: 6px; padding: 6px 9px; white-space: pre; display: inline-block; letter-spacing: 0.04em; }
.sim-screen.off { background: #5d6b49; }
.sim-7seg { font: 700 22px/1 var(--lab-mono); background: #111; color: #ff4b3a; border-radius: 6px; padding: 6px 10px; letter-spacing: 0.18em; display: inline-block; }
.sim-power { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--lab-muted); margin-left: auto; font-variant-numeric: tabular-nums; min-width: 0; }
.sim-power i { flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--lab-line); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-line); }
.sim-power[data-s="run"] { color: var(--lab-good); }
.sim-power[data-s="run"] i { background: var(--lab-good); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-good); }
.sim-power[data-s="pause"] { color: var(--lab-gold-ink); }
.sim-power[data-s="pause"] i { background: var(--lab-gold); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-gold); }
.sim-power b { font-weight: 600; }
.sim-which { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--lab-muted); }
.sim-which b { color: var(--lab-text); font-weight: 600; }
.sim-which .lab-link-btn, .ed-msg .lab-link-btn { font: inherit; color: var(--lab-accent); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.sim-note { border: 1.5px solid var(--lab-gold); border-radius: 10px; padding: 7px 10px; background: rgba(255, 190, 0, 0.1); font-size: 13px; line-height: 1.45; }
.sim-note button { margin-left: 4px; }
.ed-bar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.ed-bar .lab-btn { display: inline-flex; align-items: center; gap: 6px; }
.ed-bar .lab-btn .lab-ico { width: 15px; height: 15px; }
.ed-msg { margin-top: 8px; font-size: 13px; line-height: 1.45; }
.ed-msg:empty { display: none; }
.ed-msg .ok { color: var(--lab-good); font-weight: 600; }
.ed-msg ul { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.ed-msg li { border: 1.5px solid var(--lab-accent); border-radius: 10px; padding: 7px 10px; background: rgba(202, 31, 63, 0.06); }
.ed-msg li.warn { border-color: var(--lab-gold); background: rgba(255, 190, 0, 0.1); }
.ed-msg code { font: 12px/1.45 var(--lab-mono); color: var(--lab-ink); white-space: pre-wrap; word-break: break-word; display: block; }
.ed-msg small { display: block; margin-top: 3px; color: var(--lab-text); }
.ed-hint { margin: 6px 0 0; font-size: 12px; color: var(--lab-muted); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
let cssDone = false;
function addCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const PRESS_MIN_MS = 120; // a quick click still lasts long enough for a sketch to see it

// ---------- the lab side ----------
export function attachSim(stage, ui, host, W) {
  const list = MAP.builds[host.dataset.build];
  if (!list || !list.length || !W.uno) return null;
  addCss();
  const C = circuit(W);
  const find0 = joinNets(C);

  // ---- the panel ----
  const controls = host.querySelector('.lab-controls');
  const g = document.createElement('div');
  g.className = 'lab-group lab-sim';
  g.innerHTML = `<span class="lab-group-title">Run the sketch</span>
<div class="sim">
  <div class="sim-head">${list.length > 1
    ? `<label>Sketch <select aria-label="Which sketch to run">${list.map((n) => `<option value="${n}">${n}.ino</option>`).join('')}</select></label>`
    : `<span class="sim-file">${list[0]}.ino</span>`}</div>
  <div class="sim-err" hidden role="alert"></div>
  <div class="sim-note" hidden role="status"></div>
  <div class="sim-bar" role="group" aria-label="The board">
    <button type="button" class="lab-btn primary sim-run" disabled>${icon('play')}<span>Run</span></button>
    <button type="button" class="lab-btn sim-stop" disabled aria-label="Stop: unplug the board">${icon('stop')}<span>Stop</span></button>
    <button type="button" class="lab-btn sim-reset" disabled aria-label="Reset: start the sketch again, still plugged in">Reset</button>
    <span class="sim-power" data-s="off"><i aria-hidden="true"></i><span class="sim-state">Loading the sketch…</span></span>
    <span class="sr-only sim-said" aria-live="polite"></span>
  </div>
  <div class="sim-ins"></div>
  <p class="sim-about" hidden></p>
  <p class="sim-which"></p>
  <div class="sim-mon" hidden>
    <h5>Serial monitor <span>9600 baud</span></h5>
    <pre class="sim-log" role="log" aria-live="off" aria-label="Serial monitor: what the sketch prints" tabindex="0"></pre>
    <form class="sim-send"><input type="text" aria-label="Text to send to the board" placeholder="Send to the board" autocomplete="off" spellcheck="false"><button type="submit" class="lab-btn">Send</button><button type="button" class="lab-btn sim-clear">Clear</button></form>
  </div>
</div>`;
  controls.prepend(g);
  const $ = (s) => g.querySelector(s);
  const sel = $('select');
  const about = $('.sim-about');
  const errBox = $('.sim-err');
  const runBtn = $('.sim-run');
  const stopBtn = $('.sim-stop');
  const resetBtn = $('.sim-reset');
  const stateEl = $('.sim-state');
  const powerEl = $('.sim-power');
  const saidEl = $('.sim-said');
  const noteBox = $('.sim-note');
  const whichEl = $('.sim-which');
  const insEl = $('.sim-ins');
  const logEl = $('.sim-log');
  const sendForm = $('.sim-send');

  // the sketch in the Code tab: an editor, and the buttons to check and upload it
  const codeGroup = ui.group('The sketch', { tab: 'code' });
  const whichCode = document.createElement('p');
  whichCode.className = 'sim-which';
  whichCode.style.margin = '0 0 8px';
  codeGroup.appendChild(whichCode);
  const code = codeEditor(codeGroup, { file: list[0] + '.ino', text: '// loading…', label: 'The sketch. You can change it, then press Upload and run.', onInput: (t) => edited(t) });
  const edBar = document.createElement('div');
  edBar.className = 'ed-bar';
  edBar.innerHTML = `<button type="button" class="lab-btn ed-verify">${icon('check')}<span>Verify</span></button><button type="button" class="lab-btn primary ed-upload">${icon('play')}<span>Upload and run</span></button><button type="button" class="lab-btn ed-back" disabled>Back to the course’s sketch</button>`;
  codeGroup.appendChild(edBar);
  const edMsg = document.createElement('div');
  edMsg.className = 'ed-msg';
  edMsg.setAttribute('role', 'status');
  edMsg.id = 'edmsg-' + Math.random().toString(36).slice(2, 8);
  codeGroup.appendChild(edMsg);
  code.describedBy(edMsg.id);
  const edHint = document.createElement('p');
  edHint.className = 'ed-hint';
  edHint.textContent = 'Tab indents. To leave the box with the keyboard, press Esc, then Tab. Your changes stay on this computer.';
  codeGroup.appendChild(edHint);
  const built = document.createElement('p');
  built.className = 'sim-real';
  built.style.margin = '6px 0 0';
  codeGroup.appendChild(built);
  ui.refreshTabs();

  // ---- what is in the build ----
  const termsOf = C.termsOf;
  const term = (p, re) => termsOf(p.i).find((t) => re.test(t.leg));
  const leds = []; // { mat, a, c, kind }
  const rgbs = []; // { dies, lens, r, g, b, common }
  const buzzers = [];
  const servos = [];
  const pots = [];
  const ldrs = [];
  const sonars = [];
  const lcds = [];
  const pads = [];
  const sources = []; // modules that put a voltage on a node: { node, v() }
  const dhts = [];
  const fans = [];
  const steppers = [];
  for (const p of W.parts) {
    const d = p.data;
    if (p.kind === 'led') {
      const m = p.group.children[0];
      leds.push({ mat: m.userData.lens, a: termsOf(p.i)[0].node, c: termsOf(p.i)[1].node, p, base: m.userData.lens.emissiveIntensity });
    } else if (p.kind === 'buz') {
      const ts = termsOf(p.i);
      buzzers.push({ p, plus: ts[0].node, minus: ts[1].node, body: p.group.children[0].children[0] });
    } else if (p.kind === 'pot') {
      p.knob = d.label === 'contrast' ? 0.12 : 0.5;
      pots.push(p);
    } else if (p.kind === 'blk' && /^RGB LED/.test(d.label)) {
      const m = p.group.children[0];
      const ts = termsOf(p.i);
      const by = (nm) => ts.find((t) => t.leg.startsWith(nm))?.node;
      rgbs.push({ p, dies: m.userData.dies, lens: m.userData.lens, r: by('red'), g: by('green'), b: by('blue'), common: by('long') });
    } else if (p.kind === 'blk' && /^light sensor/.test(d.label)) {
      p.light = 50;
      ldrs.push(p);
    } else if (p.kind === 'blk' && /^HC-SR04/.test(d.label)) {
      const ts = termsOf(p.i);
      const named = ts.some((t) => /Trig/.test(t.leg));
      sonars.push({ p, trig: named ? term(p, /Trig/).node : ts[1].node, echo: named ? term(p, /Echo/).node : ts[2].node, cm: 30 });
    } else if (p.kind === 'blk' && /^LCD1602, bare/.test(d.label)) {
      const ts = termsOf(p.i);
      const by = (nm) => ts.find((t) => t.leg === nm)?.node;
      lcds.push({ p, screen: p.model?.screen, rs: by('RS'), e: by('E'), d: ['D4', 'D5', 'D6', 'D7'].map(by), v0: by('V0'), i2c: false });
    } else if (p.kind === 'mod' && /^LCD1602, I2C/.test(d.label)) {
      lcds.push({ p, screen: p.model?.screen, i2c: true });
    } else if (p.kind === 'blk' && /keypad/.test(d.label)) {
      pads.push({ p, pins: termsOf(p.i).map((t) => t.node) });
    } else if (p.kind === 'blk' && /^rain/.test(d.label)) {
      p.wet = 0;
      sources.push({ p, kind: 'rain', terms: termsOf(p.i), v: () => 4.6 - 3.4 * (p.wet / 100) });
    } else if (p.kind === 'blk' && /^DHT11/.test(d.label)) {
      dhts.push({ p, terms: termsOf(p.i), temp: 27, hum: 65 });
    } else if (p.kind === 'blk' && /^motor/.test(d.label)) {
      fans.push({ p, fan: p.model?.fan, speed: 0 });
    } else if (p.kind === 'mod' && /^traffic/.test(d.label)) {
      const ts = termsOf(p.i);
      const gnd = ts.find((t) => /^GND/.test(t.leg))?.node;
      for (const k of ['R', 'Y', 'G']) { const t = ts.find((x) => x.leg === k + ' pin'); if (t && p.model?.lights?.[k]) leds.push({ mat: p.model.lights[k], a: t.node, c: gnd, p, base: 0.1, mod: true }); }
    } else if (p.kind === 'mod' && /^RGB module/.test(d.label)) {
      const ts = termsOf(p.i);
      const by = (nm) => ts.find((t) => t.leg === nm + ' pin')?.node;
      rgbs.push({ p, dies: null, lens: p.model?.rgbLens, r: by('R'), g: by('G'), b: by('B'), common: by('GND') });
    } else if (p.kind === 'mod' && /^servo/.test(d.label)) {
      const horn = p.model?.horn;
      let pivot = null;
      if (horn) {
        pivot = new THREE.Group();
        pivot.position.copy(horn.position);
        horn.parent.add(pivot);
        horn.position.set(0, 0, 0);
        pivot.add(horn);
        // a dot on one arm, so the angle can be read (the horn has two arms)
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), new THREE.MeshBasicMaterial({ color: 0xca1f3f }));
        dot.rotation.x = Math.PI / 2;
        dot.position.set(2.45, 0, 0.18);
        dot.userData.noInk = true;
        pivot.add(dot);
        pivot.rotation.z = Math.PI / 2; // 90 degrees until a sketch says otherwise
      }
      const tag = label('', { scale: 0.9, always: true, min: 11 });
      tag.position.copy(p.focus).setY(p.focus.y + 2.5);
      tag.visible = false;
      stage.scene.add(tag);
      servos.push({ p, sig: termsOf(p.i)[0].node, pivot, angle: 90, target: null, tag });
    } else if (p.kind === 'mod' && /^ULN2003/.test(d.label)) {
      const ts = termsOf(p.i);
      steppers.push({ p, ins: ['IN1', 'IN2', 'IN3', 'IN4'].map((nm) => ts.find((t) => t.leg === nm + ' pin')?.node), leds: p.model?.leds || [] });
    }
  }
  // A soft glow for lights that have none of their own (the RGB light, the modules' lights).
  function haloFor(mat, root, lift, size) {
    let mesh = null;
    root.traverse((o) => { if (!mesh && o.isMesh && o.material === mat) mesh = o; });
    if (!mesh) return null;
    const h = P.haloSprite(0xffffff, size);
    h.position.copy(mesh.position).setY(mesh.position.y + lift);
    mesh.parent.add(h);
    return h;
  }
  for (const L of leds) if (L.mod) L.halo = haloFor(L.mat, L.p.group, 1.2, 3.4);
  for (const R of rgbs) R.halo = R.dies ? haloFor(R.lens, R.p.group, 2.2, 5.5) : haloFor(R.lens, R.p.group, 1.2, 4.2);
  const npns = W.parts.filter((p) => p.kind === 'npn').map((p) => ({ p, base: termsOf(p.i)[1].node }));
  for (const b of buzzers) {
    b.tag = label('', { scale: 0.9, always: true, min: 11 });
    b.tag.position.copy(b.p.focus).setY(b.p.focus.y + 1.6);
    b.tag.visible = false;
    stage.scene.add(b.tag);
  }

  // ---- nets and what drives them ----
  let find = find0;
  let netInfo = new Map();
  const pinNet = []; // Arduino pin -> net
  function rebuild() {
    find = joinNets(C);
    netInfo = new Map();
    const info = (n) => { const k = find(n); if (!netInfo.has(k)) netInfo.set(k, { pins: [], v: undefined, src: null }); return netInfo.get(k); };
    for (const n of C.nodes) {
      const I = info(n);
      if (n === 'GND') I.v = 0;
      else if (n === 'P:5V') I.v = 5;
      else if (n === 'P:3V3') I.v = 3.3;
      else if (n.startsWith('P:')) { const p = pinNumber(n.slice(2)); if (p >= 0 && !I.pins.includes(p)) I.pins.push(p); }
    }
    for (const t of W.terms) if (t.source) info(t.node).v = /\+/.test(t.leg) ? 6 : 0;
    for (const s of sources) {
      // a module's output pin is the one whose strip reaches an analog pin
      for (const t of s.terms) { const I = info(t.node); if (I.pins.some((p) => p >= 14)) { I.src = s.v; } }
    }
    pinNet.length = 0;
    for (const [k, I] of netInfo) for (const p of I.pins) pinNet[p] = k;
    edgesAt = new Map();
    for (const e of C.edges) {
      const a = find(e.a), b = find(e.b);
      if (a === b) continue;
      (edgesAt.get(a) ?? edgesAt.set(a, []).get(a)).push({ e, o: b });
      (edgesAt.get(b) ?? edgesAt.set(b, []).get(b)).push({ e, o: a });
    }
  }
  let edgesAt = new Map();
  rebuild();
  const netOfNode = (n) => (n ? find(n) : null);
  const pinsOf = (n) => (n ? netInfo.get(find(n))?.pins ?? [] : []);
  const pinOfNode = (n) => pinsOf(n)[0] ?? -1;
  const usedPins = new Set();
  for (const I of netInfo.values()) I.pins.forEach((p) => usedPins.add(p));

  // ---- the running chip ----
  let uno = null;
  let rec = null; // the compiled sketch
  let running = false;
  let S = null; // the last sample of every pin
  const owned = new Set(); // input pins a device drives itself
  const floatV = new Float32Array(20).fill(2.5);

  // How a net is driven: { h: share of the time high, weak } or null (nothing drives it).
  function drive(net, self = -1, depth = 0, seen = null) {
    const I = netInfo.get(net);
    if (!I) return null;
    if (I.v !== undefined) return { h: I.v > 2.5 ? 1 : 0 };
    if (I.src) return { h: I.src() > 2.5 ? 1 : 0 };
    if (uno) {
      for (const p of I.pins) if (p !== self && OUT(uno.mode(p))) return { h: S ? S[p].duty : uno.level[p], pin: p };
      for (const p of I.pins) if (p !== self && uno.mode(p) === PinState.InputPullUp) return { h: 1, weak: true, pin: p };
    }
    if (depth < 2) {
      seen ??= new Set();
      seen.add(net);
      for (const { o } of edgesAt.get(net) || []) {
        if (seen.has(o)) continue;
        const d = drive(o, self, depth + 1, seen);
        if (d) return { ...d, via: true };
      }
    }
    return null;
  }
  // A net's voltage, for the analog pins: a source, or the weighted pull of the parts on it.
  function volts(net, self) {
    const I = netInfo.get(net);
    if (!I) return null;
    if (I.v !== undefined) return I.v;
    if (I.src) return I.src();
    for (const p of I.pins) if (p !== self && OUT(uno.mode(p))) return 5 * S?.[p].duty;
    let G = 0, Iy = 0;
    for (const { e, o } of edgesAt.get(net) || []) {
      const J = netInfo.get(o);
      let v = J.v ?? (J.src ? J.src() : undefined);
      if (v === undefined) for (const p of J.pins) if (OUT(uno.mode(p))) { v = 5 * (S ? S[p].duty : uno.level[p]); break; }
      if (v === undefined) continue;
      const gg = 1 / e.r();
      G += gg; Iy += gg * v;
    }
    if (self >= 0 && uno.mode(self) === PinState.InputPullUp) { G += 1 / 35000; Iy += 5 / 35000; }
    return G ? Iy / G : null;
  }

  // The level the world puts on each input pin the build uses.
  function resolveInputs() {
    if (!uno) return;
    for (const p of usedPins) {
      if (owned.has(p)) continue;
      const m = uno.mode(p);
      if (OUT(m)) continue;
      const net = pinNet[p];
      let v;
      const I = netInfo.get(net);
      if (I.v !== undefined) v = I.v > 2.5;
      else if (I.src) v = I.src() > 2.5;
      else {
        const d = drive(net, p);
        if (d && !d.weak) v = d.h > 0.5;
        else if (m === PinState.InputPullUp) v = true;
        else v = floatV[p] > 2.5; // floating: it reads whatever it picks up
      }
      if (uno.readInput(p) !== +v) uno.setInput(p, v);
    }
    for (const k of pads) padResolve(k);
  }
  function analogInputs() {
    for (let ch = 0; ch < 6; ch++) {
      const p = 14 + ch;
      let v = null;
      if (usedPins.has(p)) v = volts(pinNet[p], p);
      // a reading through parts (a divider, a knob, a sensor) wobbles by a count or so; a wire straight to 5V or GND does not
      const I = usedPins.has(p) ? netInfo.get(pinNet[p]) : null;
      uno.adcNoise[ch] = v !== null && I && I.v === undefined ? 0.005 : 0;
      if (v === null) {
        // nothing on it: a floating pin wanders
        floatV[p] = clamp(floatV[p] + (Math.random() - 0.5) * 0.6, 0.3, 4.7);
        v = floatV[p];
      }
      uno.adc.channelValues[ch] = clamp(v, 0, 5);
    }
    for (let p = 0; p < 14; p++) if (Math.random() < 0.08) floatV[p] = Math.random() * 5;
  }

  // ---- keypad: a pressed key joins a row pin to a column pin ----
  const KEYS = ['123A', '456B', '789C', '*0#D'];
  function padResolve(k) {
    padResolve1(uno, k.pins.slice(0, 4).map(pinOfNode), k.pins.slice(4, 8).map(pinOfNode), k.down, floatV);
  }
  for (const k of pads) { k.down = new Set(); k.pins.forEach((n) => { const p = pinOfNode(n); if (p >= 0) owned.add(p); }); }

  // ---- devices that need the chip's timing ----
  const lcdChips = [];
  function wireDevices() {
    owned.clear();
    for (const k of pads) k.pins.forEach((n) => { const p = pinOfNode(n); if (p >= 0) owned.add(p); });
    for (const s of sonars) {
      const trig = pinOfNode(s.trig), echo = pinOfNode(s.echo);
      if (trig < 0 || echo < 0) continue;
      owned.add(echo);
      wireSonar(uno, s, trig, echo);
    }
    lcdChips.length = 0;
    let backpack = null;
    for (const L of lcds) {
      const chip = new HD44780();
      L.chip = chip;
      lcdChips.push(L);
      if (L.i2c) {
        owned.add(18); owned.add(19); // SDA and SCL belong to the I2C hardware
        backpack = new Backpack(uno.twi, chip);
        uno.twi.eventHandler = backpack;
        L.backpack = backpack;
      } else {
        const rs = pinOfNode(L.rs), e = pinOfNode(L.e), d = L.d.map(pinOfNode);
        if (rs < 0 || e < 0 || d.some((x) => x < 0)) continue;
        wireLcd(uno, chip, rs, e, d);
      }
    }
    // a sketch that talks to an I2C screen the drawing leaves out (Part 8 reuses Part 6's screen)
    if (!backpack && /LiquidCrystal_I2C/.test(rec?.source || '')) {
      const chip = new HD44780();
      uno.twi.eventHandler = new Backpack(uno.twi, chip);
      lcdChips.push({ chip, i2c: true, offstage: true, backpack: uno.twi.eventHandler });
      owned.add(18); owned.add(19);
    }
    // DHT11: answers a start signal (data pin held low, then let go) with 40 bits
    for (const D of dhts) {
      const t = D.terms.find((x) => pinsOf(x.node).some((p) => p < 14));
      const pin = t ? pinsOf(t.node).find((p) => p < 14) : -1;
      if (pin < 0) continue;
      owned.add(pin);
      dhtStart(uno, D, pin);
    }
    // TM1637 four-digit display, for the sketch that uses one (not drawn in the build)
    tm = null;
    const tmm = /TM1637Display\s+\w+\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/.exec(rec?.source || '');
    if (tmm) {
      const val = (id) => +(/^\d+$/.test(id) ? id : (new RegExp(`(?:const\\s+)?int\\s+${id}\\s*=\\s*(\\d+)`).exec(rec.source)?.[1] ?? -1));
      const clk = val(tmm[1]), dio = val(tmm[2]);
      if (clk >= 0 && dio >= 0) { tm = tmMake(clk, dio); owned.add(clk); owned.add(dio); }
    }
  }
  let tm = null;
  function dhtWatch() { for (const D of dhts) dhtWatch1(uno, D); }
  function tmWatch() { if (tm) tmWatch1(uno, tm); }

  // ---- inputs in the panel ----
  insEl.innerHTML = '';
  const row = (html) => { const d = document.createElement('div'); d.className = 'sim-row'; d.innerHTML = html; insEl.appendChild(d); return d; };
  const slider = (text, min, max, val, fmt, onInput, step = 1) => {
    const id = 'sim-' + Math.random().toString(36).slice(2, 8);
    const d = document.createElement('div');
    d.className = 'sim-slide';
    d.innerHTML = `<label for="${id}">${text}</label><output for="${id}"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}">`;
    const inp = d.querySelector('input'), out = d.querySelector('output');
    const upd = () => { out.textContent = fmt(+inp.value); onInput(+inp.value); };
    inp.addEventListener('input', upd);
    upd();
    insEl.appendChild(d);
    return inp;
  };
  // press and hold: mouse, touch, or Space / Enter on the keyboard
  function holdButton(btn, down, up) {
    let t0 = 0, on = false, timer = 0;
    const press = () => { if (on) return; on = true; t0 = performance.now(); clearTimeout(timer); btn.setAttribute('aria-pressed', 'true'); down(); };
    const release = () => {
      if (!on) return;
      const wait = Math.max(0, PRESS_MIN_MS - (performance.now() - t0));
      on = false;
      timer = setTimeout(() => { btn.setAttribute('aria-pressed', 'false'); up(); }, wait);
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch {} press(); });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } });
    btn.addEventListener('blur', release);
    btn.addEventListener('click', (e) => e.preventDefault());
  }
  const pinWords = (p) => (p >= 0 ? (p >= 14 ? pinLabel(p) : 'pin ' + p) : 'no pin');
  C.switches.forEach((s, k) => {
    const pins = [...pinsOf(s.a), ...pinsOf(s.b)];
    const r = row(`<button type="button" class="lab-btn sim-press" aria-pressed="false">Press button ${C.switches.length > 1 ? k + 1 + ' ' : ''}(${pinWords(pins[0] ?? -1)})</button><span class="sim-hint">hold it down</span>`);
    const btn = r.querySelector('button');
    const cap = s.part.group.children[0]?.userData.cap;
    holdButton(btn, () => { s.down = true; rebuild(); resolveInputs(); if (cap) { cap.position.y -= 0.3; stage.invalidate(); } }, () => { s.down = false; rebuild(); resolveInputs(); if (cap) { cap.position.y += 0.3; stage.invalidate(); } });
  });
  if (C.switches.length > 1) insEl.querySelectorAll('.sim-hint').forEach((h, k) => { if (k) h.remove(); });
  for (const k of pads) {
    const d = document.createElement('div');
    d.className = 'sim-row';
    d.innerHTML = `<span>Keypad: hold a key</span><div class="sim-pad" role="group" aria-label="Keypad">${KEYS.map((r, ri) => [...r].map((ch, ci) => `<button type="button" class="lab-btn sim-press" aria-pressed="false" data-r="${ri}" data-c="${ci}" aria-label="Key ${ch}">${ch}</button>`).join('')).join('')}</div>`;
    insEl.appendChild(d);
    d.querySelectorAll('button').forEach((b) => {
      const key = { r: +b.dataset.r, c: +b.dataset.c };
      holdButton(b, () => { k.down.add(key); if (uno) padResolve(k); }, () => { k.down.delete(key); if (uno) padResolve(k); });
    });
  }
  // knobs turn in 3D too
  for (const p of pots) {
    const pm = p.group.children[0];
    const [, , knobMesh, markMesh] = pm.children;
    const pivot = new THREE.Group();
    pivot.position.set(knobMesh.position.x, 0, knobMesh.position.z);
    pm.add(pivot);
    for (const m of [knobMesh, markMesh]) { m.position.x -= pivot.position.x; m.position.z -= pivot.position.z; pivot.add(m); }
    const mid = pinsOf(termsOf(p.i)[1].node)[0];
    const name = p.data.label === 'contrast' ? 'Contrast knob' : `Knob${mid >= 0 ? ' (' + pinWords(mid) + ')' : ''}`;
    slider(name, 0, 1000, p.knob * 1000, (v) => `${Math.round(v / 10)}% turned`, (v) => {
      p.knob = v / 1000;
      pivot.rotation.y = -((p.knob * 270 - 135) * Math.PI) / 180;
      stage.invalidate();
    });
  }
  for (const p of ldrs) {
    const pin = [...termsOf(p.i)].map((t) => pinsOf(t.node)[0]).find((x) => x >= 0);
    const ohms = (k) => 10 ** (6 - 3.3 * (k / 100)); // dark about 1 MΩ, bright sun a few hundred Ω
    slider(`Light on the sensor${pin >= 0 ? ' (' + pinWords(pin) + ')' : ''}`, 0, 100, p.light, (v) => (v < 12 ? 'dark' : v < 35 ? 'dim' : v < 65 ? 'room light' : v < 88 ? 'bright' : 'torch on it'), (v) => { p.light = v; p.ldrOhms = ohms(v); });
  }
  for (const s of sources) {
    if (s.kind === 'rain') slider('Water on the plate', 0, 100, 0, (v) => (v < 5 ? 'dry' : v < 40 ? 'a few drops' : v < 80 ? 'wet' : 'soaked'), (v) => { s.p.wet = v; });
  }
  for (const s of sonars) {
    s.tag = label('', { scale: 0.9, always: true, min: 11 });
    s.tag.position.copy(s.p.focus).setY(s.p.focus.y + 3.5);
    s.tag.visible = false;
    stage.scene.add(s.tag);
    slider('Distance to the object in front', 2, 450, s.cm, (v) => (v > 400 ? 'nothing in range' : v + ' cm'), (v) => { s.cm = v; setLabel(s.tag, v > 400 ? 'nothing in front' : `object at ${v} cm`); stage.invalidate(); });
  }
  for (const D of dhts) {
    slider('Room temperature', 0, 50, D.temp, (v) => v + ' °C', (v) => { D.temp = v; });
    slider('Humidity', 20, 90, D.hum, (v) => v + ' %', (v) => { D.hum = v; });
  }
  const screenRow = row('');
  screenRow.hidden = true;

  // sound: off until asked for
  let audio = null;
  let soundOn = false;
  if (buzzers.length) {
    const r = row(`<button type="button" class="lab-btn sim-sound" aria-pressed="false">Sound: off</button><span class="sim-hint">the buzzer’s note, through your speakers</span>`);
    const b = r.querySelector('button');
    b.addEventListener('click', () => {
      soundOn = !soundOn;
      b.setAttribute('aria-pressed', String(soundOn));
      b.textContent = soundOn ? 'Sound: on' : 'Sound: off';
      if (soundOn && !audio) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          const ctx = new Ctx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          gain.gain.value = 0;
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          audio = { ctx, osc, gain };
        } catch { b.textContent = 'No sound on this computer'; b.disabled = true; }
      }
      audio?.ctx.resume?.();
      if (!soundOn) tone(0);
    });
  }
  let toneHz = 0;
  function tone(hz) {
    if (!audio) return;
    const t = audio.ctx.currentTime;
    if (hz > 20 && hz < 20000 && soundOn && running && visible) {
      audio.osc.frequency.setTargetAtTime(hz, t, 0.004);
      audio.gain.gain.setTargetAtTime(0.05, t, 0.006);
    } else audio.gain.gain.setTargetAtTime(0, t, 0.01);
  }

  // ---- serial monitor ----
  let pendingText = '';
  let logText = '';
  let txFlash = 0, rxFlash = 0;
  function flushLog() {
    if (!pendingText) return;
    const atEnd = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    logText += pendingText;
    pendingText = '';
    if (logText.length > 6000) logText = logText.slice(logText.length - 5000).replace(/^[^\n]*\n/, '');
    logEl.textContent = logText;
    if (atEnd) logEl.scrollTop = logEl.scrollHeight;
  }
  function sysLine(t) {
    flushLog();
    if (logText && !logText.endsWith('\n')) logText += '\n';
    logText += `— ${t} —\n`;
    logEl.textContent = logText;
    logEl.scrollTop = logEl.scrollHeight;
  }
  $('.sim-clear').addEventListener('click', () => { logText = ''; pendingText = ''; logEl.textContent = ''; });
  sendForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = sendForm.querySelector('input');
    if (!uno) return;
    uno.send(inp.value + '\n');
    rxFlash = 3;
    inp.value = '';
  });

  // ---- the program on the board, and the board's three states ----
  // Unplugged (Stop): nothing runs, every output is off, the next Run starts
  // from the beginning. Running. Paused: frozen where it is, still powered.
  // Reset starts the sketch again while it stays plugged in.
  const unoLeds = W.uno.leds;
  function powerLeds(on) {
    unoLeds.ON.set(on, 1);
    if (!on) { unoLeds.L.set(false); unoLeds.TX.set(false); unoLeds.RX.set(false); }
    stage.invalidate();
  }
  function setState(text, s = powered ? (running ? 'run' : 'pause') : 'off') {
    stateEl.textContent = text;
    powerEl.dataset.s = s;
  }
  let said = '';
  function say(t) { if (t !== said) { said = t; saidEl.textContent = t; } }
  const clockOf = () => { const t = uno ? uno.seconds : 0; return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  function showRun() {
    runBtn.innerHTML = running ? `${icon('pause')}<span>Pause</span>` : `${icon('play')}<span>${powered && uno && uno.cpu.cycles > 0 ? 'Carry on' : 'Run'}</span>`;
    runBtn.setAttribute('aria-label', running ? 'Pause: freeze the sketch where it is' : powered ? 'Carry on: run from where it paused' : 'Run: plug the board in and start the sketch');
    runBtn.disabled = !rec?.ok;
    stopBtn.disabled = !powered;
    resetBtn.disabled = !powered || !rec?.ok;
  }
  let current = list[0];
  let token = 0;
  let courseRec = null; // the course's compiled sketch
  let mode = 'course'; // what is on the board: 'course' (compiled) or 'edited' (interpreted)
  let uploaded = null; // the text last uploaded
  const keyOf = (n) => `ard-sketch-edit:${n}`;
  const loadEdit = (n) => { try { return localStorage.getItem(keyOf(n)); } catch { return null; } };
  const saveEdit = (n, t) => { try { if (t === null) localStorage.removeItem(keyOf(n)); else localStorage.setItem(keyOf(n), t); } catch {} };
  const edVerify = edBar.querySelector('.ed-verify'), edUpload = edBar.querySelector('.ed-upload'), edBack = edBar.querySelector('.ed-back');
  function showWhich() {
    const what = mode === 'edited' ? '<b>Your edited sketch</b> (run by the course’s interpreter)' : courseRec && !courseRec.ok ? '<b>nothing</b>: the course’s sketch does not compile' : '<b>The course’s sketch</b> (compiled for the real chip)';
    whichEl.innerHTML = `On the board: ${what}. ${mode === 'edited' ? '<button type="button" class="lab-link-btn" data-act="back">Back to the course’s sketch</button>' : 'Change it in the <button type="button" class="lab-link-btn" data-act="code">Code</button> tab.'}`;
    const changed = courseRec && code.value !== (mode === 'edited' ? uploaded : courseRec.source);
    whichCode.innerHTML = `On the board: ${what}.${changed ? ' The text below has changes that are not uploaded yet.' : ''}`;
    edBack.disabled = !courseRec || (mode === 'course' && code.value === courseRec.source);
  }
  whichEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'code') { ui.tab('code'); code.textarea.focus(); } else backToCourse();
  });
  function edited(t) {
    if (!courseRec) return;
    saveEdit(current, t === courseRec.source ? null : t);
    showWhich();
  }
  const monitorFor = (src) => { $('.sim-mon').hidden = !/\bSerial\s*\.\s*(begin|print|write)/.test(src); };
  function note(html) { noteBox.hidden = !html; noteBox.innerHTML = html || ''; }

  function choose(name) {
    current = name;
    const my = ++token;
    halt();
    powered = false;
    powerLeds(false);
    uno = null;
    rec = null;
    courseRec = null;
    mode = 'course';
    errBox.hidden = true;
    about.hidden = true;
    note('');
    edMsg.innerHTML = '';
    showRun();
    setState('Loading the sketch…', 'off');
    loadSketch(name).then((r) => {
      if (my !== token) return;
      courseRec = r;
      rec = r;
      const saved = loadEdit(name);
      code.set(saved ?? r.source, name + '.ino');
      if (saved !== null && saved !== r.source) note('Your own version of this sketch, from last time, is in the <b>Code</b> tab. The board runs the course’s sketch until you press <b>Upload and run</b> there.');
      monitorFor(r.source);
      built.textContent = r.ok
        ? `The course’s sketch is compiled for the Uno (${r.compiler}) into ${r.flash} bytes of program and ${r.ram} bytes of memory, and runs instruction by instruction on an emulated chip.`
        : `The course’s sketch does not compile (${r.compiler}), so there is nothing to run. Fix it here and press Upload and run.`;
      const w = whatItDoes(r.source);
      about.hidden = !w;
      about.innerHTML = w ? `<b>What it does:</b> ${esc(w)}` : '';
      showWhich();
      if (!r.ok) {
        const m = /\.ino:(\d+):\d+: error: ([^\n]*)/.exec(r.error);
        errBox.hidden = false;
        errBox.innerHTML = `<b>This sketch does not compile, on purpose.</b> The Arduino software stops before uploading anything, so the board would not change. This is what the compiler really said:<pre>${esc(r.error)}</pre>${m ? `<small>Line ${m[1]} is marked in the Code tab. The fault is usually at the end of the line before it.</small>` : ''}`;
        if (m && code.value === r.source) code.mark(+m[1], 'err');
        setState('Not compiled', 'off');
        showRun();
        return;
      }
      reset(false);
      setState('Unplugged', 'off');
    }, () => {
      if (my !== token) return;
      setState('The sketch could not load', 'off');
    });
  }
  function makeBoard() {
    if (rec.interp) return new VBoard(rec.js, { onError: runtimeError, onWarn: runtimeWarn });
    return new Uno(decodeProgram(rec.program));
  }
  // a fresh board with the program on it: plugged in or not, as it was
  function reset(noteIt = true) {
    if (!rec?.ok) return;
    const wasRunning = running;
    halt();
    uno = makeBoard();
    uno.usart.onByteTransmit = (b) => { pendingText += String.fromCharCode(b); txFlash = 3; };
    uno.onChange = onPins;
    wireDevices();
    S = uno.sample();
    resolveInputs();
    analogInputs();
    lastRunLine = 0;
    code.clear('run');
    if (rec.interp && !errBox.dataset.keep) errBox.hidden = true;
    for (const L of lcdChips) { if (L.screen) L.screen.userData.show(L.screen.userData.idle, { light: powered, ink: 0.0 }); }
    paintOutputs(0);
    if (!powered) unpowered();
    if (noteIt && powered) sysLine('reset');
    if (wasRunning) start();
    showRun();
    powerLeds(powered);
    if (!running) setState(powered ? `Paused · ${clockOf()}` : 'Unplugged');
  }
  // what an unplugged board shows: lights dark, sound off, screens blank, the servo holding where it is
  function unpowered() {
    for (const L of lcdChips) if (L.screen) L.screen.userData.show(L.screen.userData.idle, { light: false, ink: 0 });
    screenRow.hidden = true;
    for (const F of fans) F.speed = 0;
    for (const B of buzzers) B.tag.visible = false;
    tone(0);
    stage.invalidate();
  }
  // Stop: unplug the board. The next Run starts the sketch from the beginning.
  function unplug() {
    const was = powered;
    halt();
    powered = false;
    reset(false);
    powerLeds(false);
    if (was) sysLine('unplugged');
    setState('Unplugged', 'off');
    say('Stopped. The board is unplugged.');
    showRun();
  }
  let powered = false;
  function onPins() {
    resolveInputs();
    if (dhts.length) dhtWatch();
    if (tm) tmWatch();
  }

  // ---- the editor: check, upload, go back ----
  function showCompile(c, uploading) {
    code.clear('err');
    const items = [...c.errors.map((e) => ({ ...e, warn: false })), ...(c.ok ? c.warnings.slice(0, 3).map((w) => ({ ...w, warn: true })) : [])];
    const list = items.length
      ? `<ul>${items.map((e) => `<li class="${e.warn ? 'warn' : ''}"><code>${esc(e.text)}</code>${e.note ? `<small>${esc(e.note)}</small>` : ''}${e.line ? `<button type="button" class="lab-link-btn" data-line="${e.line}">Show line ${e.line}</button>` : ''}</li>`).join('')}</ul>`
      : '';
    if (c.ok) edMsg.innerHTML = `<p class="ok">${uploading ? 'Done compiling. Uploaded: your sketch is running.' : 'Done compiling: no errors.'}</p>${items.length ? `<p>${items.length === 1 ? 'A warning' : 'Warnings'} (the sketch still runs):</p>` : ''}${list}`;
    else {
      edMsg.innerHTML = `<p><b>The sketch does not compile.</b> Nothing was uploaded${mode === 'edited' || courseRec?.ok ? ': the board keeps what it had' : ''}. ${c.errors[0].line ? `Line ${c.errors[0].line} is marked.` : ''}</p>${list}`;
      if (c.errors[0].line) code.mark(c.errors[0].line, 'err');
    }
  }
  edMsg.addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b) code.goto(+b.dataset.line); });
  function verify() { const c = compileSketch(code.value, current); showCompile(c, false); return c; }
  edVerify.addEventListener('click', verify);
  edUpload.addEventListener('click', () => {
    if (!courseRec) return;
    const c = compileSketch(code.value, current);
    showCompile(c, c.ok);
    if (!c.ok) return;
    uploaded = code.value;
    saveEdit(current, uploaded === courseRec.source ? null : uploaded);
    rec = { ok: true, interp: true, js: c.js, source: uploaded, name: current };
    mode = 'edited';
    errBox.hidden = true;
    note('');
    monitorFor(uploaded);
    built.textContent = 'Your edited sketch is run by the course’s interpreter: a program in this page that reads Arduino C++ and does what the Uno’s chip would, at the same speed. It is checked against every course sketch, but it is not the real compiler, so a few rare things a real compiler allows are not supported.';
    // uploading resets the board and starts the new sketch, as on a real Uno
    powered = true;
    reset(false);
    sysLine('uploaded your sketch');
    start();
    showWhich();
    say('Uploaded. Your sketch is running.');
  });
  function backToCourse() {
    if (!courseRec) return;
    code.set(courseRec.source, current + '.ino');
    saveEdit(current, null);
    edMsg.innerHTML = '';
    note('');
    if (mode === 'edited') {
      mode = 'course';
      rec = courseRec;
      uploaded = null;
      monitorFor(rec.source);
      if (rec.ok) {
        const was = powered;
        reset(false);
        if (was) { sysLine('back to the course’s sketch'); start(); }
        built.textContent = `The course’s sketch is compiled for the Uno (${rec.compiler}) into ${rec.flash} bytes of program and ${rec.ram} bytes of memory, and runs instruction by instruction on an emulated chip.`;
      } else { halt(); powered = false; uno = null; powerLeds(false); choose(current); return; }
    } else if (!courseRec.ok) {
      const m = /\.ino:(\d+):\d+:/.exec(courseRec.error);
      if (m) code.mark(+m[1], 'err');
    }
    showWhich();
  }
  edBack.addEventListener('click', backToCourse);

  // ---- what the interpreter reports while it runs ----
  let lastRunLine = 0;
  function runtimeError(e) {
    errBox.hidden = false;
    errBox.innerHTML = `<b>Your sketch stopped${e.line ? ` on line ${e.line}` : ''}.</b> ${esc(e.msg)} <small>Press Reset or Run to start it again.</small>`;
    if (e.line) code.mark(e.line, 'err');
    sysLine('the sketch stopped');
  }
  function runtimeWarn(w) {
    note(`${w.line ? `<b>Line ${w.line}:</b> ` : ''}${esc(w.msg)}${w.line ? ` <button type="button" class="lab-link-btn" data-line="${w.line}">Show it</button>` : ''}`);
    if (w.line && w.kind === 'stuck') code.mark(w.line, 'run');
  }
  noteBox.addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b) { ui.tab('code'); code.goto(+b.dataset.line); } });

  // ---- the clock: real time, in frame-sized slices ----
  let raf = 0;
  let last = 0;
  let speed = 1;
  let visible = true;
  const low = stage.lowPower;
  function start() {
    if (!uno || running || !rec?.ok) return;
    if (uno.halted) reset(false);
    running = true;
    if (!powered) {
      powered = true;
      powerLeds(true);
      for (const L of lcdChips) { if (L.screen) L.screen.userData.show(L.screen.userData.idle, { light: true, ink: 0.0 }); }
      sysLine('plugged in');
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
    showRun();
    setState(`Running · ${clockOf()}`, 'run');
    say('Running.');
  }
  // the clock stops; outputs stay as they are (Pause)
  function halt() {
    running = false;
    cancelAnimationFrame(raf);
    tone(0);
    showRun();
  }
  function pause() {
    if (!running) return;
    halt();
    setState(`Paused · ${clockOf()}`, 'pause');
    say('Paused.');
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (!onScreen(now) || document.hidden) { setState('Paused while out of sight', 'pause'); tone(0); return; }
    dt = Math.min(dt, 250); // a slow frame is caught up; a long stall is not
    const want = Math.round(dt * (HZ / 1000));
    const c0 = uno.cpu.cycles;
    analogInputs();
    // up to about half of each frame for the chip, the rest for drawing
    uno.run(want, now + clamp(dt * 0.5, low ? 8 : 10, 60));
    const done = uno.cpu.cycles - c0;
    speed = speed * 0.9 + 0.1 * (done / Math.max(1, want));
    paintOutputs(dt);
    flushLog();
    if (rec.interp && uno.line && uno.line !== lastRunLine && now - (frame.lineAt || 0) > 200) { lastRunLine = uno.line; frame.lineAt = now; code.mark(uno.line, 'run'); }
    const clock = clockOf();
    setState(speed < 0.85 ? `Running · ${clock} · ${Math.round(speed * 100)}% of real speed on this computer` : `Running · ${clock}`, 'run');
  }
  runBtn.addEventListener('click', () => (running ? pause() : start()));
  stopBtn.addEventListener('click', unplug);
  resetBtn.addEventListener('click', () => reset(true));
  sel?.addEventListener('change', () => choose(sel.value));

  // pause when the lab is off screen (or put away) or the tab is hidden
  let seenAt = 0;
  function onScreen(now) {
    if (now - seenAt < 250) return visible;
    seenAt = now;
    if (host.hidden || !host.isConnected) return (visible = false);
    if (host.classList.contains('lab-full') || host.classList.contains('lab-fs')) return (visible = true);
    const r = host.getBoundingClientRect();
    visible = r.width > 0 && r.bottom > 40 && r.top < (window.innerHeight || 800) - 40;
    return visible;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) tone(0); });

  // ---- outputs: what the chip did to its pins, shown on the parts ----
  const prev = new Map();
  const changed = (key, v, eps = 0.02) => { const o = prev.get(key); if (o === undefined || Math.abs(o - v) > eps) { prev.set(key, v); return true; } return false; };
  function lightOf(a, c) {
    const A = drive(netOfNode(a)), K = drive(netOfNode(c));
    if (!A || !K) return 0;
    const k = A.h * (1 - K.h);
    return A.weak || K.weak ? k * 0.05 : k; // a pull-up only makes a faint glow
  }
  let fanT = 0;
  function paintOutputs(dt) {
    if (!uno) return;
    S = uno.sample();
    let dirty = false;
    // the board's own lights
    const l13 = OUT(S[13].mode) ? S[13].duty : 0;
    if (changed('L', l13)) { unoLeds.L.set(l13 > 0.01, l13); dirty = true; }
    if (txFlash > 0) txFlash--;
    if (rxFlash > 0) rxFlash--;
    if (changed('TX', txFlash > 0 ? 1 : 0, 0.5)) { unoLeds.TX.set(txFlash > 0, 1); dirty = true; }
    if (changed('RX', rxFlash > 0 ? 1 : 0, 0.5)) { unoLeds.RX.set(rxFlash > 0, 1); dirty = true; }
    for (const L of leds) {
      const k = lightOf(L.a, L.c);
      // (brightness as the eye sees it: half the time on looks more than half as bright)
      if (changed(L, k)) {
        L.mat.emissiveIntensity = L.base + Math.sqrt(k) * (L.mod ? 1.6 : 1.55);
        if (L.halo) { L.halo.visible = k > 0.02; L.halo.material.color.copy(L.mat.emissive); L.halo.material.opacity = 0.6 * Math.sqrt(k); }
        dirty = true;
      }
    }
    for (const R of rgbs) {
      const com = drive(netOfNode(R.common));
      const anode = com && com.h > 0.5; // common anode: the colours light when their pins are low
      const ch = [R.r, R.g, R.b].map((n) => {
        const d = drive(netOfNode(n));
        if (!d || !com) return 0;
        return anode ? com.h * (1 - d.h) : d.h * (1 - com.h);
      });
      if (ch.map((v, i) => changed(`rgb${R.p.i}:${i}`, v)).some(Boolean)) {
        if (R.dies) R.dies.forEach((m, i) => { m.emissiveIntensity = 0.4 + ch[i] * 2.4; });
        if (R.lens) {
          const sum = Math.max(ch[0], ch[1], ch[2]);
          R.lens0 ??= R.lens.color.clone();
          const glow = new THREE.Color(ch[0], ch[1] * 0.85, ch[2]);
          R.lens.emissive.copy(glow);
          R.lens.emissiveIntensity = sum > 0.01 ? 0.6 + 1.4 * Math.sqrt(sum) : 0;
          R.lens.color.copy(R.lens0).lerp(sum > 0.01 ? glow.clone().multiplyScalar(1 / sum) : R.lens0, 0.65 * Math.sqrt(sum));
        }
        if (R.halo) {
          const sum = Math.max(...ch);
          R.halo.visible = sum > 0.02;
          R.halo.material.color.setRGB(ch[0], ch[1] * 0.85, ch[2]);
          R.halo.material.opacity = 0.85 * Math.sqrt(sum);
        }
        dirty = true;
      }
    }
    // buzzer: the pin's frequency
    let hz = 0;
    for (const B of buzzers) {
      const d = drive(netOfNode(B.plus)), k = drive(netOfNode(B.minus));
      const p = d?.pin ?? k?.pin ?? -1;
      const f = p >= 0 && OUT(S[p].mode) && k ? S[p].hz : 0;
      const sounding = f >= 20;
      if (sounding) hz = f;
      if (changed(B, sounding ? Math.round(f) : 0, 0.5)) {
        B.tag.visible = sounding;
        setLabel(B.tag, sounding ? `♪ ${Math.round(f)} Hz` : '');
        dirty = true;
      }
      if (B.body && !low) { const s = sounding ? 1 + 0.03 * Math.sin(performance.now() / 18) : 1; if (B.body.scale.x !== s) { B.body.scale.set(s, 1, s); dirty = true; } }
    }
    if (Math.abs(hz - toneHz) > 0.5 || !hz) { toneHz = hz; tone(hz); }
    // servos: the length of the pulse sets the angle (Servo library: 544 to 2400 microseconds)
    for (const V of servos) {
      const p = pinOfNode(V.sig);
      const us = p >= 0 ? S[p].pulseUs : 0;
      if (us > 400 && us < 2700) V.target = clamp(((us - 544) / (2400 - 544)) * 180, 0, 180);
      if (V.target !== null && V.pivot) {
        const step = (dt / 1000) * 600; // about 0.1 s for 60 degrees, as an SG90
        const diff = V.target - V.angle;
        V.angle += clamp(diff, -step, step);
        if (changed(V, V.angle, 0.2)) { V.pivot.rotation.z = THREE.MathUtils.degToRad(V.angle); dirty = true; }
        V.tag.visible = true;
        if (changed(V.tag, Math.round(V.angle), 0.5)) setLabel(V.tag, `${Math.round(V.angle)}°`);
      }
    }
    for (const s of sonars) if (s.pings && !s.tag.visible) { s.tag.visible = true; setLabel(s.tag, s.cm > 400 ? 'nothing in front' : `object at ${s.cm} cm`); dirty = true; }
    // fan on a transistor: the base's drive sets the speed
    if (fans.length) {
      const on = npns.length ? (drive(netOfNode(npns[0].base))?.h ?? 0) : 0;
      fanT += dt;
      for (const F of fans) {
        F.speed += (on - F.speed) * Math.min(1, dt / 400);
        // (on a slow computer the fan is redrawn less often, to leave time for the chip)
        if (F.fan && F.speed > 0.01 && (!low || fanT > 90)) { F.fan.rotation.x += (fanT / 1000) * F.speed * 40; dirty = true; }
      }
      if (!low || fanT > 90) fanT = 0;
    }
    for (const St of steppers) St.ins.forEach((n, i) => {
      const p = pinOfNode(n);
      const k = p >= 0 && OUT(S[p].mode) ? S[p].duty : 0;
      if (St.leds[i] && changed(St.leds[i], k)) { St.leds[i].emissiveIntensity = 0.15 + 1.6 * k; dirty = true; }
    });
    // screens
    for (const L of lcdChips) {
      const ch = L.chip;
      if (!ch.dirty && !L.inkDirty) continue;
      let ink = 1;
      if (L.v0) { const v = volts(netOfNode(L.v0), -1); ink = v === null ? 0.1 : clamp(1 - (v - 1.0) / 2.2, 0.04, 1); }
      if (L.v0 && !changed(L.v0 + 'ink', ink, 0.01) && !ch.dirty) continue;
      ch.dirty = false;
      if (L.screen) { L.screen.userData.show(ch.rows(), { light: ch.light, ink, glyphs: ch.cgram, cursor: ch.cursorCell() }); dirty = true; }
      const tx = ch.text();
      screenRow.hidden = false;
      screenRow.innerHTML = `<span>${L.offstage ? 'The I2C screen (not drawn in this build) shows' : 'The screen shows'}</span><span class="sim-screen${ch.light ? '' : ' off'}" aria-label="${esc(tx.join(' / ').trim() || 'nothing')}">${esc(tx[0])}\n${esc(tx[1])}</span>`;
    }
    if (pots.some((p) => p.data.label === 'contrast')) for (const L of lcdChips) L.inkDirty = true;
    if (tm?.dirty) {
      tm.dirty = false;
      screenRow.hidden = false;
      const txt = tmText(tm);
      screenRow.innerHTML = `<span>The TM1637 display (not drawn in this build) shows</span><span class="sim-7seg" aria-label="${esc(txt.trim() || 'nothing')}">${esc(txt)}</span>`;
    }
    // On a slow (software-drawn) computer, redraw at most about eight times a
    // second, so the chip keeps its real speed; elsewhere, every change.
    const t = performance.now();
    if (dirty) drawWanted = true;
    if (drawWanted && (!low || t - lastDraw > 120)) { stage.invalidate(); drawWanted = false; lastDraw = t; }
  }
  let drawWanted = false;
  let lastDraw = 0;

  // ---- the build's other buttons ----
  choose(current);
  powerLeds(false);
  showRun();
  return {
    get uno() { return uno; },
    get running() { return running; },
    get powered() { return powered; },
    get mode() { return mode; },
    editor: code,
    choose, start, stop: pause, pause, unplug, reset: () => reset(true),
    upload: () => edUpload.click(), verify, back: backToCourse,
    log: () => logText + pendingText,
    sketch: () => current,
    inputs: { switches: C.switches, pots, ldrs, sonars, dhts, sources, pads },
    parts: W.parts,
    press(k, on) { const s = C.switches[k]; s.down = on; rebuild(); resolveInputs(); },
  };
}

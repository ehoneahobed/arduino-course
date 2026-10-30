// Band 3 concept lab: the floating pin, the spring (INPUT_PULLUP), the serial
// monitor, and the lock remembering presses in an array.
//
// The board on screen is the band's own build (b3p11 from builds.json, drawn
// by build.js's prepare()), so every hole and pin is the page's. In "Parts 3
// and 4" only the parts of b3p3 (one button, three wires) are shown.
//
// This file also exports the small kit the Band 4 and Band 5 labs share
// (strip layout, serial monitor, buzzer sound, LED glow, press-and-hold).
import { THREE, label, setLabel } from './runtime.js';
import * as P from './parts.js';
import { prepare as prepareBuild, config as buildConfig } from './build.js';
import DATA from './builds.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- the kit
let cssDone = false;
export function css() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.lab.cb-lab [hidden] { display: none !important; }
.cb-tablewrap { overflow-x: auto; }
.lab.cb-lab { grid-template-rows: var(--lab-h) auto; }
.lab.cb-lab .lab-side { grid-column: 2; grid-row: 1 / span 2; }
.cb-strip { grid-column: 1; grid-row: 2; border-top: 1px solid var(--lab-line); padding: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; background: var(--lab-paper); min-width: 0; }
.cb-box { border: 1px solid var(--lab-line); border-radius: 12px; background: var(--lab-panel); padding: 10px 12px; min-width: 0; }
.cb-box > h5 { margin: 0 0 6px; font: 700 11.5px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: 0.12em; color: var(--lab-muted); display: flex; gap: 8px; align-items: center; }
.cb-box > h5 span { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 500; }
.cb-wide { grid-column: 1 / -1; }
.cb-box pre.cb-code { font: 12.5px/1.55 var(--mono, ui-monospace, Menlo, Consolas, monospace); white-space: pre; overflow-x: auto; margin: 0; padding: 0.55rem 0.7rem; }
.cb-code .cb-line { display: block; border-radius: 4px; padding: 0 4px; margin: 0 -4px; }
.cb-code .cb-line.on { background: rgba(255, 190, 0, 0.32); box-shadow: inset 3px 0 0 var(--lab-gold); }
.cb-code .cb-line.dim { opacity: 0.45; }
.cb-code button, .cb-pick { font: inherit; color: var(--lab-ink); background: rgba(255, 190, 0, 0.22); border: 1.5px dashed var(--lab-gold-ink); border-radius: 6px; padding: 0 5px; cursor: pointer; }
.cb-code button:hover, .cb-pick:hover { background: rgba(255, 190, 0, 0.42); }
.cb-code button:focus-visible, .cb-pick:focus-visible, .cb-key:focus-visible, .cb-strip button:focus-visible, .cb-strip input:focus-visible, .cb-strip select:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 2px; }
.cb-mon { overflow-x: auto; font: 12.5px/1.45 var(--mono, ui-monospace, Menlo, Consolas, monospace); background: var(--lab-paper); color: var(--lab-ink); border: 1px solid var(--lab-line); border-radius: 8px; height: 150px; overflow-y: auto; padding: 6px 9px; white-space: pre; }
.cb-mon .new { animation: cb-new 0.6s ease; }
@keyframes cb-new { from { background: rgba(255, 190, 0, 0.45); } to { background: transparent; } }
.cb-mon-foot { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--lab-muted); margin-top: 4px; }
.cb-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.cb-key { font: 600 15px/1.1 var(--lab-display); min-width: 52px; min-height: 48px; padding: 6px 12px; border-radius: 12px; border: 2px solid var(--lab-ink); background: var(--lab-paper); color: var(--lab-ink); cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
.cb-key small { display: block; font: 500 11px/1.2 var(--lab-font); color: var(--lab-muted); }
.cb-key.down, .cb-key[aria-pressed="true"] { background: var(--lab-plum); color: #fff; border-color: var(--lab-plum); }
.cb-key.down small, .cb-key[aria-pressed="true"] small { color: rgba(255,255,255,0.8); }
.cb-key.wide { min-width: 0; flex: 1 1 auto; }
.cb-note { font-size: 13px; color: var(--lab-muted); margin: 6px 0 0; }
.cb-arr { display: grid; grid-template-columns: auto repeat(4, minmax(34px, 1fr)); gap: 4px 6px; align-items: center; font: 13px/1.2 var(--mono, ui-monospace, Menlo, monospace); }
.cb-arr .ix { font-size: 11px; color: var(--lab-muted); text-align: center; }
.cb-arr .nm { padding-right: 4px; white-space: nowrap; }
.cb-cell { text-align: center; padding: 7px 0; border: 1.5px solid var(--lab-line); border-radius: 8px; background: var(--lab-paper); font-weight: 700; font-size: 15px; transition: background 0.2s, border-color 0.2s; }
.cb-cell.old { color: var(--lab-muted); font-weight: 400; border-style: dashed; }
.cb-cell.next { border-color: var(--lab-gold); box-shadow: 0 0 0 3px rgba(255, 190, 0, 0.3); }
.cb-cell.ok { background: rgba(31, 138, 112, 0.18); border-color: var(--lab-good); }
.cb-cell.bad { background: rgba(202, 31, 63, 0.16); border-color: var(--lab-accent); }
.cb-cell.cmp { border-color: var(--lab-ink); }
.cb-mark { text-align: center; font-weight: 700; min-height: 1.2em; }
.cb-mark.ok { color: var(--lab-good); } .cb-mark.bad { color: var(--lab-accent); }
.cb-vars { font: 13px/1.5 var(--mono, ui-monospace, Menlo, monospace); margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 16px; }
.cb-vars b { color: var(--lab-gold-ink); }
.cb-status { font-size: 13px; margin-top: 6px; min-height: 1.4em; color: var(--lab-ink); }
.cb-chain { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }
.cb-chain > div { border: 1.5px solid var(--lab-line); border-radius: 10px; padding: 6px 8px; background: var(--lab-paper); position: relative; }
.cb-chain > div b { display: block; font: 700 11px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: 0.08em; color: var(--lab-muted); }
.cb-chain > div span { display: block; font: 700 17px/1.3 var(--lab-display); color: var(--lab-ink); }
.cb-chain > div small { display: block; font-size: 11.5px; color: var(--lab-muted); line-height: 1.3; }
.cb-chain > div.hot { border-color: var(--lab-gold); }
.cb-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cb-table th, .cb-table td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--lab-line); }
.cb-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--lab-muted); font-weight: 700; }
.cb-table td.num { font: 600 13px var(--mono, ui-monospace, Menlo, monospace); }
.cb-strip select { font: inherit; font-size: 13.5px; padding: 5px 8px; border-radius: 8px; border: 1.5px solid var(--lab-line); background: var(--lab-paper); color: var(--lab-ink); max-width: 100%; }
.cb-strip input[type=range] { width: 100%; accent-color: var(--lab-accent); }
.cb-tl { width: 100%; height: 190px; display: block; border-radius: 8px; border: 1px solid var(--lab-line); background: var(--lab-paper); }
.cb-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--lab-muted); margin-top: 6px; }
.cb-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 4px; }
@media (max-width: 900px) {
  /* on a phone: the model, the panel (mission, words, choices), then the bench */
  .lab.cb-lab { grid-template-rows: auto; }
  .lab.cb-lab .lab-side { grid-column: auto; grid-row: auto; order: 2; }
  .lab.cb-lab .lab-canvas { order: 1; }
  .cb-strip { grid-column: auto; grid-row: auto; order: 3; }
  .cb-strip > .cb-run { order: -1; }
  .cb-box pre.cb-code { max-height: 320px; overflow: auto; }
}
@media (max-width: 520px) { .cb-strip { padding: 10px 8px; grid-template-columns: minmax(0, 1fr); } }
`;
  document.head.appendChild(s);
}

// The strip under the 3D view, where the code, the serial monitor and the
// other readouts live. Returns the strip element.
export function shell(host) {
  css();
  host.classList.add('cb-lab');
  const strip = document.createElement('div');
  strip.className = 'cb-strip';
  host.querySelector('.lab-side').insertAdjacentElement('beforebegin', strip);
  return strip;
}

export function box(parent, title, extra = '') {
  const d = document.createElement('div');
  d.className = 'cb-box' + (extra ? ' ' + extra : '');
  d.innerHTML = `<h5>${title}</h5>`;
  parent.appendChild(d);
  return d;
}

// A serial monitor, like the one in the Arduino IDE: it shows what the sketch
// prints with Serial.println, newest at the bottom.
export function monitor(parent, { baud = 9600, keep = 80 } = {}) {
  const b = box(parent, `Serial monitor <span>${baud} baud</span>`);
  const el = document.createElement('div');
  el.className = 'cb-mon';
  el.setAttribute('role', 'log');
  el.setAttribute('aria-live', 'off');
  el.setAttribute('aria-label', 'Serial monitor: what the board prints');
  el.tabIndex = 0;
  b.appendChild(el);
  const foot = document.createElement('div');
  foot.className = 'cb-mon-foot';
  foot.innerHTML = '<span class="cb-mon-msg"></span><button type="button" class="lab-btn" style="font-size:12px;padding:2px 9px">Clear</button>';
  b.appendChild(foot);
  const msg = foot.querySelector('.cb-mon-msg');
  let pending = ''; // text printed with Serial.print, waiting for its line end
  let lineEl = null;
  const api = {
    box: b,
    el,
    lines: [],
    print(t) {
      pending += t;
      if (!lineEl) { lineEl = document.createElement('div'); el.appendChild(lineEl); }
      lineEl.textContent = pending;
    },
    println(t = '') {
      api.print(String(t));
      lineEl.className = 'new';
      api.lines.push(pending);
      if (api.lines.length > keep) api.lines.shift();
      pending = '';
      lineEl = null;
      while (el.childElementCount > keep) el.firstElementChild.remove();
      el.scrollTop = el.scrollHeight;
    },
    clear() { el.innerHTML = ''; api.lines = []; pending = ''; lineEl = null; },
    note(t) { msg.textContent = t; },
  };
  foot.querySelector('button').addEventListener('click', () => api.clear());
  return api;
}

// The buzzer. An active buzzer has its own fixed note (about 2.3 kHz here); a
// passive one plays the note tone() asks for. Quiet, square wave, and only
// after the learner has pressed something (browsers insist on that anyway).
export const sound = {
  on: true,
  ctx: null,
  osc: null,
  gain: null,
  ensure() {
    if (this.ctx || !this.on) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    } catch { this.ctx = null; }
    return this.ctx;
  },
  start(freq) {
    if (!this.on) return;
    const c = this.ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (!this.osc) {
      this.gain = c.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(c.destination);
      this.osc = c.createOscillator();
      this.osc.type = 'square';
      this.osc.connect(this.gain);
      this.osc.start();
    }
    this.osc.frequency.setValueAtTime(freq, c.currentTime);
    this.gain.gain.setTargetAtTime(0.045, c.currentTime, 0.004);
  },
  stop() {
    if (!this.osc || !this.ctx) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.004);
  },
  set(on) {
    this.on = on;
    if (!on) this.stop();
  },
};

// The parts of a prepared build that match a test on their data.
export const partsWhere = (W, fn) => W.parts.filter((p) => fn(p.data));

// Make an LED part glow (k from 0, off, to 1, full).
export function glow(part, k) {
  const m = part.group.children[0];
  const lens = m?.userData.lens;
  if (!lens) return;
  if (!m.userData.halo) {
    const body = m.children[0];
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 12), new THREE.MeshBasicMaterial({ color: lens.color.clone(), transparent: true, opacity: 0, depthWrite: false }));
    halo.userData.noInk = true;
    halo.raycast = () => {};
    halo.position.copy(body.position).add(V(0, 1.2, 0));
    halo.visible = false;
    m.add(halo);
    m.userData.halo = halo;
  }
  lens.emissiveIntensity = 0.08 + 1.5 * k;
  m.userData.halo.visible = k > 0.02;
  m.userData.halo.material.opacity = 0.32 * k;
}

// The cap of a push button part, pushed down or let up.
export function pushCap(part, down) {
  const cap = part.group.children[0]?.userData.cap;
  if (!cap) return;
  cap.userData.y0 ??= cap.position.y;
  cap.position.y = cap.userData.y0 - (down ? 0.38 : 0);
}

// Press-and-hold on 3D objects: pointer down on one of them calls down(id),
// letting go anywhere calls up(id). The model does not turn while you hold.
export function holdable(stage, host, targets, { down, up }) {
  const wrap = host.querySelector('.lab-canvas');
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let held = null;
  for (const t of targets) stage.clickable(t.obj, () => {});
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const r = stage.renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, stage.camera);
    const live = targets.filter((t) => visible(t.obj));
    const hits = ray.intersectObjects(live.map((t) => t.obj), true);
    if (!hits.length) return;
    let o = hits[0].object;
    const t = live.find((x) => { let q = o; while (q) { if (q === x.obj) return true; q = q.parent; } return false; });
    if (!t) return;
    held = t.id;
    stage.controls.enabled = false;
    down(t.id);
  }, true);
  const release = () => {
    if (held === null) return;
    const id = held;
    held = null;
    stage.controls.enabled = true;
    up(id);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
}

// An HTML key that acts while it is held down (pointer, touch, Space or Enter).
export function holdKey(el, { down, up }) {
  let on = false;
  const d = (e) => { if (on) return; on = true; el.classList.add('down'); down(); e?.preventDefault?.(); };
  const u = () => { if (!on) return; on = false; el.classList.remove('down'); up(); };
  el.addEventListener('pointerdown', (e) => { try { el.setPointerCapture(e.pointerId); } catch {} d(e); });
  el.addEventListener('pointerup', u);
  el.addEventListener('pointercancel', u);
  el.addEventListener('lostpointercapture', u);
  el.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) d(e); else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  el.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') u(); });
  el.addEventListener('blur', u);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// A floating text tag at a world point.
export function tag(scene, at, text, opts = {}) {
  const a = label(text, { scale: 2.3, min: 12, always: true, ...opts });
  a.position.copy(at);
  scene.add(a);
  return a;
}
export { setLabel };

// The band's build, drawn by the build viewer's own code, so the holes match the page.
export function prepareFrom(host, name) {
  host.dataset.build = name;
  const W = prepareBuild(host);
  delete host.dataset.build;
  return W;
}
export function frame(W, extra = {}) {
  const c = buildConfig(W);
  return { ...c, ...extra, label: extra.label ?? c.label };
}

// A timer the lab can cancel: wait(ms) resolves unless the lab moved on.
export function clock() {
  let gen = 0;
  return {
    get gen() { return gen; },
    reset() { gen++; },
    wait(ms) {
      const g = gen;
      return new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej(new Error('cancelled'))), ms));
    },
  };
}

// --------------------------------------------------------------- Band 3
export const missions = [
  { id: 'float', text: 'Make pin 2 float: change INPUT_PULLUP to INPUT and watch ten readings without pressing.', hint: 'Click the pinMode line in the code. Nobody is pressing, yet the numbers jump between 0 and 1.' },
  { id: 'spring', text: 'Put the spring back: INPUT_PULLUP, then press and let go. See 1, then 0, then 1.', hint: 'Not pressed is 1, pressed is 0. Hold button 1 on the model, the big key, or Space.' },
  { id: 'lock', text: 'Open the lock: load b3_05 and press 1, 3, 3, 2. Watch entered[] fill and get checked.', hint: 'Use the four keys, keys 1 to 4, or the buttons on the model.' },
];

export function prepare(host) {
  return prepareFrom(host, 'b3p11');
}

export function config(W) {
  return frame(W, { label: '3D model of the Band 3 lock. Arrow keys turn it, plus and minus zoom, 0 resets. Space holds button 1; keys 1 to 4 press the four buttons.' });
}

export default function lab(stage, ui, host, W) {
  const { scene } = stage;
  scene.add(W.world);
  const strip = shell(host);
  const tm = clock();

  // ---- the parts ----
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const watchParts = DATA.builds.b3p3.parts;
  W.parts.forEach((p) => { p.inWatch = watchParts.some((q) => same(q, p.data)); });
  const buttons = partsWhere(W, (d) => d.type === 'btn');
  const pinWire = W.parts.find((p) => p.data.type === 'wire' && p.data.b === '2');
  const greenLed = W.parts.find((p) => p.data.type === 'led' && p.data.colour === 'green');
  const redLed = W.parts.find((p) => p.data.type === 'led' && p.data.colour === 'red');
  const buzzer = W.parts.find((p) => p.data.type === 'buz');
  const pins = [2, 3, 4, 5];

  // pin 2, and the "spring": the pull-up resistor inside the chip, drawn
  // above the board so you can see it switched on
  const sock2 = W.uno.sockPos(pinWire.data.socket);
  // lying on the Uno, from pin 2 towards the chip, scaled up to be seen
  const springY = sock2.y + 0.9;
  const spring = new THREE.Group();
  const res = P.resistor(V(0, 0, 0), V(0, 0, 4), 20000, 0);
  res.scale.setScalar(1.35);
  res.position.set(sock2.x, springY - 1.5 * 1.35, sock2.z + 3.2);
  spring.add(res);
  const rA = V(sock2.x, springY + 0.4, sock2.z + 3.2);
  const rB = V(sock2.x, springY + 0.4, sock2.z + 3.2 + 4 * 1.35);
  spring.add(P.leg([V(sock2.x, sock2.y, sock2.z + 0.5), V(sock2.x, 1.02, sock2.z + 1.2), V(sock2.x, 1.0, sock2.z + 3.2)], 0xffbe00, 0.14));
  tag(spring, V(rB.x, springY + 0.6, rB.z + 1.6), '5V', { bg: 'rgba(255,190,0,0.95)', color: '#24182E' });
  scene.add(spring);
  const pinTag = tag(scene, V(sock2.x - 4.5, sock2.y + 0.6, sock2.z + 2.4), 'pin 2: 1', {});
  const buzTag = tag(scene, buzzer.focus.clone().add(V(0, 1.2, 0)), '♪ beep', { bg: 'rgba(255,190,0,0.95)', always: true });
  buzTag.visible = false;

  // ---- callouts ----
  stage.callout(buttons[0].group, { title: 'Button 1 · pin 2', text: 'Press and hold it, or press Space. Legs in f1, f3, e1, e3.', at: buttons[0].focus.toArray(), dy: -80, dx: -30 });
  stage.callout(pinWire.group, { title: 'The wire to pin 2', text: 'From j1, the same column as the leg in f1. This is what pin 2 feels.', at: W.L.hole('j1').clone().setY(3).toArray(), dy: -90, dx: 60, quiet: true });
  const springCard = stage.callout(spring, { title: 'The spring: INPUT_PULLUP', text: 'A resistor inside the chip, joined to 5V. Drawn outside so you can see it.', at: [rA.x, rA.y, (rA.z + rB.z) / 2], dy: 10, dx: 170 });
  void springCard;
  stage.callout(buttons[2].group, { title: 'Buttons 2, 3, 4', text: 'Pins 3, 4 and 5. Every one wired the same diagonal way.', at: buttons[2].focus.toArray(), dy: -80, quiet: true });
  stage.callout(greenLed.group, { title: 'Green light · pin 8', text: 'On for two seconds when the code is right.', at: greenLed.focus.toArray(), dy: 120, dx: -90 });
  stage.callout(redLed.group, { title: 'Red light · pin 9', text: 'On when it is wrong. Blinks ten times in a lockout.', at: redLed.focus.toArray(), dy: 120, dx: 90 });
  stage.callout(buzzer.group, { title: 'Buzzer · pin 10', text: 'Active buzzer, with its 220 ohm resistor from a29 to a31.', at: buzzer.focus.toArray(), dy: -70, dx: 60 });

  // ---- state ----
  let mode = 'watch'; // 'watch' (b3_02, Parts 3 and 4) or 'lock' (b3_05, Part 11)
  let pull = true; // INPUT_PULLUP?
  let touching = false; // a finger on the loose wire / a hand near it
  const held = [false, false, false, false];
  let floatV = 1;
  let watchTimer = null;
  // mission bookkeeping
  let floatRun = { n: 0, saw: new Set() };
  let springSeq = 0;

  // ---- the strip ----
  const codeBox = box(strip, '<span class="cb-fname" style="margin:0;text-transform:none;letter-spacing:0;font:600 12.5px var(--mono,monospace);color:var(--lab-ink)">b3_02_serial_watch.ino</span>');
  const code = document.createElement('pre');
  code.className = 'cb-code';
  codeBox.appendChild(code);
  const monBox = monitor(strip);
  const ser = monBox;
  const keysBox = box(strip, 'Your hands', 'cb-keys');
  const memBox = box(strip, 'What the lock remembers', 'cb-wide');

  function renderCode() {
    codeBox.querySelector('.cb-fname').textContent = mode === 'watch' ? 'b3_02_serial_watch.ino' : 'b3_05_lock_worked.ino (the arrays)';
    if (mode === 'watch') {
      code.innerHTML = `int buttonPin = 2;

void setup() {
  Serial.begin(9600);
  pinMode(buttonPin, <button type="button" class="cb-pm" aria-label="Change the pinMode setting. Now ${pull ? 'INPUT_PULLUP' : 'INPUT'}. Press to change it and upload again.">${pull ? 'INPUT_PULLUP' : 'INPUT'}</button>);
}

void loop() {
  int reading = digitalRead(buttonPin);
  Serial.println(reading);
  delay(200);
}`;
      code.querySelector('.cb-pm').addEventListener('click', () => { pull = !pull; upload(); });
    } else {
      code.innerHTML = `int buttonPins[4] = {2, 3, 4, 5};
int secret[4] = {1, 3, 3, 2};
int entered[4] = {0, 0, 0, 0};
int pressCount = 0;
...
<span class="cb-line" data-l="store">entered[pressCount] = i + 1;</span>
<span class="cb-line" data-l="count">pressCount = pressCount + 1;</span>
...
<span class="cb-line" data-l="if4">if (pressCount == 4) {</span>
<span class="cb-line" data-l="cmp">  if (entered[i] != secret[i]) {
    correct = false;
  }</span>
  ...
<span class="cb-line" data-l="reset">  pressCount = 0;</span>
}`;
    }
  }
  const lit = (l) => code.querySelectorAll('.cb-line').forEach((e) => e.classList.toggle('on', e.dataset.l === l));

  function renderKeys() {
    if (mode === 'watch') {
      keysBox.innerHTML = `<h5>Your hands</h5>
        <div class="cb-row"><button type="button" class="cb-key wide" data-k="0">Hold button 1<small>pin 2 · or press Space on the model</small></button></div>
        <div class="cb-row"><button type="button" class="lab-btn cb-touch" aria-pressed="${touching}">Touch the loose wire</button></div>
        <p class="cb-note">Only matters with <code>INPUT</code>: your body acts as an aerial. Safe to touch: five volts cannot hurt you.</p>`;
      keysBox.querySelector('.cb-touch').addEventListener('click', (e) => { touching = !touching; e.currentTarget.setAttribute('aria-pressed', String(touching)); explain(); });
    } else {
      keysBox.innerHTML = `<h5>The four buttons</h5>
        <div class="cb-row">${pins.map((p, i) => `<button type="button" class="cb-key" data-k="${i}" aria-label="Button ${i + 1}, pin ${p}">${i + 1}<small>pin ${p}</small></button>`).join('')}</div>
        <p class="cb-note">The secret is button 1, then 3, then 3, then 2. Keys 1 to 4 work on the model too.</p>`;
    }
    keysBox.querySelectorAll('.cb-key').forEach((k) => holdKey(k, { down: () => press(+k.dataset.k, true), up: () => press(+k.dataset.k, false) }));
  }

  // ---- the lock's memory, drawn as boxes ----
  const lock = { entered: [0, 0, 0, 0], fresh: [false, false, false, false], pressCount: 0, wrongTries: 0, busy: false, marks: ['', '', '', ''], cmp: -1, status: '' };
  function renderMem() {
    if (mode !== 'lock') {
      memBox.hidden = true;
      return;
    }
    memBox.hidden = false;
    const cells = (arr, kind) => arr.map((v, i) => {
      let c = 'cb-cell';
      if (kind === 'e') {
        if (!lock.fresh[i]) c += ' old';
        if (!lock.busy && i === lock.pressCount && lock.pressCount < 4) c += ' next';
        if (lock.marks[i]) c += ' ' + lock.marks[i];
      }
      if (lock.cmp === i) c += ' cmp';
      return `<div class="${c}" aria-label="${kind === 'e' ? 'entered' : 'secret'}[${i}] is ${v}">${kind === 'e' && !lock.fresh[i] && v === 0 ? '0' : v}</div>`;
    }).join('');
    memBox.innerHTML = `<h5>What the lock remembers <span>arrays count from 0</span></h5>
      <div class="cb-arr">
        <span></span>${[0, 1, 2, 3].map((i) => `<span class="ix">[${i}]</span>`).join('')}
        <span class="nm">secret</span>${cells([1, 3, 3, 2], 's')}
        <span class="nm">entered</span>${cells(lock.entered, 'e')}
        <span></span>${lock.marks.map((m) => `<span class="cb-mark ${m}">${m === 'ok' ? '✓ same' : m === 'bad' ? '✗ differs' : ''}</span>`).join('')}
      </div>
      <div class="cb-vars"><span>pressCount = <b>${lock.pressCount}</b></span><span>wrongTries = <b>${lock.wrongTries}</b></span><span>next press goes into <b>${lock.pressCount < 4 && !lock.busy ? `entered[${lock.pressCount}]` : '—'}</b></span></div>
      <div class="cb-status" aria-live="polite">${lock.status}</div>`;
  }

  // ---- what the pin reads, and how it looks ----
  function setPinLook(v, floating) {
    setLabel(pinTag, floating ? `pin 2: ${v} (floating)` : `pin 2: ${v === 1 ? 'HIGH, 1' : 'LOW, 0'}`, {
      bg: floating ? 'rgba(202,31,63,0.95)' : v ? 'rgba(255,190,0,0.95)' : 'rgba(36,24,46,0.92)',
      color: floating || !v ? '#ffffff' : '#24182E',
    });
    stage.invalidate();
  }
  function readPin2() {
    if (held[0]) return { v: 0, floating: false }; // a direct path to GND wins
    if (pull) return { v: 1, floating: false };
    // nothing holds it: it drifts, more when a hand is near
    if (touching) floatV = Math.random() < 0.5 ? 0 : 1;
    else if (Math.random() < 0.4) floatV = 1 - floatV;
    return { v: floatV, floating: true };
  }

  function tickWatch() {
    if (mode !== 'watch') return;
    const { v, floating } = readPin2();
    ser.println(String(v));
    setPinLook(v, floating);
    // mission 1: ten untouched readings in INPUT, with both 0 and 1 among them
    if (!pull && !held[0]) {
      floatRun.n++;
      floatRun.saw.add(v);
      if (floatRun.n >= 10 && floatRun.saw.size === 2) ui.complete('float');
    } else if (held[0]) floatRun = { n: 0, saw: new Set() };
    // mission 2: with the spring on, 1 then 0 (pressed) then 1 again
    if (pull && ui.isDone('float')) {
      if (springSeq === 0 && v === 1 && !held[0]) springSeq = 1;
      else if (springSeq === 1 && v === 0 && held[0]) springSeq = 2;
      else if (springSeq === 2 && v === 1 && !held[0]) { ui.complete('spring'); springSeq = 3; }
    }
  }

  // Point the camera at what matters in each part of the band.
  function frameFor(m) {
    const p = m === 'watch'
      ? buttons[0].focus.clone().lerp(sock2, 0.72).setY(0)
      : buttons[2].focus.clone().lerp(redLed.focus, 0.5).setY(0).add(V(0, 0, 1.5));
    stage.lookAt(p, m === 'watch' ? 1.2 : 1.45);
  }

  function upload() {
    tm.reset();
    clearInterval(watchTimer);
    ser.clear();
    floatRun = { n: 0, saw: new Set() };
    springSeq = 0;
    lock.entered = [0, 0, 0, 0];
    lock.fresh = [false, false, false, false];
    lock.pressCount = 0;
    lock.wrongTries = 0;
    lock.busy = false;
    lock.marks = ['', '', '', ''];
    lock.cmp = -1;
    lock.status = '';
    glow(greenLed, 0);
    glow(redLed, 0);
    buzz(false);
    // which parts are on the board
    for (const p of W.parts) p.group.visible = mode === 'lock' || p.inWatch;
    spring.visible = mode === 'watch' && pull;
    frameFor(mode);
    renderCode();
    renderKeys();
    renderMem();
    if (mode === 'watch') {
      ser.note(`Uploaded with ${pull ? 'INPUT_PULLUP' : 'INPUT'}. Five readings a second.`);
      watchTimer = setInterval(tickWatch, 200);
      pinTag.visible = true;
    } else {
      ser.note('Uploaded b3_05_lock_worked.ino.');
      ser.println('Lock ready. Press four buttons.');
      pinTag.visible = false;
    }
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    explain();
    stage.invalidate();
  }

  function buzz(on) {
    buzTag.visible = on;
    if (on) sound.start(2300); else sound.stop();
    stage.invalidate();
  }

  // ---- pressing ----
  function press(i, down) {
    if (mode === 'watch' && i !== 0) return;
    if (held[i] === down) return;
    held[i] = down;
    pushCap(buttons[i], down);
    keysBox.querySelectorAll(`.cb-key[data-k="${i}"]`).forEach((k) => k.classList.toggle('down', down));
    if (down) sound.ensure();
    stage.invalidate();
    if (mode === 'watch') {
      // the tag answers at once; the monitor prints at its own pace (every 200 ms)
      setPinLook(readPin2().v, !pull && !held[0]);
      explain();
      return;
    }
    if (down) lockPress(i);
  }

  async function lockPress(i) {
    if (lock.busy) {
      lock.status = `Button ${i + 1} ignored: the board is busy inside a <code>delay</code> and is not reading the buttons.`;
      renderMem();
      return;
    }
    if (lock.pressCount >= 4) return;
    const g = tm.gen;
    lock.busy = true;
    // edge detection saw it go down: debounce, store, count, beep, print
    try {
      await tm.wait(50);
      lock.entered[lock.pressCount] = i + 1;
      lock.fresh[lock.pressCount] = true;
      if (lock.pressCount === 0) { for (let k = 1; k < 4; k++) lock.fresh[k] = false; lock.marks = ['', '', '', '']; }
      lit('store');
      lock.pressCount += 1;
      lock.status = `Stored <code>${i + 1}</code> in <code>entered[${lock.pressCount - 1}]</code>. The + 1 turns position ${i} into button ${i + 1}.`;
      renderMem();
      buzz(true);
      await tm.wait(60);
      buzz(false);
      ser.println(`Button ${i + 1}   presses so far: ${lock.pressCount}`);
      lit('count');
      lock.busy = false;
      renderMem();
      if (lock.pressCount === 4) await check();
    } catch { if (g === tm.gen) lock.busy = false; }
  }

  async function check() {
    lock.busy = true;
    lit('if4');
    let correct = true;
    lock.status = 'Four presses are in. Checking each place against the secret…';
    renderMem();
    // the board does this in a few millionths of a second; shown slowly here
    for (let k = 0; k < 4; k++) {
      await tm.wait(380);
      lit('cmp');
      lock.cmp = k;
      const ok = lock.entered[k] === [1, 3, 3, 2][k];
      lock.marks[k] = ok ? 'ok' : 'bad';
      if (!ok) correct = false;
      renderMem();
    }
    await tm.wait(300);
    lock.cmp = -1;
    if (correct) {
      ser.println('UNLOCKED');
      lock.status = '<b>UNLOCKED.</b> All four places matched, so <code>correct</code> stayed true. Green light for two seconds.';
      renderMem();
      ui.complete('lock');
      glow(greenLed, 1);
      buzz(true);
      await tm.wait(400);
      buzz(false);
      await tm.wait(1600);
      glow(greenLed, 0);
      lock.wrongTries = 0;
    } else {
      ser.println('WRONG');
      lock.status = '<b>WRONG.</b> One place that differs is enough to set <code>correct</code> to false. Red light and a double beep.';
      renderMem();
      glow(redLed, 1);
      for (let k = 0; k < 2; k++) {
        buzz(true); await tm.wait(250);
        buzz(false); await tm.wait(150);
      }
      await tm.wait(600);
      glow(redLed, 0);
      lock.wrongTries += 1;
      renderMem();
    }
    if (lock.wrongTries >= 3) {
      ser.println('LOCKED OUT for 10 seconds');
      lock.status = '<b>Locked out.</b> Three wrong tries. For ten seconds the red light blinks and the board reads no buttons at all.';
      renderMem();
      for (let k = 0; k < 10; k++) {
        glow(redLed, 1); await tm.wait(250);
        glow(redLed, 0); await tm.wait(750);
      }
      lock.wrongTries = 0;
      ser.println('You may try again.');
    }
    lit('reset');
    lock.pressCount = 0;
    lock.busy = false;
    lock.status += ' <code>pressCount = 0;</code> so the next press goes into <code>entered[0]</code> again. The old numbers stay in memory until they are written over.';
    renderMem();
    // a button still held down when the delays end is seen as a new press
    held.forEach((h, k) => { if (h) lockPress(k); });
  }

  // ---- the side panel ----
  function explain() {
    if (mode === 'lock') {
      ui.info('Part 11: the lock remembers', `<p><code>entered</code> is an array: one name, four boxes, counted from <b>0</b>. Each press is stored at <code>entered[pressCount]</code>, then <code>pressCount</code> goes up by one.</p>
        <p>After the fourth press the lock compares <code>entered[i]</code> with <code>secret[i]</code> for <code>i</code> = 0, 1, 2, 3. It starts by assuming it is right; one place that differs is enough to fail.</p>
        <p class="lab-tip">Get it wrong three times on purpose to see the lockout. Presses during a <code>delay</code> are not read.</p>`);
      return;
    }
    if (held[0]) {
      ui.info('Pressed: a path to GND', `<p>The button joins pin 2 to the − rail, and the rail to GND. A direct path to ground wins easily, so the pin reads <b>LOW, 0</b>${pull ? ', even against the pull-up resistor' : ', with or without a spring'}.</p>`);
    } else if (pull) {
      ui.info('INPUT_PULLUP: the spring door', `<p>The resistor inside the chip joins pin 2 to 5 volts, like the weight that pulls a door shut. Nothing else touches the pin, so it sits at 5 volts and reads <b>HIGH, 1</b>, every time.</p>
        <p><b>With <code>INPUT_PULLUP</code>: not pressed is 1, pressed is 0.</b></p>`);
    } else {
      ui.info('INPUT: a floating pin', `<p>Nothing holds pin 2 at 0 or at 5 volts. It is the ordinary door from Part 1, swinging in the draught, so the reading jumps between 0 and 1 with nobody pressing.${touching ? ' Your finger on the loose wire makes it jump even more.' : ''}</p>
        <p class="lab-tip">On a real board a short wire sometimes settles on one value for a while. Pull the j1 end loose and touch it, as Part 4 says.</p>`);
    }
  }

  const g1 = ui.group('Which sketch is on the board?');
  const modeBtns = [
    ui.button('b3_02: one button (Parts 3 and 4)', () => { mode = 'watch'; upload(); }, { group: g1, pressed: true }),
    ui.button('b3_05: the lock (Part 11)', () => { mode = 'lock'; upload(); }, { group: g1, pressed: false }),
  ];
  modeBtns[0].dataset.m = 'watch';
  modeBtns[1].dataset.m = 'lock';
  const g2 = ui.group('Sound');
  const sb = ui.button('Buzzer sound on', (b) => { sound.set(!sound.on); b.setAttribute('aria-pressed', String(sound.on)); b.textContent = sound.on ? 'Buzzer sound on' : 'Buzzer sound off'; }, { group: g2, pressed: true });
  void sb;
  ui.element('<p class="lab-tip">Drag to turn the board. The floating tag over pin 2 shows what the pin reads right now; the serial monitor shows what the sketch prints.</p>');

  // ---- the model's own buttons, and the keyboard ----
  holdable(stage, host, buttons.map((b, i) => ({ obj: b.group, id: i })), { down: (i) => press(i, true), up: (i) => press(i, false) });
  W.onKey = (e) => {
    const k = e.key;
    if (k === ' ' || k === 'Enter') { if (!e.repeat) press(0, true); return true; }
    if (/^[1-4]$/.test(k)) { if (!e.repeat) press(+k - 1, true); return true; }
    return false;
  };
  host.querySelector('.lab-canvas').addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') press(0, false);
    if (/^[1-4]$/.test(e.key)) press(+e.key - 1, false);
  });

  // ---- dark mode: the "ink" wires follow the page's text colour ----
  const retint = () => {
    const c = getComputedStyle(host).color.match(/\d+/g);
    if (c) { let [r, g, b] = c.map(Number); if ((0.3 * r + 0.59 * g + 0.11 * b) / 255 < 0.2) [r, g, b] = [43, 47, 49]; W.inkMats.forEach((m) => m.color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)); }
    stage.invalidate();
  };
  new MutationObserver(() => setTimeout(retint, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  upload();
  host.labDebug = { press, get mode() { return mode; }, set mode(m) { mode = m; upload(); }, setPull(v) { pull = v; upload(); }, ser, lock };
}

// Band 0 (Bench Ready) concept lab: the Arduino Uno up close.
// <div class="lab" data-lab="concept-b0" data-lazy hidden></div>
//
// 1. A tour of the board: the seven parts Band 0 Part 1 names, plus the reset
//    button, TX and RX and the ON light.
// 2. The upload journey: sketch, Verify, Upload, along the USB cable into the
//    chip, then the L light runs it (and keeps running it from a phone charger).
//    The sketches are the real ones: compiled for the Uno and run on an
//    emulated chip, or edited in the Code tab and run by the course's
//    interpreter (sketchpanel.js). Stop unplugs the cable; Run plugs it back.
// 3. Reading an error: b0_03_buggy_semicolon.ino, the missing semicolon on
//    line 23 that the computer notices on line 24 (the real compiler's message).
//
// It also holds a few helpers the Band 1 and Band 2 labs share (glow, code
// boxes, a little CSS, preparing a wiring build from builds.json).
import { THREE, mat, rbox, cable, decal, codeView } from './runtime.js';
import * as P from './parts.js';
import { buildUno, config as buildConfig, prepare as buildPrepare } from './build.js';
import { sketchPanel, OUT } from './sketchpanel.js';

const { V } = P;
const UY = 0.95; // Arduino board top (as build.js)
const UNO_W = 27;

// ---------- shared helpers (Bands 0 to 2) ----------
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A soft round glow, drawn over an LED when it is lit.
let glowTex = null;
export function glow(color, size = 3) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.set(size, size, 1);
  s.userData.noInk = true;
  s.raycast = () => {};
  return s;
}

// A clock for a lab's simulation. Unlike stage.onTick it keeps running while
// the model is scrolled out of view, so on a phone the sketch keeps going
// while you read the code below it.
export function clock(stage, fn) {
  let last = performance.now();
  let on = true;
  const f = (now) => {
    if (!on) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    fn(dt);
    stage.invalidate();
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return () => { on = false; };
}

// A wiring build from builds.json, exactly as "View in 3D" draws it.
export function prepBuild(host, name) {
  const tmp = document.createElement('div');
  tmp.dataset.build = name;
  host.appendChild(tmp);
  try {
    return buildPrepare(tmp);
  } finally {
    tmp.remove();
  }
}
export { buildConfig };

// The CSS these labs add on top of labs.css (code boxes, scope, sliders).
const CSS = `
.cl-code { font: 13px/1.45 ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace; background: var(--lab-panel); border: 1px solid var(--lab-line); border-radius: 10px; padding: 6px 0; overflow-x: auto; width: 100%; }
.cl-code .cl-file { display: block; font: 600 11.5px var(--lab-font); color: var(--lab-muted); padding: 0 10px 4px; }
.cl-line { display: flex; gap: 8px; width: 100%; border: 0; background: none; color: var(--lab-ink); font: inherit; text-align: left; padding: 0 10px; white-space: pre; cursor: default; border-left: 3px solid transparent; }
button.cl-line { cursor: pointer; }
button.cl-line:hover { background: var(--lab-tint); }
.cl-line:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: -3px; }
.cl-line .n { color: var(--lab-muted); min-width: 2.2em; text-align: right; user-select: none; }
.cl-line.run { background: rgba(255, 190, 0, 0.22); border-left-color: var(--lab-gold); }
.cl-line.err { background: rgba(202, 31, 63, 0.14); border-left-color: var(--lab-accent); }
.cl-line.ok { background: rgba(31, 138, 112, 0.16); border-left-color: var(--lab-good); }
.cl-console { width: 100%; font: 12.5px/1.4 ui-monospace, Menlo, Consolas, monospace; background: #1d1724; color: #f1edf4; border-radius: 8px; padding: 7px 10px; min-height: 2.4em; white-space: pre-wrap; word-break: break-word; }
.cl-console.bad { color: #ff8a9b; }
.cl-console.good { color: #9fe3c9; }
.cl-read { width: 100%; font-size: 13.5px; color: var(--lab-text); }
.cl-read b { color: var(--lab-ink); }
.cl-meter { width: 100%; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 13.5px; }
.cl-meter dt { color: var(--lab-muted); }
.cl-meter dd { margin: 0; font-weight: 600; color: var(--lab-ink); }
.cl-slider { width: 100%; display: grid; grid-template-columns: 4.2em 1fr 3em; align-items: center; gap: 8px; font-size: 13.5px; }
.cl-slider input[type=range] { width: 100%; accent-color: var(--lab-accent); }
.cl-slider output { font: 600 14px ui-monospace, Menlo, monospace; text-align: right; }
.cl-scope { width: 100%; height: 120px; display: block; border-radius: 8px; background: #1d1724; }
.cl-stripes { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.cl-stripes svg { width: 100%; height: auto; max-height: 90px; }
.cl-stripes svg [role=button] { cursor: pointer; }
.cl-stripes svg [role=button]:focus { outline: none; }
.cl-stripes svg [role=button]:focus-visible rect, .cl-stripes svg [role=button].sel rect { stroke: var(--lab-gold); stroke-width: 3; }
.cl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cl-swatch { display: inline-block; width: 1.4em; height: 1.4em; border-radius: 50%; vertical-align: -0.35em; margin-right: 6px; box-shadow: 0 0 0 1px rgba(0,0,0,.3); }
`;
export function ensureStyle() {
  if (document.getElementById('concept-lab-css')) return;
  const s = document.createElement('style');
  s.id = 'concept-lab-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// A code box: lines [{n, t}], optionally clickable. Returns { el, mark(n, cls), clear(cls), set(lines), action(text, fn) }.
// It is the runtime's code view (highlighting, line numbers, Copy); { tab: true }
// moves its group into the panel's Code tab.
export function codeBox(group, file, lines, onLine, opts) {
  return codeView(group, file, lines, onLine, opts);
}
// ---------- the sketches (the real ones run: assets/labs/hex/, sketchpanel.js) ----------
const SK = {
  b0_01: { name: 'b0_01_blink_given', what: 'on for one second, off for one second, forever' },
  b0_02: { name: 'b0_02_signature_worked', what: 'two short flashes, one long flash, then a rest' },
  b0_03: { name: 'b0_03_buggy_semicolon', what: 'on for half a second, off for half a second' },
};
const keyOfName = (n) => Object.keys(SK).find((k) => SK[k].name === n);

// ---------- the board's parts, in the words of Band 0 Part 1 ----------
const PARTS = {
  usb: { title: 'USB socket', short: 'Power and your program both arrive here.', what: 'Where the cable from your computer plugs in. It carries two things at once: the electricity that powers the board, and the program you are sending it.' },
  jack: { title: 'Power socket', short: 'Power from an adapter or battery.', what: 'A second way to give the board electricity, from a wall adapter or a battery. You do not need it while the USB cable is plugged in.' },
  digital: { title: 'Digital pins', short: '0 to 13. Your program switches them.', what: 'The row of small holes along the top, numbered 0 to 13. Each one can be switched on or off by your program. Wires go into these holes. You will not use them until Band 1.' },
  analog: { title: 'Analog pins', short: 'A0 to A5, for sensors.', what: 'The holes marked A0 to A5 along the bottom. These are for reading sensors. You meet them at Band 4.' },
  power: { title: 'Power pins', short: '5V supplies, GND is the way back.', what: 'Also along the bottom. The important ones are <b>5V</b>, which supplies electricity, and <b>GND</b>, which is where electricity returns to. There is more than one GND hole. They all do the same thing. <b>Never join 5V straight to GND.</b>' },
  L: { title: 'The L light', short: 'Joined to pin 13. You blink this one.', what: 'A tiny light already built into the board. It is joined to pin 13. This is the light you will blink in this band.' },
  chip: { title: 'The main chip', short: 'Your program is stored and runs here.', what: 'The black rectangle in the middle. This is where your program is stored and where it runs. When you press Upload, the program is copied into it and stays there, even with the cable pulled out.' },
  reset: { title: 'Reset button', short: 'Starts your sketch again from the top.', what: 'Press it and the board starts your sketch again from the very beginning, <code>setup</code> first. It does not delete your sketch: that stays in the chip.' },
  txrx: { title: 'TX and RX', short: 'Flicker while a program crosses the cable.', what: 'Two very small lights close together near the USB socket. They flicker quickly for a second or two while a program crosses the cable. The L light is the one further away from this pair.' },
  on: { title: 'The ON light', short: 'Shows the board has power.', what: 'The small green light that comes on and stays on when the board has electricity. It has nothing to do with your program, so it never blinks.' },
};

export function prepare(host) {
  const world = new THREE.Group();
  const uno = buildUno({ parts: [] }, 0, 0);
  world.add(uno.group);
  // laptop, to the left of the board, screen facing you
  const lap = new THREE.Group();
  const base = rbox(19, 0.8, 12.5, 0x3a3340, 0.25);
  base.position.set(0, 0.4, 0);
  const keys = decal(16.5, 7.5, (g, W, H) => {
    g.fillStyle = '#2a2430';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#4a4252';
    const cw = W / 14, ch = H / 5;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) g.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
    g.fillRect(cw * 3, ch * 4 + 2, cw * 8, ch - 4);
  }, { px: 128, transparent: false });
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.81, -1.6);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), mat(0x4a4252));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.81, 4.2);
  pad.userData.noInk = true;
  const lid = new THREE.Group();
  lid.position.set(0, 0.8, -6.1);
  lid.rotation.x = -0.16;
  const shell = rbox(19, 12, 0.5, 0x3a3340, 0.25);
  shell.position.set(0, 6, 0);
  const screen = decal(17.6, 10.6, () => {}, { px: 300, transparent: false });
  screen.position.set(0, 6.1, 0.26);
  lid.add(shell, screen);
  lap.add(base, keys, pad, lid);
  lap.scale.setScalar(0.7);
  lap.position.set(9, 0, -13);
  world.add(lap);
  // phone charger, in front
  const chg = new THREE.Group();
  const brick = rbox(4, 4, 3.2, 0xf2f0ec, 0.35);
  brick.position.y = 2;
  const prongs = [-0.8, 0.8].map((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.18), mat(P.METAL, { metalness: 0.6 })); p.position.set(x, 2.4, -2.3); p.rotation.x = Math.PI / 2; p.userData.noInk = true; return p; });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.05), mat(0x222222));
  slot.position.set(0, 2, -1.62);
  slot.userData.noInk = true;
  chg.add(brick, ...prongs, slot);
  chg.scale.setScalar(0.8);
  chg.position.set(-5.5, 0, 25);
  world.add(chg);
  world.updateMatrixWorld(true);
  return { world, uno, lap, lid, screen, chg, b: { title: 'the Arduino Uno' } };
}

export function config(W) {
  const c = buildConfig(W);
  c.label = '3D model of an Arduino Uno, a laptop and a phone charger. Arrow keys turn it, plus and minus zoom, 0 resets.';
  c.tourZoom = 2.2;
  c.fit = [c.fit[0] * 1.06, c.fit[1] * 1.16];
  return c;
}

export const missions = [
  { id: 'find', text: 'Find the L light, and the part where your program is kept.', hint: 'Click parts of the board, or use the buttons under "Parts of the board".' },
  { id: 'upload', text: 'Upload a sketch, then move the cable to the phone charger. Does it keep blinking?', hint: 'Open a sketch, press Upload and run in the Code tab, then choose "Phone charger" under 3 · Power.' },
  { id: 'error', text: 'Verify b0_03, then click the line where the mistake really is.', hint: 'Open b0_03, press Verify in the Code tab, then click a line in the code. The message names a line. Look at the line above it.' },
];

export const hint = 'Drag to turn · pinch or scroll to zoom · tap a part';

export default function lab(stage, ui, host, W) {
  ensureStyle();
  const { scene } = stage;
  scene.add(W.world);
  const { uno } = W;

  // ---- pickable regions (invisible boxes over the parts) ----
  const zone = (id, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    m.userData.noInk = true;
    m.userData.part = id;
    W.world.add(m);
    stage.clickable(m, () => select(id));
    return m;
  };
  const Z = {
    usb: zone('usb', 6.6, 4.6, 5, 2.1, UY + 2.15, 6),
    jack: zone('jack', 6, 4.6, 4, 1.9, UY + 2.15, 16.4),
    digital: zone('digital', 18.4, 1.6, 2.4, 7.6 + 9, UY + 0.6, 1.4),
    analog: zone('analog', 6.4, 1.6, 2.4, 10.6 + 10.5, UY + 0.6, 19.6),
    power: zone('power', 7.4, 1.6, 2.4, 10.6 + 3, UY + 0.6, 19.6),
    L: zone('L', 1.6, 1.2, 1.4, 11.6, UY + 0.4, 4.3),
    chip: zone('chip', 14.4, 1.8, 3.6, 18.2, UY + 0.7, 14.6),
    reset: zone('reset', 2.2, 1.8, 2.2, 7.6, UY + 0.7, 3.6),
    txrx: zone('txrx', 1.4, 1.0, 2.4, 10.2, UY + 0.4, 7.55),
    on: zone('on', 1.6, 1.0, 1.4, 24.6, UY + 0.4, 5.2),
  };
  // the laptop and charger can be picked too
  stage.clickable(W.lap, () => { ui.info('The laptop', '<p>The Arduino IDE runs here. You write your sketch in it, press <b>Verify</b> to check it and <b>Upload</b> to send it down the USB cable. Use the buttons under <b>2 · Send it a program</b>.</p>'); });
  stage.clickable(W.chg, () => setPower('charger'));

  // ---- callouts: the four most important first (a phone shows only those) ----
  const cards = {};
  const card = (id, obj, at, dx, dy, quiet = false) => {
    cards[id] = stage.callout(obj, { title: PARTS[id].title, text: PARTS[id].short, at, dx, dy, quiet, onClick: () => select(id) });
  };
  card('L', Z.L, [0, 0.3, 0], 60, -120);
  card('chip', Z.chip, [0, 0.8, 0], 90, 80);
  card('usb', Z.usb, [-1.5, 1.8, 0], -40, -130);
  card('digital', Z.digital, [3, 0.6, -0.6], 70, -150);
  card('jack', Z.jack, [-1.5, 1.8, 0], -80, 90, true);
  card('power', Z.power, [0, 0.6, 0.6], -40, 110, true);
  card('analog', Z.analog, [0, 0.6, 0.6], 60, 110, true);
  card('reset', Z.reset, [0, 0.6, 0], -60, -110, true);
  card('txrx', Z.txrx, [0, 0.3, 0], -90, 60, true);
  card('on', Z.on, [0, 0.3, 0], 80, -90, true);

  const clicked = new Set();
  let selected = null;
  function select(id) {
    selected = id;
    for (const [k, c] of Object.entries(cards)) c.card.classList.toggle('sel', k === id);
    const p = PARTS[id];
    let extra = '';
    const on = sk.sketch ? `<code>${esc(sk.sketch)}.ino</code>${sk.mode === 'edited' ? ' (your edited version)' : ''}` : 'nothing yet';
    const what = sk.mode === 'course' && keyOfName(sk.sketch) ? `: ${esc(SK[keyOfName(sk.sketch)].what)}` : '';
    if (id === 'L') extra = `<p class="lab-tip">${sk.powered ? (sk.running ? `Right now it is running ${on}${what}.` : `The sketch is paused, so the L light stays as it was.`) : 'The board has no power, so it is dark.'}</p>`;
    if (id === 'chip') extra = `<p class="lab-tip">Inside it now: ${on}.</p>`;
    if (id === 'on') extra = `<p class="lab-tip">${sk.powered ? 'It is on: the board has power.' : 'It is off: the board has no power.'}</p>`;
    if (id === 'reset') { extra = sk.powered ? '<p class="lab-tip">Pressed. Watch the L light start the pattern again from the top.</p>' : '<p class="lab-tip">Nothing happens: the board has no power. Plug it in first.</p>'; if (sk.powered) sk.reset(); }
    ui.info(p.title, `<p>${p.what}</p>${extra}`);
    clicked.add(id);
    if (clicked.has('L') && clicked.has('chip')) ui.complete('find');
    stage.invalidate();
  }

  // ---- the USB cable: laptop, phone charger or unplugged ----
  const plug = rbox(2.2, 1.7, 2.5, 0xcfd3d8, 0.12, { metalness: 0.5, roughness: 0.4 });
  W.world.add(plug);
  let cableMesh = null;
  const lapPort = V(2.2, 0.4, -11.5);
  const chgPort = V(-5.5, 1.6, 23.7);
  function drawCable() {
    if (cableMesh) { W.world.remove(cableMesh); cableMesh.geometry.dispose(); }
    const atBoard = source !== 'none';
    const pEnd = atBoard ? V(-2.1, UY + 2.15, 6) : V(-6, 0.9, 9.5);
    plug.position.copy(pEnd);
    plug.rotation.y = atBoard ? 0 : 0.6;
    const start = V(pEnd.x - 1.1, pEnd.y, pEnd.z);
    let pts;
    if (source === 'charger' || (source === 'none' && lastSource === 'charger')) pts = [start, V(-5, 1.6, 7.4), V(-6.4, 0.5, 12), V(-6.2, 0.5, 19), V(-5.6, 1.5, 22.4), chgPort];
    else pts = [start, V(-4.8, 2.0, 5.2), V(-5.4, 0.5, 0), V(-3.2, 0.45, -8.4), V(0.4, 0.4, -11.3), lapPort];
    cableMesh = cable(pts, 0x2b2b30, 0.32, 60);
    cableMesh.userData.noHull = true;
    W.world.add(cableMesh);
    stage.invalidate();
  }

  // ---- the IDE on the laptop screen: it shows the sketch open in the Code tab ----
  const scr = W.screen.material.map.image;
  const sg = scr.getContext('2d');
  const ide = { file: SK.b0_01.name + '.ino', text: '', msg: '', bad: false, busy: 0, errLine: 0 };
  function drawIDE() {
    const w = scr.width, h = scr.height;
    sg.fillStyle = '#e9eef0'; sg.fillRect(0, 0, w, h);
    sg.fillStyle = '#00878f'; sg.fillRect(0, 0, w, h * 0.13);
    const r = h * 0.045;
    [[w * 0.05, '✓'], [w * 0.12, '→']].forEach(([x, t]) => {
      sg.fillStyle = '#ffffff'; sg.beginPath(); sg.arc(x, h * 0.065, r, 0, Math.PI * 2); sg.fill();
      sg.fillStyle = '#00878f'; sg.font = `700 ${r * 1.4}px Rubik, Arial`; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText(t, x, h * 0.068);
    });
    sg.fillStyle = '#ffffff'; sg.textAlign = 'left'; sg.font = `600 ${h * 0.045}px Rubik, Arial`;
    sg.fillText(ide.file, w * 0.2, h * 0.067);
    sg.fillStyle = '#ffffff'; sg.fillRect(0, h * 0.13, w, h * 0.62);
    sg.font = `${h * 0.045}px ui-monospace, Menlo, monospace`;
    const lh = h * 0.058;
    // skip the long header comment: show the code itself, with its real line numbers
    const lines = ide.text.split('\n');
    let first = lines.findIndex((t, i) => i > 0 && t.trim() && !/^\s*\/\//.test(t));
    if (first < 0) first = 0;
    if (ide.errLine && ide.errLine - 1 > first + 8) first = ide.errLine - 6;
    lines.slice(first, first + 10).forEach((t, i) => {
      const n = first + 1 + i;
      if (n === ide.errLine) { sg.fillStyle = 'rgba(202,31,63,.22)'; sg.fillRect(0, h * 0.15 + i * lh, w, lh); }
      sg.fillStyle = '#9aa3a8'; sg.textAlign = 'right'; sg.fillText(String(n), w * 0.08, h * 0.18 + i * lh);
      sg.fillStyle = '#24303a'; sg.textAlign = 'left'; sg.fillText(t, w * 0.11, h * 0.18 + i * lh);
    });
    sg.fillStyle = '#17181b'; sg.fillRect(0, h * 0.75, w, h * 0.25);
    sg.fillStyle = ide.bad ? '#ff7a8a' : '#d8f5ea';
    sg.font = `${h * 0.042}px ui-monospace, Menlo, monospace`;
    const words = ide.msg.split(' ');
    let line = '', y = h * 0.82;
    for (const wd of words) {
      if (sg.measureText(line + wd).width > w * 0.94) { sg.fillText(line, w * 0.03, y); line = ''; y += h * 0.055; }
      line += wd + ' ';
    }
    sg.fillText(line, w * 0.03, y);
    if (ide.busy) { sg.fillStyle = '#00878f'; sg.fillRect(w * 0.6, h * 0.035, w * 0.36 * ide.busy, h * 0.06); }
    W.screen.material.map.needsUpdate = true;
    stage.invalidate();
  }
  let ideT = 0;
  const ideLater = () => { cancelAnimationFrame(ideT); ideT = requestAnimationFrame(() => { ide.text = sk.editor.value; ide.file = sk.open + '.ino'; drawIDE(); }); };

  // ---- side panel ----
  ui.info('The Arduino Uno', '<p>This is the board from Band 0 Part 1. Click any part of it to see what it does, or press <b>Show me around</b> (the signpost under the model) for a tour.</p><p class="lab-tip">Then send it a real program from the laptop, change it, and break one on purpose.</p>');
  const gParts = ui.group('1 · Parts of the board');
  for (const id of ['usb', 'jack', 'digital', 'analog', 'power', 'L', 'chip', 'reset', 'txrx', 'on']) {
    const b = ui.button(PARTS[id].title, () => select(id), { group: gParts });
    b.classList.add('lab-part');
  }
  const gCode = ui.group('2 · Send it a program');
  const tabs = Object.keys(SK).map((k) => {
    const b = ui.button(k, () => openSketch(k), { group: gCode });
    b.dataset.k = k;
    b.setAttribute('aria-label', `Open ${SK[k].name}.ino in the Code tab`);
    return b;
  });

  // The sketches are real: the course's compiled ones run on an emulated chip,
  // and an edited one runs on the course's interpreter (sketchpanel.js).
  let source = 'laptop';
  let lastSource = 'laptop';
  let uploadedOnce = false;
  let flashes = 0;
  let lHigh = false;
  let toldCharger = false;
  let errorShown = false;
  let found = false;
  const sk = sketchPanel(stage, ui, host, {
    sketches: Object.values(SK).map((s) => s.name),
    group: gCode,
    picker: false,
    loadOnChoose: false,
    leds: uno.leds,
    canUpload: () => (source === 'laptop' ? null
      : source === 'charger' ? 'No board on the Port. The board is on the phone charger, so the laptop cannot reach it. Choose <b>Laptop USB</b> under <b>3 · Power</b> first.'
        : 'No board on the Port. The cable is unplugged. Choose <b>Laptop USB</b> under <b>3 · Power</b> first.'),
    beforeUpload: () => journey(),
    // the L light is pin 13 (the panel lights it); here: does it keep blinking on the charger?
    paint(S) {
      if (!S) { lHigh = false; return false; }
      const on = OUT(S[13].mode) && S[13].duty > 0.5;
      if (on && !lHigh && source === 'charger' && uploadedOnce && ++flashes >= 2) {
        ui.complete('upload');
        if (!toldCharger) { toldCharger = true; ui.info('It keeps blinking', `<p>The laptop is not involved at all now. When you pressed Upload, <code>${esc(sk.sketch)}.ino</code> was copied into the main chip, and it stays there until you upload something different over it. Moving the cable cut the power for a moment, so it started again from the top: <code>setup</code> once, then <code>loop</code>.</p>`); }
      }
      lHigh = on;
      return false;
    },
    onCompile(c) {
      ide.msg = c.ok ? (c.uploading ? 'Done uploading.' : 'Done compiling.') : c.errors[0].text.split('\n')[0];
      ide.bad = !c.ok;
      ide.errLine = c.ok ? 0 : c.errors[0].line || 0;
      ideLater();
      if (!c.ok && c.course && c.sketch === SK.b0_03.name) {
        errorShown = true;
        note('<b>Now click the line where the mistake really is</b>, in the code.');
        ui.info('A red error', `<p>It failed, and that is what this sketch is for. This is the real compiler’s message. Read it piece by piece:</p><ul><li><code>b0_03_buggy_semicolon.ino</code> is the file.</li><li><code>24</code> is the line number it is complaining about.</li><li><code>expected ';'</code> means it wanted a semicolon.</li><li><code>before '}' token</code> means it noticed when it reached the curly bracket.</li></ul><p><b>Now click the line where the mistake really is.</b></p>`);
        stage.reveal();
      }
    },
    onState(st) {
      // Stop unplugs the cable; Run plugs it back in where it was
      if (st.why === 'stop' && source !== 'none') setSource('none');
      if (st.why === 'run' && source === 'none') setSource(lastSource);
      if (st.why === 'upload') {
        uploadedOnce = true;
        flashes = 0;
        const k = keyOfName(st.sketch);
        const what = st.mode === 'course' && k ? `Watch the L light: ${esc(SK[k].what)}.` : 'Watch the L light: it follows your sketch now.';
        note(`${what} Then try the phone charger under <b>3 · Power</b>.`);
        ui.info('Done uploading', `<p>The program crossed the cable and was copied into the main chip. The board started it straight away: <code>setup</code> once, then <code>loop</code> over and over. ${what}</p>${st.mode === 'edited' ? '<p class="lab-tip">The yellow line in the code is the one running now. Most of the time it is a <code>delay</code>: the board is sitting there doing nothing at all.</p>' : ''}<p class="lab-tip">Next: under <b>3 · Power</b>, move the cable to the phone charger.</p>`);
      }
      if (st.why === 'choose') ideLater();
      ui.toggle(powerBtns, powerBtns.find((b) => b.dataset.src === source));
    },
  });
  sk.editor.textarea.addEventListener('input', ideLater);
  // (beside Verify and Upload, in the Code tab, where the mistake is being read)
  const fixBtn = ui.button('Add the semicolon', () => fix(), { group: sk.codeGroup.querySelector('.sp-edbar') });
  fixBtn.hidden = true;
  const fb = document.createElement('div');
  fb.className = 'cl-read';
  fb.setAttribute('aria-live', 'polite');
  gCode.appendChild(fb);
  const note = (t) => { fb.innerHTML = t; };
  const gPow = ui.group('3 · Power');
  const powerBtns = [['laptop', 'Laptop USB'], ['charger', 'Phone charger'], ['none', 'Unplugged']].map(([src, t]) => {
    const b = ui.button(t, () => setPower(src), { group: gPow });
    b.dataset.src = src;
    return b;
  });
  ui.button('Press reset', () => select('reset'), { group: gPow });

  // the cable only (the board's power follows it: sketchpanel.js)
  function setSource(src) {
    if (src !== 'none') lastSource = src;
    else if (source !== 'none') lastSource = source;
    source = src;
    drawCable();
    ui.toggle(powerBtns, powerBtns.find((b) => b.dataset.src === src));
  }
  function setPower(src) {
    if (sk.busy) return;
    const changed = src !== source;
    setSource(src);
    flashes = 0;
    if (src === 'none') sk.unplug('cable');
    else if (changed || !sk.powered) sk.powerCycle('cable');
    if (src === 'none') ui.info('Unplugged', '<p>The board goes dark, because it has lost its electricity. The program is still inside the chip. Give it power again, from the laptop or from a phone charger, and watch. (<b>Stop</b> does the same: it unplugs the cable.)</p>');
    else if (src === 'charger') ui.info('Running from a phone charger', `<p>Same cable, but the other end is in a phone charger now, so no program can arrive: Upload will say there is no board. The board starts again from the top with what is in its chip${sk.sketch ? `, <code>${esc(sk.sketch)}.ino</code>` : ''}. Watch the L light.</p>${uploadedOnce ? '' : '<p class="lab-tip">For the mission, upload a sketch from the laptop first, then come back here.</p>'}`);
    else ui.info('Plugged into the laptop', '<p>The cable carries power and, when you press Upload, your program. The small green ON light shows the board has power.</p>');
  }

  function openSketch(k) {
    ui.toggle(tabs, tabs.find((b) => b.dataset.k === k));
    errorShown = false;
    found = false;
    fixBtn.hidden = true;
    note(k === 'b0_03' ? 'This one is broken on purpose. In the Code tab, press <b>Verify</b> and read the message.' : 'In the Code tab, press <b>Verify</b> to check it, or <b>Upload and run</b> to check it and send it. You can change the numbers first.');
    ide.msg = '';
    ide.bad = false;
    ide.errLine = 0;
    sk.choose(SK[k].name).then(ideLater);
    ui.tab('code');
  }

  // the program's journey: down the cable, across the board, into the chip
  const packetGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const packetMat = new THREE.MeshBasicMaterial({ color: 0xffbe00, toneMapped: false });
  async function journey() {
    stage.reveal();
    uno.leds.L.set(false);
    ide.msg = 'Uploading…';
    ide.bad = false;
    const c1 = cableMesh.userData.curve;
    const onBoard = new THREE.CatmullRomCurve3([V(-1.2, UY + 2.15, 6), V(3.5, UY + 0.4, 6.6), V(8, UY + 0.4, 9.5), V(11, UY + 1.0, 13.5), V(16, UY + 1.6, 14.6)]);
    const packets = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(packetGeo, packetMat);
      m.userData.noInk = true;
      m.visible = false;
      W.world.add(m);
      packets.push(m);
    }
    const len = 2.2;
    await stage.tween((k) => {
      const t = k * len;
      packets.forEach((m, i) => {
        const s = (t - i * 0.12) / 1.6; // 0..1 over the whole trip
        m.visible = s > 0 && s < 1;
        if (!m.visible) return;
        // the cable runs laptop end -> board end, so walk it backwards
        if (s < 0.65) m.position.copy(c1.getPointAt(1 - s / 0.65));
        else m.position.copy(onBoard.getPointAt((s - 0.65) / 0.35));
        m.rotation.y += 0.2;
      });
      const flick = Math.floor(k * 40) % 2 === 0;
      uno.leds.TX.set(flick && k < 0.9, 0.9);
      uno.leds.RX.set(!flick && k < 0.9, 0.9);
      ide.busy = k;
      if (Math.floor(k * 20) !== Math.floor((k - 0.02) * 20)) drawIDE();
    }, len, (k) => k);
    uno.leds.TX.set(false); uno.leds.RX.set(false);
    ide.busy = 0;
    packets.forEach((m) => W.world.remove(m));
    await stage.wait(0.3);
  }

  // Reading the error: click (or move the caret to) the line where the mistake really is.
  const ta = sk.editor.textarea;
  const caretLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length;
  ta.addEventListener('click', () => clickLine(caretLine(), true));
  ta.addEventListener('keyup', (e) => { if (/^(Arrow|Page|Home|End)/.test(e.key)) clickLine(caretLine(), false); });
  function clickLine(n, loud) {
    if (sk.open !== SK.b0_03.name || found || !sk.course || ta.value !== sk.course.source) return;
    if (!errorShown) { if (loud) ui.info(`Line ${n}`, '<p>Press <b>Verify</b> first, and read what the computer says.</p>'); return; }
    if (n === 23) {
      found = true;
      sk.editor.mark(23, 'err');
      note('<b>Found it.</b> Line 23 is missing its semicolon. The computer only noticed at the <code>}</code> on line 24. Always look at the line above the one it names.');
      ui.complete('error');
      fixBtn.hidden = false;
      ui.info('Found it: line 23', `<p>The semicolon at the end of line 23 is missing. The message points at line 24 because the computer reads top to bottom. At the end of line 23 an instruction is allowed to carry on onto the next line, so it is still waiting for the semicolon. It reaches the curly bracket on line 24, and that is the first moment it can be sure something is wrong.</p><p><b>The error message tells you where the computer noticed, not where you made the mistake. Always look at the line above the one it names.</b></p><p class="lab-tip">Now type the <code>;</code> yourself, or press <b>Add the semicolon</b>, then Verify again.</p>`);
    } else if (!loud) {
      // moving the caret with the keyboard: only the right line answers
    } else if (n === 24) {
      note('Line 24 is where the computer <i>noticed</i>. Look at the line above.');
      ui.info('That is where it noticed', '<p>Line 24 is where the computer <i>noticed</i>. Nothing is wrong with a curly bracket. Look at the line above the one it names.</p>');
    } else {
      note('Not that one. Start at line 24 and look just above it.');
      ui.info(`Line ${n}`, '<p>Not that one. The message says line 24. Start there and look at the line just above it.</p>');
    }
  }
  function fix() {
    const lines = ta.value.split('\n');
    if (lines[22] !== undefined && !/;\s*$/.test(lines[22])) lines[22] = lines[22].replace(/\s*$/, ';');
    ta.value = lines.join('\n');
    ta.dispatchEvent(new Event('input'));
    fixBtn.hidden = true;
    sk.editor.clear('err');
    note('Fixed. Press <b>Verify</b> to check it.');
    ui.info('Semicolon added', '<p>Line 23 now ends with <code>;</code>. Press <b>Verify</b>: it should pass. Then <b>Upload and run</b> it and watch the L light blink faster, half a second on and half a second off.</p><p class="lab-tip">Your fixed copy is run by the course’s own interpreter, because the real compiler cannot run in a web page. It reads the code the same way.</p>');
  }

  // start as the board arrives: plugged into the laptop, a blink in its chip
  ui.toggle(powerBtns, powerBtns[0]);
  ui.toggle(tabs, tabs[0]);
  drawCable();
  note('The board has <code>b0_01_blink_given.ino</code> in its chip and is running it. Open a sketch, change it if you like, and press <b>Upload and run</b> in the Code tab.');
  sk.choose(SK.b0_01.name, { load: true }).then(() => { if (source !== 'none') sk.start('power'); ideLater(); });
  stage.invalidate();
  host.dispatchEvent(new CustomEvent('lab-ready', { bubbles: true, detail: { lab: 'concept-b0' } }));
}

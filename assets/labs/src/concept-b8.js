// Band 8 concept lab: a state machine as rooms joined by one-way arrows.
// Three machines, each following its sketch line for line:
//   - b8_01_states_given: WAITING, ARMED, ALARM, SNOOZED, one button, one light.
//   - b8_02_buggy_flags: the same device written with three flags. Its eight
//     combinations are eight rooms on two floors; three of them have no
//     branch that writes the light, and one of those is where it freezes.
//   - b8_03_tank_alarm_worked: ARMED, ALARM, SNOOZED, a tank, two lights, a
//     buzzer and a button. setup() ends with enterState(ARMED), so a power
//     cut always wakes it armed (criterion 4), and a snooze is forgotten.
// <div class="lab" data-lab="concept-b8" data-lazy hidden></div>
import { THREE, mat, rbox, cable, label } from './runtime.js';
import * as P from './parts.js';
import { esc } from './concept-b6.js';
import { sketchPanel, OUT, PinState } from './sketchpanel.js';
import { wireSonar } from './devices.js';

const { V } = P;
const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';
const INK = '#24182E';

export const missions = [
  { id: 'cycle', text: 'Walk b8_01 round its cycle: WAITING, ARMED, ALARM, SNOOZED, then let SNOOZED time out back to ARMED.', hint: 'Press the button three times, then wait five seconds without touching it.' },
  { id: 'frozen', text: 'Freeze b8_02 in the room no branch handles. Then try to freeze b8_01 the same way.', hint: 'In b8_02, press three times and look at the light and the room. Then switch to b8_01 and press four times.' },
  { id: 'power', text: 'Snooze the tank alarm with the water still high, then cut the power. Which state does it wake in?', hint: 'In b8_03, raise the water to 15 cm or closer, press the button to snooze, then press "Pull the USB out".' },
];

export const config = {
  camera: [7, 2 + 170 * Math.sin(0.92), 0 + 170 * Math.cos(0.92)],
  target: [7, 2, 0],
  fit: [66, 54],
  pan: true, minZoom: 0.7, maxZoom: 6, tourZoom: 2.2,
  shadowSize: 50, groundSize: 80, sun: [10, 90, 30], maxPolar: Math.PI * 0.45,
  label: '3D model of a state machine drawn as rooms joined by arrows, with the device beside it. Arrow keys turn it, plus and minus zoom, 0 resets. The buttons beside it press the device’s button, change the water and cut the power.',
};

// ---------- the three machines, as the sketches have them ----------
const ONE = { WAITING: 0, ARMED: 1, ALARM: 2, SNOOZED: 3 };
const ONE_NAMES = ['WAITING', 'ARMED', 'ALARM', 'SNOOZED'];
const TANK_NAMES = ['ARMED', 'ALARM', 'SNOOZED'];
const flagKey = (f) => `${+f.armed}${+f.alarming}${+f.snoozed}`;
// Which of b8_02's three light branches runs for a combination, if any.
function branchFor(a, al, s) {
  if (a && !al && !s) return 1;   // light on
  if (a && al) return 2;          // flashing
  if (!a && !al) return 3;        // light off
  return 0;                       // nothing writes the light
}
const SHORT = ['NO BRANCH', 'light on', 'flashing', 'light off'];
const BRANCH_TEXT = ['no branch: the light is frozen', 'branch 1: light on', 'branch 2: flashing', 'branch 3: light off'];

export default function lab(stage, ui, host) {
  const { scene } = stage;
  const world = new THREE.Group();
  scene.add(world);

  // ---------- building blocks ----------
  const roomGeo = new THREE.CylinderGeometry(5.2, 5.6, 0.9, 40);
  function room(pos, name, sub, color) {
    const g = new THREE.Group();
    const m = mat(color, { emissive: 0xffbe00, emissiveIntensity: 0 });
    const disc = new THREE.Mesh(roomGeo, m);
    disc.position.y = 0.45;
    g.add(disc);
    const t = label(sub ? [name, ...[].concat(sub)] : name, { scale: 1.6, always: true, bg: 'rgba(255,255,255,0.94)' });
    t.position.set(0, 1.4, 3.1);
    g.add(t);
    g.position.copy(pos);
    P.shadowAll(g);
    g.userData = { m, tag: t, name, color };
    return g;
  }
  // a one-way arrow between two rooms, lifted into an arch, with words on it
  function arrow(a, b, text, { color = 0x7a5c96, lift = 4, side = 0, dashed = false } = {}) {
    const g = new THREE.Group();
    const A = a.clone(), B = b.clone();
    const dir = B.clone().sub(A).setY(0).normalize();
    const perp = V(-dir.z, 0, dir.x);
    const r = 6;
    const p0 = A.clone().addScaledVector(dir, r).add(V(0, 1.2, 0)).addScaledVector(perp, side);
    const p2 = B.clone().addScaledVector(dir, -r - 1.2).add(V(0, 1.2, 0)).addScaledVector(perp, side);
    const mid = p0.clone().add(p2).multiplyScalar(0.5).add(V(0, lift, 0)).addScaledVector(perp, side * 0.8);
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const tube = cable(curve.getPoints(24), color, 0.32, 40);
    tube.userData.noHull = true;
    if (dashed) { tube.material.transparent = true; tube.material.opacity = 0.75; }
    g.add(tube);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.2, 16), mat(color));
    const tan = curve.getTangent(1).normalize();
    head.position.copy(p2).addScaledVector(tan, 1.0);
    head.quaternion.setFromUnitVectors(V(0, 1, 0), tan);
    g.add(head);
    if (text) {
      const t = label(text, { scale: 1.25, bg: 'rgba(255,255,255,0.9)', color: dashed ? '#8A5C00' : INK });
      t.position.copy(curve.getPoint(0.5)).add(V(0, 0.6, 0));
      g.add(t);
    }
    P.shadowAll(g);
    return g;
  }

  // a "power on" plug arrow into the room setup() chooses
  function powerArrow(to, text) {
    const g = new THREE.Group();
    const plug = rbox(2.4, 1.6, 2.4, 0x2b2d31, 0.2);
    const from = to.clone().add(V(-4, 0, 14));
    plug.position.copy(from).setY(0.8);
    g.add(plug);
    g.add(arrow(from, to, text, { color: 0x1f8a70, lift: 2 }));
    return g;
  }

  // ---------- machine 1: b8_01 ----------
  const m1 = new THREE.Group();
  const R1 = [V(-15, 0, 0), V(0, 0, -12), V(15, 0, 0), V(0, 0, 12)];
  const rooms1 = [
    room(R1[0], 'WAITING', 'light off', 0xd9d3de),
    room(R1[1], 'ARMED', 'light on', 0x9fd6b5),
    room(R1[2], 'ALARM', 'light flashing', 0xf2a7b4),
    room(R1[3], 'SNOOZED', 'light off, 5 s', 0xc9c1f0),
  ];
  rooms1.forEach((r) => m1.add(r));
  m1.add(arrow(R1[0], R1[1], 'button pressed'));
  m1.add(arrow(R1[1], R1[2], 'button pressed'));
  m1.add(arrow(R1[2], R1[3], 'button pressed'));
  m1.add(arrow(R1[3], R1[0], 'button pressed'));
  m1.add(arrow(R1[3], R1[1], '5 seconds pass', { color: 0xc48a00, dashed: true, side: 3.5, lift: 3 }));
  m1.add(powerArrow(R1[0], 'power on: setup() enters WAITING'));
  world.add(m1);

  // ---------- machine 2: b8_02, eight combinations on two floors ----------
  const m2 = new THREE.Group();
  const F = 8, FZ = 22; // the snoozed=1 floor: up, and further back so both floors show
  const pos2 = (a, al, s) => V(a ? 12 : -12, s ? F : 0, (al ? 8 : -8) - (s ? FZ : 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 30), mat(0xbfd9f0, { transparent: true, opacity: 0.22, depthWrite: false }));
  glass.position.set(0, F - 0.2, -FZ);
  glass.userData.noInk = true;
  m2.add(glass);
  for (const sx of [-18, 18]) for (const sz of [-FZ - 14, -FZ + 14]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, F, 8), mat(0x9a90a8));
    post.position.set(sx, F / 2, sz);
    m2.add(post);
  }
  const floorTag = label('upper floor: snoozed = 1', { scale: 1.3, bg: 'rgba(255,255,255,0.85)' });
  floorTag.position.set(0, F + 0.5, -FZ - 15);
  m2.add(floorTag);
  const rooms2 = {};
  for (const a of [0, 1]) for (const al of [0, 1]) for (const s of [0, 1]) {
    const b = branchFor(a, al, s);
    const col = b === 0 ? 0x5b5662 : b === 1 ? 0x9fd6b5 : b === 2 ? 0xf2a7b4 : 0xd9d3de;
    const r = room(pos2(a, al, s), `armed=${a} alarming=${al}`, [`snoozed=${s}`, SHORT[b]], col);
    rooms2[`${a}${al}${s}`] = r;
    m2.add(r);
  }
  // the presses and the timeout, worked out from the sketch itself
  const press2 = (a, al, s) => (!a ? [1, al, s] : !al ? [a, 1, s] : !s ? [0, al, 1] : [a, 0, 0]);
  for (const a of [0, 1]) for (const al of [0, 1]) for (const s of [0, 1]) {
    const [a2, al2, s2] = press2(a, al, s);
    m2.add(arrow(pos2(a, al, s), pos2(a2, al2, s2), '', { lift: 3, side: 1.2 }));
    if (s) m2.add(arrow(pos2(a, al, s), pos2(1, al, 0), '', { color: 0xc48a00, dashed: true, lift: 2, side: -1.5 }));
  }
  const key2 = label(['plum arrow: a press', 'gold arrow: 5 seconds pass'], { scale: 1.2, bg: 'rgba(255,255,255,0.9)' });
  key2.position.set(0, 0.5, 15);
  m2.add(key2);
  world.add(m2);

  // ---------- machine 3: b8_03 tank alarm ----------
  const m3 = new THREE.Group();
  const R3 = [V(-15, 0, 6), V(15, 0, 6), V(0, 0, -12)];
  const rooms3 = [
    room(R3[0], 'ARMED', 'green on, quiet', 0x9fd6b5),
    room(R3[1], 'ALARM', 'red flashing, beeping', 0xf2a7b4),
    room(R3[2], 'SNOOZED', 'green on, 30 s', 0xc9c1f0),
  ];
  rooms3.forEach((r) => m3.add(r));
  m3.add(arrow(R3[0], R3[1], 'water within 15 cm', { side: 2.5 }));
  m3.add(arrow(R3[1], R3[0], 'water back to 20 cm or more', { side: 2.5 }));
  m3.add(arrow(R3[1], R3[2], 'button pressed'));
  m3.add(arrow(R3[2], R3[0], '30 seconds pass', { color: 0xc48a00, dashed: true }));
  m3.add(powerArrow(R3[0], 'power on: setup() enters ARMED'));
  world.add(m3);

  // ---------- the token: "you are here" ----------
  const token = new THREE.Group();
  const tokM = mat(0xffbe00, { emissive: 0xffbe00, emissiveIntensity: 0.35 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 3.2, 24), tokM);
  stem.position.y = 1.6;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), tokM);
  ball.position.y = 3.9;
  token.add(stem, ball);
  P.shadowAll(token);
  world.add(token);
  const tokTag = label('state', { scale: 1.3, always: true, bg: '#FFBE00' });
  tokTag.position.set(0, 6.2, 0);
  token.add(tokTag);

  // ---------- the devices ----------
  const DX = 0;
  const dev = new THREE.Group();
  dev.position.set(29, 0, 6);
  dev.scale.setScalar(1.3);
  world.add(dev);
  const base = rbox(11, 1, 20, 0xe9e2d4, 0.3, { roughness: 0.9 });
  base.position.set(DX, 0.5, 0);
  dev.add(base);
  const TOP = 1;
  const greenLed = P.led(V(DX - 3.5, TOP, -7.5), V(DX - 2.5, TOP, -7.5), 'green', TOP);
  const redLed = P.led(V(DX + 2.5, TOP, -7.5), V(DX + 3.5, TOP, -7.5), 'red', TOP);
  const btn = P.button([V(DX - 1.5, TOP, 5), V(DX + 1.5, TOP, 5), V(DX - 1.5, TOP, 8), V(DX + 1.5, TOP, 8)], TOP);
  const buz = P.buzzer(V(DX + 4.5, TOP, -1), V(DX + 2.5, TOP, -1), TOP, 0);
  dev.add(greenLed, redLed, btn, buz);
  const tags = {
    led1: label('pin 7', { scale: 1.1 }), led2: label('pin 8', { scale: 1.1 }), btn: label('pin 2', { scale: 1.1 }), buz: label('pin 6', { scale: 1.1 }),
  };
  tags.led1.position.set(DX - 3, 0.6, -10.2);
  tags.led2.position.set(DX + 3, 0.6, -10.2);
  tags.btn.position.set(DX, 0.6, 10.4);
  tags.buz.position.set(DX + 3.5, 0.6, 1.8);
  dev.add(tags.led1, tags.led2, tags.btn, tags.buz);
  stage.clickable(btn, () => press());
  // the tank: a see-through poly tank, the sensor looking down at the water
  const tank = new THREE.Group();
  const TH = 26, TR = 5.5;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TH, 40, 1, true), mat(0x9aa3ad, { transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  shell.position.y = TH / 2;
  shell.userData.noInk = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TR, 0.3, 8, 40), mat(0x2c2d31));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TH;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(TR - 0.2, TR - 0.2, 1, 40), mat(0x4fa3f0, { transparent: true, opacity: 0.7 }));
  water.userData.noInk = true;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * TR + 3, 0.8, 1.6), mat(0x8a8f96));
  bar.position.y = TH + 0.4;
  const son = P.moduleModel('HC-SR04', ['VCC', 'Trig', 'Echo', 'GND']).group;
  son.scale.setScalar(0.42);
  son.rotation.x = Math.PI / 2;   // eyes looking straight down
  son.position.set(0, TH + 1.6, 0.4);
  tank.add(shell, rim, water, bar, son);
  tank.position.set(45, 0, 2);
  tank.scale.setScalar(0.75);
  world.add(tank);
  const tankTag = new THREE.Object3D();
  tankTag.position.set(45, TH * 0.75 + 3.5, 2);
  world.add(tankTag);
  const setLed = (g, on) => { const m = g.userData.lens; m.emissiveIntensity = on ? 1.6 : 0.08; m.opacity = on ? 1 : 0.92; };

  // ---------- state ----------
  const S = {
    mach: 'one', t: 0, ff: false,
    // b8_01
    state: 0, stateSince: 0, lastFlash: 0, flashOn: false,
    // b8_02
    f: { armed: false, alarming: false, snoozed: false }, snoozeStart: 0, led: false,
    // b8_03
    water: 40, loopAcc: 0, buzzing: false, green: false, red: false,
    off: false, offUntil: 0, millis0: 0,
    serial: [],
    path: [], frozenFor: 0, sawFrozen: false, presses1AfterFreeze: 0, visited1: new Set(),
    cutDuringSnoozeHigh: false,
  };
  const millis = () => (S.t - S.millis0) * 1000;
  const log = (s) => { S.serial.push(s); if (S.serial.length > 5) S.serial.shift(); };

  // b8_01, line for line
  function enter1(n, why) {
    const from = S.state;
    S.state = n;
    S.stateSince = millis();
    if (n === ONE.WAITING) S.led = false;
    if (n === ONE.ARMED) S.led = true;
    if (n === ONE.SNOOZED) S.led = false;
    log(`now in state ${n}`);
    S.path.push({ from, to: n, why });
    if (S.path.length > 12) S.path.shift();
    S.visited1.add(n);
    moveToken();
  }
  function run1(pressed) {
    if (S.state === ONE.WAITING) { if (pressed) enter1(ONE.ARMED, 'press'); }
    else if (S.state === ONE.ARMED) { if (pressed) enter1(ONE.ALARM, 'press'); }
    else if (S.state === ONE.ALARM) {
      if (millis() - S.lastFlash >= 120) { S.lastFlash = millis(); S.flashOn = !S.flashOn; S.led = S.flashOn; }
      if (pressed) enter1(ONE.SNOOZED, 'press');
    } else if (S.state === ONE.SNOOZED) {
      if (millis() - S.stateSince >= 5000) enter1(ONE.ARMED, 'time');
      else if (pressed) enter1(ONE.WAITING, 'press');
    }
  }
  // b8_02, line for line
  function run2(pressed) {
    const f = S.f;
    const before = flagKey(f);
    if (pressed) {
      if (!f.armed) f.armed = true;
      else if (!f.alarming) f.alarming = true;
      else if (!f.snoozed) { f.snoozed = true; S.snoozeStart = millis(); f.armed = false; }
      else { f.snoozed = false; f.alarming = false; }
      log(`armed=${+f.armed}  alarming=${+f.alarming}  snoozed=${+f.snoozed}`);
    }
    if (f.snoozed && millis() - S.snoozeStart >= 5000) { f.snoozed = false; f.armed = true; }
    if (f.armed && !f.alarming && !f.snoozed) S.led = true;
    else if (f.armed && f.alarming) {
      if (millis() - S.lastFlash >= 120) { S.lastFlash = millis(); S.flashOn = !S.flashOn; S.led = S.flashOn; }
    } else if (!f.armed && !f.alarming) S.led = false;
    // otherwise: nothing writes the light. It keeps whatever it had.
    if (flagKey(f) !== before) moveToken();
  }
  // b8_03, line for line (loop has delay(50))
  function enter3(n) {
    S.state = n;
    S.stateSince = millis();
    S.buzzing = false; S.red = false; S.green = false;
    if (n === 0) S.green = true;
    if (n === 2) S.green = true;
    log(`state ${n}`);
    moveToken();
  }
  const readDistance = () => Math.round(S.water + (Math.random() - 0.5) * 0.8);
  function run3(pressed) {
    const cm = readDistance();
    if (S.state === 0) { if (cm <= 15) enter3(1); }
    else if (S.state === 1) {
      if (millis() - S.lastFlash >= 250) { S.lastFlash = millis(); S.flashOn = !S.flashOn; S.red = S.flashOn; S.buzzing = S.flashOn; }
      if (cm >= 20) enter3(0);
      else if (pressed) enter3(2);
    } else if (S.state === 2) {
      if (millis() - S.stateSince >= 30000) enter3(0);
    }
    if (S.state === 1 && S.cameBackFromSnoozeCut) { ui.complete('power'); S.cameBackFromSnoozeCut = false; }
  }

  // setup(): what each sketch does the moment power arrives
  function setup() {
    S.millis0 = S.t;
    S.lastFlash = 0; S.flashOn = false; S.loopAcc = 0;
    S.led = false; S.green = S.red = S.buzzing = false;
    if (S.mach === 'one') { S.state = 0; enter1(ONE.WAITING, 'power'); }
    else if (S.mach === 'flags') { S.f = { armed: false, alarming: false, snoozed: false }; log('started: armed=0 alarming=0 snoozed=0'); moveToken(); }
    else enter3(0);
  }

  let pendingPress = false;
  function press() {
    if (S.off) return;
    if (sk?.powered) realPressUntil = performance.now() + 150; // the real sketch reads pin 2 itself
    else pendingPress = true;
    btn.userData.cap.position.y -= 0.3;
    stage.wait(0.15).then(() => { btn.userData.cap.position.y += 0.3; stage.invalidate(); });
  }

  // ---------- the token moves between rooms ----------
  function roomNow() {
    if (S.mach === 'one') return rooms1[S.state];
    if (S.mach === 'flags') return rooms2[flagKey(S.f)];
    return rooms3[S.state];
  }
  let tokTween = 0;
  function moveToken() {
    const r = roomNow();
    const to = r.position.clone().add(V(0, 0.9, -1));
    const from = token.position.clone();
    const id = ++tokTween;
    [...rooms1, ...Object.values(rooms2), ...rooms3].forEach((x) => { x.userData.m.emissiveIntensity = x === r ? 0.28 : 0; });
    if (!token.visible || from.distanceTo(to) < 0.1) { token.position.copy(to); token.visible = true; stage.invalidate(); return; }
    stage.tween((k) => {
      if (id !== tokTween) return;
      token.position.lerpVectors(from, to, k);
      token.position.y += Math.sin(Math.PI * k) * 5;
    }, 0.45);
  }

  // ---------- callouts ----------
  const tokCard = stage.callout(token, { title: 'You are here', text: 'The device is always in exactly one room.', at: [0, 5, 0], dx: 90, dy: -120 });
  stage.callout(btn, { title: 'The button', text: 'Pin 2. Click it, or use "Press the button".', at: [0, 3, 6.5], dx: -60, dy: 90 });
  const ledCard = stage.callout(greenLed, { title: 'The light', text: 'Pin 7.', at: [-3, 5, -7.5], dx: 40, dy: -80 });
  const frozenCard = stage.callout(rooms2['011'], { title: 'Frozen', text: 'armed false, alarming true: no branch matches, so nothing writes the light.', at: [-4, 1, 0], dx: -40, dy: -70, quiet: true });
  const tankCard = stage.callout(tank, { title: 'The tank', text: 'The sensor looks down. Full tank, short distance.', at: [0, 26, 0], dx: -40, dy: -40, quiet: true });
  void tokCard; void frozenCard;

  // ---------- the side panel ----------
  const gM = ui.group('The sketch running');
  const machs = [['one', 'b8_01: one state'], ['flags', 'b8_02: three flags'], ['tank', 'b8_03: tank alarm']];
  const machBtns = machs.map(([id, t]) => ui.button(t, () => setMach(id), { group: gM }));
  const gI = ui.group('Do something to it');
  ui.button('Press the button', () => press(), { group: gI, primary: true });
  const cutBtn = ui.button('Pull the USB out (and back in)', () => cut(), { group: gI });
  const ffBtn = ui.button('Fast-forward time', () => { S.ff = !S.ff; ffBtn.setAttribute('aria-pressed', String(S.ff)); }, { group: gI, pressed: false });
  const waterWrap = ui.element(`<label style="display:flex;gap:8px;align-items:center;width:100%;font-size:13.5px">Water, cm below the sensor <input type="range" min="5" max="45" value="${S.water}" style="flex:1;min-width:0;accent-color:var(--lab-accent);direction:rtl" aria-label="Water level, in centimetres below the sensor. Smaller means fuller."><output style="font:600 13px ${MONO};min-width:3.6em;text-align:right">${S.water} cm</output></label>`, gI);
  const wIn = waterWrap.querySelector('input');
  const wOut = waterWrap.querySelector('output');
  wIn.addEventListener('input', () => { S.water = +wIn.value; wOut.textContent = `${S.water} cm`; placeWater(); });

  function placeWater() {
    const level = Math.max(0.5, TH - S.water * 0.5 - 1); // 1 cm = 0.5 units below the rim
    water.scale.y = level;
    water.position.y = level / 2;
    stage.invalidate();
  }

  let started = false;
  function setMach(id) {
    S.mach = id;
    ui.toggle(machBtns, machBtns[machs.findIndex((x) => x[0] === id)]);
    m1.visible = id === 'one';
    m2.visible = id === 'flags';
    m3.visible = id === 'tank';
    const tankOn = id === 'tank';
    tank.visible = tankTag.visible = waterWrap.hidden = false;
    tank.visible = tankOn;
    tankTag.visible = tankOn;
    waterWrap.hidden = !tankOn;
    redLed.visible = buz.visible = tags.led2.visible = tags.buz.visible = tankOn;
    ledCard.set('The light' + (tankOn ? 's' : ''), tankOn ? 'Green on pin 7, red on pin 8. The buzzer is on pin 6.' : 'Pin 7. It is the only output.');
    void tankCard;
    S.serial = [];
    S.path = [];
    token.visible = false;
    if (id === 'one') S.visited1 = new Set();
    S.presses1AfterFreeze = 0;
    if (started) stage.lookAt(id === 'flags' ? V(6, 3, -11) : id === 'tank' ? V(14, 3, 0) : V(7, 2, 0), id === 'one' ? 1 : 0.82);
    started = true;
    setup();
    lastInfo = '';
  }

  function cut() {
    if (S.off) return;
    if (sk?.powered) {
      // the real board: unplugged, every number gone; plugged back in, setup() runs again
      if (S.mach === 'tank' && S.state === 2 && S.water <= 15) S.cutDuringSnoozeHigh = true;
      sk.unplug('cut');
      cutBtn.disabled = true;
      token.visible = false;
      log('(power cut)');
      lastInfo = '';
      setTimeout(() => {
        cutBtn.disabled = false;
        log('(power back)');
        if (S.cutDuringSnoozeHigh) { S.cutDuringSnoozeHigh = false; S.cameBackFromSnoozeCut = true; }
        sk.start('power');
      }, 1400);
      return;
    }
    if (S.mach === 'tank' && S.state === 2 && S.water <= 15) S.cutDuringSnoozeHigh = true;
    S.off = true;
    S.offUntil = S.t + 1.4;
    S.led = S.green = S.red = S.buzzing = false;
    token.visible = false;
    log('(power cut)');
    cutBtn.disabled = true;
    lastInfo = '';
  }

  // ---------- the words beside it ----------
  let lastInfo = '';
  function showInfo() {
    let name, code, extra = '';
    if (S.off) {
      name = 'No power';
      code = '';
      extra = '<p><b>Everything is off.</b> Every number in the sketch is gone. When the power comes back, <code>setup()</code> decides the room.</p>';
    } else if (S.mach === 'one') {
      name = ONE_NAMES[S.state];
      code = `int state = ${name};`;
      if (S.state === 3) extra = `<p>Snooze time left: <b>${Math.max(0, (5000 - (millis() - S.stateSince)) / 1000).toFixed(1)} s</b></p>`;
      extra += '<p class="lab-tip">One name, four values. There is no fifth value, so there is no room without a branch.</p>';
    } else if (S.mach === 'flags') {
      const f = S.f;
      const b = branchFor(f.armed, f.alarming, f.snoozed);
      name = `armed=${+f.armed} alarming=${+f.alarming} snoozed=${+f.snoozed}`;
      code = b ? `branch ${b} writes the light` : 'no branch matches';
      extra = b ? `<p>${BRANCH_TEXT[b]}.</p>` : '<p><b>Frozen.</b> armed is false and alarming is true. The first branch needs armed, so does the second, and the third needs alarming false. None of the three runs, so nothing writes the light. It stays exactly as it was.</p>';
      extra += '<p class="lab-tip">Three flags make eight rooms. Only five have a branch, and nothing stops the device walking into the other three.</p>';
    } else {
      name = TANK_NAMES[S.state];
      code = `state = ${name};`;
      extra = `<p>The sensor reads the water <b>${S.water} cm</b> below it.</p>`;
      if (S.state === 2) extra += `<p>Snooze time left: <b>${Math.max(0, (30000 - (millis() - S.stateSince)) / 1000).toFixed(1)} s</b></p>`;
      extra += `<p class="lab-tip">Alarm at 15 cm or closer; clear at 20 cm or more. Between the two, nothing flaps. After a power cut, <code>setup()</code> always ends with <code>enterState(ARMED)</code>.</p>`;
    }
    const serial = `<div class="lab-joins"><b>Serial monitor</b><pre style="margin:4px 0 0;font:12px/1.45 ${MONO};white-space:pre-wrap">${S.serial.map(esc).join('\n') || '…'}</pre></div>`;
    const html = `<p>Now in: <b>${esc(name)}</b>${code ? ` · <code>${esc(code)}</code>` : ''}</p>${extra}${serial}`;
    if (html === lastInfo) return;
    lastInfo = html;
    ui.info('Rooms and arrows', html);
  }

  // ---------- the clock ----------
  let infoT = 0;
  stage.onTick((dt) => {
    S.t += dt * (S.ff ? 10 : 1);
    if (S.off) {
      if (S.t >= S.offUntil) {
        S.off = false;
        cutBtn.disabled = false;
        log('(power back)');
        const wasSnoozeCut = S.cutDuringSnoozeHigh;
        S.cutDuringSnoozeHigh = false;
        setup();
        if (wasSnoozeCut) S.cameBackFromSnoozeCut = true;
      }
    } else if (sk?.powered) {
      // the real sketch runs the device; its serial output moves the token
      if (S.mach === 'flags') { if (flagKey(S.f) === '011') { S.frozenFor += dt; if (S.frozenFor > 1) S.sawFrozen = true; } else S.frozenFor = 0; }
    } else {
      const pressed = pendingPress;
      pendingPress = false;
      if (S.mach === 'one') {
        run1(pressed);
        if (pressed && S.sawFrozen) S.presses1AfterFreeze++;
        if (S.sawFrozen && S.presses1AfterFreeze >= 4 && S.visited1.size === 4) ui.complete('frozen');
      } else if (S.mach === 'flags') {
        run2(pressed);
        if (flagKey(S.f) === '011') { S.frozenFor += dt; if (S.frozenFor > 1) S.sawFrozen = true; } else S.frozenFor = 0;
      } else {
        S.loopAcc += dt * 1000 * (S.ff ? 10 : 1);
        let p = pressed;
        while (S.loopAcc >= 50) { S.loopAcc -= 50; run3(p); p = false; }
        if (p) pendingPress = true; // keep a press for the next round
      }
    }
    // missions: the b8_01 cycle, with SNOOZED leaving by the clock
    const P1 = S.path;
    for (let i = 0; i + 3 < P1.length; i++) {
      if (P1[i].to === 1 && P1[i + 1].to === 2 && P1[i + 2].to === 3 && P1[i + 3].to === 1 && P1[i + 3].why === 'time' && P1.slice(0, i + 1).some((x) => x.to === 0)) ui.complete('cycle');
    }
    // outputs (the real sketch draws its own: see paint below)
    if (!sk?.powered) {
      if (S.mach === 'tank') { setLed(greenLed, S.green); setLed(redLed, S.red); }
      else { setLed(greenLed, S.led); setLed(redLed, false); }
      buz.position.y = S.buzzing ? 0.12 : 0;
    }
    tokM.color.setHex(S.mach === 'flags' && flagKey(S.f) === '011' ? 0xca1f3f : 0xffbe00);
    tokM.emissive.setHex(S.mach === 'flags' && flagKey(S.f) === '011' ? 0xca1f3f : 0xffbe00);
    infoT += dt;
    if (infoT > 0.2) { infoT = 0; showInfo(); }
  });

  // ---------- the real sketch (sketchpanel.js) ----------
  // The device's pins are real: the light on 7, the red light on 8, the buzzer
  // on 6, the button on 2, and for the tank the sensor on 10 and 11 looking at
  // the water. The token follows what the sketch prints ("now in state 2").
  const SKETCH_MACH = { b8_01_states_given: 'one', b8_02_buggy_flags: 'flags', b8_03_tank_alarm_worked: 'tank' };
  let realPressUntil = 0;
  let syncing = false;
  const sonar = { cm: S.water };
  function heard(line) {
    log(line);
    lastInfo = '';
    let m;
    if (S.mach === 'one' && (m = /now in state (\d)/.exec(line))) {
      const from = S.state, to = +m[1];
      S.state = to;
      S.stateSince = millis();
      // only the clock leads from SNOOZED to ARMED
      S.path.push({ from, to, why: from === 3 && to === 1 ? 'time' : token.visible ? 'press' : 'power' });
      if (S.path.length > 12) S.path.shift();
      S.visited1.add(to);
      if (S.sawFrozen) S.presses1AfterFreeze++;
      if (S.sawFrozen && S.presses1AfterFreeze >= 4 && S.visited1.size === 4) ui.complete('frozen');
      moveToken();
    } else if (S.mach === 'flags' && (m = /armed=(\d)\s+alarming=(\d)\s+snoozed=(\d)/.exec(line))) {
      S.f = { armed: m[1] === '1', alarming: m[2] === '1', snoozed: m[3] === '1' };
      moveToken();
    } else if (S.mach === 'tank' && (m = /^state (\d)/.exec(line))) {
      S.state = +m[1];
      S.stateSince = millis();
      moveToken();
      if (S.state === 1 && S.cameBackFromSnoozeCut) { ui.complete('power'); S.cameBackFromSnoozeCut = false; }
    }
  }
  const sk = sketchPanel(stage, ui, host, {
    sketches: Object.keys(SKETCH_MACH),
    explain: 'The device beside the rooms is its real pins; the gold token follows what it prints on the serial monitor. Unplug it and the model takes over again.',
    wire(u) { wireSonar(u, sonar, 10, 11); },
    inputs(u) {
      sonar.cm = S.water;
      const m = u.mode(2);
      if (m === PinState.Input || m === PinState.InputPullUp) { const v = performance.now() < realPressUntil ? 0 : 1; if (u.readInput(2) !== v) u.setInput(2, v); }
    },
    serial: (() => { let line = ''; return (t) => { for (const ch of t) { if (ch === '\n') { heard(line); line = ''; } else if (ch !== '\r') line += ch; } }; })(),
    serialNote: (t) => { log(`(${t})`); lastInfo = ''; },
    paint(P) {
      if (!P) { setLed(greenLed, false); setLed(redLed, false); buz.position.y = 0; return true; }
      const d = (p) => (OUT(P[p].mode) ? P[p].duty : 0);
      setLed(greenLed, d(7) > 0.3);
      setLed(redLed, d(8) > 0.3);
      buz.position.y = OUT(P[6].mode) && (P[6].hz > 20 || d(6) > 0.3) ? 0.12 : 0;
      return true;
    },
    onState(st) {
      if (st.why === 'choose' || st.why === 'upload') {
        const m = SKETCH_MACH[st.open];
        if (m && m !== S.mach) { syncing = true; setMach(m); syncing = false; }
      }
      if (st.powered && ['run', 'upload'].includes(st.why)) { S.serial = []; S.path = []; token.visible = false; lastInfo = ''; }
      if (!st.powered && !['choose', 'reset', 'load', 'cut'].includes(st.why)) setup(); // the model takes over, from setup()
    },
  });
  gM.addEventListener('click', (e) => { if (!syncing && sk.powered && e.target.closest('button')) sk.unplug('lab'); }, true);

  placeWater();
  setMach('one');
  sk.choose('b8_01_states_given');
}

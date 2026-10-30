// Band 6 concept lab: what gate.write(angle) actually sends down the orange
// wire, why a still knob makes a shivering arm (b6_03_buggy_jitter) and the
// deadband that stops it, and the shared-ground rule from Part 7.
// <div class="lab" data-lab="concept-b6" data-lazy hidden></div>
//
// Everything simulated here follows the band's sketches line for line:
//   - Servo library: write(angle) sets the pulse width. Its defaults are
//     544 microseconds for 0 and 2400 for 180, one pulse every 20 ms.
//   - b6_01: for (angle 0..180) { write(angle); delay(15); } and back.
//   - b6_02 / b6_03: reading = analogRead(A0); angle = map(reading, 0, 1023,
//     0, 180) (whole numbers, like the Arduino); write(angle); delay(20).
//   - The deadband: if (abs(wanted - lastAngle) >= deadband) { write; lastAngle = wanted; }
//     with lastAngle starting at -100.
//
// It also exports a few small helpers (a plain Arduino, a redrawable screen,
// a jumper between two points) that the Band 7 and Band 8 labs share.
import { THREE, mat, rbox, decal, label, setLabel } from './runtime.js';
import * as P from './parts.js';
import { buildUno } from './build.js';
import { sketchPanel } from './sketchpanel.js';

const { V } = P;
const SANS = 'Rubik, "Segoe UI", Arial, sans-serif';
const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';

// ---------- shared helpers (used by concept-b7.js and concept-b8.js) ----------
export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A flat screen whose picture can be redrawn: draw(fn) paints the canvas and
// tells three.js to upload it again.
export function livePlate(w, h, ppu = 40) {
  const c = document.createElement('canvas');
  const k = Math.min(1, 1400 / Math.max(w * ppu, h * ppu));
  c.width = Math.round(w * ppu * k);
  c.height = Math.round(h * ppu * k);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  mesh.userData.noInk = true;
  const g = c.getContext('2d');
  return {
    mesh, canvas: c, W: c.width, H: c.height,
    draw(fn) { fn(g, c.width, c.height); tex.needsUpdate = true; },
  };
}

// The Arduino Uno: the shared model (build.js), centred on the origin.
// sock(name, k) is the top of a socket; setOn(level) lights the ON light.
export function miniUno() {
  const W = 27, D = 21;
  const u = buildUno({ parts: [] }, -W / 2, -D / 2);
  const socks = {};
  for (const sk of u.socks) (socks[sk.name] ??= []).push(u.sockPos(sk));
  return {
    group: u.group, W, D, onLed: u.leds.ON.mesh, uno: u,
    sock: (name, k = 0) => socks[name][k].clone(),
    setOn(level) { u.leds.ON.set(level > 0.02, level); },
  };
}

// A jumper wire from the top of one hole or socket to another, arching up
// by `h`. Either end may instead be a free end with its own lead-in point.
export function hop(a, b, color, h = 5, { ends = [true, true], via = null } = {}) {
  const pts = [];
  if (ends[0]) pts.push(V(a.x, a.y + 1.5, a.z), V(a.x, a.y + h, a.z));
  else pts.push(a.clone());
  if (via) via.forEach((p) => pts.push(p.clone()));
  if (ends[1]) pts.push(V(b.x, b.y + h, b.z), V(b.x, b.y + 1.5, b.z));
  else pts.push(b.clone());
  return P.jumper(pts, color, { r: 0.24, ends });
}

// ---------- the Band 6 lab ----------
const COL = { orange: 0xf08a1c, red: 0xd9342b, brown: 0x6b3f22, black: 0x2b2d31, link: 0x3d6fa8 };
const PULSE_MIN = 544;  // the Servo library's defaults
const PULSE_MAX = 2400;
const pulseFor = (a) => Math.round(PULSE_MIN + (a * (PULSE_MAX - PULSE_MIN)) / 180);
const mapAngle = (r) => Math.trunc((r * 180) / 1023); // map(reading, 0, 1023, 0, 180)

export const missions = [
  { id: 'pulse', text: 'Send the arm to 0, then to 180, and watch the pulse on pin 9 change.', hint: 'Choose "You pick the angle", then press gate.write(0) and gate.write(180). Read the pulse width each time.' },
  { id: 'deadband', text: 'Hear the shiver from b6_03, then stop it with a deadband of 3.', hint: 'Choose "The knob", leave the deadband at "none", and keep your hands off the knob. Then pick a deadband of 3.' },
  { id: 'ground', text: 'Put the servo on the battery with no ground link and watch it fail. Then add the one wire.', hint: 'Under Power choose "Battery pack". Take the ground link out, watch, then put it back in.' },
];

export const config = {
  camera: [-5, 3 + 160 * Math.sin(0.92), -12 + 160 * Math.cos(0.92)],
  target: [-5, 3, -12],
  fit: [66, 56],
  pan: true, minZoom: 0.7, maxZoom: 6, tourZoom: 2.2,
  shadowSize: 40, groundSize: 70, sun: [10, 80, 30], maxPolar: Math.PI * 0.45,
  label: '3D model of a servo on an Arduino. Arrow keys turn it, plus and minus zoom, 0 resets. The buttons beside it run the sketch and change the power.',
};

export default function lab(stage, ui, host) {
  const { scene } = stage;
  const world = new THREE.Group();
  scene.add(world);
  const low = stage.lowPower;

  // --- the Arduino ---
  const uno = miniUno();
  uno.group.position.set(-21, 0, 0);
  world.add(uno.group);
  const U = (name, k) => uno.sock(name, k).add(uno.group.position);
  const pin9 = U('9');

  // --- the servo, with a card arm on its horn ---
  const sv = P.moduleModel('servo', ['orange', 'red', 'brown']);
  const SX = 10, SZ = 0;
  sv.group.position.set(SX, 0, SZ);
  world.add(sv.group);
  const horn = sv.group.children.find((m) => Math.abs(m.position.z - 5.6) < 0.01);
  const pivot = new THREE.Group();
  pivot.position.copy(horn.position);
  sv.group.add(pivot);
  horn.position.set(0, 0, 0);
  pivot.add(horn);
  const card = rbox(12, 1.5, 0.3, 0xd8b98a, 0.1, { roughness: 0.85 });
  card.position.set(6.4, 0, 0.36);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 0.08), mat(0xe9e4d2, { transparent: true, opacity: 0.85 }));
  tape.position.set(1.2, 0, 0.55);
  tape.userData.noInk = true;
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.35, 24), mat(0xc9a43a, { metalness: 0.6, roughness: 0.35 }));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(11.4, 0, 0.7);
  pivot.add(card, tape, coin);
  P.shadowAll(pivot);
  const pivotWorld = () => pivot.getWorldPosition(new THREE.Vector3());

  // a protractor behind the arm, and a thin gold line for the angle asked for
  const R = 15;
  const prot = decal(2 * R + 3, R + 2, (c, CW, CH) => {
    const s = CW / (2 * R + 3);
    const cx = CW / 2, cy = CH - s * 1.0;
    c.clearRect(0, 0, CW, CH);
    c.strokeStyle = 'rgba(36,24,46,0.55)';
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = s * 0.12;
    c.beginPath();
    c.arc(cx, cy, R * s, Math.PI, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#24182E';
    c.font = `700 ${s * 1.1}px ${SANS}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let a = 0; a <= 180; a += 10) {
      const r0 = a % 90 === 0 ? R - 2.2 : a % 30 === 0 ? R - 1.5 : R - 0.9;
      const t = (a * Math.PI) / 180;
      c.beginPath();
      c.moveTo(cx + Math.cos(t) * r0 * s, cy - Math.sin(t) * r0 * s);
      c.lineTo(cx + Math.cos(t) * R * s, cy - Math.sin(t) * R * s);
      c.stroke();
      if (a % 30 === 0) c.fillText(String(a), cx + Math.cos(t) * (R - 3.4) * s, cy - Math.sin(t) * (R - 3.4) * s);
    }
  }, { px: 512, maxPx: 1400 });
  const pw = pivotWorld();
  prot.position.set(pw.x, pw.y + (R + 2) / 2 - 1.0, pw.z - 0.5);
  world.add(prot);
  const aim = new THREE.Group();
  aim.position.set(pw.x, pw.y, pw.z - 0.3);
  const aimBar = new THREE.Mesh(new THREE.BoxGeometry(R - 0.5, 0.28, 0.06), new THREE.MeshBasicMaterial({ color: 0xffbe00 }));
  aimBar.position.x = (R - 0.5) / 2;
  aimBar.userData.noInk = true;
  aim.add(aimBar);
  world.add(aim);

  // --- the + and − rails (the top pair of the breadboard) ---
  const RZ = -17, RX0 = -12, RX1 = 22;
  const railBar = rbox(RX1 - RX0, 0.9, 3.4, 0xf3f0ea, 0.12);
  railBar.position.set((RX0 + RX1) / 2, 0.45, RZ);
  world.add(railBar);
  const PLUSZ = RZ - 0.75, MINUSZ = RZ + 0.75;
  const stripe = (z, hex) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(RX1 - RX0 - 1, 0.03, 0.14), new THREE.MeshBasicMaterial({ color: hex }));
    m.position.set((RX0 + RX1) / 2, 0.92, z + (z < RZ ? -0.65 : 0.65));
    m.userData.noInk = true;
    world.add(m);
  };
  stripe(PLUSZ, 0xd9342b);
  stripe(MINUSZ, 0x3d6fa8);
  for (let x = RX0 + 1; x < RX1; x += 1) {
    if ((x - RX0) % 6 === 0) continue;
    for (const z of [PLUSZ, MINUSZ]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.4), mat(0x3a3340));
      h.position.set(x, 0.91, z);
      h.userData.noInk = true;
      world.add(h);
    }
  }
  const rail = (x, plus) => V(x, 0.9, plus ? PLUSZ : MINUSZ);
  const plusTag = label('+ rail', { scale: 1.4, color: '#B4232F' });
  plusTag.position.set(RX0 - 2.6, 1.2, PLUSZ);
  const minusTag = label('− rail', { scale: 1.4, color: '#2B5A93' });
  minusTag.position.set(RX0 - 2.6, 1.2, MINUSZ);
  world.add(plusTag, minusTag);

  // --- the battery pack ---
  const batt = P.batteryPack();
  batt.group.position.set(8, 0, -27);
  world.add(batt.group);
  const bt = batt.tips.map((t) => t.clone().add(batt.group.position));
  const battWires = new THREE.Group();
  battWires.add(P.jumper([bt[0], V(bt[0].x - 2.5, 1.2, bt[0].z), V(-1.5, 5, -24), V(-1.5, 5, PLUSZ), V(-1.5, 2.4, PLUSZ)], COL.red, { r: 0.24, ends: [false, true] }));
  battWires.add(P.jumper([bt[1], V(bt[1].x - 2.5, 1.2, bt[1].z), V(0.5, 4, -21), V(0.5, 4, MINUSZ), V(0.5, 2.4, MINUSZ)], COL.black, { r: 0.24, ends: [false, true] }));
  world.add(battWires);

  // --- the wires ---
  const tips = sv.tips.map((t) => t.clone().add(sv.group.position));
  const lead = (tip, to, color, h, mid) => P.jumper([tip, V(tip.x, tip.y + 0.1, tip.z - 1.8), ...(mid || []), V(to.x, to.y + h, to.z), V(to.x, to.y + 1.5, to.z)], color, { r: 0.24, ends: [false, true] });
  const sigWire = lead(tips[0], pin9, COL.orange, 4, [V(9, 6, -8.5), V(-8, 7, -10.5)]);
  const redWire = lead(tips[1], rail(17, true), COL.red, 3.5, [V(tips[1].x, 3.5, -11)]);
  const brownWire = lead(tips[2], rail(19, false), COL.brown, 3, [V(tips[2].x + 0.4, 3, -11)]);
  const v5Wire = hop(U('5V'), rail(-9, true), COL.red, 9, { via: [V(-14, 11, -4)] });
  const gndWire = hop(U('GND', 1), rail(-7, false), COL.link, 8, { via: [V(-12, 10, -4)] });
  world.add(sigWire, redWire, brownWire, v5Wire, gndWire);
  // where the ground link goes when it is out: a dashed ghost
  const ghostPts = [U('GND', 1).setY(3.4), V(-20.5, 8, 9.4), V(-12, 10, -4), V(-7, 8, MINUSZ), V(-7, 2.4, MINUSZ)];
  const ghostCurve = new THREE.CatmullRomCurve3(ghostPts);
  const ghostGeo = new THREE.BufferGeometry().setFromPoints(ghostCurve.getPoints(60));
  const ghost = new THREE.Line(ghostGeo, new THREE.LineDashedMaterial({ color: 0xca1f3f, dashSize: 0.8, gapSize: 0.6 }));
  ghost.computeLineDistances();
  ghost.userData.noInk = true;
  world.add(ghost);
  const ghostMid = new THREE.Object3D();
  ghostMid.position.copy(ghostCurve.getPoint(0.55));
  world.add(ghostMid);

  // --- the signal screen: what pin 9 sends ---
  const scopeW = 30, scopeH = 12.5;
  const scopeG = new THREE.Group();
  const frame = rbox(scopeW + 1.4, scopeH + 1.4, 0.8, 0x24182e, 0.3);
  const scr = livePlate(scopeW, scopeH, 44);
  scr.mesh.position.z = 0.42;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 1.2), mat(0x5a4470));
  stand.position.set(0, -scopeH / 2 - 2.2, -0.3);
  scopeG.add(frame, scr.mesh, stand);
  scopeG.position.set(-21, 10.5, -28);
  scopeG.rotation.x = -0.55;
  world.add(scopeG);
  P.shadowAll(frame);

  // ---------- state ----------
  const S = {
    prog: 'write',      // 'sweep' | 'write' | 'knob'
    sweepDelay: 15,     // 15, 2, or 0 (no delay at all)
    pick: 90,
    knob: 511,
    deadband: 0,        // 0 = none (b6_03)
    power: 'usb',       // 'usb' | 'battery'
    link: true,
    load: false,
    target: 90,         // what the sketch last wrote (null before the first write)
    angle: 90,          // where the arm really is
    lastAngle: -100,
    sweepA: 0, sweepDir: 1, acc: 0, pulseAcc: 0,
    serial: [],
    moves: [],          // times the target changed (for "moves in the last second")
    t: 0,
    brown: 0, resetUntil: -10, jerk: 1, jerkT: 0, twitchT: 0,
    knobTouched: 0,
    seenMin: false, seenMax: false,
    sawShiver: false, quietSince: null,
    sawFail: 0, linkMoved: 0, linkFrom: null,
  };

  const signalOk = () => S.power === 'usb' || S.link;
  const sketchRunning = () => S.t >= S.resetUntil;

  function write(a) {
    a = Math.max(0, Math.min(180, Math.round(a)));
    if (S.target !== a) S.moves.push(S.t);
    S.target = a;
  }

  function restartSketch() {
    S.sweepA = 0; S.sweepDir = 1; S.acc = 0;
    S.lastAngle = -100;
    S.serial = ['(the board reset: the sketch starts again from the top)'];
  }

  // ---------- the simulation ----------
  const step = (dt) => {
    S.t += dt;
    const ms = dt * 1000;
    // brown-out: a loaded arm on the Arduino's own 5V pin
    const moving = S.target !== null && (Math.abs(S.target - S.angle) > 0.6 || (S.moves.length && S.moves[S.moves.length - 1] > S.t - 0.15));
    const struggling = S.power === 'usb' && S.load && moving && sketchRunning();
    if (struggling) {
      S.jerkT -= dt;
      if (S.jerkT <= 0) { S.jerk = S.jerk > 0.5 ? 0.05 : 1; S.jerkT = 0.05 + Math.random() * 0.12; }
      S.brown += dt;
      if (S.brown > 2.6) {
        S.brown = 0;
        S.resetUntil = S.t + 0.6;
        restartSketch();
      }
    } else { S.jerk = 1; S.brown = Math.max(0, S.brown - dt * 0.5); }
    uno.setOn(!sketchRunning() ? 0 : struggling ? (S.jerk < 0.5 ? 0.25 : 0.7) : 1.0);

    // the sketch: the real one's pulses on pin 9 (sketchpanel.js), or the model's
    if (sketchRunning() && sk?.powered) {
      if (realUs > 400 && realUs < 2700) write(((realUs - 544) / (2400 - 544)) * 180);
    } else if (sketchRunning()) {
      if (S.prog === 'write') write(S.pick);
      else if (S.prog === 'sweep') {
        if (S.sweepDelay > 0) {
          S.acc += ms;
          while (S.acc >= S.sweepDelay) {
            S.acc -= S.sweepDelay;
            write(S.sweepA);
            S.sweepA += S.sweepDir;
            if (S.sweepA > 180) { S.sweepA = 180; S.sweepDir = -1; }
            else if (S.sweepA < 0) { S.sweepA = 0; S.sweepDir = 1; }
          }
        } else {
          // no delay: all 362 writes take a millisecond or two, so each
          // 20 ms pulse carries whichever angle the loop happens to be on
          S.pulseAcc += ms;
          while (S.pulseAcc >= 20) { S.pulseAcc -= 20; write(Math.floor(Math.random() * 181)); }
        }
      } else if (S.prog === 'knob') {
        S.acc += ms;
        while (S.acc >= 20) {
          S.acc -= 20;
          const noise = [-1, 0, 0, 1, 1, 2][Math.floor(Math.random() * 6)];
          const reading = Math.max(0, Math.min(1023, Math.round(S.knob) + noise));
          const wanted = mapAngle(reading);
          let line;
          if (S.deadband === 0) {
            write(wanted);
            line = `reading ${reading}   angle ${wanted}   write(${wanted})`;
          } else if (Math.abs(wanted - S.lastAngle) >= S.deadband) {
            write(wanted);
            S.lastAngle = wanted;
            line = `reading ${reading}   angle ${wanted}   write(${wanted})`;
          } else {
            line = `reading ${reading}   angle ${wanted}   gap ${Math.abs(wanted - S.lastAngle)}, no move`;
          }
          S.serial.push(line);
          if (S.serial.length > 6) S.serial.shift();
        }
      }
    }
    while (S.moves.length && S.moves[0] < S.t - 1) S.moves.shift();

    // the servo
    if (!sketchRunning()) {
      // no signal while the board restarts: the arm sags a little under load
      if (S.load) S.angle += (Math.random() - 0.5) * 0.6;
    } else if (signalOk()) {
      const speed = (S.power === 'battery' ? 600 : 450) * S.jerk;
      const d = S.target - S.angle;
      const stepA = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      S.angle += stepA;
      if (S.power === 'battery' && S.link) S.linkMoved += Math.abs(stepA);
    } else {
      // battery, no shared ground: the pulse means nothing to the servo
      S.twitchT -= dt;
      if (S.twitchT <= 0) {
        S.twitchT = 0.35 + Math.random() * 0.9;
        S.angle = Math.max(0, Math.min(180, S.angle + (Math.random() - 0.5) * 7));
      }
    }
    S.angle = Math.max(0, Math.min(180, S.angle));
    pivot.rotation.z = THREE.MathUtils.degToRad(S.angle);
    aim.rotation.z = THREE.MathUtils.degToRad(S.target ?? S.angle);
    aim.visible = S.target !== null;
    // shiver: a fast tiny wobble when the target keeps flipping
    const shiver = signalOk() && S.moves.length >= 4 && Math.abs(S.target - S.angle) < 3;
    sv.group.position.x = SX + (shiver && !reducedMotion() ? Math.sin(S.t * 90) * 0.05 : 0);

    detect(dt);
  };

  // ---------- missions: only what really happened counts ----------
  function detect(dt) {
    if (S.prog === 'write' && signalOk() && sketchRunning()) {
      if (S.target === 0 && S.angle <= 1) S.seenMin = true;
      if (S.target === 180 && S.angle >= 179) S.seenMax = true;
      if (S.seenMin && S.seenMax) ui.complete('pulse');
    }
    if (S.prog === 'knob' && signalOk() && sketchRunning()) {
      const handsOff = S.t - S.knobTouched > 1;
      if (S.deadband === 0 && handsOff && S.moves.length >= 8) S.sawShiver = true;
      if (S.sawShiver && S.deadband >= 3 && handsOff && S.moves.length === 0) {
        S.quietSince ??= S.t;
        if (S.t - S.quietSince > 3) ui.complete('deadband');
      } else S.quietSince = null;
    } else S.quietSince = null;
    if (S.power === 'battery' && !S.link) S.sawFail += dt;
    if (S.power === 'battery' && S.link && S.sawFail > 2) {
      if (S.linkFrom === null) { S.linkFrom = S.t; S.linkMoved = 0; }
      if (S.linkMoved >= 60) ui.complete('ground');
    } else { S.linkFrom = null; }
  }

  // ---------- the signal screen ----------
  let lastScope = '';
  function drawScope() {
    const ok = signalOk() && sketchRunning();
    const us = S.target === null ? null : pulseFor(S.target);
    const key = `${ok}|${us}|${S.power}|${S.link}|${sketchRunning()}|${ok ? '' : Math.floor(S.t * 4)}`;
    if (key === lastScope) return;
    lastScope = key;
    scr.draw((c, W, H) => {
      const u = W / scopeW;
      c.fillStyle = '#1b1222';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      c.lineWidth = 1;
      for (let x = 0; x <= W; x += u * 2) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y <= H; y += u * 2) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.fillStyle = '#FFBE00';
      c.font = `700 ${u * 0.95}px ${SANS}`;
      c.textBaseline = 'top';
      c.fillText(S.power === 'battery' && !S.link ? 'Pin 9, as the servo sees it' : 'What pin 9 sends', u * 0.6, u * 0.4);
      c.font = `600 ${u * 0.78}px ${MONO}`;
      c.fillStyle = '#ffffff';
      const pad = u * 0.8;
      const drawTrace = (y0, y1, x0, x1, span, width, color, rep) => {
        // y0 = HIGH, y1 = LOW; one pulse of `width` (µs) every 20000 µs over `span` µs
        c.strokeStyle = color;
        c.lineWidth = u * 0.16;
        c.beginPath();
        c.moveTo(x0, y1);
        for (let t0 = 0; t0 < span; t0 += rep) {
          const xa = x0 + ((x1 - x0) * t0) / span;
          const xb = x0 + ((x1 - x0) * Math.min(span, t0 + width)) / span;
          c.lineTo(xa, y1); c.lineTo(xa, y0); c.lineTo(xb, y0); c.lineTo(xb, y1);
        }
        c.lineTo(x1, y1);
        c.stroke();
      };
      if (!sketchRunning()) {
        c.fillStyle = '#ff8a8a';
        c.fillText('No signal: the board is restarting.', pad, H * 0.45);
        return;
      }
      if (us === null) return;
      if (!ok) {
        // no shared zero: measured against the servo's own ground, the pulse is lost
        c.strokeStyle = '#ff6b6b';
        c.lineWidth = u * 0.14;
        c.beginPath();
        let y = H * 0.55;
        for (let x = pad; x < W - pad; x += u * 0.25) {
          y = Math.max(H * 0.28, Math.min(H * 0.8, y + (Math.random() - 0.5) * u * 1.4));
          if (x === pad) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        c.fillStyle = '#ffffff';
        c.fillText('No shared ground: no zero to measure', pad, H - u * 2.1);
        c.fillText('the pulse against. It means nothing.', pad, H - u * 1.1);
        return;
      }
      // top: three frames of 20 ms
      c.fillStyle = '#d9cfe0';
      c.fillText('one pulse every 20 ms', pad, u * 1.6);
      drawTrace(u * 2.9, u * 4.6, pad, W - pad, 60000, us, '#FFBE00', 20000);
      // bottom: the first 3 ms, magnified
      const x0 = pad, x1 = W - pad, yH = u * 6.4, yL = u * 8.8;
      c.fillStyle = '#d9cfe0';
      c.fillText('the first 3 ms, magnified', pad, u * 5.3);
      drawTrace(yH, yL, x0, x1, 3000, us, '#FFBE00', 1e9);
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 1;
      c.font = `600 ${u * 0.62}px ${MONO}`;
      c.fillStyle = '#d9cfe0';
      for (let ms = 0; ms <= 3; ms += 0.5) {
        const x = x0 + ((x1 - x0) * ms * 1000) / 3000;
        c.beginPath(); c.moveTo(x, yL + u * 0.2); c.lineTo(x, yL + u * 0.5); c.stroke();
        c.textAlign = 'center';
        c.fillText(`${ms} ms`, Math.min(W - u * 1.2, Math.max(u * 1.2, x)), yL + u * 0.6);
      }
      c.textAlign = 'left';
      c.font = `700 ${u * 0.9}px ${MONO}`;
      c.fillStyle = '#ffffff';
      const xe = x0 + ((x1 - x0) * us) / 3000;
      c.fillText(`${us} µs`, Math.min(xe + u * 0.4, W - u * 5), yH + u * 0.3);
    });
  }

  // ---------- callouts (the tour visits them in this order) ----------
  stage.callout(pivot, { title: 'The arm', text: 'Goes to the angle it is told and holds it there.', at: [9, 1.2, 0.5], dx: 70, dy: -70 });
  stage.callout(scr.mesh, { title: 'The signal', text: 'The width of each pulse is the angle. Wider pulse, bigger angle.', at: [scopeW / 2 - 1, 0, 0], dx: 150, dy: -10 });
  stage.callout(uno.group, { title: 'Pin 9', text: 'The orange wire. gate.attach(9) told the library which pin.', at: uno.sock('9').toArray(), dx: 110, dy: 30 });
  const gndCard = stage.callout(gndWire, { title: 'Ground link', text: 'Carries no power. It tells both halves where zero is.', at: [-12, 10, -4], dx: -90, dy: 60 });
  stage.callout(ghostMid, { title: 'The missing wire', text: 'No ground link: the servo cannot read the pulse.', dx: -90, dy: 60 });
  stage.callout(batt.group, { title: 'Battery pack', text: 'Four AA cells, about 6 V. Only the servo touches the + rail.', at: [5, 2, 0], dx: 210, dy: -30 });
  stage.callout(railBar, { title: 'The rails', text: 'Red is the + rail, blue is the − rail.', at: [8, 0.5, 0], dx: 60, dy: -60, quiet: true });
  stage.callout(sv.group, { title: 'SG90 servo', text: 'A motor, gears and a sensor. It goes to an angle, not a speed.', at: [2, 4.8, 0.8], dx: 80, dy: -40, quiet: true });
  stage.callout(aim, { title: 'Asked for', text: 'The gold line is the angle the sketch last wrote.', at: [R - 2, 0, 0], dx: 40, dy: -50, quiet: true });

  // ---------- the side panel ----------
  const progGroup = ui.group('The sketch running');
  const progBtns = [
    ui.button('You pick the angle', () => setProg('write'), { group: progGroup }),
    ui.button('Sweep (b6_01)', () => setProg('sweep'), { group: progGroup }),
    ui.button('The knob (b6_02, b6_03)', () => setProg('knob'), { group: progGroup }),
  ];
  const sub = ui.group();
  const powGroup = ui.group('Power');
  const powBtns = [
    ui.button('Arduino 5V (Part 5)', () => setPower('usb'), { group: powGroup }),
    ui.button('Battery pack (Part 7)', () => setPower('battery'), { group: powGroup }),
  ];
  const linkBtn = ui.button('Ground link: in', () => { S.link = !S.link; refresh(); }, { group: powGroup, pressed: true });
  const loadBtn = ui.button('Coin on the arm', () => { S.load = !S.load; refresh(); }, { group: powGroup, pressed: false });

  const range = (id, lab, min, max, val, onInput) => {
    const d = ui.element(`<label style="display:flex;gap:8px;align-items:center;width:100%;font-size:13.5px">${lab}<input type="range" min="${min}" max="${max}" value="${val}" style="flex:1;min-width:0;accent-color:var(--lab-accent)" aria-label="${lab}"><output style="font:600 13px ${MONO};min-width:3.2em;text-align:right">${val}</output></label>`, sub);
    const inp = d.querySelector('input');
    const out = d.querySelector('output');
    inp.addEventListener('input', () => { out.textContent = inp.value; onInput(+inp.value); });
    return { inp, out, set(v) { inp.value = v; out.textContent = v; } };
  };

  function buildSub() {
    sub.innerHTML = '';
    if (S.prog === 'write') {
      sub.insertAdjacentHTML('beforeend', '<span class="lab-group-title">gate.write(angle)</span>');
      const r = range('pick', 'Angle', 0, 180, S.pick, (v) => { S.pick = v; });
      for (const a of [0, 90, 180]) ui.button(`gate.write(${a})`, () => { S.pick = a; r.set(a); }, { group: sub });
    } else if (S.prog === 'sweep') {
      sub.insertAdjacentHTML('beforeend', '<span class="lab-group-title">The wait inside each for loop</span>');
      const bs = [[15, 'delay(15)'], [2, 'delay(2)'], [0, 'no delay at all']].map(([v, t]) => {
        const b = ui.button(t, () => { S.sweepDelay = v; ui.toggle(bs, b); }, { group: sub });
        return b;
      });
      ui.toggle(bs, bs[[15, 2, 0].indexOf(S.sweepDelay)]);
    } else {
      sub.insertAdjacentHTML('beforeend', '<span class="lab-group-title">The knob on A0</span>');
      range('knob', 'Knob', 0, 1023, S.knob, (v) => { S.knob = v; S.knobTouched = S.t; });
      sub.insertAdjacentHTML('beforeend', '<span class="lab-group-title">Deadband</span>');
      const bs = [[0, 'none (b6_03)'], [1, '1'], [3, '3'], [10, '10'], [30, '30']].map(([v, t]) => {
        const b = ui.button(t, () => { S.deadband = v; S.lastAngle = -100; ui.toggle(bs, b); }, { group: sub });
        return b;
      });
      ui.toggle(bs, bs[[0, 1, 3, 10, 30].indexOf(S.deadband)]);
    }
  }
  function setProg(p) {
    S.prog = p;
    S.acc = 0; S.pulseAcc = 0; S.lastAngle = -100; S.serial = [];
    if (p === 'sweep') { S.sweepA = Math.round(S.angle); S.sweepDir = 1; }
    ui.toggle(progBtns, progBtns[['write', 'sweep', 'knob'].indexOf(p)]);
    buildSub();
    refresh();
  }
  function setPower(p) {
    S.power = p;
    ui.toggle(powBtns, powBtns[p === 'usb' ? 0 : 1]);
    refresh();
  }
  function refresh() {
    const onBatt = S.power === 'battery';
    if (onBatt) { S.brown = 0; S.resetUntil = Math.min(S.resetUntil, S.t); }
    battWires.visible = onBatt;
    batt.group.visible = onBatt;
    v5Wire.visible = !onBatt;
    gndWire.visible = !onBatt || S.link;
    ghost.visible = ghostMid.visible = onBatt && !S.link;
    linkBtn.hidden = !onBatt;
    linkBtn.textContent = S.link ? 'Ground link: in' : 'Ground link: out';
    linkBtn.setAttribute('aria-pressed', String(S.link));
    if (onBatt) gndCard.set('Ground link', 'Carries no power. It tells both halves where zero is.');
    else gndCard.set('GND wire', 'The − rail to GND. On USB power the servo shares the Arduino’s ground.');
    loadBtn.setAttribute('aria-pressed', String(S.load));
    coin.visible = S.load;
    stage.invalidate();
    lastInfo = '';
    showInfo();
  }

  // ---------- the words beside it ----------
  let lastInfo = '';
  function showInfo() {
    const a = Math.round(S.angle);
    const us = S.target === null ? '—' : `${pulseFor(S.target)} µs`;
    let status;
    if (S.t < S.resetUntil + 2.5) status = '<b>The board reset.</b> The servo pulled the 5V pin down so far that the chip restarted. Give the servo its own battery (Part 7).';
    else if (!signalOk()) status = '<b>Powered, the sketch is right, and nothing works.</b> The arm twitches or sits still. The servo has no shared ground, so the pulse on pin 9 has nothing to be measured against. Put the ground link in.';
    else if (S.power === 'usb' && S.load && S.brown > 0.2) status = '<b>Jerky, and the ON light dips.</b> A loaded arm wants more current than the Arduino’s 5V pin can give.';
    else if (S.prog === 'knob' && S.moves.length >= 4) status = `<b>Shivering.</b> The reading wobbles by one or two, so the angle flips and the sketch writes every one. ${S.moves.length} moves in the last second, with nothing touching the knob.`;
    else if (S.prog === 'sweep' && S.sweepDelay === 0) status = '<b>No sweep at all.</b> The for loops finish in a moment. The servo only ever sees whatever angle the loop is on when each pulse goes out, so it shivers.';
    else if (S.power === 'battery') status = '<b>Smooth and strong.</b> Battery power for the push, one shared ground for the signal.';
    else status = '<b>Working.</b> With nothing heavy on the arm, the Arduino’s 5V pin is enough.';
    const code = S.prog === 'write' ? `gate.write(${S.pick});`
      : S.prog === 'sweep' ? (S.sweepDelay ? `for (…) { gate.write(angle); delay(${S.sweepDelay}); }` : 'for (…) { gate.write(angle); }')
        : S.deadband === 0 ? 'gate.write(angle);   // every reading (b6_03)' : `if (abs(wanted - lastAngle) >= ${S.deadband}) { … }`;
    const serial = S.prog === 'knob' ? `<div class="lab-joins"><b>Serial monitor</b><pre style="margin:4px 0 0;font:12px/1.45 ${MONO};white-space:pre-wrap">${S.serial.map(esc).join('\n') || '…'}</pre></div>` : '';
    const html = `<p><code>${esc(code)}</code></p>
      <p>Asked for <b>${S.target ?? '—'}°</b> · arm at <b>${a}°</b> · pulse <b>${us}</b></p>
      <p>${status}</p>${serial}`;
    if (html === lastInfo) return;
    lastInfo = html;
    ui.info('Servo, signal and ground', html);
  }

  let infoT = 0;
  stage.onTick((dt) => {
    step(dt);
    infoT += dt;
    if (infoT > 0.2) { infoT = 0; showInfo(); drawScope(); }
  });

  // ---------- the real sketch: b6_01 to b6_03 on an emulated chip ----------
  // Pin 9's real pulses set the arm (through the same power and ground as the
  // model above), and the knob reaches A0 with a real reading's wobble.
  const SKETCH_PROG = { b6_01_servo_sweep_given: 'sweep', b6_02_servo_knob: 'knob', b6_03_buggy_jitter: 'knob' };
  let realUs = 0;
  let syncing = false;
  const sk = sketchPanel(stage, ui, host, {
    sketches: Object.keys(SKETCH_PROG),
    explain: 'Pin 9’s real pulses move the arm, through the power and ground you choose below. The knob reaches A0. The model’s own buttons unplug it.',
    inputs(u) { u.adc.channelValues[0] = (S.knob / 1023) * 5; u.adcNoise[0] = 0.005; },
    serial: (() => { let line = ''; return (t) => { for (const ch of t) { if (ch === '\n') { S.serial.push(line); if (S.serial.length > 6) S.serial.shift(); line = ''; } else if (ch !== '\r') line += ch; } }; })(),
    serialNote: (t) => { S.serial.push(`(${t})`); if (S.serial.length > 6) S.serial.shift(); },
    paint(P) {
      realUs = P ? P[9].pulseUs : 0;
      return false; // the arm is drawn by the model's own clock
    },
    onState(st) {
      if (st.why === 'choose' || st.why === 'upload') {
        const p = SKETCH_PROG[st.open];
        if (p && p !== S.prog) { syncing = true; setProg(p); syncing = false; }
      }
      if (st.powered && (st.why === 'run' || st.why === 'upload')) S.serial = [];
    },
  });
  // The model's sketch buttons, its angle buttons and its deadband are the model's: they unplug the board.
  for (const grp of [progGroup, sub]) grp.addEventListener('click', (e) => { if (!syncing && sk.powered && e.target.closest('button')) sk.unplug('lab'); }, true);

  setProg('write');
  setPower('usb');
  drawScope();
  sk.choose('b6_01_servo_sweep_given');
  void low; void setLabel;
}

// Band 1 (Signal Tower) concept lab: electricity in plain words.
// <div class="lab" data-lab="concept-b1" data-lazy hidden></div>
//
// The Part 5 circuit, built from the same data as its wiring diagram (b1p5):
// pin 8, the 220 ohm resistor, the LED from long leg to short leg, the − rail,
// GND. Gold dots are the current, moving like the rope in Part 1: the same
// speed everywhere, slower when something squeezes, and stopping everywhere
// at once when the loop is broken.
//   1. Break the loop.
//   2. Turn the LED round (it does not break, it just does not light).
//   3. Read a resistor's stripes (and the band names they come from).
// Swapping the resistor for a plain wire burns the LED out, safely, here.
import { THREE, mat, rbox } from './runtime.js';
import * as P from './parts.js';
import { esc, glow, ensureStyle, prepBuild, buildConfig, codeBox, clock } from './concept-b0.js';

const { V } = P;
const BT = 1.3; // breadboard top (as build.js)
const HOUSE = 1.5; // jumper housing height
const UY = 0.95;
const SOCK_Y = UY + 1.3; // top of the Uno's sockets (build.js HDR_H)

// The nine bands of this course, named after the colour code.
const BANDS = ['Bench Ready', 'Signal Tower', 'Mood Lamp', 'Combination Lock', 'Night Guard', 'Simon Says', 'Things That Move', 'Distance and Display', 'Build for Nzemaland'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function prepare(host) {
  return prepBuild(host, 'b1p5');
}
export function config(W) {
  const c = buildConfig(W);
  c.label = '3D model of Band 1 Part 5: pin 8, a 220 ohm resistor, a red LED and the minus rail back to GND. Gold dots show the current. Arrow keys turn it, plus and minus zoom, 0 resets.';
  return c;
}

export const missions = [
  { id: 'break', text: 'With the light on, break the loop. Watch where the dots stop.', hint: 'Under "2 · Change the circuit", take out the wire from the − rail to GND.' },
  { id: 'backwards', text: 'Turn the LED round, then back. Is it broken, or only backwards?', hint: 'Use "Turn the LED round" twice, with pin 8 HIGH and the loop complete.' },
  { id: 'stripes', text: 'Read a mystery resistor’s stripes and choose its value.', hint: 'Under "3 · Read the stripes", press "A mystery resistor". Gold goes on the right.' },
];

export default function lab(stage, ui, host, W) {
  ensureStyle();
  const { scene } = stage;
  scene.add(W.world);
  const L = W.L;
  const byType = (t, pred = () => true) => W.parts.find((p) => p.kind === t && pred(p.data));
  const ledPart = byType('led');
  const resPart = byType('res');
  const pinWire = byType('wire', (d) => d.to === 'socket');
  const legWire = byType('wire', (d) => d.to === 'rail');
  const feed = byType('power');
  const curveOf = (part) => { let c = null; part.group.traverse((m) => { if (m.userData.curve) c = m.userData.curve; }); return c; };
  const hole = (h) => L.hole(h);
  const sock = (s) => W.uno.sockPos(s);

  // ---- state ----
  const S = { pin: 'high', res: 220, ledBack: false, gndOut: false, burnt: false };
  let blinkT = 0;
  const pinHigh = () => S.pin === 'high' || (S.pin === 'blink' && blinkT % 2 < 0.4);

  // ---- the LED: can be turned round, burnt and replaced ----
  let ledModel = ledPart.group.children[0];
  const ledGlow = glow(0xff5a3c, 7);
  scene.add(ledGlow);
  function placeLed() {
    ledPart.group.remove(ledModel);
    ledModel = S.ledBack ? P.led(hole('f6'), hole('f5'), 'red', BT) : P.led(hole('f5'), hole('f6'), 'red', BT);
    P.shadowAll(ledModel);
    ledPart.group.add(ledModel);
    ledGlow.position.copy(ledModel.userData.top).add(V(0, -1.4, 0));
    if (S.burnt) burnLook();
  }
  function burnLook() {
    const l = ledModel.userData.lens;
    l.color.setHex(0x4b2f22);
    l.emissive.setHex(0x000000);
    l.opacity = 0.97;
  }

  // ---- a plain wire in place of the resistor ----
  const j3 = hole('j3'), j5 = hole('j5');
  const barePath = [V(j5.x, BT + HOUSE, j5.z), V(j5.x, BT + 2.7, j5.z), V((j3.x + j5.x) / 2, BT + 3.2, j5.z), V(j3.x, BT + 2.7, j3.z), V(j3.x, BT + HOUSE, j3.z)];
  const bare = P.jumper(barePath, 0xd9a400);
  bare.visible = false;
  W.world.add(bare);
  // the 470 ohm resistor, for the squeeze
  const r470 = P.resistor(j5, j3, 470, BT);
  P.shadowAll(r470);
  r470.visible = false;
  W.world.add(r470);
  const r220 = resPart.group;

  // ---- the path the current takes, as one long line ----
  function buildPath() {
    const pts = [];
    const add = (...ps) => ps.forEach((p) => pts.push(p.clone()));
    const s8 = sock(pinWire.data.socket);
    const sG = sock(feed.data.socket);
    const up = (p, h) => V(p.x, p.y + h, p.z);
    // out of pin 8, along the green wire to h3
    add(V(s8.x, SOCK_Y, s8.z));
    add(...curveOf(pinWire).getPoints(40).reverse());
    const h3 = hole('h3');
    add(h3, V(j3.x, BT + 0.08, j3.z));
    // through the resistor (or the bare wire) from j3 to j5
    if (S.res === 'wire') add(...barePath.slice().reverse());
    else {
      const R = S.res === 220 ? r220 : r470;
      R.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(R);
      add(V(j3.x, box.max.y - 0.1, j3.z), V(j5.x, box.max.y - 0.3, j5.z));
    }
    add(V(j5.x, BT + 0.08, j5.z));
    // along column 5 to the LED's leg in f5, through the LED to f6
    const f5 = hole('f5'), f6 = hole('f6');
    add(V(f5.x, BT + 0.08, f5.z), V(f5.x, BT + 2.6, f5.z), V(f6.x, BT + 2.6, f6.z), V(f6.x, BT + 0.08, f6.z));
    // column 6 to j6, then the blue wire to the − rail
    const lw = curveOf(legWire).getPoints(40);
    const j6 = hole('j6');
    add(V(j6.x, BT + 0.08, j6.z), ...lw);
    const railA = lw[lw.length - 1];
    // along the − rail to the feed wire, and down the feed wire to GND
    const fw = curveOf(feed).getPoints(60).reverse();
    const railB = fw[0];
    add(V(railA.x, BT + 0.08, railA.z), V(railB.x, BT + 0.08, railB.z));
    const gStart = pts.length;
    add(...fw, V(sG.x, SOCK_Y, sG.z));
    const gEnd = pts.length;
    // back into GND, through the chip, and out of pin 8 again
    const ux0 = W.ux0, uz0 = W.uz0;
    add(V(sG.x, UY + 0.25, sG.z), V(ux0 + 18.2, UY + 1.45, uz0 + 14.6), V(s8.x, UY + 0.25, s8.z + 1.2), V(s8.x, SOCK_Y, s8.z));
    void up;
    // lengths
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, len: cum[cum.length - 1], gStart, gEnd };
  }
  let path = buildPath();
  const at = (d, out) => {
    const { pts, cum, len } = path;
    d = ((d % len) + len) % len;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const k = (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    out.lerpVectors(pts[lo], pts[hi], k);
    return lo;
  };

  // ---- the dots ----
  const SPACING = 1.5;
  const N = 140;
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffbe00, toneMapped: false }), N);
  dots.userData.noInk = true;
  dots.raycast = () => {};
  scene.add(dots);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0xca1f3f, toneMapped: false }));
  marker.userData.noInk = true;
  marker.raycast = () => {};
  scene.add(marker);
  let shift = 0;
  const m4 = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  function placeDots() {
    const n = Math.min(N, Math.floor(path.len / SPACING));
    dots.count = n;
    const lift = S.gndOut ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const seg = at(shift + i * (path.len / n), tmp);
      if (lift && seg >= path.gStart && seg < path.gEnd) tmp.y += lift;
      m4.makeTranslation(tmp.x, tmp.y, tmp.z);
      dots.setMatrixAt(i, m4);
    }
    dots.instanceMatrix.needsUpdate = true;
    const seg = at(shift + 0.37 * path.len, tmp);
    if (lift && seg >= path.gStart && seg < path.gEnd) tmp.y += lift;
    marker.position.copy(tmp);
  }

  // ---- what is happening, worked out from the state ----
  function circuit() {
    const closed = !S.gndOut;
    const forward = !S.ledBack;
    const high = pinHigh();
    const flows = high && closed && forward && !S.burnt;
    const speed = !flows ? 0 : S.res === 220 ? 5 : S.res === 470 ? 2.4 : 24;
    return { closed, forward, high, flows, speed };
  }
  let burnClock = 0;
  let wasFlowing = false;
  let sawBackDark = false;
  const smoke = [];
  clock(stage, (dt) => {
    if (S.pin === 'blink') blinkT += dt;
    const c = circuit();
    if (c.speed) { shift += c.speed * dt; placeDots(); }
    // brightness
    const k = !c.flows ? 0 : S.res === 220 ? 1 : S.res === 470 ? 0.55 : 1.8 + Math.sin(burnClock * 40) * 0.3;
    const lens = ledModel.userData.lens;
    if (!S.burnt) { lens.emissiveIntensity = 0.08 + k * 1.4; lens.emissive.setHex(0xe23b2a); }
    ledGlow.material.opacity = Math.min(1, k * 0.9);
    // no resistor: the LED takes far more than it can handle and burns out
    if (c.flows && S.res === 'wire') {
      burnClock += dt;
      if (burnClock > 1.4) burn();
    }
    for (const p of smoke) {
      p.userData.t += dt;
      p.position.y += dt * 1.6;
      p.position.x += dt * 0.4 * Math.sin(p.userData.t * 3 + p.userData.ph);
      const s = 0.6 + p.userData.t * 1.1;
      p.scale.setScalar(s);
      p.material.opacity = Math.max(0, 0.55 - p.userData.t * 0.2);
    }
    for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].userData.t > 3) { scene.remove(smoke[i]); smoke.splice(i, 1); }
    if (S.pin === 'blink') readout();
    wasFlowing = c.flows;
  });
  function burn() {
    S.burnt = true;
    burnClock = 0;
    burnLook();
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8a8590, transparent: true, opacity: 0.5, depthWrite: false }));
      p.userData.noInk = true;
      p.raycast = () => {};
      p.userData.t = -i * 0.15;
      p.userData.ph = i;
      p.position.copy(ledModel.userData.top).add(V((Math.random() - 0.5) * 0.8, -0.6, (Math.random() - 0.5) * 0.8));
      scene.add(p);
      smoke.push(p);
    }
    ui.info('The LED burnt out', '<p>With nothing to slow it down, the LED took far more current than it can handle, got hot and burnt out in seconds. On a real board you may see it flash brightly, go dark, and smell it. It will never light again.</p><p><b>Never connect an LED without a resistor. Not even for a quick test.</b></p><p class="lab-tip">Put a resistor back, then press <b>Fit a new LED</b>.</p>');
    newLedBtn.hidden = false;
    readout();
  }

  // ---- callouts ----
  const card = (part, title, text, dx, dy, quiet) => stage.callout(part.group, { title, text, at: part.focus ? part.group.worldToLocal(part.focus.clone()) .toArray() : [0, 0, 0], dx, dy, quiet, onClick: () => explain(part) });
  card(ledPart, 'LED', 'Long leg towards the pin, short leg towards ground.', 70, -110);
  card(resPart, '220 Ω resistor', 'Red, red, brown, gold. Slows the current.', -60, -120);
  card(pinWire, 'From pin 8', 'Where the current leaves the board.', -90, 70);
  card(feed, 'To GND', 'This wire closes the loop.', 80, 90);
  card(legWire, 'To the − rail', 'From the short leg’s column.', 90, -60, true);
  const markCard = stage.callout(marker, { title: 'The marker', text: 'Like the tape on the rope. Watch it go round.', dx: -80, dy: -80, quiet: true });
  void markCard;
  [ledPart, resPart, pinWire, legWire, feed].forEach((p) => stage.clickable(p.group, () => explain(p)));
  stage.clickable(r470, () => explain(resPart));
  stage.clickable(bare, () => ui.info('A plain wire', '<p>It joins <code>j5</code> to <code>j3</code> with nothing to slow the current down. This is the one to never do on your real board.</p>'));

  function explain(part) {
    if (part === ledPart) ui.info('The LED', `<p>A small light that only works one way round. The long leg is the side electricity goes in: it faces the pin. The short leg, next to the flat part of the rim, is where it comes out: it faces ground.</p><p class="lab-tip">${S.ledBack ? 'Right now it is in backwards: long leg in <code>f6</code>, short leg in <code>f5</code>.' : 'Long leg in <code>f5</code>, short leg in <code>f6</code>.'}</p>`);
    else if (part === resPart) { ui.info('The resistor', `<p>A resistor slows the current down. It has no direction, so it goes in either way round. This one is in <code>j5</code> and <code>j3</code>.</p><p class="lab-tip">Read its stripes under <b>3 · Read the stripes</b>.</p>`); showResistor(typeof S.res === 'number' ? S.res : 220, false); }
    else if (part === pinWire) ui.info('The wire from pin 8', '<p>From <code>h3</code> to digital pin 8. When the sketch says <code>HIGH</code>, pin 8 pushes at 5 volts and the current leaves the board here.</p>');
    else if (part === legWire) ui.info('The wire to the − rail', '<p>From <code>j6</code>, in the same column as the LED’s short leg in <code>f6</code>, to the − rail along the top edge.</p>');
    else if (part === feed) ui.info('The wire to GND', `<p>From the same − rail to a GND pin. There is more than one GND pin and any of them works. This wire is what closes the loop.</p>${S.gndOut ? '<p class="lab-tip">It is out at the moment, so the loop is broken.</p>' : ''}`);
  }

  // ---- side panel ----
  ui.info('One light circuit', '<p>This is Band 1 Part 5. Pin 8 pushes, the resistor slows it, the LED lights, and the current goes back to GND along the − rail. It is a complete loop.</p><p class="lab-tip">The gold dots are the current, like the rope in Part 1. The red one is the marker. Watch it go round and come back.</p>');
  const gPin = ui.group('1 · Pin 8');
  const pinBtns = [['high', 'HIGH (5 volts)'], ['low', 'LOW (0 volts)'], ['blink', 'Run b1_01']].map(([v, t]) => {
    const b = ui.button(t, () => setPin(v), { group: gPin });
    b.dataset.v = v;
    return b;
  });
  const sketchWrap = document.createElement('div');
  gPin.appendChild(sketchWrap);
  const code = codeBox(sketchWrap, 'b1_01_one_led_given.ino', [{ n: 26, t: '  digitalWrite(lampPin, HIGH);' }, { n: 27, t: '  delay(400);' }, { n: 28, t: '  digitalWrite(lampPin, LOW);' }, { n: 29, t: '  delay(1600);' }]);
  sketchWrap.hidden = true;
  const gChange = ui.group('2 · Change the circuit');
  const gndBtn = ui.button('Take out the GND wire', () => setGnd(!S.gndOut), { group: gChange, pressed: false });
  const backBtn = ui.button('Turn the LED round', () => setBack(!S.ledBack), { group: gChange, pressed: false });
  const resBtns = [[220, '220 Ω'], [470, '470 Ω (squeeze)'], ['wire', 'A plain wire (no resistor)']].map(([v, t]) => {
    const b = ui.button(t, () => setRes(v), { group: gChange });
    b.dataset.v = String(v);
    return b;
  });
  const newLedBtn = ui.button('Fit a new LED', () => { S.burnt = false; placeLed(); newLedBtn.hidden = true; ui.info('A new LED', '<p>Fresh LED, long leg in <code>f5</code>. Check the whole circuit before you power it again: is there a resistor in <code>j5</code> to <code>j3</code>?</p>'); readout(); }, { group: gChange });
  newLedBtn.hidden = true;
  const meter = document.createElement('dl');
  meter.className = 'cl-meter';
  meter.setAttribute('aria-live', 'polite');
  gChange.appendChild(meter);

  function readout() {
    const c = circuit();
    const cur = S.burnt ? 'none: the LED is burnt out, so the loop is broken inside it'
      : !c.high ? 'none, anywhere: pin 8 is not pushing'
      : !c.closed ? 'none, anywhere: the loop is broken'
      : !c.forward ? 'none, anywhere: the LED only lets it through one way'
      : S.res === 220 ? 'about 15 thousandths of an amp, the same at every point'
      : S.res === 470 ? 'less than with 220 Ω, the same at every point. A little dimmer'
      : 'far more than the LED can handle';
    meter.innerHTML = `<dt>Pin 8</dt><dd>${c.high ? 'HIGH, 5 volts' : 'LOW, 0 volts'}</dd><dt>Loop</dt><dd>${c.closed ? 'complete' : 'broken: GND wire out'}</dd><dt>LED</dt><dd>${S.burnt ? 'burnt out' : c.forward ? 'long leg towards the pin' : 'backwards'}</dd><dt>Current</dt><dd>${cur}</dd>`;
  }
  function setPin(v) {
    S.pin = v;
    blinkT = 0;
    ui.toggle(pinBtns, pinBtns.find((b) => b.dataset.v === v));
    sketchWrap.hidden = v !== 'blink';
    if (v === 'blink') ui.info('b1_01_one_led_given.ino', '<p>On for 400 milliseconds, off for 1600, over and over. Watch the dots: they all start together and all stop together.</p>');
    else if (v === 'low') ui.info('Pin 8 is LOW', '<p>The pin drops to 0 volts. Nothing pushes, so nothing moves anywhere in the loop.</p>');
    readout();
  }
  function setGnd(out) {
    const was = circuit();
    S.gndOut = out;
    feed.group.position.y = out ? 3 : 0;
    gndBtn.setAttribute('aria-pressed', String(out));
    gndBtn.textContent = out ? 'Put the GND wire back' : 'Take out the GND wire';
    placeDots();
    if (out) {
      ui.info('The loop is broken', `<p>${was.flows ? 'Every dot stopped at the same moment, wherever it was, not only the ones near the gap. ' : ''}There is nowhere for the current to go, so nothing moves anywhere in it. This is the rope with its knot untied.</p><p class="lab-tip">One missing wire here stops all the lights at once, and everything else looks perfect.</p>`);
      if (was.flows) ui.complete('break');
    } else ui.info('The loop is complete again', '<p>Put the wire back and everything moves again, all at the same moment.</p>');
    readout();
  }
  function setBack(back) {
    const c0 = circuit();
    S.ledBack = back;
    placeLed();
    backBtn.setAttribute('aria-pressed', String(back));
    backBtn.textContent = back ? 'Turn the LED back' : 'Turn the LED round';
    const c = circuit();
    if (back) {
      if (c0.high && c0.closed && !S.burnt) sawBackDark = true;
      ui.info('The LED is in backwards', '<p>Long leg in <code>f6</code>, towards ground. Nothing happens at all. It does not break, it just does not light, and no current flows anywhere in the loop.</p><p class="lab-tip">If a light does not come on, turn the LED round before you do anything else.</p>');
    } else {
      if (sawBackDark && c.high && c.closed && !S.burnt) {
        ui.complete('backwards');
        ui.info('Lit again', '<p>Not broken: only backwards. An LED only works one way round. <b>Long leg goes to the pin, short leg goes to ground.</b></p>');
      } else ui.info('The LED is the right way round', '<p>Long leg in <code>f5</code>, towards the pin.</p>');
    }
    readout();
  }
  function setRes(v) {
    S.res = v;
    burnClock = 0;
    r220.visible = v === 220;
    r470.visible = v === 470;
    bare.visible = v === 'wire';
    ui.toggle(resBtns, resBtns.find((b) => b.dataset.v === String(v)));
    path = buildPath();
    placeDots();
    if (v === 470) ui.info('A 470 Ω resistor', '<p>It squeezes harder, like a tighter hand on the rope. Every dot slows down at the same moment, not only the ones near the resistor, and the light is a little dimmer. Anything from 200 to about 470 ohms works fine.</p>');
    else if (v === 'wire') ui.info('No resistor: a plain wire', '<p>Pin 8 now goes straight to the LED with nothing to slow the current down. Watch the LED. <b>This is a model: do not try it on your board.</b></p>');
    else ui.info('The 220 Ω resistor', '<p>The board supplies 5 volts. An LED is comfortable with about 15 thousandths of an amp, and 220 ohms gives roughly that.</p>');
    readout();
  }

  // ---- 3 · Read the stripes ----
  const gStr = ui.group('3 · Read the stripes');
  const strWrap = document.createElement('div');
  strWrap.className = 'cl-stripes';
  gStr.appendChild(strWrap);
  let shown = { value: 220, flipped: false, mystery: false, answered: false, sel: -1 };
  function stripeInfo(i) {
    const [d1, d2, z] = P.bands(shown.value);
    const digits = [d1, d2, z];
    if (i === 3) return '<b>Gold</b> is not part of the number. It sits apart, with a wider gap. Turn the resistor so it is on the right, then read from the left.';
    const d = digits[i];
    const col = P.BAND_NAMES[d];
    const band = d <= 8 ? ` Band ${d} of this course is ${col}: <b>${BANDS[d]}</b>${d === 1 ? ', where you are now' : ''}.` : ' The course stops at grey, so white has no band.';
    if (i < 2) return `<b>${cap(col)}</b> is ${d}. ${i === 0 ? 'The first number.' : 'The second number.'}${band}`;
    return `<b>${cap(col)}</b> is ${d}, and in third place it means: add ${d === 0 ? 'no zeros' : d === 1 ? 'one zero' : d + ' zeros'}.${band}`;
  }
  function drawStripes() {
    const [d1, d2, z] = P.bands(shown.value);
    const cols = [P.BAND_HEX[d1], P.BAND_HEX[d2], P.BAND_HEX[z], P.GOLD];
    const xs = [70, 100, 130, 205];
    const order = shown.flipped ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const X = (i) => (shown.flipped ? 300 - xs[i] : xs[i]);
    const names = cols.map((c, i) => (i === 3 ? 'gold' : P.BAND_NAMES[[d1, d2, z][i]]));
    strWrap.innerHTML = `<svg viewBox="0 0 300 80" role="group" aria-label="${shown.mystery ? 'A mystery resistor' : 'The resistor in this circuit'}. Stripes from left to right: ${order.map((i) => names[i]).join(', ')}.">
      <line x1="0" y1="40" x2="300" y2="40" stroke="#9aa0a6" stroke-width="4"/>
      <rect x="45" y="18" width="210" height="44" rx="20" fill="#dcc596" stroke="#24182e" stroke-opacity=".5"/>
      ${[0, 1, 2, 3].map((i) => `<g role="button" tabindex="0" data-i="${i}" aria-label="Stripe: ${names[i]}" class="${shown.sel === i ? 'sel' : ''}"><rect x="${X(i) - 9}" y="${i === 0 || i === 3 ? 16 : 19}" width="18" height="${i === 0 || i === 3 ? 48 : 42}" rx="3" fill="${cols[i]}" stroke="#24182e" stroke-opacity=".35"/></g>`).join('')}
    </svg>
    <div class="cl-read" aria-live="polite">${shown.sel >= 0 ? stripeInfo(shown.sel) : shown.flipped ? 'The gold stripe is on the <b>left</b>. If you read gold first, you are holding it the wrong way round. Turn it end for end.' : 'Click a stripe, or Tab to it and press Enter. Read from the left, with gold on the right.'}</div>
    <div class="cl-chips quiz"></div>`;
    strWrap.querySelectorAll('[role=button]').forEach((g) => {
      const pick = () => { shown.sel = +g.dataset.i; drawStripes(); strWrap.querySelector(`[data-i="${shown.sel}"]`)?.focus(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    const quiz = strWrap.querySelector('.quiz');
    if (shown.mystery && !shown.answered) {
      const v = shown.value;
      const [a, b, zz] = P.bands(v);
      const wrong1 = (a * 10 + b) * Math.pow(10, Math.max(0, zz - 1));
      const wrong2 = (a * 10 + b) * Math.pow(10, zz + 1);
      const wrong3 = (b * 10 + a) * Math.pow(10, zz);
      const opts = [...new Set([v, wrong1 === v ? wrong3 : wrong1, wrong2])].sort((x, y) => x - y);
      for (const o of opts) {
        const btn = ui.button(`${o} Ω`, () => answer(o), { group: quiz });
        btn.setAttribute('aria-label', `${o} ohms`);
      }
    }
  }
  function words(v) {
    const [a, b, z] = P.bands(v);
    return `${P.BAND_NAMES[a]} ${a}, ${P.BAND_NAMES[b]} ${b}, then ${P.BAND_NAMES[z]} ${z}: ${a}${b} with ${z === 0 ? 'no zeros' : z === 1 ? 'one zero' : z + ' zeros'} added, so ${v} Ω`;
  }
  function answer(o) {
    if (o === shown.value) {
      shown.answered = true;
      ui.complete('stripes');
      ui.info(`Right: ${shown.value} Ω`, `<p>${cap(words(shown.value))}.</p><p class="lab-tip">From now on, find resistors by reading them rather than by guessing from the size, because all resistors look almost the same.</p>`);
    } else {
      ui.info(`Not ${o} Ω`, `<p>Turn it so gold is on the right first. Then the first two stripes are the two numbers, and the third says how many zeros to add.</p>${shown.flipped ? '<p class="lab-tip">This one is held the wrong way round: gold is on the left.</p>' : ''}`);
    }
    drawStripes();
  }
  function showResistor(v, mystery) {
    shown = { value: v, flipped: mystery && Math.random() < 0.5, mystery, answered: false, sel: -1 };
    drawStripes();
    if (!mystery) return;
    ui.info('A mystery resistor', '<p>What is its value? Put the gold stripe on the right, read the colours from the left, then choose below the drawing.</p>');
  }
  const KIT = [100, 330, 470, 1000, 2200, 10000];
  let lastMystery = 0;
  ui.button('This circuit’s resistor', () => { showResistor(220, false); ui.info('The resistor in this circuit', `<p>${cap(words(220))}. On most 220 ohm resistors you will see red, red, brown, then a gap, then gold.</p>`); }, { group: gStr });
  ui.button('A mystery resistor', () => {
    let v;
    do v = KIT[Math.floor(Math.random() * KIT.length)]; while (v === lastMystery);
    lastMystery = v;
    showResistor(v, true);
  }, { group: gStr, primary: true });
  ui.button('Turn it end for end', () => { shown.flipped = !shown.flipped; shown.sel = -1; drawStripes(); }, { group: gStr });

  // ---- start ----
  placeLed();
  setPin('high');
  ui.toggle(resBtns, resBtns[0]);
  showResistor(220, false);
  placeDots();
  readout();
  clock(stage, () => { if (S.pin === 'blink') code.mark(blinkT % 2 < 0.4 ? 27 : 29, 'run'); });
  stage.invalidate();
  void rbox; void mat; void esc; void wasFlowing;
  host.dispatchEvent(new CustomEvent('lab-ready', { bubbles: true, detail: { lab: 'concept-b1' } }));
}

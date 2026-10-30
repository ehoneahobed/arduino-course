// Band 7 concept lab: an ultrasonic ping going out and echoing back from
// something you move, the echo time turned into centimetres exactly as the
// band does it (microseconds / 29 / 2, in whole numbers), and the LCD
// showing the answer three ways: b7_04_buggy_flicker (clear() every round),
// b7_04 with clear() taken out (leftover characters), and b7_05 (only write
// when it changed, always exactly 16 characters).
// <div class="lab" data-lab="concept-b7" data-lazy hidden></div>
import { THREE, mat, rbox, decal, label } from './runtime.js';
import * as P from './parts.js';
import { livePlate, reducedMotion, esc } from './concept-b6.js';

const { V } = P;
const SANS = 'Rubik, "Segoe UI", Arial, sans-serif';
const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';
const CM = 0.45;          // world units per centimetre along the track
const MAX_CM = 200;
const TIMEOUT = 25000;    // pulseIn(echoPin, HIGH, 25000)
const US_PER_CM = 29.1;   // the real air, for the simulated echo; the sketch divides by 29

// wordFor() from b7_05: every one exactly 16 characters
const wordFor = (cm) => (cm < 10 ? 'STOP            ' : cm < 30 ? 'Nearly there    ' : cm < 100 ? 'Keep coming     ' : 'Clear           ');

export const missions = [
  { id: 'ruler', text: 'Check the sensor against the ruler at three places at least 10 cm apart.', hint: 'Move the book with the slider (or click the ruler) and let a ping finish at each place. Compare the answer with the ruler.' },
  { id: 'nothing', text: 'Make the sensor hear nothing. What number does it give?', hint: 'Try the towel, the book at an angle, open space, or the book very close.' },
  { id: 'screen', text: 'Watch b7_04 flicker, catch a leftover character with clear() taken out, then fix both with b7_05.', hint: 'Under "The screen", try each sketch in turn. With clear() taken out, move the book from over 100 cm to under 100 cm.' },
];

const AZ = 0.3; // look from a little to the left, so the sensor's eyes show
export const config = {
  camera: [28 - 170 * Math.cos(0.8) * Math.sin(AZ), 4 + 170 * Math.sin(0.8), -2 + 170 * Math.cos(0.8) * Math.cos(AZ)],
  target: [28, 4, -2],
  fit: [142, 64],
  pan: true, minZoom: 0.7, maxZoom: 7, tourZoom: 2.6,
  shadowSize: 70, groundSize: 110, sun: [10, 90, 40], maxPolar: Math.PI * 0.45,
  label: '3D model of a distance sensor, a book on a ruler and a screen. Arrow keys turn it, plus and minus zoom, 0 resets. The buttons beside it move the book and change the sketch.',
};

export default function lab(stage, ui) {
  const { scene } = stage;
  const world = new THREE.Group();
  scene.add(world);
  const calm = reducedMotion();

  // --- the sensor, eyes facing along the ruler ---
  const son = P.moduleModel('HC-SR04', ['VCC', 'Trig', 'Echo', 'GND']);
  const SS = 1.5; // drawn larger than life, so its eyes can be seen
  son.group.scale.setScalar(SS);
  son.group.rotation.y = Math.PI / 2;
  world.add(son.group);
  const EYE_Y = (6.4 / 2 + 1.4) * SS;
  const X0 = 2.6 * SS;                   // the front of the eyes: zero on the ruler
  const TX = V(X0, EYE_Y, -3.9 * SS);    // transmitter (Trig side)
  const RXp = V(X0, EYE_Y, 3.9 * SS);    // receiver
  const xAt = (cm) => X0 + cm * CM;

  // --- the ruler along the table ---
  const RL = MAX_CM * CM;
  const ruler = decal(RL + 2, 4, (c, W, H) => {
    const s = W / (RL + 2);
    c.fillStyle = '#f6d65a';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#24182E';
    c.fillStyle = '#24182E';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.font = `700 ${s * 1.3}px ${SANS}`;
    for (let cm = 0; cm <= MAX_CM; cm += 1) {
      const x = s * (1 + cm * CM);
      const len = cm % 10 === 0 ? H * 0.45 : cm % 5 === 0 ? H * 0.3 : H * 0.16;
      c.lineWidth = cm % 10 === 0 ? s * 0.12 : s * 0.06;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, len); c.stroke();
      if (cm % 20 === 0) c.fillText(String(cm), x, H * 0.5);
    }
    c.textAlign = 'right';
    c.font = `700 ${s * 1.0}px ${SANS}`;
    c.fillText('cm', W - s * 0.4, H * 0.55);
  }, { px: 256, maxPx: 4096 });
  ruler.rotation.x = -Math.PI / 2;
  ruler.position.set(X0 + RL / 2 - 1 + 1, 0.03, 6.2);
  ruler.position.x = X0 - 1 + (RL + 2) / 2;
  world.add(ruler);
  stage.clickable(ruler, (o, e, hit) => {
    if (!hit) return;
    const cm = Math.round((hit.point.x - X0) / CM);
    setDist(Math.max(1, Math.min(MAX_CM, cm)));
  });

  // --- the things it can be pointed at ---
  const book = new THREE.Group();
  const cover = rbox(2.4, 13, 9, 0x5a4470, 0.15);
  cover.position.y = 6.5;
  const pages = new THREE.Mesh(new THREE.BoxGeometry(2.0, 12.4, 8.6), mat(0xf4efe2));
  pages.position.set(0.3, 6.5, 0);
  const title = decal(6, 2, (c, W, H) => { c.fillStyle = '#FFBE00'; c.font = `700 ${H * 0.5}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BOOK', W / 2, H / 2); }, { px: 128 });
  title.rotation.y = -Math.PI / 2;
  title.position.set(-1.22, 9, 0);
  book.add(cover, pages, title);
  P.shadowAll(book);
  const towel = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = rbox(4.2, 2.4, 9, [0xe9a6b8, 0xe39aae, 0xeeb2c2][i], 1.0, { roughness: 1 });
    f.position.set(0, 1.2 + i * 2.2, 0);
    towel.add(f);
  }
  P.shadowAll(towel);
  world.add(book, towel);
  const target = new THREE.Object3D(); // where the thing stands, for callouts
  world.add(target);

  // --- the ping: rings spreading out on the table, slowed right down ---
  const ringGeo = new THREE.RingGeometry(0.93, 1, 40, 1, -Math.PI / 5, (2 * Math.PI) / 5);
  const mkRings = (color) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.userData.noInk = true;
      m.userData.k = i;
      g.add(m);
    }
    g.visible = false;
    world.add(g);
    return g;
  };
  const outR = mkRings(0xffbe00);
  const backR = mkRings(0xca1f3f);
  const pingDot = new THREE.Object3D();
  world.add(pingDot);

  // --- the screen (the I2C kind), standing so it faces you ---
  const lcdM = P.moduleModel('LCD1602, I2C', ['GND', 'VCC', 'SDA', 'SCL']);
  const LS = 2.0;
  lcdM.group.scale.setScalar(LS);
  lcdM.group.rotation.set(0.9, -AZ, 0, 'YXZ');
  lcdM.group.position.set(-26, 0, 2);
  world.add(lcdM.group);
  const oldScreen = lcdM.group.children.find((m) => m.geometry?.parameters?.width === 13);
  const lcd = livePlate(13, 3.6, 60);
  lcd.mesh.rotation.x = -Math.PI / 2;
  if (oldScreen) { lcd.mesh.position.copy(oldScreen.position); lcd.mesh.position.y += 0.01; oldScreen.visible = false; }
  lcdM.group.add(lcd.mesh);

  // --- the echo pin, on a screen behind the ruler ---
  const scW = 60, scH = 13;
  const scope = livePlate(scW, scH, 22);
  const scG = new THREE.Group();
  const frame = rbox(scW + 1.4, scH + 1.4, 0.8, 0x24182e, 0.3);
  scope.mesh.position.z = 0.42;
  scG.add(frame, scope.mesh);
  scG.position.set(48, 9, -20);
  scG.rotation.set(-0.55, -AZ, 0, 'YXZ');
  world.add(scG);
  P.shadowAll(frame);
  const zeroTag = label('0 cm', { scale: 1.6 });
  zeroTag.position.set(X0, 0.2, 9.6);
  world.add(zeroTag);

  // ---------- state ----------
  const S = {
    thing: 'book',     // book | angled | towel | nothing
    cm: 60,
    pinging: true,
    ping: null,        // the slow-motion ping on screen
    nextPing: 0.4,
    last: null,        // the last finished slow ping: {us, cm, echo, why}
    screen: 'flicker', // flicker | leftover | fixed
    buf: [Array(16).fill(' '), Array(16).fill(' ')],
    wrote: [Array(16).fill(-1), Array(16).fill(-1)],
    round: 0, cur: [0, 0], blankUntil: 0, loopAcc: 0, lastShown: null,
    writes: [], blanks: [],
    t: 0,
    rulerSeen: [], flickerTime: 0, sawLeftover: false, fixedVals: new Set(),
  };

  // What the sensor really hears for the thing in front of it now.
  function hear() {
    if (S.thing === 'nothing') return { echo: false, why: 'Nothing is there to send the click back.' };
    if (S.thing === 'towel') return { echo: false, why: 'Soft things swallow the click.' };
    if (S.thing === 'angled') return { echo: false, why: 'The click bounced off sideways and never came home.' };
    if (S.cm < 2) return { echo: false, why: 'Too close: the echo came back before the sensor finished shouting.' };
    return { echo: true };
  }
  // pulseIn's answer, in microseconds, as the board would get it this moment
  function measure() {
    const h = hear();
    if (!h.echo) return 0;
    const us = Math.round(2 * S.cm * US_PER_CM + (Math.random() - 0.5) * 40);
    return us > TIMEOUT ? 0 : us;
  }
  const toCm = (us) => Math.trunc(Math.trunc(us / 29) / 2); // microseconds / 29 / 2

  // ---------- the LCD, character by character ----------
  let cursorPos = [0, 0];
  const lcdOps = {
    clear() { for (const r of S.buf) r.fill(' '); S.blankUntil = S.t + 0.02; S.blanks.push(S.t); cursorPos = [0, 0]; },
    setCursor(c, r) { cursorPos = [c, r]; },
    print(str) {
      str = String(str);
      for (const ch of str) {
        const [c, r] = cursorPos;
        if (c < 16) { S.buf[r][c] = ch; S.wrote[r][c] = S.round; }
        cursorPos = [c + 1, r];
      }
    },
  };
  function sketchRound() {
    S.round++;
    let wroteAny = false;
    const before = S.round;
    if (S.screen === 'fixed') {
      let us = measure();
      let cm = us === 0 ? 999 : toCm(us);           // readDistance in b7_05
      if (cm !== S.lastShown) {
        S.lastShown = cm;
        lcdOps.setCursor(0, 0); lcdOps.print(wordFor(cm));
        lcdOps.setCursor(0, 1);
        if (cm >= 999) lcdOps.print('--- cm          ');
        else { if (cm < 100) lcdOps.print(' '); if (cm < 10) lcdOps.print(' '); lcdOps.print(cm); lcdOps.print(' cm          '); }
        wroteAny = true;
        S.fixedVals.add(cm);
      }
    } else {
      const cm = toCm(measure());                   // b7_04: 0 stays 0
      if (S.screen === 'flicker') lcdOps.clear();
      lcdOps.setCursor(0, 0); lcdOps.print('Distance');
      lcdOps.setCursor(0, 1); lcdOps.print(cm); lcdOps.print(' cm');
      wroteAny = true;
    }
    if (wroteAny) S.writes.push(S.t);
    void before;
  }
  // cells on the bottom row holding something this round did not write
  const leftovers = () => S.buf[1].map((ch, i) => ch !== ' ' && S.wrote[1][i] !== S.round && S.screen === 'leftover');

  let lcdKey = '';
  function drawLcd() {
    const blank = S.t < S.blankUntil && !calm;
    const key = blank + S.buf[0].join('') + S.buf[1].join('');
    if (key === lcdKey) return;
    lcdKey = key;
    lcd.draw((c, W, H) => {
      c.fillStyle = '#7fbf3f';
      c.fillRect(0, 0, W, H);
      const cw = W / 16.6, ch = H / 2.3;
      for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) {
        const x = W * 0.018 + i * cw, y = H * 0.08 + r * ch * 1.06;
        c.fillStyle = 'rgba(31,58,18,0.08)';
        c.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        if (blank) continue;
        c.fillStyle = '#1f3a12';
        c.font = `700 ${ch * 0.82}px ${MONO}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(S.buf[r][i], x + cw / 2, y + ch / 2 + 1);
      }
    });
  }

  // ---------- the echo screen ----------
  let scopeKey = '';
  function drawScope() {
    const p = S.ping;
    const us = p ? Math.round(p.liveUs) : S.last ? S.last.us : 0;
    const key = `${us}|${p ? p.phase : ''}|${S.last ? S.last.us : ''}`;
    if (key === scopeKey) return;
    scopeKey = key;
    scope.draw((c, W, H) => {
      const u = W / scW;
      c.fillStyle = '#1b1222';
      c.fillRect(0, 0, W, H);
      const x0 = u * 9, x1 = W - u * 2;
      const tx = (t) => x0 + ((x1 - x0) * t) / TIMEOUT;
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 1;
      c.font = `600 ${u * 1.0}px ${MONO}`;
      c.fillStyle = '#d9cfe0';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (let ms = 0; ms <= 25; ms += 5) {
        const x = tx(ms * 1000);
        c.beginPath(); c.moveTo(x, u * 2); c.lineTo(x, H - u * 2.2); c.stroke();
        c.fillText(`${ms} ms`, Math.min(x, W - u * 2.4), H - u * 1.9);
      }
      c.textAlign = 'left';
      c.font = `700 ${u * 1.15}px ${SANS}`;
      c.fillStyle = '#FFBE00';
      c.fillText('Trig, pin 10', u * 0.8, u * 2.6);
      c.fillStyle = '#ff8fa3';
      c.fillText('Echo, pin 11', u * 0.8, u * 6.8);
      c.lineWidth = u * 0.22;
      // Trig: 10 microseconds HIGH (far too short to see at this scale, so drawn as a tick)
      c.strokeStyle = '#FFBE00';
      c.beginPath(); c.moveTo(x0, u * 4.8); c.lineTo(tx(0), u * 4.8); c.lineTo(tx(0), u * 2.7); c.lineTo(tx(0) + u * 0.35, u * 2.7); c.lineTo(tx(0) + u * 0.35, u * 4.8); c.lineTo(x1, u * 4.8); c.stroke();
      // Echo: HIGH from when the click leaves until it comes back
      const hi = u * 6.9, lo = u * 9.2;
      c.strokeStyle = '#ff8fa3';
      c.beginPath(); c.moveTo(x0, lo);
      const shown = p ? p.liveUs : S.last ? (S.last.us || TIMEOUT) : 0;
      const ended = !p || p.phase === 'done';
      if (shown > 0) {
        c.lineTo(tx(0), lo); c.lineTo(tx(0), hi); c.lineTo(tx(Math.min(TIMEOUT, shown)), hi);
        if (ended && (!S.last || S.last.us > 0)) { c.lineTo(tx(shown), lo); c.lineTo(x1, lo); }
      } else c.lineTo(x1, lo);
      c.stroke();
      c.font = `700 ${u * 1.15}px ${MONO}`;
      c.fillStyle = '#ffffff';
      let msg;
      if (p) msg = p.echo || p.phase === 'out' ? `Echo HIGH so far: ${Math.round(p.liveUs)} µs` : `No echo yet: ${Math.round(p.liveUs)} µs`;
      else if (S.last) msg = S.last.us ? `Echo was HIGH for ${S.last.us} µs` : 'Nothing came back: pulseIn gave up at 25000 µs and said 0';
      else msg = '';
      c.fillText(msg, x0, u * 10.1);
    });
  }

  // ---------- the slow-motion ping ----------
  function startPing() {
    const h = hear();
    const d = S.thing === 'nothing' ? MAX_CM + 10 : S.cm;
    const us = h.echo ? measure() : 0;
    S.ping = { t: 0, phase: 'out', echo: h.echo, why: h.why, d, us, liveUs: 0, tOut: 0.35 + (d / MAX_CM) * 1.7 };
  }
  function showRings(g, centre, r, dir, alpha) {
    g.visible = r > 0.2;
    g.position.copy(centre);
    g.rotation.y = dir;
    g.children.forEach((m) => {
      const rr = Math.max(0.05, r - m.userData.k * 1.3);
      m.scale.setScalar(rr);
      m.material.opacity = alpha * (rr > 0.3 ? 0.9 - m.userData.k * 0.2 : 0);
    });
  }
  function stepPing(dt) {
    const p = S.ping;
    if (!p) return;
    p.t += dt;
    const face = xAt(p.d) - (S.thing === 'towel' ? 2.1 : 1.2);
    const outDist = face - TX.x;
    const usPerSec = (2 * p.d * US_PER_CM) / (2 * p.tOut); // slow-motion clock
    if (p.phase === 'out') {
      const k = Math.min(1, p.t / p.tOut);
      showRings(outR, TX, outDist * k, 0, 1);
      backR.visible = false;
      p.liveUs = Math.min(TIMEOUT, p.t * usPerSec);
      pingDot.position.set(TX.x + outDist * k, EYE_Y, 0);
      if (k >= 1) { p.phase = p.echo ? 'back' : S.thing === 'angled' ? 'away' : 'lost'; p.t = 0; }
    } else if (p.phase === 'back') {
      const k = Math.min(1, p.t / p.tOut);
      showRings(outR, TX, outDist, 0, 1 - k);
      showRings(backR, V(face, EYE_Y, 0), (face - RXp.x) * k, Math.PI, 1);
      p.liveUs = (p.tOut + p.t) * usPerSec;
      pingDot.position.set(face - (face - RXp.x) * k, EYE_Y, 0);
      if (k >= 1) finishPing();
    } else {
      // no echo: the click is swallowed, goes on, or flies off sideways, and
      // pulseIn waits until its 25000 microsecond limit
      const k = Math.min(1, p.t / 1.2);
      if (p.phase === 'away') showRings(backR, V(face, EYE_Y, 0), 12 * k, -Math.PI / 2 + 0.5, 1 - k);
      else backR.visible = false;
      showRings(outR, TX, outDist + (p.phase === 'lost' && S.thing === 'nothing' ? 20 * k : 0), 0, 1 - k);
      p.liveUs = p.tOut * usPerSec + k * (TIMEOUT - p.tOut * usPerSec);
      if (k >= 1) finishPing();
    }
  }
  function finishPing() {
    const p = S.ping;
    const cm = toCm(p.us);
    S.last = { us: p.us, cm, echo: p.echo, why: p.why, d: p.d, thing: S.thing };
    p.phase = 'done';
    S.ping = null;
    outR.visible = backR.visible = false;
    S.nextPing = 0.9;
    // missions
    if (p.echo && S.thing === 'book' && Math.abs(cm - p.d) <= 2) {
      if (!S.rulerSeen.some((d) => Math.abs(d - p.d) < 10)) S.rulerSeen.push(p.d);
      if (S.rulerSeen.length >= 3) ui.complete('ruler');
    }
    if (!p.echo && p.us === 0) ui.complete('nothing');
    lastInfo = '';
  }

  // ---------- callouts ----------
  stage.callout(son.group, { title: 'HC-SR04', text: 'Trig makes the click. Echo stays HIGH until it hears it come back.', at: [0, 7, 0], dx: 10, dy: -170 });
  stage.callout(pingDot, { title: 'The ping', text: 'Shown slowed down. The real one takes a few thousandths of a second.', dx: 90, dy: 110 });
  stage.callout(target, { title: 'What it bounces off', text: 'Flat, hard things send the click back. Move it along the ruler.', at: [0, 11, 0], dx: 120, dy: -150 });
  stage.callout(lcd.mesh, { title: 'The screen', text: '16 characters by 2 rows. It never wipes itself.', at: [0, 0, -1.6], dx: 30, dy: -170 });
  stage.callout(scope.mesh, { title: 'The Echo pin', text: 'pulseIn times how long this stays HIGH, in microseconds.', at: [-scW / 2 + 4, 2, 0], dx: -60, dy: -40, quiet: true });
  stage.callout(ruler, { title: 'The ruler', text: 'Zero is at the front of the eyes. Click it to move the book there.', at: [-RL / 2 + 10, 0, 1.8], dx: 0, dy: 70, quiet: true });

  // ---------- the side panel ----------
  const gThing = ui.group('In front of the sensor');
  const things = [['book', 'Book, flat on'], ['angled', 'Book at an angle'], ['towel', 'Folded towel'], ['nothing', 'Nothing at all']];
  const thingBtns = things.map(([id, t]) => ui.button(t, () => setThing(id), { group: gThing }));
  const dWrap = ui.element(`<label style="display:flex;gap:8px;align-items:center;width:100%;font-size:13.5px">Distance <input type="range" min="1" max="${MAX_CM}" value="${S.cm}" style="flex:1;min-width:0;accent-color:var(--lab-accent)" aria-label="Distance from the sensor, in centimetres"><output style="font:600 13px ${MONO};min-width:4em;text-align:right">${S.cm} cm</output></label>`, gThing);
  const dIn = dWrap.querySelector('input');
  const dOut = dWrap.querySelector('output');
  dIn.addEventListener('input', () => setDist(+dIn.value, true));
  const gPing = ui.group('The ping');
  const keepBtn = ui.button('Keep pinging', () => { S.pinging = !S.pinging; keepBtn.setAttribute('aria-pressed', String(S.pinging)); }, { group: gPing, pressed: true });
  ui.button('Send one ping', () => { if (!S.ping) startPing(); }, { group: gPing });
  const gScr = ui.group('The screen');
  const scrs = [['flicker', 'b7_04: clear() every round'], ['leftover', 'clear() taken out'], ['fixed', 'b7_05: pad to 16, skip if same']];
  const scrBtns = scrs.map(([id, t]) => ui.button(t, () => setScreen(id), { group: gScr }));

  function setThing(id) {
    S.thing = id;
    ui.toggle(thingBtns, thingBtns[things.findIndex((x) => x[0] === id)]);
    place();
  }
  function setDist(cm, fromSlider) {
    S.cm = cm;
    if (!fromSlider) dIn.value = cm;
    dOut.textContent = `${cm} cm`;
    if (S.thing === 'nothing') setThing('book');
    place();
  }
  function setScreen(id) {
    S.screen = id;
    S.lastShown = null;
    S.loopAcc = 0;
    ui.toggle(scrBtns, scrBtns[scrs.findIndex((x) => x[0] === id)]);
    lastInfo = '';
  }
  function place() {
    // a ping in flight was aimed at the old place: start a fresh one
    if (S.ping) { S.ping = null; outR.visible = backR.visible = false; }
    S.nextPing = Math.min(S.nextPing, 0.35);
    const x = xAt(S.cm);
    book.visible = S.thing === 'book' || S.thing === 'angled';
    towel.visible = S.thing === 'towel';
    book.position.set(x, 0, 0);
    book.rotation.y = S.thing === 'angled' ? -0.75 : 0;
    towel.position.set(x + 0.8, 0, 0);
    target.position.set(x, 0, 0);
    target.visible = S.thing !== 'nothing';
    stage.invalidate();
    lastInfo = '';
  }

  // ---------- the words beside it ----------
  let lastInfo = '';
  function showInfo() {
    let calc;
    const L = S.last;
    if (!L) calc = '<p>Watch the first ping go out…</p>';
    else if (L.us) {
      const a = Math.trunc(L.us / 29);
      calc = `<p><code>pulseIn</code> gave <b>${L.us}</b> microseconds.</p>
        <p><code>${L.us} / 29 = ${a}</code> cm of travel, there and back.<br><code>${a} / 2 = ${L.cm}</code> cm to the ${L.thing === 'book' ? 'book' : 'thing'}. The ruler says ${L.d} cm.</p>`;
    } else {
      calc = `<p><b>Nothing came back.</b> ${esc(L.why || '')} <code>pulseIn</code> waited for its limit of 25000 microseconds, gave up, and handed back <b>0</b>.</p><p><code>0 / 29 / 2 = 0</code>. A 0 means “I heard nothing”, not “touching”.</p>`;
    }
    const lo = leftovers();
    const cell = (r, i) => {
      const ch = S.buf[r][i];
      const fresh = S.wrote[r][i] === S.round;
      const bad = r === 1 && lo[i];
      return `<span style="display:inline-block;width:1.15em;text-align:center;border-radius:3px;${bad ? 'background:#ca1f3f;color:#fff' : fresh ? 'background:rgba(255,190,0,.45)' : ''}">${ch === ' ' ? '<span style="opacity:.3">·</span>' : esc(ch)}</span>`;
    };
    const rows = [0, 1].map((r) => S.buf[r].map((_, i) => cell(r, i)).join('')).join('<br>');
    const perSec = S.writes.length;
    const blanks = S.blanks.length;
    let note;
    if (S.screen === 'flicker') note = `<b>Flickering.</b> <code>clear()</code> blanks all 32 characters ${blanks} times a second, and the number is rewritten even when it has not changed.${calc ? '' : ''}`;
    else if (S.screen === 'leftover') note = lo.some(Boolean) ? '<b>A leftover.</b> The red characters are from an earlier, longer reading. Nothing wrote over them.' : '<b>No flicker now.</b> Move the book so the number gets shorter, say from 100 to 99, and watch the end of the row.';
    else note = `<b>Steady.</b> It writes only when the number changes (${perSec} times in the last second), and always exactly 16 characters, so nothing old is left behind.`;
    const html = `${calc}
      <div class="lab-joins"><b>The screen, character by character</b><div style="font:600 14px/1.6 ${MONO};margin-top:4px;overflow-x:auto;white-space:nowrap">${rows}</div><small class="lab-tip">Gold: written this round.</small></div>
      <p class="lab-tip">${note}</p>`;
    if (html === lastInfo) return;
    lastInfo = html;
    ui.info('Ping, sum, screen', html);
  }

  // ---------- the clock ----------
  let infoT = 0;
  stage.onTick((dt) => {
    S.t += dt;
    // the sketch on the board runs at its real speed
    const period = S.screen === 'fixed' ? 50 : 60;
    S.loopAcc += dt * 1000;
    while (S.loopAcc >= period) { S.loopAcc -= period; sketchRound(); }
    while (S.writes.length && S.writes[0] < S.t - 1) S.writes.shift();
    while (S.blanks.length && S.blanks[0] < S.t - 1) S.blanks.shift();
    if (S.screen === 'flicker') S.flickerTime += dt;
    if (S.screen === 'leftover' && leftovers().some(Boolean)) S.sawLeftover = true;
    if (S.flickerTime > 1.5 && S.sawLeftover && S.screen === 'fixed' && S.fixedVals.size >= 2) ui.complete('screen');
    if (S.screen !== 'fixed') S.fixedVals.clear();
    // the slow-motion ping
    if (S.ping) stepPing(dt);
    else if (S.pinging) { S.nextPing -= dt; if (S.nextPing <= 0) startPing(); }
    drawLcd();
    infoT += dt;
    if (infoT > 0.2) { infoT = 0; showInfo(); drawScope(); }
    else if (S.ping) drawScope();
  });

  setThing('book');
  setScreen('flicker');
  place();
  drawLcd();
  drawScope();
  void label;
}

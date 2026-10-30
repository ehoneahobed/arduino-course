// Band 4 concept lab: the light sensor as a voltage divider, from the light
// in a place to a decision, calibration in your own places, and the
// division trap (5 / 1023 is 0).
//
// The board is the band's own Part 7 build (b4p7: knob on A0, light sensor
// f12/f14 with the 10 000 ohm resistor j14 to j16 and its middle on A1, the
// lamp on pin 9). The numbers come from a simple light-sensor model, tuned so
// a room reads about 520 at six in the evening and about 310 after dark, the
// example Part 8 gives. Real sensors differ, which is the point of Part 8.
import { THREE, rbox, mat } from './runtime.js';
import { shell, box, monitor, glow, tag, setLabel, prepareFrom, frame, partsWhere } from './concept-b3.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The five places of the brightness walk (Part 1 and Part 8), and roughly how
// much light (lux) reaches a sensor pointing up there: daytime, six in the
// evening, and after dark (with the room's bulb on indoors).
const PLACES = [
  { name: 'Outside in the sun', lux: [50000, 900, 0.6] },
  { name: 'Outside in shade', lux: [10000, 500, 0.6] },
  { name: 'By a window', lux: [1500, 160, 6] },
  { name: 'Middle of a room', lux: [300, 60, 17.5] },
  { name: 'Under a cloth', lux: [15, 4, 0.8] },
];
const TIMES = ['Daytime', 'Six in the evening', 'After dark'];
const R_FIXED = 10000;

// The sensor's resistance in ohms for an amount of light.
const sensorOhms = (lux) => Math.min(2e6, Math.max(80, 9700 * Math.pow(Math.max(lux, 0.05) / 60, -0.7)));
// Five volts through the sensor to the middle point, 10 000 ohms on to ground.
const voltsAt = (ohms) => (5 * R_FIXED) / (ohms + R_FIXED);
const toReading = (v) => Math.max(0, Math.min(1023, Math.round((v / 5) * 1023)));
const arduinoMap = (x, a, b, c, d) => Math.trunc(((x - a) * (d - c)) / (b - a)) + c;
const ohmText = (r) => (r >= 1e6 ? `${(r / 1e6).toFixed(1)} MΩ` : r >= 1000 ? `${(r / 1000).toFixed(r < 10000 ? 1 : 0)} kΩ` : `${Math.round(r)} Ω`);

export const missions = [
  { id: 'chain', text: 'Follow the chain: cup your hand over the sensor, then shine a torch on it. Watch every number change.', hint: 'Use “Your hands” below the model. Darker means more resistance, fewer volts at A1, a smaller number.' },
  { id: 'calibrate', text: 'Calibrate: write down at least three places, say where you would want a lamp, then turn the knob until the lamp is right in every row.', hint: 'Pick a place and a time, press “Write it down”, then choose yes or no for each row.' },
  { id: 'trap', text: 'Spring the division trap: load b4_04 and see volts stuck at 0.00. Then fix the line and set the knob halfway: about 2.5 volts.', hint: 'The fix is one decimal point. Halfway is a reading of about 512.' },
];

export function prepare(host) {
  return prepareFrom(host, 'b4p7');
}
export function config(W) {
  return frame(W, { label: '3D model of the Band 4 night guard: knob on A0, light sensor on A1, lamp on pin 9. Arrow keys turn it, plus and minus zoom, 0 resets.' });
}

export default function lab(stage, ui, host, W) {
  const { scene } = stage;
  scene.add(W.world);
  const strip = shell(host);

  const knobPart = W.parts.find((p) => p.data.type === 'pot');
  const ldrPart = W.parts.find((p) => p.data.type === 'blk' && /light sensor/.test(p.data.label));
  const fixed = W.parts.find((p) => p.data.type === 'res' && p.data.value === '10k');
  const a1Wire = W.parts.find((p) => p.data.type === 'wire' && p.data.b === 'A1');
  const a0Wire = W.parts.find((p) => p.data.type === 'wire' && p.data.b === 'A0');
  const lamp = W.parts.find((p) => p.data.type === 'led');
  const plusFeed = partsWhere(W, (d) => d.type === 'power' && d.rail === '+top')[0];
  const ldrAt = W.L.hole('f13');
  const sockA1 = W.uno.sockPos(a1Wire.data.socket);
  const sockA0 = W.uno.sockPos(a0Wire.data.socket);

  // ---- the knob turns with the value ----
  const potModel = knobPart.group.children[0];
  const [, , knobMesh, markMesh] = potModel.children;
  const pivot = new THREE.Group();
  pivot.position.set(knobMesh.position.x, 0, knobMesh.position.z);
  potModel.add(pivot);
  for (const m of [knobMesh, markMesh]) { m.position.x -= pivot.position.x; m.position.z -= pivot.position.z; pivot.add(m); }

  // ---- a hand and a phone torch, to cover or light the sensor ----
  const hand = new THREE.Group();
  const palm = rbox(5.2, 1.2, 4.2, 0x8d5a3b, 0.5);
  hand.add(palm);
  for (let k = 0; k < 4; k++) {
    const f = rbox(1.05, 0.9, 3.2, 0x8d5a3b, 0.4);
    f.position.set(-1.85 + k * 1.23, -0.1, -3.3);
    hand.add(f);
  }
  hand.position.set(ldrAt.x, 7.4, ldrAt.z + 1.2);
  hand.rotation.x = 0.2;
  hand.visible = false;
  scene.add(hand);
  const torch = new THREE.Group();
  const phone = rbox(3.2, 0.5, 6.2, 0x24182e, 0.35);
  torch.add(phone);
  const lensDot = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0xfff6c2 }));
  lensDot.rotation.x = Math.PI / 2;
  lensDot.position.set(0, -0.27, -2.3);
  torch.add(lensDot);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.userData.noInk = true;
  beam.position.set(0, -4.5, -2.3);
  torch.add(beam);
  torch.position.set(ldrAt.x, 11.5, ldrAt.z + 2.3);
  torch.visible = false;
  scene.add(torch);

  // ---- tags ----
  const rTag = tag(scene, V(ldrAt.x, 6.2, ldrAt.z - 3.2), 'sensor ≈ 10 kΩ');
  const midAt = W.L.hole('h14');
  const a1Tag = tag(scene, V(midAt.x + 3, 3, W.L.hole('e14').z), 'A1');
  const a0Tag = tag(scene, V(W.L.hole('j6').x - 1, 6.8, W.L.hole('j6').z - 2.5), 'A0');
  const lampTag = tag(scene, lamp.focus.clone().add(V(0, 1.6, -1.5)), 'lamp off');

  // ---- callouts ----
  stage.callout(ldrPart.group, { title: 'Light sensor · f12, f14', text: 'Bright light: it resists less. Dark: it resists much more.', at: [ldrAt.x, 4.2, ldrAt.z], dx: -170, dy: -40 });
  stage.callout(fixed.group, { title: '10 000 ohms · j14 to j16', text: 'Brown, black, orange. The fixed half of the divider, down to the − rail.', at: fixed.focus.toArray(), dx: 150, dy: -95, quiet: true });
  stage.callout(a1Wire.group, { title: 'The middle point → A1', text: 'h14 to A1. The board measures the voltage here, not the resistance.', at: W.L.hole('h14').clone().setY(3).toArray(), dx: 140, dy: 40, quiet: true });
  stage.callout(knobPart.group, { title: 'Knob → A0', text: 'It does not control the light. It sets the number that counts as dark.', at: knobPart.focus.toArray(), dx: -60, dy: 120 });
  stage.callout(lamp.group, { title: 'Lamp · pin 9', text: 'On when light < threshold.', at: lamp.focus.toArray(), dx: 120, dy: 100, quiet: true });
  if (plusFeed) stage.callout(plusFeed.group, { title: '5V on the + rail', text: 'The top of both dividers. The − rail goes to GND.', at: W.L.railHole('+top', 2).clone().setY(2).toArray(), dy: -60, quiet: true });

  // ---- the scene's lights follow the place ----
  const lights = [];
  scene.traverse((o) => { if (o.isHemisphereLight || o.isDirectionalLight) lights.push([o, o.intensity]); });

  // ---- state ----
  let place = 3;
  let time = 0;
  let cover = 'none';
  let knob = 512;
  let sketch = 'guard'; // 'guard' (b4_05) or 'trap' (b4_04)
  let lampMode = 'switch'; // 'switch' (b4_05) or 'fade' (the Bronze task, with map)
  let line = 'bug'; // b4_04's volts line: 'bug', 'fix' or 'mv'
  const rows = [];
  const seen = { dark: false, bright: false, bug: false };
  let timer = null;

  const luxNow = () => {
    const base = PLACES[place].lux[time];
    return cover === 'hand' ? base * 0.03 : cover === 'torch' ? base + 3000 : base;
  };
  function lightNow(jitter = true) {
    const r = sensorOhms(luxNow());
    const v = voltsAt(r);
    let reading = toReading(v);
    if (jitter) reading = Math.max(0, Math.min(1023, reading + Math.round((Math.random() - 0.5) * 5)));
    return { r, v, reading };
  }

  // ---- the strip ----
  const hands = box(strip, 'Your hands');
  hands.insertAdjacentHTML('beforeend', `
    <label style="display:block;font-size:13px;margin-bottom:4px" for="cb4-place">Where is the board?</label>
    <select id="cb4-place">${PLACES.map((p, i) => `<option value="${i}" ${i === place ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
    <div class="cb-row" role="group" aria-label="Time of day">${TIMES.map((t, i) => `<button type="button" class="lab-btn cb-time" data-t="${i}" aria-pressed="${i === time}">${t}</button>`).join('')}</div>
    <div class="cb-row" role="group" aria-label="Over the sensor">
      <button type="button" class="lab-btn cb-cover" data-c="none" aria-pressed="true">Nothing over it</button>
      <button type="button" class="lab-btn cb-cover" data-c="hand" aria-pressed="false">Cup your hand over it</button>
      <button type="button" class="lab-btn cb-cover" data-c="torch" aria-pressed="false">Phone torch on it</button>
    </div>
    <label style="display:block;font-size:13px;margin-top:10px" for="cb4-knob">Turn the knob (A0): <b class="cb-knobv">512</b></label>
    <input id="cb4-knob" type="range" min="0" max="1023" step="1" value="512">`);
  const ser = monitor(strip);
  const chainBox = box(strip, 'From light to a decision', 'cb-wide');
  const chain = document.createElement('div');
  chain.className = 'cb-chain';
  chainBox.appendChild(chain);
  const chainCode = document.createElement('pre');
  chainCode.className = 'cb-code';
  chainCode.style.marginTop = '8px';
  chainBox.appendChild(chainCode);
  const calBox = box(strip, 'Calibration: your table', 'cb-wide');

  hands.querySelector('#cb4-place').addEventListener('change', (e) => { place = +e.target.value; update(); });
  hands.querySelectorAll('.cb-time').forEach((b) => b.addEventListener('click', () => {
    time = +b.dataset.t;
    hands.querySelectorAll('.cb-time').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));
  hands.querySelectorAll('.cb-cover').forEach((b) => b.addEventListener('click', () => {
    cover = b.dataset.c;
    hands.querySelectorAll('.cb-cover').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));
  const knobIn = hands.querySelector('#cb4-knob');
  knobIn.addEventListener('input', () => { knob = +knobIn.value; update(); });

  // ---- drawing ----
  function update() {
    const L = lightNow(false);
    const lux = luxNow();
    hand.visible = cover === 'hand';
    torch.visible = cover === 'torch';
    const k = Math.min(1, Math.max(0, Math.log10(Math.max(lux, 0.3)) / 4.7));
    for (const [o, i0] of lights) o.intensity = i0 * (0.35 + 0.75 * k);
    pivot.rotation.y = -((knob / 1023) * 270 - 135) * (Math.PI / 180);
    hands.querySelector('.cb-knobv').textContent = knob;
    setLabel(rTag, `sensor ≈ ${ohmText(L.r)}`);
    if (sketch === 'guard') {
      setLabel(a1Tag, `middle: ${L.v.toFixed(2)} V → A1 reads ${L.reading}`);
      setLabel(a0Tag, `A0: threshold ${knob}`);
      a1Tag.visible = true;
      rTag.visible = true;
      const on = L.reading < knob;
      const bright = arduinoMap(L.reading, 0, 1023, 255, 0);
      if (lampMode === 'switch') {
        glow(lamp, on ? 1 : 0);
        setLabel(lampTag, on ? 'LAMP ON' : 'lamp off', { bg: on ? 'rgba(255,190,0,0.95)' : 'rgba(255,255,255,0.92)' });
      } else {
        glow(lamp, bright / 255);
        setLabel(lampTag, `brightness ${bright}`, { bg: 'rgba(255,190,0,0.95)' });
      }
      renderChain(L, lux, on, bright);
    } else {
      const v = voltsLine(knob);
      setLabel(a0Tag, `A0: ${knob}`);
      a1Tag.visible = false;
      rTag.visible = false;
      glow(lamp, 0);
      setLabel(lampTag, 'lamp not used here', { bg: 'rgba(255,255,255,0.92)' });
      renderTrap(v);
    }
    renderTable();
    stage.invalidate();
  }

  function renderChain(L, lux, on, bright) {
    const luxText = lux >= 1000 ? `${Math.round(lux / 100) * 100}` : lux >= 10 ? `${Math.round(lux)}` : lux.toFixed(1);
    const decision = lampMode === 'switch'
      ? `<div class="hot"><b>Decide</b><span>${L.reading} < ${knob}?</span><small>${on ? 'yes, so the lamp goes on' : 'no, so the lamp stays off'}</small></div>`
      : `<div class="hot"><b>map</b><span>${bright}</span><small>map(${L.reading}, 0, 1023, 255, 0): darker means brighter</small></div>`;
    chain.innerHTML = `
      <div><b>Light here</b><span>${luxText} lux</span><small>${PLACES[place].name}, ${TIMES[time].toLowerCase()}${cover === 'hand' ? ', hand over it' : cover === 'torch' ? ', torch on it' : ''}</small></div>
      <div><b>Sensor</b><span>${ohmText(L.r)}</span><small>more light, less resistance</small></div>
      <div><b>Volts at A1</b><span>${L.v.toFixed(2)} V</span><small>5 × 10k ÷ (sensor + 10k)</small></div>
      <div><b>analogRead(A1)</b><span>${L.reading}</span><small>0 volts is 0, 5 volts is 1023</small></div>
      ${decision}
      <div><b>Lamp · pin 9</b><span>${lampMode === 'switch' ? (on ? 'ON' : 'off') : `${Math.round((bright / 255) * 100)}%`}</span><small>${lampMode === 'switch' ? 'digitalWrite HIGH or LOW' : 'analogWrite(lampPin, brightness)'}</small></div>`;
    chainCode.textContent = lampMode === 'switch'
      ? `int light = analogRead(lightPin);      // ${L.reading}\nint threshold = analogRead(knobPin);  // ${knob}\n\nif (light < threshold) {\n  digitalWrite(lampPin, HIGH);\n} else {\n  digitalWrite(lampPin, LOW);\n}`
      : `int light = analogRead(lightPin);                  // ${L.reading}\nint brightness = map(light, 0, 1023, 255, 0);    // ${bright}\nanalogWrite(lampPin, brightness);`;
    chainBox.querySelector('h5').innerHTML = 'From light to a decision <span>b4_05, the night guard</span>';
  }

  // b4_04's three versions of the volts line, worked through step by step
  function voltsLine(reading) {
    if (line === 'bug') return { text: '0.00', steps: [['5 / 1023', '0', 'both whole numbers: the 0.00489 is thrown away'], ['0 × ' + reading, '0', 'nought times anything'], ['volts', '0.00', 'float volts cannot bring it back']], code: 'float volts = 5 / 1023 * reading;' };
    if (line === 'fix') {
      const v = (5.0 / 1023.0) * reading;
      return { text: v.toFixed(2), volts: v, steps: [['5.0 / 1023.0', '0.004888', 'a decimal point: work in decimals'], ['× ' + reading, v.toFixed(4), ''], ['volts', v.toFixed(2), 'Serial.println shows two places']], code: 'float volts = 5.0 / 1023.0 * reading;' };
    }
    const mv = Math.trunc((5000 * reading) / 1023);
    return { text: String(mv), mv, steps: [['5000 × (long)' + reading, String(5000 * reading), 'multiply first: a big number'], ['÷ 1023', String(mv), 'losing a fraction out of 5000 hardly matters'], ['millivolts', String(mv), `${(mv / 1000).toFixed(3)} volts`]], code: 'int millivolts = 5000 * (long)reading / 1023;' };
  }
  function renderTrap(v) {
    chainBox.querySelector('h5').innerHTML = 'The division, step by step <span>b4_04_buggy_intdiv.ino</span>';
    chain.innerHTML = `<div><b>analogRead(A0)</b><span>${knob}</span><small>the knob</small></div>` + v.steps.map(([a, b, c], i) => `<div class="${i === v.steps.length - 1 ? 'hot' : ''}"><b>${a}</b><span>${b}</span><small>${c}</small></div>`).join('');
    chainCode.innerHTML = `int reading = analogRead(knobPin);\n\n<span class="cb-line on">${v.code}</span>\n\nSerial.print("reading ");\nSerial.print(reading);\nSerial.print("   ${line === 'mv' ? 'millivolts' : 'volts'} ");\nSerial.println(${line === 'mv' ? 'millivolts' : 'volts'});\ndelay(300);`;
  }

  function renderTable() {
    calBox.hidden = sketch !== 'guard';
    if (calBox.hidden) return;
    const cur = lightNow(false).reading;
    const ok = (r) => r.want === null ? null : (r.reading < knob) === r.want;
    calBox.innerHTML = `<h5>Calibration: your table <span>threshold (the knob) = ${knob}</span></h5>
      <div class="cb-tablewrap"><table class="cb-table"><thead><tr><th>Place</th><th>Time of day</th><th>Sensor number</th><th>Want a lamp here?</th><th>The lamp would be</th></tr></thead><tbody>
      ${rows.length ? rows.map((r, i) => `<tr><td>${r.place}</td><td>${r.time}</td><td class="num">${r.reading}</td>
        <td><button type="button" class="lab-btn cb-want" data-i="${i}" data-w="1" aria-pressed="${r.want === true}">yes</button> <button type="button" class="lab-btn cb-want" data-i="${i}" data-w="0" aria-pressed="${r.want === false}">no</button></td>
        <td>${r.reading < knob ? 'ON' : 'off'} ${ok(r) === null ? '' : ok(r) ? '<span class="cb-mark ok">✓ right</span>' : '<span class="cb-mark bad">✗ wrong</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="cb-note">Nothing written down yet. Pick a place and a time, then press “Write it down”.</td></tr>'}
      </tbody></table></div>
      <div class="cb-row"><button type="button" class="lab-btn primary cb-rec">Write it down: ${cur} here</button><span class="cb-note cb-recmsg" style="margin:0"></span></div>
      <p class="cb-note">Write the threshold down with a reason, as Part 8 asks: not just “400”, but “400, because the middle of the room read 520 at six in the evening and 310 once the sun had gone.”</p>`;
    calBox.querySelector('.cb-rec').addEventListener('click', () => {
      const msg = calBox.querySelector('.cb-recmsg');
      if (cover !== 'none') { msg.textContent = 'Take your hand or the torch away first: the table is for the place, not your hand.'; return; }
      const r = lightNow(true).reading;
      const p = PLACES[place].name, t = TIMES[time];
      const at = rows.findIndex((x) => x.place === p && x.time === t);
      if (at >= 0) rows[at].reading = r; else rows.push({ place: p, time: t, reading: r, want: null });
      checkCal();
      renderTable();
    });
    calBox.querySelectorAll('.cb-want').forEach((b) => b.addEventListener('click', () => {
      rows[+b.dataset.i].want = b.dataset.w === '1';
      checkCal();
      renderTable();
    }));
  }
  function checkCal() {
    if (rows.length < 3 || rows.some((r) => r.want === null)) return;
    if (!rows.some((r) => r.want) || !rows.some((r) => !r.want)) return;
    if (rows.every((r) => (r.reading < knob) === r.want)) ui.complete('calibrate');
  }

  // ---- the serial monitor, at the sketch's own pace ----
  function tick() {
    if (sketch === 'guard') {
      const L = lightNow(true);
      if (lampMode === 'switch') {
        const on = L.reading < knob;
        ser.println(`light ${L.reading}   threshold ${knob}   ${on ? 'LAMP ON' : 'lamp off'}`);
      } else {
        ser.println(`light ${L.reading}   brightness ${arduinoMap(L.reading, 0, 1023, 255, 0)}`);
      }
      if (cover === 'hand' && L.reading < 300) seen.dark = true;
      if (cover === 'torch' && L.reading > 900) seen.bright = true;
      if (seen.dark && seen.bright) ui.complete('chain');
      checkCal();
    } else {
      const v = voltsLine(knob);
      ser.println(`reading ${knob}   ${line === 'mv' ? 'millivolts' : 'volts'} ${v.text}`);
      if (line === 'bug' && knob > 50) seen.bug = true;
      const half = (line === 'fix' && v.volts >= 2.3 && v.volts <= 2.7) || (line === 'mv' && v.mv >= 2300 && v.mv <= 2700);
      if (seen.bug && half) ui.complete('trap');
    }
  }
  function upload() {
    clearInterval(timer);
    ser.clear();
    ser.note(sketch === 'guard' ? (lampMode === 'switch' ? 'Uploaded b4_05_night_guard_worked.ino.' : 'Uploaded your Bronze copy of b4_05, with map.') : `Uploaded b4_04 with ${line === 'bug' ? 'the line as it came' : 'your fix'}.`);
    timer = setInterval(tick, sketch === 'guard' ? 200 : 300);
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === sketch)));
    lampG.hidden = sketch !== 'guard';
    lineG.hidden = sketch !== 'trap';
    explain();
    update();
  }

  function explain() {
    if (sketch === 'trap') {
      ui.info('Part 9: the division trap', `<p><code>5 / 1023</code> is whole-number division, because both numbers are whole. The true answer is about 0.00489; there is nowhere to put the fraction, so it becomes <b>0</b>, and 0 times your reading is 0.</p>
        <p>Saying <code>float volts</code> does not help: by the time the answer is stored, the damage is done. One decimal point anywhere in the division is enough.</p>
        <p class="lab-tip">The millivolts fix multiplies by 5000 first. The <code>(long)</code> gives the sum a bigger box: 5000 × 1023 is over five million, too big for an int.</p>`);
      return;
    }
    ui.info('A voltage divider', `<p>The board cannot measure resistance, only voltage. So the sensor sits at the top, from the + rail, and the 10 000 ohm resistor at the bottom, to the − rail. Pin A1 reads the point between them.</p>
      <p>More light: the sensor resists less, so more of the 5 volts reaches the middle, so the number goes <b>up</b>. Darker: the number goes <b>down</b>.</p>
      <p class="lab-tip">Nobody can tell you what number counts as dark. Measure it where the lamp will live: that is calibration, Part 8.</p>`);
  }

  // ---- the side panel ----
  const g1 = ui.group('Which sketch is on the board?');
  const modeBtns = [
    ui.button('b4_05: the night guard (Parts 7 to 10)', () => { sketch = 'guard'; upload(); }, { group: g1, pressed: true }),
    ui.button('b4_04: the division trap (Part 9)', () => { sketch = 'trap'; upload(); }, { group: g1, pressed: false }),
  ];
  modeBtns[0].dataset.m = 'guard';
  modeBtns[1].dataset.m = 'trap';
  const lampG = ui.group('The lamp');
  const lampBtns = [
    ui.button('On below the threshold (b4_05)', () => { lampMode = 'switch'; lampBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === 0))); upload(); }, { group: lampG, pressed: true }),
    ui.button('Fades with map (the Bronze task)', () => { lampMode = 'fade'; lampBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1))); upload(); }, { group: lampG, pressed: false }),
  ];
  const lineG = ui.group('The volts line in b4_04');
  const lineOpts = [['bug', '5 / 1023 (as it came)'], ['fix', '5.0 / 1023.0 (the fix)'], ['mv', '5000 * (long)reading / 1023']];
  const lineBtns = lineOpts.map(([id, t]) => ui.button(t, () => { line = id; lineBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(lineOpts[i][0] === id))); upload(); }, { group: lineG, pressed: id === 'bug' }));
  ui.element('<p class="lab-tip">The numbers here come from a model of one sensor and one 10 000 ohm resistor. Yours will be different, and that is exactly why you calibrate.</p>');

  // dark mode: the "ink" wires follow the page's text colour
  new MutationObserver(() => setTimeout(() => {
    const c = getComputedStyle(host).color.match(/\d+/g);
    if (c) { let [r, g, b] = c.map(Number); if ((0.3 * r + 0.59 * g + 0.11 * b) / 255 < 0.2) [r, g, b] = [43, 47, 49]; W.inkMats.forEach((m) => m.color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)); }
    stage.invalidate();
  }, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  // (The whole build is framed to fill the view, sensor included.)
  void mat;
  upload();
  host.labDebug = { ser, rows, set: (o) => { if ('place' in o) place = o.place; if ('time' in o) time = o.time; if ('cover' in o) cover = o.cover; if ('knob' in o) { knob = o.knob; knobIn.value = knob; } update(); }, readingOf: (p, t) => toReading(voltsAt(sensorOhms(PLACES[p].lux[t]))) };
}

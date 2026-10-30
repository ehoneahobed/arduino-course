// Band 2 (Mood Lamp) concept lab: how the board fakes dimming, the for loop,
// and mixing colour from three numbers.
// <div class="lab" data-lab="concept-b2" data-lazy hidden></div>
//
// The builds are Band 2's own (b2p5: the LED on pin 9; b2p7: the RGB LED on
// pins 9, 10 and 11), from the same data as the wiring diagrams.
//   1. analogWrite as fast switching: a waveform, the LED, and slow motion.
//   2. b2_01's for loop, one step at a time, with level shown as it counts.
//   3. Mixing light: three sliders, showColour(r, g, b).
import { THREE } from './runtime.js';
import * as P from './parts.js';
import DATA from './builds.json';
import { esc, glow, ensureStyle, prepBuild, buildConfig, codeBox, clock } from './concept-b0.js';

const { V } = P;
const SLOW_PERIOD = 2; // seconds for one PWM slice in slow motion (about a thousand times slower)

export function prepare(host) {
  if (!DATA.builds.b2p5pin7) {
    // Part 8b: the same light with its wire moved to pin 7, which has no ~.
    const b = JSON.parse(JSON.stringify(DATA.builds.b2p5));
    b.title = 'Band 2 Part 8b: the wire moved to pin 7';
    for (const p of b.parts) if (p.type === 'wire' && p.to === 'socket') { p.b = '7'; p.socket = { hdr: 'dig', i: DATA.pins.dig.indexOf('7'), name: '7' }; }
    DATA.builds.b2p5pin7 = b;
  }
  const A = prepBuild(host, 'b2p5');
  const A7 = prepBuild(host, 'b2p5pin7');
  const B = prepBuild(host, 'b2p7');
  return { A, A7, B };
}
export function config(W) {
  const c = buildConfig(W.B);
  c.label = '3D model of Band 2: one LED on pin 9, or the RGB LED on pins 9, 10 and 11. Arrow keys turn it, plus and minus zoom, 0 resets.';
  return c;
}

export const missions = [
  { id: 'slow', text: 'Slow the switching right down with analogWrite at 64. How much of the time is the pin on?', hint: 'Set the slider to 64 on pin 9, then press "Slow motion".' },
  { id: 'loop', text: 'Step through the for loop until its test says no. What number is level holding?', hint: 'Press "One step" a few times, then "Jump to the last rounds" and keep stepping.' },
  { id: 'yellow', text: 'Mix yellow light using the sliders.', hint: 'Choose "Colour", then try two of the three colours at full.' },
];

export default function lab(stage, ui, host, W) {
  ensureStyle();
  const { scene } = stage;
  const { A, A7, B } = W;
  [A, A7, B].forEach((w) => scene.add(w.world));
  const find = (w, t, pred = () => true) => w.parts.find((p) => p.kind === t && pred(p.data));

  // ---- the single LED (two copies: wire on pin 9, wire on pin 7) ----
  const ledOf = (w) => {
    const part = find(w, 'led');
    const model = part.group.children[0];
    const g = glow(0xff5a3c, 7);
    g.position.copy(model.userData.top).add(V(0, -1.4, 0));
    w.world.add(g);
    return { part, lens: model.userData.lens, glow: g };
  };
  const led9 = ledOf(A), led7 = ledOf(A7);
  // ---- the RGB LED ----
  const rgbPart = find(B, 'blk');
  let rgbLens = null;
  const dies = [];
  rgbPart.group.traverse((m) => {
    if (!m.isMesh || m.userData.isInk) return;
    if (m.geometry.type === 'SphereGeometry') rgbLens = m.material;
    if (m.geometry.type === 'BoxGeometry' && m.material.emissive && m.geometry.parameters.width < 0.3) dies.push(m);
  });
  const rgbGlow = glow(0xffffff, 11);
  rgbGlow.position.copy(rgbPart.focus).add(V(0, -1.6, 0));
  B.world.add(rgbGlow);

  // ---- state ----
  const S = { mode: 'fade', pin: 9, value: 128, slow: false, r: 0, g: 0, b: 0 };
  let slowT = 0;
  let slowAt64 = 0;
  const duty = () => (S.pin === 9 ? S.value / 255 : S.value >= 128 ? 1 : 0);

  function show() {
    A.world.visible = S.mode === 'fade' && S.pin === 9;
    A7.world.visible = S.mode === 'fade' && S.pin === 7;
    B.world.visible = S.mode === 'colour';
    stage.invalidate();
  }
  function lightLed(L, k) {
    L.lens.emissiveIntensity = 0.08 + k * 1.5;
    L.lens.emissive.setHex(0xe23b2a);
    L.glow.material.opacity = Math.min(1, k * 0.95);
  }
  function lightRgb() {
    const r = S.r / 255, g = S.g / 255, b = S.b / 255;
    const max = Math.max(r, g, b);
    rgbLens.emissive.setRGB(r, g, b);
    rgbLens.emissiveIntensity = 1.1;
    rgbLens.color.setRGB(0.95, 0.94, 0.92);
    rgbGlow.material.color.setRGB(r, g, b);
    rgbGlow.material.opacity = Math.min(1, max * 0.95);
    [r, g, b].forEach((v, i) => { if (dies[i]) dies[i].material.emissiveIntensity = 0.2 + v * 2; });
    stage.invalidate();
  }

  // ---- callouts ----
  const card = (w, part, title, text, dx, dy, quiet) => stage.callout(part.group, { title, text, at: part.focus.toArray(), dx, dy, quiet, onClick: () => explain(title) });
  card(A, led9.part, 'LED on pin 9', 'Fully on or fully off, very fast.', 80, -110);
  card(A, find(A, 'wire', (d) => d.to === 'socket'), 'Pin 9 (~)', 'Has a ~: it can do PWM.', -90, 70);
  card(A, find(A, 'res'), '220 Ω resistor', 'As in Band 1.', -70, -110, true);
  card(A7, led7.part, 'LED on pin 7', 'Pin 7 has no ~.', 80, -110);
  card(A7, find(A7, 'wire', (d) => d.to === 'socket'), 'Pin 7 (no ~)', 'No PWM: only off or on.', -90, 70);
  card(B, rgbPart, 'RGB LED', 'Three lights in one case.', 80, -120);
  const wire = (n) => find(B, 'wire', (d) => d.to === 'socket' && d.b === String(n));
  card(B, wire(9), 'Red: pin 9', 'Its own resistor.', -100, 60);
  card(B, wire(10), 'Green: pin 10', 'Its own resistor.', 0, 110);
  card(B, wire(11), 'Blue: pin 11', 'Its own resistor.', 100, 70);
  card(B, find(B, 'wire', (d) => d.to === 'rail'), 'Long leg to − rail', 'Shared by all three. No resistor.', 90, -60, true);
  [led9.part, led7.part].forEach((p) => stage.clickable(p.group, () => explain('LED')));
  stage.clickable(rgbPart.group, () => explain('RGB LED'));
  function explain(t) {
    if (/RGB/.test(t)) ui.info('The RGB LED', '<p>It looks like one light but it is really three lights inside one plastic case: a red one, a green one and a blue one, sitting right next to each other so their light mixes. The long leg is the shared return path. Because it is three lights, it needs three resistors.</p>');
    else if (/^(Red|Green|Blue)/.test(t)) ui.info(t, '<p>Each colour has its own pin and its own resistor. Pins 9, 10 and 11 all have a ~, so each colour can be set anywhere from 0 to 255.</p>');
    else if (/7/.test(t)) ui.info('Pin 7', '<p>Pin 7 has no ~ next to it, so it cannot do PWM. <code>analogWrite</code> on it is perfectly legal code, so nothing complains. The board treats anything below 128 as fully off, and anything from 128 upwards as fully on.</p>');
    else ui.info('The LED on pin 9', '<p>Band 1’s circuit exactly, on pin 9 instead of pin 8, because pin 9 can do PWM and pin 8 cannot. The pin is never at half a voltage: it is either fully on at 5 volts or fully off at 0 volts.</p>');
  }

  // ---- side panel ----
  ui.info('How the board fakes dimming', '<p>The board cannot make a dim light. Its pins have only two settings: fully on at 5 volts, or fully off at 0 volts. What <code>analogWrite</code> changes is how much of each tiny slice of time the pin spends switched on.</p><p class="lab-tip">Move the slider and watch the picture of the pin. Then press <b>Slow motion</b>.</p>');
  const gMode = ui.group('Show');
  const modeBtns = [['fade', 'Brightness (Parts 2 to 5)'], ['colour', 'Colour (Parts 6 and 7)']].map(([m, t]) => {
    const b = ui.button(t, () => setMode(m), { group: gMode });
    b.dataset.m = m;
    return b;
  });

  // brightness group
  const gFade = ui.group('1 · analogWrite');
  const sl = document.createElement('label');
  sl.className = 'cl-slider';
  sl.innerHTML = '<span>Value</span><input type="range" min="0" max="255" step="1" value="128" aria-label="analogWrite value, 0 to 255"><output>128</output>';
  gFade.appendChild(sl);
  const range = sl.querySelector('input');
  const out = sl.querySelector('output');
  const line = document.createElement('div');
  line.className = 'cl-code';
  gFade.appendChild(line);
  const scope = document.createElement('canvas');
  scope.className = 'cl-scope';
  scope.setAttribute('role', 'img');
  gFade.appendChild(scope);
  const scopeNote = document.createElement('div');
  scopeNote.className = 'cl-read';
  scopeNote.setAttribute('aria-live', 'polite');
  gFade.appendChild(scopeNote);
  const pinBtns = [[9, 'Wire on pin 9 (~)'], [7, 'Wire on pin 7 (no ~)']].map(([p, t]) => {
    const b = ui.button(t, () => setPin(p), { group: gFade });
    b.dataset.p = p;
    return b;
  });
  const slowBtn = ui.button('Slow motion', () => setSlow(!S.slow), { group: gFade, pressed: false });
  const presets = document.createElement('div');
  presets.className = 'cl-chips';
  gFade.appendChild(presets);
  [0, 64, 128, 255].forEach((v) => ui.button(String(v), () => { stopLoop(); setValue(v); }, { group: presets }));

  // for loop group
  const gLoop = ui.group('2 · The for loop');
  const LOOP_LINES = (st, dl) => [
    { n: 31, t: `  for (int level = 0; level <= 255; level = level + ${st}) {` },
    { n: 32, t: '    analogWrite(lampPin, level);' },
    { n: 33, t: `    delay(${dl});` },
    { n: 34, t: '  }' },
    { n: 35, t: `  for (int level = 255; level >= 0; level = level - ${st}) {` },
    { n: 36, t: '    analogWrite(lampPin, level);' },
    { n: 37, t: `    delay(${dl});` },
    { n: 38, t: '  }' },
  ];
  const code = codeBox(gLoop, 'b2_01_fade_given.ino', LOOP_LINES(4, 20));
  const loopRead = document.createElement('dl');
  loopRead.className = 'cl-meter';
  loopRead.setAttribute('aria-live', 'polite');
  gLoop.appendChild(loopRead);
  // Play and One step sit on the code itself.
  const playBtn = code.action('▶ Play', () => (L.playing ? stopLoop() : playLoop()), { primary: true });
  code.action('One step', () => { stopLoop(); stepLoop(true); });
  ui.button('Jump to the last rounds', () => { stopLoop(); jump(); }, { group: gLoop });
  const sizes = document.createElement('div');
  sizes.className = 'cl-chips';
  gLoop.appendChild(sizes);
  const sizeBtns = [[4, 20, 'Step 4, delay 20 (as given)'], [60, 400, 'Step 60, delay 400']].map(([st, dl, t]) => {
    const b = ui.button(t, () => setSize(st, dl), { group: sizes });
    b.dataset.st = st;
    return b;
  });

  // colour group
  const gCol = ui.group('3 · Mix the light');
  const sliders = ['r', 'g', 'b'].map((k, i) => {
    const lab = document.createElement('label');
    lab.className = 'cl-slider';
    const name = ['Red', 'Green', 'Blue'][i];
    lab.innerHTML = `<span>${name}</span><input type="range" min="0" max="255" step="1" value="0" aria-label="${name}, 0 to 255, on pin ${9 + i}"><output>0</output>`;
    gCol.appendChild(lab);
    const inp = lab.querySelector('input');
    inp.style.accentColor = ['#d1342b', '#2f9a48', '#2f6fd0'][i];
    inp.addEventListener('input', () => { stopStory(); setRGB({ [k]: +inp.value }, true); });
    return { k, inp, out: lab.querySelector('output') };
  });
  const colLine = document.createElement('div');
  colLine.className = 'cl-code';
  gCol.appendChild(colLine);
  const colNote = document.createElement('div');
  colNote.className = 'cl-read';
  colNote.setAttribute('aria-live', 'polite');
  gCol.appendChild(colNote);
  const chips = document.createElement('div');
  chips.className = 'cl-chips';
  gCol.appendChild(chips);
  const TABLE = [['Red', 255, 0, 0], ['Green', 0, 255, 0], ['Blue', 0, 0, 255], ['Orange', 255, 120, 0], ['Pink', 255, 105, 180], ['White', 255, 255, 255], ['Off', 0, 0, 0]];
  TABLE.forEach(([nm, r, g, b]) => {
    const btn = ui.button(nm, () => { stopStory(); setRGB({ r, g, b }, false); }, { group: chips });
    btn.setAttribute('aria-label', `${nm}: ${r}, ${g}, ${b}`);
  });
  const storyBtn = ui.button('Run b2_02', () => (story ? stopStory() : runStory()), { group: gCol });

  // ---- brightness ----
  function setValue(v, fromLoop = false) {
    S.value = Math.max(0, Math.min(255, Math.round(v)));
    range.value = S.value;
    out.textContent = S.value;
    line.innerHTML = `<span class="cl-line"><span class="n">${fromLoop ? 32 : ''}</span><span>analogWrite(${S.pin}, ${S.value});</span></span>`;
    const d = duty();
    const pct = Math.round(d * 100);
    scope.setAttribute('aria-label', `Pin ${S.pin} voltage over time: on for ${pct} percent of each slice.`);
    scopeNote.innerHTML = S.pin === 7
      ? `Pin 7 has no ~, so <b>${S.value}</b> comes out <b>fully ${S.value >= 128 ? 'on' : 'off'}</b>. ${S.value >= 128 ? '128 and above: on.' : 'Below 128: off.'}`
      : S.value === 0 ? '<b>0</b>: fully off, all the time.' : S.value === 255 ? '<b>255</b>: fully on, all the time.'
      : `On for <b>${pct}%</b> of each slice (${S.value} out of 255), off for the rest. ${S.slow ? 'In slow motion you can see it switch.' : 'This repeats several hundred times every second, far too fast to see, so your eye reports “dimmer”.'}`;
    drawScope();
  }
  range.addEventListener('input', () => { stopLoop(); setValue(+range.value); });
  function setPin(p) {
    S.pin = p;
    ui.toggle(pinBtns, pinBtns.find((b) => +b.dataset.p === p));
    show();
    setValue(S.value);
    if (p === 7) ui.info('The wire is on pin 7', '<p>As in Part 8b. Pin 7 has no ~, so it cannot do PWM. Nothing complains: <code>analogWrite</code> on it is legal code. Anything below 128 comes out fully off and anything from 128 upwards fully on. Slide through 127 and 128, or press ▶ Play on the for loop, and watch the fade turn into a snap.</p>');
    else ui.info('The wire is on pin 9', '<p>Pin 9 has a ~ printed next to it. On an Uno only pins 3, 5, 6, 9, 10 and 11 can do PWM.</p>');
  }
  function setSlow(on) {
    S.slow = on;
    slowT = 0;
    slowAt64 = 0;
    slowBtn.setAttribute('aria-pressed', String(on));
    slowBtn.textContent = on ? 'Normal speed' : 'Slow motion';
    setValue(S.value);
    if (on) ui.info('Slow motion', '<p>The same switching, about a thousand times slower. Now you can see what the pin is really doing: fully on, then fully off, again and again. The share of time it spends on is the number you gave <code>analogWrite</code>, out of 255.</p><p class="lab-tip">This is your hand waving in front of the LED in Part 5, done for you.</p>');
    else ui.info('Normal speed', '<p>Back to several hundred slices a second. Your eye cannot follow it, so it does the averaging and reports a steady, dimmer light.</p>');
  }
  const sctx = scope.getContext('2d');
  function drawScope() {
    const w = (scope.width = scope.clientWidth * (window.devicePixelRatio > 1 ? 2 : 1) || 300);
    const h = (scope.height = (scope.clientHeight || 120) * (window.devicePixelRatio > 1 ? 2 : 1));
    const k = h / 120;
    sctx.fillStyle = '#1d1724';
    sctx.fillRect(0, 0, w, h);
    const top = 24 * k, bot = 96 * k, x0 = 40 * k, x1 = w - 8 * k;
    sctx.strokeStyle = 'rgba(255,255,255,.14)';
    sctx.lineWidth = 1;
    [top, bot].forEach((y) => { sctx.beginPath(); sctx.moveTo(x0, y); sctx.lineTo(x1, y); sctx.stroke(); });
    sctx.fillStyle = '#cfc6d8';
    sctx.font = `${11 * k}px ui-monospace, Menlo, monospace`;
    sctx.textAlign = 'right';
    sctx.textBaseline = 'middle';
    sctx.fillText('5 V', x0 - 6 * k, top);
    sctx.fillText('0 V', x0 - 6 * k, bot);
    const periods = 4;
    const pw = (x1 - x0) / periods;
    const d = duty();
    sctx.strokeStyle = '#ffbe00';
    sctx.lineWidth = 2.5 * k;
    sctx.beginPath();
    for (let i = 0; i < periods; i++) {
      const a = x0 + i * pw;
      const on = a + pw * d;
      if (i === 0) sctx.moveTo(a, d > 0 ? top : bot);
      if (d > 0) { sctx.lineTo(a, top); sctx.lineTo(on, top); }
      if (d < 1) { sctx.lineTo(on, bot); sctx.lineTo(a + pw, bot); }
    }
    sctx.stroke();
    // slice marks
    sctx.fillStyle = 'rgba(255,255,255,.35)';
    sctx.textAlign = 'center';
    sctx.font = `${10 * k}px Rubik, Arial, sans-serif`;
    sctx.fillText(S.slow ? 'one slice = 2 seconds in slow motion' : 'one slice = about 2 thousandths of a second', (x0 + x1) / 2, 112 * k);
    if (S.slow) {
      const x = x0 + ((slowT / SLOW_PERIOD) % periods) * pw;
      sctx.strokeStyle = '#ca1f3f';
      sctx.lineWidth = 2 * k;
      sctx.beginPath();
      sctx.moveTo(x, 10 * k);
      sctx.lineTo(x, 100 * k);
      sctx.stroke();
    }
  }
  new ResizeObserver(() => drawScope()).observe(scope);

  // ---- the for loop ----
  const L = { playing: false, loop: 0, phase: 'init', level: 0, round: 0, st: 4, dl: 20, wait: 0, msg: '' };
  const rounds = () => Math.floor(255 / L.st) + 1;
  function testOk() { return L.loop === 0 ? L.level <= 255 : L.level >= 0; }
  function describe() {
    const up = L.loop === 0;
    const test = up ? `level <= 255` : `level >= 0`;
    const lines = { init: up ? 31 : 35, test: up ? 31 : 35, block: up ? 32 : 36, wait: up ? 33 : 37, step: up ? 31 : 35, done: up ? 34 : 38 };
    code.clear('run'); code.clear('ok'); code.clear('err');
    const ln = lines[L.phase];
    if (ln) code.mark(ln, L.phase === 'done' ? 'err' : 'run');
    const tst = L.phase === 'block' || L.phase === 'wait' || L.phase === 'done' ? `${test.replace('level', L.level)}? <b>${testOk() ? 'yes' : 'no'}</b>` : 'not yet';
    loopRead.innerHTML = `<dt>Loop</dt><dd>${up ? 'first, counting up' : 'second, counting down'}</dd><dt>level</dt><dd>${L.level}</dd><dt>Test</dt><dd>${tst}</dd><dt>Round</dt><dd>${L.round ? `${L.round} of ${rounds()}` : '–'}</dd><dt>Sent to the pin</dt><dd>${S.value}</dd>${L.msg ? `<dt>Now</dt><dd>${L.msg}</dd>` : ''}`;
  }
  function stepLoop(manual) {
    const up = L.loop === 0;
    switch (L.phase) {
      case 'init': L.level = up ? 0 : 255; L.round = 0; L.phase = 'test'; L.msg = `make level and put ${L.level} in it`; break;
      case 'test':
        if (testOk()) { L.phase = 'block'; L.round++; L.msg = 'yes, so run the block'; }
        else {
          L.phase = 'done';
          L.msg = `no: the loop is finished. level holds ${L.level}, a number that never reaches the pin.`;
          if (manual && up) {
            ui.complete('loop');
            ui.info(`level holds ${L.level}`, `<p>On the last round that actually ran, level held ${L.level - L.st}. Then the step added ${L.st}, making it <b>${L.level}</b>, and only then did the test fail. So the biggest number it ever holds is one that never reaches the pin.</p><p class="lab-tip">${L.st === 4 ? 'With a step of 4 that is 64 rounds: 0, 4, 8 and so on up to 252.' : 'Put the step back to 4 and try again: you should find 256.'}</p>`);
          }
        }
        break;
      case 'block': setValue(L.level, true); L.phase = 'wait'; L.wait = L.dl / 1000; L.msg = `analogWrite(lampPin, ${L.level}), then wait ${L.dl} ms`; break;
      case 'wait': L.phase = 'step'; L.level = up ? L.level + L.st : L.level - L.st; L.msg = `level = level ${up ? '+' : '−'} ${L.st}, so it is now ${L.level}`; break;
      case 'step': L.phase = 'test'; L.msg = ''; stepLoop(manual); return;
      case 'done': L.loop = 1 - L.loop; L.phase = 'init'; L.msg = up ? 'on to the second for loop' : 'loop() has finished, so it starts again from the top'; stepLoop(manual); return;
    }
    describe();
  }
  function jump() {
    L.loop = 0; L.phase = 'test'; L.round = rounds() - 2; L.level = L.st * (rounds() - 2); L.msg = `jumped: level is ${L.level}`;
    describe();
  }
  function playLoop() {
    L.playing = true;
    playBtn.textContent = '❚❚ Pause';
    if (S.slow) setSlow(false);
  }
  function stopLoop() {
    if (!L.playing) return;
    L.playing = false;
    playBtn.textContent = '▶ Play';
  }
  function setSize(st, dl) {
    stopLoop();
    L.st = st; L.dl = dl; L.loop = 0; L.phase = 'init'; L.round = 0; L.level = 0; L.msg = '';
    ui.toggle(sizeBtns, sizeBtns.find((b) => +b.dataset.st === st));
    code.set(LOOP_LINES(st, dl));
    describe();
    if (st === 60) ui.info('Big, slow steps', '<p>Both 4s are now 60, and both delays are 400. Press ▶ Play: the light arrives in about five obvious jumps instead of a smooth fade. Those jumps were always there. That is what the fade is made of.</p>');
    else ui.info('Back to 4 and 20', '<p>Press ▶ Play: a smooth fade again. There are 64 steps in each direction and you cannot see a single one. Nothing changed except how fast they go by. One complete round takes about 2560 milliseconds.</p>');
  }

  // ---- colour ----
  let story = null;
  function setRGB(c, bySlider) {
    Object.assign(S, c);
    sliders.forEach((s) => { s.inp.value = S[s.k]; s.out.textContent = S[s.k]; });
    colLine.innerHTML = `<span class="cl-line"><span class="n"></span><span>showColour(${S.r}, ${S.g}, ${S.b});</span></span>`;
    const name = TABLE.find(([, r, g, b]) => r === S.r && g === S.g && b === S.b)?.[0];
    const yellow = S.r >= 200 && S.g >= 200 && S.b <= 40;
    colNote.innerHTML = `<span class="cl-swatch" style="background:rgb(${S.r},${S.g},${S.b})"></span>${name ? `<b>${name}</b>. ` : yellow ? '<b>Yellow!</b> ' : ''}Pin 9 gets ${S.r}, pin 10 gets ${S.g}, pin 11 gets ${S.b}.`;
    lightRgb();
    if (bySlider && yellow) {
      ui.complete('yellow');
      ui.info('Red and green make yellow', '<p>Not a muddy brown: bright yellow. Paint takes colour away, so mixing paints heads towards dark. Light adds: every colour you add makes it brighter, so mixing light heads towards white. Screens and LEDs make light, so the adding rules apply.</p><p class="lab-tip">Your real LED may need different numbers. Its three tiny lights are not equally strong, which is why your white may look slightly pink or blue (Part 8d).</p>');
    }
  }
  const STORY = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 120, 0], [255, 255, 255], [0, 0, 0]];
  function runStory() {
    let i = 0;
    const go = () => { setRGB({ r: STORY[i][0], g: STORY[i][1], b: STORY[i][2] }, false); i = (i + 1) % STORY.length; };
    go();
    story = setInterval(go, 1000);
    storyBtn.textContent = 'Stop b2_02';
    storyBtn.setAttribute('aria-pressed', 'true');
    ui.info('b2_02_rgb_colours.ino', '<p>Red for a second, then green, then blue, then orange, then white, then off, then it starts again. Each line in <code>loop</code> is one <code>showColour(...)</code> and one <code>delay(1000)</code>.</p>');
  }
  function stopStory() {
    if (!story) return;
    clearInterval(story);
    story = null;
    storyBtn.textContent = 'Run b2_02';
    storyBtn.setAttribute('aria-pressed', 'false');
  }

  function setMode(m) {
    S.mode = m;
    ui.toggle(modeBtns, modeBtns.find((b) => b.dataset.m === m));
    gFade.style.display = gLoop.style.display = m === 'fade' ? '' : 'none';
    gCol.style.display = m === 'colour' ? '' : 'none';
    if (m === 'colour') {
      stopLoop();
      ui.info('Mixing light', '<p>An RGB LED takes three numbers, each from 0 to 255, and mixes that much red, green and blue light. Pins 9, 10 and 11 all have a ~.</p><p class="lab-tip">Use the sliders to find yellow. The buttons below them are the table from Part 6, with yellow left out on purpose.</p>');
    } else stopStory();
    show();
    if (m === 'fade') drawScope();
  }

  // ---- every frame ----
  let scopeClock = 0;
  clock(stage, (dt) => {
    if (S.mode !== 'fade') return;
    const L9 = S.pin === 9 ? led9 : led7;
    if (L.playing) {
      // real speed: phases are instant, only delay takes time
      let budget = dt;
      let guard = 0;
      while (guard++ < 50) {
        if (L.phase === 'wait') {
          if (L.wait > budget) { L.wait -= budget; break; }
          budget -= L.wait;
          L.wait = 0;
        }
        stepLoop(false);
      }
    }
    if (S.slow) {
      slowT += dt;
      const on = (slowT % SLOW_PERIOD) / SLOW_PERIOD < duty();
      lightLed(L9, on ? 1 : 0);
      if (S.pin === 9 && Math.abs(S.value - 64) <= 6) {
        slowAt64 += dt;
        if (slowAt64 > SLOW_PERIOD * 1.5) {
          slowAt64 = -1e9;
          ui.complete('slow');
          ui.info('On a quarter of the time', `<p>64 out of 255 is about a quarter. In every slice the pin is fully on, at 5 volts, for a quarter of the time and fully off for the rest. At normal speed that reads as about a quarter brightness.</p>`);
        }
      } else if (slowAt64 > 0) slowAt64 = 0;
      scopeClock += dt;
      if (scopeClock > 0.05) { scopeClock = 0; drawScope(); }
    } else lightLed(L9, duty());
  });

  setMode('fade');
  setPin(9);
  ui.info('How the board fakes dimming', '<p>The board cannot make a dim light. Its pins have only two settings: fully on at 5 volts, or fully off at 0 volts. What <code>analogWrite</code> changes is how much of each tiny slice of time the pin spends switched on.</p><p class="lab-tip">Move the slider and watch the picture of the pin. Then press <b>Slow motion</b>.</p>');
  ui.toggle(sizeBtns, sizeBtns[0]);
  setValue(128);
  setRGB({ r: 0, g: 0, b: 0 }, false);
  describe();
  void esc;
  host.dispatchEvent(new CustomEvent('lab-ready', { bubbles: true, detail: { lab: 'concept-b2' } }));
}

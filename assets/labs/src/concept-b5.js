// Band 5 concept lab: writing your own function (a call jumps in and comes
// back), sound with tone, and millis against delay on a timeline.
//
// Two of the band's own boards: b5p4 (four lights on pins 2 to 5, four
// buttons, the buzzer on pin 12) for b5_02, and the same board with Part 6's
// four wires moved (button 1 to pin 6, light 1 to pin 9, light 2 to pin 8,
// the wire from j24 out of pin 9) for b5_03 and b5_04. The second is made
// here from the first, wire by wire, exactly as Part 6's table says.
import { THREE } from './runtime.js';
import { shell, box, sound, glow, pushCap, holdable, holdKey, tag, setLabel, prepareFrom, frame, partsWhere, clock, esc } from './concept-b3.js';
import DATA from './builds.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Part 6, "Move four wires", applied to the Part 4 board.
function part6Board() {
  if (DATA.builds.b5p6) return;
  const b = JSON.parse(JSON.stringify(DATA.builds.b5p4));
  const pinIndex = (name) => DATA.pins.dig.indexOf(name);
  const move = (from, to) => {
    const w = b.parts.find((p) => p.type === 'wire' && p.a === from);
    w.b = to;
    w.socket = { hdr: 'dig', i: pinIndex(to), name: to };
  };
  b.parts = b.parts.filter((p) => !(p.type === 'wire' && p.a === 'j24')); // 1. out of pin 9 (its loose end stays in j24)
  move('j19', '6'); // 2. button 1 is now the button
  move('b1', '9'); // 3. light 1 is now the fading lamp
  move('b5', '8'); // 4. light 2 is now the answer light
  b.title = 'Band 5 Part 6: four wires moved';
  DATA.builds.b5p6 = b;
}

export const missions = [
  { id: 'call', text: 'Follow one call: step through playStep(2) one line at a time, from the jump in to the return.', hint: 'Press “One line” until loop reaches playStep(2), then keep going until you are back in loop.' },
  { id: 'octave', text: 'Make light 1 sing one octave higher: double notes[0], then hear it play.', hint: 'Doubling the number gives the same note, higher. 262 doubled is 524; the real note is 523.' },
  { id: 'deaf', text: 'Catch the deaf board: with b5_03, press the button until it misses one. Then load b5_04 and press three times: every one is seen.', hint: 'Press and let go at an ordinary speed, about a fifth of a second. Watch the timeline.' },
];

export function prepare(host) {
  part6Board();
  const W = prepareFrom(host, 'b5p4');
  W.six = prepareFrom(host, 'b5p6');
  return W;
}
export function config(W) {
  return frame(W, { label: '3D model of the Band 5 board: four lights, four buttons and the buzzer. Arrow keys turn it, plus and minus zoom, 0 resets. Space holds button 1.' });
}

// b5_02_functions_worked.ino, as lines. `n` marks lines the walk-through visits.
const FN_LINES = [
  ['int ledPins[4] = {2, 3, 4, 5};'],
  ['int notes[4] = {'],
  ['  @N0, @N1, @N2, @N3};'],
  ['int buzzerPin = 12;'],
  [''],
  ['void playStep(int which) {', 'enter'],
  ['  digitalWrite(ledPins[which], HIGH);', 'on'],
  ['  tone(buzzerPin, notes[which]);', 'tone'],
  ['  delay(@D);', 'd1'],
  [''],
  ['  digitalWrite(ledPins[which], LOW);', 'off'],
  ['  noTone(buzzerPin);', 'notone'],
  ['  delay(120);', 'd2'],
  ['}', 'ret'],
  [''],
  ['void setup() { ... }'],
  [''],
  ['void loop() {'],
  ['  playStep(0);', 'c0'],
  ['  playStep(1);', 'c1'],
  ['  playStep(2);', 'c2'],
  ['  playStep(3);', 'c3'],
  [''],
  ['  delay(1000);', 'd3'],
  ['}', 'end'],
];

export default function lab(stage, ui, host, W) {
  const { scene } = stage;
  const W4 = W;
  const W6 = W.six;
  scene.add(W4.world, W6.world);
  const strip = shell(host);
  const tm = clock();

  const leds4 = partsWhere(W4, (d) => d.type === 'led');
  const btn4 = partsWhere(W4, (d) => d.type === 'btn');
  const buz4 = W4.parts.find((p) => p.data.type === 'buz');
  const lamp6 = W6.parts.find((p) => p.data.type === 'led' && p.data.anode === 'b3');
  const answer6 = W6.parts.find((p) => p.data.type === 'led' && p.data.anode === 'b7');
  const btn6 = W6.parts.find((p) => p.data.type === 'btn' && p.data.holes.includes('e19'));
  const wire6 = W6.parts.find((p) => p.data.type === 'wire' && p.data.a === 'j19');
  const wireLamp6 = W6.parts.find((p) => p.data.type === 'wire' && p.data.a === 'b1');
  const buzTag = tag(W4.world, buz4.focus.clone().add(V(0, 1.4, -1.5)), '♪', { bg: 'rgba(255,190,0,0.95)' });
  buzTag.visible = false;
  const lampTag = tag(W6.world, lamp6.focus.clone().add(V(0, 1.4, -1.6)), 'level 0');

  // ---- callouts ----
  ['Light 1 · pin 2', 'Light 2 · pin 3', 'Light 3 · pin 4', 'Light 4 · pin 5'].forEach((t, i) => {
    stage.callout(leds4[i].group, { title: t, text: `ledPins[${i}] is ${i + 2}. Its note is notes[${i}].`, at: leds4[i].focus.toArray(), dy: i % 2 ? -90 : -60, dx: (i - 1.5) * 40, quiet: i > 0 });
  });
  stage.callout(buz4.group, { title: 'Buzzer · pin 12', text: 'Passive: it plays the note tone() asks for. No resistor.', at: buz4.focus.toArray(), dy: -70, dx: 40 });
  stage.callout(btn4[0].group, { title: 'Buttons · pins 8 to 11', text: 'Not used by b5_02. The game in Part 9 needs them.', at: btn4[0].focus.toArray(), dy: 90, quiet: true });
  stage.callout(lamp6.group, { title: 'The fading lamp · pin 9', text: 'Light 1, its wire moved from pin 2. Only a ~ pin can fade.', at: lamp6.focus.toArray(), dy: -80, dx: -40 });
  stage.callout(answer6.group, { title: 'The answer light · pin 8', text: 'Light 2, moved from pin 3. On while the board sees the button.', at: answer6.focus.toArray(), dy: -80, dx: 90 });
  stage.callout(btn6.group, { title: 'The button · pin 6', text: 'Button 1, its wire from j19 moved to pin 6. Hold it, or press Space.', at: btn6.focus.toArray(), dy: -70, dx: 60 });
  stage.callout(wire6.group, { title: 'Moved wires', text: 'j19 to pin 6, b1 to pin 9, b5 to pin 8. The wire from j24 is out of pin 9.', at: W6.L.hole('j19').clone().setY(3).toArray(), dy: -90, quiet: true });
  void wireLamp6;

  // ---- the strip ----
  const codeBox = box(strip, '<span class="cb-fname" style="margin:0;text-transform:none;letter-spacing:0;font:600 12.5px var(--mono,monospace);color:var(--lab-ink)"></span>');
  const code = document.createElement('pre');
  code.className = 'cb-code';
  codeBox.appendChild(code);
  const right = box(strip, '', 'cb-run');
  const tlBox = box(strip, 'The same presses, two programs <span>the last 8 seconds</span>', 'cb-wide');
  const canvas = document.createElement('canvas');
  canvas.className = 'cb-tl';
  canvas.setAttribute('role', 'img');
  tlBox.appendChild(canvas);
  tlBox.insertAdjacentHTML('beforeend', `<div class="cb-legend"><span><i style="background:rgba(90,68,112,.35)"></i>inside delay(20): not looking</span><span><i style="background:#FFBE00"></i>digitalRead: looking at the button</span><span><i style="background:#CA1F3F"></i>your press</span><span><b style="color:var(--lab-good)">✓</b> seen · <b style="color:var(--lab-accent)">✗</b> missed</span></div><div class="cb-status cb-count" aria-live="polite"></div>`);

  // ---- state ----
  let mode = 'fn'; // 'fn' (b5_02) or 'timing' (b5_03 and b5_04)
  let onBoard = 'delay'; // in timing mode: 'delay' (b5_03) or 'millis' (b5_04)
  const notes = [262, 330, 392, 523];
  let stepMs = 400;

  // ======================================================= Part 5: functions
  let run = 'stop'; // 'stop', 'slow', 'real', 'step'
  let pc = 'c0'; // the line about to run
  let which = null;
  let calledFrom = null;
  let stepper = null; // resolve() for "One line"
  let follow = null; // mission 1: following playStep(2) one line at a time
  const lineOf = (id) => FN_LINES.findIndex((l) => l[1] === id);

  function renderFn() {
    codeBox.querySelector('.cb-fname').textContent = 'b5_02_functions_worked.ino';
    code.innerHTML = FN_LINES.map(([t, id]) => {
      let h = esc(t).replace(/@N(\d)/g, (_, k) => `<input class="cb-pick cb-note-in" data-k="${k}" type="text" inputmode="numeric" maxlength="4" value="${notes[k]}" aria-label="notes[${k}], a pitch in hertz" style="width:4.6ch;text-align:center">`).replace('@D', `<input class="cb-pick cb-d-in" type="text" inputmode="numeric" maxlength="4" value="${stepMs}" aria-label="How long each step lasts, in thousandths of a second" style="width:4.6ch;text-align:center">`);
      const cls = ['cb-line'];
      if (id && id === pc && run !== 'stop') cls.push('on');
      if (id && calledFrom === id) cls.push('from');
      return `<span class="${cls.join(' ')}" data-l="${id || ''}">${h || ' '}</span>`;
    }).join('');
    code.querySelectorAll('.cb-note-in').forEach((el) => el.addEventListener('change', () => {
      const v = Math.round(+el.value);
      if (v >= 31 && v <= 4000) notes[+el.dataset.k] = v; else el.value = notes[+el.dataset.k];
      renderVars(null);
    }));
    code.querySelector('.cb-d-in').addEventListener('change', (e) => {
      const v = Math.round(+e.target.value);
      if (v >= 10 && v <= 2000) stepMs = v; else e.target.value = stepMs;
    });
  }
  function litFn() {
    code.querySelectorAll('.cb-line').forEach((el) => {
      el.classList.toggle('on', !!el.dataset.l && el.dataset.l === pc && run !== 'stop');
      el.style.boxShadow = el.dataset.l && el.dataset.l === calledFrom ? 'inset 3px 0 0 var(--lab-accent)' : '';
    });
    const on = code.querySelector('.cb-line.on');
    if (on) {
      const top = on.offsetTop - code.offsetTop;
      if (top < code.scrollTop || top > code.scrollTop + code.clientHeight - 30) code.scrollTop = Math.max(0, top - 60);
    }
  }
  function renderVars(extra = null) {
    if (mode !== 'fn') return;
    // the buttons are made once, so a click is never lost to a redraw
    if (!right.querySelector('.cb-where')) {
      right.innerHTML = `<h5>Where the board is</h5>
      <div class="cb-vars cb-where" style="margin-top:0;flex-direction:column;gap:2px"></div>
      <div class="cb-status" aria-live="polite"></div>
      <div class="cb-row" role="group" aria-label="Run the sketch">
        <button type="button" class="lab-btn" data-r="step">One line</button>
        <button type="button" class="lab-btn" data-r="slow" aria-pressed="false">Run slowly</button>
        <button type="button" class="lab-btn" data-r="real" aria-pressed="false">Real speed</button>
        <button type="button" class="lab-btn" data-r="stop">Stop</button>
      </div>
      <p class="cb-note">“Run slowly” waits a moment on every line so you can follow it. On the board, the lines between the delays take millionths of a second.</p>`;
      right.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => setRun(b.dataset.r)));
    }
    const inside = which !== null;
    right.querySelector('.cb-where').innerHTML = `<span>now in: <b>${inside ? `playStep(which = ${which})` : 'loop'}</b></span>
        <span>${inside ? `came from: <b>loop, ${esc(FN_LINES[lineOf(calledFrom)][0].trim())}</b> (it will go back there)` : 'calls playStep four times, then delay(1000)'}</span>
        ${inside ? `<span>which = <b>${which}</b> · ledPins[which] = <b>${which + 2}</b> · notes[which] = <b>${notes[which]}</b></span>` : '<span>&nbsp;</span>'}`;
    if (extra !== null) right.querySelector('.cb-status').innerHTML = extra;
    right.querySelectorAll('[data-r]').forEach((b) => { if (b.dataset.r === 'slow' || b.dataset.r === 'real') b.setAttribute('aria-pressed', String(run === b.dataset.r)); });
  }

  function setRun(r) {
    sound.ensure();
    if (r === 'step') {
      if (run !== 'step') { tm.reset(); run = 'step'; walk(); }
      else if (stepper) { const s = stepper; stepper = null; s(); }
      return;
    }
    tm.reset();
    stepper = null;
    follow = null;
    run = r;
    if (r === 'stop') { lightsOff(); which = null; calledFrom = null; pc = 'c0'; renderVars(''); litFn(); return; }
    walk();
  }

  // One line: wait for the learner (step), a moment (slow), or nothing (real).
  function line(id, msg) {
    pc = id;
    litFn();
    if (msg !== undefined) renderVars(msg);
    if (run === 'step') return new Promise((res) => { stepper = res; });
    return run === 'slow' ? tm.wait(420) : Promise.resolve();
  }
  // A delay: really waits, except in "One line" mode, where it is one press.
  const pause = (ms) => (run === 'step' ? Promise.resolve() : tm.wait(ms));

  function lightsOff() {
    leds4.forEach((p) => glow(p, 0));
    sound.stop();
    buzTag.visible = false;
    stage.invalidate();
  }

  async function playStep(k, from) {
    calledFrom = from;
    await line(from, `loop calls <code>playStep(${k})</code>. The board remembers where it was, puts <b>${k}</b> into the box called <code>which</code>, and jumps in.`);
    which = k;
    if (follow === null && k === 2 && run === 'step') follow = { k: 2 };
    await line('enter', `Inside <code>playStep</code>. Everywhere it says <code>which</code>, it uses <b>${k}</b>.`);
    await line('on', `<code>digitalWrite(ledPins[${k}], HIGH)</code>: pin ${k + 2} on.`);
    glow(leds4[k], 1);
    stage.invalidate();
    await line('tone', `<code>tone(buzzerPin, ${notes[k]})</code>: the buzzer starts a ${notes[k]} Hz note, and the board carries straight on.`);
    const f = notes[k];
    sound.start(f);
    setLabel(buzTag, `♪ ${f} Hz`);
    buzTag.visible = true;
    stage.invalidate();
    await line('d1', `<code>delay(${stepMs})</code>: the light and the note keep going while the board waits.`);
    await pause(stepMs);
    if (k === 0 && f >= 520 && f <= 528) ui.complete('octave');
    await line('off', `<code>digitalWrite(ledPins[${k}], LOW)</code>: pin ${k + 2} off.`);
    glow(leds4[k], 0);
    stage.invalidate();
    await line('notone', '<code>noTone(buzzerPin)</code>: the note stops.');
    sound.stop();
    buzTag.visible = false;
    stage.invalidate();
    await line('d2', '<code>delay(120)</code>: a short gap before the next step.');
    await pause(120);
    await line('ret', 'The closing curly bracket: <code>playStep</code> is finished. Back to loop, to the line after the call.');
    const done = follow && follow.k === k && run === 'step';
    which = null;
    const back = calledFrom;
    calledFrom = null;
    if (done) { ui.complete('call'); follow = null; }
    return back;
  }

  async function walk() {
    const g = tm.gen;
    try {
      for (;;) {
        for (let k = 0; k < 4; k++) await playStep(k, 'c' + k);
        await line('d3', '<code>delay(1000)</code>: a pause, then <code>loop</code> starts again from the top.');
        await pause(1000);
        await line('end', '');
        if (g !== tm.gen) return;
      }
    } catch (e) { if (!/cancelled/.test(e?.message)) console.error(e); }
  }

  // ======================================================= Parts 6 and 7: timing
  let t0 = performance.now();
  const presses = []; // { down, up, delaySaw, millisSaw, board }
  let held = false;
  let rafOn = false;
  let lastLamp = -1;
  let lastAnswer = null;
  const P = 2560; // b5_03: 128 rounds of delay(20), then one look at the button

  const ms = () => performance.now() - t0;
  const levelDelay = (t) => { const c = t % P; return c < 1280 ? 4 * Math.floor(c / 20) : 255 - 4 * Math.floor((c - 1280) / 20); };
  const levelMillis = (t) => { const s = Math.floor(t / 20) % 128; return s < 64 ? Math.min(255, 4 * (s + 1)) : Math.max(0, 255 - 4 * (s - 63)); };
  const checkBefore = (t) => Math.floor(t / P) * P; // the last time b5_03 looked
  // b5_03's answer light: what it saw at its last look
  const delayAnswer = (t) => {
    const c = checkBefore(t);
    if (c <= 0) return false;
    return presses.some((p) => p.down <= c && (p.up === null || p.up >= c));
  };

  function renderTiming() {
    codeBox.querySelector('.cb-fname').textContent = onBoard === 'delay' ? 'b5_03_blocking_problem.ino' : 'b5_04_millis_fixed.ino';
    code.innerHTML = onBoard === 'delay'
      ? `<span class="cb-line" data-l="for">void loop() {
  for (int level = 0; level <= 255; level = level + 4) {
    analogWrite(lampPin, level);</span>
<span class="cb-line" data-l="busy">    delay(20);</span>
<span class="cb-line" data-l="for2">  }
  for (int level = 255; level >= 0; level = level - 4) {
    analogWrite(lampPin, level);</span>
<span class="cb-line" data-l="busy2">    delay(20);</span>
<span class="cb-line" data-l="for3">  }
</span><span class="cb-line" data-l="look">  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(answerPin, HIGH);
  } else {
    digitalWrite(answerPin, LOW);
  }</span>
}`
      : `<span class="cb-line" data-l="t">void loop() {
  unsigned long now = millis();

  if (now - lastFadeTime >= fadeGap) {
    lastFadeTime = now;
    level = level + step;
    ...flip step at 255 and 0...
    analogWrite(lampPin, level);
  }</span>
<span class="cb-line on" data-l="look">  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(answerPin, HIGH);
  } else {
    digitalWrite(answerPin, LOW);
  }</span>
}`;
    right.innerHTML = `<h5>Your hands</h5>
      <div class="cb-row"><button type="button" class="cb-key wide cb-hold">Hold the button<small>button 1, now on pin 6 · or Space on the model</small></button></div>
      <div class="cb-row" role="group" aria-label="Which sketch is on the board">
        <button type="button" class="lab-btn" data-b="delay" aria-pressed="${onBoard === 'delay'}">b5_03: with delay</button>
        <button type="button" class="lab-btn" data-b="millis" aria-pressed="${onBoard === 'millis'}">b5_04: with millis</button>
      </div>
      <p class="cb-note">The timeline runs both sketches against your presses. The board on the left runs the one you choose.</p>`;
    holdKey(right.querySelector('.cb-hold'), { down: () => press(true), up: () => press(false) });
    right.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { onBoard = b.dataset.b; restartTiming(); }));
  }

  function restartTiming() {
    t0 = performance.now();
    presses.length = 0;
    lastLamp = -1;
    lastAnswer = null;
    renderTiming();
    explain();
    counts();
  }

  function press(down) {
    if (mode !== 'timing' || held === down) return;
    held = down;
    pushCap(btn6, down);
    right.querySelector('.cb-hold')?.classList.toggle('down', down);
    const t = ms();
    if (down) presses.push({ down: t, up: null, board: onBoard });
    else {
      const p = presses[presses.length - 1];
      if (p && p.up === null) {
        p.up = t;
        // b5_03 saw it only if it looked while the button was down
        p.delaySaw = Math.floor(p.up / P) * P >= p.down && Math.floor(p.up / P) > 0;
        p.millisSaw = p.up - p.down > 0.01;
        counts();
      }
    }
    stage.invalidate();
  }

  function counts() {
    const done = presses.filter((p) => p.up !== null);
    const d = done.filter((p) => p.delaySaw).length;
    const el = tlBox.querySelector('.cb-count');
    el.innerHTML = done.length
      ? `Presses: <b>${done.length}</b> · seen by b5_03 (delay): <b>${d}</b> · seen by b5_04 (millis): <b>${done.filter((p) => p.millisSaw).length}</b>`
      : 'Hold the button for an ordinary press, about a fifth of a second, a few times.';
    // mission 3: a miss with b5_03 on the board, then three seen in a row with b5_04 on it
    const missedOnDelay = done.some((p) => p.board === 'delay' && !p.delaySaw);
    if (missedOnDelay) seenMiss = true;
    const millisRun = done.filter((p) => p.board === 'millis');
    if (seenMiss && millisRun.length >= 3 && millisRun.slice(-3).every((p) => p.millisSaw)) ui.complete('deaf');
  }
  let seenMiss = false;

  // the 3D lamp and answer light, and the timeline, while the lab is on screen
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen && mode === 'timing') startRaf(); }).observe(host);
  function startRaf() {
    if (rafOn) return;
    rafOn = true;
    let last = 0;
    const loop = (now) => {
      if (mode !== 'timing' || !onScreen || host.hidden) { rafOn = false; return; }
      const t = ms();
      if (now - last > 45) {
        last = now;
        const level = onBoard === 'delay' ? levelDelay(t) : levelMillis(t);
        const ans = onBoard === 'delay' ? delayAnswer(t) : held;
        if (level !== lastLamp || ans !== lastAnswer) {
          lastLamp = level;
          lastAnswer = ans;
          glow(lamp6, level / 255);
          glow(answer6, ans ? 1 : 0);
          setLabel(lampTag, `level ${level}`);
          stage.invalidate();
        }
        if (onBoard === 'delay') {
          const c = t % P;
          const looking = t > 2000 && (t - checkBefore(t) < 140) ? 'look' : c < 1280 ? 'busy' : 'busy2';
          code.querySelectorAll('.cb-line').forEach((el) => el.classList.toggle('on', el.dataset.l === looking));
        }
      }
      drawTimeline(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function cssVar(name, fb) {
    const v = getComputedStyle(host).getPropertyValue(name).trim();
    return v || fb;
  }
  function drawTimeline(t) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const Wd = canvas.clientWidth, Hd = canvas.clientHeight;
    if (!Wd) return;
    if (canvas.width !== Math.round(Wd * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = cssVar('--lab-ink', '#24182E'), muted = cssVar('--lab-muted', '#655C6E'), line = cssVar('--lab-line', '#E4DEE9');
    const gold = '#FFBE00', red = cssVar('--lab-accent', '#CA1F3F'), good = cssVar('--lab-good', '#1F8A70');
    g.clearRect(0, 0, Wd, Hd);
    const span = 8000;
    const L = Math.min(118, Wd * 0.3), R = Wd - 10;
    const X = (tt) => L + ((tt - (t - span)) / span) * (R - L);
    const rows = { d: 26, m: 82, p: 138 };
    g.font = `600 12px ${cssVar('--lab-font', 'Rubik, sans-serif')}`;
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    g.fillText('b5_03 · delay', 6, rows.d);
    g.fillText('b5_04 · millis', 6, rows.m);
    g.fillText('your button', 6, rows.p);
    g.fillStyle = muted;
    g.font = `11px ${cssVar('--lab-font', 'Rubik, sans-serif')}`;
    g.fillText(onBoard === 'delay' ? 'on the board' : '', 6, rows.d + 15);
    g.fillText(onBoard === 'millis' ? 'on the board' : '', 6, rows.m + 15);
    // b5_03: busy inside delay(20) for 2.56 s, then one look
    for (let k = Math.floor((t - span) / P); k * P <= t; k++) {
      const a = Math.max(k * P, t - span, 0), b = Math.min((k + 1) * P, t);
      if (b <= a) continue;
      g.fillStyle = 'rgba(90,68,112,0.30)';
      g.fillRect(X(a), rows.d - 11, Math.max(0, X(b) - X(a) - 1), 22);
      if ((k + 1) * P <= t && (k + 1) * P >= t - span) {
        const x = X((k + 1) * P);
        g.fillStyle = gold;
        g.fillRect(x - 1.5, rows.d - 15, 3, 30);
      }
    }
    if (Wd > 380) { g.fillStyle = muted; g.fillText('delay(20) × 128: not looking', Math.max(L + 6, X(Math.max(0, t - span)) + 6), rows.d); }
    // b5_04: looks every round, thousands of times a second
    const m0 = Math.max(0, t - span);
    g.fillStyle = gold;
    for (let x = X(m0); x < X(t); x += 3) g.fillRect(x, rows.m - 11, 1.2, 22);
    // presses
    for (const p of presses) {
      const a = p.down, b = p.up ?? t;
      if (b < t - span) continue;
      g.fillStyle = red;
      g.fillRect(X(Math.max(a, t - span)), rows.p - 9, Math.max(2, X(b) - X(Math.max(a, t - span))), 18);
      if (p.up !== null && a >= t - span) {
        const x = (X(a) + X(b)) / 2;
        g.font = `700 15px ${cssVar('--lab-font', 'Rubik, sans-serif')}`;
        g.textAlign = 'center';
        g.fillStyle = p.delaySaw ? good : red;
        g.fillText(p.delaySaw ? '✓' : '✗', x, rows.d + 25);
        g.fillStyle = good;
        g.fillText('✓', x, rows.m + 25);
        g.textAlign = 'left';
      }
    }
    // now
    g.strokeStyle = line;
    g.beginPath(); g.moveTo(R, 6); g.lineTo(R, Hd - 6); g.stroke();
    g.fillStyle = muted;
    g.font = `11px ${cssVar('--lab-font', 'Rubik, sans-serif')}`;
    g.textAlign = 'right';
    g.fillText('now', R - 3, Hd - 10);
    g.fillText('8 seconds ago', L + 70, Hd - 10);
    g.textAlign = 'left';
  }

  // ======================================================= modes and words
  function setMode(m) {
    mode = m;
    tm.reset();
    run = 'stop';
    stepper = null;
    follow = null;
    which = null;
    calledFrom = null;
    pc = 'c0';
    lightsOff();
    if (held) press(false);
    W4.world.visible = m === 'fn';
    W6.world.visible = m === 'timing';
    tlBox.hidden = m !== 'timing';
    canvas.setAttribute('aria-label', 'Timeline of the last eight seconds: b5_03 spends 2.56 seconds inside delay and looks at the button once; b5_04 looks thousands of times a second.');
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
    if (m === 'fn') { right.innerHTML = ''; renderFn(); renderVars(''); glow(lamp6, 0); glow(answer6, 0); }
    else { restartTiming(); startRaf(); }
    const focus = m === 'fn' ? W4.L.hole('h21') : W6.L.hole('h11');
    // Part 5's board is framed whole; Parts 6 and 7 look closer at the button and lamp.
    if (m === 'fn') stage.view.reset();
    else stage.lookAt(focus.clone().setY(0), 1.35);
    explain();
    stage.invalidate();
  }

  function explain() {
    if (mode === 'fn') {
      ui.info('Part 5: your own instruction', `<p><code>playStep</code> is a function: a named group of lines. Writing <code>playStep(2)</code> <b>calls</b> it. The board remembers where it was in <code>loop</code>, puts 2 into <code>which</code>, runs the lines, and at the closing bracket goes back to the line after the call.</p>
        <p>The same seven lines do a different job each time, depending on the number you hand them. The 400 lives in one place only.</p>
        <p class="lab-tip">Change a number in <code>notes</code> or the <code>delay</code> in the code, then run it again.</p>`);
    } else if (onBoard === 'delay') {
      ui.info('b5_03: the board is busy', `<p>Count the delays: two <code>for</code> loops, 128 rounds of <code>delay(20)</code>, about <b>two and a half seconds</b> doing nothing. The button is checked once, at the very bottom.</p>
        <p>A press has to still be held at that one instant to be seen, so most presses are missed. When one is seen, the answer light stays on until the next look.</p>`);
    } else {
      ui.info('b5_04: waiting without stopping', `<p>Instead of stopping until it is time, it keeps running and keeps asking: <code>if (now - lastFadeTime >= fadeGap)</code>. One step of the fade, then out.</p>
        <p>Everything below the <code>if</code> runs on every round, thousands of times a second, so every press is seen at once, even in the middle of a fade.</p>`);
    }
  }

  const g1 = ui.group('Which part of the band?');
  const modeBtns = [
    ui.button('b5_02: your own function (Part 5)', () => setMode('fn'), { group: g1, pressed: true }),
    ui.button('b5_03 and b5_04: delay against millis (Parts 6 and 7)', () => setMode('timing'), { group: g1, pressed: false }),
  ];
  modeBtns[0].dataset.m = 'fn';
  modeBtns[1].dataset.m = 'timing';
  const g2 = ui.group('Sound');
  ui.button('Buzzer sound on', (b) => { sound.set(!sound.on); b.setAttribute('aria-pressed', String(sound.on)); b.textContent = sound.on ? 'Buzzer sound on' : 'Buzzer sound off'; }, { group: g2, pressed: true });
  ui.element('<p class="lab-tip">The sound is your computer playing the same note the buzzer would. A passive buzzer sounds harsher.</p>');

  // the model's button and the keyboard
  holdable(stage, host, [{ obj: btn6.group, id: 0 }], { down: () => press(true), up: () => press(false) });
  W.onKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) press(true); return true; }
    return false;
  };
  host.querySelector('.lab-canvas').addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') press(false); });

  // dark mode: the "ink" wires follow the page's text colour
  new MutationObserver(() => setTimeout(() => {
    const c = getComputedStyle(host).color.match(/\d+/g);
    if (c) { let [r, gg, b] = c.map(Number); if ((0.3 * r + 0.59 * gg + 0.11 * b) / 255 < 0.2) [r, gg, b] = [43, 47, 49]; [...W4.inkMats, ...W6.inkMats].forEach((m) => m.color.setRGB(r / 255, gg / 255, b / 255, THREE.SRGBColorSpace)); }
    stage.invalidate();
  }, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  setMode('fn');
  host.labDebug = { setMode, setRun, press, presses, notes, get pc() { return pc; } };
}

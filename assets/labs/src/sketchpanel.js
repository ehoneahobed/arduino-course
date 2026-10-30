// The real sketch runner for the concept labs ("Try it in 3D").
//
// The same engine as a build's "Run the sketch" (sim.js), made small enough
// to drop into a lab whose 3D model is not a wiring build:
//   - the course's sketch, compiled for the Uno's chip (assets/labs/hex/),
//     runs on an emulated ATmega328P (uno.js, avr8js) at the chip's own speed
//   - the Code tab holds the editor; an edited sketch is checked and run by
//     the course's own Arduino C++ interpreter (cpp-compile.js, vboard.js),
//     exactly as in the build viewer, and kept in the same place in the
//     browser (localStorage "ard-sketch-edit:<sketch>"), so a learner's
//     edited b0_02 shows in both
//   - Run / Pause, Stop (unplug) and Reset, with the coloured state dot, in
//     three places that stay in step: the Explore tab, pinned at the top of
//     the Code tab, and a compact bar on the 3D view itself (so in full
//     screen they are never hidden away)
// The lab says what the pins mean in its own model (opts.paint), what the
// world puts on the inputs (opts.inputs), and when uploading is impossible
// (opts.canUpload: on a phone charger no program can arrive).
//
//   const sk = sketchPanel(stage, ui, host, {
//     sketches: ['b0_01_blink_given', 'b0_02_signature_worked'],
//     leds: W.uno.leds,                 // the 3D Uno's L, TX, RX and ON lights
//     paint(S, uno, dt) { ...; return dirty },   // S[pin] = { mode, level, duty, hz, pulseUs }
//     inputs(uno) { uno.setInput(2, pressed ? 0 : 1) },
//     onState(st) {},                   // { powered, running, mode, sketch, why }
//   });
//   sk.choose(name), sk.start(), sk.pause(), sk.unplug(), sk.reset(), sk.upload(), sk.verify(), sk.back()
import { Uno, HZ, PinState, decodeProgram } from './uno.js';
import { icon } from './runtime.js';
import { compileSketch } from './cpp-compile.js';
import { VBoard } from './vboard.js';
import { codeEditor } from './editor.js';
import { loadSketch } from './sim.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const OUT = (m) => m === PinState.High || m === PinState.Low;
export { PinState };

// The same key as the build viewer (sim.js), so an edit made in one shows in the other.
const keyOf = (n) => `ard-sketch-edit:${n}`;
export const loadEdit = (n) => { try { return localStorage.getItem(keyOf(n)); } catch { return null; } };
const saveEdit = (n, t) => { try { if (t === null) localStorage.removeItem(keyOf(n)); else localStorage.setItem(keyOf(n), t); } catch {} };

const CSS = `
.sp { display: flex; flex-direction: column; gap: 9px; width: 100%; }
.sp-which { margin: 0; font-size: 13px; line-height: 1.45; color: var(--lab-text); }
.sp-which b { color: var(--lab-ink); font-weight: 600; }
.sp-which code { font: 600 12.5px/1.3 var(--lab-mono); color: var(--lab-ink); overflow-wrap: anywhere; }
.sp-which small { display: block; color: var(--lab-muted); font-size: 12px; margin-top: 2px; }
.sp-pick { font-size: 13px; color: var(--lab-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sp-pick select { font: 500 13px/1.3 var(--lab-mono); color: var(--lab-ink); background: var(--lab-paper); border: 1.5px solid var(--lab-line); border-radius: 8px; padding: 5px 8px; min-width: 0; flex: 1; max-width: 100%; }
.sp-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sp-bar .lab-btn { display: inline-flex; align-items: center; gap: 6px; }
.sp-bar .lab-btn .lab-ico { width: 15px; height: 15px; }
.sp-bar .sp-run .lab-ico { fill: currentColor; }
.sp-power { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--lab-muted); margin-left: auto; font-variant-numeric: tabular-nums; min-width: 0; }
.sp-power i { flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--lab-line); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-line); }
.sp-power[data-s="run"] { color: var(--lab-good); }
.sp-power[data-s="run"] i { background: var(--lab-good); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-good); }
.sp-power[data-s="pause"] { color: var(--lab-gold-ink); }
.sp-power[data-s="pause"] i { background: var(--lab-gold); box-shadow: 0 0 0 2px var(--lab-paper), 0 0 0 3px var(--lab-gold); }
.sp-code .ed-ta, .sp-code .sp-edbar .lab-btn, .sp-code .sp-msg, .sp-code .lab-ed { scroll-margin-top: 64px; }
.sp-name { flex: 1 1 100%; font-size: 12px; color: var(--lab-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-name code { font: 600 12px/1.3 var(--lab-mono); color: var(--lab-ink); }
.sp-pin { position: static; z-index: 3; background: var(--lab-paper); margin: -2px -2px 8px; padding: 8px 2px; border-bottom: 1px solid var(--lab-line); }
.sp-pin.sp-stick { position: sticky; top: 0; }
.sp-err { border: 1.5px solid var(--lab-accent); border-radius: 10px; padding: 8px 10px; background: rgba(202, 31, 63, 0.06); font-size: 13px; line-height: 1.45; }
.sp-err pre { margin: 6px 0 0; font: 12px/1.45 var(--lab-mono); white-space: pre-wrap; color: var(--lab-ink); }
.sp-note { border: 1.5px solid var(--lab-gold); border-radius: 10px; padding: 7px 10px; background: rgba(255, 190, 0, 0.1); font-size: 13px; line-height: 1.45; }
.sp .lab-link-btn, .sp-msg .lab-link-btn, .sp-which .lab-link-btn { font: inherit; color: var(--lab-accent); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.sp-edbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.sp-edbar .lab-btn { display: inline-flex; align-items: center; gap: 6px; }
.sp-edbar .lab-btn .lab-ico { width: 15px; height: 15px; }
.sp-msg { margin-top: 8px; font-size: 13px; line-height: 1.45; }
.sp-msg:empty { display: none; }
.sp-msg p { margin: 0 0 4px; }
.sp-msg .ok { color: var(--lab-good); font-weight: 600; }
.sp-msg .bad { color: var(--lab-accent); font-weight: 600; }
.sp-msg ul { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.sp-msg li { border: 1.5px solid var(--lab-accent); border-radius: 10px; padding: 7px 10px; background: rgba(202, 31, 63, 0.06); }
.sp-msg li.warn { border-color: var(--lab-gold); background: rgba(255, 190, 0, 0.1); }
.sp-msg li code, .sp-msg pre { font: 12px/1.45 var(--lab-mono); color: var(--lab-ink); white-space: pre-wrap; word-break: break-word; display: block; margin: 0; }
.sp-msg small { display: block; margin-top: 3px; color: var(--lab-text); }
.sp-hint { margin: 6px 0 0; font-size: 12px; color: var(--lab-muted); }
.sp-real { margin: 6px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--lab-muted); }
.sp-mon { border: 1px solid var(--lab-line); border-radius: 10px; background: var(--lab-panel); padding: 8px 10px; }
.sp-mon h5 { margin: 0 0 6px; font: 700 11.5px/1.2 var(--lab-font); text-transform: uppercase; letter-spacing: 0.12em; color: var(--lab-muted); display: flex; gap: 8px; align-items: center; }
.sp-mon h5 span { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 500; }
.sp-log { font: 12.5px/1.45 var(--lab-mono); background: var(--lab-paper); color: var(--lab-ink); border: 1px solid var(--lab-line); border-radius: 8px; height: 120px; overflow: auto; padding: 6px 9px; white-space: pre; margin: 0; }
.sp-log:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 1px; }
.sp-send { display: flex; gap: 6px; margin-top: 6px; }
.sp-send input { flex: 1; min-width: 0; font: 12.5px/1.3 var(--lab-mono); padding: 5px 8px; border: 1.5px solid var(--lab-line); border-radius: 8px; background: var(--lab-paper); color: var(--lab-ink); }
.sp-float { position: absolute; left: 12px; top: 12px; z-index: 5; display: flex; align-items: center; gap: 2px; padding: 4px 6px 4px 4px; background: var(--lab-card); border: 1px solid var(--lab-line); border-radius: 14px; box-shadow: var(--lab-shadow); max-width: calc(100% - 24px); }
.lab-fs .sp-float { top: 66px; }
.sp-float button { display: inline-flex; align-items: center; gap: 6px; height: 34px; min-width: 34px; padding: 0 9px; border: 0; border-radius: 10px; background: transparent; color: var(--lab-ink); font: 600 13px/1 var(--lab-font); cursor: pointer; }
.sp-float button .lab-ico { width: 17px; height: 17px; }
.sp-float button:hover:not(:disabled) { background: var(--lab-tint); }
.sp-float button:disabled { opacity: 0.4; cursor: default; }
.sp-float button:focus-visible { outline: 3px solid var(--lab-gold); outline-offset: 1px; }
.sp-float .sp-run { background: var(--lab-good); color: #fff; }
.sp-float .sp-run .lab-ico { fill: currentColor; }
.sp-float .sp-run:hover:not(:disabled) { background: var(--lab-good); filter: brightness(1.08); }
.sp-float .sp-run[data-on="1"]:hover:not(:disabled) { background: var(--lab-gold); }
.sp-float .sp-run[data-on="1"] { background: var(--lab-gold); color: #24182e; }
.sp-float .sp-power { margin: 0 4px 0 6px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 16em; }
.sp-float .sp-stop span, .sp-float .sp-reset span { display: none; }
@container (max-width: 520px) { .sp-float .sp-power .sp-state { display: none; } .sp-float .sp-run span { display: none; } }
.sp-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
let cssDone = false;
function addCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function sketchPanel(stage, ui, host, opts = {}) {
  addCss();
  const {
    sketches,
    title = 'Run the real sketch',
    leds = null, // the 3D Uno's own lights: { L, TX, RX, ON } with set(on, k)
    paint = null,
    inputs = null,
    wire = null, // (uno) => {}: hook up devices to a fresh board
    onState = null,
    onCompile = null,
    canUpload = null,
    beforeUpload = null, // async: an upload's journey, before the new sketch starts
    picker = sketches.length > 1,
    loadOnChoose = true, // choosing a sketch also puts the course's version on the board
    group = null, // put the Explore part in this group instead of a new one
    floating = true,
    explain = null, // extra words under "On the board"
    serial = null, // (text) => {}: the sketch's serial output goes to the lab's own monitor instead
    serialNote = null, // (words) => {}: plugged in, unplugged, reset… for the lab's own monitor
  } = opts;
  const controls = host.querySelector('.lab-controls');

  // ---------- the run bar (made three times; they stay in step) ----------
  const bars = [];
  function makeBar(cls = '') {
    const b = document.createElement('div');
    b.className = 'sp-bar ' + cls;
    b.setAttribute('role', 'group');
    b.setAttribute('aria-label', 'The board: run, stop, reset');
    b.innerHTML = `<button type="button" class="${cls.includes('sp-float') ? '' : 'lab-btn primary '}sp-run" disabled>${icon('play')}<span>Run</span></button><button type="button" class="${cls.includes('sp-float') ? '' : 'lab-btn '}sp-stop" disabled aria-label="Stop: unplug the board" title="Stop: unplug the board">${icon('stop')}<span>Stop</span></button><button type="button" class="${cls.includes('sp-float') ? '' : 'lab-btn '}sp-reset" disabled aria-label="Reset: start the sketch again, still plugged in" title="Reset: start the sketch again">${icon('turnL')}<span>Reset</span></button><span class="sp-power" data-s="off"><i aria-hidden="true"></i><span class="sp-state">Loading the sketch…</span></span>`;
    b.querySelector('.sp-run').addEventListener('click', () => (running ? pause() : start('run')));
    b.querySelector('.sp-stop').addEventListener('click', () => unplug('stop'));
    b.querySelector('.sp-reset').addEventListener('click', () => reset(true));
    bars.push(b);
    return b;
  }

  // ---------- Explore: what is on the board, the bar, the picker ----------
  const g = group || document.createElement('div');
  if (!group) {
    g.className = 'lab-group lab-sim';
    g.innerHTML = `<span class="lab-group-title">${title}</span>`;
    controls.prepend(g);
  }
  const box = document.createElement('div');
  box.className = 'sp';
  g.appendChild(box);
  const whichEl = document.createElement('p');
  whichEl.className = 'sp-which';
  box.appendChild(whichEl);
  box.appendChild(makeBar());
  const said = document.createElement('span');
  said.className = 'sp-sr';
  said.setAttribute('aria-live', 'polite');
  box.appendChild(said);
  let sel = null;
  if (picker) {
    const lab = document.createElement('label');
    lab.className = 'sp-pick';
    lab.innerHTML = `Sketch <select aria-label="Which sketch">${sketches.map((n) => `<option value="${n}">${n}.ino</option>`).join('')}</select>`;
    box.appendChild(lab);
    sel = lab.querySelector('select');
    sel.addEventListener('change', () => choose(sel.value));
  }
  const errBox = document.createElement('div');
  errBox.className = 'sp-err';
  errBox.hidden = true;
  errBox.setAttribute('role', 'alert');
  box.appendChild(errBox);
  const noteBox = document.createElement('div');
  noteBox.className = 'sp-note';
  noteBox.hidden = true;
  noteBox.setAttribute('role', 'status');
  box.appendChild(noteBox);
  const mon = document.createElement('div');
  mon.className = 'sp-mon';
  mon.hidden = true;
  mon.innerHTML = `<h5>Serial monitor <span>9600 baud</span></h5><pre class="sp-log" role="log" aria-live="off" aria-label="Serial monitor: what the sketch prints" tabindex="0"></pre><form class="sp-send"><input type="text" aria-label="Text to send to the board" placeholder="Send to the board" autocomplete="off" spellcheck="false"><button type="submit" class="lab-btn">Send</button><button type="button" class="lab-btn sp-clear">Clear</button></form>`;
  box.appendChild(mon);
  const logEl = mon.querySelector('.sp-log');

  // ---------- the Code tab: pinned bar, editor, Verify / Upload / Back ----------
  const codeGroup = ui.group('', { tab: 'code' });
  const pane = codeGroup.parentNode;
  pane.prepend(codeGroup); // first in the Code tab, above any of the lab's own code boxes
  codeGroup.classList.add('sp-code');
  const pin = makeBar('sp-pin');
  const pinName = document.createElement('span');
  pinName.className = 'sp-name';
  pin.prepend(pinName);
  codeGroup.appendChild(pin);
  stickWhenRoomy(pin);
  const whichCode = document.createElement('p');
  whichCode.className = 'sp-which';
  whichCode.style.margin = '0 0 8px';
  codeGroup.appendChild(whichCode);
  let codePicker = null;
  if (picker) {
    const lab = document.createElement('label');
    lab.className = 'sp-pick';
    lab.style.marginBottom = '8px';
    lab.innerHTML = `Sketch <select aria-label="Which sketch to open">${sketches.map((n) => `<option value="${n}">${n}.ino</option>`).join('')}</select>`;
    codeGroup.appendChild(lab);
    codePicker = lab.querySelector('select');
    codePicker.addEventListener('change', () => choose(codePicker.value));
  }
  const code = codeEditor(codeGroup, { file: sketches[0] + '.ino', text: '// loading…', label: 'The sketch. You can change it, then press Upload and run.', onInput: (t) => edited(t) });
  const edBar = document.createElement('div');
  edBar.className = 'sp-edbar';
  edBar.innerHTML = `<button type="button" class="lab-btn sp-verify" title="Check the code. Nothing is sent to the board.">${icon('check')}<span>Verify</span></button><button type="button" class="lab-btn primary sp-upload" title="Check the code, send it to the board and start it">${icon('play')}<span>Upload and run</span></button><button type="button" class="lab-btn sp-back" disabled>Back to the course’s sketch</button>`;
  codeGroup.appendChild(edBar);
  const edMsg = document.createElement('div');
  edMsg.className = 'sp-msg';
  edMsg.setAttribute('role', 'status');
  edMsg.id = 'spmsg-' + Math.random().toString(36).slice(2, 8);
  codeGroup.appendChild(edMsg);
  code.describedBy(edMsg.id);
  const edHint = document.createElement('p');
  edHint.className = 'sp-hint';
  edHint.textContent = 'Tab indents. To leave the box with the keyboard, press Esc, then Tab. Your changes stay on this computer, and show in this sketch’s other 3D views too.';
  codeGroup.appendChild(edHint);
  const built = document.createElement('p');
  built.className = 'sp-real';
  codeGroup.appendChild(built);
  const edVerify = edBar.querySelector('.sp-verify'), edUpload = edBar.querySelector('.sp-upload'), edBack = edBar.querySelector('.sp-back');
  ui.refreshTabs();

  // ---------- the bar on the 3D view ----------
  let floatBar = null;
  if (floating) {
    floatBar = makeBar('sp-float');
    floatBar.setAttribute('aria-label', 'The board (the sketch in the Code tab)');
    host.querySelector('.lab-canvas')?.appendChild(floatBar);
  }

  // ---------- state ----------
  let current = sketches[0]; // the sketch open in the editor
  let token = 0;
  let courseRec = null; // the course's compiled version of the open sketch
  let rec = null; // what is on the board: { ok, interp?, js?, program?, source, name }
  let mode = 'course'; // 'course' (compiled) or 'edited' (interpreted)
  let onBoard = null; // the sketch name whose program is on the board
  let uno = null;
  let running = false;
  let powered = false;
  let busy = false; // uploading
  let S = null;

  const fileName = (n) => n + '.ino';
  function tell(why) { onState?.({ powered, running, mode, sketch: onBoard, open: current, why, rec }); }
  function say(t) { if (said.textContent !== t) said.textContent = t; }

  function showWhich() {
    let what;
    if (!rec) what = courseRec && !courseRec.ok && onBoard === null ? '<b>nothing yet</b>' : '<b>nothing yet</b>';
    else if (mode === 'edited') what = `<b>your edited</b> <code>${fileName(onBoard)}</code>, run by the course’s interpreter`;
    else what = `<code>${fileName(onBoard)}</code>, the course’s sketch, compiled for the real chip`;
    whichEl.innerHTML = `On the board: ${what}.${explain ? ` <small>${explain}</small>` : ''} <button type="button" class="lab-link-btn" data-act="code">${mode === 'edited' ? 'See it' : 'Change it'} in the Code tab</button>`;
    const pending = courseRec && rec && (current !== onBoard || code.value !== rec.source);
    pinName.innerHTML = rec ? `On the board: <code>${fileName(onBoard)}</code>${mode === 'edited' ? ', your edited version' : ', the course’s sketch'}` : 'On the board: nothing yet';
    if (floatBar) floatBar.title = pinName.textContent;
    whichCode.innerHTML = `On the board: ${what}.${pending ? ` <b>The text below is not on the board yet:</b> press Upload and run.` : ''}`;
    edBack.disabled = !courseRec || (code.value === courseRec.source && !(mode === 'edited' && onBoard === current));
  }
  whichEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) { ui.tab('code'); code.textarea.focus({ preventScroll: true }); }
  });
  function edited(t) {
    if (!courseRec) return;
    saveEdit(current, t === courseRec.source ? null : t);
    showWhich();
  }
  function note(html) { noteBox.hidden = !html; noteBox.innerHTML = html || ''; }
  const usesSerial = (src) => /\bSerial\s*\.\s*(begin|print|write)/.test(src || '');

  function setState(text, s = powered ? (running ? 'run' : 'pause') : 'off') {
    for (const b of bars) {
      b.querySelector('.sp-state').textContent = text;
      b.querySelector('.sp-power').dataset.s = s;
    }
  }
  const clockOf = () => { const t = uno ? uno.seconds : 0; return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
  function showRun() {
    const can = !!rec?.ok && !busy;
    for (const b of bars) {
      const r = b.querySelector('.sp-run');
      const label = running ? 'Pause' : powered && uno && uno.seconds > 0 ? 'Carry on' : 'Run';
      r.innerHTML = `${icon(running ? 'pause' : 'play')}<span>${label}</span>`;
      r.dataset.on = running ? '1' : '0';
      r.setAttribute('aria-label', running ? 'Pause: freeze the sketch where it is' : powered ? 'Carry on: run from where it paused' : 'Run: plug the board in and start the sketch');
      r.title = r.getAttribute('aria-label');
      r.disabled = !can;
      b.querySelector('.sp-stop').disabled = !powered || busy;
      b.querySelector('.sp-reset').disabled = !powered || !can;
    }
  }

  // ---------- the board's lights ----------
  function powerLeds(on) {
    if (!leds) return;
    leds.ON?.set(on, 1);
    if (!on) { leds.L?.set(false); leds.TX?.set(false); leds.RX?.set(false); }
    stage.invalidate();
  }
  let txFlash = 0, rxFlash = 0;

  // ---------- serial ----------
  let logText = '', pendingText = '';
  function flushLog() {
    if (!pendingText) return;
    if (serial) { const t = pendingText; pendingText = ''; serial(t); return; }
    const atEnd = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    logText += pendingText;
    pendingText = '';
    if (logText.length > 6000) logText = logText.slice(logText.length - 5000).replace(/^[^\n]*\n/, '');
    logEl.textContent = logText;
    if (atEnd) logEl.scrollTop = logEl.scrollHeight;
  }
  function sysLine(t) {
    if (serial) { serialNote?.(t); return; }
    if (mon.hidden) return;
    flushLog();
    if (logText && !logText.endsWith('\n')) logText += '\n';
    logText += `— ${t} —\n`;
    logEl.textContent = logText;
    logEl.scrollTop = logEl.scrollHeight;
  }
  mon.querySelector('.sp-clear').addEventListener('click', () => { logText = ''; pendingText = ''; logEl.textContent = ''; });
  mon.querySelector('.sp-send').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input');
    if (!uno || !powered) return;
    uno.send(inp.value + '\n');
    rxFlash = 3;
    inp.value = '';
  });

  // ---------- loading a sketch into the editor (and maybe onto the board) ----------
  function compiledWords(r) {
    return r.ok
      ? `The course’s sketch is compiled for the Uno (${r.compiler}) into ${r.flash} bytes of program and ${r.ram} bytes of memory, and runs instruction by instruction on an emulated chip.`
      : `The course’s sketch does not compile (${r.compiler}), so it cannot go on the board as it is.`;
  }
  function choose(name, { load = loadOnChoose } = {}) {
    current = name;
    if (sel) sel.value = name;
    if (codePicker) codePicker.value = name;
    const my = ++token;
    edMsg.innerHTML = '';
    code.set('// loading…', fileName(name));
    return loadSketch(name).then((r) => {
      if (my !== token) return;
      courseRec = r;
      const saved = loadEdit(name);
      code.set(saved ?? r.source, fileName(name));
      note(saved !== null && saved !== r.source ? `Your own version of <code>${fileName(name)}</code>, from last time, is in the <b>Code</b> tab. ${load ? 'The board has the course’s sketch until you press <b>Upload and run</b> there.' : 'Press <b>Upload and run</b> to send it.'} <button type="button" class="lab-link-btn" data-act="course">Use the course’s sketch</button>` : '');
      built.textContent = compiledWords(r);
      if (load) putCourse(false);
      if (!r.ok) {
        const m = /\.ino:(\d+):\d+: error/.exec(r.error);
        if (m && code.value === r.source) code.mark(+m[1], 'err');
      }
      showWhich();
      showRun();
      tell('choose');
    }, () => {
      if (my !== token) return;
      setState('The sketch could not load', 'off');
      code.set('// This sketch could not load. Reload the page and try again.', fileName(name));
    });
  }
  noteBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="course"]');
    if (b) backToCourse();
    const l = e.target.closest('[data-line]');
    if (l) { ui.tab('code'); code.goto(+l.dataset.line); }
  });
  // the course's compiled sketch onto the board (unplugged, as sim.js does: Run plugs it in)
  function putCourse(keepPower) {
    halt();
    errBox.hidden = true;
    if (!courseRec.ok) {
      rec = null; onBoard = null; uno = null; mode = 'course';
      if (!keepPower) powered = false;
      powerLeds(powered);
      errBox.hidden = false;
      const m = /\.ino:(\d+):\d+: error: ([^\n]*)/.exec(courseRec.error);
      errBox.innerHTML = `<b>This sketch does not compile, on purpose.</b> The Arduino software stops before uploading anything. This is what the compiler really said:<pre>${esc(courseRec.error)}</pre>${m ? `<small>Line ${m[1]} is marked in the Code tab. The fault is usually at the end of the line before it.</small>` : ''}`;
      setState('Nothing to run', 'off');
      showRun();
      return;
    }
    rec = courseRec; onBoard = current; mode = 'course';
    mon.hidden = !!serial || !usesSerial(rec.source);
    if (!keepPower) powered = false;
    reset(false);
  }

  // ---------- the program on the board, and its three states ----------
  function makeBoard() {
    if (rec.interp) return new VBoard(rec.js, { onError: runtimeError, onWarn: runtimeWarn });
    return new Uno(decodeProgram(rec.program));
  }
  function onPins() { if (uno && inputs) inputs(uno); }
  let lastRunLine = 0;
  function reset(noteIt = true) {
    if (!rec?.ok) return;
    const was = running;
    halt();
    uno = makeBoard();
    uno.usart.onByteTransmit = (b) => { pendingText += String.fromCharCode(b); txFlash = 3; };
    uno.onChange = onPins;
    wire?.(uno);
    onPins();
    S = uno.sample();
    lastRunLine = 0;
    code.clear('run');
    if (rec.interp) errBox.hidden = true;
    paintOutputs(0);
    if (noteIt && powered) { sysLine('reset'); say('Reset: the sketch starts again from the top.'); }
    if (was) start('reset');
    powerLeds(powered);
    showRun();
    if (!running) setState(powered ? `Paused · ${clockOf()}` : 'Unplugged');
    tell('reset');
  }
  function unplug(why = 'stop') {
    const was = powered;
    halt();
    powered = false;
    if (rec?.ok) reset(false); else uno = null;
    powerLeds(false);
    paint?.(null, null, 0); // the lab's own outputs go dark
    stage.invalidate();
    if (was) { sysLine('unplugged'); say('Stopped. The board is unplugged.'); }
    setState('Unplugged', 'off');
    showRun();
    tell(why);
  }
  function start(why = 'run') {
    if (!rec?.ok || running || busy) return;
    if (!uno || uno.halted) reset(false);
    running = true;
    if (!powered) {
      powered = true;
      powerLeds(true);
      sysLine('plugged in');
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
    showRun();
    setState(`Running · ${clockOf()}`, 'run');
    say('Running.');
    tell(why);
  }
  function halt() {
    running = false;
    cancelAnimationFrame(raf);
    showRun();
  }
  function pause() {
    if (!running) return;
    halt();
    setState(`Paused · ${clockOf()}`, 'pause');
    say('Paused.');
    tell('pause');
  }
  // power taken away and given back (a different cable, a different socket)
  function powerCycle(why = 'power') {
    if (!rec?.ok) { powered = false; return; }
    halt();
    powered = false;
    reset(false);
    start(why);
  }

  // ---------- the clock: real time, in frame-sized slices ----------
  let raf = 0, last = 0, speed = 1, seenAt = 0, visible = true;
  const low = stage.lowPower;
  function onScreen(now) {
    if (now - seenAt < 250) return visible;
    seenAt = now;
    if (host.hidden || !host.isConnected) return (visible = false);
    if (host.classList.contains('lab-full') || host.classList.contains('lab-fs')) return (visible = true);
    const r = host.getBoundingClientRect();
    visible = r.width > 0 && r.bottom > 40 && r.top < (window.innerHeight || 800) - 40;
    return visible;
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (!onScreen(now) || document.hidden) { setState('Paused while out of sight', 'pause'); return; }
    dt = Math.min(dt, 250);
    const want = Math.round(dt * (HZ / 1000));
    const c0 = uno.cpu.cycles;
    if (inputs) inputs(uno);
    uno.run(want, now + clamp(dt * 0.5, low ? 8 : 10, 60));
    speed = speed * 0.9 + 0.1 * ((uno.cpu.cycles - c0) / Math.max(1, want));
    paintOutputs(dt);
    flushLog();
    if (rec.interp && uno.line && uno.line !== lastRunLine && current === onBoard && now - (frame.lineAt || 0) > 200) { lastRunLine = uno.line; frame.lineAt = now; code.mark(uno.line, 'run'); }
    const clock = clockOf();
    setState(speed < 0.85 ? `Running · ${clock} · ${Math.round(speed * 100)}% speed here` : `Running · ${clock}`, 'run');
  }
  const prev = {};
  let drawWanted = false, lastDraw = 0;
  function paintOutputs(dt) {
    if (!uno) return;
    S = uno.sample();
    let dirty = false;
    if (leds && powered) {
      const l13 = OUT(S[13].mode) ? S[13].duty : 0;
      if (prev.L === undefined || Math.abs(prev.L - l13) > 0.02) { prev.L = l13; leds.L?.set(l13 > 0.01, l13); dirty = true; }
      if (txFlash > 0) txFlash--;
      if (rxFlash > 0) rxFlash--;
      const tx = txFlash > 0, rx = rxFlash > 0;
      if (prev.TX !== tx) { prev.TX = tx; leds.TX?.set(tx, 1); dirty = true; }
      if (prev.RX !== rx) { prev.RX = rx; leds.RX?.set(rx, 1); dirty = true; }
    }
    if (paint && powered && paint(S, uno, dt)) dirty = true;
    const t = performance.now();
    if (dirty) drawWanted = true;
    if (drawWanted && (!low || t - lastDraw > 120)) { stage.invalidate(); drawWanted = false; lastDraw = t; }
  }

  // ---------- Verify, Upload, Back ----------
  function listOf(items) {
    return items.length ? `<ul>${items.map((e) => `<li class="${e.warn ? 'warn' : ''}"><code>${esc(e.text)}</code>${e.note ? `<small>${esc(e.note)}</small>` : ''}${e.line ? `<button type="button" class="lab-link-btn" data-line="${e.line}">Show line ${e.line}</button>` : ''}</li>`).join('')}</ul>` : '';
  }
  // Check the text in the editor. The course's own text is checked by the real
  // compiler (its result is stored); anything else by the interpreter.
  function check() {
    const src = code.value;
    if (courseRec && src === courseRec.source) {
      if (courseRec.ok) return { ok: true, course: true, errors: [], warnings: [] };
      const lines = courseRec.error.split('\n');
      const m = /\.ino:(\d+):(\d+): error: ([^\n]*)/.exec(courseRec.error);
      return { ok: false, course: true, errors: [{ line: m ? +m[1] : 0, text: lines.filter((l) => /error:/.test(l)).join('\n') || courseRec.error }], warnings: [], full: courseRec.error };
    }
    return compileSketch(src, current);
  }
  function showCheck(c, uploading) {
    code.clear('err');
    if (c.ok) {
      const items = (c.warnings || []).slice(0, 3).map((w) => ({ ...w, warn: true }));
      const size = c.course ? ` Sketch uses ${courseRec.flash} bytes of program storage space and ${courseRec.ram} bytes of memory.` : '';
      edMsg.innerHTML = `<p class="ok">${uploading ? 'Done uploading.' : 'Done compiling: no errors.'}</p><p>${uploading ? 'The board started it straight away: <code>setup</code> once, then <code>loop</code> over and over.' : 'Nothing happens on the board: Verify only checks the code.'}${size}</p>${items.length ? `<p>${items.length === 1 ? 'A warning' : 'Warnings'} (the sketch still runs):</p>${listOf(items)}` : ''}`;
    } else {
      const first = c.errors[0];
      edMsg.innerHTML = `<p class="bad">${c.course ? 'Compilation error.' : 'The sketch does not compile.'}</p><p>${uploading ? 'Nothing was uploaded: Upload checks your code first, and this did not pass. The board keeps what it had.' : 'Nothing was sent to the board.'}${first.line ? ` Line ${first.line} is marked.` : ''}</p>${c.full ? `<pre>${esc(c.full)}</pre>${first.line ? `<button type="button" class="lab-link-btn" data-line="${first.line}">Show line ${first.line}</button>` : ''}` : listOf(c.errors)}`;
      if (first.line) code.mark(first.line, 'err');
    }
  }
  edMsg.addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b) code.goto(+b.dataset.line); });
  function verify() {
    if (!courseRec || busy) return null;
    const c = check();
    showCheck(c, false);
    onCompile?.({ ...c, sketch: current, uploading: false });
    return c;
  }
  async function upload() {
    if (!courseRec || busy) return false;
    const c = check();
    if (!c.ok) { showCheck(c, true); onCompile?.({ ...c, sketch: current, uploading: true }); return false; }
    const why = canUpload?.();
    if (why) { edMsg.innerHTML = `<p class="bad">Upload failed.</p><p>${why}</p>`; return false; }
    const text = code.value;
    const next = c.course ? courseRec : { ok: true, interp: true, js: c.js, source: text, name: current };
    saveEdit(current, c.course ? null : text);
    edMsg.innerHTML = '<p>Uploading…</p>';
    if (beforeUpload) {
      busy = true;
      halt();
      showRun();
      setState('Uploading…', powered ? 'pause' : 'off');
      try { await beforeUpload(next); } catch {}
      busy = false;
    }
    rec = next;
    onBoard = current;
    mode = c.course ? 'course' : 'edited';
    errBox.hidden = true;
    note('');
    mon.hidden = !!serial || !usesSerial(rec.source);
    built.textContent = c.course ? compiledWords(courseRec) : 'Your edited sketch is run by the course’s interpreter: a program in this page that reads Arduino C++ and does what the Uno’s chip would, at the same speed. It is checked against every course sketch, but it is not the real compiler, so a few rare things a real compiler allows are not supported.';
    // uploading resets the board and starts the new sketch, as on a real Uno
    powered = true;
    reset(false);
    sysLine(c.course ? 'uploaded the course’s sketch' : 'uploaded your sketch');
    start('upload');
    showCheck(c, true);
    onCompile?.({ ...c, sketch: current, uploading: true });
    showWhich();
    say('Uploaded. The sketch is running.');
    return true;
  }
  function backToCourse() {
    if (!courseRec) return;
    code.set(courseRec.source, fileName(current));
    saveEdit(current, null);
    edMsg.innerHTML = '';
    note('');
    if (mode === 'edited' && onBoard === current) {
      if (courseRec.ok) {
        const was = powered;
        rec = courseRec; mode = 'course';
        mon.hidden = !!serial || !usesSerial(rec.source);
        reset(false);
        if (was) { sysLine('back to the course’s sketch'); start('back'); }
        built.textContent = compiledWords(courseRec);
      } else { unplug('back'); putCourse(false); }
    }
    if (!courseRec.ok) { const m = /\.ino:(\d+):\d+:/.exec(courseRec.error); if (m) code.mark(+m[1], 'err'); }
    showWhich();
    tell('back');
  }
  edVerify.addEventListener('click', verify);
  edUpload.addEventListener('click', upload);
  edBack.addEventListener('click', backToCourse);

  // ---------- what the interpreter reports while it runs ----------
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

  setState('Loading the sketch…', 'off');
  showRun();
  const api = {
    get uno() { return uno; },
    get running() { return running; },
    get powered() { return powered; },
    get busy() { return busy; },
    get mode() { return mode; },
    get sketch() { return onBoard; },
    get open() { return current; },
    get rec() { return rec; },
    get course() { return courseRec; },
    get sample() { return S; },
    editor: code,
    group: g,
    codeGroup,
    choose, start, pause, unplug, powerCycle, reset: () => reset(true), upload, verify, back: backToCourse, note,
    log: () => logText + pendingText,
    // put the course's version of the open sketch on the board (unplugged, or as powered as it was)
    load: (keepPower = false) => { if (courseRec) { putCourse(keepPower); if (keepPower && powered && rec?.ok) start('load'); showWhich(); tell('load'); } },
    refresh: showWhich,
  };
  host.labSketch = api; // for the test bench and the curious
  return api;
}

// The build viewer's own run bar (sim.js) mirrored in the same two easy-to-find
// places: on the 3D view, and pinned at the top of the Code tab. The copies
// press the real buttons and follow their state, so sim.js is unchanged.
export function mirrorBar(host) {
  const src = host.querySelector('.lab-sim .sim-bar');
  if (!src || host.querySelector('.sp-float')) return;
  addCss();
  const run = src.querySelector('.sim-run'), stop = src.querySelector('.sim-stop'), rst = src.querySelector('.sim-reset'), pow = src.querySelector('.sim-power');
  const make = (cls) => {
    const b = document.createElement('div');
    b.className = 'sp-bar ' + cls;
    b.setAttribute('role', 'group');
    b.setAttribute('aria-label', 'The board: run, stop, reset');
    const f = cls.includes('sp-float');
    b.innerHTML = `<button type="button" class="${f ? '' : 'lab-btn primary '}sp-run"></button><button type="button" class="${f ? '' : 'lab-btn '}sp-stop" aria-label="Stop: unplug the board" title="Stop: unplug the board">${icon('stop')}<span>Stop</span></button><button type="button" class="${f ? '' : 'lab-btn '}sp-reset" aria-label="Reset: start the sketch again, still plugged in" title="Reset: start the sketch again">${icon('turnL')}<span>Reset</span></button><span class="sp-power" data-s="off"><i aria-hidden="true"></i><span class="sp-state"></span></span>`;
    b.querySelector('.sp-run').addEventListener('click', () => run.click());
    b.querySelector('.sp-stop').addEventListener('click', () => stop.click());
    b.querySelector('.sp-reset').addEventListener('click', () => rst.click());
    return b;
  };
  const copies = [];
  const fl = make('sp-float');
  host.querySelector('.lab-canvas')?.appendChild(fl);
  copies.push(fl);
  const pane = host.querySelector('.lab-pane[data-pane="code"]');
  if (pane && pane.children.length) {
    const pin = make('sp-pin');
    pane.prepend(pin);
    copies.push(pin);
    stickWhenRoomy(pin);
  }
  const sync = () => {
    const on = /pause/i.test(run.textContent);
    for (const b of copies) {
      const r = b.querySelector('.sp-run');
      r.innerHTML = run.innerHTML;
      r.disabled = run.disabled;
      r.dataset.on = on ? '1' : '0';
      r.setAttribute('aria-label', run.getAttribute('aria-label') || 'Run');
      r.title = r.getAttribute('aria-label');
      b.querySelector('.sp-stop').disabled = stop.disabled;
      b.querySelector('.sp-reset').disabled = rst.disabled;
      const p = b.querySelector('.sp-power');
      p.dataset.s = pow.dataset.s;
      p.querySelector('.sp-state').textContent = pow.textContent.trim();
    }
  };
  new MutationObserver(sync).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
  sync();
}

// The sketch's serial output, into a lab's own serial monitor (concept-b3.js's
// monitor(): print, println). onLine(text) hears every finished line.
export function serialTo(ser, onLine) {
  let line = '';
  return (text) => {
    let part = '';
    for (const ch of text) {
      if (ch === '\r') continue;
      if (ch === '\n') { ser.println(part); part = ''; onLine?.(line); line = ''; } else { part += ch; line += ch; }
    }
    if (part) ser.print(part);
  };
}

// Pin a Code-tab bar to the top of its scrolling panel, but only when the
// panel is tall enough that the bar does not hide what it is meant to run.
function stickWhenRoomy(bar) {
  if (!window.ResizeObserver) return;
  let box = null;
  const check = () => {
    box ??= bar.closest('.lab-panes');
    if (box) bar.classList.toggle('sp-stick', box.clientHeight > 280);
  };
  requestAnimationFrame(() => { check(); if (box) new ResizeObserver(check).observe(box); });
}

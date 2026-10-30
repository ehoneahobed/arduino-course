#!/usr/bin/env node
// The fidelity test for the course's Arduino C++ interpreter.
//
// Every course sketch is run two ways, headless, with the same scripted
// inputs (button presses at given times, knob and sensor values, keypad
// keys, distances): the compiled machine code (assets/labs/hex/) on the
// emulated ATmega328P (avr8js, uno.js), and the source on the interpreter
// (cpp-compile.js + vboard.js). Then the two are compared, every 5 ms of
// virtual time, within tolerances: each pin's mode, share of time high
// (PWM), frequency (tone) and pulse length (servo), the serial output (text
// and when each line came), the 16x2 screen's text and the TM1637's digits.
//
//   node tools/interp_check.mjs              every sketch
//   node tools/interp_check.mjs b3 b7_05     only sketches whose names start so
//   node tools/interp_check.mjs -v b4_06     show the first differences in detail
//   node tools/interp_check.mjs --dump=b2_01_fade_given,9,0,200
//                                            both boards' readings of pin 9 from 0 to 200 ms
//
// The deliberate buggy sketches must misbehave the same way both ways, and
// b0_03 must fail to compile in the interpreter with the compiler's message.
// Exit code 1 if anything does not match. It needs esbuild (see build_labs.mjs).
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/labs/src');
const HEX = join(ROOT, 'assets/labs/hex');
const SKETCHES = join(ROOT, 'arduino/sketches');
const argv = process.argv.slice(2);
const verbose = argv.includes('-v');
const only = argv.filter((a) => !a.startsWith('-'));

async function findEsbuild() {
  try { return await import('esbuild'); } catch {}
  for (const t of [process.env.ESBUILD, join(ROOT, '../BIH Tech Club/node_modules/esbuild'), join(ROOT, 'node_modules/esbuild')].filter(Boolean)) {
    try { return createRequire(join(t, 'noop.js'))(t); } catch {}
  }
  console.error('esbuild not found (see tools/README.md).');
  process.exit(2);
}
const esbuild = await findEsbuild();
const bundle = await esbuild.build({
  stdin: {
    contents: `export { Uno, decodeProgram } from './uno.js'; export { VBoard } from './vboard.js'; export { compileSketch } from './cpp-compile.js';
      export { HD44780, Backpack } from './hd44780.js'; export * as dev from './devices.js';`,
    resolveDir: SRC, loader: 'js',
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
});
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { Uno, decodeProgram, VBoard, compileSketch, HD44780, Backpack, dev } = M;

// ---------- the scripted inputs for each sketch ----------
// btn: { pin: [[fromMs, toMs], …] } pressed (the pin reads LOW; the course wires buttons with INPUT_PULLUP)
// an: { channel: [[atMs, volts], …] }, noise: volts of wobble on analogRead (as the page adds)
// sonar: { trig, echo, cm: [[atMs, cm], …] }, dht: { pin, at: [[ms, temp, hum]] }
// pad: { rows, cols, keys: [[fromMs, toMs, 'key'], …] }, lcd: 'i2c' | { rs, e, d }, tm: { clk, dio }
// loose: { pin: [[fromMs, toMs]] } windows where that pin is checked only for flicker (both must flicker or both hold)
// bus: pins that carry data to a part (the parallel screen's wires): checked through what the part shows instead
// rhythm: pins whose beeps follow a measured echo (pulseIn jitters by a few microseconds on the chip, so a
//   beep can end one loop earlier or later): checked per half second for the share of time sounding and the note
const KEYS = ['123A', '456B', '789C', '*0#D'];
const press = (...t) => t.map((x) => [x, x + 250]);
const SONAR = { trig: 10, echo: 11 };
const SC = {
  b0_01_blink_given: { ms: 9000 },
  b0_02_signature_worked: { ms: 12000 },
  b0_03_buggy_semicolon: { fails: { line: 24, msg: "expected ';' before '}' token" } },
  b1_01_one_led_given: { ms: 10000 },
  b1_02_signal_hardcoded: { ms: 28000 },
  b1_03_signal_variables: { ms: 28000 },
  b1_04_buggy_silent: { ms: 9000 },
  b1_05_traffic_module: { ms: 28000 },
  b2_01_fade_given: { ms: 9000 },
  b2_02_rgb_colours: { ms: 13000 },
  b2_03_colour_story_worked: { ms: 22000 },
  b2_04_buggy_nonpwm: { ms: 7000 },
  b2_05_rgb_module: { ms: 25000 },
  b3_01_button_light_given: { ms: 6000, btn: { 2: [[1000, 2000], [3000, 3050], [4000, 4600]] } },
  b3_02_serial_watch: { ms: 6000, btn: { 2: [[1000, 2000], [3000, 3600]] } },
  b3_03_toggle_buggy: { ms: 6000, btn: { 2: [[1000, 1600], [3000, 3400]] }, loose: { 8: [[1000, 6000]] } },
  b3_04_toggle_fixed: { ms: 6000, btn: { 2: [[1000, 1300], [2000, 2400], [3000, 3200], [4500, 4800]] } },
  b3_05_lock_worked: { ms: 26000, btn: { 2: press(1000, 5500, 9000, 12500), 4: press(1600, 2200, 6100, 9600, 10200, 13100), 3: press(2800, 6700, 7300, 10800, 13700) } },
  b3_06_keypad_lock: { ms: 26000, pad: { rows: [9, 8, 7, 6], cols: [5, 4, 3, 2], keys: typed(1000, '1942', 6000, '1111', 10000, '*12', 12000, '2222', 16000, '3333') } },
  b3_07_keypad_test: { ms: 9000, pad: { rows: [9, 8, 7, 6], cols: [5, 4, 3, 2], keys: typed(1000, '123A456B789C*0#D') } },
  b4_01_pot_read_given: { ms: 6000, an: { 0: [[0, 2.5], [2000, 0.4], [4000, 4.9]] }, noise: 0.005 },
  b4_02_pot_dim_led: { ms: 6000, an: { 0: [[0, 2.5], [2000, 0.4], [4000, 4.9]] }, noise: 0.005 },
  b4_03_light_read: { ms: 6000, an: { 1: [[0, 3.1], [2500, 1.2]] }, noise: 0.005 },
  b4_04_buggy_intdiv: { ms: 6000, an: { 0: [[0, 2.5], [3000, 4.0]] }, noise: 0.005 },
  b4_05_night_guard_worked: { ms: 8000, an: { 0: [[0, 2.5]], 1: [[0, 3.5], [3000, 1.0], [6000, 4.0]] }, noise: 0.005 },
  b4_06_rain_alarm: { ms: 10000, an: { 0: [[0, 4.6], [2500, 1.4], [7000, 4.5]] }, noise: 0.005 },
  b4_07_room_monitor: { ms: 9000, dht: { pin: 4, at: [[0, 27, 65], [4500, 34, 70]] } },
  b5_01_tone_given: { ms: 7000 },
  b5_02_functions_worked: { ms: 8000 },
  b5_03_blocking_problem: { ms: 9000, btn: { 6: [[1000, 1500], [3000, 5000]] } },
  b5_04_millis_fixed: { ms: 7000, btn: { 6: [[1000, 1500], [3000, 5000]] } },
  b5_05_simon_worked: { ms: 16000, an: { 0: [[0, 2.2]] }, btn: { 8: press(3500, 9000), 9: press(4500), 10: press(5200), 11: press(7000) } },
  b5_06_reaction_race: { ms: 22000, an: { 0: [[0, 1.7]] }, btn: { 2: [[1500, 1700], [9500, 9800], [14000, 14300], [19000, 19250]] } },
  b6_01_servo_sweep_given: { ms: 8000 },
  b6_02_servo_knob: { ms: 5000, an: { 0: [[0, 2.5], [1500, 0.5], [3000, 4.5]] }, noise: 0.005 },
  b6_03_buggy_jitter: { ms: 5000, an: { 0: [[0, 2.5], [2500, 1.0]] }, noise: 0.005 },
  b6_04_servo_gate_worked: { ms: 9000, an: { 0: [[0, 2.5], [1500, 1.0]] }, noise: 0.005, btn: { 2: [[4000, 4300]] } },
  b6_05_motor_driver: { ms: 13000 },
  b6_06_stepper_dial: { ms: 12000, an: { 0: [[0, 0.5], [2000, 2.5]] }, btn: { 2: [[6000, 6300]] } },
  b6_07_fan_transistor: { ms: 9000, an: { 0: [[0, 0.05], [1500, 2.5], [3000, 4.9]] }, btn: { 2: [[5000, 5300]] } },
  b7_01_ping_given: { ms: 5000, sonar: { ...SONAR, cm: [[0, 30], [2000, 120], [3500, 450]] } },
  b7_02_lcd_i2c_given: { ms: 3000, lcd: 'i2c' },
  b7_03_lcd_parallel_given: { ms: 1500, lcd: { rs: 12, e: 11, d: [5, 4, 3, 2] }, bus: [12, 11, 5, 4, 3, 2] },
  b7_04_buggy_flicker: { ms: 4000, lcd: 'i2c', sonar: { ...SONAR, cm: [[0, 25], [2500, 140]] } },
  b7_05_bin_worked_i2c: { ms: 9000, lcd: 'i2c', rhythm: [6], sonar: { ...SONAR, cm: [[0, 150], [3000, 70], [4500, 20], [6000, 6]] } },
  b7_05_bin_worked_parallel: { ms: 9000, lcd: { rs: 12, e: 11, d: [5, 4, 3, 2] }, bus: [12, 11, 5, 4, 3, 2], rhythm: [6], sonar: { trig: 10, echo: 9, cm: [[0, 150], [3000, 70], [4500, 20], [6000, 6]] } },
  b7_06_guard_tm1637: { ms: 8000, tm: { clk: 2, dio: 3 }, bus: [2, 3], rhythm: [6], sonar: { ...SONAR, cm: [[0, 150], [2000, 45], [4000, 15], [6000, 500]] } },
  b8_01_states_given: { ms: 14000, btn: { 2: [[1000, 1300], [2500, 2800], [4000, 4300], [11000, 11200]] } },
  b8_02_buggy_flags: { ms: 14000, btn: { 2: [[1000, 1300], [2500, 2800], [4000, 4300], [11000, 11200]] } },
  b8_03_tank_alarm_worked: { ms: 12000, btn: { 2: [[6000, 6300]] }, sonar: { ...SONAR, cm: [[0, 40], [2000, 10], [4000, 25], [5000, 12]] } },
  b8_04_project_skeleton: { ms: 3000 },
  bench_voltmeter: { ms: 5000, an: { 0: [[0, 3.3], [2500, 1.1]] }, noise: 0.005 },
  id_01_which_buzzer: { ms: 11000 },
  id_02_which_rgb: { ms: 15000 },
};
function typed(...a) {
  const keys = [];
  for (let i = 0; i < a.length; i += 2) [...a[i + 1]].forEach((k, j) => keys.push([a[i] + j * 450, a[i] + j * 450 + 180, k]));
  return keys;
}

// ---------- a headless bench around either board ----------
let seed = 1;
const realRandom = Math.random;
function seeded(s) { seed = s >>> 0; Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const at = (sched, ms) => { let v = sched[0][1]; for (const s of sched) if (s[0] <= ms) v = s[1]; return v; };

function bench(board, sc, source) {
  const ms = () => board.cpu.cycles / 16000;
  const owned = new Set();
  const floatV = new Float32Array(20);
  const pressed = (p) => (sc.btn?.[p] || []).some(([a, b]) => ms() >= a && ms() < b);
  let pad = null, dht = null, tm = null;
  if (sc.pad) {
    pad = { rows: sc.pad.rows, cols: sc.pad.cols, down: [] };
    [...pad.rows, ...pad.cols].forEach((p) => owned.add(p));
  }
  const resolveInputs = () => {
    for (let p = 0; p < 20; p++) {
      if (owned.has(p) || board.isOutput(p)) continue;
      const v = pressed(p) ? 0 : board.mode(p) === 3 ? 1 : 0;
      if (board.readInput(p) !== v) board.setInput(p, v);
    }
    if (pad) dev.padResolve(board, pad.rows, pad.cols, pad.down, floatV);
  };
  const lcd = sc.lcd ? new HD44780() : null;
  if (sc.lcd === 'i2c') { board.twi.eventHandler = new Backpack(board.twi, lcd); owned.add(18); owned.add(19); }
  else if (sc.lcd) dev.wireLcd(board, lcd, sc.lcd.rs, sc.lcd.e, sc.lcd.d);
  const son = sc.sonar ? { cm: sc.sonar.cm[0][1] } : null;
  if (son) { owned.add(sc.sonar.echo); dev.wireSonar(board, son, sc.sonar.trig, sc.sonar.echo); }
  if (sc.dht) { dht = { temp: sc.dht.at[0][1], hum: sc.dht.at[0][2] }; owned.add(sc.dht.pin); dev.dhtStart(board, dht, sc.dht.pin); }
  if (sc.tm) { tm = dev.tmMake(sc.tm.clk, sc.tm.dio); owned.add(sc.tm.clk); owned.add(sc.tm.dio); }
  board.onChange = () => { resolveInputs(); if (dht) dev.dhtWatch(board, dht); if (tm) dev.tmWatch(board, tm); };
  let serial = [];
  board.usart.onByteTransmit = (b) => serial.push([ms(), b]);
  resolveInputs();
  const trace = [];
  for (let t = 0; t < sc.ms; t += 5) {
    // inputs for this slice
    for (const ch in sc.an || {}) { board.adc.channelValues[ch] = at(sc.an[ch], t); board.adcNoise[ch] = sc.noise || 0; }
    if (son) son.cm = at(sc.sonar.cm, t);
    if (dht) { const d = sc.dht.at.filter((x) => x[0] <= t).pop(); dht.temp = d[1]; dht.hum = d[2]; }
    if (pad) pad.down = sc.pad.keys.filter(([a, b]) => t >= a && t < b).map(([, , k]) => { const r = KEYS.findIndex((row) => row.includes(k)); return { r, c: KEYS[r].indexOf(k) }; });
    resolveInputs();
    board.run(Math.max(1, (t + 5) * 16000 - board.cpu.cycles), Infinity);
    const S = board.sample();
    trace.push({ t, pins: S.map((s) => ({ out: s.mode === 0 || s.mode === 1, duty: s.duty, hz: s.hz, us: s.pulseUs })), lcd: lcd ? lcd.text().join('|') + (lcd.light ? '' : ' (dark)') : null, tm: tm ? dev.tmText(tm) : null });
  }
  return { trace, serial };
}

function runAvr(rec, sc) {
  seeded(7);
  const uno = new Uno(decodeProgram(rec.program));
  return bench(uno, sc, rec.source);
}
function runInterp(src, name, sc) {
  seeded(7);
  const c = compileSketch(src, name);
  if (!c.ok) return { compile: c };
  const errs = [];
  const b = new VBoard(c.js, { onError: (e) => errs.push(e), onWarn: () => {} });
  const r = bench(b, sc, src);
  r.errors = errs;
  return r;
}

// ---------- comparing ----------
function lines(serial) {
  const out = [];
  let cur = '', t0 = null;
  for (const [t, b] of serial) {
    if (t0 === null) t0 = t;
    if (b === 10) { out.push([t0, cur.replace(/\r$/, '')]); cur = ''; t0 = null; } else cur += String.fromCharCode(b);
  }
  if (cur) out.push([t0, cur + '…']);
  return out;
}
// a line that differs only in measured numbers by a count or two (a time read
// with millis(), an echo measured with pulseIn) still matches
function closeNumbers(a, b) {
  const na = a.split(/(-?\d+(?:\.\d+)?)/), nb = b.split(/(-?\d+(?:\.\d+)?)/);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (i % 2 === 0) { if (na[i] !== nb[i]) return false; continue; }
    const x = +na[i], y = +nb[i];
    if (Math.abs(x - y) > Math.max(2, 0.01 * Math.abs(x))) return false;
  }
  return true;
}
function compare(A, B, sc) {
  const problems = [];
  const n = Math.min(A.trace.length, B.trace.length);
  const K = 3; // windows of slack either way (15 ms)
  const looseAt = (p, t) => (sc.loose?.[p] || []).some(([a, b]) => t >= a && t < b);
  const used = new Set();
  for (const X of [A, B]) for (const w of X.trace) w.pins.forEach((s, p) => { if (s.out || s.duty > 0) used.add(p); });
  const stats = { pins: used.size, windows: n };
  // a 5 ms window holds only a few PWM periods, so the chip's measured share
  // high and frequency jitter from window to window: compare 20 ms averages
  // of the share high and 25 ms medians of the frequency
  const series = (X, get, how) => {
    const raw = X.trace.slice(0, n).map(get);
    if (how === 'mean') return raw.map((_, i) => { let s = 0, c = 0; for (let j = i; j < Math.min(n, i + 4); j++) { s += raw[j]; c++; } return s / c; });
    // (the chip's frequency is measured from the rises in each window, so a slow one reads 0 in some: take the most of 25 ms)
    if (how === 'median') return raw.map((_, i) => Math.max(...raw.slice(Math.max(0, i - 2), i + 3)));
    return raw;
  };
  const check = (label, get, eps, rel = 0, how, epsAt, K = 3) => {
    const SA = series(A, get, how), SB = series(B, get, how);
    const RA = A.trace.slice(0, n).map(get), RB = B.trace.slice(0, n).map(get);
    for (const [X, Y, R, who] of [[SA, SB, RA, 'chip'], [SB, SA, RB, 'interp']]) {
      for (let i = 0; i < (how === 'mean' ? n - 4 : n); i++) {
        const v = X[i];
        // a frequency counts only where it is steady (a tone or PWM), not a data line's rhythm
        if (how === 'median' && v > 0) { const nz = R.slice(Math.max(0, i - 2), i + 3).filter((u) => u > 0); if (nz.length < 2 || Math.max(...nz) > 1.03 * Math.min(...nz)) continue; }
        if (epsAt) eps = epsAt(i);
        let lo = Infinity, hi = -Infinity;
        for (let j = Math.max(0, i - K); j <= Math.min(n - 1, i + K); j++) { const u = Y[j]; lo = Math.min(lo, u); hi = Math.max(hi, u); }
        const tol = eps + rel * Math.abs(v);
        if (v < lo - tol || v > hi + tol) {
          problems.push(`${label} at ${A.trace[i].t} ms: ${who} ${v.toFixed(3)}, other ${lo.toFixed(3)}…${hi.toFixed(3)}`);
          return;
        }
      }
    }
  };
  for (const p of used) {
    if (sc.bus?.includes(p)) continue;
    if (sc.rhythm?.includes(p)) {
      for (let t = 0; t + 500 <= n * 5; t += 500) {
        const blk = (X) => X.trace.filter((w) => w.t >= t && w.t < t + 500);
        const on = (X) => blk(X).filter((w) => w.pins[p].hz >= 20).length / 100;
        // the note most heard in the half second (the chip's measured pitch wobbles by a hertz or two)
        const notes = (X) => { const c = new Map(); blk(X).forEach((w) => { const h = Math.round(w.pins[p].hz / 10) * 10; if (h >= 20) c.set(h, (c.get(h) || 0) + 1); }); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''; };
        const oa = on(A), ob = on(B);
        if (Math.abs(oa - ob) > 0.2 || (oa >= 0.1 && ob >= 0.1 && notes(A) !== notes(B))) { problems.push(`pin ${p} beeps ${t}-${t + 500} ms: chip sounding ${(oa * 100).toFixed(0)}% (${notes(A) || 'silent'} Hz), interp ${(ob * 100).toFixed(0)}% (${notes(B) || 'silent'} Hz)`); break; }
      }
      continue;
    }
    const tl = (w) => looseAt(p, w.t);
    check(`pin ${p} share high`, (w) => (tl(w) ? 0 : w.pins[p].duty), 0.03, 0, 'mean', (i) => (A.trace[i].pins[p].hz >= 20 || B.trace[i].pins[p].hz >= 20 ? 0.08 : 0.03));
    check(`pin ${p} frequency`, (w) => (tl(w) || w.pins[p].hz < 20 ? 0 : w.pins[p].hz), 1.5, 0.01, 'median');
    const servo = B.trace.some((w) => Math.abs(w.pins[p].hz - 50) < 1 && w.pins[p].us > 400 && w.pins[p].us < 2700);
    if (servo) check(`pin ${p} pulse µs`, (w) => (tl(w) || !(w.pins[p].us > 400 && w.pins[p].us < 3000) ? 0 : w.pins[p].us), 15, 0, undefined, undefined, 8);
    if (sc.loose?.[p]) {
      // where the sketch is meant to misbehave: both flicker together, or both hold steady
      for (const [a, b] of sc.loose[p]) {
        const f = (X) => X.trace.filter((w) => w.t >= a && w.t < b).map((w) => w.pins[p].duty);
        const flick = (d) => d.filter((x) => x > 0.08 && x < 0.92).length / Math.max(1, d.length);
        const fa = flick(f(A)), fb = flick(f(B));
        if (Math.abs(fa - fb) > 0.15) problems.push(`pin ${p} flicker ${a}-${b} ms: chip ${(fa * 100).toFixed(0)}% of the time, interp ${(fb * 100).toFixed(0)}%`);
      }
    }
  }
  if (A.trace.some((w) => w.lcd !== null)) {
    // the screen: every state that stays for 10 ms or more on one must show on the other
    // within 40 ms, and both must spend the same share of time half-written (the flicker bug)
    const stable = (X) => { const out = []; X.trace.slice(0, n).forEach((w, i, a) => { if (i && a[i - 1].lcd === w.lcd && (!out.length || out[out.length - 1].v !== w.lcd)) out.push({ i: i - 1, v: w.lcd }); }); return out; };
    const SAx = stable(A), SBx = stable(B);
    for (const [X, Y, who] of [[SAx, B, 'chip'], [SBx, A, 'interp']]) {
      const miss = X.find((s) => !Y.trace.slice(Math.max(0, s.i - 8), s.i + 9).some((w) => w.lcd === s.v || closeNumbers(w.lcd, s.v)));
      if (miss) problems.push(`screen at ${A.trace[miss.i].t} ms: ${who} shows "${miss.v}" and the other does not`);
    }
    const common = (X) => { const c = new Map(); X.trace.forEach((w) => c.set(w.lcd, (c.get(w.lcd) || 0) + 1)); return c; };
    const half = (X) => { const c = common(X); return X.trace.slice(0, n).filter((w) => c.get(w.lcd) <= 2).length / n; };
    const ha = half(A), hb = half(B);
    if (Math.abs(ha - hb) > 0.05) problems.push(`screen half-written ${(ha * 100).toFixed(0)}% of the time on the chip, ${(hb * 100).toFixed(0)}% in the interpreter`);
    stats.screen = SAx.length;
  }
  if (A.trace.some((w) => w.tm !== null)) {
    for (let i = 0; i < n; i++) {
      const v = A.trace[i].tm;
      let found = false;
      for (let j = Math.max(0, i - 12); j <= Math.min(n - 1, i + 12); j++) if (B.trace[j].tm === v || closeNumbers(B.trace[j].tm, v)) { found = true; break; }
      if (!found) { problems.push(`TM1637 at ${A.trace[i].t} ms: chip "${v}", interp "${B.trace[i].tm}"`); break; }
    }
  }
  const la = lines(A.serial), lb = lines(B.serial);
  stats.lines = la.length;
  // each line must be printed by the other too, within two lines and 40 ms of it
  if (Math.abs(la.length - lb.length) > 2) problems.push(`serial: chip printed ${la.length} lines, interp ${lb.length}`);
  for (const [X, Y, who] of [[la, lb, 'chip'], [lb, la, 'interp']]) {
    const last = Math.min(X.length, Y.length) - 1;
    for (let i = 0; i < last; i++) {
      const ok = Y.slice(Math.max(0, i - 2), i + 3).some((y) => (y[1] === X[i][1] || closeNumbers(y[1], X[i][1])) && Math.abs(y[0] - X[i][0]) <= 40);
      if (!ok) { problems.push(`serial line ${i + 1} at ${X[i][0].toFixed(0)} ms: ${who} "${X[i][1]}", the other "${Y[i]?.[1]}" at ${Y[i]?.[0].toFixed(0)} ms`); break; }
    }
  }
  return { problems, stats };
}

// ---------- run ----------
// --dump name,pin,fromMs,toMs: both boards' readings of one pin, window by window, and the first serial lines
const dumpArg = argv.find((a) => a.startsWith('--dump='));
if (dumpArg) {
  const [nm, pin, from, to] = dumpArg.slice(7).split(',');
  const sc = SC[nm];
  const src = readFileSync(join(SKETCHES, nm + '.ino'), 'utf8');
  const c2 = { window: {} };
  vm.createContext(c2);
  vm.runInContext(readFileSync(join(HEX, nm + '.js'), 'utf8'), c2);
  const A = runAvr(c2.window.ArduinoSketches[nm], sc), B = runInterp(src, nm, sc);
  const f = (w) => { const s = w.pins[+pin]; return `${s.out ? 'out' : 'in '} ${s.duty.toFixed(3)} ${s.hz.toFixed(1).padStart(7)} Hz ${s.us.toFixed(0).padStart(5)} us`; };
  for (let i = 0; i < A.trace.length; i++) {
    const a = A.trace[i], b = B.trace[i];
    if (a.t < +from || a.t > +to) continue;
    console.log(String(a.t).padStart(6), ' chip', f(a), ' | interp', f(b), a.lcd ?? '', b.lcd ?? '', a.tm ?? '', b.tm ?? '');
  }
  console.log('chip serial', lines(A.serial).slice(0, 10), '\ninterp serial', lines(B.serial).slice(0, 10));
  process.exit(0);
}
const names = readdirSync(SKETCHES).filter((f) => f.endsWith('.ino')).map((f) => f.slice(0, -4)).filter((n) => !only.length || only.some((o) => n.startsWith(o))).sort();
const ctx = { window: {} };
vm.createContext(ctx);
const rows = [];
let bad = 0;
const t00 = Date.now();
for (const name of names) {
  const sc = SC[name];
  const src = readFileSync(join(SKETCHES, name + '.ino'), 'utf8').replace(/\r\n/g, '\n');
  if (!sc) { rows.push([name, 'NO SCENARIO', '']); bad++; continue; }
  const t0 = Date.now();
  if (sc.fails) {
    const c = compileSketch(src, name);
    const e = c.errors?.[0];
    const okFail = !c.ok && e.line === sc.fails.line && e.msg === sc.fails.msg;
    rows.push([name, okFail ? 'match' : 'MISMATCH', okFail ? `both fail to compile: "${e.text}"` : `interpreter: ${c.ok ? 'compiled' : e.text}`]);
    if (!okFail) bad++;
    continue;
  }
  vm.runInContext(readFileSync(join(HEX, name + '.js'), 'utf8'), ctx);
  const rec = ctx.window.ArduinoSketches[name];
  const A = runAvr(rec, sc);
  const B = runInterp(src, name, sc);
  if (B.compile) { rows.push([name, 'MISMATCH', 'interpreter: ' + B.compile.errors.map((e) => e.text).join('; ')]); bad++; continue; }
  const { problems, stats } = compare(A, B, sc);
  if (B.errors.length) problems.unshift('interpreter stopped: ' + B.errors.map((e) => `line ${e.line}: ${e.msg}`).join('; '));
  const what = `${(sc.ms / 1000).toFixed(0)} s, ${stats.pins} pins${stats.lines ? `, ${stats.lines} serial lines` : ''}${stats.screen ? `, ${stats.screen} screen states` : ''}${sc.loose ? ', flicker checked' : ''}`;
  rows.push([name, problems.length ? 'MISMATCH' : 'match', problems.length ? problems.slice(0, verbose ? 8 : 2).join(' | ') : what, ((Date.now() - t0) / 1000).toFixed(1) + ' s']);
  if (problems.length) bad++;
}
Math.random = realRandom;
const w = Math.max(...rows.map((r) => r[0].length));
for (const r of rows) console.log(`${r[0].padEnd(w)}  ${r[1].padEnd(8)}  ${r[2]}${r[3] ? `  (${r[3]})` : ''}`);
console.log(`\n${rows.length - bad} of ${rows.length} match  (${((Date.now() - t00) / 1000).toFixed(0)} s)`);
process.exit(bad ? 1 : 0);

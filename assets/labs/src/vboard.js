// The course's Arduino C++ interpreter, part 3: the board it runs on.
//
// VBoard runs a sketch compiled by cpp-compile.js on a virtual Uno with the
// same outside as uno.js's Uno (avr8js): pin modes and levels, each pin's
// share of time high, its frequency and pulse length, edge callbacks, clock
// events, the serial port, the ADC and an I2C bus. So sim.js, the 3D parts
// and tools/interp_check.mjs drive both boards the same way.
//
// Time is virtual and counted in the chip's clock cycles (16 million a
// second). The program is a generator: it runs until its time reaches the
// end of the slice the page asked for, then yields, so delay(), busy loops
// and loops that never pause cannot freeze the page. The Arduino core
// (digitalWrite, analogWrite's PWM, tone, millis, pulseIn, Serial…) and the
// libraries the course uses (Servo, LiquidCrystal, LiquidCrystal_I2C, Wire,
// Keypad, SimpleDHT, Stepper, TM1637Display) are written here in
// JavaScript, following the real libraries line by line where timing or
// behaviour shows (the screens' start-up waits, the keypad's debounce, the
// DHT11's pulse timing, the TM1637's bit-banged bus).
import { PinState } from '../../vendor/avr8js@0.21.1/index.js';
import { PURE, Ptr } from './cpp-compile.js';

export const HZ = 16e6;
const N = 20;
const F = Math.fround;
const US = 16; // cycles per microsecond

export class RuntimeError extends Error {
  constructor(line, msg) { super(msg); this.line = line; }
}

// ---------- text for print() ----------
function digitsOf(n, base) {
  if (base < 2) base = 10;
  return (n >>> 0).toString(base).toUpperCase();
}
export function printFloat(number, digits) {
  number = F(number);
  if (number !== number) return 'nan';
  if (number === Infinity || number === -Infinity) return 'inf';
  if (number > 4294967040.0 || number < -4294967040.0) return 'ovf';
  let s = '';
  if (number < 0) { s = '-'; number = F(-number); }
  let rounding = F(0.5);
  for (let i = 0; i < digits; i++) rounding = F(rounding / F(10));
  number = F(number + rounding);
  const ip = Math.trunc(number) >>> 0;
  let rem = F(number - F(ip));
  s += String(ip);
  if (digits > 0) s += '.';
  while (digits-- > 0) {
    rem = F(rem * F(10));
    const d = Math.trunc(rem) & 0xffff;
    s += String(d);
    rem = F(rem - F(d));
  }
  return s;
}
const cstr = (p) => {
  if (!p) return '';
  let s = '';
  for (let i = p.o; i < p.a.length; i++) { const b = p.a[i] & 255; if (!b) break; s += String.fromCharCode(b); }
  return s;
};
// a value as print() would send it, one character per byte
function textOf(kind, v, fmt) {
  if (kind === 'c') return fmt === undefined ? String.fromCharCode(v & 255) : textOf('i', v, fmt);
  if (kind === 's') return cstr(v);
  if (kind === 'S') return v ?? '';
  if (kind === 'f') return printFloat(v, fmt === undefined ? 2 : fmt & 255);
  const base = fmt === undefined ? 10 : fmt;
  if (base === 0) return String.fromCharCode(v & 255);
  if (kind === 'i' && base === 10) return v < 0 ? '-' + String(-v) : String(v);
  return digitsOf(v, base);
}

// ---------- String ----------
const S = {
  cstr,
  num: (v, kind, base) => (kind === "'f'" || kind === 'f' ? printFloat(v, base ?? 2) : kind === 'c' ? String.fromCharCode(v & 255) : textOf(kind === 'u' ? 'u' : 'i', v, base)),
  at: (s, i) => (i >= 0 && i < s.length ? (s.charCodeAt(i) << 24) >> 24 : 0),
  length: (s) => s.length,
  charAt: (s, i) => S.at(s, i),
  indexOf: (s, x, from = 0) => s.indexOf(x, from),
  lastIndexOf: (s, x) => s.lastIndexOf(x),
  substring: (s, a, b) => (b === undefined ? s.slice(a) : s.slice(Math.min(a, b), Math.max(a, b))),
  toInt: (s) => { const m = /^\s*([+-]?\d+)/.exec(s); return m ? parseInt(m[1], 10) | 0 : 0; },
  toFloat: (s) => { const v = parseFloat(s); return v === v ? F(v) : 0; },
  equals: (s, x) => (s === x ? 1 : 0),
  equalsIgnoreCase: (s, x) => (s.toLowerCase() === x.toLowerCase() ? 1 : 0),
  startsWith: (s, x) => (s.startsWith(x) ? 1 : 0),
  endsWith: (s, x) => (s.endsWith(x) ? 1 : 0),
  compareTo: (s, x) => (s < x ? -1 : s > x ? 1 : 0),
  c_str: (s) => new Ptr(Int8Array.from([...s].map((c) => (c.charCodeAt(0) << 24) >> 24).concat(0)), 0),
  concat: (s, x) => s + x,
  trim: (s) => s.trim(),
  toUpperCase: (s) => s.toUpperCase(),
  toLowerCase: (s) => s.toLowerCase(),
  replace: (s, a, b) => (a ? s.split(a).join(b) : s),
  remove: (s, i, n) => (n === undefined ? s.slice(0, i) : s.slice(0, i) + s.slice(i + n)),
  setCharAt: (s, i, c) => (i < s.length ? s.slice(0, i) + String.fromCharCode(c & 255) + s.slice(i + 1) : s),
};

// ---------- the board ----------
export class VBoard {
  // js: the program from compileSketch(); hooks: onError({line, msg}), onWarn({line, msg})
  constructor(js, hooks = {}) {
    this.hooks = hooks;
    this.level = new Uint8Array(N);
    this.since = new Float64Array(N);
    this.hi = new Float64Array(N);
    this.frac = new Float64Array(N);
    this.rises = new Uint32Array(N);
    this.lastRise = new Float64Array(N).fill(-1e12);
    this.lastFall = new Float64Array(N).fill(-1e12);
    this.period = new Float64Array(N);
    this.pulse = new Float64Array(N);
    this.ddr = new Uint8Array(N);
    this.port = new Uint8Array(N);
    this.ext = new Int8Array(N).fill(-1);
    this.wave = new Array(N).fill(null);
    this.waveOn = new Uint8Array(N); // { kind: 'pwm' | 'tone' | 'servo', duty, hz, pulseUs }
    this.edge = [];
    this.onChange = null;
    this.windowStart = 0;
    this.T = { c: 0, lim: 0, d: 0, io: 0 };
    this.events = [];
    this.evNow = null;
    const self = this;
    this.cpu = { get cycles() { return self.evNow ?? self.T.c; }, addClockEvent: (fn, delay) => self.addEvent(fn, delay) };
    this.usart = { onByteTransmit: null };
    this.adc = { channelValues: new Array(8).fill(0), referenceVoltage: 5 };
    this.adcNoise = new Float32Array(8);
    this.twi = { eventHandler: null, ack: false, val: 0xff, completeStart() {}, completeStop() {}, completeConnect(a) { this.ack = a; }, completeWrite(a) { this.ack = a; }, completeRead(v) { this.val = v; } };
    this.rx = [];
    this.line = 0;
    this.t0 = -1;
    this.halted = false;
    this.toneP = -1;
    this.seed = 1;
    this.warned = new Set();
    this.rt = makeRuntime(this);
    // eslint-disable-next-line no-new-func
    this.prog = Function('rt', js)(this.rt);
    this.gen = this.main();
  }
  *main() {
    yield* this.prog.init(); // global objects' constructors run before init(), as on the chip
    this.t0 = this.T.c;
    this.T.c += 300;
    yield* this.prog.setup();
    for (;;) {
      yield* this.prog.loop();
      this.T.io = this.T.c;
      if ((this.T.c += 12) >= this.T.lim) yield 0;
    }
  }

  // ---- clock events (the devices use them, as with avr8js) ----
  addEvent(fn, delay) {
    const t = (this.evNow ?? this.T.c) + delay;
    const ev = this.events;
    let i = ev.length;
    while (i > 0 && ev[i - 1].t > t) i--;
    ev.splice(i, 0, { t, fn });
  }
  fire() {
    const ev = this.events;
    while (ev.length && ev[0].t <= this.T.c) {
      const e = ev.shift();
      this.evNow = e.t;
      try { e.fn(); } finally { this.evNow = null; }
    }
  }
  // let `cyc` cycles pass, firing events on time and yielding at the end of each slice
  *wait(cyc) {
    const T = this.T;
    const end = T.c + cyc;
    for (;;) {
      let nx = end;
      if (this.events.length && this.events[0].t < nx) nx = this.events[0].t;
      if (nx > T.lim) nx = T.lim;
      if (nx > T.c) T.c = nx;
      this.fire();
      T.io = T.c;
      if (T.c >= end) return;
      if (T.c >= T.lim) yield 0;
    }
  }

  // ---- the same outside as uno.js ----
  mode(p) {
    if (this.ddr[p]) return this.level[p] ? PinState.High : PinState.Low;
    return this.port[p] ? PinState.InputPullUp : PinState.Input;
  }
  isOutput(p) { return !!this.ddr[p]; }
  setInput(p, v) { this.ext[p] = v ? 1 : 0; }
  readInput(p) {
    if (this.ddr[p]) return this.level[p];
    return this.ext[p] >= 0 ? this.ext[p] : this.port[p];
  }
  send(text) { this.rt.Serial.receive(text); }
  get seconds() { return this.T.c / HZ; }

  run(cycles, deadline) {
    const T = this.T;
    const end = T.c + cycles;
    if (this.halted) { T.c = end; this.fire(); return; }
    while (T.c < end) {
      T.lim = Math.min(end, T.c + 16000);
      let r;
      try { r = this.gen.next(); } catch (e) { this.fail(e); T.c = end; break; }
      if (r.done) { this.halted = true; break; }
      if (r.value) this.line = r.value;
      this.fire();
      if (T.c - T.io > 2 * HZ && !this.warned.has('stuck')) {
        this.warned.add('stuck');
        this.hooks.onWarn?.({ line: this.line, kind: 'stuck', msg: `This loop has gone round for 2 seconds without a pause and without touching anything the board can see (no delay, no pin, no millis, no Serial). It may never end. A real board would be stuck here too.` });
      }
      if (performance.now() > deadline) break;
    }
  }
  fail(e) {
    this.halted = true;
    if (e instanceof RuntimeError) this.hooks.onError?.({ line: e.line, msg: e.message });
    else { this.hooks.onError?.({ line: this.line, msg: `The interpreter stopped: ${e && e.message}` }); if (!(e instanceof RangeError)) console.error(e); }
  }
  warnOnce(key, line, msg) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.hooks.onWarn?.({ line, msg });
  }

  // ---- pins ----
  apply(p) {
    const now = this.T.c;
    this.hi[p] += (now - this.since[p]) * this.frac[p];
    this.since[p] = now;
    const w = this.ddr[p] ? this.wave[p] : null;
    // (as avr8js reports it: an input pin's level is its pull-up bit)
    const f = w ? w.duty : this.port[p];
    const lv = w ? (w.duty >= 0.5 ? 1 : 0) : this.port[p];
    this.frac[p] = f;
    const wasWave = this.waveOn[p];
    this.waveOn[p] = w ? 1 : 0;
    if (lv !== this.level[p]) {
      this.level[p] = lv;
      if (!w && !wasWave) {
        if (lv) { this.rises[p]++; this.period[p] = now - this.lastRise[p]; this.lastRise[p] = now; }
        else { this.pulse[p] = now - this.lastRise[p]; this.lastFall[p] = now; }
        this.edge[p]?.(lv, now);
      }
    }
  }
  changed() { this.onChange?.(); }
  sample() {
    const now = this.T.c;
    const span = Math.max(1, now - this.windowStart);
    const out = [];
    for (let p = 0; p < N; p++) {
      this.hi[p] += (now - this.since[p]) * this.frac[p];
      this.since[p] = now;
      const w = this.ddr[p] ? this.wave[p] : null;
      let hz, pulseUs;
      if (w) {
        hz = w.hz; pulseUs = w.pulseUs;
        // keep the edge records as the chip's would be, so a wave that stops fades from them the same way
        this.lastRise[p] = now; this.period[p] = HZ / w.hz; this.pulse[p] = w.pulseUs * 16;
      }
      else {
        const recent = now - this.lastRise[p] < Math.max(0.05 * HZ, this.period[p] * 1.5);
        hz = recent && this.rises[p] > 0 && this.period[p] > 0 ? HZ / this.period[p] : 0;
        pulseUs = recent && now - this.lastRise[p] < 0.06 * HZ ? this.pulse[p] / 16 : 0;
      }
      out.push({ mode: this.mode(p), level: this.level[p], duty: Math.min(1, this.hi[p] / span), hz, pulseUs });
      this.hi[p] = 0;
      this.rises[p] = 0;
    }
    this.windowStart = now;
    return out;
  }
}

// ---------- the Arduino core, as the program calls it ----------
function makeRuntime(B) {
  const T = B.T;
  const ok = (p) => p >= 0 && p < N;
  const PWM = { 3: 'b', 5: 'a', 6: 'a', 9: 'b', 10: 'b', 11: 'b' };
  const offPwm = (p) => { if (B.wave[p]?.kind === 'pwm') B.wave[p] = null; };
  const rt = {
    T, pure: PURE, S, __board: B,
    nop() {},
    deep(line) { throw new RuntimeError(line, 'Functions have called each other more than 180 deep (a function that calls itself and never stops?). A real board would run out of memory and crash here.'); },
    oob(line, name, i, len) {
      B.warnOnce('oob' + line, line, `[${i}] is outside the array${name ? ` '${name}'` : ''}: it has ${len} place${len === 1 ? '' : 's'}, numbered 0 to ${len - 1}. A real board would read some other memory here; the interpreter gives 0.`);
      return 0;
    },
    st(A, i, v, line, name) {
      if (i >= 0 && i < A.length) { A[i] = v; return A[i]; }
      B.warnOnce('oobw' + line, line, `[${i}] is outside the array${name ? ` '${name}'` : ''}: it has ${A.length} place${A.length === 1 ? '' : 's'}, numbered 0 to ${A.length - 1}. On a real board this would change some other memory and could crash the sketch; the interpreter ignores it.`);
      return v;
    },
    pr(p, i, line) {
      if (p === null) throw new RuntimeError(line, 'This uses a pointer that is NULL (points at nothing). A real board would read garbage here.');
      const v = p.a[p.o + i];
      return v ?? rt.oob(line, '', p.o + i, p.a.length);
    },
    pw(p, i, v, line) {
      if (p === null) throw new RuntimeError(line, 'This writes through a pointer that is NULL (points at nothing).');
      return rt.st(p.a, p.o + i, v, line, '');
    },
    padd(p, n) { if (p === null) return null; return new Ptr(p.a, p.o + n); },
    fm: {
      sqrt: (x) => F(Math.sqrt(x)), sin: (x) => F(Math.sin(x)), cos: (x) => F(Math.cos(x)), tan: (x) => F(Math.tan(x)), asin: (x) => F(Math.asin(x)), acos: (x) => F(Math.acos(x)), atan: (x) => F(Math.atan(x)),
      exp: (x) => F(Math.exp(x)), log: (x) => F(Math.log(x)), log10: (x) => F(Math.log10(x)), abs: (x) => F(Math.abs(x)), floor: (x) => F(Math.floor(x)), ceil: (x) => F(Math.ceil(x)), trunc: (x) => F(Math.trunc(x)),
      pow: (x, y) => F(Math.pow(x, y)), atan2: (y, x) => F(Math.atan2(y, x)), fmod: (x, y) => F(x % y), hypot: (x, y) => F(Math.hypot(x, y)),
    },

    pinMode(p, m) {
      T.c += 36; T.io = T.c;
      if (!ok(p)) return;
      if (m === 0) { B.ddr[p] = 0; B.port[p] = 0; } else if (m === 2) { B.ddr[p] = 0; B.port[p] = 1; } else B.ddr[p] = 1;
      B.apply(p); B.changed();
    },
    digitalWrite(p, v) {
      T.c += 44; T.io = T.c;
      if (!ok(p)) return;
      offPwm(p);
      B.port[p] = v ? 1 : 0;
      B.apply(p); B.changed();
    },
    digitalRead(p) {
      T.c += 50; T.io = T.c;
      if (!ok(p)) return 0;
      B.fire();
      if (B.wave[p]?.kind === 'pwm') { offPwm(p); B.apply(p); }
      return B.readInput(p);
    },
    analogWrite(p, val) {
      rt.pinMode(p, 1);
      if (!ok(p)) return;
      T.c += 30;
      if (val === 0) { rt.digitalWrite(p, 0); return; }
      if (val === 255) { rt.digitalWrite(p, 1); return; }
      const tim = PWM[p];
      if (!tim) { rt.digitalWrite(p, val < 128 ? 0 : 1); return; }
      const ocr = val & 255;
      const duty = tim === 'a' ? (ocr + 1) / 256 : ocr / 255;
      const hz = tim === 'a' ? HZ / 64 / 256 : HZ / 64 / 510;
      B.wave[p] = { kind: 'pwm', duty, hz, pulseUs: (duty / hz) * 1e6 };
      B.apply(p); B.changed();
    },
    analogRead(pin) {
      T.c += 1800; T.io = T.c;
      B.fire();
      if (pin >= 14) pin -= 14;
      const ch = pin & 7;
      let v = B.adc.channelValues[ch] ?? 0;
      if (B.adcNoise[ch]) v += (Math.random() + Math.random() + Math.random() - 1.5) * 1.4 * B.adcNoise[ch];
      return Math.min(1023, Math.max(0, Math.floor((v / B.adc.referenceVoltage) * 1024)));
    },
    millis() {
      T.c += 20; T.io = T.c;
      if (B.t0 < 0) return 0;
      const n = Math.floor((T.c - B.t0) / 16384);
      return (n + Math.floor((3 * n) / 125)) >>> 0;
    },
    micros() {
      T.c += 30; T.io = T.c;
      if (B.t0 < 0) return 0;
      return (Math.floor((T.c - B.t0) / 64) * 4) >>> 0;
    },
    *delay(ms, line) {
      B.line = line;
      T.io = T.c;
      yield* B.wait(ms * 16000 + 40);
    },
    *delayMicroseconds(us, line) {
      if (us <= 1) { T.c += 16; return; }
      const x = (((us << 2) & 0xffff) - 5) & 0xffff;
      yield* B.wait(x * 4 + 20);
    },
    *pulseIn(pin, state, timeout = 1000000, line) {
      if (line) B.line = line;
      T.io = T.c;
      T.c += 60;
      if (!ok(pin)) return 0;
      const st = state ? 1 : 0;
      const end = T.c + timeout * US;
      const read = () => { B.fire(); return B.readInput(pin); };
      // step to the next thing that could change the pin (an event), or the timeout
      const step = function* () {
        let nx = end;
        if (B.events.length && B.events[0].t < nx) nx = B.events[0].t;
        if (nx > T.lim) nx = T.lim;
        if (nx > T.c) T.c = nx;
        T.io = T.c;
        if (T.c >= end) return false;
        if (T.c >= T.lim) yield 0;
        return true;
      };
      while (read() === st) if (!(yield* step())) return 0;
      while (read() !== st) if (!(yield* step())) return 0;
      const t0 = T.c;
      while (read() === st) if (!(yield* step())) return 0;
      // the core counts the pulse in a loop of 16 cycles a turn; each time
      // timer 0 overflows (every 1024 microseconds, for millis) its interrupt
      // steals about 6 microseconds of counting, as on the chip
      const base = B.t0 < 0 ? 0 : B.t0;
      const ov = Math.floor((T.c - base) / 16384) - Math.floor((t0 - base) / 16384);
      return Math.max(0, Math.floor((T.c - t0 - 96 * ov) / 16) + 1) >>> 0;
    },
    tone(pin, freq, dur = 0) {
      T.c += 120; T.io = T.c;
      if (!ok(pin)) return;
      if (B.toneP >= 0 && B.toneP !== pin) return; // the Uno has one tone timer
      B.toneP = pin;
      B.ddr[pin] = 1;
      if (!freq) { B.wave[pin] = null; B.port[pin] = 0; B.apply(pin); B.changed(); return; }
      let pre = 1, ocr = Math.floor(HZ / freq / 2) - 1;
      for (const k of [8, 32, 64, 128, 256, 1024]) { if (ocr <= 255) break; pre = k; ocr = Math.floor(HZ / freq / 2 / k) - 1; }
      const hz = HZ / (2 * pre * (ocr + 1));
      const id = (B.toneId = (B.toneId || 0) + 1);
      B.wave[pin] = { kind: 'tone', duty: 0.5, hz, pulseUs: 1e6 / hz / 2 };
      B.apply(pin); B.changed();
      if (dur > 0) {
        const toggles = Math.floor((2 * freq * dur) / 1000);
        B.addEvent(() => { if (B.toneId === id && B.wave[pin]?.kind === 'tone') { B.wave[pin] = null; B.port[pin] = 0; B.apply(pin); B.changed(); } }, Math.round((toggles / (2 * hz)) * HZ));
      }
    },
    noTone(pin) {
      T.c += 60;
      if (!ok(pin)) return;
      if (B.toneP === pin) { B.toneP = -1; B.toneId = (B.toneId || 0) + 1; if (B.wave[pin]?.kind === 'tone') B.wave[pin] = null; }
      rt.digitalWrite(pin, 0);
    },
    map(x, a, b, c, d) {
      T.c += 760; // a 32-bit multiply and divide
      return (PURE.$d32(Math.imul((x - a) | 0, (d - c) | 0), (b - a) | 0) + c) | 0;
    },
    random() {
      // avr-libc's random(): Park and Miller's minimal standard generator
      let x = B.seed | 0;
      if (x === 0) x = 123459876;
      const hi = Math.trunc(x / 127773), lo = x % 127773;
      x = 16807 * lo - 2836 * hi;
      if (x < 0) x += 0x7fffffff;
      B.seed = x;
      return x;
    },
    random1(n) { T.c += 400; T.io = T.c; if (n === 0) return 0; return rt.random() % n; },
    random2(a, b) { if (a >= b) return a; return (rt.random1((b - a) | 0) + a) | 0; },
    randomSeed(s) { T.c += 20; if (s !== 0) B.seed = s >>> 0; },
    shiftOut(dataPin, clockPin, order, val) {
      for (let i = 0; i < 8; i++) {
        rt.digitalWrite(dataPin, order === 0 ? (val >> i) & 1 : (val >> (7 - i)) & 1);
        rt.digitalWrite(clockPin, 1);
        rt.digitalWrite(clockPin, 0);
      }
    },
    shiftIn(dataPin, clockPin, order) {
      let v = 0;
      for (let i = 0; i < 8; i++) {
        rt.digitalWrite(clockPin, 1);
        if (order === 0) v |= rt.digitalRead(dataPin) << i; else v |= rt.digitalRead(dataPin) << (7 - i);
        rt.digitalWrite(clockPin, 0);
      }
      return v & 255;
    },
    isDigit: (c) => (c >= 48 && c <= 57 ? 1 : 0), isAlpha: (c) => (/[A-Za-z]/.test(String.fromCharCode(c & 255)) ? 1 : 0), isAlphaNumeric: (c) => (/[A-Za-z0-9]/.test(String.fromCharCode(c & 255)) ? 1 : 0),
    isSpace: (c) => (c === 32 || (c >= 9 && c <= 13) ? 1 : 0), isUpperCase: (c) => (c >= 65 && c <= 90 ? 1 : 0), isLowerCase: (c) => (c >= 97 && c <= 122 ? 1 : 0), isPunct: (c) => (/[!-/:-@[-`{-~]/.test(String.fromCharCode(c & 255)) ? 1 : 0),
    toUpperCase: (c) => (c >= 97 && c <= 122 ? c - 32 : c), toLowerCase: (c) => (c >= 65 && c <= 90 ? c + 32 : c),
    strlen: (p) => cstr(p).length, strcmp: (a, b) => { const x = cstr(a), y = cstr(b); return x < y ? -1 : x > y ? 1 : 0; },
  };
  rt.Serial = new HardwareSerial(B, rt);
  rt.Wire = new TwoWire(B, rt);
  rt.C = { Servo, LiquidCrystal, LiquidCrystal_I2C, Keypad, SimpleDHT11, SimpleDHT22: SimpleDHT11, Stepper, TM1637Display };
  return rt;
}

// ---------- print(), for Serial and the screens ----------
class Printer {
  *pr(kind, v, fmt, ln) {
    const s = textOf(kind, v, fmt) + (ln ? '\r\n' : '');
    // (printing a number divides it by 10 for each digit: about 700 cycles a digit on the chip)
    const digits = kind === 'i' || kind === 'u' || kind === 'f' ? s.replace(/[^0-9]/g, '').length : 0;
    this.rt.T.c += 40 + digits * 700 + (kind === 'f' ? 1200 : 0);
    for (let i = 0; i < s.length; i++) yield* this.put(s.charCodeAt(i));
    return s.length;
  }
  *ln() { yield* this.put(13); yield* this.put(10); return 2; }
  *write(b) { yield* this.put(b & 255); return 1; }
}

class HardwareSerial extends Printer {
  constructor(B, rt) {
    super();
    this.B = B; this.rt = rt;
    this.begun = false;
    this.cpc = 16640;
    this.txq = [];
    this.txAt = 0; // when the transmitter is free
    this.pending = [];
    this.rxAt = 0;
    this.rxbuf = [];
    this.timeout = 1000;
    this.lost = 0;
  }
  begin(baud) {
    const T = this.rt.T;
    T.c += 200;
    baud = baud >>> 0 || 9600;
    let mult = 8, ubrr = Math.floor((Math.floor(HZ / 4 / baud) - 1) / 2);
    if (ubrr > 4095 || baud === 57600) { mult = 16; ubrr = Math.floor((Math.floor(HZ / 8 / baud) - 1) / 2); }
    this.cpc = (ubrr + 1) * mult * 10;
    this.begun = true;
    this.txAt = T.c;
  }
  end() { this.begun = false; }
  emit(b) {
    this.B.usart.onByteTransmit?.(b);
  }
  pump() {
    const T = this.rt.T;
    while (this.txq.length && this.txAt <= (this.B.evNow ?? T.c)) { this.emit(this.txq.shift()); this.txAt += this.cpc; }
    if (this.txq.length) this.schedule();
  }
  schedule() {
    if (this.sched) return;
    this.sched = true;
    const T = this.rt.T;
    this.B.addEvent(() => { this.sched = false; this.pump(); }, Math.max(0, this.txAt - (this.B.evNow ?? T.c)));
  }
  *put(b) {
    const T = this.rt.T;
    T.c += 70; T.io = T.c;
    if (!this.begun) {
      if (!this.lost++) this.B.warnOnce('nobegin', this.B.line, 'The sketch prints to the serial monitor, but never starts it with Serial.begin(9600) in setup(). On a real board nothing would arrive.');
      return;
    }
    this.B.fire();
    if (!this.txq.length && this.txAt <= T.c) { this.emit(b); this.txAt = T.c + this.cpc; return; }
    while (this.txq.length >= 63) yield* this.B.wait(Math.max(16, this.txAt - T.c));
    this.txq.push(b);
    this.schedule();
  }
  *flush() { const T = this.rt.T; while (this.txq.length || this.txAt > T.c) yield* this.B.wait(Math.max(16, this.txAt - T.c)); }
  availableForWrite() { return 63 - this.txq.length; }
  // ---- receiving ----
  receive(text) {
    for (const b of new TextEncoder().encode(text)) this.pending.push(b);
  }
  rxPump() {
    const T = this.rt.T;
    if (!this.begun) return;
    if (this.pending.length && this.rxAt < T.c - this.cpc) this.rxAt = T.c - this.cpc;
    while (this.pending.length && this.rxAt + this.cpc <= T.c) {
      this.rxAt += this.cpc;
      const b = this.pending.shift();
      if (this.rxbuf.length < 63) this.rxbuf.push(b);
    }
  }
  available() { this.rt.T.c += 20; this.rt.T.io = this.rt.T.c; this.rxPump(); return this.rxbuf.length; }
  read() { this.rt.T.c += 25; this.rxPump(); return this.rxbuf.length ? this.rxbuf.shift() : -1; }
  peek() { this.rt.T.c += 20; this.rxPump(); return this.rxbuf.length ? this.rxbuf[0] : -1; }
  setTimeout(ms) { this.timeout = ms; }
  *timed(peek = false) {
    const start = this.rt.millis();
    do {
      this.rxPump();
      if (this.rxbuf.length) return peek ? this.rxbuf[0] : this.rxbuf.shift();
      yield* this.B.wait(16 * 100);
    } while (((this.rt.millis() - start) >>> 0) < this.timeout);
    return -1;
  }
  *parseInt() {
    let c;
    for (;;) { c = yield* this.timed(true); if (c < 0) return 0; if (c === 45 || (c >= 48 && c <= 57)) break; this.rxbuf.shift(); }
    let v = 0, neg = false;
    for (;;) {
      if (c === 45) neg = true; else if (c >= 48 && c <= 57) v = (Math.imul(v, 10) + c - 48) | 0;
      this.rxbuf.shift();
      c = yield* this.timed(true);
      if (!(c >= 48 && c <= 57)) break;
    }
    return neg ? -v | 0 : v;
  }
  *parseFloat() {
    let s = '', c;
    for (;;) { c = yield* this.timed(true); if (c < 0) return 0; if (c === 45 || c === 46 || (c >= 48 && c <= 57)) break; this.rxbuf.shift(); }
    while (c === 45 || c === 46 || (c >= 48 && c <= 57)) { s += String.fromCharCode(c); this.rxbuf.shift(); c = yield* this.timed(true); }
    const v = parseFloat(s);
    return v === v ? F(v) : 0;
  }
  *readString() { let s = ''; for (;;) { const c = yield* this.timed(); if (c < 0) return s; s += String.fromCharCode(c); } }
  *readStringUntil(t) { let s = ''; for (;;) { const c = yield* this.timed(); if (c < 0 || c === (t & 255)) return s; s += String.fromCharCode(c); } }
}

// ---------- Wire (I2C) ----------
class TwoWire {
  constructor(B, rt) { this.B = B; this.rt = rt; this.buf = []; this.addr = 0; this.rxb = []; }
  begin() {
    // twi_init turns on the pull-ups on SDA and SCL (A4, A5)
    const B = this.B;
    this.rt.T.c += 100;
    for (const p of [18, 19]) { B.port[p] = 1; B.apply(p); }
    B.changed();
  }
  setClock() {}
  beginTransmission(a) { this.rt.T.c += 20; this.addr = a & 127; this.buf = []; }
  write(b) { this.rt.T.c += 20; if (this.buf.length < 32) { this.buf.push(b & 255); return 1; } return 0; }
  *endTransmission() {
    const T = this.rt.T;
    T.io = T.c;
    const h = this.B.twi.eventHandler;
    const twi = this.B.twi;
    let res = 2;
    if (h) {
      h.start(false);
      twi.ack = false;
      h.connectToSlave(this.addr, true);
      if (twi.ack) {
        res = 0;
        for (const b of this.buf) { twi.ack = false; h.writeByte(b); if (!twi.ack) { res = 3; break; } }
      }
      h.stop();
    }
    T.c += 640 + this.buf.length * 160;
    return res;
  }
  *requestFrom(a, n) {
    const h = this.B.twi.eventHandler;
    this.rxb = [];
    if (h) {
      h.start(false);
      this.B.twi.ack = false;
      h.connectToSlave(a & 127, false);
      if (this.B.twi.ack) for (let i = 0; i < n; i++) { h.readByte(i === n - 1); this.rxb.push(this.B.twi.val & 255); }
      h.stop();
    }
    this.rt.T.c += 300 + n * 160;
    return this.rxb.length;
  }
  available() { return this.rxb.length; }
  read() { return this.rxb.length ? this.rxb.shift() : -1; }
}

// ---------- Servo ----------
class Servo {
  constructor(rt) { this.rt = rt; this.pin = -1; this.us = 1500; this.cur = 1500; this.min = 544; this.max = 2400; }
  *ctor() {}
  attach(pin, min, max) {
    const rt = this.rt;
    rt.pinMode(pin, 1);
    if (min !== undefined) this.min = min;
    if (max !== undefined) this.max = max;
    if (this.pin !== pin) {
      // the library's first pulse comes after its timer has gone once round (about 53 ms)
      this.live = false;
      this.rt.__board.addEvent(() => { if (this.pin === pin) { this.live = true; this.liveAt = this.rt.__board.cpu.cycles; this.frame(pin); } }, 52800 * US);
    }
    this.pin = pin;
    this.show();
    return 0;
  }
  // the library starts each pulse every 20 ms, with the width last written
  frame(pin) {
    if (this.pin !== pin || !this.live) return;
    this.cur = this.us;
    this.show();
    this.rt.__board.addEvent(() => this.frame(pin), 20000 * US);
  }
  show() {
    const B = this.rt.__board;
    if (this.pin < 0 || this.pin >= N || !this.live) return;
    // the library keeps time in half-microsecond ticks and trims 2 microseconds
    const ticks = Math.floor(((this.cur - 2) * 16) / 8);
    const us = ticks / 2 + 2;
    // (one pulse gives no frequency yet: the chip's is measured between two)
    B.wave[this.pin] = { kind: 'servo', duty: us / 20000, hz: B.cpu.cycles - this.liveAt >= 19999 * US ? 50 : 0, pulseUs: us };
    B.apply(this.pin); B.changed();
  }
  detach() {
    const B = this.rt.__board;
    if (this.pin >= 0 && B.wave[this.pin]?.kind === 'servo') { B.wave[this.pin] = null; B.apply(this.pin); B.changed(); }
    this.pin = -1;
  }
  write(v) {
    this.rt.T.c += 360;
    if (v < 544) { if (v < 0) v = 0; if (v > 180) v = 180; v = this.rt.map(v, 0, 180, this.min, this.max); }
    this.writeMicroseconds(v);
  }
  writeMicroseconds(v) {
    if (v < this.min) v = this.min; if (v > this.max) v = this.max;
    this.us = v;
  }
  readMicroseconds() { return Math.floor(((Math.floor(((this.us - 2) * 16) / 8)) * 8) / 16) + 2; }
  read() { return this.rt.map(this.readMicroseconds() + 1, this.min, this.max, 0, 180); }
  attached() { return this.pin >= 0 ? 1 : 0; }
}

// ---------- the 16x2 screen, wired to six pins ----------
class LiquidCrystal extends Printer {
  constructor(rt) { super(); this.rt = rt; }
  *ctor(...a) {
    // (rs, en, d4..d7) | (rs, rw, en, d4..d7) | 8-bit forms
    let rs, rw = 255, en, d;
    if (a.length === 6) [rs, en, ...d] = a;
    else if (a.length === 7) [rs, rw, en, ...d] = a;
    else if (a.length === 10) { [rs, en, ...d] = a; }
    else { [rs, rw, en, ...d] = a; }
    this.rs = rs; this.rw = rw; this.en = en; this.d = d;
    this.four = d.length === 4;
    this.fn = this.four ? 0x00 : 0x10;
    yield* this.begin(16, 1);
  }
  *begin(cols, lines, dots = 0) {
    const rt = this.rt;
    if (lines > 1) this.fn |= 0x08;
    this.lines = lines;
    this.offsets = [0x00, 0x40, cols, 0x40 + cols];
    if (dots && lines === 1) this.fn |= 0x04;
    rt.pinMode(this.rs, 1);
    if (this.rw !== 255) rt.pinMode(this.rw, 1);
    rt.pinMode(this.en, 1);
    for (let i = 0; i < (this.four ? 4 : 8); i++) rt.pinMode(this.d[i], 1);
    yield* rt.delayMicroseconds(50000);
    rt.digitalWrite(this.rs, 0);
    rt.digitalWrite(this.en, 0);
    if (this.rw !== 255) rt.digitalWrite(this.rw, 0);
    if (this.four) {
      yield* this.bits(0x03); yield* rt.delayMicroseconds(4500);
      yield* this.bits(0x03); yield* rt.delayMicroseconds(4500);
      yield* this.bits(0x03); yield* rt.delayMicroseconds(150);
      yield* this.bits(0x02);
    } else {
      yield* this.command(0x20 | this.fn); yield* rt.delayMicroseconds(4500);
      yield* this.command(0x20 | this.fn); yield* rt.delayMicroseconds(150);
      yield* this.command(0x20 | this.fn);
    }
    yield* this.command(0x20 | this.fn);
    this.ctl = 0x04;
    yield* this.display();
    yield* this.clear();
    this.mode = 0x02;
    yield* this.command(0x04 | this.mode);
  }
  *clear() { yield* this.command(0x01); yield* this.rt.delayMicroseconds(2000); }
  *home() { yield* this.command(0x02); yield* this.rt.delayMicroseconds(2000); }
  *setCursor(col, row) {
    if (row >= 4) row = 3;
    if (row >= this.lines) row = this.lines - 1;
    yield* this.command(0x80 | ((col + this.offsets[row]) & 255));
  }
  *noDisplay() { this.ctl &= ~0x04; yield* this.command(0x08 | this.ctl); }
  *display() { this.ctl |= 0x04; yield* this.command(0x08 | this.ctl); }
  *noCursor() { this.ctl &= ~0x02; yield* this.command(0x08 | this.ctl); }
  *cursor() { this.ctl |= 0x02; yield* this.command(0x08 | this.ctl); }
  *noBlink() { this.ctl &= ~0x01; yield* this.command(0x08 | this.ctl); }
  *blink() { this.ctl |= 0x01; yield* this.command(0x08 | this.ctl); }
  *scrollDisplayLeft() { yield* this.command(0x18); }
  *scrollDisplayRight() { yield* this.command(0x1c); }
  *leftToRight() { this.mode |= 0x02; yield* this.command(0x04 | this.mode); }
  *rightToLeft() { this.mode &= ~0x02; yield* this.command(0x04 | this.mode); }
  *autoscroll() { this.mode |= 0x01; yield* this.command(0x04 | this.mode); }
  *noAutoscroll() { this.mode &= ~0x01; yield* this.command(0x04 | this.mode); }
  *createChar(loc, map) {
    loc &= 7;
    yield* this.command(0x40 | (loc << 3));
    for (let i = 0; i < 8; i++) yield* this.put(map ? map.a[map.o + i] ?? 0 : 0);
  }
  *command(v) { yield* this.send(v, 0); }
  *put(v) { yield* this.send(v, 1); }
  *send(v, mode) {
    const rt = this.rt;
    rt.digitalWrite(this.rs, mode);
    if (this.rw !== 255) rt.digitalWrite(this.rw, 0);
    if (!this.four) yield* this.bits8(v);
    else { yield* this.bits(v >> 4); yield* this.bits(v); }
  }
  *pulse() {
    const rt = this.rt;
    rt.digitalWrite(this.en, 0);
    yield* rt.delayMicroseconds(1);
    rt.digitalWrite(this.en, 1);
    yield* rt.delayMicroseconds(1);
    rt.digitalWrite(this.en, 0);
    yield* rt.delayMicroseconds(100);
  }
  *bits(v) { for (let i = 0; i < 4; i++) this.rt.digitalWrite(this.d[i], (v >> i) & 1); yield* this.pulse(); }
  *bits8(v) { for (let i = 0; i < 8; i++) this.rt.digitalWrite(this.d[i], (v >> i) & 1); yield* this.pulse(); }
}

// ---------- the 16x2 screen with an I2C backpack (Frank de Brabander's library) ----------
class LiquidCrystal_I2C extends LiquidCrystal {
  *ctor(addr, cols, rows) { this.addr = addr; this.cols = cols; this.rows = rows; this.bl = 0; }
  *init() {
    this.rt.Wire.begin();
    this.fn = 0x00;
    yield* this.begin(this.cols, this.rows);
  }
  *begin(cols, lines, dots = 0) {
    const rt = this.rt;
    if (lines > 1) this.fn |= 0x08;
    this.lines = lines;
    if (dots && lines === 1) this.fn |= 0x04;
    yield* rt.delay(50);
    yield* this.ex(this.bl);
    yield* rt.delay(1000);
    yield* this.bits(0x30); yield* rt.delayMicroseconds(4500);
    yield* this.bits(0x30); yield* rt.delayMicroseconds(4500);
    yield* this.bits(0x30); yield* rt.delayMicroseconds(150);
    yield* this.bits(0x20);
    yield* this.command(0x20 | this.fn);
    this.ctl = 0x04;
    yield* this.display();
    yield* this.clear();
    this.mode = 0x02;
    yield* this.command(0x04 | this.mode);
    yield* this.home();
  }
  *setCursor(col, row) {
    const off = [0x00, 0x40, 0x14, 0x54];
    if (row > this.lines) row = this.lines - 1;
    yield* this.command(0x80 | ((col + (off[row] ?? 0)) & 255));
  }
  *backlight() { this.bl = 0x08; yield* this.ex(0); }
  *noBacklight() { this.bl = 0; yield* this.ex(0); }
  *setBacklight(v) { if (v) yield* this.backlight(); else yield* this.noBacklight(); }
  *send(v, mode) {
    yield* this.bits((v & 0xf0) | mode);
    yield* this.bits(((v << 4) & 0xf0) | mode);
  }
  *bits(v) { yield* this.ex(v); yield* this.ex(v | 0x04); yield* this.rt.delayMicroseconds(1); yield* this.ex(v & ~0x04); yield* this.rt.delayMicroseconds(50); }
  *ex(data) {
    const W = this.rt.Wire;
    W.beginTransmission(this.addr);
    W.write(data | this.bl);
    yield* W.endTransmission();
  }
}

// ---------- Keypad (Mark Stanley and Alexander Brevig's library, 3.1) ----------
class Keypad {
  constructor(rt) { this.rt = rt; }
  *ctor(map, rows, cols, nr, nc) {
    this.map = map; this.rows = rows; this.cols = cols; this.nr = nr; this.nc = nc;
    this.debounce = 10; this.hold = 500; this.start = 0; this.single = false; this.holdTimer = 0;
    this.bitMap = new Uint16Array(10);
    this.key = Array.from({ length: 10 }, () => ({ kchar: 0, kcode: 0, kstate: 0, changed: false }));
  }
  setDebounceTime(d) { this.debounce = d < 1 ? 1 : d; }
  setHoldTime(h) { this.hold = h; }
  pin(arr, i) { return arr.a[arr.o + i] & 255; }
  *getKey() {
    this.single = true;
    if ((yield* this.getKeys()) && this.key[0].changed && this.key[0].kstate === 1) return this.key[0].kchar;
    this.single = false;
    return 0;
  }
  *waitForKey() { let k = 0; while ((k = yield* this.getKey()) === 0) { if ((this.rt.T.c += 20) >= this.rt.T.lim) yield 0; } return k; }
  *getKeys() {
    const rt = this.rt;
    let act = false;
    rt.T.c += 30;
    if (((rt.millis() - this.start) >>> 0) > this.debounce) {
      this.scan();
      act = this.update();
      this.start = rt.millis();
    }
    return act ? 1 : 0;
  }
  scan() {
    const rt = this.rt;
    for (let r = 0; r < this.nr; r++) rt.pinMode(this.pin(this.rows, r), 2);
    for (let c = 0; c < this.nc; c++) {
      const cp = this.pin(this.cols, c);
      rt.pinMode(cp, 1);
      rt.digitalWrite(cp, 0);
      for (let r = 0; r < this.nr; r++) {
        const v = rt.digitalRead(this.pin(this.rows, r)) ? 0 : 1;
        if (v) this.bitMap[r] |= 1 << c; else this.bitMap[r] &= ~(1 << c);
      }
      rt.digitalWrite(cp, 1);
      rt.pinMode(cp, 0);
    }
  }
  update() {
    const K = this.key;
    for (const k of K) if (k.kstate === 0) { k.kchar = 0; k.kcode = -1; k.changed = false; }
    for (let r = 0; r < this.nr; r++) for (let c = 0; c < this.nc; c++) {
      const button = (this.bitMap[r] >> c) & 1;
      const code = r * this.nc + c;
      const ch = this.map.a[this.map.o + code] ?? 0;
      const idx = K.findIndex((k) => k.kcode === code);
      if (idx > -1) this.next(idx, button);
      if (idx === -1 && button) {
        const i = K.findIndex((k) => k.kchar === 0);
        if (i >= 0) { K[i].kchar = ch; K[i].kcode = code; K[i].kstate = 0; this.next(i, button); }
      }
    }
    return K.some((k) => k.changed);
  }
  next(i, button) {
    const k = this.key[i];
    const rt = this.rt;
    k.changed = false;
    const to = (s) => { k.kstate = s; k.changed = true; };
    switch (k.kstate) {
      case 0: if (button) { to(1); this.holdTimer = rt.millis(); } break;
      case 1: if (((rt.millis() - this.holdTimer) >>> 0) > this.hold) to(2); else if (!button) to(3); break;
      case 2: if (!button) to(3); break;
      case 3: to(0); break;
    }
  }
  getState() { return this.key[0].kstate; }
  keyStateChanged() { return this.key[0].changed ? 1 : 0; }
  isPressed(ch) { return this.key.some((k) => k.kchar === ch && k.kstate === 1 && k.changed) ? 1 : 0; }
}

// ---------- SimpleDHT11 (winlin's library) ----------
class SimpleDHT11 {
  constructor(rt) { this.rt = rt; }
  *ctor(pin = -1) { this.pin = pin; this.inMode = 0; }
  setPinInputMode(m) { if (m !== 0 && m !== 2) return 0x18; this.inMode = m; return 0; }
  *levelTime(level, first = 10, interval = 6) {
    const rt = this.rt;
    const t0 = rt.micros();
    let time = 0;
    for (let i = 0; ; i++) {
      if (time < 0 || time > 500000) return -1;
      if (i === 0) { if (first > 0) yield* rt.delayMicroseconds(first); } else if (interval > 0) yield* rt.delayMicroseconds(interval);
      time = (rt.micros() - t0) >>> 0;
      rt.__board.fire();
      if (rt.__board.readInput(this.pin) !== level) return time;
    }
  }
  *sample(data) {
    const rt = this.rt;
    const E = (t, e) => ((t << 8) | e);
    rt.pinMode(this.pin, 1);
    rt.digitalWrite(this.pin, 0);
    yield* rt.delay(20);
    rt.digitalWrite(this.pin, 1);
    rt.pinMode(this.pin, this.inMode);
    yield* rt.delayMicroseconds(25);
    let t = yield* this.levelTime(0);
    if (t < 30) return E(t, 0x10);
    t = yield* this.levelTime(1);
    if (t < 50) return E(t, 0x11);
    for (let j = 0; j < 40; j++) {
      t = yield* this.levelTime(0);
      if (t < 24) return E(t, 0x12);
      t = yield* this.levelTime(1);
      if (t < 11) return E(t, 0x13);
      data[j] = t > 40 ? 1 : 0;
    }
    t = yield* this.levelTime(0);
    if (t < 24) return E(t, 0x14);
    return 0;
  }
  *read(pt, ph, pdata) {
    if (this.pin === -1) return 0x17;
    const data = new Uint8Array(40);
    const r = yield* this.sample(data);
    if (r) return r | 0;
    const byte = (o) => { let v = 0; for (let i = 0; i < 8; i++) v += data[o + i] << (7 - i); return v & 255; };
    const h = byte(0), h2 = byte(8), tt = byte(16), t2 = byte(24), chk = byte(32);
    if (chk !== ((h + h2 + tt + t2) & 255)) return 0x15;
    if (pdata) for (let i = 0; i < 40; i++) pdata.a[pdata.o + i] = data[i];
    if (pt) pt.a[pt.o] = tt;
    if (ph) ph.a[ph.o] = h;
    if (tt === 0 && h === 0) return 0x16;
    return 0;
  }
}

// ---------- Stepper (Arduino's library, 1.1.3) ----------
class Stepper {
  constructor(rt) { this.rt = rt; }
  *ctor(steps, ...pins) {
    this.n = steps; this.pins = pins; this.stepNo = 0; this.dir = 0; this.last = 0; this.delay = 0;
    for (const p of pins) this.rt.pinMode(p, 1);
  }
  setSpeed(rpm) { this.delay = rpm ? Math.floor(Math.floor(60000000 / this.n) / rpm) >>> 0 : 0xffffffff; }
  version() { return 5; }
  *step(n) {
    const rt = this.rt;
    let left = Math.abs(n);
    if (n > 0) this.dir = 1;
    if (n < 0) this.dir = 0;
    while (left > 0) {
      const now = rt.micros();
      const gone = (now - this.last) >>> 0;
      if (gone >= this.delay) {
        this.last = now;
        if (this.dir === 1) { this.stepNo++; if (this.stepNo === this.n) this.stepNo = 0; }
        else { if (this.stepNo === 0) this.stepNo = this.n; this.stepNo--; }
        left--;
        this.motor(this.pins.length === 5 ? this.stepNo % 10 : this.stepNo % 4);
      } else {
        // the library spins on micros(); jump to the moment it would step
        const wait = Math.max(4, this.delay - gone) * US;
        yield* rt.__board.wait(Math.min(wait, 16000 * 50));
      }
      if ((rt.T.c += 30) >= rt.T.lim) yield 0;
    }
  }
  motor(s) {
    const P = this.pins, w = (a, b, c, d) => { this.rt.digitalWrite(P[0], a); this.rt.digitalWrite(P[1], b); if (P.length > 2) { this.rt.digitalWrite(P[2], c); this.rt.digitalWrite(P[3], d); } };
    if (P.length === 2) { [[0, 1], [1, 1], [1, 0], [0, 0]].slice(s, s + 1).forEach(([a, b]) => w(a, b)); return; }
    if (s === 0) w(1, 0, 1, 0); else if (s === 1) w(0, 1, 1, 0); else if (s === 2) w(0, 1, 0, 1); else w(1, 0, 0, 1);
  }
}

// ---------- TM1637Display (avishorp's library) ----------
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];
class TM1637Display {
  constructor(rt) { this.rt = rt; }
  *ctor(clk, dio, bitDelay = 100) {
    this.clk = clk; this.dio = dio; this.bd = bitDelay; this.br = 0;
    const rt = this.rt;
    rt.pinMode(clk, 0); rt.pinMode(dio, 0);
    rt.digitalWrite(clk, 0); rt.digitalWrite(dio, 0);
  }
  setBrightness(b, on = 1) { this.br = (b & 7) | (on ? 8 : 0); }
  encodeDigit(d) { return DIGITS[d & 15]; }
  *bit() { yield* this.rt.delayMicroseconds(this.bd); }
  *start() { this.rt.pinMode(this.dio, 1); yield* this.bit(); }
  *stop() { const rt = this.rt; rt.pinMode(this.dio, 1); yield* this.bit(); rt.pinMode(this.clk, 0); yield* this.bit(); rt.pinMode(this.dio, 0); yield* this.bit(); }
  *writeByte(b) {
    const rt = this.rt;
    let data = b;
    for (let i = 0; i < 8; i++) {
      rt.pinMode(this.clk, 1); yield* this.bit();
      rt.pinMode(this.dio, data & 1 ? 0 : 1); yield* this.bit();
      rt.pinMode(this.clk, 0); yield* this.bit();
      data >>= 1;
    }
    rt.pinMode(this.clk, 1); rt.pinMode(this.dio, 0); yield* this.bit();
    rt.pinMode(this.clk, 0); yield* this.bit();
    const ack = rt.digitalRead(this.dio);
    if (ack === 0) rt.pinMode(this.dio, 1);
    yield* this.bit();
    rt.pinMode(this.clk, 1); yield* this.bit();
    return ack;
  }
  *setSegments(seg, length = 4, pos = 0) {
    const s = Array.isArray(seg) ? seg : Array.from({ length }, (_, i) => seg.a[seg.o + i] & 255);
    yield* this.start(); yield* this.writeByte(0x40); yield* this.stop();
    yield* this.start(); yield* this.writeByte(0xc0 + (pos & 3));
    for (let k = 0; k < length; k++) yield* this.writeByte(s[k] ?? 0);
    yield* this.stop();
    yield* this.start(); yield* this.writeByte(0x80 + (this.br & 15)); yield* this.stop();
  }
  *clear() { yield* this.setSegments([0, 0, 0, 0]); }
  *showNumberDec(num, lead = 0, length = 4, pos = 0) { yield* this.showNumberDecEx(num, 0, lead, length, pos); }
  *showNumberDecEx(num, dots, lead = 0, length = 4, pos = 0) { yield* this.base(num < 0 ? -10 : 10, (num < 0 ? -num : num) & 0xffff, dots, lead, length, pos); }
  *showNumberHexEx(num, dots = 0, lead = 0, length = 4, pos = 0) { yield* this.base(16, num & 0xffff, dots, lead, length, pos); }
  *base(base, num, dots, lead, length, pos) {
    let neg = false;
    if (base < 0) { base = -base; neg = true; }
    const d = [0, 0, 0, 0];
    if (num === 0 && !lead) { for (let i = 0; i < length - 1; i++) d[i] = 0; d[length - 1] = DIGITS[0]; }
    else {
      for (let i = length - 1; i >= 0; --i) {
        const digit = (num % base) & 255;
        d[i] = digit === 0 && num === 0 && !lead ? 0 : DIGITS[digit & 15];
        if (digit === 0 && num === 0 && neg) { d[i] = 0x40; neg = false; }
        num = Math.floor(num / base);
      }
    }
    if (dots) for (let i = 0; i < 4; i++) { d[i] |= dots & 0x80; dots = (dots << 1) & 255; }
    yield* this.setSegments(d, length, pos);
  }
}


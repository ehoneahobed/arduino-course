// A virtual Arduino Uno: the ATmega328P, emulated by avr8js (MIT, vendored in
// assets/vendor/avr8js@0.21.1/), running a sketch's real machine code. It
// adds what the 3D labs need on top: every pin's level over time (how long it
// was high, how often it rose, its last pulse), so a lab can show a PWM
// light's brightness, a buzzer's pitch or a servo's angle from what the chip
// really did, and a way to drive the input pins.
//
// Uno pins: D0-D7 are port D, D8-D13 port B, A0-A5 (D14-D19) port C.
import {
  CPU, avrInstruction, AVRTimer, timer0Config, timer1Config, timer2Config,
  AVRIOPort, portBConfig, portCConfig, portDConfig, PinState,
  AVRUSART, usart0Config, AVRADC, adcConfig, AVRTWI, twiConfig, ADCMuxInputType,
} from '../../vendor/avr8js@0.21.1/index.js';

export const HZ = 16e6;
export { PinState };
const PORTS = [['D', portDConfig, 0, 8], ['B', portBConfig, 8, 6], ['C', portCConfig, 14, 6]];
const N = 20;

// 'A0'..'A5', 'SDA', 'SCL', '0'..'13' -> 0..19 (or -1)
export function pinNumber(name) {
  if (/^\d+$/.test(name)) return +name <= 13 ? +name : -1;
  const a = /^A([0-5])$/.exec(name);
  if (a) return 14 + +a[1];
  if (name === 'SDA') return 18;
  if (name === 'SCL') return 19;
  return -1;
}
export const pinLabel = (p) => (p >= 14 ? 'A' + (p - 14) : String(p));

export class Uno {
  constructor(bytes) {
    const prog = new Uint16Array(0x4000);
    new Uint8Array(prog.buffer).set(bytes.subarray(0, 0x8000));
    const cpu = (this.cpu = new CPU(prog));
    this.timers = [timer0Config, timer1Config, timer2Config].map((c) => new AVRTimer(cpu, c));
    this.usart = new AVRUSART(cpu, usart0Config, HZ);
    this.adc = new AVRADC(cpu, adcConfig);
    this.twi = new AVRTWI(cpu, twiConfig, HZ);
    // A real analogRead never gives quite the same number twice (the course
    // says so, and b6_03 depends on it): adcNoise[ch] is that wobble, in volts.
    this.adcNoise = new Float32Array(8);
    const adc = this.adc;
    const plain = adc.onADCRead;
    adc.onADCRead = (input) => {
      const ch = input.channel;
      if (input.type !== ADCMuxInputType.SingleEnded || !this.adcNoise[ch]) { plain(input); return; }
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * 1.4; // roughly normal, sigma about 1
      const v = (adc.channelValues[ch] ?? 0) + g * this.adcNoise[ch];
      const raw = Math.min(1023, Math.max(0, Math.floor((v / adc.referenceVoltage) * 1024)));
      cpu.addClockEvent(() => adc.completeADCRead(raw), adc.sampleCycles);
    };
    this.port = [];
    this.bit = [];
    // per pin: level now, cycle of the last change, high cycles in this window,
    // rising edges in this window, the last rise, the last period, the last high pulse
    this.level = new Uint8Array(N);
    this.since = new Float64Array(N);
    this.hi = new Float64Array(N);
    this.rises = new Uint32Array(N);
    this.lastRise = new Float64Array(N).fill(-1e12);
    this.lastFall = new Float64Array(N).fill(-1e12);
    this.period = new Float64Array(N);
    this.pulse = new Float64Array(N);
    this.edge = []; // edge[p] = fn(level, cycle): called on every change of an output pin
    this.onChange = null; // any port write (outputs, modes or pull-ups)
    this.windowStart = 0;
    this.rx = [];
    for (const [, cfg, base, n] of PORTS) {
      const port = new AVRIOPort(cpu, cfg);
      for (let b = 0; b < n; b++) { this.port[base + b] = port; this.bit[base + b] = b; }
      port.addListener((value, old) => this._changed(base, n, value, old));
    }
  }

  _changed(base, n, value, old) {
    const now = this.cpu.cycles;
    const diff = value ^ old;
    if (diff) {
      for (let b = 0; b < n; b++) {
        if (!(diff & (1 << b))) continue;
        const p = base + b;
        const v = (value >> b) & 1;
        if (this.level[p]) this.hi[p] += now - this.since[p];
        this.since[p] = now;
        this.level[p] = v;
        if (v) {
          this.rises[p]++;
          this.period[p] = now - this.lastRise[p];
          this.lastRise[p] = now;
        } else {
          this.pulse[p] = now - this.lastRise[p];
          this.lastFall[p] = now;
        }
        const f = this.edge[p];
        if (f) f(v, now);
      }
    }
    if (this.onChange) this.onChange();
  }

  // Output, input or pull-up (PinState), as the sketch has set the pin.
  mode(p) { return this.port[p].pinState(this.bit[p]); }
  isOutput(p) { const m = this.mode(p); return m === PinState.High || m === PinState.Low; }
  // What the outside world puts on an input pin.
  setInput(p, v) { this.port[p].setPin(this.bit[p], !!v); }
  readInput(p) { return (this.cpu.data[this.port[p].portConfig.PIN] >> this.bit[p]) & 1; }

  // Run for `cycles` clock cycles, or until the wall clock passes `deadline` (ms).
  run(cycles, deadline) {
    const cpu = this.cpu;
    const end = cpu.cycles + cycles;
    const usart = this.usart;
    while (cpu.cycles < end) {
      for (let i = 0; i < 2000; i++) { avrInstruction(cpu); cpu.tick(); }
      if (this.rx.length && !usart.rxBusy && usart.rxEnable) usart.writeByte(this.rx.shift());
      if (performance.now() > deadline) break;
    }
  }

  // What every pin did since the last sample: duty (0..1 of the time high),
  // frequency (Hz, from the last period, if it is still toggling) and the last
  // high pulse (microseconds).
  sample() {
    const now = this.cpu.cycles;
    const span = Math.max(1, now - this.windowStart);
    const out = [];
    for (let p = 0; p < N; p++) {
      if (this.level[p]) { this.hi[p] += now - this.since[p]; this.since[p] = now; }
      const recent = now - this.lastRise[p] < Math.max(0.05 * HZ, this.period[p] * 1.5);
      const toggling = recent && this.rises[p] > 0;
      out.push({
        mode: this.mode(p),
        level: this.level[p],
        duty: Math.min(1, this.hi[p] / span),
        hz: toggling && this.period[p] > 0 ? HZ / this.period[p] : 0,
        pulseUs: recent && now - this.lastRise[p] < 0.06 * HZ ? this.pulse[p] / 16 : 0,
      });
      this.hi[p] = 0;
      this.rises[p] = 0;
    }
    this.windowStart = now;
    return out;
  }

  send(text) { for (const ch of new TextEncoder().encode(text)) this.rx.push(ch); }
  get seconds() { return this.cpu.cycles / HZ; }
}

// Base64 machine code (from tools/compile_sketches.mjs) to bytes.
export function decodeProgram(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

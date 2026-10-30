// The parts that answer the board in time with it: the HC-SR04's echo, the
// DHT11's 40 bits, the TM1637's two-wire bus, the keypad's rows and columns
// and the 16x2 screen on six pins. Shared by sim.js (the page) and
// tools/interp_check.mjs (the fidelity test), and by both boards: the
// emulated chip (uno.js) and the course's interpreter (vboard.js).
import { PinState } from '../../vendor/avr8js@0.21.1/index.js';

export const HZ = 16e6;
const OUT = (m) => m === PinState.High || m === PinState.Low;

// HC-SR04: a 10 microsecond pulse on Trig, then Echo goes high for the time
// sound takes there and back (58.3 microseconds a centimetre; 38 ms for nothing in range).
export function wireSonar(uno, s, trig, echo) {
  let rise = 0;
  s.busy = false;
  uno.setInput(echo, 0);
  uno.edge[trig] = (v, now) => {
    if (v) { rise = now; return; }
    if (s.busy || now - rise < 8 * 16) return; // a trigger needs 10 microseconds high
    s.busy = true;
    const us = s.cm > 400 ? 38000 : s.cm * 58.3;
    uno.cpu.addClockEvent(() => {
      uno.setInput(echo, 1);
      uno.cpu.addClockEvent(() => { uno.setInput(echo, 0); s.busy = false; s.pings = (s.pings || 0) + 1; }, Math.round(us * 16));
    }, 450 * 16);
  };
}

// The 16x2 screen in 4-bit mode: a nibble is latched when E falls.
export function wireLcd(uno, chip, rs, e, d) {
  uno.edge[e] = (v) => { if (!v) chip.nibble(uno.level[rs], uno.level[d[0]] | (uno.level[d[1]] << 1) | (uno.level[d[2]] << 2) | (uno.level[d[3]] << 3)); };
}

// DHT11: answers a start signal (data pin held low, then let go) with 40 bits.
export function dhtStart(uno, D, pin) {
  D.pin = pin;
  D.lowSince = -1;
  D.busy = false;
  uno.setInput(pin, 1);
}
export function dhtWatch(uno, D) {
  if (D.pin === undefined || D.busy) return;
  const m = uno.mode(D.pin);
  const now = uno.cpu.cycles;
  if (m === PinState.Low) { if (D.lowSince < 0) D.lowSince = now; return; }
  // the start signal: held low for a millisecond or more, then let go (perhaps high for a moment first)
  if (D.lowSince >= 0) { D.armed = now - D.lowSince > 0.001 * HZ ? now : -1; D.lowSince = -1; }
  if (!OUT(m) && D.armed >= 0 && now - D.armed < 0.0005 * HZ) {
    D.armed = -1;
    D.busy = true;
    const h = Math.round(D.hum), tt = Math.round(D.temp);
    const bytes = [h, 0, tt, 0, (h + tt) & 0xff];
    // [microseconds, then the level]: wait, low 80, high 80, then each bit
    // (low 50, high 27 for a 0 or 70 for a 1), a last low 50, and let go
    let at = 0;
    const steps = [[12, 0], [80, 1], [80, 0]];
    for (const b of bytes) for (let k = 7; k >= 0; k--) steps.push([50, 1], [(b >> k) & 1 ? 70 : 27, 0]);
    steps.push([50, 1]);
    for (const [us, lv] of steps) {
      at += us;
      uno.cpu.addClockEvent(() => uno.setInput(D.pin, lv), Math.round(at * 16));
    }
    uno.cpu.addClockEvent(() => { D.busy = false; D.reads = (D.reads || 0) + 1; }, Math.round((at + 10) * 16));
  }
}

// TM1637 four-digit display: two wires, the board pulls them low or lets them float high.
export const SEG = { 0x3f: '0', 0x06: '1', 0x5b: '2', 0x4f: '3', 0x66: '4', 0x6d: '5', 0x7d: '6', 0x07: '7', 0x7f: '8', 0x6f: '9', 0x77: 'A', 0x7c: 'b', 0x39: 'C', 0x5e: 'd', 0x79: 'E', 0x71: 'F', 0x40: '-', 0x00: ' ', 0x76: 'H', 0x38: 'L', 0x73: 'P', 0x3e: 'U', 0x54: 'n', 0x5c: 'o', 0x50: 'r', 0x78: 't', 0x6e: 'y', 0x08: '_', 0x63: '°' };
export function tmMake(clk, dio) { return { clk, dio, bits: 0, n: 0, bytes: [], seg: [0, 0, 0, 0], on: false, last: [1, 1], cmd: -1 }; }
export function tmWatch(uno, tm) {
  const bus = (p) => (uno.mode(p) === PinState.Low ? 0 : 1);
  const c = bus(tm.clk), d = bus(tm.dio);
  const [pc, pd] = tm.last;
  if (c && pc && pd && !d) { tm.bits = 0; tm.n = 0; tm.bytes = []; } // start
  else if (c && pc && !pd && d) { tmCommand(tm, tm.bytes); tm.bytes = []; } // stop
  else if (c && !pc) {
    if (tm.n < 8) { tm.bits |= d << tm.n; tm.n++; } else { tm.bytes.push(tm.bits); tm.bits = 0; tm.n = 0; } // the 9th clock is the ack
  }
  tm.last = [c, d];
  if (uno.readInput(tm.dio) !== 1 && uno.mode(tm.dio) !== PinState.Low) uno.setInput(tm.dio, 1);
  if (uno.readInput(tm.clk) !== 1 && uno.mode(tm.clk) !== PinState.Low) uno.setInput(tm.clk, 1);
}
function tmCommand(tm, b) {
  if (!b.length) return;
  const c = b[0];
  if ((c & 0xc0) === 0xc0) { let a = c & 3; for (const x of b.slice(1)) { if (a < 4) tm.seg[a] = x; a++; } tm.dirty = true; }
  else if ((c & 0xc0) === 0x80) { tm.on = !!(c & 8); tm.dirty = true; }
}
export const tmText = (tm) => (tm.on ? tm.seg.map((s) => SEG[s & 0x7f] ?? '?').join('') : '    ');

// Keypad: a pressed key joins a row pin to a column pin. rows, cols: pin numbers (-1 if not wired).
export function padResolve(uno, rows, cols, down, floatV) {
  const drv = (p) => (p >= 0 && OUT(uno.mode(p)) ? uno.level[p] : -1);
  // rows and columns both: low if a pressed key joins it to a pin driven low
  const all = [...rows.map((p, r) => ({ p, r })), ...cols.map((p, c) => ({ p, c }))];
  for (const x of all) {
    if (x.p < 0 || OUT(uno.mode(x.p))) continue;
    let v = uno.mode(x.p) === PinState.InputPullUp ? 1 : floatV[x.p] > 2.5 ? 1 : 0;
    for (const key of down) {
      const other = x.r !== undefined ? (key.r === x.r ? cols[key.c] : -1) : key.c === x.c ? rows[key.r] : -1;
      const d = other >= 0 ? drv(other) : -1;
      if (d >= 0) { v = d; break; }
    }
    if (uno.readInput(x.p) !== v) uno.setInput(x.p, v);
  }
}

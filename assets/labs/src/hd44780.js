// The 16x2 screen's controller chip, the HD44780, as far as the course's
// sketches use it: the LiquidCrystal library (4-bit wiring, RS / E / D4-D7)
// and LiquidCrystal_I2C (the same chip behind a PCF8574 "backpack" at an I2C
// address, usually 0x27). It is fed exactly what the sketch sends: nibbles
// latched on E's falling edge, or bytes over I2C.
export class HD44780 {
  constructor() { this.reset(); }
  reset() {
    this.ddram = new Uint8Array(128).fill(0x20);
    this.cgram = new Uint8Array(64);
    this.ac = 0; // address counter
    this.cgMode = false;
    this.eightBit = true; // power-on state
    this.half = -1; // the first nibble of a byte in 4-bit mode
    this.inc = 1;
    this.shiftOnWrite = false;
    this.on = false;
    this.cursor = false;
    this.blink = false;
    this.twoLines = false;
    this.scroll = 0;
    this.light = true;
    this.dirty = true;
    this.writes = 0;
  }
  // One E pulse on a 4-bit bus: D4-D7 carry `n`.
  nibble(rs, n) {
    if (this.eightBit) { this.byte(rs, n << 4); return; } // D0-D3 not wired: read as 0
    if (this.half < 0) { this.half = n; return; }
    const b = (this.half << 4) | n;
    this.half = -1;
    this.byte(rs, b);
  }
  byte(rs, b) {
    this.dirty = true;
    if (rs) { this.data(b); return; }
    if (b & 0x80) { this.ac = b & 0x7f; this.cgMode = false; }
    else if (b & 0x40) { this.cg = b & 0x3f; this.cgMode = true; }
    else if (b & 0x20) {
      this.eightBit = !!(b & 0x10);
      this.twoLines = !!(b & 0x08);
      this.half = -1;
    } else if (b & 0x10) {
      if (b & 0x08) this.scroll += b & 0x04 ? -1 : 1; // display shift
      else this.move(b & 0x04 ? 1 : -1); // cursor move
    } else if (b & 0x08) { this.on = !!(b & 4); this.cursor = !!(b & 2); this.blink = !!(b & 1); }
    else if (b & 0x04) { this.inc = b & 2 ? 1 : -1; this.shiftOnWrite = !!(b & 1); }
    else if (b & 0x02) { this.ac = 0; this.scroll = 0; this.cgMode = false; }
    else if (b & 0x01) { this.ddram.fill(0x20); this.ac = 0; this.scroll = 0; this.inc = 1; this.cgMode = false; }
  }
  move(d) {
    let a = this.ac + d;
    if (this.twoLines) {
      if (a === 0x28) a = 0x40; else if (a === 0x68) a = 0; else if (a === 0x3f) a = 0x27; else if (a === -1) a = 0x67;
    } else a = (a + 80) % 80;
    this.ac = a & 0x7f;
  }
  data(b) {
    this.writes++;
    if (this.cgMode) { this.cgram[this.cg] = b & 0x1f; this.cg = (this.cg + this.inc) & 0x3f; return; }
    this.ddram[this.ac] = b;
    this.move(this.inc);
    if (this.shiftOnWrite) this.scroll += this.inc;
  }
  // The two rows of sixteen as character codes, as they show on the glass.
  rows() {
    const out = [];
    for (let r = 0; r < 2; r++) {
      const row = [];
      for (let k = 0; k < 16; k++) {
        if (!this.on || (r === 1 && !this.twoLines)) { row.push(32); continue; }
        const col = (((k + this.scroll) % 40) + 40) % 40;
        row.push(this.ddram[(r ? 0x40 : 0) + col]);
      }
      out.push(row);
    }
    return out;
  }
  cursorCell() {
    if (!this.on || !this.cursor) return -1;
    const r = this.ac >= 0x40 ? 1 : 0;
    const k = (((this.ac - (r ? 0x40 : 0) - this.scroll) % 40) + 40) % 40;
    return k < 16 ? r * 16 + k : -1;
  }
  text() {
    return this.rows().map((r) => r.map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : c === 0xdf ? '°' : c < 8 ? '▒' : '?')).join(''));
  }
}

// A PCF8574 I2C backpack in front of the HD44780 (the LiquidCrystal_I2C
// wiring): P0 RS, P1 RW, P2 E, P3 backlight, P4-P7 D4-D7. An avr8js TWI event
// handler, so the sketch's Wire library talks to it as to the real thing.
export class Backpack {
  constructor(twi, lcd, address = 0x27) {
    this.twi = twi;
    this.lcd = lcd;
    this.address = address;
    this.sel = false;
    this.last = 0;
    this.seen = false; // has the sketch ever addressed us?
  }
  start() { this.twi.completeStart(); }
  stop() { this.sel = false; this.twi.completeStop(); }
  connectToSlave(addr, write) {
    this.sel = addr === this.address;
    if (this.sel) this.seen = true;
    this.write = write;
    this.twi.completeConnect(this.sel);
  }
  writeByte(v) {
    if (this.sel) {
      const fall = (this.last & 4) && !(v & 4);
      if (fall) this.lcd.nibble(this.last & 1, this.last >> 4);
      if (!!(v & 8) !== this.lcd.light) { this.lcd.light = !!(v & 8); this.lcd.dirty = true; }
      this.last = v;
    }
    this.twi.completeWrite(this.sel);
  }
  readByte() { this.twi.completeRead(this.last | 0xf0); }
}

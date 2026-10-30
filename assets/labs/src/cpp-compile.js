// The course's Arduino C++ interpreter, part 2: checking a sketch and
// turning it into JavaScript.
//
// compileSketch(source, name) reads the sketch (cpp-parse.js), checks it the
// way the real compiler would (types, scopes, arguments, setup and loop) and
// writes one JavaScript program. Every C++ function becomes a JavaScript
// generator, so delay() and long loops can pause and let the page breathe:
// the board (vboard.js) runs the program in slices of virtual time.
//
// Numbers behave as on the Uno's chip: int is 16 bits and wraps, long is 32,
// float and double are both 32-bit floats, integer division truncates, char
// is signed. Errors carry the line and column and are worded as avr-gcc words
// them ("expected ';' before '}' token", "'x' was not declared in this scope").
import { lex, preprocess, parse, CompileError } from './cpp-parse.js';

// ---------- types ----------
const INTS = ['bool', 'i8', 'u8', 'i16', 'u16', 'i32', 'u32'];
const RANGE = { bool: [0, 1], i8: [-128, 127], u8: [0, 255], i16: [-32768, 32767], u16: [0, 65535], i32: [-2147483648, 2147483647], u32: [0, 4294967295] };
const isInt = (t) => typeof t === 'string' && INTS.includes(t);
const isArith = (t) => isInt(t) || t === 'f32';
const isPtr = (t) => t && t.k === 'ptr';
const isArr = (t) => t && t.k === 'arr';
const isObj = (t) => t && t.k === 'obj';
const SIZE = { bool: 1, i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, String: 6 };
const TA = { bool: 'Uint8Array', i8: 'Int8Array', u8: 'Uint8Array', i16: 'Int16Array', u16: 'Uint16Array', i32: 'Int32Array', u32: 'Uint32Array', f32: 'Float32Array' };
const NAME = { void: 'void', bool: 'bool', i8: 'char', u8: 'byte {aka unsigned char}', i16: 'int', u16: 'unsigned int', i32: 'long int', u32: 'long unsigned int', f32: 'float', String: 'String' };
export function typeName(t) {
  if (typeof t === 'string') return NAME[t] || t;
  if (isPtr(t)) return (t.cst ? 'const ' : '') + typeName(t.to).replace(/ \{aka.*\}/, '') + '*';
  if (isArr(t)) return typeName(t.of).replace(/ \{aka.*\}/, '') + t.dims.map((d) => `[${d}]`).join('');
  if (isObj(t)) return t.cls;
  if (t && t.k === 'fn') return `${typeName(t.ret)}(${t.params.map((p) => typeName(p.t)).join(', ')})`;
  return '?';
}
const sizeOf = (t) => (typeof t === 'string' ? SIZE[t] ?? 1 : isPtr(t) ? 2 : isArr(t) ? sizeOf(t.of) * t.dims.reduce((a, b) => a * b, 1) : isObj(t) ? 8 : 1);
const promote = (t) => (t === 'bool' || t === 'i8' || t === 'u8' || t === 'i16' ? 'i16' : t);
function common(a, b) {
  if (a === 'f32' || b === 'f32') return 'f32';
  a = promote(a); b = promote(b);
  if (a === b) return a;
  if (a === 'u32' || b === 'u32') return 'u32';
  if (a === 'i32' || b === 'i32') return 'i32';
  return 'u16';
}
const WRAP = { bool: (c) => `((${c})?1:0)`, i8: (c) => `((${c})<<24>>24)`, u8: (c) => `((${c})&255)`, i16: (c) => `((${c})<<16>>16)`, u16: (c) => `((${c})&65535)`, i32: (c) => `((${c})|0)`, u32: (c) => `((${c})>>>0)`, f32: (c) => `F(${c})` };

// ---------- pointers and the pure helpers (shared by folding and the runtime) ----------
export class Ptr {
  constructor(a, o) { this.a = a; this.o = o; }
}
export const PURE = {
  F: Math.fround,
  $P: (a, o) => new Ptr(a, o),
  $d16: (a, b) => (b ? ((a / b) | 0) << 16 >> 16 : -1),
  $du16: (a, b) => (b ? ((a / b) >>> 0) & 65535 : 65535),
  $d32: (a, b) => (b ? (a / b) | 0 : -1),
  $du32: (a, b) => (b ? Math.floor(a / b) >>> 0 : 4294967295),
  $m16: (a, b) => (b ? (a % b) << 16 >> 16 : a),
  $mu16: (a, b) => (b ? (a % b) & 65535 : a),
  $m32: (a, b) => (b ? (a % b) | 0 : a),
  $mu32: (a, b) => (b ? (a % b) >>> 0 : a),
  $ftoi: (x) => (x !== x ? 0 : x > 4294967295 || x < -2147483648 ? 0 : Math.trunc(x)),
  $arr: (C, n, v) => { const a = new C(n); for (let i = 0; i < v.length; i++) a[i] = v[i]; return a; },
  $arrA: (n, v, fill) => { const a = new Array(n).fill(fill); for (let i = 0; i < v.length; i++) a[i] = v[i]; return a; },
  $peq: (a, b) => (a === b || (a !== null && b !== null && a.a === b.a && a.o === b.o) ? 1 : 0),
};
const PURE_NAMES = Object.keys(PURE);
function foldCode(code) {
  try {
    // eslint-disable-next-line no-new-func
    return Function(...PURE_NAMES, `"use strict"; return (${code});`)(...PURE_NAMES.map((k) => PURE[k]));
  } catch { return undefined; }
}
const lit = (v) => (Object.is(v, -0) ? '0' : v < 0 ? `(${v})` : String(v));

// ---------- the Arduino library, as the compiler sees it ----------
const K = (r, p, more = {}) => ({ r, p, ...more });
const BUILTINS = {
  pinMode: K('void', ['u8', 'u8']), digitalWrite: K('void', ['u8', 'u8']), digitalRead: K('i16', ['u8']),
  analogRead: K('i16', ['u8']), analogWrite: K('void', ['u8', 'i16']), analogReference: K('void', ['u8']),
  delay: K('void', ['u32'], { gen: true, line: true }), delayMicroseconds: K('void', ['u16'], { gen: true, line: true }),
  millis: K('u32', []), micros: K('u32', []),
  pulseIn: K('u32', ['u8', 'u8', 'u32'], { min: 2, gen: true, line: true }), pulseInLong: K('u32', ['u8', 'u8', 'u32'], { min: 2, gen: true, line: true, js: 'pulseIn' }),
  tone: K('void', ['u8', 'u16', 'u32'], { min: 2 }), noTone: K('void', ['u8']),
  map: K('i32', ['i32', 'i32', 'i32', 'i32', 'i32']), randomSeed: K('void', ['u32']),
  shiftOut: K('void', ['u8', 'u8', 'u8', 'u8']), shiftIn: K('u8', ['u8', 'u8', 'u8']),
  sqrt: K('f32', ['f32'], { js: 'fm.sqrt' }), sin: K('f32', ['f32'], { js: 'fm.sin' }), cos: K('f32', ['f32'], { js: 'fm.cos' }), tan: K('f32', ['f32'], { js: 'fm.tan' }),
  asin: K('f32', ['f32'], { js: 'fm.asin' }), acos: K('f32', ['f32'], { js: 'fm.acos' }), atan: K('f32', ['f32'], { js: 'fm.atan' }), exp: K('f32', ['f32'], { js: 'fm.exp' }),
  log: K('f32', ['f32'], { js: 'fm.log' }), log10: K('f32', ['f32'], { js: 'fm.log10' }), fabs: K('f32', ['f32'], { js: 'fm.abs' }), floor: K('f32', ['f32'], { js: 'fm.floor' }),
  ceil: K('f32', ['f32'], { js: 'fm.ceil' }), trunc: K('f32', ['f32'], { js: 'fm.trunc' }),
  pow: K('f32', ['f32', 'f32'], { js: 'fm.pow' }), atan2: K('f32', ['f32', 'f32'], { js: 'fm.atan2' }), fmod: K('f32', ['f32', 'f32'], { js: 'fm.fmod' }), hypot: K('f32', ['f32', 'f32'], { js: 'fm.hypot' }),
  isDigit: K('bool', ['i16']), isAlpha: K('bool', ['i16']), isAlphaNumeric: K('bool', ['i16']), isSpace: K('bool', ['i16']), isUpperCase: K('bool', ['i16']), isLowerCase: K('bool', ['i16']), isPunct: K('bool', ['i16']),
  toUpperCase: K('i16', ['i16']), toLowerCase: K('i16', ['i16']),
  strlen: K('u16', ['ptr']), strcmp: K('i16', ['ptr', 'ptr']),
  yield: K('void', [], { js: 'nop' }), interrupts: K('void', [], { js: 'nop' }), noInterrupts: K('void', [], { js: 'nop' }),
};
const UNSUPPORTED = { attachInterrupt: 'Interrupts (attachInterrupt) are', detachInterrupt: 'Interrupts are', digitalPinToInterrupt: 'Interrupts are', malloc: 'malloc is', free: 'free is', EEPROM: 'EEPROM is', sprintf: 'sprintf is', snprintf: 'snprintf is', printf: 'printf is' };
const MACROS = new Set(['abs', 'min', 'max', 'constrain', 'sq', 'round', 'radians', 'degrees', 'bitRead', 'bitSet', 'bitClear', 'bitWrite', 'bit', 'lowByte', 'highByte', 'makeKeymap', 'F', 'random', 'word']);
const CONSTS = {
  HIGH: ['i16', 1], LOW: ['i16', 0], INPUT: ['i16', 0], OUTPUT: ['i16', 1], INPUT_PULLUP: ['i16', 2], LED_BUILTIN: ['i16', 13],
  A0: ['u8', 14], A1: ['u8', 15], A2: ['u8', 16], A3: ['u8', 17], A4: ['u8', 18], A5: ['u8', 19], A6: ['u8', 20], A7: ['u8', 21], SDA: ['u8', 18], SCL: ['u8', 19],
  true: ['bool', 1], false: ['bool', 0], DEC: ['i16', 10], HEX: ['i16', 16], OCT: ['i16', 8], BIN: ['i16', 2],
  LSBFIRST: ['i16', 0], MSBFIRST: ['i16', 1], CHANGE: ['i16', 1], FALLING: ['i16', 2], RISING: ['i16', 3], DEFAULT: ['i16', 1], EXTERNAL: ['i16', 0], INTERNAL: ['i16', 3],
  PI: ['f32', Math.fround(3.1415926535897932384626433832795)], HALF_PI: ['f32', Math.fround(1.5707963267948966192313216916398)], TWO_PI: ['f32', Math.fround(6.283185307179586476925286766559)],
  DEG_TO_RAD: ['f32', Math.fround(0.017453292519943295769236907684886)], RAD_TO_DEG: ['f32', Math.fround(57.295779513082320876798154814105)], EULER: ['f32', Math.fround(2.718281828459045)],
  SERIAL_8N1: ['i16', 6], NO_KEY: ['i8', 0, 'Keypad.h'], SimpleDHTErrSuccess: ['i16', 0, 'SimpleDHT.h'],
  IDLE: ['i16', 0, 'Keypad.h'], PRESSED: ['i16', 1, 'Keypad.h'], HOLD: ['i16', 2, 'Keypad.h'], RELEASED: ['i16', 3, 'Keypad.h'],
  INT_MAX: ['i16', 32767], INT_MIN: ['i16', -32768], LONG_MAX: ['i32', 2147483647], LONG_MIN: ['i32', -2147483648], UINT_MAX: ['u16', 65535], ULONG_MAX: ['u32', 4294967295],
};
const PRINT = { print: 1, println: 1 };
// Classes: their header, constructors (argument types), and methods.
const M = (r, p = [], more = {}) => ({ r, p, ...more });
export const CLASSES = {
  HardwareSerial: {
    print: true, gen: true,
    methods: {
      begin: M('void', ['u32', 'u8'], { min: 1 }), end: M('void'), available: M('i16'), read: M('i16'), peek: M('i16'), flush: M('void', [], { gen: true }),
      write: M('u16', ['u8'], { gen: true, writeLike: true }), availableForWrite: M('i16'), setTimeout: M('void', ['u32']),
      parseInt: M('i32', [], { gen: true }), parseFloat: M('f32', [], { gen: true }), readString: M('String', [], { gen: true }), readStringUntil: M('String', ['i8'], { gen: true }),
    },
  },
  TwoWire: { header: 'Wire.h', methods: { begin: M('void', ['u8'], { min: 0 }), beginTransmission: M('void', ['u8']), write: M('u16', ['u8']), endTransmission: M('u8', ['bool'], { min: 0, gen: true }), requestFrom: M('u8', ['u8', 'u8'], { gen: true }), available: M('i16'), read: M('i16'), setClock: M('void', ['u32']) } },
  Servo: {
    header: 'Servo.h', ctor: [[]],
    methods: { attach: M('u8', ['u8', 'i16', 'i16'], { min: 1 }), detach: M('void'), write: M('void', ['i16']), writeMicroseconds: M('void', ['i16']), read: M('i16'), readMicroseconds: M('i16'), attached: M('bool') },
  },
  LiquidCrystal: {
    header: 'LiquidCrystal.h', print: true, gen: true, ctor: [['u8', 'u8', 'u8', 'u8', 'u8', 'u8'], ['u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8'], ['u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8'], ['u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8', 'u8']],
    methods: lcdMethods({}),
  },
  LiquidCrystal_I2C: {
    header: 'LiquidCrystal_I2C.h', print: true, gen: true, ctor: [['u8', 'u8', 'u8']],
    methods: lcdMethods({ init: M('void', [], { gen: true }), backlight: M('void', [], { gen: true }), noBacklight: M('void', [], { gen: true }), setBacklight: M('void', ['u8'], { gen: true }) }),
  },
  Keypad: {
    header: 'Keypad.h', ctor: [['ptr', 'ptr', 'ptr', 'u8', 'u8']],
    methods: { getKey: M('i8', [], { gen: true }), waitForKey: M('i8', [], { gen: true }), getKeys: M('bool', [], { gen: true }), getState: M('i16'), isPressed: M('bool', ['i8']), keyStateChanged: M('bool'), setDebounceTime: M('void', ['u16']), setHoldTime: M('void', ['u16']) },
  },
  SimpleDHT11: { header: 'SimpleDHT.h', ctor: [[], ['i16']], methods: { read: M('i16', ['ptr', 'ptr', 'ptr'], { gen: true }), setPinInputMode: M('i16', ['u8']) } },
  SimpleDHT22: { header: 'SimpleDHT.h', ctor: [[], ['i16']], methods: { read: M('i16', ['ptr', 'ptr', 'ptr'], { gen: true }), setPinInputMode: M('i16', ['u8']) } },
  Stepper: { header: 'Stepper.h', ctor: [['i16', 'i16', 'i16'], ['i16', 'i16', 'i16', 'i16', 'i16']], methods: { setSpeed: M('void', ['i32']), step: M('void', ['i16'], { gen: true }), version: M('i16') } },
  TM1637Display: {
    header: 'TM1637Display.h', ctor: [['u8', 'u8'], ['u8', 'u8', 'u16']],
    methods: {
      setBrightness: M('void', ['u8', 'bool'], { min: 1 }), setSegments: M('void', ['ptr', 'u8', 'u8'], { min: 1, gen: true }), clear: M('void', [], { gen: true }),
      showNumberDec: M('void', ['i16', 'bool', 'u8', 'u8'], { min: 1, gen: true }), showNumberDecEx: M('void', ['i16', 'u8', 'bool', 'u8', 'u8'], { min: 2, gen: true }),
      showNumberHexEx: M('void', ['u16', 'u8', 'bool', 'u8', 'u8'], { min: 1, gen: true }), encodeDigit: M('u8', ['u8']),
    },
  },
};
function lcdMethods(extra) {
  const g = (p = [], more = {}) => M('void', p, { gen: true, ...more });
  return {
    begin: g(['u8', 'u8', 'u8'], { min: 2 }), clear: g(), home: g(), setCursor: g(['u8', 'u8']), noDisplay: g(), display: g(), noCursor: g(), cursor: g(), noBlink: g(), blink: g(),
    scrollDisplayLeft: g(), scrollDisplayRight: g(), leftToRight: g(), rightToLeft: g(), autoscroll: g(), noAutoscroll: g(), createChar: g(['u8', 'ptr']),
    write: M('u16', ['u8'], { gen: true, writeLike: true }), ...extra,
  };
}
const CLASS_NAMES = new Set(Object.keys(CLASSES).filter((c) => CLASSES[c].ctor));
const HEADERS = new Set(['Arduino.h', 'Wire.h', 'Servo.h', 'LiquidCrystal.h', 'LiquidCrystal_I2C.h', 'Keypad.h', 'SimpleDHT.h', 'Stepper.h', 'TM1637Display.h', 'SPI.h', 'math.h', 'stdlib.h', 'string.h', 'avr/pgmspace.h', 'stdint.h']);
HEADERS.suggest = (n) => {
  const s = closest(n, [...HEADERS]);
  return (s ? `Did you mean <${s}>? ` : '') + "The course's interpreter knows the libraries the course uses: " + [...HEADERS].filter((h) => !/[a-z]+\.h$/.test(h) || /^[A-Z]/.test(h)).join(', ') + '.';
};
const STRING_METHODS = {
  length: ['u16', []], charAt: ['i8', ['u16']], indexOf: ['i16', ['any', 'u16'], 1], lastIndexOf: ['i16', ['any'], 1], substring: ['String', ['u16', 'u16'], 1],
  toInt: ['i32', []], toFloat: ['f32', []], equals: ['bool', ['any']], equalsIgnoreCase: ['bool', ['any']], startsWith: ['bool', ['any']], endsWith: ['bool', ['any']],
  c_str: ['ptr', []], compareTo: ['i16', ['any']], concat: ['bool', ['any'], 1, true], trim: ['void', [], 0, true], toUpperCase: ['void', [], 0, true], toLowerCase: ['void', [], 0, true],
  replace: ['void', ['any', 'any'], 2, true], remove: ['void', ['u16', 'u16'], 1, true], setCharAt: ['void', ['u16', 'i8'], 2, true],
};

// ---------- suggestions ----------
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function closest(name, cands) {
  let best = null, bd = 1e9;
  const lo = name.toLowerCase();
  for (const c of cands) {
    if (c === name) continue;
    if (c.toLowerCase() === lo) return c;
    const d = lev(lo, c.toLowerCase());
    if (d < bd) { bd = d; best = c; }
  }
  return best && name.length >= 3 && best.length >= 3 && bd <= Math.max(1, Math.floor(name.length / 3)) ? best : null;
}

// ---------- the compiler ----------
export function compileSketch(source, name = 'sketch') {
  const file = name + '.ino';
  const fmt = (e) => (e.line ? `${file}:${e.line}:${e.col}: error: ${e.msg}` : `${file}: error: ${e.msg}`);
  try {
    const raw = lex(source);
    const { toks, includes } = preprocess(raw, HEADERS);
    const tree = parse(toks, CLASS_NAMES);
    const c = new Compiler(tree, includes, file);
    c.run();
    const errors = c.errors.map((e) => ({ ...e, text: fmt(e) }));
    const warnings = c.warnings.map((w) => ({ ...w, text: `${file}:${w.line}:${w.col}: warning: ${w.msg}` }));
    if (errors.length) return { ok: false, errors, warnings };
    return { ok: true, js: c.js, errors: [], warnings, includes: includes.map((i) => i.name), uses: c.uses };
  } catch (e) {
    if (!(e instanceof CompileError)) {
      console.error(e);
      return { ok: false, errors: [{ line: 0, col: 0, msg: 'the interpreter could not read this sketch (' + e.message + ')', text: `${file}: error: the interpreter could not read this sketch` }], warnings: [] };
    }
    const err = { line: e.line, col: e.col, msg: e.msg ?? e.message, note: e.note };
    // a missing semicolon is reported at the next token, as gcc does; say where it probably belongs
    return { ok: false, errors: [{ ...err, msg: e.message, text: fmt({ ...err, msg: e.message }) }], warnings: [] };
  }
}

class Compiler {
  constructor(tree, includes, file) {
    this.items = tree.items;
    this.includes = new Set(includes.map((i) => i.name));
    if (this.includes.has('LiquidCrystal_I2C.h')) this.includes.add('Wire.h');
    this.file = file;
    this.errors = [];
    this.warnings = [];
    this.out = [];
    this.globals = new Map(); // name -> sym
    this.funcs = new Map();
    this.strs = new Map();
    this.pre = []; // constant pool lines
    this.uid = 0;
    this.scopes = [];
    this.fn = null;
    this.order = 0;
    this.uses = new Set();
    this.acc = 0; // the chip's clock cycles for what has been compiled (a model: see COST)
  }
  measure(f) { const a = this.acc; const r = f(); return [r, Math.max(2, Math.round(this.acc - a))]; }
  error(node, msg, note) {
    if (this.errors.length < 12 && !this.errors.some((e) => e.line === node.line && e.msg === msg)) this.errors.push({ line: node.line, col: node.col, msg, note });
    throw STOP;
  }
  warn(node, msg) { if (!this.warnings.some((w) => w.line === node.line && w.msg === msg)) this.warnings.push({ line: node.line, col: node.col, msg }); }

  // ---- types from the tree ----
  type(spec, ptr = 0, dims = [], node = spec) {
    let t;
    if (spec.cls) {
      const C = CLASSES[spec.cls];
      if (C.header && !this.includes.has(C.header)) this.error(spec, `'${spec.cls}' does not name a type`, `Add #include <${C.header}> at the top of the sketch.`);
      t = { k: 'obj', cls: spec.cls };
    } else {
      const w = spec.words;
      const has = (x) => w.includes(x);
      const longs = w.filter((x) => x === 'long').length;
      const one = w.length === 1 ? w[0] : null;
      if (one === 'void') t = 'void';
      else if (one === 'bool' || one === 'boolean') t = 'bool';
      else if (one === 'byte' || one === 'uint8_t') t = 'u8';
      else if (one === 'int8_t') t = 'i8';
      else if (one === 'word' || one === 'uint16_t' || one === 'size_t') t = 'u16';
      else if (one === 'int16_t') t = 'i16';
      else if (one === 'int32_t') t = 'i32';
      else if (one === 'uint32_t') t = 'u32';
      else if (one === 'String') t = 'String';
      else if (one === 'float' || has('double')) t = 'f32';
      else if (one === 'int64_t' || one === 'uint64_t' || longs > 1) this.error(spec, "64-bit numbers (long long) are not supported by the course's interpreter", 'Use long or unsigned long (32 bits): they go up to about 2 billion and 4 billion.');
      else if (one === 'auto') this.error(spec, "'auto' is not supported by the course's interpreter", 'Write the type out: int, long, float…');
      else if (has('char')) t = has('unsigned') ? 'u8' : 'i8';
      else if (longs) t = has('unsigned') ? 'u32' : 'i32';
      else if (has('int') || has('short') || has('unsigned') || has('signed')) t = has('unsigned') ? 'u16' : 'i16';
      else this.error(spec, `'${w.join(' ')}' does not name a type`);
    }
    for (let i = 0; i < ptr; i++) t = { k: 'ptr', to: t, cst: spec.const && i === 0 };
    if (dims.length) t = { k: 'arr', of: t, dims };
    return t;
  }
  constInt(e, what) {
    const r = this.expr(e);
    if (r.cv === undefined || !isInt(r.t)) this.error(e, `${what} is not an integer constant`, 'An array size must be a number fixed before the sketch runs, like 4, or a const int.');
    return r.cv;
  }

  // ---- scopes ----
  push() { this.scopes.push(new Map()); }
  pop() { this.scopes.pop(); }
  declare(node, sym) {
    const s = this.scopes[this.scopes.length - 1];
    if (s.has(sym.name)) this.error(node, `redeclaration of '${typeName(sym.t)} ${sym.name}'`, `'${sym.name}' was already made on line ${s.get(sym.name).line}. Give one of them another name, or leave out the type to change the one you have.`);
    sym.line = node.line;
    s.set(sym.name, sym);
    return sym;
  }
  lookup(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) { const s = this.scopes[i].get(name); if (s) return s; }
    const g = this.globals.get(name);
    if (g && g.order <= this.order) return g;
    if (this.funcs.has(name)) return this.funcs.get(name);
    if (name === 'Serial') return { kind: 'obj', t: { k: 'obj', cls: 'HardwareSerial' }, js: 'rt.Serial', name };
    if (name === 'Wire' && this.includes.has('Wire.h')) return { kind: 'obj', t: { k: 'obj', cls: 'TwoWire' }, js: 'rt.Wire', name };
    const c = CONSTS[name];
    if (c && (!c[2] || this.includes.has(c[2]))) return { kind: 'const', t: c[0], cv: c[1], name };
    if (/^B[01]{1,8}$/.test(name)) return { kind: 'const', t: 'i16', cv: parseInt(name.slice(1), 2), name };
    if (name === 'NULL' || name === 'nullptr') return { kind: 'null', name };
    if (g) return { late: g };
    return null;
  }
  notDeclared(node, name) {
    const r = this.lookup(name);
    if (r && r.late) this.error(node, `'${name}' was not declared in this scope`, `'${name}' is made on line ${r.late.line}, below this line. Move it above the function that uses it (near the top of the sketch).`);
    if (UNSUPPORTED[name]) this.error(node, `${UNSUPPORTED[name]} not supported by the course's interpreter`, 'The course\'s own sketches, run on the real chip, can still use it.');
    if (name === 'Wire') this.error(node, "'Wire' was not declared in this scope", 'Add #include <Wire.h> at the top of the sketch.');
    if (CONSTS[name]?.[2]) this.error(node, `'${name}' was not declared in this scope`, `Add #include <${CONSTS[name][2]}> at the top of the sketch.`);
    const later = this.declaredAt.get(name);
    if (later && later.fn === null && later.line > node.line) this.error(node, `'${name}' was not declared in this scope`, `'${name}' is made on line ${later.line}, below this line. Move it above the function that uses it (near the top of the sketch).`);
    if (later && later.fn && later.fn !== this.fn?.name) this.error(node, `'${name}' was not declared in this scope`, `'${name}' is made inside ${later.fn}() (line ${later.line}), so it only exists there. To use it in ${this.fn ? this.fn.name + '()' : 'here'} too, make it above setup(), outside every function.`);
    const cands = new Set([...Object.keys(BUILTINS), ...MACROS, ...Object.keys(CONSTS), 'Serial', ...this.funcs.keys()]);
    for (const s of this.scopes) for (const k of s.keys()) cands.add(k);
    for (const [k, g] of this.globals) if (g.order <= this.order) cands.add(k);
    const s = closest(name, [...cands]);
    this.error(node, `'${name}' was not declared in this scope${s ? `; did you mean '${s}'?` : ''}`, s ? null : `Check the spelling (capitals count), and that '${name}' is made (declared) before it is used.`);
  }

  // ---- the whole program ----
  run() {
    const STOPPED = (f) => { try { f(); } catch (e) { if (e !== STOP) throw e; } };
    // where every name is made, for the "was not declared" notes
    this.declaredAt = new Map();
    for (const it of this.items) {
      if (it.k === 'decl') for (const d of it.decls) if (!this.declaredAt.has(d.name)) this.declaredAt.set(d.name, { fn: null, line: d.line });
      if (it.k === 'func') {
        const walk = (n) => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { n.forEach(walk); return; }
          if (n.k === 'decl') for (const d of n.decls) if (!this.declaredAt.has(d.name)) this.declaredAt.set(d.name, { fn: it.name, line: d.line });
          for (const k in n) if (k !== 'type' && typeof n[k] === 'object') walk(n[k]);
        };
        walk(it.body);
        for (const p of it.params) if (p.name && !this.declaredAt.has(p.name)) this.declaredAt.set(p.name, { fn: it.name, line: p.line });
      }
    }
    // pass 1: function signatures (Arduino adds prototypes for every function)
    this.order = 0;
    for (const it of this.items) {
      if (it.k !== 'func' && it.k !== 'proto') continue;
      STOPPED(() => {
        const ret = this.type(it.type, it.ptr);
        if (isArr(ret) || isObj(ret)) this.error(it, 'a function cannot return an array or an object here');
        this.push();
        const params = it.params.map((p) => {
          let t = this.type(p.type, p.ptr);
          if (p.dims.length) t = { k: 'ptr', to: p.dims.length > 1 ? { k: 'arr', of: t, dims: p.dims.slice(1).map((d) => this.constInt(d, 'size')) } : t, cst: p.type.const };
          if (t === 'void') this.error(p, "parameter may not have 'void' type");
          if (isObj(t)) this.error(p, "objects (like a Servo or a screen) cannot be passed to a function in the course's interpreter", 'Use the global object inside the function instead.');
          return { t, name: p.name, def: p.def, line: p.line, col: p.col };
        });
        this.pop();
        const old = this.funcs.get(it.name);
        const sig = { kind: 'fn', name: it.name, ret, params, js: 'f_' + it.name, line: it.line, defined: false };
        if (old) {
          const same = old.params.length === params.length && old.params.every((p, i) => typeName(p.t) === typeName(params[i].t));
          if (!same) this.error(it, `the course's interpreter cannot have two functions called '${it.name}'`, 'Arduino C++ allows it (overloading), but here each function needs its own name.');
          if (typeName(old.ret) !== typeName(ret)) this.error(it, `ambiguating new declaration of '${typeName(ret)} ${it.name}(${params.map((p) => typeName(p.t)).join(', ')})'`);
          if (it.k === 'func' && old.defined) this.error(it, `redefinition of '${typeName(ret)} ${it.name}(${params.map((p) => typeName(p.t)).join(', ')})'`, `${it.name}() is already written on line ${old.line}. A sketch can only have one.`);
          if (it.k === 'func') { old.defined = true; old.line = it.line; old.params = params; }
        } else {
          if (BUILTINS[it.name] || MACROS.has(it.name)) this.error(it, `'${it.name}' is already an Arduino function`, 'Give your function a different name.');
          sig.defined = it.k === 'func';
          this.funcs.set(it.name, sig);
        }
      });
    }
    // pass 2: globals and bodies, in order
    const body = [];
    const init = [];
    this.order = 0;
    for (const it of this.items) {
      this.order++;
      STOPPED(() => {
        if (it.k === 'decl') this.globalDecl(it, init, body);
        else if (it.k === 'enum') this.enumDecl(it);
        else if (it.k === 'typedef') this.error(it, "typedef is not supported by the course's interpreter");
        else if (it.k === 'func') body.push(this.func(it));
      });
    }
    for (const n of ['setup', 'loop']) {
      const f = this.funcs.get(n);
      if (!f || !f.defined) this.errors.push({ line: 0, col: 0, msg: `undefined reference to \`${n}'`, note: `Every sketch needs both void setup() { … } and void loop() { … }, even if one of them is empty.${f ? '' : closest(n, [...this.funcs.keys()]) ? ` Is '${closest(n, [...this.funcs.keys()])}' meant to be ${n}?` : ''}` });
      else if (f.params.length || f.ret !== 'void') this.errors.push({ line: f.line, col: 1, msg: `'${n}' must be written void ${n}()`, note: `The board calls ${n}() with nothing in the brackets and expects nothing back.` });
    }
    for (const f of this.funcs.values()) if (!f.defined && f.called) this.errors.push({ line: f.called.line, col: f.called.col, msg: `undefined reference to \`${f.name}(${f.params.map((p) => typeName(p.t)).join(', ')})'`, note: `${f.name}() is declared but its body { … } is never written.` });
    this.errors.sort((a, b) => (a.line || 1e9) - (b.line || 1e9));
    if (this.errors.length) return;
    this.js = [
      '"use strict";',
      `const {${PURE_NAMES.join(',')}} = rt.pure;`,
      'const T = rt.T, $st = rt.st, $oob = rt.oob, $pr = rt.pr, $pw = rt.pw, $padd = rt.padd, $S = rt.S, $deep = rt.deep;',
      ...this.pre,
      ...this.globalLets,
      ...body,
      'function* $init() {',
      ...init,
      '}',
      'return { init: $init, setup: f_setup, loop: f_loop };',
    ].join('\n');
  }
  get globalLets() { return [...this.globals.values()].map((g) => (g.decl ? g.decl : '')).filter(Boolean); }

  enumDecl(it) {
    let v = 0;
    for (const item of it.items) {
      if (item.val) v = this.constInt(item.val, 'enumerator value');
      const sym = { kind: 'const', name: item.name, t: 'i16', cv: v, order: this.order, line: item.line };
      if (this.globals.has(item.name)) this.error(item, `redeclaration of '${item.name}'`);
      this.globals.set(item.name, sym);
      v++;
    }
  }

  strConst(bytes) {
    const key = bytes.join(',');
    if (!this.strs.has(key)) {
      const id = '$s' + this.strs.size;
      this.strs.set(key, id);
      this.pre.push(`const ${id} = $P(Int8Array.from([${bytes.map((b) => (b << 24) >> 24).join(',')},0]), 0);`);
    }
    return this.strs.get(key);
  }

  // A variable: global (g_) or local (v_). Arrays are typed arrays; scalars whose
  // address is taken (&x) live in a one-place array so a pointer can reach them.
  makeVar(d, spec, global, node) {
    let t = this.type(spec, d.ptr, [], spec);
    if (t === 'void') this.error(d, `variable or field '${d.name}' declared void`);
    let dims = d.dims.map((x) => (x ? this.constInt(x, 'array size') : null));
    const sym = { kind: 'var', name: d.name, t, cst: !!spec.const && !d.ptr, global, line: d.line };
    if (dims.length) {
      if (isObj(t)) this.error(d, "arrays of objects are not supported by the course's interpreter");
      // a missing first size comes from the list
      if (dims[0] === null) {
        if (!d.init) this.error(d, `storage size of '${d.name}' isn't known`, 'Give the array a size, like int pins[4];, or a list of values.');
        dims[0] = d.init.k === 'list' ? d.init.items.length : d.init.k === 'str' ? d.init.v.length + 1 : 1;
      }
      if (dims.some((x) => x === null)) this.error(d, `declaration of '${d.name}' as multidimensional array must have bounds for all dimensions except the first`);
      if (dims.some((x) => x <= 0)) this.error(d, `size of array '${d.name}' is not positive`);
      const total = dims.reduce((a, b) => a * b, 1);
      if (total * sizeOf(t) > 1500) this.error(d, `size of array '${d.name}' is too large`, `It needs ${total * sizeOf(t)} bytes; the Uno has 2048 bytes of memory for everything.`);
      sym.t = { k: 'arr', of: t, dims };
    }
    sym.js = (global ? 'g_' : `v${++this.uid}_`) + d.name;
    sym.boxed = !dims.length && !isObj(t) && this.addrTaken.has(d.name);
    return sym;
  }
  initValue(sym, d) {
    const t = sym.t;
    if (isArr(t)) {
      const total = t.dims.reduce((a, b) => a * b, 1);
      const ctorName = TA[t.of] || 'Array';
      const vals = [];
      if (d.init) {
        if (d.init.k === 'str') {
          if (t.of !== 'i8' && t.of !== 'u8') this.error(d.init, `invalid conversion from 'const char*' to '${typeName(t.of)}'`);
          if (d.init.v.length + 1 > total) this.error(d.init, `initializer-string for array of chars is too long [-fpermissive]`);
          d.init.v.forEach((b) => vals.push(lit(t.of === 'i8' ? (b << 24) >> 24 : b)));
        } else if (d.init.k === 'list') {
          const flat = [];
          const walk = (list, depth) => {
            const per = t.dims.slice(depth + 1).reduce((a, b) => a * b, 1);
            if (list.items.length > t.dims[depth]) this.error(list, `too many initializers for '${typeName({ k: 'arr', of: t.of, dims: t.dims.slice(depth) })}'`);
            list.items.forEach((x, i) => {
              if (x.k === 'list') { if (depth + 1 >= t.dims.length) this.error(x, 'braces around scalar initializer'); const base = flat.length; walk(x, depth + 1); while (flat.length < base + per) flat.push(null); }
              else if (depth + 1 < t.dims.length && x.k === 'str') { const base = flat.length; x.v.forEach((b) => flat.push({ cv: t.of === 'i8' ? (b << 24) >> 24 : b })); while (flat.length < base + per) flat.push(null); }
              else flat.push(x);
            });
          };
          if (t.dims.length > 1 && d.init.items.every((x) => x.k !== 'list')) {
            d.init.items.forEach((x) => flat.push(x));
            if (flat.length > total) this.error(d.init, `too many initializers for '${typeName(t)}'`);
          } else walk(d.init, 0);
          for (const x of flat) {
            if (x === null) { vals.push(TA[t.of] ? '0' : t.of === 'String' ? '""' : 'null'); continue; }
            if (x.cv !== undefined && !x.k) { vals.push(lit(x.cv)); continue; }
            vals.push(this.conv(this.expr(x), t.of, x, 'initialization'));
          }
        } else this.error(d.init, `array must be initialized with a brace-enclosed initializer`);
      }
      if (!TA[t.of]) return `$arrA(${total}, [${vals.join(',')}], ${t.of === 'String' ? '""' : 'null'})`;
      return vals.length ? `$arr(${ctorName}, ${total}, [${vals.join(',')}])` : `new ${ctorName}(${total})`;
    }
    if (isObj(t)) {
      const C = CLASSES[t.cls];
      let args = d.ctor;
      if (d.init) {
        if (d.init.k === 'call' && d.init.f.k === 'id' && d.init.f.name === t.cls) args = d.init.args;
        else this.error(d.init, `conversion from '${typeName(this.expr(d.init).t)}' to non-scalar type '${t.cls}' requested`);
      }
      args = args || [];
      const sig = C.ctor.find((s) => s.length === args.length);
      if (!sig) this.error(d, `no matching function for call to '${t.cls}::${t.cls}(${args.map((a) => typeName(this.expr(a).t)).join(', ')})'`, `A ${t.cls} is made with ${C.ctor.map((s) => s.length).join(' or ')} values in its brackets.`);
      const cargs = args.map((a, i) => this.conv(this.expr(a), sig[i], a, 'argument'));
      this.uses.add(t.cls);
      return { obj: `new rt.C.${t.cls}(rt)`, ctor: cargs };
    }
    if (d.ctor) {
      if (d.ctor.length !== 1) this.error(d, `expression list treated as compound expression in initializer [-fpermissive]`);
      return this.conv(this.expr(d.ctor[0]), t, d.ctor[0], 'initialization');
    }
    if (d.init) {
      if (d.init.k === 'list') {
        if (d.init.items.length > 1) this.error(d.init, `scalar object '${sym.name}' requires one element in initializer`);
        if (!d.init.items.length) return this.zero(t);
        return this.conv(this.expr(d.init.items[0]), t, d.init.items[0], 'initialization');
      }
      const e = this.expr(d.init);
      return this.conv(e, t, d.init, 'initialization');
    }
    return this.zero(t);
  }
  zero(t) { return t === 'String' ? '""' : isPtr(t) ? 'null' : '0'; }

  globalDecl(it, init, body) {
    this.addrTaken = this.addrOfGlobals ??= this.scanAddr(this.items);
    for (const d of it.decls) {
      const sym = this.makeVar(d, it.type, true, it);
      if (this.globals.has(d.name)) this.error(d, `redefinition of '${typeName(sym.t)} ${d.name}'`, `'${d.name}' was already made on line ${this.globals.get(d.name).line}.`);
      if (this.funcs.has(d.name)) this.error(d, `'${typeName(sym.t)} ${d.name}' redeclared as different kind of symbol`);
      if (sym.cst && !d.init && !d.ctor && !isArr(sym.t)) this.error(d, `uninitialized const '${d.name}' [-fpermissive]`, 'A const needs its value where it is made: const int ledPin = 13;');
      sym.order = this.order;
      const v = this.initValue(sym, d);
      // a const with a fixed value can be used where C++ needs a constant (array sizes, case labels)
      if (sym.cst && typeof v === 'string' && isArith(sym.t)) { const cv = foldCode(v); if (typeof cv === 'number') sym.cv = cv; }
      this.globals.set(d.name, sym);
      if (isObj(sym.t)) {
        sym.decl = `let ${sym.js};`;
        init.push(`${sym.js} = ${v.obj}; yield* ${sym.js}.ctor(${v.ctor.join(', ')});`);
      } else if (sym.boxed) {
        sym.decl = `const ${sym.js} = new ${TA[sym.t] || 'Array'}(1);`;
        init.push(`${sym.js}[0] = ${v};`);
      } else if (typeof v === 'string' && foldCode(v) !== undefined && !/\$s\d/.test(v)) {
        sym.decl = `let ${sym.js} = ${v};`;
      } else {
        sym.decl = `let ${sym.js} = ${this.zero(isArr(sym.t) ? 'x' : sym.t)};`;
        init.push(`${sym.js} = ${v};`);
      }
    }
  }
  scanAddr(nodes) {
    const set = new Set();
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.k === 'un' && n.op === '&' && n.a.k === 'id') set.add(n.a.name);
      for (const k in n) if (k !== 'type' && typeof n[k] === 'object') walk(n[k]);
    };
    walk(nodes);
    return set;
  }

  // ---- functions ----
  func(it) {
    const sig = this.funcs.get(it.name);
    this.fn = { sig, temps: 0, loops: 0, switches: 0, statics: [], name: it.name };
    this.addrTaken = new Set([...this.scanAddr(it.body), ...(this.addrOfGlobals ?? new Set())]);
    this.push();
    const params = [];
    const pre = [];
    for (const p of sig.params) {
      if (!p.name) { params.push(`$u${++this.uid}`); continue; }
      const sym = { kind: 'var', name: p.name, t: p.t, js: `v${++this.uid}_${p.name}`, line: p.line };
      if (this.addrTaken.has(p.name) && !isPtr(p.t)) {
        sym.boxed = true;
        params.push(sym.js + '$');
        pre.push(`const ${sym.js} = new ${TA[p.t] || 'Array'}(1); ${sym.js}[0] = ${sym.js}$;`);
      } else params.push(sym.js);
      this.declare(p, sym);
    }
    const lines = [];
    let ok = true;
    try { this.block(it.body.body, lines); } catch (e) { if (e !== STOP) throw e; ok = false; }
    this.pop();
    const temps = this.fn.temps ? `let ${Array.from({ length: this.fn.temps }, (_, i) => '$t' + (i + 1)).join(',')};` : '';
    const ret = sig.ret === 'void' ? '' : `return ${this.zero(sig.ret)};`;
    if (sig.ret !== 'void' && !this.endsWithReturn(it.body.body)) this.warn({ line: it.body.end, col: 1 }, `no return statement in function returning non-void [-Wreturn-type]`);
    const statics = this.fn.statics.join('\n');
    this.fn = null;
    if (!ok) return '';
    return `${statics}\nfunction* ${sig.js}(${params.join(', ')}) {\nif (++T.d > 180) $deep(${it.line});\ntry {\n${temps}${pre.join('\n')}\n${lines.join('\n')}\n${ret}\n} finally { T.d--; }\n}`;
  }
  endsWithReturn(body) {
    const last = body[body.length - 1];
    if (!last) return false;
    if (last.k === 'return') return true;
    if (last.k === 'while' && last.c.k === 'id' && last.c.name === 'true') return true;
    if (last.k === 'for' && !last.c) return true;
    if (last.k === 'if' && last.b) return this.endsWithReturn([last.a]) && this.endsWithReturn([last.b]);
    if (last.k === 'block') return this.endsWithReturn(last.body);
    return false;
  }
  temp() { return '$t' + ++this.fn.temps; }

  block(stmts, out) {
    for (const s of stmts) {
      try { this.stmt(s, out); } catch (e) { if (e !== STOP) throw e; }
    }
    if (this.errors.length) throw STOP;
  }
  charge(n) { return `T.c += ${n};`; }
  cost(e) {
    // a rough count of the chip's work for an expression (clock cycles)
    let n = 0;
    const walk = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(walk); return; } if (x.k === 'bin' || x.k === 'asg' || x.k === 'un' || x.k === 'pre' || x.k === 'post' || x.k === 'idx' || x.k === 'cond') n += 3; if (x.k === 'call') n += 8; for (const k in x) if (typeof x[k] === 'object' && k !== 'type') walk(x[k]); };
    walk(e);
    return 2 + n;
  }
  stmt(s, out) {
    switch (s.k) {
      case 'empty': return;
      case 'block': {
        this.push();
        out.push('{');
        try { this.block(s.body, out); } finally { this.pop(); }
        out.push('}');
        return;
      }
      case 'expr': {
        const [e, k] = this.measure(() => this.expr(s.e, { discard: true }));
        out.push(`${this.charge(k + 2)} ${e.c};`);
        return;
      }
      case 'decl': {
        for (const d of s.decls) {
          const sym = this.makeVar(d, s.type, false, s);
          if (s.type.static) {
            // a static local lives for the whole run; its first value is set once
            const g = `s${++this.uid}_${d.name}`;
            sym.js = g;
            this.declare(d, sym);
            const v = this.initValue(sym, d);
            if (isObj(sym.t)) this.error(d, "static objects are not supported by the course's interpreter");
            if (sym.boxed) this.fn.statics.push(`const ${g} = new ${TA[sym.t] || 'Array'}(1); ${g}[0] = ${v};`);
            else this.fn.statics.push(`let ${g} = ${v};`);
            continue;
          }
          const [v, k] = this.measure(() => this.initValue(sym, d));
          if (sym.cst && typeof v === 'string' && isArith(sym.t)) { const cv = foldCode(v); if (typeof cv === 'number') sym.cv = cv; }
          if (sym.cst && !d.init && !d.ctor && !isArr(sym.t)) this.error(d, `uninitialized const '${d.name}' [-fpermissive]`);
          this.declare(d, sym);
          if (isObj(sym.t)) out.push(`const ${sym.js} = ${v.obj}; yield* ${sym.js}.ctor(${v.ctor.join(', ')});`);
          else if (sym.boxed) out.push(`${this.charge(4)} const ${sym.js} = new ${TA[sym.t] || 'Array'}(1); ${sym.js}[0] = ${v};`);
          else out.push(`${this.charge(k + 2)} let ${sym.js} = ${v};`);
        }
        return;
      }
      case 'if': {
        const [c, k] = this.measure(() => this.cond(s.c));
        out.push(`${this.charge(k + 3)} if (${c}) {`);
        this.sub(s.a, out);
        if (s.b) { out.push('} else {'); this.sub(s.b, out); }
        out.push('}');
        return;
      }
      case 'while': {
        const [c, k] = this.measure(() => this.cond(s.c));
        out.push(`while (true) { if ((T.c += ${k + 4}) >= T.lim) yield ${s.line}; if (!(${c})) break;`);
        this.loop(s.body, out);
        out.push('}');
        return;
      }
      case 'do': {
        out.push(`do { if ((T.c += 3) >= T.lim) yield ${s.line};`);
        this.loop(s.body, out);
        const [c, k] = this.measure(() => this.cond(s.c));
        out.push(`} while ((T.c += ${k + 2}, ${c}));`);
        return;
      }
      case 'for': {
        this.push();
        try {
          let init = '';
          if (s.init) {
            if (s.init.k === 'decl') {
              const parts = [];
              for (const d of s.init.decls) {
                const sym = this.makeVar(d, s.init.type, false, s.init);
                if (isArr(sym.t) || isObj(sym.t) || sym.boxed) this.error(d, "only plain variables can be made inside for ( )");
                const v = this.initValue(sym, d);
                this.declare(d, sym);
                parts.push(`${sym.js} = ${v}`);
              }
              init = 'let ' + parts.join(', ');
            } else init = this.expr(s.init.e, { discard: true }).c;
          }
          const [c, k1] = this.measure(() => (s.c ? this.cond(s.c) : 'true'));
          const [u, k2] = this.measure(() => (s.u ? this.expr(s.u, { discard: true }).c : ''));
          out.push(`for (${init}; ${c}; ${u}) { if ((T.c += ${k1 + k2 + 4}) >= T.lim) yield ${s.line};`);
          this.loop(s.body, out);
          out.push('}');
        } finally { this.pop(); }
        return;
      }
      case 'switch': {
        const [e, k] = this.measure(() => this.expr(s.e));
        if (!isInt(e.t)) this.error(s.e, `switch quantity not an integer`);
        if (s.body.k !== 'block') this.error(s.body, "a switch needs its cases inside { }");
        this.fn.switches++;
        this.fn.cases = this.fn.cases || [];
        this.fn.cases.push(new Set());
        out.push(`${this.charge(k + 6)} switch (${this.conv(e, promote(e.t), s.e)}) {`);
        this.push();
        try { this.block(s.body.body, out); } finally { this.pop(); this.fn.switches--; this.fn.cases.pop(); }
        out.push('}');
        return;
      }
      case 'case': {
        if (!this.fn.switches) this.error(s, `case label '${this.exprText(s.v)}' not within a switch statement`);
        const v = this.expr(s.v);
        if (v.cv === undefined || !isInt(v.t)) this.error(s.v, `'${this.exprText(s.v)}' is not a constant expression`, 'A case needs a fixed value, like case 1: or a const int.');
        const set = this.fn.cases[this.fn.cases.length - 1];
        if (set.has(v.cv)) this.error(s, `duplicate case value`);
        set.add(v.cv);
        out.push(`case ${lit(v.cv)}:`);
        return;
      }
      case 'default':
        if (!this.fn.switches) this.error(s, "'default' label not within a switch statement");
        out.push('default:');
        return;
      case 'break':
        if (!this.fn.loops && !this.fn.switches) this.error(s, 'break statement not within loop or switch');
        out.push('break;');
        return;
      case 'continue':
        if (!this.fn.loops) this.error(s, 'continue statement not within a loop');
        out.push('continue;');
        return;
      case 'return': {
        const r = this.fn.sig.ret;
        if (!s.e) {
          if (r !== 'void') this.error(s, `return-statement with no value, in function returning '${typeName(r)}' [-fpermissive]`);
          out.push('return;');
          return;
        }
        const [e, k] = this.measure(() => this.expr(s.e));
        if (r === 'void') {
          if (e.t !== 'void') this.error(s, "return-statement with a value, in function returning 'void' [-fpermissive]", `${this.fn.name}() is void: it gives nothing back. Write return; on its own, or change void to the type it returns.`);
          out.push(`${e.c}; return;`);
          return;
        }
        out.push(`${this.charge(k + 8)} return ${this.conv(e, r, s.e, 'return')};`);
        return;
      }
    }
    this.error(s, 'this kind of statement is not supported by the course\'s interpreter');
  }
  sub(s, out) {
    this.push();
    try { if (s.k === 'block') this.block(s.body, out); else this.block([s], out); } finally { this.pop(); }
  }
  loop(s, out) {
    this.fn.loops++;
    const sw = this.fn.switches;
    this.fn.switches = 0; // a break inside the loop body belongs to the loop
    try { this.sub(s, out); } finally { this.fn.loops--; this.fn.switches = sw; }
  }
  cond(e) {
    if (e.k === 'asg' && e.op === '=' && !e.paren) this.warn(e, 'suggest parentheses around assignment used as truth value [-Wparentheses]  (did you mean == ?)');
    const r = this.expr(e);
    return this.truth(r, e);
  }
  truth(r, node) {
    if (isArith(r.t)) return r.c;
    if (isPtr(r.t) || r.isNull) return `(${r.c} !== null)`;
    if (r.t === 'String') return `(${r.c} !== null)`;
    if (isObj(r.t) && r.t.cls === 'HardwareSerial') return '1';
    if (isArr(r.t)) return '1';
    if (r.t && r.t.k === 'fn') return '1';
    this.error(node, `could not convert '${this.exprText(node)}' from '${typeName(r.t)}' to 'bool'`);
  }
  exprText(e) {
    switch (e.k) {
      case 'id': return e.name;
      case 'num': return e.text;
      case 'chr': return `'${String.fromCharCode(e.v & 255)}'`;
      case 'str': return '"' + new TextDecoder().decode(Uint8Array.from(e.v)) + '"';
      case 'bin': return `(${this.exprText(e.a)} ${e.op} ${this.exprText(e.b)})`;
      case 'call': return `${this.exprText(e.f)}(${e.args.map((a) => this.exprText(a)).join(', ')})`;
      case 'mem': return `${this.exprText(e.a)}.${e.name}`;
      case 'idx': return `${this.exprText(e.a)}[${this.exprText(e.i)}]`;
      case 'un': return e.op + this.exprText(e.a);
      default: return '…';
    }
  }

  // ---- conversions ----
  conv(e, to, node, ctx = 'conversion') {
    const from = e.t;
    if (from === 'void') this.error(node, 'void value not ignored as it ought to be', 'This function gives nothing back (it is void), so its result cannot be used.');
    if (to === 'any') return e.c;
    if (to === 'ptr') { // a library pointer argument: an array, a pointer, &x or NULL
      if (isArr(from)) return `$P(${e.c}, 0)`;
      if (isPtr(from) || e.isNull) return e.c;
      if (e.cv === 0) return 'null';
      this.error(node, `invalid conversion from '${typeName(from)}' to a pointer [-fpermissive]`, 'This needs the name of an array, or &variable.');
    }
    if (isArith(to)) {
      if (isArith(from)) {
        if (from === to) return e.c;
        if (e.cv !== undefined) {
          let v = e.cv;
          if (to === 'f32') v = Math.fround(v);
          else if (to === 'bool') v = v ? 1 : 0;
          else {
            if (from === 'f32') v = PURE.$ftoi(v);
            const r = RANGE[to];
            const w = foldCode(WRAP[to](lit(v)));
            if ((v < r[0] || v > r[1]) && from !== 'f32' && ctx !== 'cast' && isInt(from) && !(e.lit && to[0] === 'u')) this.warn(node, `overflow in conversion from '${typeName(from)}' to '${typeName(to)}' changes value from '${v}' to '${w}' [-Woverflow]`);
            v = w;
          }
          return lit(v);
        }
        if (to === 'f32') { this.acc += 70; return `F(${e.c})`; }
        if (to === 'bool') return `((${e.c})?1:0)`;
        if (from === 'f32') { this.acc += 90; return WRAP[to](`$ftoi(${e.c})`); }
        const a = RANGE[from], b = RANGE[to];
        if (a[0] >= b[0] && a[1] <= b[1]) return e.c;
        return WRAP[to](e.c);
      }
      if (to === 'bool' && (isPtr(from) || isArr(from) || e.isNull)) return `((${e.c})!==null?1:0)`;
      if (e.isNull) return '0';
      if (isPtr(from) || isArr(from)) this.error(node, `invalid conversion from '${typeName(isArr(from) ? { k: 'ptr', to: from.of } : from)}' to '${typeName(to)}' [-fpermissive]`, isPtr(from) && from.to === 'i8' && from.cst ? 'Text in "double quotes" is a string, not a number. A single letter in \'single quotes\' is a char.' : undefined);
      if (from === 'String') this.error(node, `cannot convert 'String' to '${typeName(to)}' in ${ctx}`, 'Use .toInt() or .toFloat() to turn the text into a number.');
      if (isObj(from)) this.error(node, `cannot convert '${from.cls}' to '${typeName(to)}' in ${ctx}`);
      if (from && from.k === 'fn') this.error(node, `invalid conversion from '${typeName(from)}' to '${typeName(to)}'`, 'A function name needs ( ) after it to call it.');
      this.error(node, `cannot convert '${typeName(from)}' to '${typeName(to)}'`);
    }
    if (to === 'String') {
      if (from === 'String') return e.c;
      if (isPtr(from) && (from.to === 'i8' || from.to === 'u8')) return `$S.cstr(${e.c})`;
      if (isArr(from) && (from.of === 'i8' || from.of === 'u8')) return `$S.cstr($P(${e.c},0))`;
      if (isArith(from)) return `$S.num(${e.c}, ${this.kind(from)})`;
      this.error(node, `conversion from '${typeName(from)}' to non-scalar type 'String' requested`);
    }
    if (isPtr(to)) {
      if (e.isNull || e.cv === 0) return 'null';
      if (isArr(from)) {
        if (sizeOf(from.of) !== sizeOf(isArr(to.to) ? to.to.of : to.to) && !isArr(to.to)) this.error(node, `cannot convert '${typeName(from)}' to '${typeName(to)}' in ${ctx}`);
        return `$P(${e.c}, 0)`;
      }
      if (isPtr(from)) {
        if (from.cst && !to.cst && from.to === 'i8' && ctx !== 'cast') this.warn(node, `ISO C++ forbids converting a string constant to '${typeName(to)}' [-Wwrite-strings]`);
        if (sizeOf(from.to) !== sizeOf(to.to) && ctx !== 'cast') this.error(node, `cannot convert '${typeName(from)}' to '${typeName(to)}' in ${ctx}`);
        return e.c;
      }
      if (from === 'String') this.error(node, `cannot convert 'String' to '${typeName(to)}' in ${ctx}`, 'Use .c_str() to get the text of a String as a char*.');
      this.error(node, `invalid conversion from '${typeName(from)}' to '${typeName(to)}' [-fpermissive]`);
    }
    if (isObj(to)) this.error(node, `cannot convert '${typeName(from)}' to '${to.cls}'`);
    this.error(node, `cannot convert '${typeName(from)}' to '${typeName(to)}'`);
  }
  kind(t) { return t === 'f32' ? "'f'" : t === 'i8' ? "'c'" : t === 'u16' || t === 'u32' || t === 'u8' || t === 'bool' ? "'u'" : "'i'"; }
  // what print() does with a value: c char, s text, S String, i/u number, f float
  printKind(t, node) {
    if (t === 'i8') return 'c';
    if (t === 'f32') return 'f';
    if (t === 'String') return 'S';
    if (isPtr(t) && (t.to === 'i8' || t.to === 'u8')) return 's';
    if (isArr(t) && (t.of === 'i8' || t.of === 'u8')) return 'a';
    if (t === 'u16' || t === 'u32' || t === 'u8' || t === 'bool') return 'u';
    if (isInt(t)) return 'i';
    if (t === 'void') this.error(node, 'invalid use of void expression', 'This function gives nothing back, so there is nothing to print.');
    this.error(node, `no matching function for call to 'print(${typeName(t)})'`);
  }

  // ---- expressions ----
  // returns { c: JS code, t: type, lv?: lvalue, cv?: constant value }
  expr(e, opt = {}) {
    switch (e.k) {
      case 'num': return this.number(e);
      case 'chr': return { c: lit(e.v), t: e.multi ? 'i16' : 'i8', cv: e.v };
      case 'str': return { c: this.strConst(e.v), t: { k: 'ptr', to: 'i8', cst: true }, str: e.v };
      case 'id': return this.ident(e);
      case 'comma': { const a = this.expr(e.a, { discard: true }); const b = this.expr(e.b); return { c: `(${a.c}, ${b.c})`, t: b.t }; }
      case 'cond': {
        const c = this.truth(this.expr(e.c), e.c);
        const a = this.expr(e.a), b = this.expr(e.b);
        if (isArith(a.t) && isArith(b.t)) {
          const t = a.t === b.t ? a.t : common(a.t, b.t);
          return { c: `((${c}) ? ${this.conv(a, t, e.a)} : ${this.conv(b, t, e.b)})`, t };
        }
        if (a.t === 'String' || b.t === 'String') return { c: `((${c}) ? ${this.conv(a, 'String', e.a)} : ${this.conv(b, 'String', e.b)})`, t: 'String' };
        if ((isPtr(a.t) || a.isNull) && (isPtr(b.t) || b.isNull)) return { c: `((${c}) ? ${a.c} : ${b.c})`, t: isPtr(a.t) ? a.t : b.t };
        if (a.t === 'void' && b.t === 'void') return { c: `((${c}) ? ${a.c} : ${b.c})`, t: 'void' };
        this.error(e, `operands to ?: have different types '${typeName(a.t)}' and '${typeName(b.t)}'`);
      }
      // falls through (error throws)
      case 'bin': return this.binary(e);
      case 'asg': return this.assign(e);
      case 'un': return this.unary(e);
      case 'pre': case 'post': return this.incdec(e);
      case 'cast': return this.cast(this.type(e.type, e.ptr), this.expr(e.a), e);
      case 'fcast': {
        const t = this.type(e.type);
        if (t === 'String') return this.stringCtor(e);
        if (e.args.length !== 1) this.error(e, `functional cast to '${typeName(t)}' needs one value`);
        return this.cast(t, this.expr(e.args[0]), e);
      }
      case 'sizeof': {
        const t = e.type ? this.type(e.type, e.ptr) : this.expr(e.a).t;
        if (t && t.k === 'fn') this.error(e, 'invalid application of sizeof to a function type');
        const v = sizeOf(t);
        return { c: String(v), t: 'u16', cv: v };
      }
      case 'call': return this.call(e, opt);
      case 'idx': return this.index(e);
      case 'mem': this.error(e, `invalid use of member '${e.name}'`, `A member function needs ( ) after it: ${this.exprText(e.a)}.${e.name}(…)`);
      // falls through
      case 'list': this.error(e, 'expected primary-expression before \'{\' token');
    }
    this.error(e, 'this expression is not supported by the course\'s interpreter');
  }
  number(e) {
    const text = e.text;
    const m = /^(.*?)([uUlLfF]*)$/.exec(text);
    const body = m[1], suf = m[2].toLowerCase();
    const isHex = /^0[xX]/.test(body), isBin = /^0[bB]/.test(body);
    if (!isHex && (/[.eE]/.test(body) || suf.includes('f'))) {
      if (suf.includes('f') && !/[.eE]/.test(body)) this.error(e, `invalid suffix "${m[2]}" on integer constant`);
      const v = Math.fround(parseFloat(body));
      return { c: lit(v), t: 'f32', cv: v, lit: true };
    }
    let v;
    if (isHex) v = parseInt(body.slice(2), 16);
    else if (isBin) v = parseInt(body.slice(2), 2);
    else if (body.length > 1 && body[0] === '0') { if (/[89]/.test(body)) this.error(e, `invalid digit "${/[89]/.exec(body)[0]}" in octal constant`); v = parseInt(body, 8); }
    else v = parseInt(body, 10);
    if (v > 4294967295) this.error(e, `integer constant is too large for its type`);
    const u = suf.includes('u'), l = suf.includes('l');
    const dec = !isHex && !isBin && !(body.length > 1 && body[0] === '0');
    let t;
    if (u && l) t = 'u32';
    else if (u) t = v <= 65535 ? 'u16' : 'u32';
    else if (l) t = v <= 2147483647 ? 'i32' : 'u32';
    else if (v <= 32767) t = 'i16';
    else if (!dec && v <= 65535) t = 'u16';
    else if (v <= 2147483647) t = 'i32';
    else t = 'u32';
    return { c: lit(v), t, cv: v, lit: true };
  }
  ident(e) {
    const s = this.lookup(e.name);
    this.acc += 2;
    if (!s || s.late) this.notDeclared(e, e.name);
    if (s.kind === 'const') return { c: lit(s.cv), t: s.t, cv: s.cv };
    if (s.kind === 'null') return { c: 'null', t: 'i16', isNull: true, cv: 0 };
    if (s.kind === 'fn') return { c: s.js, t: { k: 'fn', ret: s.ret, params: s.params }, fn: s };
    if (s.kind === 'obj') return { c: s.js, t: s.t };
    if (s.kind === 'var') {
      if (s.cv !== undefined) return { c: lit(s.cv), t: s.t, cv: s.cv, lv: { kind: 'var', js: s.js, t: s.t, sym: s } };
      if (s.boxed) return { c: `${s.js}[0]`, t: s.t, lv: { kind: 'box', js: s.js, t: s.t, sym: s } };
      return { c: s.js, t: s.t, lv: isObj(s.t) ? null : { kind: 'var', js: s.js, t: s.t, sym: s } };
    }
    this.notDeclared(e, e.name);
  }
  // a[i][j]...: reaches through arrays (flattened) and pointers
  index(e) {
    const chain = [];
    let base = e;
    while (base.k === 'idx') { chain.unshift(base.i); base = base.a; }
    const b = this.expr(base);
    if (b.t === 'String') {
      if (chain.length !== 1) this.error(e, 'invalid types for array subscript');
      const i = this.conv(this.expr(chain[0]), 'i32', chain[0]);
      return { c: `$S.at(${b.c}, ${i})`, t: 'i8' };
    }
    if (isArr(b.t)) {
      const dims = b.t.dims;
      if (chain.length > dims.length) this.error(e, `invalid types '${typeName(b.t.of)}[int]' for array subscript`, 'This has more [ ] than the array has.');
      let off = '';
      let cvOff = 0;
      let allConst = true;
      chain.forEach((ix, k) => {
        const r = this.expr(ix);
        if (!isInt(r.t)) this.error(ix, `invalid types '${typeName(b.t)}[${typeName(r.t)}]' for array subscript`, 'The number in [ ] must be a whole number (an int), not a float or text.');
        const per = dims.slice(k + 1).reduce((x, y) => x * y, 1);
        const c = this.conv(r, 'i32', ix);
        if (r.cv !== undefined) cvOff += r.cv * per; else allConst = false;
        off += (off ? ' + ' : '') + (per === 1 ? `(${c})` : `(${c})*${per}`);
      });
      if (allConst && chain.length === dims.length) {
        const total = dims.reduce((x, y) => x * y, 1);
        if (cvOff < 0 || cvOff >= total) this.warn(e, `array subscript ${cvOff} is outside array bounds of '${typeName(b.t)}' [-Warray-bounds]`);
      }
      if (chain.length < dims.length) {
        // a row of a 2D array: a pointer to its first element
        const rest = dims.slice(chain.length);
        return { c: `$P(${b.c}, ${off})`, t: { k: 'ptr', to: rest.length > 1 ? { k: 'arr', of: b.t.of, dims: rest.slice(1) } : b.t.of } };
      }
      const name = base.k === 'id' ? base.name : 'array';
      this.acc += 6 + (sizeOf(b.t.of) > 1 ? 2 : 0);
      const L = e.line;
      return { c: `(${b.c}[${off}] ?? $oob(${L}, ${JSON.stringify(name)}, ${off}, ${b.c}.length))`, t: b.t.of, lv: { kind: 'elem', arr: b.c, idx: off, t: b.t.of, line: L, name } };
    }
    if (isPtr(b.t)) {
      if (chain.length !== 1) {
        if (isArr(b.t.to) && chain.length === 2) {
          const per = b.t.to.dims.reduce((x, y) => x * y, 1);
          const i0 = this.conv(this.expr(chain[0]), 'i32', chain[0]);
          const i1 = this.conv(this.expr(chain[1]), 'i32', chain[1]);
          const tmp = this.temp();
          return { c: `$pr(${tmp} = ${b.c}, (${i0})*${per} + (${i1}), ${e.line})`, t: b.t.to.of, lv: { kind: 'ptr', p: b.c, idx: `(${i0})*${per} + (${i1})`, t: b.t.to.of, line: e.line } };
        }
        this.error(e, 'invalid types for array subscript');
      }
      const r = this.expr(chain[0]);
      if (!isInt(r.t)) this.error(chain[0], `invalid types '${typeName(b.t)}[${typeName(r.t)}]' for array subscript`);
      const i = this.conv(r, 'i32', chain[0]);
      const et = b.t.to;
      if (isArr(et)) return { c: `$padd(${b.c}, (${i})*${et.dims.reduce((x, y) => x * y, 1)})`, t: { k: 'ptr', to: et.dims.length > 1 ? { k: 'arr', of: et.of, dims: et.dims.slice(1) } : et.of } };
      return { c: this.ptrRead(b.c, i, et, e.line), t: et, lv: { kind: 'ptr', p: b.c, idx: i, t: et, line: e.line, cst: b.t.cst } };
    }
    if (b.t && b.t.k === 'fn') this.error(e, 'pointer to a function used in arithmetic');
    this.error(e, `invalid types '${typeName(b.t)}[int]' for array subscript`, `'${this.exprText(base)}' is not an array.`);
  }
  ptrRead(p, i, et, L) {
    const raw = `$pr(${p}, ${i}, ${L})`;
    return isInt(et) && et !== 'bool' ? WRAP[et](raw) : et === 'f32' ? `F(${raw})` : raw;
  }

  cast(t, a, node) {
    if (t === 'void') return { c: a.c, t: 'void' };
    if (isArith(t)) {
      if (isPtr(a.t) || isArr(a.t)) this.error(node, `cast from '${typeName(a.t)}' to '${typeName(t)}' loses precision [-fpermissive]`);
      const c = this.conv(a, t, node, 'cast');
      const cv = a.cv !== undefined ? foldCode(c) : undefined;
      return { c, t, cv: typeof cv === 'number' ? cv : undefined };
    }
    if (isPtr(t)) {
      if (isArr(a.t)) return { c: `$P(${a.c}, 0)`, t };
      if (isPtr(a.t) || a.isNull) return { c: a.c, t };
      this.error(node, `invalid cast from type '${typeName(a.t)}' to type '${typeName(t)}'`);
    }
    if (t === 'String') return { c: this.conv(a, 'String', node), t: 'String' };
    this.error(node, `invalid cast from type '${typeName(a.t)}' to type '${typeName(t)}'`);
  }

  binary(e) {
    const op = e.op;
    const A = this.expr(e.a), B = this.expr(e.b);
    if (op === '&&' || op === '||') {
      const a = this.truth(A, e.a), b = this.truth(B, e.b);
      this.acc += 3;
      const c = `((${a}) ${op} (${b}) ? 1 : 0)`;
      const cv = A.cv !== undefined && B.cv !== undefined ? foldCode(c) : undefined;
      return { c, t: 'bool', cv };
    }
    for (const [X, n] of [[A, e.a], [B, e.b]]) {
      if (X.t === 'void') this.error(n, 'void value not ignored as it ought to be');
      if (X.t && X.t.k === 'fn') this.warn(n, `the address of '${X.fn.name}' will always evaluate as 'true' [-Waddress] (did you forget the ( ) to call it?)`);
    }
    // String joins and compares
    if (A.t === 'String' || B.t === 'String') {
      if (op === '+') return { c: `(${this.conv(A, 'String', e.a)} + ${this.conv(B, 'String', e.b)})`, t: 'String' };
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) return { c: `((${this.conv(A, 'String', e.a)} ${op === '==' ? '===' : op === '!=' ? '!==' : op} ${this.conv(B, 'String', e.b)}) ? 1 : 0)`, t: 'bool' };
      this.error(e, `no match for 'operator${op}' (operand types are '${typeName(A.t)}' and '${typeName(B.t)}')`);
    }
    // pointers
    const pa = isPtr(A.t) || isArr(A.t), pb = isPtr(B.t) || isArr(B.t);
    if (pa || pb || A.isNull || B.isNull) {
      const P = (X) => (isArr(X.t) ? `$P(${X.c}, 0)` : X.c);
      if (['==', '!='].includes(op)) {
        if ((pa || A.isNull) && (pb || B.isNull)) return { c: `(${op === '!=' ? '1 - ' : ''}$peq(${P(A)}, ${P(B)}))`, t: 'bool' };
        if (pa && B.cv === 0) return { c: `(${P(A)} ${op === '==' ? '===' : '!=='} null ? 1 : 0)`, t: 'bool' };
        if (pb && A.cv === 0) return { c: `(${P(B)} ${op === '==' ? '===' : '!=='} null ? 1 : 0)`, t: 'bool' };
        if (A.isNull || B.isNull) { /* NULL compared with a number: it is 0 */ }
        else this.error(e, `ISO C++ forbids comparison between pointer and integer [-fpermissive]`, (isPtr(A.t) && A.str) || (isPtr(B.t) && B.str) ? 'Text in "double quotes" is a string. To compare one letter (a char), use single quotes: \'A\'.' : undefined);
      } else if (op === '+' && pa && isInt(B.t)) return { c: `$padd(${P(A)}, ${this.conv(B, 'i32', e.b)})`, t: isArr(A.t) ? { k: 'ptr', to: A.t.of } : A.t };
      else if (op === '+' && pb && isInt(A.t)) return { c: `$padd(${P(B)}, ${this.conv(A, 'i32', e.a)})`, t: isArr(B.t) ? { k: 'ptr', to: B.t.of } : B.t };
      else if (op === '-' && pa && isInt(B.t)) return { c: `$padd(${P(A)}, -(${this.conv(B, 'i32', e.b)}))`, t: isArr(A.t) ? { k: 'ptr', to: A.t.of } : A.t };
      else if (op === '-' && pa && pb) return { c: `(${P(A)}.o - ${P(B)}.o)`, t: 'i16' };
      else if (!(A.isNull && isArith(B.t)) && !(B.isNull && isArith(A.t))) this.error(e, `invalid operands of types '${typeName(A.t)}' and '${typeName(B.t)}' to binary 'operator${op}'`, op === '+' && (A.str || B.str) ? 'Joining text with + needs a String: String("Count: ") + count. Or print the two parts one after the other.' : undefined);
    }
    if (!isArith(A.t) || !isArith(B.t)) {
      const bad = !isArith(A.t) ? A.t : B.t;
      this.error(e, `invalid operands of types '${typeName(A.t)}' and '${typeName(B.t)}' to binary 'operator${op}'`, isObj(bad) ? `'${bad.cls}' is an object: use one of its functions, like .read().` : undefined);
    }
    let c, t;
    if (['<<', '>>'].includes(op)) {
      if (A.t === 'f32' || B.t === 'f32') this.error(e, `invalid operands of types '${typeName(A.t)}' and '${typeName(B.t)}' to binary 'operator${op}'`);
      t = promote(A.t);
      const a = this.conv(A, t, e.a), b = this.conv(B, promote(B.t), e.b);
      this.acc += B.cv !== undefined ? Math.min(B.cv, 16) * (t === 'i32' || t === 'u32' ? 4 : 2) : 30;
      if (B.cv !== undefined && (B.cv < 0 || B.cv >= sizeOf(t) * 8)) this.warn(e, `${op === '<<' ? 'left' : 'right'} shift count ${B.cv < 0 ? 'is negative' : '>= width of type'} [-Wshift-count-overflow]`);
      if (op === '<<') c = t === 'u32' ? `((${a}) << (${b}) >>> 0)` : WRAP[t](`(${a}) << (${b})`);
      else c = t === 'u32' || t === 'u16' ? `((${a}) >>> (${b}))` : `((${a}) >> (${b}))`;
    } else {
      const ct = common(A.t, B.t);
      const a = this.conv(A, ct, e.a), b = this.conv(B, ct, e.b);
      this.acc += opCost(op, ct);
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
        if (isInt(A.t) && isInt(B.t) && (A.t[0] === 'u') !== (B.t[0] === 'u') && ct[0] === 'u' && A.cv === undefined && B.cv === undefined) this.warn(e, 'comparison of integer expressions of different signedness [-Wsign-compare]');
        t = 'bool';
        c = `((${a}) ${op === '==' ? '===' : op === '!=' ? '!==' : op} (${b}) ? 1 : 0)`;
      } else {
        t = ct;
        if (ct === 'f32') {
          if (['%', '&', '|', '^'].includes(op)) this.error(e, `invalid operands of types '${typeName(A.t)}' and '${typeName(B.t)}' to binary 'operator${op}'`, op === '%' ? '% (the remainder) only works on whole numbers. fmod(a, b) does it for floats.' : undefined);
          c = `F((${a}) ${op} (${b}))`;
        } else if (op === '/' || op === '%') {
          if (B.cv === 0) this.warn(e, 'division by zero [-Wdiv-by-zero]');
          const h = { i16: '16', u16: 'u16', i32: '32', u32: 'u32' }[ct];
          c = `${op === '/' ? '$d' : '$m'}${h}(${a}, ${b})`;
        } else if (op === '*') {
          c = ct === 'i32' ? `Math.imul(${a}, ${b})` : ct === 'u32' ? `(Math.imul(${a}, ${b}) >>> 0)` : WRAP[ct](`(${a}) * (${b})`);
        } else {
          c = WRAP[ct](`(${a}) ${op} (${b})`);
        }
      }
    }
    let cv;
    if (A.cv !== undefined && B.cv !== undefined) { cv = foldCode(c); if (typeof cv === 'number') c = lit(cv); else cv = undefined; }
    return { c, t, cv };
  }

  unary(e) {
    if (e.op === '&') {
      if (e.a.k === 'id') {
        const s = this.lookup(e.a.name);
        if (s && s.kind === 'var' && s.boxed) return { c: `$P(${s.js}, 0)`, t: { k: 'ptr', to: s.t } };
        if (s && s.kind === 'var' && isArr(s.t)) return { c: `$P(${s.js}, 0)`, t: { k: 'ptr', to: s.t.of } };
        if (s && s.kind === 'fn') this.error(e, "pointers to functions are not supported by the course's interpreter");
      }
      if (e.a.k === 'idx') {
        const r = this.expr(e.a);
        if (r.lv && r.lv.kind === 'elem') return { c: `$P(${r.lv.arr}, ${r.lv.idx})`, t: { k: 'ptr', to: r.t } };
        if (r.lv && r.lv.kind === 'ptr') return { c: `$padd(${r.lv.p}, ${r.lv.idx})`, t: { k: 'ptr', to: r.t } };
      }
      const r = this.expr(e.a);
      if (!r.lv) this.error(e, 'lvalue required as unary \'&\' operand');
      this.error(e, "taking the address of this is not supported by the course's interpreter");
    }
    if (e.op === '*') {
      const r = this.expr(e.a);
      if (isArr(r.t)) return { c: `(${r.c}[0] ?? 0)`, t: r.t.of, lv: { kind: 'elem', arr: r.c, idx: '0', t: r.t.of, line: e.line, name: '' } };
      if (!isPtr(r.t)) this.error(e, `invalid type argument of unary '*' (have '${typeName(r.t)}')`);
      return { c: this.ptrRead(r.c, '0', r.t.to, e.line), t: r.t.to, lv: { kind: 'ptr', p: r.c, idx: '0', t: r.t.to, line: e.line, cst: r.t.cst } };
    }
    const A = this.expr(e.a);
    if (e.op === '!') {
      const c = `((${this.truth(A, e.a)}) ? 0 : 1)`;
      return { c, t: 'bool', cv: A.cv !== undefined ? (A.cv ? 0 : 1) : undefined };
    }
    if (!isArith(A.t)) this.error(e, `wrong type argument to unary ${e.op === '-' ? 'minus' : e.op === '+' ? 'plus' : 'complement'}`);
    const t = promote(A.t);
    const a = this.conv(A, t, e.a);
    let c;
    if (e.op === '+') c = a;
    else if (e.op === '-') c = t === 'f32' ? `F(-(${a}))` : WRAP[t](`-(${a})`);
    else { if (t === 'f32') this.error(e, "wrong type argument to bit-complement"); c = WRAP[t](`~(${a})`); }
    let cv;
    if (A.cv !== undefined) { cv = foldCode(c); if (typeof cv === 'number') c = lit(cv); }
    return { c, t, cv };
  }

  // store `val` (JS code, already of type lv.t) into an lvalue; returns code whose value is the stored value
  store(lv, val, node) {
    this.acc += 3;
    if (lv.sym?.cst || lv.cst) this.error(node, `assignment of read-only ${lv.kind === 'var' ? `variable '${lv.sym.name}'` : 'location'}`, lv.kind === 'var' ? `'${lv.sym.name}' is const: its value is fixed where it is made (line ${lv.sym.line}).` : undefined);
    if (lv.kind === 'var') return `(${lv.js} = ${val})`;
    if (lv.kind === 'box') return `(${lv.js}[0] = ${val})`;
    if (lv.kind === 'elem') return `$st(${lv.arr}, ${lv.idx}, ${val}, ${lv.line}, ${JSON.stringify(lv.name)})`;
    if (lv.kind === 'ptr') return `$pw(${lv.p}, ${lv.idx}, ${val}, ${lv.line})`;
    this.error(node, 'lvalue required as left operand of assignment');
  }
  // an lvalue whose parts are evaluated once (for x op= y, x++)
  stable(lv) {
    if (lv.kind === 'var' || lv.kind === 'box') return { lv, setup: '' };
    if (lv.kind === 'elem') {
      const ti = this.temp();
      return { lv: { ...lv, idx: ti }, setup: `${ti} = ${lv.idx}, ` };
    }
    if (lv.kind === 'ptr') {
      const tp = this.temp(), ti = this.temp();
      return { lv: { ...lv, p: tp, idx: ti }, setup: `${tp} = ${lv.p}, ${ti} = ${lv.idx}, ` };
    }
    return { lv, setup: '' };
  }
  readLv(lv) {
    if (lv.kind === 'var') return lv.js;
    if (lv.kind === 'box') return `${lv.js}[0]`;
    if (lv.kind === 'elem') return `(${lv.arr}[${lv.idx}] ?? $oob(${lv.line}, ${JSON.stringify(lv.name)}, ${lv.idx}, ${lv.arr}.length))`;
    return this.ptrRead(lv.p, lv.idx, lv.t, lv.line);
  }
  assign(e) {
    const A = this.expr(e.a);
    if (!A.lv) {
      if (isArr(A.t)) this.error(e, `invalid array assignment`, 'An array cannot be copied with =. Copy it one place at a time with a for loop.');
      if (isObj(A.t)) this.error(e, `assigning one ${A.t.cls} to another is not supported by the course's interpreter`);
      this.error(e, 'lvalue required as left operand of assignment', A.cv !== undefined || A.fn ? `The left of = must be a variable. Is it the wrong way round, or did you mean == (compare)?` : undefined);
    }
    if (A.lv.sym && A.lv.sym.cv !== undefined && A.lv.sym.cst) this.store(A.lv, '0', e);
    const t = A.lv.t;
    if (isArr(t)) this.error(e, 'invalid array assignment', 'An array cannot be copied with =. Copy it one place at a time with a for loop.');
    if (e.op === '=') {
      const B = this.expr(e.b);
      return { c: this.store(A.lv, this.conv(B, t, e.b, 'assignment'), e), t };
    }
    const op = e.op.slice(0, -1);
    const { lv, setup } = this.stable(A.lv);
    const cur = { c: this.readLv(lv), t, lv };
    if (t === 'String') {
      if (op !== '+') this.error(e, `no match for 'operator${e.op}' (operand types are 'String' and '${typeName(this.expr(e.b).t)}')`);
      const B = this.expr(e.b);
      return { c: `(${setup}${this.store(lv, `${cur.c} + ${this.conv(B, 'String', e.b)}`, e)})`, t };
    }
    if (isPtr(t)) {
      const B = this.expr(e.b);
      if (!isInt(B.t) || !['+', '-'].includes(op)) this.error(e, `invalid operands to binary 'operator${op}'`);
      return { c: `(${setup}${this.store(lv, `$padd(${cur.c}, ${op === '-' ? '-' : ''}(${this.conv(B, 'i32', e.b)}))`, e)})`, t };
    }
    // x op= y is x = (type of x)(x op y)
    const node = { k: 'bin', op, line: e.line, col: e.col };
    const B = this.expr(e.b);
    const r = this.binaryVals(node, cur, B, e.a, e.b);
    return { c: `(${setup}${this.store(lv, this.conv(r, t, e, 'assignment'), e)})`, t };
  }
  binaryVals(node, A, B, na, nb) {
    // run binary() with already-compiled operands
    const fake = { ...node, a: { k: '$v', v: A, line: na.line, col: na.col }, b: { k: '$v', v: B, line: nb.line, col: nb.col } };
    const orig = this.expr.bind(this);
    this.expr = (x, o) => (x.k === '$v' ? x.v : orig(x, o));
    try { return this.binary(fake); } finally { delete this.expr; }
  }
  incdec(e) {
    const A = this.expr(e.a);
    const word = e.op === '++' ? 'increment' : 'decrement';
    if (!A.lv) this.error(e, `lvalue required as ${word} operand`);
    const t = A.lv.t;
    if (!isArith(t) && !isPtr(t)) this.error(e, `no match for 'operator${e.op}' (operand type is '${typeName(t)}')`);
    const { lv, setup } = this.stable(A.lv);
    const cur = this.readLv(lv);
    this.acc += t === 'f32' ? 120 : t === 'i32' || t === 'u32' ? 6 : 3;
    const d = e.op === '++' ? '+ 1' : '- 1';
    const nextOf = (x) => (isPtr(t) ? `$padd(${x}, ${e.op === '++' ? 1 : -1})` : t === 'f32' ? `F(${x} ${d})` : t === 'bool' ? (e.op === '++' ? '1' : `(${x} ? 0 : 1)`) : WRAP[t](`${x} ${d}`));
    if (e.k === 'pre') return { c: `(${setup}${this.store(lv, nextOf(cur), e)})`, t };
    const tv = this.temp();
    return { c: `(${setup}${tv} = ${cur}, ${this.store(lv, nextOf(tv), e)}, ${tv})`, t };
  }

  // ---- calls ----
  args(e, params, min, name, sigText) {
    if (e.args.length < min) this.error(e, `too few arguments to function '${sigText}'`, `${name}() needs ${min === params.length ? params.length : `at least ${min}`} value${params.length === 1 ? '' : 's'} in its brackets, separated by commas.`);
    if (e.args.length > params.length) this.error(e, `too many arguments to function '${sigText}'`, `${name}() takes ${params.length === 0 ? 'nothing' : params.length === min ? params.length : `${min} to ${params.length}`} in its brackets.`);
    return e.args.map((a, i) => this.conv(this.expr(a), params[i], a, 'argument'));
  }
  call(e, opt) {
    const f = e.f;
    if (f.k === 'mem') return this.method(e, opt);
    if (f.k !== 'id') {
      const r = this.expr(f);
      this.error(e, `'${this.exprText(f)}' cannot be used as a function`, isArith(r.t) ? 'Is a * (times) missing before the ( ?' : undefined);
    }
    const name = f.name;
    const local = this.lookup(name);
    if (local && local.kind === 'var') this.error(e, `'${name}' cannot be used as a function`, `'${name}' is a variable (line ${local.line}). A function call needs a function's name.`);
    if (local && local.kind === 'fn') {
      const params = local.params;
      const sigText = `${typeName(local.ret)} ${name}(${params.map((p) => typeName(p.t)).join(', ')})`;
      let min = params.length;
      while (min > 0 && params[min - 1].def) min--;
      if (e.args.length < min) this.error(e, `too few arguments to function '${sigText}'`, `${name}() needs ${params.length} value${params.length === 1 ? '' : 's'}: ${params.map((p) => typeName(p.t) + ' ' + (p.name || '')).join(', ')}.`);
      if (e.args.length > params.length) this.error(e, `too many arguments to function '${sigText}'`, `${name}() takes ${params.length || 'nothing'}${params.length ? ' value' + (params.length === 1 ? '' : 's') : ''} in its brackets.`);
      const args = params.map((p, i) => {
        const a = e.args[i] ?? p.def;
        return this.conv(this.expr(a), p.t, a, 'argument');
      });
      if (!local.called) local.called = e;
      this.acc += 20 + 4 * params.length;
      return { c: `(yield* ${local.js}(${args.join(', ')}))`, t: local.ret };
    }
    if (MACROS.has(name)) return this.macro(e, name);
    const B = BUILTINS[name];
    if (B) {
      const sigText = `${typeName(B.r)} ${name}(${B.p.map((p) => (p === 'ptr' ? 'const char*' : { u8: 'uint8_t', u16: 'unsigned int', u32: 'long unsigned int', i32: 'long int', i16: 'int', f32: 'double', bool: 'bool' }[p] ?? p)).join(', ')})`;
      const args = this.args(e, B.p, B.min ?? B.p.length, name, sigText);
      if (B.line) args.push(String(e.line));
      this.acc += 6 + 3 * args.length;
      this.uses.add(name);
      const fn = 'rt.' + (B.js || name);
      return { c: B.gen ? `(yield* ${fn}(${args.join(', ')}))` : `${fn}(${args.join(', ')})`, t: B.r };
    }
    if (CLASSES[name]?.ctor) this.error(e, `a ${name} can only be made where it is declared, like ${name} myThing(…);`);
    this.notDeclared(f, name);
  }
  macro(e, name) {
    const a = e.args;
    const need = { abs: 1, min: 2, max: 2, constrain: 3, sq: 1, round: 1, radians: 1, degrees: 1, bitRead: 2, bitSet: 2, bitClear: 2, bitWrite: 3, bit: 1, lowByte: 1, highByte: 1, makeKeymap: 1, F: 1, word: 1 }[name];
    if (name === 'random') {
      if (a.length < 1 || a.length > 2) this.error(e, a.length < 1 ? "too few arguments to function 'long int random(long int)'" : "too many arguments to function 'long int random(long int, long int)'", 'random(max) or random(min, max): the number is at least min and less than max.');
      const args = a.map((x) => this.conv(this.expr(x), 'i32', x));
      this.uses.add('random');
      return { c: a.length === 1 ? `rt.random1(${args[0]})` : `rt.random2(${args[0]}, ${args[1]})`, t: 'i32' };
    }
    if (name === 'word' && a.length === 2) {
      const h = this.conv(this.expr(a[0]), 'u8', a[0]), l = this.conv(this.expr(a[1]), 'u8', a[1]);
      return { c: `(((${h}) << 8 | (${l})) & 65535)`, t: 'u16' };
    }
    if (a.length !== need) this.error(e, `macro "${name}" ${a.length < need ? 'requires' : 'passed'} ${Math.max(a.length, need)} arguments, but ${a.length < need ? 'only ' + a.length + ' given' : 'takes just ' + need}`);
    const n = (text) => ({ k: 'num', text, line: e.line, col: e.col });
    const bin = (op, x, y) => ({ k: 'bin', op, a: x, b: y, line: e.line, col: e.col });
    const cond = (c, x, y) => ({ k: 'cond', c, a: x, b: y, line: e.line, col: e.col });
    const neg = (x) => ({ k: 'un', op: '-', a: x, line: e.line, col: e.col });
    const cast = (words, x, ptr = 0) => ({ k: 'cast', type: { words, line: e.line, col: e.col }, ptr, a: x, line: e.line, col: e.col });
    const asg = (op, x, y) => ({ k: 'asg', op, a: x, b: y, line: e.line, col: e.col });
    let tree;
    switch (name) {
      case 'abs': tree = cond(bin('>', a[0], n('0')), a[0], neg(a[0])); break;
      case 'min': tree = cond(bin('<', a[0], a[1]), a[0], a[1]); break;
      case 'max': tree = cond(bin('>', a[0], a[1]), a[0], a[1]); break;
      case 'constrain': tree = cond(bin('<', a[0], a[1]), a[1], cond(bin('>', a[0], a[2]), a[2], a[0])); break;
      case 'sq': tree = bin('*', a[0], a[0]); break;
      case 'round': tree = cond(bin('>=', a[0], n('0')), cast(['long'], bin('+', a[0], n('0.5'))), cast(['long'], bin('-', a[0], n('0.5')))); break;
      case 'radians': tree = bin('*', a[0], { k: 'id', name: 'DEG_TO_RAD', line: e.line, col: e.col }); break;
      case 'degrees': tree = bin('*', a[0], { k: 'id', name: 'RAD_TO_DEG', line: e.line, col: e.col }); break;
      case 'bitRead': tree = bin('&', bin('>>', a[0], a[1]), n('0x01')); break;
      case 'bitSet': tree = asg('|=', a[0], bin('<<', n('1UL'), a[1])); break;
      case 'bitClear': tree = asg('&=', a[0], { k: 'un', op: '~', a: bin('<<', n('1UL'), a[1]), line: e.line, col: e.col }); break;
      case 'bitWrite': tree = cond(a[2], asg('|=', a[0], bin('<<', n('1UL'), a[1])), asg('&=', a[0], { k: 'un', op: '~', a: bin('<<', n('1UL'), a[1]), line: e.line, col: e.col })); break;
      case 'bit': tree = bin('<<', n('1UL'), a[0]); break;
      case 'lowByte': tree = cast(['uint8_t'], bin('&', a[0], n('0xff'))); break;
      case 'highByte': tree = cast(['uint8_t'], bin('>>', a[0], n('8'))); break;
      case 'makeKeymap': tree = cast(['char'], a[0], 1); break;
      case 'F': tree = a[0]; break;
      case 'word': tree = cast(['word'], a[0]); break;
    }
    return this.expr(tree);
  }
  stringCtor(e) {
    if (!e.args.length) return { c: '""', t: 'String' };
    const A = this.expr(e.args[0]);
    if (e.args.length === 2) {
      const b = this.conv(this.expr(e.args[1]), 'i16', e.args[1]);
      if (!isArith(A.t)) this.error(e, 'String(value, base) needs a number');
      return { c: `$S.num(${A.c}, ${this.kind(A.t)}, ${b})`, t: 'String' };
    }
    return { c: this.conv(A, 'String', e.args[0]), t: 'String' };
  }
  method(e, opt) {
    const m = e.f;
    const O = this.expr(m.a);
    if (m.arrow) this.error(m, `base operand of '->' has non-pointer type '${typeName(O.t)}'`, 'Use a dot: object.function()');
    if (O.t === 'String') return this.stringMethod(e, O, m);
    if (!isObj(O.t)) {
      if (O.t && O.t.k === 'fn') this.error(m, `request for member '${m.name}' in '${this.exprText(m.a)}', which is of non-class type`);
      this.error(m, `request for member '${m.name}' in '${this.exprText(m.a)}', which is of non-class type '${typeName(O.t)}'`);
    }
    const C = CLASSES[O.t.cls];
    const cname = O.t.cls;
    if (C.print && PRINT[m.name]) {
      if (e.args.length > 2) this.error(e, `no matching function for call to '${cname}::${m.name}(…)'`, `${m.name}() takes one thing to show, and for numbers an optional format (DEC, HEX, BIN) or number of decimals.`);
      if (!e.args.length) {
        if (m.name === 'print') this.error(e, `no matching function for call to '${cname}::print()'`, 'print() needs something to show in its brackets.');
        return { c: `(yield* ${O.c}.ln())`, t: 'u16' };
      }
      const V = this.expr(e.args[0]);
      const k = this.printKind(V.t, e.args[0]);
      let fmt = 'undefined';
      if (e.args.length === 2) {
        if (k === 's' || k === 'S' || k === 'a') this.error(e, `no matching function for call to '${cname}::${m.name}(${typeName(V.t)}, int)'`);
        fmt = this.conv(this.expr(e.args[1]), 'i16', e.args[1]);
      }
      const val = k === 'a' ? `$P(${V.c}, 0)` : V.c;
      return { c: `(yield* ${O.c}.pr(${JSON.stringify(k === 'a' ? 's' : k)}, ${val}, ${fmt}, ${m.name === 'println' ? 1 : 0}))`, t: 'u16' };
    }
    const spec = C.methods[m.name];
    if (!spec) {
      const all = [...Object.keys(C.methods), ...(C.print ? ['print', 'println'] : [])];
      const s = closest(m.name, all);
      this.error(m, `'class ${cname}' has no member named '${m.name}'${s ? `; did you mean '${s}'?` : ''}`, s ? null : `A ${cname} can do: ${all.join(', ')}.`);
    }
    if (spec.writeLike && e.args.length === 1) {
      const V = this.expr(e.args[0]);
      if (isPtr(V.t) || isArr(V.t)) return { c: `(yield* ${O.c}.pr("s", ${isArr(V.t) ? `$P(${V.c}, 0)` : V.c}, undefined, 0))`, t: 'u16' };
    }
    const sigText = `${typeName(spec.r)} ${cname}::${m.name}(${spec.p.map((p) => (p === 'ptr' ? 'uint8_t*' : typeName(p))).join(', ')})`;
    const args = this.args(e, spec.p, spec.min ?? spec.p.length, m.name, sigText);
    return { c: spec.gen ? `(yield* ${O.c}.${m.name}(${args.join(', ')}))` : `${O.c}.${m.name}(${args.join(', ')})`, t: spec.r };
  }
  stringMethod(e, O, m) {
    const spec = STRING_METHODS[m.name];
    if (!spec) {
      const s = closest(m.name, Object.keys(STRING_METHODS));
      this.error(m, `'class String' has no member named '${m.name}'${s ? `; did you mean '${s}'?` : ''}`);
    }
    const [r, p, min = p.length, inplace] = spec;
    const args = this.args(e, p, min, m.name, `String::${m.name}`).map((c, i) => (p[i] === 'any' ? this.conv(this.expr(e.args[i]), 'String', e.args[i]) : c));
    if (inplace) {
      if (!O.lv) this.error(e, `String::${m.name}() changes the String, so it needs a String variable`);
      const { lv, setup } = this.stable(O.lv);
      if (r === 'bool') return { c: `(${setup}${this.store(lv, `$S.${m.name}(${this.readLv(lv)}, ${args.join(', ')})`, e)}, 1)`, t: 'bool' };
      return { c: `(${setup}${this.store(lv, `$S.${m.name}(${[this.readLv(lv), ...args].join(', ')})`, e)}, undefined)`, t: 'void' };
    }
    return { c: `$S.${m.name}(${[O.c, ...args].join(', ')})`, t: r === 'ptr' ? { k: 'ptr', to: 'i8', cst: true } : r };
  }
}
const STOP = { stop: true };
// A model of the chip's clock cycles for one operation (avr-gcc's code and its
// helper routines: no divide instruction, no floating-point hardware).
function opCost(op, t) {
  const wide = t === 'i32' || t === 'u32';
  if (t === 'f32') return op === '*' ? 160 : op === '/' ? 480 : ['+', '-'].includes(op) ? 120 : 70;
  if (op === '/' || op === '%') return wide ? 650 : 230;
  if (op === '*') return wide ? 50 : 8;
  return wide ? 4 : 2;
}

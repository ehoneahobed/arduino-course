// The course's Arduino C++ interpreter, part 1: reading a sketch.
//
// A lexer, a small preprocessor (#include, #define, #ifdef) and a parser for
// the part of C++ that Arduino sketches use. It produces a tree that
// cpp-compile.js checks and turns into JavaScript. Errors are thrown as
// CompileError with the line and column, worded the way the real compiler
// (avr-gcc) words them, because the course teaches learners to read those.

export class CompileError extends Error {
  constructor(line, col, msg, note) {
    super(msg);
    this.line = line;
    this.col = col;
    this.note = note;
  }
}

// ---------- lexer ----------
const PUNCT = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
  '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}'];
const NUM = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[uUlLfF]*/;
const ID = /^[A-Za-z_][A-Za-z0-9_]*/;

function escapeValue(s, i, line, col) {
  // s[i] is the character after the backslash; returns [value, next index]
  const c = s[i];
  const simple = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11, '?': 63 };
  if (c === 'x') {
    const m = /^[0-9a-fA-F]+/.exec(s.slice(i + 1));
    if (!m) throw new CompileError(line, col, '\\x used with no following hex digits');
    return [parseInt(m[0], 16) & 255, i + 1 + m[0].length];
  }
  if (/[0-7]/.test(c)) {
    const m = /^[0-7]{1,3}/.exec(s.slice(i));
    return [parseInt(m[0], 8) & 255, i + m[0].length];
  }
  if (c in simple) return [simple[c], i + 1];
  return [c.charCodeAt(0), i + 1]; // unknown escape: gcc warns and keeps the letter
}

export function lex(src, { pp = true, line0 = 1, col0 = 1 } = {}) {
  const toks = [];
  let i = 0, line = line0, ls = -(col0 - 1); // ls: index where the current line starts
  let atLineStart = true;
  const n = src.length;
  const enc = new TextEncoder();
  while (i < n) {
    const c = src[i];
    if (c === '\n') { i++; line++; ls = i; atLineStart = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
    const col = i - ls + 1;
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new CompileError(line, col, 'unterminated comment');
      for (let k = i; k < end; k++) if (src[k] === '\n') { line++; ls = k + 1; }
      i = end + 2;
      continue;
    }
    if (c === '#' && atLineStart && pp) {
      // a preprocessor line (with backslash-newline continuations)
      let j = i + 1, text = '';
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\' && src[j + 1] === '\n') { j += 2; line++; ls = j; text += ' '; continue; }
        if (src[j] === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; break; }
        if (src[j] === '/' && src[j + 1] === '*') {
          const end = src.indexOf('*/', j + 2);
          if (end < 0) break;
          for (let k = j; k < end; k++) if (src[k] === '\n') { line++; ls = k + 1; }
          j = end + 2; text += ' '; continue;
        }
        text += src[j++];
      }
      toks.push({ t: 'pp', v: text, line, col, bodyCol: col + 1 });
      i = j;
      continue;
    }
    atLineStart = false;
    if (c === '"') {
      const bytes = [];
      let j = i + 1;
      for (;;) {
        if (j >= n || src[j] === '\n') throw new CompileError(line, col, 'missing terminating " character');
        const ch = src[j];
        if (ch === '"') { j++; break; }
        if (ch === '\\') { const [v, k] = escapeValue(src, j + 1, line, j - ls + 1); bytes.push(v); j = k; continue; }
        for (const b of enc.encode(ch)) bytes.push(b);
        j++;
      }
      toks.push({ t: 'str', v: bytes, line, col, text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      const vals = [];
      for (;;) {
        if (j >= n || src[j] === '\n') throw new CompileError(line, col, "missing terminating ' character");
        const ch = src[j];
        if (ch === "'") { j++; break; }
        if (ch === '\\') { const [v, k] = escapeValue(src, j + 1, line, j - ls + 1); vals.push(v); j = k; continue; }
        for (const b of enc.encode(ch)) vals.push(b);
        j++;
      }
      if (!vals.length) throw new CompileError(line, col, 'empty character constant');
      const multi = vals.length > 1;
      let v = vals[vals.length - 1];
      if (multi) v = vals.slice(-2).reduce((a, b) => (a << 8) | b, 0);
      toks.push({ t: 'chr', v: multi ? (v << 16) >> 16 : (v << 24) >> 24, multi, line, col, text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = NUM.exec(src.slice(i, i + 64));
      let text = m[0];
      // a number glued to letters (like 9pin) is one bad token
      const tail = /^[A-Za-z0-9_]*/.exec(src.slice(i + text.length))[0];
      if (tail) throw new CompileError(line, col, `invalid suffix "${tail}" on integer constant`);
      toks.push({ t: 'num', text, line, col });
      i += text.length;
      continue;
    }
    const idm = ID.exec(src.slice(i, i + 128));
    if (idm) {
      let id = idm[0];
      if (id.length === 128) id = ID.exec(src.slice(i))[0];
      toks.push({ t: 'id', v: id, line, col });
      i += id.length;
      continue;
    }
    let p = null;
    for (const q of PUNCT) if (src.startsWith(q, i)) { p = q; break; }
    if (p) { toks.push({ t: 'op', v: p, line, col }); i += p.length; continue; }
    const code = c.charCodeAt(0);
    if (code > 127) {
      const b = enc.encode(c)[0];
      throw new CompileError(line, col, `stray '\\${b.toString(8)}' in program`, 'A letter or symbol that is not plain ASCII is outside quotes. Often a curly quote (“ ” ‘ ’) pasted from a document: type it again as " or \'.');
    }
    throw new CompileError(line, col, `stray '${c}' in program`);
  }
  toks.push({ t: 'eof', line, col: i - ls + 1 });
  return toks;
}

// ---------- preprocessor ----------
// Runs the directives in order and expands #define macros. Returns the
// expanded tokens and the list of #include names.
export function preprocess(toks, knownHeaders) {
  const macros = new Map();
  const includes = [];
  const out = [];
  const cond = []; // stack of { on, done }
  const active = () => cond.every((c) => c.on);
  const input = toks.slice().reverse();
  const isDefined = (name) => macros.has(name) || name === 'ARDUINO' || name === '__AVR__' || name === 'ARDUINO_AVR_UNO' || name === '__AVR_ATmega328P__';
  while (input.length) {
    const tk = input.pop();
    if (tk.t === 'pp') {
      const m = /^\s*([a-z_]*)\s*([\s\S]*)$/.exec(tk.v);
      const dir = m[1];
      const rest = m[2].trim();
      const restCol = tk.col + 1 + tk.v.indexOf(m[2]);
      if (dir === 'ifdef' || dir === 'ifndef') {
        const on = active() && (dir === 'ifdef') === isDefined(rest.split(/\s/)[0]);
        cond.push({ on, done: on, outer: active() });
        continue;
      }
      if (dir === 'if') {
        let v = false;
        const e = rest.replace(/defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)/g, (s, a, b) => (isDefined(a || b) ? '1' : '0'));
        if (/^[\d\s()!&|<>=]+$/.test(e)) { try { v = !!Function(`return (${e})`)(); } catch { v = false; } }
        else if (/^ARDUINO\s*>=?\s*\d+$/.test(e)) v = true;
        const on = active() && v;
        cond.push({ on, done: on, outer: active() });
        continue;
      }
      if (dir === 'else' || dir === 'elif') {
        const top = cond[cond.length - 1];
        if (!top) throw new CompileError(tk.line, tk.col, `#${dir} without #if`);
        cond.pop();
        const outer = active();
        let v = true;
        if (dir === 'elif') { const e = rest.replace(/defined\s*\(\s*(\w+)\s*\)/g, (s, a) => (isDefined(a) ? '1' : '0')); v = /^[\d\s()!&|]+$/.test(e) ? !!Function(`return (${e})`)() : false; }
        const on = outer && !top.done && v;
        cond.push({ on, done: top.done || on });
        continue;
      }
      if (dir === 'endif') {
        if (!cond.length) throw new CompileError(tk.line, tk.col, '#endif without #if');
        cond.pop();
        continue;
      }
      if (!active()) continue;
      if (dir === 'include') {
        const im = /^[<"]\s*([^>"]+?)\s*[>"]/.exec(rest);
        if (!im) throw new CompileError(tk.line, tk.col, '#include expects "FILENAME" or <FILENAME>');
        const name = im[1];
        if (!knownHeaders.has(name)) throw new CompileError(tk.line, restCol, `${name}: No such file or directory`, knownHeaders.suggest?.(name));
        includes.push({ name, line: tk.line });
        continue;
      }
      if (dir === 'define') {
        const dm = /^([A-Za-z_]\w*)(\(([^)]*)\))?\s*([\s\S]*)$/.exec(rest);
        if (!dm) throw new CompileError(tk.line, restCol, 'macro names must be identifiers');
        const bodyCol = restCol + rest.length - dm[4].length;
        const body = lex(dm[4], { pp: false, line0: tk.line, col0: bodyCol }).slice(0, -1);
        const params = dm[2] !== undefined ? dm[3].split(',').map((s) => s.trim()).filter(Boolean) : null;
        macros.set(dm[1], { body, params, line: tk.line });
        continue;
      }
      if (dir === 'undef') { macros.delete(rest.split(/\s/)[0]); continue; }
      if (dir === 'pragma' || dir === 'line' || dir === '') continue;
      if (dir === 'error') throw new CompileError(tk.line, tk.col, '#error ' + rest);
      if (dir === 'warning') continue;
      throw new CompileError(tk.line, tk.col, `invalid preprocessing directive #${dir}`);
    }
    if (!active()) { if (tk.t === 'eof') out.push(tk); continue; }
    if (tk.t === 'id' && macros.has(tk.v) && !(tk.hide && tk.hide.has(tk.v))) {
      const mac = macros.get(tk.v);
      const hide = new Set(tk.hide || []);
      hide.add(tk.v);
      const place = (b) => ({ ...b, line: tk.line, col: tk.col, hide, macro: tk.v });
      if (!mac.params) {
        for (let k = mac.body.length - 1; k >= 0; k--) input.push(place(mac.body[k]));
        continue;
      }
      const next = input[input.length - 1];
      if (!next || next.t !== 'op' || next.v !== '(') { out.push(tk); continue; }
      input.pop();
      const args = [[]];
      let depth = 0;
      for (;;) {
        const a = input.pop();
        if (!a || a.t === 'eof') throw new CompileError(tk.line, tk.col, `unterminated argument list invoking macro "${tk.v}"`);
        if (a.t === 'op' && a.v === '(') depth++;
        if (a.t === 'op' && a.v === ')') { if (!depth) break; depth--; }
        if (a.t === 'op' && a.v === ',' && !depth) { args.push([]); continue; }
        args[args.length - 1].push(a);
      }
      if (args.length === 1 && !args[0].length && mac.params.length === 0) args.length = 0;
      if (args.length !== mac.params.length) throw new CompileError(tk.line, tk.col, `macro "${tk.v}" ${args.length < mac.params.length ? 'requires' : 'passed'} ${Math.max(args.length, mac.params.length)} arguments, but ${args.length < mac.params.length ? 'only ' + args.length + ' given' : 'takes just ' + mac.params.length}`);
      const exp = [];
      for (const b of mac.body) {
        const pi = b.t === 'id' ? mac.params.indexOf(b.v) : -1;
        if (pi >= 0) exp.push(...args[pi]);
        else exp.push(place(b));
      }
      for (let k = exp.length - 1; k >= 0; k--) input.push(exp[k]);
      continue;
    }
    out.push(tk);
  }
  if (cond.length) {
    const last = out[out.length - 1];
    throw new CompileError(last.line, 1, 'unterminated #if (an #ifdef or #if has no #endif)');
  }
  return { toks: out, includes, macros };
}

// ---------- parser ----------
export const TYPE_WORDS = new Set(['void', 'bool', 'boolean', 'char', 'byte', 'short', 'int', 'long', 'unsigned', 'signed', 'float', 'double', 'word',
  'size_t', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'uint64_t', 'int64_t', 'String', 'const', 'static', 'volatile', 'auto', 'unsigned', 'register', 'inline', 'enum', 'struct']);
const QUALIFIERS = new Set(['const', 'static', 'volatile', 'register', 'inline', 'extern']);
const COMBO = new Set(['unsigned', 'signed', 'long', 'short', 'int', 'char', 'double']);

const tokText = (t) => {
  if (t.t === 'eof') return null;
  if (t.t === 'id') return `'${t.v}'`;
  if (t.t === 'num') return 'numeric constant';
  if (t.t === 'str') return 'string constant';
  if (t.t === 'chr') return 'character constant';
  return `'${t.v}' token`;
};
export const before = (t) => (t.t === 'eof' ? 'at end of input' : `before ${tokText(t)}`);

export function parse(toks, classNames) {
  let p = 0;
  const typedefs = new Set();
  const peek = (k = 0) => toks[Math.min(p + k, toks.length - 1)];
  const next = () => toks[p++];
  const is = (v, k = 0) => { const t = peek(k); return (t.t === 'op' || t.t === 'id') && t.v === v; };
  const accept = (v) => { if (is(v)) { p++; return true; } return false; };
  const err = (t, msg, note) => { throw new CompileError(t.line, t.col, msg, note); };
  const expect = (v, what) => {
    if (is(v)) return next();
    const t = peek();
    if (v === '}' && t.t === 'eof') err(t, "expected '}' at end of input", 'A { has no matching }. Count them: every { needs a } to close it.');
    err(t, `expected '${v}' ${before(t)}`, what);
  };
  const isTypeName = (t) => t.t === 'id' && (TYPE_WORDS.has(t.v) || classNames.has(t.v) || typedefs.has(t.v));
  const startsType = (k = 0) => {
    const t = peek(k);
    if (!isTypeName(t)) return false;
    // `String(x)` and `int(x)` at the start of an expression are casts, not declarations
    if (!QUALIFIERS.has(t.v) && is('(', k + 1) && !classNames.has(t.v)) return false;
    if (classNames.has(t.v) && (is('(', k + 1) || is('.', k + 1))) return false; // Keypad(...) or Serial.x
    return true;
  };

  // [const] [static] base-type
  function parseType() {
    const start = peek();
    const q = { const: false, static: false };
    const words = [];
    let cls = null;
    for (;;) {
      const t = peek();
      if (t.t !== 'id') break;
      if (QUALIFIERS.has(t.v)) { next(); if (t.v === 'const') q.const = true; if (t.v === 'static') q.static = true; continue; }
      if (t.v === 'enum') { next(); const en = parseEnum(t); words.push(en ? 'int' : 'int'); continue; }
      if (t.v === 'struct') err(t, "struct is not supported by the course's interpreter", 'Use separate variables or arrays instead.');
      if (cls) break;
      if (TYPE_WORDS.has(t.v) || typedefs.has(t.v)) {
        if (!words.length || (COMBO.has(t.v) && words.every((w) => COMBO.has(w)))) { words.push(t.v); next(); continue; }
        break;
      }
      if (classNames.has(t.v) && !words.length) { cls = t.v; next(); continue; }
      break;
    }
    if (!words.length && !cls) err(peek(), `expected type-specifier ${before(peek())}`);
    return { words, cls, ...q, line: start.line, col: start.col };
  }
  let enumDecls = [];
  function parseEnum(t) {
    let name = null;
    if (peek().t === 'id' && !is('{')) { name = next().v; typedefs.add(name); }
    if (!accept('{')) return name;
    const items = [];
    while (!is('}')) {
      const it = next();
      if (it.t !== 'id') err(it, `expected identifier ${before(it)}`);
      let val = null;
      if (accept('=')) val = parseAssign();
      items.push({ name: it.v, val, line: it.line, col: it.col });
      if (!accept(',')) break;
    }
    expect('}');
    enumDecls.push({ k: 'enum', name, items, line: t.line, col: t.col });
    return name;
  }

  // one declarator: *name[3][4] = init | (args)
  function parseDeclarator(type, allowInit = true) {
    let ptr = 0;
    while (accept('*')) ptr++;
    if (is('&')) err(peek(), "references (&) are not supported by the course's interpreter", 'Use a global variable, or return the value from the function.');
    const nt = peek();
    if (nt.t !== 'id' || TYPE_WORDS.has(nt.v)) {
      if (nt.t === 'id' && TYPE_WORDS.has(nt.v)) err(nt, `expected unqualified-id ${before(nt)}`);
      err(nt, `expected unqualified-id ${before(nt)}`);
    }
    next();
    const dims = [];
    while (accept('[')) {
      if (accept(']')) { dims.push(null); continue; }
      dims.push(parseExpr());
      expect(']');
    }
    const d = { name: nt.v, line: nt.line, col: nt.col, ptr, dims, init: null, ctor: null };
    if (!allowInit) return d;
    if (accept('=')) {
      const at = peek();
      d.init = is('{') ? parseInitList() : parseAssign();
      d.initAt = at;
    } else if (is('(')) {
      const at = next();
      const args = [];
      if (!is(')')) { do { args.push(parseAssign()); } while (accept(',')); }
      expect(')');
      d.ctor = args;
      d.initAt = at;
    } else if (is('{')) {
      d.init = parseInitList();
    }
    return d;
  }
  function parseInitList() {
    const open = expect('{');
    const items = [];
    while (!is('}')) {
      items.push(is('{') ? parseInitList() : parseAssign());
      if (!accept(',')) break;
    }
    expect('}');
    return { k: 'list', items, line: open.line, col: open.col };
  }
  function parseParams() {
    const params = [];
    if (is(')')) return params;
    if (is('void') && is(')', 1)) { next(); return params; }
    do {
      if (!startsType()) err(peek(), `expected type-specifier ${before(peek())}`, peek().t === 'id' ? `Each thing a function takes needs its type in front, like int ${peek().v}.` : undefined);
      const type = parseType();
      let ptr = 0;
      while (accept('*')) ptr++;
      if (is('&')) err(peek(), "references (&) are not supported by the course's interpreter", 'Pass the value instead, or use a global variable.');
      let name = null, line = peek().line, col = peek().col;
      if (peek().t === 'id' && !TYPE_WORDS.has(peek().v)) name = next().v;
      const dims = [];
      while (accept('[')) { if (accept(']')) { dims.push(null); continue; } dims.push(parseExpr()); expect(']'); }
      let def = null;
      if (accept('=')) def = parseAssign();
      params.push({ type, ptr, name, dims, def, line, col });
    } while (accept(','));
    return params;
  }

  // ---- top level ----
  function parseTop() {
    const items = [];
    while (peek().t !== 'eof') {
      const t = peek();
      if (accept(';')) continue;
      if (is('}')) err(t, "expected declaration before '}' token", 'There is one } too many: it closes nothing. Remove it, or check the { above it.');
      if (is('typedef')) {
        next();
        const type = parseType();
        const d = parseDeclarator(type, false);
        typedefs.add(d.name);
        items.push({ k: 'typedef', type, d, line: t.line, col: t.col });
        expect(';');
        continue;
      }
      if (is('enum')) {
        enumDecls = [];
        next();
        parseEnum(t);
        items.push(...enumDecls);
        if (!accept(';')) {
          // enum used as a type for variables: enum State s = ...;
          const decls = [];
          do { decls.push(parseDeclarator({ words: ['int'], line: t.line, col: t.col })); } while (accept(','));
          expect(';');
          items.push({ k: 'decl', type: { words: ['int'], line: t.line, col: t.col }, decls, line: t.line, col: t.col });
        }
        continue;
      }
      if (t.t === 'id' && !isTypeName(t)) {
        const n = peek(1);
        if (n.t === 'id' || (n.t === 'op' && n.v === '*' && peek(2).t === 'id')) err(t, `'${t.v}' does not name a type`, null, { kind: 'type', name: t.v });
        if (n.t === 'op' && n.v === '(' ) err(t, `expected constructor, destructor, or type conversion before '(' token`, `A line outside every function must start with a type, like void ${t.v}() { … } or int ${t.v} = 0;`);
        err(t, `'${t.v}' does not name a type`, null);
      }
      if (t.t !== 'id') err(t, `expected unqualified-id ${before(t)}`);
      enumDecls = [];
      const type = parseType();
      items.push(...enumDecls);
      if (accept(';')) continue; // a bare enum or type
      // function?
      let k = 0;
      while (is('*', k)) k++;
      if (peek(k).t === 'id' && is('(', k + 1) && looksLikeFunction(k + 2)) {
        let ptr = 0;
        while (accept('*')) ptr++;
        const nt = next();
        next(); // (
        const params = parseParams();
        expect(')');
        if (accept(';')) { items.push({ k: 'proto', type, ptr, name: nt.v, params, line: nt.line, col: nt.col }); continue; }
        if (!is('{')) {
          const b = peek();
          if (b.t === 'id' && isTypeName(b)) err(b, `expected ';' before '${b.v}'`);
          err(b, `expected '{' ${before(b)}`, `A function's body goes in { } straight after its ( ).`);
        }
        const body = parseBlock();
        items.push({ k: 'func', type, ptr, name: nt.v, params, body, line: nt.line, col: nt.col, end: body.end });
        continue;
      }
      const decls = [];
      do { decls.push(parseDeclarator(type)); } while (accept(','));
      const after = peek();
      if (!is(';')) {
        if (after.t === 'op' && after.v === '(') err(after, `expected ',' or ';' ${before(after)}`);
        err(after, `expected ',' or ';' ${before(after)}`);
      }
      next();
      items.push({ k: 'decl', type, decls, line: t.line, col: t.col });
    }
    return items;
  }
  // after "name (": a parameter list (types, or empty) rather than constructor arguments
  function looksLikeFunction(k) {
    const t = peek(k);
    if (t.t === 'op' && t.v === ')') return true;
    if (t.t === 'id' && (TYPE_WORDS.has(t.v) || typedefs.has(t.v))) return true;
    if (t.t === 'id' && classNames.has(t.v) && peek(k + 1).t === 'id') return true;
    if (t.t === 'id' && !classNames.has(t.v) && peek(k + 1).t === 'id' && !is(',', k + 1)) return true; // unknown type name: report it there
    return false;
  }

  // ---- statements ----
  function parseBlock() {
    const open = expect('{');
    const body = [];
    while (!is('}')) {
      if (peek().t === 'eof') err(peek(), "expected '}' at end of input", `The { on line ${open.line} is never closed. Every { needs a } to close it.`);
      body.push(parseStmt());
    }
    const close = next();
    return { k: 'block', body, line: open.line, col: open.col, end: close.line };
  }
  function endStmt(what) {
    if (is(';')) { next(); return; }
    const t = peek();
    err(t, `expected ';' ${before(t)}`, what || 'Each instruction ends with a semicolon ;. The missing one is usually at the end of the line before this one.');
  }
  function parseDeclStmt() {
    const t = peek();
    enumDecls = [];
    const type = parseType();
    if (enumDecls.length) err(t, "an enum inside a function is not supported by the course's interpreter", 'Put the enum above setup(), outside every function.');
    const decls = [];
    if (is(';')) { next(); return { k: 'empty', line: t.line, col: t.col }; }
    do { decls.push(parseDeclarator(type)); } while (accept(','));
    const a = peek();
    if (!is(';')) {
      if (a.t === 'op' && a.v === '(') err(a, `a function-definition is not allowed here before '(' token`, 'A function cannot be made inside another function. Move it outside, above or below loop().');
      if (a.t === 'op' && a.v === '{') err(a, `a function-definition is not allowed here before '{' token`, 'A function cannot be made inside another function. Is a } missing above?');
      endStmt();
    } else next();
    return { k: 'decl', type, decls, line: t.line, col: t.col };
  }
  function parseStmt() {
    const t = peek();
    if (is('{')) return parseBlock();
    if (accept(';')) return { k: 'empty', line: t.line, col: t.col };
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': {
          next();
          expect('(');
          const c = parseExpr();
          expectClose(')');
          const a = parseStmt();
          let b = null;
          if (accept('else')) b = parseStmt();
          return { k: 'if', c, a, b, line: t.line, col: t.col };
        }
        case 'else': err(t, "'else' without a previous 'if'", 'An else must come straight after the } of an if. Is there a ; after the if ( … ), or an extra }?');
        // falls through (err throws)
        case 'while': {
          next();
          expect('(');
          const c = parseExpr();
          expectClose(')');
          const body = parseStmt();
          return { k: 'while', c, body, line: t.line, col: t.col };
        }
        case 'do': {
          next();
          const body = parseStmt();
          expect('while');
          expect('(');
          const c = parseExpr();
          expectClose(')');
          endStmt();
          return { k: 'do', c, body, line: t.line, col: t.col };
        }
        case 'for': {
          next();
          expect('(');
          let init = null;
          if (accept(';')) init = null;
          else if (startsType()) init = parseDeclStmt();
          else { init = { k: 'expr', e: parseExpr(), line: peek().line, col: peek().col }; endStmt("A for ( ) has three parts separated by semicolons: for (int i = 0; i < 10; i = i + 1)."); }
          let c = null;
          if (!is(';')) c = parseExpr();
          endStmt("A for ( ) has three parts separated by semicolons: for (int i = 0; i < 10; i = i + 1).");
          let u = null;
          if (!is(')')) u = parseExpr();
          expectClose(')');
          const body = parseStmt();
          return { k: 'for', init, c, u, body, line: t.line, col: t.col };
        }
        case 'switch': {
          next();
          expect('(');
          const e = parseExpr();
          expectClose(')');
          const body = parseStmt();
          return { k: 'switch', e, body, line: t.line, col: t.col };
        }
        case 'case': {
          next();
          const v = parseCond();
          expect(':', 'A case ends with a colon, like case 1:');
          return { k: 'case', v, line: t.line, col: t.col };
        }
        case 'default': next(); expect(':'); return { k: 'default', line: t.line, col: t.col };
        case 'break': next(); endStmt(); return { k: 'break', line: t.line, col: t.col };
        case 'continue': next(); endStmt(); return { k: 'continue', line: t.line, col: t.col };
        case 'return': {
          next();
          let e = null;
          if (!is(';')) e = parseExpr();
          endStmt();
          return { k: 'return', e, line: t.line, col: t.col };
        }
        case 'goto': err(t, "goto is not supported by the course's interpreter");
      }
      if (startsType()) return parseDeclStmt();
      // Unknown type name used to declare something: `Strng s;`
      const n = peek(1);
      if (n.t === 'id' && !['if', 'else'].includes(n.v) && (peek(2).t === 'op' && [';', '=', '(', '[', ','].includes(peek(2).v))) {
        err(t, `'${t.v}' was not declared in this scope`, null);
      }
    }
    const e = parseExpr();
    endStmt();
    return { k: 'expr', e, line: t.line, col: t.col };
  }
  function expectClose(v) {
    if (is(v)) return next();
    const t = peek();
    err(t, `expected '${v}' ${before(t)}`, v === ')' ? 'A ( is not closed. Every ( needs a ) to close it.' : undefined);
  }

  // ---- expressions ----
  function parseExpr() {
    let e = parseAssign();
    while (is(',')) { const t = next(); e = { k: 'comma', a: e, b: parseAssign(), line: t.line, col: t.col }; }
    return e;
  }
  const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  function parseAssign() {
    const a = parseCond();
    const t = peek();
    if (t.t === 'op' && ASSIGN.has(t.v)) {
      next();
      const b = parseAssign();
      return { k: 'asg', op: t.v, a, b, line: t.line, col: t.col };
    }
    return a;
  }
  function parseCond() {
    const c = parseBin(0);
    if (is('?')) {
      const t = next();
      const a = parseExpr();
      expect(':');
      const b = parseAssign();
      return { k: 'cond', c, a, b, line: t.line, col: t.col };
    }
    return c;
  }
  const BIN = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
  function parseBin(level) {
    if (level >= BIN.length) return parseUnary();
    let a = parseBin(level + 1);
    for (;;) {
      const t = peek();
      if (t.t === 'op' && BIN[level].includes(t.v)) {
        next();
        const b = parseBin(level + 1);
        a = { k: 'bin', op: t.v, a, b, line: t.line, col: t.col };
      } else return a;
    }
  }
  function castAhead() {
    // ( type [*]* )
    if (!is('(')) return false;
    const t = peek(1);
    if (!(t.t === 'id' && (TYPE_WORDS.has(t.v) || typedefs.has(t.v) || (classNames.has(t.v) && t.v !== 'Serial' && t.v !== 'Wire')))) return false;
    if (t.v === 'String' && is('(', 2)) return false;
    let k = 2;
    while (peek(k).t === 'id' && (TYPE_WORDS.has(peek(k).v))) k++;
    while (is('*', k)) k++;
    return is(')', k);
  }
  function parseUnary() {
    const t = peek();
    if (t.t === 'op') {
      if (t.v === '++' || t.v === '--') { next(); return { k: 'pre', op: t.v, a: parseUnary(), line: t.line, col: t.col }; }
      if (['-', '+', '!', '~', '&', '*'].includes(t.v)) { next(); return { k: 'un', op: t.v, a: parseUnary(), line: t.line, col: t.col }; }
      if (castAhead()) {
        next();
        const type = parseType();
        let ptr = 0;
        while (accept('*')) ptr++;
        expect(')');
        return { k: 'cast', type, ptr, a: parseUnary(), line: t.line, col: t.col };
      }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      next();
      if (is('(') && peek(1).t === 'id' && (TYPE_WORDS.has(peek(1).v) || typedefs.has(peek(1).v))) {
        next();
        const type = parseType();
        let ptr = 0;
        while (accept('*')) ptr++;
        expect(')');
        return { k: 'sizeof', type, ptr, line: t.line, col: t.col };
      }
      return { k: 'sizeof', a: parseUnary(), line: t.line, col: t.col };
    }
    return parsePostfix(parsePrimary());
  }
  function parsePostfix(e) {
    for (;;) {
      const t = peek();
      if (t.t !== 'op') return e;
      if (t.v === '(') {
        next();
        const args = [];
        if (!is(')')) { do { args.push(parseAssign()); } while (accept(',')); }
        expectClose(')');
        e = { k: 'call', f: e, args, line: t.line, col: t.col };
      } else if (t.v === '[') {
        next();
        const i = parseExpr();
        expect(']');
        e = { k: 'idx', a: e, i, line: t.line, col: t.col };
      } else if (t.v === '.' || t.v === '->') {
        next();
        const n = next();
        if (n.t !== 'id') err(n, `expected unqualified-id ${before(n)}`);
        e = { k: 'mem', a: e, name: n.v, arrow: t.v === '->', line: n.line, col: n.col };
      } else if (t.v === '++' || t.v === '--') {
        next();
        e = { k: 'post', op: t.v, a: e, line: t.line, col: t.col };
      } else return e;
    }
  }
  function parsePrimary() {
    const t = peek();
    if (t.t === 'num') { next(); return { k: 'num', text: t.text, line: t.line, col: t.col }; }
    if (t.t === 'chr') { next(); return { k: 'chr', v: t.v, multi: t.multi, line: t.line, col: t.col }; }
    if (t.t === 'str') {
      next();
      let bytes = t.v;
      while (peek().t === 'str') bytes = bytes.concat(next().v);
      return { k: 'str', v: bytes, line: t.line, col: t.col };
    }
    if (t.t === 'id') {
      if (TYPE_WORDS.has(t.v) && !QUALIFIERS.has(t.v)) {
        // a functional cast: int(x), float(x), String(x), unsigned long is not allowed this way
        next();
        if (!is('(')) err(peek(), `expected primary-expression ${before(t)}`);
        next();
        const args = [];
        if (!is(')')) { do { args.push(parseAssign()); } while (accept(',')); }
        expectClose(')');
        return { k: 'fcast', type: { words: [t.v], line: t.line, col: t.col }, args, line: t.line, col: t.col };
      }
      next();
      return { k: 'id', name: t.v, line: t.line, col: t.col };
    }
    if (t.t === 'op' && t.v === '(') {
      next();
      const e = parseExpr();
      expectClose(')');
      return { ...e, paren: true };
    }
    if (t.t === 'op' && t.v === '{') err(t, `expected primary-expression before '{' token`, 'A list in { } can only give an array its first values, where it is made: int pins[3] = {2, 3, 4};');
    err(t, `expected primary-expression ${before(t)}`);
  }

  const items = parseTop();
  return { items, typedefs };
}

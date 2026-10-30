// "Build it yourself": the course's wiring rules and the electrical check,
// with no three.js in it (so tools can test it in node).
//
// A learner's build is a list of items. Each item is one part from the tray
// (an LED, a resistor, a module's lead...) or one jumper wire, with an end
// for every leg:
//   'f5'           a breadboard hole
//   'r:-top:7'     a rail hole: the rail, then its column
//   'S:dig:9'      an Arduino socket: its header and its place in it
//                  (builds.json's pins.dig / pins.pwr name it)
//
// check() runs, in this order:
//   1. the generator's guards, as tools/bbdraw.py runs them on every diagram:
//      two legs in one hole (HOLE COLLISION), two wires in one Arduino socket
//      (SOCKET COLLISION), 5V, 3V3 or VIN into a − rail and GND into a + rail
//      (POLARITY), a link joining a + rail to a − rail (LINK POLARITY), a
//      battery the wrong way round, and a rail that something uses but
//      nothing feeds (DEAD RAIL), with the "fed from the wrong half" case
//      named, because the top and bottom rail pairs are separate strips
//   2. nothing shorting 5V (or the battery) to GND
//   3. the electrical check: the learner's netlist (which part legs and
//      Arduino pins are joined, through columns, rails and wires) against the
//      build's own. Holes do not have to match, only what is joined to what,
//      so any equivalent placement passes. Parts that are the same (two 220 Ω
//      resistors, four buttons) may swap places. When it does not match, the
//      common faults are named: an LED or buzzer the wrong way round, both legs
//      of a part in one column, a resistor that is not in series, and then
//      "these should be joined" / "these should not be".
//
// One difference from bbdraw: bbdraw counts a rail as fed only by a power
// wire from the Arduino, a battery or a link. Here a rail is fed when it is
// electrically joined to GND, 5V, 3V3, VIN or a battery, so feeding it through
// a column (Arduino GND to a hole, that column to the rail) counts too.

export const RAILS = ['+top', '-top', '-bot', '+bot'];
const HOLE = /^([a-j])(\d{1,2})$/;
const POWER = new Set(['5V', '3V3', 'VIN']);

export const parseHole = (h) => { const m = HOLE.exec(h); return m && { row: m[1], col: +m[2] }; };
export const isHole = (e) => typeof e === 'string' && HOLE.test(e);
export const isRail = (e) => typeof e === 'string' && e.startsWith('r:');
export const isSock = (e) => typeof e === 'string' && e.startsWith('S:');
export const topHalf = (h) => 'fghij'.includes(parseHole(h).row);
export const railOf = (e) => e.split(':')[1];
export const railCol = (e) => +e.split(':')[2];
export const railEnd = (rail, col) => `r:${rail}:${col}`;
export const sockEnd = (s) => `S:${s.hdr}:${s.i}`;
export function sockOf(e, pins) {
  const [, hdr, i] = e.split(':');
  return { hdr, i: +i, name: pins[hdr][+i] };
}
export const railWords = (r) => `the ${r.endsWith('top') ? 'top' : 'bottom'} ${r[0] === '+' ? '+' : '−'} rail`;
const colWords = (col, top) => `column ${col} (rows ${top ? 'f to j' : 'a to e'})`;
const pinWords = (name) => (name === 'GND' ? 'a GND socket' : /^\d+$/.test(name) ? `pin ${name}` : `the ${name} socket`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (s) => `<code>${esc(s)}</code>`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The electrical node an end sits on.
export function nodeOf(e, pins) {
  if (isHole(e)) { const p = parseHole(e); return (topHalf(e) ? 'T' : 'B') + p.col; }
  if (isRail(e)) return railOf(e);
  if (isSock(e)) { const s = sockOf(e, pins); return s.name === 'GND' ? 'GND' : 'P:' + s.name; }
  return null;
}
// Where an end is, in words.
export function endWords(e, pins) {
  if (isHole(e)) return 'hole ' + code(e);
  if (isRail(e)) return `${railWords(railOf(e))} (column ${railCol(e)})`;
  if (isSock(e)) return 'the Arduino’s ' + pinWords(sockOf(e, pins).name).replace(/^the /, '') + ' socket';
  return 'nowhere yet';
}
function nodeWords(n) {
  if (RAILS.includes(n)) return railWords(n);
  if (n === 'GND') return 'the Arduino’s GND';
  if (n.startsWith('P:')) return 'Arduino ' + pinWords(n.slice(2)).replace(/^the /, '').replace(/ socket$/, '');
  return colWords(+n.slice(1), n[0] === 'T');
}

// ---------- part names ----------
export function pinNamesOf(label, n) {
  if (/^LCD1602, bare/.test(label)) return ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'].slice(0, n);
  let rest = null;
  if (label.includes(':')) rest = label.split(':')[1];
  else if (label.includes('  ')) rest = label.split('  ')[1];
  if (rest) {
    const names = rest.split('/').map((s) => s.trim());
    if (names.length === n) return names;
  }
  if (/^HC-SR04/.test(label) && n === 4) return ['VCC', 'Trig', 'Echo', 'GND'];
  return Array.from({ length: n }, (_, i) => 'pin ' + (i + 1));
}
const shortLabel = (label) => label.split(/ {2}|:|,/)[0].trim();
export function ohmWords(v) {
  const m = String(v).trim().match(/^([\d.]+)\s*([kKmM]?)/);
  if (!m) return v + ' Ω';
  return m[2] ? `${m[1]}${m[2].toLowerCase() === 'k' ? 'k' : 'M'} Ω` : `${m[1]} Ω`;
}

// ---------- the tray: the build's parts, each to be placed ----------
// legs: [{ name, accept }] where accept is 'hole', 'rail', 'sock' or 'rs' (a rail or a socket).
// shape: 'free' (each leg anywhere), 'row' (legs in neighbouring columns of one row),
// 'button' (four legs across the middle channel).
export function trayOf(b) {
  const out = [];
  b.parts.forEach((p, i) => {
    const t = { id: 't' + i, src: i, sub: null, type: p.type, label: p.label || '', value: p.value || '', colour: p.colour || '' };
    const H = (name) => ({ name, accept: 'hole' });
    switch (p.type) {
      case 'led':
        out.push({ ...t, title: `${p.colour || 'red'} LED${p.label ? ' ' + p.label : ''}`, legs: [H('long leg (+)'), H('short leg (−)')], shape: 'free', polar: true, lab: ['a', 'k'] });
        break;
      case 'res':
        out.push({ ...t, title: `${ohmWords(p.value)} resistor`, legs: [H('one leg'), H('other leg')], shape: 'free', lab: ['s', 's'] });
        break;
      case 'buz':
        out.push({ ...t, title: 'buzzer', legs: [H('long leg (+)'), H('short leg (−)')], shape: 'free', polar: true, lab: ['p', 'm'] });
        break;
      case 'pot':
        out.push({ ...t, title: p.label === 'knob' ? 'knob (potentiometer)' : `${p.label} knob (potentiometer)`, legs: [H('outer leg'), H('middle leg'), H('other outer leg')], shape: 'row', lab: ['o', 'm', 'o'] });
        break;
      case 'npn':
        out.push({ ...t, title: 'transistor', legs: [H('emitter (E)'), H('base (B)'), H('collector (C)')], shape: 'row', lab: ['e', 'b', 'c'] });
        break;
      case 'btn':
        out.push({ ...t, title: 'push button', legs: p.holes.map(() => H('leg')), shape: 'button', lab: p.holes.map(() => 's') });
        break;
      case 'blk': {
        if (/^light sensor/.test(p.label)) {
          out.push({ ...t, title: 'light sensor', legs: [H('one leg'), H('other leg')], shape: 'free', lab: ['s', 's'] });
        } else if (/^motor/.test(p.label)) {
          out.push({ ...t, title: 'motor and its diode', legs: [H('motor wire'), H('diode, plain end'), { name: 'motor wire and diode stripe', accept: 'rail' }], shape: 'free', lab: ['0', '1', '2'] });
        } else {
          const names = pinNamesOf(p.label, p.holes.length);
          const rails = (p.rails || []).map((r, k) => ({ name: 'rail lead ' + (k + 1), accept: 'rail' }));
          const title = /^RGB LED/.test(p.label) ? 'RGB LED' : shortLabel(p.label);
          out.push({ ...t, title, legs: [...names.map((n) => H(/^pin \d/.test(n) ? n : n + (/^RGB/.test(p.label) ? ' leg' : ' pin'))), ...rails], shape: rails.length ? 'free' : 'row', rowLegs: names.length, lab: [...names.map((_, k) => String(k)), ...rails.map((_, k) => 'r' + k)] });
        }
        break;
      }
      case 'mod':
        p.pins.forEach((q, k) => {
          if (!q.to) return;
          out.push({ ...t, id: `t${i}.${k}`, sub: k, title: `${shortLabel(p.label)}: ${q.name} lead`, legs: [{ name: `${q.name} lead`, accept: 'rs' }], shape: 'free', lab: [String(k)], lead: true, pin: q.name, modLabel: p.label });
        });
        break;
      case 'batt':
        out.push({ ...t, id: `t${i}.0`, sub: 0, title: 'battery pack: red (+) lead', legs: [{ name: 'red (+) lead', accept: 'rail' }], shape: 'free', lab: ['0'], lead: true, battery: '+' });
        out.push({ ...t, id: `t${i}.1`, sub: 1, title: 'battery pack: black (−) lead', legs: [{ name: 'black (−) lead', accept: 'rail' }], shape: 'free', lab: ['1'], lead: true, battery: '-' });
        break;
      default:
        break; // wires, power feeds and links are the learner's own wires
    }
  });
  // parts that are the same may swap places
  const key = (t) => (['led', 'res', 'btn', 'pot', 'buz'].includes(t.type) ? `${t.type}|${t.value}|${t.colour}|${t.label}` : null);
  const groups = new Map();
  for (const t of out) { const k = key(t); if (k) (groups.get(k) ?? groups.set(k, []).get(k)).push(t.src); }
  out.groups = [...groups.values()].filter((g) => g.length > 1);
  return out;
}
export const wireCount = (b) => b.parts.filter((p) => ['wire', 'power', 'link'].includes(p.type)).length;

// The holes a rigid part takes, given the hole of its first leg.
export function rigidHoles(tray, anchor, flip, b) {
  const p = parseHole(anchor);
  if (!p) return null;
  if (tray.shape === 'button') {
    const c = flip ? p.col - 2 : p.col;
    if (c < b.c0 || c + 2 > b.c1) return null;
    return [`f${c}`, `f${c + 2}`, `e${c}`, `e${c + 2}`];
  }
  const n = tray.rowLegs ?? tray.legs.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = p.col + (flip ? -k : k);
    if (c < b.c0 || c > b.c1) return null;
    out.push(p.row + c);
  }
  return out;
}

// ---------- a build's own wiring, as items ----------
// railColOf(partIndex, k) gives the rail column the 3D view uses for that end, if known.
export function itemsFromBuild(b, railColOf = () => null) {
  const used = Object.fromEntries(RAILS.map((r) => [r, new Set()]));
  const take = (rail, i, k, from = b.c0) => {
    let c = railColOf(i, k);
    if (c == null) { c = from; while (used[rail].has(c) && c <= b.c1) c++; }
    used[rail].add(c);
    return railEnd(rail, c);
  };
  const S = (s) => sockEnd(s);
  const items = [];
  b.parts.forEach((p, i) => {
    const T = 't' + i;
    switch (p.type) {
      case 'led': items.push({ id: 'g' + i, tray: T, ends: [p.anode, p.cathode] }); break;
      case 'res': items.push({ id: 'g' + i, tray: T, ends: [p.a, p.b] }); break;
      case 'buz': items.push({ id: 'g' + i, tray: T, ends: [p.plus, p.minus] }); break;
      case 'pot': case 'btn': items.push({ id: 'g' + i, tray: T, ends: [...p.holes] }); break;
      case 'npn': items.push({ id: 'g' + i, tray: T, ends: [p.e, p.b, p.c] }); break;
      case 'blk': items.push({ id: 'g' + i, tray: T, ends: [...p.holes, ...(p.rails || []).map((r, k) => take(r.rail, i, k, parseHole(p.holes[0]).col))] }); break;
      case 'wire': {
        const b2 = p.to === 'hole' ? p.b : p.to === 'rail' ? take(p.b, i, 1, parseHole(p.a).col) : S(p.socket);
        items.push({ id: 'g' + i, tray: null, ends: [p.a, b2], colour: p.colour });
        break;
      }
      case 'power': items.push({ id: 'g' + i, tray: null, ends: [S(p.socket), take(p.rail, i, 1)], colour: p.colour }); break;
      case 'link': items.push({ id: 'g' + i, tray: null, ends: [take(p.a, i, 0), take(p.b, i, 1)], colour: p.colour }); break;
      case 'mod': p.pins.forEach((q, k) => { if (q.to) items.push({ id: `g${i}.${k}`, tray: `${T}.${k}`, ends: [q.to === 'rail' ? take(q.rail, i, k) : S(q.socket)] }); }); break;
      case 'batt': items.push({ id: `g${i}.0`, tray: `${T}.0`, ends: [take(p.plus, i, 0, b.c1 - 3)] }, { id: `g${i}.1`, tray: `${T}.1`, ends: [take(p.minus, i, 1, b.c1 - 3)] }); break;
      default: break;
    }
  });
  return items;
}

// ---------- items back to a build (for running the sketch on the learner's wiring) ----------
export function buildFromItems(b, items, pins, { title } = {}) {
  const tray = trayOf(b);
  const byId = Object.fromEntries(tray.map((t) => [t.id, t]));
  const of = (id) => items.find((it) => it.tray === id && it.ends.every(Boolean));
  const parts = [];
  b.parts.forEach((p, i) => {
    const it = of('t' + i);
    switch (p.type) {
      case 'led': if (it) parts.push({ ...p, anode: it.ends[0], cathode: it.ends[1] }); break;
      case 'res': if (it) parts.push({ ...p, a: it.ends[0], b: it.ends[1] }); break;
      case 'buz': if (it) parts.push({ ...p, plus: it.ends[0], minus: it.ends[1] }); break;
      case 'pot': case 'btn': if (it) parts.push({ ...p, holes: [...it.ends] }); break;
      case 'npn': if (it) parts.push({ ...p, e: it.ends[0], b: it.ends[1], c: it.ends[2] }); break;
      case 'blk': if (it) {
        const n = p.holes.length;
        parts.push({ ...p, holes: it.ends.slice(0, n), rails: (p.rails || []).map((r, k) => ({ ...r, rail: railOf(it.ends[n + k]), col: railCol(it.ends[n + k]) })) });
      } break;
      case 'mod': parts.push({ ...p, pins: p.pins.map((q, k) => {
        const l = of(`t${i}.${k}`);
        if (!q.to || !l) return { name: q.name, to: null };
        const e = l.ends[0];
        return isRail(e) ? { name: q.name, to: 'rail', rail: railOf(e), col: railCol(e), colour: q.colour } : { name: q.name, to: 'socket', socket: sockOf(e, pins), colour: q.colour };
      }) }); break;
      case 'batt': {
        const a = of(`t${i}.0`), c = of(`t${i}.1`);
        if (a && c) parts.push({ ...p, plus: railOf(a.ends[0]), minus: railOf(c.ends[0]), cols: [railCol(a.ends[0]), railCol(c.ends[0])] });
        break;
      }
      default: break;
    }
  });
  void byId;
  for (const it of items) {
    if (it.tray || !it.ends.every(Boolean)) continue;
    let [x, y] = it.ends;
    const kind = (e) => (isHole(e) ? 'h' : isRail(e) ? 'r' : 's');
    const order = { h: 0, s: 1, r: 2 };
    if (order[kind(x)] > order[kind(y)]) [x, y] = [y, x];
    const kx = kind(x), ky = kind(y);
    const colour = it.colour && it.colour !== 'auto' ? it.colour : autoColour(it.ends, pins);
    if (kx === 'h' && ky === 'h') parts.push({ type: 'wire', a: x, b: y, to: 'hole', colour, label: '', socket: null });
    else if (kx === 'h' && ky === 'r') parts.push({ type: 'wire', a: x, b: railOf(y), to: 'rail', col: railCol(y), colour, label: '', socket: null });
    else if (kx === 'h' && ky === 's') { const s = sockOf(y, pins); parts.push({ type: 'wire', a: x, b: s.name, to: 'socket', colour, label: '', socket: s }); }
    else if (kx === 's' && ky === 'r') parts.push({ type: 'power', socket: sockOf(x, pins), rail: railOf(y), col: railCol(y), colour, label: '' });
    else if (kx === 'r' && ky === 'r') parts.push({ type: 'link', a: railOf(x), b: railOf(y), colA: railCol(x), colB: railCol(y), colour, label: '' });
    // socket to socket: not a build (check() says so)
  }
  const nets = netsOf(items, tray, pins);
  return { c0: b.c0, c1: b.c1, title: title ?? b.title, uno: b.uno, fed: RAILS.filter((r) => nets.fed(r)), parts, mine: true };
}

// A wire's colour as the course draws it: red to a + rail, blue to a − rail or GND, green to a pin.
export function autoColour(ends, pins) {
  const rail = ends.find((e) => isRail(e));
  const sock = ends.find((e) => isSock(e));
  if (rail) return railOf(rail)[0] === '+' ? '#C8452F' : '#3D6FA8';
  if (sock) { const n = sockOf(sock, pins).name; return n === 'GND' ? '#3D6FA8' : POWER.has(n) ? '#C8452F' : '#2E7D46'; }
  return 'ink';
}

// ---------- nets ----------
// Union-find over the nodes; every leg of every part is a terminal with a label.
// Labels: '<part>.<leg>' with legs that are the same (a resistor's two legs) sharing one.
export function netsOf(items, tray, pins, map = null) {
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); let y = x; while (parent.get(y) !== r) { const n = parent.get(y); parent.set(y, r); y = n; } return r; };
  const unite = (a, c) => { const ra = find(a), rc = find(c); if (ra !== rc) parent.set(ra, rc); };
  const byId = Object.fromEntries(tray.map((t) => [t.id, t]));
  const terms = [];
  for (const it of items) {
    if (!it.ends.every(Boolean)) continue;
    const t = it.tray ? byId[it.tray] : null;
    if (!t) { // a wire
      const [a, c] = it.ends.map((e) => nodeOf(e, pins));
      unite(a, c);
      continue;
    }
    const src = map ? map.get(t.src) ?? t.src : t.src;
    it.ends.forEach((e, k) => {
      const node = nodeOf(e, pins);
      find(node);
      const leg = t.lead ? t.lab[0] : t.lab[k];
      terms.push({ label: `${src}.${leg}`, node, end: e, item: it, tray: t, leg: k, src });
    });
    if (t.shape === 'button') {
      // the legs on one side are one piece of metal (as the 3D view's sim joins them)
      const byCol = new Map();
      it.ends.forEach((e) => { const c = parseHole(e)?.col; if (c != null) (byCol.get(c) ?? byCol.set(c, []).get(c)).push(nodeOf(e, pins)); });
      for (const g of byCol.values()) for (let k = 1; k < g.length; k++) unite(g[0], g[k]);
    }
  }
  const sources = (root) => {
    const s = new Set();
    for (const n of parent.keys()) if (find(n) === root && (n === 'GND' || (n.startsWith('P:') && POWER.has(n.slice(2))))) s.add(n === 'GND' ? 'GND' : n.slice(2));
    for (const t of terms) if (t.tray.battery && find(t.node) === root) s.add(t.tray.battery === '+' ? 'BATT+' : 'BATT-');
    return s;
  };
  return {
    find, terms, parent,
    nodes: () => [...parent.keys()],
    sources,
    fed: (rail) => parent.has(rail) && sources(find(rail)).size > 0,
  };
}

// The nets as text, for comparing: one line per net, its labels sorted.
function canon(N, ard) {
  const by = new Map();
  const add = (root, lab) => (by.get(root) ?? by.set(root, []).get(root)).push(lab);
  for (const t of N.terms) add(N.find(t.node), t.label);
  for (const a of ard) add(N.find(a), a);
  return [...by.values()].map((l) => l.sort().join(' ')).sort();
}
function diffCount(A, B) {
  const m = new Map();
  for (const x of A) m.set(x, (m.get(x) || 0) + 1);
  let d = 0;
  for (const x of B) { const v = m.get(x) || 0; if (v) m.set(x, v - 1); else d++; }
  for (const v of m.values()) d += v;
  return d;
}

// ---------- the check ----------
// b: the build (builds.json shape), items: the learner's, pins: builds.json pins.
// names: optional { [partIndex]: title } (the 3D view's part titles).
export function check(b, items, pins, { names = {}, target = null } = {}) {
  const tray = trayOf(b);
  const byId = Object.fromEntries(tray.map((t) => [t.id, t]));
  const titleOf = (t) => names[t.src] && !t.lead ? names[t.src] : t.title;
  const the = (t) => {
    const s = titleOf(t);
    return /^(the |a )/i.test(s) ? s : 'the ' + s.replace(/^[A-Z](?=[a-z])/, (m) => m.toLowerCase());
  };
  const legName = (t, k) => (t.lead ? the(t) : `${the(t)}’s ${t.legs[k].name}`);
  const placed = items.filter((it) => it.ends.every(Boolean));
  const problems = [];
  const P = (sev, kind, text, ends = []) => problems.push({ sev, kind, text, ends: ends.filter(Boolean) });

  // 0. the parts still in the tray
  const missing = tray.filter((t) => !placed.some((it) => it.tray === t.id));
  for (const t of missing.slice(0, 3)) P('missing', 'missing', `${cap(the(t))} is still in the tray. Place it, then check again.`);
  if (missing.length > 3) P('missing', 'missing', `${missing.length - 3} more ${missing.length - 3 === 1 ? 'part is' : 'parts are'} still in the tray.`);

  // who is in each hole and socket
  const at = new Map();
  for (const it of placed) {
    const t = it.tray ? byId[it.tray] : null;
    it.ends.forEach((e, k) => {
      const who = t ? legName(t, t.lead ? 0 : k) : `a wire end (${it.ends.map((x) => shortEnd(x, pins)).join(' to ')})`;
      (at.get(e) ?? at.set(e, []).get(e)).push(who);
    });
  }
  // 1a. HOLE COLLISION and SOCKET COLLISION
  for (const [e, who] of at) {
    if (who.length < 2) continue;
    const list = who.slice(0, 2).join(' and ') + (who.length > 2 ? ` (and ${who.length - 2} more)` : '');
    if (isHole(e)) {
      const p = parseHole(e);
      const five = (topHalf(e) ? 'fghij' : 'abcde').split('').map((r) => r + p.col).filter((h) => h !== e && !at.has(h));
      P('rule', 'hole', `<b>Two things in hole ${code(e)}:</b> ${list}. A hole holds one leg only, so one of them would not really be in. Move one to another hole in column ${p.col}${five.length ? `, such as ${code(five[0])}` : ''}: the five holes of a column are joined underneath, so it is still connected.`, [e]);
    } else if (isRail(e)) {
      P('rule', 'hole', `<b>Two things in one hole of ${railWords(railOf(e))}</b> (column ${railCol(e)}): ${list}. A hole holds one leg only. Move one along the rail: every hole of a rail is joined.`, [e]);
    } else {
      const s = sockOf(e, pins);
      P('rule', 'socket', `<b>Two wires in one Arduino socket</b> (${pinWords(s.name).replace(/^the /, '')}): ${list}. One Arduino socket takes one wire. ${s.name === 'GND' ? 'The Uno has three GND sockets: use another one.' : 'Join them on the breadboard instead, and run one wire to the Arduino.'}`, [e]);
    }
  }
  // 1b. POLARITY (a feed wire), LINK POLARITY, the battery, socket to socket
  for (const it of placed) {
    const t = it.tray ? byId[it.tray] : null;
    if (t?.battery) {
      const r = railOf(it.ends[0]);
      if (r[0] !== t.battery) P('rule', 'polarity', `<b>The battery’s ${t.battery === '+' ? 'red (+)' : 'black (−)'} lead is in ${railWords(r)}.</b> The red lead goes to a + rail and the black lead to a − rail. The other way round, everything on the board gets power backwards.`, [it.ends[0]]);
      continue;
    }
    if (t) continue;
    const socks = it.ends.filter(isSock), rails = it.ends.filter(isRail);
    if (socks.length === 2) {
      P('rule', 'sockets', `<b>A wire goes from one Arduino socket straight to another</b> (${socks.map((e) => pinWords(sockOf(e, pins).name).replace(/^the /, '')).join(' and ')}). This build never does that. Put one end in the breadboard instead.`, socks);
    } else if (socks.length === 1 && rails.length === 1) {
      const s = sockOf(socks[0], pins).name, r = railOf(rails[0]);
      if (POWER.has(s) && r[0] === '-') P('rule', 'polarity', `<b>The wire from ${s} goes into ${railWords(r)}.</b> A − rail is for GND: it is the way back. ${s} belongs in a + rail. Move this wire’s rail end to a + rail, or move it to a GND socket if this rail should be ground.`, [...socks, ...rails]);
      if (s === 'GND' && r[0] === '+') P('rule', 'polarity', `<b>The wire from GND goes into ${railWords(r)}.</b> A + rail carries power. GND belongs in a − rail. Move this wire’s rail end to the − rail next to it.`, [...socks, ...rails]);
    } else if (rails.length === 2 && railOf(rails[0])[0] !== railOf(rails[1])[0]) {
      P('rule', 'polarity', `<b>A wire joins ${railWords(railOf(rails[0]))} to ${railWords(railOf(rails[1]))}.</b> A link joins two + rails or two − rails, never a + to a −: that joins power straight to ground.`, rails);
    }
  }
  const tray0 = tray;
  const N = netsOf(placed, tray0, pins);
  // 1c. DEAD RAIL (and fed from the wrong half)
  const usedRails = new Set();
  for (const it of placed) {
    const t = it.tray ? byId[it.tray] : null;
    if (t?.battery) continue;
    const rails = it.ends.filter(isRail);
    if (!t && it.ends.some(isSock) && rails.length) continue; // a feed wire feeds, it does not use
    if (!t && rails.length === 2) continue; // a link
    rails.forEach((e) => usedRails.add(railOf(e)));
  }
  for (const r of RAILS) {
    if (!usedRails.has(r) || N.fed(r)) continue;
    const users = placed.filter((it) => it.ends.some((e) => isRail(e) && railOf(e) === r)).flatMap((it) => it.ends.filter((e) => isRail(e) && railOf(e) === r));
    const other = (r.endsWith('top') ? r.replace('top', 'bot') : r.replace('bot', 'top'));
    const feed = r[0] === '+' ? 'a 5V socket' : 'a GND socket';
    if (N.fed(other)) {
      P('rule', 'half', `<b>${cap(railWords(r))} is not fed.</b> Your ${r[0] === '+' ? '5V' : 'GND'} wire feeds ${railWords(other)}, but the top and bottom rail pairs are separate strips, so this one is still dead metal. Feed this rail too (a wire from ${feed} to it), or move the wires that use it to ${railWords(other)}.`, users);
    } else {
      P('rule', 'dead', `<b>Nothing feeds ${railWords(r)}.</b> Something is wired to it, but a rail is dead metal until a wire joins it to the Arduino. Add a wire from ${feed} to this rail.`, users);
    }
  }
  // 1d. a rail carrying the wrong thing (fed through a column, say)
  const flagged = new Set(problems.filter((p) => p.kind === 'polarity').flatMap((p) => p.ends.filter(isRail).map(railOf)));
  for (const r of RAILS) {
    if (!N.parent.has(r) || flagged.has(r)) continue;
    const s = N.sources(N.find(r));
    if (r[0] === '-' && [...s].some((x) => POWER.has(x) || x === 'BATT+') && !s.has('GND') && !s.has('BATT-')) P('rule', 'polarity', `<b>${cap(railWords(r))} carries ${[...s].find((x) => POWER.has(x)) || 'the battery’s +'}.</b> A − rail is for GND, the way back. Look at what joins it to power.`, railHoles(placed, r));
    if (r[0] === '+' && (s.has('GND') || s.has('BATT-')) && ![...s].some((x) => POWER.has(x) || x === 'BATT+')) P('rule', 'polarity', `<b>${cap(railWords(r))} is joined to GND.</b> A + rail carries power. Look at what joins it to ground.`, railHoles(placed, r));
  }
  // 2. shorts
  const seenShort = new Set();
  for (const n of N.nodes()) {
    const root = N.find(n);
    if (seenShort.has(root)) continue;
    seenShort.add(root);
    const s = N.sources(root);
    const pw = [...s].filter((x) => POWER.has(x));
    const where = netEnds(placed, N, root, pins);
    if ((pw.length && s.has('GND')) || (s.has('BATT+') && (s.has('GND') || s.has('BATT-')))) {
      P('short', 'short', `<b>A short circuit:</b> ${pw.length ? pw.join(' and ') : 'the battery’s +'} is joined straight to ${s.has('GND') ? 'GND' : 'the battery’s −'}, with no part in between. On a real board that makes the Arduino or the battery hot, and can damage it. Find the wire or leg that joins them${where.length ? ` (look at ${where.slice(0, 3).map((e) => shortEnd(e, pins)).join(', ')})` : ''} and move it.`, where);
    } else if (s.has('BATT+') && pw.includes('5V')) {
      P('short', 'short', '<b>The battery’s + is joined to the Arduino’s 5V.</b> They must never meet: the battery would push its 6 V back into the Arduino. Only the grounds are shared.', where);
    }
  }

  // 3. the netlist
  const T = target ?? itemsFromBuild(b);
  const TN = netsOf(T, tray, pins);
  const ard = new Set();
  for (const n of [...TN.nodes(), ...N.nodes()]) if (n === 'GND' || n.startsWith('P:')) ard.add(n);
  const tc = canon(TN, ard);
  const groups = tray.groups || [];
  let best = null;
  const score = (map) => diffCount(tc, canon(netsOf(placed, tray, pins, map), ard));
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [x, ...r])));
  const total = groups.reduce((n, g) => n * fact(g.length), 1);
  {
    if (total <= 2000) {
      const lists = groups.map((g) => perms(g));
      const idx = groups.map(() => 0);
      for (;;) {
        const map = new Map();
        groups.forEach((g, gi) => g.forEach((s, k) => map.set(s, lists[gi][idx[gi]][k])));
        const sc = score(map);
        if (!best || sc < best.sc) best = { map, sc };
        if (sc === 0) break;
        let gi = 0;
        while (gi < groups.length && ++idx[gi] >= lists[gi].length) { idx[gi] = 0; gi++; }
        if (gi >= groups.length) break;
      }
    } else {
      // too many to try them all: swap pairs while it helps
      const map = new Map();
      groups.forEach((g) => g.forEach((s) => map.set(s, s)));
      best = { map, sc: score(map) };
      let better = true;
      while (better && best.sc > 0) {
        better = false;
        for (const g of groups) for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) {
          const m = new Map(best.map);
          const a = m.get(g[x]); m.set(g[x], m.get(g[y])); m.set(g[y], a);
          const sc = score(m);
          if (sc < best.sc) { best = { map: m, sc }; better = true; }
        }
      }
    }
  }
  const match = best ? best.sc === 0 : canonEq(tc, canon(N, ard));
  if (!match && !missing.length && !problems.some((p) => p.sev === 'rule')) diagnose(P, b, tray, placed, T, pins, best?.map ?? null, ard, legName, the);

  const order = { missing: 0, rule: 1, short: 2, wiring: 3 };
  problems.sort((x, y) => order[x.sev] - order[y.sev]);
  return {
    ok: !problems.length,
    runnable: !problems.some((p) => p.sev === 'rule' || p.sev === 'short'),
    matches: match && !missing.length,
    problems,
    fed: RAILS.filter((r) => N.fed(r)),
  };
}
const canonEq = (a, c) => diffCount(a, c) === 0;
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
function railHoles(items, r) { return items.flatMap((it) => it.ends.filter((e) => isRail(e) && railOf(e) === r)); }
function netEnds(items, N, root, pins) { return items.flatMap((it) => it.ends.filter((e) => N.find(nodeOf(e, pins)) === root)); }
export function shortEnd(e, pins) {
  if (isHole(e)) return e;
  if (isRail(e)) return `${railOf(e)[0] === '+' ? '+' : '−'} rail (${railOf(e).endsWith('top') ? 'top' : 'bottom'})`;
  const n = sockOf(e, pins).name;
  return /^\d+$/.test(n) ? 'pin ' + n : n;
}

// What is wrong, in words: the faults beginners make, then anything else.
function diagnose(P, b, tray, items, target, pins, map, ard, legName, the) {
  const L = netsOf(items, tray, pins, map);
  const T = netsOf(target, tray, pins);
  // label -> the nets it is on (a resistor's two legs share a label, so up to two)
  const netsBy = (N) => {
    const m = new Map();
    for (const t of N.terms) (m.get(t.label) ?? m.set(t.label, []).get(t.label)).push(N.find(t.node));
    for (const a of ard) (m.get(a) ?? m.set(a, []).get(a)).push(N.find(a));
    return m;
  };
  const labelsIn = (N, root) => {
    const out = N.terms.filter((t) => N.find(t.node) === root).map((t) => t.label);
    for (const a of ard) if (N.find(a) === root) out.push(a);
    return out;
  };
  const termsOfSrc = (N, src) => N.terms.filter((t) => t.src === src);
  const said = new Set(); // labels already explained
  let n = 0;
  const add = (text, ends, labels) => { if (n >= 4) return; n++; P('wiring', 'wiring', text, ends); labels.forEach((l) => said.add(l)); };
  const where = (t) => (isHole(t.end) ? code(t.end) : shortEnd(t.end, pins));
  const lmeet = (x, y) => L.find(x.node) === L.find(y.node);
  const tmeet = (x, y) => T.find(x.node) === T.find(y.node);
  const others = (N, root, src) => labelsIn(N, root).filter((l) => !l.startsWith(src + '.'));
  const overlap = (A, B) => { const m = new Map(); A.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); let k = 0; B.forEach((x) => { if (m.get(x)) { k++; m.set(x, m.get(x) - 1); } }); return k; };

  for (const t of tray) {
    if (t.lead) continue;
    // (with `map`, a learner's part carries the number of the build's part it stands for)
    const lt = termsOfSrc(L, t.src);
    const tt = termsOfSrc(T, t.src);
    if (lt.length !== tt.length || lt.length < 2) continue;
    const src = String(t.src);
    // both legs of a two-legged part joined
    if (lt.length === 2 && lmeet(lt[0], lt[1]) && !tmeet(tt[0], tt[1])) {
      const same = isHole(lt[0].end) && isHole(lt[1].end) && nodeOf(lt[0].end, pins) === nodeOf(lt[1].end, pins);
      add(`<b>Both legs of ${the(t)} are joined to each other</b>${same ? `: ${where(lt[0])} and ${where(lt[1])} are in the same column, and the five holes of a column are joined underneath` : ', through the wires and columns between them'}. The current goes round it instead of through it${t.type === 'led' ? ', so it never lights' : ''}. Move one leg to a column of its own.`, [lt[0].end, lt[1].end], [lt[0].label, lt[1].label]);
      continue;
    }
    // an LED or buzzer the wrong way round
    if (t.polar && lt.length === 2) {
      const la = others(L, L.find(lt[0].node), src), lk = others(L, L.find(lt[1].node), src);
      const ta = others(T, T.find(tt[0].node), String(t.src)), tk = others(T, T.find(tt[1].node), String(t.src));
      const straight = overlap(la, ta) + overlap(lk, tk);
      const crossed = overlap(la, tk) + overlap(lk, ta);
      if (crossed > straight && crossed >= 2) {
        add(`<b>${cap(the(t))} is in backwards.</b> Its long leg (+) is in ${where(lt[0])}, where the short leg (−) should be, and its short leg is in ${where(lt[1])}. Current only goes through it one way: in at the long leg, out at the short leg. Turn it round (the <b>Flip</b> button), so the long leg is on the side of ${t.type === 'led' ? 'the pin and the resistor' : 'the pin'}.`, [lt[0].end, lt[1].end], [lt[0].label, lt[1].label]);
        continue;
      }
    }
  }
  // a resistor that is not in series: what it should sit between is joined straight across
  for (const t of tray) {
    if (t.type !== 'res') continue;
    const tt = termsOfSrc(T, t.src);
    if (tt.length !== 2 || tmeet(tt[0], tt[1])) continue;
    const A = others(T, T.find(tt[0].node), String(t.src)), B = others(T, T.find(tt[1].node), String(t.src));
    const Lm = netsBy(L);
    let hit = null;
    for (const x of A) for (const y of B) {
      const nx = Lm.get(x) || [], ny = Lm.get(y) || [];
      if (nx.some((r) => ny.includes(r))) { hit = [x, y]; break; }
    }
    if (!hit || said.has(hit[0]) && said.has(hit[1])) continue;
    const nm = (lab) => labelWords(lab, L, tray, legName, map);
    const ends = L.terms.filter((q) => q.label === hit[0] || q.label === hit[1]).map((q) => q.end);
    const lr = L.terms.filter((q) => q.src === t.src);
    const led = [hit[0], hit[1]].some((l) => /\.(a|k)$/.test(l) && tray.find((q) => String(q.src) === l.split('.')[0] && q.type === 'led'));
    add(`<b>${cap(the(t))} is not in series${led ? ' with the LED' : ''}.</b> ${cap(nm(hit[0]))} is joined straight to ${nm(hit[1])}, so the current goes round the resistor instead of through it${led ? ', and nothing holds it back to protect the LED' : ''}. The resistor must sit between them: one leg in a column with ${nm(hit[0])}, the other in a column with ${nm(hit[1])}, and nothing else joining those two columns.`, [...ends, ...lr.map((q) => q.end)], [hit[0], hit[1], `${t.src}.s`]);
  }
  // anything else: should be joined, should not be
  const Lm = netsBy(L);
  const seen = new Set();
  for (const root of new Set(T.nodes().map((x) => T.find(x)))) {
    const labs = labelsIn(T, root).filter((l) => !said.has(l));
    if (labs.length < 2) continue;
    const groups = new Map();
    for (const l of labs) {
      const rs = Lm.get(l) || ['none:' + l];
      const r = rs.length === 1 ? rs[0] : rs.find((x) => labelsIn(L, x).some((y) => y !== l && labs.includes(y))) ?? rs[0];
      (groups.get(r) ?? groups.set(r, []).get(r)).push(l);
    }
    if (groups.size < 2) continue;
    const [g1, g2] = [...groups.entries()].sort((a, c) => c[1].length - a[1].length);
    const pick = (g) => g[1].find((l) => !ard.has(l)) ?? g[1][0];
    const a = pick(g1), c = pick(g2);
    const key = [a, c].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const na = labelWords(a, L, tray, legName, map), nc = labelWords(c, L, tray, legName, map);
    const wa = whereNode(g1[0], L, pins), wc = whereNode(g2[0], L, pins);
    const ends = L.terms.filter((q) => q.label === a || q.label === c).map((q) => q.end);
    let why, tip;
    if (wa.ard || wc.ard) {
      const board = wa.ard ? wc : wa, ard = wa.ard ? na : nc, part = wa.ard ? nc : na;
      why = board.ard ? 'Nothing joins them.' : `Nothing joins ${board.text}, where ${part} is, to ${ard}.`;
      tip = board.ard ? 'Add a wire between them.' : `Add a wire from ${board.col ? 'column ' + board.col : board.text} to ${ard}${board.rail ? '' : ', in a free hole of that column'}.`;
    } else {
      const is = (lab, w) => (ard.has(lab) ? 'reaches ' + w.text : 'is ' + w.on);
      why = `${cap(na)} ${is(a, wa)} and ${nc} ${is(c, wc)}, so no current can get from one to the other.`;
      tip = wa.col && wc.col ? `Move one so they share a column (column ${wc.col}, say), or join the two columns with a wire.` : 'Add a wire between them, or move one so they meet.';
    }
    add(`<b>${cap(na)} and ${nc} should be joined, but they are not.</b> ${why} ${tip}`, ends, [a, c]);
  }
  for (const root of new Set(L.nodes().map((x) => L.find(x)))) {
    const labs = labelsIn(L, root).filter((l) => !said.has(l));
    if (labs.length < 2) continue;
    const Tm = netsBy(T);
    const groups = new Map();
    for (const l of labs) {
      const rs = Tm.get(l) || ['none'];
      const r = rs.length === 1 ? rs[0] : rs.find((x) => labelsIn(T, x).some((y) => y !== l && labs.includes(y))) ?? rs[0];
      (groups.get(r) ?? groups.set(r, []).get(r)).push(l);
    }
    if (groups.size < 2) continue;
    const gs = [...groups.values()];
    const a = gs[0].find((l) => !ard.has(l)) ?? gs[0][0], c = gs[1].find((l) => !ard.has(l)) ?? gs[1][0];
    const na = labelWords(a, L, tray, legName, map), nc = labelWords(c, L, tray, legName, map);
    const w = whereNode(root, L, pins);
    const ends = L.terms.filter((q) => q.label === a || q.label === c).map((q) => q.end);
    const pinGnd = [a, c].some((l) => l === 'GND' || l === 'P:5V') && [a, c].some((l) => /^P:\d+$/.test(l));
    add(`<b>${cap(na)} and ${nc} are joined, but they should not be.</b> They meet ${w.on}.${pinGnd ? ' When the sketch turns that pin on, it would be pushing straight into ' + ([a, c].includes('GND') ? 'GND: a short.' : '5V.') : ''} Look for a leg or wire that is one column out.`, ends, [a, c]);
  }
}
function labelWords(lab, N, tray, legName, map) {
  if (lab === 'GND') return 'the Arduino’s GND';
  if (lab.startsWith('P:')) { const n = lab.slice(2); return /^\d+$/.test(n) ? `Arduino pin ${n}` : `the Arduino’s ${n}`; }
  const t = N.terms.find((q) => q.label === lab);
  if (t) {
    // a resistor's legs share a label: name the part, not one leg
    if (t.tray.lab.filter((x) => x === t.tray.lab[t.leg]).length > 1 && !t.tray.lead) return legName(t.tray, 0).replace(/’s .*$/, '');
    return legName(t.tray, t.tray.lead ? 0 : t.leg);
  }
  const tr = tray.find((q) => String(q.src) === lab.split('.')[0]);
  void map;
  return tr ? legName(tr, 0).replace(/’s .*$/, '') : 'a part';
}
function whereNode(root, N, pins) {
  // a column, a rail or the Arduino, named as the learner would find it
  const nodes = N.nodes().filter((x) => N.find(x) === root);
  const col = nodes.find((x) => /^[TB]\d+$/.test(x));
  if (col) { const t = colWords(+col.slice(1), col[0] === 'T'); return { text: t, on: 'in ' + t, col: +col.slice(1) }; }
  const rail = nodes.find((x) => RAILS.includes(x));
  if (rail) return { text: railWords(rail), on: 'on ' + railWords(rail), rail: true };
  const a = nodes.find((x) => x === 'GND' || x.startsWith('P:'));
  if (a) return { text: nodeWords(a), on: 'at ' + nodeWords(a), ard: true };
  void pins;
  return { text: 'nothing', on: 'joined to nothing' };
}

// ---------- the guided build's order, from the page's own words ----------
// chunks: [{ text, see, then, step }] in page order (see buildmode.js for how
// they are read from the page). Returns, for each part index, { chunk, pos }
// or null if the page does not place it.
export function orderFromChunks(b, chunks) {
  const holesOf = (p) => {
    const h = [];
    for (const k of ['anode', 'cathode', 'a', 'b', 'plus', 'minus', 'e', 'c']) if (isHole(p[k])) h.push(p[k]);
    if (p.holes) h.push(...p.holes);
    return h;
  };
  const sockWord = (name) => (name === 'GND' ? /\bGND\b/ : name === '5V' ? /\b5\s?V\b/ : /^\d+$/.test(name) ? new RegExp(`(\\bpin\\s+${name}\\b|^\\s*${name}\\s*$|\\b${name}\\b)`) : new RegExp(`\\b${name}\\b`));
  const railWord = /rail/i;
  const found = b.parts.map(() => null);
  const holeRe = /\b([a-j])(\d{1,2})\b/g;
  const chunkHoles = chunks.map((c) => {
    const m = new Map();
    let x;
    holeRe.lastIndex = 0;
    while ((x = holeRe.exec(c.text))) if (!m.has(x[0])) m.set(x[0], x.index);
    return m;
  });
  b.parts.forEach((p, i) => {
    const hs = holesOf(p);
    if (hs.length) {
      const needOther = p.type === 'wire' && p.to !== 'hole';
      let fallback = null;
      for (let k = 0; k < chunks.length; k++) {
        const m = chunkHoles[k];
        if (!hs.every((h) => m.has(h))) continue;
        const pos = Math.min(...hs.map((h) => m.get(h)));
        if (!needOther) { found[i] = { chunk: k, pos }; return; }
        const other = p.to === 'rail' ? railWord : sockWord(p.socket.name);
        if (other.test(chunks[k].text)) { found[i] = { chunk: k, pos }; return; }
        fallback ??= { chunk: k, pos };
      }
      found[i] = fallback;
    } else if (p.type === 'power') {
      const re = sockWord(p.socket.name);
      for (let k = 0; k < chunks.length; k++) {
        const t = chunks[k].text;
        if (railWord.test(t) && re.test(t)) { found[i] = { chunk: k, pos: t.search(re) }; return; }
      }
    } else if (p.type === 'mod' || p.type === 'batt') {
      const re = p.type === 'batt' ? /batter/i : new RegExp(shortLabel(p.label).split(' ')[0], 'i');
      for (let k = 0; k < chunks.length; k++) if (re.test(chunks[k].text) && /(wire|lead|pin|plug|rail|connect)/i.test(chunks[k].text)) { found[i] = { chunk: k, pos: chunks[k].text.search(re) }; return; }
    }
  });
  return found;
}
// The course's own order when the page cannot say: parts left to right, then
// signal wires, then the wires to rails and the feeds.
export function defaultRank(p) {
  const minCol = (p) => {
    const hs = [];
    for (const k of ['anode', 'cathode', 'a', 'b', 'plus', 'minus', 'e', 'c']) if (isHole(p[k])) hs.push(parseHole(p[k]).col);
    if (p.holes) hs.push(...p.holes.map((h) => parseHole(h).col));
    return hs.length ? Math.min(...hs) : 0;
  };
  if (['led', 'res', 'buz', 'pot', 'npn', 'btn', 'blk'].includes(p.type)) return [0, minCol(p)];
  if (p.type === 'wire' && (p.to === 'hole' || (p.to === 'socket' && !['5V', 'GND', '3V3', 'VIN'].includes(p.socket.name)))) return [1, minCol(p)];
  if (p.type === 'mod') return [2, 0];
  if (p.type === 'wire') return [3, minCol(p)];
  if (p.type === 'batt') return [4, 0];
  return [5, 0]; // power feeds and links last
}

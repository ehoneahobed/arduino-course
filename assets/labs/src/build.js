// "View in 3D": one wiring build from tools/diagrams.py, as an illustrated
// 3D scene. <div class="lab" data-lab="build" data-build="b1p5"></div>
//
// The data is the same data the SVG diagrams are drawn from (bbdraw.py's
// Board.json(), exported by `python3 tools/diagrams.py --json`), so the 3D
// view cannot show a hole the page does not.
//
// One world unit is one breadboard pitch (0.1 inch). Columns run along x,
// rows along z (row j at the back, row a at the front), up is y. The Arduino
// sits in front of the board, as it sits below the board in the SVG.
import { THREE, mat, rbox, decal, label } from './runtime.js';
import * as P from './parts.js';
import DATA from './builds.json';

const { V } = P;
const BT = 1.3; // board top
const ROWZ = { j: 0, i: 1, h: 2, g: 3, f: 4, e: 7, d: 8, c: 9, b: 10, a: 11 };
const RAILZ = { '+top': -3.2, '-top': -2.2, '-bot': 13.2, '+bot': 14.2 };
const RAILS = ['+top', '-top', '-bot', '+bot'];
const BZ0 = -4.6;
const BZ1 = 15.6;
const UNO_W = 27;
const UNO_D = 21;
const UY = 0.95; // Arduino board top
const HDR_H = 0.9;
const SOCK_Y = UY + HDR_H;
const HOUSE = 1.5; // jumper housing height
const PAL = ['#FFBE00', '#1FB5A6', '#E0479E', '#FF7A1A', '#4FA3F0', '#8BC34A'];
const RED = '#C8452F';
const BLU = '#3D6FA8';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parse = (h) => { const m = /^([a-j])(\d{1,2})$/.exec(h); return m && { row: m[1], col: +m[2] }; };
const isHole = (s) => !!parse(s);
const topHalf = (h) => 'fghij'.includes(parse(h).row);
const holeNode = (h) => (topHalf(h) ? 'T' : 'B') + parse(h).col;
const sockNode = (s) => (s.name === 'GND' ? 'GND' : 'P:' + s.name);
const railName = (r) => `${r[0] === '+' ? '+' : '−'} rail (${r.endsWith('top') ? 'top' : 'bottom'})`;
const pinName = (n) => (n === 'GND' ? 'GND' : /^\d+$/.test(n) ? 'pin ' + n : n);
const PWM = new Set(['3', '5', '6', '9', '10', '11']);

function nodeName(n) {
  if (RAILS.includes(n)) return 'the ' + railName(n);
  if (n === 'GND') return 'the Arduino’s GND';
  if (n.startsWith('P:')) return 'Arduino ' + pinName(n.slice(2));
  if (n.startsWith('M:')) return n.split(':')[3];
  const c = n.slice(1);
  return n[0] === 'T' ? `column ${c}, rows f to j` : `column ${c}, rows a to e`;
}

function inkHex(host) {
  const c = getComputedStyle(host).color || 'rgb(20,26,28)';
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m) return 0x1b2224;
  let [r, g, b] = m.map(Number);
  // keep a near-black wire visibly a wire, not a hole
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  if (lum < 0.2) [r, g, b] = [43, 47, 49];
  return (r << 16) | (g << 8) | b;
}

// ---------- names and words for each part ----------
function pinNamesOf(label, n) {
  if (/^LCD1602, bare/.test(label)) return ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'].slice(0, n);
  let rest = null;
  if (label.includes(':')) rest = label.split(':')[1];
  else if (label.includes('  ')) rest = label.split('  ')[1];
  if (rest) {
    const names = rest.split('/').map((s) => s.trim());
    if (names.length === n) return names;
  }
  return Array.from({ length: n }, (_, i) => 'pin ' + (i + 1));
}

function shortLabel(label) {
  return label.split(/ {2}|:|,/)[0].trim();
}

// ---------- layout ----------
function layout(b) {
  const n = b.c1 - b.c0;
  const L = { n, c0: b.c0, c1: b.c1 };
  L.X = (c) => c - b.c0;
  L.x0 = -2.4;
  L.x1 = n + 1.4;
  L.hole = (h) => { const p = parse(h); return V(L.X(p.col), BT, ROWZ[p.row]); };
  // rail holes: one per column, like the SVG. Who sits where is decided here
  // so that no two wire ends share a rail hole.
  const used = Object.fromEntries(RAILS.map((r) => [r, new Set()]));
  // A simpler walk: from col, step by dir, then the other way.
  L.railFrom = (rail, col, dir) => {
    for (let k = 0; k <= n; k++) {
      const c = col + dir * k;
      if (c >= b.c0 && c <= b.c1 && !used[rail].has(c)) { used[rail].add(c); return c; }
    }
    for (let k = 1; k <= n; k++) {
      const c = col - dir * k;
      if (c >= b.c0 && c <= b.c1 && !used[rail].has(c)) { used[rail].add(c); return c; }
    }
    return col;
  };
  L.railHole = (rail, col) => V(L.X(col), BT, RAILZ[rail]);
  return L;
}

// ---------- the world ----------
export function prepare(host) {
  const name = host.dataset.build;
  const b = DATA.builds[name];
  if (!b) throw new Error(`No build called "${name}".`);
  const L = layout(b);
  const ink = inkHex(host);
  const world = new THREE.Group();
  const parts = []; // { kind, title, short, where, what, group, focus, terms, wires }
  const terms = []; // { part, leg, node, at }
  const conductors = []; // { part, a, b }
  const inkMats = [];
  const tags = [];

  const jumperMat = (hex) => {
    const m = mat(0, { roughness: 0.7 });
    if (hex === 'ink') { m.color.setHex(ink); inkMats.push(m); } else m.color.set(hex);
    return m;
  };
  const addJumper = (path, colour, opts) => {
    const g = P.jumper(path, 0, opts);
    const c = g.userData.cable;
    c.material.dispose();
    c.material = jumperMat(colour);
    return g;
  };
  const up = (p, h) => V(p.x, p.y + h, p.z);
  const holeTop = (p) => up(p, HOUSE);

  // smooth path through axis-aligned turns, with rounded corners
  const route = (pts, r = 0.9) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], c = pts[i], d = pts[i + 1];
      const l1 = a.distanceTo(c), l2 = c.distanceTo(d);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      out.push(c.clone().lerp(a, rr / l1), c.clone(), c.clone().lerp(d, rr / l2));
    }
    out.push(pts[pts.length - 1]);
    // drop the exact corner point: centripetal Catmull-Rom then rounds it
    return out.filter((p, i) => i === 0 || i === out.length - 1 || (i - 2) % 3 !== 0);
  };
  // an arch from a to b (both wire tops), peaking at height `peak`
  const arch = (a, b, peak) => {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const rise = Math.max(0.5, Math.min(1.2, d * 0.2));
    const top = Math.max(peak, a.y + rise + 0.2, b.y + rise + 0.2);
    const pts = [a, up(a, rise * 0.8)];
    if (d > 1.2) {
      pts.push(V(a.x + (b.x - a.x) * 0.2, top - (top - a.y) * 0.12, a.z + (b.z - a.z) * 0.2));
      pts.push(V((a.x + b.x) / 2, top, (a.z + b.z) / 2));
      pts.push(V(a.x + (b.x - a.x) * 0.8, top - (top - b.y) * 0.12, a.z + (b.z - a.z) * 0.8));
    } else {
      pts.push(V((a.x + b.x) / 2, top, (a.z + b.z) / 2));
    }
    pts.push(up(b, rise * 0.8), b);
    return pts;
  };

  // ---- breadboard ----
  const board = buildBoard(b, L);
  world.add(board.group);

  // ---- band of modules in front of the board, and above it ----
  const front = [];
  const back = [];
  const modelOf = {};
  b.parts.forEach((p, i) => {
    if (p.type === 'mod') {
      const names = p.pins.map((q) => q.name);
      const m = P.moduleModel(p.label, names);
      modelOf[i] = m;
      front.push({ i, m, pref: -Infinity, order: front.length });
    } else if (p.type === 'blk' && !/^(RGB LED|light sensor)/.test(p.label)) {
      const motorish = /^motor/.test(p.label);
      const names = motorish ? ['', ''] : pinNamesOf(p.label, p.holes.length);
      const m = P.moduleModel(p.label, names);
      modelOf[i] = m;
      const xs = p.holes.map((h) => L.hole(h).x);
      const pref = xs.reduce((s, x) => s + x, 0) / xs.length;
      const onTop = p.holes.some((h) => topHalf(h));
      (onTop && !motorish ? back : front).push({ i, m, pref, order: 99 });
    } else if (p.type === 'batt') {
      const m = P.batteryPack();
      modelOf[i] = m;
      front.push({ i, m, pref: L.n - m.w / 2 + 1, order: 999 });
    }
  });
  // place left to right, never overlapping
  const place = (list) => {
    let cursor = L.x0;
    list.sort((a, c) => (a.pref === c.pref ? a.order - c.order : a.pref - c.pref));
    for (const it of list) {
      const x = Math.max(it.pref === -Infinity ? -Infinity : it.pref, cursor + it.m.w / 2);
      it.x = x;
      cursor = x + it.m.w / 2 + 1.6;
    }
  };
  place(front);
  place(back);
  const bandZ0 = BZ1 + 2.2;
  const bandD = front.reduce((d, it) => Math.max(d, it.m.d), 0);
  for (const it of front) {
    it.z = bandZ0 + it.m.d / 2 + (it.m.zOff ?? 0);
    it.m.group.position.set(it.x, 0, it.z);
    world.add(it.m.group);
  }
  for (const it of back) {
    it.z = BZ0 - 3.2 - (it.m.d ?? 1) / 2;
    it.m.group.position.set(it.x, 0, it.z);
    world.add(it.m.group);
  }
  const uz0 = front.length ? bandZ0 + bandD + 2.4 : BZ1 + 3.2;
  const ux0 = L.x0;

  // ---- Arduino ----
  const uno = b.uno ? buildUno(b, ux0, uz0) : null;
  if (uno) world.add(uno.group);
  const sockAt = (s) => uno.sockPos(s);

  // ---- parts ----
  let lane = 0;
  let gutL = 0;
  let gutR = 0;
  const T = (part, leg, node, at, extra = {}) => terms.push({ part, leg, node, at, ...extra });

  // rail ends for wires that land in their own column come first, so the
  // feeds and links fit round them (as the SVG's lanes do)
  const railCol = {};
  b.parts.forEach((p, i) => {
    if (p.type === 'wire' && p.to === 'rail') railCol[i] = L.railFrom(p.b, parse(p.a).col, 1);
  });

  b.parts.forEach((p, i) => {
    const part = { i, kind: p.type, data: p, group: new THREE.Group() };
    const g = part.group;
    const legs = [];
    switch (p.type) {
      case 'led': {
        const a = L.hole(p.anode), c = L.hole(p.cathode);
        const m = P.led(a, c, p.colour, BT);
        g.add(m);
        part.title = `${cap(p.colour)} LED${p.label ? ' ' + p.label : ''}`;
        part.short = `${cap(p.colour)} LED (${p.anode}, ${p.cathode})`;
        part.where = `Long leg (+) in <code>${p.anode}</code>, short leg (−) in <code>${p.cathode}</code>.`;
        part.what = 'A light. Current goes through it one way only: in at the long leg, out at the short leg. Turn it round and it stays dark. The flat edge on the rim is on the short-leg side.';
        part.focus = m.userData.top;
        T(i, 'long leg (+)', holeNode(p.anode), p.anode);
        T(i, 'short leg (−)', holeNode(p.cathode), p.cathode);
        break;
      }
      case 'res': {
        const value = P.ohms(p.value);
        const m = P.resistor(L.hole(p.a), L.hole(p.b), value, BT);
        g.add(m);
        const [d1, d2, z] = P.bands(value);
        const words = [P.BAND_NAMES[d1], P.BAND_NAMES[d2], P.BAND_NAMES[z]].join(', ');
        part.title = `${P.ohmText(value)} resistor`;
        part.short = `${P.ohmText(value)} resistor (${p.a}, ${p.b})`;
        part.where = `Legs in <code>${p.a}</code> and <code>${p.b}</code>. It works either way round.`;
        part.what = value >= 5000
          ? `Bands: ${words}, then gold. Here it works with its partner part as a pair, so the Arduino can read the middle point between them.`
          : `Bands: ${words}, then gold. It holds the current back so the light does not burn out.`;
        part.focus = m.userData.top;
        T(i, 'one end', holeNode(p.a), p.a);
        T(i, 'other end', holeNode(p.b), p.b);
        break;
      }
      case 'wire': {
        const a = holeTop(L.hole(p.a));
        let bEnd;
        let path;
        let colour = p.colour;
        if (p.to === 'rail') {
          const col = railCol[i];
          bEnd = holeTop(L.railHole(p.b, col));
          const d = Math.hypot(bEnd.x - a.x, bEnd.z - a.z);
          path = arch(a, bEnd, BT + HOUSE + 0.8 + d * 0.12);
          part.title = `Wire to the ${railName(p.b)}`;
          part.short = `Wire ${p.a} → ${p.b[0] === '+' ? '+' : '−'} rail`;
          part.where = `From <code>${p.a}</code> to the ${railName(p.b)}.`;
          part.what = p.b[0] === '+'
            ? `It joins column ${parse(p.a).col} to the + rail, so everything in that column of five gets the rail’s power.`
            : `It joins column ${parse(p.a).col} to the − rail. That is the way back to the Arduino’s GND, which every circuit needs.`;
          T(i, 'rail end', p.b, railName(p.b));
          conductors.push({ part: i, a: holeNode(p.a), b: p.b });
        } else if (p.to === 'hole') {
          bEnd = holeTop(L.hole(p.b));
          const d = Math.hypot(bEnd.x - a.x, bEnd.z - a.z);
          path = arch(a, bEnd, BT + HOUSE + 1 + Math.min(4, d * 0.14) + (lane++ % 3) * 0.35);
          part.title = 'Jumper wire';
          part.short = `Wire ${p.a} → ${p.b}`;
          part.where = `From <code>${p.a}</code> to <code>${p.b}</code>.`;
          part.what = `It joins column ${parse(p.a).col} to column ${parse(p.b).col}, so the two strips act as one.`;
          T(i, 'far end', holeNode(p.b), p.b);
          conductors.push({ part: i, a: holeNode(p.a), b: holeNode(p.b) });
        } else {
          bEnd = up(sockAt(p.socket), HOUSE);
          const d = Math.hypot(bEnd.x - a.x, bEnd.z - a.z);
          path = arch(a, bEnd, BT + HOUSE + 3.2 + Math.min(3, d * 0.06) + (lane++ % 4) * 0.45);
          const pn = pinName(p.socket.name);
          part.title = `Wire to ${/^pin/.test(pn) ? pn : 'the ' + pn + ' pin'}`;
          part.short = `Wire ${p.a} → ${pn}`;
          part.where = `From <code>${p.a}</code> to the Arduino’s <b>${esc(p.socket.name)}</b> socket.`;
          part.what = /^A\d/.test(p.socket.name)
            ? `It lets the Arduino read the voltage in column ${parse(p.a).col} on its ${p.socket.name} pin.`
            : p.socket.name === '5V' ? `It feeds column ${parse(p.a).col} straight from the Arduino’s 5V pin.`
            : p.socket.name === 'GND' ? `It joins column ${parse(p.a).col} to the Arduino’s GND.`
            : `It carries pin ${p.socket.name}’s signal to column ${parse(p.a).col}. The sketch decides what that pin does.`;
          T(i, 'Arduino end', sockNode(p.socket), p.socket.name, { sock: p.socket });
          conductors.push({ part: i, a: holeNode(p.a), b: sockNode(p.socket) });
        }
        if (colour === 'ink') part.inkWire = true;
        const j = addJumper(path, colour);
        g.add(j);
        part.focus = path[Math.floor(path.length / 2)];
        part.isWire = true;
        T(i, 'board end', holeNode(p.a), p.a);
        break;
      }
      case 'power': {
        const s = up(sockAt(p.socket), HOUSE);
        const col = L.railFrom(p.rail, p.rail[0] === '+' ? b.c0 : b.c0 + 1, 1);
        const r = holeTop(L.railHole(p.rail, col));
        const gx = L.x0 - 1.8 - gutL++ * 0.8;
        const h1 = 4.2 + gutL * 0.3;
        const path = route([s, V(s.x, h1, s.z), V(s.x, h1, uz0 + UNO_D + 1.4 + gutL * 0.6), V(gx, h1, uz0 + UNO_D + 1.4 + gutL * 0.6), V(gx, h1 - 0.6, r.z), V(r.x, h1 - 0.6, r.z), r], 1.0);
        g.add(addJumper(path, p.colour));
        part.title = `Feed wire: ${p.socket.name} to the ${railName(p.rail)}`;
        part.short = `Feed ${p.socket.name} → ${railName(p.rail)}`;
        part.where = `From the Arduino’s <b>${esc(p.socket.name)}</b> socket to the ${railName(p.rail)}.`;
        part.what = `A rail is dead metal until a wire feeds it. This one makes the ${railName(p.rail)} ${p.socket.name === 'GND' ? 'the Arduino’s GND' : 'live with ' + p.socket.name}. The top and bottom rail pairs are not joined, so it feeds this one only.`;
        part.focus = path[Math.floor(path.length / 2)];
        part.isWire = true;
        T(i, 'Arduino end', sockNode(p.socket), p.socket.name, { sock: p.socket });
        T(i, 'rail end', p.rail, railName(p.rail));
        conductors.push({ part: i, a: sockNode(p.socket), b: p.rail });
        break;
      }
      case 'link': {
        const ca = L.railFrom(p.a, b.c1, -1);
        const cb = L.railFrom(p.b, b.c1, -1);
        const A = holeTop(L.railHole(p.a, ca));
        const B = holeTop(L.railHole(p.b, cb));
        const gx = L.x1 + 1.8 + gutR++ * 0.8;
        const h1 = 3.8;
        const path = route([A, V(A.x, h1, A.z), V(gx, h1, A.z), V(gx, h1, B.z), V(B.x, h1, B.z), B], 1.0);
        g.add(addJumper(path, p.colour));
        part.title = 'Rail link';
        part.short = `Link ${railName(p.a)} ↔ ${railName(p.b)}`;
        part.where = `From the ${railName(p.a)} to the ${railName(p.b)}.`;
        part.what = 'The top and bottom rails are separate strips. This wire joins them, so both carry the same thing.';
        part.focus = path[Math.floor(path.length / 2)];
        part.isWire = true;
        T(i, 'one end', p.a, railName(p.a));
        T(i, 'other end', p.b, railName(p.b));
        conductors.push({ part: i, a: p.a, b: p.b });
        break;
      }
      case 'btn': {
        const m = P.button(p.holes.map(L.hole), BT);
        g.add(m);
        part.title = 'Push button';
        part.short = `Button (${p.holes.join(', ')})`;
        part.where = `Four legs: ${p.holes.map((h) => `<code>${h}</code>`).join(' ')}. Its body sits over the middle channel.`;
        part.what = 'Pressing it joins its two sides for as long as you hold it. Let go and the gap opens again. It sits across the channel so its legs land in four separate strips.';
        part.focus = m.userData.top;
        p.holes.forEach((h) => T(i, 'leg', holeNode(h), h));
        break;
      }
      case 'pot': {
        const away = topHalf(p.holes[0]) ? -1 : 1;
        const m = P.pot(p.holes.map(L.hole), BT, away);
        g.add(m);
        part.title = p.label === 'knob' ? 'Knob (potentiometer)' : `Potentiometer (${p.label})`;
        part.short = `${p.label === 'knob' ? 'Knob' : cap(p.label) + ' knob'} (${p.holes.join(', ')})`;
        part.where = `Outer legs in <code>${p.holes[0]}</code> and <code>${p.holes[2]}</code>, middle leg in <code>${p.holes[1]}</code>.`;
        part.what = 'Turning it moves the middle leg’s voltage anywhere between the two outer legs. The outer legs go to + and −; the middle leg is the one that answers.';
        part.focus = m.userData.top;
        T(i, 'outer leg', holeNode(p.holes[0]), p.holes[0]);
        T(i, 'middle leg', holeNode(p.holes[1]), p.holes[1]);
        T(i, 'outer leg', holeNode(p.holes[2]), p.holes[2]);
        break;
      }
      case 'buz': {
        const toward = topHalf(p.plus) ? 1 : -1;
        const m = P.buzzer(L.hole(p.plus), L.hole(p.minus), BT, toward);
        g.add(m);
        part.title = 'Buzzer';
        part.short = `Buzzer (${p.plus}, ${p.minus})`;
        part.where = `Long leg (+) in <code>${p.plus}</code>, short leg in <code>${p.minus}</code>.`;
        part.what = 'It makes a sound when its pin is switched on. Like an LED it has a + leg, marked on top.';
        part.focus = m.userData.top;
        T(i, 'long leg (+)', holeNode(p.plus), p.plus);
        T(i, 'short leg (−)', holeNode(p.minus), p.minus);
        break;
      }
      case 'npn': {
        const m = P.transistor(L.hole(p.e), L.hole(p.b), L.hole(p.c), BT);
        g.add(m);
        part.title = 'NPN transistor';
        part.short = `Transistor (${p.e}, ${p.b}, ${p.c})`;
        part.where = `Emitter <code>${p.e}</code>, base <code>${p.b}</code>, collector <code>${p.c}</code>. Flat face towards you.`;
        part.what = 'An electric switch. A small current into the base lets a big current flow from collector to emitter, so a pin can control a motor it could never power itself.';
        part.focus = m.userData.top;
        T(i, 'emitter (E)', holeNode(p.e), p.e);
        T(i, 'base (B)', holeNode(p.b), p.b);
        T(i, 'collector (C)', holeNode(p.c), p.c);
        break;
      }
      case 'blk': {
        const holes = p.holes.map(L.hole);
        if (/^RGB LED/.test(p.label)) {
          const m = P.rgbLed(holes, BT, 1);
          g.add(m);
          const names = pinNamesOf(p.label, p.holes.length);
          part.title = 'RGB LED';
          part.short = `RGB LED (${p.holes.join(', ')})`;
          part.where = names.map((nm, k) => `${nm} <code>${p.holes[k]}</code>`).join(', ') + '.';
          part.what = 'Three lights in one: red, green and blue. The long leg is the one they share. Each colour gets its own resistor and its own pin.';
          part.focus = m.userData.top;
          names.forEach((nm, k) => T(i, nm + ' leg', holeNode(p.holes[k]), p.holes[k]));
        } else if (/^light sensor/.test(p.label)) {
          const m = P.ldr(holes[0], holes[1], BT);
          g.add(m);
          part.title = 'Light sensor (LDR)';
          part.short = `Light sensor (${p.holes.join(', ')})`;
          part.where = `Legs in <code>${p.holes[0]}</code> and <code>${p.holes[1]}</code>. Either way round.`;
          part.what = 'Its resistance falls as light gets brighter. With a partner resistor it makes a voltage the Arduino can read.';
          part.focus = m.userData.top;
          p.holes.forEach((h) => T(i, 'leg', holeNode(h), h));
        } else if (/^motor/.test(p.label)) {
          // the motor stands off the board; the diode sits across it
          const it = front.find((f) => f.i === i);
          const mm = modelOf[i];
          g.add(mm.group);
          const tip0 = mm.tips[0].clone().add(mm.group.position);
          const tip1 = mm.tips[1].clone().add(mm.group.position);
          const hA = holeTop(L.hole(p.holes[0]));
          g.add(addJumper(arch(tip0, hA, BT + HOUSE + 2.2), 'ink', { ends: [false, true] }));
          const rr = p.rails[0];
          const col = L.railFrom(rr.rail, parse(p.holes[0]).col, -1);
          const rTop = holeTop(L.railHole(rr.rail, col));
          const gx = L.x0 - 1.8 - gutL++ * 0.8;
          g.add(addJumper(route([tip1, V(tip1.x, 4.6, tip1.z), V(gx, 4.6, tip1.z), V(gx, 4.0, rTop.z), V(rTop.x, 4.0, rTop.z), rTop], 1), rr.colour, { ends: [false, true] }));
          const dcol = L.railFrom(rr.rail, parse(p.holes[1]).col + 1, 1);
          const d = P.diode(L.hole(p.holes[1]), L.railHole(rr.rail, dcol), BT, 3.0);
          g.add(d);
          part.title = 'Motor, with its diode';
          part.short = `Motor and diode (${p.holes.join(', ')}, + rail)`;
          part.where = `One motor wire into <code>${p.holes[0]}</code>, the other to the ${railName(rr.rail)}. Diode: plain end in <code>${p.holes[1]}</code>, striped end in the ${railName(rr.rail)}.`;
          part.what = 'The motor spins the fan. The diode sits across it to soak up the kick a motor gives when it switches off. The stripe must face the + rail.';
          part.focus = it ? V(it.x, 4, it.z) : d.userData.top;
          T(i, 'motor wire', holeNode(p.holes[0]), p.holes[0]);
          T(i, 'diode, plain end', holeNode(p.holes[1]), p.holes[1]);
          T(i, 'motor wire and diode stripe', rr.rail, railName(rr.rail));
          void it;
        } else {
          const mm = modelOf[i];
          g.add(mm.group);
          const names = pinNamesOf(p.label, p.holes.length);
          mm.tips.forEach((tp, k) => {
            if (k >= p.holes.length) return;
            const tip = tp.clone().add(mm.group.position);
            const h = holeTop(holes[k]);
            const dist = Math.hypot(h.x - tip.x, h.z - tip.z);
            const path = arch(tip, h, Math.max(tip.y, h.y) + 1.0 + Math.min(2.5, dist * 0.1));
            g.add(addJumper(path, 'ink', { r: 0.16, ends: [!mm.standing, true] }));
          });
          (p.rails || []).forEach((rr, k) => {
            const tip = mm.tips[mm.tips.length - 1].clone().add(mm.group.position);
            const col = L.railFrom(rr.rail, b.c0 + 1 + k, 1);
            const rTop = holeTop(L.railHole(rr.rail, col));
            g.add(addJumper(arch(tip, rTop, 5), rr.colour));
            T(i, 'rail lead', rr.rail, railName(rr.rail));
          });
          part.title = shortLabel(p.label);
          part.short = `${shortLabel(p.label)} (${p.holes[0]}–${p.holes[p.holes.length - 1]})`;
          part.where = names.map((nm, k) => `${esc(nm)} <code>${p.holes[k]}</code>`).join(', ') + '.';
          part.what = blkWhat(p.label);
          part.focus = mm.group.position.clone().setY(mm.h ? mm.h / 2 + 1 : 2.5);
          names.forEach((nm, k) => T(i, nm, holeNode(p.holes[k]), p.holes[k]));
        }
        break;
      }
      case 'mod': {
        const mm = modelOf[i];
        g.add(mm.group);
        mm.group.updateMatrixWorld(true);
        p.pins.forEach((q, k) => {
          const tip = mm.tips[k].clone().add(mm.group.position);
          const node = `M:${i}:${k}:${shortLabel(p.label)} ${q.name}`;
          T(i, `${q.name} pin`, node, q.name, { modPin: true });
          if (q.to === 'socket') {
            const s = up(sockAt(q.socket), HOUSE);
            const dist = Math.hypot(s.x - tip.x, s.z - tip.z);
            g.add(addJumper(arch(tip, s, Math.max(tip.y, s.y) + 1.6 + Math.min(2.5, dist * 0.08) + (k % 3) * 0.3), q.colour, { ends: [!mm.plugTips, true] }));
            conductors.push({ part: i, a: node, b: sockNode(q.socket), lead: `${q.name} → ${pinName(q.socket.name)}` });
          } else if (q.to === 'rail') {
            const left = mm.group.position.x < L.n / 2;
            const top = q.rail.endsWith('top');
            const col = L.railFrom(q.rail, left ? b.c0 + 2 : b.c1 - 2, left ? 1 : -1);
            const r = holeTop(L.railHole(q.rail, col));
            let path;
            if (top) {
              const gx = left ? L.x0 - 1.8 - gutL++ * 0.8 : L.x1 + 1.8 + gutR++ * 0.8;
              const h1 = 4.4 + k * 0.25;
              path = route([tip, V(tip.x, h1, tip.z), V(gx, h1, tip.z), V(gx, h1 - 0.4, r.z), V(r.x, h1 - 0.4, r.z), r], 1.0);
            } else {
              path = arch(tip, r, Math.max(tip.y, r.y) + 2);
            }
            g.add(addJumper(path, q.colour, { ends: [!mm.plugTips, true] }));
            conductors.push({ part: i, a: node, b: q.rail, lead: `${q.name} → ${railName(q.rail)}` });
          }
        });
        part.title = cap(shortLabel(p.label));
        part.short = cap(shortLabel(p.label));
        part.where = 'Nothing of it goes in the breadboard. ' + p.pins.filter((q) => q.to).map((q) => `<b>${esc(q.name)}</b> → ${q.to === 'rail' ? railName(q.rail) : esc(pinName(q.socket.name))}`).join(', ') + '.';
        part.what = modWhat(p.label);
        part.focus = mm.group.position.clone().setY(3);
        break;
      }
      case 'batt': {
        const mm = modelOf[i];
        g.add(mm.group);
        const rails = [p.plus, p.minus];
        rails.forEach((rail, k) => {
          const tip = mm.tips[k].clone().add(mm.group.position);
          const col = L.railFrom(rail, k === 0 ? b.c1 : b.c1 - 1, -1);
          const r = holeTop(L.railHole(rail, col));
          const gx = L.x1 + 1.8 + gutR++ * 0.8;
          const h1 = 3.6 + k * 0.4;
          const path = route([tip, V(tip.x - 1.2, h1, tip.z), V(tip.x - 1.2, h1, BZ1 + 1.2 + k * 0.6), V(gx, h1, BZ1 + 1.2 + k * 0.6), V(gx, h1, r.z), V(r.x, h1, r.z), r], 1.0);
          g.add(addJumper(path, rail[0] === '+' ? RED : BLU, { ends: [false, true] }));
        });
        part.title = cap(p.label);
        part.short = cap(p.label);
        part.where = `Red lead to the ${railName(p.plus)}, black lead to the ${railName(p.minus)}.`;
        part.what = 'Power for the motor or servo, so the Arduino’s small 5V pin is not asked to do it. Its + rail is NOT the Arduino’s 5V. The Arduino and the battery share a ground.';
        part.focus = mm.group.position.clone().setY(2.5);
        T(i, '+ lead', p.plus, railName(p.plus), { source: true });
        T(i, '− lead', p.minus, railName(p.minus), { source: true });
        break;
      }
      default:
        return;
    }
    void legs;
    world.add(g);
    parts.push(part);
  });

  world.updateMatrixWorld(true);
  return { b, L, world, parts, terms, conductors, board, uno, inkMats, ux0, uz0, tags };
}

const cardText = (p) => {
  const m = /\(([^)]*)\)\s*$/.exec(p.short);
  if (m && /\b[a-j]\d/.test(m[1])) return m[1];
  return p.short.replace(/^(Wire|Feed|Link)\s+/, '');
};
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function blkWhat(label) {
  if (/^HC-SR04/.test(label)) return 'A distance sensor. Trig sends out a click of sound too high to hear; Echo reports how long the echo took to come back.';
  if (/^LCD1602/.test(label)) return 'A screen with two lines of sixteen letters. The knob next to it sets the contrast.';
  if (/keypad/.test(label)) return 'Sixteen keys in a grid of four rows and four columns. Eight wires let the Arduino find which key is down.';
  if (/^rain/.test(label)) return 'The rain sensor’s little control board. Water on the sensing plate changes the voltage it reports.';
  if (/^DHT11/.test(label)) return 'A temperature and humidity sensor. It sends its readings down one data wire.';
  return 'A module. Each of its pins sits in its own column.';
}

function modWhat(label) {
  if (/^servo/.test(label)) return 'A motor that turns to an angle you choose, from 0 to 180 degrees. Its three wires: orange is the signal, red is power, brown is ground.';
  if (/^ULN2003/.test(label)) return 'A driver board: seven transistors and their diodes in one chip, so the Arduino’s pins can drive the stepper motor’s coils.';
  if (/^traffic/.test(label)) return 'Three LEDs with their resistors already fitted. One pin per colour and a shared ground.';
  if (/^RGB module/.test(label)) return 'An RGB LED with its resistors already on the board. One pin per colour and a shared ground.';
  if (/^LCD1602, I2C/.test(label)) return 'A screen with a small I²C board on its back, so it needs only four wires: power, ground and the two I²C lines.';
  return 'A module that does not sit in the breadboard.';
}

// ---------- breadboard ----------
function buildBoard(b, L) {
  const g = new THREE.Group();
  const W = L.x1 - L.x0;
  const D = BZ1 - BZ0;
  const cx = (L.x0 + L.x1) / 2;
  const cz = (BZ0 + BZ1) / 2;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, BT, D), bodyMat);
  body.position.set(cx, BT / 2, cz);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // the middle channel: a groove you can see
  const groove = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 1.2), new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8 }));
  groove.position.set(cx, BT + 0.005, 5.5);
  groove.userData.noInk = true;
  g.add(groove);

  // printing: rails, letters, numbers, and every used hole named (as in the SVG)
  const used = new Set();
  for (const p of b.parts) {
    for (const k of ['anode', 'cathode', 'a', 'b', 'plus', 'minus', 'e', 'c']) if (typeof p[k] === 'string' && isHole(p[k])) used.add(p[k]);
    if (p.holes) p.holes.forEach((h) => used.add(h));
  }
  const ppu = Math.max(24, Math.min(48, Math.floor(2048 / W)));
  const print = decal(W, D, (c, CW, CH) => {
    const sx = CW / W;
    const sz = CH / D;
    const X = (x) => (x - L.x0) * sx;
    const Z = (z) => (z - BZ0) * sz;
    c.clearRect(0, 0, CW, CH);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // rail lines
    const line = (z, col) => { c.fillStyle = col; c.fillRect(X(-0.6), Z(z) - sz * 0.05, X(L.n + 0.6) - X(-0.6), sz * 0.1); };
    line(-3.75, RED); line(-1.65, BLU); line(12.65, BLU); line(14.75, RED);
    c.font = `700 ${sz * 0.8}px Rubik, Arial, sans-serif`;
    for (const r of RAILS) {
      c.fillStyle = r[0] === '+' ? RED : BLU;
      for (const x of [-1.35, L.n + 0.75]) c.fillText(r[0] === '+' ? '+' : '−', X(x), Z(RAILZ[r]) + sz * 0.04);
    }
    c.font = `600 ${sz * 0.5}px ui-monospace, "IBM Plex Mono", Menlo, monospace`;
    c.fillStyle = 'rgba(36,24,46,.62)';
    for (const [row, z] of Object.entries(ROWZ)) for (const x of [-1.35, L.n + 0.75]) c.fillText(row, X(x), Z(z));
    for (let n = b.c0; n <= b.c1; n++) {
      if (n % 5 === 0 || n === b.c0) for (const z of [-1.05, 12.05]) c.fillText(String(n), X(L.X(n)), Z(z));
    }
    // "+" beside each long leg, outboard of it, as in the SVG
    c.font = `700 ${sz * 0.62}px Rubik, Arial, sans-serif`;
    c.fillStyle = '#24182E';
    for (const p of b.parts) {
      const pl = p.type === 'led' ? [p.anode, p.cathode] : p.type === 'buz' ? [p.plus, p.minus] : null;
      if (!pl) continue;
      const a = L.hole(pl[0]), k = L.hole(pl[1]);
      const side = a.x <= k.x ? -1 : 1;
      c.fillText('+', X(a.x + side * 0.6), Z(a.z) - sz * 0.02);
    }
    // used holes: a ring and the name, like the SVG
    c.font = `700 ${sz * 0.4}px ui-monospace, "IBM Plex Mono", Menlo, monospace`;
    for (const h of used) {
      const p = L.hole(h);
      c.strokeStyle = 'rgba(36,24,46,.85)';
      c.lineWidth = sz * 0.07;
      c.beginPath();
      c.arc(X(p.x), Z(p.z), sz * 0.42, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#24182E';
      c.fillText(h, X(p.x), Z(p.z + 0.62));
    }
  }, { px: Math.round(D * ppu), maxPx: 2048 });
  print.rotation.x = -Math.PI / 2;
  print.position.set(cx, BT + 0.012, cz);
  print.material.depthWrite = false;
  print.renderOrder = 2;
  g.add(print);

  // holes: one instanced mesh, one draw call, ~600 squares on a 45-column board
  const ids = []; // instance -> { kind, name/rail, col }
  const cols = [];
  for (let c = b.c0; c <= b.c1; c++) cols.push(c);
  const count = cols.length * 14;
  const holeGeo = new THREE.BoxGeometry(0.36, 0.05, 0.36);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const holes = new THREE.InstancedMesh(holeGeo, holeMat, count);
  const m4 = new THREE.Matrix4();
  const base = new THREE.Color(0x4a4744);
  let k = 0;
  const holeIndex = {};
  const railIndex = {};
  for (const c of cols) {
    for (const row of Object.keys(ROWZ)) {
      m4.makeTranslation(L.X(c), BT + 0.02, ROWZ[row]);
      holes.setMatrixAt(k, m4);
      holes.setColorAt(k, base);
      ids.push({ kind: 'hole', name: row + c, col: c });
      holeIndex[row + c] = k++;
    }
    for (const r of RAILS) {
      m4.makeTranslation(L.X(c), BT + 0.02, RAILZ[r]);
      holes.setMatrixAt(k, m4);
      holes.setColorAt(k, base);
      ids.push({ kind: 'rail', rail: r, col: c });
      railIndex[r + c] = k++;
    }
  }
  holes.instanceMatrix.needsUpdate = true;
  holes.userData.noGlow = true;
  holes.userData.ids = ids;
  g.add(holes);

  // the metal strips inside: two per column, and the four long rails.
  // Hidden until X-ray is on.
  const strips = new THREE.Group();
  strips.visible = false;
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.3 });
  const colStrips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.16, 4.5), stripMat, cols.length * 2);
  const silver = new THREE.Color(0xb9bfc6);
  const stripIndex = {};
  k = 0;
  for (const c of cols) {
    for (const half of ['T', 'B']) {
      m4.makeTranslation(L.X(c), BT - 0.42, half === 'T' ? 2 : 9);
      colStrips.setMatrixAt(k, m4);
      colStrips.setColorAt(k, silver);
      stripIndex[half + c] = k++;
    }
  }
  colStrips.userData.noGlow = true;
  strips.add(colStrips);
  const railStrips = {};
  for (const r of RAILS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L.n + 0.5, 0.16, 0.38), new THREE.MeshStandardMaterial({ color: 0xb9bfc6, metalness: 0.75, roughness: 0.3 }));
    m.position.set(L.n / 2, BT - 0.42, RAILZ[r]);
    m.userData.noInk = true;
    railStrips[r] = m;
    strips.add(m);
  }
  g.add(strips);
  return { group: g, body, bodyMat, print, groove, holes, holeIndex, railIndex, strips, colStrips, stripIndex, railStrips, base, silver, used };
}

// ---------- Arduino Uno ----------
function buildUno(b, ux0, uz0) {
  const g = new THREE.Group();
  const DIG = DATA.pins.dig;
  const PWR = DATA.pins.pwr;
  const usedS = new Set();
  const visit = (s) => s && usedS.add(s.hdr + s.i);
  for (const p of b.parts) {
    visit(p.socket);
    if (p.pins) p.pins.forEach((q) => visit(q.socket));
  }
  const digX = (i) => ux0 + 7.6 + i;
  const pwrX = (i) => ux0 + 10.6 + i;
  const digZ = uz0 + 1.1;
  const pwrZ = uz0 + UNO_D - 1.1;
  const sockPos = (s) => V(s.hdr === 'dig' ? digX(s.i) : pwrX(s.i), SOCK_Y, s.hdr === 'dig' ? digZ : pwrZ);

  const pcb = rbox(UNO_W, 0.32, UNO_D, 0x0f7d86, 0.25, { roughness: 0.6 });
  pcb.position.set(ux0 + UNO_W / 2, UY - 0.16, uz0 + UNO_D / 2);
  g.add(pcb);
  for (const [fx, fz] of [[1.5, 1.5], [UNO_W - 1.5, 2], [1.5, UNO_D - 1.5], [UNO_W - 1.5, UNO_D - 2]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, UY - 0.32, 10), mat(0xdcdcdc));
    foot.position.set(ux0 + fx, (UY - 0.32) / 2, uz0 + fz);
    foot.userData.noInk = true;
    g.add(foot);
  }
  // printing on the board
  const ppu = 40;
  const silk = decal(UNO_W, UNO_D, (c, CW, CH) => {
    const s = CW / UNO_W;
    const X = (x) => (x - ux0) * s;
    const Z = (z) => (z - uz0) * s;
    c.clearRect(0, 0, CW, CH);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const pinLabel = (x, z, name, used, below) => {
      const t = (PWM.has(name) ? '~' : '') + name;
      c.save();
      c.translate(X(x), Z(z));
      c.rotate(-Math.PI / 2);
      c.font = `700 ${s * 0.52}px ui-monospace, "IBM Plex Mono", Menlo, monospace`;
      const w = c.measureText(t).width + s * 0.3;
      const ax = below ? -w / 2 : w / 2; // text grows away from the header
      if (used) {
        c.fillStyle = '#2E7D46';
        c.beginPath();
        c.roundRect(ax - w / 2, -s * 0.38, w, s * 0.76, s * 0.18);
        c.fill();
      }
      c.fillStyle = used ? '#ffffff' : 'rgba(255,255,255,.88)';
      c.fillText(t, ax, s * 0.03);
      c.restore();
    };
    DIG.forEach((nm, i) => nm && pinLabel(digX(i), digZ + 0.75, nm, usedS.has('dig' + i), true));
    PWR.forEach((nm, i) => nm && pinLabel(pwrX(i), pwrZ - 0.75, nm, usedS.has('pwr' + i), false));
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.font = `600 ${s * 0.55}px Rubik, Arial, sans-serif`;
    c.fillText('DIGITAL (PWM ~)', X(digX(9)), Z(digZ + 3.2));
    c.fillText('POWER', X(pwrX(3)), Z(pwrZ - 3.1));
    c.fillText('ANALOG IN', X(pwrX(10.5)), Z(pwrZ - 3.1));
    c.font = `800 ${s * 2.1}px Rubik, Arial, sans-serif`;
    c.fillText('UNO', X(ux0 + 17), Z(uz0 + 8.6));
    c.font = `700 ${s * 0.95}px Rubik, Arial, sans-serif`;
    c.fillText('ARDUINO', X(ux0 + 17), Z(uz0 + 6.6));
  }, { px: Math.round(UNO_D * ppu) });
  silk.rotation.x = -Math.PI / 2;
  silk.position.set(ux0 + UNO_W / 2, UY + 0.006, uz0 + UNO_D / 2);
  silk.material.depthWrite = false;
  g.add(silk);

  // headers: black blocks, sockets as one instanced mesh
  const hdrMat = mat(0x1d1e22, { roughness: 0.6 });
  const block = (x0, n, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(n, HDR_H, 0.95), hdrMat);
    m.position.set(x0 + (n - 1) / 2, UY + HDR_H / 2, z);
    m.castShadow = true;
    g.add(m);
  };
  block(digX(0), 10, digZ);
  block(digX(11), 8, digZ);
  block(pwrX(0), 7, pwrZ);
  block(pwrX(8), 6, pwrZ);
  const socks = [];
  DIG.forEach((nm, i) => nm && socks.push({ hdr: 'dig', i, name: nm }));
  PWR.forEach((nm, i) => nm && socks.push({ hdr: 'pwr', i, name: nm }));
  const sockMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.04, 0.46), new THREE.MeshBasicMaterial({ color: 0xffffff }), socks.length);
  const m4 = new THREE.Matrix4();
  const sockBase = new THREE.Color(0x050505);
  const sockIndex = {};
  socks.forEach((s, k) => {
    const p = sockPos(s);
    m4.makeTranslation(p.x, SOCK_Y + 0.01, p.z);
    sockMesh.setMatrixAt(k, m4);
    sockMesh.setColorAt(k, sockBase);
    sockIndex[s.hdr + s.i] = k;
  });
  sockMesh.userData.noGlow = true;
  sockMesh.userData.socks = socks;
  g.add(sockMesh);

  // USB socket, power jack, the chip, a reset button
  const usb = rbox(6.2, 4.3, 4.7, 0xc9ccd1, 0.1, { metalness: 0.6, roughness: 0.35 });
  usb.position.set(ux0 + 2.1, UY + 2.15, uz0 + 6.0);
  const usbHole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 3.0), mat(0x2a2b30));
  usbHole.position.set(ux0 - 1.0, UY + 2.15, uz0 + 6.0);
  usbHole.userData.noInk = true;
  const jack = rbox(5.6, 4.3, 3.6, 0x1d1e22, 0.12);
  jack.position.set(ux0 + 1.9, UY + 2.15, uz0 + 16.4);
  const chip = rbox(14.2, 1.3, 3.0, 0x1d1e22, 0.08);
  chip.position.set(ux0 + 18.2, UY + 0.65, uz0 + 14.6);
  const dent = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), mat(0x121316));
  dent.rotation.x = -Math.PI / 2;
  dent.position.set(ux0 + 11.8, UY + 1.31, uz0 + 14.6);
  dent.userData.noInk = true;
  const reset = rbox(1.6, 0.8, 1.6, 0xc9ccd1, 0.08, { metalness: 0.5 });
  reset.position.set(ux0 + 7.6, UY + 0.4, uz0 + 3.6);
  const resetCap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 14), mat(0xca1f3f));
  resetCap.position.set(ux0 + 7.6, UY + 1.0, uz0 + 3.6);
  g.add(usb, usbHole, jack, chip, dent, reset, resetCap);
  // the chip's legs, as two thin strips
  for (const s of [-1, 1]) {
    const legs = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.3, 0.3), mat(0xc9ccd1, { metalness: 0.6 }));
    legs.position.set(ux0 + 18.2, UY + 0.2, uz0 + 14.6 + s * 1.65);
    legs.userData.noInk = true;
    g.add(legs);
  }
  g.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { group: g, pcb, sockMesh, sockIndex, sockBase, socks, sockPos, used: usedS };
}

// ---------- the lab ----------
export default function buildLab(stage, ui, host, W) {
  const { THREE: T3, scene } = stage;
  void T3;
  const { b, parts, terms, conductors, board, uno } = W;
  scene.add(W.world);

  // ---- electrical nets: holes in a strip, rails, wires, the Arduino's GND ----
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  const unite = (a, c) => parent.set(find(a), find(c));
  conductors.forEach((c) => unite(c.a, c.b));
  terms.forEach((t) => find(t.node));
  const netOf = (node) => find(node);
  const nodesIn = (net) => [...parent.keys()].filter((n) => find(n) === net);

  // How you get from one node to the others in its net: breadth first over the wires.
  function paths(node) {
    const adj = new Map();
    conductors.forEach((c) => {
      if (!adj.has(c.a)) adj.set(c.a, []);
      if (!adj.has(c.b)) adj.set(c.b, []);
      adj.get(c.a).push([c.b, c]);
      adj.get(c.b).push([c.a, c]);
    });
    const via = new Map([[node, null]]);
    const q = [node];
    while (q.length) {
      const n = q.shift();
      for (const [m, c] of adj.get(n) || []) if (!via.has(m)) { via.set(m, { from: n, c }); q.push(m); }
    }
    return via;
  }

  // ---- highlighting ----
  const holeMesh = board.holes;
  const ids = holeMesh.userData.ids;
  const gold = new T3.Color();
  let xray = false;
  let sel = null; // { kind: 'part'|'hole'|'sock', ... }

  function stripNodesOfNet(net) {
    return nodesIn(net).filter((n) => /^[TB]\d+$/.test(n) || RAILS.includes(n));
  }
  function paint(nets) {
    // nets: [{ net, colour, primary: node }]
    for (let k = 0; k < ids.length; k++) holeMesh.setColorAt(k, board.base);
    for (const k of Object.values(board.stripIndex)) board.colStrips.setColorAt(k, board.silver);
    for (const r of RAILS) { board.railStrips[r].material.color.copy(board.silver); board.railStrips[r].material.emissive.setHex(0); }
    if (uno) for (let k = 0; k < uno.socks.length; k++) uno.sockMesh.setColorAt(k, uno.sockBase);
    const touched = new Set();
    for (const { net, colour } of nets) {
      gold.set(colour);
      for (const n of stripNodesOfNet(net)) {
        if (RAILS.includes(n)) {
          const rm = board.railStrips[n];
          rm.material.color.copy(gold);
          rm.material.emissive.copy(gold).multiplyScalar(0.35);
          for (let c = b.c0; c <= b.c1; c++) holeMesh.setColorAt(board.railIndex[n + c], gold);
        } else {
          board.colStrips.setColorAt(board.stripIndex[n], gold);
          const c = +n.slice(1);
          for (const row of n[0] === 'T' ? 'fghij' : 'abcde') holeMesh.setColorAt(board.holeIndex[row + c], gold);
        }
      }
      if (uno) {
        for (const n of nodesIn(net)) {
          if (n === 'GND' || n.startsWith('P:')) {
            uno.socks.forEach((s, k) => { if (sockNode(s) === n && (n !== 'GND' || uno.used.has(s.hdr + s.i) || true)) uno.sockMesh.setColorAt(k, gold); });
          }
        }
      }
      conductors.forEach((c) => { if (find(c.a) === net) touched.add(c.part); });
      terms.forEach((t) => { if (find(t.node) === net) touched.add(t.part); });
    }
    holeMesh.instanceColor.needsUpdate = true;
    board.colStrips.instanceColor.needsUpdate = true;
    if (uno) uno.sockMesh.instanceColor.needsUpdate = true;
    return touched;
  }

  function setEmissive(group, hex, k = 1) {
    group.traverse((m) => {
      if (!m.isMesh || m.userData.isInk || !m.material || !('emissive' in m.material)) return;
      if (m.userData.em0 === undefined) { m.userData.em0 = m.material.emissive.getHex(); m.userData.ei0 = m.material.emissiveIntensity; }
      if (hex === null) { m.material.emissive.setHex(m.userData.em0); m.material.emissiveIntensity = m.userData.ei0; } else { m.material.emissive.set(hex); m.material.emissiveIntensity = k; }
    });
  }
  function setGhost(group, on) {
    group.traverse((m) => {
      if (m.userData.isInk) { m.visible = !on; return; }
      if (!m.isMesh || !m.material || m.isInstancedMesh) return;
      const mt = m.material;
      if (m.userData.op0 === undefined) { m.userData.op0 = mt.opacity; m.userData.tr0 = mt.transparent; m.userData.dw0 = mt.depthWrite; }
      const want = on ? Math.min(m.userData.op0, 0.2) : m.userData.op0;
      if (mt.opacity !== want || mt.transparent !== (on || m.userData.tr0)) {
        mt.opacity = want;
        mt.transparent = on || m.userData.tr0;
        mt.depthWrite = on ? false : m.userData.dw0;
        mt.needsUpdate = true;
      }
    });
  }

  function refresh() {
    let nets = [];
    let lit = new Set();
    if (sel?.kind === 'part') {
      const own = terms.filter((t) => t.part === sel.i);
      const seen = new Map();
      own.forEach((t) => { const n = netOf(t.node); if (!seen.has(n)) seen.set(n, PAL[seen.size % PAL.length]); });
      nets = [...seen].map(([net, colour]) => ({ net, colour }));
      if (parts.find((p) => p.i === sel.i)?.isWire) nets = nets.slice(0, 1).map((x) => ({ ...x, colour: PAL[0] }));
    } else if (sel?.node) {
      nets = [{ net: netOf(sel.node), colour: PAL[0] }];
    }
    lit = paint(nets);
    const colourOfPart = new Map();
    for (const p of parts) {
      const mine = sel?.kind === 'part' && sel.i === p.i;
      setEmissive(p.group, mine ? 0x6b4a00 : null, mine ? 0.55 : 1);
      setGhost(p.group, xray && !!sel && !lit.has(p.i) && !mine);
      if (xray && !sel) setGhost(p.group, false);
      void colourOfPart;
    }
    // X-ray: see-through board, strips showing
    board.strips.visible = xray;
    board.bodyMat.transparent = xray;
    board.bodyMat.opacity = xray ? 0.28 : 1;
    board.bodyMat.depthWrite = !xray;
    board.bodyMat.needsUpdate = true;
    board.print.material.opacity = xray ? 0.75 : 1;
    board.groove.visible = !xray;
    stage.invalidate();
  }

  // ---- words for the side panel ----
  const partName = (t) => {
    const p = parts.find((q) => q.i === t.part);
    return p ? p.title : 'part';
  };
  function joinsOf(node, exceptPart) {
    const net = netOf(node);
    const via = paths(node);
    const items = [];
    for (const t of terms) {
      if (t.part === exceptPart || find(t.node) !== net) continue;
      const p = parts.find((q) => q.i === t.part);
      if (!p || p.isWire) continue;
      const hop = via.get(t.node);
      let how;
      if (t.node === node) how = /^[TB]/.test(node) ? 'same five-hole strip' : 'same rail';
      else {
        // name the wires on the way, from this node outwards
        const chain = [];
        for (let n = t.node, v = via.get(n); v; n = v.from, v = via.get(n)) chain.unshift(parts.find((q) => q.i === v.c.part)?.short ?? 'a wire');
        how = 'through ' + chain.join(', then ');
      }
      void hop;
      items.push(`${esc(p.title)}, ${esc(t.leg)}${isHole(t.at) ? ` <code>${t.at}</code>` : ''} <span class="lab-how">(${esc(how)})</span>`);
    }
    // the Arduino and rails reached through wires
    for (const [n, v] of via) {
      if (!v) continue;
      if (n === 'GND' || n.startsWith('P:') || RAILS.includes(n)) {
        const chain = [];
        for (let m = n, w = via.get(m); w; m = w.from, w = via.get(m)) chain.unshift(parts.find((q) => q.i === w.c.part)?.short ?? 'a wire');
        items.push(`<b>${esc(nodeName(n))}</b> <span class="lab-how">(through ${esc(chain.join(', then '))})</span>`);
      }
    }
    if (RAILS.includes(node) && !items.length) items.push('nothing else');
    return items;
  }

  const intro = () => {
    ui.info(b.title || 'This build in 3D', `<p>The same build as the flat picture, in 3D. Drag to turn it, pinch or scroll to zoom.</p>
      <p><b>Click any part, wire or hole</b> to see what it is and what it is joined to. Turn on <b>X-ray</b> to see the metal strips hidden inside the board.</p>`);
  };

  function showPart(p) {
    const own = terms.filter((t) => t.part === p.i && !t.source);
    let joins = '';
    if (!p.isWire) {
      const seen = new Map();
      own.forEach((t) => { const n = netOf(t.node); if (!seen.has(n)) seen.set(n, PAL[seen.size % PAL.length]); });
      joins = own.map((t) => {
        const list = joinsOf(t.node, p.i);
        const dot = xray ? `<span class="lab-dot" style="background:${seen.get(netOf(t.node))}"></span>` : '';
        return `<li>${dot}<b>${esc(cap(t.leg))}</b>${isHole(t.at) ? ` <code>${t.at}</code>` : ''}: ${list.length ? list.join('; ') : '<span class="lab-how">nothing else in this build</span>'}</li>`;
      }).join('');
    } else {
      const t = own[0];
      const list = t ? joinsOf(t.node, p.i) : [];
      joins = `<li>${list.length ? list.join('; ') : 'nothing else'}</li>`;
    }
    ui.info(p.title, `<p class="lab-where">${p.where}</p><p>${p.what}</p>
      <div class="lab-joins"><b>${p.isWire ? 'This wire joins' : 'Joined to'}</b><ul>${joins}</ul></div>
      ${xray ? '' : '<p class="lab-tip">Turn on <b>X-ray</b> to see the metal that does the joining.</p>'}`);
  }

  function showHole(info) {
    if (info.kind === 'hole') {
      const { name, col } = info;
      const top = 'fghij'.includes(name[0]);
      const five = (top ? 'fghij' : 'abcde').split('').map((r) => r + col);
      const node = holeNode(name);
      const list = joinsOf(node, -1);
      ui.info(`Hole ${name}`, `<p>Under <code>${name}</code> is a metal strip that joins five holes: ${five.map((h) => `<code>${h}</code>`).join(' ')}. Anything in one of them is joined to anything in the others.</p>
        <p>${top ? 'Rows a to e, below the channel, are a different strip: nothing crosses the middle.' : 'Rows f to j, above the channel, are a different strip: nothing crosses the middle.'}</p>
        <div class="lab-joins"><b>In this build it is joined to</b><ul>${list.length ? list.map((x) => `<li>${x}</li>`).join('') : '<li>nothing: this strip is empty</li>'}</ul></div>`);
    } else {
      const { rail } = info;
      const other = rail.endsWith('top') ? 'bottom' : 'top';
      const list = joinsOf(rail, -1);
      const fed = b.fed.includes(rail);
      ui.info(`The ${railName(rail)}`, `<p>One long metal strip runs the whole length of this rail, so every hole along it is joined. It is <b>not</b> joined to the ${other} rails: the top pair and the bottom pair are separate.</p>
        <p>${fed ? 'In this build something feeds it.' : 'Nothing feeds this rail in this build, so it is dead metal.'}</p>
        <div class="lab-joins"><b>Joined to</b><ul>${list.map((x) => `<li>${x}</li>`).join('') || '<li>nothing</li>'}</ul></div>`);
    }
  }

  function showSock(s) {
    const node = sockNode(s);
    const list = joinsOf(node, -1);
    const kind = s.name === 'GND' ? 'Ground: the way back for every circuit. All the GND sockets are joined inside the Arduino.'
      : s.name === '5V' ? 'Steady 5 volts from the Arduino, for parts that need power.'
      : s.name === '3V3' ? '3.3 volts, for parts that need less than 5.'
      : s.name === 'VIN' ? 'The voltage coming in through the power jack.'
      : /^A\d$/.test(s.name) ? 'An analog input: the Arduino can read any voltage from 0 to 5V here, as a number from 0 to 1023.'
      : /^\d+$/.test(s.name) ? `A digital pin. The sketch can switch it on (5V) or off (0V), or read it.${PWM.has(s.name) ? ' The ~ means it can also dim, with analogWrite.' : ''}`
      : 'A pin on the Arduino.';
    ui.info(s.name === 'GND' ? 'GND socket' : /^\d+$/.test(s.name) ? `Pin ${s.name}` : `${s.name} socket`, `<p>${kind}</p>
      <div class="lab-joins"><b>In this build</b><ul>${list.length ? list.map((x) => `<li>${x}</li>`).join('') : '<li>nothing is plugged in here</li>'}</ul></div>`);
  }

  // ---- selection ----
  const cards = new Map();
  let selCard = null;
  function select(next, { glide = false } = {}) {
    sel = next;
    if (selCard) selCard.card.classList.remove('sel');
    selCard = null;
    partBtns.forEach((bt) => bt.setAttribute('aria-pressed', 'false'));
    if (!sel) intro();
    else if (sel.kind === 'part') {
      const p = parts.find((q) => q.i === sel.i);
      showPart(p);
      selCard = cards.get(p.i);
      selCard?.card.classList.add('sel');
      partBtns.get(p.i)?.setAttribute('aria-pressed', 'true');
      if (glide) stage.lookAt(p.focus.clone(), Math.max(stage.camera.zoom, tourZoom));
    } else if (sel.kind === 'hole') showHole(sel.info);
    else if (sel.kind === 'sock') showSock(sel.sock);
    refresh();
  }

  parts.forEach((p) => {
    stage.clickable(p.group, () => select(sel?.kind === 'part' && sel.i === p.i ? null : { kind: 'part', i: p.i }));
  });
  stage.clickable(holeMesh, (o, e, hit) => {
    const info = ids[hit.instanceId];
    if (!info) return;
    const node = info.kind === 'hole' ? holeNode(info.name) : info.rail;
    select({ kind: 'hole', info, node });
  });
  if (uno) {
    stage.clickable(uno.sockMesh, (o, e, hit) => {
      const s = uno.socks[hit.instanceId];
      if (s) select({ kind: 'sock', sock: s, node: sockNode(s) });
    });
    stage.clickable(uno.group, (o, e, hit) => {
      if (hit.object === uno.sockMesh) return;
      select(null);
      ui.info('Arduino Uno', `<p>The small computer that runs your sketch. It talks to the circuit through the sockets along its two long edges.</p>
        <p>The sockets near the board are the <b>digital pins</b>, 0 to 13. The far side has the <b>power</b> sockets (5V, GND) and the <b>analog inputs</b> A0 to A5. The pins this build uses are printed in green.</p>
        <p class="lab-tip">Click a socket to see what is plugged into it.</p>`);
    });
  }
  board.body.userData.noGlow = true;
  stage.clickable(board.body, () => {
    select(null);
    ui.info('Breadboard', `<p>Holes in a plastic block, with metal strips hidden inside. Each column of five holes is joined (f to j, and a to e). The long rails along the top and bottom edges are joined end to end. Nothing crosses the channel down the middle.</p>
      <p class="lab-tip">Click a hole, or turn on <b>X-ray</b>, to see which holes are joined.</p>`);
  });

  // ---- callout cards: a few always, one per part for the tour ----
  const tourZoom = Math.min(4, Math.max(1.6, (W.fitW || 40) / 26));
  if (uno) {
    stage.callout(uno.group, { title: 'Arduino Uno', text: 'Pins in use are green', at: [W.ux0 + 24, UY, W.uz0 + 12], dx: 150, dy: 30 });
  }
  const railUsed = RAILS.find((r) => b.fed.includes(r)) ?? '-top';
  stage.callout(board.group, { title: 'Breadboard', text: 'Columns of five are joined', at: [W.L.x1 - 0.3, BT, railUsed.endsWith('top') ? -2.7 : 13.7], dx: 150, dy: railUsed.endsWith('top') ? 10 : -10 });
  parts.forEach((p) => {
    const c = stage.callout(p.group, { title: p.title, text: cardText(p), at: p.focus.toArray(), dy: -60, quiet: true, data: p, onClick: () => select({ kind: 'part', i: p.i }) });
    cards.set(p.i, c);
  });

  // ---- side panel ----
  intro();
  const look = ui.group('Look inside');
  const xBtn = ui.button('X-ray: off', () => setX(!xray), { group: look, pressed: false });
  function setX(on) {
    xray = on;
    xBtn.textContent = on ? 'X-ray: on' : 'X-ray: off';
    xBtn.classList.toggle('active', on);
    xBtn.setAttribute('aria-pressed', String(on));
    if (sel?.kind === 'part') showPart(parts.find((q) => q.i === sel.i));
    else if (!sel && on) ui.info('X-ray', `<p>The plastic is see-through now. The silver bars are the metal strips inside: <b>one strip under each column of five holes</b>, and one long strip under each rail.</p>
      <p>Look at the channel down the middle: no metal crosses it. And the top rails and bottom rails are separate strips.</p><p class="lab-tip">Click a hole or a part to light up everything joined to it.</p>`);
    refresh();
  }
  const find_ = ui.element(`<form class="lab-find"><label>Find a hole <input name="h" size="5" autocomplete="off" spellcheck="false" placeholder="f5" aria-describedby="${host.id || ''}"></label> <button type="submit" class="lab-btn">Show</button><span class="lab-find-msg" role="status"></span></form>`, look);
  const form = find_.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.h.value.trim().toLowerCase().replace(/\s+/g, '');
    const msg = form.querySelector('.lab-find-msg');
    const p = parse(v);
    if (!p || p.col < b.c0 || p.col > b.c1) {
      msg.textContent = p ? ` This picture shows columns ${b.c0} to ${b.c1}.` : ' Type a row letter and a column number, like f5.';
      return;
    }
    msg.textContent = '';
    const info = { kind: 'hole', name: v, col: p.col };
    select({ kind: 'hole', info, node: holeNode(v) });
    stage.lookAt(W.L.hole(v), Math.max(stage.camera.zoom, tourZoom));
  });

  const list = ui.element(`<details class="lab-parts" ${window.innerWidth > 900 ? 'open' : ''}><summary>Parts in this build (${parts.length})</summary><div class="lab-group lab-partlist"></div></details>`);
  const partsBox = list.querySelector('.lab-partlist');
  const partBtns = new Map();
  parts.forEach((p) => {
    const bt = ui.button(p.short, () => select(sel?.kind === 'part' && sel.i === p.i ? null : { kind: 'part', i: p.i }, { glide: true }), { group: partsBox, pressed: false });
    bt.classList.add('lab-part');
    partBtns.set(p.i, bt);
  });

  // ---- keyboard ----
  W.onKey = (e) => {
    if (e.key === 'x' || e.key === 'X') { setX(!xray); return true; }
    if (e.key === 'Escape') { select(null); return true; }
    return false;
  };

  // ---- the tour picks each part as it reaches it ----
  W.onTour = (c) => {
    if (!c) { select(null); return; }
    if (c.data) select({ kind: 'part', i: c.data.i });
  };

  // ---- dark mode: the "ink" wires follow the page's text colour ----
  const retint = () => {
    const hex = inkHex(host);
    W.inkMats.forEach((m) => m.color.setHex(hex));
    stage.invalidate();
  };
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => setTimeout(retint, 50));
  new MutationObserver(() => setTimeout(retint, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  refresh();
  host.dispatchEvent(new CustomEvent('lab-ready', { bubbles: true, detail: { lab: 'build', build: host.dataset.build } }));
}

// ---------- camera framing, from the finished world ----------
export function config(W) {
  const elev = THREE.MathUtils.degToRad(46);
  const box = new THREE.Box3().setFromObject(W.world);
  const cs = Math.cos(elev), sn = Math.sin(elev);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = y * cs - z * sn;
    u0 = Math.min(u0, x); u1 = Math.max(u1, x);
    v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const fitW = (u1 - u0) * 1.04 + 1.5;
  const fitH = (v1 - v0) * 1.04 + 1.5;
  W.fitW = fitW;
  const uc = (u0 + u1) / 2;
  const vc = (v0 + v1) / 2;
  const target = [uc, 0, -vc / sn];
  const D = 160;
  const camera = [target[0], D * sn, target[2] + D * cs];
  const size = box.getSize(new THREE.Vector3());
  const half = Math.max(size.x, size.z) / 2 + 4;
  return {
    camera, target, fit: [fitW, fitH], pan: true, minZoom: 0.7, maxZoom: 8,
    tourZoom: Math.min(4, Math.max(1.6, fitW / 26)),
    shadowSize: half, groundSize: half * 1.6, sun: [half * 0.25, 90, half * 0.5], maxPolar: Math.PI * 0.45,
    onKey: (e) => W.onKey?.(e), onTour: (c) => W.onTour?.(c),
    label: `3D model of ${W.b.title || 'this build'}. Arrow keys turn it, plus and minus zoom, 0 resets, X turns X-ray on and off, Escape clears the selection.`,
  };
}

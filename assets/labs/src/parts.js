// 3D models for the parts the wiring diagrams use (tools/bbdraw.py).
// One world unit is one breadboard pitch: 0.1 inch, 2.54 mm.
import { THREE, mat, rbox, cable, decal } from './runtime.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';
const SANS = 'Rubik, "Archivo", "Segoe UI", Arial, sans-serif';

export const METAL = 0xb8bcc2;
export const PLASTIC_BLACK = 0x26272b;

// Shared geometries (one outline geometry each, too).
const G = {
  housing: new THREE.BoxGeometry(0.62, 1.5, 0.62),
  pin: new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6),
};

export function shadowAll(o, cast = true, receive = true) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}

// A thin bent wire leg (LED, resistor...), through points.
export function leg(points, color = METAL, r = 0.075) {
  const m = cable(points, color, r, 12);
  m.material.metalness = 0.6;
  m.material.roughness = 0.35;
  m.userData.noInk = true;
  m.castShadow = false;
  return m;
}

// ---------- jumper wires ----------
// A jumper: a plastic housing at each end, a soft curved cable between.
// ends: [{p: Vector3 (where the pin goes in), up: true}], path: Vector3 list
export function jumper(path, color, { r = 0.2, ends = [true, true] } = {}) {
  const g = new THREE.Group();
  const c = cable(path, color, r, Math.max(28, path.length * 8));
  c.userData.noHull = false;
  g.add(c);
  const hm = mat(PLASTIC_BLACK, { roughness: 0.6 });
  [0, path.length - 1].forEach((k, j) => {
    if (!ends[j]) return;
    const p = path[k];
    const h = new THREE.Mesh(G.housing, hm);
    h.position.set(p.x, p.y - 0.75, p.z);
    h.castShadow = true;
    g.add(h);
  });
  g.userData.cable = c;
  return g;
}

// ---------- resistor colour code ----------
export const BAND_HEX = ['#1b1b1b', '#7b4a24', '#d1342b', '#f07c12', '#f4c430', '#2f9a48', '#2f6fd0', '#8040b0', '#8d8d8d', '#f6f6f6'];
export const BAND_NAMES = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
export const GOLD = '#c9a43a';

export function ohms(label) {
  const m = String(label).trim().match(/^([\d.]+)\s*([kKmM]?)/);
  if (!m) return 220;
  let v = parseFloat(m[1]);
  if (/k/i.test(m[2])) v *= 1e3;
  if (m[2] === 'M') v *= 1e6;
  return Math.round(v);
}

// Four-band code: two digits, then how many zeros, then gold (5%).
export function bands(value) {
  let v = value;
  let zeros = 0;
  while (v >= 100) { v /= 10; zeros++; }
  v = Math.round(v);
  if (v < 10) { v *= 10; zeros--; }
  const d1 = Math.floor(v / 10);
  const d2 = v % 10;
  return [d1, d2, Math.max(0, zeros)];
}

export function ohmText(value) {
  if (value >= 1e6) return (value / 1e6).toString().replace('.', '.') + ' MΩ';
  if (value >= 1e3) return (value / 1e3) + 'k Ω';
  return value + ' Ω';
}

// ---------- LED ----------
const LED_HEX = { red: 0xe23b2a, green: 0x2fae55, yellow: 0xf4c21e, blue: 0x3a7ee0, white: 0xf4f1ea };

// at: the two hole tops (anode, cathode). Body floats above their midpoint.
export function led(a, c, colour, top) {
  const g = new THREE.Group();
  const col = LED_HEX[colour] ?? LED_HEX.red;
  const mid = a.clone().add(c).multiplyScalar(0.5);
  const baseY = top + 2.3;
  const body = new THREE.Group();
  body.position.set(mid.x, baseY, mid.z);
  const lens = mat(col, { roughness: 0.25, transparent: true, opacity: 0.92, emissive: col, emissiveIntensity: 0.08 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.26, 28), lens);
  rim.position.y = 0.13;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 1.25, 28, 1, true), lens);
  can.position.y = 0.26 + 0.62;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.98, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = 0.26 + 1.25;
  body.add(rim, can, dome);
  // the flat on the rim marks the short (cathode) leg side
  const dir = c.clone().sub(a).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 1.5), mat(0xffffff, { transparent: true, opacity: 0.5 }));
  flat.userData.noInk = true;
  flat.position.set(dir.x * 1.06, 0.13, dir.z * 1.06);
  flat.rotation.y = Math.atan2(-dir.z, dir.x);
  body.add(flat);
  g.add(body);
  const la = V(mid.x - dir.x * 0.5, baseY, mid.z - dir.z * 0.5);
  const lc = V(mid.x + dir.x * 0.5, baseY, mid.z + dir.z * 0.5);
  // The long leg (anode) has a little crank in it, as in most drawings.
  const k = V((a.x + la.x) / 2 - dir.x * 0.35, top + 1.2, (a.z + la.z) / 2 - dir.z * 0.35);
  g.add(leg([a, V(a.x, top + 0.5, a.z), k, V(la.x, baseY - 0.4, la.z), la], 0xc9ccd1, 0.085));
  g.add(leg([c, V(c.x, top + 0.5, c.z), V(lc.x, baseY - 0.4, lc.z), lc], 0xc9ccd1, 0.07));
  g.userData.anodeMark = V(k.x - dir.x * 0.8, top + 1.4, k.z - dir.z * 0.8);
  g.userData.top = V(mid.x, baseY + 2.4, mid.z);
  g.userData.lens = lens;
  return g;
}

// A four-leg RGB LED: milky dome, legs fanned to four holes. The long leg is
// the shared one (index `long`).
export function rgbLed(holes, top, long = 1) {
  const g = new THREE.Group();
  const mid = holes.reduce((s, h) => s.add(h), V(0, 0, 0)).multiplyScalar(1 / holes.length);
  const baseY = top + 2.6;
  const lens = mat(0xf3f0ea, { roughness: 0.3, transparent: true, opacity: 0.93 });
  const body = new THREE.Group();
  body.position.set(mid.x, baseY, mid.z);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.26, 28), lens);
  rim.position.y = 0.13;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 1.3, 28, 1, true), lens);
  can.position.y = 0.9;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.98, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = 1.55;
  body.add(rim, can, dome);
  // three little dies inside: red, green, blue
  [0xe23b2a, 0x2fae55, 0x3a7ee0].forEach((c, i) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat(c, { emissive: c, emissiveIntensity: 0.4 }));
    d.position.set((i - 1) * 0.4, 0.9, 0);
    d.userData.noInk = true;
    body.add(d);
  });
  g.add(body);
  holes.forEach((h, i) => {
    const off = (i - (holes.length - 1) / 2) * 0.45;
    const lx = mid.x + off;
    const pts = [h, V(h.x, top + 0.5, h.z)];
    if (i === long) pts.push(V((h.x + lx) / 2 - 0.3, top + 1.3, h.z));
    pts.push(V(lx, baseY - 0.4, mid.z), V(lx, baseY, mid.z));
    g.add(leg(pts, 0xc9ccd1, i === long ? 0.085 : 0.07));
  });
  g.userData.top = V(mid.x, baseY + 2.6, mid.z);
  return g;
}

// ---------- resistor ----------
export function resistor(a, b, value, top) {
  const g = new THREE.Group();
  const span = Math.hypot(b.x - a.x, b.z - a.z);
  const [d1, d2, m] = bands(value);
  const cols = [BAND_HEX[d1], BAND_HEX[d2], BAND_HEX[m], GOLD];
  const bodyMat = mat(0xdcc596, { roughness: 0.6 });
  const L = 2.2;
  const R = 0.38;
  const make = () => {
    const bg = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L * 0.62, 20), bodyMat);
    cyl.rotation.z = Math.PI / 2;
    bg.add(cyl);
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.SphereGeometry(R * 1.22, 20, 12), bodyMat);
      end.scale.set(1.15, 1, 1);
      end.position.x = s * L * 0.36;
      bg.add(end);
    }
    // bands: three value bands near one end, gold apart at the other
    const at = [-0.72, -0.42, -0.12, 0.62];
    cols.forEach((c, i) => {
      const r = i === 0 || i === 3 ? R * 1.24 : R * 1.03;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 20), mat(new THREE.Color(c).getHex(), { roughness: 0.5 }));
      band.rotation.z = Math.PI / 2;
      band.position.x = at[i];
      band.userData.noInk = true;
      bg.add(band);
    });
    return bg;
  };
  const body = make();
  const dir = b.clone().sub(a).setY(0).normalize();
  const ang = Math.atan2(-dir.z, dir.x);
  if (span >= 2.9) {
    // lying flat, legs bent down at each end
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const y = top + 1.5;
    body.position.set(mid.x, y, mid.z);
    body.rotation.y = ang;
    const e = L / 2 + 0.05;
    const pa = V(mid.x - dir.x * e, y, mid.z - dir.z * e);
    const pb = V(mid.x + dir.x * e, y, mid.z + dir.z * e);
    g.add(leg([a, V(a.x, top + 0.6, a.z), V(a.x, y - 0.25, a.z), pa], 0xc9ccd1, 0.07));
    g.add(leg([b, V(b.x, top + 0.6, b.z), V(b.x, y - 0.25, b.z), pb], 0xc9ccd1, 0.07));
    g.userData.top = V(mid.x, y + 1, mid.z);
  } else {
    // standing up over the first hole, the top lead bent over to the second
    body.rotation.z = Math.PI / 2;
    const ry = top + 0.6 + L / 2;
    body.position.set(a.x, ry, a.z);
    body.rotation.y = 0;
    const wrapG = new THREE.Group();
    wrapG.add(body);
    g.add(wrapG);
    const tp = V(a.x, ry + L / 2 + 0.1, a.z);
    g.add(leg([a, V(a.x, top + 0.3, a.z), V(a.x, ry - L / 2, a.z)], 0xc9ccd1, 0.07));
    const over = V((a.x + b.x) / 2, tp.y + 0.9, (a.z + b.z) / 2);
    g.add(leg([tp, V(a.x, tp.y + 0.6, a.z), over, V(b.x, tp.y + 0.2, b.z), V(b.x, top + 0.6, b.z), b], 0xc9ccd1, 0.07));
    g.userData.top = V(a.x, ry + L / 2 + 1.2, a.z);
    g.userData.standing = true;
    return g;
  }
  g.add(body);
  return g;
}

// ---------- push button ----------
export function button(holes, top) {
  const g = new THREE.Group();
  const xs = holes.map((h) => h.x);
  const zs = holes.map((h) => h.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const w = Math.max(2.6, Math.max(...xs) - Math.min(...xs) + 0.5);
  const d = Math.max(2.6, Math.max(...zs) - Math.min(...zs) - 0.3);
  const y0 = top + 0.35;
  const base = rbox(w, 1.0, d, 0x2c2d31, 0.12);
  base.position.set(cx, y0 + 0.5, cz);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.08, d * 0.92), mat(METAL, { metalness: 0.6, roughness: 0.35 }));
  plate.position.set(cx, y0 + 1.04, cz);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.7, 24), mat(0x3a3b40, { roughness: 0.5 }));
  cap.position.set(cx, y0 + 1.4, cz);
  g.add(base, plate, cap);
  for (const h of holes) {
    const ex = cx + Math.sign(h.x - cx) * (w / 2 - 0.15);
    g.add(leg([h, V(h.x, top + 0.2, h.z), V(ex, y0 + 0.1, h.z + Math.sign(cz - h.z) * 0.3)], 0xc9ccd1, 0.08));
  }
  g.userData.top = V(cx, y0 + 2.2, cz);
  g.userData.cap = cap;
  return g;
}

// ---------- potentiometer (the knob) ----------
export function pot(holes, top, awayZ) {
  const g = new THREE.Group();
  const xs = holes.map((h) => h.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const hz = holes[0].z;
  const cz = hz + awayZ * 1.55;
  const w = Math.max(...xs) - Math.min(...xs) + 1.7;
  const y0 = top + 0.45;
  const body = rbox(w, 1.3, 2.9, 0x2f5f9e, 0.12);
  body.position.set(cx, y0 + 0.65, cz);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 20), mat(METAL, { metalness: 0.6, roughness: 0.35 }));
  ring.position.set(cx, y0 + 1.55, cz);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 1.3, 24), mat(0x2a2b30));
  knob.position.set(cx, y0 + 2.4, cz);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.8), mat(0xf6f6f6));
  mark.position.set(cx, y0 + 3.07, cz + 0.45);
  mark.userData.noInk = true;
  g.add(body, ring, knob, mark);
  for (const h of holes) g.add(leg([h, V(h.x, top + 0.2, h.z), V(h.x, y0 + 0.2, hz + awayZ * 0.4)], 0xc9ccd1, 0.08));
  g.userData.top = V(cx, y0 + 3.4, cz);
  return g;
}

// ---------- buzzer ----------
export function buzzer(plus, minus, top, towardZ) {
  const g = new THREE.Group();
  const mid = plus.clone().add(minus).multiplyScalar(0.5);
  const cz = mid.z + towardZ * 1.1;
  const y0 = top + 0.9;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 1.6, 32), mat(0x1f2024, { roughness: 0.6 }));
  body.position.set(mid.x, y0 + 0.8, cz);
  const holeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), mat(0x050505));
  holeTop.position.set(mid.x, y0 + 1.62, cz);
  holeTop.userData.noInk = true;
  g.add(body, holeTop);
  const plusMark = decal(0.8, 0.8, (c, W, H) => {
    c.fillStyle = '#f2f2f2';
    c.font = `bold ${H * 0.9}px ${SANS}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+', W / 2, H / 2);
  }, { px: 64 });
  plusMark.rotation.x = -Math.PI / 2;
  const dx = plus.x - minus.x;
  plusMark.position.set(mid.x + Math.sign(dx || -1) * 0.95, y0 + 1.61, cz);
  g.add(plusMark);
  g.add(leg([plus, V(plus.x, top + 0.3, plus.z), V(mid.x + Math.sign(dx || -1) * 0.6, y0, cz)], 0xc9ccd1, 0.085));
  g.add(leg([minus, V(minus.x, top + 0.3, minus.z), V(mid.x - Math.sign(dx || -1) * 0.6, y0, cz)], 0xc9ccd1, 0.07));
  g.userData.top = V(mid.x, y0 + 2.4, cz);
  return g;
}

// ---------- NPN transistor, TO-92 ----------
export function transistor(e, b, c, top) {
  const g = new THREE.Group();
  const holes = [e, b, c];
  const mid = b.clone();
  const y0 = top + 1.4;
  // half a cylinder: the flat face, with the printing, faces +z
  const shape = new THREE.CylinderGeometry(0.95, 0.95, 1.9, 24, 1, false, Math.PI / 2, Math.PI);
  const body = new THREE.Mesh(shape, mat(0x1c1d21, { roughness: 0.55, side: THREE.DoubleSide }));
  body.position.set(mid.x, y0 + 0.95, mid.z - 0.1);
  const face = decal(1.85, 1.8, (cx, W, H) => {
    cx.fillStyle = '#1c1d21';
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#d8d8d8';
    cx.textAlign = 'center';
    cx.font = `bold ${H * 0.16}px ${MONO}`;
    cx.fillText('NPN', W / 2, H * 0.3);
    cx.font = `bold ${H * 0.22}px ${MONO}`;
    cx.fillText('E  B  C', W / 2, H * 0.75);
  }, { px: 128, transparent: false });
  face.position.set(mid.x, y0 + 0.95, mid.z - 0.09);
  g.add(body, face);
  holes.forEach((h, i) => g.add(leg([h, V(h.x, top + 0.3, h.z), V(mid.x + (i - 1) * 0.5, y0, mid.z - 0.3)], 0xc9ccd1, 0.07)));
  g.userData.top = V(mid.x, y0 + 2.4, mid.z);
  return g;
}

// ---------- light sensor (LDR) ----------
export function ldr(a, b, top) {
  const g = new THREE.Group();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const y0 = top + 1.8;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.45, 28), mat(0xe9dcc0, { roughness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  disc.position.set(mid.x, y0 + 1.0, mid.z);
  const face = decal(1.7, 1.7, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.strokeStyle = '#c0541c';
    c.lineWidth = W * 0.07;
    c.beginPath();
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const y = H * (0.22 + (0.56 * i) / n);
      c.lineTo(i % 2 ? W * 0.25 : W * 0.75, y);
    }
    c.stroke();
  }, { px: 96 });
  face.position.set(mid.x, y0 + 1.0, mid.z + 0.24);
  g.add(disc, face);
  g.add(leg([a, V(a.x, top + 0.4, a.z), V(mid.x - 0.45, y0 + 0.2, mid.z)], 0xc9ccd1, 0.07));
  g.add(leg([b, V(b.x, top + 0.4, b.z), V(mid.x + 0.45, y0 + 0.2, mid.z)], 0xc9ccd1, 0.07));
  g.userData.top = V(mid.x, y0 + 2.4, mid.z);
  return g;
}

// ---------- diode (1N4001): black body, silver stripe at the cathode ----------
export function diode(plain, striped, top, lift = 2.2) {
  const g = new THREE.Group();
  const mid = plain.clone().add(striped).multiplyScalar(0.5);
  const dir = striped.clone().sub(plain).setY(0).normalize();
  const y = top + lift;
  const body = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.9, 18), mat(0x1c1d21));
  cyl.rotation.z = Math.PI / 2;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), mat(0xd9dde2, { metalness: 0.5, roughness: 0.3 }));
  stripe.rotation.z = Math.PI / 2;
  stripe.position.x = 0.7;
  stripe.userData.noInk = true;
  body.add(cyl, stripe);
  body.position.set(mid.x, y, mid.z);
  body.rotation.y = Math.atan2(-dir.z, dir.x);
  g.add(body);
  const pa = V(mid.x - dir.x * 1.0, y, mid.z - dir.z * 1.0);
  const pb = V(mid.x + dir.x * 1.0, y, mid.z + dir.z * 1.0);
  g.add(leg([plain, V(plain.x, top + 0.6, plain.z), V(plain.x, y - 0.3, plain.z).lerp(pa, 0.3), pa], 0xc9ccd1, 0.07));
  g.add(leg([striped, V(striped.x, top + 0.6, striped.z), V(striped.x, y - 0.3, striped.z).lerp(pb, 0.3), pb], 0xc9ccd1, 0.07));
  g.userData.top = V(mid.x, y + 1, mid.z);
  return g;
}

// ---------- printed text plate ----------
export function textPlate(w, h, lines, { bg = null, color = '#ffffff', font = SANS, weight = 600, size = 0.36, align = 'center', ppu = 110 } = {}) {
  const m = decal(w, h, (c, W, H) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, W, H); } else c.clearRect(0, 0, W, H);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const step = H / arr.length;
    arr.forEach((t, i) => {
      let fs = (size / h) * H;
      do c.font = `${weight} ${fs}px ${font}`;
      while (c.measureText(t).width > W * 0.94 && (fs -= 1) > 6);
      c.fillText(t, align === 'center' ? W / 2 : align === 'left' ? W * 0.03 : W * 0.97, step * (i + 0.5));
    });
  }, { px: Math.max(32, Math.min(256, Math.round(ppu * Math.min(w, h)))) });
  return m;
}

// A flat PCB with a printed name and a row of header pins along one edge.
// Returns the group and the pin tips (world positions once placed).
function pcbModule({ w, d, color, name, pins, pinEdge = 'top', thick = 0.25, y = 0.35, pinSpacing = 1 }) {
  const g = new THREE.Group();
  const board = rbox(w, thick, d, color, 0.08);
  board.position.y = y + thick / 2;
  g.add(board);
  const n = pins.length;
  const tips = [];
  const ez = pinEdge === 'top' ? -d / 2 + 0.6 : d / 2 - 0.6;
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(n * pinSpacing, 0.5, 0.62), mat(PLASTIC_BLACK));
  hdr.position.set(0, y + thick + 0.25, ez);
  g.add(hdr);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pinSpacing;
    const p = new THREE.Mesh(G.pin, mat(0xd4b04c, { metalness: 0.6, roughness: 0.35 }));
    p.position.set(x, y + thick + 0.75, ez);
    p.userData.noInk = true;
    g.add(p);
    tips.push(V(x, y + thick + 1.0, ez));
  }
  if (pins.some((p) => p)) {
    const lab = textPlate(n * pinSpacing, 0.55, [pins.join('   ')], { color: '#f4f4f4', size: 0.34, font: MONO, weight: 700 });
    // centred labels per pin: draw one plate per pin instead for accuracy
    lab.visible = false;
    for (let i = 0; i < n; i++) {
      if (!pins[i]) continue;
      const t = textPlate(Math.max(0.95, pinSpacing), 0.5, pins[i], { color: '#f4f4f4', size: 0.3, font: MONO, weight: 700 });
      t.rotation.x = -Math.PI / 2;
      t.position.set((i - (n - 1) / 2) * pinSpacing, y + thick + 0.01, ez + (pinEdge === 'top' ? 0.75 : -0.75));
      g.add(t);
    }
  }
  if (name) {
    const t = textPlate(w * 0.9, 0.9, name, { color: '#f4f4f4', size: 0.55, weight: 700 });
    t.rotation.x = -Math.PI / 2;
    t.position.set(0, y + thick + 0.012, pinEdge === 'top' ? d / 2 - 0.8 : -d / 2 + 0.8);
    g.add(t);
  }
  g.userData.tips = tips;
  return g;
}

// ---------- modules that stand off the board (bbdraw "mod" and "blk") ----------
// Each returns { group, tips: [local Vector3 per pin], w, d }.
export function moduleModel(label, pinNames) {
  const L = label.toLowerCase();
  const n = pinNames.length;
  if (L.startsWith('servo')) return servo(pinNames);
  if (L.startsWith('uln2003')) return uln2003(pinNames);
  if (L.startsWith('traffic')) return trafficModule(pinNames);
  if (L.startsWith('rgb module')) return rgbModule(pinNames);
  if (L.startsWith('lcd1602, i2c')) return lcd(pinNames, true);
  if (L.startsWith('lcd1602')) return lcd(pinNames, false);
  if (L.startsWith('hc-sr04')) return sonar(pinNames);
  if (L.startsWith('4x4 keypad')) return keypad(pinNames);
  if (L.startsWith('rain')) return rain(pinNames);
  if (L.startsWith('dht11')) return dht(pinNames, L.includes('bare'));
  if (L.startsWith('motor')) return motor();
  const w = Math.max(5, n * 1.2 + 2);
  const m = pcbModule({ w, d: 4, color: 0x1f5f9a, name: label, pins: pinNames });
  return { group: shadowAll(m), tips: m.userData.tips, w, d: 4, standing: false };
}

function servo(pins) {
  // SG90 lying on its side, output shaft towards you; a three-wire lead
  // (brown, red, orange, as on a real servo) ending in a 3-pin plug.
  const g = new THREE.Group();
  const bw = 9, bh = 4.8, bd = 9;
  const body = rbox(bw, bh, bd * 0.62, 0x2d6fb8, 0.25, { roughness: 0.45, transparent: true, opacity: 0.97 });
  body.position.set(0, bh / 2, 0.8);
  const ears = rbox(bw + 3, bh * 0.85, 0.5, 0x2d6fb8, 0.1, { roughness: 0.45 });
  ears.position.set(0, bh / 2, -0.1);
  const gear = rbox(bw * 0.55, bh * 0.92, 1.4, 0x2d6fb8, 0.3);
  gear.position.set(-bw * 0.18, bh / 2, 3.95);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16), mat(0xf2f2f2));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(-bw * 0.26, bh / 2, 5.0);
  const horn = rbox(5.6, 0.95, 0.4, 0xf4f4f4, 0.4);
  horn.position.set(-bw * 0.26, bh / 2, 5.6);
  const sticker = textPlate(5, 1.0, 'SG90 servo', { color: '#ffffff', size: 0.62, weight: 700 });
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(0.6, bh + 0.01, 0.6);
  g.add(body, ears, gear, shaft, horn, sticker);
  // the lead leaves the back of the case and ends in a plug
  const plug = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.6), mat(PLASTIC_BLACK));
  plug.position.set(bw / 2 + 2.6, 0.45, -3.2);
  g.add(plug);
  const leadCols = { orange: 0xf08a1c, red: 0xd9342b, brown: 0x6b3f22 };
  const tips = [];
  pins.forEach((p, i) => {
    const x = bw / 2 + 2.6 + (i - 1) * 0.8;
    const col = leadCols[p] ?? 0x555555;
    const c = cable([V(bw / 2 - 0.5, 1.6 + i * 0.05, 0.5 + (i - 1) * 0.3), V(bw / 2 + 1.5, 1.0, 0.2 + (i - 1) * 0.3), V(x, 0.7, -1.6), V(x, 0.6, -2.4)], col, 0.13, 24);
    c.userData.noHull = true;
    g.add(c);
    tips.push(V(x, 1.1, -3.6));
  });
  return { group: shadowAll(g), tips, w: bw + 7, d: 11, plugTips: true, zOff: 3.5 };
}

function uln2003(pins) {
  const g = new THREE.Group();
  const w = 9.5, d = 8.5;
  const m = pcbModule({ w, d, color: 0x2a7a44, name: 'ULN2003', pins });
  g.add(m);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.4), mat(0x1c1d21));
  chip.position.set(-1, 0.9, 0.6);
  g.add(chip);
  const sock = rbox(3.2, 1.2, 1.6, 0xf2f2f2, 0.08);
  sock.position.set(2.6, 1.2, 2.6);
  g.add(sock);
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), mat(0xe23b2a, { emissive: 0xe23b2a, emissiveIntensity: 0.2 }));
    l.position.set(-3.8 + i * 0.8, 0.75, 2.4);
    g.add(l);
  }
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

function trafficModule(pins) {
  const g = new THREE.Group();
  const w = Math.max(5, pins.length * 1.1 + 1), d = 7.5;
  const m = pcbModule({ w, d, color: 0x1e1f23, name: '', pins });
  g.add(m);
  [0xe23b2a, 0xf4c21e, 0x2fae55].forEach((c, i) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.0, 20), mat(c, { roughness: 0.3, emissive: c, emissiveIntensity: 0.1 }));
    l.position.set(0, 1.1, -1.1 + i * 2.0);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), l.material);
    dm.position.set(0, 1.6, -1.1 + i * 2.0);
    g.add(l, dm);
  });
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

function rgbModule(pins) {
  const g = new THREE.Group();
  const w = Math.max(5, pins.length * 1.1 + 1), d = 5;
  const m = pcbModule({ w, d, color: 0x1e1f23, name: 'RGB', pins });
  g.add(m);
  const lens = mat(0xf3f0ea, { roughness: 0.3, transparent: true, opacity: 0.93 });
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.0, 20), lens);
  l.position.set(0, 1.1, 0.4);
  const dm = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dm.position.set(0, 1.6, 0.4);
  g.add(l, dm);
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

function lcd(pins, i2c) {
  const g = new THREE.Group();
  if (i2c) {
    // lying flat, screen up, the I2C backpack's four pins on the left edge
    const w = 18, d = 7.8;
    const board = rbox(w, 0.25, d, 0x1f7a3d, 0.08);
    board.position.y = 0.45;
    const frame = rbox(14.5, 0.8, 5.4, 0x1c1d21, 0.1);
    frame.position.set(0.9, 0.95, 0);
    const screen = textPlate(13, 3.6, ['Distance:', '  23 cm'], { bg: '#7fbf3f', color: '#1f3a12', font: MONO, size: 1.2, weight: 700, align: 'left' });
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(0.9, 1.36, 0);
    g.add(board, frame, screen);
    const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, pins.length), mat(PLASTIC_BLACK));
    hdr.position.set(-w / 2 + 0.6, 0.85, 0);
    g.add(hdr);
    const tips = pins.map((p, i) => {
      const z = (i - (pins.length - 1) / 2) * 1;
      const t = textPlate(1.6, 0.7, p, { color: '#f4f4f4', size: 0.42, font: MONO, weight: 700 });
      t.rotation.x = -Math.PI / 2;
      t.position.set(-w / 2 + 1.9, 0.59, z);
      g.add(t);
      return V(-w / 2 + 0.6, 1.2, z);
    });
    return { group: shadowAll(g), tips, w, d };
  }
  // the bare kind, standing up behind the board, 16 pins along its lower edge
  const w = 24, h = 10.2;
  const board = rbox(w, h, 0.25, 0x1f7a3d, 0.08);
  board.position.set(0, h / 2 + 0.4, 0);
  const frame = rbox(19.5, 6.4, 0.9, 0x1c1d21, 0.1);
  frame.position.set(0, h / 2 + 0.9, 0.55);
  const screen = textPlate(18, 4.6, ['Distance:', '  23 cm'], { bg: '#7fbf3f', color: '#1f3a12', font: MONO, size: 1.5, weight: 700, align: 'left' });
  screen.position.set(0, h / 2 + 0.9, 1.02);
  g.add(board, frame, screen);
  const n = pins.length;
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(n, 0.62, 0.5), mat(PLASTIC_BLACK));
  hdr.position.set(-w / 2 + 1 + n / 2, 1.0, 0.4);
  g.add(hdr);
  const tips = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 1.5 + i;
    tips.push(V(x, 0.9, 0.8));
  }
  const nums = textPlate(n, 0.5, [pins.map((_, i) => String(i + 1).padStart(2, ' ')).join('')], { color: '#f4f4f4', size: 0.32, font: MONO, weight: 700 });
  nums.position.set(-w / 2 + 1 + n / 2, 1.65, 0.14);
  nums.visible = false;
  g.add(nums);
  return { group: shadowAll(g), tips, w, d: 1.2, standing: true, h };
}

function sonar(pins) {
  // HC-SR04 standing up behind the board, its two "eyes" towards you.
  const g = new THREE.Group();
  const w = 14, h = 6.4;
  const board = rbox(w, h, 0.25, 0x1f5f9a, 0.08);
  board.position.set(0, h / 2 + 1.4, 0);
  g.add(board);
  for (const s of [-1, 1]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 2.4, 28), mat(0xcfd3d8, { metalness: 0.55, roughness: 0.35 }));
    can.rotation.x = Math.PI / 2;
    can.position.set(s * 3.9, h / 2 + 1.4, 1.3);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), mat(0x2a2b30, { roughness: 0.9 }));
    mesh.position.set(s * 3.9, h / 2 + 1.4, 2.51);
    mesh.userData.noInk = true;
    g.add(can, mesh);
  }
  const name = textPlate(5, 0.8, 'HC-SR04', { color: '#f4f4f4', size: 0.55, weight: 700 });
  name.position.set(0, h + 0.8, 0.14);
  g.add(name);
  const n = pins.length;
  const tips = [];
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(n, 0.62, 0.5), mat(PLASTIC_BLACK));
  hdr.position.set(0, 1.4, 0.35);
  g.add(hdr);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2);
    tips.push(V(x, 1.1, 0.7));
    const t = textPlate(1.4, 0.6, pins[i] || '', { color: '#f4f4f4', size: 0.34, font: MONO, weight: 700 });
    t.position.set(x * 1.0, 2.2, 0.14);
    t.scale.set(0.72, 1, 1);
    g.add(t);
  }
  return { group: shadowAll(g), tips, w, d: 3, standing: true, h: h + 1.4 };
}

function keypad(pins) {
  const g = new THREE.Group();
  const w = 11, d = 12;
  const pad = rbox(w, 0.3, d, 0x1c1d21, 0.2);
  pad.position.set(0, 0.15, 1.2);
  g.add(pad);
  const keys = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
  keys.forEach((k, i) => {
    const t = textPlate(2.1, 2.1, k, { bg: /[A-D]/.test(k) ? '#ca1f3f' : '#2f6fd0', color: '#ffffff', size: 1.1, weight: 700 });
    t.rotation.x = -Math.PI / 2;
    t.position.set(((i % 4) - 1.5) * 2.5, 0.32, 1.2 + (Math.floor(i / 4) - 1.5) * 2.6);
    g.add(t);
  });
  // ribbon tail with an 8-pin end
  const tail = new THREE.Mesh(new THREE.BoxGeometry(pins.length * 1.0, 0.08, 2.6), mat(0xd8c8a0));
  tail.position.set(0, 0.06, -6.0);
  tail.userData.noInk = true;
  g.add(tail);
  const tips = pins.map((p, i) => V((i - (pins.length - 1) / 2) * 1.0, 0.4, -7.2));
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(pins.length * 1.0, 0.5, 0.62), mat(PLASTIC_BLACK));
  hdr.position.set(0, 0.3, -7.2);
  g.add(hdr);
  return { group: shadowAll(g), tips, w, d: 15, zOff: 2.2 };
}

function rain(pins) {
  const g = new THREE.Group();
  const w = Math.max(6, pins.length * 1.1 + 1.5), d = 5.6;
  const m = pcbModule({ w, d, color: 0x1f5f9a, name: 'rain sensor', pins: pins.map(() => '') });
  g.add(m);
  const pot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), mat(0x2f5f9e));
  pot.position.set(-1.5, 1.1, 0.8);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), mat(0xf2f2f2));
  knob.position.set(-1.5, 1.8, 0.8);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.4), mat(0x1c1d21));
  chip.position.set(1.4, 0.85, 0.8);
  g.add(pot, knob, chip);
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

function dht(pins, bare) {
  const g = new THREE.Group();
  const n = pins.length;
  const w = Math.max(5, n * 1.1 + 1.2);
  let tips;
  let d;
  if (bare) {
    d = 3;
    tips = [];
    for (let i = 0; i < n; i++) tips.push(V((i - (n - 1) / 2), 0.5, -1.6));
    const hdrPins = new THREE.Mesh(new THREE.BoxGeometry(n, 0.2, 0.3), mat(0xd4b04c, { metalness: 0.5 }));
    hdrPins.position.set(0, 0.35, -1.4);
    hdrPins.userData.noInk = true;
    g.add(hdrPins);
  } else {
    const m = pcbModule({ w, d: 6.5, color: 0x1f5f9a, name: '', pins: pins.map(() => '') });
    g.add(m);
    tips = m.userData.tips;
    d = 6.5;
  }
  const shell = rbox(4.7, bare ? 6 : 5, 2.3, 0x4aa3df, 0.15);
  shell.position.set(0, bare ? 3.1 : 3.3, bare ? 0 : 0.9);
  g.add(shell);
  // the grille
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), mat(0x1d4e78));
      s.position.set((c - 1) * 1.2, (bare ? 4.4 : 4.6) - r * 1.0, (bare ? 0 : 0.9) + 1.17);
      s.userData.noInk = true;
      g.add(s);
    }
  }
  return { group: shadowAll(g), tips, w, d };
}

function motor() {
  // a small DC motor lying down, with a fan blade on its shaft
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6, 28), mat(0xc9ccd1, { metalness: 0.55, roughness: 0.35 }));
  can.rotation.z = Math.PI / 2;
  can.position.set(0, 2.25, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.6, 28), mat(0xe8e1cf));
  cap.rotation.z = Math.PI / 2;
  cap.position.set(-3.3, 2.25, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 10), mat(0xe2e2e2, { metalness: 0.7 }));
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(3.7, 2.25, 0);
  const blade = rbox(0.4, 4.2, 1.1, 0xca1f3f, 0.15);
  blade.position.set(4.3, 2.25, 0);
  blade.rotation.x = 0.5;
  g.add(can, cap, shaft, blade);
  // two terminals on the back cap
  const tips = [V(-3.8, 3.2, -0.8), V(-3.8, 3.2, 0.8)];
  return { group: shadowAll(g), tips, w: 9, d: 5 };
}

export function batteryPack() {
  // four AA cells side by side in a black holder
  const g = new THREE.Group();
  const w = 12.5, d = 6.6;
  const tray = rbox(w, 1.3, d, 0x1c1d21, 0.15);
  tray.position.y = 0.65;
  g.add(tray);
  for (let i = 0; i < 4; i++) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, w - 1.6, 20), mat(i % 2 ? 0x2f6fd0 : 0x2f6fd0));
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0, 1.35, (i - 1.5) * 1.5);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.735, 0.735, 2.4, 20), mat(0xe8e8e8));
    band.rotation.z = Math.PI / 2;
    band.position.set(i % 2 ? 3.4 : -3.4, 1.35, (i - 1.5) * 1.5);
    band.userData.noInk = true;
    g.add(cell, band);
  }
  const t = textPlate(5, 0.9, '4 × AA = 6 V', { color: '#ffffff', size: 0.6, weight: 700 });
  t.rotation.x = -Math.PI / 2;
  t.position.set(0, 2.1, 0);
  g.add(t);
  // leads leave the left end: + red, − black (drawn in rail colours by the lab)
  const tips = [V(-w / 2 + 0.3, 1.0, -1.2), V(-w / 2 + 0.3, 1.0, 1.2)];
  return { group: shadowAll(g), tips, w, d };
}

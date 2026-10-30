// 3D models for the parts the wiring diagrams use (tools/bbdraw.py).
// One world unit is one breadboard pitch: 0.1 inch, 2.54 mm.
//
// The look: the BIH illustrated style (ink outlines, soft shadows) with real
// proportions and materials. To stay quick on old PCs and phones:
//   - static detail is merged into a few meshes per part (class Merge), with
//     per-vertex colours, its own ink lines and silhouette shell;
//   - repeated things (holes, sockets) are instanced (see build.js);
//   - printing is drawn once on canvas textures (crisp text, anisotropy);
//   - on software WebGL (lowPower) metals drop the reflection map, tubes get
//     fewer sides and the extra fill light is skipped.
import { THREE, mat, rbox, decal, inkLine, lowPower } from './runtime.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
const SANS = 'Rubik, "Archivo", "Segoe UI", Arial, sans-serif';
const HEAD = 'Outfit, Rubik, "Segoe UI", Arial, sans-serif';
export const FONTS = { MONO, SANS, HEAD };

export const METAL = 0xb8bcc2;
export const PLASTIC_BLACK = 0x26272b;
const TIN = 0xd2d5d9;
const LEADC = 0xc9ccd1;
const INK = 0x24182e;
const noop = () => {};

// ---------- small helpers ----------
export function shadowAll(o, cast = true, receive = true) {
  o.traverse((m) => { if (m.isMesh && !m.userData.noShadow) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}
const v3 = (p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]));
const radial = () => (lowPower() ? 6 : 10);

// A canvas texture, drawn once. Crisp: mipmaps and the best anisotropy the GPU has.
export function canvasTexture(cw, ch, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(cw));
  c.height = Math.max(2, Math.round(ch));
  const g = c.getContext('2d');
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16; // three.js clamps this to what the GPU allows
  return t;
}

// A soft studio reflection for metal and glossy epoxy (not on software WebGL).
let ENV;
export function envMap() {
  if (lowPower()) return null;
  if (!ENV) {
    ENV = canvasTexture(256, 128, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#fffdf8');
      gr.addColorStop(0.42, '#ece6f0');
      gr.addColorStop(0.52, '#9c90a6');
      gr.addColorStop(1, '#3b3142');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // two soft boxes and a window: the highlights metal picks up
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(W * 0.12, H * 0.1, W * 0.16, H * 0.18);
      g.fillRect(W * 0.58, H * 0.16, W * 0.1, H * 0.12);
      g.fillStyle = 'rgba(255,240,215,0.8)';
      g.fillRect(W * 0.82, H * 0.22, W * 0.06, H * 0.2);
    });
    ENV.mapping = THREE.EquirectangularReflectionMapping;
  }
  return ENV;
}

export function metalMat(color = TIN, { rough = 0.32, metal = 0.9, ...extra } = {}) {
  const e = envMap();
  return new THREE.MeshStandardMaterial({
    color, roughness: e ? rough : Math.min(0.55, rough + 0.12), metalness: e ? metal : 0.4,
    envMap: e, envMapIntensity: 1.05, ...extra,
  });
}
export function plasticMat(color = 0xffffff, { rough = 0.55, gloss = 0.35, ...extra } = {}) {
  const e = envMap();
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMap: e, envMapIntensity: e ? gloss : 0, ...extra });
}

// Extra lights for the illustrated look: a cool rim from behind and a warm fill
// from the left. The runtime's sun stays the key light. Added once per scene,
// the first time a model is drawn, so every lab gets them.
export function studio(scene) {
  if (!scene || !scene.isScene || scene.userData.bihStudio) return;
  scene.userData.bihStudio = true;
  const low = lowPower();
  scene.traverse((o) => { if (o.isHemisphereLight) o.intensity *= 0.82; });
  const rim = new THREE.DirectionalLight(0xe4ecff, low ? 0.55 : 0.95);
  rim.position.set(-20, 30, -60);
  scene.add(rim);
  if (!low) {
    const fill = new THREE.DirectionalLight(0xffeedd, 0.45);
    fill.position.set(-60, 25, 30);
    scene.add(fill);
  }
}
function hookStudio(mesh) {
  const prev = mesh.onBeforeRender;
  mesh.onBeforeRender = function (r, scene, ...rest) {
    studio(scene);
    mesh.onBeforeRender = prev;
    prev.call(this, r, scene, ...rest);
  };
  return mesh;
}

// ---------- ink: outlines for merged meshes ----------
const edgeCache = new WeakMap();
function edgesOf(geo, angle) {
  let m = edgeCache.get(geo);
  if (!m) edgeCache.set(geo, (m = {}));
  return (m[angle] ??= new THREE.EdgesGeometry(geo, angle));
}
// One silhouette thickness for every model shell, so they share one shader
// (each distinct thickness would be another program to compile on old PCs).
const HULLS = {};
const HULL_OFF = 0.028;
function hullMat() {
  const k = HULL_OFF.toFixed(3);
  return (HULLS[k] ??= (() => {
    const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${k};`);
    };
    m.customProgramCacheKey = () => 'bih-hull-' + k;
    return m;
  })());
}
function inkChild(mesh, lineGeo, hullGeo, off) {
  if (lineGeo) {
    const l = new THREE.LineSegments(lineGeo, inkLine);
    l.raycast = noop;
    l.userData.isInk = true;
    mesh.add(l);
  }
  if (hullGeo) {
    const h = new THREE.Mesh(hullGeo, hullMat(off));
    h.raycast = noop;
    h.userData.isInk = true;
    mesh.add(h);
  }
}
// Give one ordinary mesh a silhouette shell of a chosen thickness (the
// runtime's default shell is too thick for tiny parts).
export function inkThin(mesh, off = 0.025, angle = 50) {
  mesh.userData.inked = true;
  inkChild(mesh, edgesOf(mesh.geometry, angle), mesh.geometry.attributes.normal ? mesh.geometry : null, off);
  return mesh;
}

function concat(list, names) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = name === 'uv' ? 2 : 3;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of list) {
      const cnt = g.attributes.position.count;
      const a = g.attributes[name];
      if (a) {
        if (a.isInterleavedBufferAttribute || a.array.length !== cnt * size) for (let i = 0; i < cnt; i++) for (let j = 0; j < size; j++) arr[o + i * size + j] = a.getComponent(i, j);
        else arr.set(a.array, o);
      }
      o += cnt * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
function matrixOf(o) {
  if (o.m) return o.m.clone();
  const p = o.p ?? [0, 0, 0];
  const r = o.r ?? [0, 0, 0];
  const s = o.s ?? 1;
  _p.copy(v3(p));
  _q.setFromEuler(_e.set(r[0], r[1], r[2], r[3] ?? 'XYZ'));
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Many small shapes, one mesh: add(geometry, { p, r, s, c, ink, hull, uv }).
// c is an sRGB colour (multiplied into any colour the geometry already has),
// ink an edge angle (false for none), hull adds it to the silhouette shell.
export class Merge {
  constructor({ uv = false } = {}) {
    this.geos = [];
    this.lines = [];
    this.hulls = [];
    this.uv = uv;
  }
  add(geo, o = {}) {
    const m = matrixOf(o);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    _c.set(o.c ?? 0xffffff);
    const col = new Float32Array(n * 3);
    const src = g.attributes.color;
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r * (src ? src.getX(i) : 1);
      col[i * 3 + 1] = _c.g * (src ? src.getY(i) : 1);
      col[i * 3 + 2] = _c.b * (src ? src.getZ(i) : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (this.uv && o.uv) {
      // o.uv = [u0, v0, u1, v1]: squeeze the geometry's 0..1 uvs into that box
      const a = g.attributes.uv;
      const [u0, v0, u1, v1] = o.uv;
      for (let i = 0; i < n; i++) a.setXY(i, u0 + a.getX(i) * (u1 - u0), v0 + a.getY(i) * (v1 - v0));
    }
    this.geos.push(g);
    if (o.ink !== false && o.ink !== 0) {
      const e = edgesOf(geo, o.ink ?? 25).clone();
      e.applyMatrix4(m);
      this.lines.push(e);
    }
    if (o.hull) this.hulls.push(g);
    return this;
  }
  get empty() { return !this.geos.length; }
  geometry() { return concat(this.geos, ['position', 'normal', 'color', ...(this.uv ? ['uv'] : [])]); }
  mesh(material, { hull = 0.03, shadow = true, colors = true } = {}) {
    material.vertexColors = colors;
    const mesh = new THREE.Mesh(this.geometry(), material);
    mesh.userData.inked = true;
    mesh.castShadow = mesh.receiveShadow = shadow;
    inkChild(mesh, this.lines.length ? concat(this.lines, ['position']) : null, this.hulls.length ? concat(this.hulls, ['position', 'normal']) : null, hull);
    return mesh;
  }
}

// Shared shapes.
const GEO = {};
const box = (w, h, d) => (GEO[`b${w},${h},${d}`] ??= new THREE.BoxGeometry(w, h, d));
const rboxG = (w, h, d, r = 0.06, seg = 2) => (GEO[`rb${w},${h},${d},${r},${seg}`] ??= new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
const cyl = (rt, rb, h, seg = 20, open = false) => (GEO[`c${rt},${rb},${h},${seg},${open}`] ??= new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const plane = (w, h) => (GEO[`p${w},${h}`] ??= new THREE.PlaneGeometry(w, h));

// A square hole as it looks from above: a funnel with walls lit as if they
// sloped into the plastic, and a dark floor. Flat (y = 0), so it costs two
// triangles a wall. a: outer half-size, b: floor half-size.
export function funnelGeo(a = 0.31, b = 0.13, floor = 0.22, wall = 1) {
  const P = [];
  const N = [];
  const C = [];
  const tri = (p0, p1, p2, n, c) => {
    const ux = p1[0] - p0[0], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vz = p2[2] - p0[2];
    if (uz * vx - ux * vz < 0) [p1, p2] = [p2, p1];
    for (const p of [p0, p1, p2]) { P.push(...p); N.push(...n); C.push(c, c, c); }
  };
  const quad = (p0, p1, p2, p3, n, c) => { tri(p0, p1, p2, n, c); tri(p0, p2, p3, n, c); };
  const s = 0.62, t = 0.78;
  quad([a, 0, -a], [a, 0, a], [b, 0, b], [b, 0, -b], [-s, t, 0], wall * 0.92);
  quad([-a, 0, -a], [-a, 0, a], [-b, 0, b], [-b, 0, -b], [s, t, 0], wall);
  quad([-a, 0, a], [a, 0, a], [b, 0, b], [-b, 0, b], [0, t, -s], wall * 0.8);
  quad([-a, 0, -a], [a, 0, -a], [b, 0, -b], [-b, 0, -b], [0, t, s], wall * 1.05);
  quad([-b, 0, -b], [b, 0, -b], [b, 0, b], [-b, 0, b], [0, 1, 0], floor);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

// A soft shadow pad under a board or module: works without shadow maps
// (software WebGL), and grounds things on a GPU too.
const SHADOWS = {};
export function contactShadow(w, d, { blur = 0.9, opacity = 0.32, y = 0.015 } = {}) {
  const key = `${Math.round(w * 4)}x${Math.round(d * 4)}x${blur}`;
  const tex = (SHADOWS[key] ??= (() => {
    const px = 18;
    const pad = blur * 2.2;
    return canvasTexture((w + pad * 2) * px, (d + pad * 2) * px, (g, W, H) => {
      g.clearRect(0, 0, W, H);
      g.shadowColor = 'rgba(36,24,46,1)';
      g.shadowBlur = blur * px * 1.4;
      g.shadowOffsetX = W * 2;
      g.fillStyle = '#000';
      g.beginPath();
      g.roundRect(pad * px - W * 2, pad * px, w * px, d * px, px * 0.6);
      g.fill();
    });
  })());
  const pad = blur * 2.2;
  const m = new THREE.Mesh(plane(w + pad * 2, d + pad * 2), new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = -1;
  m.userData.noInk = true;
  m.userData.noShadow = true;
  m.raycast = noop;
  return m;
}

// A radial glow for lights (additive): the "bloom" round a lit LED.
let GLOWTEX;
export function haloSprite(color, size = 3) {
  GLOWTEX ??= canvasTexture(128, 128, (g, W) => {
    const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, W);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOWTEX, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.set(size, size, 1);
  s.visible = false;
  s.userData.noInk = true;
  s.raycast = noop;
  return s;
}

// A tube along points (legs, cables), with its curve kept for animations.
function tubeGeo(points, r, seg, rad = radial()) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, r, rad, false);
  g.userData.curve = curve;
  return g;
}

// A thin bent wire leg (LED, resistor...), through points.
export function leg(points, color = LEADC, r = 0.075) {
  const m = new THREE.Mesh(tubeGeo(points, r, Math.max(12, points.length * 6), lowPower() ? 5 : 8), metalMat(color, { rough: 0.3 }));
  m.userData.noInk = true;
  m.userData.curve = m.geometry.userData.curve;
  m.castShadow = false;
  return m;
}
// Several legs as one mesh (one draw call).
function legs(list, color = LEADC, mtl) {
  const mg = new Merge();
  for (const [pts, r] of list) mg.add(tubeGeo(pts, r ?? 0.075, Math.max(12, pts.length * 6), lowPower() ? 5 : 8), { ink: false });
  const m = mg.mesh(mtl ?? metalMat(color, { rough: 0.3 }));
  m.castShadow = true;
  return m;
}

// ---------- jumper wires ----------
// A moulded plug: black housing, a short sleeve where the wire goes in, and
// the metal pin poking out underneath. y = 0 is the top of the housing.
let PLUG;
function plugGeo() {
  if (PLUG) return PLUG;
  const mg = new Merge();
  mg.add(rboxG(0.62, 1.22, 0.62, 0.07, 1), { p: [0, -0.89, 0], c: 0x1f1f23, ink: false });
  mg.add(cyl(0.3, 0.27, 0.08, 12), { p: [0, -0.24, 0], c: 0x2c2c31, ink: false });
  mg.add(cyl(0.24, 0.29, 0.22, 12), { p: [0, -0.1, 0], c: 0x2c2c31, ink: false });
  // a moulded grip: two shallow ribs on each face
  for (const z of [-0.315, 0.315]) for (const y of [-0.7, -1.0]) mg.add(box(0.5, 0.06, 0.02), { p: [0, y, z], c: 0x2a2a2f, ink: false });
  mg.add(box(0.15, 0.55, 0.15), { p: [0, -1.72, 0], c: 0xcfd2d6, ink: false });
  PLUG = mg.geometry();
  return PLUG;
}

// ends: [true, true] (a plug at each end), path: Vector3 list from one plug top to the other.
export function jumper(path, color, { r = 0.2, ends = [true, true] } = {}) {
  const g = new THREE.Group();
  const geo = tubeGeo(path, r, Math.max(28, path.length * 8), lowPower() ? 6 : 10);
  const c = new THREE.Mesh(geo, plasticMat(color, { rough: 0.42, gloss: 0.4 }));
  c.castShadow = true;
  c.userData.curve = geo.userData.curve;
  g.add(c);
  const mg = new Merge();
  const pg = plugGeo();
  [0, path.length - 1].forEach((k, j) => {
    if (!ends[j]) return;
    mg.add(pg, { p: path[k], ink: false });
  });
  if (!mg.empty) {
    const h = mg.mesh(plasticMat(0xffffff, { rough: 0.5, gloss: 0.3 }));
    h.userData.noInk = true;
    g.add(h);
  }
  g.userData.cable = c;
  hookStudio(c);
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

// A 5 mm LED body, standing on y = 0: the rim (with its flat on +x), the
// can and the dome, as one smooth lathe. Shared by every LED.
let LENS;
function lensGeo() {
  if (LENS) return LENS;
  const pts = [V(0, 0, 0), V(1.13, 0, 0), V(1.15, 0.05, 0), V(1.15, 0.36, 0), V(1.1, 0.4, 0), V(0.99, 0.42, 0), V(0.98, 0.5, 0), V(0.98, 2.2, 0)];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(V(0.98 * Math.cos(a) + (i === 10 ? 0 : 0), 2.2 + 0.98 * Math.sin(a), 0));
  }
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, p.y)), lowPower() ? 20 : 32);
  // the flat on the rim, on the +x side (the short leg)
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 0.99 && pos.getY(i) < 0.45) pos.setX(i, 0.99);
  g.computeVertexNormals();
  LENS = g;
  return g;
}
// The lead frame you can see through the epoxy: post (anode) and anvil (cathode, +x).
let FRAME;
function frameGeo() {
  if (FRAME) return FRAME;
  const mg = new Merge();
  mg.add(box(0.16, 1.5, 0.12), { p: [-0.32, 0.75, 0], c: 0xc8ccd1, ink: false });
  mg.add(box(0.16, 0.25, 0.12), { p: [-0.2, 1.5, 0], r: [0, 0, -0.6], c: 0xc8ccd1, ink: false });
  mg.add(box(0.5, 1.35, 0.12), { p: [0.3, 0.68, 0], c: 0xb9bdc3, ink: false });
  mg.add(cyl(0.24, 0.16, 0.18, 12), { p: [0.3, 1.42, 0], c: 0xd8dbe0, ink: false });
  FRAME = mg.geometry();
  return FRAME;
}
let GLINT;
function glintGeo() {
  // a painted highlight on the dome, like an illustrator's white streak
  if (GLINT) return GLINT;
  const s = new THREE.Shape();
  s.absellipse(0, 0, 0.16, 0.5, 0, Math.PI * 2, false, 0);
  GLINT = new THREE.ShapeGeometry(s, 10);
  return GLINT;
}

// a, c: the two hole tops (anode, cathode). The body floats above their midpoint.
export function led(a, c, colour, top) {
  const g = new THREE.Group();
  const col = LED_HEX[colour] ?? LED_HEX.red;
  const mid = a.clone().add(c).multiplyScalar(0.5);
  const baseY = top + 2.3;
  const dir = c.clone().sub(a).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  const body = new THREE.Group();
  body.position.set(mid.x, baseY, mid.z);
  body.rotation.y = Math.atan2(-dir.z, dir.x); // body +x = towards the short leg
  const lens = plasticMat(col, { rough: 0.16, gloss: 0.9, transparent: true, opacity: 0.86, emissive: col, emissiveIntensity: 0.08 });
  const lensMesh = new THREE.Mesh(lensGeo(), lens);
  lensMesh.castShadow = true;
  inkThin(lensMesh, 0.03, 50);
  const inner = new THREE.Mesh(frameGeo(), metalMat(0xffffff, { rough: 0.35, vertexColors: true }));
  inner.userData.noInk = true;
  const dieMat = new THREE.MeshBasicMaterial({ color: 0x3a3330, toneMapped: false });
  const die = new THREE.Mesh(box(0.14, 0.08, 0.14), dieMat);
  die.position.set(0.3, 1.55, 0);
  die.userData.noInk = true;
  const glint = new THREE.Mesh(glintGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }));
  // (in world axes, so the highlight is always on the side facing the light)
  const gn = V(-0.6, 0.5, 0.62).normalize();
  glint.position.set(mid.x + gn.x * 1.0, baseY + 2.2 + gn.y * 1.0, mid.z + gn.z * 1.0);
  glint.quaternion.setFromUnitVectors(V(0, 0, 1), gn);
  glint.rotateZ(-0.5);
  glint.userData.noInk = true;
  glint.raycast = noop;
  const halo = haloSprite(col, 4.2);
  halo.position.set(0, 1.9, 0);
  body.add(lensMesh, inner, die, halo);
  // Labs light an LED by raising its lens's emissiveIntensity. Follow that
  // with the die and a halo, so every LED glows the same way.
  const dieOff = new THREE.Color(0x3a3330);
  const dieOn = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35);
  lensMesh.onBeforeRender = (r, scene) => {
    studio(scene);
    const k = THREE.MathUtils.clamp((lens.emissiveIntensity - 0.12) / 1.4, 0, 1.2);
    halo.visible = k > 0.03;
    halo.material.opacity = Math.min(1, k) * 0.6;
    halo.material.color.copy(lens.emissive.getHex() ? lens.emissive : lens.color);
    dieMat.color.copy(dieOff).lerp(dieOn, Math.min(1, k * 1.4));
  };
  g.add(body, glint);
  // legs: the long one (anode) has a little crank in it, as in most drawings
  const la = V(mid.x - dir.x * 0.32, baseY + 0.1, mid.z - dir.z * 0.32);
  const lc = V(mid.x + dir.x * 0.32, baseY + 0.1, mid.z + dir.z * 0.32);
  const k = V((a.x + la.x) / 2 - dir.x * 0.35, top + 1.2, (a.z + la.z) / 2 - dir.z * 0.35);
  g.add(legs([
    [[V(a.x, top - 0.3, a.z), V(a.x, top + 0.5, a.z), k, V(la.x, baseY - 0.4, la.z), la], 0.085],
    [[V(c.x, top - 0.3, c.z), V(c.x, top + 0.5, c.z), V(lc.x, baseY - 0.4, lc.z), lc], 0.075],
  ]));
  g.userData.anodeMark = V(k.x - dir.x * 0.8, top + 1.4, k.z - dir.z * 0.8);
  g.userData.top = V(mid.x, baseY + 3.2, mid.z);
  g.userData.lens = lens;
  g.userData.halo = null; // concept labs may add their own
  return g;
}

// A four-leg RGB LED: milky dome, legs fanned to four holes. The long leg is
// the shared one (index `long`).
export function rgbLed(holes, top, long = 1) {
  const g = new THREE.Group();
  const mid = holes.reduce((s, h) => s.add(h), V(0, 0, 0)).multiplyScalar(1 / holes.length);
  const baseY = top + 2.6;
  const lens = plasticMat(0xf3f0ea, { rough: 0.32, gloss: 0.7, transparent: true, opacity: 0.9 });
  const body = new THREE.Group();
  body.position.set(mid.x, baseY, mid.z);
  const pts = [[0, 0], [1.13, 0], [1.15, 0.05], [1.15, 0.36], [1.1, 0.4], [0.99, 0.42], [0.98, 0.5], [0.98, 1.55]].map(([x, y]) => new THREE.Vector2(x, y));
  const can = new THREE.Mesh(new THREE.LatheGeometry(pts, lowPower() ? 20 : 32), lens);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.98, lowPower() ? 20 : 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  dome.position.y = 1.55;
  inkThin(can, 0.03, 50);
  inkThin(dome, 0.03, 50);
  body.add(can, dome);
  // three little dies inside: red, green, blue
  [0xe23b2a, 0x2fae55, 0x3a7ee0].forEach((c, i) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat(c, { emissive: c, emissiveIntensity: 0.4 }));
    d.position.set((i - 1) * 0.4, 1.2, 0);
    d.userData.noInk = true;
    body.add(d);
  });
  const glint = new THREE.Mesh(glintGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  const gn = V(-0.6, 0.5, 0.62).normalize();
  glint.position.set(gn.x, 1.55 + gn.y, gn.z);
  glint.quaternion.setFromUnitVectors(V(0, 0, 1), gn);
  glint.rotateZ(-0.5);
  glint.userData.noInk = true;
  glint.raycast = noop;
  body.add(glint);
  hookStudio(can);
  g.add(body);
  const list = holes.map((h, i) => {
    const off = (i - (holes.length - 1) / 2) * 0.45;
    const lx = mid.x + off;
    const p = [V(h.x, top - 0.3, h.z), V(h.x, top + 0.5, h.z)];
    if (i === long) p.push(V((h.x + lx) / 2 - 0.3, top + 1.3, h.z));
    p.push(V(lx, baseY - 0.4, mid.z), V(lx, baseY + 0.1, mid.z));
    return [p, i === long ? 0.085 : 0.07];
  });
  g.add(legs(list));
  g.userData.top = V(mid.x, baseY + 2.6, mid.z);
  return g;
}

// ---------- resistor ----------
// The body is one lathe (the "dog bone" shape: fat ends, slimmer middle)
// painted with its bands, so a resistor is one mesh plus its legs.
const RES_L = 2.5;
let RESGEO;
function resistorGeo() {
  if (RESGEO) return RESGEO;
  const N = 44;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = -RES_L / 2 + (RES_L * i) / (N - 1);
    const u = Math.abs(y) / (RES_L / 2);
    let r;
    if (u > 0.9) r = 0.08 + 0.36 * Math.sqrt(Math.max(0, 1 - ((u - 0.9) / 0.1) ** 2)) ** 1.2;
    else if (u > 0.56) r = 0.44 - 0.02 * ((u - 0.73) / 0.17) ** 2;
    else if (u > 0.44) r = 0.36 + 0.08 * ((u - 0.44) / 0.12);
    else r = 0.36;
    pts.push(new THREE.Vector2(Math.max(0.07, r), y));
  }
  const g = new THREE.LatheGeometry(pts, lowPower() ? 16 : 24);
  g.rotateZ(-Math.PI / 2); // lie along +x; v runs from -x (v = 0) to +x (v = 1)
  RESGEO = g;
  return g;
}
const RES_TEX = {};
function resistorTex(cols) {
  const key = cols.join();
  return (RES_TEX[key] ??= canvasTexture(16, 512, (c, W, H) => {
    c.fillStyle = '#d8c08e';
    c.fillRect(0, 0, W, H);
    // a little mottling, like the lacquer on a real one
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(${i % 2 ? '255,250,235' : '150,120,70'},0.07)`;
      c.fillRect(0, (i * 97) % H, W, 3 + (i % 5));
    }
    // canvas row for an axial position x (-L/2 .. L/2); flipY puts v = 1 at the top
    const row = (x) => (1 - (x + RES_L / 2) / RES_L) * H;
    const at = [-0.78, -0.47, -0.2, 0.62];
    cols.forEach((col, i) => {
      const w = 0.16;
      const y0 = row(at[i] + w / 2), y1 = row(at[i] - w / 2);
      c.fillStyle = col;
      c.fillRect(0, y0, W, y1 - y0);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(0, y0, W, 2);
      c.fillRect(0, y1 - 2, W, 2);
      if (i === 3) { c.fillStyle = 'rgba(255,240,180,0.35)'; c.fillRect(0, y0 + (y1 - y0) * 0.3, W, (y1 - y0) * 0.2); }
    });
  }));
}

export function resistor(a, b, value, top) {
  const g = new THREE.Group();
  const span = Math.hypot(b.x - a.x, b.z - a.z);
  const [d1, d2, m] = bands(value);
  const cols = [BAND_HEX[d1], BAND_HEX[d2], BAND_HEX[m], GOLD];
  const bodyMat = plasticMat(0xffffff, { map: resistorTex(cols), rough: 0.48, gloss: 0.45 });
  const L = RES_L;
  const body = new THREE.Group();
  const cylM = new THREE.Mesh(resistorGeo(), bodyMat);
  cylM.castShadow = true;
  inkThin(cylM, 0.025, 60);
  hookStudio(cylM);
  body.add(cylM);
  const dir = b.clone().sub(a).setY(0).normalize();
  const ang = Math.atan2(-dir.z, dir.x);
  if (span >= 2.9) {
    // lying flat, legs bent down at each end
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const y = top + 1.5;
    body.position.set(mid.x, y, mid.z);
    body.rotation.y = ang;
    const e = L / 2 - 0.05;
    const pa = V(mid.x - dir.x * e, y, mid.z - dir.z * e);
    const pb = V(mid.x + dir.x * e, y, mid.z + dir.z * e);
    const bend = (h, p, s) => [V(h.x, top - 0.3, h.z), V(h.x, top + 0.6, h.z), V(h.x, y - 0.32, h.z), V(h.x + dir.x * s * 0.12, y - 0.06, h.z + dir.z * s * 0.12), V(h.x + (p.x - h.x) * 0.5, y, h.z + (p.z - h.z) * 0.5), p];
    g.add(legs([[bend(a, pa, 1), 0.07], [bend(b, pb, -1), 0.07]]));
    g.userData.top = V(mid.x, y + 1, mid.z);
  } else {
    // standing up over the first hole, the top lead bent over to the second
    body.rotation.z = Math.PI / 2;
    const ry = top + 0.6 + L / 2;
    body.position.set(a.x, ry, a.z);
    const wrapG = new THREE.Group();
    wrapG.add(body);
    g.add(wrapG);
    const tp = V(a.x, ry + L / 2 - 0.05, a.z);
    const over = V((a.x + b.x) / 2, tp.y + 0.9, (a.z + b.z) / 2);
    g.add(legs([
      [[V(a.x, top - 0.3, a.z), V(a.x, top + 0.3, a.z), V(a.x, ry - L / 2 + 0.05, a.z)], 0.07],
      [[tp, V(a.x, tp.y + 0.6, a.z), over, V(b.x, tp.y + 0.2, b.z), V(b.x, top + 0.6, b.z), V(b.x, top - 0.3, b.z)], 0.07],
    ]));
    g.userData.top = V(a.x, ry + L / 2 + 1.2, a.z);
    g.userData.standing = true;
    return g;
  }
  g.add(body);
  return g;
}

// ---------- push button ----------
// A 6 mm tactile switch: black body, a metal frame clipped over it, a round
// stem (the part you press) and four bent legs.
export function button(holes, top) {
  const g = new THREE.Group();
  const xs = holes.map((h) => h.x);
  const zs = holes.map((h) => h.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const w = Math.max(2.6, Math.max(...xs) - Math.min(...xs) + 0.5);
  const d = Math.max(2.6, Math.max(...zs) - Math.min(...zs) - 0.3);
  const y0 = top + 0.35;
  const pl = new Merge();
  pl.add(rboxG(w, 1.0, d, 0.1, 2), { p: [cx, y0 + 0.5, cz], c: 0x232327, ink: 60, hull: true });
  // four little round posts in the corners of the top, under the frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pl.add(cyl(0.2, 0.2, 0.12, 10), { p: [cx + sx * (w / 2 - 0.42), y0 + 1.06, cz + sz * (d / 2 - 0.42)], c: 0x2e2e33, ink: false });
  const base = pl.mesh(plasticMat(0xffffff, { rough: 0.5 }), { hull: 0.025 });
  const mt = new Merge();
  mt.add(box(w * 0.9, 0.07, d * 0.9), { p: [cx, y0 + 1.035, cz], ink: 25 });
  for (const sz of [-1, 1]) {
    // the frame's clips, bent down the two sides
    mt.add(box(0.7, 0.75, 0.06), { p: [cx - w * 0.22, y0 + 0.68, cz + sz * (d / 2 + 0.02)], ink: 25 });
    mt.add(box(0.7, 0.75, 0.06), { p: [cx + w * 0.22, y0 + 0.68, cz + sz * (d / 2 + 0.02)], ink: 25 });
  }
  // dimples stamped in the frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mt.add(cyl(0.12, 0.12, 0.03, 10), { p: [cx + sx * w * 0.3, y0 + 1.08, cz + sz * d * 0.3], c: 0xaeb2b8, ink: false });
  // legs: flat strips out of the body, down into the holes
  for (const h of holes) {
    const ex = cx + Math.sign(h.x - cx) * (w / 2 - 0.1);
    const sz = Math.sign(cz - h.z);
    const lx = ex + (h.x - ex) * 0.6;
    mt.add(box(0.28, 0.06, 0.5), { p: [(ex + lx) / 2, y0 + 0.04, h.z + sz * 0.2], s: [Math.max(0.3, Math.abs(lx - ex) / 0.28 + 1), 1, 1], ink: false });
    mt.add(box(0.28, 0.7, 0.06), { p: [h.x, top + 0.05, h.z], ink: false });
    mt.add(box(0.28, 0.06, 0.5), { p: [h.x, y0 + 0.04, h.z + sz * 0.2], ink: false });
  }
  const frame = mt.mesh(metalMat(0xd7dadf, { rough: 0.28 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.7, lowPower() ? 18 : 28), plasticMat(0x2c2c31, { rough: 0.38, gloss: 0.5 }));
  cap.position.set(cx, y0 + 1.4, cz);
  cap.castShadow = true;
  inkThin(cap, 0.025, 50);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, lowPower() ? 18 : 28), cap.material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  ring.userData.noInk = true;
  cap.add(ring);
  hookStudio(cap);
  g.add(base, frame, cap);
  g.userData.top = V(cx, y0 + 2.2, cz);
  g.userData.cap = cap;
  return g;
}

// ---------- potentiometer (the knob) ----------
// Children 0..3 stay body, bushing, knob, mark: Band 4's lab turns the last two.
function knurlGeo(r, h, ridges) {
  const g = new THREE.CylinderGeometry(r, r * 1.03, h, ridges * 2, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr < r * 0.9) continue;
    const a = Math.atan2(z, x);
    const k = Math.round(((a + Math.PI) / (2 * Math.PI)) * ridges * 2) % 2 ? 0.94 : 1;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
export function pot(holes, top, awayZ) {
  const g = new THREE.Group();
  const xs = holes.map((h) => h.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const hz = holes[0].z;
  const cz = hz + awayZ * 1.55;
  const w = Math.max(...xs) - Math.min(...xs) + 1.7;
  const y0 = top + 0.45;
  const pl = new Merge();
  pl.add(rboxG(w, 1.3, 2.9, 0.14, 2), { p: [cx, y0 + 0.65, cz], c: 0x2f62a8, ink: 60, hull: true });
  pl.add(box(w * 0.86, 0.06, 2.4), { p: [cx, y0 + 1.31, cz], c: 0x3a72bd, ink: false });
  const body = pl.mesh(plasticMat(0xffffff, { rough: 0.45, gloss: 0.4 }), { hull: 0.03 });
  // a threaded metal bushing
  const thread = [];
  for (let i = 0; i <= 8; i++) thread.push(new THREE.Vector2(i % 2 ? 0.7 : 0.76, -0.25 + (i * 0.5) / 8));
  thread.push(new THREE.Vector2(0.5, 0.25), new THREE.Vector2(0.5, 0.26));
  const ring = new THREE.Mesh(new THREE.LatheGeometry(thread, lowPower() ? 16 : 24), metalMat(0xc9ccd1, { rough: 0.3 }));
  ring.position.set(cx, y0 + 1.55, cz);
  inkThin(ring, 0.02, 60);
  const knob = new THREE.Mesh(knurlGeo(1.0, 1.3, lowPower() ? 14 : 22), plasticMat(0x26262b, { rough: 0.42, gloss: 0.5 }));
  knob.position.set(cx, y0 + 2.4, cz);
  knob.castShadow = true;
  inkThin(knob, 0.03, 50);
  hookStudio(knob);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.8), new THREE.MeshBasicMaterial({ color: 0xf6f6f6, toneMapped: false }));
  mark.position.set(cx, y0 + 3.07, cz + 0.45);
  mark.userData.noInk = true;
  g.add(body, ring, knob, mark);
  // a dimple in the knob's top, and the legs
  g.add(legs(holes.map((h) => [[V(h.x, top - 0.3, h.z), V(h.x, top + 0.2, h.z), V(h.x, y0 + 0.2, hz + awayZ * 0.4), V(h.x, y0 + 0.3, hz + awayZ * 0.7)], 0.08])));
  g.userData.top = V(cx, y0 + 3.4, cz);
  return g;
}

// ---------- buzzer ----------
let BUZ;
function buzzerGeo() {
  if (BUZ) return BUZ;
  const r = 1.65, h = 1.6;
  const pts = [[0, 0], [r - 0.1, 0], [r, 0.08], [r, h - 0.22], [r - 0.06, h - 0.07], [r - 0.2, h], [0.55, h], [0.5, h - 0.05], [0.35, h - 0.05], [0, h - 0.05]];
  BUZ = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), lowPower() ? 22 : 36);
  return BUZ;
}
export function buzzer(plus, minus, top, towardZ) {
  const g = new THREE.Group();
  const mid = plus.clone().add(minus).multiplyScalar(0.5);
  const cz = mid.z + towardZ * 1.1;
  const y0 = top + 0.9;
  const body = new THREE.Mesh(buzzerGeo(), plasticMat(0x1d1e22, { rough: 0.3, gloss: 0.6 }));
  body.position.set(mid.x, y0, cz);
  body.castShadow = true;
  inkThin(body, 0.03, 50);
  hookStudio(body);
  const holeTop = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ color: 0x050505, toneMapped: false }));
  holeTop.rotation.x = -Math.PI / 2;
  holeTop.position.set(mid.x, y0 + 1.56, cz);
  holeTop.userData.noInk = true;
  g.add(body, holeTop);
  const dx = plus.x - minus.x;
  const plusMark = decal(0.8, 0.8, (c, W, H) => {
    c.fillStyle = '#f2f2f2';
    c.font = `bold ${H * 0.9}px ${SANS}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+', W / 2, H / 2);
  }, { px: 64 });
  plusMark.rotation.x = -Math.PI / 2;
  plusMark.position.set(mid.x + Math.sign(dx || -1) * 0.95, y0 + 1.61, cz);
  g.add(plusMark);
  g.add(legs([
    [[V(plus.x, top - 0.3, plus.z), V(plus.x, top + 0.3, plus.z), V(mid.x + Math.sign(dx || -1) * 0.6, y0 + 0.1, cz)], 0.085],
    [[V(minus.x, top - 0.3, minus.z), V(minus.x, top + 0.3, minus.z), V(mid.x - Math.sign(dx || -1) * 0.6, y0 + 0.1, cz)], 0.07],
  ]));
  g.userData.top = V(mid.x, y0 + 2.4, cz);
  return g;
}

// ---------- NPN transistor, TO-92 ----------
export function transistor(e, b, c, top) {
  const g = new THREE.Group();
  const holes = [e, b, c];
  const mid = b.clone();
  const y0 = top + 1.4;
  // the D shape: round back, flat face (with the printing) towards +z
  const s = new THREE.Shape();
  s.moveTo(-0.95, 0);
  s.absarc(0, 0, 0.95, Math.PI, 0, false);
  s.lineTo(-0.95, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelOffset: -0.06, bevelSegments: 2, curveSegments: lowPower() ? 10 : 18 });
  geo.rotateX(Math.PI / 2); // extrude along -y
  geo.translate(0, 1.8, 0);
  const body = new THREE.Mesh(geo, plasticMat(0x1c1d21, { rough: 0.5 }));
  body.position.set(mid.x, y0, mid.z - 0.1);
  body.castShadow = true;
  body.userData.round = true;
  hookStudio(body);
  const face = decal(1.7, 1.6, (cx, W, H) => {
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
  g.add(legs(holes.map((h, i) => [[V(h.x, top - 0.3, h.z), V(h.x, top + 0.3, h.z), V(mid.x + (i - 1) * 0.5, y0 + 0.1, mid.z - 0.3)], 0.07])));
  g.userData.top = V(mid.x, y0 + 2.4, mid.z);
  return g;
}

// ---------- light sensor (LDR) ----------
let LDRTEX;
export function ldr(a, b, top) {
  const g = new THREE.Group();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const y0 = top + 1.8;
  const edge = plasticMat(0xece3cf, { rough: 0.5 });
  LDRTEX ??= canvasTexture(256, 256, (c, W, H) => {
    c.fillStyle = '#efe6d2';
    c.fillRect(0, 0, W, H);
    // two silver combs, with the orange-brown sensing track snaking between them
    c.fillStyle = '#c8ccd0';
    c.fillRect(W * 0.12, H * 0.12, W * 0.12, H * 0.76);
    c.fillRect(W * 0.76, H * 0.12, W * 0.12, H * 0.76);
    c.strokeStyle = '#b5521f';
    c.lineWidth = W * 0.05;
    c.lineJoin = 'round';
    c.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const y = H * (0.18 + (0.64 * i) / n);
      c.lineTo(i % 2 ? W * 0.27 : W * 0.73, y);
      c.lineTo(i % 2 ? W * 0.73 : W * 0.27, y);
    }
    c.stroke();
    // clear coat sheen
    const gr = c.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);
    // round: clear the corners
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    c.fill();
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.45, lowPower() ? 18 : 30), [edge, plasticMat(0xffffff, { map: LDRTEX, rough: 0.2, gloss: 0.8 }), edge]);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(mid.x, y0 + 1.0, mid.z);
  disc.castShadow = true;
  disc.userData.round = true;
  hookStudio(disc);
  g.add(disc);
  g.add(legs([
    [[V(a.x, top - 0.3, a.z), V(a.x, top + 0.4, a.z), V(mid.x - 0.45, y0 + 0.4, mid.z)], 0.07],
    [[V(b.x, top - 0.3, b.z), V(b.x, top + 0.4, b.z), V(mid.x + 0.45, y0 + 0.4, mid.z)], 0.07],
  ]));
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
  const pts = [[0.08, -0.98], [0.3, -0.96], [0.4, -0.86], [0.4, 0.86], [0.3, 0.96], [0.08, 0.98]].map(([r, h]) => new THREE.Vector2(r, h));
  const cylG = new THREE.LatheGeometry(pts, lowPower() ? 14 : 22);
  cylG.rotateZ(-Math.PI / 2);
  const cylM = new THREE.Mesh(cylG, plasticMat(0x1c1d21, { rough: 0.35, gloss: 0.5 }));
  cylM.castShadow = true;
  inkThin(cylM, 0.025, 60);
  hookStudio(cylM);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.415, 0.415, 0.3, lowPower() ? 14 : 22, 1, true), metalMat(0xd9dde2, { rough: 0.4, metal: 0.4 }));
  stripe.rotation.z = Math.PI / 2;
  stripe.position.x = 0.62;
  stripe.userData.noInk = true;
  body.add(cylM, stripe);
  body.position.set(mid.x, y, mid.z);
  body.rotation.y = Math.atan2(-dir.z, dir.x);
  g.add(body);
  const pa = V(mid.x - dir.x * 0.98, y, mid.z - dir.z * 0.98);
  const pb = V(mid.x + dir.x * 0.98, y, mid.z + dir.z * 0.98);
  g.add(legs([
    [[V(plain.x, top - 0.3, plain.z), V(plain.x, top + 0.6, plain.z), V(plain.x, y - 0.3, plain.z).lerp(pa, 0.3), pa], 0.07],
    [[V(striped.x, top - 0.3, striped.z), V(striped.x, top + 0.6, striped.z), V(striped.x, y - 0.3, striped.z).lerp(pb, 0.3), pb], 0.07],
  ]));
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
  m.material.map.anisotropy = 16;
  return m;
}

// ---------- module boards ----------
// A PCB lying flat with its printing (mask colour, name, pin names, holes)
// drawn on its top face, and a row of male header pins along one edge.
// draw(c, s, X, Z) may add more printing (s: pixels per unit).
const PPU = () => (lowPower() ? 40 : 64);
function boardMesh(w, d, thick, color, draw, { holes = true } = {}) {
  const s = PPU();
  const tex = canvasTexture(w * s, d * s, (c, W, H) => {
    const base = '#' + new THREE.Color(color).getHexString();
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);
    const gr = c.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.07)');
    gr.addColorStop(1, 'rgba(0,0,0,0.08)');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);
    const X = (x) => (x + w / 2) * s;
    const Z = (z) => (z + d / 2) * s;
    if (holes && w > 4 && d > 3) {
      for (const [hx, hz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = X(hx * (w / 2 - 0.6)), pz = Z(hz * (d / 2 - 0.6));
        c.fillStyle = '#d8d6cf';
        c.beginPath(); c.arc(px, pz, s * 0.42, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a2a2a';
        c.beginPath(); c.arc(px, pz, s * 0.26, 0, Math.PI * 2); c.fill();
      }
    }
    draw?.(c, s, X, Z);
  });
  const side = plasticMat(new THREE.Color(color).multiplyScalar(0.75).getHex(), { rough: 0.7 });
  const top = plasticMat(0xffffff, { map: tex, rough: 0.55, gloss: 0.3 });
  const m = new THREE.Mesh(box(w, thick, d), [side, side, top, side, side, side]);
  m.castShadow = m.receiveShadow = true;
  hookStudio(m);
  return m;
}
const silk = (c, s, t, x, z, size = 0.34, { font = MONO, weight = 700, color = '#f4f4f4', align = 'center', rot = 0 } = {}) => {
  c.save();
  c.translate(x, z);
  c.rotate(rot);
  c.fillStyle = color;
  c.font = `${weight} ${size * s}px ${font}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(t, 0, 0);
  c.restore();
};

// A row of n male header pins on a black strip, as plastic + metal merges.
function headerRow(pl, mt, n, x0, y, z, { spacing = 1, along = 'x', up = 1.0, down = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * spacing;
    const p = along === 'x' ? [x, y + 0.25, z] : [z, y + 0.25, x];
    pl.add(box(along === 'x' ? spacing : 0.62, 0.5, along === 'x' ? 0.62 : spacing), { p, c: 0x1f1f23, ink: 25 });
    const pp = along === 'x' ? [x, y + 0.5 + up / 2 - down / 2, z] : [z, y + 0.5 + up / 2 - down / 2, x];
    mt.add(box(0.16, up + down + 0.5, 0.16), { p: pp, ink: false });
  }
}

function pcbModule({ w, d, color, name, pins, pinEdge = 'top', thick = 0.25, y = 0.35, pinSpacing = 1, draw }) {
  const g = new THREE.Group();
  const n = pins.length;
  const ez = pinEdge === 'top' ? -d / 2 + 0.6 : d / 2 - 0.6;
  const board = boardMesh(w, d, thick, color, (c, s, X, Z) => {
    // pin pads and names
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * pinSpacing;
      c.fillStyle = '#d9c27a';
      c.fillRect(X(x) - s * 0.36, Z(ez) - s * 0.36, s * 0.72, s * 0.72);
      if (pins[i]) silk(c, s, pins[i], X(x), Z(ez + (pinEdge === 'top' ? 0.9 : -0.9)), 0.3, { rot: -Math.PI / 2 });
    }
    if (name) silk(c, s, name, X(0), Z(pinEdge === 'top' ? d / 2 - 0.8 : -d / 2 + 0.8), 0.55, { font: SANS });
    draw?.(c, s, X, Z);
  });
  board.position.y = y + thick / 2;
  g.add(board);
  const pl = new Merge();
  const mt = new Merge();
  headerRow(pl, mt, n, -((n - 1) / 2) * pinSpacing, y + thick, ez, { spacing: pinSpacing, up: 0.55 });
  g.add(pl.mesh(plasticMat(0xffffff, { rough: 0.5 })), mt.mesh(metalMat(0xd8b65a, { rough: 0.25 })));
  const tips = [];
  for (let i = 0; i < n; i++) tips.push(V((i - (n - 1) / 2) * pinSpacing, y + thick + 1.0, ez));
  g.userData.tips = tips;
  g.userData.y = y + thick;
  g.userData.pl = pl;
  return g;
}

// A DIP chip with its legs, into the given merges (plastic, metal); x along its length.
function dip(pl, mt, pins, x, y, z, { w = 2.6, h = 0.9, pitch = 1 } = {}) {
  const L = (pins / 2) * pitch;
  pl.add(rboxG(L, h, w, 0.06, 1), { p: [x, y + 0.3 + h / 2, z], c: 0x1e1f22, ink: 50, hull: true });
  for (let k = 0; k < pins / 2; k++) for (const sz of [-1, 1]) {
    const lx = x - L / 2 + pitch / 2 + k * pitch;
    mt.add(box(0.3, 0.08, 0.35), { p: [lx, y + 0.65, z + sz * (w / 2 + 0.12)], ink: false });
    mt.add(box(0.18, 0.62, 0.08), { p: [lx, y + 0.34, z + sz * (w / 2 + 0.28)], ink: false });
  }
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
  m.add(contactShadow(w, 4, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(m), tips: m.userData.tips, w, d: 4, standing: false };
}

function servo(pins) {
  // SG90 lying on its side, output shaft towards you; a three-wire lead
  // (brown, red, orange, as on a real servo) ending in a 3-pin plug.
  const g = new THREE.Group();
  const bw = 9, bh = 4.8, bd = 9;
  const low = lowPower();
  const caseCol = 0x2f74c8;
  const pl = new Merge();
  pl.add(rboxG(bw, bh, bd * 0.62, 0.3, 2), { p: [0, bh / 2, 0.8], c: caseCol, ink: 60, hull: true });
  // mounting ears, with their screw holes and slots
  pl.add(rboxG(bw + 3.2, bh * 0.85, 0.5, 0.12, 1), { p: [0, bh / 2, -0.1], c: caseCol, ink: 50, hull: true });
  // the gear housing hump and the bearing boss round the shaft
  pl.add(rboxG(bw * 0.58, bh * 0.92, 1.4, 0.35, 2), { p: [-bw * 0.18, bh / 2, 3.95], c: caseCol, ink: 60, hull: true });
  pl.add(cyl(1.25, 1.25, 0.5, low ? 16 : 28), { p: [-bw * 0.26, bh / 2, 4.85], r: [Math.PI / 2, 0, 0], c: caseCol, ink: 50, hull: true });
  pl.add(cyl(1.0, 1.0, 0.6, low ? 14 : 24), { p: [bw * 0.12, bh / 2, 4.75], r: [Math.PI / 2, 0, 0], c: caseCol, ink: 50, hull: true });
  // the back cap, a shade darker, and its screws
  pl.add(rboxG(bw - 0.2, bh - 0.2, 0.6, 0.2, 1), { p: [0, bh / 2, -2.25], c: 0x2866b3, ink: 50 });
  const body = pl.mesh(plasticMat(0xffffff, { rough: 0.32, gloss: 0.6 }), { hull: 0.035 });
  // the screw holes in the ears
  const dk = new Merge();
  for (const sx of [-1, 1]) {
    dk.add(cyl(0.32, 0.32, 0.56, 12), { p: [sx * (bw / 2 + 0.9), bh / 2, -0.1], r: [Math.PI / 2, 0, 0], c: 0x123056, ink: false });
    dk.add(box(0.5, 0.36, 0.56), { p: [sx * (bw / 2 + 1.45), bh / 2, -0.1], c: 0x123056, ink: false });
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) dk.add(cyl(0.22, 0.22, 0.1, 10), { p: [sx * (bw / 2 - 0.6), bh / 2 + sy * (bh / 2 - 0.6), -2.58], r: [Math.PI / 2, 0, 0], c: 0x9aa0a8, ink: false });
  const holes = dk.mesh(plasticMat(0xffffff, { rough: 0.6 }));
  holes.userData.noInk = true;
  const shaft = new THREE.Mesh(knurlGeo(0.55, 1.1, 12), plasticMat(0xf2f2f2, { rough: 0.5 }));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(-bw * 0.26, bh / 2, 5.0);
  inkThin(shaft, 0.02, 50);
  // the horn: one white arm with a row of holes, on a round hub.
  // It is a direct child at z = 5.6, so Band 6's lab can turn it.
  const horn = new THREE.Group();
  horn.position.set(-bw * 0.26, bh / 2, 5.6);
  const hs = new THREE.Shape();
  hs.moveTo(-2.8, -0.28);
  hs.lineTo(-0.9, -0.48);
  hs.absarc(0, 0, 0.95, Math.PI + 0.53, -0.53, false);
  hs.lineTo(2.8, -0.28);
  hs.absarc(2.8, 0, 0.28, -Math.PI / 2, Math.PI / 2, false);
  hs.lineTo(0.9, 0.48);
  hs.absarc(0, 0, 0.95, 0.53, Math.PI - 0.53, false);
  hs.lineTo(-2.8, 0.28);
  hs.absarc(-2.8, 0, 0.28, Math.PI / 2, Math.PI * 1.5, false);
  for (const x of [-2.6, -2.0, -1.4, 1.4, 2.0, 2.6]) {
    const h = new THREE.Path();
    h.absarc(x, 0, 0.11, 0, Math.PI * 2, true);
    hs.holes.push(h);
  }
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelOffset: -0.04, bevelSegments: 1, curveSegments: low ? 6 : 10 });
  hg.translate(0, 0, -0.2);
  const hornMesh = new THREE.Mesh(hg, plasticMat(0xf4f4f2, { rough: 0.5 }));
  hornMesh.castShadow = true;
  hornMesh.userData.round = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.5, low ? 14 : 24), hornMesh.material);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.25;
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), metalMat(0xb9bdc3));
  screw.rotation.x = Math.PI / 2;
  screw.position.z = 0.52;
  screw.userData.noInk = true;
  horn.add(hornMesh, hub, screw);
  const sticker = textPlate(5.2, 1.6, ['SG90  9g', 'MICRO SERVO'], { bg: null, color: '#ffffff', size: 0.6, weight: 700, font: HEAD });
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(0.7, bh + 0.012, 0.7);
  g.add(body, holes, shaft, horn, sticker);
  // the lead leaves the back of the case and ends in a plug
  const plug = new Merge();
  plug.add(rboxG(2.6, 0.9, 1.6, 0.08, 1), { p: [bw / 2 + 2.6, 0.45, -3.2], c: 0x1f1f23, ink: 25 });
  for (let i = 0; i < 3; i++) plug.add(funnelGeo(0.22, 0.1, 0.2, 0.8), { p: [bw / 2 + 2.6 + (i - 1) * 0.8, 0.45, -4.005], r: [-Math.PI / 2, 0, 0], c: 0x2a2a2e, ink: false });
  const plugM = plug.mesh(plasticMat(0xffffff, { rough: 0.5 }));
  g.add(plugM);
  const leadCols = { orange: 0xf08a1c, red: 0xd9342b, brown: 0x6b3f22 };
  const tips = [];
  const lead = new Merge();
  pins.forEach((p, i) => {
    const x = bw / 2 + 2.6 + (i - 1) * 0.8;
    const col = leadCols[p] ?? 0x555555;
    lead.add(tubeGeo([V(bw / 2 - 0.5, 1.6 + i * 0.05, 0.5 + (i - 1) * 0.28), V(bw / 2 + 1.5, 1.0, 0.2 + (i - 1) * 0.28), V(x, 0.7, -1.6), V(x, 0.6, -2.4)], 0.14, 24, low ? 5 : 8), { c: col, ink: false });
    tips.push(V(x, 1.1, -3.6));
  });
  const leadM = lead.mesh(plasticMat(0xffffff, { rough: 0.45, gloss: 0.4 }));
  leadM.userData.noInk = true;
  g.add(leadM);
  g.add(contactShadow(bw + 3, bd * 0.75, { blur: 0.8, opacity: 0.3 }));
  hookStudio(body);
  return { group: shadowAll(g), tips, w: bw + 7, d: 11, plugTips: true, zOff: 3.5 };
}

function uln2003(pins) {
  const g = new THREE.Group();
  const w = 9.5, d = 8.5;
  const m = pcbModule({
    w, d, color: 0x2a7a44, name: '', pins, draw: (c, s, X, Z) => {
      silk(c, s, 'ULN2003', X(-1), Z(-1.25), 0.5, { font: HEAD });
      for (let i = 0; i < 4; i++) silk(c, s, 'ABCD'[i], X(-3.8 + i * 0.8), Z(3.35), 0.3);
      c.strokeStyle = '#f4f4f4';
      c.lineWidth = s * 0.05;
      c.strokeRect(X(-4.95), Z(-0.35), s * 7.9, s * 1.9);
    },
  });
  g.add(m);
  const pl = new Merge();
  const mt = new Merge();
  dip(pl, mt, 16, -1, 0.6, 0.6, { w: 1.6, h: 0.5 });
  // the white socket the stepper motor plugs into
  pl.add(rboxG(3.2, 1.2, 1.6, 0.08, 1), { p: [2.6, 1.2, 2.6], c: 0xf2f2f0, ink: 25 });
  for (let i = 0; i < 5; i++) pl.add(funnelGeo(0.22, 0.1, 0.25, 0.9), { p: [1.4 + i * 0.6, 1.805, 2.6], c: 0xdedad2, ink: false });
  g.add(pl.mesh(plasticMat(0xffffff, { rough: 0.45 })), mt.mesh(metalMat(TIN)));
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(box(0.5, 0.3, 0.4), plasticMat(0xe23b2a, { emissive: 0xe23b2a, emissiveIntensity: 0.25, rough: 0.3, gloss: 0.7 }));
    l.position.set(-3.8 + i * 0.8, 0.75, 2.6);
    g.add(l);
  }
  g.add(contactShadow(w, d, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

// A 5 mm LED head standing on a module board (no legs), for the modules.
function moduleLed(color, x, z, y, { opacity = 0.88, scale = 1 } = {}) {
  const lens = plasticMat(color, { rough: 0.18, gloss: 0.9, transparent: true, opacity, emissive: color, emissiveIntensity: 0.1 });
  const m = new THREE.Mesh(lensGeo(), lens);
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  m.castShadow = true;
  inkThin(m, 0.03, 50);
  return m;
}

function trafficModule(pins) {
  const g = new THREE.Group();
  const w = Math.max(5, pins.length * 1.1 + 1), d = 7.5;
  const m = pcbModule({ w, d, color: 0x1e1f23, name: '', pins, draw: (c, s, X, Z) => {
    ['R', 'Y', 'G'].forEach((t, i) => silk(c, s, t, X(1.6), Z(-1.1 + i * 2.0), 0.42, { font: SANS }));
  } });
  g.add(m);
  [0xe23b2a, 0xf4c21e, 0x2fae55].forEach((c, i) => g.add(moduleLed(c, 0, -1.1 + i * 2.0, 0.6, { scale: 0.85 })));
  g.add(contactShadow(w, d, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

function rgbModule(pins) {
  const g = new THREE.Group();
  const w = Math.max(5, pins.length * 1.1 + 1), d = 5;
  const m = pcbModule({ w, d, color: 0x1e1f23, name: 'RGB', pins });
  g.add(m);
  g.add(moduleLed(0xf3f0ea, 0, 0.4, 0.6, { opacity: 0.92, scale: 0.95 }));
  g.add(contactShadow(w, d, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

// An LCD's glass: a green backlit panel with faint character cells.
function lcdScreen(w, h, lines, fs) {
  return decal(w, h, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#9fd35a');
    gr.addColorStop(1, '#79b83a');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);
    const cw = W / 17.2, ch = H / 2.6;
    const x0 = (W - cw * 16) / 2, y0 = (H - ch * 2) / 2;
    c.fillStyle = 'rgba(30,70,20,0.10)';
    for (let r = 0; r < 2; r++) for (let k = 0; k < 16; k++) c.fillRect(x0 + k * cw + cw * 0.06, y0 + r * ch + ch * 0.06, cw * 0.88, ch * 0.88);
    c.fillStyle = '#1f3a12';
    c.font = `700 ${ch * 0.78 * fs}px ${MONO}`;
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    lines.forEach((t, r) => { for (let k = 0; k < Math.min(16, t.length); k++) c.fillText(t[k], x0 + (k + 0.5) * cw, y0 + (r + 0.52) * ch); });
    const sh = c.createLinearGradient(0, 0, W, H);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)');
    sh.addColorStop(0.4, 'rgba(255,255,255,0)');
    c.fillStyle = sh;
    c.fillRect(0, 0, W, H);
  }, { px: 160, transparent: false });
}

function lcd(pins, i2c) {
  const g = new THREE.Group();
  if (i2c) {
    // lying flat, screen up, the I2C backpack's four pins on the left edge
    const w = 18, d = 7.8;
    const board = boardMesh(w, d, 0.25, 0x1f7a3d, (c, s, X, Z) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = '#d9c27a';
        c.beginPath(); c.arc(X(-6.6 + i * 0.9), Z(-d / 2 + 0.55), s * 0.22, 0, Math.PI * 2); c.fill();
      }
    });
    board.position.y = 0.45;
    const pl = new Merge();
    pl.add(rboxG(14.5, 0.8, 5.4, 0.1, 1), { p: [0.9, 0.95, 0], c: 0x1c1d21, ink: 25 });
    // the backpack peeking out at the left, under the board
    pl.add(box(2.2, 0.2, 5.0), { p: [-w / 2 + 1.0, 0.22, 0], c: 0x1a1a1e, ink: 25 });
    const mt = new Merge();
    headerRow(pl, mt, pins.length, -(pins.length - 1) / 2, 0.6, -w / 2 + 0.6, { along: 'z', up: 0.4 });
    const screen = lcdScreen(13, 3.6, ['Distance:', '  23 cm'], 1);
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(0.9, 1.36, 0);
    g.add(board, screen, pl.mesh(plasticMat(0xffffff, { rough: 0.5 })), mt.mesh(metalMat(0xd8b65a, { rough: 0.25 })));
    const tips = pins.map((p, i) => {
      const z = (i - (pins.length - 1) / 2) * 1;
      const t = textPlate(1.6, 0.7, p, { color: '#f4f4f4', size: 0.42, font: MONO, weight: 700 });
      t.rotation.x = -Math.PI / 2;
      t.position.set(-w / 2 + 1.9, 0.59, z);
      g.add(t);
      return V(-w / 2 + 0.6, 1.2, z);
    });
    g.add(contactShadow(w, d, { blur: 0.7, opacity: 0.28 }));
    return { group: shadowAll(g), tips, w, d };
  }
  // the bare kind, standing up behind the board, 16 pins along its lower edge
  const w = 24, h = 10.2;
  const s = PPU();
  const n = pins.length;
  const tex = canvasTexture(w * s, h * s, (c, W, H) => {
    c.fillStyle = '#1f7a3d';
    c.fillRect(0, 0, W, H);
    for (const [hx, hy] of [[1, 1], [w - 1, 1], [1, h - 1], [w - 1, h - 1]]) {
      c.fillStyle = '#d8d6cf'; c.beginPath(); c.arc(hx * s, hy * s, s * 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#123'; c.beginPath(); c.arc(hx * s, hy * s, s * 0.3, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < n; i++) {
      const x = (1.5 + i) * s;
      c.fillStyle = '#d9c27a'; c.beginPath(); c.arc(x, H - s * 0.75, s * 0.3, 0, Math.PI * 2); c.fill();
      silk(c, s, String(i + 1), x, H - s * 1.5, 0.3);
    }
  });
  const side = plasticMat(0x165a2d, { rough: 0.7 });
  const board = new THREE.Mesh(box(w, h, 0.25), [side, side, side, side, plasticMat(0xffffff, { map: tex, rough: 0.55 }), side]);
  board.position.set(0, h / 2 + 0.4, 0);
  const frame = rbox(19.5, 6.4, 0.9, 0x1c1d21, 0.1);
  frame.position.set(0, h / 2 + 0.9, 0.55);
  const screen = lcdScreen(18, 4.6, ['Distance:', '  23 cm'], 1);
  screen.position.set(0, h / 2 + 0.9, 1.02);
  g.add(board, frame, screen);
  const pl = new Merge();
  const mt = new Merge();
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 1.5 + i;
    pl.add(box(1, 0.62, 0.5), { p: [x, 1.0, 0.4], c: 0x1f1f23, ink: 25 });
    mt.add(box(0.16, 1.4, 0.16), { p: [x, 0.9, 0.4], ink: false });
  }
  g.add(pl.mesh(plasticMat(0xffffff, { rough: 0.5 })), mt.mesh(metalMat(0xd8b65a, { rough: 0.25 })));
  hookStudio(board);
  const tips = [];
  for (let i = 0; i < n; i++) tips.push(V(-w / 2 + 1.5 + i, 0.9, 0.8));
  g.add(contactShadow(w, 1.6, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips, w, d: 1.2, standing: true, h };
}

function sonar(pins) {
  // HC-SR04 standing up behind the board, its two "eyes" towards you.
  const g = new THREE.Group();
  const w = 14, h = 6.4;
  const low = lowPower();
  const s = PPU();
  const n = pins.length;
  const tex = canvasTexture(w * s, h * s, (c, W, H) => {
    c.fillStyle = '#1d5fa8';
    c.fillRect(0, 0, W, H);
    const gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(0,0,0,0.1)');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);
    for (const [hx, hy] of [[0.7, 0.7], [w - 0.7, 0.7], [0.7, h - 0.7], [w - 0.7, h - 0.7]]) {
      c.fillStyle = '#d8d6cf'; c.beginPath(); c.arc(hx * s, hy * s, s * 0.42, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#18263a'; c.beginPath(); c.arc(hx * s, hy * s, s * 0.24, 0, Math.PI * 2); c.fill();
    }
    silk(c, s, 'T', W / 2 - 3.9 * s, H * 0.1, 0.5, { font: SANS });
    silk(c, s, 'R', W / 2 + 3.9 * s, H * 0.1, 0.5, { font: SANS });
    silk(c, s, 'HC-SR04', W / 2, H * 0.12, 0.62, { font: HEAD });
    for (let i = 0; i < n; i++) {
      const x = W / 2 + (i - (n - 1) / 2) * s;
      c.fillStyle = '#d9c27a';
      c.fillRect(x - s * 0.3, H - s * 0.9, s * 0.6, s * 0.6);
      if (pins[i]) silk(c, s, pins[i], x, H - s * 1.55, 0.3, { rot: -Math.PI / 2 });
    }
  });
  const side = plasticMat(0x174d88, { rough: 0.7 });
  const board = new THREE.Mesh(box(w, h, 0.25), [side, side, side, side, plasticMat(0xffffff, { map: tex, rough: 0.55, gloss: 0.3 }), side]);
  board.position.set(0, h / 2 + 1.4, 0);
  board.castShadow = true;
  hookStudio(board);
  g.add(board);
  // the two ultrasonic transducers: aluminium cans with a black mesh face
  const can = new Merge();
  const prof = [[0, 0], [2.0, 0], [2.0, 2.25], [1.92, 2.4], [1.62, 2.4], [1.6, 2.3], [0, 2.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const canG = new THREE.LatheGeometry(prof, low ? 20 : 36);
  for (const sx of [-1, 1]) can.add(canG, { p: [sx * 3.9, h / 2 + 1.4, 0.12], r: [Math.PI / 2, 0, 0], ink: 50, hull: true });
  // the crystal between them
  can.add(stadiumGeo(2.2, 0.8, 0.7), { p: [0, h - 0.2, 0.12], r: [Math.PI / 2, 0, 0], ink: 50, hull: true });
  g.add(can.mesh(metalMat(0xd3d6db, { rough: 0.35 }), { hull: 0.03 }));
  MESHTEX ??= canvasTexture(128, 128, (c, W, H) => {
    c.fillStyle = '#26262b';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#3d3d44';
    for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < W; x += 6) c.fillRect(x, y, 3, 3);
  });
  MESHTEX.wrapS = MESHTEX.wrapT = THREE.RepeatWrapping;
  MESHTEX.repeat.set(2.5, 2.5);
  for (const sx of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.6, low ? 20 : 32), plasticMat(0xffffff, { map: MESHTEX, rough: 0.9 }));
    face.position.set(sx * 3.9, h / 2 + 1.4, 2.43);
    face.userData.noInk = true;
    g.add(face);
  }
  const pl = new Merge();
  const mt = new Merge();
  for (let i = 0; i < n; i++) {
    const x = i - (n - 1) / 2;
    pl.add(box(1, 0.62, 0.5), { p: [x, 1.4, 0.35], c: 0x1f1f23, ink: 25 });
    mt.add(box(0.16, 0.16, 0.9), { p: [x, 1.4, 0.55], ink: false });
    mt.add(box(0.16, 0.7, 0.16), { p: [x, 1.1, 0.95], ink: false });
  }
  g.add(pl.mesh(plasticMat(0xffffff, { rough: 0.5 })), mt.mesh(metalMat(0xd8b65a, { rough: 0.25 })));
  const tips = [];
  for (let i = 0; i < n; i++) tips.push(V(i - (n - 1) / 2, 1.1, 0.7));
  g.add(contactShadow(w, 2.4, { blur: 0.6, opacity: 0.22 }));
  return { group: shadowAll(g), tips, w, d: 3, standing: true, h: h + 1.4 };
}
let MESHTEX;
// A rounded-end slab (an HC-49 crystal can), standing on y = 0.
function stadiumGeo(L, W, H) {
  const k = `st${L},${W},${H}`;
  if (GEO[k]) return GEO[k];
  const s = new THREE.Shape();
  const r = W / 2;
  s.moveTo(-L / 2 + r, -r);
  s.lineTo(L / 2 - r, -r);
  s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L / 2 + r, r);
  s.absarc(-L / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: H - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelOffset: -0.05, bevelSegments: 2, curveSegments: lowPower() ? 6 : 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.05, 0);
  return (GEO[k] = g);
}
export { stadiumGeo };

function keypad(pins) {
  const g = new THREE.Group();
  const w = 11, d = 12;
  const s = lowPower() ? 48 : 80;
  const keys = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
  const tex = canvasTexture(w * s, d * s, (c, W, H) => {
    c.fillStyle = '#1c1d21';
    c.fillRect(0, 0, W, H);
    keys.forEach((k, i) => {
      const x = W / 2 + ((i % 4) - 1.5) * 2.5 * s;
      const z = H / 2 + (Math.floor(i / 4) - 1.5) * 2.6 * s;
      const kw = 2.1 * s;
      const letter = /[A-D]/.test(k);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.roundRect(x - kw / 2 + s * 0.05, z - kw / 2 + s * 0.1, kw, kw, s * 0.3); c.fill();
      const gr = c.createLinearGradient(0, z - kw / 2, 0, z + kw / 2);
      gr.addColorStop(0, letter ? '#e0435c' : '#4a86e0');
      gr.addColorStop(1, letter ? '#b81c39' : '#2a63bd');
      c.fillStyle = gr;
      c.beginPath(); c.roundRect(x - kw / 2, z - kw / 2, kw, kw, s * 0.3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = s * 0.05;
      c.stroke();
      c.fillStyle = '#ffffff';
      c.font = `700 ${s * 1.1}px ${HEAD}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(k, x, z + s * 0.05);
    });
  });
  const side = plasticMat(0x141518, { rough: 0.6 });
  const pad = new THREE.Mesh(box(w, 0.3, d), [side, side, plasticMat(0xffffff, { map: tex, rough: 0.35, gloss: 0.5 }), side, side, side]);
  pad.position.set(0, 0.15, 1.2);
  pad.castShadow = pad.receiveShadow = true;
  hookStudio(pad);
  g.add(pad);
  // ribbon tail with eight silver traces, ending in an 8-pin socket
  const ribbon = canvasTexture(pins.length * 32, 96, (c, W, H) => {
    c.fillStyle = '#d9c8a0';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#9fa4aa';
    for (let i = 0; i < pins.length; i++) c.fillRect(i * 32 + 11, 0, 10, H);
  });
  const tail = new THREE.Mesh(box(pins.length * 1.0, 0.08, 2.6), plasticMat(0xffffff, { map: ribbon, rough: 0.5, transparent: true, opacity: 0.95 }));
  tail.position.set(0, 0.06, -6.0);
  tail.userData.noInk = true;
  g.add(tail);
  const tips = pins.map((p, i) => V((i - (pins.length - 1) / 2) * 1.0, 0.4, -7.2));
  const pl = new Merge();
  pl.add(box(pins.length * 1.0, 0.5, 0.62), { p: [0, 0.3, -7.2], c: 0x1f1f23, ink: 25 });
  const hd = pl.mesh(plasticMat(0xffffff, { rough: 0.5 }));
  g.add(hd);
  g.add(contactShadow(w, d + 3, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips, w, d: 15, zOff: 2.2 };
}

function rain(pins) {
  const g = new THREE.Group();
  const w = Math.max(6, pins.length * 1.1 + 1.5), d = 5.6;
  const m = pcbModule({ w, d, color: 0x1f5f9a, name: 'rain sensor', pins: pins.map(() => '') });
  g.add(m);
  const pl = new Merge();
  const mt = new Merge();
  pl.add(rboxG(1.6, 1.0, 1.6, 0.08, 1), { p: [-1.5, 1.1, 0.8], c: 0x2f62a8, ink: 25 });
  pl.add(cyl(0.55, 0.55, 0.3, 16), { p: [-1.5, 1.72, 0.8], c: 0xf2f2f0, ink: 50, hull: true });
  pl.add(box(0.9, 0.06, 0.16), { p: [-1.5, 1.88, 0.8], c: 0x888888, ink: false });
  dip(pl, mt, 8, 1.4, 0.5, 0.8, { w: 1.2, h: 0.4, pitch: 0.5 });
  for (const [x, c] of [[-0.2, 0xe23b2a], [0.6, 0x2fae55]]) pl.add(box(0.5, 0.25, 0.35), { p: [x, 0.75, -0.3], c, ink: 25 });
  g.add(pl.mesh(plasticMat(0xffffff, { rough: 0.45 }), { hull: 0.02 }), mt.mesh(metalMat(TIN)));
  g.add(contactShadow(w, d, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips: m.userData.tips, w, d };
}

let GRILLE;
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
    const mt = new Merge();
    for (let i = 0; i < n; i++) mt.add(box(0.16, 0.16, 1.6), { p: [i - (n - 1) / 2, 0.4, -1.0], ink: false });
    g.add(mt.mesh(metalMat(0xd8b65a, { rough: 0.25 })));
  } else {
    const m = pcbModule({ w, d: 6.5, color: 0x1f5f9a, name: '', pins: pins.map(() => '') });
    g.add(m);
    tips = m.userData.tips;
    d = 6.5;
  }
  GRILLE ??= canvasTexture(240, 300, (c, W, H) => {
    c.fillStyle = '#4aa3df';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#1d4e78';
    for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) c.fillRect(24 + k * 52, 28 + r * 44, 36, 26);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = `700 22px ${HEAD}`;
    c.textAlign = 'center';
    c.fillText('DHT11', W / 2, H - 8);
  });
  const sh = plasticMat(0x4aa3df, { rough: 0.5 });
  const shell = new THREE.Mesh(rboxG(4.7, bare ? 6 : 5, 2.3, 0.15, 2), sh);
  shell.position.set(0, bare ? 3.1 : 3.3, bare ? 0 : 0.9);
  shell.userData.round = true;
  const face = new THREE.Mesh(plane(4.4, bare ? 5.7 : 4.7), plasticMat(0xffffff, { map: GRILLE, rough: 0.55 }));
  face.position.set(0, shell.position.y, shell.position.z + 1.16);
  face.userData.noInk = true;
  hookStudio(shell);
  g.add(shell, face);
  g.add(contactShadow(w, d, { blur: 0.6, opacity: 0.25 }));
  return { group: shadowAll(g), tips, w, d };
}

function motor() {
  // a small DC motor (the "130" kind) lying down, with a fan on its shaft
  const g = new THREE.Group();
  const low = lowPower();
  // can with two flat sides: a stadium-ish section extruded along x
  const sec = new THREE.Shape();
  const R = 2.2, F = 1.75;
  const a = Math.acos(F / R);
  sec.absarc(0, 0, R, a, Math.PI - a, false);
  sec.absarc(0, 0, R, Math.PI + a, -a, false);
  const canG = new THREE.ExtrudeGeometry(sec, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.1, bevelOffset: -0.1, bevelSegments: 2, curveSegments: low ? 12 : 24 });
  canG.rotateY(Math.PI / 2);
  canG.translate(-2.8, 2.25, 0);
  const canM = new THREE.Mesh(canG, metalMat(0xc9ccd1, { rough: 0.3 }));
  canM.userData.round = true;
  canM.castShadow = true;
  hookStudio(canM);
  const pl = new Merge();
  pl.add(cyl(2.0, 2.0, 0.6, low ? 16 : 28), { p: [-3.3, 2.25, 0], r: [0, 0, Math.PI / 2], c: 0xe8e1cf, ink: 50, hull: true });
  pl.add(cyl(0.7, 0.7, 0.3, 16), { p: [3.05, 2.25, 0], r: [0, 0, Math.PI / 2], c: 0xc9ccd1, ink: 50 });
  // the fan: hub and two twisted blades
  pl.add(cyl(0.55, 0.55, 0.6, 16), { p: [4.3, 2.25, 0], r: [0, 0, Math.PI / 2], c: 0xca1f3f, ink: 50, hull: true });
  for (const sgn of [-1, 1]) pl.add(rboxG(0.22, 2.0, 1.0, 0.1, 1), { p: [4.3, 2.25 + sgn * 1.2, 0], r: [sgn * 0.5, 0, 0], c: 0xca1f3f, ink: 50, hull: true });
  const plM = pl.mesh(plasticMat(0xffffff, { rough: 0.45, gloss: 0.4 }), { hull: 0.03 });
  const mt = new Merge();
  mt.add(cyl(0.22, 0.22, 1.6, 10), { p: [3.7, 2.25, 0], r: [0, 0, Math.PI / 2], ink: false });
  for (const z of [-0.8, 0.8]) mt.add(box(0.12, 1.0, 0.45), { p: [-3.7, 3.0, z], c: 0xd8b65a, ink: 25 });
  g.add(canM, plM, mt.mesh(metalMat(0xdfe2e6)));
  // two terminals on the back cap
  const tips = [V(-3.8, 3.2, -0.8), V(-3.8, 3.2, 0.8)];
  g.add(contactShadow(8, 4, { blur: 0.8, opacity: 0.28 }));
  return { group: shadowAll(g), tips, w: 9, d: 5 };
}

let CELLTEX;
export function batteryPack() {
  // four AA cells side by side in a black holder
  const g = new THREE.Group();
  const w = 12.5, d = 6.6;
  const low = lowPower();
  const pl = new Merge();
  pl.add(rboxG(w, 1.3, d, 0.15, 2), { p: [0, 0.65, 0], c: 0x1c1d21, ink: 60, hull: true });
  // ribs between the cells and end walls
  for (let i = 0; i < 5; i++) pl.add(box(w - 1.4, 0.5, 0.12), { p: [0, 1.45, (i - 2) * 1.5], c: 0x232428, ink: false });
  for (const sx of [-1, 1]) pl.add(box(0.5, 1.0, d - 0.2), { p: [sx * (w / 2 - 0.25), 1.6, 0], c: 0x1c1d21, ink: 25 });
  const tray = pl.mesh(plasticMat(0xffffff, { rough: 0.55 }), { hull: 0.03 });
  CELLTEX ??= canvasTexture(512, 128, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#2f6fd0');
    gr.addColorStop(0.62, '#2f6fd0');
    gr.addColorStop(0.62, '#e8e8e8');
    gr.addColorStop(1, '#e8e8e8');
    c.fillStyle = gr;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff';
    c.font = `800 ${H * 0.2}px ${HEAD}`;
    c.textBaseline = 'middle';
    c.fillText('AA  1.5V', W * 0.08, H * 0.5);
    c.fillStyle = '#2f6fd0';
    c.fillText('+', W * 0.86, H * 0.5);
  });
  CELLTEX.wrapT = THREE.RepeatWrapping;
  const cellMat = plasticMat(0xffffff, { map: CELLTEX, rough: 0.35, gloss: 0.6 });
  const cellG = new THREE.CylinderGeometry(0.72, 0.72, w - 1.6, low ? 14 : 24, 1, true);
  cellG.rotateZ(Math.PI / 2);
  // rotate the uvs so the wrap's print runs along the cell
  const uv = cellG.attributes.uv;
  // (u along the cell, v round it, shifted so the print faces up and out)
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, 1 - v, u + 0.375); }
  g.add(tray);
  const ends = new Merge();
  for (let i = 0; i < 4; i++) {
    const flip = i % 2 ? -1 : 1;
    const cell = new THREE.Mesh(cellG, cellMat);
    cell.position.set(0, 1.35, (i - 1.5) * 1.5);
    if (flip < 0) cell.rotation.y = Math.PI;
    cell.userData.noInk = true;
    cell.castShadow = true;
    g.add(cell);
    ends.add(cyl(0.72, 0.72, 0.1, low ? 14 : 24), { p: [flip * ((w - 1.6) / 2), 1.35, (i - 1.5) * 1.5], r: [0, 0, Math.PI / 2], ink: false });
    ends.add(cyl(0.72, 0.72, 0.1, low ? 14 : 24), { p: [-flip * ((w - 1.6) / 2), 1.35, (i - 1.5) * 1.5], r: [0, 0, Math.PI / 2], ink: false });
    ends.add(cyl(0.25, 0.25, 0.3, 12), { p: [flip * ((w - 1.6) / 2 + 0.15), 1.35, (i - 1.5) * 1.5], r: [0, 0, Math.PI / 2], ink: false });
  }
  g.add(ends.mesh(metalMat(0xd8dbe0)));
  // the label, moulded on the holder's front
  const t = textPlate(6, 0.9, '4 × AA = 6 V', { color: '#ffffff', size: 0.6, weight: 700 });
  t.position.set(0, 0.68, d / 2 + 0.012);
  g.add(t);
  // leads leave the left end: + red, − black (drawn in rail colours by the lab)
  const tips = [V(-w / 2 + 0.3, 1.0, -1.2), V(-w / 2 + 0.3, 1.0, 1.2)];
  g.add(contactShadow(w, d, { blur: 0.7, opacity: 0.3 }));
  hookStudio(tray);
  return { group: shadowAll(g), tips, w, d };
}

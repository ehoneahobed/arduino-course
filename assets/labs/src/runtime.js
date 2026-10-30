// Shared 3D stage for the Arduino Ladder's labs: renderer, camera, orbit
// controls, click/hover picking, callout cards, a view toolbar, tweening and a
// small side-panel UI helper.
//
// Ported from the BIH JHS Tech Club runtime (src/labs/runtime.js in that
// repo) so both sites share one illustrated look. Changes for this course:
//   - the lab builds its own markup, so a page only needs <div class="lab" data-lab="…">
//   - it draws only when something changes (kind to old PCs), and turns off
//     shadows and antialiasing on software WebGL
//   - optional `fit: [w, h]` frames a box of that size, `pan`, zoom limits
//   - callouts can be `quiet` (shown only on the tour or when selected)
//   - the canvas takes keyboard focus: arrows turn, + and - zoom, 0 resets
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };

// Bozoma Innovation Hub colours (plum, red, gold), plus a few helpers.
export const COLORS = {
  plum: 0x24182e,
  softPlum: 0x5a4470,
  gold: 0xffbe00,
  red: 0xca1f3f,
  green: 0x1f8a70,
  light: 0xf9f9f9,
  grey: 0xd9d3de,
  sky: 0xf4f0f6,
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Software WebGL (SwiftShader, llvmpipe, Microsoft Basic Render) means an old
// PC or a locked-down one: draw at 1x, no antialiasing, no soft shadows.
let lowPowerCache;
export function lowPower() {
  if (lowPowerCache !== undefined) return lowPowerCache;
  lowPowerCache = false;
  try {
    if (/[?&]lowpower\b/.test(location.search)) return (lowPowerCache = true);
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
    lowPowerCache = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {}
  return lowPowerCache;
}

// The markup a lab needs. A page may write it out itself (as the Tech Club
// does) or leave an empty <div class="lab" data-lab="…">.
export function ensureShell(host, hint) {
  if (!host.querySelector('.lab-canvas')) {
    host.innerHTML = `<div class="lab-canvas"><div class="lab-status">Loading the 3D view…</div><span class="lab-hint">${hint || 'Drag to turn · scroll or pinch to zoom · click things'}</span></div>
<div class="lab-side"><div class="lab-missions" aria-live="polite"></div><div class="lab-info" aria-live="polite"></div><div class="lab-controls"></div></div>`;
  }
  host.classList.add('lab-ready');
}

export function createStage(host, opts = {}) {
  const wrap = host.querySelector('.lab-canvas');
  const low = lowPower();
  lowInk = low;
  // Transparent canvas over the CSS "paper" background, like an illustrated diagram.
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2));
  renderer.shadowMap.enabled = opts.shadows !== false && !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  wrap.appendChild(renderer.domElement);
  // The "Drag to look around" hint fades once the learner has tried it (or after 8 seconds).
  const touched = () => wrap.classList.add('touched');
  renderer.domElement.addEventListener('pointerdown', touched, { once: true });
  setTimeout(touched, 8000);

  const scene = new THREE.Scene();
  if (opts.background !== undefined) scene.background = new THREE.Color(opts.background);

  // A fixed-angle orthographic camera: no perspective distortion, so a model
  // reads like a clear technical drawing.
  const start = new THREE.Vector3(...(opts.camera ?? [0, 6, 12]));
  const target0 = new THREE.Vector3(...(opts.target ?? [0, 0, 0]));
  const dist0 = start.distanceTo(target0);
  const ortho = !opts.perspective;
  const viewH = 2 * dist0 * Math.tan(THREE.MathUtils.degToRad((opts.fov ?? 45) / 2)) * (opts.frame ?? 1);
  const camera = ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, dist0 * 4 + 200) : new THREE.PerspectiveCamera(opts.fov ?? 45, 1, 0.1, 500);
  camera.position.copy(start);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target0);
  controls.enableDamping = true;
  controls.maxPolarAngle = opts.maxPolar ?? Math.PI * 0.49;
  controls.minDistance = opts.minDistance ?? 3;
  controls.maxDistance = opts.maxDistance ?? 40;
  controls.minZoom = opts.minZoom ?? dist0 / (opts.maxDistance ?? 40);
  controls.maxZoom = opts.maxZoom ?? dist0 / (opts.minDistance ?? 3);
  controls.enablePan = opts.pan ?? false;
  controls.screenSpacePanning = true;
  // Keyboard turning is done by the stage itself (below), not OrbitControls.

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cfe0, 2.1));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.5);
  const sunAt = opts.sun ?? [6, 12, 8];
  sun.position.set(target0.x + sunAt[0], sunAt[1], target0.z + sunAt[2]);
  sun.target.position.copy(target0);
  scene.add(sun.target);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  const s = opts.shadowSize ?? 14;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: Math.max(50, s * 4) });
  scene.add(sun);

  if (opts.ground !== false) {
    // A shadow-only floor: the paper shows through, with a soft shadow under the model.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(opts.groundSize ?? 30, 64), new THREE.ShadowMaterial({ color: 0x24182e, opacity: 0.14 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(target0.x, opts.groundY ?? 0, target0.z);
    ground.receiveShadow = true;
    ground.userData.noInk = true;
    scene.add(ground);
  }

  const tickers = new Set();
  // Tweens (moves, timers) keep going while the lab is scrolled off-screen;
  // only drawing and idle animations pause.
  const tweens = new Set();
  const clickables = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let dirty = 2;
  const invalidate = () => { dirty = 2; };

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...clickables.keys()], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !clickables.has(o)) o = o.parent;
      if (o && live(o) && !o.userData.noPick) {
        lastHit = h;
        return o;
      }
    }
    return null;
  }
  let lastHit = null;

  // Raycasting ignores visibility, so skip hidden or removed objects ourselves.
  function live(o) {
    for (let p = o; p; p = p.parent) {
      if (!p.visible) return false;
      if (p === scene) return true;
    }
    return false;
  }

  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return; // that was a drag to rotate, not a click
    const o = pick(e);
    if (o) clickables.get(o)(o, e, lastHit);
    else opts.onMiss?.(e);
    invalidate();
  });
  let lastMove = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.buttons) return;
    const now = performance.now();
    if (now - lastMove < 40) return; // hover picking at most 25 times a second
    lastMove = now;
    const o = pick(e);
    renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
    if (o !== hovered) {
      setGlow(hovered, false);
      setGlow(o, true);
      hovered = o;
      invalidate();
    }
  });

  function resize() {
    const w = wrap.clientWidth || 600;
    const h = wrap.clientHeight || 420;
    renderer.setSize(w, h, false);
    if (ortho) {
      let vh;
      if (opts.fit) {
        // Frame a box of fit[0] x fit[1] world units, whatever the canvas shape.
        // The toolbar takes about 56px at the bottom.
        const usable = Math.max(0.6, (h - 56) / h);
        vh = Math.max(opts.fit[1], (opts.fit[0] * h) / w) / usable;
      } else {
        // Fit the same framing on a narrow (phone) canvas as on a wide one.
        vh = viewH * Math.max(1, (1.35 * h) / w);
      }
      // with fit, lift the picture clear of the toolbar along the bottom
      const d = opts.fit ? (20 / h) * vh : 0;
      Object.assign(camera, { left: (-vh * w) / h / 2, right: (vh * w) / h / 2, top: vh / 2 - d, bottom: -vh / 2 - d });
      api.viewHeight = vh;
    } else {
      camera.aspect = w / h;
      const base = opts.fov ?? 45;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * Math.max(1, (1.35 * h) / w)));
    }
    camera.updateProjectionMatrix();
    invalidate();
  }

  // Pause drawing when the lab is scrolled off-screen or hidden.
  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  }).observe(wrap);

  controls.addEventListener('change', invalidate);

  let frame = 0;
  inkScene(scene);
  const callouts = createCallouts(wrap, camera, renderer, live, scene, () => (ortho ? (wrap.clientHeight * camera.zoom) / (camera.top - camera.bottom) : wrap.clientHeight / viewH));
  const view = createViewBar(wrap, { camera, controls, start, target0, ortho, tween: (fn, d) => api.tween(fn, d), callouts, tourZoom: opts.tourZoom, onTour: opts.onTour, invalidate });

  // Keyboard: the canvas area is focusable, so the model can be turned
  // without a mouse. Buttons in the side panel do everything else.
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'application');
  wrap.setAttribute('aria-label', opts.label ?? '3D model. Arrow keys turn it, plus and minus zoom, 0 resets the view.');
  wrap.addEventListener('keydown', (e) => {
    if (e.target !== wrap || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    let used = true;
    if (k === 'ArrowLeft') view.turn(-20);
    else if (k === 'ArrowRight') view.turn(20);
    else if (k === 'ArrowUp') view.tilt(-0.12);
    else if (k === 'ArrowDown') view.tilt(0.12);
    else if (k === '+' || k === '=') view.zoom(1.25);
    else if (k === '-' || k === '_') view.zoom(1 / 1.25);
    else if (k === '0' || k === 'Home') view.reset();
    else used = opts.onKey ? opts.onKey(e) === true : false;
    if (used) e.preventDefault();
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (tweens.size) {
      for (const f of tweens) f(dt, t);
      dirty = 2;
    }
    if (!visible) return;
    if (tickers.size) {
      for (const f of tickers) f(dt, t);
      dirty = 2;
    }
    controls.update();
    if (!dirty) return;
    dirty--;
    if (++frame % 20 === 1) inkScene(scene);
    renderer.render(scene, camera);
    callouts.update();
  });

  const api = {
    THREE,
    scene,
    camera,
    controls,
    renderer,
    lowPower: low,
    viewHeight: viewH,
    invalidate,
    // A card pinned to a part with a dashed leader line (see createCallouts).
    callout: (obj, o) => { invalidate(); return callouts.add(obj, o); },
    callouts,
    highlight: (obj, on) => { setGlow(obj, on); invalidate(); },
    view,
    // Scroll the model into view (e.g. when a learner presses a button below it on a phone).
    reveal() {
      if (!visible) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    onTick(fn) {
      tickers.add(fn);
      return () => tickers.delete(fn);
    },
    clickable(obj, fn) {
      clickables.set(obj, fn);
    },
    unclickable(obj) {
      clickables.delete(obj);
    },
    tween(fn, duration = 0.6, ease = easeInOut) {
      return new Promise((resolve) => {
        let e = 0;
        const step = (dt) => {
          e += dt;
          const k = Math.min(e / duration, 1);
          fn(ease(k));
          if (k >= 1) {
            tweens.delete(step);
            resolve();
          }
        };
        tweens.add(step);
      });
    },
    wait(seconds) {
      return this.tween(() => {}, seconds, (k) => k);
    },
    // Glide the camera so a world point is in the middle, at a given zoom.
    lookAt(p, zoom) {
      const t0 = controls.target.clone();
      const c0 = camera.position.clone();
      const z0 = camera.zoom;
      const z1 = zoom ?? z0;
      return api.tween((k) => {
        controls.target.lerpVectors(t0, p, k);
        camera.position.copy(c0).add(controls.target.clone().sub(t0));
        if (ortho) { camera.zoom = z0 + (z1 - z0) * k; camera.updateProjectionMatrix(); }
      }, 0.7);
    },
    confetti() {
      const colors = [0x24182e, 0xca1f3f, 0xffbe00, 0x5a4470, 0x1f8a70, 0xffffff];
      const bits = [];
      const origin = controls.target.clone().add(new THREE.Vector3(0, 3, 0));
      for (let i = 0; i < 120; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
        m.userData.noInk = true;
        m.position.copy(origin);
        m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 14 + 6, (Math.random() - 0.5) * 18);
        m.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0);
        scene.add(m);
        bits.push(m);
      }
      let life = 0;
      const off = this.onTick((dt) => {
        life += dt;
        for (const m of bits) {
          m.userData.v.y -= 18 * dt;
          m.position.addScaledVector(m.userData.v, dt);
          m.rotation.x += m.userData.spin.x * dt;
          m.rotation.y += m.userData.spin.y * dt;
        }
        if (life > 3) {
          bits.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
          off();
        }
      });
    },
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
  return api;
}

export const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function setGlow(obj, on) {
  if (!obj || obj.userData.noGlow) return;
  obj.traverse((m) => {
    if (!m.isMesh || m.userData.isInk || !m.material || !('emissive' in m.material)) return;
    if (on) {
      m.userData._emissive ??= m.material.emissive.getHex();
      m.material.emissive.setHex(0x3a2a08); // warm gold glow on hover
    } else if (m.userData._emissive !== undefined) {
      m.material.emissive.setHex(m.userData._emissive);
      delete m.userData._emissive;
    }
  });
}

// ---------- Ink outlines ----------
// Gives every solid an ink outline, like a technical illustration: crease
// lines for boxes and flat shapes, plus a thin silhouette ("inverted hull")
// for round shapes. New objects are picked up automatically.
const INK = 0x24182e;
export const inkLine = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.78 });
const hullMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
hullMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.045;');
};
const ROUND = /Sphere|Cylinder|Capsule|Torus|Lathe|Cone|Tube|Icosahedron|Dodecahedron|Octahedron|RoundedBox/;
const noPick = () => {};
let lowInk = false; // software WebGL: no silhouette shells on cables
// Many copies of one part share one outline geometry.
const edgeCache = new WeakMap();
const edgesOf = (g, angle) => {
  let byAngle = edgeCache.get(g);
  if (!byAngle) edgeCache.set(g, (byAngle = {}));
  return (byAngle[angle] ??= new THREE.EdgesGeometry(g, angle));
};

export function inkScene(root) {
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.inked || m.userData.noInk || m.userData.isInk) return;
    m.userData.inked = true;
    const g = m.geometry;
    const mt = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!g || !mt || (mt.transparent && mt.opacity < 0.6) || mt.isShadowMaterial || g.attributes.position.count > 6000) return;
    const round = ROUND.test(g.type) || m.userData.round;
    if (!m.userData.noEdges) {
      const lines = new THREE.LineSegments(edgesOf(g, round ? 50 : 25), inkLine);
      lines.raycast = noPick;
      lines.userData.isInk = true;
      m.add(lines);
    }
    if (round && g.attributes.normal && !m.userData.noHull && !(lowInk && g.type === 'TubeGeometry')) {
      const hull = new THREE.Mesh(g, hullMat);
      hull.raycast = noPick;
      hull.userData.isInk = true;
      m.add(hull);
    }
  });
}

// ---------- Callout cards ----------
// HTML cards pinned to parts of the model with a dot and a dashed leader
// line, so labels are crisp, readable, clickable and work with a keyboard.
function createCallouts(wrap, camera, renderer, live, scene, pxPerUnit) {
  const layer = document.createElement('div');
  layer.className = 'lab-callouts';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lab-leaders');
  svg.setAttribute('aria-hidden', 'true');
  layer.appendChild(svg);
  wrap.appendChild(layer);
  const list = new Set();
  const v = new THREE.Vector3();
  let shown = true;
  // Plain text tags made by label(): drawn wherever their anchor is, if it is in this scene.
  const tagEls = new Map();
  const inScene = (o) => { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; };
  function drawTags(W, H, placed) {
    const unit = pxPerUnit();
    for (const a of TAGS) {
      if (!inScene(a)) { const el = tagEls.get(a); if (el) el.hidden = true; continue; }
      let el = tagEls.get(a);
      const t = a.userData.tag;
      if (!el) {
        el = document.createElement('span');
        el.className = 'tag3d';
        el.setAttribute('aria-hidden', 'true');
        layer.appendChild(el);
        tagEls.set(a, el);
      }
      if (el.dataset.v !== String(t.v)) {
        el.dataset.v = t.v;
        el.innerHTML = (Array.isArray(t.text) ? t.text : [t.text]).map((x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
        el.style.color = t.color;
        el.style.background = t.bg && !/^rgba\([^)]*,\s*0\)$/.test(t.bg) ? t.bg : 'transparent';
        el.classList.toggle('bare', !t.bg);
      }
      const on = live(a) && (t.always || shown);
      el.hidden = !on;
      if (!on) continue;
      a.getWorldPosition(v);
      v.project(camera);
      if (v.z > 1) { el.hidden = true; continue; }
      el.style.fontSize = Math.max(t.min ?? 11, Math.min(22, t.scale * unit * 0.42)).toFixed(1) + 'px';
      const tx = ((v.x + 1) / 2) * W;
      const ty = ((1 - v.y) / 2) * H;
      el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) translate(-50%, -50%)`;
      // A tag under a card is hidden rather than drawn on top of it.
      const hw = el.offsetWidth / 2;
      const hh = el.offsetHeight / 2;
      if (placed.some((p) => tx - hw < p.r && tx + hw > p.l && ty - hh < p.b && ty + hh > p.t)) el.hidden = true;
    }
  }
  const api = {
    add(obj, { title, text = '', icon = '', at = [0, 0, 0], dx = 0, dy = -70, onClick, quiet = false, data } = {}) {
      const card = document.createElement(onClick ? 'button' : 'div');
      if (onClick) card.type = 'button';
      card.className = 'lab-callout' + (quiet ? ' quiet' : '');
      const dot = document.createElement('span');
      dot.className = 'lab-callout-dot';
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.appendChild(line);
      layer.append(dot, card);
      // c.at (a Vector3, local to obj) can be changed later to move the dot.
      const c = { obj, at: new THREE.Vector3(...at), dx, dy, card, dot, line, quiet, data };
      c.set = (t, x = '', i = icon) => {
        card.innerHTML = `${i ? `<span class="lab-callout-icon" aria-hidden="true">${i}</span>` : ''}<span><b>${t}</b>${x ? `<small>${x}</small>` : ''}</span>`;
      };
      c.set(title, text);
      if (onClick) card.addEventListener('click', onClick);
      c.remove = () => { list.delete(c); card.remove(); dot.remove(); line.remove(); };
      list.add(c);
      return c;
    },
    clear() { [...list].forEach((c) => c.remove()); },
    items: () => [...list].filter((c) => !c.obj || live(c.obj)),
    show(on) { shown = on; layer.classList.toggle('off', !on); },
    touring(on) { layer.classList.toggle('touring', on); },
    get shown() { return shown; },
    update() {
      const r = renderer.domElement;
      const W = r.clientWidth;
      const H = r.clientHeight;
      const placed = [];
      if (list.size) placeCards(W, H, placed);
      drawTags(W, H, placed);
    },
  };
  // On a phone-sized canvas only the first four cards a lab adds (its most
  // important) are shown; the rest still appear one at a time in the tour.
  // A quiet card shows only while the tour visits it or its part is selected.
  function placeCards(W, H, placed) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const small = W < 520;
    const touring = layer.classList.contains('touring');
    let count = 0;
    // The selected or toured card is placed first, so it wins its spot.
    const order = [...list].sort((a, b) => rank(b) - rank(a));
    for (const c of order) {
      const lit = c.card.classList.contains('tour') || c.card.classList.contains('sel');
      let on = c.obj ? live(c.obj) : true;
      if (c.quiet && !lit) on = false;
      if (!shown && !lit) on = false;
      if (touring && !lit) on = false;
      if (on && !lit) count++;
      if (on && !lit && (small && count > 4 || order.some((o) => o.card.classList.contains('sel')))) on = false;
      c.card.hidden = c.dot.hidden = !on;
      c.line.style.display = on ? '' : 'none';
      if (!on) continue;
      v.copy(c.at);
      if (c.obj) c.obj.localToWorld(v);
      v.project(camera);
      const x = ((v.x + 1) / 2) * W;
      const y = ((1 - v.y) / 2) * H;
      const cw = c.card.offsetWidth;
      const ch = c.card.offsetHeight;
      // Keep the card inside the canvas, and on narrow canvases nearer its dot.
      const near = Math.min(1, W / 700);
      const left = Math.max(6, Math.min(W - cw - 6, x + c.dx * near - cw / 2));
      // Keep clear of the toolbar at the bottom; if the spot is taken, try just
      // below or above the card in the way, whichever stays on the canvas.
      const maxTop = H - ch - 62;
      const clamp = (t) => Math.max(40, Math.min(maxTop, t));
      const free = (t) => !placed.some((p) => left < p.r && left + cw > p.l && t < p.b && t + ch > p.t);
      let top = clamp(y + c.dy * near - ch / 2);
      for (let tries = 0; tries < 6 && !free(top); tries++) {
        const hit = placed.find((p) => left < p.r && left + cw > p.l && top < p.b && top + ch > p.t);
        const down = clamp(hit.b + 6);
        const up = clamp(hit.t - ch - 6);
        top = (c.dy >= 0 ? [down, up] : [up, down]).find(free) ?? (c.dy >= 0 ? down : up);
      }
      placed.push({ l: left, r: left + cw, t: top, b: top + ch });
      c.card.style.transform = `translate(${left}px, ${top}px)`;
      c.dot.style.transform = `translate(${x - 6}px, ${y - 6}px)`;
      const ex = Math.max(left, Math.min(left + cw, x));
      const ey = Math.max(top, Math.min(top + ch, y));
      Object.entries({ x1: x, y1: y, x2: ex, y2: ey }).forEach(([k, val]) => c.line.setAttribute(k, val.toFixed(1)));
    }
  }
  const rank = (c) => (c.card.classList.contains('sel') ? 2 : c.card.classList.contains('tour') ? 1 : 0);
  return api;
}

// ---------- View toolbar ----------
// Turn, zoom, show/hide labels, tour and reset, as buttons under the model.
function createViewBar(wrap, { camera, controls, start, target0, ortho, tween, callouts, tourZoom, onTour, invalidate }) {
  const bar = document.createElement('div');
  bar.className = 'lab-viewbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'View');
  const btn = (icon, label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = icon;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', fn);
    bar.appendChild(b);
    return b;
  };
  const turn = (deg) => {
    const offset = camera.position.clone().sub(controls.target);
    const from = Math.atan2(offset.x, offset.z);
    const radius = Math.hypot(offset.x, offset.z);
    const to = from + THREE.MathUtils.degToRad(deg);
    const tg = controls.target.clone();
    tween((k) => {
      const a = from + (to - from) * k;
      camera.position.set(tg.x + Math.sin(a) * radius, camera.position.y, tg.z + Math.cos(a) * radius);
    }, 0.5);
  };
  // Tilt: move the camera up or down around the target (radians).
  const tilt = (d) => {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.phi = THREE.MathUtils.clamp(sph.phi + d, 0.05, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    invalidate();
  };
  const zoom = (f) => {
    if (ortho) {
      const z0 = camera.zoom;
      const z1 = THREE.MathUtils.clamp(z0 * f, controls.minZoom, controls.maxZoom);
      tween((k) => { camera.zoom = z0 + (z1 - z0) * k; camera.updateProjectionMatrix(); }, 0.3);
    } else {
      const off = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(off.length() / f, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(off.setLength(len));
      invalidate();
    }
  };
  btn('⟲', 'Turn left', () => turn(-45));
  btn('⟳', 'Turn right', () => turn(45));
  btn('−', 'Zoom out', () => zoom(1 / 1.25));
  btn('+', 'Zoom in', () => zoom(1.25));
  // "Show me around": glide to each labelled part in turn and light up its card.
  let touring = false;
  const stopTour = () => { touring = false; };
  const tourBtn = btn('▶', 'Show me around', async () => {
    if (touring) { touring = false; return; }
    const stops = callouts.items();
    if (!stops.length) return;
    touring = true;
    tourBtn.classList.add('on');
    tourBtn.innerHTML = '■';
    tourBtn.setAttribute('aria-label', 'Stop the tour');
    tourBtn.title = 'Stop the tour';
    callouts.touring(true);
    const p = new THREE.Vector3();
    for (const c of stops) {
      if (!touring) break;
      p.copy(c.at);
      c.obj?.localToWorld(p);
      const t0 = controls.target.clone();
      const c0 = camera.position.clone();
      const z0 = camera.zoom;
      const z1 = ortho ? Math.min(controls.maxZoom, tourZoom ?? 1.45) : z0;
      onTour?.(c);
      await tween((k) => {
        controls.target.lerpVectors(t0, p, k);
        camera.position.copy(c0).add(controls.target.clone().sub(t0));
        if (ortho) { camera.zoom = z0 + (z1 - z0) * k; camera.updateProjectionMatrix(); }
      }, 0.8);
      c.card.classList.add('tour');
      invalidate();
      for (let i = 0; i < 30 && touring; i++) await tween(() => {}, 0.1);
      c.card.classList.remove('tour');
    }
    touring = false;
    callouts.touring(false);
    tourBtn.classList.remove('on');
    tourBtn.innerHTML = '▶';
    tourBtn.setAttribute('aria-label', 'Show me around');
    tourBtn.title = 'Show me around';
    onTour?.(null);
    reset();
  });
  // Dragging the model stops the tour.
  controls.addEventListener('start', stopTour);
  const lb = btn('🏷️', 'Show or hide labels', () => {
    callouts.show(!callouts.shown);
    lb.classList.toggle('on', callouts.shown);
    lb.setAttribute('aria-pressed', String(callouts.shown));
    invalidate();
  });
  lb.classList.add('on');
  lb.setAttribute('aria-pressed', 'true');
  const reset = () => {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const z0 = camera.zoom;
    tween((k) => {
      camera.position.lerpVectors(p0, start, k);
      controls.target.lerpVectors(t0, target0, k);
      if (ortho) { camera.zoom = z0 + (1 - z0) * k; camera.updateProjectionMatrix(); }
    }, 0.6);
  };
  btn('⌂', 'Reset the view', reset);
  wrap.appendChild(bar);
  return { turn, tilt, zoom, reset, bar, stopTour, get touring() { return touring; } };
}

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
}

export function box(w, h, d, color, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Building blocks for detailed models ----------
// A box with softly rounded edges (cases, keys, devices).
export function rbox(w, h, d, color, radius = 0.06, extra) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A cable or wire through a list of [x, y, z] points, as a smooth tube.
export function cable(points, color = 0x24182e, radius = 0.04, segments) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments ?? Math.max(24, points.length * 10), radius, 6, false), mat(color, { roughness: 0.7 }));
  m.castShadow = true;
  m.userData.curve = curve;
  return m;
}

// A flat printed detail (legend, screen, sticker, label) drawn with a 2D canvas.
// draw(g, W, H) paints on a canvas of W×H pixels; the plane is w×h world units.
export function decal(w, h, draw, { px = 256, transparent = true, maxPx = 2048 } = {}) {
  const c = document.createElement('canvas');
  let cw = Math.round(px * Math.max(1, w / h));
  let ch = Math.round(px * Math.max(1, h / w));
  const k = Math.min(1, maxPx / Math.max(cw, ch));
  c.width = Math.round(cw * k);
  c.height = Math.round(ch * k);
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false }));
  m.userData.noInk = true;
  return m;
}

// Floating text labels: an invisible point in the scene that the stage draws
// as crisp HTML text (see createCallouts). `always` keeps it on when the
// labels button hides the cards.
const TAGS = new Set();
export function label(text, { scale = 1, bg = 'rgba(255,255,255,0.92)', color = '#24182E', always = false, min } = {}) {
  const anchor = new THREE.Object3D();
  anchor.userData.tag = { text, scale, bg, color, v: 1, always, min };
  TAGS.add(anchor);
  return anchor;
}

export function setLabel(anchor, text, opts = {}) {
  const t = anchor.userData.tag;
  if (!t) return;
  Object.assign(t, { text, color: opts.color ?? t.color, bg: opts.bg ?? t.bg, v: t.v + 1 });
}

// The HTML side panel next to the canvas: info text plus control buttons.
export function createUI(host) {
  const info = host.querySelector('.lab-info');
  const controls = host.querySelector('.lab-controls');
  const missionsEl = host.querySelector('.lab-missions');
  let missions = [];
  let done = new Set();
  let storeKey = null;
  let onFinish = () => {};

  function renderMissions() {
    if (!missionsEl || !missions.length) return;
    const next = missions.find((m) => !done.has(m.id));
    const count = missions.filter((m) => done.has(m.id)).length;
    host.dispatchEvent(new CustomEvent('lab-missions', { bubbles: true, detail: { lab: host.dataset.lab, done: count, total: missions.length } }));
    missionsEl.innerHTML = `
      <div class="mission-head"><b>Missions</b><span>${count} of ${missions.length}</span><button type="button" class="mission-reset" title="Start the missions again" aria-label="Start the missions again">↺</button></div>
      <div class="meter mission-meter"><span style="width:${(count / missions.length) * 100}%"></span></div>
      ${next ? `<div class="mission-next"><span class="mission-label">Do this next</span><b>${next.text}</b>${next.hint ? `<small>${next.hint}</small>` : ''}</div>` : '<div class="mission-next done"><b>All missions done. Well found.</b><small>Explore freely, or press ↺ to try again.</small></div>'}
      <details><summary>See all missions</summary><ol>${missions.map((m) => `<li class="${done.has(m.id) ? 'ok' : ''}">${done.has(m.id) ? '✓' : '○'} ${m.text}</li>`).join('')}</ol></details>`;
  }
  missionsEl?.addEventListener('click', (e) => {
    if (!e.target.closest('.mission-reset')) return;
    done = new Set();
    save();
    renderMissions();
  });
  function save() {
    try {
      localStorage.setItem(storeKey, JSON.stringify([...done]));
    } catch {}
  }

  return {
    info(title, html) {
      info.innerHTML = `<h4>${String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h4>${html}`;
    },
    missions(labId, list, finish) {
      missions = list;
      storeKey = `ard-lab-${labId}`;
      onFinish = finish ?? onFinish;
      try {
        done = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'));
      } catch {}
      renderMissions();
    },
    complete(id) {
      if (done.has(id) || !missions.some((m) => m.id === id)) return;
      done.add(id);
      save();
      renderMissions();
      missionsEl?.classList.remove('pop');
      void missionsEl?.offsetWidth;
      missionsEl?.classList.add('pop');
      if (missions.every((m) => done.has(m.id))) onFinish();
    },
    isDone: (id) => done.has(id),
    clear() {
      controls.innerHTML = '';
    },
    button(text, fn, { primary = false, group, pressed } = {}) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lab-btn' + (primary ? ' primary' : '');
      b.textContent = text;
      if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', () => fn(b));
      (group ?? controls).appendChild(b);
      return b;
    },
    group(title) {
      const g = document.createElement('div');
      g.className = 'lab-group';
      if (title) g.innerHTML = `<span class="lab-group-title">${title}</span>`;
      controls.appendChild(g);
      return g;
    },
    toggle(buttons, active) {
      buttons.forEach((b) => b.classList.toggle('active', b === active));
    },
    element(html, group) {
      const d = document.createElement('div');
      d.innerHTML = html;
      (group ?? controls).appendChild(d);
      return d;
    },
  };
}

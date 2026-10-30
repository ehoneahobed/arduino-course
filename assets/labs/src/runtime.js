// Shared 3D stage for the Arduino Ladder's labs: renderer, camera, orbit
// controls, click/hover picking, callout cards, a view toolbar, full screen,
// tweening, and the side panel (missions, explore, code, help).
//
// Ported from the BIH JHS Tech Club runtime (src/labs/runtime.js in that
// repo) so both sites share one illustrated look. Changes for this course:
//   - the lab builds its own markup, so a page only needs <div class="lab" data-lab="…">
//   - it draws only when something changes (kind to old PCs), and turns off
//     shadows and antialiasing on software WebGL
//   - the model is framed to fill the view (stage.autoFit), whatever its size
//   - a wide in-page view that breaks out of the text column, and a full
//     screen mode (Fullscreen API, or a full-window "theatre" where there is
//     none, as on iPhones) with the panel as a drawer
//   - callout cards with icons and elbow leader lines that keep out of each
//     other's way; quiet cards show only on the tour or when selected
//   - keyboard: W A S D or arrows move, Q and E turn, + and - zoom, R resets,
//     F full screen, L labels, T tour (and X X-ray where a lab has it)
//   - a code view (codeView) with Arduino C++ highlighting, line numbers,
//     the running line, action buttons and Copy
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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const coarse = () => !!window.matchMedia?.('(pointer: coarse)').matches;
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- Icons ----------
// Simple line icons (24×24, stroke currentColor), for the toolbar, the tabs
// and the callout cards.
const P_ = (d) => `<path d="${d}"/>`;
export const ICONS = {
  turnL: P_('M3 12a9 9 0 1 0 3-6.7') + P_('M3 4v5h5'),
  turnR: P_('M21 12a9 9 0 1 1-3-6.7') + P_('M21 4v5h-5'),
  zoomIn: '<circle cx="11" cy="11" r="7"/>' + P_('M20 20l-4-4M11 8v6M8 11h6'),
  zoomOut: '<circle cx="11" cy="11" r="7"/>' + P_('M20 20l-4-4M8 11h6'),
  tag: P_('M3 12V4h8l10 10-8 8z') + '<circle cx="7.5" cy="8.5" r="1.4"/>',
  play: P_('M7 4.5v15l12-7.5z'),
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  home: P_('M3 11l9-7 9 7') + P_('M5 10v10h14V10') + P_('M10 20v-6h4v6'),
  expand: P_('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  shrink: P_('M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'),
  xray: '<rect x="3" y="3" width="13" height="13" rx="2"/>' + P_('M8 8h13v13H8z'),
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/>' + P_('M15 4v16'),
  close: P_('M6 6l12 12M18 6L6 18'),
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/>' + P_('M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'),
  check: P_('M4 12.5l5 5L20 6.5'),
  cube: P_('M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z') + P_('M3.5 7.3L12 12l8.5-4.7M12 12v9.5'),
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  help: '<circle cx="12" cy="12" r="9"/>' + P_('M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8') + '<circle cx="12" cy="17.2" r=".6" fill="currentColor"/>',
  code: P_('M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16'),
  compass: '<circle cx="12" cy="12" r="9"/>' + P_('M15.5 8.5l-2 5-5 2 2-5z'),
  bench: P_('M3 10h18M5 10v9M19 10v9M7 10V6h10v4'),
  // parts, for callout cards
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>' + P_('M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4'),
  usb: P_('M8 3h8v6H8z') + P_('M6 9h12v5a6 6 0 0 1-12 0z') + P_('M12 20v2M10.5 5.5h.01M13.5 5.5h.01'),
  pins: P_('M4 7h16v5H4z') + P_('M7 12v6M10.5 12v6M14 12v6M17.5 12v6'),
  bolt: P_('M13 2L5 13.5h6L10 22l8-11.5h-6z'),
  bulb: P_('M9 17h6M10 20.5h4') + P_('M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z'),
  resistor: P_('M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4'),
  button: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="4"/>',
  sound: P_('M4 9.5h3.5L12 5v14l-4.5-4.5H4z') + P_('M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'),
  gear: '<circle cx="12" cy="12" r="3"/>' + P_('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'),
  screen: '<rect x="3" y="5" width="18" height="12" rx="2"/>' + P_('M7 9.5h6M7 12.5h10M9 21h6M12 17v4'),
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/>' + P_('M21 10.5v3M7 12h4M9 10v4'),
  ground: P_('M12 3v9M5 12h14M7.5 15.5h9M10 19h4'),
  wire: P_('M3 18c4 0 4-12 9-12s5 12 9 12') + '<circle cx="3" cy="18" r="1.3"/><circle cx="21" cy="18" r="1.3"/>',
  grid: '<rect x="3" y="4" width="18" height="16" rx="2"/>' + P_('M7 8h.01M11 8h.01M15 8h.01M7 12h.01M11 12h.01M15 12h.01M7 16h.01M11 16h.01M15 16h.01M19 8h.01M19 12h.01M19 16h.01'),
  board: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><rect x="9" y="10" width="7" height="4" rx=".6"/>' + P_('M5 8h6M14 8h5M2.5 11h3'),
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/>' + P_('M2.5 18.5h19l-1.5-3.5H4z'),
  radar: P_('M12 21a9 9 0 0 1-9-9M12 17a5 5 0 0 1-5-5M12 13a1 1 0 0 1-1-1') + P_('M14 10l6-6'),
  knob: '<circle cx="12" cy="13" r="7"/>' + P_('M12 13l3.5-4M12 2.5v1.5M4 6l1 1M20 6l-1 1'),
  sun: '<circle cx="12" cy="12" r="4"/>' + P_('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'),
  clock: '<circle cx="12" cy="12" r="9"/>' + P_('M12 7v5l3.5 2'),
  flow: '<rect x="2.5" y="3.5" width="7" height="6" rx="1.5"/><rect x="14.5" y="14.5" width="7" height="6" rx="1.5"/>' + P_('M9.5 6.5h4a3 3 0 0 1 3 3v5M14.5 12l2 2.5 2-2.5'),
  drop: P_('M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z'),
  wave: P_('M2 12c2.5-6 4.5-6 6 0s3.5 6 6 0 4.5-6 6 0'),
  info: '<circle cx="12" cy="12" r="9"/>' + P_('M12 11v6M12 7.5h.01'),
};
export function icon(name, cls = '') {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="lab-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
// A card's icon from its title, so every lab gets fitting icons for free.
const ICON_RULES = [
  [/usb/i, 'usb'], [/laptop|computer|\bide\b/i, 'laptop'], [/chip|microcontroller|processor/i, 'chip'],
  [/battery/i, 'battery'], [/\bgnd\b|ground/i, 'ground'], [/servo|motor|\barm\b|fan|stepper|gear|pivot/i, 'gear'],
  [/buzzer|sound|note|tone|speaker|beep/i, 'sound'], [/screen|lcd|display|tm1637|i2c/i, 'screen'],
  [/you are here|marker|now in/i, 'target'], [/hc-sr|sonar|bounce/i, 'radar'], [/ldr|light sensor|photo|sun/i, 'sun'], [/ultrason|echo|ping|distance|sensor|ruler|book|target/i, 'radar'],
  [/knob|pot\b|potentiometer|dial/i, 'knob'], [/resistor|ohm|stripe|spring|pull.?up/i, 'resistor'],
  [/button|key|press|reset/i, 'button'], [/\bled\b|light|lamp|\bon\b|\btx\b|\brx\b/i, 'bulb'],
  [/power|5v|3\.3v|jack|charger|vin|supply/i, 'bolt'], [/wire|cable|jumper|link/i, 'wire'],
  [/breadboard|rail|column|strip|hole/i, 'grid'], [/digital|analog|pins?\b|socket|header/i, 'pins'],
  [/uno|arduino|board|device/i, 'board'], [/millis|delay|time|clock|timer/i, 'clock'],
  [/water|tank|rain|drop/i, 'drop'], [/state|room|arrow|machine|token/i, 'flow'], [/signal|pulse|pwm|wave|scope/i, 'wave'],
];
export function iconFor(title) {
  const t = String(title || '').replace(/<[^>]*>/g, '');
  for (const [re, name] of ICON_RULES) if (re.test(t)) return name;
  return 'info';
}

// The URL of a file next to labs.html (the 3D Workshop), worked out from
// where this script was loaded, so it is right from every folder.
export function siteUrl(path) {
  try {
    const s = [...document.scripts].map((x) => x.src).find((u) => /assets\/labs\/labs(\.bundle)?\.js/.test(u));
    if (s) return new URL('../../' + path, s).href;
  } catch {}
  return path;
}

// ---------- The markup a lab needs ----------
// A page may leave an empty <div class="lab" data-lab="…">; this fills it.
export function ensureShell(host, hint) {
  if (!host.querySelector('.lab-canvas')) {
    host.innerHTML = `<div class="lab-canvas">
  <div class="lab-status" role="status"><span class="lab-spin" aria-hidden="true"></span><b>Building the 3D model…</b><small>This can take a few seconds on an older computer.</small></div>
</div>
<aside class="lab-side" aria-label="Lab panel">
  <div class="lab-side-head"><span class="lab-side-title"></span><button type="button" class="lab-iconbtn lab-drawer-x" aria-label="Hide the panel" title="Hide the panel">${icon('panel')}</button></div>
  <div class="lab-next" hidden></div>
  <div class="lab-info" aria-live="polite"></div>
  <div class="lab-tabs" role="tablist" aria-label="Lab panel"></div>
  <div class="lab-panes">
    <div class="lab-pane" data-pane="explore" role="tabpanel"><div class="lab-controls"></div></div>
    <div class="lab-pane" data-pane="code" role="tabpanel" hidden></div>
    <div class="lab-pane" data-pane="missions" role="tabpanel" hidden><div class="lab-missions" aria-live="polite"></div></div>
    <div class="lab-pane" data-pane="help" role="tabpanel" hidden></div>
  </div>
</aside>`;
  }
  if (hint) host.dataset.hint = hint;
  host.classList.add('lab-ready');
  breakout(host);
}

// In a page the lab is wider than the text column: up to 1480px, centred on
// the window; on a phone it runs edge to edge. Full screen undoes this.
const placed = new Set();
function placeOne(host) {
  if (!host.isConnected || host.hidden || host.classList.contains('lab-full') || host.classList.contains('lab-app')) return;
  // A band page's sidebar (assets/pager.js) takes the left edge on wide screens.
  const side = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--side-w')) || 0;
  const vw = (document.documentElement.clientWidth || window.innerWidth) - side;
  const W = vw >= 900 ? Math.min(1480, vw - 40) : vw;
  host.style.width = W + 'px';
  host.style.maxWidth = 'none';
  host.style.marginLeft = '0px';
  host.style.marginRight = '0px';
  const left = host.getBoundingClientRect().left;
  host.style.marginLeft = Math.round(side + (vw - W) / 2 - left) + 'px';
  host.style.setProperty('--lab-w', W + 'px');
}
let placing = 0;
function placeAll() {
  cancelAnimationFrame(placing);
  placing = requestAnimationFrame(() => placed.forEach(placeOne));
}
export function breakout(host) {
  if (host.classList.contains('lab-app')) return;
  if (!placed.size) window.addEventListener('resize', placeAll);
  placed.add(host);
  placeOne(host);
}

// ---------- Full screen ----------
let theatreHost = null;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsEnabled = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

export function createStage(host, opts = {}) {
  const wrap = host.querySelector('.lab-canvas');
  const side = host.querySelector('.lab-side');
  // An "app" lab fills its box (the 3D Workshop's viewer) with the full-screen layout.
  const app = host.classList.contains('lab-app');
  const shot = host.classList.contains('lab-shot');
  if (app) host.classList.add('lab-full');
  if (app && (shot || window.innerWidth < 760)) host.classList.add('drawer-closed');
  const low = lowPower();
  lowInk = low;
  // Transparent canvas over the CSS "paper" background, like an illustrated diagram.
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'low-power' });
  renderer.shadowMap.enabled = opts.shadows !== false && !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  wrap.appendChild(renderer.domElement);
  // The hint chip fades once the learner has tried it (or after 9 seconds).
  const touched = () => wrap.classList.add('touched');
  renderer.domElement.addEventListener('pointerdown', touched, { once: true });
  renderer.domElement.addEventListener('wheel', touched, { once: true, passive: true });
  const hintTimer = setTimeout(touched, 9000);

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
  let fit = opts.fit ? [...opts.fit] : null;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target0);
  controls.enableDamping = !reduced();
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.85;
  controls.maxPolarAngle = opts.maxPolar ?? Math.PI * 0.49;
  controls.minDistance = opts.minDistance ?? 3;
  controls.maxDistance = opts.maxDistance ?? 40;
  controls.minZoom = opts.minZoom ?? dist0 / (opts.maxDistance ?? 40);
  controls.maxZoom = opts.maxZoom ?? dist0 / (opts.minDistance ?? 3);
  // An orthographic camera zooms rather than moving closer, so its distance
  // only matters for clipping: keep it where the lab put it.
  if (ortho) { controls.minDistance = 0; controls.maxDistance = Infinity; }
  controls.enablePan = opts.pan ?? true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = ortho;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // Keyboard moving is done by the stage itself (below), not OrbitControls.

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
    ground.userData.noFit = true;
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
    if (!downAt || e.button > 0) { downAt = null; return; }
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return; // that was a drag to rotate, not a click
    const o = pick(e);
    if (o) clickables.get(o)(o, e, lastHit);
    else opts.onMiss?.(e);
    invalidate();
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
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

  // Room the picture keeps clear of: the toolbar along the bottom, the title
  // bar in full screen, and a phone's panel when it is pulled up over the model.
  function insets(w, h) {
    if (shot) return { t: 8, b: 8, l: 8, r: 8 };
    const full = host.classList.contains('lab-full');
    const ins = { t: host.classList.contains('lab-fs') ? 58 : 14, b: 70, l: 12, r: 12 };
    if (w < 520) { ins.b = 64; ins.l = ins.r = 6; }
    if (full && !host.classList.contains('drawer-closed') && side && getComputedStyle(side).position === 'absolute') {
      ins.b = Math.max(ins.b, side.offsetHeight + 64);
    }
    ins.b = Math.min(ins.b, h * 0.6);
    return ins;
  }

  const FILL = 0.94; // the model spans this much of the free area
  function pixelRatio(w, h) {
    const dpr = window.devicePixelRatio || 1;
    const cap = low ? 1 : 2;
    const budget = low ? 1.4e6 : 4.2e6; // pixels drawn per frame, at most
    return Math.max(0.6, Math.min(dpr, cap, Math.sqrt(budget / Math.max(1, w * h))));
  }
  function resize() {
    placeOne(host); // the first time it is shown, or after full screen
    const w = wrap.clientWidth || 600;
    const h = wrap.clientHeight || 420;
    renderer.setPixelRatio(pixelRatio(w, h));
    renderer.setSize(w, h, false);
    if (ortho) {
      let s, dx = 0, dy = 0;
      if (fit) {
        // Frame a box of fit[0] × fit[1] world units in the free part of the canvas.
        const ins = insets(w, h);
        const uw = Math.max(80, w - ins.l - ins.r);
        const uh = Math.max(80, h - ins.t - ins.b);
        s = Math.max(fit[0] / (uw * FILL), fit[1] / (uh * FILL));
        dx = ins.l + uw / 2 - w / 2;
        dy = ins.t + uh / 2 - h / 2;
      } else {
        // Fit the same framing on a narrow (phone) canvas as on a wide one.
        s = (viewH * Math.max(1, (1.35 * h) / w)) / h;
      }
      Object.assign(camera, { left: (-w / 2 - dx) * s, right: (w / 2 - dx) * s, top: (h / 2 + dy) * s, bottom: (-h / 2 + dy) * s });
      api.viewHeight = h * s;
    } else {
      camera.aspect = w / h;
      const base = opts.fov ?? 45;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * Math.max(1, (1.35 * h) / w)));
    }
    camera.updateProjectionMatrix();
    callouts?.remeasure();
    invalidate();
  }

  // The visible model, measured in the starting view, so it can fill the canvas.
  const fitBounds = new THREE.Box3();
  function measure() {
    const cam = camera.clone();
    cam.position.copy(start);
    cam.up.set(0, 1, 0);
    cam.lookAt(target0);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    scene.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const bb = new THREE.Box3();
    const p = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    fitBounds.makeEmpty();
    const walk = (o) => {
      if (!o.visible || o.userData.noFit || o.userData.isInk || o.isLight || o.isCamera) return;
      if ((o.isMesh || o.isLine || o.isPoints) && o.geometry && !o.isSprite) {
        const mt = Array.isArray(o.material) ? o.material[0] : o.material;
        const seen = mt && mt.visible !== false && !mt.isShadowMaterial && !(mt.transparent && mt.opacity < 0.08);
        if (seen) {
          if (o.isInstancedMesh) { o.computeBoundingBox(); bb.copy(o.boundingBox); } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox); }
          if (!bb.isEmpty() && Number.isFinite(bb.min.x)) {
            m4.multiplyMatrices(inv, o.matrixWorld);
            for (let i = 0; i < 8; i++) {
              p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
              fitBounds.expandByPoint(p.clone().applyMatrix4(o.matrixWorld));
              p.applyMatrix4(m4);
              x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
            }
          }
        }
      }
      for (const c of o.children) walk(c);
    };
    walk(scene);
    if (!Number.isFinite(x0)) return null;
    return { x0, x1, y0, y1, right: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1) };
  }
  // Frame the model so it fills the view. A lab can opt out (autoFit: false)
  // or ask for a little extra room (fitPad, a fraction, default 0.04).
  function autoFit() {
    if (!ortho || opts.autoFit === false) return;
    const m = measure();
    if (!m) return;
    const pad = 1 + (opts.fitPad ?? 0.04);
    const cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
    const off = m.right.multiplyScalar(cx).add(m.up.multiplyScalar(cy));
    target0.add(off);
    start.add(off);
    camera.position.copy(start);
    controls.target.copy(target0);
    camera.zoom = 1;
    fit = [(m.x1 - m.x0) * pad, (m.y1 - m.y0) * pad];
    resize();
    controls.update();
  }

  // Keep panning near the model, so it cannot be lost off the side.
  const clampTarget = () => {
    if (fitBounds.isEmpty()) return;
    const t = controls.target;
    const b = fitBounds;
    const mx = (b.max.x - b.min.x) * 0.15 + 2, mz = (b.max.z - b.min.z) * 0.15 + 2, my = (b.max.y - b.min.y) * 0.15 + 2;
    const cx = THREE.MathUtils.clamp(t.x, b.min.x - mx, b.max.x + mx);
    const cy = THREE.MathUtils.clamp(t.y, b.min.y - my, b.max.y + my);
    const cz = THREE.MathUtils.clamp(t.z, b.min.z - mz, b.max.z + mz);
    if (cx !== t.x || cy !== t.y || cz !== t.z) {
      camera.position.x += cx - t.x; camera.position.y += cy - t.y; camera.position.z += cz - t.z;
      t.set(cx, cy, cz);
    }
  };

  // Pause drawing when the lab is scrolled off-screen or hidden.
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  });
  io.observe(wrap);

  controls.addEventListener('change', () => { clampTarget(); invalidate(); });
  controls.addEventListener('start', touched);

  let frame = 0;
  inkScene(scene);
  const callouts = createCallouts(wrap, camera, renderer, live, scene, () => (ortho ? (wrap.clientHeight * camera.zoom) / (camera.top - camera.bottom) : wrap.clientHeight / viewH), () => insets(wrap.clientWidth, wrap.clientHeight));
  const view = createViewBar(host, wrap, { camera, controls, start, target0, ortho, tween: (fn, d) => api.tween(fn, d), callouts, tourZoom: opts.tourZoom, onTour: opts.onTour, onKey: opts.onKey, invalidate, viewHeight: () => api.viewHeight });

  // ---- hint chip, toast, title bar (full screen) ----
  const hintEl = document.createElement('div');
  hintEl.className = 'lab-hint';
  hintEl.setAttribute('aria-hidden', 'true');
  const hintHTML = (isFull) => (coarse()
    ? '<span>Drag to turn</span><span>Two fingers to move and zoom</span><span>Tap a part</span>'
    : `<span>Drag to turn</span><span>Scroll to zoom</span><span>Right-drag to move</span><span>${isFull ? '<kbd>Esc</kbd> leaves full screen' : '<kbd>F</kbd> full screen'}</span>`);
  hintEl.innerHTML = hintHTML(false);
  wrap.appendChild(hintEl);
  const toastEl = document.createElement('div');
  toastEl.className = 'lab-toast';
  toastEl.setAttribute('role', 'status');
  wrap.appendChild(toastEl);
  let toastTimer = 0;
  const top = document.createElement('div');
  top.className = 'lab-topbar';
  const title = opts.title || (host.getAttribute('aria-label') || '').replace(/^3D (lab|view)( of)?:?\s*/i, '') || '3D lab';
  top.innerHTML = `<span class="lab-topbar-title">${icon('cube')}<span>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</span></span><button type="button" class="lab-iconbtn lab-exit" aria-label="Leave full screen (Esc)" title="Leave full screen (Esc)">${icon('close')}</button>`;
  wrap.appendChild(top);
  top.querySelector('.lab-exit').addEventListener('click', () => full.exit());
  const sideTitle = host.querySelector('.lab-side-title');
  if (sideTitle) sideTitle.textContent = 'Lab panel';

  // ---- full screen ----
  const full = {
    on: false,
    mode: null, // 'api' or 'theatre'
    toggle() { return full.on ? full.exit() : full.enter(); },
    enter() {
      if (full.on) return;
      const req = host.requestFullscreen || host.webkitRequestFullscreen;
      if (req && fsEnabled() && !/[?&]theatre\b/.test(location.search)) {
        try {
          const p = req.call(host, { navigationUI: 'hide' });
          if (p && p.catch) p.catch(() => { if (!full.on) theatre(true); });
          return;
        } catch {}
      }
      theatre(true);
    },
    exit() {
      if (!full.on) return;
      if (full.mode === 'api' && fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else theatre(false);
    },
  };
  const onEsc = (e) => {
    if (e.key === 'Escape' && full.mode === 'theatre') { e.preventDefault(); theatre(false); }
  };
  function theatre(on) {
    if (on) {
      if (theatreHost && theatreHost !== host) theatreHost.labStage?.fullscreen.exit();
      theatreHost = host;
      host.classList.add('lab-theatre');
      document.documentElement.classList.add('lab-theatre-on');
      document.addEventListener('keydown', onEsc, true);
      setFull(true, 'theatre');
    } else {
      if (theatreHost === host) theatreHost = null;
      host.classList.remove('lab-theatre');
      document.documentElement.classList.remove('lab-theatre-on');
      document.removeEventListener('keydown', onEsc, true);
      setFull(false);
    }
  }
  const onFsChange = () => {
    const el = fsElement();
    if (el === host && !full.on) setFull(true, 'api');
    else if (el !== host && full.on && full.mode === 'api') setFull(false);
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  let stripHome = null;
  // A lab's bench strip (code, monitor, keys) becomes a tab in the drawer.
  function dock(on) {
    if (on) {
      const strip = host.querySelector(':scope > .cb-strip');
      const pane = host.querySelector('.lab-pane[data-pane="code"]');
      if (strip && pane) {
        stripHome = strip.nextElementSibling;
        pane.appendChild(strip);
        host.labUI?.refreshTabs();
        host.labUI?.tab('code');
      }
    } else {
      const strip = host.querySelector('.lab-pane .cb-strip');
      if (strip) {
        host.insertBefore(strip, stripHome && stripHome.parentNode === host ? stripHome : side);
        host.labUI?.refreshTabs();
      }
    }
  }
  function setFull(on, mode) {
    full.on = on;
    full.mode = on ? mode : null;
    host.classList.toggle('lab-fs', on);
    if (!app) {
      host.classList.toggle('lab-full', on);
      if (on) host.classList.toggle('drawer-closed', window.innerWidth < 760);
      else host.classList.remove('drawer-closed');
      dock(on);
      if (!on) placeOne(host);
    }
    view.setFull(on);
    hintEl.innerHTML = hintHTML(on);
    setTimeout(() => { resize(); wrap.focus({ preventScroll: true }); }, 30);
    host.dispatchEvent(new CustomEvent('lab-fullscreen', { bubbles: true, detail: { on } }));
  }
  const drawer = {
    get open() { return !host.classList.contains('drawer-closed'); },
    toggle(open = !drawer.open) {
      host.classList.toggle('drawer-closed', !open);
      view.setDrawer(open);
      resize();
      setTimeout(resize, 60);
    },
  };
  host.querySelector('.lab-drawer-x')?.addEventListener('click', () => drawer.toggle(false));

  // ---- keyboard ----
  // The canvas area is focusable, so the model can be moved without a mouse.
  // Buttons in the side panel do everything else.
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'application');
  const keysText = 'Arrow keys or W A S D move it, Q and E turn it, plus and minus zoom, R resets, F is full screen';
  const label = (opts.label ?? '3D model. Arrow keys turn it, plus and minus zoom, 0 resets the view.').replace(/Arrow keys turn it, plus and minus zoom, 0 resets( the view)?/, keysText);
  wrap.setAttribute('aria-label', label);
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  wrap.addEventListener('keydown', (e) => {
    if (e.target !== wrap || e.altKey || e.ctrlKey || e.metaKey) return;
    if (opts.onKey && opts.onKey(e) === true) { e.preventDefault(); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let used = true;
    if (e.shiftKey && k === 'ArrowLeft') view.turn(-20);
    else if (e.shiftKey && k === 'ArrowRight') view.turn(20);
    else if (e.shiftKey && k === 'ArrowUp') view.tilt(-0.12);
    else if (e.shiftKey && k === 'ArrowDown') view.tilt(0.12);
    else if (k === 'ArrowLeft' || k === 'a') view.pan(-1, 0);
    else if (k === 'ArrowRight' || k === 'd') view.pan(1, 0);
    else if (k === 'ArrowUp' || k === 'w') view.pan(0, 1);
    else if (k === 'ArrowDown' || k === 's') view.pan(0, -1);
    else if (k === 'q') view.turn(-30);
    else if (k === 'e') view.turn(30);
    else if (k === '+' || k === '=') view.zoom(1.25);
    else if (k === '-' || k === '_') view.zoom(1 / 1.25);
    else if (k === '0' || k === 'Home' || k === 'r') view.reset();
    else if (k === 'l') view.labels();
    else if (k === 't') view.tour();
    else if (k === 'x' && view.xray) view.xray();
    else used = false;
    if (used) { e.preventDefault(); touched(); }
  });
  // F for full screen works anywhere in the lab (not while typing).
  host.addEventListener('keydown', (e) => {
    if ((e.key === 'f' || e.key === 'F') && !e.altKey && !e.ctrlKey && !e.metaKey && !typing(e.target) && !e.defaultPrevented) {
      e.preventDefault();
      full.toggle();
    }
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (tweens.size) {
      for (const f of tweens) f(dt, t);
      dirty = 2;
    }
    if (!visible && !full.on) return;
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

  const ro = new ResizeObserver(resize);
  const api = {
    THREE,
    scene,
    camera,
    controls,
    renderer,
    lowPower: low,
    viewHeight: viewH,
    invalidate,
    // A card pinned to a part with a leader line (see createCallouts).
    callout: (obj, o) => { invalidate(); return callouts.add(obj, o); },
    callouts,
    highlight: (obj, on) => { setGlow(obj, on); invalidate(); },
    view,
    fullscreen: full,
    drawer,
    autoFit,
    // A short message over the model (a mission done, say).
    toast(html, ms = 3200) {
      toastEl.innerHTML = html;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
    },
    // Scroll the model into view (e.g. when a learner presses a button below it on a phone).
    reveal() {
      if (!visible && !full.on) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      if (reduced()) return;
      const colors = [0x24182e, 0xca1f3f, 0xffbe00, 0x5a4470, 0x1f8a70, 0xffffff];
      const bits = [];
      const origin = controls.target.clone().add(new THREE.Vector3(0, 3, 0));
      const k = Math.max(1, (api.viewHeight || 30) / 30);
      for (let i = 0; i < 120; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4 * k, 0.25 * k), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
        m.userData.noInk = true;
        m.userData.noFit = true;
        m.position.copy(origin);
        m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 14 + 6, (Math.random() - 0.5) * 18).multiplyScalar(k);
        m.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0);
        scene.add(m);
        bits.push(m);
      }
      let life = 0;
      const off = this.onTick((dt) => {
        life += dt;
        for (const m of bits) {
          m.userData.v.y -= 18 * k * dt;
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
    // A picture of the model as it is now (for thumbnails).
    // After the lab has built its panel: the app layout docks its strip.
    relayout() {
      if (app) { dock(true); view.setDrawer(!host.classList.contains('drawer-closed')); resize(); }
    },
    snapshot(type = 'image/webp', quality = 0.85) {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL(type, quality);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      clearTimeout(hintTimer);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      if (full.on) full.exit();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      placed.delete(host);
    },
  };
  ro.observe(wrap);
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
// HTML cards pinned to parts of the model with a ring dot and an elbow
// leader line, so labels are crisp, readable, clickable and work with a
// keyboard. Each card tries its own spot first (dx, dy from the part), then
// spots around the part, and takes the first that covers no other card, no
// other card's dot and stays on the canvas.
function createCallouts(wrap, camera, renderer, live, scene, pxPerUnit, insets) {
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
  function drawTags(W, H, placedCards) {
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
      if (placedCards.some((p) => tx - hw < p.r && tx + hw > p.l && ty - hh < p.b && ty + hh > p.t)) el.hidden = true;
    }
  }
  const api = {
    add(obj, { title, text = '', icon: ic = '', at = [0, 0, 0], dx = 0, dy = -70, onClick, quiet = false, data } = {}) {
      const card = document.createElement(onClick ? 'button' : 'div');
      if (onClick) card.type = 'button';
      card.className = 'lab-callout' + (quiet ? ' quiet' : '');
      const dot = document.createElement('span');
      dot.className = 'lab-callout-dot';
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const end = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      end.setAttribute('r', '2.6');
      end.setAttribute('class', 'lab-leader-end');
      svg.append(line, end);
      layer.append(dot, card);
      // c.at (a Vector3, local to obj) can be changed later to move the dot.
      const c = { obj, at: new THREE.Vector3(...at), dx, dy, card, dot, line, end, quiet, data, spot: 0 };
      c.set = (t, x = '', i = ic) => {
        // An emoji or text icon is kept; otherwise a line icon fitting the title.
        const glyph = i && !/^[a-z]+$/.test(i) ? `<span class="lab-callout-emoji">${i}</span>` : icon(i || iconFor(t));
        card.innerHTML = `<span class="lab-callout-icon" aria-hidden="true">${glyph}</span><span class="lab-callout-txt"><b>${t}</b>${x ? `<small>${x}</small>` : ''}</span>`;
        c.size = null;
      };
      c.set(title, text);
      if (onClick) card.addEventListener('click', onClick);
      c.remove = () => { list.delete(c); card.remove(); dot.remove(); line.remove(); end.remove(); };
      list.add(c);
      return c;
    },
    clear() { [...list].forEach((c) => c.remove()); },
    items: () => [...list].filter((c) => !c.obj || live(c.obj)),
    show(on) { shown = on; layer.classList.toggle('off', !on); },
    // Cards are measured once; a new canvas size (full screen, a phone turned round) measures again.
    remeasure() { list.forEach((c) => { c.size = null; }); },
    touring(on) { layer.classList.toggle('touring', on); },
    get shown() { return shown; },
    update() {
      const r = renderer.domElement;
      const W = r.clientWidth;
      const H = r.clientHeight;
      const placedCards = [];
      if (list.size) placeCards(W, H, placedCards);
      drawTags(W, H, placedCards);
    },
  };
  // Spots tried after a card's own: around the part, nearest first.
  const DIRS = [[0, -1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]];
  // On a phone-sized canvas only the first four cards a lab adds (its most
  // important) are shown; the rest still appear one at a time in the tour.
  // A quiet card shows only while the tour visits it or its part is selected.
  function placeCards(W, H, placedCards) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const small = W < 520;
    const touring = layer.classList.contains('touring');
    const ins = insets();
    const minTop = Math.max(8, ins.t - 6);
    const maxBottom = H - ins.b + 8;
    let count = 0;
    // The selected or toured card is placed first, so it wins its spot.
    const order = [...list].sort((a, b) => rank(b) - rank(a));
    const anySel = order.some((o) => o.card.classList.contains('sel'));
    const showing = [];
    for (const c of order) {
      const lit = c.card.classList.contains('tour') || c.card.classList.contains('sel');
      let on = c.obj ? live(c.obj) : true;
      if (c.quiet && !lit) on = false;
      if (!shown && !lit) on = false;
      if (touring && !lit) on = false;
      if (on && !lit) count++;
      if (on && !lit && ((small && count > 4) || anySel)) on = false;
      if (on) {
        v.copy(c.at);
        if (c.obj) c.obj.localToWorld(v);
        v.project(camera);
        c.x = ((v.x + 1) / 2) * W;
        c.y = ((1 - v.y) / 2) * H;
        // a part behind the camera or far off the canvas: no card
        if (v.z > 1 || c.x < -40 || c.x > W + 40 || c.y < -40 || c.y > H + 40) on = false;
      }
      c.card.hidden = c.dot.hidden = !on;
      c.line.style.display = c.end.style.display = on ? '' : 'none';
      if (on) showing.push(c);
    }
    const dots = showing.map((c) => [c.x, c.y]);
    const near = Math.min(1, W / 760);
    for (const c of showing) {
      const { x, y } = c;
      if (!c.size || !c.size[0]) c.size = [c.card.offsetWidth, c.card.offsetHeight];
      const [cw, ch] = c.size;
      const inside = (l, t) => l >= 6 && l + cw <= W - 6 && t >= minTop && t + ch <= maxBottom;
      const clear = (l, t) => !placedCards.some((p) => l < p.r + 6 && l + cw + 6 > p.l && t < p.b + 6 && t + ch + 6 > p.t) && !dots.some(([px, py]) => px > l - 8 && px < l + cw + 8 && py > t - 8 && py < t + ch + 8);
      const spot = (i) => {
        if (i === 0) return [x + c.dx * near - cw / 2, y + c.dy * near - ch / 2];
        const k = i - 1;
        const [ux, uy] = DIRS[k % 8];
        const r = [56, 100, 150][Math.floor(k / 8)] * Math.max(0.7, near);
        return [x + ux * (r + cw / 2) - cw / 2, y + uy * (r + ch / 2) - ch / 2];
      };
      const N = 1 + 8 * 3;
      // Stay put if the spot used last time still works (no jumping about).
      let best = null;
      const tryAt = (i) => { const [l, t] = spot(i); if (inside(l, t) && clear(l, t)) { best = [l, t]; c.spot = i; return true; } return false; };
      if (!tryAt(c.spot)) for (let i = 0; i < N && !best; i++) if (i !== c.spot) tryAt(i);
      if (!best) {
        // Nowhere free: its own spot, kept on the canvas.
        const [l, t] = spot(0);
        best = [Math.max(6, Math.min(W - cw - 6, l)), Math.max(minTop, Math.min(maxBottom - ch, t))];
      }
      const [left, topY] = best;
      placedCards.push({ l: left, r: left + cw, t: topY, b: topY + ch });
      c.card.style.transform = `translate(${left.toFixed(1)}px, ${topY.toFixed(1)}px)`;
      c.dot.style.transform = `translate(${(x - 7).toFixed(1)}px, ${(y - 7).toFixed(1)}px)`;
      // Elbow leader: out of the card's side (or straight up/down when the
      // part is under the card), then along to the dot.
      let d, ex, ey;
      if (x >= left + 10 && x <= left + cw - 10) {
        ex = x; ey = y < topY ? topY : topY + ch;
        d = `M${x.toFixed(1)},${y.toFixed(1)}V${ey.toFixed(1)}`;
      } else {
        ex = x < left ? left : left + cw;
        ey = Math.max(topY + 10, Math.min(topY + ch - 10, y));
        d = Math.abs(ey - y) < 2 ? `M${x.toFixed(1)},${y.toFixed(1)}H${ex.toFixed(1)}` : `M${ex.toFixed(1)},${ey.toFixed(1)}H${x.toFixed(1)}V${y.toFixed(1)}`;
        if (y > topY && y < topY + ch) d = `M${x.toFixed(1)},${y.toFixed(1)}H${ex.toFixed(1)}`;
      }
      c.line.setAttribute('d', d);
      c.line.setAttribute('class', c.card.classList.contains('sel') || c.card.classList.contains('tour') ? 'hot' : '');
      c.end.setAttribute('cx', ex.toFixed(1));
      c.end.setAttribute('cy', ey.toFixed(1));
    }
  }
  const rank = (c) => (c.card.classList.contains('sel') ? 2 : c.card.classList.contains('tour') ? 1 : 0);
  return api;
}

// ---------- View toolbar ----------
// Turn, zoom, labels, tour, X-ray (where the lab has it), reset, the panel
// (in full screen) and full screen, as icon buttons under the model.
function createViewBar(host, wrap, { camera, controls, start, target0, ortho, tween, callouts, tourZoom, onTour, invalidate, viewHeight }) {
  const bar = document.createElement('div');
  bar.className = 'lab-viewbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'View');
  const btn = (ic, label, key, fn, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.innerHTML = icon(ic);
    b.dataset.tip = key ? `${label} · ${key}` : label;
    b.setAttribute('aria-label', label);
    if (key) b.setAttribute('aria-keyshortcuts', key);
    b.addEventListener('click', fn);
    bar.appendChild(b);
    return b;
  };
  const sep = () => { const s = document.createElement('span'); s.className = 'lab-sep'; s.setAttribute('aria-hidden', 'true'); bar.appendChild(s); return s; };
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
  // Pan: slide the view along the screen (a tenth of the view per press).
  const pan = (sx, sy) => {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const step = ((viewHeight() || 20) / (ortho ? camera.zoom : 1)) * 0.1;
    const d = right.multiplyScalar(sx * step).add(up.multiplyScalar(sy * step));
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    tween((k) => {
      camera.position.copy(p0).addScaledVector(d, k);
      controls.target.copy(t0).addScaledVector(d, k);
    }, 0.22);
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
  btn('turnL', 'Turn left', 'Q', () => turn(-45));
  btn('turnR', 'Turn right', 'E', () => turn(45));
  sep();
  btn('zoomOut', 'Zoom out', '−', () => zoom(1 / 1.25));
  btn('zoomIn', 'Zoom in', '+', () => zoom(1.25));
  sep();
  // "Show me around": glide to each labelled part in turn and light up its card.
  let touring = false;
  const stopTour = () => { touring = false; };
  const tour = async () => {
    if (touring) { touring = false; return; }
    const stops = callouts.items();
    if (!stops.length) return;
    touring = true;
    tourBtn.classList.add('on');
    tourBtn.innerHTML = icon('stop');
    tourBtn.setAttribute('aria-label', 'Stop the tour');
    tourBtn.dataset.tip = 'Stop the tour · T';
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
    tourBtn.innerHTML = icon('play');
    tourBtn.setAttribute('aria-label', 'Show me around');
    tourBtn.dataset.tip = 'Show me around · T';
    onTour?.(null);
    reset();
  };
  const tourBtn = btn('play', 'Show me around', 'T', tour, 'lab-tourbtn');
  // Dragging the model stops the tour.
  controls.addEventListener('start', stopTour);
  const labels = () => {
    callouts.show(!callouts.shown);
    lb.classList.toggle('on', callouts.shown);
    lb.setAttribute('aria-pressed', String(callouts.shown));
    invalidate();
  };
  const lb = btn('tag', 'Show or hide labels', 'L', labels);
  lb.classList.add('on');
  lb.setAttribute('aria-pressed', 'true');
  // X-ray: a lab with an "X-ray" button in its panel gets one here too.
  let xb = null;
  const xraySource = () => [...host.querySelectorAll('.lab-controls .lab-btn')].find((b) => /^x-?ray/i.test(b.textContent.trim()));
  const xray = () => { const src = xraySource(); if (src) src.click(); };
  const syncX = () => {
    const src = xraySource();
    if (!src) return;
    if (!xb) {
      xb = btn('xray', 'X-ray: see the metal inside', 'X', xray);
      bar.insertBefore(xb, lb.nextSibling);
      api.xray = xray;
    }
    const on = src.getAttribute('aria-pressed') === 'true' || /:\s*on/i.test(src.textContent);
    xb.classList.toggle('on', on);
    xb.setAttribute('aria-pressed', String(on));
  };
  setTimeout(() => {
    syncX();
    const src = xraySource();
    if (src) new MutationObserver(syncX).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
  }, 0);
  sep();
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
  btn('home', 'Reset the view', 'R', reset);
  const panelSep = sep();
  panelSep.classList.add('lab-fullonly');
  const panelBtn = btn('panel', 'Show the panel', '', () => host.labStage?.drawer.toggle(), 'lab-fullonly lab-panelbtn');
  const fsBtn = btn('expand', 'Full screen', 'F', () => host.labStage?.fullscreen.toggle(), 'lab-fsbtn');
  wrap.appendChild(bar);
  const api = {
    turn, tilt, pan, zoom, reset, tour, labels, bar, stopTour,
    xray: null,
    get touring() { return touring; },
    setFull(on) {
      fsBtn.innerHTML = icon(on ? 'shrink' : 'expand');
      fsBtn.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
      fsBtn.dataset.tip = on ? 'Leave full screen · Esc' : 'Full screen · F';
      api.setDrawer(!host.classList.contains('drawer-closed'));
    },
    setDrawer(open) {
      panelBtn.classList.toggle('on', open);
      panelBtn.setAttribute('aria-pressed', String(open));
      panelBtn.setAttribute('aria-label', open ? 'Hide the panel' : 'Show the panel');
      panelBtn.dataset.tip = open ? 'Hide the panel' : 'Show the panel';
    },
  };
  return api;
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

// ---------- Arduino C++ highlighting ----------
const KW = new Set('void int long unsigned float double bool boolean byte char const static if else for while do return switch case break continue default true false sizeof struct class new delete String word short volatile'.split(' '));
const CONST = new Set('HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 true false'.split(' '));
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(^[ \t]*#[a-z]+[^\n]*)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[UuLlFf]*\b)|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?/gm;
// Plain text in, HTML out, every character wrapped (so it can be done twice safely).
export function highlightCpp(text) {
  let out = '';
  let last = 0;
  const plain = (s) => (s ? `<span class="tk">${esc(s)}</span>` : '');
  text.replace(TOKEN, (m, com, str, pre, num, id, call, i) => {
    out += plain(text.slice(last, i));
    last = i + m.length;
    if (com) out += `<span class="tk tk-com">${esc(com)}</span>`;
    else if (str) out += `<span class="tk tk-str">${esc(str)}</span>`;
    else if (pre) out += `<span class="tk tk-pre">${esc(pre)}</span>`;
    else if (num) out += `<span class="tk tk-num">${esc(num)}</span>`;
    else if (id) {
      const cls = CONST.has(id) ? 'tk-const' : KW.has(id) ? 'tk-kw' : call ? 'tk-fn' : /^[A-Z][a-z]/.test(id) && /^(Serial|Servo|LiquidCrystal|Wire)/.test(id) ? 'tk-type' : '';
      out += `<span class="tk${cls ? ' ' + cls : ''}">${esc(id)}</span>` + (call ? plain(call) : '');
    }
    return m;
  });
  return out + plain(text.slice(last));
}
// Highlight the text inside an element that has buttons or inputs in it,
// leaving those alone. Safe to run again: text already done is skipped.
export function highlightIn(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('.tk, button, input, select, textarea, label') || !n.nodeValue ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const span = document.createElement('span');
    span.innerHTML = highlightCpp(n.nodeValue);
    n.replaceWith(...span.childNodes);
  }
}

async function copyText(t) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// ---------- Code view ----------
// A sketch as numbered, highlighted lines, like the Arduino IDE. Lines can be
// clickable (onLine(n)); mark(n, 'run' | 'err' | 'ok') lights one. Action
// buttons (Run, Step, Verify…) sit in its header with Copy.
//   const code = codeView(group, 'b0_01_blink_given.ino', [{ n: 17, t: 'void setup() {' }, …], onLine);
//   code.action('▶ Run', () => …, { primary: true });
// When `tab` is true and the view is in a lab's panel, its group moves to the
// panel's Code tab.
export function codeView(parent, file, lines, onLine, { tab = false, label = 'Sketch' } = {}) {
  const el = document.createElement('div');
  el.className = 'lab-code';
  el.innerHTML = `<div class="lab-code-head"><span class="lab-code-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lab-code-file"></span><span class="lab-code-acts"></span></div><div class="lab-code-body" role="list" aria-label="${esc(label)}"></div>`;
  const fileEl = el.querySelector('.lab-code-file');
  const body = el.querySelector('.lab-code-body');
  const acts = el.querySelector('.lab-code-acts');
  const rows = new Map();
  let text = '';
  const set = (ls, f = file) => {
    fileEl.textContent = f;
    body.innerHTML = '';
    rows.clear();
    text = ls.map((l) => l.t).join('\n');
    for (const l of ls) {
      const r = document.createElement(onLine ? 'button' : 'div');
      if (onLine) { r.type = 'button'; r.setAttribute('aria-label', `Line ${l.n}: ${l.t.trim() || 'blank'}`); r.addEventListener('click', () => onLine(l.n)); }
      r.className = 'cl-line';
      r.setAttribute('role', 'listitem');
      r.innerHTML = `<span class="n">${l.n}</span><span class="t">${l.t ? highlightCpp(l.t) : ' '}</span>`;
      body.appendChild(r);
      rows.set(l.n, r);
    }
  };
  set(lines);
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'lab-code-btn';
  copyBtn.innerHTML = `${icon('copy')}<span>Copy</span>`;
  copyBtn.setAttribute('aria-label', 'Copy the code');
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(text);
    copyBtn.classList.toggle('done', ok);
    copyBtn.innerHTML = ok ? `${icon('check')}<span>Copied</span>` : `${icon('copy')}<span>Select and copy</span>`;
    setTimeout(() => { copyBtn.classList.remove('done'); copyBtn.innerHTML = `${icon('copy')}<span>Copy</span>`; }, 1800);
  });
  acts.appendChild(copyBtn);
  parent.appendChild(el);
  if (tab) {
    const group = el.closest('.lab-group');
    const host = el.closest('.lab');
    if (group && host?.labUI) host.labUI.adopt(group);
    else if (group && host) (host._codeGroups ||= []).push(group);
  }
  return {
    el,
    set,
    mark(n, cls) {
      for (const [k, r] of rows) r.classList.toggle(cls, k === n);
      if (cls === 'run' || cls === 'err') {
        const r = rows.get(n);
        if (r && body.scrollHeight > body.clientHeight + 4) {
          const top = r.offsetTop - body.offsetTop;
          if (top < body.scrollTop || top + r.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = top - body.clientHeight / 3;
        }
      }
    },
    clear(cls) { for (const r of rows.values()) r.classList.remove(cls); },
    // A button in the header (Run, Step, Reset, Verify, Upload…).
    action(text, fn, { primary = false, title } = {}) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lab-code-btn' + (primary ? ' primary' : '');
      b.textContent = text;
      if (title) b.title = title;
      b.addEventListener('click', () => fn(b));
      acts.insertBefore(b, copyBtn);
      return b;
    },
  };
}

// ---------- The side panel ----------
// Info text pinned at the top, then tabs: Explore (the lab's own buttons),
// Code (when the lab has code), Missions and Help.
export function createUI(host) {
  const info = host.querySelector('.lab-info');
  const controls = host.querySelector('.lab-controls');
  const missionsEl = host.querySelector('.lab-missions');
  const nextEl = host.querySelector('.lab-next');
  const tabsEl = host.querySelector('.lab-tabs');
  const panes = {};
  host.querySelectorAll('.lab-pane').forEach((p) => (panes[p.dataset.pane] = p));
  let missions = [];
  let done = new Set();
  let storeKey = null;
  let onFinish = () => {};
  let current = 'explore';
  const uid = (host.id || host.dataset.lab || 'lab') + '-' + Math.random().toString(36).slice(2, 7);

  // ---- tabs ----
  function tabList() {
    const code = panes.code && panes.code.children.length;
    const codeName = code && panes.code.querySelector('.lab-code, .cb-code') ? 'Code' : 'Bench';
    const count = missions.filter((m) => done.has(m.id)).length;
    return [
      ['explore', 'Explore', 'compass'],
      code ? ['code', codeName, codeName === 'Code' ? 'code' : 'bench'] : null,
      missions.length ? ['missions', `Missions <span class="lab-badge${count === missions.length ? ' done' : ''}">${count}/${missions.length}</span>`, 'target'] : null,
      ['help', 'Help', 'help'],
    ].filter(Boolean);
  }
  function refreshTabs() {
    if (!tabsEl) return;
    const list = tabList();
    if (!list.some(([id]) => id === current)) current = 'explore';
    tabsEl.innerHTML = list.map(([id, t, ic]) => `<button type="button" role="tab" id="${uid}-t-${id}" aria-controls="${uid}-p-${id}" aria-selected="${id === current}" tabindex="${id === current ? 0 : -1}" data-tab="${id}">${icon(ic)}<span>${t}</span></button>`).join('');
    for (const [id, p] of Object.entries(panes)) {
      p.id = `${uid}-p-${id}`;
      p.setAttribute('aria-labelledby', `${uid}-t-${id}`);
      p.hidden = id !== current;
    }
  }
  function tab(id) {
    if (!panes[id]) return;
    current = id;
    refreshTabs();
  }
  tabsEl?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { tab(b.dataset.tab); tabsEl.querySelector(`[data-tab="${b.dataset.tab}"]`)?.focus(); }
  });
  tabsEl?.addEventListener('keydown', (e) => {
    const ids = tabList().map(([id]) => id);
    let i = ids.indexOf(current);
    if (e.key === 'ArrowRight') i = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = ids.length - 1;
    else return;
    e.preventDefault();
    tab(ids[i]);
    tabsEl.querySelector(`[data-tab="${ids[i]}"]`)?.focus();
  });

  // ---- help ----
  if (panes.help) {
    const k = (s) => s.split(' ').map((x) => `<kbd>${x}</kbd>`).join(' ');
    const touch = coarse();
    panes.help.innerHTML = `<div class="lab-help">
  <h5>Moving around</h5>
  <dl class="lab-keys">
    <dt>${touch ? 'Drag one finger' : 'Drag'}</dt><dd>Turn the model</dd>
    <dt>${touch ? 'Two fingers' : 'Right-drag'}</dt><dd>Move it ${touch ? 'and pinch to zoom' : 'across'}</dd>
    ${touch ? '' : '<dt>Scroll</dt><dd>Zoom, towards the pointer</dd>'}
    <dt>${touch ? 'Tap' : 'Click'} a part</dt><dd>Find out what it does</dd>
  </dl>
  <h5>Keys <small>(click the model first)</small></h5>
  <dl class="lab-keys">
    <dt>${k('W A S D')} or arrows</dt><dd>Move</dd>
    <dt>${k('Q E')}</dt><dd>Turn left, turn right</dd>
    <dt>${k('Shift')} + arrows</dt><dd>Turn and tilt</dd>
    <dt>${k('+ −')}</dt><dd>Zoom in, zoom out</dd>
    <dt>${k('R')}</dt><dd>Reset the view</dd>
    <dt>${k('L')} · ${k('T')}</dt><dd>Labels on or off · the tour</dd>
    <dt>${k('F')} · ${k('Esc')}</dt><dd>Full screen · leave it</dd>
    ${host.dataset.lab === 'build' ? `<dt>${k('X')}</dt><dd>X-ray: see the metal inside</dd>` : ''}
  </dl>
  <p class="lab-tip">The lab is a model, not your board. Real parts can look a little different: check the one in your hand too.</p>
  <p class="lab-tip">If it runs slowly, close other tabs, or leave full screen. Everything here works without the internet.</p>
  <p><a class="lab-link" href="${siteUrl('labs.html')}">${icon('cube')} Every 3D lab in the course: the 3D Workshop</a></p>
</div>`;
  }

  // ---- missions ----
  function renderMissions() {
    if (!missionsEl || !missions.length) return;
    const next = missions.find((m) => !done.has(m.id));
    const count = missions.filter((m) => done.has(m.id)).length;
    const idx = next ? missions.indexOf(next) + 1 : missions.length;
    host.dispatchEvent(new CustomEvent('lab-missions', { bubbles: true, detail: { lab: host.dataset.lab, done: count, total: missions.length } }));
    missionsEl.innerHTML = `
      <div class="mission-head"><b>Missions</b><span>${count} of ${missions.length} done</span><button type="button" class="mission-reset" title="Start the missions again" aria-label="Start the missions again">↺</button></div>
      <div class="meter mission-meter"><span style="width:${(count / missions.length) * 100}%"></span></div>
      <ol class="mission-list">${missions.map((m, i) => `<li class="${done.has(m.id) ? 'ok' : m === next ? 'now' : ''}"><span class="mission-mark" aria-hidden="true">${done.has(m.id) ? icon('check') : i + 1}</span><span><b>${m.text}</b>${m === next && m.hint ? `<small>${m.hint}</small>` : ''}<em class="sr">${done.has(m.id) ? ' (done)' : m === next ? ' (next)' : ''}</em></span></li>`).join('')}</ol>
      ${next ? '' : '<p class="mission-all">All missions done. Well found. Explore freely, or press ↺ to try again.</p>'}`;
    if (nextEl) {
      nextEl.hidden = false;
      nextEl.innerHTML = next
        ? `<button type="button" class="lab-next-btn" aria-label="Mission ${idx} of ${missions.length}: ${String(next.text).replace(/<[^>]*>/g, '').replace(/"/g, '&quot;')}. Show all missions.">${icon('target')}<span><span class="lab-next-k">Mission ${idx} of ${missions.length}</span><b>${next.text}</b>${next.hint ? `<small>${next.hint}</small>` : ''}</span></button><div class="meter"><span style="width:${(count / missions.length) * 100}%"></span></div>`
        : `<button type="button" class="lab-next-btn done" aria-label="All missions done. Show the missions.">${icon('check')}<span><span class="lab-next-k">All ${missions.length} missions done</span><b>Well found. Explore freely.</b></span></button>`;
    }
    refreshTabs();
  }
  nextEl?.addEventListener('click', (e) => { if (e.target.closest('.lab-next-btn')) tab('missions'); });
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

  const api = {
    info(title, html) {
      info.innerHTML = `<h4>${String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h4>${html}`;
      info.scrollTop = 0;
      info.classList.remove('fresh');
      void info.offsetWidth;
      info.classList.add('fresh');
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
      for (const el of [missionsEl, nextEl]) {
        el?.classList.remove('pop');
        void el?.offsetWidth;
        el?.classList.add('pop');
      }
      const m = missions.find((x) => x.id === id);
      const n = missions.filter((x) => done.has(x.id)).length;
      host.labStage?.toast(`${icon('check')}<span><b>Mission done${n === missions.length ? ': all of them!' : ` (${n} of ${missions.length})`}</b><small>${String(m.text).replace(/<[^>]*>/g, '')}</small></span>`);
      if (missions.every((x) => done.has(x.id))) onFinish();
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
    // A titled group of controls. { tab: 'code' } puts it in the Code tab.
    group(title, { tab: where } = {}) {
      const g = document.createElement('div');
      g.className = 'lab-group';
      if (title) g.innerHTML = `<span class="lab-group-title">${title}</span>`;
      (where && panes[where] ? panes[where] : controls).appendChild(g);
      if (where) refreshTabs();
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
    // Move a group of controls into the Code tab.
    // A signpost is left where it was, so nobody loses it.
    adopt(group) {
      if (group.parentNode && group.parentNode !== panes.code) {
        const t = group.querySelector('.lab-group-title');
        const sign = document.createElement('div');
        sign.className = 'lab-group lab-moved';
        sign.innerHTML = `${t ? `<span class="lab-group-title">${t.innerHTML}</span>` : ''}<button type="button" class="lab-btn">${icon('code')} Open the Code tab</button>`;
        sign.querySelector('button').addEventListener('click', () => { tab('code'); tabsEl?.querySelector('[data-tab="code"]')?.focus(); });
        group.parentNode.insertBefore(sign, group);
      }
      panes.code.appendChild(group);
      refreshTabs();
    },
    tab,
    refreshTabs,
  };
  host.labUI = api;
  (host._codeGroups || []).forEach((g) => api.adopt(g));
  // Sketches shown in a lab's own boxes get the same colours as the Code tab.
  const hl = () => host.querySelectorAll('pre.cb-code').forEach(highlightIn);
  new MutationObserver((recs) => { if (recs.some((r) => r.target.closest?.('pre.cb-code') || [...r.addedNodes].some((n) => n.nodeType === 1 && (n.matches('pre.cb-code') || n.querySelector?.('pre.cb-code'))))) hl(); }).observe(host, { childList: true, subtree: true });
  refreshTabs();
  return api;
}

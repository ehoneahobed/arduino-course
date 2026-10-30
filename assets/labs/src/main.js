// Entry point of labs.bundle.js. Mounts every <div class="lab" data-lab="…">
// on the page, and wires the "View in 3D" buttons next to the wiring
// diagrams (see tools/inject_3d.py). Built as one classic script so it works
// from file:// (a USB stick) as well as from the web.
import { createStage, createUI, webglAvailable, ensureShell, icon } from './runtime.js';
import * as build from './build.js';
import { mirrorBar } from './sketchpanel.js';
import * as conceptB0 from './concept-b0.js';
import * as conceptB1 from './concept-b1.js';
import * as conceptB2 from './concept-b2.js';
import * as conceptB3 from './concept-b3.js';
import * as conceptB4 from './concept-b4.js';
import * as conceptB5 from './concept-b5.js';
import * as conceptB6 from './concept-b6.js';
import * as conceptB7 from './concept-b7.js';
import * as conceptB8 from './concept-b8.js';

const LABS = { build };
// Concept labs: one line each, so labs added side by side never collide.
LABS['concept-b0'] = conceptB0;
LABS['concept-b1'] = conceptB1;
LABS['concept-b2'] = conceptB2;
LABS['concept-b3'] = conceptB3;
LABS['concept-b4'] = conceptB4;
LABS['concept-b5'] = conceptB5;
LABS['concept-b6'] = conceptB6;
LABS['concept-b7'] = conceptB7;
LABS['concept-b8'] = conceptB8;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// No WebGL: say so kindly, and point back at what still teaches.
function noGL(host, isBuild) {
  host.classList.add('lab-failed');
  const fb = host.previousElementSibling?.querySelector?.('.view3d-full');
  if (fb) fb.hidden = true;
  const canvas = host.querySelector('.lab-canvas');
  canvas.innerHTML = `<div class="lab-nogl" role="status">${icon('cube')}<b>This computer cannot show the 3D model</b><p>It needs WebGL, which is turned off or not supported here.</p><ul><li>${isBuild ? 'The flat picture shows exactly the same build, hole for hole.' : 'The page around this box teaches the same ideas in words and pictures.'}</li><li>Another browser (Chrome, Edge or Firefox) may work, or turning on “hardware acceleration” in its settings.</li></ul>${isBuild ? '<p><button type="button" class="lab-btn primary lab-back">Back to the flat picture</button></p>' : ''}</div>`;
  canvas.querySelector('.lab-back')?.addEventListener('click', () => {
    const btn = host.closest('figure')?.querySelector('.view3d-btn[aria-pressed="true"]');
    if (btn) toggle(btn);
  });
}

export function mount(host) {
  if (host.dataset.mounted) return host.labReady || Promise.resolve();
  host.dataset.mounted = '1';
  const id = host.dataset.lab;
  const lab = LABS[id];
  const isBuild = id === 'build';
  ensureShell(host, lab?.hint);
  const status = host.querySelector('.lab-status');
  if (!lab) {
    status.textContent = `There is no 3D lab called "${id}".`;
    return Promise.resolve();
  }
  if (!webglAvailable()) {
    noGL(host, isBuild);
    return Promise.resolve();
  }
  // Let the "Building the 3D model" message show before the heavy work.
  host.labReady = nextFrame().then(() => {
    try {
      const W = lab.prepare ? lab.prepare(host) : null;
      const cfg = { ...(W && lab.config ? lab.config(W) : lab.config) };
      cfg.title ??= isBuild ? W?.b?.title : (host.getAttribute('aria-label') || '').replace(/^3D lab:\s*/i, '');
      const stage = createStage(host, cfg);
      host.labStage = stage; // for the test bench, the toolbar and the curious
      const ui = createUI(host);
      if (lab.missions) ui.missions(id, lab.missions, () => stage.confetti());
      lab.default(stage, ui, host, W);
      // a build's Run / Stop / Reset, also on the 3D view and at the top of the Code tab
      if (isBuild) mirrorBar(host);
      stage.relayout();
      stage.autoFit();
      status.remove();
      host.classList.add('lab-live');
      host.dispatchEvent(new CustomEvent('lab-mounted', { bubbles: true, detail: { lab: id } }));
    } catch (err) {
      console.error(err);
      status.innerHTML = `<b>The 3D view could not load.</b><small>${isBuild ? 'The flat picture shows the same build.' : 'The page around it teaches the same ideas.'}</small>`;
      host.classList.add('lab-failed');
    }
  });
  return host.labReady;
}

// "View in 3D" next to a wiring figure. The figure holds the flat SVG and a
// hidden button; this swaps the SVG for the 3D lab and back. The lab is made
// the first time it is opened, so a page with four diagrams does not start
// four 3D scenes.
export function toggle(btn, want) {
  const fig = btn.closest('figure') || btn.parentElement;
  let host = fig.querySelector('.lab[data-lab="build"]');
  const open = want ?? btn.getAttribute('aria-pressed') !== 'true';
  if (open && !host) {
    host = document.createElement('div');
    host.className = 'lab';
    host.dataset.lab = 'build';
    host.dataset.build = btn.dataset.build;
    const svg = fig.querySelector('svg[aria-label], img[alt]');
    const name = svg ? (svg.getAttribute('aria-label') || svg.getAttribute('alt')) : '';
    host.setAttribute('aria-label', name ? `3D view: ${name}` : '3D view of this build');
    (btn.closest('.view3d') || btn).insertAdjacentElement('afterend', host);
  }
  if (!open && host?.labStage?.fullscreen.on) host.labStage.fullscreen.exit();
  fig.classList.toggle('is-3d', open);
  if (host) host.hidden = !open;
  btn.setAttribute('aria-pressed', String(open));
  btn.textContent = open ? 'Back to the flat picture' : 'View in 3D';
  fullButton(btn, host, open);
  if (open) {
    // Fonts first, so the printing on the board is drawn in the right face.
    return whenFonts().then(() => mount(host));
  }
  return Promise.resolve();
}

// A "Full screen" button beside an open lab's own button.
export function fullButton(btn, host, open) {
  const wrap = btn.closest('.view3d');
  if (!wrap) return;
  let fb = wrap.querySelector('.view3d-full');
  if (open && !fb && host) {
    fb = document.createElement('button');
    fb.type = 'button';
    fb.className = 'view3d-full';
    fb.innerHTML = '⛶ Full screen';
    fb.addEventListener('click', () => {
      const go = () => host.labStage?.fullscreen.enter();
      if (host.labStage) go(); else mount(host).then(go);
    });
    wrap.appendChild(fb);
  }
  if (fb) fb.hidden = !open || !!host?.classList.contains('lab-failed');
}

function whenFonts() {
  return Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
}

// Open whatever a link or the 3D menu points at: a concept lab (its id, or
// the id of the section around it) or a build ("3d-b1p5"). Resolves once it
// is showing. { full: true } also goes full screen.
export function open(target, { full = false, scroll = true } = {}) {
  let el = typeof target === 'string' ? document.getElementById(target.replace(/^#/, '')) : target;
  let p = Promise.resolve(null);
  const m = typeof target === 'string' && /^#?3d-(.+)$/.exec(target);
  if (m) el = document.querySelector(`.view3d-btn[data-build="${m[1]}"]`);
  if (!el) return p;
  const lazyBtn = el.matches?.('button[data-lab-open]') ? el : el.querySelector?.('button[data-lab-open]') || (el.matches?.('.lab[data-lab]') ? document.querySelector(`button[data-lab-open="${el.dataset.lab}"]`) : null);
  const buildBtn = el.matches?.('.view3d-btn[data-build]') ? el : el.querySelector?.('.view3d-btn[data-build]');
  let host = null;
  if (lazyBtn) {
    host = document.querySelector(`.lab[data-lab="${lazyBtn.dataset.labOpen}"]`);
    if (host && host.hidden) lazyBtn.click();
  } else if (buildBtn) {
    if (buildBtn.getAttribute('aria-pressed') !== 'true') toggle(buildBtn, true);
    host = buildBtn.closest('figure')?.querySelector('.lab[data-lab="build"]');
  } else if (el.matches?.('.lab[data-lab]')) {
    host = el;
    host.hidden = false;
  }
  if (!host) return p;
  if (scroll) (host.previousElementSibling || host).scrollIntoView({ behavior: 'smooth', block: 'start' });
  // A lab must not go full screen until the person asked for it (here, a click).
  if (full) host.labStage ? host.labStage.fullscreen.enter() : (host.dataset.wantFull = '1');
  return whenFonts().then(() => mount(host)).then(() => {
    if (host.dataset.wantFull) { delete host.dataset.wantFull; host.labStage?.fullscreen.enter(); }
    return host;
  });
}

function init() {
  const btns = document.querySelectorAll('.view3d-btn[data-build]');
  const gl = btns.length ? !!window.WebGLRenderingContext : false;
  for (const btn of btns) {
    const wrap = btn.closest('.view3d') || btn;
    if (!gl) continue;
    wrap.hidden = false;
    btn.hidden = false;
    if (btn.dataset.wired) continue;
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => toggle(btn));
  }
  // A lab marked data-lazy waits for its "Open the 3D lab" button (labs.js).
  const labs = [...document.querySelectorAll('.lab[data-lab]:not([data-lazy])')];
  if (labs.length) whenFonts().then(() => labs.forEach(mount));
}

// A picture of a lab (the thumbnails in the 3D Workshop: tools/lab_thumbs.mjs).
export function snapshot(host, type, quality) {
  const st = host.labStage;
  if (!st) return null;
  st.callouts.show(false);
  return st.snapshot(type, quality);
}

window.ArduinoLabs = { mount, toggle, init, open, snapshot, fullButton };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// Entry point of labs.bundle.js. Mounts every <div class="lab" data-lab="…">
// on the page, and wires the "View in 3D" buttons next to the wiring
// diagrams (see tools/inject_3d.py). Built as one classic script so it works
// from file:// (a USB stick) as well as from the web.
import { createStage, createUI, webglAvailable, ensureShell } from './runtime.js';
import * as build from './build.js';
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

export function mount(host) {
  if (host.dataset.mounted) return;
  host.dataset.mounted = '1';
  const lab = LABS[host.dataset.lab];
  ensureShell(host, host.dataset.lab === 'build' ? 'Drag to turn · pinch or scroll to zoom · tap a part' : undefined);
  const status = host.querySelector('.lab-status');
  if (!lab) {
    status.textContent = `There is no 3D lab called "${host.dataset.lab}".`;
    return;
  }
  if (!webglAvailable()) {
    status.textContent = 'This computer cannot show 3D graphics (WebGL is turned off or not supported). ' + (host.dataset.lab === 'build' ? 'The flat picture shows the same build.' : 'The page around it teaches the same ideas in words.');
    host.classList.add('lab-failed');
    return;
  }
  try {
    const W = lab.prepare ? lab.prepare(host) : null;
    const stage = createStage(host, W && lab.config ? lab.config(W) : lab.config);
    const ui = createUI(host);
    if (lab.missions) ui.missions(host.dataset.lab, lab.missions, () => stage.confetti());
    lab.default(stage, ui, host, W);
    host.labStage = stage; // for the test bench and the curious
    status.remove();
  } catch (err) {
    console.error(err);
    status.textContent = 'The 3D view could not load. The flat picture shows the same build.';
    host.classList.add('lab-failed');
  }
}

// "View in 3D" next to a wiring figure. The figure holds the flat SVG and a
// hidden button; this swaps the SVG for the 3D lab and back. The lab is made
// the first time it is opened, so a page with four diagrams does not start
// four 3D scenes.
export function toggle(btn) {
  const fig = btn.closest('figure') || btn.parentElement;
  let host = fig.querySelector('.lab[data-lab="build"]');
  const open = btn.getAttribute('aria-pressed') !== 'true';
  if (open && !host) {
    host = document.createElement('div');
    host.className = 'lab';
    host.dataset.lab = 'build';
    host.dataset.build = btn.dataset.build;
    host.setAttribute('aria-label', '3D view of this build');
    (btn.closest('.view3d') || btn).insertAdjacentElement('afterend', host);
  }
  fig.classList.toggle('is-3d', open);
  if (host) host.hidden = !open;
  btn.setAttribute('aria-pressed', String(open));
  btn.textContent = open ? 'Back to the flat picture' : 'View in 3D';
  if (open) {
    // Fonts first, so the printing on the board is drawn in the right face.
    whenFonts().then(() => mount(host));
  }
}

function whenFonts() {
  return Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
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

window.ArduinoLabs = { mount, toggle, init };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

#!/usr/bin/env node
// Rebuilds assets/labs/labs.bundle.js: the 3D runtime, three.js 0.180.0
// (vendored in assets/vendor/three@0.180.0/) and every lab, in one classic
// script that runs from file:// with no web server and no network.
//
//   node tools/build_labs.mjs            export the builds, then bundle
//   node tools/build_labs.mjs --no-json  bundle only (skip diagrams.py --json)
//   node tools/build_labs.mjs --dev      unminified, for reading errors
//
// It needs esbuild. It looks for it, in this order: an `esbuild` package this
// folder can import, the path in $ESBUILD (a folder holding esbuild's
// package.json, or the package's lib/main.js), then the BIH Tech Club repo
// next to this one. To get it anywhere: `npm install --no-save esbuild`.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_DIR = join(ROOT, 'assets/vendor/three@0.180.0');
const SRC = join(ROOT, 'assets/labs/src');
const OUT = join(ROOT, 'assets/labs/labs.bundle.js');
const args = new Set(process.argv.slice(2));

async function findEsbuild() {
  try {
    return await import('esbuild');
  } catch {}
  const tries = [process.env.ESBUILD, join(ROOT, '../BIH Tech Club/node_modules/esbuild'), join(ROOT, 'node_modules/esbuild')].filter(Boolean);
  for (const t of tries) {
    try {
      const req = createRequire(join(statSync(t).isDirectory() ? t : dirname(t), 'noop.js'));
      return req(statSync(t).isDirectory() ? t : t);
    } catch {}
  }
  console.error('esbuild not found. Run `npm install --no-save esbuild` here, or set ESBUILD=/path/to/node_modules/esbuild.');
  process.exit(1);
}

if (!args.has('--no-json')) {
  // The builds come from the same definitions as the SVG diagrams.
  execFileSync('python3', [join(ROOT, 'tools/diagrams.py'), '--json'], { stdio: 'inherit' });
}
for (const f of ['three.module.js', 'three.core.js', 'addons/controls/OrbitControls.js', 'addons/geometries/RoundedBoxGeometry.js']) {
  if (!existsSync(join(THREE_DIR, f))) {
    console.error(`Missing ${join(THREE_DIR, f)}. Copy it from three@0.180.0 (build/ and examples/jsm/).`);
    process.exit(1);
  }
}

const esbuild = await findEsbuild();
// `three` and `three/addons/…` resolve to the vendored copy, never to npm.
const vendorThree = {
  name: 'vendor-three',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(THREE_DIR, 'three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(THREE_DIR, 'addons', a.path.slice('three/addons/'.length)) }));
  },
};
const dev = args.has('--dev');
const res = await esbuild.build({
  entryPoints: [join(SRC, 'main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome80', 'firefox78', 'safari14', 'edge80'],
  minify: !dev,
  legalComments: 'eof',
  outfile: OUT,
  plugins: [vendorThree],
  logLevel: 'warning',
  banner: { js: '/* Arduino Ladder 3D labs. Built by tools/build_labs.mjs: do not edit, edit assets/labs/src/ and rebuild. three.js 0.180.0 (MIT, see assets/vendor/three@0.180.0/LICENSE). */' },
  metafile: true,
});
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(`wrote ${OUT.replace(ROOT + '/', '')} (${kb} KB${dev ? ', unminified' : ''})`);
void pathToFileURL;
void res;

#!/usr/bin/env node
// Makes the 3D Workshop's thumbnails: assets/labs/thumbs/<id>.webp, one per
// concept lab and build listed in labs.html. Each is a picture of the model
// on a transparent background, taken from labs.html?open=<id>&shot.
//
//   node tools/lab_thumbs.mjs              every lab and build
//   node tools/lab_thumbs.mjs b1p5 b3p6    just these
//   node tools/lab_thumbs.mjs --soft       software WebGL (no GPU needed; slower, no antialiasing)
//
// Run it after `node tools/build_labs.mjs` and `python3 tools/labs_page.py`,
// whenever the models change. It needs playwright-core and Google Chrome:
// it looks for playwright-core here, in $PLAYWRIGHT (a folder holding the
// package), then in the BIH Tech Club repo next to this one; and for Chrome
// in $CHROME or the usual places.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/labs/thumbs');
const COURSE = join(ROOT, 'arduino');
const args = process.argv.slice(2);
const soft = args.includes('--soft');
const only = args.filter((a) => !a.startsWith('--'));

async function findPlaywright() {
  try { return await import('playwright-core'); } catch {}
  for (const t of [process.env.PLAYWRIGHT, join(ROOT, '../BIH Tech Club/node_modules/playwright-core')].filter(Boolean)) {
    try { return createRequire(join(t, 'noop.js'))(t); } catch {}
  }
  console.error('playwright-core not found. Run `npm install --no-save playwright-core`, or set PLAYWRIGHT=/path/to/node_modules/playwright-core.');
  process.exit(1);
}
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));

const html = readFileSync(join(COURSE, 'labs.html'), 'utf8');
const catalog = JSON.parse(/<script type="application\/json" id="ws-catalog">([\s\S]*?)<\/script>/.exec(html)[1].replace(/<\\\//g, '</'));
const ids = catalog.map((c) => c.id).filter((id) => !only.length || only.includes(id));
mkdirSync(OUT, { recursive: true });

const { chromium } = await findPlaywright();
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: soft ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist', '--headless=new', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])],
});
const ctx = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1, colorScheme: 'light' });
let made = 0;
for (const id of ids) {
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(join(COURSE, 'labs.html')).href + `?open=${encodeURIComponent(id)}&shot`, { waitUntil: 'load' });
    await page.waitForSelector('.lab.lab-live', { timeout: 90000 });
    await page.waitForTimeout(1500);
    // 800 × 500 drawn, saved at 560 × 350 (sharp on a phone, small on disk)
    const url = await page.evaluate(() => new Promise((done) => {
      const big = window.ArduinoLabs.snapshot(document.querySelector('.lab.lab-live'), 'image/png');
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 560; c.height = 350;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, 560, 350);
        done(c.toDataURL('image/webp', 0.82));
      };
      img.onerror = () => done(null);
      img.src = big;
    }));
    if (!url || !url.startsWith('data:image/webp')) throw new Error('no picture');
    writeFileSync(join(OUT, `${id}.webp`), Buffer.from(url.split(',')[1], 'base64'));
    made++;
    process.stdout.write(`${id} `);
  } catch (e) {
    console.error(`\n${id}: ${e.message}`);
  }
  await page.close();
}
await browser.close();
console.log(`\nwrote ${made} of ${ids.length} thumbnails to assets/labs/thumbs/`);

#!/usr/bin/env node
// Makes the link-preview cards (WhatsApp, Facebook, X) and the app icons. Run it after adding a
// page or changing a page's <title> or description, then run python3 tools/inject_head.py:
//
//   node tools/og.mjs              every card, plus the icons
//   node tools/og.mjs band-3 home  only the cards whose file name contains one of these words
//
// Writes assets/og/<page path with / as ->.jpg (1200 x 630, about 50-120 KB each), one per page
// that has a <link rel="canonical">, and assets/brand/icon-512.png, icon-maskable-192.png and
// icon-maskable-512.png. The images are committed, so the host never needs a browser.
// Cards are in the Bozoma Innovation Hub style: plum, the white logo mark, a gold kicker, the
// title in Outfit, the red and gold bar; band pages carry their resistor colour, and pages with
// a 3D build show its Workshop thumbnail. It needs playwright-core and Google Chrome, found the
// same way as tools/lab_thumbs.mjs ($PLAYWRIGHT, then the BIH Tech Club repo next to this one;
// $CHROME, then the usual places).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/og');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

async function findPlaywright() {
  try { return await import('playwright-core'); } catch {}
  for (const t of [process.env.PLAYWRIGHT, join(ROOT, '../BIH Tech Club/node_modules/playwright-core')].filter(Boolean)) {
    try { return createRequire(join(t, 'noop.js'))(t); } catch {}
  }
  console.error('playwright-core not found. Run `npm install --no-save playwright-core`, or set PLAYWRIGHT=/path/to/node_modules/playwright-core.');
  process.exit(1);
}
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && existsSync(p));

const b64 = (file, type) => `data:${type};base64,` + readFileSync(join(ROOT, file)).toString('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&times;/g, '×').replace(/&amp;/g, '&');

// The resistor colour code, as the course teaches it (assets/course.css --b0 ... --b8):
// deep colours for a stripe on a resistor body, light ones for text on plum.
const BANDS = [
  ['Black', '#2B2F31', '#9AA3A6'], ['Brown', '#6B4526', '#B98452'], ['Red', '#9E3325', '#E2705F'],
  ['Orange', '#8C5417', '#E0A054'], ['Yellow', '#6E5D00', '#D6C24A'], ['Green', '#2A6E3D', '#5FB878'],
  ['Blue', '#1F5A8C', '#7FB3E0'], ['Violet', '#5E3E8C', '#B096DE'], ['Grey', '#454B4F', '#A9B1B5'],
];
// A real resistor's stripes are brighter than the course's text colours.
const STRIPE = ['#1c1c1c', '#7a4a22', '#d0312d', '#f08a1c', '#f5d327', '#2f9e44', '#1f6fd1', '#8b4fc9', '#8d9396'];

// The same page list and naming rule as tools/inject_head.py.
function pages(dir = '') {
  return readdirSync(join(ROOT, dir)).sort().flatMap((name) => {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(ROOT, rel)).isDirectory()) return name.startsWith('.') || (!dir && ['tools', 'node_modules', 'assets'].includes(name)) ? [] : pages(rel);
    return name.endsWith('.html') ? [rel] : [];
  });
}
const ogName = (rel) => rel.slice(0, -5).replace(/\//g, '-');

// 3D Workshop thumbnails, by the page they belong to (last build on the page = its main build).
const labs = readFileSync(join(ROOT, 'arduino/labs.html'), 'utf8');
const catalog = JSON.parse(/<script type="application\/json" id="ws-catalog">([\s\S]*?)<\/script>/.exec(labs)[1].replace(/<\\\//g, '</'));
const thumbFor = {};
for (const c of catalog) {
  const page = 'arduino/' + c.lesson.split('#')[0];
  if (!existsSync(join(ROOT, `assets/labs/thumbs/${c.id}.webp`))) continue;
  if (!thumbFor[page] || !c.id.startsWith('concept-')) thumbFor[page] = c.id;
}
Object.assign(thumbFor, { 'index.html': 'b7p8i2c', 'arduino/home.html': 'b1p6', 'arduino/labs.html': 'b5p4' });

function cardData(rel, html) {
  const title = unesc(/<title>([\s\S]*?)<\/title>/.exec(html)[1].trim());
  const desc = unesc(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '');
  const band = /<html[^>]*data-band="(\d)"/.exec(html)?.[1];
  const d = { title, sub: desc, band: band === undefined ? null : +band, thumb: thumbFor[rel] || null };
  if (rel === 'index.html') {
    return { ...d, kicker: 'IoT at Bozoma Innovation Hub', title: 'Build smart things. <em>Start here.</em>', html: true, sub: 'Free courses in electronics, the Internet of Things and coding, at your own speed. Works with no internet.', ladder: true };
  }
  if (rel === 'arduino/home.html') {
    return { ...d, kicker: 'The Arduino Ladder · free course', title: 'Nine bands. Nine things <em>you build.</em>', html: true, sub: 'Arduino for complete beginners, at your own speed, with 3D labs. Works with no internet.', ladder: true };
  }
  let m = /^Band (\d): (.*?) · /.exec(title);
  if (m) return { ...d, kicker: `Band ${m[1]} · ${BANDS[+m[1]][0]}`, title: m[2] };
  const parts = title.split(' · ').filter((p) => !/Arduino Ladder$/.test(p));
  const kind = parts.length > 1 ? parts[1] : 'The Arduino Ladder';
  const kicker = d.band !== null && /Swap|Practice|Bench/.test(kind) ? `Band ${d.band} · ${kind}` : kind === 'The Arduino Ladder' ? kind : `${kind} · The Arduino Ladder`;
  const names = { 'Facilitator Guide': 'The facilitator guide', 'Video library': 'The video library' };
  return { ...d, kicker, title: names[parts[0]] || parts[0] };
}

const FONTS = `@font-face { font-family: Outfit; font-weight: 100 900; src: url(${b64('assets/fonts/outfit.woff2', 'font/woff2')}); }
  @font-face { font-family: Rubik; font-weight: 300 900; src: url(${b64('assets/fonts/rubik.woff2', 'font/woff2')}); }`;
const MARK = b64('assets/brand/logo-mark-white.png', 'image/png');

function resistor(n) {
  // A resistor lying across, with one wide stripe in the band's colour.
  return `<svg class="res" viewBox="0 0 300 60" aria-hidden="true">
    <path d="M0 30H300" stroke="#cfd3d6" stroke-width="5" stroke-linecap="round"/>
    <rect x="70" y="8" width="160" height="44" rx="20" fill="#e9d3a6"/>
    <rect x="70" y="8" width="160" height="16" rx="8" fill="#fff" opacity=".28"/>
    <rect x="128" y="8" width="44" height="44" fill="${STRIPE[n]}"/>
    <rect x="70" y="8" width="160" height="44" rx="20" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
  </svg>`;
}

function card(c) {
  const title = c.html ? c.title : esc(c.title);
  const len = title.replace(/<[^>]+>/g, '').length;
  const wide = !c.thumb;
  const size = wide ? (len > 40 ? 64 : len > 26 ? 76 : 88) : (len > 34 ? 54 : len > 22 ? 64 : 74);
  const accent = c.band !== null ? BANDS[c.band][2] : '#FFBE00';
  const ladder = c.ladder ? `<div class="ladder">${STRIPE.map((s) => `<i style="background:${s}"></i>`).join('')}</div>` : '';
  return `<!doctype html><html><head><style>
  ${FONTS}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #24182E; color: #fff; font-family: Rubik, sans-serif; position: relative; overflow: hidden; }
  .glow { position: absolute; width: 560px; height: 560px; border-radius: 50%; filter: blur(140px); opacity: .32; }
  .g1 { background: #FFBE00; left: -160px; top: -240px; } .g2 { background: #CA1F3F; right: -160px; bottom: -280px; }
  .g3 { background: ${accent}; right: 80px; top: 60px; width: 420px; height: 420px; opacity: ${c.thumb ? .22 : 0}; }
  .main { position: absolute; left: 0; top: 0; bottom: 14px; width: ${wide ? 1200 : 700}px; padding: 60px 0 58px 80px; display: flex; flex-direction: column; }
  .lock { display: flex; align-items: center; gap: 18px; }
  .lock img { width: 74px; height: 74px; }
  .lock b { display: block; font: 600 34px/1.05 Outfit, sans-serif; letter-spacing: -.3px; }
  .lock small { display: block; font-size: 19px; color: rgba(255,255,255,.72); margin-top: 4px; letter-spacing: .3px; }
  .kicker { margin-top: auto; display: flex; align-items: center; gap: 16px; font-size: 22px; font-weight: 700; color: #FFBE00; letter-spacing: 3.5px; text-transform: uppercase; }
  .res { width: 150px; height: 30px; flex: none; }
  h1 { font: 500 ${size}px/1.04 Outfit, sans-serif; margin: 16px 0 20px; letter-spacing: -1px; max-width: ${wide ? 1000 : 610}px; }
  h1 em { color: #FFBE00; font-style: normal; }
  p { font-size: ${wide ? 26 : 24}px; line-height: 1.35; color: rgba(255,255,255,.76); font-weight: 300; max-width: ${wide ? 960 : 590}px;
      display: -webkit-box; -webkit-line-clamp: ${wide ? 2 : 3}; -webkit-box-orient: vertical; overflow: hidden; }
  .pic { position: absolute; right: -50px; top: 70px; width: 620px; height: 420px; display: grid; place-items: center; }
  .pic::before { content: ""; position: absolute; inset: 40px 30px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,.2), rgba(255,255,255,0)); }
  .pic img { position: relative; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 18px 26px rgba(0,0,0,.45)); }
  .ladder { position: absolute; right: 80px; bottom: 62px; display: flex; gap: 10px; }
  .ladder i { width: 18px; height: 56px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: linear-gradient(90deg, ${c.band !== null ? STRIPE[c.band] : '#CA1F3F'} 0 70%, #FFBE00 70%); }
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  ${c.thumb ? `<div class="pic"><img src="${b64(`assets/labs/thumbs/${c.thumb}.webp`, 'image/webp')}"></div>` : ''}
  ${ladder}
  <div class="main">
    <div class="lock"><img src="${MARK}"><span><b>IoT at BIH</b><small>Bozoma Innovation Hub · Aiyinasi, Ghana</small></span></div>
    <div class="kicker">${c.band !== null ? resistor(c.band) : ''}<span>${esc(c.kicker)}</span></div>
    <h1>${title}</h1>
    ${c.sub ? `<p>${esc(c.sub)}</p>` : ''}
  </div>
  <div class="bar"></div>
</body></html>`;
}

const { chromium } = await findPlaywright();
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const rel of pages()) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  if (!/<link rel="canonical"/.test(html)) continue;
  const name = ogName(rel);
  if (only.length && !only.some((w) => name.includes(w))) continue;
  await page.setContent(card(cardData(rel, html)), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
  made++;
}

// App icons: the colour mark on white ("any", like icon-192.png), and the white mark on plum
// inside the middle 60% ("maskable": phones crop it to a circle or a rounded square).
let icons = 0;
if (!only.length) {
  const colour = b64('assets/brand/logo-mark.png', 'image/png');
  const icon = (size, bg, src, inner) => `<html style="background:${bg}"><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden">
    <img src="${src}" style="position:absolute;left:${(size * (1 - inner)) / 2}px;top:${(size * (1 - inner)) / 2}px;width:${size * inner}px;height:${size * inner}px"></body></html>`;
  for (const [file, size, bg, src, inner] of [
    ['icon-512.png', 512, '#fff', colour, 0.8],
    ['icon-maskable-192.png', 192, '#24182E', MARK, 0.58],
    ['icon-maskable-512.png', 512, '#24182E', MARK, 0.58],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(icon(size, bg, src, inner), { waitUntil: 'load' });
    await page.screenshot({ path: join(ROOT, 'assets/brand', file), clip: { x: 0, y: 0, width: size, height: size } });
    icons++;
  }
}
await browser.close();
console.log(`Made ${made} preview card(s) in assets/og/${icons ? ` and ${icons} app icons in assets/brand/` : ''}`);

#!/usr/bin/env node
// Compiles every sketch in arduino/sketches/ for the Arduino Uno
// (ATmega328P, arduino:avr:uno) and writes what the 3D labs' virtual Arduino
// needs: one small script per sketch in assets/labs/hex/<sketch>.js holding
// the machine code (the Intel HEX, as base64 bytes), the sketch's source and
// the compiler's own report. A sketch that does not compile (b0_03 on
// purpose) gets the compiler's real error text instead, so the lab can show
// it. The output is committed: learners never need a compiler.
//
//   node tools/compile_sketches.mjs            compile all
//   node tools/compile_sketches.mjs b2_01      only sketches whose name starts so
//   node tools/compile_sketches.mjs --install  first install the core and libraries
//
// It needs arduino-cli (https://arduino.github.io/arduino-cli/). It looks for
// it in $ARDUINO_CLI, then on the PATH, then inside the Arduino IDE 2 app
// (macOS / Windows / Linux default places). With --install it runs
//   arduino-cli core install arduino:avr
//   arduino-cli lib install Servo LiquidCrystal "LiquidCrystal I2C" Keypad SimpleDHT TM1637 Stepper
// ("LiquidCrystal I2C" is Frank de Brabander's, the one the course names).
// To keep those libraries away from your own sketchbook, set
// ARDUINO_DIRECTORIES_USER=/some/folder first; arduino-cli honours it.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKETCHES = join(ROOT, 'arduino/sketches');
const OUT = join(ROOT, 'assets/labs/hex');
const FQBN = 'arduino:avr:uno';
const LIBS = ['Servo', 'LiquidCrystal', 'LiquidCrystal I2C', 'Keypad', 'SimpleDHT', 'TM1637', 'Stepper'];
// These must NOT compile (the course says so). Anything else failing is a real problem.
const MEANT_TO_FAIL = new Set(['b0_03_buggy_semicolon']);

const argv = process.argv.slice(2);
const install = argv.includes('--install');
const only = argv.filter((a) => !a.startsWith('--'));

function findCli() {
  const tries = [
    process.env.ARDUINO_CLI,
    'arduino-cli',
    '/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe'),
    'C:/Program Files/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe',
    '/opt/arduino-ide/resources/app/lib/backend/resources/arduino-cli',
  ].filter(Boolean);
  for (const t of tries) {
    const r = spawnSync(t, ['version'], { encoding: 'utf8' });
    if (r.status === 0) return { cli: t, version: r.stdout.trim() };
  }
  console.error('arduino-cli not found. Install it (brew install arduino-cli, or the official download), or set ARDUINO_CLI=/path/to/arduino-cli.');
  process.exit(1);
}

const { cli, version } = findCli();
const run = (args, opts = {}) => spawnSync(cli, args, { encoding: 'utf8', maxBuffer: 1 << 26, ...opts });
console.log(`using ${cli}\n  ${version}`);

if (install) {
  for (const args of [['core', 'update-index'], ['core', 'install', 'arduino:avr'], ['lib', 'install', ...LIBS]]) {
    console.log('arduino-cli ' + args.join(' '));
    execFileSync(cli, args, { stdio: 'inherit' });
  }
}

// Intel HEX to bytes (only data records; the Uno's flash starts at 0).
function hexToBytes(text) {
  const out = [];
  let base = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(':')) continue;
    const n = parseInt(line.slice(1, 3), 16);
    const addr = parseInt(line.slice(3, 7), 16);
    const type = parseInt(line.slice(7, 9), 16);
    if (type === 0) {
      for (let i = 0; i < n; i++) out[base + addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
    } else if (type === 2) base = parseInt(line.slice(9, 13), 16) << 4;
    else if (type === 4) base = parseInt(line.slice(9, 13), 16) << 16;
  }
  return Uint8Array.from(out, (b) => b ?? 0xff);
}

// The compiler's report, without the temp folder's path in it.
const tidy = (s, tmp, name) => s.replace(/\x1b\[[0-9;]*m/g, '').split(tmp + '/' + name + '/').join('').split(tmp).join('').replace(/\r/g, '').trim();

mkdirSync(OUT, { recursive: true });
const names = readdirSync(SKETCHES).filter((f) => f.endsWith('.ino')).map((f) => f.slice(0, -4)).filter((n) => !only.length || only.some((o) => n.startsWith(o))).sort();
const tmp = mkdtempSync(join(tmpdir(), 'ard-compile-'));
const index = {};
const problems = [];
try {
  for (const name of names) {
    const dir = join(tmp, name);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(SKETCHES, name + '.ino'), join(dir, name + '.ino'));
    const outDir = join(tmp, 'out-' + name);
    const r = run(['compile', '--no-color', '--fqbn', FQBN, '--build-path', join(tmp, 'build-' + name), '--output-dir', outDir, '--warnings', 'default', dir]);
    const source = readFileSync(join(SKETCHES, name + '.ino'), 'utf8').replace(/\r\n/g, '\n');
    const report = tidy((r.stdout || '') + '\n' + (r.stderr || ''), tmp, name);
    let rec;
    if (r.status === 0 && existsSync(join(outDir, name + '.ino.hex'))) {
      const bytes = hexToBytes(readFileSync(join(outDir, name + '.ino.hex'), 'utf8'));
      const flash = /Sketch uses (\d+) bytes/.exec(report)?.[1];
      const ram = /Global variables use (\d+) bytes/.exec(report)?.[1];
      rec = { ok: true, flash: +flash || bytes.length, ram: +ram || 0, program: Buffer.from(bytes).toString('base64') };
      console.log(`  ok    ${name}  (${rec.flash} bytes of flash, ${rec.ram} of RAM)`);
      if (MEANT_TO_FAIL.has(name)) problems.push(`${name} compiled, but the course says it must not`);
    } else {
      // keep only the compiler's own lines: the error and where it is
      const lines = report.split('\n').filter((l) => l.trim() && !/^(Used librar|Used platform|Error during build|Sketch uses|Global variables)/.test(l) && !/^\S+:\S+\s+\d[\d.]*\s+\//.test(l) && !/^\S+\s+\d[\d.]*\s+\//.test(l));
      rec = { ok: false, error: lines.join('\n') };
      console.log(`  FAIL  ${name}${MEANT_TO_FAIL.has(name) ? '  (on purpose)' : ''}\n${lines.map((l) => '        ' + l).join('\n')}`);
      if (!MEANT_TO_FAIL.has(name)) problems.push(`${name} did not compile`);
    }
    rec.name = name;
    rec.source = source;
    rec.compiler = `arduino-cli ${/Version: ([^ ]+)/.exec(version)?.[1] ?? ''}, ${FQBN}`.trim();
    const js = `/* ${name}.ino, compiled for the Arduino Uno by tools/compile_sketches.mjs: do not edit, recompile. */\n` +
      `(window.ArduinoSketches=window.ArduinoSketches||{})[${JSON.stringify(name)}]=${JSON.stringify(rec)};\n`;
    writeFileSync(join(OUT, name + '.js'), js);
    index[name] = rec.ok ? { ok: true, flash: rec.flash } : { ok: false };
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (!only.length) {
  // drop outputs for sketches that no longer exist
  for (const f of readdirSync(OUT)) if (f.endsWith('.js') && !names.includes(f.slice(0, -3))) rmSync(join(OUT, f));
}
console.log(`\n${names.length} sketches, ${Object.values(index).filter((x) => x.ok).length} compiled, written to assets/labs/hex/`);
if (problems.length) {
  console.error('\nProblems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

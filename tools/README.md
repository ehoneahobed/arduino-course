# Checkers

Three scripts that read the course pages and refuse to let known defect classes
back in. Run them from the folder that holds `pack2/`, `pack3/`, `pack4/` and
`projects/`. Each exits noisily rather than quietly, and each has been tested by
putting the defect back and watching it fire.

## `holecheck.py` — one hole, one leg

Reads every page's authoritative pin-plan table and flags any breadboard hole, or
any Arduino pin, claimed by two different rows of the same table. Different tables
are different circuits built at different times, so collisions only count within
one table.

    python3 holecheck.py

It ignores three things that look like claims and are not: notes that span the
whole table, a hole named in a row's first cell to identify a part it already
placed ("Emitter, `e12`"), and a hole named only to warn you off it
("`b11`, not `a11`").

With no arguments it checks every band and project page. It used to accept no
arguments and check nothing, printing "0 collisions" and meaning "0 files", which
is worse than no checker at all. It now refuses to run on an empty file list.

## `carryover.py` — the seams

The rail audit of August 2026 found nine defects and not one was inside a
hole-by-hole wiring list. Every one sat at a join between pages. This checks the
joins.

    python3 carryover.py

**Check A, rail feed.** A rail is dead metal until a wire feeds it. Any page that
instructs a learner to connect something to a rail must, on that page, either name
the feed wire or say that an earlier feed stays in place, and must say which of the
two rail pairs it means, because the top pair and the bottom pair are not joined.
This is decidable, so it passes or fails.

**Check B, carry-over edges.** Every reference to an earlier build ("Band 3 Part 9
has it", "already wired", "you moved it there in Part 6") is paired with every
board-clearing instruction that could have removed the thing referenced. Position
is (page, line), and a "Before you start: clear the board" box counts for its whole
Part in both directions, because Band 3 lost its button to a clear box three lines
*below* the sentence that said the button was already wired.

Check B is a worklist, not a verdict. It cannot know whether a given clear removed
the specific thing a given reference needs. Reviewed edges live in
`carryover-reviewed.txt`, one `page:line` per line, so a run reports only what is
new. Delete a line there to put that edge back in the report.

## `bbdraw.py` — wiring diagrams that cannot disagree with the words

Generates a breadboard-and-Arduino diagram from the same hole names the page text
uses. It refuses to draw a board with two legs in one hole, a rail nothing feeds,
or a 5V wire into a minus rail. `check_against_text(board, html, name)` diffs the
holes in a page against the holes in its diagram, both directions.

    import bbdraw as B
    b = B.Board(1, 12, title="Band 1 Part 5")
    b.led("f5", "f6")
    b.res("j5", "j3", "220")
    b.wire("h3", "8")
    b.wire("j6", "-top")
    b.power("GND", "-top")
    open("out.svg", "w").write(b.svg())

Leaving out that last line is an error, not a silent omission:

    DEAD RAIL: -top used but nothing feeds it.

## `read3.py` — reading level

    python3 read3.py 'pack*/band*.body.html' 'projects/*.body.html'

Flesch-Kincaid by hand, counting the boxed prose that the older `read2.py` skipped.
The course sits around grade 4.2 and every page should stay under 6.

## `diagrams.py` and `inject_wiring.py` — the wiring pictures

`diagrams.py` holds every board in the course, defined once, in the same hole
names the pages use. Nothing in it is drawn freehand: each build was transcribed
from its page with the quoted sentence beside it.

    python3 diagrams.py --check    run the guards and the hole diff, write nothing
    python3 diagrams.py            write wiring/*.svg

`--check` does two things. Every generator guard runs on every build, so a hole
collision or an unfed rail is an error rather than a picture. Then every hole in
every picture is checked against the `<code>` holes on its own page: a diagram
cannot show a hole the page never names. Three pages failed that on the first run
and all three were the page's fault, not the diagram's, saying "b20, b21 and so
on" where a beginner has to count. The second run found two more of the same
shape, plus a real wiring defect: Band 6 Part 5 asked for the servo's red wire
and the + rail feed both to sit in the single 5V socket, which the course's own
"one Arduino pin takes one wire" rule forbids.

`inject_wiring.py` places each diagram on its page. An anchor must appear exactly
once or it refuses to run, because a picture beside the wrong build is worse than
no picture. Re-running replaces rather than duplicates.

The build scripts substitute `<!--SVG:wire_NAME-->` from `wiring/`, so the order
is: `diagrams.py` then `inject_wiring.py` then the build.

### Part types

`led`, `res`, `wire`, `power`, `link`, `btn`, `pot`, `buz`, `npn`, `blk` (a module
that sits IN the board), `battery` (a pack feeding the rails instead of the
Arduino), and `mod` (a module with no breadboard presence at all: a servo, a
driver board, an I2C screen). `blk` takes `rails=` for a module that also reaches
a rail directly.

## The 3D build viewer: `build_labs.mjs`, `inject_3d.py`, `labtest.html`

Every wiring diagram can also be seen as a 3D model you can turn, click and
X-ray. It is drawn from the same data as the SVG: `Board.json()` in
`bbdraw.py`, exported for all builds by

    python3 diagrams.py --json      writes ../assets/labs/src/builds.json

Sources live in `assets/labs/src/` (`runtime.js` is the BIH Tech Club 3D
runtime, ported; `build.js` is the viewer; `parts.js` the part models;
`main.js` mounts labs). three.js 0.180.0 is vendored in
`assets/vendor/three@0.180.0/`. Pages load nothing from a CDN.

Because the site must open from a USB stick (file://, where browsers refuse
ES modules), everything is bundled into one committed classic script,
`assets/labs/labs.bundle.js`. After changing a build in `diagrams.py` or
anything in `assets/labs/src/`, rebuild it:

    node tools/build_labs.mjs            runs diagrams.py --json, then bundles
    node tools/build_labs.mjs --dev      unminified, for reading errors

It needs esbuild: it uses an installed `esbuild` package, or `$ESBUILD`, or
the BIH Tech Club repo's copy next to this folder. Anywhere else:
`npm install --no-save esbuild` first.

A page carries two tags in its head, and a hidden button in each wiring figure:

    <link rel="stylesheet" href="../assets/labs/labs.css">
    <script defer src="../assets/labs/labs.js"></script>

`labs.js` is a small loader (about 13 KB). The 1 MB bundle is fetched only when someone
presses **View in 3D**, so a band page costs nothing extra on mobile data.
Without JavaScript or WebGL the button stays hidden and the flat SVG teaches
exactly as before. Any page may also hold `<div class="lab" data-lab="build"
data-build="b1p5"></div>`, which is filled straight away.

    python3 tools/inject_3d.py           add the head tags and buttons to bands/ and projects/
    python3 tools/inject_3d.py --check   report only
    python3 tools/inject_3d.py --undo    take them out again
    python3 tools/inject_3d.py --root DIR   work on a copy

`inject_3d.py` matches each figure to its build by the SVG's `aria-label`
(the build's title). A label that matches no build, or two, stops the run
before anything is written. Running it twice changes nothing.

`tools/labtest.html` is a test bench, not linked from the site: it shows the
flat SVG above the 3D view for any builds (`?b=b1p5,b5p4`), and
`&lowpower` forces the settings used on software WebGL.

What the viewer does: drag, pinch or the toolbar to turn and zoom, right-drag
or two fingers to move; on the focused model `W A S D` or arrows move it, `Q`
and `E` turn it, `+` and `-` zoom, `R` resets, `L` labels, `T` the tour, `X`
X-ray, `F` full screen and `Esc` leaves it. Click a part, a
hole or an Arduino socket to see what it is and everything it is joined to.
X-ray makes the board see-through, shows the metal strips (one per column of
five, one per rail, nothing across the channel, top and bottom rails
separate) and lights up each electrical connection in its own colour.
"Show me around" visits every part in build order.

### The Build tab: guided build and "Build it yourself"

`assets/labs/src/buildmode.js` adds the **Build** tab to every build (`ui.pane()` in `runtime.js` makes a
lab's own tab). `practice-rules.js` holds the rules and the electrical check, with no three.js, so it can be
tested in node:

    import * as R from './practice-rules.js';
    const r = R.check(build, items, DATA.pins);   // { ok, runnable, matches, problems: [{ sev, text, ends }] }
    R.check(build, R.itemsFromBuild(build), DATA.pins).ok   // true for every build in builds.json

A learner's build is a list of items, one per part or wire, each end a hole (`f5`), a rail hole
(`r:-top:7`) or an Arduino socket (`S:dig:9`, the header and place in `builds.json`'s `pins`).
`R.buildFromItems()` turns it back into a build in the `builds.json` shape (with the rail columns the learner
chose: `col`, `colA`/`colB`, `cols`, which `build.js` honours), and the lab is mounted again with that build in
`host.labBuild` to run the sketch on it. The guards mirror `bbdraw.py`'s (HOLE COLLISION, SOCKET COLLISION,
POLARITY, LINK POLARITY, the battery, DEAD RAIL with the wrong-half case). One difference: a rail counts as fed
when it is electrically joined to GND, 5V, 3V3, VIN or a battery, so feeding it through a column counts too.
The guided build's order comes from the page: `readChunks()` reads the paragraphs, list items, table rows and
boxes between the wiring figure and the next one, and `R.orderFromChunks()` places each part at the first
chunk that names all its holes (and, for a wire to a rail or socket, the rail or the pin). On the test bench,
`host.labBuildMode` drives it (`guided()`, `next()`, `practice()`, `begin(trayId)`, `place(end)`, `typed('pin 8')`,
`check()`, `lastCheck()`).

## The virtual Arduino: `compile_sketches.mjs`

Each 3D build has a **Run the sketch** section: the course's real sketches,
compiled for the Uno's ATmega328P, run in the browser on an emulated chip
(avr8js 0.21.1, MIT, vendored in `assets/vendor/avr8js@0.21.1/` and bundled
into `labs.bundle.js`). Which sketches a build offers is in
`assets/labs/src/sketches.json` (the first is the one the page builds it for;
the others fit its wiring pin for pin). The code is `assets/labs/src/sim.js`
(wiring to parts, inputs, the panel), `uno.js` (the chip and its pins) and
`hd44780.js` (the 16x2 screen and its I2C backpack).

The machine code is compiled once by a maintainer and committed, so nobody
needs a compiler to use the site:

    node tools/compile_sketches.mjs             compile every sketch in arduino/sketches/
    node tools/compile_sketches.mjs b2_01 b7    only the sketches whose names start so
    node tools/compile_sketches.mjs --install   first install the core and the libraries

It writes one small script per sketch, `assets/labs/hex/<sketch>.js` (the
program as base64 bytes from the Intel HEX, the source, and the program and
memory sizes), which the lab fetches with a plain `<script>` when a build
opens, so it works from file:// too. A sketch that does not compile keeps the
compiler's own error text instead; the lab shows it and marks the line. Only
`b0_03_buggy_semicolon` may fail: any other failure, or b0_03 compiling, makes
the script exit with an error. Recompile after changing any sketch.

It needs `arduino-cli` (`brew install arduino-cli`, the official download, or
the copy inside Arduino IDE 2, which it finds by itself; or set
`ARDUINO_CLI=/path/to/arduino-cli`), the `arduino:avr` core and the libraries
the sketches include: Servo, LiquidCrystal, Stepper, "LiquidCrystal I2C" (Frank
de Brabander), Keypad, SimpleDHT and TM1637. `--install` installs all of them.
To keep them out of your own sketchbook, set `ARDUINO_DIRECTORIES_USER` to
another folder first. Last compiled with arduino-cli 1.5.1 and arduino:avr
1.8.8: 53 of 54 compile.

What the emulated board is joined to, through the build's own wiring (wires,
strips, rails and pressed buttons, as in X-ray): lights and the RGB light from
each pin's share of time high (so `analogWrite` shows as brightness; a common
anode RGB light is lit by a LOW pin, as the real one is), the board's L, TX,
RX and ON lights, the buzzer's pitch from the pin's frequency (sound off until
the learner turns it on), servo angle from pulse length, the stepper driver's
four lights, the fan from the transistor's base, the 16x2 screen in 4-bit mode
or over I2C (address 0x27), and the serial monitor (with a box to send text).
Inputs in the panel: buttons (hold to press; `INPUT_PULLUP` or the build's own
resistors decide what a pin reads, and a floating pin wanders), knobs, the
light sensor, the rain sensor, distance for the HC-SR04, temperature and
humidity for the DHT11, and the keypad. `analogRead` wobbles by a count or so,
as a real one does (b6_03 needs that). The TM1637 display and the I2C screen
in Band 7 Part 8 are not drawn in their builds, so what they show is printed
in the panel. The chip runs at its real speed (16 million cycles a second) in
frame-sized slices, and pauses when the lab is off screen or the tab is
hidden; on a slow computer the panel says how much slower than real it is.

The board has three states: **Run** (plugged in and running), **Pause**
(frozen where it is, still powered) and **Stop** (unplugged: the clock stops,
every output goes off, the screens go blank, the servo holds where it is, and
the next Run starts from the beginning). **Reset** starts the sketch again
while it stays plugged in. The parts that answer the chip in time with it (the
HC-SR04's echo, the DHT11, the TM1637's bus, the keypad, the screen on six
pins) are in `assets/labs/src/devices.js`, shared by the page and the test
below.

## Editing a sketch: the course's Arduino C++ interpreter

The Code tab of every build is an editor (`assets/labs/src/editor.js`: a
textarea over a highlighted copy, with line numbers; Tab and Shift+Tab indent,
Enter keeps the indent, Esc then Tab leaves the box). **Verify** checks the
sketch, **Upload and run** checks it and runs it, **Back to the course's
sketch** puts the original back. A learner's version is saved per sketch in
localStorage (`ard-sketch-edit:<sketch>`); the board runs the course's
compiled sketch until they upload.

arduino-cli cannot run in a browser, so an edited sketch is run by an
interpreter written for this course rather than by an existing one (JSCPP and
similar C++ interpreters in JavaScript are large, run `int` as 32 bits, cannot
pause for `delay()` without freezing the page, and word their errors
differently from the Arduino IDE). It has three parts:

- `cpp-parse.js`: lexer, preprocessor (`#include`, `#define`, `#ifdef`) and
  parser for the C++ that sketches use.
- `cpp-compile.js`: checks the sketch as avr-gcc would (types, scopes,
  arguments, `setup` and `loop`, the libraries' members) with the same wording
  and a plain-English note, then writes it out as JavaScript generators. Numbers
  behave as on the ATmega328P: `int` 16 bits and wrapping, `long` 32, `float` and
  `double` both 32-bit floats, integer division and `%` as C, `char` signed,
  Arduino's `abs`/`min`/`max`/`constrain` as the macros they are. It also
  keeps a model of the chip's clock cycles for each operation (a divide costs
  hundreds), so loops that poll `millis()` take as long as on the chip.
- `vboard.js`: a virtual Uno with the same outside as `uno.js` (pin modes and
  levels, PWM share and frequency, pulse lengths, edge callbacks, clock events,
  serial, ADC, I2C), so the 3D parts, the inputs and `devices.js` work on it
  unchanged. The Arduino core and the libraries (Servo, LiquidCrystal,
  LiquidCrystal_I2C with Wire, Keypad, SimpleDHT, Stepper, TM1637Display) are
  written in JavaScript after the real ones, including their timing (the
  screens' start-up waits, the keypad's debounce, the DHT11's pulse timing, the
  TM1637's bit-banged bus, `pulseIn` losing a few microseconds to the timer
  interrupt, `random()` as avr-libc's).

It supports what the course's sketches use and what a learner is likely to
add: all the integer types, `float`, `bool`, `char`, `byte`, `String`, `const`,
`static` locals, `#define`, `enum`, arrays (also 2D) and `char` arrays, pointers
to them and `&x` for library calls, functions with default values, every
statement and operator, casts. Not supported (with a clear message): `struct`
and classes of your own, references (`&` parameters), `long long`, interrupts
(`attachInterrupt`), `sprintf`, EEPROM, libraries the course does not use.

Time is virtual: the program runs in slices until it reaches the time the page
asked for, then yields, so `delay()`, busy loops and a loop that never pauses
cannot freeze the page. A loop that goes round for 2 seconds without touching
anything the board can see gets a note ("It may never end. A real board would
be stuck here too."); calls nested more than 180 deep stop the sketch with a
message; reading or writing outside an array gives a note with the line. While
an edited sketch runs, the line it is waiting on (a `delay`) is marked.

### The fidelity test: `interp_check.mjs`

    node tools/interp_check.mjs              every course sketch
    node tools/interp_check.mjs b3 b7_05     only sketches whose names start so
    node tools/interp_check.mjs -v b4_06     more detail on differences
    node tools/interp_check.mjs --dump=b2_01_fade_given,9,0,200   one pin, window by window

It runs every sketch in `arduino/sketches/` two ways in Node, with no browser:
the compiled machine code on the emulated chip (avr8js) and the source on the
interpreter, with the same scripted inputs (button presses at given times, knob
and sensor values, keypad keys, distances; `analogRead` noise from the same
seeded random numbers). Every 5 ms of virtual time it compares each pin's mode,
share of time high (20 ms averages, for PWM), frequency (tones), servo pulse
length, the serial text and when each line came (within 40 ms), the 16x2
screen's text and the TM1637's digits. Measured numbers may differ by a count
or two (a time read with `millis()`, an echo timed with `pulseIn`). The buggy
sketches must misbehave the same way (b3_03's light must flicker as much both
ways while the button is held), and b0_03 must fail to compile with the
compiler's own message. The scenarios are in the `SC` table at the top. It
needs esbuild (as `build_labs.mjs` does). Last run: 54 of 54 match, in about
100 seconds.

## Full screen, the "3D lab" pill and the 3D Workshop: `inject_nav3d.py`, `labs_page.py`, `lab_thumbs.mjs`

Every lab and build viewer has a **Full screen** button (and the `F` key). It
uses the browser's Fullscreen API, or a full-window "theatre" where there is
none (iPhones); `?theatre` on a page forces the theatre to test it. In full
screen the panel becomes a drawer (a sheet on phones). In a page the lab
breaks out of the text column to the window's width. The model is framed to
fill the view (`stage.autoFit()` in `runtime.js`; a lab can pass
`autoFit: false` or `fitPad` in its config).

The panel has tabs: **Explore** (the lab's own buttons), **Code** (a group made
with `ui.group(title, { tab: 'code' })`, or holding a `codeView(…, { tab: true })`;
a lab's bench strip also moves there in full screen), **Missions** and **Help**.
`codeView()` in `runtime.js` is the code box: Arduino C++ highlighting, line
numbers, the running line, header buttons (`code.action('▶ Run', fn)`) and
Copy. The builds' Code tab uses the editor in `editor.js` instead (see above). Callout cards get a line icon picked from their title.

    python3 tools/inject_nav3d.py           a "3D lab" pill first in each band's section bar
    python3 tools/inject_nav3d.py --check   report only
    python3 tools/inject_nav3d.py --undo    take it out again

The pill links to the band's "Try it in 3D" heading (`id="try-3d"`, which the
tool adds). With JavaScript, `labs.js` makes it a menu of every 3D view on the
page. A link to `#try-3d`, or to `#3d-b1p5` for a build, opens that view.

`labs.html` is the 3D Workshop: every concept lab and build, by band, each
opening full size at `labs.html?open=<id>`. It is generated:

    python3 tools/labs_page.py              write labs.html (after adding a build, a figure or a lab;
                                            it also adds the page's app and link-preview tags, see below)
    node tools/lab_thumbs.mjs               the thumbnails, assets/labs/thumbs/<id>.webp
    node tools/lab_thumbs.mjs b1p5 --soft   one of them, on software WebGL

`lab_thumbs.mjs` needs Google Chrome and playwright-core (found here, in
`$PLAYWRIGHT`, or in the BIH Tech Club repo next to this one). Rerun it
whenever the models change; a missing thumbnail shows a drawn cube instead.

## Offline app and link previews: `build_sw.mjs`, `inject_head.py`, `og.mjs`

The website installs as an app ("IoT at BIH") and keeps working with no internet. The parts:

- `manifest.webmanifest` (root): the app's name, plum theme and icons (`assets/brand/icon-*.png`).
- `sw.js` (root): the service worker. Its header explains what is saved when.
- `assets/app.js`: registers `sw.js` (only over http/https, never from `file://`), runs the
  "Save the whole course on this device" panel (`<div data-offline>` on `arduino/home.html` and
  `arduino/profile.html`), shows "Updated — reload for the latest version" when a new version
  takes over, and the install hint (`beforeinstallprompt`; an iPhone/iPad note in the panel).
- `offline.html` (root): shown for a page that is not saved yet when there is no internet.

**Run after changing any file of the site** (a page, a script, a sketch, a thumbnail, anything):

    node tools/build_sw.mjs            write the file list, content hashes and version into sw.js
    node tools/build_sw.mjs --check    exit 1 if sw.js is out of date

The version is a hash of every file's content, so browsers pick up a new version only when
something changed, and then download again only the files whose hash changed. Old saved copies
are kept until fresh ones arrive, so a phone that is offline when the update lands loses nothing.
A device that pressed "Save the whole course" saves the new version by itself. Run it last, after
the other tools below, because they change pages. If you forget it, the site still works, but
devices keep the old copies of cache-first files (fonts, pictures, compiled sketches, downloads)
and only see new pages when they are online.

What goes in: every file of the site except `tools/`, `assets/og/`, `assets/vendor/` and
`assets/labs/src/` (already inside `labs.bundle.js`), Markdown, licences, `vercel.json`,
`robots.txt`, `sitemap.xml` and `404.html`. Saved on the first visit (`CORE` in `build_sw.mjs`):
the site home, the course home, My progress, every band page, the shared CSS and JS, fonts, the
logo and `offline.html`, about 2 MB before compression. Everything else (about 7 MB in all) is
saved when first opened, or all at once by the button. A new course's pages are picked up
automatically; add them to `CORE_RE` if they should be saved on the first visit. Pages are saved
under their clean address (`arduino/bands/band-3`) and found by either form; the redirects in
`vercel.json` are copied into `sw.js` so old addresses work offline too. YouTube is never cached.

**Link previews** (WhatsApp, Facebook, X). Every page with a `<link rel="canonical">` carries
`og:*` and `twitter:card` tags, and the manifest link and `app.js` tag:

    node tools/og.mjs                  the preview cards, assets/og/<page path with / as ->.jpg,
                                       and the app icons icon-512, icon-maskable-192/512
    node tools/og.mjs band-3           only the cards whose name contains "band-3"
    python3 tools/inject_head.py       add or refresh the tags in every page's <head>
    python3 tools/inject_head.py --check

`inject_head.py` is safe to run again: it replaces only its own block (between the
`app + link previews` comments) and takes the title, description and address from the page.
`labs_page.py` calls it, so the generated 3D Workshop keeps its tags. `og.mjs` needs Chrome and
playwright-core, found like `lab_thumbs.mjs`. Rerun it after adding a page or changing a page's
title or description. Cards are 1200 x 630 JPEGs of about 40 to 80 KB: plum, the white logo mark,
a gold kicker, the title in Outfit, the band's resistor colour, and the page's 3D build if it has
one. Facebook and WhatsApp keep a preview for a while; Facebook's Sharing Debugger refreshes it.

After adding or changing pages, the order is:

    node tools/og.mjs && python3 tools/inject_head.py && python3 tools/labs_page.py && node tools/build_sw.mjs

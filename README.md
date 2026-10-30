# IoT at Bozoma Innovation Hub

Free, self-paced courses in electronics, the Internet of Things and coding, built by
[Bozoma Innovation Hub](https://bozomainnovationhub.com) in Aiyinasi, Ghana, for people who have
never done any of it before. The site home (`index.html`) lists the courses and a learning path.

| Course | Folder | Status |
|---|---|---|
| The Arduino Ladder | `arduino/` | Open |
| Wi-Fi and the Internet of Things (ESP32) | `esp32/` | Planned |
| Raspberry Pi | `raspberry-pi/` | Planned |
| Code for makers (Python, MicroPython) | `code/` | Planned |

To add one, see [ADDING-A-COURSE.md](ADDING-A-COURSE.md). Everything below is about the first course.

**Live site:** https://iot.bozomainnovationhub.com (the old https://arduino-course-psi.vercel.app address still works)

# The Arduino Ladder

A free, project-based Arduino course for complete beginners. Nine bands. Nine things you build.
Written for someone who has never touched electronics or programming, working at their own speed,
with nobody to ask. It lives in `arduino/`; its old addresses (`/bands/…`, `/projects/…`, `/guide`,
`/labs`) redirect there permanently (`vercel.json`).

---

## What is in here

| Band | Build | Time | What it teaches |
|---|---|---|---|
| 0 · Black | Bench Ready | ~3 h | What the board is, how to send it a program, how to read an error |
| 1 · Brown | Signal Tower | ~6 h | Breadboards, circuits, resistors, three lights in a sequence |
| 2 · Red | Mood Lamp | ~6 h | Brightness, colour mixing, `for` loops |
| 3 · Orange | Combination Lock | ~7 h | Buttons, floating pins, the serial monitor, remembering, arrays |
| 4 · Yellow | Night Guard | ~7 h | Sensors, voltage dividers, `map`, and calibration |
| 5 · Green | Simon Says | ~8 h | Writing your own functions, sound, and `millis` versus `delay` |
| 6 · Blue | Things That Move | ~7 h | Servos, libraries, deadbands, and the shared-ground rule |
| 7 · Violet | Distance and Display | ~7 h | Ultrasonic time-of-flight, LCD screens of both kinds, flicker-free output |
| 8 · Grey | Build for Nzemaland | ~12 h | State machines, briefs and criteria, power-cut behaviour, honest evaluation |

Bands 0 to 5 teach the parts and the ideas. Bands 6 to 8 are about what happens
when a project has to leave the desk: it has to push something, speak for
itself, and be usable by somebody who is not its author.

The band names come from the resistor colour code: black is 0, brown is 1,
red is 2, and so on. Learners decode their own band name in Band 1.

```
index.html                  the site home (IoT at BIH)
arduino/home.html           the course home page
arduino/guide.html          the facilitator guide
arduino/labs.html           the 3D Workshop
arduino/bands/              the nine lesson pages
arduino/projects/           swaps, bench pages, practice, ideas
arduino/sketches/           all 41 Arduino sketches, plus a README
arduino/downloads/          a zip of every sketch
assets/                     shared by every course: course.css, theme.js, pager.js, app.js, labs/, brand/, fonts/, og/
sw.js, manifest.webmanifest the offline app (sw.js's file list is written by tools/build_sw.mjs)
offline.html                shown for a page not saved yet, with no internet
```

## How it is built

Plain HTML and CSS. **No build step, no framework, no dependencies.** You can
open `index.html` in a browser by double-clicking it and the whole course works,
with no internet connection at all. That matters: it means the course runs from
a USB stick in a room with no network.

The fonts are in `assets/fonts/`, so nothing needs the internet except the optional YouTube videos.

## Offline, install, and link previews

**Offline on the website.** The first visit saves the site home, the course home, My progress,
every band page and the shared styles, scripts and fonts (a service worker, `sw.js`). Every other
page, the 3D bundle, compiled sketches and thumbnails are saved the first time they are opened.
On the course home and My progress, **Save the whole course on this device** saves everything at
once (about 7 MB), with a progress bar; a device that did that saves each new version by itself.
When a new version takes over an open page, a quiet note says "Updated — reload for the latest
version". Pages work at both `/arduino/bands/band-3` and `band-3.html`, and the old addresses
redirect, with no internet. YouTube videos are never saved: they still need the internet, and
their boxes say so. From a USB stick (`file://`) none of this runs, because nothing is needed.

**Install.** The site is an installable app called "IoT at BIH" (`manifest.webmanifest`, plum,
BIH icons). Where the browser offers it, the site home shows a small dismissible "Install" note
and the course home and My progress show an **Install this course** button; on an iPhone or iPad
those pages say "tap Share, then Add to Home Screen". The app opens at the site home. It assumes
the site is at the root of its domain (as on Vercel); in a GitHub Pages project folder the pages
and offline saving still work, but the installed app would start at the wrong address.

**Link previews.** Every page carries Open Graph and Twitter tags, so a link shared on WhatsApp,
Facebook or X shows a card (`assets/og/`): the page's title, the band's resistor colour and its 3D
build, in BIH plum and gold.

**After changing any file, run `node tools/build_sw.mjs`** so devices pick up the change. After
adding a page or changing a title or description, also make its card and tags first. The details
and the order are in `tools/README.md` ("Offline app and link previews").

Every diagram is hand-drawn inline SVG that follows the reader's light or dark
theme. Nothing is a bitmap, so nothing goes blurry.

## One section at a time

Band pages show one section at a time, with **Previous** and **Next** at the foot, a progress bar, and a tick
in the section bar for every section read (`assets/pager.js`). Learners come back to where they left off.
Progress is kept in that browser only. Any link into a section (an idea card, a 3D build, `#try-3d`) opens
that section. "Show the whole band on one page" switches back to the long page; printing, and browsers
without JavaScript, always get the whole band.

On wide screens the section list is a sidebar with the band's progress at the top; on phones and tablets a
"Sections" bar at the top opens it as a drawer. Every page has a light / dark switch in the top bar
(`assets/theme.js`, saved in the browser; with no choice saved the page follows the device setting).

## Check yourself, badges and My progress

Each band's **Check yourself** is interactive (`assets/check.js`, styles in `assets/progress.css`). Questions with
one right answer get choice buttons or a box to type a number; a wrong answer gets a hint and a link back to
the section that teaches it, and the answer shows after a try or on request. Open questions ("explain",
"describe") get a box to write in, then the model answer, then an honest **Got it / Not yet**. It reads data
attributes on each `<li>` of `<ol class="num" data-check>` (`data-kind="choice|number|list|open"`,
`data-choices`, `data-correct`, `data-see`, `data-hint`, `data-why-N`; the header of `check.js` lists them).
The model answers still come from the `<details>`, so without JavaScript, and in print, the page is as before.
**If you change a question or its answer, check its data attributes still agree.**

A band's **badge** (its resistor colour) is earned when every section has been read and every Check yourself
question is done (checkable ones right, open ones self-marked). Concept-lab missions are a bonus, never
required. `assets/progress.js` works this out and draws the course home dashboard ("Continue where you left
off", badges, a quiet line on each band card) and the line on the site home's course card.
`arduino/profile.html` (`assets/profile.js`) shows badges, dates, scores, missions, 3D builds run and builds wired
right in "Build it yourself", prints a
record for a facilitator, and can export, import and clear progress. Everything is kept in the browser only
(localStorage keys `ladder-read-N`, `ladder-check-N`, `ladder-badge-N`, `ladder-meta-N`, `ladder-where`,
`ladder-name`, `ladder-3d-runs`, `ladder-builds-wired`, each build's practice board `ladder-build-<id>`, plus the
labs' `ard-lab-*` and `ard-sketch-edit:*`).

## Videos

Band pages carry optional videos from Science Buddies' free "How to Use an Arduino" series
(https://www.youtube.com/playlist?list=PLlBVuTSjOrclb0iCMSRpS_H1lSrlSVeEm), each placed in the
section that teaches the same thing. A box is a thumbnail link (works without JavaScript); with
`assets/video.js` it plays in place in YouTube's privacy-enhanced player, only when clicked, and says
"needs the internet" when offline. Every box reminds learners that the page wins if the two differ.

## The 3D labs

Every wiring diagram has a **View in 3D** button. The 3D build is generated from the same hole data as the
flat picture (`python3 tools/diagrams.py --json`), so the two cannot disagree. Pages load a small loader
(`assets/labs/labs.js`); the 3D bundle (`assets/labs/labs.bundle.js`, three.js included) is fetched only when a
learner presses the button, and it works from a USB stick with no internet. Lab source is in `assets/labs/src/`;
rebuild the bundle with `node tools/build_labs.mjs` (see `tools/README.md`).
Every lab opens **full screen** (the button, or the `F` key), and in a page it is as wide as the window.

Every 3D build can also **run its sketch**. The course's real sketches are compiled for the Uno's chip
(`node tools/compile_sketches.mjs`, output committed in `assets/labs/hex/`) and run in the browser on an
emulated ATmega328P (avr8js, MIT, vendored in `assets/vendor/avr8js@0.21.1/`), at the chip's own speed. What
the sketch does to its pins reaches the 3D parts through the build's own wiring: lights (with PWM brightness),
the RGB light, buzzer, servo, the 16x2 screen and the serial monitor, with buttons, knobs and sensors to set in
the panel. A sketch that does not compile shows the compiler's real error. Which sketches go with which build:
`assets/labs/src/sketches.json`. Details in `tools/README.md`.

The board has three states, shown by a coloured dot beside the buttons: **Run** plugs it in and starts the
sketch, **Pause** freezes it where it is, **Stop** unplugs it (every output off, the screen blank, the servo
left where it stopped) so the next Run starts from the beginning, and **Reset** starts the sketch again while it
stays plugged in.
The same Run / Pause, Stop and Reset also sit on the 3D view itself (top left) and pinned at the top of the
Code tab, so in full screen they are never hidden away. The red signpost under the model is **Show me
around** (the tour, `T`), not Run.

Learners can also **change the code and upload it**. The Code tab is an editor (line numbers, colours, Tab to
indent) with **Verify**, **Upload and run** and **Back to the course's sketch**; each learner's version of each
sketch is kept in the browser (localStorage). The real compiler cannot run in a page, so an edited sketch is
checked and run by the course's own **Arduino C++ interpreter** (`assets/labs/src/cpp-parse.js`,
`cpp-compile.js`, `vboard.js`), on the same virtual board and parts. It gives compiler-style errors with line
numbers ("expected ';' before '}' token", "'digitalwrite' was not declared in this scope; did you mean
'digitalWrite'?"), runs `int` as 16 bits and `float` as the chip does, and never freezes the page. The panel
always says which is on the board: the course's sketch (compiled for the real chip) or your edited sketch (run by
the interpreter). `node tools/interp_check.mjs` runs every course sketch both ways and compares them; all 54
match.

Every 3D build also has a **Build** tab, for building it with your own hands:

- **Guided build** steps through the build one part at a time, in the order the page's own steps and pin-plan
  tables place them (read from the steps after the wiring picture; where a page cannot say, as in the 3D
  Workshop, parts left to right, then signal wires, then the wires to the rails and the feeds). Each part drops
  into its holes, the holes light up and are named ("f5 +", "f6 −"), and the page's own "You should see" goes
  with it, with the step's test ("Then: plug in…") after the part it follows. A part the page says is already on
  the board from before is marked so. **Next** / **Back**, or `N` / `B` on the model.
- **Build it yourself** starts from an empty breadboard and the Uno, with a tray of the build's parts and as many
  wires as you like (colours to choose). Pick a part, then tap the hole for each leg; or type where ("f5",
  "pin 8", "GND", "-top"); or click the model and use the arrow keys to move a gold ring and `Enter` to place
  (`Delete` removes, `Esc` cancels). Placed parts can be moved, flipped (an LED) or put back. **Check my
  wiring** runs the same guards as the diagrams (`tools/bbdraw.py`): two legs in one hole, two wires in one
  Arduino socket, 5V into a − rail or GND into a + rail, a rail that is used but not fed, or fed from the wrong
  half; then that nothing shorts 5V to GND; then compares what is joined to what (through columns, rails and
  wires) with the build's own wiring, so any equivalent layout passes and identical parts may swap places. It
  names the usual faults kindly and lights the holes in question: an LED or buzzer in backwards, both legs of a
  part in one column, a resistor not in series, "these two should be joined" and "should not be". The rules
  are in `assets/labs/src/practice-rules.js` (no three.js in it, so it runs in node too). When the wiring is
  right, or wrong but safe, **Run the sketch on your build** opens the same 3D view on the learner's own
  wiring with the virtual Arduino running, so a wrong wiring visibly misbehaves; **Back to Build it yourself**
  returns. The board is kept per build in the browser (`ladder-build-<id>`), and a build checked right is
  recorded in `ladder-builds-wired` and shown on My progress. Placing a part adds only that part to the scene;
  holes are lit through the board's instanced colours, so it stays quick on old computers and phones.

Each band also has a **concept lab** ("Try it in 3D") placed where its big idea is taught: the Uno tour and
upload journey (Band 0), current in a loop and resistor colours (1), PWM and colour mixing (2), floating pins
and the lock's array (3), the light-sensor divider and calibration (4), functions and `millis` vs `delay` (5),
servo pulses, deadband and shared ground (6), ultrasonic echo and flicker-free LCD output (7), and state
machines with power-cut behaviour (8). Their source is `assets/labs/src/concept-bN.js`.

Every concept lab that shows a sketch also **runs the real one** ("Run the real sketch", from
`assets/labs/src/sketchpanel.js`): the course's compiled sketch on the emulated chip by default, an
editable Code tab with **Verify**, **Upload and run** and **Back to the course's sketch** (edits run on the
interpreter and are kept under the same `localStorage` key as the build viewer, so an edited `b0_02` shows in
both), Run / Pause, Stop (unplug) and Reset with the state dot, and a line saying what is on the board.
Band 0 runs b0_01 to b0_03 on the Uno's L light (Stop unplugs the cable; on the phone charger the sketch
runs but Upload finds no board; b0_03 shows the real compiler's error). Bands 2 to 8 keep their slowed-down
models (the PWM picture, the divider, the state-machine rooms…) and add the band's sketches running on the
same 3D parts: b2_01/b2_04/b2_02/b2_03, b3_02/b3_05, b4_05/b4_04/b4_03, b5_02/b5_03/b5_04, b6_01–b6_03,
b7_01/b7_04/b7_05 (real sonar timing and I2C screen) and b8_01–b8_03 (the room token follows what the sketch
prints). Touching a model's own controls unplugs the board so the two never fight over a light.

Each band page's section bar starts with a **3D lab** pill that lists every 3D view on the page, and
`labs.html`, the **3D Workshop**, shows all of them with thumbnails, grouped by band. It is generated by
`python3 tools/labs_page.py`, and its thumbnails by `node tools/lab_thumbs.mjs`.

## Publishing it

### GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`,
   the branch to `main`, and the folder to `/ (root)`.
4. Save. Your site appears at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

The `.nojekyll` file is already here, which stops GitHub trying to process the
site as a blog.

### Vercel

1. Push this repository to GitHub.
2. At [vercel.com](https://vercel.com), choose **Add New → Project** and import
   the repository.
3. Framework preset: **Other**. Leave the build command empty and set the output
   directory to the repository root (`.`).
4. Deploy.

`vercel.json` is already here and turns on clean URLs, so `/guide` works as well
as `/guide.html`.

### A custom domain

Both hosts support one. For GitHub Pages, put your domain in a file called
`CNAME` at the root and point a DNS record at GitHub. For Vercel, add the domain
in the project settings. Neither needs any change to the site itself.

## Editing it

Everything is a plain text file, so any editor will do.

- **Fix a typo in a lesson:** open the band page in `arduino/bands/` and edit the text.
  The lesson content is ordinary HTML with no templating.
- **Change a colour or the type:** everything is in `assets/course.css`, at the
  top, as CSS custom properties. The light palette is on `:root` and the dark
  one is redefined below it.
- **Change a sketch:** edit the `.ino` file in `sketches/`, then rebuild the zip
  with `cd arduino/sketches && zip -r ../downloads/arduino-ladder-sketches.zip .`

If you change a lesson, please also check its **Check yourself** answer key still
agrees with it. Several of those answers depend on exact numbers in the sketches.

## About the sketches

All 41 were compiled and linked for the ATmega328P (the chip on an Arduino Uno)
before publication, with zero warnings.

Four of them fail **on purpose**, because reading a failure is part of the lesson:

- `b3_03_toggle_buggy.ino` compiles and runs, and does the wrong thing
- `b5_03_blocking_problem.ino` compiles and runs, and misses button presses
- `b6_03_buggy_jitter.ino` compiles and runs, and will not hold the arm still
- `b8_02_buggy_flags.ino` compiles and runs, and freezes in a state no branch handles

And one fails to compile on purpose:

- `b0_03_buggy_semicolon.ino` — the learner is meant to read the error message

A fifth, `b7_04_buggy_flicker.ino`, compiles and runs but is deliberately
unpleasant to look at, and the band takes it apart.

Every other sketch works. If one does not do what its header says, the problem
is the wiring, and the band page has a checklist for it.

**Libraries.** Bands 0 to 5 need none. Band 6 uses `Servo` and Band 7 uses
`LiquidCrystal`; both ship with the Arduino IDE. The only one a learner may have
to install is `LiquidCrystal_I2C` (Frank de Brabander), and only if their screen
has an I²C backpack. Band 7 Part 6a walks through it.

## The teaching behind it

The course is built on the Raspberry Pi Foundation's twelve principles of
computing pedagogy. Every band follows the same six steps:

**Think first** (an unplugged activity) → **Guess** (predict what the code does)
→ **Run it** → **Look closer** (trace, debug, reorder) → **Change it**
(three tiers) → **Make your own** (a real brief, tested on a real person).

`guide.html` sets out where each of the twelve principles is actually enforced,
so the course can be held to them.

## Licence

- **Course content** (all lesson text, diagrams and pages): Creative Commons
  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). Use it, translate it,
  adapt it, teach with it. Keep the attribution and share your changes alike.
- **Sketches and site code** (`sketches/`, `assets/`): MIT.

See `LICENSE` for the details. If you would rather publish under different terms,
change that file before you push.

## Credit

Made by Bozoma Innovation Hub, Aiyinasi, Ellembelle District, Western Region,
Ghana, for young people in Nzemaland getting skills without having to leave home.

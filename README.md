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
assets/                     shared by every course: course.css, theme.js, pager.js, labs/, brand/, fonts/
```

## How it is built

Plain HTML and CSS. **No build step, no framework, no dependencies.** You can
open `index.html` in a browser by double-clicking it and the whole course works,
with no internet connection at all. That matters: it means the course runs from
a USB stick in a room with no network.

The only external request is to Google Fonts. If that fails, the pages fall back
to system fonts and everything still works.

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

Each band also has a **concept lab** ("Try it in 3D") placed where its big idea is taught: the Uno tour and
upload journey (Band 0), current in a loop and resistor colours (1), PWM and colour mixing (2), floating pins
and the lock's array (3), the light-sensor divider and calibration (4), functions and `millis` vs `delay` (5),
servo pulses, deadband and shared ground (6), ultrasonic echo and flicker-free LCD output (7), and state
machines with power-cut behaviour (8). Their source is `assets/labs/src/concept-bN.js`.

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

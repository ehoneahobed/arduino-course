# The Arduino Ladder

A free, project-based Arduino course for complete beginners, built by
[Bozoma Innovation Hub](https://bozomainnovationhub.com) in Aiyinasi, Ghana.

Six bands. Six things you build. Written for someone who has never touched
electronics or programming, working at their own speed, with nobody to ask.

**Live site:** _add your URL here once you have deployed it_

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

Bands 6, 7 and 8 (motors, distance and displays, and a capstone project) are
still being written.

The band names come from the resistor colour code: black is 0, brown is 1,
red is 2, and so on. Learners decode their own band name in Band 1.

```
index.html          the course home page
guide.html          the facilitator guide
bands/              the six lesson pages
sketches/           all 26 Arduino sketches, plus a README
downloads/          a zip of every sketch
assets/course.css   one stylesheet for the whole site
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

- **Fix a typo in a lesson:** open the band page in `bands/` and edit the text.
  The lesson content is ordinary HTML with no templating.
- **Change a colour or the type:** everything is in `assets/course.css`, at the
  top, as CSS custom properties. The light palette is on `:root` and the dark
  one is redefined below it.
- **Change a sketch:** edit the `.ino` file in `sketches/`, then rebuild the zip
  with `cd sketches && zip -r ../downloads/arduino-ladder-sketches.zip .`

If you change a lesson, please also check its **Check yourself** answer key still
agrees with it. Several of those answers depend on exact numbers in the sketches.

## About the sketches

All 26 were compiled for the ATmega328P (the chip on an Arduino Uno) before
publication, with zero warnings.

Two of them fail **on purpose**, because reading a failure is part of the lesson:

- `b3_03_toggle_buggy.ino` compiles and runs, and does the wrong thing
- `b5_03_blocking_problem.ino` compiles and runs, and misses button presses

And one fails to compile on purpose:

- `b0_03_buggy_semicolon.ino` — the learner is meant to read the error message

Every other sketch works. If one does not do what its header says, the problem
is the wiring, and the band page has a checklist for it.

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

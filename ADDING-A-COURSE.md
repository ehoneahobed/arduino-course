# Adding a course to IoT at Bozoma Innovation Hub

The site is a home for several courses. The Arduino Ladder is the first; ESP32 (Wi-Fi and IoT), Raspberry Pi
and Code for makers are planned. Every course lives in its own folder and shares the parts in `assets/`.

```
index.html          the site home: the course catalogue and the learning path
404.html            shared "page not found"
assets/             shared by every course
  course.css          BIH colours, type, layout, light and dark themes
  hub.css             the site home only
  theme.js            the light / dark switch
  pager.js            one section at a time, the section sidebar and drawer, progress ticks
  labs/               the 3D engine (three.js runtime, parts, the 3D Workshop thumbnails)
  brand/ fonts/ vendor/
arduino/            the Arduino Ladder (index, guide, labs.html, bands/, projects/, sketches/, downloads/)
tools/              the Arduino Ladder's build and checking scripts
```

## Steps

1. **Make the folder**, named for the board or topic in lower case: `esp32/`, `raspberry-pi/`, `code/`.
   Copy `arduino/index.html` and one band page as a starting point. Pages one level down use
   `../assets/…`; pages two levels down use `../../assets/…`.
2. **Keep the shared page parts.** In every page's `<head>`, straight after `<meta charset>`, load
   `assets/theme.js` (no `defer`, so there is no flash of the wrong theme), then `course.css`.
   Keep the top bar with the `← IoT at BIH` link (`class="hub"`) and the BIH footer.
3. **Give the course its own progress.** Put `data-course="esp32"` (the folder name) and `data-band="N"`
   (or the lesson number) on each lesson page's `<html>`. `pager.js` then keeps that course's ticks and
   "where you left off" separate from every other course. Lesson pages need the same structure as the
   Arduino bands: a `<nav aria-label="Sections">` with one link per `<section class="part" id="…">`,
   and `<script defer src="../../assets/pager.js"></script>`.
4. **List it on the site home.** In `index.html`, find the course card (it is marked "Planned"),
   turn the `<div class="course planned">` into `<a class="course open" href="esp32/index.html">`,
   change "Planned" to "Open now", add its facts, and update the learning path below it.
5. **3D labs (optional).** The engine in `assets/labs/` is shared. A new board needs its own models in
   `assets/labs/src/parts.js` or a new file next to it, registered in `main.js`, then
   `node tools/build_labs.mjs`. The Workshop page and its tools are currently Arduino-only
   (`arduino/labs.html`, `tools/labs_page.py`); a second course with labs should get its own
   `labs.html` in its folder.
6. **Offline.** Use relative links only (except in `404.html`), so the whole site still opens from a
   USB stick by double-clicking `index.html`.
7. **Old links.** If you ever move pages, add a permanent redirect in `vercel.json`, as was done when the
   Arduino Ladder moved from the site root into `arduino/`.

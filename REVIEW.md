# Beginner-Readiness Review — What Was Wrong and What Changed

*The Arduino Ladder · Bozoma Innovation Hub, Aiyinasi*

This records a full review of all six bands against one test: **could a fifteen-year-old
who has never seen a breadboard carry out this step, alone, with only the page and the
parts, and know for certain whether they got it right?**

Three independent audits were run over the finished pages and the twenty-six sketches.
They converged on the same root cause: **code steps had "You should see" boxes; physical
steps almost never did.** The learner could always tell whether their program worked and
almost never whether their wiring did.

---

## Errors of physical fact

These would have stopped a learner cold, and nothing on the page would have told them why.

**One hole, one leg.** Every build from Band 1 onward instructed the learner to put a
resistor leg and a jumper wire into the *same* breadboard hole. A hole takes one lead.
This was in all five build bands, in the pages, in ten sketch headers and in the README.
The pin wire now goes in a different row of the same column (`h3` rather than `j3`,
`b1` rather than `a1`), and the rule is now taught explicitly the first time it matters,
with the reason: a column of five holes is one connection underneath.

**Two wires in one Arduino pin, twice.** Band 5 Part 6 asked the learner to move a wire
into pin 9 while button 2's wire was still in it, then into pin 8 while button 1's was
still in it. The moves are now numbered, ordered so nothing is ever double-booked, and
the two sketch headers and the README agree with the page.

**An overflow claim off by a factor of twenty.** Band 4 said an `int` calculation goes
wrong "above about a reading of 130". A 16-bit `int` overflows at a reading of about 6.
A learner invited to "try it if you like" would have seen it break immediately and
concluded the page was wrong.

**Quoted lines that were not in the files.** Two instructions quoted `const int ledPin = 13;`
and `const int buttonPin = 2;`. The word `const` appears in none of the twenty-six sketches.
`b0_01_blink_given.ino` has no variable at all: it hard-codes `13` three times. The page
now says so, and shows the three lines.

**Band 1's Bronze task used pin 6**, which Part 7b of the same band needs empty for its
silent-bug demonstration. Moved to pin 12.

---

## Instructions a person alone could not carry out

**The rope activity** (Band 1) never said how to make a loop, what "pull" meant, or how
the pulling actually works with your hands. It now has a diagram, a materials list with
five substitutions, a marker so the motion is visible, the explicit hand-over-hand motion,
a solo version using a chair back, and a stated outcome at every step.

**Handling the parts** was assumed. Band 1 now teaches three skills with a diagram:
bending resistor legs into a staple, pushing a part in and knowing it seated, and taking
one out by the body rather than the leg.

**Seating a push button** was described as "columns 19 and 21". A button has four legs
and needs four holes, its body over the middle channel. Band 5 now names all four holes,
shows the diagonal pair in a diagram, and says how hard to press and what a seated button
looks like.

**Band 5's solo counting activity was impossible.** It asked for an alarm set to go off
"in about thirty seconds" (alarms are clock times), then to press a face-down phone's
screen, then to time the response with no timer. Rebuilt around a stopwatch and a signal
number the learner chooses, with its own version of the follow-up questions.

**Which button answers which light** was never established before the game asked the
learner to "press the matching button". Now a table, plus what to do if the parts ended
up in a different order.

**Clearing the previous build** was never mentioned. Each build band now opens with it,
and Band 5 names the potentiometer specifically, because it sits on A0 and the game's
random seeding needs A0 empty.

---

## Working with nobody to ask

Five of the six bands ended their troubleshooting with "post the photo" and had no
alternative, while naming no forum, group or address. Every band now carries a solo route:
save it, write it into the build log, sleep on it. "Look at two other people's sketches"
now has a solo equivalent that keeps the pedagogical point: read your own work cold the
next day and write down the one thing you would change.

Band 0 also gained: the CH340 driver on macOS and Linux, not just Windows (every
starter-kit board needs it, and the page previously blamed the cable); the IDE download
size and a USB-stick route for expensive data; TX and RX named so the L light can be told
apart from them; and a list of part substitutions in place of "report it now" to nobody.

Band 4's calibration exercise, which the band itself calls its most important part, asked
the learner to carry a laptop to five places and offered a power bank as the fallback. A
power bank runs the board and shows no readings at all. The page now says so and gives a
workable no-laptop method.

---

## How it was checked

Every sketch is compiled and linked for the ATmega328P at 16 MHz. Twenty-three compile
and run; `b0_03` fails to compile on purpose, and `b3_03` and `b5_03` compile and
misbehave on purpose. Link and anchor integrity across all nine pages is verified, as is
the absence of any external dependency beyond the two Google Fonts hosts, so the site
works from a USB stick.

Reading level across the six bands measures **grade 4.8** by Flesch-Kincaid over roughly
45,000 words, up from 17,700 words at the first rewrite. Bands 4 and 5 sit at 5.1 and 5.2,
which is where the hardest material lives.

---

## Where the course lives now

The single source of truth is the git repository: a static site with no build step and no
framework, ready for GitHub Pages or Vercel as it stands. The standalone band pages
published as artifacts before this review are superseded and should not be followed.

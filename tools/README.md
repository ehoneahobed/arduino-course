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

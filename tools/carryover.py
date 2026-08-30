"""
Carry-over checker for the Arduino Ladder.

The rail audit found nine defects and not one of them was inside a
hole-by-hole wiring list. Every one sat at a SEAM: a page tells the learner
to clear the board, and a later page assumes something survived. Or a page
authorises a branch, and the branch skips the step that held the feed.

Hole collisions are checked by holecheck.py. This file checks the joins.

Two checks:

  A. RAIL FEED.  A rail is dead metal until a wire feeds it. Any page that
     tells a learner to connect something to a rail must, on that same page,
     either name the feed wire (GND to a minus rail, 5V or a battery to a
     plus rail) or say in words that an earlier feed stays in place. It must
     also say WHICH of the two strips it means, because the top pair and the
     bottom pair are not joined. This is decidable, so it is reported as
     PASS or FAIL.

  B. CARRY-OVER EDGES.  Every reference to an earlier build ("Band 3 Part 9
     has it", "you moved it there in Part 6", "already wired") is paired with
     every board-clearing instruction that sits between the thing referenced
     and the reference itself, in reading order. Position is (page, line), so
     a clear in Part 3 and an assumption in Part 10 of the SAME page is
     caught, which is how the Band 8 servo defect got in.

     This one is a worklist, not a verdict. It cannot know whether a given
     clear removed the specific thing a given reference needs. It exists to
     put a human in front of the small number of places where it could have.
"""
import io, re, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "projects"))

# ---- reading order --------------------------------------------------------

def reading_order():
    """Bands 0 to 8, each followed by the project pages that hang off it.
    Pages with no band (Invent, Ship, Identify) are read last: they are
    reference pages, not steps in the ladder."""
    try:
        import meta
        projects = meta.PROJECTS
    except Exception:
        projects = []
    order = []
    for band in range(0, 9):
        pack = {0: "pack2", 1: "pack2", 2: "pack2", 3: "pack3", 4: "pack3",
                5: "pack3", 6: "pack4", 7: "pack4", 8: "pack4"}[band]
        p = os.path.join(HERE, pack, "band%d.body.html" % band)
        if os.path.exists(p):
            order.append(("Band %d" % band, p))
        for pr in projects:
            if pr.get("band") == band:
                order.append((pr["slug"], os.path.join(HERE, "projects",
                                                       pr["slug"] + ".body.html")))
    for pr in projects:
        if pr.get("band") is None:
            order.append((pr["slug"], os.path.join(HERE, "projects",
                                                   pr["slug"] + ".body.html")))
    return [(n, p) for n, p in order if os.path.exists(p)]


def lines_of(path):
    raw = io.open(path, encoding="utf-8").read().split("\n")
    out = []
    for i, ln in enumerate(raw, 1):
        t = re.sub(r"<[^>]+>", " ", ln)
        t = (t.replace("&#8722;", "-").replace("&mdash;", " - ")
               .replace("&#8220;", '"').replace("&#8221;", '"')
               .replace("&#8217;", "'").replace("&nbsp;", " "))
        t = re.sub(r"&[a-z#0-9]+;", " ", t)
        out.append((i, re.sub(r"\s+", " ", t).strip(), ln))
    return out


# ---- check A: rail feed ---------------------------------------------------

# an INSTRUCTION to connect something to a rail, as opposed to a mention of one
CONNECT = re.compile(
    r"((to|into|onto|reaches|joins?) the [-+] rail"
    r"|(to|into|onto) (a |an |the )?[-+] rail"
    r"|[-+] rail\b[^.]{0,10}\b(instead of|rather than)"
    r"|\b(wire|leg|wires?)\b[^.]{0,30}\b[-+] rail)", re.I)
NAMES_FEED_MINUS = re.compile(
    r"((-|that same|that|the) rail to (a |an |the )?[^.]{0,24}GND"
    r"|GND[^.]{0,14} to the (-|that same) rail"
    r"|from (a |an |the )?GND pin to the - rail"
    r"|black( wire)? to the - rail"
    r"|wire the - rail to[^.]{0,12}GND)", re.I)
NAMES_FEED_PLUS = re.compile(
    r"(\+ rail to[^.]{0,24}5V"
    r"|5V[^.]{0,14} to the \+ rail"
    r"|red( wire)? to the \+ rail"
    r"|wire the \+ rail to[^.]{0,12}5V"
    r"|power the rails)", re.I)
NAMES_STRIP = re.compile(
    r"(top (edge|pair|- rail|\+ rail|rails)|bottom (edge|pair|- rail|\+ rail|rails)"
    r"|nearest row [`<]?[ja]|along the (top|bottom) edge)", re.I)
SAYS_CARRIES = re.compile(
    r"(stays? (in place|where|exactly)|leave .{0,40}(in place|where it is|alone)"
    r"|do not move|already (there|in place|wired)|if it is not already there"
    r"|except the two that power the rails)", re.I)


def check_rails(name, path):
    txt = lines_of(path)
    whole = " ".join(t for _, t, _ in txt)
    # A page that merely EXPLAINS that a board has two + rails is not asking
    # anyone to connect anything to one. Only an instruction counts.
    uses_minus = CONNECT.search(whole.replace("+ rail", "@"))
    uses_plus = CONNECT.search(whole.replace("- rail", "@"))
    if not (uses_minus or uses_plus):
        return []
    problems = []
    if uses_minus and not (NAMES_FEED_MINUS.search(whole) or SAYS_CARRIES.search(whole)):
        problems.append("uses a - rail; no GND feed named and no statement that an earlier feed stays")
    if uses_plus and not (NAMES_FEED_PLUS.search(whole) or SAYS_CARRIES.search(whole)):
        problems.append("uses a + rail; no 5V or battery feed named and no statement that an earlier feed stays")
    if (uses_minus or uses_plus) and not NAMES_STRIP.search(whole):
        problems.append("never says WHICH of the two rail pairs it means")
    return problems


# ---- check B: carry-over edges --------------------------------------------

CLEAR = re.compile(
    r"(take (everything|it all|the whole|all)[^.]{0,60}off"
    r"|clear[^.]{0,50}\b(off|board)"
    r"|off the (board|breadboard)[^.]{0,30}"
    r"|comes? off\b"
    r"|out of the (board|breadboard|Arduino header|header)"
    r"|start(ing)? from an empty board"
    r"|columns? \d+ to \d+ are bare"
    r"|strip[^.]{0,30}bare)", re.I)

REF = re.compile(
    r"(Band (\d) Part (\d+)"
    r"|Part (\d+) (?:has it|already|made you)"
    r"|you moved it there in Part (\d+)"
    r"|already (?:wired|there|in place|built)"
    r"|still (?:in place|there|standing)"
    r"|as you did (?:for|in) )", re.I)


def scan(name, path, band_index):
    """Line order is not enough. A "Before you start: clear the board" box
    governs its whole Part, so a sentence at the TOP of Part 6 saying "your
    button is already wired" is downstream of a clear box three lines below
    it. Band 3 lost its button to exactly that, so parts are tracked and a
    clear applies to every reference in the same part, in either direction."""
    clears, refs = [], []
    part = 0
    for i, t, raw in lines_of(path):
        if 'class="part"' in raw or 'class="parthead"' in raw:
            part += 1
        if not t:
            continue
        for m in CLEAR.finditer(t):
            clears.append((i, part, snippet(t, m.start())))
        for m in REF.finditer(t):
            tgt = None
            if m.group(2):
                tgt = int(m.group(2))          # Band N Part M -> band N
            refs.append((i, part, snippet(t, m.start()), tgt))
    return clears, refs


def snippet(t, at, w=96):
    a = max(0, at - 18)
    return ("..." if a else "") + t[a:a + w] + ("..." if a + w < len(t) else "")


def main():
    order = reading_order()
    pos = {n: k for k, (n, _) in enumerate(order)}
    band_of = {}
    for k, (n, _) in enumerate(order):
        m = re.match(r"Band (\d)", n)
        if m:
            band_of[int(m.group(1))] = k

    print("=" * 74)
    print("A. RAIL FEED")
    print("=" * 74)
    fails = 0
    for n, p in order:
        probs = check_rails(n, p)
        if probs:
            fails += 1
            print("FAIL %s" % n)
            for x in probs:
                print("       %s" % x)
    if not fails:
        print("PASS  every page that touches a rail names its feed and its strip")
    print()

    print("=" * 74)
    print("B. CARRY-OVER EDGES  (a worklist, not a verdict)")
    print("=" * 74)
    allc = []                       # (page_index, line, part, name, text)
    allr = []
    for k, (n, p) in enumerate(order):
        c, r = scan(n, p, k)
        allc += [(k, i, pt, n, s) for i, pt, s in c]
        allr += [(k, i, pt, n, s, t) for i, pt, s, t in r]

    reviewed = set()
    rpath = os.path.join(HERE, "carryover-reviewed.txt")
    if os.path.exists(rpath):
        for ln in io.open(rpath, encoding="utf-8"):
            ln = ln.split("#")[0].strip()
            if ln:
                reviewed.add(ln)

    edges = skipped = 0
    for pk, pi, ppt, pn, ps, tgt in allr:
        # where does the thing being referenced live?
        src = band_of.get(tgt, None) if tgt is not None else None
        lo = src if src is not None else pk        # vague refs: same page only
        between = []
        for ck, ci, cpt, cn, cs in allc:
            if not (ck > lo or (ck == lo and src is None)):
                continue
            earlier = ck < pk or (ck == pk and ci < pi)
            same_part = ck == pk and cpt == ppt     # a clear box governs its part
            if earlier or same_part:
                between.append((ck, ci, cn, cs))
        if not between:
            continue
        if "%s:%d" % (pn, pi) in reviewed:
            skipped += 1
            continue
        edges += 1
        print("- %s:%d  assumes: %s" % (pn, pi, ps))
        for ck, ci, cn, cs in between[-3:]:
            print("        cleared at %s:%d  %s" % (cn, ci, cs))
    print()
    if not edges:
        print("PASS  no unreviewed carry-over edges")
    print()
    print("%d rail failures, %d NEW carry-over edges, %d already reviewed"
          % (fails, edges, skipped))


if __name__ == "__main__":
    main()

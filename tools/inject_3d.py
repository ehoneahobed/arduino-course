"""
Put a "View in 3D" button beside every wiring diagram, and the 3D viewer's
two tags in each page's <head>.

    python3 tools/inject_3d.py                 every page in bands/ and projects/
    python3 tools/inject_3d.py --check         change nothing, report what it would do
    python3 tools/inject_3d.py --undo          take it all out again
    python3 tools/inject_3d.py --root DIR      work on a copy of the site in DIR

Each <figure class="wiring"> is matched to its build by the SVG's aria-label,
which is the build's title in tools/diagrams.py (the same title is in
assets/labs/src/builds.json). A label that matches no build, or two builds,
stops the run before anything is written, because a 3D view of the wrong
build is worse than none.

What it writes, per figure:

    <figure class="wiring" data-build="b1p5">
      <p class="view3d" hidden><button type="button" class="view3d-btn"
         data-build="b1p5" aria-pressed="false" hidden>View in 3D</button></p>
      <svg ...>            (the flat diagram, untouched, still the default)

and, once per page, before </head>:

    <link rel="stylesheet" href="../assets/labs/labs.css">
    <script defer src="../assets/labs/labs.js"></script>

Without JavaScript the button stays hidden and the page is exactly as before.
labs.js is a 2 KB loader; the 3D bundle is fetched only when someone presses
the button. Running it twice changes nothing the second time.
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = ('  <link rel="stylesheet" href="{up}assets/labs/labs.css">\n'
        '  <script defer src="{up}assets/labs/labs.js"></script>\n')
HEAD_RE = re.compile(r'[ \t]*<link rel="stylesheet" href="[^"]*assets/labs/labs\.css">\n'
                     r'[ \t]*<script defer src="[^"]*assets/labs/labs(?:\.bundle)?\.js"></script>\n')
BTN = ('\n      <p class="view3d" hidden><button type="button" class="view3d-btn" '
       'data-build="{name}" aria-pressed="false" hidden>View in 3D</button></p>')
BTN_RE = re.compile(r'\n[ \t]*<p class="view3d" hidden><button[^>]*class="view3d-btn"[^>]*>View in 3D</button></p>')
FIG_RE = re.compile(r'<figure class="wiring"(?: data-build="[^"]*")?>')
LABEL_RE = re.compile(r'<svg[^>]*aria-label="([^"]*)"')


def titles():
    path = os.path.join(HERE, "..", "assets", "labs", "src", "builds.json")
    data = json.load(io.open(path, encoding="utf-8"))
    by = {}
    for name, b in data["builds"].items():
        by.setdefault(b["title"], []).append(name)
    return by


def strip(s):
    s = HEAD_RE.sub("", s)
    s = BTN_RE.sub("", s)
    s = re.sub(r'<figure class="wiring" data-build="[^"]*">', '<figure class="wiring">', s)
    return s


def process(path, rel, by, undo):
    s0 = io.open(path, encoding="utf-8").read()
    s = strip(s0)
    if undo:
        return s0, s, []
    up = "../" * rel.count("/")
    out = []
    pos = 0
    names = []
    for m in FIG_RE.finditer(s):
        lab = LABEL_RE.search(s, m.end(), m.end() + 600)
        if not lab:
            raise SystemExit("NO SVG     %s: a wiring figure without an <svg aria-label> right after it" % rel)
        title = lab.group(1).replace("&amp;", "&")
        found = by.get(title, [])
        if len(found) != 1:
            raise SystemExit("NO MATCH   %s: %r matches %d builds (%s)" % (rel, title, len(found), found))
        name = found[0]
        names.append(name)
        out.append(s[pos:m.start()])
        out.append('<figure class="wiring" data-build="%s">' % name)
        out.append(BTN.format(name=name))
        pos = m.end()
    out.append(s[pos:])
    s = "".join(out)
    if names:
        if "</head>" not in s:
            raise SystemExit("NO HEAD    %s" % rel)
        s = s.replace("</head>", HEAD.format(up=up) + "</head>", 1)
    return s0, s, names


def main(argv):
    root = os.path.normpath(os.path.join(HERE, ".."))
    if "--root" in argv:
        root = os.path.abspath(argv[argv.index("--root") + 1])
    check = "--check" in argv
    undo = "--undo" in argv
    by = titles()
    pages = []
    for d in ("bands", "projects"):
        folder = os.path.join(root, d)
        if os.path.isdir(folder):
            pages += [d + "/" + f for f in sorted(os.listdir(folder)) if f.endswith(".html")]
    if not pages:
        raise SystemExit("no pages found under %s (expected bands/ and projects/)" % root)
    # read and plan everything first, so a bad match writes nothing at all
    plans = [(rel,) + process(os.path.join(root, rel), rel, by, undo) for rel in pages]
    used = {}
    changed = 0
    for rel, before, after, names in plans:
        for n in names:
            used.setdefault(n, []).append(rel)
        if after != before:
            changed += 1
            if not check:
                io.open(os.path.join(root, rel), "w", encoding="utf-8").write(after)
        if names or after != before:
            print("%-8s %-40s %s" % ("same" if after == before else ("would" if check else "wrote"),
                                     rel, " ".join(names) if names else "(removed)"))
    all_builds = {n for v in by.values() for n in v}
    if not undo:
        missing = sorted(all_builds - set(used))
        twice = sorted(n for n, v in used.items() if len(v) > 1)
        print("\n%d figures on %d pages, %d of %d builds placed; %d page(s) %s"
              % (sum(len(p[3]) for p in plans), sum(1 for p in plans if p[3]), len(used),
                 len(all_builds), changed, "would change" if check else "changed"))
        if missing:
            print("builds with no figure on any page: %s" % ", ".join(missing))
        if twice:
            print("builds shown on more than one page (fine): %s" % ", ".join(twice))
    else:
        print("\n%d page(s) %s" % (changed, "would change" if check else "cleaned"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

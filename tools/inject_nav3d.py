"""
Put a "3D lab" pill in each band page's section bar, straight after the link
to the section the lab sits in (so the bar keeps the order of the lesson), pointing at
the band's concept lab ("Try it in 3D: ..."), and give that heading the id
the pill links to.

    python3 tools/inject_nav3d.py           every page in bands/
    python3 tools/inject_nav3d.py --check   change nothing, report what it would do
    python3 tools/inject_nav3d.py --undo    take it all out again

What it writes, per band page:

    <nav aria-label="Sections">
      ...
      <a href="#what">What is it</a>
      <a class="nav-3d" href="#try-3d">3D lab</a>
      ...
    <h3 id="try-3d" ...>Try it in 3D: ...</h3>

Without JavaScript the pill is a plain link to the lab's section. With it,
assets/labs/labs.js turns it into a small menu of every 3D view on the page
(the concept lab and each "View in 3D" build), plus a link to labs.html.
Running it twice changes nothing the second time.
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "arduino")
PILL = '  <a class="nav-3d" href="#try-3d">3D lab</a>\n'
PILL_RE = re.compile(r'[ \t]*<a class="nav-3d"[^>]*>.*?</a>\n')
NAV_RE = re.compile(r'(<nav aria-label="Sections">\n)')
H3_RE = re.compile(r'<h3((?:(?! id=)[^>])*)>(Try it in 3D:)')
H3_ID_RE = re.compile(r'<h3 id="try-3d"([^>]*)>(Try it in 3D:)')


def process(s, undo):
    s = PILL_RE.sub("", s)
    s = H3_ID_RE.sub(r'<h3\1>\2', s)
    if undo:
        return s
    if not H3_RE.search(s) or not NAV_RE.search(s):
        return None
    s = H3_RE.sub(r'<h3 id="try-3d"\1>\2', s, count=1)
    # The section that holds the lab is the last one opened before its heading.
    ids = re.findall(r'<section[^>]*\bid="([^"]+)"', s[:s.index('id="try-3d"')])
    link = re.compile(r'([ \t]*<a href="#%s">[^<]*</a>\n)' % re.escape(ids[-1])) if ids else None
    if link and link.search(s):
        return link.sub(lambda m: m.group(1) + PILL, s, count=1)
    return NAV_RE.sub(lambda m: m.group(1) + PILL, s, count=1)


def main():
    check = "--check" in sys.argv
    undo = "--undo" in sys.argv
    changed = 0
    folder = os.path.join(ROOT, "bands")
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".html"):
            continue
        path = os.path.join(folder, name)
        s0 = io.open(path, encoding="utf-8").read()
        s = process(s0, undo)
        if s is None:
            print("SKIP      bands/%s: no section bar or no 'Try it in 3D' heading" % name)
            continue
        if s != s0:
            changed += 1
            print(("WOULD FIX " if check else "FIXED     ") + "bands/" + name)
            if not check:
                io.open(path, "w", encoding="utf-8").write(s)
    print("%d page(s) %s" % (changed, "to change" if check else "changed"))


if __name__ == "__main__":
    main()

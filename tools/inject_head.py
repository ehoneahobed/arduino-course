#!/usr/bin/env python3
"""Adds the app and link-preview tags to the <head> of every page. Safe to run again:
it replaces its own block (between the two "app + link previews" comments) and changes
nothing else.

    python3 tools/inject_head.py           update every page
    python3 tools/inject_head.py --check   exit 1 if a page is out of date (changes nothing)

The block holds:
  - <link rel="manifest"> (the installable app) and <script defer src="assets/app.js">
    (offline saving, the update note, the install hint);
  - Open Graph and Twitter tags for WhatsApp, Facebook and X: og:title from <title>,
    og:description from <meta name="description">, og:url from <link rel="canonical">,
    og:image = assets/og/<page path with / as ->.jpg (made by node tools/og.mjs).
Pages with no canonical link (404.html, offline.html) get only the manifest and script,
with root-absolute paths because the server shows them at any address.
tools/labs_page.py calls apply() so the generated 3D Workshop keeps its tags.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://iot.bozomainnovationhub.com"
SITE_NAME = "IoT at Bozoma Innovation Hub"
START = "<!-- app + link previews (tools/inject_head.py) -->"
END = "<!-- /app + link previews -->"
BLOCK_RE = re.compile(r"[ \t]*" + re.escape(START) + r".*?" + re.escape(END) + r"\n?", re.S)
ANCHOR_RE = re.compile(r'^([ \t]*)<link rel="apple-touch-icon"[^>]*>\n', re.M)
# The site home shows the small "Install this course" note; other pages offer it in their panel only.
INSTALL_CHIP = {"index.html"}


def pages():
    out = []
    for d, dirs, files in os.walk(ROOT):
        rel_d = os.path.relpath(d, ROOT)
        dirs[:] = sorted(x for x in dirs if not x.startswith(".") and not (rel_d == "." and x in ("tools", "node_modules", "assets")))
        for f in sorted(files):
            if f.endswith(".html"):
                out.append(os.path.normpath(os.path.join(rel_d, f)).replace(os.sep, "/"))
    return out


def og_name(rel):
    """arduino/bands/band-3.html -> arduino-bands-band-3 (assets/og/arduino-bands-band-3.jpg)."""
    return rel[:-5].replace("/", "-")


def find(pattern, html):
    m = re.search(pattern, html, re.S)
    return m.group(1).strip() if m else None


def block(html, rel, indent="  "):
    canonical = find(r'<link rel="canonical" href="([^"]+)"', html)
    up = "/" if not canonical else "../" * rel.count("/")
    chip = ' data-install="chip"' if rel in INSTALL_CHIP else ""
    lines = [START, '<link rel="manifest" href="%smanifest.webmanifest">' % up]
    if canonical:
        title = find(r"<title>(.*?)</title>", html)
        desc = find(r'<meta name="description" content="([^"]*)"', html)
        if not title or not desc:
            raise SystemExit("%s: needs a <title> and a <meta name=\"description\">" % rel)
        title = re.sub(r"\s+", " ", title).replace('"', "&quot;")
        image = "%s/assets/og/%s.jpg" % (SITE, og_name(rel))
        lines += [
            '<meta property="og:type" content="website">',
            '<meta property="og:site_name" content="%s">' % SITE_NAME,
            '<meta property="og:title" content="%s">' % title,
            '<meta property="og:description" content="%s">' % desc,
            '<meta property="og:url" content="%s">' % canonical,
            '<meta property="og:image" content="%s">' % image,
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta property="og:image:alt" content="%s">' % title,
            '<meta property="og:locale" content="en_GB">',
            '<meta name="twitter:card" content="summary_large_image">',
        ]
    lines += ['<script defer src="%sassets/app.js"%s></script>' % (up, chip), END]
    return "".join(indent + l + "\n" for l in lines)


def apply(html, rel):
    """Return the page with an up-to-date block (rel is the path from the site root)."""
    html = BLOCK_RE.sub("", html)
    m = ANCHOR_RE.search(html)
    if not m:
        raise SystemExit('%s: no <link rel="apple-touch-icon"> to put the block after' % rel)
    return html[: m.end()] + block(html, rel, m.group(1)) + html[m.end():]


def main():
    check = "--check" in sys.argv
    stale, missing = [], []
    for rel in pages():
        path = os.path.join(ROOT, rel)
        cur = io.open(path, encoding="utf-8").read()
        new = apply(cur, rel)
        if 'rel="canonical"' in new and not os.path.exists(os.path.join(ROOT, "assets", "og", og_name(rel) + ".jpg")):
            missing.append(og_name(rel) + ".jpg")
        if new != cur:
            stale.append(rel)
            if not check:
                io.open(path, "w", encoding="utf-8", newline="\n").write(new)
    if missing:
        print("No preview image yet for: %s (run node tools/og.mjs)" % ", ".join(missing))
    if check:
        print("%d page(s) out of date: %s" % (len(stale), ", ".join(stale)) if stale else "Every page's head is up to date")
        sys.exit(1 if stale or missing else 0)
    print("Updated %d of %d pages" % (len(stale), len(pages())))


if __name__ == "__main__":
    main()

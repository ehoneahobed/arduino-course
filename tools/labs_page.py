"""
Write labs.html, the 3D Workshop: every concept lab and every 3D build in the
course on one page, grouped by band, each opening full size.

    python3 tools/labs_page.py           write labs.html
    python3 tools/labs_page.py --check   say whether labs.html is up to date

It reads the builds from assets/labs/src/builds.json, finds which page shows
each one (the "View in 3D" buttons in bands/ and projects/), takes each
band's concept lab from its "Try it in 3D" heading, and counts the lab's
missions in assets/labs/src/concept-bN.js. Thumbnails are
assets/labs/thumbs/<id>.webp, made by `node tools/lab_thumbs.mjs`; a missing
one shows a drawn placeholder instead.

labs.html?open=<id> (concept-b0 … concept-b8, or a build such as b1p5) is the
viewer: the lab fills the window, with "previous" and "next". Rerun this
after adding a build, a band page figure or a concept lab.
"""
import html, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "arduino"))
OUT = os.path.join(ROOT, "labs.html")
COLOURS = ["Black", "Brown", "Red", "Orange", "Yellow", "Green", "Blue", "Violet", "Grey"]


SITE = os.path.normpath(os.path.join(ROOT, ".."))   # shared assets/ live at the site root


def read(p):
    base = SITE if p.startswith("assets/") else ROOT
    return io.open(os.path.join(base, p), encoding="utf-8").read()


def plain(s):
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def cap(s):
    return s[:1].upper() + s[1:]


def page_title(src):
    m = re.search(r"<title>([^<]*)</title>", src)
    return plain(m.group(1)).split(" · ")[0] if m else ""


def catalog():
    data = json.loads(read("assets/labs/src/builds.json"))["builds"]
    pages = []
    for folder in ("bands", "projects"):
        for name in sorted(os.listdir(os.path.join(ROOT, folder)), key=lambda n: (len(n), n)):
            if name.endswith(".html"):
                pages.append(folder + "/" + name)
    where = {}  # build -> first page that shows it
    for p in pages:
        for b in re.findall(r'class="view3d-btn" data-build="([^"]+)"', read(p)):
            where.setdefault(b, p)
    bands = []
    for n in range(9):
        p = "bands/band-%d.html" % n
        src = read(p)
        h1 = re.search(r"<h1[^>]*>([^<]*)</h1>", src)
        h3 = re.search(r'<h3[^>]*>Try it in 3D:\s*(.*?)</h3>', src, re.S)
        lab = re.search(r'<div class="lab"[^>]*data-lab="(concept-b\d)"[^>]*aria-label="([^"]*)"', src)
        intro = ""
        if h3:
            m = re.search(r"<p>(.*?)</p>", src[h3.end():h3.end() + 3000], re.S)
            intro = plain(m.group(1)) if m else ""
            # keep it short: up to two sentences
            parts = [x for x in re.split(r"(?<=[.!?])\s+", intro) if not x.startswith("If ")]
            intro = " ".join(parts[:2])
        missions = 0
        if lab:
            js = read("assets/labs/src/%s.js" % lab.group(1))
            m = re.search(r"export const missions = \[(.*?)\n\];", js, re.S)
            missions = len(re.findall(r"\{\s*id:", m.group(1))) if m else 0
        bands.append({
            "n": n, "name": plain(h1.group(1)) if h1 else "Band %d" % n, "colour": COLOURS[n], "page": p,
            "lab": {
                "id": lab.group(1), "title": cap(plain(h3.group(1))) if h3 else "The concept lab",
                "about": intro, "aria": plain(lab.group(2)).replace("3D lab: ", ""), "missions": missions,
                "lesson": p + "#try-3d",
            } if lab else None,
            "builds": [],
        })
    bench = {"n": "bench", "name": "Bench pages and practice", "colour": "", "page": "", "lab": None, "builds": []}
    for name, b in data.items():
        title = b.get("title", name)
        p = where.get(name, "")
        m = re.match(r"Band (\d) (Part [^:]+): (.*)$", title)
        if m:
            band, kind, t = int(m.group(1)), m.group(2), cap(m.group(3))
        elif title.startswith("Bench: "):
            band, kind, t = None, "Bench", cap(title[7:])
        else:
            pm = re.match(r"projects/b(\d)-", p)
            band, kind, t = (int(pm.group(1)) if pm else None), "Swap", cap(title)
        if band is None and p.startswith("bands/"):
            band = int(re.search(r"band-(\d)", p).group(1))
        src = read(p) if p else ""
        item = {"id": name, "kind": kind, "title": t, "full": title, "lesson": (p + "#3d-" + name) if p else "", "page": page_title(src) if src else ""}
        (bands[band]["builds"] if band is not None else bench["builds"]).append(item)
    # builds in the order their page shows them, then the rest
    for g in bands + [bench]:
        def order(it):
            if not it["lesson"]:
                return (2, 0, it["id"])
            p = it["lesson"].split("#")[0]
            src = read(p)
            i = src.find('data-build="%s"' % it["id"])
            return (0 if p.startswith("bands/") else 1, p, i)
        g["builds"].sort(key=order)
    return bands + [bench]


ICON_CUBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/></svg>'
ICON_TARGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></svg>'
ICON_GRID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h.01M11 8h.01M15 8h.01M19 8h.01M7 12h.01M11 12h.01M15 12h.01M19 12h.01M7 16h.01M11 16h.01M15 16h.01M19 16h.01"/></svg>'
ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
ICON_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'


def e(s):
    return html.escape(s, quote=True)


def thumb(id_):
    return '<span class="ws-thumb"><img src="../assets/labs/thumbs/%s.webp" alt="" loading="lazy" decoding="async" width="400" height="250" onerror="this.remove()"></span>' % id_


def render(groups):
    total_labs = sum(1 for g in groups if g["lab"])
    total_builds = sum(len(g["builds"]) for g in groups)
    flat = []
    rail, body = [], []
    for g in groups:
        gid = "band-%s" % g["n"]
        is_band = g["n"] != "bench"
        count = (1 if g["lab"] else 0) + len(g["builds"])
        style = ' style="--bc:var(--b%s)"' % g["n"] if is_band else ""
        label = "%s · %s" % (g["colour"], g["name"]) if is_band else g["name"]
        rail.append('<a href="#%s"%s><span class="ws-chip">%s</span><span class="ws-rail-name">%s</span><span class="ws-count">%d</span></a>' % (gid, style, g["n"] if is_band else "+", e(g["name"]), count))
        cards = []
        if g["lab"]:
            L = g["lab"]
            flat.append({"id": L["id"], "title": L["title"], "band": g["n"], "kind": "Concept lab", "lesson": L["lesson"]})
            q = " ".join([L["title"], L["aria"], L["about"], g["name"], "band %s" % g["n"], "concept lab missions"]).lower()
            cards.append(
                '<div class="ws-item ws-concept" data-q="%s">'
                '<a class="ws-card" href="labs.html?open=%s">%s<span class="ws-meta"><span class="ws-kind">%s Concept lab%s</span><b>%s</b><small>%s</small></span><span class="ws-go" aria-hidden="true">Open %s</span></a>'
                '<a class="ws-lesson" href="%s">%s In the lesson</a></div>' % (
                    e(q), L["id"], thumb(L["id"]), ICON_TARGET, (" · %d missions" % L["missions"]) if L["missions"] else "",
                    e(L["title"]), e(L["about"] or L["aria"]), ICON_CUBE, e(L["lesson"]), ICON_OUT))
        for b in g["builds"]:
            flat.append({"id": b["id"], "title": b["title"], "band": g["n"], "kind": b["kind"], "lesson": b["lesson"]})
            q = " ".join([b["full"], b["page"], g["name"], "band %s" % g["n"], b["kind"]]).lower()
            sub = b["page"] if b["page"] and b["kind"] in ("Swap", "Bench") else ("Band %s · %s" % (g["n"], g["name"]) if is_band else b["page"])
            cards.append(
                '<div class="ws-item" data-q="%s">'
                '<a class="ws-card" href="labs.html?open=%s">%s<span class="ws-meta"><span class="ws-kind">%s %s</span><b>%s</b><small>%s</small></span><span class="ws-go" aria-hidden="true">Open %s</span></a>'
                '%s</div>' % (
                    e(q), b["id"], thumb(b["id"]), ICON_GRID, e(b["kind"]), e(b["title"]), e(sub), ICON_CUBE,
                    ('<a class="ws-lesson" href="%s">%s In the lesson</a>' % (e(b["lesson"]), ICON_OUT)) if b["lesson"] else ""))
        page_link = ' <a class="ws-bandlink" href="%s">Open Band %s %s</a>' % (g["page"], g["n"], ICON_OUT) if is_band else ""
        body.append('<section class="ws-band" id="%s"%s><h2><span class="ws-chip">%s</span><span>%s</span>%s</h2><div class="ws-grid">%s</div></section>' % (
            gid, style, g["n"] if is_band else "+", e(label), page_link, "".join(cards)))
    return TEMPLATE.replace("@@RAIL@@", "\n".join(rail)).replace("@@BODY@@", "\n".join(body)).replace(
        "@@CATALOG@@", json.dumps(flat, ensure_ascii=False).replace("</", "<\\/")).replace(
        "@@NLABS@@", str(total_labs)).replace("@@NBUILDS@@", str(total_builds)).replace("@@SEARCH@@", ICON_SEARCH).replace("@@CUBE@@", ICON_CUBE)


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="../assets/theme.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="canonical" href="https://iot.bozomainnovationhub.com/arduino/labs">
  <title>3D Workshop · Arduino Ladder</title>
  <meta name="description" content="Every 3D lab in the Arduino Ladder: nine concept labs with missions, and every wiring build from the lessons, to turn, zoom and explore full screen. Works offline.">
  <meta name="theme-color" content="#24182E">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/brand/icon-192.png">
  <link rel="apple-touch-icon" href="../assets/brand/icon-180.png">
  <link rel="stylesheet" href="../assets/course.css">
  <link rel="stylesheet" href="../assets/labs/labs.css">
  <script defer src="../assets/labs/labs.js"></script>
  <script defer src="../assets/progress.js"></script>
  <!-- Made by tools/labs_page.py: edit that, not this file. -->
  <style>
    body.ws { padding: 0; display: block; min-height: 100vh; }
    .ws-top { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: .8rem 1.4rem; flex-wrap: wrap; padding: .65rem 1.25rem; background: var(--plum); color: #fff; }
    .ws-brand { display: flex; align-items: center; gap: .65rem; color: #fff; text-decoration: none; }
    .ws-brand img { width: 34px; height: 34px; }
    .ws-brand b { display: block; font: 600 1.05rem/1.1 var(--display); }
    .ws-brand small { display: block; font-size: .74rem; opacity: .75; }
    .ws-search { flex: 1 1 260px; max-width: 520px; display: flex; align-items: center; gap: .5rem; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); border-radius: 12px; padding: 0 .8rem; }
    .ws-search:focus-within { background: rgba(255,255,255,.16); border-color: var(--gold); }
    .ws-search svg { width: 18px; height: 18px; flex: none; opacity: .8; }
    .ws-search input { flex: 1; min-width: 0; font: inherit; font-size: .95rem; color: #fff; background: none; border: 0; padding: .55rem 0; outline: none; }
    .ws-search input::placeholder { color: rgba(255,255,255,.65); }
    .ws-toplinks { margin-left: auto; display: flex; gap: .3rem; }
    .ws-toplinks a { color: #fff; text-decoration: none; font: 500 .85rem/1 var(--display); padding: .5rem .75rem; border-radius: 9px; border: 1px solid rgba(255,255,255,.18); }
    .ws-toplinks a:hover { background: rgba(255,255,255,.12); }
    .ws-wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 0; max-width: 1560px; margin: 0 auto; }
    .ws-rail { position: sticky; top: 60px; align-self: start; height: calc(100vh - 60px); overflow: auto; padding: 1.4rem .9rem 2rem 1.25rem; border-right: 1px solid var(--line); }
    .ws-rail h2 { font: 700 .7rem/1.2 var(--text); text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin: 0 0 .7rem .4rem; }
    .ws-rail a { display: flex; align-items: center; gap: .6rem; padding: .42rem .5rem; border-radius: 10px; color: var(--ink); text-decoration: none; font-size: .9rem; line-height: 1.25; }
    .ws-rail a:hover, .ws-rail a.on { background: var(--surface-2); }
    .ws-rail-name { flex: 1; }
    .ws-count { font: 600 .72rem/1 var(--text); color: var(--muted); }
    .ws-chip { flex: none; display: inline-grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 8px; background: var(--bc, var(--plum-soft)); color: #fff; font: 700 .82rem/1 var(--display); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
    .ws-main { padding: 1.6rem 1.5rem 4rem; min-width: 0; }
    .ws-hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem 2rem; margin-bottom: 1.6rem; }
    .ws-hero h1 { font-size: clamp(1.7rem, 1.2rem + 2vw, 2.5rem); }
    .ws-hero p { color: var(--ink-2); max-width: 62ch; margin-top: .5rem; }
    .ws-stats { display: flex; gap: .6rem; flex-wrap: wrap; }
    .ws-stats span { font: 600 .85rem/1 var(--display); padding: .55rem .8rem; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }
    .ws-stats b { font-size: 1.1rem; margin-right: .25rem; }
    .ws-band { margin: 0 0 2.4rem; scroll-margin-top: 76px; }
    .ws-band h2 { display: flex; align-items: center; gap: .7rem; font-size: 1.2rem; margin: 0 0 .9rem; padding-bottom: .6rem; border-bottom: 1px solid var(--line); }
    .ws-band h2 .ws-chip { width: 2rem; height: 2rem; font-size: .95rem; }
    .ws-bandlink { margin-left: auto; display: inline-flex; align-items: center; gap: .35rem; font: 500 .82rem/1 var(--display); color: var(--accent-ink); text-decoration: none; }
    .ws-bandlink svg { width: 14px; height: 14px; }
    .ws-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .ws-item { position: relative; display: flex; flex-direction: column; min-width: 0; }
    .ws-item[hidden] { display: none; }
    .ws-concept { grid-column: 1 / -1; }
    .ws-concept .ws-card { flex-direction: row; min-height: 250px; }
    .ws-concept .ws-thumb { flex: 0 0 min(50%, 520px); border-bottom: 0; border-right: 1px solid var(--line-soft); }
    .ws-concept .ws-meta { align-self: center; padding: 1.4rem 1.6rem 2.8rem; max-width: 60ch; }
    .ws-concept .ws-meta small { font-size: .95rem; }
    .ws-concept .ws-card::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--bc, var(--accent)); }
    @media (max-width: 760px) { .ws-concept .ws-card { flex-direction: column; } .ws-concept .ws-thumb { flex: none; border-right: 0; border-bottom: 1px solid var(--line-soft); } .ws-concept .ws-meta { padding: 1rem 1rem 2.2rem; } }
    .ws-card { position: relative; display: flex; flex-direction: column; flex: 1; text-decoration: none; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); transition: transform .18s, box-shadow .18s, border-color .18s; }
    .ws-card:hover, .ws-card:focus-visible { transform: translateY(-2px); border-color: var(--bc, var(--accent)); box-shadow: 0 14px 34px -18px rgba(36,24,46,.55); outline: none; }
    .ws-card:focus-visible { box-shadow: 0 0 0 3px var(--gold); }
    .ws-thumb { position: relative; display: block; aspect-ratio: 16 / 10; background-color: var(--surface); background-image: linear-gradient(rgba(36,24,46,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(36,24,46,.05) 1px, transparent 1px); background-size: 22px 22px; border-bottom: 1px solid var(--line-soft); overflow: hidden; }
    .ws-thumb::before { content: ""; position: absolute; inset: 30%; background: var(--line); -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.4' stroke-linejoin='round'%3E%3Cpath d='M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z'/%3E%3Cpath d='M3.5 7.3L12 12l8.5-4.7M12 12v9.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.4' stroke-linejoin='round'%3E%3Cpath d='M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z'/%3E%3Cpath d='M3.5 7.3L12 12l8.5-4.7M12 12v9.5'/%3E%3C/svg%3E") center / contain no-repeat; }
    .ws-thumb:has(img)::before { display: none; }
    .ws-thumb img { position: relative; display: block; width: 100%; height: 100%; object-fit: contain; transition: transform .35s; }
    .ws-card:hover .ws-thumb img { transform: scale(1.04); }
    .ws-meta { display: block; padding: .8rem 1rem 1rem; }
    .ws-kind { display: inline-flex; align-items: center; gap: .35rem; font: 700 .68rem/1.2 var(--text); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
    .ws-kind svg { width: 14px; height: 14px; }
    .ws-concept .ws-kind { color: var(--copper); }
    .ws-meta b { display: block; font: 600 1.02rem/1.3 var(--display); margin-top: .3rem; }
    .ws-concept .ws-meta b { font-size: 1.2rem; }
    .ws-meta small { display: block; font-size: .84rem; color: var(--muted); margin-top: .3rem; line-height: 1.45; }
    .ws-go { position: absolute; top: .7rem; right: .7rem; display: inline-flex; align-items: center; gap: .35rem; font: 600 .8rem/1 var(--display); color: #fff; background: var(--plum); padding: .45rem .7rem; border-radius: 999px; opacity: 0; transform: translateY(-4px); transition: opacity .18s, transform .18s; }
    .ws-go svg { width: 15px; height: 15px; }
    .ws-card:hover .ws-go, .ws-card:focus-visible .ws-go { opacity: 1; transform: none; }
    .ws-concept .ws-go { opacity: 1; transform: none; background: var(--accent); }
    .ws-lesson { position: absolute; right: .7rem; bottom: .65rem; display: inline-flex; align-items: center; gap: .3rem; font: 500 .76rem/1 var(--display); color: var(--muted); text-decoration: none; padding: .3rem .45rem; border-radius: 7px; }
    .ws-lesson:hover { color: var(--accent-ink); background: var(--surface-2); }
    .ws-lesson svg { width: 13px; height: 13px; }
    .ws-item .ws-meta { padding-bottom: 2.1rem; }
    .ws-empty { color: var(--muted); padding: 2rem 0; }
    .ws-foot { margin-top: 2rem; font-size: .85rem; color: var(--muted); max-width: 70ch; }
    @media (max-width: 980px) { .ws-wrap { grid-template-columns: 1fr; } .ws-rail { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); padding: .7rem 1rem; display: flex; gap: .3rem; overflow-x: auto; } .ws-rail h2 { display: none; } .ws-rail a { flex: none; } .ws-rail-name, .ws-count { display: none; } .ws-main { padding: 1.2rem 1rem 3rem; } }
    @media (max-width: 560px) { .ws-concept { grid-column: 1 / -1; } .ws-toplinks { display: none; } .ws-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: .7rem; } .ws-meta small { display: none; } .ws-meta b { font-size: .92rem; } .ws-lesson { display: none; } .ws-item .ws-meta { padding-bottom: .9rem; } }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ws-thumb { background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); } }
    :root[data-theme="dark"] .ws-thumb { background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); }
    /* the viewer: one lab filling the window */
    body.ws-view { height: 100vh; height: 100dvh; overflow: hidden; display: flex; flex-direction: column; }
    body.ws-view .ws-wrap, body.ws-view .ws-search, body.ws-view .ws-toplinks { display: none; }
    .ws-vbar { display: none; }
    body.ws-view .ws-vbar { display: flex; align-items: center; gap: .5rem; min-width: 0; flex: 1; }
    .ws-vbar a, .ws-vbar button { display: inline-flex; align-items: center; gap: .4rem; color: #fff; text-decoration: none; font: 500 .85rem/1 var(--display); padding: .5rem .7rem; border-radius: 9px; border: 1px solid rgba(255,255,255,.18); background: none; cursor: pointer; white-space: nowrap; }
    .ws-vbar a:hover, .ws-vbar button:hover { background: rgba(255,255,255,.12); }
    .ws-vbar svg { width: 17px; height: 17px; flex: none; }
    .ws-prev, .ws-next { font-size: 1.15rem !important; min-width: 2.3rem; justify-content: center; }
    .ws-vbar a[aria-disabled="true"] { opacity: .35; pointer-events: none; }
    .ws-vtitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 1rem/1.2 var(--display); padding: 0 .4rem; }
    .ws-vtitle small { font: 500 .78rem/1 var(--text); opacity: .7; margin-right: .5rem; }
    .ws-stage { flex: 1; min-height: 0; position: relative; }
    .ws-stage .lab-skel { position: absolute; inset: 0; height: auto; margin: 0; border: 0; border-radius: 0; }
    :root .lab.lab-app { position: absolute; inset: 0; margin: 0; }
    :root .lab.lab-app:not(.lab-fs) { width: 100% !important; height: 100%; }
    body.ws-view .ws-top { flex-wrap: nowrap; padding: .5rem .8rem; gap: .6rem; }
    body.ws-view .ws-brand span { display: none; }
    @media (max-width: 640px) { .ws-vbar .ws-lessonlink span, .ws-vbar .ws-back span { display: none; } .ws-vtitle small { display: none; } }
    /* thumbnail mode (tools/lab_thumbs.mjs) */
    body.ws-shot .ws-top { display: none; }
    body.ws-shot .ws-stage { flex: none; width: 800px; height: 500px; }
    .lab.lab-shot .lab-side, .lab.lab-shot .lab-viewbar, .lab.lab-shot .lab-hint, .lab.lab-shot .lab-callouts, .lab.lab-shot .lab-topbar { display: none !important; }
    .lab.lab-shot .lab-canvas { background: none; }
    .lab.lab-shot { background: none; border: 0; box-shadow: none; grid-template-columns: 1fr !important; }
  </style>
</head>
<body class="ws">
<header class="ws-top">
  <a class="ws-brand" href="home.html"><img src="../assets/brand/logo-mark-white.png" alt="Arduino Ladder home"><span><b>3D Workshop</b><small>The Arduino Ladder · Bozoma Innovation Hub</small></span></a>
  <label class="ws-search">@@SEARCH@@<input type="search" id="ws-q" placeholder="Find a lab: button, servo, screen…" aria-label="Find a 3D lab" autocomplete="off"></label>
  <nav class="ws-toplinks" aria-label="Course"><a href="home.html">Course home</a><a href="bands/band-0.html">Start with Band 0</a></nav>
  <div class="ws-vbar">
    <a class="ws-back" href="labs.html" aria-label="All 3D labs">&larr; <span>All labs</span></a>
    <span class="ws-vtitle" id="ws-vtitle"></span>
    <a class="ws-prev" id="ws-prev" href="#" aria-label="Previous lab">&lsaquo;</a>
    <a class="ws-next" id="ws-next" href="#" aria-label="Next lab">&rsaquo;</a>
    <a class="ws-lessonlink" id="ws-lesson" href="#">@@CUBE@@<span>In the lesson</span></a>
  </div>
</header>
<div class="ws-wrap">
  <nav class="ws-rail" aria-label="Bands">
    <h2>Bands</h2>
@@RAIL@@
  </nav>
  <main class="ws-main" id="main">
    <div class="ws-hero">
      <div>
        <h1>Every 3D lab in the course</h1>
        <p>Each band has a concept lab with missions, where its big idea is taught. Every wiring diagram in the lessons is here in 3D too. Click one to open it full size: drag to turn it, scroll or pinch to zoom, and click any part.</p>
      </div>
      <div class="ws-stats"><span><b>@@NLABS@@</b> concept labs</span><span><b>@@NBUILDS@@</b> builds in 3D</span><span>Works offline</span></div>
    </div>
@@BODY@@
    <p class="ws-empty" id="ws-empty" hidden>Nothing matches that. Try a part, such as “LED”, “button” or “servo”.</p>
    <p class="ws-foot">The labs are models, not your board: real parts can look a little different. They need a browser with WebGL (any recent Chrome, Edge, Firefox or Safari). Without it, the lessons teach exactly the same things with flat pictures.</p>
  </main>
</div>
<script type="application/json" id="ws-catalog">@@CATALOG@@</script>
<script>
(function () {
  var list = JSON.parse(document.getElementById('ws-catalog').textContent);
  var q = new URLSearchParams(location.search);
  var id = q.get('open');
  if (!id) {
    // the catalogue: search, and the band rail follows the scroll
    var input = document.getElementById('ws-q');
    var items = [].slice.call(document.querySelectorAll('.ws-item'));
    var bands = [].slice.call(document.querySelectorAll('.ws-band'));
    input.addEventListener('input', function () {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      var any = false;
      items.forEach(function (it) {
        var hay = it.getAttribute('data-q');
        var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
        it.hidden = !ok;
        any = any || ok;
      });
      bands.forEach(function (b) { b.hidden = !b.querySelector('.ws-item:not([hidden])'); });
      document.getElementById('ws-empty').hidden = any;
    });
    if ('IntersectionObserver' in window) {
      var links = {};
      [].forEach.call(document.querySelectorAll('.ws-rail a'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { for (var k in links) links[k].classList.toggle('on', k === e.target.id); } });
      }, { rootMargin: '-30% 0px -60% 0px' });
      bands.forEach(function (b) { io.observe(b); });
    }
    return;
  }
  // the viewer
  var i = -1;
  for (var k = 0; k < list.length; k++) if (list[k].id === id) i = k;
  var it = list[i];
  document.body.classList.add('ws-view');
  if (q.has('shot')) document.body.classList.add('ws-shot');
  var stage = document.createElement('div');
  stage.className = 'ws-stage';
  document.body.appendChild(stage);
  if (!it) { stage.innerHTML = '<p style="padding:2rem">There is no 3D lab called “' + id.replace(/</g, '&lt;') + '”. <a href="labs.html">See them all</a>.</p>'; return; }
  document.title = it.title + ' · 3D Workshop · Arduino Ladder';
  document.getElementById('ws-vtitle').innerHTML = '<small>' + (it.band === 'bench' ? 'Bench' : 'Band ' + it.band) + ' · ' + it.kind + '</small>' + it.title.replace(/</g, '&lt;');
  var prev = document.getElementById('ws-prev'), next = document.getElementById('ws-next'), lesson = document.getElementById('ws-lesson');
  if (i > 0) prev.href = 'labs.html?open=' + list[i - 1].id; else prev.setAttribute('aria-disabled', 'true');
  if (i < list.length - 1) next.href = 'labs.html?open=' + list[i + 1].id; else next.setAttribute('aria-disabled', 'true');
  if (it.lesson) lesson.href = it.lesson; else lesson.hidden = true;
  prev.title = i > 0 ? 'Previous: ' + list[i - 1].title : '';
  next.title = i < list.length - 1 ? 'Next: ' + list[i + 1].title : '';
  var host = document.createElement('div');
  host.className = 'lab lab-app' + (q.has('shot') ? ' lab-shot' : '');
  host.dataset.lazy = '';
  if (/^concept-/.test(id)) host.dataset.lab = id;
  else { host.dataset.lab = 'build'; host.dataset.build = id; }
  host.setAttribute('aria-label', '3D lab: ' + it.title);
  stage.appendChild(host);
  // Page keys: [ and ] go to the previous and next lab.
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === '[' && i > 0) location.href = prev.href;
    if (e.key === ']' && i < list.length - 1) location.href = next.href;
  });
  function go() {
    var sk = document.createElement('div');
    stage.insertBefore(sk, host);
    var bar = null;
    if (!window.ArduinoLabs) {
      sk.className = 'lab-skel';
      sk.innerHTML = '<div class="lab-skel-in"><svg class="lab-skel-cube" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/></svg><b>Loading the 3D lab…</b><div class="meter busy"><span></span></div><small>About 1 MB to download, the first time.</small></div>';
      bar = sk.querySelector('.meter');
    }
    window.ArduinoLabsLoader.load(function (f) {
      if (!bar) return;
      if (f < 0) { bar.className = 'meter busy'; return; }
      bar.className = 'meter';
      bar.firstChild.style.width = Math.round(Math.max(0.04, f) * 100) + '%';
    }).then(function () {
      sk.remove();
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      return Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { return window.ArduinoLabs.mount(host); });
    }, function () { sk.innerHTML = '<div class="lab-skel-in"><b>The 3D lab could not load.</b><small>Try reloading the page.</small></div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
</script>
</body>
</html>
"""


def main():
    sys.path.insert(0, HERE)
    import inject_head  # the app and link-preview tags every page carries
    out = inject_head.apply(render(catalog()), "arduino/labs.html")
    if "--check" in sys.argv:
        cur = io.open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        print("labs.html is up to date" if cur == out else "labs.html is out of date: run python3 tools/labs_page.py")
        sys.exit(0 if cur == out else 1)
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("wrote labs.html")


if __name__ == "__main__":
    main()

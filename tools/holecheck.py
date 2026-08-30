"""Occupancy checker: reads each band/project page's authoritative
pin-plan TABLE (one row per part) and flags any breadboard hole, or
any Arduino pin, claimed by two different rows."""
import io,re,sys,glob,collections

def tables_of(path):
    """Each wiring table is a separate circuit built at a separate time,
    so collisions only mean anything WITHIN one table."""
    s=io.open(path,encoding="utf-8").read()
    s=re.sub(r'<details>.*?</details>','',s,flags=re.S)
    out=[]
    for ti,tbl in enumerate(re.findall(r'<table>(.*?)</table>',s,re.S)):
        head=re.sub(r'<[^>]+>',' ',(re.search(r'<thead>(.*?)</thead>',tbl,re.S) or re.match('','')).group(1) if re.search(r'<thead>',tbl,re.S) else '')
        if not re.search(r'hole|wiring|goes to|arduino pin|pin\b', head, re.I): continue
        for tr in re.findall(r'<tr>(.*?)</tr>',tbl,re.S):
            txt=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',tr)).strip()
            if not txt: continue
            # A note spanning the table is advice, not a placement.
            if re.search(r'<td[^>]*colspan',tr): continue
            body=tr
            # The first cell names the part. If it repeats a hole ("Emitter, e12")
            # that is identification, not a second leg in the same hole.
            cells=re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S)
            if len(cells)>1: body=' '.join(cells[1:])
            # "b11, not a11" warns you off a hole; it does not claim it.
            body=re.sub(r'\bnot\b\s*<code>[a-j]\d{1,2}</code>',' ',body,flags=re.I)
            holes=set("%s%s"%h for h in re.findall(r'<code>([a-j])(\d{1,2})</code>',body))
            pins=set(re.findall(r'\bto\s+(?:Arduino\s+)?pin\s+<?[a-z]*>?<?code>?\s*(\d{1,2})',body))
            pins |= set(re.findall(r'<td[^>]*class="n"[^>]*>\s*<?[a-z]*>?(\d{1,2})',tr))
            if holes or pins: out.append((ti,txt[:70],holes,pins))
    return out

ARGS=sys.argv[1:] or ['pack*/band*.body.html','projects/*.body.html']
paths=sorted(sum((glob.glob(a) for a in ARGS),[]))
if not paths: sys.exit("holecheck: no pages matched %s" % ARGS)
bad=0
for path in paths:
    rows=tables_of(path)
    if not rows: continue
    H=collections.defaultdict(list); P=collections.defaultdict(list)
    for ti,txt,holes,pins in rows:
        for h in holes: H[(ti,h)].append(txt)
        for p in pins:  P[(ti,p)].append(txt)
    probs=[("HOLE","t%d %s"%k,v) for k,v in H.items() if len(v)>1]+[("PIN","t%d %s"%k,v) for k,v in P.items() if len(v)>1]
    name=path.split('/')[-1]
    if probs:
        bad+=len(probs)
        print("== %s"%name)
        for kind,k,v in sorted(probs):
            print("   %s %-4s claimed by %d rows:"%(kind,k,len(v)))
            for t in v: print("        ",t)
    else:
        print("== %-28s clean (%d rows)"%(name,len(rows)))
print("\n%d collisions"%bad)

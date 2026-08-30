import re,sys,glob
def syll(w):
    w=re.sub(r'[^a-z]','',w.lower())
    if not w: return 0
    w=re.sub(r'e$','',w) or w
    return max(1,len(re.findall(r'[aeiouy]+',w)))
tw=ts=ty=0
for f in sorted(sum((glob.glob(a) for a in sys.argv[1:]),[])):
    s=open(f).read()
    s=re.sub(r'<(script|style|svg|pre|nav|thead)\b.*?</\1>','',s,flags=re.S)
    s=re.sub(r'<table\b.*?</table>','',s,flags=re.S)
    blocks=re.findall(r'<(?:p|li|dd|h5|summary)\b[^>]*>(.*?)</(?:p|li|dd|h5|summary)>'
                      r'|<div class="(?:ifnot|see)"[^>]*>(.*?)</div>',s,re.S)
    parts=[x for t in blocks for x in t if x]
    txt=' . '.join(parts)
    txt=re.sub(r'<b>.*?</b>','. ',txt,flags=re.S)      # the bold lead-in is a heading
    txt=re.sub(r'<br\s*/?>',' . ',txt)
    txt=re.sub(r'<code>.*?</code>',' code ',txt,flags=re.S)
    txt=re.sub(r'<[^>]+>',' ',txt); txt=re.sub(r'&[a-z#0-9]+;',' ',txt)
    sents=[x for x in re.split(r'[.!?:;]+',txt) if len(x.split())>2]
    words=re.findall(r"[A-Za-z][A-Za-z'-]*",txt)
    if not sents or not words: continue
    y=sum(syll(w) for w in words)
    g=0.39*len(words)/len(sents)+11.8*y/len(words)-15.59
    print("%-26s grade %4.1f  %5d words  %4.1f w/sent" % (f.split('/')[-1],g,len(words),len(words)/len(sents)))
    tw+=len(words); ts+=len(sents); ty+=y
print("-"*60); print("ALL grade %.1f  %d words"%(0.39*tw/ts+11.8*ty/tw-15.59,tw))

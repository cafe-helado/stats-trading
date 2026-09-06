#!/usr/bin/env python3
"""Flip a planned module to live: swap its index entry, add it to the service
worker's precache list, and bump the cache.

    python wire.py <number> <file.html> "<Title>" "<subject line>" "<blurb>" tag,tag,tag

Doing this by hand is how a page ends up live on the index and missing from
PRECACHE, which is the one failure nothing warns you about — the site keeps
working online and only breaks on a train.
"""
import io, os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
num, fn, title, subj, blurb, tags = sys.argv[1:7]

idx = os.path.join(here, "index.html")
s = io.open(idx, encoding="utf-8").read()

pat = re.compile(
    r'  <div class="entry planned">\s*\n\s*<span class="n">' + re.escape(num) +
    r'</span>.*?<span class="st soon">Planned</span>\s*\n  </div>', re.S)
m = pat.search(s)
if not m:
    print("no planned entry numbered " + num + " — already live?")
    sys.exit(1)

entry = (
    '  <a class="entry" href="' + fn + '">\n'
    '    <span class="n">' + num + '</span>\n'
    '    <div>\n'
    '      <h3>' + title + '</h3>\n'
    '      <p class="subj">' + subj + '</p>\n'
    '      <p>' + blurb + '</p>\n'
    '      <div class="tags">' +
    "".join("<span>" + t.strip() + "</span>" for t in tags.split(",")) +
    '</div>\n'
    '    </div>\n'
    '    <span class="st live">Live &rarr;</span>\n'
    '  </a>')
s = s[:m.start()] + entry + s[m.end():]
io.open(idx, "w", encoding="utf-8", newline="").write(s)

sw = os.path.join(here, "sw.js")
w = io.open(sw, encoding="utf-8").read()
if '"' + fn + '"' not in w:
    anchor = '  "assets/lab.css",'
    assert w.count(anchor) == 1
    w = w.replace(anchor, '  "' + fn + '",\n' + anchor)
    v = re.search(r'chance-visually-v(\d+)', w)
    n = int(v.group(1)) + 1
    w = re.sub(r'chance-visually-v\d+', "chance-visually-v" + str(n), w)
    io.open(sw, "w", encoding="utf-8", newline="").write(w)
    print("wired " + fn + " into the index and PRECACHE; cache now v" + str(n))
else:
    print("wired " + fn + " into the index; it was already in PRECACHE")

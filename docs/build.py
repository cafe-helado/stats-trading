#!/usr/bin/env python3
"""
build.py — inline the shared assets into standalone single-file pages.

The split form (assets/lab.css + assets/lab.js) is what gets hosted: browsers
cache the shared files across the series. But relative paths only resolve when
the whole folder is served together, so a single page emailed, AirDropped, or
opened from a preview pane will render unstyled.

This writes a self-contained copy of each page into dist/ with everything inlined.

    python3 build.py
"""
import os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)

def read(p):
    with open(os.path.join(HERE, p), encoding="utf-8") as f:
        return f.read()

def inline(html):
    # <link rel="stylesheet" href="assets/x.css">  ->  <style>...</style>
    def css_sub(m):
        path = m.group(1)
        if path.startswith(("http://", "https://", "//")):
            return m.group(0)
        return "<style>\n/* inlined: %s */\n%s\n</style>" % (path, read(path))
    html = re.sub(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>', css_sub, html)

    # <script src="assets/x.js"></script>  ->  <script>...</script>
    def js_sub(m):
        path = m.group(1)
        if path.startswith(("http://", "https://", "//")):
            return m.group(0)
        return "<script>\n/* inlined: %s */\n%s\n</script>" % (path, read(path))
    html = re.sub(r'<script[^>]+src="([^"]+)"[^>]*>\s*</script>', js_sub, html)

    # the series bar links home; in a standalone file there is no home
    html = html.replace('<a class="home" href="index.html">', '<a class="home" href="#">')

    # A standalone file has no origin to install a service worker against and
    # no sibling manifest to link to, so strip the whole PWA layer out of
    # dist/. pwa.js would bail on file:// anyway, but shipping dead code in a
    # file whose entire point is being self-contained is untidy.
    PWA = [
        r'\n?[ \t]*<link rel="manifest"[^>]*>',
        r'\n?[ \t]*<link rel="apple-touch-icon"[^>]*>',
        r'\n?[ \t]*<meta name="apple-mobile-web-app-[^>]*>',
        r'\n?[ \t]*<meta name="mobile-web-app-capable"[^>]*>',
        r'\n?[ \t]*<script[^>]+src="assets/pwa\.js"[^>]*>\s*</script>',
        r'\n?[ \t]*<script>\s*/\* inlined: assets/pwa\.js \*/[\s\S]*?</script>',
    ]
    for pat in PWA:
        html = re.sub(pat, "", html)
    return html

pages = [p for p in glob.glob(os.path.join(HERE, "*.html"))
         if os.path.basename(p) not in ("template.html",)]

for p in sorted(pages):
    name = os.path.basename(p)
    with open(p, encoding="utf-8") as f:
        out = inline(f.read())
    dest = os.path.join(DIST, name)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(out)
    print("  %-24s %7d bytes  ->  dist/%s" % (name, len(out), name))

print("\ndist/ holds standalone copies. Host the split files; share the dist ones.")

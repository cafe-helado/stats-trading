#!/usr/bin/env python3
"""Assemble a page from a body fragment + a script fragment."""
import sys, html
FONTS=('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
'<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900'
'&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400'
'&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">')
body_f, js_f, out_f, title, desc = sys.argv[1:6]
head=f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#EDF0EC">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23EDF0EC'/><circle cx='16' cy='16' r='7' fill='none' stroke='%231F4CE8' stroke-width='3'/></svg>">
{FONTS}
<link rel="stylesheet" href="assets/lab.css">
<link rel="stylesheet" href="assets/mobile.css">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Chance">
<meta name="mobile-web-app-capable" content="yes">
</head>
<body>
"""
page=head+open(body_f,encoding="utf-8").read()+'\n<script src="assets/lab.js"></script>\n<script src="assets/stats.js"></script>\n<script src="assets/pwa.js" defer></script>\n<script>\n'+open(js_f,encoding="utf-8").read()+'\n</script>\n</body>\n</html>\n'
open(out_f,"w",encoding="utf-8",newline="").write(page)
print(out_f, len(page), "bytes")

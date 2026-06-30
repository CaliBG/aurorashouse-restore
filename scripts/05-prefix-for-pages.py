#!/usr/bin/env python3
"""Rewrite the root-relative paths in src/ to a GitHub Pages PROJECT subpath, e.g.
`/assets/x` -> `/aurorashouse-restore/assets/x` and `href="/aboutme"` ->
`href="/aurorashouse-restore/aboutme"`. Run on the CI runner before uploading the Pages
artifact; the committed src/ stays root-relative for local preview. Idempotent / double-
prefix-safe via look-around. Usage: python3 scripts/05-prefix-for-pages.py /aurorashouse-restore"""
import os, re, sys, glob

BASE = (sys.argv[1] if len(sys.argv) > 1 else "/aurorashouse-restore").rstrip("/")
SEG = BASE.strip("/")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# Target dir holding the site (HTML at its root, css under assets/). Default: src/.
# For a gh-pages build the site lives at the branch root, so pass that dir explicitly.
SRC = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, "src")

# 1) every root-relative /assets/... ref (src, srcset, url(), content, data-*, asset href).
#    Lookbehind: not preceded by a word char/hyphen, so /<base>/assets/ won't re-match.
ASSETS_RE = re.compile(r'(?<![\w-])/assets/')
# 2) internal nav links href="/..." that are not already prefixed and not protocol-relative.
NAV_RE = re.compile(r'href="/(?!' + re.escape(SEG) + r'/)(?!/)')

def fix_html(t):
    t = ASSETS_RE.sub(BASE + "/assets/", t)
    t = NAV_RE.sub(f'href="{BASE}/', t)
    return t

def fix_css(t):
    return ASSETS_RE.sub(BASE + "/assets/", t)

def main():
    nh = nc = 0
    for f in glob.glob(os.path.join(SRC, "*.html")):
        t = open(f, encoding="utf-8", errors="replace").read()
        open(f, "w", encoding="utf-8").write(fix_html(t)); nh += 1
    for f in glob.glob(os.path.join(SRC, "assets", "**", "*.css"), recursive=True):
        t = open(f, encoding="utf-8", errors="replace").read()
        if "/assets/" in t:
            open(f, "w", encoding="utf-8").write(fix_css(t)); nc += 1
    print(f"prefixed {nh} html + {nc} css with base '{BASE}'")
    # sanity: report a sample
    sample = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    import re as _re
    hit = _re.search(r'(href|src)="' + re.escape(BASE) + r'/[^"]*"', sample)
    print("sample:", hit.group(0)[:80] if hit else "NONE FOUND (check!)")

if __name__ == "__main__":
    main()

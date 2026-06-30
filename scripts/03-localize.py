#!/usr/bin/env python3
"""Build the runnable site in src/ : copy production HTML, then rewrite every first-party
asset URL (website-files / typekit / cloudfront / ajax) to a local root-relative /assets/...
path. Also localizes url() refs inside the shared Webflow CSS and the Typekit CSS.
Idempotent: always regenerates src/*.html from _capture/pages/*.html."""
import os, re, sys, glob, shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_paths import local_path_for, KEEP_HOSTS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGES = os.path.join(ROOT, "_capture", "pages")
SRC = os.path.join(ROOT, "src")

HOST_ALT = "|".join(re.escape(h) for h in KEEP_HOSTS)
# a first-party URL token, bounded by HTML/CSS delimiters (quotes, comma, ws, paren, <>)
URL_RE = re.compile(r'https?://(?:' + HOST_ALT + r')/[^"\',\s)<>\\]+', re.I)
# single-URL attributes whose value may contain RAW spaces (filenames with spaces)
SINGLE_ATTR_RE = re.compile(
    r'\b(src|href|poster|content|data-poster-url)="(https?://(?:' + HOST_ALT + r')/[^"]*)"', re.I)
SRCSET_RE = re.compile(r'\bsrcset="([^"]*)"', re.I)
VIDEO_ATTR_RE = re.compile(r'(data-video-urls=")([^"]*)(")')
# inline style background-image: url(&quot;...&quot;) — Webflow encodes the quotes as
# &quot;, and filenames may contain spaces AND parens, so match between the quotes.
STYLE_URL_RE = re.compile(
    r'url\((&quot;|&#34;|["\'])(https?://(?:' + HOST_ALT + r')/.*?)\1\)', re.I)

def to_local(url):
    """url -> '/assets/...' or None if not mapped."""
    lp = local_path_for(url)
    return ("/" + lp) if lp else None

def repl_url(m):
    full = m.group(0)
    # strip any HTML-entity tail the greedy class may have swept up
    cut = len(full)
    for ent in ("&quot;", "&#", "&gt;", "&lt;"):
        i = full.find(ent)
        if i != -1:
            cut = min(cut, i)
    url, tail = full[:cut], full[cut:]
    lp = to_local(url)
    return (lp + tail) if lp else full

def repl_srcset(m):
    out = []
    for cand in m.group(1).split(","):
        c = cand.strip()
        if not c:
            continue
        d = re.search(r'\s+(\d+(?:\.\d+)?[wx])$', c)  # trailing "500w"/"2x" descriptor
        url, desc = (c[:d.start()].strip(), " " + d.group(1)) if d else (c, "")
        lp = to_local(url) if url.startswith("http") else None
        out.append((lp if lp else url) + desc)
    return 'srcset="' + ", ".join(out) + '"'

def repl_video(m):
    pre, val, post = m.group(1), m.group(2), m.group(3)
    outs = []
    for part in val.split(","):
        p = part.strip()
        lp = to_local(p) if p.startswith("http") else None
        outs.append(lp if lp else p)
    return pre + ",".join(outs) + post

def repl_single(m):
    attr, url = m.group(1), m.group(2).strip()
    lp = to_local(url)
    return f'{attr}="{lp if lp else url}"'

def repl_style_url(m):
    q, url = m.group(1), m.group(2).strip()
    lp = to_local(url)
    return f'url({q}{lp if lp else url}{q})'

def localize_html(text):
    # 0) drop Subresource Integrity: we relocate (and edit) assets, so hashes won't match
    text = re.sub(r'\s+integrity="[^"]*"', "", text)
    # 1) srcset (multi-URL; preserve descriptors + internal spaces)
    text = SRCSET_RE.sub(repl_srcset, text)
    # 2) data-video-urls (comma-joined list; URLs may contain raw spaces)
    text = VIDEO_ATTR_RE.sub(repl_video, text)
    # 3) inline style url(&quot;...&quot;) (filenames may contain spaces and parens)
    text = STYLE_URL_RE.sub(repl_style_url, text)
    # 4) single-URL attributes whose value may contain raw spaces
    text = SINGLE_ATTR_RE.sub(repl_single, text)
    # 5) anything left (%20-encoded url() in inline styles, etc.)
    text = URL_RE.sub(repl_url, text)
    # 6) inject the locally-hosted Lora stylesheet (the original loads it from Google via
    #    WebFont.load; this makes the rebuild self-contained / offline-capable). The
    #    original WebFont.load is kept for fidelity but is now redundant.
    if "/assets/gfonts/lora.css" not in text:
        text = text.replace("</head>",
            '<link rel="stylesheet" href="/assets/gfonts/lora.css"/></head>', 1)
    return text

def localize_css(text):
    # CSS only has url(...) http refs (fonts, placeholders); same global replace works
    return URL_RE.sub(repl_url, text)

def main():
    # ---- HTML pages ----
    n = 0
    for f in sorted(glob.glob(os.path.join(PAGES, "*.html"))):
        name = os.path.basename(f)
        text = open(f, encoding="utf-8", errors="replace").read()
        out = localize_html(text)
        with open(os.path.join(SRC, name), "w", encoding="utf-8") as fh:
            fh.write(out)
        remaining = len(URL_RE.findall(out))
        n += 1
        print(f"  {name:24} first-party URLs left: {remaining}")

    # ---- CSS files (rewrite in place under src/assets) ----
    for css in glob.glob(os.path.join(SRC, "assets", "**", "*.css"), recursive=True):
        t = open(css, encoding="utf-8", errors="replace").read()
        before = len(URL_RE.findall(t))
        if before:
            t2 = localize_css(t)
            open(css, "w", encoding="utf-8").write(t2)
            after = len(URL_RE.findall(t2))
            print(f"  [css] {os.path.relpath(css, SRC):50} {before}->{after} http refs")

    print(f"\nLocalized {n} HTML pages into src/")

if __name__ == "__main__":
    main()

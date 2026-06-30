#!/usr/bin/env python3
"""Discover every first-party asset referenced by the captured HTML (and by the shared
CSS / Lottie JSON / Typekit CSS those pull in), then download each to its local_path_for()
location under src/assets/. Concurrent, resumable (skips files already on disk)."""
import os, re, sys, json, subprocess, glob
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlsplit, unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_paths import local_path_for, KEEP_HOSTS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGES = os.path.join(ROOT, "_capture", "pages")
SRC = os.path.join(ROOT, "src")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

HOST_ALT = "|".join(re.escape(h) for h in KEEP_HOSTS)
RAW_URL_RE = re.compile(r'https?://(?:' + HOST_ALT + r')/[^\s"\'<>),\\]+', re.I)
ATTR_RE = re.compile(r'(?:src|href|poster|srcset|content|style|data-[\w-]+)\s*=\s*"([^"]*)"', re.I)
CSS_URL_RE = re.compile(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)')

def clean(u):
    u = u.replace("&amp;", "&")
    # cut HTML-entity artifacts that the regex may have swept up
    for cut in ("&quot;", "&#", "&gt;", "&lt;"):
        i = u.find(cut)
        if i != -1:
            u = u[:i]
    return u.strip().rstrip(",")

def canon(u):
    """canonical dedupe key = host + fully-decoded path"""
    s = urlsplit(u)
    p = s.path
    prev = None
    while prev != p:
        prev = p; p = unquote(p)
    return s.netloc.lower() + p

def harvest_text(text, is_css=False):
    """Return set of candidate first-party URLs found in HTML or CSS text."""
    found = set()
    if is_css:
        for m in CSS_URL_RE.finditer(text):
            found.add(m.group(1))
    else:
        # full attribute values (handles spaces inside quotes, srcset, style url())
        for m in ATTR_RE.finditer(text):
            val = m.group(1)
            if "url(" in val:
                for cm in CSS_URL_RE.finditer(val):
                    found.add(cm.group(1))
            # comma-separated lists: srcset ("<url> <descriptor>") OR webflow
            # data-video-urls ("<url>,<url>") whose URLs may contain raw spaces/parens.
            for cand in val.split(","):
                cand = cand.strip()
                if not cand.startswith("http"):
                    continue
                # strip a trailing srcset descriptor like "768w"/"2x" ONLY if present;
                # otherwise keep the whole candidate (filenames may contain spaces).
                m2 = re.search(r'\s+\d+(?:\.\d+)?[wx]$', cand)
                url = cand[:m2.start()] if m2 else cand
                found.add(url.strip())
        # also a raw sweep as a safety net
        for m in RAW_URL_RE.finditer(text):
            found.add(m.group(0))
    # keep only first-party hosts, clean entities
    out = set()
    for u in found:
        u = clean(u)
        try:
            if urlsplit(u).netloc.lower() in KEEP_HOSTS:
                out.add(u)
        except Exception:
            pass
    return out

def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return ("skip", url, dest)
    fetch = url.replace(" ", "%20")  # curl cannot request raw spaces in a URL
    r = subprocess.run(
        ["curl", "-sL", "--fail", "-A", UA, "--retry", "2", "--max-time", "300", fetch, "-o", dest],
        capture_output=True)
    if r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0:
        return ("ok", url, dest)
    if os.path.exists(dest):
        os.remove(dest)
    return ("FAIL", url, dest)

def main():
    # ---- pass 1: harvest from HTML ----
    urls = {}  # canon -> representative url
    for f in sorted(glob.glob(os.path.join(PAGES, "*.html"))):
        text = open(f, encoding="utf-8", errors="replace").read()
        for u in harvest_text(text):
            urls.setdefault(canon(u), u)
    print(f"[pass1] {len(urls)} unique first-party URLs from HTML")

    # ---- download pass 1 ----
    def run_batch(url_map, label):
        tasks = []
        for c, u in url_map.items():
            lp = local_path_for(u)
            if not lp:
                continue
            tasks.append((u, os.path.join(SRC, lp)))
        ok = fail = skip = 0
        fails = []
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = [ex.submit(download, u, d) for u, d in tasks]
            for fut in as_completed(futs):
                st, u, d = fut.result()
                if st == "ok": ok += 1
                elif st == "skip": skip += 1
                else: fail += 1; fails.append(u)
        print(f"[{label}] downloaded={ok} skipped={skip} failed={fail} (of {len(tasks)})")
        if fails:
            print("  FAILURES:")
            for u in fails[:40]:
                print("   ", u)
        return fails

    run_batch(urls, "html-assets")

    # ---- pass 2: parse downloaded CSS / Lottie / Typekit for more refs ----
    more = {}
    # any .css and .json we just stored
    for path in glob.glob(os.path.join(SRC, "assets", "**", "*"), recursive=True):
        low = path.lower()
        if low.endswith((".css",)):
            txt = open(path, encoding="utf-8", errors="replace").read()
            for u in harvest_text(txt, is_css=True):
                more.setdefault(canon(u), u)
        elif low.endswith(".json") or low.endswith(".lottie"):
            txt = open(path, encoding="utf-8", errors="replace").read()
            # lottie image refs sometimes absolute; also any website-files url in json
            for m in RAW_URL_RE.finditer(txt):
                u = clean(m.group(0))
                more.setdefault(canon(u), u)
    # drop ones already downloaded
    new = {c: u for c, u in more.items() if c not in urls}
    print(f"[pass2] {len(new)} additional URLs from CSS/JSON")
    if new:
        run_batch(new, "css-json-assets")
        urls.update(new)

    # ---- write manifest (only entries that actually landed on disk) ----
    man = {}
    for c, u in urls.items():
        lp = local_path_for(u)
        if lp and os.path.exists(os.path.join(SRC, lp)):
            man[c] = {"url": u, "local": lp}
    with open(os.path.join(ROOT, "_analysis", "asset-manifest.json"), "w") as fh:
        json.dump(man, fh, indent=2)
    print(f"\nManifest: {len(man)} on-disk assets -> _analysis/asset-manifest.json")

if __name__ == "__main__":
    main()

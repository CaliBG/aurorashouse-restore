"""Single source of truth for mapping a remote asset URL -> local path under src/.
Both the downloader and the HTML/CSS localizer import this, so download targets and
rewritten references always agree (no URL-encoding mismatches)."""
import re
from urllib.parse import urlsplit, unquote

ASSET_ROOT = "assets"  # under src/

def _decode(s):
    # repeatedly unquote to flatten double-encoding (%2520 -> %20 -> ' ')
    prev = None
    while prev != s:
        prev = s
        s = unquote(s)
    return s

def _sanitize(name):
    # keep it filesystem- and URL-safe: spaces/@/() etc -> _
    name = name.replace("&amp;", "_")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name

def local_path_for(url):
    """Return a clean repo-relative path like 'assets/wf-65b94.../abcd_file.png'.
    Returns None for URLs we intentionally do NOT localize (youtube, instagram...)."""
    u = urlsplit(url)
    host = u.netloc.lower()
    path = _decode(u.path)
    base = path.rsplit("/", 1)[-1] or "index"

    if host == "cdn.prod.website-files.com":
        # /<siteid>/<file>  -> assets/wf-<siteid8>/<sanitized base>
        parts = [p for p in path.split("/") if p]
        siteid = parts[0] if parts else "misc"
        return f"{ASSET_ROOT}/wf-{siteid[:12]}/{_sanitize(base)}"
    if host in ("use.typekit.net", "p.typekit.net", "use.typekit.com"):
        # typekit css + font files; preserve subpath to avoid collisions
        sub = _sanitize(path.strip("/").replace("/", "__")) or "typekit"
        return f"{ASSET_ROOT}/typekit/{sub}"
    if host == "d3e54v103j8qbb.cloudfront.net":
        if base.endswith(".js") or "jquery" in base:
            return f"{ASSET_ROOT}/js/jquery-3.5.1.min.js"
        # webflow default shared static assets (svg placeholders, bg image, etc.)
        return f"{ASSET_ROOT}/wf-shared/{_sanitize(base)}"
    if host == "ajax.googleapis.com":
        return f"{ASSET_ROOT}/js/{_sanitize(base)}"
    if host in ("fonts.googleapis.com", "fonts.gstatic.com"):
        # google fonts (Lora) — loaded via WebFont loader; localize css + files
        sub = _sanitize((host + path).replace("/", "__"))
        return f"{ASSET_ROOT}/gfonts/{sub}"
    return None  # leave remote (youtube, instagram, webflow.com badge, etc.)

# hosts we localize (for discovery filters)
KEEP_HOSTS = {
    "cdn.prod.website-files.com", "use.typekit.net", "p.typekit.net",
    "use.typekit.com", "d3e54v103j8qbb.cloudfront.net", "ajax.googleapis.com",
    "fonts.googleapis.com", "fonts.gstatic.com",
}

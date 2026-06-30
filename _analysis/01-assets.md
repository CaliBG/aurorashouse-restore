# Module 01 — Assets (capture, download, localize)

## Outcome
All first-party assets the live site loads are mirrored locally and the rebuild renders
with **0 page errors** and **0 missing assets** (verified by a full-browser network sweep
of all 16 pages). Total: **1645 files, ~847 MB**.

| type | count | notes |
|------|------:|-------|
| png  | 886 | most imagery + responsive `-p-500/800/1080/…` variants |
| jpg/jpeg | 371 / 23 | photos + posters |
| mp4  | 61 | background + inline video (paired with webm) |
| webm | 61 | "  (Chromium prefers webm; mp4 source is ERR_ABORTED — same as live) |
| gif  | 4 | |
| woff2 | 7 | **Lora** (Google), variable font, 7 subsets — localized |
| ttf  | 5 | Helvetica family, @font-face in shared CSS |
| typekit | ~210 | Adobe Typekit `af_*` (a/d/l = woff2/woff/opentype) × ~70 faces |
| js   | 6 | jQuery, webfont.js, webflow.js + chunks |
| css  | 4 | shared webflow css, typekit wzm6vjt + p, lora.css |
| svg  | 2 | webflow default placeholders (cloudfront) |

## Pipeline (scripts/)
1. `01-capture-html.sh` — curl all 16 routes → `_capture/pages/*.html` (read-only truth).
2. `02-download-assets.py` — discover first-party URLs from HTML (+ parse downloaded
   CSS/JSON for more), download concurrently to `src/assets/`. Resumable.
3. `capture-network.mjs` — Playwright loads every page, scrolls, records **every** network
   request → `_analysis/asset-urls.txt` (the completeness oracle).
4. reconcile — every network URL must exist on disk (was 0 missing).
5. `03-localize.py` — rewrite all first-party URLs in HTML + CSS to local `/assets/…`.

## Local path scheme — `lib_paths.py::local_path_for(url)`
Single source of truth shared by downloader + localizer (so download targets and rewritten
refs always agree). Decodes encoding, sanitizes the basename, buckets by host:
- `cdn.prod.website-files.com/<siteid>/<file>` → `assets/wf-<siteid12>/<sanitized base>`
  - two site folders exist: `wf-65b9459accec` (current) + `wf-61c262650cbd` (reused old site)
- `use.typekit.net/…` → `assets/typekit/<flattened>`
- `d3e54v103j8qbb.cloudfront.net` → jQuery → `assets/js/jquery-3.5.1.min.js`; other (svg) → `assets/wf-shared/<base>`
- `ajax.googleapis.com` → `assets/js/<base>` ; `fonts.gstatic.com` → `assets/gfonts/<base>`

## Encoding gotchas solved (Webflow specifics)
- **srcset** filenames are `%20`-encoded → safe; descriptors (`500w`/`2x`) stripped only
  when they actually trail.
- **`data-video-urls`** = comma-joined `mp4,webm`; URLs may contain **raw spaces** and
  `%2F`-encoded slashes → special-cased.
- **`data-poster-url` / `src`** may contain raw spaces → single-URL attribute special-case.
- **inline `style="background-image:url(&quot;…&quot;)"`** filenames may contain spaces
  *and* parens (`PROCESS4 (2)…`) → matched between `&quot;` delimiters, not `)`.
- **SRI**: production HTML carries `integrity="sha384-…"` on css/js. We edit the shared CSS
  (rewrite url()) so its hash no longer matches → the browser blocks it → whole-page style
  loss. Fix: **strip all `integrity=` attributes** in localized HTML (same-origin, no need).
- **HTTP Range**: `<video>` needs `206 Partial Content`; the dev server (`scripts/serve.py`)
  implements range so video loads/seeks correctly.

## Remaining (benign, matches live)
- `*-transcode.mp4` requests show `net::ERR_ABORTED` — Chromium aborting the unused source
  when it picks webm. **The live site does the identical thing.** Not a defect.

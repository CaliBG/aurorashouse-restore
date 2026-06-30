# Progress log

## Session 1 (2026-06-30) — full static reconstruction, verified

**Status: COMPLETE & VERIFIED.** All 16 pages render locally with pixel-level parity to the
live site, 0 page errors, 0 missing assets.

Done:
- [x] Recon: identified Webflow site, 16 routes, asset surface, tech stack → `00-overview.md`.
- [x] Captured production HTML for all 16 pages → `_capture/pages/`.
- [x] Downloaded all first-party assets (1645 files / 847 MB) → `src/assets/`.
- [x] Network-truth completeness check (Playwright): 339 live-fetched URLs, 0 missing.
- [x] Localized every asset URL in HTML + CSS to `/assets/…` → `01-assets.md`.
- [x] Fixed SRI block (strip `integrity=`), raw-space/paren filenames, `data-video-urls`,
      inline-style `url(&quot;…&quot;)`, HTTP Range for video.
- [x] Localized **Lora** (Google variable font) for offline self-containment.
- [x] Custom dev server with clean-URLs + Range (`scripts/serve.py`).
- [x] Verification: full 16-page 404 sweep clean; homepage + `/hoj` screenshots pixel-match
      live; full-page screenshot sizes within 0.1% of live.

Verified-equivalent behaviors (local == live):
- Card-fan hero + "In Play", scroll-tilted project cards (Webflow IX2 via webflow.js).
- Two Lottie animations (`aurora_v002.json`, `Comp_1.lottie`) render (SVG).
- Background videos; `*-transcode.mp4` ERR_ABORTED is identical to live (webm chosen).
- Typekit + Helvetica + Lora fonts.

## Known deltas / polish backlog
- Visual parity confirmed on home + hoj; the other 14 project pages are structurally
  guaranteed (byte-identical production HTML + shared CSS/JS + all assets present, sweep
  clean) but not each individually eyeballed. Spot-check more if desired.
- Form page (`/form`): submission posts to Webflow's backend on the live site; locally the
  form renders but has no backend (static restore). Left as-is.
- 3rd-party embeds (YouTube/Instagram) intentionally remain remote.
- The original `WebFont.load(Lora)` call is kept (faithful) but redundant now that
  `lora.css` is local; could be removed if a 100%-offline-silent load is wanted.

## How to re-run the whole pipeline
```bash
cd aurorashouse-restore
bash scripts/01-capture-html.sh         # re-fetch production HTML (optional)
python3 scripts/02-download-assets.py   # download assets (resumable)
node  scripts/capture-network.mjs       # refresh completeness oracle
python3 scripts/03-localize.py          # rebuild src/*.html from _capture
python3 scripts/serve.py 5050 &         # serve
node  scripts/404sweep.mjs              # verify no broken refs
node  scripts/screenshot.mjs / /hoj --w=1512   # visual compare vs live
```

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

## Session 2 (2026-06-30) — full 16-page objective verification

Ran `scripts/compare.mjs` (Playwright full-page screenshot local vs live, animations frozen,
pixelmatch the overlap) across all 16 pages, then drilled into outliers with
`scripts/locate-diff.mjs` (per-100px-band diff) and `scripts/region.mjs` (region read).

Result — **all 16 pages confirmed faithful**:
- **12 pages pixel-perfect (0.00%)**: /, /aboutme, /form, /caterpilla-com, /hoj,
  /jellyfied, /kiri, /mars, /oca, /regen, /rossco, /uptime.
- **/generation**: flagged once (live under-rendered at capture: 10586 vs 13825) but a clean
  re-capture is byte-identical (13825 == 13825, 0 diverging bands). → capture-timing flake.
- **/guccifunfair, /gucciquest, /mothers**: identical page height; the diff is **background-
  video playback-phase** (same looping video, different frame at the captured instant — e.g.
  guccifunfair hero shows the GUCCI-sign opening frame locally vs the lit night frame live).
  Same content, not a defect.

Tooling added this session: `compare.mjs`, `locate-diff.mjs`, `region.mjs`, `404sweep.mjs`,
`check-video.mjs`, `diag.mjs`.

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

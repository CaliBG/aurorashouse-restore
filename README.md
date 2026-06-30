# Aurora's House — source reconstruction

**Live (this rebuild):** https://calibg.github.io/aurorashouse-restore/

Reconstruction of the deployed personal portfolio **https://aurorashouse.webflow.io**
("Aurora's House") from its live production build, after the original source was lost to a
disk failure. The site was built in **Webflow**; since Webflow publishes static
HTML/CSS/JS + CDN assets, this rebuild is a faithful, fully-localized static mirror that
runs offline and renders pixel-for-pixel like the live site.

## Run it
```bash
python3 scripts/serve.py 5050      # no dependencies needed to just view the site
# open http://localhost:5050
```
The server provides Webflow-style clean URLs (`/aboutme` → `aboutme.html`) and HTTP Range
support (so `<video>` plays/seeks). Any static server works too, but clean URLs + range are
needed for full fidelity.

## What's here
```
src/                 the runnable reconstructed site (THE DELIVERABLE)
  *.html             16 pages: home, aboutme, form, + 13 project pages
  assets/            all localized assets (847 MB): images, video, fonts, js, css
_capture/pages/      raw production HTML (read-only reference truth)
_analysis/           reverse-engineering docs + progress log
scripts/             capture / download / localize / serve / screenshot / verify tooling
package.json         Playwright (only needed to re-run capture/verify, not to view)
```

## Pages (16)
`/` · `/aboutme` · `/form` · and projects `caterpilla-com` `generation` `guccifunfair`
`gucciquest` `hoj` `jellyfied` `kiri` `mars` `mothers` `oca` `regen` `rossco` `uptime`.

## Stack reproduced
Standard Webflow output: shared CSS, jQuery + webflow.js (drives all IX2 scroll
interactions via `data-w-id`), 2 Lottie animations, Adobe Typekit + Helvetica + Google
Lora fonts, a custom cursor, background videos. No custom app logic — interactions are
reproduced exactly because the original `webflow.js` + page data-attributes are unchanged.

## Fidelity
Verified: full 16-page browser sweep with **0 errors / 0 missing assets**; home and `/hoj`
screenshots are pixel-identical to live. See `_analysis/progress.md` for details and the
small list of intentional deltas (e.g. the contact form has no backend in a static mirror;
YouTube/Instagram embeds stay remote).

## Re-running the pipeline
See the command block at the bottom of `_analysis/progress.md`.
```bash
npm install        # only if you want to re-run capture/verify (Playwright)
```

## Deploy / redeploy to GitHub Pages
The site is served from the **`gh-pages`** branch (repo root), with all root-relative paths
rewritten to the `/aurorashouse-restore/` project subpath by `scripts/05-prefix-for-pages.py`.
`main` keeps the clean root-relative `src/` for local preview. To redeploy after changing
`src/`:
```bash
WT=../.aurora-ghp
git worktree add --orphan -b gh-pages-tmp "$WT" && git -C "$WT" checkout main -- src
( cd "$WT" && shopt -s dotglob && mv src/* . && rmdir src )
python3 scripts/05-prefix-for-pages.py "/aurorashouse-restore" "$WT"
git -C "$WT" add -A && git -C "$WT" reset --soft main \
  && git -C "$WT" commit -m "deploy" && git -C "$WT" push -f origin gh-pages-tmp:gh-pages
git worktree remove --force "$WT"
```
(A `.github/workflows/pages.yml` Actions deploy is the cleaner long-term option but needs a
token with the `workflow` scope — the current push token lacks it.)


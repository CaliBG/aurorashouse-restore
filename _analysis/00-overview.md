# Aurora's House — Source Reconstruction · Overview

> Reconstructing **https://aurorashouse.webflow.io** from its deployed production build.
> The original source was lost to a disk failure; only the live site remains.
> Strategy: faithful static mirror of the published Webflow output → localize all asset
> paths → runnable local project → verify visually against the live site, iterate to parity.

## What this site is

- **Platform:** Webflow (static export). `<meta name="generator" content="Webflow">`.
  - `data-wf-site="65b9459accec081c62b07754"`, `data-wf-page` per page.
  - Last Published: **Thu Jun 04 2026** (per HTML comment).
- **Owner/brand:** "Aurora" — a personal **portfolio** site.
  - Title: `Aurora's House`. Desc: "Hi, I'm Aurora. This is my portfolio…".
  - og:image: `…/67a61b0d928bb0266c43a93c_Quest-1.png`.
- **NOT related to** the `haoqi.design` reconstruction in `~/Desktop/vscode/网站复/`
  (that is a Next.js/three.js app — different project, different owner). Ignore it.

## Tech stack (all standard Webflow, minimal custom code)

- **CSS:** one shared stylesheet `css/aurorashouse.webflow.shared.897360989.css`.
- **JS:** jQuery 3.5.1 (cloudfront) + `webflow.340461f9.caf2c803f365974e.js` +
  2 chunks `webflow.schunk.5c0de8c2fa1ed806.js`, `webflow.schunk.f2efb3c5440a81cf.js`.
  These drive all **Webflow IX2 interactions** (elements carry `data-w-id`).
- **Fonts:** Adobe **Typekit** `https://use.typekit.net/wzm6vjt.css` + Google **Lora**
  (loaded via WebFont.load in inline script). 
- **Animation:** one **Lottie** JSON `…65b9459accec081c62b07785_aurora_v002.json`
  (the "rich motion" part — Lottie, not WebGL; no shader extraction needed).
- **Custom cursor:** `.cursor-wrapper { pointer-events: none; }` (only custom style).
- **Inline custom code (identical on ALL 16 pages, nothing per-page):**
  1. `WebFont.load({ google:{ families:["Lora:300,400,500,600,700"] }})`
  2. Webflow `w-mod-js` / `w-mod-touch` detection shim
  3. the one-line cursor style above
- **Embeds:** standard YouTube iframes in content (aboutme=8, mars=6, guccifunfair=3);
  Instagram links on aboutme. No custom JS logic anywhere.

## Asset CDN

- Host: `cdn.prod.website-files.com`
- Two site folders referenced:
  - `65b9459accec081c62b07754/` — the CURRENT Aurora site
  - `61c262650cbd45339cd81ef9/` — an OLDER Webflow site whose assets are reused here
  - Both are publicly fetchable.
- Volume: media-heavy. ~700+ distinct files; mix of png (most), jpg/jpeg, **mp4 (57)**,
  **webm (114)**, gif, 1 .lottie, 1 .json, fonts. (Counts are pre-dedup regex estimates.)

## Page inventory (16 routes)

| route | role |
|-------|------|
| `/`              | Home (nav + project grid + Lottie + custom cursor) |
| `/aboutme`       | About (YouTube embeds, instagram links) |
| `/form`          | Contact form |
| `/caterpilla-com`| project |
| `/generation`    | project |
| `/guccifunfair`  | project (YouTube) |
| `/gucciquest`    | project |
| `/hoj`           | project |
| `/jellyfied`     | project |
| `/kiri`          | project |
| `/mars`          | project (YouTube) |
| `/mothers`       | project (largest HTML, 60KB) |
| `/oca`           | project |
| `/regen`         | project |
| `/rossco`        | project |
| `/uptime`        | project |

## Reconstruction plan (modules)

0. **Recon** ✅ — tech, pages, assets mapped (this doc).
1. **HTML capture** ✅ — all 16 pages saved to `_capture/pages/` (production truth, read-only).
2. **Network-truth asset manifest** — Playwright loads each page, scrolls, records every
   network request → definitive asset list (`_analysis/asset-manifest.*`).
3. **Asset download** — mirror all assets under `src/` preserving CDN path structure
   (`src/cdn/<siteid>/<file>`), plus js/css/fonts.
4. **Localize** — rewrite every absolute CDN/typekit/jquery URL in HTML+CSS to local
   relative paths. Keep YouTube/Instagram as remote (external content).
5. **Serve & verify** — `npx serve src` on :5050; Playwright screenshots local vs live at
   desktop+mobile widths, per page; diff; fix; iterate to parity.
6. **Polish & doc** — README, run instructions, known-deltas log in `progress.md`.

## Directory layout

```
aurorashouse-restore/
  _capture/pages/      production HTML (read-only truth)
  _capture/...         other raw production captures
  _analysis/           these docs (survive context compression)
  scripts/             capture + screenshot + localize scripts
  src/                 the runnable reconstructed site (the deliverable)
  package.json         playwright + serve
```

## Conventions / decisions

- **Deliverable form:** clean **static site** mirroring production (Webflow is static;
  this guarantees visual parity since we reuse the real assets). Not a framework rebuild.
- `_capture/` is never edited. `src/` is the working reconstruction.
- External third-party embeds (YouTube, Instagram, Google fonts CSS endpoint) may stay
  remote; first-party assets (website-files.com CDN, typekit fonts) are localized.

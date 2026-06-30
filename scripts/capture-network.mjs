// Load every page in a real browser, scroll to trigger lazy-loads, and record every
// network request the browser actually makes. This is the definitive asset list —
// it catches CSS-referenced fonts/bg-images, Lottie-internal images, videos, srcset
// picks, etc. that fragile HTML regexes miss.
//
// Output:
//   _analysis/network-by-page.json   { route: [url, ...] }
//   _analysis/asset-urls.txt         flat, deduped, sorted list of first-party asset URLs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://aurorashouse.webflow.io';
const ROUTES = ['/', '/aboutme', '/form', '/caterpilla-com', '/generation',
  '/guccifunfair', '/gucciquest', '/hoj', '/jellyfied', '/kiri', '/mars',
  '/mothers', '/oca', '/regen', '/rossco', '/uptime'];

// hosts whose assets we want to mirror locally (first-party + required libs)
const KEEP_HOSTS = [
  'cdn.prod.website-files.com',
  'use.typekit.net',
  'p.typekit.net',
  'use.typekit.com',
  'd3e54v103j8qbb.cloudfront.net', // jquery
  'ajax.googleapis.com',           // webfont.js
];

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 400;
      const timer = setInterval(() => {
        const sh = document.body.scrollHeight;
        window.scrollBy(0, step);
        total += step;
        if (total >= sh + 2000) { clearInterval(timer); resolve(); }
      }, 80);
    });
    window.scrollTo(0, 0);
  });
}

const byPage = {};
const all = new Set();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1512, height: 900 },
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
});

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const urls = new Set();
  page.on('request', (req) => {
    const u = req.url();
    try {
      const h = new URL(u).host;
      if (KEEP_HOSTS.includes(h)) { urls.add(u); all.add(u); }
    } catch {}
  });
  const url = BASE + route;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error(`  ! ${route} goto: ${e.message}`);
  }
  await autoScroll(page).catch(() => {});
  await page.waitForTimeout(1500);
  byPage[route] = [...urls].sort();
  console.log(`  ${route.padEnd(16)} ${urls.size} assets`);
  await page.close();
}

await browser.close();

fs.writeFileSync(path.join(ROOT, '_analysis/network-by-page.json'),
  JSON.stringify(byPage, null, 2));
fs.writeFileSync(path.join(ROOT, '_analysis/asset-urls.txt'),
  [...all].sort().join('\n') + '\n');

console.log(`\nTOTAL unique first-party asset URLs: ${all.size}`);

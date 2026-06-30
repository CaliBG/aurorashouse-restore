// Screenshot one or more routes from BOTH the local rebuild and the live site, so they
// can be compared side by side. Usage:
//   node scripts/screenshot.mjs <route> [route2 ...] [--w=1512] [--mobile] [--seg]
// Outputs to _capture/shots/<slug>__<local|live>[__<w>].png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, '_capture', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const args = process.argv.slice(2);
const routes = args.filter(a => !a.startsWith('--'));
const wArg = args.find(a => a.startsWith('--w='));
const width = wArg ? parseInt(wArg.split('=')[1], 10) : (args.includes('--mobile') ? 390 : 1512);
const height = args.includes('--mobile') ? 844 : 900;
const fullPage = !args.includes('--viewport');

const LOCAL = 'http://localhost:5050';
const LIVE = 'https://aurorashouse.webflow.io';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const slug = (r) => (r === '/' ? 'index' : r.replace(/^\//, '').replace(/\//g, '_'));

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0; const step = 500;
      const t = setInterval(() => {
        window.scrollBy(0, step); y += step;
        if (y >= document.body.scrollHeight + 1500) { clearInterval(t); res(); }
      }, 60);
    });
    window.scrollTo(0, 0);
  });
}

async function shot(page, base, route, tag) {
  const url = base + (route === '/' ? '/' : route);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error(`  ! ${tag} ${route}: ${e.message}`);
  }
  await autoScroll(page).catch(() => {});
  await page.waitForTimeout(1200);
  const out = path.join(SHOTS, `${slug(route)}__${tag}__${width}.png`);
  await page.screenshot({ path: out, fullPage });
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`  ${tag.padEnd(5)} ${route.padEnd(16)} -> ${path.basename(out)} (${kb}KB)`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height }, deviceScaleFactor: 1, userAgent: UA,
});
const page = await ctx.newPage();
for (const r of routes) {
  await shot(page, LOCAL, r, 'local');
  await shot(page, LIVE, r, 'live');
}
await browser.close();
console.log('done');

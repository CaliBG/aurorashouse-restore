// Capture a viewport-sized region at a given scroll-Y from local and live (frozen video),
// saved side-by-side-comparable. Usage: node scripts/region.mjs <route> <y> [width]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_capture', 'shots', 'region');
fs.mkdirSync(OUT, { recursive: true });
const route = process.argv[2] || '/';
const y = parseInt(process.argv[3] || '0', 10);
const width = parseInt(process.argv[4] || '1440', 10);
const slug = (route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '_')) + '_y' + y;
const LOCAL = 'http://localhost:5050', LIVE = 'https://aurorashouse.webflow.io';
const b = await chromium.launch();
for (const [tag, base] of [['local', LOCAL], ['live', LIVE]]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' });
  const p = await ctx.newPage();
  try { await p.goto(base + (route === '/' ? '/' : route), { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await p.evaluate(async () => { await new Promise(r => { let yy = 0; const t = setInterval(() => { window.scrollBy(0, 700); yy += 700; if (yy > document.body.scrollHeight + 1200) { clearInterval(t); r(); } }, 35); }); window.scrollTo(0, 0); }).catch(() => {});
  await p.evaluate(() => { document.querySelectorAll('video').forEach(v => { try { v.pause(); v.currentTime = 0; } catch (e) {} }); const s = document.createElement('style'); s.textContent = '*{animation-play-state:paused !important;transition:none !important}'; document.head.appendChild(s); }).catch(() => {});
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  await p.waitForTimeout(900);
  const out = path.join(OUT, `${slug}__${tag}.png`);
  await p.screenshot({ path: out });
  console.log(tag, '->', path.relative(ROOT, out));
  await p.close();
}
await b.close();

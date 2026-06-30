// For one route, capture local+live (frozen), then report per-band (100px) diff% so we can
// see WHERE the pages diverge without reading a huge image. Also dumps a cropped region.
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = process.argv[2] || '/';
const WIDTH = 1440, BAND = 100;
const LOCAL = 'http://localhost:5050', LIVE = 'https://aurorashouse.webflow.io';

async function shoot(ctx, base) {
  const p = await ctx.newPage();
  try { await p.goto(base + (route === '/' ? '/' : route), { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await p.evaluate(async () => { await new Promise(r => { let y = 0; const t = setInterval(() => { window.scrollBy(0, 700); y += 700; if (y > document.body.scrollHeight + 1200) { clearInterval(t); r(); } }, 35); }); window.scrollTo(0, 0); }).catch(() => {});
  await p.evaluate(() => { document.querySelectorAll('video').forEach(v => { try { v.pause(); v.currentTime = 0; } catch (e) {} }); const s = document.createElement('style'); s.textContent = '*{animation-play-state:paused !important;transition:none !important}'; document.head.appendChild(s); }).catch(() => {});
  await p.waitForTimeout(1000);
  const buf = await p.screenshot({ fullPage: true });
  await p.close();
  return PNG.sync.read(buf);
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' });
const a = await shoot(ctx, LOCAL), c = await shoot(ctx, LIVE);
console.log(`local ${a.width}x${a.height}  live ${c.width}x${c.height}`);
const w = Math.min(a.width, c.width), h = Math.min(a.height, c.height);
console.log('band(y)      diff%');
let firstBig = -1;
for (let y = 0; y < h; y += BAND) {
  const bh = Math.min(BAND, h - y);
  const da = Buffer.alloc(w * bh * 4), db = Buffer.alloc(w * bh * 4);
  for (let r = 0; r < bh; r++) { a.data.copy(da, r * w * 4, (y + r) * a.width * 4, (y + r) * a.width * 4 + w * 4); c.data.copy(db, r * w * 4, (y + r) * c.width * 4, (y + r) * c.width * 4 + w * 4); }
  const diff = Buffer.alloc(w * bh * 4);
  const n = pixelmatch(da, db, diff, w, bh, { threshold: 0.12 });
  const pct = n / (w * bh) * 100;
  if (pct > 2) { console.log(String(y).padStart(6), '  ', pct.toFixed(1)); if (firstBig < 0) firstBig = y; }
}
console.log('first divergence band y =', firstBig, ' (local taller by', a.height - c.height, 'px)');
b.close();

// Page-by-page fidelity check: screenshot local vs live (full page, animations frozen),
// pixelmatch the overlap, report diff% + write a diff image for any page that differs.
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_capture', 'shots', 'diff');
fs.mkdirSync(OUT, { recursive: true });

const LOCAL = 'http://localhost:5050';
const LIVE = 'https://aurorashouse.webflow.io';
const WIDTH = 1440;
const ROUTES = process.argv.slice(2).filter(a => !a.startsWith('--'));
const routes = ROUTES.length ? ROUTES : ['/', '/aboutme', '/form', '/caterpilla-com',
  '/generation', '/guccifunfair', '/gucciquest', '/hoj', '/jellyfied', '/kiri', '/mars',
  '/mothers', '/oca', '/regen', '/rossco', '/uptime'];
const slug = r => (r === '/' ? 'index' : r.replace(/^\//, '').replace(/\//g, '_'));

async function freezeAndShoot(page, base, route) {
  try { await page.goto(base + (route === '/' ? '/' : route), { waitUntil: 'networkidle', timeout: 60000 }); }
  catch (e) { /* continue with whatever rendered */ }
  // scroll through to trigger lazy content, then back to top deterministically
  await page.evaluate(async () => {
    await new Promise(r => { let y = 0; const t = setInterval(() => { window.scrollBy(0, 700); y += 700; if (y > document.body.scrollHeight + 1200) { clearInterval(t); r(); } }, 35); });
    window.scrollTo(0, 0);
  }).catch(() => {});
  // freeze all animation sources so the two captures are comparable
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach(v => { try { v.pause(); v.currentTime = 0; } catch (e) {} });
    try { window.lottie && window.lottie.pause && window.lottie.pause(); } catch (e) {}
    try { window.Webflow && window.Webflow.require && window.Webflow.require('lottie').lottie.pause(); } catch (e) {}
    const s = document.createElement('style');
    s.textContent = '*{animation-play-state:paused !important;transition:none !important;caret-color:transparent !important}';
    document.head.appendChild(s);
  }).catch(() => {});
  await page.waitForTimeout(1200);
  return await page.screenshot({ fullPage: true });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' });

console.log('route'.padEnd(16), 'localH', 'liveH', 'diff%', 'verdict');
const results = [];
for (const route of routes) {
  const p1 = await ctx.newPage();
  const localBuf = await freezeAndShoot(p1, LOCAL, route);
  await p1.close();
  const p2 = await ctx.newPage();
  const liveBuf = await freezeAndShoot(p2, LIVE, route);
  await p2.close();

  const a = PNG.sync.read(localBuf), b = PNG.sync.read(liveBuf);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  // crop both to w×h (top-left aligned)
  const crop = (img) => {
    if (img.width === w && img.height === h) return img.data;
    const out = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) img.data.copy(out.data, y * w * 4, y * img.width * 4, y * img.width * 4 + w * 4);
    return out.data;
  };
  const da = crop(a), db = crop(b);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(da, db, diff.data, w, h, { threshold: 0.12, includeAA: false });
  const pct = (n / (w * h) * 100);
  const heightDelta = Math.abs(a.height - b.height);
  const verdict = pct < 1.2 && heightDelta < 40 ? 'OK' : (pct < 4 ? 'minor' : 'CHECK');
  results.push({ route, pct, heightDelta, lh: a.height, vh: b.height, verdict });
  if (verdict !== 'OK') fs.writeFileSync(path.join(OUT, slug(route) + '.diff.png'), PNG.sync.write(diff));
  console.log(route.padEnd(16), String(a.height).padEnd(6), String(b.height).padEnd(6), pct.toFixed(2).padStart(6), verdict);
}
await browser.close();
console.log('\nSummary:');
for (const v of ['CHECK', 'minor', 'OK']) {
  const rs = results.filter(r => r.verdict === v);
  if (rs.length) console.log(`  ${v}: ${rs.map(r => r.route).join(', ')}`);
}

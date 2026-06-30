// Load every local route, scroll, and report any 4xx/failed asset requests + page errors.
import { chromium } from 'playwright';
const BASE = 'http://localhost:5050';
const ROUTES = ['/', '/aboutme', '/form', '/caterpilla-com', '/generation',
  '/guccifunfair', '/gucciquest', '/hoj', '/jellyfied', '/kiri', '/mars',
  '/mothers', '/oca', '/regen', '/rossco', '/uptime'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 900 } });
let totalBad = 0, totalErr = 0;
for (const route of ROUTES) {
  const p = await ctx.newPage();
  const bad = new Set(), errs = new Set();
  p.on('response', r => { if (r.status() >= 400) bad.add('HTTP' + r.status() + ' ' + r.url().replace(BASE, '')); });
  p.on('requestfailed', r => { const u = r.url(); if (u.startsWith(BASE)) bad.add('FAIL ' + u.replace(BASE, '')); });
  p.on('pageerror', e => errs.add(e.message.slice(0, 120)));
  try { await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await p.evaluate(async () => { await new Promise(r => { let y = 0; const t = setInterval(() => { window.scrollBy(0, 600); y += 600; if (y > document.body.scrollHeight + 1000) { clearInterval(t); r(); } }, 40); }); }).catch(() => {});
  await p.waitForTimeout(800);
  totalBad += bad.size; totalErr += errs.size;
  const flag = bad.size || errs.size ? '⚠' : '✓';
  console.log(`${flag} ${route.padEnd(16)} bad=${bad.size} err=${errs.size}`);
  [...bad].slice(0, 12).forEach(x => console.log('     ', x));
  [...errs].slice(0, 5).forEach(x => console.log('     ERR', x));
  await p.close();
}
console.log(`\nTOTAL bad-requests=${totalBad}  page-errors=${totalErr}`);
await b.close();

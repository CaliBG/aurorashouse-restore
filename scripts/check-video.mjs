import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [tag, base] of [['LOCAL', 'http://localhost:5050'], ['LIVE', 'https://aurorashouse.webflow.io']]) {
  const ctx = await b.newContext({ viewport: { width: 1512, height: 900 } });
  const p = await ctx.newPage();
  const fails = [];
  p.on('requestfailed', r => { if (/\.(mp4|webm)/.test(r.url())) fails.push((r.failure()?.errorText || '?') + '  ' + r.url().split('/').pop().slice(0, 42)); });
  try { await p.goto(base + '/oca', { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await p.waitForTimeout(2500);
  console.log(`\n=== ${tag} /oca  video requestfailed (${fails.length}) ===`);
  [...new Set(fails)].forEach(x => console.log('  ', x));
  await p.close();
}
await b.close();

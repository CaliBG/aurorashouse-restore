// Diagnostic: load a local route, capture console errors, failed/4xx requests,
// and the runtime state of Webflow / jQuery / Lottie / IX2.
import { chromium } from 'playwright';
const route = process.argv[2] || '/';
const base = process.argv[3] || 'http://localhost:5050';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1512, height: 900 } });
const p = await ctx.newPage();
const errs = [], fails = [], cons = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().slice(0, 180)); });
p.on('pageerror', e => errs.push(e.message.slice(0, 220)));
p.on('requestfailed', r => fails.push((r.failure()?.errorText || 'failed') + ' ' + r.url().slice(0, 130)));
p.on('response', r => { if (r.status() >= 400) fails.push('HTTP' + r.status() + ' ' + r.url().slice(0, 130)); });
await p.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const lottie = [...document.querySelectorAll('[data-animation-type="lottie"]')].map(e => ({
    src: (e.getAttribute('data-src') || '').slice(-50), hasSvg: !!e.querySelector('svg'),
    hasCanvas: !!e.querySelector('canvas'), childN: e.children.length }));
  return {
    bodyH: document.body.scrollHeight,
    wfReady: typeof window.Webflow !== 'undefined',
    jq: typeof window.jQuery !== 'undefined',
    lottieEls: lottie,
    ixNodes: document.querySelectorAll('[data-w-id]').length,
    title: document.title,
  };
});
console.log('=== PAGE INFO ' + route + ' ===');
console.log(JSON.stringify(info, null, 2));
console.log('\n=== pageerrors (' + errs.length + ') ==='); errs.slice(0, 15).forEach(e => console.log(' ', e));
console.log('\n=== failed/4xx requests (' + [...new Set(fails)].length + ') ==='); [...new Set(fails)].slice(0, 25).forEach(e => console.log(' ', e));
console.log('\n=== console errors/warnings (' + [...new Set(cons)].length + ') ==='); [...new Set(cons)].slice(0, 15).forEach(e => console.log(' ', e));
await b.close();

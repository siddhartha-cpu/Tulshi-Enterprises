// Start the site first (npx netlify dev --port 8888), then: node dev-tools/check.cjs <outdir> [pages...]  - console errors, failed requests, sideways overflow, full-page screenshots
const { chromium } = require('playwright');
const OUT = process.argv[2];
const PAGES = process.argv.length > 3 ? process.argv.slice(3) : ['index', 'about', 'services', 'projects', 'gallery', 'clientele', 'contact', 'business_enquiry', '404'];
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  let bad = 0;
  for (const w of [1440, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    for (const pg of PAGES) {
      const p = await ctx.newPage();
      const errs = [];
      p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      p.on('pageerror', e => errs.push('pageerror: ' + e.message));
      p.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) errs.push(r.status() + ' ' + r.url()); });
      await p.goto('http://localhost:8888/' + pg + '.html', { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } window.scrollTo(0, 0); });
      await p.waitForLoadState('networkidle'); await p.waitForTimeout(400);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) errs.push('overflow ' + over + 'px');
      const e404 = pg === '404' ? errs.filter(x => !x.startsWith('404 ')) : errs;
      if (e404.length) { bad++; console.log('PROBLEM', pg, w, e404.slice(0, 5).join(' | ')); }
      await p.screenshot({ path: OUT + '/' + pg + '-' + w + '.png', fullPage: true });
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log(bad ? bad + ' page(s) with problems' : 'ALL CLEAN');
})();

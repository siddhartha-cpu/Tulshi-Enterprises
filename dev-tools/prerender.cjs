// Bakes the built-in projects and gallery into projects.html / gallery.html using the site's own script,
// so visitors and search engines get the content in the HTML (no jump when the script runs).
// Content sits between <!--pre:ID--> markers inside each container, so this can be re-run safely.
// node dev-tools/prerender.cjs <site dir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2]);

function clearBaked(html, id) {
  return html.replace(new RegExp('<!--pre:' + id + '-->[\\s\\S]*?<!--/pre:' + id + '-->'), '');
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/api/**', r => r.abort());           // built-in list only
  for (const [file, ids] of [['projects.html', ['projectGrid']], ['gallery.html', ['galFilters', 'galGrid']]]) {
    const full = path.join(SITE, file);
    let html = fs.readFileSync(full, 'utf8');
    for (const id of ids) html = clearBaked(html, id);     // start from the empty containers
    fs.writeFileSync(full, html);
    const p = await ctx.newPage();
    await p.goto('file://' + full);
    await p.waitForFunction(id => document.getElementById(id) && document.getElementById(id).children.length > 0, ids[ids.length - 1], { timeout: 15000 });
    for (const id of ids) {
      const inner = await p.$eval('#' + id, el => el.innerHTML);
      const re = new RegExp('(<div[^>]*id="' + id + '"[^>]*>)(</div>)');
      if (!re.test(html)) throw new Error('empty container #' + id + ' not found in ' + file);
      html = html.replace(re, (m, a, c) => a + '<!--pre:' + id + '-->' + inner + '<!--/pre:' + id + '-->' + c);
    }
    if (file === 'gallery.html') {
      const hidden = await p.$eval('#galMore', el => el.hidden);
      if (!hidden) html = html.replace(/(<button[^>]*id="galMore")\s+hidden>/, '$1>');
    }
    fs.writeFileSync(full, html);
    console.log('prerendered', file, html.length);
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

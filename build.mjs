// Netlify build step.
// 1. Turns the original projects in assets/js/projects.js into netlify/lib/builtin-projects.mjs,
//    so the admin portal starts with them (photos stay where they are, in gallery/).
// 2. Copies the website (and nothing else) into "dist". The server code, this script and the
//    package files stay private.
// Run it yourself with "node build.mjs" after changing assets/js/projects.js by hand.
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

/* ---------- 1. original projects for the admin portal ---------- */
const box = { window: {} };
vm.runInNewContext(readFileSync('assets/js/projects.js', 'utf8'), box, { timeout: 2000 });
const list = (box.window.PROJECTS || []).map((p) => {
  const photos = (p.photos || []).map((ph) => ({
    n: ph.n, caption: ph.title || '', desc: ph.desc || '', tag: ph.tag || '', place: ph.place || '', note: ph.note || ''
  }));
  return {
    id: p.id, builtin: true, title: p.title || '', short: p.short || '', name: p.name || '', loc: p.loc || '',
    client: p.client || '', tags: p.tags || [], specs: p.specs || [], blurb: p.blurb || '', desc: p.desc || '',
    cover: Math.max(0, photos.findIndex((ph) => ph.n === p.cover)), pos: p.pos || '', photos
  };
});
mkdirSync('netlify/lib', { recursive: true });
writeFileSync('netlify/lib/builtin-projects.mjs',
  '// Made by build.mjs from assets/js/projects.js. Do not edit here; edit projects.js and run "node build.mjs".\n' +
  'export default ' + JSON.stringify(list, null, 1) + ';\n');
console.log('Original projects for the admin portal: ' + list.length + ' (' + list.reduce((a, p) => a + p.photos.length, 0) + ' photos).');

/* ---------- 2. the website ---------- */
const PRIVATE = new Set(['dist', 'netlify', 'node_modules', '.netlify', '.git', 'build.mjs', 'netlify.toml',
  'package.json', 'package-lock.json', 'README.md', '.gitignore', 'vercel.json', '.htaccess', '.DS_Store', 'dev-tools']);

rmSync('dist', { recursive: true, force: true });
let copied = 0;
for (const name of readdirSync('.')) {
  if (PRIVATE.has(name)) continue;
  cpSync(name, 'dist/' + name, { recursive: true });
  copied++;
}
console.log('Website copied to dist (' + copied + ' items).');

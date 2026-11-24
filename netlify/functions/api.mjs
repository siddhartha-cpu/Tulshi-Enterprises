/* =========================================================
   M/S. Tulshi Enterprises — admin portal server (Netlify Function)

   Everything shown in Field execution and the Gallery is managed from
   /admin and kept in Netlify Blobs (Netlify's built-in storage), so it
   survives new deploys. The original projects (assets/js/projects.js,
   photos in gallery/) are added automatically the first time, and can
   then be edited or deleted like any other post.

   Public
     GET    /api/content               all projects + gallery photos
     GET    /api/img/<key>             one uploaded photo
   Admin (signed in)
     POST   /api/admin/login           { username, password }
     POST   /api/admin/logout
     GET    /api/admin/me
     GET    /api/admin/content
     POST   /api/admin/upload          one JPEG photo -> { key }
     POST   /api/admin/projects        post a project
     PUT    /api/admin/projects/<id>   edit a project
     DELETE /api/admin/projects/<id>
     POST   /api/admin/restore         bring back deleted original projects
     POST   /api/admin/gallery         post gallery photos
     PATCH  /api/admin/gallery/<id>    edit a caption
     DELETE /api/admin/gallery/<id>

   Sign-in uses ADMIN_USERNAME / ADMIN_PASSWORD from
   Netlify > Project configuration > Environment variables (redeploy after changing them).
   There is no built-in password: without ADMIN_PASSWORD nobody can sign in.
   ========================================================= */
import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/cache';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import BUILTIN from '../lib/builtin-projects.mjs';

export const config = { path: '/api/*' };

const env = (k) => {
  try { if (globalThis.Netlify && globalThis.Netlify.env) { const v = globalThis.Netlify.env.get(k); if (v) return v; } } catch (e) { /* not on Netlify */ }
  return process.env[k] || '';
};
const adminUser = () => (env('ADMIN_USERNAME') || 'admin').trim().toLowerCase();
const adminPass = () => env('ADMIN_PASSWORD');

const SESSION_SECONDS = 12 * 60 * 60;   // stay signed in for 12 hours
const MAX_TRIES = 5;                     // wrong passwords before a pause
const LOCK_MS = 15 * 60 * 1000;          // pause length
const MAX_IMAGE = 4 * 1024 * 1024;       // per photo, after the browser has resized it
const MAX_PROJECTS = 200, MAX_GALLERY = 600, MAX_PHOTOS = 40, MAX_BATCH = 30;
const CONTENT_TAG = 'tulshi-content';

const TYPES = {
  street: 'Street lighting', highmast: 'High masts', lines: 'MV & LT lines',
  civil: 'Civil foundations & RCC', cabling: 'Underground cabling', panels: 'Feeder pillars & junction boxes',
  maintenance: 'Repair & maintenance', poles: 'Pole & material supply'
};
const KEY_RE = /^[a-z0-9]{6,12}-[a-f0-9]{16}$/;  // photo keys
const ID_RE = /^[a-z0-9]{6,12}-[a-f0-9]{8}$/;    // post ids
const PROJECT_ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/; // post ids and the original projects' ids
const BUILTIN_IDS = new Set(BUILTIN.map((p) => p.id));
const BUILTIN_NUMS = new Set(BUILTIN.flatMap((p) => p.photos.map((ph) => ph.n))); // photos in gallery/
const clone = (o) => JSON.parse(JSON.stringify(o));

const contentStore = () => getStore({ name: 'tulshi-content', consistency: 'strong' });
const imageStore = () => getStore({ name: 'tulshi-images', consistency: 'strong' });

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* ---------- small helpers ---------- */
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
const fail = (status, error) => json({ error }, status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newId = (bytes) => Date.now().toString(36) + '-' + randomBytes(bytes).toString('hex');
const arr = (v) => (Array.isArray(v) ? v : []);
// one line of text: no control characters, single spaces
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// a paragraph: keeps line breaks
const para = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const sameText = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

async function readJson(req, maxBytes) {
  const text = await req.text();
  if (!text || text.length > maxBytes) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}

async function purge(tags) {
  try { await purgeCache({ tags }); } catch (e) { /* local preview or no cache yet: nothing to clear */ }
}

/* ---------- sessions (signed cookie, no passwords stored in the browser) ---------- */
let cachedSecret = '';
async function secret() {
  const fromEnv = env('ADMIN_SESSION_SECRET');
  if (fromEnv) return fromEnv;
  if (cachedSecret) return cachedSecret;
  const s = contentStore();
  let v = await s.get('config/session-secret');
  if (!v) {
    const fresh = randomBytes(32).toString('hex');
    const w = await s.set('config/session-secret', fresh, { onlyIfNew: true });
    v = w.modified ? fresh : await s.get('config/session-secret');
  }
  cachedSecret = v;
  return v;
}
// changing the username or password signs everyone out
async function signingKey() { return createHmac('sha256', await secret()).update('session|' + adminUser() + '|' + adminPass()).digest(); }
async function makeToken() {
  const payload = Buffer.from(JSON.stringify({ u: adminUser(), exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', await signingKey()).update(payload).digest('base64url');
}
const isHttps = (req) => new URL(req.url).protocol === 'https:';
const cookieName = (req) => (isHttps(req) ? '__Host-tulshi_admin' : 'tulshi_admin');
function sessionCookie(req, value, maxAge) {
  return cookieName(req) + '=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (isHttps(req) ? '; Secure' : '');
}
async function signedIn(req) {
  const raw = req.headers.get('cookie') || '';
  const name = cookieName(req) + '=';
  const part = raw.split(/;\s*/).find((c) => c.startsWith(name));
  if (!part) return false;
  const [payload, sig] = part.slice(name.length).split('.');
  if (!payload || !sig) return false;
  const want = createHmac('sha256', await signingKey()).update(payload).digest();
  let got;
  try { got = Buffer.from(sig, 'base64url'); } catch (e) { return false; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return p.u === adminUser() && typeof p.exp === 'number' && p.exp > Date.now();
  } catch (e) { return false; }
}

// state-changing requests must come from our own admin page
function fromAdminPage(req) {
  if (req.headers.get('x-requested-with') !== 'tulshi-admin') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === new URL(req.url).host || host === req.headers.get('host') || host === req.headers.get('x-forwarded-host');
  } catch (e) { return false; }
}

/* ---------- sign in / out ---------- */
async function login(req, context) {
  const body = await readJson(req, 2048);
  if (!body) return fail(400, 'Enter your username and password.');
  const s = contentStore();
  const who = createHash('sha256').update(String((context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown')).digest('hex').slice(0, 32);
  const key = 'auth/tries/' + who;
  const now = Date.now();
  let rec = (await s.get(key, { type: 'json' })) || { n: 0, until: 0, first: now };
  if (rec.until > now) return fail(429, 'Too many wrong tries. Please wait ' + Math.ceil((rec.until - now) / 60000) + ' minutes and try again.');
  if (!adminPass()) return fail(503, 'The admin password has not been set up yet. Add ADMIN_PASSWORD in Netlify and redeploy.');

  const okUser = sameText(line(body.username, 100).toLowerCase(), adminUser());
  const okPass = sameText(String(body.password == null ? '' : body.password).slice(0, 200), adminPass());
  if (!(okUser && okPass)) {
    if (now - rec.first > LOCK_MS) rec = { n: 0, until: 0, first: now };
    rec.n += 1;
    const locked = rec.n >= MAX_TRIES;
    if (locked) rec = { n: 0, until: now + LOCK_MS, first: now };
    await s.setJSON(key, rec);
    await sleep(400);
    return fail(locked ? 429 : 401, locked
      ? 'Too many wrong tries. Please wait ' + LOCK_MS / 60000 + ' minutes and try again.'
      : 'Wrong username or password.');
  }
  await s.delete(key).catch(() => {});
  return json({ ok: true, user: adminUser() }, 200, { 'Set-Cookie': sessionCookie(req, await makeToken(), SESSION_SECONDS) });
}

/* ---------- all content (one small index file) ---------- */
const INDEX_KEY = 'content/index';
// Reads the index and adds any original project that isn't there yet (first run, or one added
// to projects.js later), unless the admin deleted it.
async function loadIndex() {
  const r = await contentStore().getWithMetadata(INDEX_KEY, { type: 'json' });
  const raw = r && r.data && typeof r.data === 'object' ? r.data : {};
  const doc = {
    seeded: raw.seeded === true,
    removedBuiltin: arr(raw.removedBuiltin).filter((id) => BUILTIN_IDS.has(id)),
    projects: arr(raw.projects),
    gallery: arr(raw.gallery)
  };
  const have = new Set(doc.projects.map((p) => p.id));
  const missing = BUILTIN.filter((b) => !have.has(b.id) && doc.removedBuiltin.indexOf(b.id) < 0);
  const changed = !doc.seeded || missing.length > 0;
  doc.projects.push(...missing.map(clone));
  doc.seeded = true;
  return { doc, exists: !!r, etag: r ? r.etag : null, changed };
}
function writeIndex(doc, exists, etag) {
  const s = contentStore();
  return !exists ? s.setJSON(INDEX_KEY, doc, { onlyIfNew: true })
    : etag ? s.setJSON(INDEX_KEY, doc, { onlyIfMatch: etag })
      : s.setJSON(INDEX_KEY, doc); // storage gave no version tag (local preview): plain save
}
// read, change and save; retries if two saves happen at the same moment
async function updateIndex(change) {
  for (let i = 0; i < 5; i++) {
    const { doc, exists, etag } = await loadIndex();
    const result = change(doc);
    const w = await writeIndex(doc, exists, etag);
    if (w.modified) { await purge([CONTENT_TAG]); return result; }
    await sleep(120 * (i + 1));
  }
  throw new HttpError(409, 'Another save happened at the same moment. Please try again.');
}
async function currentIndex() {
  const x = await loadIndex();
  if (x.changed) { try { await writeIndex(x.doc, x.exists, x.etag); } catch (e) { /* saved next time */ } }
  return x.doc;
}
const publicView = (doc) => ({ seeded: true, projects: doc.projects, gallery: doc.gallery });

async function publicContent() {
  const doc = await currentIndex();
  return new Response(JSON.stringify(publicView(doc)), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=600, stale-while-revalidate=60',
      'Netlify-Cache-Tag': CONTENT_TAG,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
async function adminContent() {
  const doc = await currentIndex();
  const removed = doc.removedBuiltin.map((id) => { const b = BUILTIN.find((x) => x.id === id); return b ? b.title : id; });
  return json({ ...publicView(doc), removed });
}

/* ---------- photos ---------- */
async function upload(req) {
  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'image/jpeg') return fail(415, 'Photos must be JPEG.');
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE) return fail(413, 'That photo is too large.');
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return fail(400, 'The photo was empty.');
  if (buf.length > MAX_IMAGE) return fail(413, 'That photo is too large.');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return fail(415, 'That file is not a photo.');
  const key = newId(8);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await imageStore().set(key, ab, { metadata: { type: 'image/jpeg', size: buf.length, at: Date.now() } });
  return json({ key });
}

async function servePhoto(key) {
  if (!KEY_RE.test(key)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const data = await imageStore().get(key, { type: 'arrayBuffer' });
  if (!data) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable',
      'Netlify-Cache-Tag': 'photo-' + key,
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

// a photo is either an original one (n = its number in gallery/) or an uploaded one (img + thumb keys)
const isOriginal = (ph) => ph && Number.isInteger(ph.n);
const photoRef = (ph) => (isOriginal(ph) ? 'n' + ph.n : 'k' + ph.img);
const keysOf = (list) => list.filter((ph) => !isOriginal(ph)).flatMap((ph) => [ph.img, ph.thumb]);
const usedKeys = (doc) => new Set([...doc.projects.flatMap((p) => keysOf(arr(p.photos))), ...keysOf(doc.gallery)]);
const BAD_PHOTO = 'A photo did not finish uploading. Please try again.';

function readPhoto(p, allowOriginal) {
  const caption = line(p && p.caption, 140);
  if (allowOriginal && p && Number.isInteger(p.n)) {
    if (!BUILTIN_NUMS.has(p.n)) throw new HttpError(400, 'A photo was not recognised. Please reload the page and try again.');
    return { n: p.n, caption };
  }
  const o = { img: String((p && p.img) || ''), thumb: String((p && p.thumb) || ''), caption };
  if (!KEY_RE.test(o.img) || !KEY_RE.test(o.thumb)) throw new HttpError(400, BAD_PHOTO);
  return o;
}
async function photosMustExist(keys) {
  const s = imageStore();
  const found = await Promise.all(keys.map((k) => s.getMetadata(k).catch(() => null)));
  if (found.some((f) => !f)) throw new HttpError(400, BAD_PHOTO);
}
async function deletePhotos(keys, stillUsed) {
  keys = keys.filter((k) => KEY_RE.test(k) && !stillUsed.has(k));
  if (!keys.length) return;
  const s = imageStore();
  await Promise.allSettled(keys.map((k) => s.delete(k)));
  await purge(keys.map((k) => 'photo-' + k));
}

/* ---------- projects ---------- */
async function readProjectForm(req) {
  const b = await readJson(req, 128 * 1024);
  if (!b) throw new HttpError(400, 'Please fill in the form.');
  const title = line(b.title, 120), loc = line(b.loc, 160), client = line(b.client, 120), desc = para(b.desc, 2000);
  if (title.length < 3) throw new HttpError(400, 'Please enter the project name.');
  if (loc.length < 2) throw new HttpError(400, 'Please enter the location.');
  if (desc.length < 10) throw new HttpError(400, 'Please write a few words about the project.');
  const tags = [...new Set(arr(b.tags).map(String))].filter((t) => TYPES[t]);
  const specs = arr(b.specs).map((s) => line(s, 60)).filter(Boolean).slice(0, 6);
  const raw = arr(b.photos);
  if (!raw.length) throw new HttpError(400, 'Please add at least one photo.');
  if (raw.length > MAX_PHOTOS) throw new HttpError(400, 'Please keep it to ' + MAX_PHOTOS + ' photos per project.');
  const photos = raw.map((p) => readPhoto(p, true));
  if (new Set(photos.map(photoRef)).size !== photos.length) throw new HttpError(400, 'The same photo was added twice.');
  if (photos.some((ph) => ph.caption.length < 2)) throw new HttpError(400, 'Please write a caption for every photo.');
  await photosMustExist(keysOf(photos));
  const cover = Number.isInteger(b.cover) && b.cover >= 0 && b.cover < photos.length ? b.cover : 0;
  const rev = Number.isInteger(b.rev) ? b.rev : null; // which version of the project the admin page was showing
  return { title, loc, client, tags, specs, desc, cover, photos, rev };
}

async function createProject(req) {
  const { rev, ...f } = await readProjectForm(req);
  const item = { id: newId(4), ...f, rev: 1, date: new Date().toISOString() };
  await updateIndex((doc) => {
    if (doc.projects.length >= MAX_PROJECTS) throw new HttpError(400, 'There are already ' + MAX_PROJECTS + ' projects. Please delete an old one first.');
    doc.projects.unshift(item);
  });
  return json({ ok: true, project: item });
}

async function editProject(id, req) {
  if (!PROJECT_ID_RE.test(id)) return fail(404, 'That project was not found.');
  const { rev, ...f } = await readProjectForm(req);
  const { dropped, used } = await updateIndex((doc) => {
    const i = doc.projects.findIndex((p) => p.id === id);
    if (i < 0) throw new HttpError(404, 'That project was not found. It may have been deleted.');
    const old = doc.projects[i];
    // refuse to save over a newer version (another tab, or a click before the page refreshed)
    if (rev !== null && rev !== (old.rev | 0)) throw new HttpError(409, 'This project was changed a moment ago. The page has been refreshed, please make your change again.');
    // keep the extra details of photos that stay (original photos have longer descriptions)
    const before = new Map(arr(old.photos).map((ph) => [photoRef(ph), ph]));
    const photos = f.photos.map((ph) => { const o = before.get(photoRef(ph)); return o ? { ...o, caption: ph.caption } : ph; });
    const next = { ...old, ...f, photos, rev: (old.rev | 0) + 1, edited: new Date().toISOString() };
    if (old.title !== f.title) next.short = '';  // the website makes a new short name from the title
    if (old.desc !== f.desc) next.blurb = '';    // ... and a new summary from the description
    doc.projects[i] = next;
    const kept = new Set(keysOf(photos));
    return { dropped: keysOf(arr(old.photos)).filter((k) => !kept.has(k)), used: usedKeys(doc) };
  });
  await deletePhotos(dropped, used);
  return json({ ok: true });
}

async function deleteProject(id) {
  if (!PROJECT_ID_RE.test(id)) return fail(404, 'That project was not found.');
  const { gone, used } = await updateIndex((doc) => {
    const i = doc.projects.findIndex((p) => p.id === id);
    if (i < 0) throw new HttpError(404, 'That project was already deleted.');
    const g = doc.projects.splice(i, 1)[0];
    if (BUILTIN_IDS.has(g.id) && doc.removedBuiltin.indexOf(g.id) < 0) doc.removedBuiltin.push(g.id);
    return { gone: g, used: usedKeys(doc) };
  });
  await deletePhotos(keysOf(arr(gone.photos)), used);
  return json({ ok: true });
}

async function restoreOriginals() {
  const n = await updateIndex((doc) => {
    const have = new Set(doc.projects.map((p) => p.id));
    const back = BUILTIN.filter((b) => !have.has(b.id));
    doc.removedBuiltin = [];
    // put each one back where it was: before the next original project that is still there
    back.forEach((b) => {
      const later = BUILTIN.slice(BUILTIN.indexOf(b) + 1).map((x) => x.id);
      const at = doc.projects.findIndex((p) => later.indexOf(p.id) > -1);
      if (at < 0) doc.projects.push(clone(b)); else doc.projects.splice(at, 0, clone(b));
    });
    return back.length;
  });
  return json({ ok: true, restored: n });
}

/* ---------- gallery ---------- */
async function createGallery(req) {
  const b = await readJson(req, 96 * 1024);
  if (!b) return fail(400, 'Please add photos first.');
  const raw = arr(b.items);
  if (!raw.length) return fail(400, 'Please add at least one photo.');
  if (raw.length > MAX_BATCH) return fail(400, 'Please post at most ' + MAX_BATCH + ' photos at a time.');
  const date = new Date().toISOString();
  const items = raw.map((r) => {
    const ph = readPhoto(r, false);
    if (ph.caption.length < 2) throw new HttpError(400, 'Please write a caption for every photo.');
    const tag = TYPES[String(r.tag)] ? String(r.tag) : '';
    return { id: newId(4), img: ph.img, thumb: ph.thumb, caption: ph.caption, place: line(r.place, 120), tag, date };
  });
  await photosMustExist(keysOf(items));
  await updateIndex((doc) => {
    if (doc.gallery.length + items.length > MAX_GALLERY) throw new HttpError(400, 'The gallery is full (' + MAX_GALLERY + ' photos). Please delete some old ones first.');
    doc.gallery.unshift(...items);
  });
  return json({ ok: true, items });
}

async function editGalleryItem(id, req) {
  if (!ID_RE.test(id)) return fail(404, 'That photo was not found.');
  const b = await readJson(req, 4096);
  if (!b) return fail(400, 'Please write a caption.');
  const caption = line(b.caption, 140);
  if (caption.length < 2) return fail(400, 'Please write a caption.');
  await updateIndex((doc) => {
    const g = doc.gallery.find((x) => x.id === id);
    if (!g) throw new HttpError(404, 'That photo was not found. It may have been deleted.');
    g.caption = caption;
    if (typeof b.place === 'string') g.place = line(b.place, 120);
    if (typeof b.tag === 'string') g.tag = TYPES[b.tag] ? b.tag : '';
  });
  return json({ ok: true });
}

async function deleteGalleryItem(id) {
  if (!ID_RE.test(id)) return fail(404, 'That photo was not found.');
  const { gone, used } = await updateIndex((doc) => {
    const i = doc.gallery.findIndex((g) => g.id === id);
    if (i < 0) throw new HttpError(404, 'That photo was already deleted.');
    return { gone: doc.gallery.splice(i, 1)[0], used: usedKeys(doc) };
  });
  await deletePhotos([gone.img, gone.thumb], used);
  return json({ ok: true });
}

/* ---------- router ---------- */
export default async (req, context) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const method = req.method;
  try {
    if (path === '/api/content' && method === 'GET') return await publicContent();
    let m = path.match(/^\/api\/img\/([^/]+)$/);
    if (m && method === 'GET') return await servePhoto(m[1]);

    if (path.startsWith('/api/admin/')) {
      if (method !== 'GET' && !fromAdminPage(req)) return fail(403, 'This request was blocked.');
      if (path === '/api/admin/login' && method === 'POST') return await login(req, context);
      if (path === '/api/admin/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(req, '', 0) });
      if (!(await signedIn(req))) return fail(401, 'Please sign in again.');

      if (path === '/api/admin/me' && method === 'GET') return json({ ok: true, user: adminUser(), types: TYPES });
      if (path === '/api/admin/content' && method === 'GET') return await adminContent();
      if (path === '/api/admin/upload' && method === 'POST') return await upload(req);
      if (path === '/api/admin/projects' && method === 'POST') return await createProject(req);
      if (path === '/api/admin/gallery' && method === 'POST') return await createGallery(req);
      if (path === '/api/admin/restore' && method === 'POST') return await restoreOriginals();
      m = path.match(/^\/api\/admin\/projects\/([^/]+)$/);
      if (m && method === 'PUT') return await editProject(m[1], req);
      if (m && method === 'DELETE') return await deleteProject(m[1]);
      m = path.match(/^\/api\/admin\/gallery\/([^/]+)$/);
      if (m && method === 'PATCH') return await editGalleryItem(m[1], req);
      if (m && method === 'DELETE') return await deleteGalleryItem(m[1]);
    }
    return fail(404, 'Not found.');
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('api error', e);
    return fail(500, 'Something went wrong on the server. Please try again.');
  }
};

/* =========================================================
   M/S. Tulshi Enterprises — admin portal (/admin)
   Sign in, then post, edit and delete projects and gallery photos.
   The original projects are here too, and can be edited or deleted
   (and brought back) like any other post.
   Photos are resized in the browser before upload, so even big
   phone photos go up quickly.
   ========================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var root = document.documentElement;

  var TYPES = [
    ['street', 'Street lighting'], ['highmast', 'High masts'], ['lines', 'MV & LT lines'],
    ['civil', 'Civil foundations & RCC'], ['cabling', 'Underground cabling'], ['panels', 'Feeder pillars & junction boxes'],
    ['maintenance', 'Repair & maintenance'], ['poles', 'Pole & material supply']
  ];
  var TYPE_NAME = {}; TYPES.forEach(function (t) { TYPE_NAME[t[0]] = t[1]; });
  var MAX_PROJECT_PHOTOS = 40, MAX_GALLERY_BATCH = 30;
  var FULL_PX = 1800, THUMB_PX = 640;

  var content = { projects: [], gallery: [], removed: [] };
  var editing = null;   // id of the project being edited
  var editingRev = 0;   // its version when editing started
  var listBusy = false; // a change from the lists is being saved

  /* ---------- day / night switch (same setting as the website) ---------- */
  function syncMode() {
    var night = root.getAttribute('data-mode') !== 'day';
    document.querySelectorAll('[data-mode-toggle]').forEach(function (el) {
      el.setAttribute('aria-checked', String(night));
      el.setAttribute('title', night ? 'Switch to day' : 'Switch to night');
    });
  }
  document.querySelectorAll('[data-mode-toggle]').forEach(function (el) {
    el.addEventListener('click', function () {
      var next = root.getAttribute('data-mode') === 'day' ? 'night' : 'day';
      root.setAttribute('data-mode', next);
      try { localStorage.setItem('tulshi-mode', next); } catch (e) {}
      syncMode();
    });
  });
  syncMode();

  /* ---------- talking to the server ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'X-Requested-With': 'tulshi-admin' };
    var body = opts.body;
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
    if (opts.type) headers['Content-Type'] = opts.type;
    return fetch('/api/admin/' + path, { method: opts.method || 'GET', headers: headers, body: body, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('application/json') < 0) { var e0 = new Error('The admin server is not running on this copy of the website.'); e0.noServer = true; throw e0; }
        return r.json().then(function (d) {
          if (!r.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
          return d;
        });
      }, function () { throw new Error('No connection to the website. Check your internet and try again.'); });
  }
  function signedOut(err) {
    if (err && err.status === 401) { showLogin('You were signed out. Please sign in again.'); return true; }
    return false;
  }

  /* ---------- photos: original ones live in gallery/, uploaded ones come from the server ---------- */
  var isOriginal = function (ph) { return ph && typeof ph.n === 'number'; };
  var thumbUrl = function (ph) { return isOriginal(ph) ? '/gallery/thumbs/photo-' + pad(ph.n) + '.webp' : '/api/img/' + encodeURIComponent(ph.thumb); };
  var refOf = function (ph, caption) {
    return isOriginal(ph) ? { n: ph.n, caption: caption } : { img: ph.img, thumb: ph.thumb, caption: caption };
  };
  function projectBody(p, photos, cover) {
    return { title: p.title, loc: p.loc, client: p.client || '', tags: p.tags || [], specs: p.specs || [], desc: p.desc, cover: cover, photos: photos, rev: p.rev | 0 };
  }
  var findProject = function (id) { for (var i = 0; i < content.projects.length; i++) if (content.projects[i].id === id) return content.projects[i]; return null; };

  /* ---------- toast ---------- */
  var toastT = null;
  function toast(text, bad) {
    var t = $('toast'); t.textContent = text; t.classList.toggle('is-bad', !!bad); t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, bad ? 6000 : 3800);
  }

  /* ---------- views ---------- */
  function show(id) {
    ['booting', 'loginView', 'noServer', 'appView'].forEach(function (v) { $(v).hidden = v !== id; });
    $('signOut').hidden = id !== 'appView';
  }
  function showLogin(msg) {
    show('loginView');
    $('lgMsg').textContent = msg || '';
    setTimeout(function () { ($('lgUser').value ? $('lgPass') : $('lgUser')).focus(); }, 30);
  }
  function showApp() { show('appView'); loadContent(); }

  /* ---------- sign in / out ---------- */
  $('lgPeek').addEventListener('click', function () {
    var on = $('lgPass').type === 'password';
    $('lgPass').type = on ? 'text' : 'password';
    this.setAttribute('aria-pressed', String(on));
    this.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
  });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('lgUser').value.trim(), p = $('lgPass').value;
    if (!u || !p) { $('lgMsg').textContent = 'Enter your username and password.'; return; }
    var btn = $('lgBtn'); btn.disabled = true; btn.textContent = 'Signing in…'; $('lgMsg').textContent = '';
    api('login', { method: 'POST', json: { username: u, password: p } })
      .then(function () { $('lgPass').value = ''; showApp(); toast('Signed in.'); })
      .catch(function (err) { if (err.noServer) show('noServer'); else { $('lgMsg').textContent = err.message; $('lgPass').select(); } })
      .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });
  $('signOut').addEventListener('click', function () {
    if (dirty() && !window.confirm('You have changes that are not saved yet. Sign out anyway?')) return;
    api('logout', { method: 'POST' }).catch(function () {}).then(function () { stopEditing(); clearPicks(galleryPicks); showLogin('You are signed out.'); });
  });

  /* ---------- tabs ---------- */
  var tabs = [$('tabProjects'), $('tabGallery')];
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    try { sessionStorage.setItem('tulshi-admin-tab', tab.id); } catch (e) {}
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); }
    });
  });
  try { var savedTab = $(sessionStorage.getItem('tulshi-admin-tab') || ''); if (savedTab && tabs.indexOf(savedTab) > -1) selectTab(savedTab); } catch (e) {}

  /* ---------- type-of-work pickers ---------- */
  $('pTypes').innerHTML = TYPES.map(function (t) {
    return '<label class="chip"><input type="checkbox" value="' + t[0] + '"><span>' + esc(t[1]) + '</span></label>';
  }).join('');
  $('gType').insertAdjacentHTML('beforeend', TYPES.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join(''));

  /* ---------- reading and shrinking photos in the browser ---------- */
  function decode(file) {
    var viaImg = function () {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: function () { URL.revokeObjectURL(url); } }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
        img.src = url;
      });
    };
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .then(function (b) { return { src: b, w: b.width, h: b.height, done: function () { if (b.close) b.close(); } }; }, viaImg);
    }
    return viaImg();
  }
  function toJpeg(pic, maxSide, quality) {
    var s = Math.min(1, maxSide / Math.max(pic.w, pic.h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(pic.w * s)); c.height = Math.max(1, Math.round(pic.h * s));
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic.src, 0, 0, c.width, c.height);
    return new Promise(function (resolve, reject) { c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('convert')); }, 'image/jpeg', quality); });
  }
  function prepare(file) {
    return decode(file).then(function (pic) {
      if (!pic.w || !pic.h) throw new Error('unreadable');
      return Promise.all([toJpeg(pic, FULL_PX, 0.84), toJpeg(pic, THUMB_PX, 0.8)]).then(function (out) {
        pic.done();
        return { full: out[0], thumb: out[1] };
      });
    });
  }

  /* ---------- a list of chosen photos (used by both forms) ---------- */
  var seq = 0;
  function Picks(opts) {
    this.list = []; this.cover = 0; this.opts = opts;
    this.ul = $(opts.list); this.input = $(opts.input); this.drop = $(opts.drop);
    var self = this;
    this.input.addEventListener('change', function () { self.add(self.input.files); self.input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { self.drop.addEventListener(ev, function (e) { e.preventDefault(); self.drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { self.drop.addEventListener(ev, function () { self.drop.classList.remove('is-over'); }); });
    this.drop.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer) self.add(e.dataTransfer.files); });
    this.ul.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]'); if (!li) return;
      var i = self.index(li.dataset.id);
      if (e.target.closest('.adm-pick-x')) self.remove(i);
      else if (e.target.closest('.adm-pick-cover')) { self.cover = i; self.render(); }
    });
    this.ul.addEventListener('input', function (e) {
      var li = e.target.closest('li[data-id]'); if (!li) return;
      var it = self.list[self.index(li.dataset.id)]; if (it) { it.caption = e.target.value; li.classList.remove('has-error'); }
    });
  }
  Picks.prototype.index = function (id) { for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) return i; return -1; };
  // photos already on the website (when editing a project)
  Picks.prototype.load = function (photos, cover) {
    clearPicks(this);
    this.list = photos.map(function (ph) {
      return { id: 'p' + (++seq), ref: ph, caption: ph.caption || '', url: thumbUrl(ph), ready: true, existing: true };
    });
    this.cover = Math.min(Math.max(0, cover | 0), Math.max(0, this.list.length - 1));
    this.render();
  };
  Picks.prototype.add = function (files) {
    var self = this, arr = Array.prototype.slice.call(files || []);
    var room = this.opts.max - this.list.length;
    if (!arr.length) return;
    if (room <= 0) { toast('You can have up to ' + this.opts.max + ' photos here.', true); return; }
    if (arr.length > room) { toast('Only the first ' + room + ' photos were added (limit ' + this.opts.max + ').', true); arr = arr.slice(0, room); }
    $(this.opts.msg).textContent = ''; this.drop.classList.remove('has-error');
    var bad = [];
    var jobs = arr.map(function (file) {
      if (file.type && file.type.indexOf('image/') !== 0) { bad.push(file.name); return Promise.resolve(); }
      var it = { id: 'p' + (++seq), name: file.name, caption: '', full: null, thumb: null, url: '', ready: false };
      self.list.push(it); self.render();
      return prepare(file).then(function (out) {
        it.full = out.full; it.thumb = out.thumb; it.url = URL.createObjectURL(out.thumb); it.ready = true; self.render();
      }).catch(function () {
        bad.push(file.name); self.remove(self.index(it.id), true);
      });
    });
    Promise.all(jobs).then(function () {
      if (bad.length) toast('Could not read ' + bad.join(', ') + '. Please use JPG or PNG photos.', true);
    });
  };
  Picks.prototype.remove = function (i, quiet) {
    if (i < 0) return;
    var it = this.list.splice(i, 1)[0];
    if (it && it.url && !it.existing) URL.revokeObjectURL(it.url);
    if (this.cover >= this.list.length) this.cover = Math.max(0, this.list.length - 1);
    else if (i < this.cover) this.cover--;
    this.render();
    if (!quiet && it) toast(it.existing ? 'Photo will be removed when you press Save changes.' : 'Photo removed.');
  };
  Picks.prototype.render = function () {
    var self = this, focusedId = null, caret = null;
    var a = document.activeElement;
    if (a && a.tagName === 'TEXTAREA' && this.ul.contains(a)) { focusedId = a.closest('li').dataset.id; caret = a.selectionStart; }
    this.ul.innerHTML = this.list.map(function (it, i) {
      var cover = self.opts.cover && i === self.cover;
      return '<li class="adm-pick' + (cover ? ' is-cover' : '') + (it.ready ? '' : ' is-busy') + '" data-id="' + it.id + '">' +
        '<div class="adm-pick-img">' + (it.url ? '<img src="' + esc(it.url) + '" alt="" loading="lazy">' : '') +
          (self.opts.cover ? '<button type="button" class="adm-pick-cover" aria-pressed="' + cover + '" title="' + (cover ? 'Cover photo' : 'Make this the cover photo') + '"><svg aria-hidden="true"><use href="#i-star"/></svg><span class="t">' + (cover ? 'Cover' : 'Make cover') + '</span></button>' : '') +
          '<button type="button" class="adm-pick-x" aria-label="Remove photo ' + (i + 1) + '"><svg aria-hidden="true"><use href="#i-close"/></svg></button>' +
        '</div>' +
        '<textarea rows="2" maxlength="140" placeholder="Caption for this photo" aria-label="Caption for photo ' + (i + 1) + '">' + esc(it.caption) + '</textarea>' +
      '</li>';
    }).join('');
    if (focusedId) {
      var ta = this.ul.querySelector('li[data-id="' + focusedId + '"] textarea');
      if (ta) { ta.focus(); try { ta.setSelectionRange(caret, caret); } catch (e) {} }
    }
  };
  Picks.prototype.busy = function () { return this.list.some(function (it) { return !it.ready; }); };
  Picks.prototype.hasNew = function () { return this.list.some(function (it) { return !it.existing; }); };
  function clearPicks(p) { p.list.forEach(function (it) { if (it.url && !it.existing) URL.revokeObjectURL(it.url); }); p.list = []; p.cover = 0; p.render(); }

  var projectPicks = new Picks({ list: 'pPicks', input: 'pFiles', drop: 'pDrop', msg: 'pMsg', max: MAX_PROJECT_PHOTOS, cover: true });
  var galleryPicks = new Picks({ list: 'gPicks', input: 'gFiles', drop: 'gDrop', msg: 'gMsg', max: MAX_GALLERY_BATCH, cover: false });
  function dirty() { return !!editing || projectPicks.hasNew() || galleryPicks.hasNew(); }
  window.addEventListener('beforeunload', function (e) { if ((projectPicks.hasNew() || galleryPicks.hasNew() || editing) && !posting) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- uploading (new photos only) ---------- */
  var posting = false;
  function uploadAll(picks, progressEl) {
    var out = [], i = 0, list = picks.list;
    var fresh = list.filter(function (it) { return !it.existing; }), done = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(out);
      var it = list[i];
      if (it.existing) { out.push(it.ref); i++; return next(); }
      var li = picks.ul.querySelector('li[data-id="' + it.id + '"]');
      progressEl.textContent = 'Uploading photo ' + (done + 1) + ' of ' + fresh.length + '…';
      return api('upload', { method: 'POST', type: 'image/jpeg', body: it.full })
        .then(function (a) { return api('upload', { method: 'POST', type: 'image/jpeg', body: it.thumb }).then(function (b) { return { img: a.key, thumb: b.key }; }); })
        .then(function (k) { out.push(k); done++; if (li) li.classList.add('is-done'); i++; return next(); });
    }
    return next();
  }
  function lockForm(form, on) {
    posting = on;
    form.querySelectorAll('input, textarea, select, button').forEach(function (el) { el.disabled = on; });
  }

  /* ---------- the project form: post a new one, or edit one ---------- */
  function setFieldError(name, on) {
    var f = document.querySelector('#projectForm [data-field="' + name + '"]');
    if (f) f.classList.toggle('has-error', on);
  }
  ['pTitle', 'pLoc', 'pDesc'].forEach(function (id) { $(id).addEventListener('input', function () { this.closest('.field').classList.remove('has-error'); }); });

  function startEditing(p) {
    if (posting) return;
    if ((projectPicks.hasNew() || editing) && editing !== p.id && !window.confirm('Your changes in the form are not saved yet. Edit this project instead?')) return;
    selectTab(tabs[0]);
    editing = p.id; editingRev = p.rev | 0;
    var form = $('projectForm');
    form.reset();
    form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
    $('pMsg').textContent = ''; $('pProgress').textContent = '';
    $('pTitle').value = p.title || ''; $('pLoc').value = p.loc || ''; $('pClient').value = p.client || '';
    $('pSpecs').value = (p.specs || []).join(', ');
    $('pDesc').value = p.desc || '';
    document.querySelectorAll('#pTypes input').forEach(function (c) { c.checked = (p.tags || []).indexOf(c.value) > -1; });
    projectPicks.load(p.photos || [], p.cover);
    $('pFormTitle').textContent = 'Edit project: ' + p.title;
    $('pPost').textContent = 'Save changes';
    $('pCancel').hidden = false;
    form.classList.add('is-editing');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { $('pTitle').focus({ preventScroll: true }); }, 350);
  }
  function stopEditing() {
    editing = null;
    var form = $('projectForm');
    form.reset(); clearPicks(projectPicks);
    form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
    $('pMsg').textContent = ''; $('pProgress').textContent = '';
    $('pFormTitle').textContent = 'Post a new project';
    $('pPost').textContent = 'Post project';
    $('pCancel').hidden = true;
    form.classList.remove('is-editing');
  }
  $('pCancel').addEventListener('click', function () { stopEditing(); toast('Editing cancelled. Nothing was changed.'); });

  $('projectForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (posting) return;
    var form = this, msg = $('pMsg'), prog = $('pProgress');
    msg.textContent = '';
    var data = {
      title: $('pTitle').value.trim(), loc: $('pLoc').value.trim(), client: $('pClient').value.trim(),
      specs: $('pSpecs').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      tags: Array.prototype.slice.call(document.querySelectorAll('#pTypes input:checked')).map(function (c) { return c.value; }),
      desc: $('pDesc').value.trim()
    };
    var bad = [];
    setFieldError('title', data.title.length < 3); if (data.title.length < 3) bad.push($('pTitle'));
    setFieldError('loc', data.loc.length < 2); if (data.loc.length < 2) bad.push($('pLoc'));
    setFieldError('desc', data.desc.length < 10); if (data.desc.length < 10) bad.push($('pDesc'));
    $('pDrop').classList.toggle('has-error', !projectPicks.list.length);
    if (!projectPicks.list.length) { msg.textContent = 'Add at least one photo.'; if (!bad.length) bad.push($('pFiles')); }
    var noCap = projectPicks.list.filter(function (it) { return it.caption.trim().length < 2; });
    noCap.forEach(function (it) { var li = projectPicks.ul.querySelector('li[data-id="' + it.id + '"]'); if (li) li.classList.add('has-error'); });
    if (noCap.length) { msg.textContent = 'Write a caption under every photo.'; if (!bad.length) bad.push(projectPicks.ul.querySelector('.has-error textarea')); }
    if (bad.length) { if (bad[0]) bad[0].focus(); return; }
    if (projectPicks.busy()) { msg.textContent = 'Photos are still being prepared. Please wait a moment and try again.'; return; }

    var wasEditing = editing;
    lockForm(form, true);
    uploadAll(projectPicks, prog).then(function (refs) {
      prog.textContent = 'Saving…';
      data.cover = projectPicks.cover;
      if (wasEditing) data.rev = editingRev;
      data.photos = refs.map(function (r, i) { return refOf(r, projectPicks.list[i].caption.trim()); });
      return wasEditing
        ? api('projects/' + encodeURIComponent(wasEditing), { method: 'PUT', json: data })
        : api('projects', { method: 'POST', json: data });
    }).then(function () {
      lockForm(form, false);
      stopEditing();
      toast(wasEditing ? 'Changes saved. The website is updated.' : 'Project posted. It is now on the website.');
      loadContent();
    }).catch(function (err) {
      lockForm(form, false); prog.textContent = '';
      $('pCancel').hidden = !editing;
      projectPicks.ul.querySelectorAll('.is-done').forEach(function (li) { li.classList.remove('is-done'); });
      if (signedOut(err)) return;
      msg.textContent = err.message; toast(err.message, true);
      if (err.status === 409 || err.status === 404) { stopEditing(); loadContent(); }
    });
  });

  /* ---------- post gallery photos ---------- */
  $('galleryForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (posting) return;
    var form = this, msg = $('gMsg'), prog = $('gProgress');
    msg.textContent = '';
    if (!galleryPicks.list.length) { $('gDrop').classList.add('has-error'); msg.textContent = 'Add at least one photo.'; $('gFiles').focus(); return; }
    var noCap = galleryPicks.list.filter(function (it) { return it.caption.trim().length < 2; });
    noCap.forEach(function (it) { var li = galleryPicks.ul.querySelector('li[data-id="' + it.id + '"]'); if (li) li.classList.add('has-error'); });
    if (noCap.length) { msg.textContent = 'Write a caption under every photo.'; var t = galleryPicks.ul.querySelector('.has-error textarea'); if (t) t.focus(); return; }
    if (galleryPicks.busy()) { msg.textContent = 'Photos are still being prepared. Please wait a moment and try again.'; return; }
    var place = $('gPlace').value.trim(), tag = $('gType').value;

    lockForm(form, true);
    uploadAll(galleryPicks, prog).then(function (keys) {
      prog.textContent = 'Posting…';
      return api('gallery', { method: 'POST', json: { items: keys.map(function (k, i) { return { img: k.img, thumb: k.thumb, caption: galleryPicks.list[i].caption.trim(), place: place, tag: tag }; }) } });
    }).then(function (r) {
      lockForm(form, false);
      var n = (r.items || []).length;
      form.reset(); clearPicks(galleryPicks); prog.textContent = '';
      toast((n === 1 ? 'Photo' : n + ' photos') + ' posted to the gallery.');
      loadContent();
    }).catch(function (err) {
      lockForm(form, false); prog.textContent = '';
      galleryPicks.ul.querySelectorAll('.is-done').forEach(function (li) { li.classList.remove('is-done'); });
      if (signedOut(err)) return;
      msg.textContent = err.message; toast(err.message, true);
    });
  });

  /* ---------- everything on the website ---------- */
  var fmtDate = function (iso) {
    try { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch (e) { return ''; }
  };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  var delBtn = function (kind, id, name, extra) {
    return '<button type="button" class="adm-mini is-danger" data-del="' + kind + '" data-id="' + esc(id) + '" data-name="' + esc(name) + '"' + (extra || '') + '><svg aria-hidden="true"><use href="#i-trash"/></svg>Delete</button>';
  };
  function photoTile(ph, kind, ownerId, idx, sub) {
    var key = kind === 'gallery' ? ph.id : ownerId + ':' + idx;
    return '<li class="adm-tile" data-kind="' + kind + '" data-key="' + esc(key) + '"><img src="' + esc(thumbUrl(ph)) + '" alt="" loading="lazy">' +
      '<div><b class="adm-cap">' + esc(ph.caption) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</b>' +
      '<span class="adm-tile-msg" role="alert"></span>' +
      '<span class="adm-tile-actions"><button type="button" class="adm-mini" data-edit-cap><svg aria-hidden="true"><use href="#i-edit"/></svg>Edit caption</button>' +
      delBtn(kind === 'gallery' ? 'gallery' : 'photo', key, ph.caption) + '</span></div></li>';
  }
  function renderContent() {
    var c = content;
    var projectPhotos = c.projects.reduce(function (a, p) { return a + p.photos.length; }, 0);
    $('countProjects').textContent = c.projects.length;
    $('countGallery').textContent = c.gallery.length + projectPhotos;
    $('countLatest').textContent = c.gallery.length;
    $('projectEmpty').hidden = c.projects.length > 0;
    $('galleryEmpty').hidden = c.gallery.length > 0;

    $('restoreBox').hidden = !c.removed.length;
    $('restoreText').textContent = c.removed.length
      ? 'Deleted original ' + (c.removed.length === 1 ? 'project: ' : 'projects: ') + c.removed.join(', ') + '.' : '';

    $('projectList').innerHTML = c.projects.map(function (p) {
      var cov = p.photos[p.cover] || p.photos[0] || {};
      var types = (p.tags || []).map(function (t) { return TYPE_NAME[t]; }).filter(Boolean).join(', ');
      var when = p.builtin ? 'Original project' : fmtDate(p.date);
      return '<li class="adm-row">' +
        '<img src="' + esc(thumbUrl(cov)) + '" alt="" loading="lazy">' +
        '<div><h3>' + esc(p.title) + '</h3><p>' + esc(p.loc) + ' · ' + plural(p.photos.length, 'photo', 'photos') + (when ? ' · ' + esc(when) : '') + (types ? '<br>' + esc(types) : '') + '</p></div>' +
        '<div class="adm-actions">' +
          '<a class="adm-mini" href="/projects.html#project-' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-eye"/></svg>View</a>' +
          '<button type="button" class="adm-mini" data-edit-project="' + esc(p.id) + '"><svg aria-hidden="true"><use href="#i-edit"/></svg>Edit</button>' +
          delBtn('projects', p.id, p.title) +
        '</div></li>';
    }).join('');

    $('galleryList').innerHTML = c.gallery.map(function (g) {
      return photoTile(g, 'gallery', '', 0, [g.place, TYPE_NAME[g.tag]].filter(Boolean).join(' · '));
    }).join('');

    $('projectPhotos').innerHTML = c.projects.map(function (p) {
      return '<section class="adm-group"><h3 class="adm-sub">' + esc(p.title) + ' <span class="adm-badge">' + p.photos.length + '</span></h3>' +
        '<p class="adm-hint">To add photos or change the cover, use Edit in the Projects tab.</p>' +
        '<ul class="adm-tiles">' + p.photos.map(function (ph, i) { return photoTile(ph, 'photo', p.id, i, i === p.cover ? 'Cover photo' : ''); }).join('') + '</ul></section>';
    }).join('');
  }
  function loadContent() {
    return api('content').then(function (d) {
      content = { projects: d.projects || [], gallery: d.gallery || [], removed: d.removed || [] };
      renderContent();
    }).catch(function (err) { if (!signedOut(err)) toast(err.message, true); });
  }

  // a photo inside a project is changed by saving the project with that photo changed
  function saveProjectPhotos(p, photos, cover) {
    return api('projects/' + encodeURIComponent(p.id), { method: 'PUT', json: projectBody(p, photos, cover) });
  }
  function tileFor(el) { return el.closest('.adm-tile'); }

  /* ---------- buttons in the lists ---------- */
  // one change at a time: the next one waits until the list shows the result of the last
  function listJob(job, okText) {
    listBusy = true;
    document.body.classList.add('is-saving');
    return job.then(function (r) {
      return loadContent().then(function () { toast(typeof okText === 'function' ? okText(r) : okText); });
    }, function (err) {
      if (!signedOut(err)) { toast(err.message, true); return loadContent(); }
    }).then(function () { listBusy = false; document.body.classList.remove('is-saving'); });
  }
  document.addEventListener('click', function (e) {
    if (listBusy && e.target.closest('[data-edit-project], [data-edit-cap], [data-cap-save], [data-del], #restoreBtn')) {
      e.preventDefault(); toast('Saving… one moment.'); return;
    }
    // edit a whole project
    var ep = e.target.closest('[data-edit-project]');
    if (ep) { var proj = findProject(ep.getAttribute('data-edit-project')); if (proj) startEditing(proj); return; }

    // edit a caption in place
    var ec = e.target.closest('[data-edit-cap]');
    if (ec) {
      var tile = tileFor(ec);
      if (tile.classList.contains('is-editing')) return;
      tile.classList.add('is-editing');
      var cap = tile.querySelector('.adm-cap');
      var current = cap.firstChild ? cap.firstChild.textContent : '';
      cap.hidden = true;
      tile.querySelector('.adm-tile-actions').hidden = true;
      cap.insertAdjacentHTML('afterend', '<textarea rows="3" maxlength="140" aria-label="Caption">' + esc(current) + '</textarea>' +
        '<span class="adm-tile-actions adm-cap-edit"><button type="button" class="adm-mini" data-cap-save>Save</button><button type="button" class="adm-mini" data-cap-cancel>Cancel</button></span>');
      var ta = tile.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      return;
    }
    var cc = e.target.closest('[data-cap-cancel]');
    if (cc) { renderContent(); return; }
    var cs = e.target.closest('[data-cap-save]');
    if (cs) {
      var t = tileFor(cs), text = t.querySelector('textarea').value.trim(), m = t.querySelector('.adm-tile-msg');
      if (text.length < 2) { m.textContent = 'Write a caption.'; return; }
      cs.disabled = true; cs.textContent = 'Saving…';
      var req;
      if (t.dataset.kind === 'gallery') {
        req = api('gallery/' + encodeURIComponent(t.dataset.key), { method: 'PATCH', json: { caption: text } });
      } else {
        var parts = t.dataset.key.split(':'), p = findProject(parts[0]), idx = +parts[1];
        if (!p) { loadContent(); return; }
        req = saveProjectPhotos(p, p.photos.map(function (ph, i) { return refOf(ph, i === idx ? text : ph.caption); }), p.cover);
      }
      listJob(req, 'Caption saved.');
      return;
    }

    // bring back deleted original projects
    if (e.target.closest('#restoreBtn')) {
      listJob(api('restore', { method: 'POST' }), function (r) {
        return r && r.restored === 1 ? 'The original project is back on the website.' : 'The original projects are back on the website.';
      });
      return;
    }

    // delete: first tap asks, second tap deletes
    var b = e.target.closest('[data-del]'); if (!b || b.disabled) return;
    var kind = b.dataset.del, id = b.dataset.id;
    if (kind === 'photo') {
      var pp = findProject(id.split(':')[0]);
      if (pp && pp.photos.length === 1) { toast('This is the only photo of "' + pp.title + '". Delete the whole project in the Projects tab instead.', true); return; }
    }
    if (!b.classList.contains('is-confirm')) {
      document.querySelectorAll('[data-del].is-confirm').forEach(function (o) { o.classList.remove('is-confirm'); o.lastChild.textContent = 'Delete'; });
      b.classList.add('is-confirm'); b.lastChild.textContent = 'Tap again to delete';
      clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('is-confirm'); b.lastChild.textContent = 'Delete'; }, 4000);
      return;
    }
    clearTimeout(b._t); b.disabled = true; b.lastChild.textContent = 'Deleting…';
    var job;
    if (kind === 'photo') {
      var bits = id.split(':'), owner = findProject(bits[0]), at = +bits[1];
      if (!owner) { loadContent(); return; }
      var cover = owner.cover === at ? 0 : owner.cover > at ? owner.cover - 1 : owner.cover;
      job = saveProjectPhotos(owner, owner.photos.filter(function (ph, i) { return i !== at; }).map(function (ph) { return refOf(ph, ph.caption); }), cover);
    } else {
      if (kind === 'projects' && editing === id) stopEditing();
      job = api(kind + '/' + encodeURIComponent(id), { method: 'DELETE' });
    }
    var p0 = kind === 'projects' ? findProject(id) : null;
    listJob(job, 'Deleted: ' + b.dataset.name + (p0 && p0.builtin ? '. You can bring it back with "Bring them back".' : ''));
  });

  /* ---------- start ---------- */
  api('me').then(showApp).catch(function (err) {
    if (err.noServer) show('noServer');
    else if (err.status === 401) showLogin();
    else { showLogin(); $('lgMsg').textContent = err.message; }
  });
})();

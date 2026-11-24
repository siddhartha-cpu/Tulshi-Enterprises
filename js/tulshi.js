/* Tulshi Enterprises: projects, gallery, enquiry form and small helpers.
   Runs after js/site.js (menu, slider, photo viewer). */
(function () {
  'use strict';
  var WA_NUMBER = '919237101021';
  var EMAIL = 'tulshienterprises21@gmail.com';
  var TYPES = {
    street: 'Street lighting', highmast: 'High mast', lines: 'MV & LT lines', poles: 'Poles & flag masts',
    civil: 'Civil foundations', cabling: 'Underground cabling', panels: 'Feeder pillars & boxes', maintenance: 'Repair & maintenance'
  };

  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function waUrl(text) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text); }

  qsa('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });


  /* ---------------------------------------------------------
     Photos: the built-in projects (assets/js/projects.js) and
     anything posted from the admin portal (/api/content).
     --------------------------------------------------------- */
  var PROJECTS = Array.isArray(window.PROJECTS) ? window.PROJECTS.slice() : [];
  var LATEST = null;
  var KEY_OK = /^[a-z0-9]{6,12}-[a-f0-9]{16}$/, ID_OK = /^[a-z0-9][a-z0-9-]{1,39}$/, POS_OK = /^\d{1,3}% \d{1,3}%$/;

  function builtin(n) { return { img: 'gallery/img/photo-' + pad(n) + '.webp', thumb: 'gallery/thumbs/photo-' + pad(n) + '.webp' }; }
  function srcOf(ph) {
    if (ph.img) return { img: ph.img, thumb: ph.thumb };
    return builtin(ph.n);
  }
  function shortDate(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? '' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function clip(t, max) { t = String(t || ''); return t.length > max ? t.slice(0, max - 2).trim() + '…' : t; }

  function toPhoto(ph, fallbackTitle) {
    if (!ph) return null;
    if (typeof ph.n === 'number' && ph.n > 0 && ph.n < 1000 && ph.n % 1 === 0) {
      return { n: ph.n, title: String(ph.caption || ph.title || fallbackTitle) };
    }
    if (!KEY_OK.test(ph.img) || !KEY_OK.test(ph.thumb)) return null;
    return { img: '/api/img/' + ph.img, thumb: '/api/img/' + ph.thumb, title: String(ph.caption || fallbackTitle) };
  }

  function applyContent(data) {
    var list = [];
    (Array.isArray(data.projects) ? data.projects : []).forEach(function (r) {
      if (!r || !ID_OK.test(String(r.id)) || !Array.isArray(r.photos)) return;
      var title = String(r.title || 'Project');
      var photos = [];
      r.photos.forEach(function (ph) { var o = toPhoto(ph, title); if (o) photos.push(o); });
      if (!photos.length) return;
      var cover = photos[Math.min(Math.max(0, r.cover | 0), photos.length - 1)];
      list.push({
        id: String(r.id), short: String(r.short || clip(title, 28)), title: title, name: String(r.name || ''),
        loc: String(r.loc || ''), client: String(r.client || ''),
        tags: (Array.isArray(r.tags) ? r.tags : []).filter(function (t) { return TYPES[t]; }),
        blurb: String(r.blurb || clip(r.desc, 220)), date: shortDate(r.date),
        coverPhoto: cover, pos: POS_OK.test(r.pos) ? r.pos : '50% 50%', photos: photos
      });
    });
    if (data.seeded) PROJECTS = list;               // the admin's full list replaces the built-in one
    else if (list.length) PROJECTS = list.concat(PROJECTS);
    var latest = [];
    (Array.isArray(data.gallery) ? data.gallery : []).forEach(function (g) {
      var o = toPhoto({ img: g && g.img, thumb: g && g.thumb, caption: g && g.caption }, 'Site photo');
      if (o) latest.push(o);
    });
    LATEST = latest.length ? { id: 'latest', short: 'Latest uploads', title: 'Latest photos from our sites', photos: latest } : null;
  }

  // built-in projects keep their photo numbers and cover number
  function normalise(p) {
    if (p.coverPhoto) return p;
    var photos = (p.photos || []).map(function (ph) { return { n: ph.n, title: String(ph.title || p.title) }; });
    var cover = photos.filter(function (ph) { return ph.n === p.cover; })[0] || photos[0];
    return {
      id: p.id, short: p.short, title: p.title, name: p.name || '', loc: p.loc || '', client: p.client || '',
      tags: p.tags || [], blurb: p.blurb || '', date: '', coverPhoto: cover, pos: p.pos || '50% 50%', photos: photos
    };
  }

  function loadPosted() {
    return new Promise(function (resolve) {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { resolve(); return; }
      var settled = false;
      var finish = function () { if (!settled) { settled = true; resolve(); } };
      var timer = setTimeout(finish, 2500);
      fetch('/api/content', { headers: { Accept: 'application/json' }, credentials: 'omit' })
        .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
        .then(function (d) { clearTimeout(timer); if (!settled && d) { try { applyContent(d); } catch (e) { /* keep the built-in list */ } } finish(); })
        .catch(function () { clearTimeout(timer); finish(); });
    });
  }

  function lbLink(ph, group, cls, inner, caption) {
    var s = srcOf(ph);
    return '<a href="' + esc(s.img) + '" data-lightbox="' + esc(group) + '" data-title="' + esc(caption || ph.title) + '"' +
      (cls ? ' class="' + cls + '"' : '') + '>' + (inner || '') + '</a>';
  }

  function buildProjects() {
    var grid = $('projectGrid'); if (!grid) return;
    var html = PROJECTS.map(normalise).map(function (p) {
      var s = srcOf(p.coverPhoto);
      var group = 'p-' + p.id;
      var tags = p.tags.map(function (t) { return TYPES[t]; }).filter(Boolean).join(', ');
      var first = lbLink(p.coverPhoto, group, 'projc-img',
        '<img src="' + esc(s.thumb) + '" alt="' + esc(p.title) + '" loading="lazy" style="object-position:' + esc(p.pos) + '">' +
        '<span class="projc-count">' + p.photos.length + ' photos</span>', p.title + ' | ' + p.coverPhoto.title);
      var rest = p.photos.filter(function (ph) { return ph !== p.coverPhoto; })
        .map(function (ph) { return lbLink(ph, group, 'd-none', '', p.title + ' | ' + ph.title); }).join('');
      return '<div class="col-xl-4 col-lg-4 col-md-6 col-sm-12" id="project-' + esc(p.id) + '"><div class="projc tproj">' + first + rest +
        '<div class="tproj-body"><h3>' + esc(p.title) + '</h3>' +
        (p.loc ? '<p class="tproj-loc"><svg class="ti" aria-hidden="true"><use href="#i-pin"/></svg> ' + esc(p.loc) + '</p>' : '') +
        (p.client ? '<p class="tproj-meta"><b>Client:</b> ' + esc(p.client) + '</p>' : '') +
        (tags ? '<p class="tproj-meta"><b>Work:</b> ' + esc(tags) + '</p>' : '') +
        (p.blurb ? '<p class="tproj-blurb">' + esc(p.blurb) + '</p>' : '') +
        '<button type="button" class="btnone tproj-open" data-open="' + esc(group) + '">View Photos <svg class="ti" aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
        '</div></div></div>';
    }).join('');
    grid.innerHTML = html || '<div class="col-12"><p class="tlead">Project photos will appear here soon.</p></div>';
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]'); if (!b) return;
      var a = grid.querySelector('a[data-lightbox="' + b.getAttribute('data-open') + '"]');
      if (a) a.click();
    });
    var deep = location.hash.match(/^#project-([a-z0-9-]+)$/);
    if (deep && $('project-' + deep[1])) $('project-' + deep[1]).scrollIntoView();
  }

  function buildGallery() {
    var grid = $('galGrid'); if (!grid) return;
    var filters = $('galFilters'), more = $('galMore');
    var groups = PROJECTS.map(normalise);
    if (LATEST) groups.unshift(LATEST);
    var PAGE = 12, shown = PAGE, current = 'all';
    function items() {
      var out = [];
      groups.forEach(function (g) {
        if (current !== 'all' && current !== g.id) return;
        g.photos.forEach(function (ph) { out.push({ ph: ph, g: g }); });
      });
      return out;
    }
    function render() {
      var list = items();
      grid.innerHTML = list.map(function (it, i) {
        var s = srcOf(it.ph);
        var label = it.g.id === 'latest' ? it.ph.title : it.g.short + ' | ' + it.ph.title;
        var hide = i >= shown;
        return '<div class="col-xl-3 col-lg-4 col-md-4 col-6' + (hide ? ' d-none' : '') + '"><div class="projc tgal">' +
          lbLink(it.ph, 'gallery', '', '<img src="' + esc(s.thumb) + '" alt="' + esc(it.ph.title) + '" loading="lazy">', label) +
          '<p>' + esc(it.ph.title) + '</p></div></div>';
      }).join('');
      more.hidden = shown >= list.length;
    }
    filters.innerHTML = '<button type="button" class="tfilter" data-f="all" aria-pressed="true">All photos</button>' +
      groups.map(function (g) { return '<button type="button" class="tfilter" data-f="' + esc(g.id) + '" aria-pressed="false">' + esc(g.short) + '</button>'; }).join('');
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      current = b.getAttribute('data-f'); shown = PAGE;
      qsa('.tfilter', filters).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
    more.addEventListener('click', function () { shown += PAGE; render(); });
    render();
  }

  if ($('projectGrid') || $('galGrid')) loadPosted().then(function () { buildProjects(); buildGallery(); });

  /* ---------------------------------------------------------
     Business enquiry form: Submit makes a PDF of the details and offers
     two ways to send it: a WhatsApp chat with our number, or an email
     to our address from the visitor's own mail app.
     --------------------------------------------------------- */
  var form = $('quoteForm');
  if (!form) return;
  var statusEl = $('qStatus'), dlg = $('sendDialog');
  function chips() { return qsa('input[name="category"]', form); }
  function val(id) { var el = $(id); if (!el) return ''; var max = +el.getAttribute('maxlength') || 2000; return el.value.trim().slice(0, max); }
  function chosen() { return chips().filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); }

  // services.html links here with ?service=<id>
  var pre = (location.search.match(/[?&]service=([a-z]+)/) || [])[1];
  if (pre) chips().forEach(function (c) { if (c.getAttribute('data-svc') === pre) c.checked = true; });

  function setErr(key, on) {
    var f = form.querySelector('[data-field="' + key + '"]'); if (!f) return;
    f.classList.toggle('has-error', on);
    qsa('input, textarea', f).forEach(function (i) { if (i.type !== 'checkbox') { if (on) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); } });
  }
  function validate() {
    var name = val('qName'), phone = val('qPhone'), email = val('qEmail');
    var ok = { name: !!name, phone: phone.replace(/\D/g, '').length >= 10, email: !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), services: chosen().length > 0 };
    Object.keys(ok).forEach(function (k) { setErr(k, !ok[k]); });
    var first = !ok.name ? 'qName' : !ok.phone ? 'qPhone' : !ok.email ? 'qEmail' : !ok.services ? 'chips' : null;
    if (first) { (first === 'chips' ? chips()[0] : $(first)).focus(); return false; }
    return true;
  }
  form.addEventListener('input', function (e) {
    var f = e.target.closest('[data-field]'); if (f && f.classList.contains('has-error')) setErr(f.getAttribute('data-field'), false);
  });
  form.addEventListener('change', function (e) { if (e.target.name === 'category' && chosen().length) setErr('services', false); });

  var current = null; // { rows, ref, file, blob, url, saved }
  function stamp() {
    var d = new Date();
    var ref = 'TE-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    var h = d.getHours() % 12 || 12;
    return { ref: ref, date: d.getDate() + ' ' + mon + ' ' + d.getFullYear() + ', ' + h + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' am' : ' pm') };
  }
  function makeEnquiry() {
    var st = stamp();
    var rows = [['Company / Department', val('qOrg')], ['Contact person', val('qName')], ['Designation', val('qDesig')], ['Mobile number', val('qPhone')],
      ['Email', val('qEmail')], ['Site location', val('qSite')], ['Work required', chosen().join(', ')], ['Requirement', val('qScope')]];
    var slug = val('qName').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'Enquiry';
    var file = 'Tulshi-Enquiry-' + slug + '-' + st.ref.slice(3) + '.pdf';
    var blob = window.TulshiPDF ? window.TulshiPDF.enquiry({ ref: st.ref, date: st.date, phone: val('qPhone'), rows: rows }) : null;
    if (current && current.url) URL.revokeObjectURL(current.url);
    current = { rows: rows, ref: st.ref, file: file, blob: blob, url: blob ? URL.createObjectURL(blob) : '', saved: false };
  }
  function messageText(limit) {
    var lines = ['Hello Tulshi Enterprises, I would like a quotation.', '', 'Enquiry ' + current.ref];
    current.rows.forEach(function (r) { if (r[1]) lines.push(r[0] + ': ' + r[1]); });
    lines.push('', 'The same details are in the attached PDF: ' + current.file);
    var t = lines.join('\n');
    return t.length > limit ? t.slice(0, limit - 40) + '...\n(full details in the attached PDF)' : t;
  }
  function savePdf() {
    if (!current || !current.url) return;
    var a = document.createElement('a');
    a.href = current.url; a.download = current.file; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    current.saved = true;
  }
  function showSteps(title, items, gmail) {
    $('stepTitle').textContent = title;
    $('stepList').innerHTML = items.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var g = $('gmailLink');
    if (gmail) { g.href = gmail; g.hidden = false; } else g.hidden = true;
    $('sendStep').hidden = false;
    $('sendStep').focus({ preventScroll: true });
  }
  function openDialog() {
    $('pdfName').textContent = current.file;
    $('sendStep').hidden = true;
    qsa('.tsend-opt', dlg).forEach(function (b) { b.classList.remove('is-chosen'); });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('tlb-open');
    $('sendWa').focus();
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () { document.body.classList.remove('tlb-open'); $('qSubmit').focus(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });
  $('sendClose').addEventListener('click', closeDialog);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.className = 'tstatus'; statusEl.innerHTML = '';
    if (!validate()) return;
    try { makeEnquiry(); } catch (err) { current = null; }
    if (!current) { statusEl.className = 'tstatus is-error'; statusEl.textContent = 'Something went wrong while making the PDF. Please try again.'; return; }
    openDialog();
  });

  $('sendWa').addEventListener('click', function () {
    this.classList.add('is-chosen'); $('sendMail').classList.remove('is-chosen');
    window.open(waUrl(messageText(3000)), '_blank', 'noopener'); // open the chat first, while the tap still counts
    if (!current.saved) savePdf();
    showSteps('WhatsApp is opening a chat with Tulshi Enterprises', [
      'Your details are already typed in the message.',
      'Tap the paperclip, choose <b>Document</b> and pick <b>' + esc(current.file) + '</b> from Downloads.',
      'Press <b>Send</b>.'
    ]);
  });
  $('sendMail').addEventListener('click', function () {
    this.classList.add('is-chosen'); $('sendWa').classList.remove('is-chosen');
    if (!current.saved) savePdf();
    var subject = 'Business enquiry ' + current.ref + ' from ' + val('qName');
    var body = messageText(1500);
    var mailto = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    var gmail = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(EMAIL) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    setTimeout(function () { window.location.href = mailto; }, 250);
    showSteps('Your email app is opening', [
      'The email is addressed to <b>' + EMAIL + '</b> with your details in it.',
      'Attach <b>' + esc(current.file) + '</b> from your Downloads folder.',
      'Press <b>Send</b>.'
    ], gmail);
  });
  $('pdfDownload').addEventListener('click', savePdf);
  $('sendNew').addEventListener('click', function () {
    closeDialog(); form.reset(); statusEl.innerHTML = '';
    qsa('.has-error', form).forEach(function (f) { f.classList.remove('has-error'); });
    $('qOrg').focus();
  });
})();

/* Links from the old one-page site (index.html#gallery, #project-x and so on) */
(function () {
  if (!/(^|\/)(index\.html)?$/.test(location.pathname)) return;
  var h = location.hash, map = { '#about': 'about.html', '#services': 'services.html', '#projects': 'projects.html', '#gallery': 'gallery.html', '#contact': 'contact.html', '#quote': 'business_enquiry.html' };
  if (map[h]) location.replace(map[h]);
  else if (/^#project-[a-z0-9-]+$/.test(h)) location.replace('projects.html' + h);
})();

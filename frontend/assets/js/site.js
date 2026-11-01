/* =========================================================
   M/S. Tulshi Enterprises — page behaviour
   ========================================================= */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var PROJECTS = window.PROJECTS || [];
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var IMG = function (n) { return 'gallery/img/photo-' + pad(n) + '.jpg'; };
  var THUMB = function (n) { return 'gallery/thumbs/photo-' + pad(n) + '.jpg'; };
  var waNumber = SITE.whatsapp || '917787808990';
  // history can be blocked inside embedded previews; never let that break the page
  function hist(method, state, url) { try { history[method](state, '', url); return true; } catch (e) { return false; } }
  var waUrl = function (text) { return 'https://wa.me/' + waNumber + (text ? '?text=' + encodeURIComponent(text) : ''); };

  /* ---------------------------------------------------------
     Day / night mode
     --------------------------------------------------------- */
  var MODE_KEY = 'tulshi-mode';
  var pendant = $('pendant');
  function currentMode() { return root.getAttribute('data-mode') === 'day' ? 'day' : 'night'; }
  function setMode(mode, save) {
    var night = mode !== 'day';
    root.setAttribute('data-mode', night ? 'night' : 'day');
    qsa('[data-mode-toggle]').forEach(function (el) {
      el.setAttribute('aria-checked', String(night));
      el.setAttribute('title', night ? 'Switch to day' : 'Switch to night');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { var bgc = getComputedStyle(root).getPropertyValue('--header-solid').trim(); if (bgc) meta.setAttribute('content', bgc); }
    if (pendant) {
      pendant.classList.remove('is-igniting');
      if (night && !reduceMotion) { void pendant.offsetWidth; pendant.classList.add('is-igniting'); }
    }
    if (save) { try { localStorage.setItem(MODE_KEY, night ? 'night' : 'day'); } catch (e) {} }
  }
  function toggleMode() { setMode(currentMode() === 'night' ? 'day' : 'night', true); }
  setMode(currentMode(), false);

  /* ---------------------------------------------------------
     Hanging lamp — the lamp stays still; only the pull chain moves.
     Click / tap the chain or the lamp, or drag the chain down and let go.
     --------------------------------------------------------- */
  var lamp = (function () {
    var svg = $('pdSvg'), chainG = $('pdChain'), handle = $('pdHandle'), body = $('pdBody');
    if (!svg || !chainG || !handle) return { pull: toggleMode };

    var AX = 152, AY = 222;          // where the chain hangs from the shade rim
    var LEN = 60, MAX_S = 40, BEADS = 14;
    var s = 0, vs = 0, th = 0, vth = 0; // stretch + swing angle, with velocities
    var drag = null, running = false, used = false;

    var beads = [];
    for (var i = 0; i < BEADS; i++) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', i % 2 ? '1.5' : '2');
      c.setAttribute('fill', 'url(#pd-bead)');
      chainG.appendChild(c); beads.push(c);
    }
    function r1(v) { return Math.round(v * 10) / 10; }
    function render() {
      var L = LEN + s, sx = Math.sin(th), cy = Math.cos(th);
      for (var k = 0; k < BEADS; k++) {
        var t = (k + 0.5) / BEADS;
        beads[k].setAttribute('cx', r1(AX + sx * L * t));
        beads[k].setAttribute('cy', r1(AY + cy * L * t));
      }
      handle.setAttribute('transform', 'translate(' + r1(AX + sx * L) + ' ' + r1(AY + cy * L) + ') rotate(' + r1(-th * 180 / Math.PI) + ')');
    }
    function step() {
      if (drag) {
        var dx = drag.x - AX, dy = drag.y - AY;
        var ts = Math.max(-8, Math.min(MAX_S, Math.hypot(dx, dy) - LEN));
        var tt = Math.max(-0.45, Math.min(0.45, Math.atan2(dx, Math.max(dy, 1))));
        s += (ts - s) * 0.45; th += (tt - th) * 0.45; vs = 0; vth = 0;
      } else {
        vs += -0.1 * s - 0.16 * vs; s += vs;
        vth += -0.045 * th - 0.05 * vth; th += vth;
      }
    }
    function loop() {
      step(); render();
      if (!drag && Math.abs(s) < 0.05 && Math.abs(vs) < 0.05 && Math.abs(th) < 0.002 && Math.abs(vth) < 0.002) {
        s = vs = th = vth = 0; render(); running = false; return;
      }
      requestAnimationFrame(loop);
    }
    function wake() { if (reduceMotion) { s = th = 0; render(); return; } if (!running) { running = true; requestAnimationFrame(loop); } }
    function markUsed() { if (!used) { used = true; pendant.classList.add('is-used'); } }
    function pull() { markUsed(); vs += 7; vth += (Math.random() < 0.5 ? -1 : 1) * 0.03; wake(); toggleMode(); }

    function toSvg(e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    var start = null, grabOff = null, moved = 0;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      var p = toSvg(e), L = LEN + s;
      start = p; moved = 0;
      grabOff = { x: p.x - (AX + Math.sin(th) * L), y: p.y - (AY + Math.cos(th) * L) };
      drag = { x: p.x - grabOff.x, y: p.y - grabOff.y };
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      wake();
    }
    function onMove(e) {
      if (!drag) return;
      var p = toSvg(e);
      moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
      drag = { x: p.x - grabOff.x, y: p.y - grabOff.y };
    }
    function onUp() {
      if (!drag) return;
      var stretched = s > 20;
      drag = null;
      if (moved < 5) { pull(); return; }
      markUsed();
      if (stretched) toggleMode();
      wake();
    }
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
    handle.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse' && !drag && !reduceMotion) { vth += 0.018; wake(); }
    });
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pull(); }
    });
    if (body) body.addEventListener('click', pull);
    render();
    return { pull: pull };
  })();

  qsa('[data-mode-toggle]').forEach(function (b) { b.addEventListener('click', function () { lamp.pull(); }); });

  /* ---------------------------------------------------------
     Header: mobile menu + current section
     --------------------------------------------------------- */
  var nav = $('siteNav'), menuBtn = document.querySelector('.menu-btn');
  function closeMenu() { if (!nav) return; nav.classList.remove('is-open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); }
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    qsa('a', nav).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }
  if ('IntersectionObserver' in window && nav) {
    var links = qsa('a[href^="#"]:not(.nav-cta)', nav);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['top', 'about', 'projects', 'gallery', 'services', 'contact'].forEach(function (id) { var el = $(id); if (el) spy.observe(el); });
  }

  /* ---------------------------------------------------------
     Social links + WhatsApp links (from config.js)
     --------------------------------------------------------- */
  var SOCIAL_ICONS = {
    instagram: { label: 'Instagram', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></g><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>' },
    facebook: { label: 'Facebook', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 8H6v4h3v12h5V12h3.64L18 8h-4V6.33C14 5.38 14.19 5 15.12 5H18V0h-3.81C10.6 0 9 1.58 9 4.62V8z"/></svg>' },
    youtube: { label: 'YouTube', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>' },
    vimeo: { label: 'Vimeo', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.98 6.9c-.1 2.3-1.7 5.5-4.8 9.5-3.2 4.2-5.9 6.2-8.1 6.2-1.4 0-2.5-1.3-3.4-3.8L5.8 12c-.7-2.5-1.4-3.8-2.2-3.8-.2 0-.8.4-1.8 1.1L.8 8c1.1-1 2.2-1.9 3.3-2.9 1.5-1.3 2.6-2 3.3-2 1.8-.2 2.8 1 3.2 3.6.4 2.8.7 4.5.9 5.2.5 2.3 1.1 3.4 1.7 3.4.5 0 1.2-.8 2.2-2.3 1-1.5 1.5-2.7 1.6-3.5.1-1.3-.4-2-1.6-2-.5 0-1.1.1-1.7.4 1.1-3.6 3.3-5.4 6.5-5.3 2.4.1 3.5 1.6 3.4 4.6z"/></svg>' },
    linkedin: { label: 'LinkedIn', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z"/></svg>' }
  };
  var social = SITE.social || {};
  // only plain https links are accepted, so a mistyped or malicious link in config.js can never run code
  var safeUrl = function (u) { return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u); };
  var socialHtml = ['linkedin', 'facebook', 'instagram', 'youtube', 'vimeo'].filter(function (k) { return safeUrl(social[k]); }).map(function (k) {
    return '<a href="' + esc(social[k]) + '" target="_blank" rel="noopener" aria-label="' + SOCIAL_ICONS[k].label + '">' + SOCIAL_ICONS[k].svg + '</a>';
  }).join('');
  qsa('[data-social]').forEach(function (el) { el.innerHTML = socialHtml; });
  qsa('[data-wa-link]').forEach(function (a) { a.href = waUrl(SITE.whatsappGreeting); });
  var yearEl = $('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Dialog helpers
     --------------------------------------------------------- */
  function lockPage(on) { document.body.classList.toggle('is-locked', on); }
  function showDialog(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); lockPage(true); }
  function hideDialog(d) { if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open'); if (!document.querySelector('dialog[open]')) lockPage(false); }

  var ICO = function (id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  function keepUnits(s) { return s.replace(/(\d) (m|mtr|kV)\b/g, '$1&nbsp;$2'); } // keeps "5 m" on one line
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* ---------------------------------------------------------
     About: "From pit to switch-on" centre carousel.
     The current stage sits in the middle; each arrow click slides
     every photo one place along.
     --------------------------------------------------------- */
  (function () {
    var pc = $('pc'); if (!pc) return;
    var cards = qsa('.pc-card', pc), track = $('pcTrack'), cap = $('pcCaption');
    var prev = $('pcPrev'), next = $('pcNext'), cur = 0, n = cards.length, capT = null;
    track.innerHTML = cards.map(function (c, i) {
      return '<button type="button" data-i="' + i + '" aria-label="Stage ' + (i + 1) + ': ' + esc(c.dataset.title) + '"><span class="n">' + (i + 1) + '</span><span class="name">' + esc(c.dataset.title) + '</span></button>';
    }).join('');
    var dots = qsa('button', track);
    // [distance from centre] -> offset (x card width), scale, opacity, brightness
    var POS = [[0, 1, 1, 1], [0.68, 0.8, 0.92, 0.6], [1.2, 0.64, 0.55, 0.45], [1.6, 0.55, 0, 0.4]];
    function layout() {
      var cw = cards[0].offsetWidth;
      cards.forEach(function (c, i) {
        var o = i - cur, d = Math.min(Math.abs(o), 3), s = POS[d], dir = o < 0 ? -1 : 1;
        c.style.transform = 'translateX(-50%) translateX(' + Math.round(dir * s[0] * cw) + 'px) scale(' + s[1] + ')';
        c.style.opacity = s[2];
        c.style.filter = d ? 'brightness(' + s[3] + ')' : 'none';
        c.style.zIndex = String(10 - d);
        c.classList.toggle('is-center', d === 0);
        c.classList.toggle('is-off', d > 2);
        c.tabIndex = d === 0 ? 0 : -1;
        c.setAttribute('aria-label', d === 0 ? 'Stage ' + (i + 1) + ', ' + c.dataset.title + ': open photo full size' : 'Go to stage ' + (i + 1) + ', ' + c.dataset.title);
      });
    }
    function caption(first) {
      var c = cards[cur];
      var fill = function () {
        $('pcStep').textContent = 'Stage ' + (cur + 1) + ' of ' + n;
        $('pcTitle').textContent = c.dataset.title;
        $('pcText').textContent = c.dataset.text;
        cap.classList.remove('is-swap');
      };
      if (first || reduceMotion) fill(); else { cap.classList.add('is-swap'); clearTimeout(capT); capT = setTimeout(fill, 180); }
    }
    function go(i, first) {
      cur = Math.max(0, Math.min(n - 1, i));
      layout(); caption(first);
      prev.disabled = cur === 0; next.disabled = cur === n - 1;
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === cur); d.classList.toggle('is-done', k < cur); d.setAttribute('aria-current', k === cur ? 'step' : 'false'); });
    }
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    track.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) go(+b.dataset.i); });
    var swiped = false;
    cards.forEach(function (c, i) {
      c.addEventListener('click', function () {
        if (swiped) { swiped = false; return; }
        if (i !== cur) go(i); else openProject(c.dataset.project, c.dataset.photo);
      });
    });
    pc.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    });
    // swipe on touch screens
    var stage = $('pcStage'), sx = null, sy = 0;
    stage.style.touchAction = 'pan-y';
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(cur + (dx < 0 ? 1 : -1)); setTimeout(function () { swiped = false; }, 400); }
    });
    window.addEventListener('resize', layout);
    go(0, true);
  })();

  /* ---------------------------------------------------------
     Field execution: projects as slides that move sideways
     --------------------------------------------------------- */
  var deckApi = (function () {
    var deck = $('deck'), trackEl = $('deckTrack'), view = $('deckViewport'), strip = $('deckStrip');
    if (!deck || !PROJECTS.length) return null;
    var n = PROJECTS.length, cur = 0;
    trackEl.innerHTML = PROJECTS.map(function (p, i) {
      var shown = p.photos.length > 1 ? p.photos.slice(0, 4) : [];
      var extra = p.photos.length - shown.length;
      return '<article class="pslide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + ': ' + esc(p.title) + '">' +
        '<button type="button" class="pslide-photo" data-open-project="' + esc(p.id) + '" data-open-photo="' + p.cover + '" aria-label="Open photos: ' + esc(p.title) + '">' +
          '<img src="' + IMG(p.cover) + '" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" decoding="async" style="object-position:' + esc(p.pos) + '">' +
          '<span class="pslide-num">' + pad(i + 1) + ' / ' + pad(n) + '</span></button>' +
        '<div class="pslide-body">' +
          '<h3 class="pslide-title">' + keepUnits(esc(p.title)) + '</h3>' +
          '<div class="pslide-where"><span>' + ICO('i-pin') + esc(p.loc) + '</span>' + (p.client ? '<span>' + ICO('i-client') + esc(p.client) + '</span>' : '') + '</div>' +
          '<div class="pslide-specs">' + p.specs.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' +
          '<p class="pslide-desc">' + esc(p.blurb) + '</p>' +
          (shown.length ? '<div class="pslide-thumbs">' + shown.map(function (ph, k) {
            var last = k === shown.length - 1 && extra > 0;
            return '<button type="button" data-open-project="' + esc(p.id) + '" data-open-photo="' + ph.n + '" aria-label="Open photo: ' + esc(ph.title) + '"><img src="' + THUMB(ph.n) + '" alt="" loading="lazy" decoding="async">' + (last ? '<span class="more">+' + extra + '</span>' : '') + '</button>';
          }).join('') + '</div>' : '') +
          '<div class="pslide-actions">' +
            '<button type="button" class="btn btn-primary" data-open-project="' + esc(p.id) + '">' + (p.photos.length > 1 ? 'View all ' + p.photos.length + ' photos' : 'View photo') + '</button>' +
            '<button type="button" class="btn btn-line" data-quote-tags="' + esc(p.tags.join(',')) + '">Get a quote for similar work</button>' +
          '</div>' +
        '</div></article>';
    }).join('');
    strip.innerHTML = PROJECTS.map(function (p, i) {
      return '<button type="button" data-i="' + i + '" aria-label="Go to project ' + (i + 1) + ': ' + esc(p.title) + '"><img src="' + THUMB(p.cover) + '" alt="" loading="lazy" style="object-position:' + esc(p.pos) + '"><span class="sn">' + (i + 1) + '</span></button>';
    }).join('');
    var slides = qsa('.pslide', trackEl), stripBtns = qsa('button', strip);
    var prevB = $('deckPrev'), nextB = $('deckNext');

    function go(i) {
      cur = Math.max(0, Math.min(n - 1, i));
      trackEl.style.transform = 'translateX(' + (-cur * 100) + '%)';
      slides.forEach(function (s, k) { if (k === cur) s.removeAttribute('inert'); else s.setAttribute('inert', ''); });
      $('deckCount').innerHTML = '<b>' + pad(cur + 1) + '</b> / ' + pad(n);
      stripBtns.forEach(function (b, k) { b.classList.toggle('is-on', k === cur); b.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      var on = stripBtns[cur];
      if (on) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      prevB.disabled = cur === 0; nextB.disabled = cur === n - 1;
      prevB.style.opacity = cur === 0 ? '.35' : ''; nextB.style.opacity = cur === n - 1 ? '.35' : '';
    }
    prevB.addEventListener('click', function () { go(cur - 1); });
    nextB.addEventListener('click', function () { go(cur + 1); });
    strip.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) go(+b.dataset.i); });
    deck.addEventListener('click', function (e) {
      var q = e.target.closest('[data-quote-tags]');
      if (q) { goToQuote(q.getAttribute('data-quote-tags').split(',')); }
    });
    deck.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    });

    // drag / swipe sideways
    var start = null, dragging = false, blockClick = false;
    view.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragging = false;
    });
    view.addEventListener('pointermove', function (e) {
      if (!start || e.pointerId !== start.id) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true; trackEl.classList.add('is-drag');
        try { view.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var edge = (cur === 0 && dx > 0) || (cur === n - 1 && dx < 0) ? 0.35 : 1;
      trackEl.style.transform = 'translateX(calc(' + (-cur * 100) + '% + ' + Math.round(dx * edge) + 'px))';
    });
    function endDrag(e) {
      if (!start) return;
      var dx = e.clientX - start.x; start = null;
      if (!dragging) return;
      dragging = false; trackEl.classList.remove('is-drag'); blockClick = true;
      setTimeout(function () { blockClick = false; }, 50);
      if (dx < -60) go(cur + 1); else if (dx > 60) go(cur - 1); else go(cur);
    }
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('click', function (e) { if (blockClick) { e.stopPropagation(); e.preventDefault(); } }, true);
    view.addEventListener('dragstart', function (e) { e.preventDefault(); });

    go(0);
    return { go: go, index: function () { return cur; } };
  })();

  /* ---------------------------------------------------------
     Gallery: every photo, filter by project
     --------------------------------------------------------- */
  (function () {
    var grid = $('galGrid'), filters = $('galFilters'), more = $('galMore'), count = $('galCount');
    if (!grid) return;
    // 13 per batch: one large tile (4 cells) + 12 small ones fills four full rows of four
    var STEP = 13, filter = 'all', shown = 0, list = [];
    // "All" mixes the projects so the first screen isn't all one site
    var all = [], longest = 0;
    PROJECTS.forEach(function (p) { longest = Math.max(longest, p.photos.length); });
    for (var k = 0; k < longest; k++) PROJECTS.forEach(function (p) { if (p.photos[k]) all.push({ p: p, ph: p.photos[k] }); });
    filters.innerHTML = '<button type="button" data-f="all" aria-pressed="true">All projects<span class="c">' + all.length + '</span></button>' +
      PROJECTS.map(function (p) { return '<button type="button" data-f="' + esc(p.id) + '" aria-pressed="false">' + esc(p.short || p.title) + '<span class="c">' + p.photos.length + '</span></button>'; }).join('');
    function itemHtml(it, i) {
      var big = i % STEP === 0;
      return '<button type="button" class="gal-item is-new' + (big ? ' is-big' : '') + '" data-open-project="' + esc(it.p.id) + '" data-open-photo="' + it.ph.n + '" aria-label="Open photo: ' + esc(it.ph.title) + '">' +
        '<img src="' + (big ? IMG(it.ph.n) : THUMB(it.ph.n)) + '" alt="' + esc(it.ph.title) + '" loading="lazy" decoding="async">' +
        '<span class="gal-cap">' + esc(it.ph.title) + '<small>' + esc(it.p.short || it.p.title) + '</small></span></button>';
    }
    function showMore() {
      var next = list.slice(shown, shown + STEP);
      grid.insertAdjacentHTML('beforeend', next.map(function (it, j) { return itemHtml(it, shown + j); }).join(''));
      shown += next.length;
      count.textContent = 'Showing ' + shown + ' of ' + plural(list.length, 'photo');
      more.hidden = shown >= list.length;
    }
    function apply(f) {
      filter = f;
      list = f === 'all' ? all : all.filter(function (it) { return it.p.id === f; }).sort(function (a, b) { return a.p.photos.indexOf(a.ph) - b.p.photos.indexOf(b.ph); });
      qsa('button', filters).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === f)); });
      grid.innerHTML = ''; shown = 0; showMore();
    }
    filters.addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (b && b.dataset.f !== filter) apply(b.dataset.f); });
    more.addEventListener('click', function () {
      var first = shown; showMore();
      var el = grid.children[first]; if (el) el.focus({ preventScroll: true });
    });
    apply('all');
  })();

  /* ---------------------------------------------------------
     Services: a string of filament bulbs across the top of the
     section. Off in day mode; in night mode they switch on one
     after another once the section scrolls into view.
     --------------------------------------------------------- */
  (function () {
    var sec = $('services'); if (!sec) return;
    var holder = document.createElement('div');
    holder.className = 'lights'; holder.setAttribute('aria-hidden', 'true');
    sec.insertBefore(holder, sec.firstChild);
    var DEFS = '<defs>' +
      '<linearGradient id="lt-metal" x1="0" x2="1"><stop offset="0" stop-color="#363B46"/><stop offset=".45" stop-color="#AEB5C2"/><stop offset="1" stop-color="#454B57"/></linearGradient>' +
      '<radialGradient id="lt-glass-on" cx=".45" cy=".6" r=".65"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFF2C9"/><stop offset=".68" stop-color="#FFC874"/><stop offset="1" stop-color="#EE9B32"/></radialGradient>' +
      '<radialGradient id="lt-glow"><stop offset="0" stop-color="#FFD891" stop-opacity=".6"/><stop offset=".4" stop-color="#FFB45A" stop-opacity=".18"/><stop offset="1" stop-color="#FFB45A" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    var BULB = '<circle class="lt-glow" cx="0" cy="21" r="30"/>' +
      '<rect class="lt-cap" x="-4.5" y="0" width="9" height="10.5" rx="1.6"/>' +
      '<path class="lt-ridge" d="M-4.5 3.2H4.5M-4.5 5.8H4.5M-4.5 8.4H4.5"/>' +
      '<path class="lt-glass" d="M-3.6 10C-3.6 13 -8.6 15 -8.6 22A8.6 8.6 0 0 0 8.6 22C8.6 15 3.6 13 3.6 10Z"/>' +
      '<path class="lt-fil" d="M-1.5 10.5V17.5M1.5 10.5V17.5M-1.5 17.5L-4 21L-2 24L0 21L2 24L4 21L1.5 17.5"/>' +
      '<ellipse class="lt-shine" cx="-4.6" cy="19" rx="1.3" ry="3" transform="rotate(18 -4.6 19)"/>';
    var lastW = 0;
    function r1(v) { return Math.round(v * 10) / 10; }
    function build() {
      var W = holder.clientWidth; if (!W || W === lastW) return; lastW = W;
      var swags = Math.max(1, Math.round(W / 440)), span = W / swags;
      var sag = Math.min(42, span * 0.1), y0 = 6, spacing = W < 700 ? 54 : 66;
      var wire = '', hooks = '', bulbs = '', i = 0;
      for (var s = 0; s < swags; s++) {
        var x0 = s * span, x1 = x0 + span;
        wire += 'M' + r1(x0) + ' ' + y0 + 'Q' + r1(x0 + span / 2) + ' ' + r1(y0 + 2 * sag) + ' ' + r1(x1) + ' ' + y0;
        hooks += '<circle class="lt-hook" cx="' + r1(x0) + '" cy="' + y0 + '" r="2.6"/>';
        var count = Math.max(2, Math.round(span / spacing));
        for (var k = 1; k <= count; k++) {
          // half-step offset keeps the spacing even across the hanging points
          var t = (k - 0.5) / count, x = x0 + span * t, y = y0 + 4 * sag * t * (1 - t);
          bulbs += '<line class="lt-cord" x1="' + r1(x) + '" y1="' + r1(y) + '" x2="' + r1(x) + '" y2="' + r1(y + 5) + '"/>' +
            '<g class="lt-bulb" style="--d:' + (i * 0.055).toFixed(3) + 's" transform="translate(' + r1(x) + ' ' + r1(y + 5) + ')">' + BULB + '</g>';
          i++;
        }
      }
      hooks += '<circle class="lt-hook" cx="' + r1(W) + '" cy="' + y0 + '" r="2.6"/>';
      holder.innerHTML = '<svg width="' + W + '" height="120" viewBox="0 0 ' + W + ' 120" focusable="false">' + DEFS +
        '<path class="lt-wire" d="' + wire + '"/>' + hooks + bulbs + '</svg>';
    }
    build();
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    if (!('IntersectionObserver' in window) || reduceMotion) { sec.classList.add('is-lit'); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { sec.classList.add('is-lit'); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(sec);
  })();

  /* ---------------------------------------------------------
     Back-to-top button (above the WhatsApp button)
     --------------------------------------------------------- */
  (function () {
    var b = $('toTop'); if (!b) return;
    var ticking = false;
    function check() { ticking = false; b.classList.toggle('is-visible', window.scrollY > 600); }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    b.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var brand = document.querySelector('.site-header .brand'); if (brand) brand.focus({ preventScroll: true });
    });
    check();
  })();

  /* ---------------------------------------------------------
     Project photo viewer
     --------------------------------------------------------- */
  var viewer = $('viewer'), track = $('vTrack'), thumbs = $('vThumbs'), nowBox = $('vNow'), progFill = $('vProgFill');
  var P = null, idx = 0, playing = false, hovering = false, timer = null, swapT = null, rafPending = false, opener = null;
  var SLIDE_MS = 4500;
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4l14 8-14 8z"/></svg>Play';
  var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>Pause';

  function findProject(id) { for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].id === id) return PROJECTS[i]; return null; }

  function openProject(id, photoN, fromHash) {
    var p = findProject(id); if (!p || !viewer) return;
    var wasOpen = viewer.open;
    if (!wasOpen) opener = document.activeElement;
    P = p; idx = 0;
    if (photoN != null) { for (var j = 0; j < p.photos.length; j++) if (p.photos[j].n === +photoN) { idx = j; break; } }
    var n = PROJECTS.indexOf(p) + 1;
    $('vCrumb').innerHTML = 'Project <b>' + n + '</b> of ' + PROJECTS.length;
    $('vTitle').textContent = p.title;
    $('vFullName').textContent = p.name;
    $('vFacts').innerHTML =
      '<div class="vfact">' + ICO('i-pin') + '<div><b>Location</b>' + esc(p.loc) + '</div></div>' +
      (p.client ? '<div class="vfact">' + ICO('i-client') + '<div><b>Client</b>' + esc(p.client) + '</div></div>' : '') +
      '<div class="vfact">' + ICO('i-photos') + '<div><b>Photos</b>' + p.photos.length + '</div></div>';
    $('vDesc').textContent = p.desc;

    track.innerHTML = p.photos.map(function (ph, i) {
      var near = Math.abs(i - idx) < 2;
      return '<div class="slide"><img src="' + IMG(ph.n) + '" alt="' + esc(ph.title) + '"' + (near ? '' : ' loading="lazy"') + ' decoding="async" draggable="false"></div>';
    }).join('');
    thumbs.innerHTML = p.photos.map(function (ph, i) {
      return '<button type="button" data-i="' + i + '" aria-label="Photo ' + (i + 1) + ': ' + esc(ph.title) + '"><img src="' + THUMB(ph.n) + '" alt="" loading="lazy" decoding="async"></button>';
    }).join('');
    var multi = p.photos.length > 1;
    ['vPrev', 'vNext', 'vPlay', 'vProg'].forEach(function (k) { $(k).style.display = multi ? '' : 'none'; });
    thumbs.style.display = multi ? '' : 'none';

    if (!wasOpen) showDialog(viewer);
    if (!fromHash) {
      var url = location.pathname + location.search + '#project-' + id;
      if (wasOpen && history.state && history.state.viewer) hist('replaceState', { viewer: id }, url);
      else hist('pushState', { viewer: id }, url);
    }
    $('vBody').scrollTop = 0; $('vInfo').scrollTop = 0;
    requestAnimationFrame(function () { track.scrollLeft = idx * track.clientWidth; });
    render(true); restart();
    if (!wasOpen) $('vClose').focus({ preventScroll: true });
  }

  function closeProject(fromHash) {
    if (!viewer || !viewer.open) return;
    stopTimer();
    hideDialog(viewer);
    if (!fromHash && /^#project-/.test(location.hash)) hist('replaceState', null, location.pathname + location.search);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
    setTimeout(function () { if (!viewer.open) track.innerHTML = ''; }, 300);
  }
  function requestClose() {
    if (history.state && history.state.viewer) history.back(); else closeProject();
  }

  function render(first) {
    var ph = P.photos[idx];
    $('vCounter').textContent = (idx + 1) + ' / ' + P.photos.length;
    $('vPlay').innerHTML = playing ? PAUSE : PLAY;
    $('vPlay').setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
    qsa('button', thumbs).forEach(function (t, i) { t.classList.toggle('is-on', i === idx); });
    var on = thumbs.children[idx];
    if (on) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2 + on.clientWidth / 2, behavior: first || reduceMotion ? 'auto' : 'smooth' });
    var fill = function () {
      $('vTag').textContent = ph.tag; $('vPhotoTitle').textContent = ph.title; $('vPhotoDesc').textContent = ph.desc;
      $('vMeta').innerHTML = [ph.place, ph.note].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
      nowBox.classList.remove('is-swap');
    };
    if (first || reduceMotion) fill(); else { nowBox.classList.add('is-swap'); clearTimeout(swapT); swapT = setTimeout(fill, 160); }
  }
  function goTo(i, smooth) {
    var n = P.photos.length; i = (i + n) % n;
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth !== false && !reduceMotion ? 'smooth' : 'auto' });
    if (i !== idx) { idx = i; render(); }
    restart();
  }
  function stepPhoto(d) { goTo(idx + d); }
  function stopTimer() { clearTimeout(timer); timer = null; progFill.style.animation = 'none'; progFill.style.width = '0'; }
  function restart() {
    stopTimer(); void progFill.offsetWidth;
    if (!P || P.photos.length < 2 || !playing || hovering || document.hidden || !viewer.open) return;
    progFill.style.animation = 'fill ' + SLIDE_MS + 'ms linear forwards';
    timer = setTimeout(function () { stepPhoto(1); }, SLIDE_MS);
  }
  function stepProject(d) {
    var i = PROJECTS.indexOf(P); var nx = PROJECTS[(i + d + PROJECTS.length) % PROJECTS.length];
    openProject(nx.id);
  }

  if (viewer) {
    track.addEventListener('scroll', function () {
      if (rafPending || !P) return; rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        var i = Math.round(track.scrollLeft / (track.clientWidth || 1));
        if (i !== idx && i >= 0 && i < P.photos.length) { idx = i; render(); restart(); }
      });
    }, { passive: true });
    var down = false, sx = 0, sl = 0;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; sx = e.clientX; sl = track.scrollLeft; track.classList.add('is-drag'); });
    window.addEventListener('pointermove', function (e) { if (down) track.scrollLeft = sl - (e.clientX - sx); });
    window.addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-drag'); goTo(Math.round(track.scrollLeft / track.clientWidth)); });
    var stage = $('vStage');
    stage.addEventListener('mouseenter', function () { hovering = true; restart(); });
    stage.addEventListener('mouseleave', function () { hovering = false; restart(); });
    document.addEventListener('visibilitychange', restart);
    $('vPrev').addEventListener('click', function () { stepPhoto(-1); });
    $('vNext').addEventListener('click', function () { stepPhoto(1); });
    $('vPlay').addEventListener('click', function () { playing = !playing; render(); restart(); });
    $('vPrevProject').addEventListener('click', function () { stepProject(-1); });
    $('vNextProject').addEventListener('click', function () { stepProject(1); });
    thumbs.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) goTo(+b.dataset.i); });
    $('vClose').addEventListener('click', requestClose);
    viewer.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepPhoto(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPhoto(-1); }
      else if (e.key === ' ' && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); $('vPlay').click(); }
    });
    $('vQuote').addEventListener('click', function () {
      var tags = P ? P.tags.slice() : [];
      requestClose();
      setTimeout(function () { goToQuote(tags); }, 60);
    });
    window.addEventListener('resize', function () { if (P && viewer.open) track.scrollLeft = idx * track.clientWidth; });
  }

  window.addEventListener('popstate', function () {
    var m = location.hash.match(/^#project-(.+)$/);
    if (m && findProject(m[1])) openProject(m[1], null, true); else closeProject(true);
  });

  // any element with data-open-project opens the viewer (tiles, process steps, about photo)
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-project]');
    if (!t) return;
    e.preventDefault();
    var sheet = $('serviceSheet'); if (sheet && sheet.open) hideDialog(sheet);
    openProject(t.getAttribute('data-open-project'), t.getAttribute('data-open-photo'));
  });

  /* ---------------------------------------------------------
     Service details
     --------------------------------------------------------- */
  var SERVICES = {
    street: { title: 'Street lighting', text: 'LED street lighting for roads, campuses, factories and townships, from the pole foundation to the night-time check.',
      list: ['Single-arm, double-arm, octagonal and decorative poles', 'Pole foundations, erection, plumbing and grouting', 'LED luminaire fitting, pole wiring and earthing', 'Feeder pillar with timer or photocell control', 'Energising and night-time lighting check before handover'] },
    highmast: { title: 'High masts', text: 'High masts for junctions, yards, stations and parks, erected by crane on foundations we cast ourselves.',
      list: ['12 m to 30 m galvanised high masts', 'Foundation with anchor bolt cage and template', 'Crane erection and section fitting', 'Lantern carriage, LED floodlights and winch', 'Aviation lamp, lightning finial and earthing', 'Commissioning with all floodlights tested'] },
    lines: { title: 'HT & LT lines', text: 'Overhead distribution line work carried out to DISCOM norms.',
      list: ['11 kV and 33 kV overhead lines', 'PCC and steel tubular pole erection', 'Conductor stringing and AB cabling', 'Stay sets, cross-arms and insulators', 'Line clearance and shutdown permits'] },
    substation: { title: 'Substations & transformers', text: 'Distribution transformer substations installed, earthed and made ready for charging.',
      list: ['Plinth-mounted and pole-mounted distribution transformers', 'Isolators, lightning arresters and fuse sets', 'Deep earthing grid and earth pits', 'LT distribution and cabling to load points'] },
    civil: { title: 'Civil foundations & RCC', text: 'The civil side of every electrical job: pits, steel and concrete, done by our own crew.',
      list: ['Setting out and machine or hand excavation', 'Rebar mats, cages and anchor bolt templates', 'Plywood shuttering and pedestal formwork', 'Ready-mix concreting, compaction and curing', 'Plinths for feeder pillars and transformers'] },
    cabling: { title: 'Underground cabling', text: 'Cable routes trenched, ducted, laid and terminated.',
      list: ['Trenching along roads and boundary walls', 'HDPE duct laying', 'XLPE armoured cable laying', 'Cable glands, lugs and core termination', 'Backfilling and route restoration'] },
    panels: { title: 'Feeder pillars & junction boxes', text: 'Control and distribution points for lighting circuits, installed and wired.',
      list: ['Outdoor feeder pillars on plinths or stands', 'Pole-mounted control and junction boxes', 'Cut-outs, MCBs and timer controls', 'Danger plates, earthing and cable dressing'] },
    maintenance: { title: 'Repair & maintenance', text: 'Fixing and upgrading existing street lighting so it keeps working.',
      list: ['Lamp-head repair and replacement at height', 'Faulty cable replacement', 'Junction and control box changeover', 'Earthing checks and re-termination'] },
    poles: { title: 'Pole & material supply', text: 'Poles and fittings supplied to site, with installation if you need it.',
      list: ['Galvanised octagonal poles', 'Decorative poles', 'Flag masts with winch', 'Brackets, base plates and fittings', 'Supply only, or supply and install'] }
  };
  var sheet = $('serviceSheet'), sheetSvc = null;
  function openService(id) {
    var s = SERVICES[id]; if (!s || !sheet) return;
    sheetSvc = id;
    $('sheetIcon').innerHTML = '<use href="#s-' + id + '"/>';
    $('sheetTitle').textContent = s.title;
    $('sheetText').textContent = s.text;
    $('sheetList').innerHTML = s.list.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    var rel = PROJECTS.filter(function (p) { return p.tags.indexOf(id) > -1; });
    $('sheetWorkWrap').hidden = !rel.length;
    $('sheetWork').innerHTML = rel.map(function (p) {
      return '<button type="button" data-open-project="' + esc(p.id) + '"><img src="' + THUMB(p.cover) + '" alt="" loading="lazy"><span>' + esc(p.title) + '</span></button>';
    }).join('');
    $('sheetWa').href = waUrl('Hello Tulshi Enterprises, I would like a quotation for ' + s.title.toLowerCase() + '.');
    showDialog(sheet);
  }
  /* Laptops: choosing a service fills the panel beside the list.
     Phones: the same tap opens the details sheet. */
  var SVC_PHOTO = { street: 4, highmast: 1, civil: 45, cabling: 37, panels: 10, maintenance: 13, poles: 34 };
  var svcPanel = $('svcPanel'), svcBtns = qsa('[data-service]'), svcT = null;
  var wide = window.matchMedia ? window.matchMedia('(min-width: 901px)') : { matches: true };
  function projectOfPhoto(n) {
    for (var i = 0; i < PROJECTS.length; i++) for (var k = 0; k < PROJECTS[i].photos.length; k++) if (PROJECTS[i].photos[k].n === n) return PROJECTS[i].id;
    return null;
  }
  function panelHtml(id) {
    var s = SERVICES[id], n = SVC_PHOTO[id], pid = n && projectOfPhoto(n);
    var media = pid
      ? '<button type="button" class="svp-photo" data-open-project="' + esc(pid) + '" data-open-photo="' + n + '" aria-label="Open photo full size: ' + esc(s.title) + '"><img src="' + IMG(n) + '" alt="' + esc(s.title) + ' on one of our sites" decoding="async"></button>'
      : '<div class="svp-art" aria-hidden="true"><svg><use href="#s-' + id + '"/></svg></div>';
    var rel = PROJECTS.filter(function (p) { return p.tags.indexOf(id) > -1; });
    return media +
      '<h3 class="svp-title">' + esc(s.title) + '</h3>' +
      '<p class="svp-text">' + esc(s.text) + '</p>' +
      '<h4>What\'s included</h4><ul class="svp-list">' + s.list.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      (rel.length ? '<h4>Where we\'ve done it</h4><div class="svp-work">' + rel.map(function (p) {
        return '<button type="button" data-open-project="' + esc(p.id) + '"><img src="' + THUMB(p.cover) + '" alt="" loading="lazy">' + esc(p.short || p.title) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="svp-actions"><button type="button" class="btn btn-primary" data-svc-quote="' + id + '">Ask for a quote</button>' +
      '<a class="btn btn-line" href="' + esc(waUrl('Hello Tulshi Enterprises, I would like a quotation for ' + s.title.toLowerCase() + '.')) + '" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Ask on WhatsApp</a></div>';
  }
  function showService(id, first) {
    if (!svcPanel || !SERVICES[id]) return;
    svcBtns.forEach(function (b) { var on = b.getAttribute('data-service') === id; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    if (first || reduceMotion) { svcPanel.innerHTML = panelHtml(id); return; }
    svcPanel.classList.add('is-swap'); clearTimeout(svcT);
    svcT = setTimeout(function () { svcPanel.innerHTML = panelHtml(id); svcPanel.classList.remove('is-swap'); }, 160);
  }
  svcBtns.forEach(function (b, i) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-service');
      if (wide.matches && svcPanel) showService(id); else openService(id);
    });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var nx = svcBtns[(i + (e.key === 'ArrowDown' ? 1 : -1) + svcBtns.length) % svcBtns.length];
      nx.focus(); if (wide.matches) nx.click();
    });
  });
  if (svcPanel) {
    svcPanel.addEventListener('click', function (e) { var q = e.target.closest('[data-svc-quote]'); if (q) goToQuote([q.getAttribute('data-svc-quote')]); });
    showService('street', true);
  }
  if (sheet) {
    qsa('[data-close]', sheet).forEach(function (b) { b.addEventListener('click', function () { hideDialog(sheet); }); });
    sheet.addEventListener('cancel', function (e) { e.preventDefault(); hideDialog(sheet); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) hideDialog(sheet); });
    $('sheetQuote').addEventListener('click', function () { hideDialog(sheet); goToQuote([sheetSvc]); });
  }

  /* ---------------------------------------------------------
     Quotation form
     --------------------------------------------------------- */
  var form = $('quoteForm'), statusEl = $('qStatus'), doneEl = $('qDone');
  function chipInputs() { return qsa('input[name="category"]', form); }
  function goToQuote(svcIds, note) {
    if (!form) return;
    if (!doneEl.hidden) resetForm();
    var any = false;
    (svcIds || []).forEach(function (id) {
      chipInputs().forEach(function (c) { if (c.getAttribute('data-svc') === id) { c.checked = true; any = true; } });
    });
    if (any) $('chipList').closest('.chips').classList.remove('has-error');
    if (note) { var sc = $('qScope'); if (!sc.value.trim()) sc.value = note; }
    $('contact').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { $('qName').focus({ preventScroll: true }); }, reduceMotion ? 0 : 600);
  }
  qsa('[data-quote-prefill]').forEach(function (b) {
    b.addEventListener('click', function () {
      var anyChecked = chipInputs().some(function (c) { return c.checked; });
      goToQuote(anyChecked ? [] : ['other'], b.getAttribute('data-quote-prefill'));
    });
  });

  function val(id) { var el = $(id); if (!el) return ''; var max = +el.getAttribute('maxlength') || 2000; return el.value.trim().slice(0, max); }
  function chosen() { return chipInputs().filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); }
  function setErr(key, on) {
    var f = form.querySelector('[data-field="' + key + '"]'); if (!f) return;
    f.classList.toggle('has-error', on);
    qsa('input, textarea', f).forEach(function (i) { if (i.type !== 'checkbox') { if (on) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); } });
  }
  function validate() {
    var name = val('qName'), phone = val('qPhone'), email = val('qEmail');
    var ok = { name: !!name, phone: phone.replace(/\D/g, '').length >= 10, email: !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), services: chosen().length > 0 };
    Object.keys(ok).forEach(function (k) { setErr(k, !ok[k]); });
    var first = !ok.name ? 'qName' : !ok.phone ? 'qPhone' : !ok.email ? 'qEmail' : !ok.services ? 'chipList' : null;
    if (first) { var el = first === 'chipList' ? chipInputs()[0] : $(first); el.focus(); return false; }
    return true;
  }
  function summary() {
    return [
      ['Name', val('qName')], ['Phone', val('qPhone')], ['Email', val('qEmail')], ['Organisation', val('qOrg')],
      ['Category', chosen().join(', ')], ['Site', val('qSite')], ['Scope', val('qScope')]
    ].filter(function (r) { return r[1]; });
  }
  function waText() {
    var rows = summary();
    var head = 'Hello Tulshi Enterprises, I would like a quotation.';
    return rows.length ? head + '\n\n' + rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') : (SITE.whatsappGreeting || head);
  }
  function mailtoHref() {
    var body = summary().map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
    return 'mailto:' + (SITE.email || 'tulshienterprises21@gmail.com') + '?subject=' + encodeURIComponent('Quotation request') + '&body=' + encodeURIComponent(body);
  }
  function showError() {
    statusEl.className = 'form-status is-error';
    statusEl.innerHTML = '<strong>The request didn\'t go through.</strong> Check your internet connection and try again, or send the same details another way.' +
      '<span class="status-actions"><a class="link-btn" href="' + esc(mailtoHref()) + '">Send by email</a>' +
      '<a class="link-btn" href="' + esc(waUrl(waText())) + '" target="_blank" rel="noopener">Send on WhatsApp</a></span>';
  }
  function showDone() {
    var first = val('qName').split(/\s+/)[0];
    $('qDoneText').textContent = 'Thanks' + (first ? ', ' + first : '') + '. Your request has reached our office, and we\'ll contact you on ' + val('qPhone') + '.';
    form.hidden = true; doneEl.hidden = false; doneEl.focus();
  }
  function resetForm() { form.reset(); form.hidden = false; doneEl.hidden = true; statusEl.className = 'form-status'; statusEl.innerHTML = ''; qsa('.has-error', form).forEach(function (f) { f.classList.remove('has-error'); }); }

  if (form) {
    form.addEventListener('input', function (e) {
      var f = e.target.closest('[data-field]'); if (f && f.classList.contains('has-error')) setErr(f.getAttribute('data-field'), false);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.className = 'form-status'; statusEl.innerHTML = '';
      if (!validate()) return;
      if ($('qHp') && $('qHp').value) { showDone(); return; } // hidden field only bots fill in
      var btn = $('qSubmit'), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      var cats = chosen();
      var payload = {
        'Name': val('qName'), 'Phone': val('qPhone'), 'email': val('qEmail'), 'Organisation': val('qOrg'),
        'Project category': cats.join(', '), 'Site location': val('qSite'), 'Scope of work': val('qScope'),
        '_subject': 'Quotation request: ' + cats.join(', ') + ' (' + val('qName') + ')',
        '_template': 'table', '_captcha': 'false'
      };
      fetch(SITE.formEndpoint || ('https://formsubmit.co/ajax/' + (SITE.email || 'tulshienterprises21@gmail.com')), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (res.ok && String(res.j.success) === 'true') showDone();
        else { if (res.j && res.j.message) console.warn('Form service:', res.j.message); showError(); }
      }).catch(function () { showError(); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
    $('qWhatsApp').addEventListener('click', function () { window.open(waUrl(waText()), '_blank', 'noopener'); });
    $('qAgain').addEventListener('click', function () { resetForm(); $('qName').focus(); });
  }

  /* ---------------------------------------------------------
     Assistant: an animated engineer. Visitors tap options (no
     typing); he answers in text and speaks the answer aloud.
     The speaker button turns his voice off or on (remembered).
     Answers come from the site's own data; nothing is sent anywhere.
     --------------------------------------------------------- */
  (function () {
    var launch = $('astLaunch'), panel = $('astPanel'), log = $('astLog'), opts = $('astOpts');
    if (!launch || !panel) return;

    // ---- the character (original illustration; mouth moves while he talks) ----
    var AVATAR = '<svg class="av" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      '<circle class="av-bg" cx="60" cy="60" r="60"/>' +
      '<path class="av-shirt" d="M10 124C12 98 32 87 60 87s48 11 50 37z"/>' +
      '<path class="av-vest" d="M27 124l7-31c6-3 14-5 26-5l-8 36zM93 124l-7-31c-6-3-14-5-26-5l8 36z"/>' +
      '<path class="av-strip" d="M30 105h24l-1 5H29zM90 105H66l1 5h24z"/>' +
      '<path class="av-neck" d="M50 72v15c5 5 15 5 20 0V72z"/>' +
      '<g class="av-head">' +
        '<ellipse class="av-skin" cx="35.5" cy="58" rx="5" ry="7"/><ellipse class="av-skin" cx="84.5" cy="58" rx="5" ry="7"/>' +
        '<path class="av-skin" d="M36 50c0-17 10-23 24-23s24 6 24 23v10c0 16-11 24-24 24S36 76 36 60z"/>' +
        '<path class="av-hair" d="M36.5 53c-1-8 .5-12 3.5-15l2 13zM83.5 53c1-8-.5-12-3.5-15l-2 13z"/>' +
        '<path class="av-brow" d="M44 47.5q5-3 10-.6M66 46.9q5-2.4 10 .6"/>' +
        '<g class="av-eyes"><ellipse cx="49" cy="55" rx="3.1" ry="3.6"/><ellipse cx="71" cy="55" rx="3.1" ry="3.6"/></g>' +
        '<path class="av-nose" d="M60.5 57q-2.5 6 .8 7.4"/>' +
        '<path class="av-moustache" d="M51 68.5q4.5-3 9 -.6q4.5-2.4 9 .6q-4.5 1.6-9 .4q-4.5 1.2-9-.4z"/>' +
        '<path class="av-mouth-closed" d="M53 72q7 4.5 14 0"/>' +
        '<ellipse class="av-mouth-open" cx="60" cy="73.2" rx="5.6" ry="3.8"/>' +
        '<path class="av-helmet" d="M33 42c0-19 12-28 27-28s27 9 27 28z"/>' +
        '<rect class="av-helmet" x="28" y="39" width="64" height="7.5" rx="3.75"/>' +
        '<path class="av-ridge" d="M60 15v24M48 18.5l2 20.5M72 18.5l-2 20.5"/>' +
      '</g></svg>';
    qsa('[data-avatar]').forEach(function (el) { el.innerHTML = AVATAR; });
    var faces = qsa('[data-avatar]');

    var PHONES = SITE.phones || [{ label: 'Site', display: '+91 77878 08990', tel: '+917787808990' }];
    var EMAIL = SITE.email || 'tulshienterprises21@gmail.com';
    var MAPS = 'https://maps.google.com/?q=' + encodeURIComponent('Sector-10, Markat Nagar, CDA, Cuttack, Odisha 753014');

    // ---- voice (browser speech; on by default, can be turned off) ----
    var synth = window.speechSynthesis, voiceOn = true, talkT = null;
    try { voiceOn = localStorage.getItem('tulshi-voice') !== 'off'; } catch (e) {}
    var voiceBtn = $('astVoice');
    function paintVoice() { voiceBtn.setAttribute('aria-pressed', String(voiceOn)); voiceBtn.setAttribute('aria-label', voiceOn ? 'Voice on. Tap to mute' : 'Voice off. Tap to turn on'); voiceBtn.title = voiceOn ? 'Mute voice' : 'Turn voice on'; }
    if (!synth) voiceBtn.hidden = true;
    paintVoice();
    voiceBtn.addEventListener('click', function () {
      voiceOn = !voiceOn; paintVoice();
      try { localStorage.setItem('tulshi-voice', voiceOn ? 'on' : 'off'); } catch (e) {}
      if (!voiceOn && synth) { synth.cancel(); talking(false); }
      else if (voiceOn) { var last = log.querySelector('.ast-bot:last-of-type'); if (last) speak(last.innerHTML); }
    });
    function pickVoice() {
      var vs = synth ? synth.getVoices() : [];
      var pref = ['en-IN', 'en-GB', 'en-US'];
      for (var i = 0; i < pref.length; i++) for (var j = 0; j < vs.length; j++) if (vs[j].lang === pref[i]) return vs[j];
      for (j = 0; j < vs.length; j++) if (/^en/i.test(vs[j].lang)) return vs[j];
      return null;
    }
    function talking(on) { faces.forEach(function (f) { f.classList.toggle('is-talking', on); }); }
    function speak(html) {
      clearTimeout(talkT);
      var plain = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
      talking(true);
      var fallback = Math.min(6500, Math.max(1400, plain.length * 55));
      if (voiceOn && synth) {
        try {
          synth.cancel();
          var u = new SpeechSynthesisUtterance(plain.replace(/\+91 /g, 'plus 9 1, ').replace(/ & /g, ' and '));
          var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
          u.onend = u.onerror = function () { talking(false); };
          synth.speak(u);
          talkT = setTimeout(function () { if (!synth.speaking) talking(false); }, fallback + 400);
          return;
        } catch (e) {}
      }
      talkT = setTimeout(function () { talking(false); }, fallback);
    }

    // ---- conversation: every step is a tap ----
    var busy = null, keepFocus = false;
    function bubble(who, html) {
      var d = document.createElement('div');
      d.className = 'ast-msg ast-' + who;
      d.innerHTML = html;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }
    function say(html, options) {
      clearTimeout(busy);
      keepFocus = keepFocus || panel.contains(document.activeElement);
      opts.innerHTML = '';
      var typing = bubble('bot', '<span class="ast-dots" aria-label="Typing"><i></i><i></i><i></i></span>');
      busy = setTimeout(function () {
        typing.innerHTML = html;
        renderOptions(options);
        log.scrollTop = log.scrollHeight;
        speak(html);
      }, reduceMotion ? 0 : 450);
    }
    // option: { label, go } for a next step, or { label, href, ext } for a link (call, WhatsApp, email, map)
    function renderOptions(list) {
      opts.innerHTML = '';
      list.forEach(function (o, i) {
        var el;
        if (o.href) {
          el = document.createElement('a');
          el.href = o.href;
          if (o.ext) { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
        } else {
          el = document.createElement('button');
          el.type = 'button';
          el.addEventListener('click', function () { bubble('user', esc(o.label)); o.go(); });
        }
        el.className = 'ast-opt' + (o.primary ? ' is-primary' : '') + (o.quiet ? ' is-quiet' : '');
        el.textContent = o.label;
        opts.appendChild(el);
        if (i === 0 && keepFocus && !panel.hidden) { el.focus({ preventScroll: true }); keepFocus = false; }
      });
    }
    var BACK = function () { return { label: 'Back to the start', quiet: true, go: menu }; };

    function menuOptions() {
      return [
        { label: 'Get a quotation', go: quoteStart },
        { label: 'Our services', go: servicesList },
        { label: 'Our projects', go: projectsList },
        { label: 'Office address', go: office },
        { label: 'Something else', go: contact }
      ];
    }
    function menu() { say('What would you like to know?', menuOptions()); }
    function quoteStart() {
      var list = Object.keys(SERVICES).map(function (id) { return { label: SERVICES[id].title, go: function () { quoteFor(id); } }; });
      list.push({ label: 'Not sure yet', go: function () { quoteFor('other'); } });
      list.push(BACK());
      say('Sure. What kind of work do you need?', list);
    }
    function quoteFor(id) {
      var name = SERVICES[id] ? SERVICES[id].title.toLowerCase() : 'your work';
      say('Every job is priced on its site and scope, so our engineers quote after seeing the details. I can open the quotation form with <b>' + esc(name) + '</b> already ticked. Just add your name and phone number.', [
        { label: 'Open the quotation form', primary: true, go: function () { close(true); goToQuote([id]); } },
        { label: 'Ask on WhatsApp instead', href: waUrl('Hello Tulshi Enterprises, I would like a quotation for ' + name + '.'), ext: true },
        BACK()
      ]);
    }
    function servicesList() {
      var list = Object.keys(SERVICES).map(function (id) { return { label: SERVICES[id].title, go: function () { serviceInfo(id); } }; });
      list.push(BACK());
      say('We do both the civil and the electrical work. Which service would you like to hear about?', list);
    }
    function serviceInfo(id) {
      var s = SERVICES[id];
      var inc = s.list.slice(0, 3).map(function (l) { return /^[A-Z][a-z]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l; }).join(', ');
      say('<b>' + esc(s.title) + '.</b> ' + esc(s.text) + ' This includes ' + esc(inc) + '.', [
        { label: 'Get a quote for this', primary: true, go: function () { quoteFor(id); } },
        { label: 'Show full details', go: function () {
          close(true);
          if (wide.matches && svcPanel) { showService(id); var sec = $('services'); if (sec) sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
          else openService(id);
        } },
        { label: 'Other services', go: servicesList },
        BACK()
      ]);
    }
    function projectsList() {
      var list = PROJECTS.map(function (p) { return { label: p.title, go: function () { projectInfo(p); } }; });
      list.push(BACK());
      say('Here are some of our recent projects. Which one would you like to see?', list);
    }
    function projectInfo(p) {
      say('<b>' + esc(p.title) + '</b>, ' + esc(p.loc) + (p.client ? ', for ' + esc(p.client) : '') + '. ' + esc(p.blurb), [
        { label: 'See the ' + p.photos.length + (p.photos.length > 1 ? ' photos' : ' photo'), primary: true, go: function () { close(true); openProject(p.id); } },
        { label: 'Other projects', go: projectsList },
        BACK()
      ]);
    }
    function office() {
      say('Our head office is at Sector-10, Markat Nagar, CDA, Cuttack, Odisha 753014. We work across Odisha and West Bengal.', [
        { label: 'Open in Google Maps', href: MAPS, ext: true },
        { label: 'Call the office', href: 'tel:' + (PHONES[1] || PHONES[0]).tel },
        BACK()
      ]);
    }
    function contact() {
      var list = PHONES.map(function (ph) { return { label: 'Call ' + ph.label.toLowerCase() + ': ' + ph.display, href: 'tel:' + ph.tel }; });
      list.push({ label: 'Chat on WhatsApp', href: waUrl(SITE.whatsappGreeting), ext: true });
      list.push({ label: 'Email us', href: 'mailto:' + EMAIL });
      list.push(BACK());
      say('No problem. You can talk to our team directly. Tap to call, chat or email.', list);
    }

    // ---- open / close ----
    var started = false, leftViaAction = false;
    function open() {
      panel.hidden = false;
      launch.setAttribute('aria-expanded', 'true');
      if (!started) { started = true; say('Hello! I\'m the Tulshi Enterprises assistant. What would you like to know?', menuOptions()); }
      else if (leftViaAction) say('Anything else I can help you with?', menuOptions());
      leftViaAction = false;
      keepFocus = true;
      setTimeout(function () { var f = opts.querySelector('.ast-opt'); if (f) { f.focus({ preventScroll: true }); keepFocus = false; } }, reduceMotion ? 0 : 500);
    }
    function close(byAction) {
      leftViaAction = byAction === true;
      panel.hidden = true;
      launch.setAttribute('aria-expanded', 'false');
      if (synth) synth.cancel();
      talking(false);
    }
    launch.addEventListener('click', function () { if (panel.hidden) open(); else { close(); launch.focus(); } });
    $('astClose').addEventListener('click', function () { close(); launch.focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) { close(); launch.focus(); }
    });
  })();

  /* ---------------------------------------------------------
     AI agents: read-only tools for browsers that support WebMCP
     (navigator.modelContext). Ignored everywhere else. The
     quotation form also carries declarative tool attributes.
     --------------------------------------------------------- */
  (function () {
    var mc = navigator.modelContext;
    if (!mc || typeof mc.registerTool !== 'function') return;
    var text = function (t) { return { content: [{ type: 'text', text: t }] }; };
    var none = { type: 'object', properties: {} };
    try {
      mc.registerTool({
        name: 'get_contact_details',
        description: 'Phone numbers, WhatsApp, email, head office address and service area of M/S. Tulshi Enterprises.',
        inputSchema: none, annotations: { readOnlyHint: true },
        execute: function () {
          return text('M/S. Tulshi Enterprises, electrical and civil contractor. Phones: ' + (SITE.phones || []).map(function (p) { return p.label + ' ' + p.display; }).join(', ') +
            '. WhatsApp: https://wa.me/' + waNumber + '. Email: ' + SITE.email + '. Head office: Sector-10, Markat Nagar, CDA, Cuttack, Odisha 753014, India. Service area: Odisha and West Bengal.');
        }
      });
      mc.registerTool({
        name: 'list_services',
        description: 'Services offered by M/S. Tulshi Enterprises, with what each includes.',
        inputSchema: none, annotations: { readOnlyHint: true },
        execute: function () {
          return text(Object.keys(SERVICES).map(function (id) { var s = SERVICES[id]; return s.title + ': ' + s.text + ' Includes: ' + s.list.join('; ') + '.'; }).join('\n'));
        }
      });
      mc.registerTool({
        name: 'list_projects',
        description: 'Completed projects of M/S. Tulshi Enterprises with location, client and description.',
        inputSchema: none, annotations: { readOnlyHint: true },
        execute: function () {
          return text(PROJECTS.map(function (p) { return p.title + ' (' + p.loc + (p.client ? ', client: ' + p.client : '') + '): ' + p.desc; }).join('\n'));
        }
      });
    } catch (e) { /* API still experimental; never let it affect the page */ }
  })();

  /* ---------------------------------------------------------
     Deep links: index.html#project-naraj opens that project
     --------------------------------------------------------- */
  var deep = location.hash.match(/^#project-(.+)$/);
  if (deep && findProject(deep[1])) {
    hist('replaceState', null, location.pathname + location.search + '#projects');
    openProject(deep[1]);
  }
})();

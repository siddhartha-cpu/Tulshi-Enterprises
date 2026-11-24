/* Tulshi Enterprises: page behaviour shared by every page.
   Mobile menu, header services dropdown, hero slider, photo viewer and back-to-top. No libraries. */
(function () {
  'use strict';
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function icon(name) { return '<svg class="ti" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  /* ---------- Mobile menu ---------- */
  var body = document.body;
  var toggler = document.querySelector('.mobile-nav-toggler');
  var mobile = document.querySelector('.mobile-menu');
  var mainNav = document.querySelector('.main-header .main-menu .navigation');
  if (toggler && mobile && mainNav) {
    var list = mobile.querySelector('.navigation');
    list.innerHTML = mainNav.innerHTML;
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'close-btn'; close.setAttribute('aria-label', 'Close menu');
    close.innerHTML = '<svg aria-hidden="true"><use href="#i-close"/></svg>';
    mobile.appendChild(close);
    // a button to open each sub-menu on phones
    qsa('li.dropdown', list).forEach(function (li, i) {
      var sub = li.querySelector('ul'); if (!sub) return;
      sub.id = sub.id || 'mobileSub' + i;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dropdown-btn'; b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', sub.id); b.setAttribute('aria-label', 'Show ' + li.querySelector('a').textContent + ' list');
      b.innerHTML = icon('chev-down');
      li.appendChild(b);
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open));
        sub.style.display = open ? 'block' : 'none';
      });
    });
    toggler.setAttribute('role', 'button'); toggler.setAttribute('tabindex', '0');
    toggler.setAttribute('aria-label', 'Open menu'); toggler.setAttribute('aria-expanded', 'false');
    var openMenu = function () {
      body.classList.add('mobile-menu-visible'); toggler.setAttribute('aria-expanded', 'true');
      setTimeout(function () { close.focus(); }, 50);
    };
    var closeMenu = function (back) {
      if (!body.classList.contains('mobile-menu-visible')) return;
      body.classList.remove('mobile-menu-visible'); toggler.setAttribute('aria-expanded', 'false');
      if (back) toggler.focus();
    };
    toggler.addEventListener('click', openMenu);
    toggler.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); } });
    close.addEventListener('click', function () { closeMenu(true); });
    var backdrop = mobile.querySelector('.menu-backdrop');
    if (backdrop) backdrop.addEventListener('click', function () { closeMenu(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(false); });
  }

  /* ---------- Header services dropdown: also opens from the keyboard ---------- */
  qsa('.main-header .main-menu .navigation > li.dropdown').forEach(function (li) {
    li.addEventListener('focusin', function () { li.classList.add('is-open'); });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) li.classList.remove('is-open'); });
  });

  /* ---------- Hero slider ---------- */
  var slider = document.getElementById('heroSlider');
  if (slider) {
    var slides = qsa('.tslide', slider), dotsWrap = slider.parentNode.querySelector('.tslider-dots');
    var cur = 0, timer = null, paused = false;
    var dots = slides.map(function (s, i) {
      s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', 'slide'); s.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      var d = document.createElement('button');
      d.type = 'button'; d.className = 'tslider-dot'; d.setAttribute('aria-label', 'Show slide ' + (i + 1));
      d.addEventListener('click', function () { go(i); restart(); });
      if (dotsWrap) dotsWrap.appendChild(d);
      return d;
    });
    var go = function (i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === cur;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        qsa('a, button', s).forEach(function (el) { if (on) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1'); });
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
    };
    var restart = function () {
      clearInterval(timer);
      if (reduceMotion || slides.length < 2) return;
      timer = setInterval(function () { if (!paused && !document.hidden) go(cur + 1); }, 6000);
    };
    qsa('.tslider-btn', slider.parentNode).forEach(function (b) {
      b.addEventListener('click', function () { go(cur + (+b.getAttribute('data-dir'))); restart(); });
    });
    var wrap = slider.parentNode;
    wrap.addEventListener('mouseenter', function () { paused = true; });
    wrap.addEventListener('mouseleave', function () { paused = false; });
    wrap.addEventListener('focusin', function () { paused = true; });
    wrap.addEventListener('focusout', function () { paused = false; });
    var x0 = null;
    slider.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { go(cur + (dx < 0 ? 1 : -1)); restart(); }
    });
    slider.classList.add('is-ready');
    go(0); restart();
  }

  /* ---------- Photo viewer for links with data-lightbox="group" ---------- */
  var viewer = null, group = [], idx = 0, lastFocus = null;
  function buildViewer() {
    viewer = document.createElement('dialog');
    viewer.className = 'tlb'; viewer.id = 'tlb'; viewer.setAttribute('aria-label', 'Photo viewer');
    viewer.innerHTML =
      '<div class="tlb-stage"><img id="tlbImg" alt=""><span class="tlb-spin" aria-hidden="true"></span></div>' +
      '<div class="tlb-bar"><p class="tlb-cap" id="tlbCap"></p><span class="tlb-count" id="tlbCount"></span></div>' +
      '<button type="button" class="tlb-btn tlb-prev" aria-label="Previous photo">' + icon('chev-left') + '</button>' +
      '<button type="button" class="tlb-btn tlb-next" aria-label="Next photo">' + icon('chev-right') + '</button>' +
      '<button type="button" class="tlb-btn tlb-close" aria-label="Close">' + '<svg class="ti" aria-hidden="true"><use href="#i-close"/></svg>' + '</button>';
    document.body.appendChild(viewer);
    viewer.querySelector('.tlb-prev').addEventListener('click', function () { show(idx - 1); });
    viewer.querySelector('.tlb-next').addEventListener('click', function () { show(idx + 1); });
    viewer.querySelector('.tlb-close').addEventListener('click', closeViewer);
    viewer.addEventListener('click', function (e) { if (e.target === viewer || e.target.classList.contains('tlb-stage')) closeViewer(); });
    viewer.addEventListener('close', function () { body.classList.remove('tlb-open'); if (lastFocus) lastFocus.focus(); });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    });
    var sx = null;
    viewer.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
    viewer.querySelector('#tlbImg').addEventListener('load', function () { viewer.classList.remove('is-loading'); });
  }
  function show(i) {
    idx = (i + group.length) % group.length;
    var a = group[idx], img = viewer.querySelector('#tlbImg');
    viewer.classList.add('is-loading');
    img.src = a.getAttribute('href');
    img.alt = (a.querySelector('img') && a.querySelector('img').alt) || a.getAttribute('data-title') || '';
    viewer.querySelector('#tlbCap').textContent = a.getAttribute('data-title') || '';
    viewer.querySelector('#tlbCount').textContent = group.length > 1 ? 'Photo ' + (idx + 1) + ' of ' + group.length : '';
    viewer.classList.toggle('is-single', group.length < 2);
    // load the next photo ahead
    if (group.length > 1) { var n = new Image(); n.src = group[(idx + 1) % group.length].getAttribute('href'); }
  }
  function closeViewer() { if (viewer && viewer.open) viewer.close(); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-lightbox]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (!viewer) buildViewer();
    var name = a.getAttribute('data-lightbox');
    group = qsa('a[data-lightbox]').filter(function (x) { return x.getAttribute('data-lightbox') === name; });
    lastFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : a;
    show(group.indexOf(a));
    body.classList.add('tlb-open');
    if (typeof viewer.showModal === 'function') viewer.showModal(); else viewer.setAttribute('open', '');
    viewer.querySelector('.tlb-close').focus();
  });

  /* ---------- Back to top ---------- */
  var up = document.querySelector('.scroll-to-top');
  if (up) {
    var tick = false;
    var onScroll = function () { tick = false; up.classList.toggle('is-on', window.pageYOffset > 400); };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    var goUp = function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); };
    up.addEventListener('click', goUp);
    up.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goUp(); } });
  }
})();

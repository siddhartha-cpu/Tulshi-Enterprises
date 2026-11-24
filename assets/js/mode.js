/* Applies the saved day / night mode before the page paints (prevents a flash of the wrong theme). */
(function () {
  var m = 'night';
  try { m = localStorage.getItem('tulshi-mode') || 'night'; } catch (e) {}
  document.documentElement.setAttribute('data-mode', m === 'day' ? 'day' : 'night');
})();

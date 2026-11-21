// Abhilekh page motion: reveals on scroll and words lit by scroll position. No tracking, no network.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var film = document.querySelector('.hero-film');
  if (reduce && film) { film.removeAttribute('autoplay'); film.pause(); }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.io').forEach(function (el) { io.observe(el); });

  // pause the film when it is off screen (saves battery on phones)
  if (film && !reduce) {
    new IntersectionObserver(function (e) { e[0].isIntersecting ? film.play().catch(function () {}) : film.pause(); }, { threshold: 0.05 }).observe(film);
  }

  // ridges drift at different speeds as you scroll (the hero) and as the footer comes up
  if (!reduce) {
    var rs = Array.prototype.slice.call(document.querySelectorAll('.ridges')), rt = false;
    function ridge() { rt = false; rs.forEach(function (el) { var r = el.parentElement.getBoundingClientRect(); el.style.setProperty('--py', (-r.top) + 'px'); }); }
    window.addEventListener('scroll', function () { if (!rt) { rt = true; requestAnimationFrame(ridge); } }, { passive: true });
    ridge();
  }

  var lit = document.querySelector('[data-lit]');
  if (!lit) return;
  var words = Array.prototype.slice.call(lit.querySelectorAll('span'));
  if (reduce) { words.forEach(function (w) { w.classList.add('on'); }); return; }
  var section = lit.parentElement, ticking = false;
  function update() {
    ticking = false;
    var r = section.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height - vh * 0.6)));
    var n = Math.round(p * words.length);
    words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

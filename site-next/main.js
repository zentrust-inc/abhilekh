// Abhilekh site · language, reveals and the three demonstrations. No network, no cookies, no tracking.
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function seg(p, a, b) { return ease((p - a) / (b - a)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- language ---------- */
  var langBtns = document.querySelectorAll('[data-set-lang]');
  function setLang(l, save) {
    doc.setAttribute('data-lang', l);
    doc.setAttribute('lang', l === 'ne' ? 'ne' : 'en');
    langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l)); });
    if (save) { try { localStorage.setItem('abhilekh-lang', l); } catch (e) {} }
  }
  var start = 'ne';
  try { start = localStorage.getItem('abhilekh-lang') || start; } catch (e) {}
  if (location.hash === '#ne') start = 'ne';
  if (location.hash === '#en') start = 'en';
  setLang(start === 'en' ? 'en' : 'ne', false);
  langBtns.forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang'), true); }); });

  /* ---------- nav ---------- */
  var nav = document.querySelector('.nav');
  var menu = document.querySelector('.menu');
  var darks = Array.prototype.slice.call(document.querySelectorAll('.transform, .dark, .limits, .foot'));
  function navState() {
    nav.classList.toggle('scrolled', window.scrollY > 16);
    var y = 36, over = false;
    darks.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= y && r.bottom >= y) over = true; });
    nav.classList.toggle('over-dark', over);
  }
  menu.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); });
  });

  /* ---------- reveals ---------- */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.io').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.io').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- A · plastic bag transformation ---------- */
  var tf = document.querySelector('.transform');
  var stage = tf && tf.querySelector('.tf-stage');
  var papers = tf ? Array.prototype.slice.call(tf.querySelectorAll('.tp')) : [];
  var caps = tf ? tf.querySelectorAll('.cap') : [];
  var bagEl = tf && tf.querySelector('.tf-bag');
  var slots = tf ? tf.querySelectorAll('.slots span') : [];
  var scatterD = [[.24, .02, -11], [.38, .30, 6], [.52, .00, 13], [.30, .52, -6], [.47, .46, 9]];
  var scatterM = [[.02, .00, -9], [.36, .02, 7], [.62, .10, 11], [.10, .30, -4], [.46, .32, 8]];
  var archLabel = tf && tf.querySelector('.tf-arch');

  function transform() {
    if (!tf) return;
    var r = tf.getBoundingClientRect(), vh = window.innerHeight;
    var p = reduce ? 1 : clamp(-r.top / (r.height - vh), 0, 1);
    tf.style.setProperty('--p', p.toFixed(4));
    var ci = p < .2 ? 0 : p < .42 ? 1 : p < .72 ? 2 : 3;
    caps.forEach(function (c, i) { c.classList.toggle('on', reduce || i === ci); });
    tf.classList.toggle('p-out', p > .24);
    tf.classList.toggle('p-phone', p > .36);
    tf.classList.toggle('p-arch', p > .66);

    // read layout first
    var sr = stage.getBoundingClientRect();
    var br = bagEl.getBoundingClientRect();
    var sl = Array.prototype.map.call(slots, function (s) { return s.getBoundingClientRect(); });
    var mobile = sr.width < 700;
    var base = mobile ? 112 : 150;
    var sc = mobile ? scatterM : scatterD;
    var aScale = mobile ? .48 : .66;
    var t1 = seg(p, .08, .30);   // out of the bag
    var t2 = seg(p, .46, .68);   // originals line up; a card goes to the phone
    var t3 = seg(p, .50, .64);   // the card appears

    // then write
    papers.forEach(function (el, i) {
      var bx = br.left - sr.left + br.width * (.18 + i * .12) - base * .35;
      var by = br.top - sr.top + br.height * (.30 + (i % 2) * .08);
      var bs = .62, brot = (i - 2) * 7;
      var sx = sc[i][0] * sr.width, sy = sc[i][1] * sr.height, srot = sc[i][2];
      var ax = mobile ? i * (base * aScale + 8) : sr.width * .22 + i * (base * aScale + 16);
      var ay = mobile ? 0 : sr.height * .26;
      var x = lerp(lerp(bx, sx, t1), ax, t2);
      var y = lerp(lerp(by, sy, t1), ay, t2);
      var rot = lerp(lerp(brot, srot, t1), 0, t2);
      var scl = lerp(lerp(bs, 1, t1), aScale, t2);
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(' + scl.toFixed(3) + ')';
      el.style.zIndex = t1 > .02 ? 6 : 4;
      // the card travels from its original to its slot in the phone
      var s = sl[i], card = el.lastElementChild;
      var dx = (s.left - sr.left - x) / scl, dy = (s.top - sr.top - y) / scl;
      card.style.opacity = String(t3);
      card.style.width = s.width.toFixed(1) + 'px';
      card.style.transform = 'translate(' + (dx * t2).toFixed(1) + 'px,' + (dy * t2).toFixed(1) + 'px) scale(' + (1 / scl).toFixed(3) + ')';
    });
    if (archLabel) {
      var lx = mobile ? 0 : sr.width * .22, ly = (mobile ? 0 : sr.height * .26) + base * 4 / 3 * aScale + 14;
      archLabel.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px)';
    }
  }

  /* on narrow screens each story scene is wider than the screen: start it centred, swipe for the rest */
  function centreScenes() {
    document.querySelectorAll('.ch-fig, .phero-fig').forEach(function (f) { if (f.scrollWidth > f.clientWidth) f.scrollLeft = (f.scrollWidth - f.clientWidth) * .55; });
  }
  centreScenes();

  /* ---------- scroll loop ---------- */
  var ticking = false;
  function frame() { ticking = false; navState(); transform(); }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  window.addEventListener('resize', frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(frame);
  frame();


  /* ---------- the film: nothing loads from YouTube until play is tapped ---------- */
  var FILM_ID = 'mw13BK-zZ8M';
  document.querySelectorAll('.yt-film').forEach(function (box) {
    var img = box.querySelector('img');
    if (img) {
      img.addEventListener('error', function () { img.remove(); });
      if (img.complete && !img.naturalWidth) img.remove();
    }
    var btn = box.querySelector('.yt-play');
    btn.addEventListener('click', function () {
      var ne = doc.getAttribute('data-lang') !== 'en';
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + FILM_ID + '?autoplay=1&rel=0&playsinline=1&cc_load_policy=1&cc_lang_pref=' + (ne ? 'ne' : 'en') + '&hl=' + (ne ? 'ne' : 'en');
      f.title = ne ? 'अभिलेख · आमाको कथा' : 'Abhilekh · Aama’s story';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.querySelector('.yt-frame').replaceChildren(f);
      box.classList.add('playing');
      f.focus();
    });
  });

  /* ---------- B · original vs extracted ---------- */
  var items = document.querySelectorAll('.ex-item');
  var hits = document.querySelectorAll('.hit');
  var details = document.querySelectorAll('.exd');
  function pick(k) {
    items.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === k)); });
    hits.forEach(function (h) {
      var on = h.getAttribute('data-k') === k;
      h.classList.toggle('on', on);
      h.classList.toggle('smudged-pick', on && h.classList.contains('smudge'));
    });
    details.forEach(function (d) { d.hidden = d.getAttribute('data-k') !== k; });
  }
  items.forEach(function (b) { b.addEventListener('click', function () { pick(b.getAttribute('data-k')); }); });
  hits.forEach(function (h) { h.addEventListener('click', function () { pick(h.getAttribute('data-k')); }); });
  // start with the first value selected once it scrolls into view
  var ocr = document.querySelector('.ocr');
  if (ocr && 'IntersectionObserver' in window) {
    var once = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!document.querySelector('.ex-item[aria-pressed=true]')) pick('tsh'); once.disconnect(); }
    }, { threshold: .4 });
    once.observe(ocr);
  }

  /* ---------- C · patient to doctor ---------- */
  var live = document.querySelector('.s-share.live');
  if (live) {
    var durBtns = live.querySelectorAll('[data-dur]');
    var lefts = document.querySelectorAll('.js-left');
    var stopBtn = live.querySelector('.js-stop');
    var againBtn = live.querySelector('.js-restart');
    var ok = document.querySelector('.br-ok'), ended = document.querySelector('.br-ended');
    var endsAt = 0, timer = null;
    function fmt(ms) {
      var s = Math.max(0, Math.round(ms / 1000));
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      if (d) return d + ' d ' + h + ' h';
      return (h ? h + ' h ' : '') + (m < 10 && h ? '0' : '') + m + ' m ' + (x < 10 ? '0' : '') + x + ' s';
    }
    function tick() {
      var left = endsAt - Date.now();
      lefts.forEach(function (l) { l.textContent = fmt(left); });
      if (left <= 0) endShare(false);
    }
    function startShare(sec) {
      endsAt = Date.now() + sec * 1000;
      live.classList.remove('ended'); ok.hidden = false; ended.hidden = true;
      live.querySelector('.live-left').hidden = false; live.querySelector('.live-ended').hidden = true;
      stopBtn.hidden = false; againBtn.hidden = true;
      durBtns.forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-dur') === sec); b.disabled = false; });
      tick(); clearInterval(timer); timer = setInterval(tick, 1000);
    }
    durBtns.forEach(function (b) { b.addEventListener('click', function () { startShare(+b.getAttribute('data-dur')); }); });
    function endShare(focus) {
      clearInterval(timer); live.classList.add('ended'); ok.hidden = true; ended.hidden = false;
      stopBtn.hidden = true; againBtn.hidden = false;
      live.querySelector('.live-left').hidden = true; live.querySelector('.live-ended').hidden = false;
      durBtns.forEach(function (b) { b.disabled = true; });
      if (focus) againBtn.focus();
    }
    stopBtn.addEventListener('click', function () { endShare(true); });
    againBtn.addEventListener('click', function () { startShare(900); });
    startShare(900);

    var origs = document.querySelectorAll('.br-orig');
    var cropBox = document.querySelector('.br-crop'), cropTxt = document.querySelector('.js-crop');
    origs.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var was = b.getAttribute('aria-pressed') === 'true';
        origs.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        if (was) { cropBox.hidden = true; return; }
        b.setAttribute('aria-pressed', 'true');
        cropTxt.textContent = b.getAttribute('data-crop');
        cropBox.hidden = false;
      });
    });
  }
})();

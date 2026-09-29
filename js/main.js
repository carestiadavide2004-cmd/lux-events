/* =========================================================
   LUX — interazioni e animazioni
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutQuart = t => (t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
  const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const body = document.body;
  const track = $('#fpTrack');
  const sections = $$('.section');
  const header = $('#header');

  let vh = window.innerHeight;
  let tops = [];
  let lightboxOpen = false;
  let menuOpen = false;

  body.classList.add('is-loading');
  $('#year').textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Altezza viewport reale (barre mobile)
     --------------------------------------------------------- */
  function setVH() {
    vh = window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
  }
  setVH();

  /* ---------------------------------------------------------
     Split dei titoli in parole
     --------------------------------------------------------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const frag = document.createDocumentFragment();
    const addWords = (text, wrapTag) => {
      text.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.style.setProperty('--i', i++);
        if (wrapTag) {
          const t = document.createElement(wrapTag);
          t.textContent = part;
          inner.appendChild(t);
        } else {
          inner.textContent = part;
        }
        w.appendChild(inner);
        frag.appendChild(w);
      });
    };
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) addWords(n.textContent);
      else if (n.nodeType === 1) addWords(n.textContent, n.tagName.toLowerCase());
    });
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = '';
    el.appendChild(frag);
  });

  /* ---------------------------------------------------------
     Reveal: elementi per sezione
     --------------------------------------------------------- */
  const revealSel = '[data-reveal], [data-split]';
  const sectionReveals = sections.map(sec => $$(revealSel, sec));

  function staggerDelays(list) {
    list.forEach((el, idx) => {
      const d = el.dataset.delay !== undefined ? +el.dataset.delay * 150 : idx * 110;
      el.style.setProperty('--d', 120 + d);
    });
  }

  function revealSection(i) {
    staggerDelays(sectionReveals[i]);
    sectionReveals[i].forEach(el => el.classList.add('is-in'));
  }
  function hideSection(i) {
    sectionReveals[i].forEach(el => el.classList.remove('is-in'));
  }

  /* ---------------------------------------------------------
     Eventi di ingresso/uscita sezione
     --------------------------------------------------------- */
  const entered = new Set();
  let heroSettleTimer;

  function onEnter(i) {
    const sec = sections[i];
    sec.classList.add('is-inview');
    if (sec.id === 'home') {
      clearTimeout(heroSettleTimer);
      heroSettleTimer = setTimeout(() => sec.classList.add('is-settled'), 2000);
    }
    if (sec.id === 'numeri') runCounters();
    entered.add(i);
  }
  function onLeave(i) {
    const sec = sections[i];
    sec.classList.remove('is-inview');
    if (sec.id === 'home') { clearTimeout(heroSettleTimer); sec.classList.remove('is-settled'); }
    if (sec.id === 'numeri') resetCounters();
    entered.delete(i);
  }

  /* ---------------------------------------------------------
     Navigazione laterale
     --------------------------------------------------------- */
  const sideDots = $('#sideDots');
  sections.forEach((sec, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-label="Vai a ${sec.dataset.name}"></button><span class="side-nav__label">${sec.dataset.name}</span>`;
    li.querySelector('button').addEventListener('click', () => goTo(i));
    sideDots.appendChild(li);
  });
  $('#sideTotal').textContent = String(sections.length).padStart(2, '0');
  const dots = $$('li', sideDots);
  const navLinks = $$('.header__nav a');

  let activeIndex = -1;
  function setActive(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
    navLinks.forEach(a => a.classList.toggle('is-active', +a.dataset.goto === i));
    $('#sideCurrent').textContent = String(i + 1).padStart(2, '0');
    if (!body.classList.contains('is-loading')) {
      history.replaceState(null, '', i === 0 ? location.pathname + location.search : `#${sections[i].id}`);
    }
  }

  /* =========================================================
     FULL-PAGE SCROLL (desktop) / scroll nativo (mobile)
     ========================================================= */
  const FP = {
    on: false,
    index: 0,
    y: 0,
    animating: false,
    lockUntil: 0,
    wheelAcc: 0,
    lastInnerScroll: 0,
    raf: null
  };
  const DURATION = 1300;

  function wantsFullPage() {
    return !reducedMotion && window.innerWidth >= 1024 && window.innerHeight >= 600 &&
      matchMedia('(pointer: fine)').matches;
  }

  function measure() {
    tops = sections.map(s => (FP.on ? 0 : s.getBoundingClientRect().top + window.scrollY));
  }
  const sectionTop = i => (FP.on ? i * vh : tops[i]);

  function enableFP(startIndex) {
    FP.on = true;
    body.classList.add('fp-on');
    window.scrollTo(0, 0);
    FP.index = startIndex;
    FP.y = startIndex * vh;
    track.style.transform = `translate3d(0, ${-FP.y}px, 0)`;
    setActive(startIndex);
  }

  function disableFP() {
    const idx = FP.index;
    FP.on = false;
    cancelAnimationFrame(FP.raf);
    FP.animating = false;
    body.classList.remove('fp-on');
    track.style.transform = '';
    sections.forEach(s => { const c = s.querySelector(':scope > .container'); if (c) { c.style.transform = ''; c.style.opacity = ''; } });
    measure();
    window.scrollTo(0, tops[idx] || 0);
    // in modalità nativa tutto ciò che è già stato visto resta visibile
    sections.forEach((_, i) => { if (i <= idx) revealSection(i); });
  }

  function goTo(i, instant = false) {
    i = clamp(i, 0, sections.length - 1);
    if (menuOpen) toggleMenu(false);

    if (!FP.on) {
      const top = tops[i] !== undefined ? tops[i] : 0;
      window.scrollTo({ top, behavior: instant || reducedMotion ? 'auto' : 'smooth' });
      return;
    }
    if (i === FP.index && !instant) return;

    const from = FP.y;
    const to = i * vh;
    const prev = FP.index;
    const dir = i > prev ? 1 : -1;
    FP.index = i;
    setActive(i);

    // posizione interna della sezione di arrivo
    const target = sections[i];
    target.scrollTop = dir > 0 ? 0 : target.scrollHeight;

    onEnter(i);
    revealSection(i);

    cancelAnimationFrame(FP.raf);
    if (instant) {
      FP.y = to;
      finish();
      return;
    }

    FP.animating = true;
    body.classList.add('fp-moving');
    const dur = Math.abs(i - prev) > 1 ? DURATION + 200 : DURATION;
    const start = performance.now();

    const step = now => {
      const t = clamp((now - start) / dur, 0, 1);
      FP.y = from + (to - from) * easeInOutQuart(t);
      if (t < 1) FP.raf = requestAnimationFrame(step);
      else finish();
    };
    FP.raf = requestAnimationFrame(step);

    function finish() {
      FP.animating = false;
      FP.y = to;
      FP.lockUntil = performance.now() + 450;
      body.classList.remove('fp-moving');
      // le altre sezioni si "resettano" per rigiocare le animazioni al rientro
      sections.forEach((_, k) => {
        if (k !== FP.index) { hideSection(k); if (entered.has(k)) onLeave(k); }
      });
    }
  }

  /* ----- Rotella ----- */
  function canScrollInside(sec, dir) {
    if (sec.scrollHeight - sec.clientHeight < 4) return false;
    if (dir > 0) return sec.scrollTop + sec.clientHeight < sec.scrollHeight - 2;
    return sec.scrollTop > 2;
  }

  window.addEventListener('wheel', e => {
    if (!FP.on || body.classList.contains('is-loading')) return;
    if (lightboxOpen || menuOpen) { e.preventDefault(); return; }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const dir = Math.sign(e.deltaY);
    const sec = sections[FP.index];
    const now = performance.now();

    if (!FP.animating && canScrollInside(sec, dir)) {
      FP.lastInnerScroll = now;
      return; // scroll interno nativo
    }
    e.preventDefault();

    // blocca l'inerzia del trackpad
    if (FP.animating || now < FP.lockUntil || now - FP.lastInnerScroll < 280) {
      FP.lockUntil = Math.max(FP.lockUntil, now + 160);
      FP.wheelAcc = 0;
      return;
    }
    FP.wheelAcc += e.deltaY;
    if (Math.abs(FP.wheelAcc) > 35) {
      const d = Math.sign(FP.wheelAcc);
      FP.wheelAcc = 0;
      goTo(FP.index + d);
    }
  }, { passive: false });

  sections.forEach(s => s.addEventListener('scroll', () => { FP.lastInnerScroll = performance.now(); }, { passive: true }));

  /* ----- Tastiera ----- */
  window.addEventListener('keydown', e => {
    if (lightboxOpen) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') stepLightbox(1);
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      return;
    }
    if (menuOpen && e.key === 'Escape') { toggleMenu(false); return; }
    if (!FP.on) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === ' ' && /BUTTON|A/.test(tag)) return;

    const sec = sections[FP.index];
    const next = ['ArrowDown', 'PageDown', ' '].includes(e.key);
    const prev = ['ArrowUp', 'PageUp'].includes(e.key);
    if (next || prev) {
      e.preventDefault();
      if (FP.animating) return;
      const dir = next ? 1 : -1;
      if (canScrollInside(sec, dir)) sec.scrollBy({ top: dir * sec.clientHeight * 0.7, behavior: 'smooth' });
      else goTo(FP.index + dir);
    } else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(sections.length - 1); }
  });

  /* ----- Touch (schermi touch con modalità full-page) ----- */
  let touchY = null;
  window.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    if (!FP.on || touchY === null || lightboxOpen || menuOpen) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) < 60 || FP.animating) return;
    const dir = Math.sign(dy);
    if (!canScrollInside(sections[FP.index], dir)) goTo(FP.index + dir);
  }, { passive: true });

  /* ----- Focus da tastiera su un'altra sezione ----- */
  document.addEventListener('focusin', e => {
    if (!FP.on || lightboxOpen || menuOpen) return;
    $('#fp').scrollTop = 0;
    const sec = e.target.closest && e.target.closest('.section');
    const i = sections.indexOf(sec);
    if (i > -1 && i !== FP.index) goTo(i);
  });

  /* ----- Link interni ----- */
  $$('[data-goto]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    goTo(+a.dataset.goto);
  }));

  /* ----- Modalità nativa: reveal con IntersectionObserver ----- */
  const revealIO = new IntersectionObserver(entries => {
    if (FP.on) return;
    let n = 0;
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const base = el.dataset.delay !== undefined ? +el.dataset.delay * 120 : 0;
      el.style.setProperty('--d', base + n++ * 90);
      el.classList.add('is-in');
      revealIO.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  const sectionIO = new IntersectionObserver(entries => {
    if (FP.on) return;
    entries.forEach(en => {
      const i = sections.indexOf(en.target);
      if (en.isIntersecting && !entered.has(i)) onEnter(i);
    });
  }, { threshold: 0.3 });

  // gli elementi con clip-path iniziale hanno area zero: l'IntersectionObserver
  // non li rileva, quindi vengono controllati a mano nel loop di render
  let pendingClips = [];
  function checkClips() {
    if (!pendingClips.length) return;
    let n = 0;
    pendingClips = pendingClips.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) {
        el.style.setProperty('--d', n++ * 120);
        el.classList.add('is-in');
        return false;
      }
      return true;
    });
  }

  function startNativeObservers() {
    $$(revealSel).forEach(el => {
      if (el.classList.contains('is-in')) return;
      if (el.dataset.reveal === 'clip') pendingClips.push(el);
      else revealIO.observe(el);
    });
    sections.forEach(s => sectionIO.observe(s));
  }

  /* =========================================================
     LOOP DI RENDER: parallasse e progress
     ========================================================= */
  const heroEl = $('#home');
  const heroBg = $('[data-parallax-hero="bg"]');
  const heroLights = $('[data-parallax-hero="lights"]');
  const heroContent = $('[data-parallax-hero="content"]');
  const heroLetters = $$('.hero__letter');
  const bgLayers = sections.map(s => $(':scope > [data-bg-parallax] img', s));
  const innerParallax = sections.map(s => $$('[data-parallax]', s));
  const containers = sections.map(s => $(':scope > .container', s));
  const progress = $('#scrollProgress');

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function currentY() { return FP.on ? FP.y : window.scrollY; }

  function render() {
    mouse.x = lerp(mouse.x, mouse.tx, 0.06);
    mouse.y = lerp(mouse.y, mouse.ty, 0.06);
    const y = currentY();

    if (FP.on) track.style.transform = `translate3d(0, ${-y}px, 0)`;

    if (!reducedMotion) {
      // HERO
      const hp = clamp(y / vh, 0, 1.3);
      if (hp < 1.25) {
        heroBg.style.transform = `translate3d(${mouse.x * -18}px, ${y * 0.45 + mouse.y * -14}px, 0) scale(1.06)`;
        heroLights.style.transform = `translate3d(${mouse.x * 40}px, ${y * 0.2 + mouse.y * 30}px, 0)`;
        heroContent.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
        heroContent.style.opacity = String(clamp(1 - hp * 1.25, 0, 1));
        if (heroEl.classList.contains('is-settled')) {
          heroLetters.forEach(l => {
            const d = +l.dataset.depth;
            l.style.setProperty('--px', `${mouse.x * 26 * d}px`);
            l.style.setProperty('--py', `${mouse.y * 16 * d}px`);
          });
        }
      }

      // SEZIONI
      sections.forEach((sec, i) => {
        const rel = (sectionTop(i) - y) / vh; // 0 = allineata, 1 = sotto
        if (Math.abs(rel) > 1.3) return;
        const bg = bgLayers[i];
        if (bg) bg.style.transform = `translate3d(0, ${-rel * vh * 0.16}px, 0)`;
        innerParallax[i].forEach(el => {
          el.style.setProperty('--py', `${(-rel * vh * (+el.dataset.parallax)).toFixed(1)}px`);
        });
        if (FP.on && containers[i] && i !== 0) {
          const a = Math.min(Math.abs(rel), 1);
          if (a < 0.001) { containers[i].style.transform = ''; containers[i].style.opacity = ''; }
          else {
            containers[i].style.transform = `translate3d(0, ${rel * vh * 0.1}px, 0) scale(${1 - a * 0.04})`;
            containers[i].style.opacity = String(1 - a * 0.55);
          }
        }
      });
    }

    // header + progress
    header.classList.toggle('is-compact', y > 40);
    const max = FP.on ? (sections.length - 1) * vh : document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleY(${max > 0 ? clamp(y / max, 0, 1) : 0})`;

    if (!FP.on) {
      checkClips();
      let idx = 0;
      tops.forEach((t, k) => { if (y + vh * 0.45 >= t) idx = k; });
      setActive(idx);
    }

    requestAnimationFrame(render);
  }

  /* ---------------------------------------------------------
     Setup modalità + resize
     --------------------------------------------------------- */
  function initialIndex() {
    const id = location.hash.slice(1);
    const i = sections.findIndex(s => s.id === id);
    return i > -1 ? i : 0;
  }

  function applyMode(start) {
    const want = wantsFullPage();
    if (want && !FP.on) {
      enableFP(start);
    } else if (!want && FP.on) {
      disableFP();
      startNativeObservers();
    } else if (!want) {
      measure();
    }
  }

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      setVH();
      applyMode(FP.on ? FP.index : Math.max(activeIndex, 0));
      if (FP.on) { FP.y = FP.index * vh; } else { measure(); }
    }, 150);
  });
  window.addEventListener('load', () => { if (!FP.on) measure(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!FP.on) measure(); }).observe(track);

  /* =========================================================
     PRELOADER
     ========================================================= */
  const preloader = $('#preloader');
  const bar = $('#preloaderBar');
  const heroVideo = $('.hero__video');
  let loadProgress = 0;
  let ready = false;

  const markReady = () => { ready = true; };
  Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(r => {
        if (heroVideo.readyState >= 3) r();
        heroVideo.addEventListener('canplay', r, { once: true });
        heroVideo.addEventListener('error', r, { once: true });
      })
    ]),
    new Promise(r => setTimeout(r, 3200))
  ]).then(markReady);

  const minTime = reducedMotion ? 200 : 1700;
  const t0 = performance.now();
  (function tick() {
    const elapsed = performance.now() - t0;
    const target = ready ? 1 : Math.min(0.9, elapsed / 2600);
    loadProgress = lerp(loadProgress, target, 0.12);
    bar.style.transform = `scaleX(${loadProgress})`;
    if (ready && elapsed > minTime && loadProgress > 0.98) return reveal();
    requestAnimationFrame(tick);
  })();

  function reveal() {
    const start = initialIndex();
    setVH();
    applyMode(start);
    if (!FP.on) {
      measure();
      if (start > 0) window.scrollTo(0, tops[start]);
    }
    preloader.classList.add('is-done');
    setTimeout(() => {
      body.classList.remove('is-loading');
      if (FP.on) { onEnter(start); revealSection(start); }
      else startNativeObservers();
      setActive(start);
    }, 450);
    setTimeout(() => { preloader.style.display = 'none'; }, 1600);
    requestAnimationFrame(render);
  }

  /* =========================================================
     MENU MOBILE
     ========================================================= */
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  function toggleMenu(force) {
    menuOpen = typeof force === 'boolean' ? force : !menuOpen;
    burger.setAttribute('aria-expanded', menuOpen);
    burger.setAttribute('aria-label', menuOpen ? 'Chiudi menu' : 'Apri menu');
    menu.classList.toggle('is-open', menuOpen);
    menu.setAttribute('aria-hidden', !menuOpen);
    if (!FP.on) body.style.overflow = menuOpen ? 'hidden' : '';
  }
  burger.addEventListener('click', () => toggleMenu());

  /* =========================================================
     CONTATORI
     ========================================================= */
  const counters = $$('[data-count]');
  const nf = new Intl.NumberFormat('it-IT', { useGrouping: 'always' }); // 3.200 e non 3200
  let counterRaf = [];

  function runCounters() {
    counters.forEach((el, k) => {
      const end = +el.dataset.count;
      const dur = 2400 + k * 250;
      const delay = 350 + k * 150;
      const start = performance.now() + delay;
      cancelAnimationFrame(counterRaf[k]);
      const step = now => {
        const t = clamp((now - start) / dur, 0, 1);
        el.textContent = nf.format(Math.round(end * easeOutExpo(t)));
        if (t < 1) counterRaf[k] = requestAnimationFrame(step);
      };
      counterRaf[k] = requestAnimationFrame(step);
    });
  }
  function resetCounters() {
    counters.forEach((el, k) => { cancelAnimationFrame(counterRaf[k]); el.textContent = '0'; });
  }
  if (reducedMotion) counters.forEach(el => { el.textContent = nf.format(+el.dataset.count); });

  /* =========================================================
     COUNTDOWN
     ========================================================= */
  const cd = $('#countdown');
  const CIRC = 2 * Math.PI * 54;
  const cdNums = {};
  const cdRings = {};
  ['days', 'hours', 'minutes', 'seconds'].forEach(u => {
    cdNums[u] = $(`[data-unit="${u}"]`, cd);
    cdRings[u] = $(`[data-ring="${u}"]`, cd);
    cdRings[u].style.strokeDasharray = CIRC;
    cdNums[u].innerHTML = '';
  });

  function setDigits(el, str) {
    let digits = $$('.digit', el);
    if (digits.length !== str.length) {
      el.innerHTML = '';
      digits = str.split('').map(ch => {
        const d = document.createElement('span');
        d.className = 'digit';
        d.innerHTML = `<span>${ch}</span>`;
        d.dataset.v = ch;
        el.appendChild(d);
        return d;
      });
      return;
    }
    digits.forEach((d, k) => {
      const ch = str[k];
      if (d.dataset.v === ch) return;
      d.dataset.v = ch;
      const old = d.lastElementChild;
      const nu = document.createElement('span');
      nu.className = 'in';
      nu.textContent = ch;
      d.appendChild(nu);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        nu.classList.remove('in');
        if (old) old.classList.add('out');
      }));
      setTimeout(() => { if (old && old.parentNode) old.remove(); }, 800);
    });
  }

  const targetDate = new Date(cd.dataset.target);
  function updateCountdown() {
    let diff = Math.max(0, targetDate - new Date());
    const s = Math.floor(diff / 1000);
    const vals = {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60
    };
    const max = { days: 60, hours: 24, minutes: 60, seconds: 60 };
    Object.keys(vals).forEach(u => {
      setDigits(cdNums[u], String(vals[u]).padStart(2, '0'));
      const frac = clamp(vals[u] / max[u], 0, 1);
      cdRings[u].style.strokeDashoffset = CIRC * (1 - frac);
    });
    if (diff === 0) {
      $('.next-event__kicker').textContent = 'La serata è in corso';
      return false;
    }
    return true;
  }
  if (updateCountdown()) {
    const iv = setInterval(() => { if (!updateCountdown()) clearInterval(iv); }, 1000);
  }

  /* =========================================================
     CURSORE, MAGNETICO, GLOW
     ========================================================= */
  if (finePointer && !reducedMotion) {
    body.classList.add('has-cursor');
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    const pos = { x: -100, y: -100, rx: -100, ry: -100 };

    window.addEventListener('mousemove', e => { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));

    (function loop() {
      pos.rx = lerp(pos.rx, pos.x, 0.18);
      pos.ry = lerp(pos.ry, pos.y, 0.18);
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.style.transform = `translate3d(${pos.rx}px, ${pos.ry}px, 0)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener('mouseover', e => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button, [data-magnetic], .loc, .pin, label, select, input, textarea');
      cursor.classList.toggle('is-label', !!lab);
      label.textContent = lab ? lab.dataset.cursor : '';
      cursor.classList.toggle('is-hover', !lab && !!hov);
    });

    // effetto magnetico
    $$('[data-magnetic]').forEach(el => {
      const strength = el.classList.contains('btn') ? 0.28 : 0.4;
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  // bagliore dorato che segue il mouse
  $$('[data-glow]').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* =========================================================
     GALLERIA + LIGHTBOX
     ========================================================= */
  const items = $$('.g-item');
  items.forEach((it, i) => {
    it.dataset.cursor = it.dataset.type === 'video' ? 'Play' : 'Vedi';
    it.setAttribute('tabindex', '0');
    it.setAttribute('role', 'button');
    it.setAttribute('aria-label', `Apri: ${it.dataset.caption}`);
    const v = $('video', it);
    if (v && finePointer) {
      it.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
      it.addEventListener('mouseleave', () => { v.pause(); });
    }
    it.addEventListener('click', () => openLightbox(i));
    it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); } });
  });

  // su touch i video partono quando sono visibili
  if (!finePointer) {
    const vio = new IntersectionObserver(entries => entries.forEach(en => {
      const v = en.target;
      if (en.isIntersecting) v.play().catch(() => {}); else v.pause();
    }), { threshold: 0.5 });
    $$('.g-item video').forEach(v => vio.observe(v));
  }

  const lb = $('#lightbox');
  const lbStage = $('#lbStage');
  const lbCaption = $('#lbCaption');
  let lbIndex = 0;
  let lastFocus = null;

  // Il video va avviato con play() dentro il gesto dell'utente (click/tasto):
  // l'attributo autoplay su un video con audio viene bloccato da Safari/Firefox
  // e il player resterebbe fermo sul primo fotogramma.
  function playVideo(v) {
    const p = v.play();
    if (p && p.catch) {
      p.catch(err => {
        if (err.name !== 'NotAllowedError') return;
        v.muted = true; // fallback: parte senza audio, riattivabile dai controlli
        v.play().catch(() => {});
      });
    }
  }

  function renderLightbox() {
    const it = items[lbIndex];
    const src = it.dataset.src;
    lbStage.innerHTML = '';
    if (it.dataset.type === 'video') {
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      lbStage.appendChild(v);
      playVideo(v);
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = $('img', it).alt;
      lbStage.appendChild(img);
    }
    lbCaption.textContent = it.dataset.caption;
  }
  function openLightbox(i) {
    lbIndex = i;
    lastFocus = document.activeElement;
    renderLightbox();
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lightboxOpen = true;
    if (!FP.on) body.style.overflow = 'hidden';
    $$('.g-item video').forEach(v => v.pause());
    $('#lbClose').focus();
  }
  function closeLightbox() {
    lb.classList.remove('is-open');
    lightboxOpen = false;
    if (!FP.on) body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; lbStage.innerHTML = ''; }, 500);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function stepLightbox(d) {
    lbIndex = (lbIndex + d + items.length) % items.length;
    renderLightbox();
  }
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', () => stepLightbox(-1));
  $('#lbNext').addEventListener('click', () => stepLightbox(1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target === lbStage) closeLightbox(); });
  let lbTouchX = null;
  lb.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (lbTouchX === null) return;
    const dx = e.changedTouches[0].clientX - lbTouchX;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    lbTouchX = null;
  });

  /* =========================================================
     LOCATION ↔ MAPPA
     ========================================================= */
  const locs = $$('.loc');
  const pins = $$('.pin');
  function highlight(i) {
    locs.forEach(l => l.classList.toggle('is-active', l.dataset.loc === String(i)));
    pins.forEach(p => p.classList.toggle('is-active', p.dataset.loc === String(i)));
  }
  [...locs, ...pins].forEach(el => {
    el.addEventListener('mouseenter', () => highlight(el.dataset.loc));
    el.addEventListener('mouseleave', () => highlight(-1));
    el.addEventListener('click', () => highlight(el.dataset.loc));
  });

  /* ---------------------------------------------------------
     Marquee: duplica i partner per il loop continuo
     --------------------------------------------------------- */
  const mq = $('.marquee__track');
  mq.innerHTML += mq.innerHTML;
  $$('.partner', mq).slice(mq.children.length / 2).forEach(p => p.setAttribute('aria-hidden', 'true'));

  /* =========================================================
     FORM (solo frontend)
     ========================================================= */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(field, msg) {
    const wrap = field.closest('.field');
    if (!wrap) return;
    wrap.classList.remove('has-error');
    void wrap.offsetWidth; // riavvia l'animazione
    if (msg) wrap.classList.add('has-error');
    $('.field__error', wrap).textContent = msg || '';
  }

  function validate(form) {
    let ok = true;
    $$('input, textarea, select', form).forEach(f => {
      if (f.type === 'checkbox') return;
      const v = f.value.trim();
      let msg = '';
      if (f.required && !v) msg = 'Campo obbligatorio';
      else if (f.type === 'email' && v && !emailRe.test(v)) msg = 'Inserisci un indirizzo email valido';
      else if (f.type === 'tel' && v && !/^[+\d\s().-]{6,}$/.test(v)) msg = 'Numero non valido';
      else if (f.name === 'name' && v && v.length < 2) msg = 'Inserisci il tuo nome';
      setError(f, msg);
      if (msg) ok = false;
    });
    const cb = $('input[type="checkbox"]', form);
    if (cb) {
      const err = $('.field__error--check', form);
      err.textContent = cb.checked ? '' : 'È necessario il consenso per procedere';
      err.classList.toggle('is-visible', !cb.checked);
      if (!cb.checked) ok = false;
    }
    if (!ok) {
      const first = $('.has-error input, .has-error textarea, .has-error select', form);
      if (first) first.focus({ preventScroll: FP.on });
    }
    return ok;
  }

  $$('.form input, .form textarea, .form select').forEach(f => {
    const evt = f.tagName === 'SELECT' || f.type === 'checkbox' ? 'change' : 'input';
    f.addEventListener(evt, () => {
      if (f.type === 'checkbox') {
        const err = $('.field__error--check', f.form);
        if (f.checked) { err.textContent = ''; err.classList.remove('is-visible'); }
      } else if (f.closest('.field.has-error')) setError(f, '');
    });
  });

  function fakeSend(btn) {
    btn.classList.add('is-loading');
    btn.disabled = true;
    const sp = document.createElement('i');
    sp.className = 'spinner';
    btn.appendChild(sp);
    return new Promise(r => setTimeout(() => {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      sp.remove();
      r();
    }, 1400));
  }

  // Lista esclusiva
  const inviteForm = $('#inviteForm');
  inviteForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate(inviteForm)) return;
    const name = inviteForm.name.value.trim();
    const email = inviteForm.email.value.trim();
    await fakeSend($('button[type="submit"]', inviteForm));
    try {
      const list = JSON.parse(localStorage.getItem('lux_guestlist') || '[]');
      list.push({ name, email, date: new Date().toISOString() });
      localStorage.setItem('lux_guestlist', JSON.stringify(list));
    } catch (_) { /* storage non disponibile */ }

    const wrap = $('#inviteWrap');
    wrap.style.transition = 'opacity .6s, transform .8s cubic-bezier(.16,1,.3,1)';
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      wrap.hidden = true;
      $('#inviteName').textContent = name.split(' ')[0];
      $('#inviteSuccess').hidden = false;
    }, 600);
  });

  // Contatti
  const contactForm = $('#contactForm');
  const note = $('#contactNote');
  contactForm.addEventListener('submit', async e => {
    e.preventDefault();
    note.textContent = '';
    if (!validate(contactForm)) return;
    const name = contactForm.name.value.trim().split(' ')[0];
    await fakeSend($('button[type="submit"]', contactForm));
    contactForm.reset();
    $$('.field', contactForm).forEach(f => f.classList.remove('has-error'));
    note.textContent = `Grazie ${name}, la tua richiesta è stata inviata. Ti risponderemo entro 24 ore.`;
  });
})();

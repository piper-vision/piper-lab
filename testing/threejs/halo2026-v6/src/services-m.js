// "Four ways we create space" on the homepage: services.html option M (James). The section's pin sticks to the screen:
// - the title sits in the middle; the first card comes up over it at a slight angle and straightens (scroll-linked),
//   the title then hides; as you scroll on, the next card appears in its place at the side
// - then each swipe turns the carousel exactly one service (a hard flick or trackpad momentum can't skip one): the
//   outgoing card sets off first, the incoming waits a beat and comes forward; stacking swaps when they're clear
// - the middle card's photo mask leaves room for its text; text fades in once the mask has reshaped
(() => {
  const sec = document.getElementById('services');
  if (!sec) return;
  const S = [
    { t: 'Outdoor<br>Structures', p: 'Elegant, engineered, demountable structures for sport, hospitality and brand events.', img: 'assets/services/hires/outdoor.jpg', alt: 'Green-clad Halo outdoor structure with a staircase and glazed terrace' },
    { t: 'Indoor<br>Structures', p: 'Raised platforms, exhibition systems and structural builds that transform interior environments.', img: 'assets/services/hires/indoor.jpg', alt: 'Halo indoor structure: a warm-lit raised walkway and stairs inside a hall' },
    { t: 'Semi-permanent &amp;<br>meanwhile use', p: 'Spaces built to stay a season or a few years, bringing underused sites to life.', img: 'assets/services/hires/semi-permanent.jpg', alt: 'Halo semi-permanent structure' },
    { t: 'Bespoke<br>applications', p: 'Beyond the usual? We adapt our modular thinking to meet unconventional needs.', img: 'assets/services/hires/bespoke.jpg', alt: 'Bespoke Halo installation with a car on display on a busy street' },
  ];
  const CARD = ['#9DCDEA', '#FF9D00', '#B19170', '#CC89E6'];
  const PROJ = ['Wimbledon ‘25 Fan Village', 'Club St Tropez Retail Pop-up', 'Club St Tropez Retail Pop-up', 'Formula E Redbull Activations'];   // placeholders
  const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13.5M11 4.5l5.5 5.5-5.5 5.5"/></svg>';
  const K = {
    ENTER: 0.7778,   // share of the section's scroll spent on the first card coming up over the title (210vh of 270vh; each service then gets 15vh)
    LOCK: 900,       // ms the page is held after a step: the card move (0.2 s wait + 0.68 s); no mask reveal any more (James)
    GESTURE: 180,    // ms pause in wheel input that counts as a new swipe
    TILT: 7,         // degrees: the arrival angle, and the side cards' angle (matches the CSS)
    SWAP_MS: 376,    // stacking swap during a step (the moment the two cards are clear of each other)
  };
  const stage = sec.querySelector('.svm-stage'), title = sec.querySelector('.svm-title');
  stage.innerHTML = S.map((s, i) => `<div class="svm-slot"><div class="svm-card" data-s="${i}" style="--c:${CARD[i]}">
    <div class="svm-img"><img src="${s.img}" alt="${s.alt}"></div>
    <a class="svm-tag" href="#">${PROJ[i]} →</a>
    <div class="svm-text"><h3>${s.t}</h3><p>${s.p}</p></div>
    <a class="svm-go" href="#" aria-label="Find out more">${arrow}</a></div></div>`).join('');
  sec.querySelector('.svm-prog').innerHTML = CARD.map(c => `<span style="--c:${c}"><i></i></span>`).join('');
  const slots = [...stage.querySelectorAll('.svm-slot')], cards = slots.map(sl => sl.firstElementChild), segs = [...sec.querySelectorAll('.svm-prog span')];

  // the middle photo's mask stops a set gap above that card's own text
  const sizeMasks = () => cards.forEach(c => { const b = c.querySelector('.svm-img').offsetLeft;
    c.style.setProperty('--mb', `${Math.max(0, c.offsetHeight - c.querySelector('.svm-text').offsetTop + b * 1.6)}px`); });
  sizeMasks(); addEventListener('resize', sizeMasks); if (document.fonts) document.fonts.ready.then(sizeMasks);

  // ---- background: each service's colour comes in with the site's pixel transition (src/bgpixels.js look): modular
  // tiles in close shades of the new colour sweep over the old one (up going forward, down going back), each stretching
  // in, then melt into the flat colour, which becomes the pin's background. The first comes in as the first card
  // reaches the title; scrolling back above that returns to the page's #EBEBE1. Between services: a plain fade.
  const BG = ['#C7D9E5', '#F9B24B', '#BFA48E', '#D69CF2'], BASE = '#EBEBE1';
  const PX_LEAD = 300;   // design px: the pixels start when the rising card's top is this far below the title's foot (was 60)
  const PX = { across: 16, coverMs: 650, stretchMs: 200, meltMs: 280, jitter: 0.22, shade: 0.035 };
  const PX_SHAPES = [[1, 1, 6], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [2, 2, 1]];
  const pin = sec.querySelector('.svm-pin');
  const cv = document.createElement('canvas');
  cv.className = 'svm-px'; cv.setAttribute('aria-hidden', 'true');
  pin.prepend(cv);   // first child: everything else paints over it
  const cx = cv.getContext('2d');
  const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
  const rgb = a => `rgb(${a.map(v => Math.round(Math.min(255, Math.max(0, v)))).join(',')})`;
  let bgNow = BASE, pxRun = null;
  // between services: a plain colour fade (James)
  function fadeTo(color) { if (pxRun) pxRun.finish(); bgNow = color; pin.style.transition = 'background-color 0.9s ease'; pin.style.background = color; }
  pin.style.background = BASE;
  function pixelTo(color, back) {
    if (pxRun) pxRun.finish();   // one still running: settle it first
    pin.style.transition = 'none';
    bgNow = color;
    const to = hex(color), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.ceil(pin.clientWidth * dpr), h = Math.ceil(pin.clientHeight * dpr);
    cv.width = w; cv.height = h;
    const cell = Math.ceil(w / PX.across), cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, gw = w / cell, gh = h / cell;
    const used = new Uint8Array(cols * rows), tiles = [];
    const free = (c, r, sw, sh) => { if (c + sw > cols || r + sh > rows) return false; for (let y = r; y < r + sh; y++) for (let x = c; x < c + sw; x++) if (used[y * cols + x]) return false; return true; };
    const pick = () => { let q = Math.random() * 13; for (const s of PX_SHAPES) { q -= s[2]; if (q < 0) return s; } return PX_SHAPES[0]; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (used[r * cols + c]) continue;
      let s = pick(); if (!free(c, r, s[0], s[1])) s = PX_SHAPES[0];
      for (let y = r; y < r + s[1]; y++) for (let x = c; x < c + s[0]; x++) used[y * cols + x] = 1;
      if (c >= gw || r >= gh) continue;
      const d = (Math.random() * 2 - 1) * PX.shade * 255, pos = (r + s[1] / 2) / gh;
      tiles.push({ x: c, y: r, w: s[0], h: s[1], shade: to.map(v => v + d), axisX: s[0] > s[1] || (s[0] === s[1] && Math.random() < 0.5),
        flip: Math.random() < 0.5, k: (back ? pos : 1 - pos) + Math.random() * PX.jitter });
    }
    tiles.sort((a, b) => a.k - b.k);
    const e = 1 / cell, n = tiles.length, start = performance.now();
    let melt = 0, done = false, raf = 0;
    const draw = (t, f) => { const tw = t.axisX ? t.w * f : t.w, th = t.axisX ? t.h : t.h * f; if (tw <= 0 || th <= 0) return;
      cx.fillStyle = rgb(t.shade.map((v, i) => v + (to[i] - v) * melt));
      cx.fillRect((t.flip && t.axisX ? t.x + t.w - tw : t.x) - e, (t.flip && !t.axisX ? t.y + t.h - th : t.y) - e, tw + 2 * e, th + 2 * e); };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); pin.style.background = color; cv.width = cv.height = 0; pxRun = null; };
    pxRun = { finish };
    cx.setTransform(cell, 0, 0, cell, 0, 0);
    (function sweep(now) {
      let fin = 0;
      for (let i = 0; i < n; i++) { const t = tiles[i]; if (t.done) { fin++; continue; }
        let g = (now - start - (i / n) * PX.coverMs) / PX.stretchMs; if (g < 0) continue;
        if (g >= 1) { g = 1; t.done = true; fin++; }
        cx.clearRect(t.x - e, t.y - e, t.w + 2 * e, t.h + 2 * e); draw(t, 1 - Math.pow(1 - g, 3)); }
      if (fin < n) { raf = requestAnimationFrame(sweep); return; }
      const m0 = performance.now();
      (function meltStep(now2) {
        melt = Math.min(1, (now2 - m0) / PX.meltMs);
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h); cx.setTransform(cell, 0, 0, cell, 0, 0);
        for (const t of tiles) draw(t, 1);
        if (melt < 1) raf = requestAnimationFrame(meltStep); else finish();
      })(m0);
    })(start);
  }

  const FIRST = 0.15;   // the first service's share of a normal service's scroll
  let zTimer = 0;
  const setZ = () => cards.forEach(c => { c.dataset.z = 3 - Math.abs(+c.dataset.p); });
  const place = (i, now) => { cards.forEach(c => { const p = Math.max(-2, Math.min(2, +c.dataset.s - i));
      c.dataset.role = now ? '' : p === 0 ? 'in' : c.dataset.p === '0' ? 'out' : ''; c.dataset.p = p; });
    clearTimeout(zTimer); if (now) setZ(); else zTimer = setTimeout(setZ, K.SWAP_MS); };

  // one service per swipe: after a step the scroll is held inside that card's stretch until a new swipe starts
  let act = -1, lastStep = 0, lockUntil = 0, range = null, lastWheel = 0, gesture = 0, live = false, passGesture = -1;
  const noteWheel = () => { const n = performance.now(); if (n - lastWheel > K.GESTURE) gesture = n; lastWheel = n; };
  const calcRange = now => !live ? null : (now < lockUntil || gesture <= lockUntil) ? [act, act] : [act - 1, act + 1];
  const yAt = k => sec.getBoundingClientRect().top + scrollY + (sec.offsetHeight - innerHeight) * (K.ENTER + (1 - K.ENTER) * Math.max(0, k - 1 + FIRST) / 4);
  const clampY = y => { if (!range) return y;
    const lo = range[0] < 0 || (range[0] === 0 && !landed) ? -Infinity : yAt(range[0]) + 2, hi = range[1] >= 3 ? Infinity : yAt(range[1] + 1) - 2;
    return Math.min(Math.max(y, lo), hi); };
  let lockY = null;   // while held: the scroll position the page is pinned at
  const limit = y => { noteWheel(); range = calcRange(performance.now()); return lockY != null ? lockY : clampY(y); };   // smooth.js wheel hook
  // one swipe = one card (James): once the first card has landed, the START of each new wheel gesture turns the carousel
  // one service in its direction and eases the page to that service, however far the swipe would have scrolled; the
  // page is then held until the card's text is in. Past the first / last service the page scrolls on as normal.
  // (Touch and keys still step by scroll position, in frame.)
  addEventListener('wheel', ev => {
    const n = performance.now(), fresh = n - lastWheel > K.GESTURE; noteWheel();
    // native scrolling (Safari, or ?smooth=0: no smooth.js to clamp): hold the page by cancelling the wheel inside the
    // carousel instead of pulling it back every frame, which fought the trackpad's momentum
    if (!window.haloSmooth && live && act >= 0 && landed && !ev.ctrlKey && ev.deltaY) {
      const to = act + Math.sign(ev.deltaY), out = to < 0 || to > 3;
      if (fresh && out && n >= lockUntil) passGesture = gesture;   // a new swipe past the first / last card: let all of it through
      if (gesture !== passGesture && (n < lockUntil || !out || !fresh)) ev.preventDefault();
    }
    if (!fresh || ev.ctrlKey || !ev.deltaY || !live || act < 0 || !landed || n < lockUntil) return;
    const to = act + Math.sign(ev.deltaY); if (to < 0 || to > 3) return;
    act = to; lastStep = n; lockUntil = n + K.LOCK; place(act);
    lockY = yAt(act) + 2;
    if (window.haloSmooth) haloSmooth.to(lockY); else scrollTo(0, lockY);
  }, { passive: false });

  let landed = false;
  function frame() {
    requestAnimationFrame(frame);
    if (window.haloSmooth && haloSmooth.limit !== limit) haloSmooth.limit = limit;   // smooth.js loads after this file
    const r = sec.getBoundingClientRect(), now = performance.now();
    live = r.top < innerHeight && r.bottom > 0;
    const t = Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 1);
    const e = Math.min(t / K.ENTER, 1), ee = 1 - Math.pow(1 - e, 3), H = innerHeight;
    // the first service's stretch is short (FIRST of a normal one) so the carousel turns soon after the first card lands
    const sp = Math.min(Math.max((t - K.ENTER) / (1 - K.ENTER), 0), 1), f = sp * 4 + (1 - FIRST), i = Math.min(3, Math.floor(f)), local = i === 0 ? (f - 1 + FIRST) / FIRST : f - i;
    // the landing counts as a step (checked BEFORE stepping: a fast scroll can pass the landing and the next card's
    // start in one frame): the swipe that brought the card in can't also turn the carousel; brief hold, then the next swipe does
    if (live && act >= 0 && e >= 0.99 && !landed) { landed = true; lastStep = now; lockUntil = now + 250; } else if (e < 0.8) landed = false;
    if (act < 0 || !live) { if (i !== act) { act = i; place(i, true); } }            // off screen (or first frame): just follow
    else if (i !== act && now > lockUntil && gesture > lockUntil) { act += Math.sign(i - act); lastStep = now; lockUntil = now + K.LOCK; place(act); }
    range = calcRange(now);
    if (now < lockUntil) { if (lockY == null && range) lockY = clampY(window.haloSmooth ? haloSmooth.target : scrollY); } else lockY = null;
    // keep the scroll in range: with smooth scroll, clamp its target (not the current position, which would throw away
    // wheel input still easing in); otherwise (touch / keys) the position itself
    if (range) { if (window.haloSmooth) { const g = haloSmooth.target, y = lockY != null ? lockY : clampY(g); if (Math.abs(y - g) > 1) haloSmooth.to(y); }
      else { const y = clampY(scrollY); if (Math.abs(y - scrollY) > 1) scrollTo(0, y); } }
    if (!live) return;
    const rise = 1 - Math.pow(1 - e, 2);   // lands exactly at the end of the arrival (no dead scroll after it)
    title.style.opacity = e < 0.86 ? 1 : 0;   // hidden once covered, so it never shows through the gaps between cards
    // the background: the current service's colour once the first card covers the title, the page colour before that
    // the first colour pixels in just as the first card is about to reach the title (its top within PX_LEAD design px of the
    // title's foot); then a plain fade from service to service
    const fk = cards.findIndex(c => c.dataset.p === '0'), tb = title.getBoundingClientRect().bottom;
    const bgOn = slots[fk].getBoundingClientRect().top < tb + PX_LEAD * innerWidth / 1920;
    const bgWant = bgOn ? BG[act] : BASE;
    if (bgWant !== bgNow) { if (bgWant === BASE || bgNow === BASE) pixelTo(bgWant, bgWant === BASE); else fadeTo(bgWant); }
    const tilt = K.TILT * Math.pow(1 - e, 2);
    // over the first half of the first service's stretch (always there for the later services)
    // on the first service the next card is hidden at the side; it fades in (CSS opacity transition on the slot) while
    // the first card moves out and it moves into the middle
    const appear = act > 0 ? 1 : 0;
    slots.forEach((sl, k) => { const p = cards[k].dataset.p, front = p === '0';
      sl.style.zIndex = cards[k].dataset.z;
      sl.style.opacity = front ? 1 : appear;
      const y = (1 - rise) * H;
      sl.style.transform = `translateY(${y.toFixed(1)}px) rotate(${(front ? tilt : 0).toFixed(2)}deg)`;
      cards[k].style.setProperty('--py', `${((1 - ee) * (front ? 9 : 5)).toFixed(2)}%`); });
    const lp = i === act ? Math.min(local * 1.05, 1) : i > act ? 1 : 0;
    segs.forEach((sg, k) => sg.style.setProperty('--p', k < act ? 1 : k > act ? 0 : lp));
  }
  requestAnimationFrame(frame);

  stage.addEventListener('click', ev => {   // a side card: go to it
    const c = ev.target.closest('.svm-card'); if (!c || c.dataset.p === '0' || ev.target.closest('a')) return;
    const y = yAt(+c.dataset.s + 0.05);
    if (window.haloSmooth) haloSmooth.to(y); else scrollTo({ top: y, behavior: 'smooth' });
  });
})();

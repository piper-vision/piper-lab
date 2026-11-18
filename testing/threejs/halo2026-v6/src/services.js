// "Four ways we create space" (services.html option K, chosen by James): a pinned section.
// - #services is 420vh; while its .sk-pin is stuck, scroll progress 0..1 picks the service (4 slots)
// - the photo changes through a pixel mask: tiles of the new photo sweep up the card (bottom to top going forward,
//   top to bottom going back), each stretching in, drawn on a canvas over the old one
// - the background stays #EBEBE1 throughout (James); only the entrance wipes it in over the cream above; the frame, the current tab's pill
//   and the progress fill take the service's stronger colour
// - the name / copy / Find out more rise in from masks; the progress runs along the bottom, a segment under each tab
//   (the width of its label) filling in its colour
// - entrance: the section waits on the cream of the section above until its top passes enterAt down the screen, then the
//   first colour wipes in and the content comes in alongside it
// - the tabs are links: they ease the page to the start of that service's slot
(() => {
  const sec = document.getElementById('services');
  if (!sec) return;
  const K = {
    landAt: 0.08,       // a link lands this far into its service's slot
    enterAt: 0.75,      // entrance starts when the section's top passes this far down the screen
    revealAfter: 200,   // ms into the entrance wipe before the content starts coming in
    wipeMs: 1100,       // background wipe (matches the CSS clip-path transitions)
    bg: '#EBEBE1',      // the section background (James): the same for every service, it doesn't change between them
  };
  const pin = sec.querySelector('.sk-pin'), wash = sec.querySelector('.sk-wash'), card = sec.querySelector('.sk-card');
  const items = [...sec.querySelectorAll('.sk-item')], tabs = [...sec.querySelectorAll('.sk-tabs a')];
  const CARD = items.map(el => el.dataset.card);
  const segs = [...sec.querySelectorAll('.sk-prog span')], tabSegs = [...sec.querySelectorAll('.sk-seg')];   // phone line / desktop under the tabs

  // ---- background: a flat layer of the new colour wipes across, then becomes the background ----------------------------
  let washTo = null, washT = 0;
  function wipeTo(color, back) {
    clearTimeout(washT);
    if (washTo) pin.style.background = washTo;   // one still running: settle it first
    washTo = color;
    wash.style.transition = 'none'; wash.style.background = color; wash.style.clipPath = back ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)';   // up from the bottom going forward, down going back
    wash.getBoundingClientRect();
    wash.style.transition = `clip-path ${K.wipeMs}ms var(--snap)`; wash.style.clipPath = 'inset(0)';
    washT = setTimeout(() => { pin.style.background = washTo; washTo = null; wash.style.transition = 'none'; wash.style.clipPath = 'inset(100% 0 0 0)'; }, K.wipeMs + 50);
  }

  // ---- photo: revealed through a pixel mask sweeping across the card -------------------------------------------------
  const PXM = { across: 14, coverMs: 700, stretchMs: 220, jitter: 0.25 };   // photo pixel reveal
  const PXM_SHAPES = [[1, 1, 6], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [2, 2, 1]];
  let pxmRun = null;
  function pixelReveal(cv, img, back, onDone) {
    if (pxmRun) pxmRun.finish();   // one still running: complete it at once
    if (!img.complete || !img.naturalWidth) { onDone(); return; }
    const box = cv.parentElement, dpr = Math.min(devicePixelRatio || 1, 2), W = Math.ceil(box.clientWidth * dpr), H = Math.ceil(box.clientHeight * dpr);
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'), iw = img.naturalWidth, ih = img.naturalHeight;
    const sc = Math.max(W / iw, H / ih) * 1.02, ox = (W - iw * sc) / 2, oy = (H - ih * sc) / 2;   // object-fit: cover at 102%
    const cell = Math.ceil(W / PXM.across), cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, gw = W / cell, gh = H / cell;
    const used = new Uint8Array(cols * rows), tiles = [];
    const free = (c, r, sw, sh) => { if (c + sw > cols || r + sh > rows) return false; for (let y = r; y < r + sh; y++) for (let x = c; x < c + sw; x++) if (used[y * cols + x]) return false; return true; };
    const pick = () => { let q = Math.random() * 13; for (const sh of PXM_SHAPES) { q -= sh[2]; if (q < 0) return sh; } return PXM_SHAPES[0]; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (used[r * cols + c]) continue;
      let sh = pick(); if (!free(c, r, sh[0], sh[1])) sh = PXM_SHAPES[0];
      for (let y = r; y < r + sh[1]; y++) for (let x = c; x < c + sh[0]; x++) used[y * cols + x] = 1;
      if (c >= gw || r >= gh) continue;
      const pos = (r + sh[1] / 2) / gh;
      tiles.push({ x: c * cell, y: r * cell, w: sh[0] * cell, h: sh[1] * cell, axisX: sh[0] > sh[1] || (sh[0] === sh[1] && Math.random() < 0.5),
        flip: Math.random() < 0.5, k: (back ? pos : 1 - pos) + Math.random() * PXM.jitter });   // bottom row first going forward, top first going back
    }
    tiles.sort((a, b) => a.k - b.k);
    const ease3 = u => 1 - Math.pow(1 - u, 3);
    const draw = (t, g) => {   // the part of the photo under this tile, grown to g along its axis
      let dw = t.axisX ? t.w * g : t.w, dh = t.axisX ? t.h : t.h * g;
      let dx = t.flip && t.axisX ? t.x + t.w - dw : t.x, dy = t.flip && !t.axisX ? t.y + t.h - dh : t.y;
      dx = Math.floor(dx); dy = Math.floor(dy); dw = Math.min(Math.ceil(dw) + 1, W - dx); dh = Math.min(Math.ceil(dh) + 1, H - dy);
      if (dw <= 0 || dh <= 0) return;
      cx.drawImage(img, (dx - ox) / sc, (dy - oy) / sc, dw / sc, dh / sc, dx, dy, dw, dh);
    };
    const n = tiles.length, t0 = performance.now();
    const run = pxmRun = { done: false, finish() { if (run.done) return; run.done = true; pxmRun = null; onDone(); cv.width = cv.height = 0; } };
    (function step(now) {
      if (run.done) return;
      let fin = 0;
      for (let k = 0; k < n; k++) {
        const t = tiles[k];
        if (t.in) { fin++; continue; }
        let g = (now - t0 - (k / n) * PXM.coverMs) / PXM.stretchMs;
        if (g < 0) continue;
        if (g >= 1) { g = 1; t.in = true; fin++; }
        draw(t, ease3(g));
      }
      if (fin < n) requestAnimationFrame(step); else run.finish();
    })(t0);
  }

  const pxCanvas = card.querySelector('.sk-px');
  function show(k, back, first) {
    const was = card.querySelector('figure.on'), fig = card.querySelector(`figure[data-s="${k}"]`);
    if (was === fig) return;
    const swap = () => { card.querySelectorAll('figure.on').forEach(x => x.classList.remove('on')); fig.classList.add('on'); };
    if (first) swap(); else pixelReveal(pxCanvas, fig.querySelector('img'), back, swap);
  }

  let active = -1, entered = false, revealed = false;
  function setActive(i) {
    if (i === active) return;
    const prev = active, first = prev < 0, back = prev > i;
    active = i;
    if (revealed) items.forEach(el => el.classList.toggle('on', +el.dataset.i === i));
    tabs.forEach(a => a.classList.toggle('on', +a.dataset.i === i));
    pin.style.setProperty('--kc', CARD[i]);
    show(i, back, first);
  }

  const prog = () => { const r = sec.getBoundingClientRect(); return Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 1); };
  let queued = false;
  function update() {
    queued = false;
    const f = prog() * 4, i = Math.min(3, Math.floor(f)), local = f - i;
    setActive(i);
    // progress: four segments, the ones passed full, the current one filling through its slot
    const fillOf = k => (k < i ? 1 : k > i ? 0 : Math.min(local * 1.05, 1));
    segs.forEach((sg, k) => sg.style.setProperty('--p', fillOf(k)));
    tabSegs.forEach((sg, k) => sg.style.setProperty('--p', fillOf(k)));
    if (!entered && sec.getBoundingClientRect().top / innerHeight < K.enterAt) {
      entered = true;
      wipeTo(K.bg, false);   // the one background change: cream to the section grey as it comes in
      setTimeout(() => {   // the content comes in while the wipe runs; the copy's masks rise a beat later
        revealed = true;
        pin.classList.remove('sk-wait');
        setTimeout(() => items.forEach(el => el.classList.toggle('on', +el.dataset.i === active)), 150);
      }, K.revealAfter);
    }
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();

  tabs.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const y = sec.getBoundingClientRect().top + scrollY + (sec.offsetHeight - innerHeight) * (+a.dataset.i + K.landAt) / 4;
    if (window.haloSmooth) haloSmooth.to(y); else scrollTo({ top: y, behavior: 'smooth' });
  }));
  window.haloServices = { update, K };
})();

// Section background reveals using the old nav pixel effect (the menu's pixel transition, index.html):
// a section marked  data-bg-pixels="#EBEBE1" data-bg-from="#FFF8E6"  starts on its `from` colour; when it scrolls
// into view, modular pixels (1x1, 2x1, 1x2, 3x1, 1x3, 2x2) sweep in from the top-right corner in close shades of
// the target colour, each stretching in along one axis, then melt into the flat colour, which becomes the
// section's background. Plays once per section. The canvas sits behind the section's content.
(() => {
  const K = {
    revealAt: 0.85,      // starts when the section's top passes this far down the screen (0 top .. 1 bottom)
    across: 16,          // pixels across the section's width (James: smaller; the nav effect used 6 across the screen)
    coverMs: 750,        // the sweep (the nav's was 420; slower reads better while scrolling)
    stretchMs: 220,      // each pixel stretching in
    meltMs: 320,         // shades melting into the flat colour
    direction: 'down',   // 'down' = a ragged front running from the top of the section to the bottom (James);
                         // 'corner' = the nav's sweep out from `origin`
    origin: [1, 0],      // corner sweep start (1, 0 = top right)
    jitter: 0.22,        // how ragged the sweep's front is (share of the section's height)
    shadeRange: 0.035,   // how far each pixel's shade strays from the target (share of 255)
  };
  const SHAPES = [[1, 1, 6], [2, 1, 2], [1, 2, 2], [3, 1, 1], [1, 3, 1], [2, 2, 1]];
  const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
  const rgb = a => `rgb(${a.map(v => Math.round(Math.min(255, Math.max(0, v)))).join(',')})`;
  const easeOut = u => 1 - Math.pow(1 - u, 3);

  function pickShape() {
    const total = SHAPES.reduce((s, x) => s + x[2], 0);
    let r = Math.random() * total;
    for (const s of SHAPES) { r -= s[2]; if (r < 0) return s; }
    return SHAPES[0];
  }

  function setup(sec) {
    const to = hex(sec.dataset.bgPixels), from = sec.dataset.bgFrom || '#FFF8E6';
    sec.style.background = from;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    sec.prepend(cv);   // first child: everything else in the section paints over it
    const S = { sec, cv, cx: cv.getContext('2d'), to, from, played: false };
    return S;
  }

  function play(S) {
    S.played = true;
    const { sec, cv, cx, to } = S;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.ceil(sec.clientWidth * dpr), h = Math.ceil(sec.clientHeight * dpr);
    cv.width = w; cv.height = h;
    const cell = Math.ceil(w / K.across);
    const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, gw = w / cell, gh = h / cell;
    const used = new Uint8Array(cols * rows);
    const free = (c, r, sw, sh) => {
      if (c + sw > cols || r + sh > rows) return false;
      for (let y = r; y < r + sh; y++) for (let x = c; x < c + sw; x++) if (used[y * cols + x]) return false;
      return true;
    };
    const tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (used[r * cols + c]) continue;
      let s = pickShape();
      if (!free(c, r, s[0], s[1])) s = SHAPES[0];
      for (let y = r; y < r + s[1]; y++) for (let x = c; x < c + s[0]; x++) used[y * cols + x] = 1;
      if (c >= gw || r >= gh) continue;
      const d = (Math.random() * 2 - 1) * K.shadeRange * 255;
      tiles.push({ x: c, y: r, w: s[0], h: s[1], shade: to.map(v => v + d),
        axisX: s[0] > s[1] || (s[0] === s[1] && Math.random() < 0.5), flip: Math.random() < 0.5 });
    }
    // sweep order: top to bottom (or distance from the origin corner), plus a little randomness
    const ox = K.origin[0] * gw, oy = K.origin[1] * gh, far = Math.hypot(gw, gh);
    tiles.forEach(t => {
      const pos = K.direction === 'down' ? (t.y + t.h / 2) / gh : Math.hypot(t.x + t.w / 2 - ox, t.y + t.h / 2 - oy) / far;
      t.k = pos + Math.random() * K.jitter;
    });
    tiles.sort((a, b) => a.k - b.k);

    const e = 1 / cell;
    let melt = 0;
    const fill = t => rgb(t.shade.map((v, i) => v + (to[i] - v) * melt));
    const draw = (t, f) => {
      const tw = t.axisX ? t.w * f : t.w, th = t.axisX ? t.h : t.h * f;
      if (tw <= 0 || th <= 0) return;
      cx.fillStyle = fill(t);
      cx.fillRect((t.flip && t.axisX ? t.x + t.w - tw : t.x) - e, (t.flip && !t.axisX ? t.y + t.h - th : t.y) - e, tw + 2 * e, th + 2 * e);
    };
    cx.setTransform(cell, 0, 0, cell, 0, 0);
    const n = tiles.length, start = performance.now();
    sec.dispatchEvent(new CustomEvent('bgpixels:start'));   // the footer starts its content a moment after this
    (function sweep(now) {
      let finished = 0;
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        if (t.done) { finished++; continue; }
        let g = (now - start - (i / n) * K.coverMs) / K.stretchMs;
        if (g < 0) continue;
        if (g >= 1) { g = 1; t.done = true; finished++; }
        cx.clearRect(t.x - e, t.y - e, t.w + 2 * e, t.h + 2 * e);
        draw(t, easeOut(g));
      }
      if (finished < n) return requestAnimationFrame(sweep);
      // every pixel is in: content can start coming in while the shades melt (the footer uses this)
      sec.dispatchEvent(new CustomEvent('bgpixels:covered'));
      // melt every shade into the flat colour, then hand over to the section's own background
      const m0 = performance.now();
      (function meltStep(now2) {
        melt = Math.min(1, (now2 - m0) / K.meltMs);
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h); cx.setTransform(cell, 0, 0, cell, 0, 0);
        for (const t of tiles) draw(t, 1);
        if (melt < 1) return requestAnimationFrame(meltStep);
        sec.style.background = rgb(to);
        cv.width = cv.height = 0;   // free it
        // tell the element's content it can come in (e.g. the Kit card's text + 3D build wait for this)
        sec.classList.add('bg-done');
        sec.dispatchEvent(new CustomEvent('bgpixels:done'));
      })(m0);
    })(start);
  }

  const sections = [...document.querySelectorAll('[data-bg-pixels]')].map(setup);
  let queued = false;
  function check() {
    queued = false;
    // data-bg-at overrides revealAt per element
    for (const S of sections) if (!S.played && S.sec.getBoundingClientRect().top / innerHeight < (+S.sec.dataset.bgAt || K.revealAt)) play(S);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  addEventListener('scroll', queue, { passive: true });
  check();
  window.haloBgPixels = {
    K,
    replay: i => { const S = sections[i || 0]; S.sec.style.background = S.from; S.played = false; play(S); },
  };
})();

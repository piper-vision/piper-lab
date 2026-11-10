// 3D gallery (from iso-h, as a 2.5D DOM version). The camera is still; photos stream
// TOWARDS it on a loop. A photo at distance d from the camera projects with scale 1/d
// around the focal point (centre of the crossbar gap). Photos sit at fixed world x/y,
// so as d shrinks they grow and slide outward past the edges, then respawn far away.
window.HaloGallery = function (stage, C, ease) {
  const G = C.gallery;
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;';
  stage.appendChild(root);

  const files = Array.from({ length: G.images }, (_, i) => `assets/gallery/${String(i + 1).padStart(2, '0')}.jpg`);
  const clamp01 = v => Math.min(Math.max(v, 0), 1);
  const mod = (a, n) => ((a % n) + n) % n;
  function rng(seed) { // mulberry32: same layout every load
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  const r0 = rng(G.seed);
  const order = files.map((f, i) => i).sort(() => r0() - 0.5);
  const photos = Array.from({ length: G.count }, (_, i) => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;
      background:${C.background};visibility:hidden;will-change:transform,opacity`;
    const img = new Image();
    img.src = files[order[i % files.length]];
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
    el.appendChild(img);
    root.appendChild(el);
    const p = { el, img, aspect: 1.5 };
    p.ready = img.decode().then(() => { p.aspect = img.naturalWidth / img.naturalHeight; }).catch(() => {});
    return p;
  });
  // evenly spaced along the depth loop (shuffled), so one arrives every range/count
  const range = G.far - G.near;
  const slots = photos.map((_, i) => i).sort(() => r0() - 0.5);
  photos.forEach((p, i) => { p.phase = (slots[i] + 0.5) / photos.length * range; p.slot = i; });

  let F = { x: innerWidth / 2, y: innerHeight / 2 };
  let keepOut = null;   // screen rect (the tagline) photos must stay clear of

  // FALL mode: photos drift slowly from top to bottom at fixed depths (nearer = bigger,
  // faster, on top), spread across the width in shuffled slots, staggered in height.
  function layoutFall() {
    const vw = innerWidth, vh = innerHeight, r = rng(G.seed * 17 + 3), Fl = G.fall;
    const ps = 1 + (G.portraitScale - 1) * clamp01((vh / vw - 0.5625) / (1.78 - 0.5625));
    // layers: big full-opacity photos near the camera + a few small faded ones far back.
    // each layer gets its own even left-to-right slots and staggered heights
    // lanes: vertical strips of the screen that no text block covers (photos fall straight
    // down, so any photo outside a lane would pass behind text at some point)
    const pad = Fl.lanePad * vw;
    const spans = (keepOut || []).map(b => [b.left - pad, b.right + pad]).sort((a, b) => a[0] - b[0]);
    const lanes = [];
    let x0 = 0;
    for (const [l, rr] of spans) { if (l > x0) lanes.push([x0, l]); x0 = Math.max(x0, rr); }
    if (x0 < vw) lanes.push([x0, vw]);
    const wide = lanes.filter(([a, b]) => b - a >= Fl.minLane * vw);
    let k = 0;
    for (const Ly of Fl.layers) {
      const n = Ly.count, xs = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
      const inLanes = Ly.lanes && wide.length;
      for (let i = 0; i < n && k < photos.length; i++, k++) {
        const p = photos[k];
        if (inLanes) {
          // round-robin over the lanes; photos sharing a lane share a depth (same speed, never collide)
          const ln = wide[i % wide.length], perLane = Math.ceil(n / wide.length), j = Math.floor(i / wide.length);
          p.d = Ly.depth[0] + (wide.indexOf(ln) / Math.max(1, wide.length - 1)) * (Ly.depth[1] - Ly.depth[0]);
          const W = Math.min((Ly.width[1]) * vw * ps, (ln[1] - ln[0]) * Ly.fill) * p.d;
          Object.assign(p, { W, H: W / p.aspect, op: Ly.opacity, bt: Ly.behindText ?? Fl.behindText });
          p.fx = (ln[0] + ln[1]) / 2 / vw;
          p.fy = (j + 0.5) / perLane;
        } else {
          p.d = Ly.depth[0] + r() * (Ly.depth[1] - Ly.depth[0]);
          const W = (Ly.width[0] + r() * (Ly.width[1] - Ly.width[0])) * vw * ps;
          Object.assign(p, { W, H: W / p.aspect, op: Ly.opacity, bt: Ly.behindText ?? Fl.behindText });
          p.fx = (xs[i] + 0.5 + (r() - 0.5) * Fl.jitter) / n;   // x slot, jittered
          p.fy = (i + r() * 0.5) / n;                             // starting height in the loop
        }
      }
    }
    photos.forEach((p, i) => {
      if (i >= k) { p.op = 0; return; }
      p.el.style.background = 'transparent';   // faded photos let the cream (or photos) behind show through
      const z = Math.round(10000 - p.d * 1000);
      if (z !== p.z) { p.z = z; p.el.style.zIndex = String(z); }
    });
  }

  function layout() {
    if (G.mode === 'fall') return layoutFall();
    const vw = innerWidth, vh = innerHeight, r = rng(G.seed * 31 + 1);
    const ps = 1 + (G.portraitScale - 1) * clamp01((vh / vw - 0.5625) / (1.78 - 0.5625));
    const dc = G.clearAt;   // photos are kept clear of the text from this distance in
    const pad = G.textPad * vw;
    // text boxes relative to the focal point, padded
    const boxes = (keepOut || []).map(k => ({ l: k.left - F.x - pad, r: k.right - F.x + pad, t: k.top - F.y - pad, b: k.bottom - F.y + pad }));
    // distances to test along each photo's path: it slides outward from the focal point as it nears
    const ds = Array.from({ length: 16 }, (_, i) => dc * Math.pow(G.near / dc, i / 15));
    // how many path samples a photo (screen centre sx,sy and size sw,sh at dc) spends behind text
    function hits(sx, sy, sw, sh) {
      let n = 0;
      for (const d of ds) {
        const f = dc / d, cx = sx * f, cy = sy * f, hw = sw * f / 2, hh = sh * f / 2;
        if (cx - hw > vw - F.x || cx + hw < -F.x || cy - hh > vh - F.y || cy + hh < -F.y) break;   // off-screen for good
        for (const b of boxes) if (cx + hw > b.l && cx - hw < b.r && cy + hh > b.t && cy - hh < b.b) { n++; break; }
      }
      return n;
    }
    const placed = [];
    // photos are placed in the order they arrive so neighbours in time spread apart
    const byPhase = [...photos].sort((a, b) => a.phase - b.phase);
    // Each photo flies out along its own direction from the centre. Directions step round by the
    // golden angle in arrival order, so the stream fans out evenly (no stacking on one side) and
    // consecutive photos head off in very different directions.
    const GOLD = Math.PI * (3 - Math.sqrt(5)), a0 = r() * Math.PI * 2;
    // sides of the screen (right, bottom, left, top): a photo whose direction is blocked by text
    // goes to the emptiest open side instead of piling up wherever happens to be free
    const side = (sx, sy) => Math.abs(sx) / (vw / 2) > Math.abs(sy) / (vh / 2) ? (sx > 0 ? 0 : 2) : (sy > 0 ? 1 : 3);
    const used = [0, 0, 0, 0];
    byPhase.forEach((p, i) => {
      const W = (G.width[0] + r() * (G.width[1] - G.width[0])) * vw * ps, H = W / p.aspect;
      const sw = W / dc, sh = H / dc;   // size on screen at the check distance
      const ax = Math.max(vw / 2 - sw / 2, 1), ay = Math.max(vh / 2 - sh / 2, 1);   // reach from the centre
      const target = a0 + i * GOLD;
      let best = null, bestScore = -Infinity;
      // look near the target direction first; widen only if the text blocks it
      for (const spread of [0.25, 0.6, 1.2, Math.PI]) {
        for (let k = 0; k < G.candidates; k++) {
          const a = target + (r() * 2 - 1) * spread, rad = 0.3 + 0.7 * Math.sqrt(r());
          const sx = Math.cos(a) * ax * rad, sy = Math.sin(a) * ay * rad;
          // a spot whose path never crosses the text wins; if none exists, the least crossing
          const h = hits(sx, sy, sw, sh);
          let score = h > 0 ? -1e9 * h : Infinity;
          for (const q of placed) {
            const dp = Math.abs(p.phase - q.phase), dPh = Math.min(dp, range - dp);
            score = Math.min(score, Math.hypot(sx - q.sx, sy - q.sy, dPh * vw * G.depthWeight));
          }
          // a side already holding more than its share loses out to emptier sides
          if (h === 0) score -= vw * (used[side(sx, sy)] - Math.min(...used));
          if (score > bestScore) { bestScore = score; best = { sx, sy, h }; }
        }
        if (best && best.h === 0) break;   // a clear spot near the target direction: done
      }
      if (best) used[side(best.sx, best.sy)]++;
      if (!best) best = { sx: (r() < 0.5 ? -1 : 1) * vw * 0.4, sy: 0 };
      Object.assign(p, best, { X: best.sx * dc, Y: best.sy * dc, W, H });
      placed.push(p);
    });
  }

  function updateFall(gt, vw, vh) {
    const Fl = G.fall, pad = G.textPad * vw;
    const boxes = (keepOut || []).map(k => ({ l: k.left - pad, r: k.right + pad, t: k.top - pad, b: k.bottom + pad }));
    for (const p of photos) {
      const s = 1 / p.d, sw = p.W * s, sh = p.H * s;
      const travel = vh + sh;                                   // fully above the top -> fully below the bottom
      const y = -sh + mod(p.fy * travel + Fl.speed * vh * s * gt, travel);
      const x = p.fx * vw - sw / 2;
      if (y > vh || y + sh < 0) { setVis(p, false); continue; }
      setVis(p, true);
      // depth: farther photos are fainter; any photo passing behind text dims so the text reads
      if (!p.op) { setVis(p, false); continue; }
      let op = p.op;
      let cover = 0;
      for (const b of boxes) {
        const ix = Math.min(x + sw, b.r) - Math.max(x, b.l), iy = Math.min(y + sh, b.b) - Math.max(y, b.t);
        if (ix > 0 && iy > 0) cover = Math.max(cover, Math.min(ix / Math.min(sw, b.r - b.l), iy / Math.min(sh, b.b - b.t)));
      }
      op *= 1 - (1 - p.bt) * ease(clamp01(cover * 2.5));
      p.el.style.transform = `translate(${x}px, ${y}px) scale(${sw / 100}, ${sh / 100})`;
      p.img.style.opacity = op;
    }
  }

  function setVis(p, v) { if (p.vis !== v) { p.vis = v; p.el.style.visibility = v ? 'visible' : 'hidden'; } }
  let laidOut = false;
  const loaded = Promise.all(photos.map(p => p.ready));
  const api = {
    setFocal(f) { F = f; if (laidOut) layout(); },
    setKeepOut(rect) { keepOut = rect; if (laidOut) layout(); },
    whenReady: loaded.then(() => { layout(); laidOut = true; }),
    // gt: seconds since the gallery started (may be negative while it warms up hidden
    // behind the opaque scene photos); show: false = not drawn at all
    // out: 0..1, the whole gallery fades while the photos rush `boost` closer
    update(gt, show = gt >= 0, out = 0, boost = 0) {
      const vw = innerWidth, vh = innerHeight;
      root.style.opacity = 1 - out;
      if (out >= 1) show = false;
      if (G.mode === 'fall' && laidOut && show) return updateFall(gt, vw, vh);
      for (const p of photos) {
        if (!laidOut || !show) { setVis(p, false); continue; }
        const d = G.near + mod(p.phase - G.speed * gt - boost * out, range);
        // entrance: the first photos pop in one after another, then far-off arrivals fade in
        const pop = G.revealDur > 0 ? ease(clamp01((gt - p.slot * G.revealStagger) / G.revealDur)) : 1;
        const op = clamp01((G.far - d) / (G.far - G.full)) * clamp01((d - G.near) / G.nearFade) * pop;
        const sw = p.W / d, sh = p.H / d, sx = F.x + p.X / d - sw / 2, sy = F.y + p.Y / d - sh / 2;
        if (op <= 0.002 || sx > vw || sy > vh || sx + sw < 0 || sy + sh < 0) { setVis(p, false); continue; }
        setVis(p, true);
        // only touch styles that changed: restacking every frame is costly
        const z = Math.round(10000 - d * 1000);
        if (z !== p.z) { p.z = z; p.el.style.zIndex = String(z); }
        const s = 0.85 + 0.15 * pop;   // small scale punch on the first pop-in
        p.el.style.transform = `translate(${sx + sw * (1 - s) / 2}px, ${sy + sh * (1 - s) / 2}px) scale(${sw * s / 100}, ${sh * s / 100})`;
        p.img.style.opacity = op;
      }
    },
  };
  addEventListener('resize', () => { if (laidOut) layout(); });
  return api;
};

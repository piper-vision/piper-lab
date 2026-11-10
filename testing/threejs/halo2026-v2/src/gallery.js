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
    const p = { el, img, aspect: 1.5, src: img.src };
    p.ready = img.decode().then(() => { p.aspect = img.naturalWidth / img.naturalHeight; }).catch(() => {});
    return p;
  });
  // LIME SQUARES (James): a few solid lime squares fly in the stream among the photos, smaller,
  // spread through the same depth loop. They ride the same layout (so they keep off the text too).
  const SQ = Object.assign({ count: 12, size: [0.035, 0.08], color: C.yellow, overUI: true, inAt: [0.9, 1.4] }, G.squares || {});
  // they fly THROUGH the UI (James): their own layer above the text and buttons (but under the menu)
  const sqLayer = document.createElement('div');
  sqLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:' + (SQ.overUI ? 4 : 0) + ';visibility:hidden;';
  (SQ.overUI ? document.body : root).appendChild(sqLayer);
  for (let i = 0; i < SQ.count; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;visibility:hidden;will-change:transform,opacity';
    const fill = document.createElement('div');   // stands in for the photo's <img>
    fill.style.cssText = 'width:100%;height:100%;background:' + SQ.color;
    el.appendChild(fill);
    sqLayer.appendChild(el);
    photos.push({ el, img: fill, aspect: 1, square: true, ready: Promise.resolve() });
  }
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
      const W = (p.square ? SQ.size[0] + r() * (SQ.size[1] - SQ.size[0]) : G.width[0] + r() * (G.width[1] - G.width[0])) * vw * ps, H = W / p.aspect;
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
          const h = p.square ? 0 : hits(sx, sy, sw, sh);   // squares go straight through the text
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

  // cursor steering + depth of field (approach mode), see update()
  const ST = Object.assign({ shift: [0.06, 0.04], smooth: 2.5 }, G.steer || {});   // camera slide at the window edge (screen widths at d = 1)
  const DOF = Object.assign({ far: 7, near: 2.5, sharp: [0.9, 2.2], stretch: 0.08, stretchAt: 0.75 }, G.dof || {});
  let mx = 0, my = 0, tmx = 0, tmy = 0, lastT = performance.now();
  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    tmx = (e.clientX / innerWidth) * 2 - 1; tmy = (e.clientY / innerHeight) * 2 - 1;
  });
  document.documentElement.addEventListener('pointerleave', () => { tmx = tmy = 0; });

  // ---- MODULAR ASSEMBLY (James picked from the gallery ideas): each photo is cut into a grid of
  // modules that fly at different depths. Far off they're scattered through space; they snap
  // together into the whole photo as it nears, hold, then break apart again as it rushes past.
  const MOD = Object.assign({ cols: 3, rows: 3, spread: 1.6, scatter: 1.6, spin: 16, shrink: 0.55, assemble: [3.9, 2.1] }, G.modular || {});
  let modOn = false;
  const smooth = t => t * t * (3 - 2 * t);
  function tilesFor(p) {
    if (p.tiles) return p.tiles;
    const r = rng(G.seed * 97 + p.slot * 13 + 5);
    p.tiles = [];
    for (let row = 0; row < MOD.rows; row++) for (let col = 0; col < MOD.cols; col++) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;visibility:hidden;will-change:transform,opacity;' +
        'background-image:url("' + p.src + '");background-repeat:no-repeat;' +
        'background-size:' + (MOD.cols * 100) + '% ' + (MOD.rows * 100) + '%;' +
        'background-position:' + (MOD.cols > 1 ? col / (MOD.cols - 1) * 100 : 0) + '% ' + (MOD.rows > 1 ? row / (MOD.rows - 1) * 100 : 0) + '%;';
      root.appendChild(el);
      // each module: its own depth offset and a little sideways scatter while apart
      p.tiles.push({ el, col, row, dz: r() * 2 - 1, jx: r() * 2 - 1, jy: r() * 2 - 1, rz: r() * 2 - 1, vis: false });
    }
    return p.tiles;
  }
  function hideTiles(p) { if (p.tiles) for (const t of p.tiles) if (t.vis) { t.vis = false; t.el.style.visibility = 'hidden'; } }
  function drawTiles(p, d, camX, camY, vw, vh) {
    // 0 = whole, 1 = fully apart. One way only: small scattered pieces far off converge between
    // assemble[0] and assemble[1] (distances), growing as they go, and lock into the complete photo,
    // which then stays whole all the way past the camera
    const [aFar, aNear] = MOD.assemble;
    const apart = smooth(clamp01((d - aNear) / (aFar - aNear)));
    const tw = p.W / MOD.cols, th = p.H / MOD.rows;
    for (const t of tilesFor(p)) {
      const dt = Math.max(G.near * 0.5, d + t.dz * MOD.spread * apart);
      const op = clamp01((G.far - dt) / (G.far - G.full)) * clamp01((dt - G.near * 0.5) / G.nearFade);
      const wx = p.X - p.W / 2 + (t.col + 0.5) * tw + t.jx * MOD.scatter * tw * apart;
      const wy = p.Y - p.H / 2 + (t.row + 0.5) * th + t.jy * MOD.scatter * th * apart;
      const k = 1 - MOD.shrink * apart;   // pieces are smaller while apart and grow as they join
      const w = tw / dt * k + 0.6, h = th / dt * k + 0.6;   // +0.6px so neighbours meet with no hairline
      const cx = F.x + (wx - camX) / dt, cy = F.y + (wy - camY) / dt;
      const show = op > 0.002 && cx + w / 2 > 0 && cx - w / 2 < vw && cy + h / 2 > 0 && cy - h / 2 < vh;
      if (show !== t.vis) { t.vis = show; t.el.style.visibility = show ? 'visible' : 'hidden'; }
      if (!show) continue;
      t.el.style.zIndex = String(Math.round(10000 - dt * 1000));
      t.el.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) rotate(' + (t.rz * MOD.spin * apart) + 'deg) translate(' + (-w / 2) + 'px, ' + (-h / 2) + 'px) scale(' + (w / 100) + ', ' + (h / 100) + ')';
      t.el.style.opacity = op;
    }
  }

  // ---- PAPER BEND (James: "imagine a piece of paper flying, the corners bend backwards ... as they're
  // nearly full opacity they straighten up"). The photo is cut into a grid of tiles laid over a dome
  // that curves away from the viewer (z = -k(x^2 + y^2)/2), each tile turned to follow the surface, so
  // the edges and most of all the corners bend back. CSS 3D, perspective on the photo box.
  const PAPER = Object.assign({ on: true, bend: 55, cols: 9, rows: 6, straightAt: 0.95 }, G.paper || {});
  function paperTiles(p) {
    if (p.paper) return p.paper;
    p.paper = [];
    for (let r = 0; r < PAPER.rows; r++) for (let c = 0; c < PAPER.cols; c++) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;background-repeat:no-repeat;backface-visibility:hidden;display:none;' +
        'background-image:url("' + p.src + '")';
      p.el.appendChild(el);
      p.paper.push({ el, c, r });
    }
    return p.paper;
  }
  function drawPaper(p, d, sw, sh) {
    // how far into its fade-in the photo is (0 = just appearing, 1 = full opacity)
    const f = clamp01((G.far - d) / (G.far - G.full));
    const u = clamp01(f / PAPER.straightAt), bendK = 1 - u * u * (3 - 2 * u);
    const th = PAPER.on ? PAPER.bend * bendK * Math.PI / 180 : 0;   // edge angle (rad)
    const flat = th < 0.004;
    if (flat !== p.flat) {
      p.flat = flat;
      p.img.style.display = flat ? 'block' : 'none';
      for (const t of paperTiles(p)) t.el.style.display = flat ? 'none' : 'block';
      p.el.style.background = flat ? C.background : 'transparent';
    }
    if (flat) return;
    // cover-fit the photo over the sheet, as the img does
    const iw = p.aspect, bw = Math.max(sw, sh * iw), bh = bw / iw, ox = (bw - sw) / 2, oy = (bh - sh) / 2;
    const k = th / (sw / 2), tw = sw / PAPER.cols, tht = sh / PAPER.rows;
    p.el.style.perspective = (Math.max(sw, sh) * 2.2) + 'px';
    for (const t of paperTiles(p)) {
      const s = (t.c + 0.5) * tw - sw / 2, v = (t.r + 0.5) * tht - sh / 2;
      const z = -k * (s * s + v * v) / 2;
      const st = t.el.style;
      // a turned tile looks narrower (by its cosine), so stretch it to keep covering its share of the
      // sheet; with the small overlap the tiles read as one unbroken curved surface
      const ay = k * s, ax = -k * v, gx = 1 / Math.max(Math.cos(ay), 0.3), gy = 1 / Math.max(Math.cos(ax), 0.3);
      const w = tw * gx + 1.2, h = tht * gy + 1.2;
      st.width = w + 'px'; st.height = h + 'px';
      // the image is stretched with the tile, so it stays continuous across the seams
      st.backgroundSize = (bw * gx) + 'px ' + (bh * gy) + 'px';
      st.backgroundPosition = ((-(t.c * tw) - ox) * gx - (w - tw * gx) / 2) + 'px ' + ((-(t.r * tht) - oy) * gy - (h - tht * gy) / 2) + 'px';
      st.transform = 'translate3d(' + (t.c * tw + tw / 2 - w / 2) + 'px, ' + (t.r * tht + tht / 2 - h / 2) + 'px, ' + z + 'px) rotateY(' + ay + 'rad) rotateX(' + ax + 'rad)';
    }
  }

  function setVis(p, v) { if (p.vis !== v) { p.vis = v; p.el.style.visibility = v ? 'visible' : 'hidden'; } }
  let laidOut = false;
  const loaded = Promise.all(photos.map(p => p.ready));
  const api = {
    setFocal(f) { F = f; if (laidOut) layout(); },
    setKeepOut(rect) { keepOut = rect; if (laidOut) layout(); },
    // the WebGL gallery reuses this layout (positions, sizes, arrival phases)
    layoutData: () => (laidOut ? { photos, range, F } : null),
    setModular(v) { modOn = v; if (!v) photos.forEach(hideTiles); },
    mouse(x, y) { tmx = mx = x; tmy = my = y; },   // debug: put the (eased) cursor at x, y in -1..1
    whenReady: loaded.then(() => { layout(); laidOut = true; }),
    // gt: seconds since the gallery started (may be negative while it warms up hidden
    // behind the opaque scene photos); show: false = not drawn at all
    // out: 0..1, the whole gallery fades while the photos rush `boost` closer
    update(gt, show = gt >= 0, out = 0, boost = 0) {
      const vw = innerWidth, vh = innerHeight;
      root.style.opacity = 1 - out;
      if (out >= 1) show = false;
      if (G.mode === 'fall' && laidOut && show) return updateFall(gt, vw, vh);
      // squares sit above the page, so they'd show over the last intro photo while it's still there:
      // fade them in as it fades away (it goes over the first ~1.2 s of gallery time)
      const sqIn = Math.min(Math.max((gt - SQ.inAt[0]) / (SQ.inAt[1] - SQ.inAt[0]), 0), 1);
      sqLayer.style.visibility = show && sqIn > 0 ? 'visible' : 'hidden';
      sqLayer.style.opacity = (1 - out) * sqIn;
      // STEER: the virtual camera slides towards the cursor (eased), so the stream drifts like a
      // space you're flying through: a photo at distance d shifts by 1/d, near ones much more (parallax)
      const now = performance.now(), dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      const km = 1 - Math.exp(-ST.smooth * dt);
      mx += (tmx - mx) * km; my += (tmy - my) * km;
      const camX = mx * ST.shift[0] * vw, camY = my * ST.shift[1] * vw;
      for (const p of photos) {
        if (!laidOut || !show || (p.square && gt < 0)) { setVis(p, false); hideTiles(p); continue; }
        const d = G.near + mod(p.phase - G.speed * gt - boost * out, range);
        if (modOn && !p.square) { setVis(p, false); drawTiles(p, d, camX, camY, vw, vh); continue; }
        hideTiles(p);
        // entrance: the first photos pop in one after another, then far-off arrivals fade in
        const pop = G.revealDur > 0 ? ease(clamp01((gt - p.slot * G.revealStagger) / G.revealDur)) : 1;
        const op = clamp01((G.far - d) / (G.far - G.full)) * clamp01((d - G.near) / G.nearFade) * pop;
        const s = 0.85 + 0.15 * pop;   // small scale punch on the first pop-in
        const sw = p.W / d * s, sh = p.H / d * s;
        const cx = F.x + (p.X - camX) / d, cy = F.y + (p.Y - camY) / d;   // photo centre on screen
        if (op <= 0.002 || cx - sw / 2 > vw || cy - sh / 2 > vh || cx + sw / 2 < 0 || cy + sh / 2 < 0) { setVis(p, false); continue; }
        setVis(p, true);
        // only touch styles that changed: restacking every frame is costly
        const z = Math.round(10000 - d * 1000);
        if (z !== p.z) { p.z = z; p.el.style.zIndex = String(z); }
        // MOTION STRETCH: rushing past close to the camera, a photo stretches a touch along its
        // direction of travel (outward from the centre)
        const st = DOF.stretch * clamp01((DOF.stretchAt - d) / (DOF.stretchAt - G.near));
        const a = Math.atan2(cy - F.y, cx - F.x);
        p.el.style.width = sw + 'px'; p.el.style.height = sh + 'px';
        p.el.style.transform = st > 0.001
          ? `translate(${cx}px, ${cy}px) rotate(${a}rad) scale(${1 + st}, 1) rotate(${-a}rad) translate(${-sw / 2}px, ${-sh / 2}px)`
          : `translate(${cx - sw / 2}px, ${cy - sh / 2}px)`;
        p.el.style.opacity = op; p.img.style.opacity = 1;
        // PAPER: far off a photo flies like a sheet of paper, its edges and corners bent back away from
        // you; it flattens out as it reaches full opacity
        if (!p.square) drawPaper(p, d, sw, sh);
        // DEPTH OF FIELD: soft in the distance, pin sharp through the middle, a little motion blur
        // as they rush past. Blur is set in the 100px box's own units, so divide by its scale.
        const blur = DOF.far * clamp01((d - DOF.sharp[1]) / (G.far - DOF.sharp[1]))
          + DOF.near * clamp01((DOF.sharp[0] - d) / (DOF.sharp[0] - G.near));
        const local = Math.round(blur * 20) / 20;   // the box is real px now, so no scale to undo
        if (local !== p.blur) { p.blur = local; p.el.style.filter = local > 0.05 ? `blur(${local}px)` : 'none'; }
      }
    },
  };
  addEventListener('resize', () => { if (laidOut) layout(); });
  return api;
};

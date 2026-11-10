(() => {
  const C = window.HALO_CONFIG;
  const stage = document.getElementById('stage');
  document.body.style.background = C.background;
  const N = C.scenes[0].rects.length;
  // background layers, stacked in scene order so later scenes cover earlier ones
  const bgLayers = (C.backgrounds || []).map(src => {
    if (!src) return null;
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', inset: '0', opacity: '0', zIndex: '1',   // above the gallery (0), below the bars (2)
      background: `url("${src}") center / cover no-repeat` });
    stage.appendChild(el);
    return el;
  });
  const gallery = C.gallery.mode === 'carousel' ? window.HaloCarousel(stage, C) : window.HaloGallery(stage, C, t => ease(t));
  const bars = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'bar';
    el.style.background = C.yellow;
    el.style.width = el.style.height = '100px';
    stage.appendChild(el);
    bars.push(el);
  }

  // cubic-bezier solver (same maths as CSS)
  function bezier([x1, y1, x2, y2]) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1;
      if (Math.abs(sx(t) - x) > 1e-5) { t = x; for (let i = 0; i < 30; i++) { (sx(t) < x ? lo = t : hi = t); t = (lo + hi) / 2; } }
      return sy(t);
    };
  }
  const ease = bezier(C.ease);
  C.easeFn = ease;
  const end = window.HaloEnd(C);

  // design rect -> viewport px for a scene
  function layout(scene) {
    const W = innerWidth, H = innerHeight;
    if (scene.mode === 'edge') {
      const s = Math.min(W / 1920, H / 1080), m = C.margin * s;
      const kx = (W - 2 * m) / (1920 - 2 * C.margin), ky = (H - 2 * m) / (1080 - 2 * C.margin);
      return scene.rects.map(([x, y, w, h]) => [m + (x - C.margin) * kx, m + (y - C.margin) * ky, w * kx, h * ky]);
    }
    const s = Math.min(W / 1920, H / 1080), ox = (W - 1920 * s) / 2, oy = (H - 1080 * s) / 2;
    return scene.rects.map(([x, y, w, h]) => [ox + x * s, oy + y * s, w * s, h * s]);
  }

  // timeline: [hold0, move0->1, hold1, move1->2, ..., endHold]
  const S = C.scenes.length;
  const segs = [];
  let t0 = 0;
  const I = C.intro || {};
  const PRE = C.pre3d && C.pre3d.enabled ? C.pre3d : null;
  if (PRE) I.enabled = false;   // the 3D pre-intro brings the bars in instead
  if (I.enabled) {
    const dur = I.delay + I.stagger * (N - 1) + I.duration;
    segs.push({ type: 'intro', t0, t1: dur }); t0 = dur;
  }
  for (let i = 0; i < S; i++) {
    const hold = i === 0 ? C.startHold : i === S - 1 ? C.endHold : C.hold;
    segs.push({ type: 'hold', scene: i, t0, t1: t0 + hold }); t0 += hold;
    if (i < S - 1) {
      const dur = C.move + C.stagger * (N - 1);
      segs.push({ type: 'move', from: i, to: i + 1, t0, t1: t0 + dur }); t0 += dur;
    }
  }
  const total = t0;

  let layouts, focal;
  function relayout() {
    layouts = C.scenes.map(layout);
    // photos stream out from the centre of the gap between the middle bars (the screen centre)
    focal = { x: innerWidth / 2, y: innerHeight / 2 };
    gallery.setFocal(focal);
  }
  relayout();
  addEventListener('resize', relayout);

  const Fz = C.finale, galleryStart = total + Fz.galleryAt;
  const lastBg = bgLayers.length - 1;
  const firstBg = bgLayers.findIndex(Boolean);
  const firstMove = segs.find(s => s.type === 'move' && s.to === firstBg);
  const warmFrom = firstMove ? firstMove.t0 + C.bgSwitchAt * C.move + C.bgFade + 0.05 : total;
  const finalLayout = () => layout({ mode: 'edge', rects: end.bars() || Fz.rects });
  let tagLayout = finalLayout();
  addEventListener('resize', () => { tagLayout = finalLayout(); });

  // photos are placed so they never pass behind the end layout's text
  const keepOut = () => gallery.setKeepOut(end.boxes());
  document.fonts.ready.then(keepOut);
  end.onLayout(() => { tagLayout = finalLayout(); keepOut(); });
  addEventListener('resize', keepOut);

  function render(tRaw) {
    const tAll = C.loop ? tRaw : tRaw;   // unclamped time for the finale + gallery
    let t = C.loop ? ((tRaw % total) + total) % total : Math.min(tRaw, total - 1e-6);
    const seg = segs.find(s => t >= s.t0 && t < s.t1) || segs[segs.length - 1];
    const outK = C.loop ? 0 : ease(Math.min(Math.max((tAll - total) / Fz.imageOut, 0), 1));
    const layerIn = j => {
      const mv = segs.find(s => s.type === 'move' && s.to === j);
      const on = mv.t0 + C.bgSwitchAt * C.move;
      return C.bgFade > 0 ? Math.min(Math.max((t - on) / C.bgFade, 0), 1) : (t >= on ? 1 : 0);
    };
    bgLayers.forEach((el, j) => {
      if (!el) return;
      const mv = segs.find(s => s.type === 'move' && s.to === j);
      const o = layerIn(j);
      const out = outK;
      // hide a photo once the next one fully covers it, so it can't bleed through the final fade
      const covered = j < lastBg && bgLayers[j + 1] && layerIn(j + 1) >= 1;
      el.style.opacity = covered ? 0 : o * (1 - out);
      const M = C.bgMotion;
      if (M && o > 0) {
        const local = (j === lastBg ? Math.min(tAll, total + Fz.imageOut) : t) - mv.t0;
        const k = ease(Math.min(Math.max(local / C.move, 0), 1));
        const s = M.enterScale + (M.restScale - M.enterScale) * k + M.drift * Math.max(0, local - C.move) + Fz.imageOutScale * out;
        const [px, py] = (M.pan && M.pan[j]) || [0, 0];
        el.style.transform = `translate(${px * (1 - k)}vw, ${py * (1 - k)}vh) scale(${s})`;
      }
    });
    for (let i = 0; i < N; i++) {
      let r;
      if (seg.type === 'intro') {
        const slot = I.order.indexOf(i);
        const k = ease(Math.min(Math.max((t - I.delay - I.stagger * slot) / I.duration, 0), 1));
        const [x, y, w, h] = layouts[0][i];
        const o = I.origin[i] || 'center';
        const sx = I.axis.includes('x') ? k : 1, sy = I.axis.includes('y') ? k : 1;
        const nw = w * sx, nh = h * sy;
        const f = o === 'center' ? 0.5 : (o === 'bottom' || o === 'right') ? 1 : 0;
        r = [x + (w - nw) * (I.axis.includes('x') ? f : 0.5), y + (h - nh) * (I.axis.includes('y') ? f : 0.5), nw, nh];
      } else if (seg.type === 'hold') r = layouts[seg.scene][i];
      else {
        const local = t - seg.t0 - C.stagger * i;
        const k = ease(Math.min(Math.max(local / C.move, 0), 1));
        const a = layouts[seg.from][i], b = layouts[seg.to][i];
        r = a.map((v, j) => v + (b[j] - v) * k);
      }
      // finale: middle bars shorten to make room for the tagline
      if (!C.loop && tAll > galleryStart) {
        const k = ease(Math.min(Math.max((tAll - galleryStart - Fz.barsAt) / C.move, 0), 1));
        r = r.map((v, j) => v + (tagLayout[i][j] - v) * k);
      }
      // scale a 100px box via transform: GPU-only, no layout per frame
      bars[i].style.transform = `translate(${r[0]}px, ${r[1]}px) scale(${r[2] / 100}, ${r[3] / 100})`;
    }
  }

  const clamp01 = v => Math.min(Math.max(v, 0), 1);
  // with the 3D pre-intro the DOM timeline waits (sitting on scene 1, under its canvas) until it lands
  const preDelay = () => (PRE ? (PRE.swingAt + PRE.swingDur) * 1000 : 0);
  let frozen = null, start = performance.now() + preDelay();
  // the pre-intro calls this the moment its flat H lands, so the two can never drift apart
  // (preDelay above is only the fallback if it never loads)
  window.haloBeginTimeline = () => { if (frozen == null) start = performance.now(); };
  if (PRE) start += 3000;
  function frame(now) {
    const tt = frozen ?? (now - start) / 1000;
    const gt = C.loop ? -1 : tt - galleryStart;
    render(Math.max(tt, 0));
    // photos are already streaming behind the final image, so its fade reveals them
    // and they're drawn from the moment the first scene photo is fully opaque (hidden behind
    // it), so the browser decodes + uploads them long before they're seen: no stutter
    gallery.update(C.loop ? -1 : tt - (total + Fz.photosAt), !C.loop && tt >= warmFrom);
    // the site layout comes in over the gallery as the intro ends
    end.update(C.loop ? -1 : gt - C.end.at);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.haloDebug = {
    freeze: s => { frozen = s; window.haloPre3d?.finish(); },
    gallery: () => ({ galleryStart }),
    end: () => galleryStart + C.end.at,   // haloDebug.freeze(haloDebug.end() + 2) = settled end layout
    boxes: () => end.boxes(),
    layout: n => end.layout(n),
    // overlay James' mock to line the end layout up: haloDebug.ref(0.5), haloDebug.ref(0) to hide
    ref: (o, src = 'assets/ref-end-2.webp') => { let r = document.getElementById('ref'); if (!r) { r = document.createElement('img'); r.id = 'ref'; } r.src = src; {
      r.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9;pointer-events:none'; document.body.appendChild(r); } r.style.opacity = o; },
    play: () => { if (PRE && frozen != null) return location.reload(); frozen = null; start = performance.now(); },
    scene: i => { const s = segs.find(x => x.type === 'hold' && x.scene === i); frozen = s.t0 + 0.01; },
    total, segs,
  };
})();

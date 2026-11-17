// "Mouse Follow" mode, modelled on how.studio's hero (from James' screen recordings): as the cursor
// moves, every `spacing` of travel a photo appears right under it. Each photo lives its own short
// life where it landed: it springs up out of nothing and reverses straight back down in one fluid
// arc, with no pause at the top.
// Move slowly and one photo at a time blooms and fades; sweep fast and they lay a short overlapping
// trail (newest on top) that clears itself from the oldest end. The text stays above.
window.HaloTrail = function (stage, C) {
  const T = Object.assign({
    spacing: 0.12,        // screen widths of cursor travel between photos (~3/4 of a photo, so they only partly overlap)
    // shapes alternate landscape, portrait, landscape... (photos are cropped to fit, cover-style)
    landscape: { ratio: 3 / 2, width: [0.155, 0.2] },   // width range in screen widths
    portrait: { ratio: 4 / 5, width: [0.11, 0.14] },
    life: 0.95,           // seconds each photo lives: it springs up and straight back down in one movement
    peak: 0.36,           // where in its life it reaches full size (0..1); earlier = snappier rise
    shrink: 0.25,         // seconds to shrink away if switched off mid-life
  }, C.trail || {});
  const root = document.createElement('div');
  root.className = 'trail';
  stage.appendChild(root);

  const files = Array.from({ length: C.gallery.images }, (_, i) => `assets/gallery/${String(i + 1).padStart(2, '0')}.jpg`);
  files.forEach(f => { new Image().src = f; });   // preload

  let on = false, next = 0, z = 1, anchor = null;
  const live = [];   // { el, born, kill }
  function spawn(x, y) {
    const n = next++, i = n % files.length, shape = n % 2 ? T.portrait : T.landscape;
    const w = (shape.width[0] + Math.random() * (shape.width[1] - shape.width[0])) * innerWidth, h = w / shape.ratio;
    const el = document.createElement('div');
    el.className = 'trail-pic';
    el.style.cssText = `width:${w}px;height:${h}px;left:${x - w / 2}px;top:${y - h / 2}px;z-index:${z++};background-image:url("${files[i]}")`;
    root.appendChild(el);
    live.push({ el, born: performance.now(), kill: null });
    anchor = { x, y };
  }
  function move(x, y) {
    if (!on) return;
    if (!anchor || Math.hypot(x - anchor.x, y - anchor.y) >= T.spacing * innerWidth) spawn(x, y);
  }
  addEventListener('pointermove', e => move(e.clientX, e.clientY));
  (function tick(now) {
    requestAnimationFrame(tick);
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i], age = (now - p.born) / 1000;
      // scale: one fluid arc, no hold: it bounces up to full size and reverses straight back down
      // to nothing (a sine hump, warped so the rise is quicker than the fall)
      const u = Math.min(age / T.life, 1), k = Math.log(0.5) / Math.log(T.peak);
      let s = Math.sin(Math.PI * Math.pow(u, k));
      if (p.kill != null) s *= Math.max(0, 1 - (now - p.kill) / 1000 / T.shrink);   // switched off: shrink away
      if (u >= 1 || (p.kill != null && s <= 0)) { p.el.remove(); live.splice(i, 1); continue; }
      p.el.style.transform = `scale(${Math.max(s, 0)})`;
    }
  })(performance.now());

  return {
    enable(v) {
      if (on === v) return;
      on = v; anchor = null;
      if (!v) { const now = performance.now(); live.forEach(p => { if (p.kill == null) p.kill = now; }); }
    },
    // debug: as if the cursor moved to (x, y)
    test: move,
  };
};

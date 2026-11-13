// 3D cylinder carousel (James' red mock): photos wrap around a cylinder that spins slowly
// about its own axis; the whole cylinder is tilted on screen so the front reads as a
// diagonal band, and leaned so the far side shows too. Each photo is CURVED: it's cut into
// thin vertical strips, each sitting on the cylinder surface. Pure CSS 3D (preserve-3d).
// Same API as HaloGallery, so main.js can swap between them.
window.HaloCarousel = function (stage, C) {
  const G = C.gallery, K = G.carousel;
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;visibility:hidden;';
  const cam = document.createElement('div');   // perspective origin = band centre
  cam.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;';
  const ring = document.createElement('div');
  ring.style.cssText = 'position:absolute;left:0;top:0;transform-style:preserve-3d;will-change:transform;';
  cam.appendChild(ring); root.appendChild(cam); stage.appendChild(root);

  const files = Array.from({ length: G.images }, (_, i) => `assets/gallery/${String(i + 1).padStart(2, '0')}.jpg`);
  const step = 360 / K.count, n = K.strips;
  const panels = Array.from({ length: K.count }, (_, i) => {
    const src = files[i % files.length];
    const strips = Array.from({ length: n }, () => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;background-image:url("${src}");background-repeat:no-repeat;`;
      ring.appendChild(el);
      return el;
    });
    const img = new Image(); img.src = src;
    const p = { strips, aspect: 1.5 };
    p.ready = img.decode().then(() => { p.aspect = img.naturalWidth / img.naturalHeight; }).catch(() => {});
    return p;
  });

  let R = 0;
  function layout() {
    const W = innerWidth, H = innerHeight, s = Math.min(W / 1920, H / 1080);
    const [pw, ph] = K.panel.map(v => v * s), gap = K.gap * s;
    R = K.count * (pw + gap) / (2 * Math.PI);           // photos + gaps wrap the full circumference
    const arc = pw / R * 180 / Math.PI, sa = arc / n;   // photo + strip angle (deg)
    const sw = 2 * R * Math.sin(sa / 2 * Math.PI / 180) + 1;   // strip chord (+1px hides seams)
    cam.style.left = `${W / 2 + (K.center[0] - 960) * s}px`;
    cam.style.top = `${H / 2 + (K.center[1] - 540) * s}px`;
    cam.style.perspective = `${K.perspective * s}px`;
    panels.forEach((p, i) => {
      // cover-fit the photo over the whole curved panel, each strip shows its slice
      const bw = Math.max(pw, ph * p.aspect), bh = bw / p.aspect, ox = (bw - pw) / 2, oy = (bh - ph) / 2;
      p.strips.forEach((el, j) => {
        Object.assign(el.style, { width: `${sw}px`, height: `${ph}px`, left: `${-sw / 2}px`, top: `${-ph / 2}px`,
          backgroundSize: `${bw}px ${bh}px`, backgroundPosition: `${-(ox + j * pw / n)}px ${-oy}px`,
          transform: `rotateY(${i * step + (j - (n - 1) / 2) * sa}deg) translateZ(${R}px)` });
      });
    });
  }
  const ready = Promise.all(panels.map(p => p.ready)).then(layout);
  layout();
  addEventListener('resize', layout);

  return {
    setFocal() {}, setKeepOut() {},
    whenReady: ready,
    // gt: seconds since the gallery started; show: false = not drawn
    update(gt, show = gt >= 0) {
      root.style.visibility = show ? 'visible' : 'hidden';
      if (!show) return;
      // pull the cylinder back by its radius so the front photos sit at true size
      const a = -K.speed * gt;
      ring.style.transform = `translateZ(${-R}px) rotateZ(${K.tilt}deg) rotateX(${K.lean}deg) rotateY(${a}deg)`;
      // photos fade from full at the front to K.back at the far side of the cylinder
      panels.forEach((p, i) => {
        const f = Math.cos((i * step + a) * Math.PI / 180);
        const o = Math.min(Math.max((f - K.fade[0]) / (K.fade[1] - K.fade[0]), 0), 1);
        const v = K.back + (1 - K.back) * o * o * (3 - 2 * o);
        if (v !== p.o) { p.o = v; for (const el of p.strips) el.style.opacity = v; }
      });
    },
  };
};

// Footer entrance, in the same vocabulary as the kit section (masks, skewed headline, overshoot pop). Plays once when
// the footer's top passes revealAt down the screen. Sets each piece's --d (delay, s) and adds .in; CSS does the motion.
//   0.00 headline rises with a skew that settles     0.12 subtitle lines     0.32 "Get in touch" rises in
//   0.35 giant Halo letters rise out of the bottom one by one, left to right (H, a, l, o)
//   0.55 link columns slide up line by line          0.85 sign-up lines, 1.0 underline draws across, placeholder fades,
//   1.25 arrow button pops with an overshoot          1.1 legal links rise in
(() => {
  const sec = document.getElementById('footer');
  if (!sec) return;
  const K = { revealAt: 0.75, lineStep: 0.06 };
  const set = (el, d) => el && el.style.setProperty('--d', `${d.toFixed(3)}s`);
  const q = s => [...sec.querySelectorAll(s)];
  set(q('.ft-h .km > span')[0], 0);
  q('.ft-sub .km > span').forEach((el, i) => set(el, 0.12 + i * K.lineStep));
  set(sec.querySelector('.ft-cta'), 0.32);
  // logo paths are H, a, l, o in the SVG's order
  q('.ft-logo path').forEach((p, i) => set(p, 0.35 + i * 0.1));
  q('.ft-links .km > a').forEach((el, i) => set(el, 0.55 + i * 0.05));
  q('.ft-sign-t .km > span').forEach((el, i) => set(el, 0.85 + i * K.lineStep));
  set(sec.querySelector('.ft-rule'), 1.0);
  set(sec.querySelector('.ft-email input'), 1.2);
  set(sec.querySelector('.ft-go'), 1.25);
  set(sec.querySelector('.ft-legal'), 1.1);

  // HOVER GLOW: a big soft lime light inside the giant Halo letters (clipped to them in the SVG), following the
  // cursor with a little lag; fades in while the cursor is over the logo, out when it leaves
  const G = { radius: 22, ease: 7, fadeIn: 0.45, fadeOut: 0.8 };   // radius in logo units (logo is 80 wide); ease per s
  const logo = sec.querySelector('.ft-logo'), glow = sec.querySelector('.ft-glow');
  let gx = 40, gy = 17, tx = 40, ty = 17, over = false, raf = 0, last = 0;
  glow.setAttribute('r', G.radius);
  glow.style.transition = `opacity ${G.fadeOut}s ease`;
  glow.style.opacity = 0;
  function follow(now) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    const k = 1 - Math.exp(-G.ease * dt);
    gx += (tx - gx) * k; gy += (ty - gy) * k;
    glow.setAttribute('cx', gx.toFixed(2)); glow.setAttribute('cy', gy.toFixed(2));
    raf = (over || Math.abs(tx - gx) + Math.abs(ty - gy) > 0.05) ? requestAnimationFrame(follow) : 0;
    if (!raf) last = 0;
  }
  addEventListener('pointermove', e => {
    const r = logo.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside) {
      tx = (e.clientX - r.left) / r.width * 80; ty = (e.clientY - r.top) / r.height * 34;
      if (!over) { if (glow.style.opacity === '0' || glow.style.opacity === '') { gx = tx; gy = ty; } glow.style.transition = `opacity ${G.fadeIn}s ease`; }
    } else if (over) glow.style.transition = `opacity ${G.fadeOut}s ease`;
    if (inside !== over) { over = inside; glow.style.opacity = inside ? 1 : 0; }
    if (over && !raf) raf = requestAnimationFrame(follow);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { over = false; glow.style.opacity = 0; });

  let played = false;
  const play = () => { played = true; sec.classList.add('in'); };
  // with a pixel background reveal (bgpixels.js) the content waits until the dark pixels have covered the cream
  if (sec.hasAttribute('data-bg-pixels')) {
    sec.addEventListener('bgpixels:covered', () => { if (!played) play(); });
    window.haloFooter = { K, G, play, reset: () => { played = false; sec.classList.remove('in'); } };
    return;
  }
  function check() { if (!played && sec.getBoundingClientRect().top / innerHeight < K.revealAt) play(); }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloFooter = { K, G, play,
    glowAt: (x, y) => { tx = gx = x; ty = gy = y; over = true; glow.style.opacity = 1; glow.setAttribute('cx', x); glow.setAttribute('cy', y); },   // debug, logo units
    reset: () => { played = false; sec.classList.remove('in'); } };
})();

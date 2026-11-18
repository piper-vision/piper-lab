// Smooth scroll (wheel / trackpad): the page eases towards the scroll target instead of jumping.
// Native scrolling is kept for touch, keyboard and the find bar; the target re-syncs after those,
// so nothing fights. Everything that reads scrollY (bar widening, word fade, reveals) just sees a
// smoother scrollY.
(() => {
  // Macs: native scrolling (James): macOS trackpad / Magic Mouse scrolling is already smooth, and this JS easing ran at
  // ~25 fps in Safari. On by default everywhere else (Windows wheels step in jumps). ?smooth=1 forces it on, ?smooth=0
  // off, in any browser, for comparing.
  const q = new URLSearchParams(location.search).get('smooth');
  const mac = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
  if (q === '0' || (mac && q !== '1')) return;
  const K = {
    ease: 0.1,       // share of the remaining distance covered per 60 fps frame (lower = smoother, floatier)
    wheel: 1,        // wheel distance multiplier
  };
  const root = document.documentElement;
  const max = () => root.scrollHeight - innerHeight;
  let target = scrollY, pos = scrollY, running = false, ours = false, last = 0;

  function tick(now) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    const k = 1 - Math.pow(1 - K.ease, dt * 60);   // frame-rate independent
    pos += (target - pos) * k;
    if (Math.abs(target - pos) < 0.5) pos = target;
    ours = true;
    scrollTo(0, pos);
    if (pos !== target) requestAnimationFrame(tick);
    else { running = false; last = 0; }
  }

  addEventListener('wheel', e => {
    if (e.ctrlKey) return;                                              // pinch zoom
    const menu = document.getElementById('menu');
    if (menu && getComputedStyle(menu).display !== 'none') return;     // full-screen menu open: leave it alone
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (!running) pos = scrollY;
    target = Math.min(Math.max(target + d * K.wheel, 0), max());
    if (window.haloSmooth.limit) target = window.haloSmooth.limit(target);   // e.g. a carousel allowing one step per swipe
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: false });

  // keyboard / touch / scrollTo from elsewhere: follow it
  addEventListener('scroll', () => {
    if (ours) { ours = false; return; }
    if (!running) target = pos = scrollY;
  }, { passive: true });
  addEventListener('resize', () => { target = Math.min(target, max()); });

  window.haloSmooth = { K, get target() { return target; }, to: y => { target = Math.min(Math.max(y, 0), max()); if (!running) { pos = scrollY; running = true; requestAnimationFrame(tick); } } };
})();

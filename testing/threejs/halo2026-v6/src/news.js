// News & Views (mock assets/ref-news.webp)
// - entrance (once, when the section's top passes revealAt): heading rises with the skew, "View all" rises, the cards
//   slide in from the right one after another (like the "Four ways" cards)
// - the card row scrolls sideways: trackpad / shift-wheel natively, and DRAG with the mouse (with a little momentum).
//   A drag never opens a card; a plain click does.
(() => {
  const sec = document.getElementById('news');
  if (!sec) return;
  const track = sec.querySelector('.nw-track');
  const K = { revealAt: 0.75, stagger: 0.09, friction: 0.92 };
  sec.querySelectorAll('.nw-card').forEach((c, i) => c.style.setProperty('--d', `${(0.15 + i * K.stagger).toFixed(2)}s`));
  let played = false;
  // the row only becomes scrollable (.live) once the last card has landed: while the cards are still off to the right
  // they stretch the scroll area, and a stray sideways trackpad nudge + scroll-snap fought the slide-in (James: cards
  // "hitting a brick wall" when the cursor was over them)
  const cards = sec.querySelectorAll('.nw-card').length;
  const settle = (0.15 + (cards - 1) * K.stagger + 1.5) * 1000;
  const play = () => { played = true; sec.classList.add('in'); track.scrollLeft = 0; setTimeout(() => track.classList.add('live'), settle); };
  function check() { if (!played && sec.getBoundingClientRect().top / innerHeight < K.revealAt) play(); }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();

  // drag to scroll (mouse only; touch scrolls natively)
  let down = false, moved = false, x0 = 0, s0 = 0, lastX = 0, lastT = 0, v = 0, raf = 0;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !track.classList.contains('live')) return;
    down = true; moved = false; x0 = lastX = e.clientX; s0 = track.scrollLeft; lastT = performance.now(); v = 0;
    cancelAnimationFrame(raf);
  });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('dragging'); }
    if (moved) {
      track.scrollLeft = s0 - dx;
      const now = performance.now(); v = (lastX - e.clientX) / Math.max(1, now - lastT) * 16; lastX = e.clientX; lastT = now;
    }
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    if (moved) {
      // glide on a little, then let the snap settle it
      (function glide() { if (Math.abs(v) < 0.5) { track.classList.remove('dragging'); return; } track.scrollLeft += v; v *= K.friction; raf = requestAnimationFrame(glide); })();
    }
  });
  // a drag shouldn't count as a click on the card underneath
  track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  track.addEventListener('dragstart', e => e.preventDefault());
  window.haloNews = { K, play, reset: () => { played = false; sec.classList.remove('in'); track.classList.remove('live'); } };
})();

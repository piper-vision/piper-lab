// Sticky header pieces (Halo logo, Contact us pill) flip to light while they sit over a dark area, so they never go
// dark-on-dark. Dark areas are marked with data-dark (the black Kit card, the footer). Per piece: it flips when its
// centre is over a dark area. (A CSS mix-blend-mode: difference would also flip them, but it turns them blue over the
// lime bars at the top of the page, so this checks the areas instead.)
(() => {
  const SEL = ['#chrome .logo', '#chrome .topcta'];
  let queued = false;
  function update() {
    queued = false;
    const zones = [...document.querySelectorAll('[data-dark]')].map(z => z.getBoundingClientRect());
    for (const sel of SEL) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dark = zones.some(z => cx >= z.left && cx <= z.right && cy >= z.top && cy <= z.bottom);
      el.classList.toggle('on-dark', dark);
    }
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  setInterval(queue, 500);   // also catches the header being rebuilt (layout switches) and late layout
  queue();
})();

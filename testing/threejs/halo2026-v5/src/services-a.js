// Homepage services: Option A / Option B switch (James), fixed bottom left.
// - A = the original "Four ways we create space" four cream cards (#services-a): cards slide in from the right once
//   the section's top passes 80% down the screen, and the photos drift inside their frames (parallax)
// - B = the card carousel (#services, src/services-m.js)
// A is the default; the choice is remembered in this browser.
(() => {
  const A = document.getElementById('services-a'), B = document.getElementById('services');
  if (!A || !B) return;

  // ---- the switch ------------------------------------------------------------------------------------------------
  const sw = document.createElement('div');
  sw.className = 'opt-switch';
  sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Services section layout');
  sw.innerHTML = '<button type="button" data-o="a">Option A</button><button type="button" data-o="b">Option B</button>';
  document.body.appendChild(sw);
  let cur = 'a';
  try { if (localStorage.getItem('haloSvcOpt') === 'b') cur = 'b'; } catch (e) {}
  function show(o) {
    cur = o;
    A.hidden = o !== 'a'; B.hidden = o !== 'b';
    sw.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.o === o)));
    try { localStorage.setItem('haloSvcOpt', o); } catch (e) {}
    dispatchEvent(new Event('resize'));   // page height changed: let everything re-measure
    check();
  }
  sw.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.o !== cur) show(b.dataset.o); });

  // ---- option A: slide in + photo parallax ---------------------------------------------------------------------------
  const cards = [...A.querySelectorAll('.sv-card')], imgs = [...A.querySelectorAll('.sv-img img')];
  cards.forEach((c, i) => c.style.setProperty('--d', `${(i * 0.09).toFixed(2)}s`));
  function check() {
    if (A.hidden) return;
    if (!A.classList.contains('in') && A.getBoundingClientRect().top < innerHeight * 0.8) A.classList.add('in');
    imgs.forEach(img => {   // p: frame centre -1 (top of screen) .. +1 (bottom); the photo shifts -p * 12% of its height
      const r = img.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const p = ((r.top + r.height / 2) / innerHeight) * 2 - 1;
      img.style.transform = `translateY(${(-p * 12 * img.offsetHeight / 100).toFixed(1)}px)`;
    });
  }
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } }, { passive: true });
  show(cur);
})();

// Homepage services: Option A-E switch (James), fixed bottom left.
// - A = the original "Four ways we create space" four cream cards (#services-a): cards slide in from the right once
//   the section's top passes 80% down the screen, and the photos drift inside their frames (parallax)
// - B = the card carousel (#services, src/services-m.js)
// - C, D, E = stacked deck, full-bleed, rail (#svc-c, #svc-d, #svc-e, src/services-x.js)
// A is the default; the choice is remembered in this browser.
(() => {
  const A = document.getElementById('services-a'), B = document.getElementById('services');
  if (!A || !B) return;
  const SEC = { a: A, b: B, c: document.getElementById('svc-c'), d: document.getElementById('svc-d'), e: document.getElementById('svc-e') };
  Object.keys(SEC).forEach(k => { if (!SEC[k]) delete SEC[k]; });

  // ---- the switch ------------------------------------------------------------------------------------------------
  const sw = document.createElement('div');
  sw.className = 'opt-switch';
  sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Services section layout');
  sw.innerHTML = Object.keys(SEC).map(k => '<button type="button" data-o="' + k + '" aria-label="Option ' + k.toUpperCase() + '">' + k.toUpperCase() + '</button>').join('');
  document.body.appendChild(sw);
  let cur = 'a';
  try { const v = localStorage.getItem('haloSvcOpt'); if (SEC[v]) cur = v; } catch (e) {}
  function show(o) {
    cur = o;
    Object.keys(SEC).forEach(k => { SEC[k].hidden = k !== o; });
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

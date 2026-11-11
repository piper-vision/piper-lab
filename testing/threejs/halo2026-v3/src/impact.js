// Impact & Sustainability entrance (mock assets/ref-impact.webp). Two triggers, each plays once:
//  - SECTION (its top passes headAt down the screen): heading lines rise with the settling skew, intro lines slide up,
//    "Our sustainability" rises
//  - CARD (its top passes cardAt): the UI on top of the 3D scene comes in — the headline rises (skew), then the stat
//    pills pop in one by one with an overshoot and their lime dots blink on. (Was keyed to the section top, which
//    fired while the card was still below the screen.)
// CSS in index.html does the motion (keyed to #impact.in / .im-card.in and each piece's --d).
(() => {
  const sec = document.getElementById('impact');
  if (!sec) return;
  const card = sec.querySelector('.im-card');
  const K = { headAt: 0.72, cardAt: 0.7 };
  const set = (el, d) => el && el.style.setProperty('--d', `${d.toFixed(3)}s`);
  const q = s => [...sec.querySelectorAll(s)];
  q('.im-h .km > span').forEach((el, i) => set(el, i * 0.09));
  q('.im-intro .km > span').forEach((el, i) => set(el, 0.18 + i * 0.06));
  set(sec.querySelector('.im-all'), 0.32);
  q('.im-hl .km > span').forEach((el, i) => set(el, 0.1 + i * 0.09));
  q('.im-pill').forEach((el, i) => set(el, 0.35 + i * 0.12));
  let head = false, ui = false;
  function check() {
    if (!head && sec.getBoundingClientRect().top / innerHeight < K.headAt) { head = true; sec.classList.add('in'); }
    if (!ui && card.getBoundingClientRect().top / innerHeight < K.cardAt) { ui = true; card.classList.add('in'); }
  }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloImpact = { K, reset: () => { head = ui = false; sec.classList.remove('in'); card.classList.remove('in'); }, play: () => { head = ui = true; sec.classList.add('in'); card.classList.add('in'); } };
})();

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

  let played = false;
  const play = () => { played = true; sec.classList.add('in'); };
  function check() { if (!played && sec.getBoundingClientRect().top / innerHeight < K.revealAt) play(); }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloFooter = { K, play, reset: () => { played = false; sec.classList.remove('in'); } };
})();

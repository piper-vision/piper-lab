// "Find a build-type for your needs" entrance (mock assets/ref-buildtype.webp). Once the section's top passes revealAt,
// sets each piece's --d (and each tag's float length --f) and adds .in; CSS in index.html does the motion:
//   0.00 heading lines rise with the settling skew (0.09 apart)   0.25 intro lines slide up (0.06 apart)
//   0.50 "View all" rises    0.20 the illustration wipes up and settles from a slight zoom (1.3 s)
//   1.05 the four tags pop on one by one (overshoot), then float gently, each at its own pace
(() => {
  const sec = document.getElementById('buildtype');
  if (!sec) return;
  const K = { revealAt: 0.75 };
  const set = (el, d) => el && el.style.setProperty('--d', `${d.toFixed(3)}s`);
  const q = s => [...sec.querySelectorAll(s)];
  q('.bt-h .km > span').forEach((el, i) => set(el, i * 0.09));
  q('.bt-p .km > span').forEach((el, i) => set(el, 0.25 + i * 0.06));
  set(sec.querySelector('.bt-all'), 0.5);
  set(sec.querySelector('.bt-illo'), 0.2);
  set(sec.querySelector('.bt-illo img'), 0.2);
  q('.bt-tag').forEach((el, i) => { set(el, 1.05 + i * 0.12); el.style.setProperty('--f', `${(4.2 + i * 0.7).toFixed(1)}s`); });
  let played = false;
  function check() { if (!played && sec.getBoundingClientRect().top / innerHeight < K.revealAt) { played = true; sec.classList.add('in'); } }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloBuildtype = { K, play: () => { played = true; sec.classList.add('in'); }, reset: () => { played = false; sec.classList.remove('in'); } };
})();

// "The kit & the team" entrance, modelled on the menu's "What we offer" dropdown (V2): plays once when the section
// comes into view. Sets each piece's --d (delay, s) and adds .in to #kit; the CSS in index.html does the motion.
// Timeline:
//   0.00  headline lines rise with a skew that settles (0.09 apart)
//   0.18  intro lines slide up (0.06 apart), then the "View all build types" pill
//   0.30  Kit card clip-wipes in from the right (0.8 s); 0.45 Team card does the same
//   0.65  Kit card: badge ring draws round, label/title/paragraph lines slide up, button; logo slaps on at ~1.15
//   0.65  the 3D build starts with the card's title (kit3d.js waits for 'reveal:done' on the card)
//   0.90  Team card: photo unmasks upwards + settles from its zoom, then its text lines and button
(() => {
  const sec = document.getElementById('kit');
  if (!sec) return;
  const K = { revealAt: 0.72, lineStep: 0.06 };
  const set = (el, d) => el && el.style.setProperty('--d', `${d.toFixed(3)}s`);
  const lines = (root, sel, d0, step = K.lineStep) => { let d = d0; root.querySelectorAll(sel).forEach(m => { set(m.firstElementChild, d); d += step; }); return d; };

  lines(sec, '.kt-h .km', 0, 0.09);
  const afterIntro = lines(sec, '.kt-intro .km', 0.18);
  set(sec.querySelector('.kt-all'), afterIntro + 0.04);

  const kit = sec.querySelector('.kt-kit'), team = sec.querySelector('.kt-team');
  set(kit, 0.3);
  set(team, 0.45);
  set(kit.querySelector('.kt-ring rect'), 0.65);
  set(kit.querySelector('.kt-badge img'), 1.15);
  let d = lines(kit, '.km', 0.65);
  set(kit.querySelector('.kt-btn'), d + 0.04);
  set(team.querySelector('.kt-img'), 0.9);
  set(team.querySelector('.kt-img img'), 0.9);
  d = lines(team, '.km', 1.25);
  set(team.querySelector('.kt-btn'), d + 0.04);

  let played = false;
  function play() {
    played = true;
    sec.classList.add('in');
    // the 3D build starts with the card's title lines (James: was 1.1 s, once the card had finished wiping in)
    setTimeout(() => kit.dispatchEvent(new CustomEvent('reveal:done')), 650);
  }
  function check() { if (!played && sec.getBoundingClientRect().top / innerHeight < K.revealAt) play(); }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloKit = { K, play, reset: () => { played = false; sec.classList.remove('in'); } };
})();

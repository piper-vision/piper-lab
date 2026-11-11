// "Four ways we create space" (James' mock assets/ref-services.webp)
// - the four cards slide in from the right, one after another, once the section comes into view
// - each photo is 24% taller than its frame and drifts inside it as the page scrolls (parallax)
(() => {
  const sec = document.getElementById('services');
  if (!sec) return;
  const K = {
    revealAt: 0.8,     // cards come in when the section's top passes this far down the screen (0 top .. 1 bottom)
    stagger: 0.09,     // between cards (s)
    drift: 0.12,       // parallax travel each way, as a share of the photo's height (img CSS is 124% tall, -12% top)
  };
  const cards = [...sec.querySelectorAll('.sv-card')];
  // the stagger (--d, used in the CSS transition) only delays the slide-in (transform); the hover scale is immediate
  cards.forEach((c, i) => { c.style.setProperty('--d', `${i * K.stagger}s`); });
  const imgs = [...sec.querySelectorAll('.sv-img img')];

  let queued = false;
  function update() {
    queued = false;
    const vh = innerHeight;
    if (sec.getBoundingClientRect().top / vh < K.revealAt) sec.classList.add('in');
    for (const img of imgs) {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < -vh * 0.2 || box.top > vh * 1.2) continue;
      // -1 when the frame's centre is at the top of the screen, +1 at the bottom
      const p = Math.min(Math.max((box.top + box.height / 2 - vh / 2) / (vh / 2), -1), 1);
      img.style.transform = `translate3d(0, ${-p * K.drift * img.offsetHeight}px, 0)`;
    }
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
  window.haloServices = { update, K };
})();

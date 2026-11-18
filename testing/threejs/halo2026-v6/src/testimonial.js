// Testimonial entrance (James' mock assets/ref-testimonial.webp). The lime background pixels in over the cream
// (bgpixels.js); a moment after the sweep starts, everything else comes in (CSS in index.html, keyed to .in + --d):
//   0.00 the first project's dotted connector carries on drawing down out of the projects section (1 s)
//   0.95 its dot pops (overshoot)                     1.00 the quote mark slaps on (overshoot)
//   0.70 quote lines rise with the settling skew, 0.09 apart       1.15 the attribution rises
(() => {
  const sec = document.getElementById('testimonial');
  if (!sec) return;
  const K = { afterPixels: 0.15, line: 0, dot: 0.95, mark: 1.0, quote: 0.7, quoteStep: 0.09, by: 1.15 };
  const set = (el, d) => el && el.style.setProperty('--d', `${d.toFixed(3)}s`);
  set(sec.querySelector('.tm-line'), K.line);
  set(sec.querySelector('.tm-dot'), K.dot);
  set(sec.querySelector('.tm-mark'), K.mark);
  sec.querySelectorAll('.tm-q p .km > span').forEach((el, i) => set(el, K.quote + i * K.quoteStep));
  set(sec.querySelector('.tm-by .km > span'), K.by);

  let played = false;
  const play = () => { played = true; sec.classList.add('in'); };
  sec.addEventListener('bgpixels:start', () => setTimeout(() => { if (!played) play(); }, K.afterPixels * 1000));
  window.haloTestimonial = { K, play, reset: () => { played = false; sec.classList.remove('in'); } };
})();

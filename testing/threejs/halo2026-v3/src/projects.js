// "Every build raises the bar" — entrance choreography (James' mock assets/ref-projects.webp)
// Once the section comes into view, column by column (left to right):
//  1. the photo unrolls from the top. Every photo unrolls at the SAME SPEED, so the taller ones take longer and the
//     three bottoms land one after another, drawing the staircase; the photo settles from a slight zoom as it opens
//  2. its tag slides on
//  3. title + subtitle rise out of their masks as the photo finishes
//  4. the dotted connector draws down, the dot pops at its end
//  5. "Impact report" and the stat lines rise, the numbers counting up from 0
(() => {
  const sec = document.getElementById('projects');
  if (!sec) return;
  const K = {
    revealAt: 0.7,     // starts when the section's top passes this far down the screen (0 top .. 1 bottom)
    colStagger: 0.16,  // between columns (s)
    speed: 480,        // photo unroll speed, design px per second (heights 401 / 469 / 536 -> 0.84 / 0.98 / 1.12 s)
    textAt: 0.8,       // title starts this share of the way through its photo's unroll
    lineStagger: 0.07, // between text lines (s)
    lineDraw: 0.7,     // connector draw time (s; matches the CSS)
    count: 1.3,        // number count-up time (s)
  };
  const cols = [...sec.querySelectorAll('.pj-col')];
  const counters = [];
  const delay = (el, s) => { el.style.transitionDelay = `${s.toFixed(3)}s`; };
  cols.forEach((col, i) => {
    const h = parseFloat(getComputedStyle(col).getPropertyValue('--h')) || 400;
    const d = i * K.colStagger, dur = h / K.speed;
    const frame = col.querySelector('.pj-frame');
    frame.style.setProperty('--dur', `${dur.toFixed(3)}s`);
    delay(frame, d);
    delay(col.querySelector('.pj-tag'), d + dur * 0.55);
    let t = d + dur * K.textAt;
    for (const m of col.querySelectorAll('.pj-t .pj-m, .pj-s .pj-m')) { delay(m, t); t += K.lineStagger; }
    const lineAt = t + 0.1;
    delay(col.querySelector('.pj-line'), lineAt);
    delay(col.querySelector('.pj-dot'), lineAt + K.lineDraw - 0.08);
    t = lineAt + K.lineDraw + 0.05;
    for (const m of col.querySelectorAll('.pj-label .pj-m, .pj-stat .pj-m')) {
      delay(m, t);
      m.querySelectorAll('b[data-count]').forEach(b => counters.push({ b, to: +b.dataset.count, at: t + 0.15 }));
      t += K.lineStagger;
    }
  });
  // numbers start at 0 so they can count up
  counters.forEach(c => { c.b.textContent = '0'; });

  let started = false;
  function play() {
    started = true;
    sec.classList.add('in');
    const t0 = performance.now();
    const easeOut = u => 1 - Math.pow(1 - u, 3);
    (function tick(now) {
      let busy = false;
      for (const c of counters) {
        const u = Math.min(Math.max(((now - t0) / 1000 - c.at) / K.count, 0), 1);
        const v = String(Math.round(c.to * easeOut(u)));
        if (c.b.textContent !== v) c.b.textContent = v;
        if (u < 1) busy = true;
      }
      if (busy) requestAnimationFrame(tick);
    })(t0);
  }
  function check() { if (!started && sec.getBoundingClientRect().top / innerHeight < K.revealAt) play(); }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
  window.haloProjects = { K, play, reset: () => { started = false; sec.classList.remove('in'); counters.forEach(c => { c.b.textContent = '0'; }); } };
})();

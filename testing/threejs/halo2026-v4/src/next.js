// "What we build" section (James' mock assets/ref-next-1.webp).
// - Right: the three paragraphs are split into words that go from light grey to near-black one by one
//   as the section scrolls up (scrubbed with the scroll, so scrolling back un-fades them).
// - Left: heading + intro lines slide up out of their masks when the section comes into view.
(() => {
  const sec = document.getElementById('next');
  if (!sec) return;
  const K = {
    start: 0.8,    // fade starts when the section top is this far down the screen (0 = top, 1 = bottom)
    end: 0.1,      // .. and every word is dark when the section top reaches here
    soft: 4,       // how many words are part-way through their fade at once (higher = softer front)
    from: [227, 221, 205],   // ~12% ink on the cream (James: fainter start); the mock's grey was ~30%: [177, 176, 172]
    to: [25, 25, 25],        // #191919
    revealAt: 0.65,          // left column reveals when the section top passes this far down the screen
    stagger: 0.07,           // between the left column's lines (s)
  };

  // split the paragraphs into word spans (keeps the spaces as text so wrapping is unchanged)
  const words = [];
  sec.querySelectorAll('.nx-words p').forEach(p => {
    const parts = p.textContent.split(/(\s+)/);
    p.textContent = '';
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { p.appendChild(document.createTextNode(part)); continue; }
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = part;
      p.appendChild(s);
      words.push(s);
    }
  });

  // left-column text blocks ("What we build", "Trusted to build for"): stagger the line slides;
  // each reveals once its own top passes revealAt down the screen
  const lefts = [...sec.querySelectorAll('.nx-left')];
  lefts.forEach(b => b.querySelectorAll('.m > span').forEach((el, i) => { el.style.transitionDelay = `${i * K.stagger}s`; }));

  const mix = k => `rgb(${K.from.map((v, i) => Math.round(v + (K.to[i] - v) * k)).join(',')})`;
  const last = new Array(words.length).fill(-1);
  let queued = false;
  function update() {
    queued = false;
    const r = sec.getBoundingClientRect().top / innerHeight;
    const p = Math.min(Math.max((K.start - r) / (K.start - K.end), 0), 1);
    const n = words.length, f = p * (n + K.soft);
    for (let i = 0; i < n; i++) {
      const k = Math.round(Math.min(Math.max((f - i) / K.soft, 0), 1) * 100) / 100;
      if (k !== last[i]) { last[i] = k; words[i].style.color = mix(k); }
    }
    for (const b of lefts) if (b.getBoundingClientRect().top / innerHeight < K.revealAt + 0.2) b.classList.add('in');
    // full-width images (under the logo strip, under the kit cards): internal parallax, like the service cards
    // (photo is 124% of its frame)
    for (const wide of wides) {
      const box = wide.parentElement.getBoundingClientRect(), vh = innerHeight;
      if (box.bottom > -vh * 0.2 && box.top < vh * 1.2) {
        const q = Math.min(Math.max((box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2), -1), 1);
        // measured against the FRAME: the photo overhangs it by 12% top and bottom, so drift stays inside that
        wide.style.transform = `translate3d(0, ${(-q * K.wideDrift * box.height).toFixed(1)}px, 0)`;
      }
    }
  }
  const wides = [...document.querySelectorAll('.nx-wide img')];   // every full-width image on the page
  K.wideDrift = 0.115;  // share of the frame's height the photo travels each way (overhang is 0.12, so no edge ever shows)
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
  window.haloNext = { update, K };
})();

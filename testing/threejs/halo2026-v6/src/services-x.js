// Homepage services Options C, D, E (James: the client's picks from services.html), ported from that page's script:
// - C (#svc-c) = services.html D "Stacked deck": each card slides up over the last, which sinks back and dims; numbered index left
// - D (#svc-d) = services.html B "Full-bleed": each service fills the screen; story-style segments up top are the links
// - E (#svc-e) = services.html C "Rail": big cards side by side glide sideways as you scroll; tabs underneath
// Each section is a tall track (.svx-track) whose .svx-pin sticks while you scroll through it; progress 0..1 -> service 0..3.
// Shown / hidden by the option switch (src/services-a.js); hidden ones are skipped.
(() => {
  const C = document.getElementById('svc-c'), D = document.getElementById('svc-d'), E = document.getElementById('svc-e');
  if (!C || !D || !E) return;
  const S = [
    { t: 'Outdoor Structures', p: 'Elegant, engineered, demountable structures for sport, hospitality and brand events.', f: 'Featured: Wimbledon', c: '#9ECDEB', img: 'assets/services/hires/outdoor.jpg' },
    { t: 'Indoor Structures', p: 'Raised platforms, exhibition systems and structural builds that transform interior environments.', f: 'Featured: Project', c: '#FF9D00', img: 'assets/services/hires/indoor.jpg' },
    { t: 'Semi-permanent & meanwhile use', p: 'Spaces built to stay a season or a few years, bringing underused sites to life.', f: 'Featured: Wimbledon', c: '#B19070', img: 'assets/services/hires/semi-permanent.jpg' },
    { t: 'Bespoke applications', p: 'Beyond the usual? We adapt our modular thinking to meet unconventional needs.', f: 'Featured: Wimbledon', c: '#CC89E4', img: 'assets/services/hires/bespoke.jpg' },
  ];
  const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13.5M11 4.5l5.5 5.5-5.5 5.5"/></svg>';
  const n2 = i => String(i + 1).padStart(2, '0');
  const lines = (text, d0 = 0) => `<span class="mask" style="--d:${d0}s"><span>${text}</span></span>`;
  const $ = (s, r) => r.querySelector(s);
  // D's big title always on two lines (James): break before ' & ', otherwise after the first word
  // C: each card sits PEEK design px lower (so shorter) than the one before, so the cards behind show a strip above it (James)
  const PEEK = 30;
  // C: the track holds 3.15 slots, not 4: the last card lands near the end, so you scroll on almost at once (James: too many
  // scrolls to get past the last card). Each slot keeps the same length (the track is 3.15 x 105vh + 100vh tall, in the CSS)
  const C_SLOTS = 3.15;
  // E: one swipe = one card (James). The track holds 3 slots: card k sits at k/3 of the way through; a wheel gesture glides
  // to the next / previous card (STEP_MS, ease in-out) and the rest of that gesture is ignored. Past the first / last card
  // the page scrolls on as normal. Touch / keys / scrollbar still scrub the rail directly.
  const E_SLOTS = 3, STEP_MS = 730, GESTURE = 180;   // 730: 50% faster than 1100 (James)
  const two = t => t.includes(' & ') ? [t.split(' & ')[0], '&amp; ' + t.split(' & ')[1]] : [t.slice(0, t.indexOf(' ')), t.slice(t.indexOf(' ') + 1)];
  const card = (s, i) => `<div class="c-text"><span class="n"><span class="dot" style="--c:${s.c}"></span>${n2(i)} / 04</span><h3>${s.t.replace(' & ', '<br>& ')}</h3><p>${s.p}</p><span class="feat">${s.f}</span>
    <a class="go" href="#" style="--c:${s.c}" aria-label="${s.t}">${arrow}</a></div>`;

  // ---- build ------------------------------------------------------------------------------------------------------
  // C: stacked deck
  $('.d-list', C).innerHTML = S.map((s, i) => `<li><a href="#" data-i="${i}"><small>${n2(i)}</small>${s.t}<span class="dot" style="--c:${s.c}"></span></a></li>`).join('');
  $('.d-deck', C).innerHTML = S.map((s, i) => `<article class="d-card" data-i="${i}" style="z-index:${i + 1}; top:calc(${i * PEEK} * var(--u))"><figure><img src="${s.img}" alt="" loading="lazy"></figure>${card(s, i)}<span class="shade" style="background:${s.c}"></span></article>`).join('');
  // D: full-bleed
  $('.b-bg', D).innerHTML = S.map((s, i) => `<figure data-i="${i}"><img src="${s.img}" alt="" loading="lazy"></figure>`).join('');
  $('.b-tabs', D).innerHTML = S.map((s, i) => `<a href="#" data-i="${i}"><span class="seg"><i></i></span>${n2(i)}&nbsp;&nbsp;${s.t}</a>`).join('');
  $('.b-copy', D).innerHTML = S.map((s, i) => `<div data-i="${i}"><div><div class="b-num">${lines(`<span class="dot" style="--c:${s.c}"></span>&nbsp;${n2(i)} / 04`)}</div><h3 class="b-title">${two(s.t).map((l, k) => lines(l, 0.06 + k * 0.08)).join('')}</h3></div>
    <div class="b-side">${lines(`<p>${s.p}</p>`, 0.15)}${lines(`<a class="pill" href="#">View project ${arrow}</a>`, 0.22)}</div></div>`).join('');
  // E: rail
  $('.c-rail', E).innerHTML = S.map((s, i) => `<article class="c-panel" data-i="${i}"><figure><img src="${s.img}" alt="" loading="lazy"></figure>${card(s, i)}</article>`).join('');
  $('.c-tabs', E).insertAdjacentHTML('beforeend', S.map((s, i) => `<a href="#" data-i="${i}"><span class="dot" style="--c:${s.c}"></span>${s.t}</a>`).join(''));

  // ---- scroll -> active service + per-option motion -------------------------------------------------------------------
  const tracks = [['c', C], ['d', D], ['e', E]].map(([id, sec]) => ({ id, sec, el: $('.svx-track', sec), active: -1 }));
  const prog = tk => { const r = tk.el.getBoundingClientRect(); return Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 1); };
  const ease = x => 1 - Math.pow(1 - x, 3);
  const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function setActive(tk, i) {
    if (i === tk.active) return;
    const prev = tk.active; tk.active = i;
    tk.el.querySelectorAll('[data-i]').forEach(el => { const k = +el.dataset.i; el.classList.toggle('on', k === i); el.classList.toggle('was', k === prev && k !== i); });
    if (tk.id === 'd') $('.svx-pin', tk.el).style.setProperty('--bgc', S[i].c);
    if (tk.id === 'e') { const t = $(`.c-tabs a[data-i="${i}"]`, tk.el), line = $('.c-line', tk.el); line.style.width = t.offsetWidth + 'px'; line.style.transform = `translateX(${t.offsetLeft}px)`; }
  }
  function frame() {
    for (const tk of tracks) {
      if (tk.sec.hidden) { tk.active = -1; continue; }
      const r = tk.el.getBoundingClientRect();
      if (r.bottom < -innerHeight || r.top > innerHeight * 2) continue;   // well off screen
      const p = prog(tk), f = p * (tk.id === 'c' ? C_SLOTS : tk.id === 'e' ? E_SLOTS : 4), i = Math.min(3, tk.id === 'e' ? Math.round(f) : Math.floor(f)), local = f - i;
      setActive(tk, i);
      if (tk.id === 'd') tk.el.querySelectorAll('.seg i').forEach(b => { const k = +b.closest('[data-i]').dataset.i; b.style.setProperty('--p', k < i ? 1 : k > i ? 0 : Math.min(local * 1.1, 1)); });
      if (tk.id === 'e') {   // the rail follows the scroll 1:1 (the easing is in the step's scroll glide, below)
        const panels = tk.el.querySelectorAll('.c-panel'), step = panels[1].offsetLeft - panels[0].offsetLeft, rail = $('.c-rail', tk.el);
        const pos = Math.min(f, 3);
        rail.style.transform = `translateX(${-pos * step + (innerWidth - panels[0].offsetWidth) / 2 - parseFloat(getComputedStyle(rail).paddingLeft)}px)`;
        panels.forEach((pn, j) => { const dist = Math.abs(j - pos); pn.style.opacity = 1 - Math.min(dist, 1) * 0.55; pn.style.setProperty('--s', 1 + Math.min(dist, 1) * 0.1); });
      }
      if (tk.id === 'c') {   // card j slides up over j-1 across most of the previous slot (ease in-out, James: slower); the ones underneath sink back and dim
        const cards = [...tk.el.querySelectorAll('.d-card')];
        const ent = cards.map((cd, j) => j === 0 ? 1 : easeIO(Math.min(Math.max((f - (j - 1) - 0.12) / 0.86, 0), 1)));
        cards.forEach((cd, j) => {
          const sink = ent.slice(j + 1).reduce((a, b) => a + b, 0);   // no cap: every card down the stack steps the same (a 1.5 cap left the back two the same size)
          cd.style.transform = `translateY(${(1 - ent[j]) * 105}%) scale(${1 - sink * 0.03})`;
          $('.shade', cd).style.opacity = Math.min(sink, 1);   // as the next card covers it, the whole card turns its service colour (its button colour, James)
        });
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- links: jump to a service (the start of its slot) -------------------------------------------------------------
  const goTo = y => {
    if (window.haloSmooth && haloSmooth.to) return haloSmooth.to(y);
    const from = scrollY, d = y - from, t0 = performance.now(), dur = Math.min(1200, 400 + Math.abs(d) * 0.25);
    (function step(now) { const k = Math.min((now - t0) / dur, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; scrollTo(0, from + d * e); if (k < 1) requestAnimationFrame(step); })(t0);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('.svx .b-tabs a, .svx .c-tabs a, .svx .d-list a');
    if (!a) return;
    e.preventDefault();
    const tk = tracks.find(t => t.el.contains(a)), top = tk.el.getBoundingClientRect().top + scrollY, span = tk.el.offsetHeight - innerHeight, i = +a.dataset.i;
    if (tk.id === 'e') return glide(eY(i));
    const at = tk.id === 'c' ? (i === 0 ? 0.02 : (i + 0.02) / C_SLOTS) : (i + 0.08) / 4;   // C: once its card has arrived
    goTo(top + span * at);
  });

  // ---- E: one wheel gesture = one card --------------------------------------------------------------------------------
  const eTk = tracks.find(t => t.id === 'e');
  const eY = k => eTk.el.getBoundingClientRect().top + scrollY + (eTk.el.offsetHeight - innerHeight) * k / E_SLOTS;
  let lastWheel = 0, lockUntil = 0, glideRun = null, baseEase = null, gestureId = 0, passId = -1;
  // the page's current scroll speed (px / ms), for the lock-in
  let velo = 0, lastY = scrollY, lastT = performance.now();
  (function track(now) { const dt = now - lastT; if (dt > 0) { velo = velo * 0.5 + ((scrollY - lastY) / dt) * 0.5; lastY = scrollY; lastT = now; } requestAnimationFrame(track); })(lastT);
  // eased scroll to y over STEP_MS. Driven THROUGH smooth.js (its target set each frame, its easing switched off for the
  // glide) so the two never fight over the scroll position
  function glide(y, ms = STEP_MS, fn = easeIO) {
    const SM = window.haloSmooth;
    if (SM && baseEase == null) baseEase = SM.K.ease;   // the normal easing, kept once (a glide cut short by another must not lose it)
    const from = scrollY, d = y - from, t0 = performance.now(), run = glideRun = {};
    lockUntil = t0 + ms + 60;
    if (SM) SM.K.ease = 1;
    (function step(now) {
      if (run !== glideRun) return;
      const k = Math.min((now - t0) / ms, 1), at = from + d * fn(k);
      if (SM) SM.to(at); else scrollTo(0, at);
      if (k < 1) requestAnimationFrame(step); else { glideRun = null; if (SM) SM.K.ease = baseEase; }
    })(t0);
  }
  // capture phase on window: runs before smooth.js's wheel handler, which it can stop
  addEventListener('wheel', ev => {
    if (E.hidden || ev.ctrlKey) return;
    const now = performance.now(), fresh = now - lastWheel > GESTURE; lastWheel = now;
    if (fresh) gestureId++;
    if (gestureId === passId) return;   // this swipe is leaving past the first / last card: let all of it through
    const y0 = eY(0), y3 = eY(3), cur = window.haloSmooth ? haloSmooth.target : scrollY;
    const d = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * innerHeight : ev.deltaY, dir = Math.sign(d);
    if (!dir) return;
    const inside = cur >= y0 - 2 && cur <= y3 + 2;
    const eat = () => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    if (glideRun) return eat();   // a glide is playing (including the one bringing the section in): hold, never restart it
    // arriving from above / below: stop on the first / last card
    if (!inside) {
      // lock in: carry on at the speed the page is already moving and stop crisply on the card (ease-out, whose
      // start speed is 2 x distance / time, so time = 2 x distance / speed). An eased glide from rest, or smooth.js's own
      // long exponential tail, both read as a brake before the section (James); the rest of that swipe is held
      const land = y => { eat(); const dist = Math.abs(y - scrollY), v = Math.max(Math.abs(velo), 0.4);
        glide(y, Math.min(Math.max(2 * dist / v, 200), 480), x => 1 - (1 - x) * (1 - x)); };   // ease-out quad: start speed 2 x distance / time; capped at 480 ms so it snaps in
      if (dir > 0 && cur < y0 && cur + d >= y0) land(y0);
      else if (dir < 0 && cur > y3 && cur + d <= y3) land(y3);
      return;
    }
    if (now < lockUntil) return eat();   // a step is playing: hold
    const k = Math.round((cur - y0) / (y3 - y0) * 3), to = k + dir;
    if (to < 0 || to > 3) { if (fresh) { passId = gestureId; return; } return eat(); }   // past the ends: a NEW gesture scrolls out as normal
    eat();
    if (fresh) glide(eY(to));   // one card per gesture; the rest of a long swipe is ignored
  }, { passive: false, capture: true });
})();

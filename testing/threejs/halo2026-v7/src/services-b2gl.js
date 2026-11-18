// Option B2 in real 3D (James: the CSS cards popped as the wide, overlapping cards swapped depth). The carousel logic
// is unchanged (src/services-m.js still builds the HTML cards, handles the scroll, one card per swipe, the arrival and
// sets each card's data-p / data-role); this draws the same four cards in WebGL instead,
// set as a ring carousel: the cards stand round a circle edge to edge and the ring turns as one, so no card ever passes
// through another (moving them separately, even in real 3D, either flipped depth or sliced through each other).
// - each card is drawn once into a texture (colour, photo, pill, title, copy, arrow) from the HTML card's own layout
// - the camera matches the CSS perspective (2400 design px, centred on the stage), so the invisible HTML cards stay
//   lined up with the drawn ones and their links (pill, arrow) still click; hovering one redraws it lime
// - side cards are drawn round the ring; clicking one turns to it
import * as THREE from 'three';

(() => {
  const sec = document.getElementById('services-b2');
  if (!sec) return;
  const pin = sec.querySelector('.svm-pin'), stage = sec.querySelector('.svm-stage');
  const slots = [...stage.querySelectorAll('.svm-slot')], cards = slots.map(s => s.firstElementChild);
  if (cards.length !== 4) return;

  const bez = (x1, y1, x2, y2) => t => {   // CSS cubic-bezier timing
    if (t <= 0) return 0; if (t >= 1) return 1;
    let a = t; for (let i = 0; i < 8; i++) { const ia = 1 - a, x = 3 * ia * ia * a * x1 + 3 * ia * a * a * x2 + a * a * a - t;
      const dx = 3 * ia * ia * x1 + 6 * ia * a * (x2 - x1) + 3 * a * a * (1 - x2); if (Math.abs(dx) < 1e-6) break; a -= x / dx; a = Math.min(1, Math.max(0, a)); }
    const ia = 1 - a; return 3 * ia * ia * a * y1 + 3 * ia * a * a * y2 + a * a * a; };
  const EASE = { out: bez(0.45, 0, 0.25, 1), in: bez(0.55, 0, 0.35, 1), base: bez(0.65, 0, 0.35, 1), op: bez(0.25, 0.1, 0.25, 1) };

  // ---- renderer / camera ---------------------------------------------------------------------------------------------
  // edge smoothing (MSAA) only on standard screens: Retina already draws at 2x, and MSAA at that size was a large part of
  // the cost on a MacBook (James: B2's frame rate)
  const renderer = new THREE.WebGLRenderer({ antialias: (devicePixelRatio || 1) < 1.5, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cv = renderer.domElement;
  cv.className = 'svm-gl'; cv.setAttribute('aria-hidden', 'true');
  pin.insertBefore(cv, stage);   // over the title, under the (invisible, clickable) HTML cards, the progress bar and View all
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const groups = cards.map(() => { const g = new THREE.Group(); scene.add(g); return g; });
  const meshes = cards.map((c, k) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
    groups[k].add(m); return m; });
  const state = cards.map(() => ({ p: null, x: 0, z: 0, r: 0, y: 0, b: 1, op: 0, tw: null, ow: null, hover: { tag: false, go: false } }));

  let W = 0, H = 0, cw = 0, ch = 0, U = 1, ready = false;
  function layout() {
    W = pin.clientWidth; H = pin.clientHeight; cw = slots[0].offsetWidth; ch = slots[0].offsetHeight; U = innerWidth / 1920;
    if (!W || !H || !cw) return false;
    renderer.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    // CSS perspective on the stage: eye 2400u in front of the stage's centre (stage centre = its offsetTop: it's
    // translateY(-50%)'d); an off-centre frustum so the canvas can cover the whole pin
    const d = 2400 * U, cy = stage.offsetTop, n = 1, f = d * 6, k = n / d;
    camera.position.set(0, 0, d); camera.updateMatrixWorld();
    camera.projectionMatrix.makePerspective(-W / 2 * k, W / 2 * k, cy * k, -(H - cy) * k, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // rounded card (30u corners) with its own 0..1 UVs
    const r = 30 * U, s = new THREE.Shape(), x0 = -cw / 2, y0 = -ch / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + cw - r, y0); s.quadraticCurveTo(x0 + cw, y0, x0 + cw, y0 + r); s.lineTo(x0 + cw, y0 + ch - r);
    s.quadraticCurveTo(x0 + cw, y0 + ch, x0 + cw - r, y0 + ch); s.lineTo(x0 + r, y0 + ch); s.quadraticCurveTo(x0, y0 + ch, x0, y0 + ch - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    const geo = new THREE.ShapeGeometry(s, 10), pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - x0) / cw; uv[i * 2 + 1] = (pos.getY(i) - y0) / ch; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    meshes.forEach(m => { m.geometry.dispose(); m.geometry = geo; });
    cards.forEach((c, k) => paint(k));
    return true;
  }

  // ---- a card drawn from its HTML layout ---------------------------------------------------------------------------------
  const off = (el, card) => { let x = 0, y = 0; for (let e = el; e && e !== card; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y, el.offsetWidth, el.offsetHeight]; };
  const rrect = (g, x, y, w, h, r) => { if (typeof r === 'number') r = [r, r, r, r]; const [tl, tr, br, bl] = r;
    g.beginPath(); g.moveTo(x + tl, y); g.lineTo(x + w - tr, y); g.quadraticCurveTo(x + w, y, x + w, y + tr); g.lineTo(x + w, y + h - br);
    g.quadraticCurveTo(x + w, y + h, x + w - br, y + h); g.lineTo(x + bl, y + h); g.quadraticCurveTo(x, y + h, x, y + h - bl); g.lineTo(x, y + tl);
    g.quadraticCurveTo(x, y, x + tl, y); g.closePath(); };
  const textTop = (g, top, lh) => { const m = g.measureText('Hg'); const a = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, d = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    return top + (lh - (a + d)) / 2 + a; };   // CSS half-leading: the baseline of a line box of height lh
  const decode = html => { const t = document.createElement('div'); return html.split(/<br\s*\/?>/i).map(l => { t.innerHTML = l; return t.textContent.trim(); }); };
  const textures = cards.map(() => null);
  function paint(k) {
    const card = cards[k], st = state[k], scale = Math.min(Math.max(devicePixelRatio || 1, 1.5), 2);
    const c = document.createElement('canvas'); c.width = Math.round(cw * scale); c.height = Math.round(ch * scale);
    const g = c.getContext('2d'); g.scale(scale, scale);
    g.fillStyle = card.style.getPropertyValue('--c') || '#ccc'; g.fillRect(0, 0, cw, ch);
    // photo: the frame inset by the border, its bottom cut back by --mb (the gap for the text), top corners rounded;
    // the image fills a box 120% the frame's height from -10% (object-fit: cover)
    const box = card.querySelector('.svm-img'), img = box.querySelector('img'), [bx, by, bw, bh] = off(box, card);
    const mb = parseFloat(card.style.getPropertyValue('--mb')) || 0, rr = 18 * U;
    if (img && img.complete && img.naturalWidth) {
      g.save(); rrect(g, bx, by, bw, bh - mb, [rr, rr, 0, 0]); g.clip();
      const ih = bh * 1.2, iy = by - bh * 0.1, sc = Math.max(bw / img.naturalWidth, ih / img.naturalHeight);
      const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      g.drawImage(img, bx + (bw - dw) / 2, iy + (ih - dh) / 2, dw, dh); g.restore();
    }
    g.fillStyle = '#191919';
    // project pill
    const tag = card.querySelector('.svm-tag');
    if (tag) { const [x, y, w, h] = off(tag, card); g.fillStyle = st.hover.tag ? '#E6FF00' : '#FFF8E6'; rrect(g, x, y, w, h, h / 2); g.fill();
      g.fillStyle = '#191919'; g.font = `400 ${15 * U}px "Space Grotesk"`; g.textBaseline = 'alphabetic'; g.fillText(tag.textContent.trim(), x + 20 * U, textTop(g, y, h)); }
    // title (its lines as broken in the HTML) and copy (wrapped to its column)
    const h3 = card.querySelector('.svm-text h3'), p = card.querySelector('.svm-text p');
    if (h3) { const [x, y] = off(h3, card), fs = parseFloat(getComputedStyle(h3).fontSize);
      g.font = `400 ${fs}px "FK Display"`; if ('letterSpacing' in g) g.letterSpacing = `${-0.02 * fs}px`;
      decode(h3.innerHTML).forEach((line, i) => g.fillText(line, x, textTop(g, y + i * fs, fs)));
      if ('letterSpacing' in g) g.letterSpacing = '0px'; }
    if (p) { const [x, y, w] = off(p, card), cs = getComputedStyle(p), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs * 1.45;
      g.font = `300 ${fs}px "Space Grotesk"`; const lines = []; let cur = '';
      p.textContent.trim().split(/\s+/).forEach(word => { const t = cur ? cur + ' ' + word : word; if (g.measureText(t).width > w + 0.5 && cur) { lines.push(cur); cur = word; } else cur = t; });
      if (cur) lines.push(cur);
      lines.forEach((line, i) => g.fillText(line, x, textTop(g, y + i * lh, lh))); }
    // arrow button
    const go = card.querySelector('.svm-go');
    if (go) { const [x, y, w, h] = off(go, card); g.fillStyle = st.hover.go ? '#E6FF00' : '#FFF8E6'; rrect(g, x, y, w, h, 14 * U); g.fill();
      const s = 22 * U / 20, ox = x + (w - 22 * U) / 2, oy = y + (h - 22 * U) / 2;
      g.save(); g.translate(ox, oy); g.scale(s, s); g.strokeStyle = '#191919'; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(3, 10); g.lineTo(16.5, 10); g.moveTo(11, 4.5); g.lineTo(16.5, 10); g.lineTo(11, 15.5); g.stroke(); g.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (textures[k]) textures[k].dispose();
    textures[k] = t; meshes[k].material.map = t; meshes[k].material.needsUpdate = true; dirty = true;
  }
  // redraw a card when its photo arrives, and when its pill / arrow is hovered (the HTML ones are invisible but on top)
  cards.forEach((card, k) => {
    const img = card.querySelector('.svm-img img'); if (img && !img.complete) img.addEventListener('load', () => ready && paint(k));
    [['tag', '.svm-tag'], ['go', '.svm-go']].forEach(([key, sel]) => { const el = card.querySelector(sel); if (!el) return;
      el.addEventListener('mouseenter', () => { state[k].hover[key] = true; if (ready) paint(k); });
      el.addEventListener('mouseleave', () => { state[k].hover[key] = false; if (ready) paint(k); }); });
  });

  // ---- motion: a ring carousel -----------------------------------------------------------------------------------------
  // The cards stand round a circle, each facing out, ANG degrees apart, the radius chosen so neighbours' edges just meet
  // (plus GAP): the ring turns as one piece, so no card ever passes through another and nothing pops (James). The
  // current service (the HTML card with data-p 0) is turned to the front.
  // The ring follows the current service on a soft spring (James: a timed curve felt rigid): it picks up speed, settles
  // with a slight overshoot; while it's moving it eases back a touch (SINK) and the cards lean with the motion (LEAN)
  const SLIDE = { w: 6.5, z: 0.85 }, ANG = 36, GAP = 0.05, SPRING = { w: 7.2, z: 0.78 }, SINK = 0.06, LEAN = 3.5, FADE = 7;
  const RAD = (0.5 + GAP) / Math.tan(ANG / 2 * Math.PI / 180);   // in card widths
  // ring: the service index facing front (fractional while turning); vel: per second; slide: the carousel's offset to the right (px)
  let ring = null, vel = 0, lastT = 0, slide = 0, svel = 0;
  const title = sec.querySelector('.svm-title');
  const shown = cards.map(() => 0);     // each card's drawn opacity, eased towards its target (no popping in)
  let lastKey = '', dirty = true;       // dirty: force a draw (new textures, a resize)
  function frame(now) {
    requestAnimationFrame(frame);
    if (sec.hidden) return;
    const pr = pin.getBoundingClientRect(), onScreen = pr.bottom > 0 && pr.top < innerHeight;
    if (!ready || W !== pin.clientWidth || H !== pin.clientHeight) { if (!onScreen && ready) return; ready = layout(); if (!ready) return; }
    // until the section has pinned and held the title a moment (.svm-in, set by services-m.js) the whole carousel waits off
    // to the right; then it slides in (on a spring), solid, over the top of the title, and back out going up (James)
    const front = cards.findIndex(c => c.dataset.p === '0'), goal = front < 0 ? 0 : +cards[front].dataset.s;
    const entered = sec.classList.contains('svm-in'), slideTo = entered ? 0 : W * 1.15;
    const dt = Math.min(0.05, Math.max(0, (now - (lastT || now)) / 1000)); lastT = now;
    const snap = ring === null || !onScreen;
    if (snap) { ring = goal; vel = 0; slide = slideTo; svel = 0; }
    else { const acc = -SPRING.w * SPRING.w * (ring - goal) - 2 * SPRING.z * SPRING.w * vel; vel += acc * dt; ring += vel * dt;
      if (Math.abs(ring - goal) < 0.0005 && Math.abs(vel) < 0.002) { ring = goal; vel = 0; } }
    if (!snap) { const sa = -SLIDE.w * SLIDE.w * (slide - slideTo) - 2 * SLIDE.z * SLIDE.w * svel; svel += sa * dt; slide += svel * dt;
      if (Math.abs(slide - slideTo) < 0.5 && Math.abs(svel) < 5) { slide = slideTo; svel = 0; } }
    // the title: there until the card has come to rest over it, then hidden (so it never shows between the cards); back as
    // soon as the carousel leaves
    title.style.opacity = entered && slide < W * 0.01 ? 0 : 1;
    const speed = Math.min(1, Math.abs(vel) / 2.5);   // 0 at rest .. 1 at full turn speed
    cards.forEach((card, k) => {
      const a = +card.dataset.s - ring, ang = a * ANG * Math.PI / 180;
      // the slot's own move (the arrival: up from below, tilted, straightening), from its inline transform
      const m = /translateY\(([-\d.]+)px\)\s*rotate\(([-\d.]+)deg\)/.exec(slots[k].style.transform || '');
      const g = groups[k]; g.position.set(slide, m ? -parseFloat(m[1]) : 0, 0); g.rotation.z = m ? -parseFloat(m[2]) * Math.PI / 180 : 0;
      const mesh = meshes[k];
      mesh.position.set(RAD * cw * Math.sin(ang), 0, RAD * cw * (Math.cos(ang) - 1) - SINK * cw * speed);
      mesh.rotation.set(0, ang - Math.sign(vel) * speed * LEAN * Math.PI / 180, 0);   // trailing a little, like it has weight
      const d = Math.abs(a);
      let op = d <= 1.2 ? 1 : Math.max(0, 1 - (d - 1.2) / 0.5);     // the ones round the back fade away
      shown[k] = snap ? op : shown[k] + (op - shown[k]) * (1 - Math.exp(-FADE * dt)); op = shown[k];   // fade, never pop
      mesh.material.color.setScalar(1 - 0.08 * Math.min(d, 1));
      mesh.material.opacity = op; mesh.visible = op > 0.002; mesh.material.transparent = op < 0.999; mesh.material.depthWrite = true;
    });
    // draw only when something on screen has changed (the ring turning, the slide, a fade, a new texture): at rest it costs
    // nothing, instead of redrawing a full-screen canvas every frame (James: frame rate on a MacBook)
    if (onScreen) {
      let key = slide.toFixed(1) + '|' + ring.toFixed(4) + '|' + vel.toFixed(3);
      for (let k = 0; k < cards.length; k++) key += '|' + groups[k].position.y.toFixed(1) + ',' + groups[k].rotation.z.toFixed(4) + ',' + meshes[k].material.opacity.toFixed(3);
      if (key !== lastKey || dirty) { renderer.render(scene, camera); lastKey = key; dirty = false; }
    }
  }
  addEventListener('resize', () => { ready = false; });
  pin.addEventListener('click', ev => {
    if (sec.hidden || ev.target.closest('a')) return;
    const f = cards.find(c => c.dataset.p === '0'); if (!f) return;
    const r = f.getBoundingClientRect(), side = ev.clientX < r.left ? -1 : ev.clientX > r.right ? 1 : 0; if (!side) return;
    const t = cards.find(c => +c.dataset.p === side); if (t) t.click();   // services-m.js scrolls to it
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { sec.classList.add('gl'); requestAnimationFrame(frame); });
})();

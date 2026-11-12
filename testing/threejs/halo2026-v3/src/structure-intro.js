// "Structure Intro" (James, assets/ref-structure-intro.mp4; shape from the halo-structure.svg mark): the Halo mark as a
// solid, an H-shaped top face on an inverted pyramid. The default intro; ?intro=original (the bottom-left switch) plays the old one instead.
//   1. on the dark grey, the small mark turns slowly (three.js, seen from just above its top face, like the logo)
//   2. it swings round face-on and grows, while the background fades from the dark to the page grey: a dark H on grey
//   3. (DOM from here) the H stretches out to the frame, then splits into the four lime bars of the final scene
//   4. the overlay fades away: underneath, the normal timeline is already at the same bars, with the gallery streaming
//      and the headline coming in (main.js jumps its clock there when haloStructureDone() is called)
// main.js creates the #sintro overlay (dark, covering the hero) before this module loads, so nothing flashes.
import * as THREE from 'three';

const C = window.HALO_CONFIG, S = C.structure, ov = document.getElementById('sintro');
if (ov && S) {
  const D = Math.PI / 180;
  // ---- easing -----------------------------------------------------------------------------------------------------
  function bezier([x1, y1, x2, y2]) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
      return sy(t); };
  }
  const site = bezier(C.ease), easeSplit = bezier(S.splitEase || C.ease), easeGrow = bezier(S.growEase), easeSpin = bezier(S.spinEase), clamp = v => Math.min(Math.max(v, 0), 1);
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpR = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };

  // ---- timeline (s) -------------------------------------------------------------------------------------------------
  const T0 = S.delay, T1 = T0 + S.hold, T2 = T1 + S.turn, T3 = T2 + S.grow, T4 = T3 + S.split, T5 = T4 + S.fade;

  // ---- overlay layers: three.js canvas, the four DOM bars ----------------------------------------------
  ov.style.background = S.bg;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });
  ov.appendChild(renderer.domElement);
  const bars = Array.from({ length: 4 }, () => {
    const b = document.createElement('div');
    b.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;visibility:hidden;';
    ov.appendChild(b); return b;
  });

  // ---- the mark: a real solid, nudged onto the logo at the start ------------------------------------------------------
  // The solid: an inverted pyramid on a square top (local XY, z = 0, apex below) with the H's two notches cut STRAIGHT
  // DOWN through it, built as three convex pieces (left leg, right leg, crossbar) from clipping planes. Its notches are
  // genuinely open, so face-on you see straight through them (nothing has to fade).
  // The logo (halo-structure.svg) is a slightly abstract drawing of it, so at the start pose every corner is nudged
  // sideways (in the screen plane: invisible as depth) onto the logo's corner, with extra corners for the kink on the
  // logo's left edge and the small top-right piece; corners the logo hides follow their neighbours. The nudges ease to
  // nothing as it turns, so it lands as the exact H the DOM bars take over from.
  const A = S.aspect, c = S.cross * A / 2, n = S.notch, w = A / 2, h = 0.5;
  const scene = new THREE.Scene();
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10000);
  camera.position.set(0, 0, 4000);
  const qFace = new THREE.Quaternion();
  const qLogo = az => new THREE.Quaternion().setFromEuler(new THREE.Euler(-(90 - S.elevation) * D, 0, az * D, 'XYZ'));

  // solid: indexed corners + face polygons
  const verts = [], polys = [];
  const vid = p => { let i = verts.findIndex(q => q.distanceTo(p) < 1e-6); if (i < 0) { verts.push(p.clone()); i = verts.length - 1; } return i; };
  const apexV = V(S.apex[0], S.apex[1], -S.depth);
  const corners = [V(-w, -h, 0), V(w, -h, 0), V(w, h, 0), V(-w, h, 0)];
  const plane = (nx, ny, nz, d) => ({ n: V(nx, ny, nz), d });          // n.p <= d is inside
  const pyramid = [plane(0, 0, 1, 0)];
  corners.forEach((a, i) => {   // side planes through each top edge and the apex, normals outwards
    const b = corners[(i + 1) % 4], nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(apexV, a)).normalize();
    if (nrm.dot(apexV.clone().multiplyScalar(0.5).sub(a)) > 0) nrm.negate();
    pyramid.push({ n: nrm, d: nrm.dot(a) });
  });
  const pieces = [
    [plane(1, 0, 0, -c)],                                                         // left leg  (x <= -c)
    [plane(-1, 0, 0, -c)],                                                        // right leg (x >= c)
    [plane(-1, 0, 0, c), plane(1, 0, 0, c), plane(0, 1, 0, h - n), plane(0, -1, 0, h - n)],   // crossbar
  ];
  pieces.forEach(extra => {
    const P = pyramid.concat(extra), pts = [];
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) for (let k = j + 1; k < P.length; k++) {
      const m = new THREE.Matrix3().set(P[i].n.x, P[i].n.y, P[i].n.z, P[j].n.x, P[j].n.y, P[j].n.z, P[k].n.x, P[k].n.y, P[k].n.z);
      if (Math.abs(m.determinant()) < 1e-9) continue;
      const p = V(P[i].d, P[j].d, P[k].d).applyMatrix3(m.invert());
      if (P.every(q => q.n.dot(p) <= q.d + 1e-7) && !pts.some(o => o.distanceTo(p) < 1e-6)) pts.push(p);
    }
    for (const q of P) {
      const on = pts.filter(p => Math.abs(q.n.dot(p) - q.d) < 1e-6);
      if (on.length < 3) continue;
      const cen = on.reduce((s, p) => s.add(p), V(0, 0, 0)).divideScalar(on.length);
      const u = new THREE.Vector3().subVectors(on[0], cen).normalize(), v = new THREE.Vector3().crossVectors(q.n, u);
      const ang = p => Math.atan2(v.dot(p.clone().sub(cen)), u.dot(p.clone().sub(cen)));
      on.sort((a, b) => ang(a) - ang(b));
      polys.push({ idx: on.map(vid), top: q.n.z > 0.999, n: q.n.clone() });
    }
  });
  // put an extra corner on the edge a-b in every face that has that edge
  function splitEdge(a, b, p) {
    const k = vid(p);
    polys.forEach(f => { const L = f.idx.length;
      for (let i = 0; i < L; i++) { const x = f.idx[i], y = f.idx[(i + 1) % L];
        if ((x === a && y === b) || (x === b && y === a)) { f.idx.splice(i + 1, 0, k); return; } } });
    return k;
  }

  // the start pose, and logo (svg units, y down) <-> local space
  const R0 = new THREE.Matrix4().makeRotationFromQuaternion(qLogo(S.azimuth)), R0i = R0.clone().invert();
  const LF = S.logoFit;
  const camOf = p => p.clone().applyMatrix4(R0);
  const toSvg = p => { const q = camOf(p); return [LF.s * q.x + LF.tx, -LF.s * q.y + LF.ty]; };
  const lift = ([sx, sy], z) => V((sx - LF.tx) / LF.s, -(sy - LF.ty) / LF.s, z).applyMatrix4(R0i);
  // logo corners, read off the path (rounded tips at their middles)
  const Lg = { P1: [33.09, 31.6], P2: [18.9, 23.2], P3: [32.57, 14.8], P4: [27.2, 11.43], P5: [12.49, 19.86], P6: [0, 13.4],
    P7: [18.36, 33.36], P8: [27.3, 51.6], P9: [65.8, 13.6], TR: [47.75, 0.05], LL: [33.6, 8.05], B: [38.97, 11.4], BR: [47.8, 6.3] };
  // the point on the edge a-b that, at the start pose, lands nearest a logo corner
  const nearestOn = (a, b, pt) => { let best = null, bd = 1e9;
    for (let t = 0; t <= 1.0001; t += 0.002) { const p = verts[a].clone().lerp(verts[b], t), s = toSvg(p), d = (s[0] - pt[0]) ** 2 + (s[1] - pt[1]) ** 2; if (d < bd) { bd = d; best = p; } }
    return best; };
  const at = (x, y, z) => verts.findIndex(q => q.distanceTo(V(x, y, z)) < 1e-6);
  const data = {};   // corner index -> logo corner
  [['P6', -w, -h], ['P5', -c, -h], ['P4', -c, -h + n], ['P3', c, -h + n], ['P2', c, -h], ['P1', w, -h], ['P9', w, h],
    ['LL', -c, h - n], ['TR', -c, h]].forEach(([k, x, y]) => { const i = at(x, y, 0); if (i >= 0) data[i] = k; });
  // the legs' inner top edges get the crossbar's corners too, so when those are nudged no hairline gap opens between
  // the top faces (the wall underneath showed through)
  [[-c, 1], [c, 1]].forEach(([x]) => {
    const lo = at(x, -h, 0), hi = at(x, h, 0);
    const m1 = splitEdge(lo, hi, V(x, -h + n, 0));
    splitEdge(m1, hi, V(x, h - n, 0));
  });
  const iApex = verts.findIndex(q => q.distanceTo(apexV) < 1e-6);
  if (iApex >= 0) data[iApex] = 'P8';
  // the kink on the logo's left edge: an extra corner on the edge from the left corner down to the apex
  const iP6 = at(-w, -h, 0);
  if (iP6 >= 0 && iApex >= 0) data[splitEdge(iP6, iApex, nearestOn(iP6, iApex, Lg.P7))] = 'P7';
  // (the small top-right piece's edge is left straight: extra corners there matched the logo's vertical side at the
  // start but put a kink in the piece from every other angle of the spin: James)
  // nudges: data corners exactly onto the logo (sideways only), the rest by an inverse-distance blend of those
  const delta = verts.map(() => V(0, 0, 0));
  const keys = Object.keys(data).map(Number);
  keys.forEach(i => { delta[i] = lift(Lg[data[i]], camOf(verts[i]).z).sub(verts[i]); });
  verts.forEach((p, i) => {
    if (data[i]) return;
    let sw = 0; const d = V(0, 0, 0);
    keys.forEach(j => { const wt = 1 / Math.max(p.distanceToSquared(verts[j]), 1e-6); sw += wt; d.addScaledVector(delta[j], wt); });
    delta[i] = d.divideScalar(sw);
  });

  // meshes: dark top faces, cream everything else (faces fanned into triangles)
  // each face split into triangles in its own plane, using the NUDGED corners (a nudged face can be concave, e.g. at
  // the kink), wound to face outwards so faces pointing away can be culled
  const tri = f => {
    const u = V(0, 0, 0), cen = V(0, 0, 0);
    f.idx.forEach(i => cen.add(verts[i])); cen.divideScalar(f.idx.length);
    u.subVectors(verts[f.idx[0]], cen).normalize();
    const v = new THREE.Vector3().crossVectors(f.n, u);
    const p2 = f.idx.map(i => { const p = verts[i].clone().add(delta[i]).sub(cen); return new THREE.Vector2(p.dot(u), p.dot(v)); });
    let out = THREE.ShapeUtils.triangulateShape(p2, []).map(t => t.map(j => f.idx[j]));
    if (out.length !== f.idx.length - 2) out = f.idx.slice(1, -1).map((x, i) => [f.idx[0], x, f.idx[i + 2]]);
    return out.map(t => { const [a, b, c2] = t.map(i => verts[i]);
      return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c2, a)).dot(f.n) < 0 ? [t[0], t[2], t[1]] : t; });
  };
  const topTris = polys.filter(f => f.top).flatMap(tri), sideTris = polys.filter(f => !f.top).flatMap(tri);
  const geoOf = list => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(list.length * 9), 3)); return geo; };
  const topGeo = geoOf(topTris), creamGeo = geoOf(sideTris);
  const cur = verts.map(p => p.clone());
  function shape(k, fl) {   // k: 0 = nudged onto the logo, 1 = the exact solid; fl: 0..1 flatten
    // the solid also flattens as it turns (its depth shrinks to nothing), so the sides and notch walls fold up under
    // the top face and are gone by the time it's face-on: no fades (James)
    const squash = 1 - fl * fl * (3 - 2 * fl);
    cur.forEach((p, i) => { p.copy(verts[i]).addScaledVector(delta[i], 1 - k); p.z *= squash; });
    [[topGeo, topTris], [creamGeo, sideTris]].forEach(([geo, list]) => {
      const pa = geo.attributes.position;
      list.forEach((t, i) => t.forEach((r, j) => { const v = cur[r]; pa.setXYZ(i * 3 + j, v.x, v.y, v.z); }));
      pa.needsUpdate = true; geo.computeBoundingSphere();
    });
  }
  shape(0, 0);
  const top = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ color: S.ink, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const side = new THREE.Mesh(creamGeo, new THREE.MeshBasicMaterial({ color: S.side }));   // front faces only
  g.add(top, side);
  scene.add(g);

  // ---- layouts in viewport px -----------------------------------------------------------------------------------------
  function edge(rects) {   // same mapping as main.js 'edge' scenes
    const W = innerWidth, H = innerHeight, s = Math.min(W / 1920, H / 1080), m = C.margin * s;
    const kx = (W - 2 * m) / (1920 - 2 * C.margin), ky = (H - 2 * m) / (1080 - 2 * C.margin);
    return rects.map(([x, y, rw, rh]) => [m + (x - C.margin) * kx, m + (y - C.margin) * ky, rw * kx, rh * ky]);
  }
  const faceSize = () => Math.min(S.faceSize * innerHeight, S.faceWidthMax * innerWidth / A);   // H height when face-on (px)
  function hSmall() {    // the face-on H the 3D lands on, as four rects (legs + the crossbar's two halves)
    const W = innerWidth, H = innerHeight, F = faceSize(), x0 = W / 2 - w * F, y0 = H / 2 - h * F, cw = 2 * c * F;
    const leg = (A * F - cw) / 2, half = (1 - 2 * n) * F / 2;
    return [[x0, y0, leg, F], [x0 + leg, y0 + n * F, cw, half], [x0 + leg, y0 + n * F + half, cw, half], [x0 + leg + cw, y0, leg, F]];
  }
  const finalRects = () => edge(C.scenes[C.scenes.length - 1].rects);

  // ---- per frame ------------------------------------------------------------------------------------------------------
  let W0 = 0, H0 = 0, done = false, handed = false;
  function draw(t) {
    const W = innerWidth, H = innerHeight;
    if (W !== W0 || H !== H0) {
      W0 = W; H0 = H; renderer.setSize(W, H, false);
      camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
    }
    const k = site(clamp((t - T1) / S.turn));   // the swing to face-on
    const p = clamp((t - (T1 + S.cardAt * S.turn)) / S.cardDur), kc = p * p * (3 - 2 * p);   // smoothstep: an even fade
    // the whole background fades from the dark to the page grey as the H comes round (was a growing card: James)
    const bgNow = mix(S.bg, C.background, kc);
    ov.style.background = bgNow;

    if (t < T2) {
      renderer.domElement.style.visibility = 'visible';
      bars.forEach(b => { b.style.visibility = 'hidden'; });
      // one full spin about its own axis first (James), then the slow extra turn during the swing
      const spinE = easeSpin(clamp((t - T0 - S.spinAt) / S.spinDur));
      const az = S.azimuth + 360 * spinE + S.spin * clamp((t - T1) / S.turn);
      g.quaternion.slerpQuaternions(qLogo(az), qFace, k);
      // size: from the small mark to the face-on H, on a log scale so the zoom feels even
      const s0 = S.startSize * W, s1 = faceSize();
      const sc = Math.exp(lerp(Math.log(s0), Math.log(s1), k));
      g.scale.setScalar(sc);
      // lift the mark so its whole silhouette (top face + the pyramid under it) is centred, not just the top face
      g.position.set(0, (1 - k) * S.depth * Math.cos(S.elevation * D) / 2 * sc, 0);
      // the mark fades up at the start; its top face eases from the logo's corners onto the exact H as it turns
      renderer.domElement.style.opacity = clamp((t - T0 + S.fadeIn) / S.fadeIn);
      // folds flat in step with the background fade (they start together; the fold lands as the H comes face-on)
      const fStart = T1 + S.cardAt * S.turn;
      shape(k, S.flatten ? clamp((t - fStart) / Math.max(T2 - fStart, 1e-3)) : 0);
      renderer.render(scene, camera);
      return;
    }
    // DOM from here: the face-on H (exactly where the 3D one landed), stretched to the frame, then split into the bars
    renderer.domElement.style.visibility = 'hidden';
    // grow 0 (James): straight from the face-on H to the final bars, no stretched full-frame H in between
    const kg = S.grow > 0 ? easeGrow(clamp((t - T2) / S.grow)) : 0, ks = easeSplit(clamp((t - T3) / S.split));
    const full = edge(S.full), fin = finalRects();
    const R = hSmall().map((r, i) => lerpR(S.grow > 0 ? lerpR(r, full[i], kg) : r, fin[i], ks));
    // dark until the bars are mostly in place, then a quick turn to lime (a slow mix reads as muddy olive)
    const col = mix(S.ink, C.yellow, clamp((ks - S.limeAt) / (1 - S.limeAt)));
    bars.forEach((b, i) => {
      const [x, y, bw, bh] = R[i];
      b.style.visibility = 'visible';
      b.style.background = col;
      // the crossbar's top half reaches 1px into the bottom half, so no hairline seam shows between them
      b.style.transform = `translate(${x}px, ${y}px) scale(${bw / 100}, ${(bh + (i === 1 ? 1 : 0)) / 100})`;
    });
    if (t >= T4 && !handed) { handed = true; window.haloStructureDone?.(); }
    ov.style.opacity = 1 - clamp((t - T4) / S.fade);
    if (t >= T5) finish();
  }

  function finish() {
    if (done) return;
    done = true;
    if (!handed) { handed = true; window.haloStructureDone?.(); }
    ov.remove();
    renderer.dispose();
  }
  // debug: ?sfreeze=1.6 loads frozen at that moment
  const qf = new URLSearchParams(location.search).get('sfreeze');
  let frozen = qf != null ? +qf : null, start = performance.now();
  (function loop(now) { if (done) return; draw(frozen ?? (now - start) / 1000 / (S.slow || 1)); requestAnimationFrame(loop); })(start);
  window.haloStructure = { S, finish, freeze: t => { frozen = t; draw(t); }, play: () => { frozen = null; start = performance.now(); },
    times: { T0, T1, T2, T3, T4, T5 } };
}

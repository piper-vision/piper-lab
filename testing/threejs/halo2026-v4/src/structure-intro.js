// "Structure Intro" (James, assets/ref-structure-intro.mp4; shape from the halo-structure.svg mark): the Halo mark as a
// solid, an H-shaped top face on an inverted pyramid. The default intro; ?intro=original (the bottom-left switch) plays the old one instead.
//   1. on the dark grey, the small mark turns slowly (three.js, seen from just above its top face, like the logo)
//   2. after one spin, flat shapes take over and replay James' After Effects morph exactly (src/structure-ae.js): the H
//      turns face-on and grows with a snap cut to cream, then snap-cuts to the lime pillars, which tighten into place
//   4. the overlay fades away: underneath, the normal timeline is already at the same bars, with the gallery streaming
//      and the headline coming in (main.js jumps its clock there when haloStructureDone() is called)
// main.js creates the #sintro overlay (dark, covering the hero) before this module loads, so nothing flashes.
import * as THREE from 'three';
import { AE } from './structure-ae.js';

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
  const T0 = S.delay;

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

  // ---- per frame ------------------------------------------------------------------------------------------------------
  // After the spin the 3D mark hands over to flat shapes that replay James' After Effects morph (src/structure-ae.js,
  // sampled from Halo_v3): AE time 0.4 = the logo pose (where our spin ends) -> 1.6 the corners ease into the big face-on
  // H (the "turn"), with a SNAP CUT at 1.0 (background dark -> cream, the cream sides gone) -> hold -> 2.0..2.4 the legs
  // start to widen -> SNAP CUT at 2.4 to wide pillars that tighten into place by 2.72 (Halo_Frame_1 1.4 -> 1.72).
  // The shapes start exactly on our logo (each corner's offset from AE's logo eases away with the morph) and the pillars
  // land on the website's own final bars (AE's pillar motion is applied as offsets from those).
  const Tm = T0 + S.spinAt + S.spinDur;                       // spin ends = AE 0.4
  // AE holds the big H still from 1.6 to 2.0: we spend S.bigHold there instead (James: AE's 0.4 s felt too long)
  const holdCut = 0.4 - S.bigHold;
  const aeAt = t => { const b = 0.4 + (t - Tm); if (b <= 1.6) return b; const u = b - 1.6;
    return u < S.bigHold ? 1.6 + u * (0.4 / Math.max(S.bigHold, 1e-3)) : 2.0 + (u - S.bigHold); };
  const tCut = Tm + 0.6, tBars = Tm + 2.0 - holdCut, tLand = tBars + 0.32, tHand = tLand + S.barsHold, T5 = tHand + S.fade;
  // the headline, paragraph, buttons + nav start coming in this long after the pillar cut (they sit above the overlay),
  // rather than waiting for the overlay to fade (James: sooner)
  const tContent = Math.min(tBars + S.contentAt, tHand);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const flat = document.createElementNS(SVGNS, 'svg');
  flat.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;visibility:hidden;';
  const mk = fill => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('fill', fill); flat.appendChild(p); return p; };
  // as in James' AE comp: the H on top, trimming the small piece (its lower corner B is pinned to the H's crossbar corner)
  const sideA = mk(S.side), sideB = mk(S.side), hPath = mk(S.ink);
  ov.insertBefore(flat, bars[0]);
  // AE comp px -> viewport px (the same 'edge' mapping as the bars)
  function mapper() {
    const W = innerWidth, H = innerHeight, s = Math.min(W / 1920, H / 1080), m = C.margin * s;
    const kx = (W - 2 * m) / (1920 - 2 * C.margin), ky = (H - 2 * m) / (1080 - 2 * C.margin);
    return { X: x => m + (x - C.margin) * kx, Y: y => m + (y - C.margin) * ky, kx, ky };
  }
  // a sampled AE frame at AE time ae (linear between the 0.04 s samples)
  const sampleAt = (list, ae) => {
    const f = clamp((ae - AE.hFrom) / AE.hStep / (list.length - 1)) * (list.length - 1), i = Math.min(Math.floor(f), list.length - 2), u = f - i;
    return list[i].map((p, j) => p.map((v, k) => lerp(v, list[i + 1][j][k], u)));
  };
  // where each AE corner starts on screen: our logo's matching corner (svg logo -> screen, as the 3D was fitted)
  // (CT, CR, FC: corners hidden in the logo, dark on dark, but the H is drawn over the cream pieces, so its edges cut them:
  // they start where the 3D has them too, or the small piece's lower edge jumps at the hand-over: James)
  const H_LABELS = ['CT', 'CR', 'LL', 'TR', 'FC', 'P6', 'P5', 'P4', 'P3', 'P2', 'P1', 'P9'];
  // WX (the piece's BR): starts where the 3D's wall edge down from TR meets the notch's right edge (CR -> CT), so the
  // trimmed piece is exactly the 3D's at the hand-over (it started on AE's vertical edge and grew a sliver: James)
  const SIDE_LABELS = [['WX', 'TR', 'LL', 'CR'], ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']];
  // the small top-right piece's two lower corners (BR, B) start where the 3D shows them, not at the svg logo's: its
  // straightened edge (no kink in the spin) makes it a plain triangle there, so starting from the svg's parallelogram
  // made it pop at the hand-over (James). That corner is where the wall's edge down from TR meets the crossbar's far edge.
  const iTR = at(-c, h, 0), iLL = at(-c, h - n, 0), iCR = at(c, h - n, 0);
  const wallPoly = polys.find(f => !f.top && f.idx.includes(iTR) && f.idx.every(i => Math.abs(verts[i].x + c) < 1e-6));
  const iDown = wallPoly ? [wallPoly.idx[(wallPoly.idx.indexOf(iTR) + 1) % wallPoly.idx.length], wallPoly.idx[(wallPoly.idx.indexOf(iTR) + wallPoly.idx.length - 1) % wallPoly.idx.length]].find(i => verts[i].z < -1e-6) : -1;
  function logoScreen() {
    const W = innerWidth, H = innerHeight, s0 = S.startSize * W, kk = s0 / LF.s, lift = S.depth * Math.cos(S.elevation * D) / 2 * s0;
    const svgTo = ([sx, sy]) => [W / 2 + kk * (sx - LF.tx), H / 2 - lift + kk * (sy - LF.ty)];
    // a 3D corner (nudged, at the logo pose) on screen
    const p3 = i => { const q = verts[i].clone().add(delta[i]).applyMatrix4(R0); return [W / 2 + q.x * s0, H / 2 - lift - q.y * s0]; };
    const hidden = { CT: at(c, h, 0), CR: iCR, FC: at(-w, h, 0) };
    let wx = null;
    if (iDown >= 0 && iCR >= 0 && hidden.CT >= 0) {
      const [a, b, p, q] = [p3(iTR), p3(iDown), p3(iCR), p3(hidden.CT)];
      const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [q[0] - p[0], q[1] - p[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) > 1e-9) { const u = ((p[0] - a[0]) * d2[1] - (p[1] - a[1]) * d2[0]) / den; wx = [a[0] + d1[0] * u, a[1] + d1[1] * u]; }
    }
    return lab => (lab === 'WX' ? (wx || p3(iCR)) : hidden[lab] !== undefined && hidden[lab] >= 0 ? p3(hidden[lab]) : svgTo(Lg[lab]));
  }
  // start offsets (screen px) for one AE path: labelled corners go exactly to the logo; hidden ones follow the
  // similarity that takes AE's logo tips onto ours
  function startOffsets(path0, labels, M, toScr) {
    const aL = [792.2, 491.8], aR = [1128, 491.8], sL = toScr('P6'), sR = toScr('P9');
    const ml = [M.X(aL[0]), M.Y(aL[1])], mr = [M.X(aR[0]), M.Y(aR[1])], sc = (sR[0] - sL[0]) / (mr[0] - ml[0]);
    const off = [];
    for (let i = 0; i < path0.length; i += 2) {
      const m = [M.X(path0[i]), M.Y(path0[i + 1])], lab = labels[i / 2];
      if (lab && lab[0] === '=') { off.push(null, null); continue; }
      const tgt = lab ? toScr(lab) : [sL[0] + (m[0] - ml[0]) * sc, sL[1] + (m[1] - ml[1]) * sc];
      off.push(tgt[0] - m[0], tgt[1] - m[1]);
    }
    labels.forEach((lab, j) => { if (lab && lab[0] === '=') { const k = labels.indexOf(lab === '=B' ? 'CR' : lab.slice(1)); off[2 * j] = off[2 * k]; off[2 * j + 1] = off[2 * k + 1]; } });
    return off;
  }
  const y4 = ae => sampleAt(AE.h, ae)[0][9];                  // the far corner's y: tracks the morph's progress
  const Y40 = AE.h[0][0][9], Y41 = AE.h[Math.round((1.6 - AE.hFrom) / AE.hStep)][0][9];
  const morphK = ae => clamp((y4(ae) - Y40) / (Y41 - Y40));
  function pathD(pts, off, keep, M) {
    let d = '';
    for (let i = 0; i < pts.length; i += 2) d += (i ? 'L' : 'M') + (M.X(pts[i]) + off[i] * keep).toFixed(1) + ',' + (M.Y(pts[i + 1]) + off[i + 1] * keep).toFixed(1);
    return d + 'Z';
  }
  const finalRects = () => C.scenes[C.scenes.length - 1].rects;
  let W0 = 0, H0 = 0, done = false, handed = false;
  function draw(t) {
    const W = innerWidth, H = innerHeight;
    if (W !== W0 || H !== H0) {
      W0 = W; H0 = H; renderer.setSize(W, H, false);
      camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
    }
    if (t < Tm) {   // the 3D logo fades in and spins once, landing exactly on the logo pose
      ov.style.background = S.bg;
      flat.style.visibility = 'hidden';
      bars.forEach(b => { b.style.visibility = 'hidden'; });
      renderer.domElement.style.visibility = 'visible';
      const spinE = easeSpin(clamp((t - T0 - S.spinAt) / S.spinDur));
      g.quaternion.copy(qLogo(S.azimuth + 360 * spinE));
      const s0 = S.startSize * W;
      g.scale.setScalar(s0);
      g.position.set(0, S.depth * Math.cos(S.elevation * D) / 2 * s0, 0);
      renderer.domElement.style.opacity = clamp((t - T0 + S.fadeIn) / S.fadeIn);
      shape(0, 0);
      renderer.render(scene, camera);
      return;
    }
    renderer.domElement.style.visibility = 'hidden';
    const ae = aeAt(t), M = mapper();
    ov.style.background = ae < 1.0 ? S.bg : C.background;     // snap cut at AE 1.0
    if (ae < 2.4) {   // the flat H (and, until the cut, the cream sides) replaying the AE morph
      flat.style.visibility = 'visible';
      bars.forEach(b => { b.style.visibility = 'hidden'; });
      const toScr = logoScreen(), keep = 1 - morphK(ae);
      const h0 = AE.h[0][0], hNow = sampleAt(AE.h, ae)[0];
      hPath.setAttribute('d', pathD(hNow, startOffsets(h0, H_LABELS, M, toScr), keep, M));
      if (ae < 1.0) {
        const s0p = AE.sides[0], sNow = sampleAt(AE.sides, ae);
        sideA.setAttribute('d', pathD(sNow[0], startOffsets(s0p[0], SIDE_LABELS[0], M, toScr), keep, M));
        sideB.setAttribute('d', pathD(sNow[1], startOffsets(s0p[1], SIDE_LABELS[1], M, toScr), keep, M));
        sideA.style.display = sideB.style.display = '';
      } else sideA.style.display = sideB.style.display = 'none';
    } else {          // snap cut to the pillars: AE's tightening motion, landing on the website's final bars
      flat.style.visibility = 'hidden';
      const L = AE.bars.length - 1, f = clamp((ae - 2.4) / 0.32) * L, i = Math.min(Math.floor(f), L - 1), u = f - i;
      const fin = finalRects(), end = AE.bars[L];
      bars.forEach((b, bi) => {
        const now = AE.bars[i][bi].map((v, k) => lerp(v, AE.bars[i + 1][bi][k], u));
        const [x, y, w0, h0] = fin[bi], e = [x, y, x + w0, y + h0].map((v, k) => v + (now[k] - end[bi][k]));
        const x0 = M.X(e[0]), y0 = M.Y(e[1]), x1 = M.X(e[2]), y1 = M.Y(e[3]);
        b.style.visibility = 'visible';
        b.style.background = C.yellow;
        b.style.transform = `translate(${x0}px, ${y0}px) scale(${(x1 - x0) / 100}, ${(y1 - y0 + (bi === 1 ? 1 : 0)) / 100})`;
      });
    }
    if (t >= tContent && !handed) { handed = true; window.haloStructureDone?.(); }
    ov.style.opacity = 1 - clamp((t - tHand) / S.fade);
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
    times: { T0, Tm, tCut, tBars, tLand, tContent, tHand, T5 } };
}

// 3D pre-intro (from iso-h, "Negative space H to isometric 3D"): on a cream floor four lines
// draw in, the four yellow bars pop up out of the floor into the negative-space H (isometric
// view, black outlines), hold a beat, then the camera swings snappily round and up until it
// looks straight down: the outlines and floor lines fade and the H lands as the flat artwork,
// exactly where the DOM bars of scene 1 sit. At that moment this canvas hides and main.js's
// timeline (which started paused at scene 1, underneath) carries on.
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';

const HC = window.HALO_CONFIG, P = HC.pre3d;
// world units: bar width = 1. Proportions measured from scene 1's rects (bar 71 design px).
const rects = HC.scenes[0].rects, px = rects[0][2];
const W = 1, BH = 1, L = rects[0][3] / px, ML = rects[1][3] / px;
const S = (rects[1][0] - rects[0][0]) / px, GAP = (rects[2][1] - rects[1][1] - rects[1][3]) / px;
const mz = (GAP + ML) / 2;
// the H's centre in the 1920x1080 frame (scene 1 is 'fit': uniform scale, centred)
const hcx = (rects[0][0] + rects[3][0] + rects[3][2]) / 2, hcy = (rects[0][1] + rects[0][1] + rects[0][3]) / 2;

const canvasWrap = document.createElement('div');
canvasWrap.id = 'pre3d';
canvasWrap.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;';
document.body.appendChild(canvasWrap);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2));
renderer.setClearColor(new THREE.Color(HC.background));
canvasWrap.appendChild(renderer.domElement);
// everything below the floor is clipped, so the bars read as growing out of it
renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.03)];
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

const yellowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(HC.yellow), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const edgeMat = new LineMaterial({ color: 0x0b0b0b, linewidth: P.lineWidth, transparent: true });
const gridMat = new LineMaterial({ color: 0x0b0b0b, linewidth: P.lineWidth, transparent: true });

function bar(len, x, z) {
  const geo = new THREE.BoxGeometry(W, BH, len);
  const mesh = new THREE.Mesh(geo, yellowMat);
  mesh.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo)), edgeMat));
  scene.add(mesh);
  return { mesh, x, z };
}
// left, far middle (top on screen once flat), near middle, right
const bars = [bar(L, -S, 0), bar(ML, 0, -mz), bar(ML, 0, mz), bar(L, S, 0)];

// four floor lines framing the H, drawn trim-path style
const R = 60;
const lines = [];
function line(a, b, delay) {
  const geo = new LineSegmentsGeometry().setPositions([a.x, 0, a.z, a.x, 0, a.z]);
  const obj = new LineSegments2(geo, gridMat);
  obj.frustumCulled = false;
  scene.add(obj);
  lines.push({ obj, a, b, delay });
}
const v = (x, z) => ({ x, z });
const fx = S + W / 2, fz = L / 2;
line(v(-R, -fz), v(R, -fz), 0);
line(v(-R, fz), v(R, fz), P.gridStagger);
line(v(-fx, R), v(-fx, -R), P.gridFamilyDelay);
line(v(fx, R), v(fx, -R), P.gridFamilyDelay + P.gridStagger);

const clamp01 = x => Math.min(Math.max(x, 0), 1), lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const ease = HC.easeFn || easeInOut;   // the site's snappy bezier

let aspect = 1, vw = 1, vh = 1;
function resize() {
  vw = innerWidth; vh = innerHeight; aspect = vw / vh;
  renderer.setSize(vw, vh);
  const pr = renderer.getPixelRatio();
  for (const m of [edgeMat, gridMat]) { m.resolution.set(vw * pr, vh * pr); m.linewidth = P.lineWidth * pr; }
}
resize();
addEventListener('resize', resize);

// face 0 = iso view, 1 = straight down with the H framed exactly as scene 1's DOM bars
function placeCamera(face) {
  const el = THREE.MathUtils.degToRad(lerp(P.elevation, 89.9, face));
  const az = THREE.MathUtils.degToRad(lerp(P.azimuth, 0, face));
  const s = Math.min(vw / 1920, vh / 1080), unit = px * s;   // screen px per world unit when flat
  const isoH = (aspect >= 1 ? P.viewWidth : P.viewWidthPortrait) / aspect;
  const flatH = vh / unit;
  const frameH = lerp(isoH, flatH, face), frameW = frameH * aspect;
  // flat: shift the frame so the H's centre lands where scene 1's centre is on screen
  const offY = face * (-(hcy - 540) * s / unit), offX = face * (-(hcx - 960) * s / unit);
  const target = new THREE.Vector3(0, lerp(BH / 2, BH, face), 0);
  camera.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(120).add(target);
  camera.lookAt(target);
  camera.top = frameH / 2 - offY; camera.bottom = -frameH / 2 - offY;
  camera.left = -frameW / 2 + offX; camera.right = frameW / 2 + offX;
  camera.updateProjectionMatrix();
}

let start = performance.now(), frozen = null, done = false;
function frame(now) {
  if (done) return;
  requestAnimationFrame(frame);
  const t = frozen ?? (now - start) / 1000;
  // grid lines draw across, then stay
  for (const l of lines) {
    const e = easeInOut(clamp01((t - l.delay) / P.gridDraw)), arr = l.obj.geometry.attributes.instanceStart.data.array;
    arr[3] = lerp(l.a.x, l.b.x, e); arr[5] = lerp(l.a.z, l.b.z, e);
    l.obj.geometry.attributes.instanceStart.data.needsUpdate = true;
    l.obj.visible = e > 0;
  }
  // bars pop up out of the floor (overshoot, settle), one after another
  bars.forEach((b, i) => {
    const u = clamp01((t - P.popAt - i * P.popStagger) / P.popDur);
    b.mesh.visible = u > 0;
    b.mesh.position.set(b.x, lerp(-BH - 0.02, 0, easeOutBack(u)) + BH / 2, b.z);
  });
  // the swing to flat: snappy, outlines + floor lines fade on the way
  const face = ease(clamp01((t - P.swingAt) / P.swingDur));
  placeCamera(face);
  edgeMat.opacity = gridMat.opacity = 1 - face;
  edgeMat.visible = gridMat.visible = face < 0.999;
  renderer.render(scene, camera);
  if (frozen == null && t >= P.swingAt + P.swingDur) finish();
}
// hand over: the DOM bars underneath are already in the identical place
function finish() {
  if (done) return;
  done = true;
  window.haloBeginTimeline?.();
  canvasWrap.remove();
  renderer.dispose();
}
if (P && P.enabled) requestAnimationFrame(frame); else finish();

window.haloPre3d = {
  freeze: s => { frozen = s; },   // hold the pre-intro at s seconds (only before it has handed over)
  play: () => { frozen = null; start = performance.now(); },
  finish,
};

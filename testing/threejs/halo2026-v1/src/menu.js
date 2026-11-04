// Menu art: the homepage's H (its four bars, same proportions and isometric
// view) floating on the right of the full-screen menu, oversized so it runs
// slightly off the edge of the page. Drawn in the same hidden-line style as the
// other scenes (fills in the background colour, outlines as fat lines). It
// fades in as the menu opens, tipped forwards and turning constantly, leaning a little
// towards the cursor.
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';
import { CONFIG as HC } from './config.js';

const C = {
  bg: 0xe5ff00,
  ink: 0x0b0b0b,
  lineWidth: 0.75,        // CSS pixels, as the homepage scenes
  elevation: HC.elevation,   // the homepage's isometric view
  azimuth: HC.azimuth,
  viewWidth: 5,           // visible world width (landscape); smaller = bigger H (it's ~9.3 across)
  viewWidthPortrait: 4,
  centreX: 0.62,          // where the H's centre sits across the screen (landscape)
  centreY: 0.64,          // ... and down the screen (0 = top)
  enter: { time: 1.1 },   // seconds for the lines to fade in as the menu opens
  tilt: 36,               // degrees it's tipped forwards (towards you) from lying flat
  spin: 9,                // degrees a second it turns, constantly, about the axis along its uprights (like a revolving sign)
  mouseTilt: [6, 3],      // degrees the cursor turns / tips it at the window edge
};

const host = document.getElementById('menu-h');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(2);   // like the other scenes, so the lines come out the same weight
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

const fillMat = new THREE.MeshBasicMaterial({
  color: C.bg, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const lineMat = new LineMaterial({ color: C.ink, linewidth: C.lineWidth, transparent: true, opacity: 0 });

// the H, laid out as on the homepage: two full-length outer bars along Z, and
// the middle bar split by the crossbar gap
const W = HC.barWidth, BH = HC.barHeight, L = HC.barLength, S = HC.barSpacing;
const ML = (L - HC.middleGap) / 2, mz = (HC.middleGap + ML) / 2;
const hGroup = new THREE.Group();
for (const [len, x, z] of [[L, -S, 0], [ML, 0, -mz], [ML, 0, mz], [L, S, 0]]) {
  const geo = new THREE.BoxGeometry(W, BH, len);
  const box = new THREE.Mesh(geo, fillMat);
  box.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo)), lineMat));
  box.position.set(x, 0, z);
  hGroup.add(box);
}
// spin turns the H about the axis along its uprights; tilt tips that forwards, towards
// the viewer (about the screen's horizontal), and carries the cursor lean
const spin = new THREE.Group(), tilt = new THREE.Group();
spin.add(hGroup);
tilt.add(spin);
scene.add(tilt);

const deg = THREE.MathUtils.degToRad;
const el = deg(C.elevation), az = deg(C.azimuth);
camera.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(50);
camera.lookAt(0, 0, 0);
const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion();

let running = false;
function size() {
  const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
  renderer.setSize(w, h);
  const landscape = aspect >= 1;
  const vw = landscape ? C.viewWidth : C.viewWidthPortrait, vh = vw / aspect;
  // shift the frame so the H's centre lands at centreX / centreY of the screen
  const cx = landscape ? C.centreX : 0.45, cy = landscape ? C.centreY : 0.72;
  camera.left = -vw * cx; camera.right = vw * (1 - cx);
  camera.top = vh * cy; camera.bottom = -vh * (1 - cy);
  camera.updateProjectionMatrix();
  const px = renderer.getPixelRatio();
  lineMat.resolution.set(w * px, h * px);
  lineMat.linewidth = C.lineWidth * px;
}
addEventListener('resize', () => { if (running) size(); });

let mx = 0, my = 0, tmx = 0, tmy = 0;
addEventListener('pointermove', e => {
  tmx = (e.clientX / window.innerWidth) * 2 - 1;
  tmy = (e.clientY / window.innerHeight) * 2 - 1;
});

const easeOut = u => 1 - Math.pow(1 - u, 3);
let raf = 0, started = 0, last = 0;
function frame(now) {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const t = (now - started) / 1000, dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const k = 1 - Math.exp(-3 * dt);
  mx += (tmx - mx) * k; my += (tmy - my) * k;
  // the lines fade in as the menu opens; it turns constantly, tipped forwards,
  // leaning a little towards the cursor
  lineMat.opacity = easeOut(Math.min(1, t / C.enter.time));
  spin.rotation.z = deg(C.spin * t);
  tilt.quaternion.setFromAxisAngle(screenRight, deg(C.tilt + my * C.mouseTilt[1]))
    .premultiply(_qa.setFromAxisAngle(up, deg(mx * C.mouseTilt[0])));
  renderer.render(scene, camera);
}

// called each time the menu opens: the H fades in afresh
export function start() {
  size();
  running = true;
  started = last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// called when the menu closes
export function stop() {
  running = false;
  cancelAnimationFrame(raf);
}

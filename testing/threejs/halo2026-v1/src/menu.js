// Menu bars: four outlined bars that drop into the full-screen menu, tumble
// under gravity, knock into each other and the screen edges, and react to the
// cursor (sweeping through one shoves it; pressing on one picks it up).
//
// Physics is 2D (Matter.js, in screen pixels); each bar is drawn as a 3D box in
// the same hidden-line style as the structure (fills in the background colour,
// outlines as fat lines), tilted about its length so a side and an end show.
// The physics rectangle is the box's on-screen footprint.
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';

const C = {
  bg: 0xe5ff00,
  ink: 0x0b0b0b,
  lineWidth: 0.75,        // CSS pixels, as the HP Hero scenes
  count: 4,
  length: 0.36,           // bar length, as a fraction of the screen's long side
  thickness: 0.16,        // square section, as a fraction of the length
  tilt: [38, 22],         // degrees about the bar's length, and across it (shows a side and an end)
  spawnX: [0.08, 0.92],   // across the screen they drop in somewhere in here (fractions of the width), each open a new mix
  stagger: 0.18,          // seconds between drops
  gravity: 1.6,           // Matter's gravity scale (1 = its default)
  restitution: 0.92,      // bounciness (0 = dead stop, 1 = no energy lost)
  friction: 0.2,
  frictionAir: 0.012,
  push: 0.1,              // how much of the cursor's speed a bar it sweeps through picks up
  pushMax: 8,             // px per step (60 steps a second)
  maxSpeed: 22,           // px per step: nothing moves faster than this (also limits a drag-and-throw)
  // 3D turning (rad per step): starting spin as they drop, how hard impacts above
  // `kickFrom` px/step of velocity change kick it, how many times the bar's 2D
  // spin its roll follows, drag per step, how firmly a resting bar settles onto a
  // face, and the yaw's spring and how far it may swing (rad) from its usual angle
  spin3d: { drop: 0.06, kickFrom: 4, kick: 0.008, follow: 1.5, drag: 0.97, settle: 0.04, yawSpring: 0.02, yawRange: 0.45 },
};

// Matter.js is a classic script (UMD); load it once
let matterReady = null;
function loadMatter() {
  return (matterReady ??= new Promise((resolve, reject) => {
    if (window.Matter) return resolve(window.Matter);
    const s = document.createElement('script');
    s.src = './vendor/matter/matter.min.js';
    s.onload = () => resolve(window.Matter);
    s.onerror = reject;
    document.head.appendChild(s);
  }));
}

const host = document.getElementById('menu-bars');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(2);   // like the other scenes, so the lines come out the same weight
// Matter's mouse reads this to map pointer positions onto the 2x canvas
renderer.domElement.setAttribute('data-pixel-ratio', '2');
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
// orthographic in screen pixels: x right, y up (physics y is down, so it's flipped when drawn)
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
camera.position.z = 1000;

const fillMat = new THREE.MeshBasicMaterial({
  color: C.bg, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const lineMat = new LineMaterial({ color: C.ink, linewidth: C.lineWidth });

let W = 1, H = 1;
function size() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H);
  camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
  camera.updateProjectionMatrix();
  const px = renderer.getPixelRatio();
  lineMat.resolution.set(W * px, H * px);
  lineMat.linewidth = C.lineWidth * px;
}

let Matter = null, engine = null, walls = [], bars = [], slots = [], raf = 0, running = false;

// one bar: a tilted box drawn in 3D, and its on-screen footprint as a physics body
function makeBar(i, len, thick) {
  const geo = new THREE.BoxGeometry(len, thick, thick);
  const box = new THREE.Mesh(geo, fillMat);
  box.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo)), lineMat));
  const sign = i % 2 ? -1 : 1;
  box.rotation.set(THREE.MathUtils.degToRad(C.tilt[0]), THREE.MathUtils.degToRad(C.tilt[1] * sign), 0, 'YXZ');
  box.updateMatrix();
  // footprint: the extent of the tilted box's corners on screen
  const v = new THREE.Vector3(), bb = new THREE.Box3();
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    bb.expandByPoint(v.set(x * len / 2, y * thick / 2, z * thick / 2).applyMatrix4(box.matrix));
  }
  const group = new THREE.Group();
  group.add(box);
  // each bar a little further back, so where they overlap on screen they draw in a fixed order
  group.position.z = -i * (thick * 2);
  scene.add(group);
  // its own slot across the screen (slots shuffled each time), anywhere within it, from a random height
  const x = W * THREE.MathUtils.lerp(C.spawnX[0], C.spawnX[1], (slots[i] + Math.random()) / C.count);
  const body = Matter.Bodies.rectangle(x, -len * (0.6 + Math.random() * 1.6), bb.max.x - bb.min.x, bb.max.y - bb.min.y, {
    restitution: C.restitution, friction: C.friction, frictionAir: C.frictionAir, chamfer: { radius: 2 },
  });
  Matter.Body.setAngle(body, (Math.random() - 0.5) * 1.6);
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
  const roll = box.rotation.x, yaw = box.rotation.y;
  return {
    body, group, box, at: i * C.stagger, added: false,
    // 3D turning on top of the 2D physics: roll about its own length and yaw
    // across it, each spinning a little as it drops and kicked by every impact
    roll, rollRest: roll, rollVel: (Math.random() - 0.5) * C.spin3d.drop,
    yaw, yawRest: yaw, yawVel: (Math.random() - 0.5) * C.spin3d.drop * 0.5,
    prevV: { x: 0, y: 0 },
  };
}

// After each physics step: the roll (about the bar's length) eases towards
// spinning with the bar's own 2D spin and gets a kick from every hard impact;
// the yaw (across it) wobbles on a spring round its usual angle, never far
// enough to turn a bar end-on. Once a bar is resting it rolls onto its nearest
// flat face, so it lies still the way a real bar would.
const QUARTER = Math.PI / 2;
function spin3d(b) {
  const S = C.spin3d, v = b.body.velocity;
  const hit = Math.hypot(v.x - b.prevV.x, v.y - b.prevV.y);
  b.prevV = { x: v.x, y: v.y };
  if (hit > S.kickFrom) {
    const k = Math.min(hit - S.kickFrom, 10) * S.kick;
    b.rollVel += (Math.random() < 0.5 ? -1 : 1) * k;
    b.yawVel += (Math.random() - 0.5) * k;
  }
  b.rollVel += (b.body.angularVelocity * S.follow - b.rollVel) * 0.03;
  b.rollVel *= S.drag;
  b.yawVel = (b.yawVel + (b.yawRest - b.yaw) * S.yawSpring) * S.drag;
  // resting: settle onto a face
  if (Math.hypot(v.x, v.y) < 0.6 && Math.abs(b.body.angularVelocity) < 0.01) {
    const face = b.rollRest + Math.round((b.roll - b.rollRest) / QUARTER) * QUARTER;
    b.rollVel = (b.rollVel + (face - b.roll) * S.settle) * 0.85;
  }
  b.roll += b.rollVel;
  b.yaw = THREE.MathUtils.clamp(b.yaw + b.yawVel, b.yawRest - S.yawRange, b.yawRest + S.yawRange);
}

function makeWalls() {
  const t = 400;   // thick, so nothing tunnels through
  const opts = { isStatic: true, friction: 0.6, restitution: 0.1 };
  return [
    Matter.Bodies.rectangle(W / 2, H + t / 2, W + 2 * t, t, opts),          // floor
    Matter.Bodies.rectangle(-t / 2, H / 2 - H, t, H * 4, opts),              // left
    Matter.Bodies.rectangle(W + t / 2, H / 2 - H, t, H * 4, opts),           // right
    Matter.Bodies.rectangle(W / 2, -2.5 * H - t / 2, W + 2 * t, t, opts),   // a ceiling well above the drop-in height
  ];
}

function build() {
  for (const b of bars) {
    scene.remove(b.group);
    b.group.traverse(o => o.geometry?.dispose());
  }
  Matter.Composite.clear(engine.world, false);
  const long = Math.max(W, H);
  const len = Math.min(long * C.length, H * 0.7), thick = len * C.thickness;
  walls = makeWalls();
  Matter.Composite.add(engine.world, walls);
  // a shuffled slot per bar, so they land spread out but in a different arrangement each open
  slots = Array.from({ length: C.count }, (_, i) => i).sort(() => Math.random() - 0.5);
  bars = Array.from({ length: C.count }, (_, i) => makeBar(i, len, thick));
}

// the cursor: sweeping through a bar shoves it along; pressing on one picks it up
let pointer = null, last = null, mouseConstraint = null;
addEventListener('pointermove', e => {
  const now = performance.now();
  pointer = { x: e.clientX, y: e.clientY };
  if (running && last && engine) {
    const dt = Math.max(1, now - last.t) / (1000 / 60);   // in physics steps
    const vx = (e.clientX - last.x) / dt, vy = (e.clientY - last.y) / dt;
    for (const b of Matter.Query.point(bars.filter(b => b.added).map(b => b.body), pointer)) {
      if (mouseConstraint?.body === b) continue;
      const k = C.push, m = C.pushMax;
      Matter.Body.setVelocity(b, {
        x: THREE.MathUtils.clamp(b.velocity.x + vx * k, -m, m),
        y: THREE.MathUtils.clamp(b.velocity.y + vy * k, -m, m),
      });
      // a shove off-centre spins it
      const r = { x: pointer.x - b.position.x, y: pointer.y - b.position.y };
      Matter.Body.setAngularVelocity(b, b.angularVelocity + (r.x * vy - r.y * vx) * 0.00004 * k);
    }
  }
  last = { x: e.clientX, y: e.clientY, t: now };
});

// fixed 60 Hz physics steps (Matter goes unstable with a varying step), as
// many as the frame needs, capped so a stalled tab doesn't spiral
const STEP = 1000 / 60;
let started = 0, prevT = 0, carry = 0;
function frame(now) {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const t = (now - started) / 1000;
  for (const b of bars) {
    if (!b.added && t >= b.at) { Matter.Composite.add(engine.world, b.body); b.added = true; }
  }
  carry = Math.min(carry + now - prevT, STEP * 4);
  prevT = now;
  while (carry >= STEP) {
    Matter.Engine.update(engine, STEP);
    carry -= STEP;
    for (const b of bars) {
      const v = b.body.velocity, s = Math.hypot(v.x, v.y);
      if (s > C.maxSpeed) Matter.Body.setVelocity(b.body, { x: v.x * C.maxSpeed / s, y: v.y * C.maxSpeed / s });
      if (b.added) spin3d(b);
    }
  }
  for (const b of bars) {
    b.group.visible = b.added;
    b.box.rotation.x = b.roll;
    b.box.rotation.y = b.yaw;
    b.group.position.x = b.body.position.x;
    b.group.position.y = -b.body.position.y;
    b.group.rotation.z = -b.body.angle;
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  if (!engine) return;
  size();
  // move the walls to the new edges; bars stay where they are
  Matter.Composite.remove(engine.world, walls);
  walls = makeWalls();
  Matter.Composite.add(engine.world, walls);
});

// called each time the menu opens: fresh bars drop in
export async function start() {
  Matter = await loadMatter();
  if (!engine) {
    engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 * C.gravity } });
    mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: Matter.Mouse.create(renderer.domElement),
      constraint: { stiffness: 0.15, damping: 0.1, render: { visible: false } },
    });
  }
  size();
  build();
  Matter.Composite.add(engine.world, mouseConstraint);
  running = true;
  started = prevT = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// called when the menu closes
export function stop() {
  running = false;
  cancelAnimationFrame(raf);
}

// Debug: menuDebug.bars() lists where each bar is (px) and how fast it's moving
window.menuDebug = {
  bars: () => bars.map(b => ({ x: Math.round(b.body.position.x), y: Math.round(b.body.position.y), vx: +b.body.velocity.x.toFixed(1), vy: +b.body.velocity.y.toFixed(1), added: b.added, rollDeg: Math.round(b.roll * 57.3), yawDeg: Math.round(b.yaw * 57.3) })),
};

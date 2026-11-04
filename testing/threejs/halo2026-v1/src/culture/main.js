import * as THREE from 'three';
import { LineSegments2 } from '../../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../../vendor/three/addons/lines/LineMaterial.js';
import { CONFIG as C } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true });
// Render at least 2x so the 1-device-pixel outlines come out half a CSS pixel wide
renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, C.minDpr), C.maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
// During the intro everything below the floor is clipped away, so bars launched
// from under the floor read as growing out of it. The floor itself is
// transparent (just the four lines), so once the # has landed the mask is
// lifted and knocked-about bars can dip below the grid without being cut.
// The plane sits a hair below y=0 so edge lines lying exactly on the floor are never on the cut.
const floorClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), C.clipBelow)];
let clipOn = null;
function setFloorClip(on) {
  if (on === clipOn) return;
  clipOn = on;
  renderer.clippingPlanes = on ? floorClip : [];
}
setFloorClip(true);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.background);

const W = C.barWidth, H = C.barHeight, L = C.barLength, O = C.barOffset;

// ---------------------------------------------------------------------------
// Camera: orthographic, looking down at the # from `elevation` / `azimuth`.
// ---------------------------------------------------------------------------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const target = new THREE.Vector3(0, H, 0);   // the # spans y = 0..2H

let curAz = C.azimuth;   // degrees; drifts with C.orbitSpeed
function placeCamera(azDeg = curAz) {
  curAz = azDeg;
  const el = THREE.MathUtils.degToRad(C.elevation);
  const az = THREE.MathUtils.degToRad(azDeg);
  camera.position
    .set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
    .multiplyScalar(120)
    .add(target);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

// ---------------------------------------------------------------------------
// Grid: four GL lines on the floor (one cell), each drawn trim-path style
// (the end vertex slides from start to finish) with a per-line stagger.
// Extent is computed from what the camera can actually see, so every line
// draws across the visible screen rather than starting far off-screen.
// ---------------------------------------------------------------------------
const gridGroup = new THREE.Group();
scene.add(gridGroup);
// fat lines (three's LineSegments2) at C.lineWidth CSS px, the same weight as the
// other Halo scenes; plain GL lines are always 1 device pixel
const gridMat = new LineMaterial({ color: C.gridColor, linewidth: C.lineWidth });
let gridLines = [];
let gridDone = 0;   // time (s) when the last line finishes

function floorPoint(nx, ny) {
  const p = new THREE.Vector3(nx, ny, -1).unproject(camera);
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
  return p.addScaledVector(dir, -p.y / dir.y);
}

function buildGrid() {
  for (const l of gridLines) { gridGroup.remove(l.obj); l.obj.geometry.dispose(); }
  gridLines = [];

  const corners = [floorPoint(-1, -1), floorPoint(1, -1), floorPoint(1, 1), floorPoint(-1, 1)];
  const m = 1.5;
  const minX = Math.min(...corners.map(c => c.x)) - m, maxX = Math.max(...corners.map(c => c.x)) + m;
  const minZ = Math.min(...corners.map(c => c.z)) - m, maxZ = Math.max(...corners.map(c => c.z)) + m;
  // once drawn, lines extend to this radius so they reach the screen edge at any orbit angle
  const R = Math.max(...corners.map(c => c.length())) + m;

  // Exactly four lines, one cell: the "/" pair (along Z) runs flush along the
  // outer faces of the bottom bars, the "\\" pair (along X) along their end
  // faces. The top bars overhang the cell, as in the reference.
  const xLines = [-(O + W / 2), O + W / 2];   // lines parallel to Z, at these x
  const zLines = [-L / 2, L / 2];             // lines parallel to X, at these z
  const family = (isX, t0) => {
    const at = isX ? zLines : xLines;
    at.forEach((c, i) => {
      // both families draw left-to-right on screen: X lines from -X, Z lines from +Z
      const a = isX ? new THREE.Vector3(minX, 0, c) : new THREE.Vector3(c, 0, maxZ);
      const b = isX ? new THREE.Vector3(maxX, 0, c) : new THREE.Vector3(c, 0, minZ);
      const fa = isX ? new THREE.Vector3(-R, 0, c) : new THREE.Vector3(c, 0, R);
      const fb = isX ? new THREE.Vector3(R, 0, c) : new THREE.Vector3(c, 0, -R);
      const geo = new LineSegmentsGeometry().setPositions([a.x, a.y, a.z, a.x, a.y, a.z]);
      const obj = new LineSegments2(geo, gridMat);
      obj.frustumCulled = false;
      gridGroup.add(obj);
      const delay = t0 + i * C.gridDrawStagger;
      gridLines.push({ obj, a, b, fa, fb, delay });
      gridDone = Math.max(gridDone, delay + C.gridDrawDuration);
    });
  };
  gridDone = 0;
  family(true, 0);
  family(false, C.gridFamilyDelay);
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateGrid(t) {
  for (const l of gridLines) {
    const p = THREE.MathUtils.clamp((t - l.delay) / C.gridDrawDuration, 0, 1);
    const e = easeInOut(p);
    const seg = l.obj.geometry.attributes.instanceStart.data;   // [x0 y0 z0 x1 y1 z1]
    const arr = seg.array;
    if (p < 1) {
      arr[0] = l.a.x; arr[2] = l.a.z;
      arr[3] = l.a.x + (l.b.x - l.a.x) * e;
      arr[5] = l.a.z + (l.b.z - l.a.z) * e;
    } else {
      // fully drawn: swap to the long endpoints (happens off-screen, so invisible)
      arr[0] = l.fa.x; arr[2] = l.fa.z;
      arr[3] = l.fb.x; arr[5] = l.fb.z;
    }
    seg.needsUpdate = true;
    l.obj.visible = p > 0;
  }
}

// ---------------------------------------------------------------------------
// Bars: flat yellow boxes with black visible edges. Two "top" bars run along
// X and rest on two "bottom" bars that run along Z.
// ---------------------------------------------------------------------------
const yellowMat = new THREE.MeshBasicMaterial({
  color: C.yellow,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // faces sit behind their own edge lines
});
const edgeMat = new LineMaterial({ color: C.edgeColor, linewidth: C.lineWidth, transparent: true, opacity: C.edgeOpacity });

const topGeo = new THREE.BoxGeometry(L, H, W);
const bottomGeo = new THREE.BoxGeometry(W, H, L);
const topEdges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(topGeo));
const bottomEdges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(bottomGeo));

function makeBar(kind, x, z, spawnAt) {
  const mesh = new THREE.Mesh(kind === 'top' ? topGeo : bottomGeo, yellowMat);
  mesh.add(new LineSegments2(kind === 'top' ? topEdges : bottomEdges, edgeMat));
  mesh.visible = false;
  scene.add(mesh);
  return { kind, x, z, spawnAt, mesh, y: 0, vy: 0, active: false, emerged: false };
}

const s = C.barsStart;
const bodies = [
  makeBar('top', 0, -O, s),                                   // far top bar first
  makeBar('top', 0, +O, s + C.topStagger),
  makeBar('bottom', -O, 0, s + C.bottomDelay),                // then the bottom pair
  makeBar('bottom', +O, 0, s + C.bottomDelay + C.bottomStagger),
];
const tops = bodies.filter(b => b.kind === 'top');
const bottoms = bodies.filter(b => b.kind === 'bottom');

const START_Y = -H - 0.02;   // fully under the floor
const v0 = apex => Math.sqrt(2 * C.gravity * (apex - START_Y));

// ---------------------------------------------------------------------------
// Physics: 1-D vertical. Gravity everywhere; the bottom bars land on a stiff
// spring floor (they can sink a little, hidden by the clip plane); the top
// bars collide with whichever bottom bar is highest and exchange momentum.
// ---------------------------------------------------------------------------
let settled = false, settleTimer = 0;

function step(dt, t) {
  for (const b of bodies) {
    if (!b.active && t >= b.spawnAt) {
      b.active = true; b.emerged = false; b.y = START_Y;
      b.vy = v0(b.kind === 'top' ? C.topApex : C.bottomApex);
    }
    if (!b.active) continue;
    b.vy -= C.gravity * dt;
    b.vy *= Math.max(0, 1 - C.airDrag * dt);
    if (b.kind === 'bottom') {
      if (!b.emerged && b.y >= 0) b.emerged = true;
      if (b.emerged && b.y < 0) {
        // spring floor; +gravity so the equilibrium is exactly y = 0
        b.vy += (-C.floorStiffness * b.y - C.floorDamping * b.vy + C.gravity) * dt;
      }
    }
    b.y += b.vy * dt;
  }

  for (const tb of tops) {
    if (!tb.active) continue;
    let sup = null;
    for (const bb of bottoms) if (bb.active && bb.emerged && (!sup || bb.y > sup.y)) sup = bb;
    if (!sup) continue;
    const supY = sup.y + H;
    if (tb.y < supY) {
      const pen = supY - tb.y;
      tb.y += pen * 0.85;
      sup.y -= pen * 0.15;
      const vrel = tb.vy - sup.vy;
      if (vrel < 0) {
        const e = vrel < -1 ? C.restitution : 0;   // tiny approach speeds are resting contact, not bounces
        const v1 = tb.vy, v2 = sup.vy;
        tb.vy = 0.5 * ((1 - e) * v1 + (1 + e) * v2);
        sup.vy = 0.5 * ((1 + e) * v1 + (1 - e) * v2);
      }
    }
  }

  // Settle detection: everything active, slow, and near its rest height for a
  // short while -> snap to exact rest positions.
  let calm = bodies.every(b => b.active);
  for (const b of bodies) {
    const rest = b.kind === 'top' ? H : 0;
    if (Math.abs(b.vy) > C.settleSpeed || Math.abs(b.y - rest) > 0.1) calm = false;
  }
  settleTimer = calm ? settleTimer + dt : 0;
  if (settleTimer > 0.25) {
    // freeze the sim; the meshes ease the last few hundredths onto exact rest
    settled = true;
    settleSimTime = t;
    for (const b of bodies) { b.snapFrom = b.y; b.vy = 0; }
  }
}

let settleSimTime = 0;
const SNAP_SECONDS = 0.25;
const smooth = t => t * t * (3 - 2 * t);

function syncMeshes(t) {
  for (const b of bodies) {
    b.mesh.visible = b.active;
    let y = b.y;
    if (settled) {
      const rest = b.kind === 'top' ? H : 0;
      const k = smooth(THREE.MathUtils.clamp((t - settleSimTime) / SNAP_SECONDS, 0, 1));
      y = b.snapFrom + (rest - b.snapFrom) * k;
    }
    b.mesh.position.set(b.x + b.off.x, y + H / 2 + b.off.y, b.z + b.off.z);
    const ang = b.rot.length();
    if (ang > 1e-6) b.mesh.quaternion.setFromAxisAngle(_axis.copy(b.rot).divideScalar(ang), ang);
    else b.mesh.quaternion.identity();
  }
}

// ---------------------------------------------------------------------------
// Hover tumble: once the # has settled, sweeping the cursor through a bar
// kicks it (lift + shove along the cursor's motion + a tumble about the
// horizontal axis perpendicular to that motion). It moves freely under a light
// gravity for `tumbleFree` seconds, then a damped spring on both position and
// rotation pulls it back onto its rest pose with a small overshoot.
// ---------------------------------------------------------------------------
const _axis = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerMoved = false, haveLastFloor = false, lastMoveT = 0;
const lastFloor = new THREE.Vector3();
for (const b of bodies) {
  b.off = new THREE.Vector3(); b.vel = new THREE.Vector3();
  b.rot = new THREE.Vector3(); b.angVel = new THREE.Vector3();
  b.hitT = -1e9;
}

window.addEventListener('pointermove', e => {
  pointerNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointerMoved = true;
});
window.addEventListener('pointerleave', () => { haveLastFloor = false; });

// cursor projected onto the horizontal plane through the middle of the #
function pointerOnPlane(out) {
  const p = new THREE.Vector3(pointerNdc.x, pointerNdc.y, -1).unproject(camera);
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
  return out.copy(p).addScaledVector(dir, (H - p.y) / dir.y);
}

function hoverKick(t) {
  if (!pointerMoved) return;
  pointerMoved = false;
  if (!settled) { haveLastFloor = false; return; }
  const cur = pointerOnPlane(new THREE.Vector3());
  if (!haveLastFloor) { lastFloor.copy(cur); lastMoveT = t; haveLastFloor = true; return; }
  const move = cur.clone().sub(lastFloor);
  const moveDt = Math.max(t - lastMoveT, 1 / 240);
  lastFloor.copy(cur); lastMoveT = t;
  if (move.lengthSq() < 1e-8) return;
  const pointerSpeed = move.length() / moveDt;          // world units per second
  // a resting cursor must never kick: the orbiting camera alone makes a fixed
  // screen point creep across the floor at well under a unit per second
  if (pointerSpeed < C.kickMinSpeed) return;
  const dir = move.normalize();

  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(bodies.map(b => b.mesh), false);
  if (!hits.length) return;
  const b = bodies.find(x => x.mesh === hits[0].object);
  if (t - b.hitT < C.tumbleCooldown) return;
  b.hitT = t;

  // the shove scales with cursor speed so a flick sends the bar flying, a nudge just rocks it
  const shove = THREE.MathUtils.clamp(pointerSpeed * C.kickGain, C.kickMin, C.kickMax);
  const strength = shove / C.kickMax;                             // 0..1, scales lift + spin too
  b.vel.addScaledVector(_up, C.kickUp * (0.4 + 0.6 * strength)).addScaledVector(dir, shove);
  const axis = new THREE.Vector3().crossVectors(_up, dir);        // tumble away from the cursor
  b.angVel.addScaledVector(axis, C.kickSpin * (0.4 + 0.6 * strength));
  // hitting near an end also twists the bar about the vertical axis (lever arm)
  const local = hits[0].point.clone().sub(b.mesh.position);
  const torqueY = b.kind === 'top' ? -local.x * dir.z : local.z * dir.x;
  b.angVel.y += (torqueY / (L / 2)) * C.kickYaw;
}

function tumbleStep(t, dt) {
  for (const b of bodies) {
    if (b.hitT < 0) continue;
    const free = t - b.hitT < C.tumbleFree;
    if (free) {
      b.vel.y -= C.tumbleGravity * dt;
      b.vel.multiplyScalar(Math.max(0, 1 - 0.6 * dt));
      b.angVel.multiplyScalar(Math.max(0, 1 - 1.0 * dt));
    } else {
      const k = C.returnStiffness, c = C.returnDamping;
      b.vel.addScaledVector(b.off, -k * dt).multiplyScalar(Math.max(0, 1 - c * dt));
      b.angVel.addScaledVector(b.rot, -k * dt).multiplyScalar(Math.max(0, 1 - c * dt));
    }
    b.off.addScaledVector(b.vel, dt);
    b.rot.addScaledVector(b.angVel, dt);
    if (!free && b.off.lengthSq() < 1e-7 && b.vel.lengthSq() < 1e-7 &&
        b.rot.lengthSq() < 1e-7 && b.angVel.lengthSq() < 1e-7) {
      b.off.set(0, 0, 0); b.vel.set(0, 0, 0); b.rot.set(0, 0, 0); b.angVel.set(0, 0, 0);
      b.hitT = -1e9;
    }
  }
}

// ---------------------------------------------------------------------------
// Bar-on-bar collision while tumbling, on the bars' exact boxes (separating-
// axis test), so they can never pass into each other. Where two overlap they're
// pushed apart along the shallowest way out, bounce off each other with a spin
// from where they hit, and a bar that was at rest gets knocked loose (then
// springs home like a kicked one). Bars sitting on each other just touch, which
// doesn't count.
// ---------------------------------------------------------------------------
const _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _ax = new THREE.Vector3();
const HALF = { top: [L / 2, H / 2, W / 2], bottom: [W / 2, H / 2, L / 2] };
function makeBox() { return { c: new THREE.Vector3(), u: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e: null }; }
const boxA = makeBox(), boxB = makeBox();

// a bar's box right now: rest pose + tumble offset/rotation
function barBox(b, box) {
  box.c.set(b.x + b.off.x, (b.kind === 'top' ? H : 0) + H / 2 + b.off.y, b.z + b.off.z);
  const ang = b.rot.length();
  if (ang > 1e-6) _q.setFromAxisAngle(_tmp.copy(b.rot).divideScalar(ang), ang); else _q.identity();
  box.u[0].set(1, 0, 0).applyQuaternion(_q);
  box.u[1].set(0, 1, 0).applyQuaternion(_q);
  box.u[2].set(0, 0, 1).applyQuaternion(_q);
  box.e = HALF[b.kind];
  return box;
}
const radius = (box, a) => box.e[0] * Math.abs(a.dot(box.u[0])) + box.e[1] * Math.abs(a.dot(box.u[1])) + box.e[2] * Math.abs(a.dot(box.u[2]));
// how far the two boxes overlap along the shallowest axis, and that axis
// (pointing from B towards A); null when they don't overlap
function overlap(A, B) {
  _d.subVectors(A.c, B.c);
  let best = Infinity;
  const test = (a, bias) => {
    const len = a.length();
    if (len < 1e-6) return true;                         // parallel edges: no new axis
    a.divideScalar(len);
    const o = radius(A, a) + radius(B, a) - Math.abs(_d.dot(a));
    if (o <= 1e-4) return false;                         // a gap (or just touching): separated
    if (o * bias < best) { best = o * bias; _n.copy(a); }
    return true;
  };
  for (const u of [...A.u, ...B.u]) if (!test(_ax.copy(u), 1)) return null;
  // edge-edge axes, slightly discouraged so flat face contacts win ties
  for (const a of A.u) for (const b of B.u) if (!test(_ax.crossVectors(a, b), 1.05)) return null;
  if (_n.dot(_d) < 0) _n.negate();
  return best;
}
// the corner of a box furthest along a direction
const support = (box, dir, out) => {
  out.copy(box.c);
  for (let k = 0; k < 3; k++) out.addScaledVector(box.u[k], Math.sign(dir.dot(box.u[k])) * box.e[k]);
  return out;
};
const _ca = new THREE.Vector3(), _cb = new THREE.Vector3(), _ra = new THREE.Vector3(), _rb = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
// The floor is solid too: a tumbling bar's lowest corner can't go under y = 0
// (so bars never cut through the floor lines). It bounces a little, skids, and
// tips from the corner that hit.
function floorCollide() {
  for (const b of bodies) {
    if (b.hitT < 0) continue;
    const box = barBox(b, boxA);
    const pen = -(box.c.y - radius(box, _up));
    if (pen <= 0) continue;
    b.off.y += pen;
    if (b.vel.y < 0) {
      const jn = -(1 + C.floorBounce) * b.vel.y;
      b.vel.y += jn;
      b.vel.x *= 1 - C.floorFriction; b.vel.z *= 1 - C.floorFriction;
      _ra.subVectors(support(box, _down, _ca), box.c);
      b.angVel.add(_ra.cross(_up).multiplyScalar(jn * C.collideSpin));
    }
  }
}
function collide(t) {
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const A = bodies[i], B = bodies[j];
    if (A.hitT < 0 && B.hitT < 0) continue;            // both at rest: nothing moving
    const pen = overlap(barBox(A, boxA), barBox(B, boxB));
    if (pen === null) continue;
    // push apart, half each
    A.off.addScaledVector(_n, pen / 2); B.off.addScaledVector(_n, -pen / 2);
    // knock a resting bar loose (straight into the spring-home phase, so it
    // doesn't sag under the free-flight gravity)
    for (const X of [A, B]) if (X.hitT < 0) X.hitT = t - C.tumbleFree;
    // equal masses: exchange the normal velocity, with a bit of bounce
    const vn = _tmp.subVectors(A.vel, B.vel).dot(_n);
    if (vn < 0) {
      const jn = -(1 + C.collideBounce) * vn / 2;
      A.vel.addScaledVector(_n, jn); B.vel.addScaledVector(_n, -jn);
      // hitting off-centre spins them: lever arm from each centre to the
      // contact (between A's deepest corner and B's)
      const contact = support(boxA, _tmp.copy(_n).negate(), _ca).add(support(boxB, _n, _cb)).multiplyScalar(0.5);
      _ra.subVectors(contact, boxA.c); _rb.subVectors(contact, boxB.c);
      A.angVel.add(_ra.cross(_n).multiplyScalar(jn * C.collideSpin));
      B.angVel.add(_rb.cross(_n).multiplyScalar(-jn * C.collideSpin));
    }
  }
}

// ---------------------------------------------------------------------------
// Timeline / loop
// ---------------------------------------------------------------------------
const FIXED = 1 / 240;
let startTime = performance.now() / 1000;
let simTime = 0;          // physics time already integrated
let settledAt = null;
let frozen = null;        // debug: hold the scene at a fixed time

function restart() {
  startTime = performance.now() / 1000;
  placeCamera(C.azimuth);
  buildGrid();
  simTime = 0; settled = false; settleTimer = 0; settledAt = null; frozen = null;
  for (const b of bodies) {
    b.active = false; b.y = START_Y; b.vy = 0; b.snapFrom = START_Y;
    b.off.set(0, 0, 0); b.vel.set(0, 0, 0); b.rot.set(0, 0, 0); b.angVel.set(0, 0, 0); b.hitT = -1e9;
  }
  haveLastFloor = false;
  syncMeshes(0);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
  renderer.setSize(w, h);
  const px = renderer.getPixelRatio();
  for (const m of [gridMat, edgeMat]) {
    m.resolution.set(w * px, h * px);
    m.linewidth = C.lineWidth * px;
  }
  const vw = aspect >= 1 ? C.viewWidth : C.viewWidthPortrait;
  // landscape: slide the frame left so the # sits right of centre, leaving the
  // left side clear for the headline (like Structure Hero)
  const shift = aspect >= 1 ? C.offsetX * vw : 0;
  camera.left = -vw / 2 - shift; camera.right = vw / 2 - shift;
  camera.top = vw / aspect / 2; camera.bottom = -vw / aspect / 2;
  camera.updateProjectionMatrix();
  placeCamera();
  buildGrid();
}
window.addEventListener('resize', resize);
resize();

// (no click-to-replay: the intro runs once per page load; hashDebug.restart() is still available)

let lastNow = performance.now() / 1000;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastNow, 0.05);
  lastNow = now;
  const t = frozen != null ? frozen : now - startTime;

  placeCamera(C.azimuth + C.orbitSpeed * t);
  updateGrid(t);
  hoverKick(t);
  // a few substeps so a fast-flung bar can't pass through another in one frame
  // (a few passes each, so a bar pinned between the floor and another settles cleanly)
  for (let k = 0; k < 8; k++) {
    tumbleStep(t, dt / 8);
    for (let p = 0; p < 4; p++) { floorCollide(); collide(t); }
  }
  setFloorClip(!settled || C.clipAfterIntro);

  if (frozen == null && !settled) {
    // fixed-step integration, capped so a background tab can't spiral
    let steps = 0;
    while (simTime + FIXED <= t && steps < 60) { simTime += FIXED; step(FIXED, simTime); steps++; }
    if (settled) settledAt = now;
  } else if (frozen == null && C.loop && settledAt != null && now - settledAt > C.holdSeconds) {
    restart();
  }
  syncMeshes(t);
  renderer.render(scene, camera);
}
frame();

// Debug hook: hashDebug.restart(), hashDebug.freeze(seconds) for stills,
// hashDebug.state() to inspect the bodies.
window.hashDebug = {
  restart,
  freeze(sec) {
    restart();
    frozen = sec;
    while (simTime + FIXED <= sec) { simTime += FIXED; step(FIXED, simTime); }
  },
  state: () => ({
    settled, gridDone,
    bodies: bodies.map(b => ({ kind: b.kind, y: +b.y.toFixed(3), vy: +b.vy.toFixed(3), active: b.active,
      off: b.off.toArray().map(v => +v.toFixed(3)), rot: b.rot.toArray().map(v => +v.toFixed(3)) })),
  }),
  // kick bar i (0-1 top, 2-3 bottom) as if hit: hashDebug.kick(2, [8, 1, 0])
  kick(i, v, spin = [0, 0, 0]) {
    const b = bodies[i];
    b.hitT = performance.now() / 1000 - startTime;
    b.vel.fromArray(v); b.angVel.fromArray(spin);
  },
  // lowest corner of any bar (0 = on the floor, < 0 = through it)
  lowest: () => Math.min(...bodies.map(b => { const x = barBox(b, boxA); return x.c.y - radius(x, _up); })),
  // deepest overlap between any two bars right now (0 = none clipping)
  maxOverlap() {
    let m = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const o = overlap(barBox(bodies[i], boxA), barBox(bodies[j], boxB));
      if (o !== null) m = Math.max(m, o);
    }
    return m;
  },
  config: C,
};

import * as THREE from 'three';
import { CONFIG as C } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true });
// Render at least 2x so the 1-device-pixel outlines come out half a CSS pixel wide
renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, C.minDpr), C.maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
// During the intro everything below the floor is clipped away, so bars launched
// from under the floor read as growing out of it. The floor itself is
// transparent (just the four lines), so once the H has landed the mask is
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
// no scene.background: each frame clears to the cream, draws the gallery, then the H on top
renderer.autoClear = false;
renderer.setClearColor(C.background);

const W = C.barWidth, H = C.barHeight, L = C.barLength, S = C.barSpacing;
const ML = (L - C.middleGap) / 2;   // length of each middle piece

// ---------------------------------------------------------------------------
// Camera: orthographic, looking down at the H from `elevation` / `azimuth`.
// Scrolling drives it through three stages (see config):
//   face  0 .. faceEnd        swing to straight-down, H upright, outlines and
//                             grid fade -> the flat artwork
//   hold  faceEnd .. flyStart the flat H sits still, gallery falling behind it
//   fly   flyStart .. 1       a virtual camera moves straight down through the
//                             H and on through the gallery photos behind it
//
// The fly-through uses one virtual camera distance `camDist` (1 = the flat
// framing, measured from the H's plane; photos sit at depths > 0 behind it).
// Anything at depth z appears scaled by 1 / (camDist + z). The H itself stays
// orthographic (perfectly flat) and is just zoomed by 1 / camDist, which is
// exactly what that perspective gives at z = 0; once the camera is inside the
// crossbar the H is hidden and the camera carries on through the photos.
// ---------------------------------------------------------------------------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
const target = new THREE.Vector3();
const lerp = THREE.MathUtils.lerp, clamp01 = v => THREE.MathUtils.clamp(v, 0, 1);
let aspect = 1;
let sp = 0, spTarget = 0;   // scroll progress 0..1 (smoothed / raw)
let face = 0;               // 0 = iso view, 1 = flat face-on view
let camDist = 1;            // virtual camera distance from the H's plane (see above)
let showH = true;           // false once the camera is inside the crossbar
let throughDist = 0.1;      // camDist at which the camera is through the H (set by placeCamera)

// Cursor: -1..1 across the window (y up), eased so the scene drifts after it.
// Returns to centre when the cursor leaves; touch screens never set it.
let mouseX = 0, mouseY = 0, mouseTX = 0, mouseTY = 0;
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  mouseTX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseTY = -((e.clientY / window.innerHeight) * 2 - 1);
});
document.documentElement.addEventListener('pointerleave', () => { mouseTX = mouseTY = 0; });
function easeMouse(dt) {
  const k = 1 - Math.exp(-C.mouseSmooth * dt);
  mouseX += (mouseTX - mouseX) * k;
  mouseY += (mouseTY - mouseY) * k;
}
// Virtual camera slide toward the cursor once face-on, in the gallery's units
// (screen widths at camera distance 1): something at distance d shifts by
// this / d on screen, so near photos move more than deep ones (parallax).
let camShiftX = 0, camShiftY = 0;

let curAz = C.azimuth;   // degrees; drifts with C.orbitSpeed while the page is at the top
function placeCamera(azDeg = curAz) {
  curAz = azDeg;
  face = easeInOut(clamp01(sp / C.faceEnd));
  // The fly-through starts before the swing has finished (flyStart < faceEnd) and
  // eases in from rest, then runs linear (photos pass at a steady rhythm): as the
  // swing slows down the push-in picks up, so scrolling feels like one continuous move.
  const u = clamp01((sp - C.flyStart) / (1 - C.flyStart)), a = C.flyEaseIn;
  const fly = (u < a ? (u * u) / (2 * a) : u - a / 2) / (1 - a / 2);
  camDist = lerp(1, C.flyEnd, fly);

  // nearest azimuth that stands the H upright on screen (it is symmetric under 180deg)
  const azTop = Math.round(azDeg / 180) * 180;
  // in the iso view the cursor orbits / tilts the camera a little; this hands over
  // to the parallax slide (camShift) as the camera swings face-on
  const iso = 1 - face;
  const el = THREE.MathUtils.degToRad(Math.min(89.9, lerp(C.elevation, 89.9, face) + mouseY * C.mouseOrbit[1] * iso));
  const az = THREE.MathUtils.degToRad(lerp(azDeg, azTop, face) + mouseX * C.mouseOrbit[0] * iso);
  camShiftX = mouseX * C.mouseShift[0] * face;
  camShiftY = mouseY * C.mouseShift[1] * face;
  // visible height: iso framing -> bars just touching top and bottom -> inside the crossbar
  const isoH = (aspect >= 1 ? C.viewWidth : C.viewWidthPortrait) / aspect;
  const flatH = Math.max(L, ((2 * S + W) * 1.08) / aspect);
  // inside the crossbar the view is all cream: stop zooming the H there and hide it
  const minDist = (C.flyEndFill * Math.min(C.middleGap, (2 * S - W) / aspect)) / flatH;
  showH = camDist > minDist;
  throughDist = minDist;
  const frameH = lerp(isoH, flatH, face) * Math.max(camDist, minDist);
  target.set(0, lerp(H / 2, H, face), 0);   // flat view frames the bar tops

  camera.position
    .set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
    .multiplyScalar(120)
    .add(target);
  camera.lookAt(target);
  // the H sits at distance camDist, so the slide moves it by camShift / camDist
  // screen widths (capped like the photos, see mouseShiftNear): shift the
  // (orthographic) frame by that much
  const frameW = frameH * aspect, hDist = Math.max(camDist, C.mouseShiftNear);
  const offX = (camShiftX / hDist) * frameW, offY = (camShiftY / hDist) * frameW;
  camera.top = frameH / 2 + offY; camera.bottom = -frameH / 2 + offY;
  camera.left = -frameW / 2 + offX; camera.right = frameW / 2 + offX;
  camera.updateProjectionMatrix();
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
const gridMat = new THREE.LineBasicMaterial({ color: C.gridColor, transparent: true });
let gridLines = [];
let gridDone = 0;   // time (s) when the last line finishes

const raycaster = new THREE.Raycaster();
// where the screen point (NDC) lands on the horizontal plane at height y
function planePoint(nx, ny, y, out = new THREE.Vector3()) {
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const { origin, direction } = raycaster.ray;
  return out.copy(origin).addScaledVector(direction, (y - origin.y) / direction.y);
}
const floorPoint = (nx, ny) => planePoint(nx, ny, 0);

function buildGrid() {
  for (const l of gridLines) { gridGroup.remove(l.obj); l.obj.geometry.dispose(); }
  gridLines = [];

  const corners = [floorPoint(-1, -1), floorPoint(1, -1), floorPoint(1, 1), floorPoint(-1, 1)];
  const m = 1.5;
  const minX = Math.min(...corners.map(c => c.x)) - m, maxX = Math.max(...corners.map(c => c.x)) + m;
  const minZ = Math.min(...corners.map(c => c.z)) - m, maxZ = Math.max(...corners.map(c => c.z)) + m;
  // once drawn, lines extend to this radius so they reach the screen edge at any orbit angle
  const R = Math.max(...corners.map(c => c.length())) + m;

  // Exactly four lines framing the blocks: the pair along Z runs flush along the
  // formation's outer faces in x, the pair along X along its ends in z. Built at
  // the H's footprint; updateGrid slides them to hug whichever formation the
  // intro is in (gridHug).
  const xLines = [-(S + W / 2), S + W / 2];   // lines parallel to Z, at these x
  const zLines = [-L / 2, L / 2];             // lines parallel to X, at these z
  const family = (isX, t0) => {
    const at = isX ? zLines : xLines;
    at.forEach((c, i) => {
      // both families draw left-to-right on screen: X lines from -X, Z lines from +Z
      const a = isX ? new THREE.Vector3(minX, 0, c) : new THREE.Vector3(c, 0, maxZ);
      const b = isX ? new THREE.Vector3(maxX, 0, c) : new THREE.Vector3(c, 0, minZ);
      const fa = isX ? new THREE.Vector3(-R, 0, c) : new THREE.Vector3(c, 0, R);
      const fb = isX ? new THREE.Vector3(R, 0, c) : new THREE.Vector3(c, 0, -R);
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array([a.x, a.y, a.z, a.x, a.y, a.z]);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      const obj = new THREE.Line(geo, gridMat);
      obj.frustumCulled = false;
      gridGroup.add(obj);
      const delay = t0 + i * C.gridDrawStagger;
      gridLines.push({ obj, a, b, fa, fb, delay, isX, sign: Math.sign(c) });
      gridDone = Math.max(gridDone, delay + C.gridDrawDuration);
    });
  };
  gridDone = 0;
  family(true, 0);
  family(false, C.gridFamilyDelay);
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateGrid(t) {
  const [hugX, hugZ] = gridHug(t);
  for (const l of gridLines) {
    const p = THREE.MathUtils.clamp((t - l.delay) / C.gridDrawDuration, 0, 1);
    const e = easeInOut(p);
    const arr = l.obj.geometry.attributes.position.array;
    if (p < 1) {
      arr[0] = l.a.x; arr[2] = l.a.z;
      arr[3] = l.a.x + (l.b.x - l.a.x) * e;
      arr[5] = l.a.z + (l.b.z - l.a.z) * e;
    } else {
      // fully drawn: swap to the long endpoints (happens off-screen, so invisible)
      arr[0] = l.fa.x; arr[2] = l.fa.z;
      arr[3] = l.fb.x; arr[5] = l.fb.z;
    }
    // slide the line out / in to hug the current formation
    if (l.isX) arr[2] = arr[5] = l.sign * hugZ;
    else arr[0] = arr[3] = l.sign * hugX;
    l.obj.geometry.attributes.position.needsUpdate = true;
    l.obj.visible = p > 0;
  }
}

// ---------------------------------------------------------------------------
// Bars: flat yellow boxes with black visible edges, all lying on the floor
// along Z. The H is the space between them: two full-length outer bars and a
// middle bar split by the crossbar gap.
// ---------------------------------------------------------------------------
const yellowMat = new THREE.MeshBasicMaterial({
  color: C.yellow,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // faces sit behind their own edge lines
});
const edgeMat = new THREE.LineBasicMaterial({ color: C.edgeColor, transparent: true, opacity: C.edgeOpacity });

const longGeo = new THREE.BoxGeometry(W, H, L);
const shortGeo = new THREE.BoxGeometry(W, H, ML);
const longEdges = new THREE.EdgesGeometry(longGeo);
const shortEdges = new THREE.EdgesGeometry(shortGeo);

// x, z = the block's resting place in the H
function makeBar(long, x, z) {
  const mesh = new THREE.Mesh(long ? longGeo : shortGeo, yellowMat);
  mesh.add(new THREE.LineSegments(long ? longEdges : shortEdges, edgeMat));
  mesh.visible = false;
  scene.add(mesh);
  return { len: long ? L : ML, x, z, mesh };
}

const mz = (C.middleGap + ML) / 2;
const bodies = [
  makeBar(true, -S, 0),       // left outer bar
  makeBar(false, 0, -mz),     // far middle piece
  makeBar(false, 0, +mz),     // near middle piece
  makeBar(true, +S, 0),       // right outer bar
];

const START_Y = -H - 0.02;   // fully under the floor

// ---------------------------------------------------------------------------
// Intro: the blocks show off how configurable they are before settling in the
// H (where scrolling unlocks). Keyframed rather than simulated, so every
// landing is exact:
//   pop    they rise out of the floor as a closed rectangular frame
//   jump 1 leap, barrel-roll and land as a stack: the short blocks standing on
//          the floor, the long blocks resting across them (a #)
//   jump 2 leap and roll again into the final H, with a small landing bounce
// A pose is { x, z: centre on the floor, y: underside height, yaw: turn about
// the vertical (0 = long axis along Z) }. Bodies are [long, short, short, long].
// ---------------------------------------------------------------------------
// Quarter turns are -90deg (same resting pose, the blocks are symmetric): turning
// that way sweeps them across the view, whereas +90deg passes through the camera's
// own direction (azimuth ~43deg) and a long block seen end-on reads as a tall column.
const QT = -Math.PI / 2;
const frameX = ML / 2 + W / 2;   // long sides just outside the short ends
const frameZ = L / 2 - W / 2;    // short ends tucked inside the long sides' ends
const [stackX, stackZ] = C.introStack;
const FORMATIONS = {
  frame: [
    { x: -frameX, z: 0, y: 0, yaw: 0 }, { x: 0, z: -frameZ, y: 0, yaw: QT },
    { x: 0, z: frameZ, y: 0, yaw: QT }, { x: frameX, z: 0, y: 0, yaw: 0 },
  ],
  stack: [
    { x: 0, z: -stackZ, y: H, yaw: QT }, { x: -stackX, z: 0, y: 0, yaw: 0 },
    { x: stackX, z: 0, y: 0, yaw: 0 }, { x: 0, z: stackZ, y: H, yaw: QT },
  ],
  h: bodies.map(b => ({ x: b.x, z: b.z, y: 0, yaw: 0 })),
};
// Each jump: per body [takeoff delay, flight time, apex height above the straight
// line]. Jump 1: the long blocks leave first and fly longer/higher so they are
// still in the air when the short ones land, then settle on top of them.
// Jump 2: the long blocks (on top) leave first, the short ones follow.
const isLong = i => i === 0 || i === 3;
const JUMPS = [
  { from: 'frame', to: 'stack', at: C.introJump1At,
    timing: i => (isLong(i) ? [0, 1.1, 1.7] : [0.08, 0.8, 1.1]) },
  { from: 'stack', to: 'h', at: C.introJump2At,
    timing: i => (isLong(i) ? [0, 1.0, 1.5] : [0.1, 0.9, 1.2]) },
];
const introEnd = Math.max(...JUMPS.map(j => j.at + Math.max(...[0, 1, 2, 3].map(i => j.timing(i)[0] + j.timing(i)[1]))))
  + C.introBounce[1];

// Floor-line footprint of a formation: half-size in x and z of everything in it
// (a block at yaw 0 runs along Z; at a quarter turn it runs along X).
function footprint(name) {
  let fx = 0, fz = 0;
  FORMATIONS[name].forEach((p, i) => {
    const along = bodies[i].len / 2, across = W / 2;
    const alongX = Math.abs(Math.sin(p.yaw)) > 0.5;
    fx = Math.max(fx, Math.abs(p.x) + (alongX ? along : across));
    fz = Math.max(fz, Math.abs(p.z) + (alongX ? across : along));
  });
  return [fx, fz];
}
const FOOTPRINTS = Object.fromEntries(Object.keys(FORMATIONS).map(n => [n, footprint(n)]));
// The floor lines hug the frame, then glide to each new footprint over a jump
// (from take-off to the last landing), so they arrive as the blocks do.
function gridHug(t) {
  if (settled) return FOOTPRINTS.h;
  let [fx, fz] = FOOTPRINTS.frame;
  for (const j of JUMPS) {
    const span = Math.max(...[0, 1, 2, 3].map(i => j.timing(i)[0] + j.timing(i)[1]));
    const u = smooth(clamp01((t - j.at) / span));
    const [tx, tz] = FOOTPRINTS[j.to];
    fx = lerp(fx, tx, u); fz = lerp(fz, tz, u);
  }
  return [fx, fz];
}

const easeOutBack = u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
// short-way yaw blend
const lerpYaw = (a, b, u) => a + (Math.atan2(Math.sin(b - a), Math.cos(b - a))) * u;
// little hop after a landing (v: 0..1 through the bounce)
const bounce = v => (v > 0 && v < 1 ? C.introBounce[0] * Math.sin(Math.PI * v) * (1 - v) : 0);

// Pose of body i at intro time t (seconds): { x, y, z, yaw, roll, visible }
function introPose(i, t) {
  const popAt = C.introPopAt + i * C.introPopStagger;
  if (t < popAt) return null;   // not out of the floor yet
  const f = FORMATIONS.frame[i];
  let pose = { x: f.x, z: f.z, yaw: f.yaw, roll: 0,
    y: lerp(START_Y, 0, easeOutBack(clamp01((t - popAt) / C.introPopDur))) };
  JUMPS.forEach((j, k) => {
    const [delay, dur, apex] = j.timing(i);
    const t0 = j.at + delay, u = (t - t0) / dur;
    if (u <= 0) return;
    const a = FORMATIONS[j.from][i], b = FORMATIONS[j.to][i];
    if (u >= 1) {
      pose = { x: b.x, z: b.z, yaw: b.yaw, roll: 0, y: b.y + bounce((t - t0 - dur) / C.introBounce[1]) };
      return;
    }
    const s = smooth(u);
    pose = {
      x: lerp(a.x, b.x, s), z: lerp(a.z, b.z, s), yaw: lerpYaw(a.yaw, b.yaw, s),
      y: lerp(a.y, b.y, u) + 4 * apex * u * (1 - u),   // parabolic flight
      // one barrel roll about the block's own long axis, alternating direction
      roll: (i % 2 ? -1 : 1) * (k % 2 ? -1 : 1) * 2 * Math.PI * s,
    };
  });
  return pose;
}

let settled = false;   // the H has landed: scrolling and hover-kicks are on
const smooth = t => t * t * (3 - 2 * t);
const _qYaw = new THREE.Quaternion(), _qRoll = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);

function syncMeshes(t) {
  for (const [i, b] of bodies.entries()) {
    if (!settled) {
      const p = introPose(i, t);
      b.mesh.visible = !!p;
      if (!p) continue;
      b.mesh.position.set(p.x, p.y + H / 2, p.z);
      b.mesh.quaternion.multiplyQuaternions(_qYaw.setFromAxisAngle(_Y, p.yaw), _qRoll.setFromAxisAngle(_Z, p.roll));
      continue;
    }
    // rest in the H, plus any hover-tumble offset
    b.mesh.visible = true;
    b.mesh.position.set(b.x + b.off.x, H / 2 + b.off.y, b.z + b.off.z);
    const ang = b.rot.length();
    if (ang > 1e-6) b.mesh.quaternion.setFromAxisAngle(_axis.copy(b.rot).divideScalar(ang), ang);
    else b.mesh.quaternion.identity();
  }
}

// Scrolling stays locked until the H has landed (it's where the scroll story starts).
// overflow:hidden stops the wheel, and anything that still scrolls the page (touch
// on some phones, keys, scripts) is snapped back to the top by readScroll.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let scrollLocked = false;
function lockScroll(on) {
  scrollLocked = on;
  document.documentElement.style.overflow = on ? 'hidden' : '';
  document.body.style.overflow = on ? 'hidden' : '';
  if (on) window.scrollTo(0, 0);
}
lockScroll(C.introLockScroll);

// ---------------------------------------------------------------------------
// Hover tumble: once the H has settled, sweeping the cursor through a bar
// kicks it (lift + shove along the cursor's motion + a tumble about the
// horizontal axis perpendicular to that motion). It moves freely under a light
// gravity for `tumbleFree` seconds, then a damped spring on both position and
// rotation pulls it back onto its rest pose with a small overshoot.
// ---------------------------------------------------------------------------
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

// A knocked bar may never dip below the floor (the floor lines would show
// through it): lift it so its lowest corner sits on y = 0, and bounce it off.
function keepAboveFloor(b, dt) {
  const ang = b.rot.length();
  if (ang > 1e-6) _q.setFromAxisAngle(_axis.copy(b.rot).divideScalar(ang), ang);
  else _q.identity();
  const e = _m.makeRotationFromQuaternion(_q).elements;   // column-major: row 1 = e[1], e[5], e[9]
  // half-height of the rotated box along world Y
  const reach = Math.abs(e[1]) * W / 2 + Math.abs(e[5]) * H / 2 + Math.abs(e[9]) * b.len / 2;
  const minOff = reach - H / 2;   // the bar's centre rests at y = H / 2
  if (b.off.y < minOff) {
    b.off.y = minOff;
    if (b.vel.y < -0.5) {
      // a real impact: bounce, with a little scrape against the floor
      b.vel.y *= -C.floorBounce;
      b.vel.x *= 0.85; b.vel.z *= 0.85;
    } else {
      // resting / sliding contact: no bounce, gentle friction
      if (b.vel.y < 0) b.vel.y = 0;
      const f = Math.exp(-C.floorFriction * dt);
      b.vel.x *= f; b.vel.z *= f;
    }
  }
}
const _up = new THREE.Vector3(0, 1, 0);
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

// cursor projected onto the horizontal plane through the middle of the H
function pointerOnPlane(out) {
  return planePoint(pointerNdc.x, pointerNdc.y, H / 2, out);
}

function hoverKick(t) {
  if (!pointerMoved) return;
  pointerMoved = false;
  // no knocking bars about once the scroll transition has started
  if (!settled || sp > 0.001) { haveLastFloor = false; return; }
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
  const torqueY = local.z * dir.x;   // every bar's long axis is Z
  b.angVel.y += (torqueY / (b.len / 2)) * C.kickYaw;
}

// ---------------------------------------------------------------------------
// Bar-bar collision: oriented-box separating-axis test on every pair where at
// least one bar is tumbling. Overlapping bars are pushed apart along the axis of
// least penetration and exchange momentum (equal masses, `collideBounce`); a
// bar that gets hit starts its own tumble, so knocks can chain.
// ---------------------------------------------------------------------------
const _ax = [[], []];   // per box: its three world-space axes
for (const a of _ax) for (let i = 0; i < 3; i++) a.push(new THREE.Vector3());
const _hd = [[0, 0, 0], [0, 0, 0]];   // per box: half extents along those axes
const _cA = new THREE.Vector3(), _cB = new THREE.Vector3(), _d = new THREE.Vector3();
const _L = new THREE.Vector3(), _n = new THREE.Vector3(), _spin = new THREE.Vector3();

function boxFrame(b, k, centre) {
  const ang = b.rot.length();
  if (ang > 1e-6) _q.setFromAxisAngle(_axis.copy(b.rot).divideScalar(ang), ang);
  else _q.identity();
  _m.makeRotationFromQuaternion(_q).extractBasis(_ax[k][0], _ax[k][1], _ax[k][2]);
  _hd[k][0] = W / 2; _hd[k][1] = H / 2; _hd[k][2] = b.len / 2;
  centre.set(b.x + b.off.x, H / 2 + b.off.y, b.z + b.off.z);
}

// overlap of the two boxes projected on axis _L (assumed unit length)
function overlapOn() {
  let r = 0;
  for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) r += Math.abs(_ax[k][i].dot(_L)) * _hd[k][i];
  return r - Math.abs(_d.dot(_L));
}

function collidePair(a, b, t) {
  boxFrame(a, 0, _cA); boxFrame(b, 1, _cB);
  _d.subVectors(_cB, _cA);
  let best = Infinity;
  const test = () => {
    const len = _L.length();
    if (len < 1e-4) return true;   // parallel edges: no new axis
    _L.divideScalar(len);
    const o = overlapOn();
    if (o <= 0) return false;      // separating axis found
    if (o < best) { best = o; _n.copy(_L); }
    return true;
  };
  for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) { _L.copy(_ax[k][i]); if (!test()) return; }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    _L.crossVectors(_ax[0][i], _ax[1][j]); if (!test()) return;
  }
  if (_n.dot(_d) < 0) _n.negate();   // normal points from a to b
  a.off.addScaledVector(_n, -best / 2);
  b.off.addScaledVector(_n, best / 2);
  const vrel = _n.dot(_d.subVectors(b.vel, a.vel));
  if (vrel < 0) {
    const j = (-(1 + C.collideBounce) * vrel) / 2;
    a.vel.addScaledVector(_n, -j);
    b.vel.addScaledVector(_n, j);
    // a glancing knock also sets both bars tumbling about the horizontal axis
    _spin.crossVectors(_up, _n).multiplyScalar(j * C.collideSpin);
    a.angVel.sub(_spin); b.angVel.add(_spin);
  }
  for (const x of [a, b]) if (x.hitT < 0) x.hitT = t;   // a resting bar that gets hit starts tumbling
}

const TUMBLE_STEP = 1 / 240;   // substep so fast bars can't pass through each other
function tumbleStep(t, dt) {
  const n = Math.max(1, Math.ceil(dt / TUMBLE_STEP));
  for (let i = 0; i < n; i++) tumbleSubstep(t, dt / n);
}

function tumbleSubstep(t, dt) {
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
  }
  for (let p = 0; p < bodies.length; p++) for (let q = p + 1; q < bodies.length; q++) {
    if (bodies[p].hitT >= 0 || bodies[q].hitT >= 0) collidePair(bodies[p], bodies[q], t);
  }
  for (const b of bodies) {
    if (b.hitT < 0) continue;
    keepAboveFloor(b, dt);
    const free = t - b.hitT < C.tumbleFree;
    if (!free && b.off.lengthSq() < 1e-7 && b.vel.lengthSq() < 1e-7 &&
        b.rot.lengthSq() < 1e-7 && b.angVel.lengthSq() < 1e-7) {
      b.off.set(0, 0, 0); b.vel.set(0, 0, 0); b.rot.set(0, 0, 0); b.angVel.set(0, 0, 0);
      b.hitT = -1e9;
    }
  }
}

// ---------------------------------------------------------------------------
// Timeline / loop
// ---------------------------------------------------------------------------
let startTime = performance.now() / 1000;
let settledAt = null;
let frozen = null;        // debug: hold the scene at a fixed time

function restart() {
  startTime = performance.now() / 1000;
  placeCamera(C.azimuth);
  buildGrid();
  settled = false; settledAt = null; frozen = null;
  for (const b of bodies) {
    b.off.set(0, 0, 0); b.vel.set(0, 0, 0); b.rot.set(0, 0, 0); b.angVel.set(0, 0, 0); b.hitT = -1e9;
  }
  haveLastFloor = false;
  lockScroll(C.introLockScroll);
  syncMeshes(0);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  aspect = w / h;
  renderer.setSize(w, h);
  // the grid's extent is measured from the resting iso view
  const keep = sp;
  sp = 0; placeCamera(); buildGrid();
  sp = keep; placeCamera();
  galleryCam.right = w; galleryCam.top = h;
  galleryCam.updateProjectionMatrix();
  layoutGallery();
  readScroll();
}

// ---------------------------------------------------------------------------
// Gallery: photos placed in depth behind the flat H, drifting slowly down.
// They are drawn in their own screen-space pass (CSS pixels, origin
// bottom-left) before the main scene, so the yellow bars cover them. Each photo
// has a depth z behind the H and is projected with the fly-through's virtual
// camera (scale 1 / (camDist + z)), so deeper photos look smaller and scrolling
// the fly-through carries the camera through the H and then past every photo
// in turn. The scroll itself never slides them.
//
// Photos sit in a few well-separated depth layers (`galleryLayers`). They all
// fall at the same speed in the world, so on screen each layer falls at
// 1 / (1 + z): near layers race, deep ones crawl, which is the parallax.
//
// Layout is done in "hold space": how the photos look at the flat framing, in
// screen widths from the screen centre. There they are placed one by one with
// a spacing check and then lifted back to their depth. Photos only ever fall
// straight down, so photos in the same layer (same speed) just need room
// around them, also across the bottom-to-top wrap of the fall loop, while
// photos in different layers (different speeds) must not share a column, or
// they would eventually slide over each other. Either way a slight overlap,
// `galleryOverlap`, is allowed. No photo ever covers the flight path: each
// keeps its whole width at least `galleryClear` (at its depth) to one side of
// the centre line, so the camera flies between them, never through one. These
// "hold" photos fade in one by one at staggered scroll points.
//
// A second, larger set of "flight" photos lines the path behind the H. They are
// invisible at the flat framing (so it stays airy) and only start once the
// camera is through the H; each then fades up as the camera closes in, so the
// further you scroll the more projects stream past.
// ---------------------------------------------------------------------------
const galleryScene = new THREE.Scene();
const galleryCam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
const galleryGeo = new THREE.PlaneGeometry(1, 1);
const texLoader = new THREE.TextureLoader();
const galleryTex = [];   // one texture per file, shared by the photos that repeat it
let texLoaded = 0, galleryReady = false;
for (let i = 0; i < C.galleryImages; i++) {
  galleryTex.push(texLoader.load(`./assets/gallery/${String(i + 1).padStart(2, '0')}.jpg`, tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const g of gallery) if (g.mesh.material.map === tex) g.aspect = tex.image.width / tex.image.height;
    // the layout needs every photo's real shape, so it waits for all of them
    if (++texLoaded === C.galleryImages) { galleryReady = true; layoutGallery(); }
  }));
}
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // seeded so the layout is stable
const gallery = [], holdPhotos = [], flightPhotos = [];

function makePhoto(fileIndex, z) {
  const mat = new THREE.MeshBasicMaterial({
    map: galleryTex[fileIndex % C.galleryImages], transparent: true, opacity: 0, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(galleryGeo, mat);
  mesh.renderOrder = -z;   // deep photos first, nearer ones drawn over them
  mesh.visible = false;
  galleryScene.add(mesh);
  // solid cream card under each photo: where photos overlap, the nearer one hides the
  // one behind cleanly, and its fade reads as cream mist instead of see-through
  const backing = new THREE.Mesh(galleryGeo, new THREE.MeshBasicMaterial({
    color: C.background, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
  }));
  backing.renderOrder = -z - 1e-4;
  mesh.add(backing);
  const g = { mesh, backing, z, aspect: 16 / 9, placed: false, size: 0 };
  gallery.push(g);
  return g;
}

// hold photos: deal round the layers in a shuffled order, so neighbouring files aren't neighbours in depth
const nLayers = C.galleryLayers.length;
const strata = [...Array(C.galleryCount).keys()].sort(() => rnd() - 0.5);
const revealOrder = [...Array(C.galleryCount).keys()].sort(() => rnd() - 0.5);
for (let i = 0; i < C.galleryCount; i++) {
  const z = C.galleryLayers[strata[i] % nLayers];
  const g = makePhoto(i, z);
  // at the H's plane; deeper photos are made bigger so they shrink less than
  // perspective alone would (still clearly smaller, but not postage stamps)
  g.width = lerp(C.galleryWidth[0], C.galleryWidth[1], rnd()) * Math.pow(1 + z, C.galleryDepthGrow);
  // scroll point it starts fading in: evenly spaced in a shuffled order, so they arrive one at a time
  g.revealAt = lerp(C.galleryHoldReveal[0], C.galleryHoldReveal[1], (revealOrder[i] + 0.5) / C.galleryCount);
  g.X = 0; g.Y0 = 0; g.holdW = 0; g.holdH = 0;                               // hold-space layout (set by layoutGallery)
  holdPhotos.push(g);
}
// flight photos: evenly stratified in depth along the path behind the H
for (let i = 0; i < C.galleryFlightCount; i++) {
  const z = lerp(C.galleryFlightDepth[0], C.galleryFlightDepth[1], (i + 0.2 + 0.6 * rnd()) / C.galleryFlightCount);
  const g = makePhoto(C.galleryCount + i, z);
  g.width = lerp(C.galleryFlightWidth[0], C.galleryFlightWidth[1], rnd());   // world size (screen widths at distance 1)
  g.wx = 0; g.wy0 = 0;                                                        // world layout (set by layoutGallery)
  flightPhotos.push(g);
}

let galleryLoop = 1;        // hold photos' fall loop height in hold space (screen widths)
let flightLoop = 1;         // flight photos' fall loop height in world units (screen widths)
// Depends on the screen's shape, so it reruns on resize (same seed = same look).
function layoutGallery() {
  if (!galleryReady) return;
  const ar = window.innerHeight / window.innerWidth;
  const aspect = 1 / ar;
  galleryLoop = C.gallerySpan * ar;
  flightLoop = C.galleryFlightSpan * ar;
  let s = 23;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // sizes are in screen widths, which are small on a tall phone screen: scale up there
  const sizeScale = aspect < 1 ? Math.min(C.galleryPortraitScale, 1 / aspect) : 1;

  // --- hold photos (the flat framing) ---
  const placed = [];
  const gap = C.galleryGap;
  // photos may tuck under each other by up to `galleryOverlap` of the smaller one's
  // size, along one axis: enough to layer them, never enough to bury one
  const ov = C.galleryOverlap;
  const clash = (a, b) => {
    if (Math.abs(a.X - b.X) >= (a.holdW + b.holdW) / 2 + gap - ov * Math.min(a.holdW, b.holdW)) return false;
    if (a.z !== b.z) return true;   // different fall speeds: sharing a column means they'd cross
    const minDy = (a.holdH + b.holdH) / 2 + gap - ov * Math.min(a.holdH, b.holdH);
    const dy = Math.abs(a.Y0 - b.Y0);
    return Math.min(dy, galleryLoop - dy) < minDy;   // the loop wraps, so check across the seam too
  };
  // the H's three bars in hold space (screen widths), to keep photos out from behind them
  const flatW = Math.max(L, ((2 * S + W) * 1.08) / aspect) * aspect;   // world width at the flat framing
  const bars = [-S, 0, S].map(c => [(c - W / 2) / flatW, (c + W / 2) / flatW]);
  const hiddenShare = g => {
    let hidden = 0;
    for (const [a, b] of bars) hidden += Math.max(0, Math.min(b, g.X + g.holdW / 2) - Math.max(a, g.X - g.holdW / 2));
    return hidden / g.holdW;
  };
  // centre distance to the nearest placed photo (the fall loop wraps vertically)
  const spacing = g => {
    let best = Infinity;
    for (const p of placed) {
      const dy0 = Math.abs(g.Y0 - p.Y0), dy = Math.min(dy0, galleryLoop - dy0);
      best = Math.min(best, Math.hypot(g.X - p.X, dy));
    }
    return best;
  };
  // best-candidate placement: of many valid spots, keep the one furthest from the
  // photos already placed (an even, natural scatter), marked down if the bars hide it
  for (const g of holdPhotos) {
    const d = 1 + g.z;   // hold-space size = world size / (1 + z)
    g.size = g.width * sizeScale;
    g.holdW = g.size / d; g.holdH = g.holdW / g.aspect;
    const minX = g.holdW / 2 + C.galleryClear / d;   // inner edge clear of the centre line
    const maxX = 0.5;                                // centre no further out than the screen edge
    g.placed = false;
    let bestScore = -Infinity, bestX = 0, bestY = 0;
    for (let attempt = 0; attempt < C.galleryCandidates; attempt++) {
      g.X = (r() < 0.5 ? -1 : 1) * lerp(minX, Math.max(minX, maxX), r());
      g.Y0 = r() * galleryLoop;
      if (placed.some(p => clash(g, p))) continue;
      const score = Math.min(spacing(g), 1) * (1 - C.galleryAvoidBars * hiddenShare(g));
      if (score > bestScore) { bestScore = score; bestX = g.X; bestY = g.Y0; }
    }
    if (bestScore > -Infinity) { g.X = bestX; g.Y0 = bestY; g.placed = true; placed.push(g); }
  }

  // --- flight photos (the path behind the H) ---
  // Best-candidate again, but in 3D (x, wrapped y, depth), so the stream of photos
  // the camera flies through is even rather than clumped. Each keeps its inner edge
  // `galleryClear` off the centre line and stays within reach of the path, so it is
  // on screen when the camera gets close.
  const fPlaced = [];
  for (const g of flightPhotos) {
    g.size = g.width * sizeScale;
    const minX = g.size / 2 + C.galleryClear;
    const maxX = Math.max(minX, C.galleryFlightReach);
    let best = -Infinity, bx = 0, by = 0;
    for (let attempt = 0; attempt < C.galleryCandidates; attempt++) {
      const x = (r() < 0.5 ? -1 : 1) * lerp(minX, maxX, r());
      const y = r() * flightLoop;
      let near = Infinity;
      for (const p of fPlaced) {
        const dy0 = Math.abs(y - p.wy0), dy = Math.min(dy0, flightLoop - dy0);
        near = Math.min(near, Math.hypot(x - p.wx, dy, (g.z - p.z) * C.galleryFlightDepthWeight));
      }
      if (near > best) { best = near; bx = x; by = y; }
    }
    g.wx = bx; g.wy0 = by; g.placed = true;
    fPlaced.push(g);
  }
}

// edge fade for a position round a fall loop (0..1), so the wrap never pops
const loopEdge = f => smooth(clamp01(f / 0.12)) * smooth(clamp01((1 - f) / 0.12));

let galleryAlpha = 0;
function updateGallery(now) {
  // fade any stragglers as the end circle closes over the screen, so none draw over the solid yellow
  const endFade = smooth(clamp01((camDist - C.circleFullAt) / C.galleryEndFade));
  galleryAlpha = sp > C.galleryHoldReveal[0] ? endFade : 0;
  if (galleryAlpha < 0.001) {
    // the gallery pass may still draw (for the end circle), so hide every photo
    for (const g of gallery) g.mesh.visible = false;
    return;
  }
  const w = window.innerWidth, h = window.innerHeight;
  const [fogNear, fogFar] = C.galleryFog;
  // flight photos only start once the camera is through the H, then each fades up
  // as the camera closes in on it: the further you scroll, the more there are
  const through = smooth(clamp01((throughDist - camDist) / C.galleryFlightGate));

  for (const g of gallery) {
    const dist = camDist + g.z;
    const k = 1 / dist;   // perspective scale; <= 0 or huge = passed the camera
    let x, y, edge, alpha;
    if (g.wx === undefined) {
      // hold photo: hold space -> world at depth z (x d)
      const d = 1 + g.z;
      const fall = (now * C.gallerySpeed * (h / w)) / d;   // hold-space distance fallen: deeper = slower
      const f = ((((g.Y0 - fall) % galleryLoop) + galleryLoop) % galleryLoop) / galleryLoop;
      x = g.X * d; y = (f - 0.5) * galleryLoop * d; edge = loopEdge(f);
      // staggered fade-in over the swing, then depth fog: far photos melt into the cream
      alpha = smooth(clamp01((sp - g.revealAt) / C.galleryHoldRevealEach))
        * lerp(1, C.galleryFogMin, smooth(clamp01((dist - fogNear) / (fogFar - fogNear))));
    } else {
      // flight photo: already in world units; same world fall speed as the hold photos
      const f = ((((g.wy0 - now * C.gallerySpeed * (h / w)) % flightLoop) + flightLoop) % flightLoop) / flightLoop;
      x = g.wx; y = (f - 0.5) * flightLoop; edge = loopEdge(f);
      const [revealFar, revealFull] = C.galleryFlightReveal;
      alpha = through * smooth(clamp01((revealFar - dist) / (revealFar - revealFull)));
    }
    g.mesh.visible = galleryReady && g.placed && dist > C.galleryNear && alpha * edge > 0.002;
    if (!g.mesh.visible) continue;
    // the cursor slide shifts nearer photos more (parallax), capped at mouseShiftNear
    // so photos rushing past don't swing across the screen
    const sk = 1 / Math.max(dist, C.mouseShiftNear);
    g.mesh.position.set(w / 2 + (x * k - camShiftX * sk) * w, h / 2 + (y * k - camShiftY * sk) * w, 0);
    g.mesh.scale.set(g.size * w * k, (g.size / g.aspect) * w * k, 1);
    g.mesh.material.opacity = galleryAlpha * edge * alpha;
    // the backing fades in with the photo's reveal (not its fog), so overlaps stay clean
    const reveal = g.wx === undefined ? smooth(clamp01((sp - g.revealAt) / C.galleryHoldRevealEach)) : alpha;
    g.backing.material.opacity = galleryAlpha * edge * reveal;
  }
}

// ---------------------------------------------------------------------------
// End circle: a yellow disc (the H's colour) waiting at the end of the clear
// path through the gallery. It sits at a depth in the same virtual camera
// space as the photos, so it first shows as a small dot far down the path and
// grows naturally (1 / distance) as the camera closes in. Its size is worked
// out so that it just covers the screen's corners when the camera reaches
// `circleFullAt`, a little before the end of the scroll, and it stays covering
// from there on: the last stretch of the hero is solid yellow, so the yellow
// section below never arrives before the circle has filled the screen.
// ---------------------------------------------------------------------------
const circleZ = C.circleEndDist - C.circleFullAt;   // depth behind the H
const circle = new THREE.Mesh(
  new THREE.CircleGeometry(1, 160),
  new THREE.MeshBasicMaterial({ color: C.yellow, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
);
circle.renderOrder = -circleZ;   // in front of deeper photos, behind nearer ones
circle.visible = false;
galleryScene.add(circle);

function updateCircle() {
  const w = window.innerWidth, h = window.innerHeight;
  const dist = camDist + circleZ;
  const [far, full] = C.circleReveal;
  const alpha = smooth(clamp01((far - dist) / (far - full)));
  circle.visible = alpha > 0.001;
  if (!circle.visible) return;
  // world radius (screen widths at distance 1) that covers the corners exactly at
  // circleFullAt; past that it only grows, so it keeps covering (distance clamped
  // so it never flips behind the camera)
  const halfDiag = 0.5 * Math.hypot(1, h / w);
  const cd = Math.max(dist, C.circleEndDist * 0.5);
  // the cursor slide shifts it by its depth like everything else (same cap as the
  // photos); padded by that shift so it still covers the corners once full
  const sd = Math.max(dist, C.mouseShiftNear);
  const shift = Math.hypot(camShiftX, camShiftY) / sd;
  const r = halfDiag * C.circleEndDist * C.circleOverfill / cd + shift;
  circle.position.set(w / 2 - (camShiftX / sd) * w, h / 2 - (camShiftY / sd) * w, 0);
  circle.scale.set(r * w, r * w, 1);
  circle.material.opacity = alpha;
}

// ---------------------------------------------------------------------------
// Tagline (#tagline in index.html): appears as the camera pushes into the H's
// crossbar (camera distance `taglineStartDist`), each line tipping up into place
// in 3D one after another, then holds still while the gallery flies past.
// Driven by camera travel from that point, so scrolling back reverses it.
// ---------------------------------------------------------------------------
const taglineEl = document.getElementById('tagline');
const taglineLines = [...taglineEl.querySelectorAll('.line')].map(el => ({ el, p: -1 }));
let taglineLift = -1;
// Once the hero's scroll space is used up, scroll the tagline away with the page.
// Uses the raw scroll (not the smoothed one) and also runs from the scroll event,
// so it moves in exact step with the next section rather than a frame behind.
function liftTagline() {
  const lift = Math.max(0, Math.round(window.scrollY - scrollMax()));
  if (lift !== taglineLift) { taglineLift = lift; taglineEl.style.transform = lift ? `translateY(${-lift}px)` : ''; }
}
function updateTagline() {
  liftTagline();

  const into = C.taglineStartDist - camDist;   // camera travel since the reveal point (negative before)
  const [tiltX, tiltY] = C.taglineTilt;
  // the lines also lean a few degrees toward the cursor (in 3D, like the scene)
  const mx = mouseX * C.mouseTilt[0], my = -mouseY * C.mouseTilt[1];
  const mouseChanged = Math.abs(mx - taglineMouse[0]) > 0.01 || Math.abs(my - taglineMouse[1]) > 0.01;
  if (mouseChanged) taglineMouse = [mx, my];
  taglineLines.forEach((line, i) => {
    const p = smooth(clamp01((into - i * C.taglineStagger) / C.taglineRevealTravel));
    if (Math.abs(p - line.p) < 1e-4 && !mouseChanged) return;   // only touch the DOM when it changes
    line.p = p;
    const q = 1 - p;
    // tips up from below the baseline, with a slight sideways turn alternating per line
    line.el.style.opacity = p.toFixed(3);
    line.el.style.transform =
      `translateY(${(q * 0.3).toFixed(3)}em) rotateX(${(q * tiltX + taglineMouse[1]).toFixed(2)}deg) ` +
      `rotateY(${(q * tiltY * (i % 2 ? -1 : 1) + taglineMouse[0]).toFixed(2)}deg)`;
  });
}
let taglineMouse = [0, 0];

// ---------------------------------------------------------------------------
// Scroll: the hero's scroll space (#scroll) is `scrollLength` screens tall;
// progress runs 0..1 over it alone, so content added after it (the next
// section) doesn't change the animation's timing. Smoothed so wheel steps glide.
// ---------------------------------------------------------------------------
const scrollEl = document.getElementById('scroll');
scrollEl.style.height = `${C.scrollLength * 100}vh`;
const scrollMax = () => scrollEl.offsetHeight - window.innerHeight;
function readScroll() {
  if (scrollLocked && window.scrollY !== 0) window.scrollTo(0, 0);   // intro still playing
  const max = scrollMax();
  spTarget = max > 0 ? clamp01(window.scrollY / max) : 0;
  liftTagline();
}
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('resize', resize);
resize();

function applyFade() {
  edgeMat.opacity = C.edgeOpacity * (1 - face);
  gridMat.opacity = 1 - face;
  edgeMat.visible = gridMat.visible = face < 0.999;
}

// (no click-to-replay: the intro runs once per page load; hDebug.restart() is still available)

let lastNow = performance.now() / 1000;
let orbitT = 0;   // orbit clock; only runs while the page is scrolled to the top
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastNow, 0.05);
  lastNow = now;
  const t = frozen != null ? frozen : now - startTime;

  sp += (spTarget - sp) * (1 - Math.exp(-C.scrollSmooth * dt));
  if (Math.abs(spTarget - sp) < 1e-4) sp = spTarget;
  // once the next section is on screen the hero must already be finished (solid
  // yellow), so a fast flick can't outrun the smoothing and show it early
  if (window.scrollY > scrollMax()) sp = spTarget;
  if (frozen != null) orbitT = t;
  else if (sp < 0.001) orbitT += dt;
  easeMouse(dt);
  placeCamera(C.azimuth + C.orbitSpeed * orbitT);
  applyFade();
  updateGrid(t);
  hoverKick(t);
  tumbleStep(t, dt);
  setFloorClip(!settled || C.clipAfterIntro);

  if (frozen == null && !settled && t >= introEnd) {
    // the H has landed: hand over to scrolling and hover-kicks
    settled = true;
    settledAt = now;
    lockScroll(false);
  } else if (frozen == null && C.loop && settledAt != null && now - settledAt > C.holdSeconds) {
    restart();
  }
  syncMeshes(t);
  updateGallery(now);
  updateCircle();
  updateTagline();

  renderer.clear();
  if (galleryAlpha >= 0.001 || circle.visible) {
    // the floor clip plane is in world units; it must not cut the pixel-space gallery
    const planes = renderer.clippingPlanes;
    renderer.clippingPlanes = [];
    renderer.render(galleryScene, galleryCam);
    renderer.clippingPlanes = planes;
    renderer.clearDepth();
  }
  if (showH) renderer.render(scene, camera);
}
frame();

// Debug hook: hDebug.restart(), hDebug.freeze(seconds) for stills,
// hDebug.scroll(p) to jump to a scroll progress (0..1) with no smoothing,
// hDebug.state() to inspect the bodies.
window.hDebug = {
  restart,
  // knock bar i (0 left, 1 far middle, 2 near middle, 3 right) with velocity (vx, vy, vz)
  kick(i, vx, vy = 0, vz = 0) {
    const b = bodies[i];
    b.vel.set(vx, vy, vz);
    b.hitT = performance.now() / 1000 - startTime;
  },
  // put the (eased) cursor straight at x, y in -1..1, no easing
  mouse(x, y) { mouseX = mouseTX = x; mouseY = mouseTY = y; },
  scroll(p) {
    window.scrollTo(0, p * scrollMax());
    spTarget = sp = p;
  },
  // hold the intro at `sec` seconds (the pose is a pure function of time)
  freeze(sec) {
    restart();
    frozen = sec;
    settled = sec >= introEnd;
    if (settled) lockScroll(false);
  },
  introEnd: () => introEnd,
  state: () => ({
    settled, gridDone, sp: +sp.toFixed(3), face: +face.toFixed(3),
    frameH: +(camera.top * 2).toFixed(3), camDist: +camDist.toFixed(3), showH,
    galleryVisible: gallery.filter(g => g.mesh.visible).length,
    galleryPlaced: gallery.filter(g => g.placed).length,
    galleryOpacity: gallery.map(g => (g.mesh.visible ? +g.mesh.material.opacity.toFixed(3) : 0)),
    galleryPos: gallery.map(g => [Math.round(g.mesh.position.x), Math.round(g.mesh.position.y), +(camDist + g.z).toFixed(2)]),
    mouse: [+mouseX.toFixed(3), +mouseY.toFixed(3)],
    cameraFrame: [camera.left, camera.right].map(v => +v.toFixed(3)),
    // pairs of on-screen photos whose rectangles overlap right now
    galleryOverlaps: (() => {
      const w = window.innerWidth, h = window.innerHeight;
      const v = gallery.filter(g => g.mesh.visible && g.mesh.material.opacity > 0.01 &&
        Math.abs(g.mesh.position.x - w / 2) < (w + g.mesh.scale.x) / 2 &&
        Math.abs(g.mesh.position.y - h / 2) < (h + g.mesh.scale.y) / 2);
      let n = 0;
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
        const a = v[i].mesh, b = v[j].mesh;
        if (Math.abs(a.position.x - b.position.x) < (a.scale.x + b.scale.x) / 2 &&
            Math.abs(a.position.y - b.position.y) < (a.scale.y + b.scale.y) / 2) n++;
      }
      return n;
    })(),
    // photos whose rectangle covers the screen centre (the camera's path): should always be 0
    galleryOnCentre: gallery.filter(g => g.mesh.visible &&
      Math.abs(g.mesh.position.x - window.innerWidth / 2) < g.mesh.scale.x / 2 &&
      Math.abs(g.mesh.position.y - window.innerHeight / 2) < g.mesh.scale.y / 2).length,
    galleryOnScreen: gallery.filter(g => g.mesh.visible &&
      Math.abs(g.mesh.position.x - window.innerWidth / 2) < (window.innerWidth + g.mesh.scale.x) / 2 &&
      Math.abs(g.mesh.position.y - window.innerHeight / 2) < (window.innerHeight + g.mesh.scale.y) / 2).length,
    bodies: bodies.map(b => ({ visible: b.mesh.visible,
      pos: b.mesh.position.toArray().map(v => +v.toFixed(3)),
      low: +new THREE.Box3().setFromObject(b.mesh, true).min.y.toFixed(3),   // lowest point, never < 0 once settled
      off: b.off.toArray().map(v => +v.toFixed(3)), rot: b.rot.toArray().map(v => +v.toFixed(3)) })),
  }),
  config: C,
};

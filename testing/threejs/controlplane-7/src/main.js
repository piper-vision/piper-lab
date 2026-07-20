import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { CONFIG } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 200
);
camera.position.set(0, 0, CONFIG.camera.z);

// mouse camera control: left-drag orbits, right-drag pans, wheel zooms.
// The cinematic sway/parallax keeps driving the camera until the first
// grab, then the user owns it for the rest of the session.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = CONFIG.camera.controls.damping;
controls.minDistance = CONFIG.camera.controls.minDistance;
controls.maxDistance = CONFIG.camera.controls.maxDistance;
controls.enableZoom = CONFIG.camera.controls.wheelZoom;
let manualCam = false;
let camGrabs = 0;
controls.addEventListener('start', () => { manualCam = true; camGrabs++; });

// ---------------------------------------------------------------------------
// shared assets

// soft round glow sprite so points read as light, not squares
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTexture();

function pointsMaterial(color, size, opacity = 1) {
  return new THREE.PointsMaterial({
    color, size, map: glowTex,
    transparent: true, opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
}

function lineMaterial(color, opacity) {
  return new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

function pointsFromArray(arr, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return new THREE.Points(geo, material);
}

// ---------------------------------------------------------------------------
// the stream
//
// Particles live in cylinder space: fixed (x, z) on a disc, base y0 in [0, H).
// Every frame the live y is (y0 + speed*t) mod H, recentred to [-H/2, H/2).
// Because everything scrolls at the same rate the wrapped vertical distance
// between any two particles is constant, so plexus pairs are built once (with
// wrap-aware distance) and stay valid forever. Ends fade to black via vertex
// colors, which additive blending renders as invisible.

const streamGroup = new THREE.Group();
scene.add(streamGroup);

const S = CONFIG.stream;
const H = S.height;

const baseX = new Float32Array(S.particleCount);
const baseY = new Float32Array(S.particleCount);
const baseZ = new Float32Array(S.particleCount);
const phase = new Float32Array(S.particleCount * 2);
for (let i = 0; i < S.particleCount; i++) {
  const r = S.radius * Math.sqrt(Math.random()); // uniform over the disc
  const a = Math.random() * Math.PI * 2;
  baseX[i] = r * Math.cos(a);
  baseZ[i] = r * Math.sin(a);
  baseY[i] = Math.random() * H;
  phase[i * 2] = Math.random() * Math.PI * 2;
  phase[i * 2 + 1] = Math.random() * Math.PI * 2;
}

const live = new Float32Array(S.particleCount * 3);
const liveFade = new Float32Array(S.particleCount);

const particleCol = new THREE.Color(CONFIG.colors.particle);
const nodeCol = new THREE.Color(CONFIG.colors.node);
const lineCol = new THREE.Color(CONFIG.colors.line);

const streamColors = new Float32Array(S.particleCount * 3);
const streamMat = pointsMaterial('#ffffff', S.particleSize);
streamMat.vertexColors = true;
const streamParticles = pointsFromArray(live, streamMat);
streamParticles.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
streamParticles.geometry.setAttribute('color',
  new THREE.BufferAttribute(streamColors, 3).setUsage(THREE.DynamicDrawUsage));
streamGroup.add(streamParticles);

// promote a random subset to bright nodes (second Points sharing coordinates)
const nodeIdx = [];
while (nodeIdx.length < S.nodeCount) {
  const i = Math.floor(Math.random() * S.particleCount);
  if (!nodeIdx.includes(i)) nodeIdx.push(i);
}
const nodeLive = new Float32Array(S.nodeCount * 3);
const nodeColors = new Float32Array(S.nodeCount * 3);
const nodeMat = pointsMaterial('#ffffff', S.nodeSize);
nodeMat.vertexColors = true;
const streamNodes = pointsFromArray(nodeLive, nodeMat);
streamNodes.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
streamNodes.geometry.setAttribute('color',
  new THREE.BufferAttribute(nodeColors, 3).setUsage(THREE.DynamicDrawUsage));
streamGroup.add(streamNodes);

// plexus pairs, built once with wrap-aware vertical distance
const pairs = [];
{
  const linkCount = new Uint8Array(S.particleCount);
  const d2max = S.linkDistance * S.linkDistance;
  for (let i = 0; i < S.particleCount; i++) {
    if (linkCount[i] >= S.maxLinksPerParticle) continue;
    for (let j = i + 1; j < S.particleCount; j++) {
      if (linkCount[j] >= S.maxLinksPerParticle) continue;
      const dx = baseX[i] - baseX[j];
      const dz = baseZ[i] - baseZ[j];
      let dy = Math.abs(baseY[i] - baseY[j]);
      dy = Math.min(dy, H - dy);
      if (dx * dx + dy * dy + dz * dz < d2max) {
        pairs.push(i, j);
        if (++linkCount[i] >= S.maxLinksPerParticle) break;
        linkCount[j]++;
      }
    }
  }
}
const linePos = new Float32Array(pairs.length * 3);
const lineColors = new Float32Array(pairs.length * 3);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
const lineMat = lineMaterial('#ffffff', S.lineOpacity);
lineMat.vertexColors = true;
streamGroup.add(new THREE.LineSegments(lineGeo, lineMat));

// organic snake: lateral offset of the column at height y. Both the
// particles and the flanking cubes sample this so they move as one current.
const W = S.wave;
function waveX(y, t) { return Math.sin(y * W.freqX + t * W.speedX) * W.ampX; }
function waveZ(y, t) { return Math.cos(y * W.freqZ + t * W.speedZ) * W.ampZ; }

// smooth 0->1 ramp over edgeFade from either end of the stream
function endFade(y) {
  const d = (H / 2 - Math.abs(y)) / S.edgeFade;
  const c = Math.max(0, Math.min(1, d));
  return c * c * (3 - 2 * c);
}

// ---------------------------------------------------------------------------
// beam glow: elongated additive sprite behind the stream

const G = CONFIG.beamGlow;
const glowMat = new THREE.SpriteMaterial({
  map: glowTex, color: G.color, transparent: true, opacity: G.opacity,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
});
const beam = new THREE.Sprite(glowMat);
beam.scale.set(G.width, H * G.heightFraction, 1);
beam.renderOrder = -1; // draw first so everything sits on top of the haze
scene.add(beam);

// ---------------------------------------------------------------------------
// cubes riding the flow

const C = CONFIG.cubes;
const cubes = [];

function buildCube(size) {
  const group = new THREE.Group();
  const h = size / 2;
  const corners = [];
  for (let x = -1; x <= 1; x += 2)
    for (let y = -1; y <= 1; y += 2)
      for (let z = -1; z <= 1; z += 2) corners.push([x * h, y * h, z * h]);
  // 12 edges = corner pairs differing in exactly one axis
  const edges = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      let diff = 0;
      for (let a = 0; a < 3; a++) if (corners[i][a] !== corners[j][a]) diff++;
      if (diff === 1) edges.push([corners[i], corners[j]]);
    }
  const pts = [];
  const edgeLine = [];
  for (const [a, b] of edges) {
    edgeLine.push(...a, ...b);
    for (let s = 1; s < C.pointsPerEdge; s++) {
      const t = s / C.pointsPerEdge;
      pts.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    }
  }
  group.add(pointsFromArray(new Float32Array(pts),
    pointsMaterial(CONFIG.colors.particle, C.pointSize)));
  group.add(pointsFromArray(new Float32Array(corners.flat()),
    pointsMaterial(CONFIG.colors.node, C.cornerSize)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeLine), 3));
  group.add(new THREE.LineSegments(geo, lineMaterial(CONFIG.colors.line, C.lineOpacity)));
  return group;
}

const topY = H / 2 + C.margin;

function placeCube(c, y) {
  const r = C.sideMin + Math.random() * (C.sideMax - C.sideMin);
  const a = Math.random() * Math.PI * 2;
  c.x = r * Math.cos(a);
  c.z = r * Math.sin(a);
  c.y = y;
  c.speed = S.speed * (C.speedMult.min + Math.random() * (C.speedMult.max - C.speedMult.min));
}

for (let i = 0; i < C.count; i++) {
  const size = C.minSize + Math.random() * (C.maxSize - C.minSize);
  const group = buildCube(size);
  streamGroup.add(group); // child of the stream so it swirls with the flow
  const mats = [];
  group.traverse((o) => { if (o.material) mats.push({ mat: o.material, rest: o.material.opacity }); });
  const c = {
    group, mats, x: 0, y: 0, z: 0, speed: 0,
    spin: new THREE.Vector3(
      (Math.random() - 0.5) * 2 * C.spinMax,
      (Math.random() - 0.5) * 2 * C.spinMax,
      (Math.random() - 0.5) * 2 * C.spinMax
    ),
  };
  // stagger the field over the full height so the loop starts mid-flow
  placeCube(c, -topY + (i + 0.5) / C.count * 2 * topY);
  cubes.push(c);
}

// ---------------------------------------------------------------------------
// background dust, rising slowly

const D = CONFIG.dust;
const dustPos = new Float32Array(D.count * 3);
for (let i = 0; i < D.count; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 2 * D.spreadX;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 2 * D.spreadY;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 2 * D.spreadZ;
}
const dust = pointsFromArray(dustPos, pointsMaterial(CONFIG.colors.particle, D.size, D.opacity));
dust.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
scene.add(dust);

// ---------------------------------------------------------------------------
// interaction + loop

const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let parX = 0;
let parY = 0;
const _col = new THREE.Color();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // stream scroll: recompute live positions, fades and colors
  const scroll = S.speed * t;
  for (let i = 0; i < S.particleCount; i++) {
    const o = i * 3;
    const y = ((baseY[i] + scroll) % H) - H / 2;
    live[o]     = baseX[i] + waveX(y, t) + Math.sin(t * S.drift.freq + phase[i * 2]) * S.drift.amp;
    live[o + 1] = y;
    live[o + 2] = baseZ[i] + waveZ(y, t) + Math.sin(t * S.drift.freq + phase[i * 2 + 1]) * S.drift.amp;
    const f = endFade(y);
    liveFade[i] = f;
    streamColors[o]     = particleCol.r * f;
    streamColors[o + 1] = particleCol.g * f;
    streamColors[o + 2] = particleCol.b * f;
  }
  streamParticles.geometry.getAttribute('position').needsUpdate = true;
  streamParticles.geometry.getAttribute('color').needsUpdate = true;

  // nodes track their particle, with a twinkle on top of the end fade
  for (let n = 0; n < nodeIdx.length; n++) {
    const i = nodeIdx[n];
    nodeLive.set(live.subarray(i * 3, i * 3 + 3), n * 3);
    const tw = 1 - S.twinkle.amp * (0.5 + 0.5 * Math.sin(t * S.twinkle.freq + phase[i * 2]));
    const f = liveFade[i] * tw;
    nodeColors[n * 3]     = nodeCol.r * f;
    nodeColors[n * 3 + 1] = nodeCol.g * f;
    nodeColors[n * 3 + 2] = nodeCol.b * f;
  }
  streamNodes.geometry.getAttribute('position').needsUpdate = true;
  streamNodes.geometry.getAttribute('color').needsUpdate = true;

  // lines track the live endpoints; a pair straddling the wrap boundary is
  // collapsed to a point for that moment so no segment spans the full height
  for (let k = 0; k < pairs.length; k += 2) {
    const a = pairs[k], b = pairs[k + 1];
    const o = k * 3;
    linePos.set(live.subarray(a * 3, a * 3 + 3), o);
    if (Math.abs(live[a * 3 + 1] - live[b * 3 + 1]) > H / 2) {
      linePos.set(live.subarray(a * 3, a * 3 + 3), o + 3);
    } else {
      linePos.set(live.subarray(b * 3, b * 3 + 3), o + 3);
    }
    _col.copy(lineCol).multiplyScalar(liveFade[a]);
    _col.toArray(lineColors, o);
    _col.copy(lineCol).multiplyScalar(liveFade[b]);
    _col.toArray(lineColors, o + 3);
  }
  lineGeo.getAttribute('position').needsUpdate = true;
  lineGeo.getAttribute('color').needsUpdate = true;

  // slow swirl of the whole column (cubes ride along as children)
  streamGroup.rotation.y += S.swirl * dt;

  // cubes: rise, tumble, fade at the ends, respawn at the bottom
  for (const c of cubes) {
    c.y += c.speed * dt;
    if (c.y > topY) placeCube(c, -topY);
    c.group.position.set(c.x + waveX(c.y, t), c.y, c.z + waveZ(c.y, t));
    c.group.rotation.x += c.spin.x * dt;
    c.group.rotation.y += c.spin.y * dt;
    c.group.rotation.z += c.spin.z * dt;
    const f = endFade(Math.max(-H / 2, Math.min(H / 2, c.y)));
    for (const m of c.mats) m.mat.opacity = m.rest * f;
  }

  // dust rises at a fraction of the stream speed
  const dp = dust.geometry.getAttribute('position');
  for (let i = 0; i < D.count; i++) {
    let y = dp.array[i * 3 + 1] + S.speed * D.riseFraction * dt;
    if (y > D.spreadY) y -= 2 * D.spreadY;
    dp.array[i * 3 + 1] = y;
  }
  dp.needsUpdate = true;

  glowMat.opacity = G.opacity * (1 + G.pulse.amp * Math.sin(t * G.pulse.freq));

  if (manualCam) {
    // the user has grabbed the camera — OrbitControls owns it from here
    controls.update();
  } else {
    // cinematic: off-axis resting angle + slow sway, cursor parallax applied
    // along the orbit-frame right vector so it stays screen-relative
    const CAM = CONFIG.camera;
    const ease = 1 - Math.exp(-CAM.parallaxEase * dt);
    parX += (mouse.x * CAM.parallax - parX) * ease;
    parY += (mouse.y * CAM.parallax - parY) * ease;
    const az = CAM.yaw + Math.sin(t * CAM.sway.yawFreq) * CAM.sway.yawAmp;
    const el = CAM.pitch + Math.sin(t * CAM.sway.pitchFreq + 1.7) * CAM.sway.pitchAmp;
    const R = CAM.z;
    camera.position.set(
      Math.sin(az) * Math.cos(el) * R + Math.cos(az) * parX,
      Math.sin(el) * R + parY,
      Math.cos(az) * Math.cos(el) * R - Math.sin(az) * parX
    );
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}
animate();

// debug hook
window.__particleStream = {
  scene, camera, renderer, CONFIG, streamGroup, cubes, controls,
  get manualCam() { return manualCam; },
  get camGrabs() { return camGrabs; },
};

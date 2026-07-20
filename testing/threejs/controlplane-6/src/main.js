import * as THREE from 'three';
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

// connect each point to a few near neighbours; returns index pairs
function buildLinks(positions, count, maxDist, maxLinks) {
  const pairs = [];
  const linkCount = new Uint8Array(count);
  const d2max = maxDist * maxDist;
  for (let i = 0; i < count; i++) {
    if (linkCount[i] >= maxLinks) continue;
    for (let j = i + 1; j < count; j++) {
      if (linkCount[j] >= maxLinks) continue;
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < d2max) {
        pairs.push(i, j);
        if (++linkCount[i] >= maxLinks) break;
        linkCount[j]++;
      }
    }
  }
  return pairs;
}

function segmentsFromPairs(positions, pairs, material) {
  const arr = new Float32Array(pairs.length * 3);
  for (let k = 0; k < pairs.length; k++) {
    arr[k * 3] = positions[pairs[k] * 3];
    arr[k * 3 + 1] = positions[pairs[k] * 3 + 1];
    arr[k * 3 + 2] = positions[pairs[k] * 3 + 2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return new THREE.LineSegments(geo, material);
}

// ---------------------------------------------------------------------------
// 1 — central icosahedron

const coreGroup = new THREE.Group();
scene.add(coreGroup);

const I = CONFIG.ico;
const icoGeo = new THREE.IcosahedronGeometry(I.radius, 0);
const icoPos = icoGeo.getAttribute('position'); // non-indexed: 20 faces × 3

// particles sampled on the 20 faces (equal area, so a uniform face pick is
// uniform over the surface); a fraction pulled inward to fill the volume
const coreBase = new Float32Array(I.particleCount * 3);
{
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < I.particleCount; i++) {
    const f = Math.floor(Math.random() * (icoPos.count / 3)) * 3;
    a.fromBufferAttribute(icoPos, f);
    b.fromBufferAttribute(icoPos, f + 1);
    c.fromBufferAttribute(icoPos, f + 2);
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    p.set(0, 0, 0)
      .addScaledVector(a, 1 - u - v)
      .addScaledVector(b, u)
      .addScaledVector(c, v);
    // cbrt keeps interior fill uniform by volume rather than clumped at centre
    if (Math.random() < I.interiorFraction) p.multiplyScalar(Math.cbrt(Math.random()));
    coreBase[i * 3] = p.x;
    coreBase[i * 3 + 1] = p.y;
    coreBase[i * 3 + 2] = p.z;
  }
}
const corePhase = new Float32Array(I.particleCount * 3);
for (let i = 0; i < corePhase.length; i++) corePhase[i] = Math.random() * Math.PI * 2;

const coreLive = coreBase.slice();
const coreParticles = pointsFromArray(coreLive, pointsMaterial(CONFIG.colors.particle, I.particleSize));
coreParticles.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
coreGroup.add(coreParticles);

// promote a random subset to bright nodes (drawn as a second Points sharing
// the same displaced coordinates, updated each frame)
const coreNodeIdx = [];
while (coreNodeIdx.length < I.nodeCount) {
  const i = Math.floor(Math.random() * I.particleCount);
  if (!coreNodeIdx.includes(i)) coreNodeIdx.push(i);
}
const coreNodeLive = new Float32Array(I.nodeCount * 3);
const coreNodes = pointsFromArray(coreNodeLive, pointsMaterial(CONFIG.colors.node, I.nodeSize));
coreNodes.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
coreGroup.add(coreNodes);

// plexus lines between near particles — endpoints track the drifting points
const corePairs = buildLinks(coreBase, I.particleCount, I.linkDistance, I.maxLinksPerParticle);
const coreLines = segmentsFromPairs(coreLive, corePairs, lineMaterial(CONFIG.colors.line, I.lineOpacity));
coreLines.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
coreGroup.add(coreLines);

// crisp frame: 12 vertex nodes, points strung along the 30 edges, edge lines.
// Frame materials are collected so the green core flash can tint them too.
const coreFlashMats = [
  { mat: coreParticles.material, base: new THREE.Color(CONFIG.colors.particle) },
  { mat: coreNodes.material, base: new THREE.Color(CONFIG.colors.node) },
  { mat: coreLines.material, base: new THREE.Color(CONFIG.colors.line) },
];
{
  const edgeGeo = new THREE.EdgesGeometry(icoGeo);
  const ep = edgeGeo.getAttribute('position');
  const edgePts = [];
  for (let e = 0; e < ep.count; e += 2) {
    for (let s = 1; s < I.edgePointsPerEdge; s++) {
      const t = s / I.edgePointsPerEdge;
      edgePts.push(
        ep.getX(e) + (ep.getX(e + 1) - ep.getX(e)) * t,
        ep.getY(e) + (ep.getY(e + 1) - ep.getY(e)) * t,
        ep.getZ(e) + (ep.getZ(e + 1) - ep.getZ(e)) * t
      );
    }
  }
  const outlineMat = lineMaterial(CONFIG.colors.outline, I.outlineOpacity);
  const edgePtMat = pointsMaterial(CONFIG.colors.outline, I.edgePointSize);
  coreGroup.add(new THREE.LineSegments(edgeGeo, outlineMat));
  coreGroup.add(pointsFromArray(new Float32Array(edgePts), edgePtMat));
  coreFlashMats.push({ mat: outlineMat, base: new THREE.Color(CONFIG.colors.outline) });
  coreFlashMats.push({ mat: edgePtMat, base: new THREE.Color(CONFIG.colors.outline) });

  // the 12 unique vertices, deduped from the non-indexed triangle soup
  const seen = new Set();
  const verts = [];
  for (let k = 0; k < icoPos.count; k++) {
    const x = icoPos.getX(k), y = icoPos.getY(k), z = icoPos.getZ(k);
    const key = x.toFixed(4) + ',' + y.toFixed(4) + ',' + z.toFixed(4);
    if (!seen.has(key)) { seen.add(key); verts.push(x, y, z); }
  }
  const vertMat = pointsMaterial(CONFIG.colors.node, I.vertexSize);
  coreGroup.add(pointsFromArray(new Float32Array(verts), vertMat));
  coreFlashMats.push({ mat: vertMat, base: new THREE.Color(CONFIG.colors.node) });
}

// ---------------------------------------------------------------------------
// core glow

const G = CONFIG.coreGlow;
const glowMat = new THREE.SpriteMaterial({
  map: glowTex, color: G.color, transparent: true, opacity: G.opacity,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
});
const coreGlow = new THREE.Sprite(glowMat);
coreGlow.scale.setScalar(G.size);
coreGlow.renderOrder = -1; // draw first so everything sits on top of the haze
scene.add(coreGlow);

// ---------------------------------------------------------------------------
// 2 — enclosing sphere shell

const sphereGroup = new THREE.Group();
scene.add(sphereGroup);

const S = CONFIG.sphere;
const spherePos = new Float32Array(S.particleCount * 3);
for (let i = 0; i < S.particleCount; i++) {
  // fibonacci distribution + radial jitter = even but organic shell
  const t = (i + 0.5) / S.particleCount;
  const phi = Math.acos(1 - 2 * t);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  const r = S.radius + (Math.random() - 0.5) * 2 * S.jitter;
  spherePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  spherePos[i * 3 + 1] = r * Math.cos(phi);
  spherePos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
// particles and nodes carry per-vertex colors so the red impact pulse can be
// painted locally (in shell-local space, so the patch rotates with the shell)
const sphereBaseCol = new THREE.Color(CONFIG.colors.particle);
const sphereNodeBaseCol = new THREE.Color(CONFIG.colors.node);

function colorArray(count, color) {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(arr, i * 3);
  return arr;
}

const sphereColors = colorArray(S.particleCount, sphereBaseCol);
const sphereParticles = pointsFromArray(spherePos,
  pointsMaterial('#ffffff', S.particleSize, S.particleOpacity));
sphereParticles.material.vertexColors = true;
sphereParticles.geometry.setAttribute('color',
  new THREE.BufferAttribute(sphereColors, 3).setUsage(THREE.DynamicDrawUsage));
sphereGroup.add(sphereParticles);

const sphereNodePos = new Float32Array(S.nodeCount * 3);
for (let i = 0; i < S.nodeCount; i++) {
  const src = Math.floor(Math.random() * S.particleCount) * 3;
  sphereNodePos.set(spherePos.subarray(src, src + 3), i * 3);
}
const sphereNodeColors = colorArray(S.nodeCount, sphereNodeBaseCol);
const sphereNodeMat = pointsMaterial('#ffffff', S.nodeSize);
sphereNodeMat.vertexColors = true;
const sphereNodes = pointsFromArray(sphereNodePos, sphereNodeMat);
sphereNodes.geometry.setAttribute('color',
  new THREE.BufferAttribute(sphereNodeColors, 3).setUsage(THREE.DynamicDrawUsage));
sphereGroup.add(sphereNodes);

const spherePairs = buildLinks(spherePos, S.particleCount, S.linkDistance, S.maxLinksPerParticle);
sphereGroup.add(segmentsFromPairs(spherePos, spherePairs,
  lineMaterial(CONFIG.colors.line, S.lineOpacity)));

// ---------------------------------------------------------------------------
// 3 — floating particle cubes

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
  const linePos = [];
  for (const [a, b] of edges) {
    linePos.push(...a, ...b);
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
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
  group.add(new THREE.LineSegments(geo, lineMaterial(CONFIG.colors.line, C.lineOpacity)));
  return group;
}

// best-candidate sampling: try several random spots and keep the one farthest
// from every other cube, so the field stays evenly spread instead of clumping
function randomSpawn(self) {
  let best = null;
  let bestScore = -1;
  for (let k = 0; k < C.spreadCandidates; k++) {
    const cand = new THREE.Vector3().randomDirection()
      .multiplyScalar(C.minDist + Math.random() * (C.maxDist - C.minDist));
    let minD = Infinity;
    for (const o of cubes) {
      if (o === self) continue;
      minD = Math.min(minD, cand.distanceTo(o.base));
    }
    if (minD > bestScore) { bestScore = minD; best = cand; }
  }
  return best;
}

for (let i = 0; i < C.count; i++) {
  const size = C.minSize + Math.random() * (C.maxSize - C.minSize);
  const group = buildCube(size);
  const base = randomSpawn(null);
  group.position.copy(base);
  scene.add(group);
  // per-cube materials with their resting opacities, for dissolve/respawn fades
  const mats = [];
  group.traverse((o) => { if (o.material) mats.push({ mat: o.material, rest: o.material.opacity }); });
  cubes.push({
    group, base, mats,
    state: 'idle',   // idle | travel | dissolve | spawn
    stateT: 0,
    outcome: null,   // 'blocked' | 'pass' while traveling
    travelPos: new THREE.Vector3(),
    travelFrom: new THREE.Vector3(),
    travelDur: 1,
    spin: new THREE.Vector3(
      (Math.random() - 0.5) * 2 * C.spinMax,
      (Math.random() - 0.5) * 2 * C.spinMax,
      (Math.random() - 0.5) * 2 * C.spinMax
    ),
    phase: new THREE.Vector3(
      Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2
    ),
  });
}

function setCubeFade(c, f) {
  for (const m of c.mats) m.mat.opacity = m.rest * f;
}

// ---------------------------------------------------------------------------
// background dust

const D = CONFIG.dust;
const dustPos = new Float32Array(D.count * 3);
for (let i = 0; i < dustPos.length; i++) dustPos[i] = (Math.random() - 0.5) * 2 * D.spread;
const dust = pointsFromArray(dustPos, pointsMaterial(CONFIG.colors.particle, D.size, D.opacity));
scene.add(dust);

// ---------------------------------------------------------------------------
// cube journeys: launcher, shell impact pulse, core flash

const J = CONFIG.journey;

// exact 1-in-3 pass rate: draw from a reshuffled 3-outcome bag
let outcomeBag = [];
function drawOutcome() {
  if (!outcomeBag.length) {
    outcomeBag = ['pass', 'blocked', 'blocked'];
    for (let i = outcomeBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [outcomeBag[i], outcomeBag[j]] = [outcomeBag[j], outcomeBag[i]];
    }
  }
  return outcomeBag.pop();
}

let launchTimer = 0;

// red impact pulses, stored in shell-local space so they rotate with it.
// Each pulse tints nearby shell particles/nodes AND lights up a curved
// sphere-cap mesh hugging the shell surface (the tint alone is too subtle).
const pulses = []; // { p: Vector3, t0: seconds, glow: THREE.Mesh }
const pulseCol = new THREE.Color(J.pulseColor);
let sphereTinted = false;
const _col = new THREE.Color();

// shared cap geometry: a section of the shell sphere around the +Y pole,
// vertex colors fading red->black outward (black is invisible with additive)
const capAngle = (J.pulseRadius * 1.15) / S.radius;
const capGeo = new THREE.SphereGeometry(S.radius + 0.06, 48, 24, 0, Math.PI * 2, 0, capAngle);
{
  const cp = capGeo.getAttribute('position');
  const capColors = new Float32Array(cp.count * 3);
  for (let i = 0; i < cp.count; i++) {
    const r = Math.sqrt(cp.getX(i) ** 2 + cp.getY(i) ** 2 + cp.getZ(i) ** 2);
    const theta = Math.acos(Math.min(1, cp.getY(i) / r)); // angle from the pole
    const f = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, theta / capAngle)));
    capColors[i * 3] = pulseCol.r * f;
    capColors[i * 3 + 1] = pulseCol.g * f;
    capColors[i * 3 + 2] = pulseCol.b * f;
  }
  capGeo.setAttribute('color', new THREE.BufferAttribute(capColors, 3));
}
const capMat = new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const UP = new THREE.Vector3(0, 1, 0);

function addPulse(worldPos, t) {
  const local = sphereGroup.worldToLocal(worldPos.clone());
  const glow = new THREE.Mesh(capGeo, capMat.clone());
  glow.quaternion.setFromUnitVectors(UP, local.clone().normalize());
  sphereGroup.add(glow);
  pulses.push({ p: local, t0: t, glow });
}

function paintPulseColors(positions, colors, count, baseCol, attr, t) {
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (const pu of pulses) {
      const dx = positions[i * 3] - pu.p.x;
      const dy = positions[i * 3 + 1] - pu.p.y;
      const dz = positions[i * 3 + 2] - pu.p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const env = Math.sin(Math.PI * Math.min(1, (t - pu.t0) / J.pulseTime));
      s += Math.max(0, 1 - d / J.pulseRadius) * env;
    }
    _col.copy(baseCol).lerp(pulseCol, Math.min(1, s * 1.6));
    _col.toArray(colors, i * 3);
  }
  attr.needsUpdate = true;
}

function updatePulses(t) {
  for (let k = pulses.length - 1; k >= 0; k--) {
    const pu = pulses[k];
    const prog = (t - pu.t0) / J.pulseTime;
    if (prog > 1) {
      sphereGroup.remove(pu.glow);
      pu.glow.material.dispose(); // geometry is shared, keep it
      pulses.splice(k, 1);
    } else {
      pu.glow.material.opacity = Math.sin(Math.PI * prog) * J.pulseGlowOpacity;
    }
  }
  if (!pulses.length) {
    if (sphereTinted) { // one final reset back to base
      sphereTinted = false;
      for (let i = 0; i < S.particleCount; i++) sphereBaseCol.toArray(sphereColors, i * 3);
      for (let i = 0; i < S.nodeCount; i++) sphereNodeBaseCol.toArray(sphereNodeColors, i * 3);
      sphereParticles.geometry.getAttribute('color').needsUpdate = true;
      sphereNodes.geometry.getAttribute('color').needsUpdate = true;
    }
    return;
  }
  sphereTinted = true;
  paintPulseColors(spherePos, sphereColors, S.particleCount, sphereBaseCol,
    sphereParticles.geometry.getAttribute('color'), t);
  paintPulseColors(sphereNodePos, sphereNodeColors, S.nodeCount, sphereNodeBaseCol,
    sphereNodes.geometry.getAttribute('color'), t);
}

// green flash when a cube reaches the core: tint the whole ico + glow
let flashT0 = -Infinity;
const flashCol = new THREE.Color(J.flashColor);
const glowBaseCol = new THREE.Color(G.color);

function updateCoreFlash(t) {
  const prog = (t - flashT0) / J.flashTime;
  const f = prog < 1 ? Math.sin(Math.PI * prog) : 0;
  for (const e of coreFlashMats) e.mat.color.copy(e.base).lerp(flashCol, f);
  glowMat.color.copy(glowBaseCol).lerp(flashCol, f * 0.7);
}

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

// camera orbit state; parallax offsets live in the orbit frame so the cursor
// nudge stays screen-relative as the camera circles the scene
let orbitAngle = 0;
let parX = 0;
let parY = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // icosahedron: tumble on all three axes
  coreGroup.rotation.x += I.spin.x * dt;
  coreGroup.rotation.y += I.spin.y * dt;
  coreGroup.rotation.z += I.spin.z * dt;

  // per-particle slow wander
  for (let i = 0; i < I.particleCount; i++) {
    const o = i * 3;
    coreLive[o]     = coreBase[o]     + Math.sin(t * I.drift.freq + corePhase[o])     * I.drift.amp;
    coreLive[o + 1] = coreBase[o + 1] + Math.sin(t * I.drift.freq + corePhase[o + 1]) * I.drift.amp;
    coreLive[o + 2] = coreBase[o + 2] + Math.sin(t * I.drift.freq + corePhase[o + 2]) * I.drift.amp;
  }
  coreParticles.geometry.getAttribute('position').needsUpdate = true;

  for (let n = 0; n < coreNodeIdx.length; n++) {
    coreNodeLive.set(coreLive.subarray(coreNodeIdx[n] * 3, coreNodeIdx[n] * 3 + 3), n * 3);
  }
  coreNodes.geometry.getAttribute('position').needsUpdate = true;

  const lp = coreLines.geometry.getAttribute('position');
  for (let k = 0; k < corePairs.length; k++) {
    lp.array.set(coreLive.subarray(corePairs[k] * 3, corePairs[k] * 3 + 3), k * 3);
  }
  lp.needsUpdate = true;

  // sphere: slow counter-rotation + node twinkle
  sphereGroup.rotation.x += S.spin.x * dt;
  sphereGroup.rotation.y += S.spin.y * dt;
  sphereGroup.rotation.z += S.spin.z * dt;
  sphereNodeMat.opacity = 1 - S.twinkle.amp * (0.5 + 0.5 * Math.sin(t * S.twinkle.freq));

  // launcher: every J.interval seconds send an idle cube toward the core
  launchTimer += dt;
  if (launchTimer >= J.interval) {
    launchTimer -= J.interval;
    const idle = cubes.filter((c) => c.state === 'idle');
    if (idle.length) {
      const c = idle[Math.floor(Math.random() * idle.length)];
      c.state = 'travel';
      c.stateT = 0;
      c.outcome = drawOutcome();
      c.travelFrom.copy(c.group.position);
      c.travelDur = c.travelFrom.length() / J.speed;
    }
  }

  // cubes: tumble always; position depends on journey state
  for (const c of cubes) {
    const spinMult = c.state === 'travel' ? J.travelSpinMult : 1;
    c.group.rotation.x += c.spin.x * spinMult * dt;
    c.group.rotation.y += c.spin.y * spinMult * dt;
    c.group.rotation.z += c.spin.z * spinMult * dt;
    c.stateT += dt;

    if (c.state === 'idle') {
      c.group.position.set(
        c.base.x + Math.sin(t * C.drift.freq + c.phase.x) * C.drift.amp,
        c.base.y + Math.sin(t * C.drift.freq + c.phase.y) * C.drift.amp,
        c.base.z + Math.sin(t * C.drift.freq + c.phase.z) * C.drift.amp
      );
    } else if (c.state === 'travel') {
      // ease-in-out along the straight line from launch point to the centre
      const p = Math.min(1, c.stateT / c.travelDur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      c.travelPos.copy(c.travelFrom).multiplyScalar(1 - e);
      c.group.position.copy(c.travelPos);
      if (c.outcome === 'blocked' && c.travelPos.length() <= S.radius) {
        addPulse(c.travelPos, t);
        c.state = 'dissolve';
        c.stateT = 0;
      } else if (c.outcome === 'pass' && (p >= 1 || c.travelPos.length() <= 0.2)) {
        flashT0 = t;
        c.state = 'dissolve';
        c.stateT = 0;
      }
    } else if (c.state === 'dissolve') {
      const f = Math.max(0, 1 - c.stateT / J.dissolveTime);
      setCubeFade(c, f);
      c.group.scale.setScalar(0.6 + 0.4 * f); // shrink a touch as it fades
      if (f <= 0) {
        c.base.copy(randomSpawn(c));
        c.group.position.copy(c.base);
        c.group.scale.setScalar(1);
        c.state = 'spawn';
        c.stateT = 0;
      }
    } else if (c.state === 'spawn') {
      const f = Math.min(1, c.stateT / J.respawnFade);
      setCubeFade(c, f);
      c.group.position.set(
        c.base.x + Math.sin(t * C.drift.freq + c.phase.x) * C.drift.amp,
        c.base.y + Math.sin(t * C.drift.freq + c.phase.y) * C.drift.amp,
        c.base.z + Math.sin(t * C.drift.freq + c.phase.z) * C.drift.amp
      );
      if (f >= 1) c.state = 'idle';
    }
  }

  updatePulses(t);
  updateCoreFlash(t);

  dust.rotation.y += D.spinY * dt;

  glowMat.opacity = G.opacity * (1 + G.pulse.amp * Math.sin(t * G.pulse.freq));

  // camera: slow continuous orbit + cursor parallax in the orbit frame
  orbitAngle += CONFIG.camera.orbitSpeed * dt;
  const ease = 1 - Math.exp(-CONFIG.camera.parallaxEase * dt);
  parX += (mouse.x * CONFIG.camera.parallax - parX) * ease;
  parY += (mouse.y * CONFIG.camera.parallax - parY) * ease;
  const sinA = Math.sin(orbitAngle), cosA = Math.cos(orbitAngle);
  const R = CONFIG.camera.z;
  camera.position.set(
    sinA * R + cosA * parX, // orbit point + parallax along the camera's right vector
    parY,
    cosA * R - sinA * parX
  );
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}
animate();

// debug hook — trigger.pulse(x,y,z) paints a red impact at that direction on
// the shell; trigger.flash() fires the green core flash
window.__hexCore = {
  scene, camera, renderer, CONFIG, coreGroup, sphereGroup, cubes,
  trigger: {
    flash: () => { flashT0 = clock.elapsedTime; },
    pulse: (x = 0, y = 0, z = 1) => {
      const p = new THREE.Vector3(x, y, z).normalize().multiplyScalar(S.radius);
      addPulse(p, clock.elapsedTime);
    },
  },
};

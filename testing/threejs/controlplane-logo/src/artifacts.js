import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Digital artifacts: small rounded cubes that flicker on and off on the
// cube's faces. The schedule is seeded and keyed to the loop time, so the
// artifacts repeat exactly every loop (the animation still loops perfectly).
export function createArtifacts(parent, cubeSize, loopSeconds, cfg) {
  const rand = mulberry32(cfg.seed);
  const h = cubeSize / 2;
  const cell = cubeSize / cfg.grid;

  // Face frames: normal plus two in-plane tangents.
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const faces = [
    [X, Y, Z], [X.clone().negate(), Y, Z],
    [Y, Z, X], [Y.clone().negate(), Z, X],
    [Z, X, Y], [Z.clone().negate(), X, Y],
  ];

  // Build the schedule: events, each a small cluster of adjacent cells.
  const items = [];
  for (let e = 0; e < cfg.count; e++) {
    const [n, u, v] = faces[Math.floor(rand() * 6)];
    const start = rand() * loopSeconds;
    const life = cfg.life[0] + rand() * (cfg.life[1] - cfg.life[0]);
    const k = 1 + Math.floor(rand() * cfg.maxCluster);
    let gx = Math.floor(rand() * cfg.grid), gy = Math.floor(rand() * cfg.grid);
    const used = new Set();
    for (let i = 0; i < k; i++) {
      if (used.has(gx + ',' + gy)) continue;
      used.add(gx + ',' + gy);
      const size = cell * (cfg.size[0] + rand() * (cfg.size[1] - cfg.size[0]));
      const out = size * (0.5 * cfg.lift[0] + rand() * 0.5 * (cfg.lift[1] - cfg.lift[0]));
      const pos = n.clone().multiplyScalar(h + out)
        .addScaledVector(u, -h + (gx + 0.5) * cell)
        .addScaledVector(v, -h + (gy + 0.5) * cell);
      items.push({
        pos, size,
        start: start + i * cfg.stagger * rand(), // cluster members land a beat apart
        life,
        bright: cfg.brightness * (0.6 + rand() * 0.4),
        seed: rand() * 1000,
      });
      // step to a neighbouring cell for the next cluster member
      if (rand() < 0.5) gx = clamp(gx + (rand() < 0.5 ? -1 : 1), 0, cfg.grid - 1);
      else gy = clamp(gy + (rand() < 0.5 ? -1 : 1), 0, cfg.grid - 1);
    }
  }

  const geo = new RoundedBoxGeometry(1, 1, 1, 3, cfg.cornerRadius);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0,
    envMapIntensity: 1.2,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const black = new THREE.Color(0, 0, 0);
  for (let i = 0; i < items.length; i++) mesh.setColorAt(i, black);
  parent.add(mesh);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  function update(seconds) {
    const t = ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const age = (t - it.start + loopSeconds * 2) % loopSeconds;
      if (age >= it.life) { mesh.setMatrixAt(i, zero); continue; }
      const a = envelope(age, it.life, it.seed, cfg.flicker);
      if (a <= 0) { mesh.setMatrixAt(i, zero); continue; }
      // quick digital pop: scale snaps up over the first few frames
      const pop = Math.min(1, age / 0.06);
      sc.setScalar(it.size * (0.6 + 0.4 * pop));
      m.compose(it.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(it.bright * a));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { update, mesh, items };
}

// On/off flicker at the start and end (stepped, like a bad signal), solid
// in between.
function envelope(age, life, seed, flicker) {
  const edge = Math.min(flicker, life * 0.35);
  if (age > edge && age < life - edge) return 1;
  const step = Math.floor(age * 40 + seed);         // 40 Hz steps
  const on = hash(step + seed * 7.13) > 0.45;
  const ramp = age <= edge ? age / edge : (life - age) / edge;
  return on ? 0.35 + 0.65 * ramp : 0;
}

function hash(x) {
  const s = Math.sin(x * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

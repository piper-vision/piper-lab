import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SNOISE } from './noise.js';
import { mulberry32 } from './rng.js';

// Shared vertex-shader chunk: computes the displaced position of a node.
// Every node owns two homes — its clean ellipsoid position (the `position`
// attribute) and a corrupted spherical anchor (`aAnchor`) — plus procedural
// noise, spike displacement and jitter layered on top while corrupted.
// Line endpoints carry the same attributes as their node, so the network
// stays attached as everything moves.
const DISPLACE = /* glsl */ `
${SNOISE}
uniform float uTime;
uniform float uRepair;
uniform float uStaggerSpan;
uniform float uNoiseAmp;
uniform float uNoiseAmp2;
uniform float uJitter;
uniform float uCorruptFlow;
uniform float uCleanFlow;

attribute vec3 aAnchor;
attribute vec4 aRand;   // x: seed, y: repair stagger, z: phase, w: size
attribute vec4 aSpike;  // xyz: spike direction, w: amount

vec3 displacedPosition(out float repairOut) {
  float lr = clamp(uRepair * (1.0 + uStaggerSpan) - aRand.y * uStaggerSpan, 0.0, 1.0);
  lr = lr * lr * (3.0 - 2.0 * lr);
  float c = 1.0 - lr;

  vec3 base = mix(aAnchor, position, lr);
  float t = uTime;

  // ambient flow — always present so the repaired orb never freezes
  vec3 flow = vec3(
    snoise(position * 0.45 + vec3(0.0,  t * 0.10, 0.0)),
    snoise(position * 0.45 + vec3(23.4, t * 0.11, 9.2)),
    snoise(position * 0.45 + vec3(51.1, t * 0.09, 31.7))
  );
  base += flow * mix(uCleanFlow, uCorruptFlow, c);

  if (c > 0.001) {
    vec3 q1 = position * 0.5 + vec3(t * 0.06, t * 0.045, -t * 0.05);
    vec3 n1 = vec3(snoise(q1), snoise(q1 + vec3(13.7)), snoise(q1 + vec3(41.3)));

    vec3 q2 = position * 1.7 + vec3(-t * 0.16, t * 0.13, t * 0.11) + aRand.x * 3.0;
    vec3 n2 = vec3(snoise(q2), snoise(q2 + vec3(7.7)), snoise(q2 + vec3(29.1)));

    vec3 corr = n1 * uNoiseAmp + n2 * uNoiseAmp2;
    corr += aSpike.xyz * aSpike.w * (0.7 + 0.3 * sin(t * 0.6 + aRand.x * 6.2831));
    corr += uJitter * (0.5 + 0.5 * aRand.z) * vec3(
      sin(t * 13.0 + aRand.x * 97.0),
      sin(t * 11.0 + aRand.x * 57.0),
      sin(t * 17.0 + aRand.x * 23.0)
    );
    base += corr * c;
  }

  repairOut = lr;
  return base;
}
`;

const POINTS_VERT = /* glsl */ `
${DISPLACE}
uniform float uScale;
uniform float uSize;

varying float vRepair;
varying float vFlicker;
varying float vDepth;

void main() {
  float lr;
  vec3 p = displacedPosition(lr);
  vRepair = lr;
  float c = 1.0 - lr;

  // flicker: hard random blinks + slow regional pulsing, corrupted only
  float gate = fract(sin(aRand.x * 812.9898 + floor(uTime * 9.0) * 7.233) * 43758.5453);
  float blink = step(1.0 - 0.30 * c, gate);
  float pulse = (0.5 + 0.5 * sin(uTime * 1.4 + aRand.z * 6.2831 + position.x * 1.3)) * c * 0.5;
  vFlicker = blink + pulse;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_PointSize = uSize * aRand.w * (1.0 + vFlicker * 0.45) * (uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const POINTS_FRAG = /* glsl */ `
uniform vec3 uColorCalm;
uniform vec3 uColorHot;
uniform vec3 uColorCyan;
uniform float uBrightness;
uniform vec2 uFog; // near, far

varying float vRepair;
varying float vFlicker;
varying float vDepth;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.22, d);
  if (disc < 0.001) discard;

  // corrupted: unstable white/cyan; repaired: consistent cyan-white
  vec3 unstable = mix(uColorCyan, uColorHot, min(vFlicker, 1.0));
  vec3 col = mix(unstable, uColorCalm, vRepair);

  float fog = smoothstep(uFog.y, uFog.x, vDepth);
  float b = uBrightness * (0.6 + 0.4 * vRepair) + vFlicker * 0.7;
  gl_FragColor = vec4(col * b, disc * fog);
}
`;

const LINES_VERT = /* glsl */ `
${DISPLACE}
attribute vec2 aLine; // x: t along segment (0/1), y: per-line seed

varying float vRepair;
varying float vT;
varying float vSeed;
varying float vDepth;

void main() {
  float lr;
  vec3 p = displacedPosition(lr);
  vRepair = lr;
  vT = aLine.x;
  vSeed = aLine.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const LINES_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColorCalm;
uniform vec3 uColorHot;
uniform vec3 uColorCyan;
uniform float uAlphaClean;
uniform float uAlphaCorrupt;
uniform float uPulseAlpha;
uniform float uPulseRateClean;
uniform float uPulseRateCorrupt;
uniform vec2 uFog;

varying float vRepair;
varying float vT;
varying float vSeed;
varying float vDepth;

void main() {
  float c = 1.0 - vRepair;
  float alpha = mix(uAlphaClean, uAlphaCorrupt, c);

  // corrupted lines drop out erratically
  float lf = fract(sin(vSeed * 91.7 + floor(uTime * 7.0) * 3.1) * 43758.5453);
  alpha *= 1.0 - 0.55 * c * step(0.62, lf);

  // travelling signal: a bright glint sliding along the segment.
  // Lines fire often while corrupted, occasionally when repaired.
  float rate = mix(uPulseRateClean, uPulseRateCorrupt, c);
  float slot = floor(uTime * rate + vSeed * 17.0);
  float firing = step(0.72, fract(sin(slot * 12.9898 + vSeed * 78.233) * 43758.5453));
  float ppos = fract(uTime * (0.3 + 0.55 * fract(vSeed * 7.31)) + vSeed * 5.0);
  float pd = abs(vT - ppos);
  float pulse = exp(-pd * pd * 130.0) * firing;

  vec3 col = mix(mix(uColorCyan, uColorHot, 0.5 + 0.5 * sin(uTime * 3.0 + vSeed * 20.0)), uColorCalm, vRepair);
  col += pulse * mix(uColorCalm, uColorHot, c) * 2.2;

  float fog = smoothstep(uFog.y, uFog.x, vDepth);
  gl_FragColor = vec4(col, (alpha + pulse * uPulseAlpha) * fog);
}
`;

export function createOrb(isMobile) {
  const C = CONFIG.orb;
  const rng = mulberry32(C.seed);
  const count = isMobile ? C.countMobile : C.count;
  const R = C.radii;

  const clean = new Float32Array(count * 3);
  const anchor = new Float32Array(count * 3);
  const rand = new Float32Array(count * 4);
  const spike = new Float32Array(count * 4);

  // spike cluster directions — groups of nodes dragged outward together
  const clusters = [];
  for (let k = 0; k < C.spikeClusters; k++) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    while (v.lengthSq() < 0.05) v.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    clusters.push(v.normalize());
  }

  const nSurf = Math.floor(count * C.surfaceFraction);
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const dir = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    let radial;
    if (i < nSurf) {
      // fibonacci sphere: evenly spaced surface points
      const t = (i + 0.5) / nSurf;
      const y = 1 - 2 * t;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * GOLDEN;
      dir.set(r * Math.cos(phi), y, r * Math.sin(phi));
      radial = 1 - rng() * 0.05;
    } else {
      dir.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      while (dir.lengthSq() < 0.05) dir.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      dir.normalize();
      radial = Math.cbrt(rng()) * 0.9;
    }

    clean[i * 3 + 0] = dir.x * R.x * radial;
    clean[i * 3 + 1] = dir.y * R.y * radial;
    clean[i * 3 + 2] = dir.z * R.z * radial;

    // corrupted anchor: same node re-homed on an irregular stretched sphere
    const stretch = 1 + C.corruptStretch * (dir.x * 0.6 + dir.y * 0.8 - dir.z * 0.4) + (rng() - 0.5) * 0.3;
    const ar = C.corruptRadius * radial * stretch;
    anchor[i * 3 + 0] = dir.x * ar;
    anchor[i * 3 + 1] = dir.y * ar;
    anchor[i * 3 + 2] = dir.z * ar;

    rand[i * 4 + 0] = rng();
    rand[i * 4 + 1] = rng();
    rand[i * 4 + 2] = rng();
    rand[i * 4 + 3] = 0.7 + 0.6 * rng();

    // strongest-matching spike cluster for this node
    let best = 0, bestDot = -2;
    for (let k = 0; k < clusters.length; k++) {
      const d = dir.dot(clusters[k]);
      if (d > bestDot) { bestDot = d; best = k; }
    }
    const w = Math.pow(Math.max(0, bestDot), C.spikePow);
    const amt = w > 0.02 ? w * C.spikeAmp * (0.7 + 0.6 * rng()) : 0;
    const cd = clusters[best];
    spike[i * 4 + 0] = cd.x;
    spike[i * 4 + 1] = cd.y;
    spike[i * 4 + 2] = cd.z;
    spike[i * 4 + 3] = amt;
  }

  // --- connections via spatial hash on clean positions ---
  const cell = C.connectRadius;
  const grid = new Map();
  const keyOf = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < count; i++) {
    const k = keyOf(clean[i * 3], clean[i * 3 + 1], clean[i * 3 + 2]);
    let bucket = grid.get(k);
    if (!bucket) { bucket = []; grid.set(k, bucket); }
    bucket.push(i);
  }

  const degree = new Uint8Array(count);
  const segments = [];
  const r2 = cell * cell;
  const cand = [];
  outer: for (let i = 0; i < count; i++) {
    if (degree[i] >= C.maxDegree) continue;
    const x = clean[i * 3], y = clean[i * 3 + 1], z = clean[i * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    cand.length = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i || degree[j] >= C.maxDegree) continue;
            const ddx = clean[j * 3] - x, ddy = clean[j * 3 + 1] - y, ddz = clean[j * 3 + 2] - z;
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 <= r2) cand.push([d2, j]);
          }
        }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, j] of cand) {
      if (degree[i] >= C.maxDegree) break;
      if (degree[j] >= C.maxDegree) continue;
      segments.push(i, j);
      degree[i]++; degree[j]++;
      if (segments.length / 2 >= C.maxSegments) break outer;
    }
  }

  // --- shared uniforms ---
  const P = CONFIG.points, L = CONFIG.lines, F = CONFIG.fog;
  const shared = {
    uTime: { value: 0 },
    uRepair: { value: 0 },
    uStaggerSpan: { value: C.staggerSpan },
    uNoiseAmp: { value: C.noiseAmp },
    uNoiseAmp2: { value: C.noiseAmp2 },
    uJitter: { value: C.jitter },
    uCorruptFlow: { value: C.corruptFlow },
    uCleanFlow: { value: C.cleanFlow },
    uColorCalm: { value: new THREE.Color(P.colorCalm) },
    uColorHot: { value: new THREE.Color(P.colorHot) },
    uColorCyan: { value: new THREE.Color(P.colorCyan) },
    uFog: { value: new THREE.Vector2(F.near, F.far) },
  };

  // --- points ---
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(clean, 3));
  pGeo.setAttribute('aAnchor', new THREE.BufferAttribute(anchor, 3));
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
  pGeo.setAttribute('aSpike', new THREE.BufferAttribute(spike, 4));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

  const pMat = new THREE.ShaderMaterial({
    vertexShader: POINTS_VERT,
    fragmentShader: POINTS_FRAG,
    uniforms: {
      ...shared,
      uScale: { value: 1 },
      uSize: { value: P.size },
      uBrightness: { value: P.baseBrightness },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);

  // --- lines: each endpoint duplicates its node's attributes ---
  const segCount = segments.length / 2;
  const lPos = new Float32Array(segCount * 6);
  const lAnchor = new Float32Array(segCount * 6);
  const lRand = new Float32Array(segCount * 8);
  const lSpike = new Float32Array(segCount * 8);
  const lLine = new Float32Array(segCount * 4);

  for (let s = 0; s < segCount; s++) {
    const seed = rng();
    for (let e = 0; e < 2; e++) {
      const n = segments[s * 2 + e];
      const v = s * 2 + e;
      lPos.set(clean.subarray(n * 3, n * 3 + 3), v * 3);
      lAnchor.set(anchor.subarray(n * 3, n * 3 + 3), v * 3);
      lRand.set(rand.subarray(n * 4, n * 4 + 4), v * 4);
      lSpike.set(spike.subarray(n * 4, n * 4 + 4), v * 4);
      lLine[v * 2 + 0] = e;
      lLine[v * 2 + 1] = seed;
    }
  }

  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('aAnchor', new THREE.BufferAttribute(lAnchor, 3));
  lGeo.setAttribute('aRand', new THREE.BufferAttribute(lRand, 4));
  lGeo.setAttribute('aSpike', new THREE.BufferAttribute(lSpike, 4));
  lGeo.setAttribute('aLine', new THREE.BufferAttribute(lLine, 2));
  lGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

  const lMat = new THREE.ShaderMaterial({
    vertexShader: LINES_VERT,
    fragmentShader: LINES_FRAG,
    uniforms: {
      ...shared,
      uAlphaClean: { value: L.alphaClean },
      uAlphaCorrupt: { value: L.alphaCorrupt },
      uPulseAlpha: { value: L.pulseAlpha },
      uPulseRateClean: { value: L.pulseRateClean },
      uPulseRateCorrupt: { value: L.pulseRateCorrupt },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(lGeo, lMat);

  const group = new THREE.Group();
  group.add(lines);
  group.add(points);

  return {
    group,
    segCount,
    update(time, repair) {
      shared.uTime.value = time;
      shared.uRepair.value = repair;
    },
    resize(heightPx, fovDeg) {
      pMat.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    },
  };
}

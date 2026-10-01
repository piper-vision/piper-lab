import * as THREE from 'three';

// Halftone dots breaking off the logo: dots spawn on the logo's outline and
// drift outward in the logo's plane, snapping cell-to-cell on the same hex
// dot grid as the halftone (so they hop digitally rather than glide). The
// schedule is seeded and keyed to loop time, so the loop stays seamless.
//
// `outline` is a list of closed loops of THREE.Vector2 in logo-local XY.
export function createParticles(outline, { gridCount, dotRadius, depth, loopSeconds, cfg }) {
  const rand = mulberry32(cfg.seed);

  // Outline segments with outward normals, for length-weighted sampling.
  // Segments facing the logo's centre (the edges of the inner triangle) are
  // skipped, so dots only break away outward, never into the hole.
  const centre = new THREE.Vector2();
  let nPts = 0;
  for (const loop of outline) for (const p of loop) { centre.add(p); nPts++; }
  centre.divideScalar(nPts);
  const segs = [];
  let total = 0;
  for (const loop of outline) {
    const ccw = THREE.ShapeUtils.area(loop) > 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      const len = a.distanceTo(b);
      if (len < 1e-6) continue;
      const t = b.clone().sub(a).divideScalar(len);
      const n = ccw ? new THREE.Vector2(t.y, -t.x) : new THREE.Vector2(-t.y, t.x);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      if (n.dot(mid.sub(centre)) < 0) continue;
      segs.push({ a, b, n, len, acc: (total += len) });
    }
  }

  // Each event is a small fragment of halftone breaking off together: a few
  // neighbouring grid cells that leave at once and drift the same way.
  const pitch0 = 1 / gridCount;
  const items = [];
  for (let e = 0; e < cfg.events; e++) {
    const r = rand() * total;
    const s = segs.find((g) => g.acc >= r) || segs[segs.length - 1];
    const u = 1 - (s.acc - r) / s.len;
    const start = s.a.clone().lerp(s.b, u);
    const dir = s.n.clone().rotateAround(new THREE.Vector2(), (rand() - 0.5) * cfg.spread);
    const tang = new THREE.Vector2(-s.n.y, s.n.x);
    const dist = cfg.distance[0] + Math.pow(rand(), 1.4) * (cfg.distance[1] - cfg.distance[0]);
    const birth = rand() * loopSeconds;
    const life = cfg.life[0] + rand() * (cfg.life[1] - cfg.life[0]);
    const z = (rand() - 0.5) * depth;
    const n = cfg.cluster[0] + Math.floor(rand() * (cfg.cluster[1] - cfg.cluster[0] + 1));
    for (let m = 0; m < n; m++) {
      // members sit a few cells apart along the edge and slightly behind it
      const o = start.clone()
        .addScaledVector(tang, (rand() - 0.5) * cfg.clusterSpread * pitch0)
        .addScaledVector(s.n, -rand() * 2 * pitch0);
      items.push({
        start: o,
        dir: dir.clone().rotateAround(new THREE.Vector2(), (rand() - 0.5) * 0.25),
        z,
        dist: dist * (0.7 + rand() * 0.6),
        birth: birth + rand() * cfg.stagger,
        life: life * (0.8 + rand() * 0.4),
        size: dotRadius * (cfg.size[0] + Math.pow(rand(), 4) * (cfg.size[1] - cfg.size[0])),
        seed: rand() * 1000,
      });
    }
  }
  const N = items.length;

  const pos = new Float32Array(N * 3);
  const aSize = new Float32Array(N);
  const aAlpha = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uViewH: { value: 1000 },
      uBright: { value: cfg.brightness },
    },
    vertexShader: /* glsl */`
      attribute float aSize, aAlpha;
      uniform float uViewH;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // world-size dot -> pixels (diameter, plus a pixel for anti-aliasing)
        gl_PointSize = aAlpha > 0.0 ? 2.0 * aSize * projectionMatrix[1][1] * 0.5 * uViewH / -mv.z + 1.5 : 0.0;
        vAlpha = aAlpha;
      }`,
    fragmentShader: /* glsl */`
      uniform float uBright;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;           // 0 centre .. 1 edge of the point quad
        float aa = fwidth(r) * 1.2;
        float d = 1.0 - smoothstep(1.0 - aa * 2.0, 1.0, r);
        if (d <= 0.0) discard;
        gl_FragColor = vec4(vec3(uBright * vAlpha * d), 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;

  const pitch = 1 / gridCount;
  function snap(x, y, out) {
    // same hex grid as the halftone shader (odd rows shifted half a cell)
    const row = Math.floor(y * gridCount);
    const off = (((row % 2) + 2) % 2) * 0.5;
    const col = Math.floor(x * gridCount - off);
    out[0] = (col + 0.5 + off) * pitch;
    out[1] = (row + 0.5) * pitch;
  }

  const tmp = [0, 0];
  // `frame` (optional): { offset: Vector3, angleAt(t) } — when given, the
  // points live in the non-spinning frame: each dot is placed where the logo
  // was at the moment it detached, and stays there while the logo turns on.
  function update(seconds, viewH, frame) {
    mat.uniforms.uViewH.value = viewH;
    const t = ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
    for (let i = 0; i < N; i++) {
      const it = items[i];
      const age = (t - it.birth + loopSeconds * 2) % loopSeconds;
      let a = 0;
      if (age < it.life) {
        const k = age / it.life;
        // ease-out drift, quantised into a few discrete hops
        const travel = Math.floor((1 - Math.pow(1 - k, 2)) * cfg.hops) / cfg.hops * it.dist;
        snap(it.start.x + it.dir.x * travel, it.start.y + it.dir.y * travel, tmp);
        if (frame) {
          const x = tmp[0] + frame.offset.x, y = tmp[1] + frame.offset.y, z = it.z + frame.offset.z;
          const ang = frame.angleAt(it.birth);
          const c = Math.cos(ang), s = Math.sin(ang);
          pos[i * 3] = c * x + s * z;       // rotation about Y
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = -s * x + c * z;
        } else {
          pos[i * 3] = tmp[0];
          pos[i * 3 + 1] = tmp[1];
          pos[i * 3 + 2] = it.z;
        }
        a = envelope(age, it.life, it.seed, cfg.flicker) * (1 - 0.6 * k);
      }
      aAlpha[i] = a;
      aSize[i] = it.size;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  return { points, update };
}

// Stepped on/off flicker at birth and death, solid in between.
function envelope(age, life, seed, flicker) {
  const edge = Math.min(flicker, life * 0.3);
  if (age > edge && age < life - edge) return 1;
  const on = hash(Math.floor(age * 30 + seed) + seed * 7.13) > 0.4;
  return on ? 1 : 0;
}
function hash(x) {
  const s = Math.sin(x * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

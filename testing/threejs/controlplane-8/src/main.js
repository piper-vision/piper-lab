import * as THREE from 'three';
import { CONFIG } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.exposure;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 50
);

// Distance at which the whole sphere fits the viewport (narrowest axis) with margin.
function fitCameraDistance() {
  const margin = 1.12;
  const vHalf = THREE.MathUtils.degToRad(CONFIG.camera.fov) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  return (CONFIG.sphere.radius * margin) / Math.sin(Math.min(vHalf, hHalf));
}
camera.position.set(0, 0, Math.max(CONFIG.camera.z, fitCameraDistance()));

// --- Depth fade: black fog darkens everything on the far side of the sphere,
// so looking through the glass the back reads dimmer. Tiles are unlit, so
// this is the only shading in the scene. Range follows the camera distance.
scene.fog = new THREE.Fog(0x000000, 1, 10);
function syncFog() {
  const dist = camera.position.length();
  const r = CONFIG.sphere.radius;
  scene.fog.near = dist + CONFIG.depthFade.nearOffset * r;
  scene.fog.far = dist + CONFIG.depthFade.farOffset * r;
}
syncFog();

// --- Tiles: every icosphere face becomes an individual flat triangle,
// shrunk toward its centroid (gap). One merged mesh for the panes, one
// merged LineSegments for the white rims.
function buildTiles(radius, detail) {
  const src = new THREE.IcosahedronGeometry(radius, detail);
  const pos = src.getAttribute('position');
  src.dispose();

  const gap = CONFIG.tiles.gap;

  const meshPositions = [];
  const linePositions = [];

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);

    centroid.addVectors(a, b).add(c).multiplyScalar(1 / 3);

    const tri = [a, b, c].map(v => v.clone().lerp(centroid, gap));

    meshPositions.push(
      tri[0].x, tri[0].y, tri[0].z,
      tri[1].x, tri[1].y, tri[1].z,
      tri[2].x, tri[2].y, tri[2].z
    );

    for (let e = 0; e < 3; e++) {
      const p = tri[e], q = tri[(e + 1) % 3];
      linePositions.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }

  const meshGeo = new THREE.BufferGeometry();
  meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(meshPositions, 3));

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

  return { meshGeo, lineGeo };
}

const { meshGeo, lineGeo } = buildTiles(CONFIG.sphere.radius, CONFIG.sphere.detail);

// --- Rim shader: a flowing simplex-noise field on the sphere's surface
// decides how brightly each outline fragment is lit, so patches of the
// shell glow and fade as the field circulates. Fog chunks keep the
// back-of-sphere depth fade working.
let rimUniforms;
function rimNoiseMaterial() {
  const n = CONFIG.rims.noise;
  rimUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(CONFIG.rims.color) },
      uOpacity: { value: CONFIG.rims.opacity },
      uScale: { value: n.scale },
      uSpeed: { value: n.speed },
      uDrift: { value: n.drift },
      uFloor: { value: n.floor },
      uThresh: { value: new THREE.Vector2(n.threshLo, n.threshHi) },
      uMask: { value: new THREE.Vector2(n.maskStart, n.maskEnd) },
    },
  ]);

  return new THREE.ShaderMaterial({
    uniforms: rimUniforms,
    transparent: true,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vPos;
      varying vec3 vWorldPos;
      void main() {
        vPos = position;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uScale;
      uniform float uSpeed;
      uniform float uDrift;
      uniform float uFloor;
      uniform vec2 uThresh;
      uniform vec2 uMask;
      varying vec3 vPos;
      varying vec3 vWorldPos;

      // Ashima / webgl-noise 3D simplex noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      void main() {
        // circulate the sampling domain around the sphere's Y axis
        float ang = uTime * uDrift;
        float ca = cos(ang), sa = sin(ang);
        vec3 p = normalize(vPos);
        p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);

        // two octaves, evolving over time
        float t = uTime * uSpeed;
        float n = snoise(p * uScale + vec3(0.0, t * 0.6, t));
        n += 0.5 * snoise(p * uScale * 2.3 + vec3(t, 0.0, -t * 0.4));
        n = n / 1.5 * 0.5 + 0.5; // → 0..1

        float lit = smoothstep(uThresh.x, uThresh.y, n);

        // suppress the glow on the camera-facing cap so the view through
        // to the core stays clear (sphere center is the world origin)
        float facing = dot(normalize(vWorldPos), normalize(cameraPosition));
        lit *= 1.0 - smoothstep(uMask.x, uMask.y, facing);

        float alpha = mix(uFloor, 1.0, lit) * uOpacity;

        gl_FragColor = vec4(uColor, alpha);
        #include <fog_fragment>
      }
    `,
  });
}

const group = new THREE.Group();
scene.add(group);

// --- Core: a translucent octahedron with its own subtle lighting.
// The tiles are unlit (MeshBasicMaterial), so these lights shape only the core.
const core = (() => {
  const p = CONFIG.core;
  const geo = new THREE.OctahedronGeometry(p.radius);
  const mat = new THREE.MeshStandardMaterial({
    color: p.color,
    roughness: p.roughness,
    metalness: p.metalness,
    transparent: true,
    opacity: p.opacity,
    flatShading: true,
    side: THREE.FrontSide,
    // Write depth and draw first among the transparents: the sphere's rear
    // rims/tiles are occluded instead of painting over the core's faces.
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;

  // faint white edge outline
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({
      color: p.rim.color,
      transparent: true,
      opacity: p.rim.opacity,
      toneMapped: false,
    })
  );
  mesh.add(edges);

  scene.add(mesh);
  return mesh;
})();

// --- Core edge runners: bright heads with fading tails traveling the
// octahedron's edge network, turning onto a random new edge at each vertex.
const coreRunners = (() => {
  const cfg = CONFIG.core.runners;
  const geo = new THREE.OctahedronGeometry(CONFIG.core.radius);
  const pos = geo.getAttribute('position');
  geo.dispose();

  // unique vertices + adjacency
  const keyOf = (v) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
  const vertexIndex = new Map();
  const vertices = [];
  const triIndices = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const k = keyOf(tmp);
    let idx = vertexIndex.get(k);
    if (idx === undefined) {
      idx = vertices.length;
      vertexIndex.set(k, idx);
      vertices.push(tmp.clone());
    }
    triIndices.push(idx);
  }
  const adjacency = vertices.map(() => new Set());
  for (let i = 0; i < triIndices.length; i += 3) {
    const tri = [triIndices[i], triIndices[i + 1], triIndices[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      adjacency[a].add(b);
      adjacency[b].add(a);
    }
  }

  const MAX_POINTS = 16;
  const runners = [];
  for (let i = 0; i < cfg.count; i++) {
    const from = Math.floor(Math.random() * vertices.length);
    const options = [...adjacency[from]];
    const to = options[Math.floor(Math.random() * options.length)];

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: cfg.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    trail.renderOrder = 2;
    core.add(trail); // rides the core's tumble

    runners.push({
      from, to,
      t: Math.random(),
      visited: [vertices[from].clone()], // traversal history, newest last
      trailGeo,
    });
  }

  const head = new THREE.Vector3();
  const scratch = new THREE.Vector3();

  function update(dt) {
    for (const r of runners) {
      // advance along the current edge, hopping vertices as needed
      let a = vertices[r.from], b = vertices[r.to];
      let len = a.distanceTo(b);
      r.t += (cfg.speed * dt) / len;
      while (r.t >= 1) {
        const leftover = (r.t - 1) * len;
        r.visited.push(vertices[r.to].clone());
        if (r.visited.length > 8) r.visited.shift();
        const options = [...adjacency[r.to]].filter(v => v !== r.from);
        const next = options[Math.floor(Math.random() * options.length)];
        r.from = r.to;
        r.to = next;
        a = vertices[r.from]; b = vertices[r.to];
        len = a.distanceTo(b);
        r.t = leftover / len;
      }
      head.lerpVectors(a, b, r.t);

      // walk back from the head through the visited vertices, laying trail
      // points until trailLength is used up
      const posAttr = r.trailGeo.getAttribute('position');
      const colAttr = r.trailGeo.getAttribute('color');
      let remaining = cfg.trailLength;
      let used = 0;
      let prev = head;
      let count = 0;
      const put = (v, dist) => {
        // lift slightly off the surface to avoid z-fighting with the faces
        scratch.copy(v).multiplyScalar(1.008);
        posAttr.setXYZ(count, scratch.x, scratch.y, scratch.z);
        used += dist; // distance from the head to THIS point
        const f = Math.pow(Math.max(0, 1 - used / cfg.trailLength), 1.5);
        colAttr.setXYZ(count, f, f, f);
        count++;
      };
      put(head, 0);
      for (let vi = r.visited.length - 1; vi >= 0 && count < MAX_POINTS; vi--) {
        const node = r.visited[vi];
        const d = prev.distanceTo(node);
        if (d > remaining) {
          scratch.lerpVectors(prev, node, remaining / d);
          put(scratch.clone(), remaining);
          break;
        }
        put(node, d);
        remaining -= d;
        prev = node;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      r.trailGeo.setDrawRange(0, count);
    }
  }

  return { update };
})();

// Dramatic lighting: hard key, faint cool fill, almost no ambient — strong
// face-to-face contrast as the core tumbles.
// --- Cubes: small translucent boxes scattered between the core and the
// shell, each tethered to the core's center by a dotted line. They live
// in the sphere's tumbling group so the whole constellation drifts together.
const spinningCubes = [];
const pulseLinks = [];
const dashOffset = { value: 0 }; // shared uniform: animates tether dashes toward the cubes

// soft radial-gradient texture for the cube bloom halos
function makeHaloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
const haloTexture = makeHaloTexture();

{
  const c = CONFIG.cubes;

  // deterministic PRNG so the arrangement is stable across reloads (mulberry32)
  let s = c.seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cubeMat = new THREE.MeshStandardMaterial({
    color: c.color,
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: c.opacity,
    flatShading: true,
    depthWrite: true,
    emissive: 0xffffff,
    emissiveIntensity: 0, // pulsed up when a light pulse arrives
  });
  const rimMat = new THREE.LineBasicMaterial({
    color: c.rim.color,
    transparent: c.rim.opacity < 1,
    opacity: c.rim.opacity,
    toneMapped: false,
  });
  const linkMat = new THREE.LineDashedMaterial({
    color: CONFIG.links.color,
    transparent: CONFIG.links.opacity < 1,
    opacity: CONFIG.links.opacity,
    dashSize: CONFIG.links.dashSize,
    gapSize: CONFIG.links.gapSize,
    toneMapped: false,
  });
  // LineDashedMaterial has no dash offset — patch one in. Line distances run
  // 0 at the cube → length at the core, so a growing offset crawls the
  // dashes toward the cube.
  linkMat.onBeforeCompile = (shader) => {
    shader.uniforms.uDashOffset = dashOffset;
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float dashSize;', 'uniform float dashSize;\nuniform float uDashOffset;')
      .replace('mod( vLineDistance, totalSize )', 'mod( vLineDistance + uDashOffset, totalSize )');
  };

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < c.count; i++) {
    // Fibonacci-sphere direction (evenly spread) with a little seeded jitter
    // so the arrangement doesn't look gridded
    const z = 1 - (2 * (i + 0.5)) / c.count + (rand() - 0.5) * 0.18;
    const phi = i * GOLDEN_ANGLE + (rand() - 0.5) * 0.5;
    const rxy = Math.sqrt(Math.max(0, 1 - z * z));
    const dir = new THREE.Vector3(rxy * Math.cos(phi), rxy * Math.sin(phi), z);
    const radius = THREE.MathUtils.lerp(c.radiusMin, c.radiusMax, rand());
    const posV = dir.multiplyScalar(radius);

    const size = THREE.MathUtils.lerp(c.sizeMin, c.sizeMax, rand());
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = cubeMat.clone(); // per-cube so each can flash independently
    const cube = new THREE.Mesh(geo, mat);
    cube.position.copy(posV);
    cube.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    cube.renderOrder = -1; // with the core: occlude rear shell lines
    cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), rimMat));
    group.add(cube);

    // bloom halo: additive sprite that lights up when a pulse arrives
    const p = CONFIG.pulses;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false, // don't let the cube's own faces clip hard edges into the glow
      toneMapped: false,
    }));
    halo.scale.setScalar(size * p.glow.haloScale);
    halo.renderOrder = 2;
    cube.add(halo);

    // dotted tether to the core's center; the core's depth write
    // hides the segment that would pass through its interior
    const linkGeo = new THREE.BufferGeometry().setFromPoints([
      posV, new THREE.Vector3(0, 0, 0),
    ]);
    const link = new THREE.Line(linkGeo, linkMat);
    link.computeLineDistances();
    group.add(link);

    // traveling light streak: a short bright segment animated along the tether
    const streakGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    const streakMat = new THREE.LineBasicMaterial({
      color: p.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const streak = new THREE.Line(streakGeo, streakMat);
    streak.visible = false;
    streak.renderOrder = 2;
    group.add(streak);

    // placement order is the top→bottom spiral, so array order IS the
    // firing order of the sequence
    pulseLinks.push({
      end: posV.clone(),
      streak, streakGeo, streakMat,
      cubeMat: mat,
      haloMat: halo.material,
    });

    spinningCubes.push({
      mesh: cube,
      spin: new THREE.Vector3(
        (rand() * 2 - 1) * c.spinMax,
        (rand() * 2 - 1) * c.spinMax,
        (rand() * 2 - 1) * c.spinMax
      ),
    });
  }
}

const coreKey = new THREE.DirectionalLight(0xffffff, 2.8);
coreKey.position.set(-2.5, 3, 4);
scene.add(coreKey);

const coreFill = new THREE.DirectionalLight(0xffffff, 0.2);
coreFill.position.set(3, -2, -3);
scene.add(coreFill);

scene.add(new THREE.AmbientLight(0xffffff, 0.06));

{
  const t = CONFIG.tiles;
  // Unlit material: no lights, no reflections — flat dark glass.
  const slabMat = new THREE.MeshBasicMaterial({
    color: t.color,
    transparent: t.opacity < 1,
    opacity: t.opacity,
    side: THREE.DoubleSide,
    depthWrite: t.opacity >= 1, // transparent slabs must not occlude each other
  });
  const slabs = new THREE.Mesh(meshGeo, slabMat);
  slabs.renderOrder = 1; // draw after the rims so lines show through the glass
  group.add(slabs);

  const rims = new THREE.LineSegments(lineGeo, rimNoiseMaterial());
  group.add(rims);
}

// --- Pointer parallax
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
});

// Poll the container size each frame — panes can resize without a window
// resize event, which would leave a stale, off-center canvas.
function syncSize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  const cur = renderer.getSize(new THREE.Vector2());
  if (cur.x !== w || cur.y !== h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.z = Math.max(CONFIG.camera.z, fitCameraDistance());
    renderer.setSize(w, h);
    syncFog();
  }
}

const clock = new THREE.Clock();
let simTime = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  syncSize();

  group.rotation.y += CONFIG.spin.y * dt;
  group.rotation.x += CONFIG.spin.x * dt;

  core.rotation.y += CONFIG.core.spin.y * dt;
  core.rotation.x += CONFIG.core.spin.x * dt;
  coreRunners.update(dt);

  for (const { mesh, spin } of spinningCubes) {
    mesh.rotation.x += spin.x * dt;
    mesh.rotation.y += spin.y * dt;
    mesh.rotation.z += spin.z * dt;
  }

  // light pulses: streak travels core → cube, then the cube blooms
  simTime += dt;
  rimUniforms.uTime.value = simTime;
  dashOffset.value = simTime * CONFIG.links.flowSpeed;
  {
    const P = CONFIG.pulses;
    const N = pulseLinks.length;
    const lastArrival = (N - 1) * P.interval + P.travelTime;
    const fadeStart = lastArrival + P.hold;
    const cycle = fadeStart + P.fadeTime + P.rest;
    const g = simTime % cycle;

    // group fade factor: 1 while filling/holding, eases to 0 after fadeStart
    let fade = 1;
    if (g >= fadeStart) {
      fade = 1 - Math.min(1, (g - fadeStart) / P.fadeTime);
      fade *= fade; // ease-out
    }

    const posAttr = new THREE.Vector3(); // scratch
    pulseLinks.forEach((link, i) => {
      const depart = i * P.interval;

      // streak: departs at its slot, runs core → cube
      const local = g - depart;
      if (local >= 0 && local < P.travelTime) {
        const t = local / P.travelTime;
        const head = t;
        const tail = Math.max(0, t - P.streakLength);
        const attr = link.streakGeo.getAttribute('position');
        posAttr.copy(link.end).multiplyScalar(tail);
        attr.setXYZ(0, posAttr.x, posAttr.y, posAttr.z);
        posAttr.copy(link.end).multiplyScalar(head);
        attr.setXYZ(1, posAttr.x, posAttr.y, posAttr.z);
        attr.needsUpdate = true;
        // ease in/out so the streak fades at both ends of its run
        link.streakMat.opacity = P.opacity * Math.sin(Math.PI * t);
        link.streak.visible = true;
      } else {
        link.streak.visible = false;
      }

      // glow: ramps up on arrival, HOLDS until the group fade
      const sinceArrival = local - P.travelTime;
      let e = 0;
      if (sinceArrival >= 0) {
        e = Math.min(1, sinceArrival / P.glow.attack);
      }
      e *= fade;
      link.cubeMat.emissiveIntensity = e * P.glow.emissiveIntensity;
      link.haloMat.opacity = e * P.glow.haloOpacity;
    });
  }

  pointer.x += (pointer.tx - pointer.x) * CONFIG.parallax.ease;
  pointer.y += (pointer.ty - pointer.y) * CONFIG.parallax.ease;
  group.rotation.z = pointer.x * CONFIG.parallax.amount * 0.4;
  camera.position.x = pointer.x * CONFIG.parallax.amount;
  camera.position.y = -pointer.y * CONFIG.parallax.amount;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
});

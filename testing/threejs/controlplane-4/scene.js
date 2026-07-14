import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const BG = new THREE.Color('#E7D8CE');

const scene = new THREE.Scene();
scene.background = BG;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 3.6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.enablePan = false;
// Zoom is disabled so the mouse wheel is free to scroll the page (which drives
// the triangle descent). Rotation still works by dragging.
controls.enableZoom = false;
controls.minDistance = 2;
controls.maxDistance = 16;
controls.minPolarAngle = -Infinity;
controls.maxPolarAngle = Infinity;
controls.target.set(0, 0, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---- Extruded triangle (independent, animated separately) ----
const shape = new THREE.Shape();
shape.moveTo(-3.1, 1.35);
shape.lineTo(3.1, 1.35);
shape.lineTo(0, -1.85);
shape.lineTo(-3.1, 1.35);

const geo = new THREE.ExtrudeGeometry(shape, {
  depth: 0.05,
  bevelEnabled: true,
  bevelThickness: 0.0075,
  bevelSize: 0.0075,
  bevelSegments: 3,
  steps: 1,
});
geo.center();
geo.computeVertexNormals();

const material = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#9da88e'),
  metalness: 0.0,
  roughness: 0.62,
  transmission: 0.15,
  thickness: 0.6,
  ior: 1.4,
  clearcoat: 0.2,
  clearcoatRoughness: 0.65,
  envMapIntensity: 0.25,
  reflectivity: 0.15,
  attenuationColor: new THREE.Color('#d9eac1'),
  attenuationDistance: 6.0,
  transparent: true,
  side: THREE.DoubleSide,
});

// Inject a soft, sphere-centered mask + wireframe grid straight into the
// triangle's own material. Where the blade overlaps the sphere, the material
// fades toward transparent (the "dissolve") and reveals grid lines through
// that soft window — so the triangle itself appears to go transparent to let
// the sphere pass, rather than a separate overlay sitting on top.
const triUniforms = {
  uSphereCenter: { value: new THREE.Vector3(0, 0, 0) }, // world-space sphere center
  uMaskRadius:   { value: 1.5 },    // world radius of the soft window (larger)
  uMaskSoft:     { value: 0.8 },    // softness of the mask edge
  uReveal:       { value: 0.0 },    // 0 = solid, 1 = fully revealing (driven by pass)
  uGridScale:    { value: 26.0 },
  uGridWidth:    { value: 0.045 },
  uGridColor:    { value: new THREE.Color('#3f4a34') },
};

material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, triUniforms);

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPos;
       varying vec2 vLocalXY;`
    )
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vLocalXY = position.xy;`
    );
  // Ensure vWorldPos is written even if worldpos_vertex isn't present.
  if (!shader.vertexShader.includes('vWorldPos =')) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vLocalXY = position.xy;
       #include <project_vertex>`
    );
  }

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPos;
       varying vec2 vLocalXY;
       uniform vec3  uSphereCenter;
       uniform float uMaskRadius;
       uniform float uMaskSoft;
       uniform float uReveal;
       uniform float uGridScale;
       uniform float uGridWidth;
       uniform vec3  uGridColor;`
    )
    // At the very end of the fragment shader, blend in the grid and punch the
    // soft transparency window based on distance to the sphere center.
    .replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // Distance from this fragment to the sphere center (world space).
       float d = distance(vWorldPos, uSphereCenter);
       // Soft window: 1 at center, 0 outside radius. Modulated by uReveal so it
       // only opens while the blade is passing through.
       float window = 1.0 - smoothstep(uMaskRadius - uMaskSoft, uMaskRadius, d);
       window *= uReveal;

       // Procedural wireframe grid in the triangle's local plane.
       vec2 g = fract(vLocalXY * uGridScale);
       vec2 gd = min(g, 1.0 - g);
       float gridLine = 1.0 - smoothstep(0.0, uGridWidth, min(gd.x, gd.y));

       // Inside the window: fade the solid material toward transparent, then
       // draw the grid lines brightly on top of that dissolved area.
       float dissolve = window;                 // how transparent the blade gets
       gl_FragColor.a *= (1.0 - dissolve * 0.92);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, uGridColor, gridLine * window * 0.9);
       gl_FragColor.a = max(gl_FragColor.a, gridLine * window * 0.85);`
    );

  material.userData.shader = shader;
};

const triangle = new THREE.Mesh(geo, material);
triangle.name = 'glassTriangle';
scene.add(triangle);

// ---- Particle sphere (independent, centered at origin) ----
const PARTICLE_COUNT = 625;
const SPHERE_RADIUS = 0.55;
const positions = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const golden = Math.PI * (3 - Math.sqrt(5));

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = golden * i;
  const x = Math.cos(theta) * r;
  const z = Math.sin(theta) * r;
  positions[i * 3]     = x * SPHERE_RADIUS;
  positions[i * 3 + 1] = y * SPHERE_RADIUS;
  positions[i * 3 + 2] = z * SPHERE_RADIUS;
  basePositions[i * 3]     = x;
  basePositions[i * 3 + 1] = y;
  basePositions[i * 3 + 2] = z;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const sprite = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const particleMat = new THREE.PointsMaterial({
  size: 0.03,
  map: sprite,
  color: new THREE.Color('#7f8a6e'),
  transparent: true,
  depthWrite: true,
  depthTest: true,
  alphaTest: 0.5,
  blending: THREE.NormalBlending,
  sizeAttenuation: true,
});

const particleSphere = new THREE.Points(particleGeo, particleMat);
particleSphere.name = 'particleSphere';
scene.add(particleSphere);

// ---- Node lines connecting nearby particles ----
// Precompute neighbour pairs across the WHOLE base sphere using a spatial hash
// grid, so connections cover the entire surface evenly instead of clustering in
// patchy index-adjacent bands. This gives an even network over all hemispheres.
// Build neighbour pairs using angular distance on the unit sphere so coverage
// is perfectly uniform regardless of Fibonacci spiral index order. Two particles
// are linked when their great-circle angle is within ANG_THRESH radians.
// Using the unit-sphere basePositions (not scaled by SPHERE_RADIUS) means the
// dot-product threshold is purely angular — density is equal everywhere.
const ANG_THRESH = 0.32;         // ~18° — wide enough to reach across hemispheres
const COS_THRESH = Math.cos(ANG_THRESH); // dot-product cutoff on unit vectors
const MAX_LINKS_PER_NODE = 7;
const MAX_LINKS = 7000;
const linkPairs = [];

// Spatial hash on the UNIT sphere base positions
const CELL = ANG_THRESH;
const cellKey = (cx, cy, cz) => cx + ',' + cy + ',' + cz;
const grid = new Map();
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const cx = Math.floor(basePositions[i * 3]     / CELL);
  const cy = Math.floor(basePositions[i * 3 + 1] / CELL);
  const cz = Math.floor(basePositions[i * 3 + 2] / CELL);
  const key = cellKey(cx, cy, cz);
  let arr = grid.get(key);
  if (!arr) { arr = []; grid.set(key, arr); }
  arr.push(i);
}

const linkCount = new Uint8Array(PARTICLE_COUNT);
const seen = new Set();
for (let i = 0; i < PARTICLE_COUNT && linkPairs.length < MAX_LINKS; i++) {
  if (linkCount[i] >= MAX_LINKS_PER_NODE) continue;
  const ax = basePositions[i * 3];
  const ay = basePositions[i * 3 + 1];
  const az = basePositions[i * 3 + 2];
  const cx = Math.floor(ax / CELL);
  const cy = Math.floor(ay / CELL);
  const cz = Math.floor(az / CELL);
  // 3x3x3 cell neighbourhood
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let oz = -1; oz <= 1; oz++) {
        const arr = grid.get(cellKey(cx + ox, cy + oy, cz + oz));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const j = arr[n];
          if (j <= i) continue;
          if (linkCount[i] >= MAX_LINKS_PER_NODE) break;
          if (linkCount[j] >= MAX_LINKS_PER_NODE) continue;
          // dot product of unit vectors = cosine of angle between them
          const bx = basePositions[j * 3];
          const by = basePositions[j * 3 + 1];
          const bz = basePositions[j * 3 + 2];
          const dot = ax * bx + ay * by + az * bz;
          if (dot >= COS_THRESH) {
            const pk = i * PARTICLE_COUNT + j;
            if (seen.has(pk)) continue;
            seen.add(pk);
            linkPairs.push(i, j);
            linkCount[i]++;
            linkCount[j]++;
            if (linkPairs.length >= MAX_LINKS) break;
          }
        }
      }
    }
  }
}

const linePositions = new Float32Array(linkPairs.length * 3);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
const lineMat = new THREE.LineBasicMaterial({
  color: new THREE.Color('#7f8a6e'),
  transparent: true,
  opacity: 0.0,
  depthWrite: false,  // don't occlude, but DO test depth so the triangle can
  depthTest: true,    // correctly pass in front of / behind the network
  blending: THREE.NormalBlending,
});
const nodeLines = new THREE.LineSegments(lineGeo, lineMat);
nodeLines.name = 'nodeLines';
scene.add(nodeLines);

// Per-particle random seeds for chaotic motion
const seeds = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  seeds[i * 3]     = Math.random() * 100;
  seeds[i * 3 + 1] = Math.random() * 100;
  seeds[i * 3 + 2] = Math.random() * 100;
}

// ---- Lighting ----
const ambient = new THREE.AmbientLight('#d9eac1', 0.75);
scene.add(ambient);

const key = new THREE.DirectionalLight('#eaf5d8', 0.45);
key.position.set(-1.2, 5, 2.5);
scene.add(key);

const fill = new THREE.DirectionalLight('#9da88e', 0.2);
fill.position.set(2.5, -3, 2);
scene.add(fill);

// ---- Descent sequence config ----
const START_Y = 4.5;      // triangle starts well above the viewport (out of sight)
const END_Y = -1.1;       // a little further away from the sphere
const SPHERE_TOP = SPHERE_RADIUS;   // sphere spans -SPHERE_RADIUS .. +SPHERE_RADIUS
const SPHERE_BOT = -SPHERE_RADIUS;

// ---- Scroll drives the descent ----
let scrollProgress = 0;   // 0 = top of page, 1 = fully scrolled
let targetScroll = 0;
function updateScroll() {
  const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  targetScroll = max > 0 ? THREE.MathUtils.clamp(scrollTop / max, 0, 1) : 0;
}
window.addEventListener('scroll', updateScroll, { passive: true });
window.addEventListener('resize', updateScroll, { passive: true });
updateScroll();

const clock = new THREE.Clock();

// The reveal value snaps up with chaos, but eases out slowly so the dissolved
// window + grid linger for a couple of seconds after the sphere has passed.
let reveal = 0;
let lastElapsed = 0;
const REVEAL_HOLD = 2.2; // seconds the reveal takes to fully fade after the pass

// Smoothed chaos value so the chaos -> stable morph eases gently instead of
// snapping. It lerps toward the raw target every frame at CHAOS_EASE.
let chaosSmooth = 0;
const CHAOS_EASE = 0.02; // lower = slower / smoother settle

function animate() {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - lastElapsed, 0.05);
  lastElapsed = t;

  // ---- Drive the triangle descent from scroll ----
  // Smoothly follow the scroll target so the motion feels weighty, not twitchy.
  scrollProgress += (targetScroll - scrollProgress) * 0.08;
  const p = scrollProgress; // 0..1 progress of the pass, tied to scroll

  // Vertical travel: from just above to just below, passing through the center.
  triangle.position.y = THREE.MathUtils.lerp(START_Y, END_Y, p);
  // Nudge the blade forward (toward the camera) so the sphere sits centered
  // within the triangle as it passes through, rather than sharing z=0.
  triangle.position.z = 0.35;

  // Lay the triangle perfectly flat (horizontal blade) so it descends straight
  // DOWN through the sphere's center.
  triangle.rotation.x = -Math.PI / 2;
  triangle.rotation.y = 0;
  triangle.rotation.z = 0;

  // ---- Chaos driven by the triangle's position relative to the sphere ----
  // Full chaos while the triangle is at/above the sphere top; settles to calm
  // once the triangle has descended past the sphere bottom.
  const dist = triangle.position.y; // world Y of triangle vs sphere at origin
  // Widen the pass window so chaos ramps over a much longer stretch of travel
  // (well above the sphere top, fading out well below the bottom) instead of
  // flipping across a narrow band.
  const passThrough = THREE.MathUtils.smoothstep(dist, SPHERE_BOT - 1.6, SPHERE_TOP + 1.2);
  // Ease the smoothed chaos toward the raw target so the morph is gradual.
  chaosSmooth += (passThrough - chaosSmooth) * CHAOS_EASE;
  const chaos = chaosSmooth; // 1 = crazy, 0 = calm (smoothed)
  const calm = 1 - chaos;

  particleSphere.rotation.y = t * (0.06 + chaos * 0.08);
  nodeLines.rotation.copy(particleSphere.rotation);

  const pos = particleGeo.attributes.position.array;
  const fastT = t * (0.2 + chaos * 0.6);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const bx = basePositions[i * 3];
    const by = basePositions[i * 3 + 1];
    const bz = basePositions[i * 3 + 2];

    const sx = seeds[i * 3];
    const sy = seeds[i * 3 + 1];
    const sz = seeds[i * 3 + 2];

    // Calm breathing (always present, dominant once settled)
    const breathe = 1 + Math.sin(t * 1.0 + i * 0.05) * 0.03 * (0.4 + calm * 0.6);

    // Chaotic radial + directional jitter, scaled by chaos (slower, softer)
    const jitter = chaos * 0.32;
    const dx = Math.sin(fastT * 1.3 + sx) * jitter;
    const dy = Math.sin(fastT * 1.7 + sy) * jitter;
    const dz = Math.sin(fastT * 1.1 + sz) * jitter;
    const radialBurst = 1 + chaos * (0.18 + Math.sin(fastT * 1.4 + sx) * 0.22);

    const rad = SPHERE_RADIUS * breathe * radialBurst;
    pos[i * 3]     = bx * rad + dx;
    pos[i * 3 + 1] = by * rad + dy;
    pos[i * 3 + 2] = bz * rad + dz;
  }
  particleGeo.attributes.position.needsUpdate = true;

  // ---- Update node lines from the live particle positions ----
  const lp = lineGeo.attributes.position.array;
  for (let k = 0; k < linkPairs.length; k += 2) {
    const a = linkPairs[k] * 3;
    const b = linkPairs[k + 1] * 3;
    const o = k * 3;
    lp[o]     = pos[a];
    lp[o + 1] = pos[a + 1];
    lp[o + 2] = pos[a + 2];
    lp[o + 3] = pos[b];
    lp[o + 4] = pos[b + 1];
    lp[o + 5] = pos[b + 2];
  }
  lineGeo.attributes.position.needsUpdate = true;
  // Lines glow in with chaos, fade out as the sphere settles.
  lineMat.opacity = 0.2;

  // ---- Open the soft transparency window as the blade passes through ----
  // Snap up instantly with chaos, but decay slowly so the dissolved window and
  // grid remain visible for ~REVEAL_HOLD seconds after the sphere has passed.
  if (chaos > reveal) {
    reveal = chaos;
  } else {
    reveal = Math.max(chaos, reveal - dt / REVEAL_HOLD);
  }
  triUniforms.uReveal.value = reveal;

  particleMat.size = 0.03 + chaos * 0.012;

  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
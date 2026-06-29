import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

// ─── Config ────────────────────────────────────────────────────────────────

const COUNT        = 6000;
const SPREAD       = 7.0;
const MOUSE_RADIUS = 2.6;
const REPULSION    = 0.13;
const SPRING       = 0.018;
const DAMPING      = 0.90;
const DRIFT        = 0.0016;

// ─── Renderer ──────────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ─── Scene & Camera ────────────────────────────────────────────────────────

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.5, 14);
camera.lookAt(0, 0, 0);

// ─── Post-processing ───────────────────────────────────────────────────────

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.35, // strength
  0.55, // radius
  0.0   // threshold – bloom everything; additive blending keeps dims subtle
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ─── Particle buffers ──────────────────────────────────────────────────────

const positions = new Float32Array(COUNT * 3);
const basePos   = new Float32Array(COUNT * 3);
const vels      = new Float32Array(COUNT * 3);
const colors    = new Float32Array(COUNT * 3);
const sizes     = new Float32Array(COUNT);

// Cool nebula palette – additive blending creates organic mixes at overlaps
const palette = [
  new THREE.Color(0x5edfff), // electric cyan
  new THREE.Color(0x2979ff), // vivid blue
  new THREE.Color(0xaa44ff), // deep purple
  new THREE.Color(0xb388ff), // soft violet
  new THREE.Color(0x64ffda), // mint aqua
  new THREE.Color(0xffffff), // white
];

const _c = new THREE.Color();

for (let i = 0; i < COUNT; i++) {
  const i3 = i * 3;

  // Uniform spherical distribution, flattened on Y for a disk-like feel
  const phi   = Math.acos(1 - 2 * Math.random());
  const theta = Math.random() * Math.PI * 2;
  const r     = SPREAD * Math.cbrt(Math.random());

  const x =  r * Math.sin(phi) * Math.cos(theta);
  const y = (r * Math.sin(phi) * Math.sin(theta)) * 0.55;
  const z =  r * Math.cos(phi);

  basePos[i3]     = positions[i3]     = x;
  basePos[i3 + 1] = positions[i3 + 1] = y;
  basePos[i3 + 2] = positions[i3 + 2] = z;

  // Color: blend toward white near center
  const normR = r / SPREAD;
  _c.copy(palette[Math.floor(Math.random() * palette.length)]);
  _c.lerp(palette[5], Math.max(0, 0.7 - normR * 1.2));
  colors[i3]     = _c.r;
  colors[i3 + 1] = _c.g;
  colors[i3 + 2] = _c.b;

  // ~8% "star" particles are larger for dramatic bloom cores
  sizes[i] = Math.random() < 0.08
    ? 4.5 + Math.random() * 4.5
    : 0.8 + Math.random() * 2.2;
}

// ─── Geometry & Material ───────────────────────────────────────────────────

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('aColor',   new THREE.BufferAttribute(colors,    3));
geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,     1));

const mat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */`
    attribute float aSize;
    attribute vec3  aColor;
    varying   vec3  vColor;

    void main() {
      vColor = aColor;
      vec4 mvPos    = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize  = aSize * (280.0 / -mvPos.z);
      gl_Position   = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vColor;

    void main() {
      vec2  uv    = gl_PointCoord - 0.5;
      float dist  = length(uv);
      if (dist > 0.5) discard;

      // Smooth power falloff → soft glowing disc
      float alpha = pow(1.0 - dist * 2.0, 2.4);
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
  transparent: true,
  depthWrite:  false,
  blending:    THREE.AdditiveBlending,
});

scene.add(new THREE.Points(geo, mat));

// ─── Mouse / touch tracking ────────────────────────────────────────────────

const mouseWorld  = new THREE.Vector3(1e5, 0, 0); // start off-screen
const raycaster   = new THREE.Raycaster();
const mouseNDC    = new THREE.Vector2();
const interPlane  = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hitPoint    = new THREE.Vector3();
let   attracting  = false;

function trackPointer(clientX, clientY) {
  mouseNDC.set(
     (clientX / window.innerWidth)  * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(mouseNDC, camera);
  if (raycaster.ray.intersectPlane(interPlane, hitPoint)) {
    mouseWorld.copy(hitPoint);
  }
}

window.addEventListener('mousemove',  e => trackPointer(e.clientX, e.clientY));
window.addEventListener('mouseleave', () => mouseWorld.set(1e5, 0, 0));
window.addEventListener('mousedown',  () => attracting = true);
window.addEventListener('mouseup',    () => attracting = false);

window.addEventListener('touchmove', e => {
  e.preventDefault();
  trackPointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchstart', e => {
  attracting = true;
  trackPointer(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchend', () => {
  attracting = false;
  mouseWorld.set(1e5, 0, 0);
});

// ─── Resize ────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ─── Animation loop ────────────────────────────────────────────────────────

const clock   = new THREE.Clock();
const posAttr = geo.getAttribute('position');
const R2      = MOUSE_RADIUS * MOUSE_RADIUS;

function tick() {
  requestAnimationFrame(tick);

  const t  = clock.getElapsedTime();
  const mx = mouseWorld.x;
  const my = mouseWorld.y;
  const mz = mouseWorld.z;
  const sign = attracting ? -1 : 1; // flip force on click

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;

    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];
    let vx = vels[i3];
    let vy = vels[i3 + 1];
    let vz = vels[i3 + 2];

    // Spring toward base position
    vx += (basePos[i3]     - px) * SPRING;
    vy += (basePos[i3 + 1] - py) * SPRING;
    vz += (basePos[i3 + 2] - pz) * SPRING;

    // Ambient sinusoidal drift – phase offset per particle avoids uniformity
    const ph = i * 0.00137;
    vx += Math.sin(t * 0.50 + ph * 5.1) * DRIFT;
    vy += Math.cos(t * 0.40 + ph * 7.3) * DRIFT;
    vz += Math.sin(t * 0.30 + ph * 4.7) * DRIFT * 0.5;

    // Mouse repulsion / attraction
    const dx = px - mx;
    const dy = py - my;
    const dz = pz - mz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < R2 && d2 > 1e-4) {
      const d = Math.sqrt(d2);
      const f = (1.0 - d / MOUSE_RADIUS) * REPULSION * sign;
      vx += (dx / d) * f;
      vy += (dy / d) * f;
      vz += (dz / d) * f;
    }

    // Damping
    vx *= DAMPING;
    vy *= DAMPING;
    vz *= DAMPING;

    positions[i3]     = px + vx;
    positions[i3 + 1] = py + vy;
    positions[i3 + 2] = pz + vz;
    vels[i3]     = vx;
    vels[i3 + 1] = vy;
    vels[i3 + 2] = vz;
  }

  posAttr.needsUpdate = true;

  // Slow camera drift – keeps the cloud looking three-dimensional without user input
  camera.position.x = Math.sin(t * 0.05) * 1.8;
  camera.position.y = 2.5 + Math.sin(t * 0.07) * 0.6;
  camera.lookAt(0, 0, 0);

  composer.render();
}

tick();

import * as THREE from 'three';
import { config } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  config.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

// ---------------------------------------------------------------- geometry
const g = config.grid;
const halfX = ((g.strandsX - 1) * g.spacingXZ) / 2;
const halfY = ((g.pointsY - 1) * g.spacingY) / 2;
const halfZ = ((g.strandsZ - 1) * g.spacingXZ) / 2;

// deterministic pseudo-random so reloads look identical
let seed = 1337;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const count = g.strandsX * g.strandsZ * g.pointsY;
const positions = new Float32Array(count * 3);
const aBase = new Float32Array(count);      // resting brightness
const aPhase = new Float32Array(count);     // twinkle phase
const aWarm = new Float32Array(count);      // 0 = cool dim tone, 1 = warm bright tone

const stringPositions = new Float32Array(g.strandsX * g.strandsZ * 2 * 3);

const p = config.points;
let i = 0;
let si = 0;
for (let ix = 0; ix < g.strandsX; ix++) {
  for (let iz = 0; iz < g.strandsZ; iz++) {
    const sx = ix * g.spacingXZ - halfX + (rand() - 0.5) * 2 * g.jitterXZ;
    const sz = iz * g.spacingXZ - halfZ + (rand() - 0.5) * 2 * g.jitterXZ;

    // one faint vertical string per strand
    stringPositions[si++] = sx;
    stringPositions[si++] = -halfY - g.spacingY * 0.5;
    stringPositions[si++] = sz;
    stringPositions[si++] = sx;
    stringPositions[si++] = halfY + g.spacingY * 0.5;
    stringPositions[si++] = sz;

    for (let iy = 0; iy < g.pointsY; iy++) {
      positions[i * 3] = sx;
      positions[i * 3 + 1] = iy * g.spacingY - halfY + (rand() - 0.5) * 2 * g.jitterY;
      positions[i * 3 + 2] = sz;

      const bright = rand() < p.brightFraction;
      aBase[i] = bright
        ? p.brightMin + rand() * (p.brightMax - p.brightMin)
        : p.dimMin + rand() * (p.dimMax - p.dimMin);
      aWarm[i] = bright ? 0.65 + rand() * 0.35 : rand() * 0.25;
      aPhase[i] = rand() * Math.PI * 2;
      i++;
    }
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aBase', new THREE.BufferAttribute(aBase, 1));
geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
geometry.setAttribute('aWarm', new THREE.BufferAttribute(aWarm, 1));

// ---------------------------------------------------------------- material
const coolColor = new THREE.Color().setStyle(p.color, THREE.LinearSRGBColorSpace);
const warmColor = new THREE.Color().setStyle(p.brightColor, THREE.LinearSRGBColorSpace);

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uSize: { value: p.sizeBase },
    uSizeMin: { value: p.sizeMin },
    uSizeMax: { value: p.sizeMax },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uCool: { value: coolColor },
    uWarm: { value: warmColor },
    uNearFade: { value: new THREE.Vector2(...p.nearFade) },
    uFarFade: { value: new THREE.Vector2(...p.farFade) },
    uExposure: { value: p.exposure },
    uTwinkleSpeed: { value: p.twinkleSpeed },
    uFlareSpeed: { value: p.flareSpeed },
    uSpikeThreshold: { value: p.spikeThreshold },
    uBandFalloff: { value: config.vignette.bandFalloff },
    uEyeY: { value: 0 },
    uZoomOut: { value: 0 },
  },
  vertexShader: /* glsl */ `
    attribute float aBase;
    attribute float aPhase;
    attribute float aWarm;
    uniform float uTime;
    uniform float uSize;
    uniform float uSizeMin;
    uniform float uSizeMax;
    uniform float uPixelRatio;
    uniform vec2 uNearFade;
    uniform vec2 uFarFade;
    uniform float uExposure;
    uniform float uTwinkleSpeed;
    uniform float uFlareSpeed;
    uniform float uBandFalloff;
    uniform float uEyeY;
    uniform float uZoomOut;
    varying float vIntensity;
    varying float vWarm;

    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = length(mv.xyz);

      // gentle shimmer, always on
      float tw = 0.78 + 0.22 * sin(uTime * uTwinkleSpeed + aPhase)
                      + 0.10 * sin(uTime * uTwinkleSpeed * 2.7 + aPhase * 3.1);

      // slow roaming flare: rare, smooth surges on any point
      float f = sin(uTime * uFlareSpeed + aPhase * 7.0)
              * sin(uTime * uFlareSpeed * 1.31 + aPhase * 3.7);
      float flare = pow(max(f, 0.0), 6.0) * 2.4;

      float intensity = (aBase * tw + aBase * flare) * uExposure;

      // fade near camera and into the depth of the cube
      intensity *= smoothstep(uNearFade.x, uNearFade.y, dist);
      intensity *= 1.0 - smoothstep(uFarFade.x, uFarFade.y, dist);

      // brighter central band around the camera's eye-line;
      // relaxes when pulled back so the whole cube reads evenly
      float band = abs(position.y - uEyeY);
      intensity *= 1.0 / (1.0 + band * band * uBandFalloff * (1.0 - uZoomOut));
      intensity *= 1.0 + uZoomOut * 0.7;

      vIntensity = intensity;
      vWarm = aWarm;

      float size = uSize * uPixelRatio / dist;
      // sparkles render a touch larger so spikes have room
      size *= 1.0 + step(0.5, aWarm) * 0.9 + flare * 0.4;
      gl_PointSize = clamp(size, uSizeMin * uPixelRatio, uSizeMax * uPixelRatio);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uCool;
    uniform vec3 uWarm;
    uniform float uSpikeThreshold;
    varying float vIntensity;
    varying float vWarm;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);

      // soft round core with a hot centre
      float core = exp(-d * d * 42.0) * 1.4 + exp(-d * d * 260.0) * 2.2;

      // 4-point star spikes, only for bright points
      float spikeAmt = smoothstep(uSpikeThreshold, uSpikeThreshold + 0.5, vIntensity);
      float spikes = exp(-abs(uv.x) * 14.0) * exp(-uv.y * uv.y * 1100.0)
                   + exp(-abs(uv.y) * 14.0) * exp(-uv.x * uv.x * 1100.0);
      spikes *= spikeAmt * 1.3;

      float a = (core + spikes) * vIntensity;
      if (a < 0.003) discard;

      vec3 col = mix(uCool, uWarm, vWarm);
      // hot centres bleach toward white
      col = mix(col, vec3(1.0), clamp(a * 0.35, 0.0, 0.75));
      gl_FragColor = vec4(col * a, 1.0);
    }
  `,
});

// points + strings live in one group so the whole cube can rotate
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const pointsMesh = new THREE.Points(geometry, material);
cubeGroup.add(pointsMesh);

// ---------------------------------------------------------------- strings
const stringGeometry = new THREE.BufferGeometry();
stringGeometry.setAttribute('position', new THREE.BufferAttribute(stringPositions, 3));
const stringMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color().setStyle(config.strings.color, THREE.LinearSRGBColorSpace),
  transparent: true,
  opacity: config.strings.opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: true,
});
cubeGroup.add(new THREE.LineSegments(stringGeometry, stringMaterial));

// fog only affects the strings (points fade in-shader)
scene.fog = new THREE.Fog(0x000000, p.farFade[0] * 0.5, p.farFade[1] * 0.8);

// ---------------------------------------------------------------- core glow
// soft warm blaze at the vanishing point, standing in for lens bloom
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  return tex;
}

const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture(),
  color: new THREE.Color().setStyle(config.coreGlow.color, THREE.LinearSRGBColorSpace),
  transparent: true,
  opacity: config.coreGlow.opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
}));
glow.scale.set(config.coreGlow.scaleX, config.coreGlow.scaleY, 1);
glow.position.set(0, 0, 0);
scene.add(glow);

// ---------------------------------------------------------------- animation
const clock = new THREE.Clock();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- input
// cursor pan + scroll zoom, both eased toward their targets each frame
const ia = config.interaction;
const pan = { x: 0, y: 0, tx: 0, ty: 0 };
let zoom = 0;      // eased twice: zoomTarget → zoomMid → zoom (S-curve dolly)
let zoomMid = 0;
let zoomTarget = 0;

window.addEventListener('pointermove', (e) => {
  pan.tx = ((e.clientX / window.innerWidth) * 2 - 1) * ia.panX;
  pan.ty = -((e.clientY / window.innerHeight) * 2 - 1) * ia.panY;
  if (reducedMotion) render();
});

window.addEventListener('wheel', (e) => {
  zoomTarget += e.deltaY * ia.scrollStep;
  zoomTarget = Math.min(Math.max(zoomTarget, ia.scrollMin), ia.scrollMax);
  if (reducedMotion) render();
}, { passive: true });

// cube rotation state: spins when pulled back, settles level when close
const rc = config.rotate;
let cubeAngle = 0;
let tiltSmooth = 0;

function smoothstep(a, b, v) {
  const s = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return s * s * (3 - 2 * s);
}

function positionCamera(t, dt) {
  const c = config.camera;
  const k = 1 - Math.exp(-dt * ia.ease); // frame-rate independent easing
  pan.x += (pan.tx - pan.x) * k;
  pan.y += (pan.ty - pan.y) * k;

  // two-stage smoothing: velocity ramps up and down, no jolt on direction changes
  const kz = 1 - Math.exp(-dt * ia.zoomEase);
  zoomMid += (zoomTarget - zoomMid) * kz;
  zoom += (zoomMid - zoom) * kz;

  const w = (t / c.cycleSeconds) * Math.PI * 2;
  const x = Math.sin(w) * c.driftX + pan.x;
  const z = halfZ + c.distance + Math.sin(w * 0.5 + 1.7) * c.driftZ + zoom;
  const y = c.height + Math.sin(w * 0.73) * 0.05 + pan.y;
  camera.position.set(x, y, z);
  camera.lookAt(x * 0.35, c.lookAheadY + pan.y * 0.35, 0);
  material.uniforms.uEyeY.value = y;

  // spin once the cube form is in view. A gentle velocity-capped seek toward
  // the nearest quarter turn (cube is 90°-symmetric) fades in as the spin
  // fades out — it engages early on the way home and can never exceed
  // settleSpeed, so levelling reads as the spin coasting into place
  const r = smoothstep(rc.startZoom, rc.fullZoom, zoom);
  cubeAngle += dt * rc.speed * r;
  if (r < 1) {
    const quarter = Math.PI / 2;
    const delta = Math.round(cubeAngle / quarter) * quarter - cubeAngle;
    const maxStep = rc.settleSpeed * dt;
    let step = delta * (1 - Math.exp(-dt * rc.settleEase));
    step = Math.max(-maxStep, Math.min(maxStep, step));
    cubeAngle += step * (1 - r);
  }
  cubeGroup.rotation.y = cubeAngle;
  tiltSmooth += (r * rc.tilt - tiltSmooth) * (1 - Math.exp(-dt * rc.tiltEase));
  cubeGroup.rotation.x = tiltSmooth;
  material.uniforms.uZoomOut.value = r;

  // keep the far side visible as the camera pulls back
  const back = Math.max(zoom, 0);
  material.uniforms.uFarFade.value.set(p.farFade[0] + back, p.farFade[1] + back);
  scene.fog.near = p.farFade[0] * 0.5 + back;
  scene.fog.far = p.farFade[1] * 0.8 + back;
}

let lastT = 0;
function render() {
  const t = reducedMotion ? 0 : clock.getElapsedTime();
  const dt = Math.min(Math.max(t - lastT, 1 / 240), 0.1) || 1 / 60;
  lastT = t;
  material.uniforms.uTime.value = t;
  positionCamera(t, dt);
  renderer.render(scene, camera);
}

if (reducedMotion) {
  render();
} else {
  renderer.setAnimationLoop(render);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  if (reducedMotion) render();
});

// debug hook
window.__lightCube = {
  scene, camera, material, config, count,
  pan,
  get zoom() { return zoom; },
  get zoomTarget() { return zoomTarget; },
};

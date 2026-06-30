import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- Scene / Renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.FogExp2(0x0a0820, 0.018);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// ---------- Environment map ----------
function buildEnvTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, 512, 512);
  const core = ctx.createRadialGradient(256, 200, 0, 256, 200, 260);
  core.addColorStop(0, 'rgba(255,240,210,1)');
  core.addColorStop(0.25, 'rgba(120,170,255,0.7)');
  core.addColorStop(0.6, 'rgba(255,120,180,0.25)');
  core.addColorStop(1, 'rgba(5,6,15,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 512, 512);
  const orbs = [
    ['#ff7a3a', 70, 90], ['#4a9bff', 420, 120], ['#ff5ab0', 380, 380],
    ['#44e0ff', 100, 400], ['#9b6bff', 256, 460], ['#fff0c8', 256, 60],
  ];
  for (const [col, x, y] of orbs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envMap = pmrem.fromEquirectangular(buildEnvTexture()).texture;

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.31, 0.8, 0.18);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Lighting ----------
const ambient = new THREE.AmbientLight(0x33405a, 0.9);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xcfe4ff, 2.2);
keyLight.position.set(2, 4, 6);
keyLight.name = 'keyLight';
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xff5a2a, 6.0, 60, 2);
rimLight.position.set(-6, -2, -8);
rimLight.name = 'rimLight';
scene.add(rimLight);

const coolLight = new THREE.PointLight(0x3a7bff, 5.0, 60, 2);
coolLight.position.set(7, 3, -6);
coolLight.name = 'coolLight';
scene.add(coolLight);

const magentaLight = new THREE.PointLight(0xff44cc, 3.5, 50, 2);
magentaLight.position.set(0, -5, -4);
magentaLight.name = 'magentaLight';
scene.add(magentaLight);

// ---------- Helper: soft radial sprite ----------
function radialSprite(color, size, opacity, falloff) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const stop = falloff ?? 0.25;
  g.addColorStop(0, color);
  g.addColorStop(stop, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

// ---------- Black hole ----------
const blackHole = new THREE.Group();
blackHole.name = 'blackHole';
blackHole.position.set(0, 0, -40);
blackHole.rotation.set(-1.15, 0.0, 0.0);
scene.add(blackHole);

// Soft-edged disc: a fullscreen-quad shader that draws a black circle with a
// smooth feathered edge, replacing the hard sphere so the boundary dissolves
// gently into the surrounding void instead of cutting sharply.
const horizonGeo = new THREE.PlaneGeometry(20, 20);
const horizonMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: {},
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d) * 2.0; // 0 at centre, 1 at plane edge
      // Disc radius in uv-space: horizon sphere is 6.5 units, plane is 20 units wide
      // so the disc occupies 6.5/10 = 0.65 of the half-width.
      float discR = 0.63;
      float softWidth = 0.07; // feather width — larger = softer edge
      float alpha = 1.0 - smoothstep(discR - softWidth, discR + softWidth, r);
      gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
    }
  `,
});
const horizon = new THREE.Mesh(horizonGeo, horizonMat);
horizon.name = 'eventHorizon';
// Face the camera (the black hole group is already rotated; the disc sits flat)
horizon.position.z = 0.1; // tiny nudge forward so it occludes the photon ring
blackHole.add(horizon);

const photonGeo = new THREE.RingGeometry(6.6, 8.2, 128);
const photonMat = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uFlare: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform float uTime;
    uniform float uFlare;
    void main() {
      float r = distance(vUv, vec2(0.5));
      float ring = smoothstep(0.5, 0.46, r) * smoothstep(0.40, 0.46, r);
      vec3 base = mix(vec3(1.0, 0.78, 0.42), vec3(1.0, 0.95, 0.85), ring);
      vec3 col = mix(base, vec3(0.7, 0.85, 1.0), uFlare * 0.6);
      // Softened photon ring: lower base alpha so it no longer dominates as a
      // hard bright band that the bloom smears into a ring halo.
      float alpha = ring * (0.16 + uFlare * 0.55);
      gl_FragColor = vec4(col * (1.0 + uFlare * 0.5), alpha);
    }
  `,
});
const photonRing = new THREE.Mesh(photonGeo, photonMat);
photonRing.name = 'photonRing';
// Hidden: the hard bright photon band is what was reading as a "ring". The
// eclipse look in the reference is just the black disc + a soft white corona,
// so we keep the corona sprite as the only halo.
photonRing.visible = false;
blackHole.add(photonRing);

// Soft white eclipse-style corona: a bright rim right at the event-horizon edge
// that fades smoothly outward into the void (like a solar eclipse), built with a
// custom canvas gradient that peaks at the horizon radius then falls off.
function buildCoronaSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256, cy = 256;
  // True soft glow: a smooth gaussian-like falloff that is BRIGHTEST at the
  // centre (right over the hole) and fades continuously to nothing — no edge
  // concentration whatsoever, so it can never read as a ring. We build it by
  // sampling exp(-k*r^2) per-pixel rather than a few hard gradient stops.
  const img = ctx.createImageData(512, 512);
  const data = img.data;
  // Eclipse corona: brightest in a soft white shell just outside the disc edge,
  // fading smoothly outward. We use a smooth power falloff (no hard stop) so it
  // bleeds away gradually like the reference, never tracing a defined ring.
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const dx = (x - cx) / 256;
      const dy = (y - cy) / 256;
      const r = Math.sqrt(dx * dx + dy * dy);
      // Smooth outward bleed; strong near centre, long gentle tail.
      const a = Math.pow(Math.max(0, 1 - r), 2.4);
      const idx = (y * 512 + x) * 4;
      data[idx] = 245;
      data[idx + 1] = 248;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Normal blending + low opacity keeps it a gentle haze rather than a hot
  // additive bloom that the post pass would re-ring.
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.NormalBlending, depthWrite: false });
  const s = new THREE.Sprite(mat);
  return s;
}
const bhGlow = buildCoronaSprite();
// Sized so the bright shell sits just outside the 6.5-unit horizon disc and the
// soft tail bleeds out into the void, matching the eclipse reference.
bhGlow.scale.setScalar(34);
bhGlow.position.set(0, 0, -0.5);
blackHole.add(bhGlow);

// ---------- Warp streaks ----------
const STREAKS = 2600;
const streakGeo = new THREE.BufferGeometry();
const positions = new Float32Array(STREAKS * 6);
const streakColors = new Float32Array(STREAKS * 6);
const streakData = [];

const palette = [
  new THREE.Color(0xfff0c8),
  new THREE.Color(0xff7a3a),
  new THREE.Color(0x4a9bff),
  new THREE.Color(0x9b6bff),
  new THREE.Color(0xff5ab0),
  new THREE.Color(0x44e0ff),
];

function resetStreak(i, randomZ) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.pow(Math.random(), 0.5) * 2.5 + 0.2;
  const z = randomZ ? (-Math.random() * 120 - 10) : -130;
  const len = Math.random() * 6 + 2;
  const speed = Math.random() * 0.9 + 0.7;
  const baseColor = palette[(Math.random() * palette.length) | 0];
  streakData[i] = { angle, radius, z, len, speed, baseColor };
}

for (let i = 0; i < STREAKS; i++) resetStreak(i, true);
streakGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
streakGeo.setAttribute('color', new THREE.BufferAttribute(streakColors, 3));

const streakMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const streaks = new THREE.LineSegments(streakGeo, streakMat);
streaks.name = 'warpStreaks';
scene.add(streaks);

function updateStreaks(dt) {
  const pos = streakGeo.attributes.position.array;
  const col = streakGeo.attributes.color.array;
  for (let i = 0; i < STREAKS; i++) {
    const s = streakData[i];
    s.z += s.speed * dt * 60;
    if (s.z > camera.position.z + 6) resetStreak(i, false);
    const spread = THREE.MathUtils.mapLinear(s.z, -130, camera.position.z, 1.0, 9.0);
    const r = s.radius * spread;
    const x = Math.cos(s.angle) * r;
    const y = Math.sin(s.angle) * r;
    const tail = s.len * THREE.MathUtils.mapLinear(s.z, -130, camera.position.z, 0.4, 3.5);
    const o = i * 6;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = s.z;
    pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = s.z - tail;
    const bright = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(s.z, -130, 0, 0.075, 1.2), 0.05, 1.2);
    const c = s.baseColor;
    col[o] = c.r * bright; col[o + 1] = c.g * bright; col[o + 2] = c.b * bright;
    col[o + 3] = c.r * bright * 0.1; col[o + 4] = c.g * bright * 0.1; col[o + 5] = c.b * bright * 0.1;
  }
  streakGeo.attributes.position.needsUpdate = true;
  streakGeo.attributes.color.needsUpdate = true;
}

// ---------- Star field ----------
const STARS = 1200;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(STARS * 3);
for (let i = 0; i < STARS; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 200;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
  starPos[i * 3 + 2] = -Math.random() * 200 - 20;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xaecbff, size: 0.4, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat);
stars.name = 'starField';
scene.add(stars);

// ---------- Nebula ----------
function nebulaSprite(color, size, x, y, z, opacity) {
  const sp = radialSprite(color, size, opacity);
  sp.position.set(x, y, z);
  return sp;
}
const nebula = new THREE.Group();
nebula.name = 'nebula';
nebula.add(nebulaSprite('rgba(120,60,220,0.7)', 60, -22, 8, -55, 0.24));
nebula.add(nebulaSprite('rgba(220,70,120,0.7)', 55, 24, -10, -50, 0.225));
nebula.add(nebulaSprite('rgba(40,120,220,0.7)', 70, 8, 14, -65, 0.21));
scene.add(nebula);

// ---------- Astronaut model ----------
let astronaut = null;
const MODEL_FILE = 'spaceman-falling.glb';
const uploaded = window.UPLOADED_3D_MODELS?.find(m => m.name === MODEL_FILE);
const modelUrl = uploaded ? uploaded.dataUrl : './' + MODEL_FILE;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

function frameModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) model.scale.multiplyScalar(6 / maxDim);
  box.setFromObject(model);
  box.getCenter(center);
  model.position.sub(center);
}

const armNodes = [];
const VISOR_RE = /(visor|glass|dome|helmet|shield|face[_.]?shield|mask|lens)/i;

function makeReflective(mesh) {
  const apply = (mat) => {
    mat.envMap = envMap;
    mat.envMapIntensity = 2.2;
    mat.metalness = Math.max(mat.metalness ?? 0, 0.85);
    mat.roughness = Math.min(mat.roughness ?? 1, 0.2);
    if ('clearcoat' in mat) { mat.clearcoat = 0.6; mat.clearcoatRoughness = 0.15; }
    mat.needsUpdate = true;
  };
  if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
  else if (mesh.material) apply(mesh.material);
}

function makeVisorReflective(mesh) {
  const apply = (mat) => {
    mat.envMap = envMap;
    mat.envMapIntensity = 2.4;
    mat.metalness = 1.0;
    mat.roughness = 0.05;
    if ('clearcoat' in mat) { mat.clearcoat = 1.0; mat.clearcoatRoughness = 0.04; }
    if (mat.color) mat.color.multiplyScalar(0.6);
    mat.needsUpdate = true;
  };
  if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
  else if (mesh.material) apply(mesh.material);
}

const ARM_RE = /(upperarm|upper_arm|lowerarm|lower_arm|forearm|shoulder|clavicle|elbow|\barm\b|arm[_.]?[lr]\b|[_.]arm)/i;
const UPPER_RE = /(upperarm|upper_arm|shoulder|clavicle|\barm\b)/i;

function detectSide(node, worldPos) {
  const n = (node.name || '').toLowerCase();
  if (/(left|lft|\bl\b|_l\b|\.l\b|l_|leftarm|arm_l|l_arm)/.test(n)) return 'left';
  if (/(right|rgt|\br\b|_r\b|\.r\b|r_|rightarm|arm_r|r_arm)/.test(n)) return 'right';
  return worldPos.x >= 0 ? 'right' : 'left';
}

{
  loader.load(modelUrl, (gltf) => {
    astronaut = new THREE.Group();
    astronaut.name = 'astronaut';
    const m = gltf.scene;
    m.updateWorldMatrix(true, true);

    const allBones = [];
    const dump = [];
    m.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = false;
        o.frustumCulled = false;
        makeReflective(o);
        const matName = (Array.isArray(o.material) ? o.material[0]?.name : o.material?.name) || '';
        if (VISOR_RE.test(o.name || '') || VISOR_RE.test(matName)) {
          makeVisorReflective(o);
        }
      }
      if (o.isBone) allBones.push(o);
      dump.push(`${o.type}: ${o.name}`);
    });

    let candidates = allBones.filter((b) => ARM_RE.test(b.name || ''));
    const uppers = candidates.filter((b) => UPPER_RE.test(b.name || ''));
    if (uppers.length) candidates = uppers;
    if (candidates.length === 0) {
      m.traverse((o) => { if (ARM_RE.test(o.name || '')) candidates.push(o); });
    }

    const wp = new THREE.Vector3();
    for (const node of candidates) {
      node.getWorldPosition(wp);
      armNodes.push({ node, rest: node.rotation.clone(), side: detectSide(node, wp.clone()), name: node.name });
    }

    frameModel(m);
    m.scale.multiplyScalar(0.9);
    astronaut.add(m);
    astronaut.position.set(0, -0.3, 4);
    astronaut.rotation.set(0.15 + Math.PI / 6 + Math.PI / 18, -0.2, 0.05);
    scene.add(astronaut);
  }, undefined, (err) => {
    console.error('Model load error:', err);
    showError('Could not load "' + MODEL_FILE + '".<br>Make sure the .glb file sits in the same folder as hyperspace.js.');
  });
}

// ---------- SVG logo helpers ----------
function sanitiseSvg(svgText) {
  return svgText
    .replace(/\bfill="white"\b/gi, 'fill="#ffffff"')
    .replace(/\bfill="black"\b/gi, 'fill="#000000"')
    .replace(/\bstroke="white"\b/gi, 'stroke="#ffffff"')
    .replace(/\bstroke="black"\b/gi, 'stroke="#000000"')
    .replace(/fill\s*:\s*white\b/gi, 'fill:#ffffff')
    .replace(/fill\s*:\s*black\b/gi, 'fill:#000000');
}

function getSvgSource(name) {
  const asset = window.UPLOADED_IMAGES?.find(a => a.name === name);
  if (asset?.dataUrl) {
    if (asset.dataUrl.startsWith('data:')) {
      try {
        const comma = asset.dataUrl.indexOf(',');
        const meta = asset.dataUrl.slice(5, comma);
        const data = asset.dataUrl.slice(comma + 1);
        const text = meta.includes('base64') ? atob(data) : decodeURIComponent(data);
        return { kind: 'text', value: text };
      } catch (e) { /* fall through */ }
    }
    return { kind: 'url', value: asset.dataUrl };
  }
  return { kind: 'url', value: 'assets/' + name };
}

async function loadSvgText(name, fallback) {
  try {
    const src = getSvgSource(name);
    if (src.kind === 'text' && src.value.includes('<svg')) return src.value;
    if (src.kind === 'url') {
      const res = await fetch(src.value);
      if (res.ok) {
        const txt = await res.text();
        if (txt.includes('<svg')) return txt;
      }
    }
  } catch (e) {
    console.warn('[logos] fetch failed for', name, '- using inline fallback');
  }
  return fallback;
}

// ---------- Fallback inline SVG markup ----------
const PIPER_SVG = `<svg width="1121" height="206" viewBox="0 0 1121 206" xmlns="http://www.w3.org/2000/svg"><path d="M67.6125 203.118H0V0H148.691C182.357 0 210.973 29.7383 210.973 65.0876C210.973 101.278 181.796 132.981 148.691 132.981H67.6125V203.118ZM6.7332 196.385H60.8793V126.247H148.691C177.588 126.247 203.96 97.0702 203.96 65.0876C203.96 33.666 178.71 6.73319 148.691 6.73319H6.7332V196.385ZM153.18 66.4903C153.18 78.8345 143.361 92.3009 130.175 92.3009H61.4404V40.6797H130.175C143.361 40.6797 153.18 54.4267 153.18 66.4903ZM68.1736 47.4129V85.5677H130.175C139.153 85.5677 146.166 75.1874 146.166 66.4903C146.166 57.7933 139.153 47.4129 130.175 47.4129H68.1736Z" fill="#ffffff"/><path d="M310.354 0V203.118H242.741V0H310.354ZM249.475 6.73319V196.385H303.621V6.73319H249.475Z" fill="#ffffff"/><path d="M410.081 203.118H342.468V0H491.159C524.825 0 553.441 29.7383 553.441 65.0876C553.441 101.278 524.264 132.981 491.159 132.981H410.081V203.118ZM349.201 196.385H403.347V126.247H491.159C520.056 126.247 546.428 97.0702 546.428 65.0876C546.428 33.666 521.178 6.73319 491.159 6.73319H349.201V196.385ZM495.648 66.4903C495.648 78.8345 485.829 92.3009 472.643 92.3009H403.908V40.6797H472.643C485.829 40.6797 495.648 54.4267 495.648 66.4903ZM410.642 47.4129V85.5677H472.643C481.621 85.5677 488.634 75.1874 488.634 66.4903C488.634 57.7933 481.621 47.4129 472.643 47.4129H410.642Z" fill="#ffffff"/><path d="M785.132 149.253V203.118H578.086V0H785.132V53.8656H645.698V78.8345H741.927V124.284H645.698V149.253H785.132ZM584.819 6.73319V196.385H778.118V156.266H638.685V117.55H734.913V85.5677H638.685V47.1324H778.118V6.73319H584.819Z" fill="#ffffff"/><path d="M1028.53 203.118H959.237V159.072C959.237 138.592 957.273 130.736 936.793 129.895H884.33V203.118H816.718V0H965.129C999.917 0 1027.41 27.2133 1027.41 62.2821C1027.41 80.7983 1019.27 98.1924 1005.53 109.976C1019.84 118.953 1028.53 135.225 1028.53 153.461V203.118ZM965.97 159.072V196.385H1021.8V153.461C1021.8 136.067 1012.54 120.636 997.672 113.342L992.622 110.817L997.392 107.451C1011.98 97.3508 1020.68 80.2372 1020.68 62.2821C1020.68 31.141 996.27 6.73319 965.129 6.73319H823.451V196.385H877.597V123.161H937.074C964.006 124.003 965.97 138.592 965.97 159.072ZM969.898 63.4043C969.898 75.7485 960.079 89.2148 946.893 89.2148H877.878V37.5937H946.893C959.798 37.5937 969.898 51.3406 969.898 63.4043ZM884.611 44.6074V82.4817H946.893C955.029 82.4817 962.884 72.943 962.884 63.4043C962.884 54.9878 955.59 44.6074 946.893 44.6074H884.611Z" fill="#ffffff"/><path d="M1120.88 175.624C1120.88 192.738 1107.41 205.924 1090.58 205.924C1073.47 205.924 1060.28 192.738 1060.28 175.624C1060.28 158.511 1073.47 145.325 1090.58 145.325C1107.13 145.325 1120.88 158.791 1120.88 175.624ZM1113.87 175.624C1113.87 162.719 1103.49 152.339 1090.58 152.339C1077.39 152.339 1067.01 162.438 1067.01 175.624C1067.01 188.81 1077.39 199.19 1090.58 199.19C1103.77 199.19 1113.87 188.81 1113.87 175.624Z" fill="#ffffff"/></svg>`;

const VISION_SVG = `<svg width="1294" height="213" viewBox="0 0 1294 213" xmlns="http://www.w3.org/2000/svg"><path d="M286.161 4.54618L178.71 207.664H106.889L0 4.54618H76.5901L143.08 133.599L209.01 4.54618H286.161ZM11.222 11.2794L111.098 200.931H174.502L274.658 11.2794H213.218L143.08 148.749L72.3819 11.2794H11.222Z" fill="#ffffff"/><path d="M385.697 4.54618V207.664H318.084V4.54618H385.697ZM324.817 11.2794V200.931H378.964V11.2794H324.817Z" fill="#ffffff"/><path d="M633.273 152.676C630.468 191.392 594.277 212.153 528.628 212.153C528.067 212.153 527.787 212.153 527.225 212.153C458.491 211.311 417.811 182.695 417.811 135.002V131.635H488.51L488.229 135.282C487.668 145.102 489.912 152.676 494.962 158.287C501.415 165.021 512.356 168.668 526.103 168.668C542.095 168.668 551.914 164.74 553.597 157.446C555.28 150.993 550.511 142.857 546.583 140.613C531.714 131.355 512.917 126.585 495.243 122.377C459.893 113.68 423.703 104.702 421.178 59.2534C422.3 46.3481 425.386 35.9678 436.047 25.3069C454.563 7.63222 484.301 -0.784269 524.42 0.057386H526.664C574.358 0.057386 632.432 13.2432 637.201 75.8058L637.482 81.4168H565.941V76.3669C565.941 71.5976 566.502 60.3756 558.928 52.8007C553.036 46.6287 543.497 43.8231 530.311 44.3843L527.786 44.1037C512.917 44.1037 502.537 45.2259 499.732 58.1312C498.89 63.7422 502.818 66.8282 509.551 71.317C520.492 77.4891 531.995 80.8557 544.058 84.2223L547.425 85.3445C571.833 91.5166 636.079 108.35 633.273 152.676ZM424.544 138.368V138.649C427.35 199.248 503.659 204.859 527.225 205.139C570.711 205.139 623.173 196.442 626.54 152.115C628.784 113.68 568.466 97.9693 545.742 91.7972L542.375 90.9555C529.75 87.5889 517.687 83.9418 505.904 77.2086C499.17 72.7198 491.596 67.3893 492.998 57.009C497.207 37.09 515.162 37.3705 528.067 37.3705H530.311C545.181 36.8094 556.683 40.4566 563.697 47.7508C572.394 56.4479 572.955 68.231 572.674 74.4031H629.907C625.698 29.5151 590.91 7.07112 526.664 7.07112L524.42 6.79058C485.985 5.94892 457.93 13.8043 440.816 30.3568C431.558 39.3344 429.033 48.3119 427.911 59.2534C430.155 99.372 461.016 106.947 496.645 115.644C515.162 120.133 534.239 124.902 549.95 134.721C555.842 138.088 563.136 148.749 560.33 159.129C558.366 166.704 550.792 175.401 526.103 175.401C510.112 175.401 497.768 171.193 489.912 162.776C484.021 156.604 481.215 148.468 481.215 138.368H424.544Z" fill="#ffffff"/><path d="M737.206 4.54618V207.664H669.593V4.54618H737.206ZM676.327 11.2794V200.931H730.473V11.2794H676.327Z" fill="#ffffff"/><path d="M1003.58 105.825C1003.58 170.351 957.569 211.872 886.309 211.872C815.05 211.872 769.32 170.351 769.32 105.825C769.32 41.5788 815.05 0.057386 886.309 0.057386C957.569 0.057386 1003.58 41.5788 1003.58 105.825ZM996.565 105.825C996.565 45.787 953.361 6.79058 886.309 6.79058C819.258 6.79058 776.053 45.787 776.053 105.825C776.053 166.143 819.258 205.139 886.309 205.139C953.361 205.139 996.565 166.143 996.565 105.825ZM942.7 106.105C942.7 141.174 919.975 164.46 886.309 164.46C852.924 164.46 830.199 141.174 830.199 106.105C830.199 70.7559 852.363 47.7508 886.309 47.7508C920.536 47.7508 942.7 70.7559 942.7 106.105ZM935.686 106.105C935.686 74.9642 916.328 54.4841 886.309 54.4841C862.463 54.4841 837.213 68.231 837.213 106.105C837.213 137.527 856.571 157.726 886.309 157.726C916.328 157.726 935.686 137.527 935.686 106.105Z" fill="#ffffff"/><path d="M1293.74 4.54618V207.664H1228.09L1102.68 80.0141V207.664H1035.35V4.54618H1100.72L1226.12 140.613V4.54618H1293.74ZM1095.95 63.1811L1230.89 200.931H1287V11.2794H1232.86V158.287L1097.63 11.2794H1042.08V200.931H1095.95V63.1811Z" fill="#ffffff"/></svg>`;

// ---------- Extruded 3D SVG logos ----------
const svgLoader = new SVGLoader();

const logoMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0.55,
  roughness: 0.22,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  envMap: envMap,
  envMapIntensity: 1.8,
  emissive: new THREE.Color(0xff9650),
  emissiveIntensity: 0.0035,
});

function buildLogoGeometry(svgText, { targetWidth, depth }) {
  const cleanSvg = sanitiseSvg(svgText);
  const data = svgLoader.parse(cleanSvg);

  const extrudeSettings = {
    depth: depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.18,
    bevelSize: depth * 0.12,
    bevelSegments: 3,
    curveSegments: 12,
  };

  const allShapes = [];
  for (const path of data.paths) {
    const shapes = SVGLoader.createShapes(path);
    for (const shape of shapes) allShapes.push(shape);
  }

  if (allShapes.length === 0) {
    for (const path of data.paths) {
      for (const subPath of path.subPaths) {
        try {
          const shape = new THREE.Shape(subPath.getPoints());
          allShapes.push(shape);
        } catch (e) { /* skip */ }
      }
    }
  }

  if (allShapes.length === 0) {
    throw new Error('SVGLoader: no shapes extracted from SVG');
  }

  const geos = [];
  for (const shape of allShapes) {
    const g = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    g.deleteAttribute('uv');
    geos.push(g);
  }

  // Merge into ONE geometry so each logo (and every echo clone) is a single mesh.
  let merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
  if (!merged) merged = geos[0];

  merged.computeBoundingBox();
  const box = merged.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  merged.translate(-center.x, -center.y, -center.z);

  const s = size.x > 0 ? targetWidth / size.x : 1;
  merged.scale(s, -s, s);
  merged.computeVertexNormals();

  return merged;
}

// A logo "system": a solid main mesh that flies out of the black hole, plus a
// pool of additive ghost clones that trail behind it for the echo effect.
function buildLogoSystem(geometry, { homePosition, startZ, echoCount, delay }) {
  const wrapper = new THREE.Group();
  wrapper.position.copy(homePosition);

  const mainMesh = new THREE.Mesh(geometry, logoMat);
  mainMesh.frustumCulled = false;
  wrapper.add(mainMesh);

  const echoes = [];
  for (let i = 0; i < echoCount; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xaecbff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ghost = new THREE.Mesh(geometry, m);
    ghost.frustumCulled = false;
    ghost.visible = false;
    echoes.push(ghost);
    wrapper.add(ghost);
  }

  return {
    wrapper,
    mainMesh,
    echoes,
    home: homePosition.clone(),
    startZ,
    delay,
    history: [], // ring buffer of past {pos, scale}
  };
}

const logoGroup = new THREE.Group();
logoGroup.name = 'logos';
scene.add(logoGroup);

let piperSys = null;
let visionSys = null;

// Where the black hole sits in world space (logos launch from here).
const BH_LAUNCH = new THREE.Vector3(0, 0, -38);

// Animation timing (seconds).
const FLY_IN_DURATION = 2.6;   // black hole -> home
const HOLD_DURATION = 3.0;     // rest at home, fully visible
const FLY_OUT_DURATION = 1.6;  // home -> toward camera
const LOGO_DELAY = 1.0;        // VISION starts 1s after PIPER
const REPEAT_GAP = 2.0;        // pause before the whole cycle repeats

// Full per-logo cycle length (its own delay is added on top).
const CYCLE_DURATION = FLY_IN_DURATION + HOLD_DURATION + FLY_OUT_DURATION + REPEAT_GAP;

let flyStart = -1;      // set once both logos are ready

(async () => {
  try {
    const piperText = await loadSvgText('PIPER.svg', PIPER_SVG);
    const visionText = await loadSvgText('vision.svg', VISION_SVG);

    const piperGeo = buildLogoGeometry(piperText, { targetWidth: 18, depth: 0.5 });
    const visionGeo = buildLogoGeometry(visionText, { targetWidth: 20, depth: 0.5 });

    piperSys = buildLogoSystem(piperGeo, {
      homePosition: new THREE.Vector3(0, 4.8, -6),
      startZ: BH_LAUNCH.z,
      echoCount: 14,
      delay: 0.0,
    });
    // PIPER (top) exits higher and slightly off-center so it sweeps past the
    // upper portion of the camera rather than into the middle.
    piperSys.camExit = new THREE.Vector3(-4, 11, 22);
    piperSys.wrapper.name = 'piperLogo';
    logoGroup.add(piperSys.wrapper);

    visionSys = buildLogoSystem(visionGeo, {
      homePosition: new THREE.Vector3(0, -4.2, -6),
      startZ: BH_LAUNCH.z,
      echoCount: 14,
      delay: LOGO_DELAY,
    });
    // VISION (bottom) exits lower so it sweeps past the lower portion.
    visionSys.camExit = new THREE.Vector3(4, -11, 22);
    visionSys.wrapper.name = 'visionLogo';
    logoGroup.add(visionSys.wrapper);

    flyStart = clock.elapsedTime;
    console.log('[logos] both logo systems built; fly-out armed');
  } catch (e) {
    console.error('[logos] failed to build SVG logos:', e);
  }
})();

// Smooth easing curves.
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x) { return x * x * x; }

// Drives one logo system through a looping cycle:
//   1. FLY IN  - emerges tiny from the black hole and scales up to home
//   2. HOLD    - rests at home, fully visible
//   3. FLY OUT - accelerates toward (and past) the camera, shrinking away
//   4. GAP     - hidden, then the cycle repeats
// During both the fly-in and fly-out it records a motion trail that the echo
// clones replay behind it for the ghosting effect.
function updateLogoSystem(sys, t, mx, my, bob, bobPhase) {
  if (!sys || flyStart < 0) return;

  // Position within this logo's own repeating cycle.
  const elapsed = t - flyStart - sys.delay;
  const cyc = ((elapsed % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  const started = elapsed >= 0;

  // Gentle idle drift / mouse parallax used for the home resting pose.
  const idleX = mx * 0.6;
  const idleY = sys.home.y + Math.sin(t * bob + bobPhase) * 0.12 - my * 0.4;
  const homePos = new THREE.Vector3(idleX, idleY, sys.home.z);

  const cur = new THREE.Vector3();
  let scale = 1.0;
  let phaseRot = 0;       // extra spin during flight
  let recording = false;  // whether to push trail history this frame
  let visible = true;

  if (!started) {
    // Before the very first launch: keep hidden at the hole.
    cur.set(BH_LAUNCH.x, BH_LAUNCH.y, BH_LAUNCH.z);
    scale = 0.04;
    visible = false;
  } else if (cyc < FLY_IN_DURATION) {
    // --- Phase 1: fly in from the black hole ---
    const p = cyc / FLY_IN_DURATION;
    const e = easeOutCubic(p);
    cur.set(
      THREE.MathUtils.lerp(BH_LAUNCH.x, homePos.x, e),
      THREE.MathUtils.lerp(BH_LAUNCH.y, homePos.y, e),
      THREE.MathUtils.lerp(sys.startZ, homePos.z, e)
    );
    scale = THREE.MathUtils.lerp(0.04, 1.0, e);
    phaseRot = (1 - e) * 1.6;
    recording = p < 1;
  } else if (cyc < FLY_IN_DURATION + HOLD_DURATION) {
    // --- Phase 2: hold at home ---
    cur.copy(homePos);
    scale = 1.0;
  } else if (cyc < FLY_IN_DURATION + HOLD_DURATION + FLY_OUT_DURATION) {
    // --- Phase 3: fly out toward the camera ---
    const exit = sys.camExit;
    const p = (cyc - FLY_IN_DURATION - HOLD_DURATION) / FLY_OUT_DURATION;
    const e = easeInCubic(p);
    cur.set(
      THREE.MathUtils.lerp(homePos.x, exit.x, e),
      THREE.MathUtils.lerp(homePos.y, exit.y, e),
      THREE.MathUtils.lerp(homePos.z, exit.z, e)
    );
    // Grow as it rushes past, then it's behind the camera.
    scale = THREE.MathUtils.lerp(1.0, 2.6, e);
    phaseRot = e * 1.2;
    recording = true;
    // Once the logo has swept past the camera plane, hide it immediately so it
    // never reappears huge or behind the camera (prevents the "pop back in").
    if (cur.z > camera.position.z - 2.5) {
      visible = false;
      recording = false;
      sys.history.length = 0;
    }
  } else {
    // --- Phase 4: gap before repeating (hidden) ---
    // Park it far back at the launch point (not at home) while invisible, so the
    // snap-to-home transition is never rendered for even a single frame.
    cur.set(BH_LAUNCH.x, BH_LAUNCH.y, BH_LAUNCH.z);
    scale = 0.04;
    visible = false;
    sys.history.length = 0; // clear trail so echoes don't linger into next cycle
  }

  sys.wrapper.position.copy(cur);
  sys.mainMesh.visible = visible;
  sys.mainMesh.scale.setScalar(scale);
  sys.mainMesh.rotation.y = mx * 0.08 + Math.sin(t * 0.4 + bobPhase) * 0.03 + phaseRot;
  sys.mainMesh.rotation.x = -my * 0.05;
  sys.mainMesh.material.opacity = 1.0;
  sys.mainMesh.material.transparent = false;

  // Record trail history while flying (echoes appear during launch + exit).
  if (recording && visible) {
    sys.history.unshift({
      x: cur.x, y: cur.y, z: cur.z,
      sx: scale, ry: sys.mainMesh.rotation.y, rx: sys.mainMesh.rotation.x,
    });
    if (sys.history.length > 140) sys.history.pop();
  }

  // Place echo clones along the recent trail, fading + shrinking with age.
  const spacing = 4; // frames between successive echoes
  for (let i = 0; i < sys.echoes.length; i++) {
    const ghost = sys.echoes[i];
    const idx = (i + 1) * spacing;
    const rec = sys.history[idx];
    if (!rec || !recording || !visible) {
      // fade ghosts out once arrived / hidden
      ghost.material.opacity *= 0.80;
      if (ghost.material.opacity < 0.01) ghost.visible = false;
      continue;
    }
    ghost.visible = true;
    // local position relative to wrapper (wrapper is at cur)
    ghost.position.set(rec.x - cur.x, rec.y - cur.y, rec.z - cur.z);
    ghost.scale.setScalar(rec.sx);
    ghost.rotation.set(rec.rx, rec.ry, 0);
    const ageF = i / sys.echoes.length;
    ghost.material.opacity = (1 - ageF) * 0.5;
  }
}

// ---------- Error overlay ----------
function showError(html) {
  let el = document.getElementById('errOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'errOverlay';
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-width:80%;padding:18px 22px;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#fff;background:rgba(20,8,12,0.92);border:1px solid #FF2244;text-align:center;z-index:9999;';
    document.body.appendChild(el);
  }
  el.innerHTML = html;
}

// ---------- Interaction ----------
const mouse = new THREE.Vector2(0, 0);
const target = new THREE.Vector2(0, 0);

const BH_PULSE_PERIOD = 12.0;
let bhPulseStrength = 0.0;
let bhPulseCount = 0;

window.addEventListener('pointermove', (e) => {
  target.x = (e.clientX / window.innerWidth - 0.5) * 2;
  target.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ---------- Animate ----------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateStreaks(dt);

  photonMat.uniforms.uTime.value = t;
  photonRing.lookAt(camera.position);
  // Keep the feathered disc facing the camera so its circular shape is never
  // foreshortened into an ellipse by the black hole group's tilt.
  horizon.lookAt(camera.position);

  nebula.rotation.z = t * 0.02;
  stars.rotation.z = t * 0.005;

  updateLogoSystem(piperSys, t, mouse.x, mouse.y, 0.6, 0.0);
  updateLogoSystem(visionSys, t, mouse.x, mouse.y, 0.55, 1.3);

  rimLight.position.x = Math.sin(t * 0.6) * 7;
  coolLight.position.y = Math.cos(t * 0.5) * 5;
  magentaLight.intensity = 3.0 + Math.sin(t * 3) * 1.2;

  mouse.lerp(target, 0.04);

  const cycleCount = Math.floor(t / BH_PULSE_PERIOD);
  if (cycleCount > bhPulseCount) bhPulseCount = cycleCount;
  const phase = (t % BH_PULSE_PERIOD) / BH_PULSE_PERIOD;
  const wave = Math.sin(Math.min(phase, 1.0) * Math.PI);
  const surgePeak = Math.min(0.6 + bhPulseCount * 0.18, 1.4);
  const targetPulse = wave * wave * surgePeak;
  bhPulseStrength += (targetPulse - bhPulseStrength) * 0.18;

  const flare = Math.min(bhPulseStrength / 1.2, 1.0);
  photonMat.uniforms.uFlare.value = flare;
  const breathe = 1 + Math.sin(t * 1.6) * 0.02;
  bhGlow.scale.setScalar(34 * breathe * (1.0 + flare * 0.04));
  bhGlow.material.opacity = 0.45 + flare * 0.05;

  // Pulse logo emissive in sync with black hole flare
  logoMat.emissiveIntensity = 0.00035 + flare * 0.0006;

  for (const a of armNodes) {
    const phase = a.side === 'left' ? 0 : Math.PI;
    const sign = a.side === 'left' ? 1 : -1;
    a.node.rotation.x = a.rest.x + Math.sin(t * 1.1 + phase) * 0.28;
    a.node.rotation.z = a.rest.z + sign * (0.22 + Math.sin(t * 0.8 + phase) * 0.20);
    a.node.rotation.y = a.rest.y + Math.cos(t * 0.7 + phase) * 0.16;
  }

  if (astronaut) {
    const floatRaw = Math.sin(t * 0.8) * 0.4;
    const floatY = floatRaw >= 0 ? floatRaw : floatRaw * 0.35;
    // Clamp downward travel so the spaceman never drifts low enough to cover the
    // bottom (VISION) logo, which rests around y = -4.2.
    // Convert 100px upward shift to world units using the camera's FOV and distance.
    // At z=5.8 (distance from camera at z=14 is ~8.2 units), 100px ≈ 0.85 world units.
    const upShift = (100 / window.innerHeight) * 2 * Math.tan((55 * Math.PI / 180) / 2) * (14 - 5.8);
    astronaut.position.y = Math.max(-0.05 + floatY + upShift, -1.6 + upShift);
    astronaut.position.z = 5.8;
    astronaut.position.x = Math.sin(t * 0.4) * 0.5 + mouse.x * 1.2;
    astronaut.rotation.y = -0.2 + Math.sin(t * 0.5) * 0.25 + mouse.x * 0.3;
    astronaut.rotation.x = 0.15 + Math.PI / 6 + Math.PI / 18 + Math.cos(t * 0.6) * 0.12 - mouse.y * 0.2;
    astronaut.rotation.z = 0.05 + Math.sin(t * 0.3) * 0.08;
  }

  camera.position.x += (mouse.x * 1.6 - camera.position.x) * 0.03;
  camera.position.y += (-mouse.y * 1.2 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, -10);

  composer.render();
}
renderer.setAnimationLoop(animate);

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

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

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.1, 0.7, 0.25);
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

// ---------- Warp core glow (the bright center the image radiates from) ----------
const coreGroup = new THREE.Group();
coreGroup.name = 'warpCore';
coreGroup.position.set(0, 0, -40);
scene.add(coreGroup);

function radialSprite(color, size, opacity) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

coreGroup.add(radialSprite('rgba(255,240,210,1)', 26, 0.9));
coreGroup.add(radialSprite('rgba(120,170,255,0.9)', 48, 0.6));
coreGroup.add(radialSprite('rgba(255,120,180,0.8)', 70, 0.35));

// ---------- Hyperspace warp streaks (radial starburst lines) ----------
const STREAKS = 2600;
const streakGeo = new THREE.BufferGeometry();
const positions = new Float32Array(STREAKS * 6); // two points per line
const streakColors = new Float32Array(STREAKS * 6);
const streakData = []; // {angle, radius, z, len, speed, baseColor}

const palette = [
  new THREE.Color(0xfff0c8), // warm white
  new THREE.Color(0xff7a3a), // orange
  new THREE.Color(0x4a9bff), // blue
  new THREE.Color(0x9b6bff), // violet
  new THREE.Color(0xff5ab0), // magenta
  new THREE.Color(0x44e0ff), // cyan
];

function resetStreak(i, randomZ) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.pow(Math.random(), 0.5) * 2.5 + 0.2; // cluster near center
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

    // perspective spread: streaks fan outward as they approach
    const spread = THREE.MathUtils.mapLinear(s.z, -130, camera.position.z, 1.0, 9.0);
    const r = s.radius * spread;
    const x = Math.cos(s.angle) * r;
    const y = Math.sin(s.angle) * r;
    // tail length grows with proximity for the motion-streak look
    const tail = s.len * THREE.MathUtils.mapLinear(s.z, -130, camera.position.z, 0.4, 3.5);

    const o = i * 6;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = s.z;
    pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = s.z - tail;

    const bright = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(s.z, -130, 0, 0.15, 1.4), 0.1, 1.4);
    const c = s.baseColor;
    col[o] = c.r * bright; col[o + 1] = c.g * bright; col[o + 2] = c.b * bright;
    col[o + 3] = c.r * bright * 0.1; col[o + 4] = c.g * bright * 0.1; col[o + 5] = c.b * bright * 0.1;
  }
  streakGeo.attributes.position.needsUpdate = true;
  streakGeo.attributes.color.needsUpdate = true;
}

// ---------- Background star field (slow, distant) ----------
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

// ---------- Nebula clouds (additive sprites near the core) ----------
function nebulaSprite(color, size, x, y, z, opacity) {
  const sp = radialSprite(color, size, opacity);
  sp.position.set(x, y, z);
  return sp;
}
const nebula = new THREE.Group();
nebula.name = 'nebula';
nebula.add(nebulaSprite('rgba(120,60,220,0.7)', 60, -22, 8, -55, 0.30));
nebula.add(nebulaSprite('rgba(220,70,120,0.7)', 55, 24, -10, -50, 0.28));
nebula.add(nebulaSprite('rgba(40,120,220,0.7)', 70, 8, 14, -65, 0.25));
scene.add(nebula);

// ---------- Astronaut model ----------
let astronaut = null;
const MODEL_FILE = 'spaceman-falling.glb';
// In the studio preview the GLB is provided via window.UPLOADED_3D_MODELS.
// On a real server it won't exist, so fall back to a file sitting next to this script.
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

// arm nodes discovered in the model, with their rest rotations
const armNodes = [];

// match a wide range of arm-bone naming conventions (Mixamo, Blender Rigify, MakeHuman, generic)
const ARM_RE = /(upperarm|upper_arm|lowerarm|lower_arm|forearm|shoulder|clavicle|elbow|\barm\b|arm[_.]?[lr]\b|[_.]arm)/i;
// prefer "upper arm / shoulder" joints so the whole arm swings from the top
const UPPER_RE = /(upperarm|upper_arm|shoulder|clavicle|\barm\b)/i;

function detectSide(node, worldPos) {
  const n = (node.name || '').toLowerCase();
  if (/(left|lft|\bl\b|_l\b|\.l\b|l_|leftarm|arm_l|l_arm)/.test(n)) return 'left';
  if (/(right|rgt|\br\b|_r\b|\.r\b|r_|rightarm|arm_r|r_arm)/.test(n)) return 'right';
  // fall back to world-space X (model's left is +X after it faces us, but either works as "opposite")
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
        if (o.material) {
          o.material.envMapIntensity = 1.2;
          o.material.needsUpdate = true;
        }
      }
      if (o.isBone) allBones.push(o);
      dump.push(`${o.type}: ${o.name}`);
    });

    // 1) try to find arm bones from the skeleton
    let candidates = allBones.filter((b) => ARM_RE.test(b.name || ''));
    // prefer upper-arm/shoulder joints when available
    const uppers = candidates.filter((b) => UPPER_RE.test(b.name || ''));
    if (uppers.length) candidates = uppers;

    // 2) if no skeleton/bones matched, fall back to any node whose name looks like an arm
    if (candidates.length === 0) {
      m.traverse((o) => { if (ARM_RE.test(o.name || '')) candidates.push(o); });
    }

    const wp = new THREE.Vector3();
    for (const node of candidates) {
      node.getWorldPosition(wp);
      armNodes.push({ node, rest: node.rotation.clone(), side: detectSide(node, wp.clone()), name: node.name });
    }

    console.log('[astronaut] bones:', allBones.length, '| arm joints used:', armNodes.map(a => `${a.name}(${a.side})`));
    if (armNodes.length === 0) console.warn('[astronaut] no arm joints found. Full hierarchy:\n' + dump.join('\n'));

    frameModel(m);
    astronaut.add(m);
    astronaut.position.set(0, -0.3, 4);
    astronaut.rotation.set(0.15 + Math.PI / 6 + Math.PI / 18, -0.2, 0.05);
    scene.add(astronaut);
  }, undefined, (err) => {
    console.error('Model load error:', err);
    showError('Could not load "' + MODEL_FILE + '".<br>Make sure the .glb file sits in the same folder as hyperspace.js (case-sensitive), and that your server allows .glb files.');
  });
}

// ---------- On-screen error overlay ----------
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

// ---------- Interaction (subtle parallax) ----------
const mouse = new THREE.Vector2(0, 0);
const target = new THREE.Vector2(0, 0);
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

  // pulsing warp core
  const pulse = 1 + Math.sin(t * 2.2) * 0.06;
  coreGroup.scale.setScalar(pulse);
  coreGroup.children.forEach((s, i) => { s.material.rotation = t * (0.05 + i * 0.03); });

  // slow nebula drift
  nebula.rotation.z = t * 0.02;
  stars.rotation.z = t * 0.005;

  // animate accent lights
  rimLight.position.x = Math.sin(t * 0.6) * 7;
  coolLight.position.y = Math.cos(t * 0.5) * 5;
  magentaLight.intensity = 3.0 + Math.sin(t * 3) * 1.2;

  mouse.lerp(target, 0.04);

  // arm sway — clearly visible weightless drift, opposite swing per side
  for (const a of armNodes) {
    const phase = a.side === 'left' ? 0 : Math.PI; // opposite swing per side
    const sign = a.side === 'left' ? 1 : -1;
    a.node.rotation.x = a.rest.x + Math.sin(t * 1.1 + phase) * 0.28;
    a.node.rotation.z = a.rest.z + sign * (0.22 + Math.sin(t * 0.8 + phase) * 0.20);
    a.node.rotation.y = a.rest.y + Math.cos(t * 0.7 + phase) * 0.16;
  }

  if (astronaut) {
    // gentle floating + tumbling drift
    astronaut.position.y = -0.3 + Math.sin(t * 0.8) * 0.4;
    astronaut.position.x = Math.sin(t * 0.4) * 0.5 + mouse.x * 1.2;
    astronaut.rotation.y = -0.2 + Math.sin(t * 0.5) * 0.25 + mouse.x * 0.3;
    astronaut.rotation.x = 0.15 + Math.PI / 6 + Math.PI / 18 + Math.cos(t * 0.6) * 0.12 - mouse.y * 0.2;
    astronaut.rotation.z = 0.05 + Math.sin(t * 0.3) * 0.08;
  }

  // camera parallax + subtle forward sway
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
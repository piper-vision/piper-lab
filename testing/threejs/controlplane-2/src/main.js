import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG } from './config.js';
import { createOrb } from './Orb.js';
import { createDust, createBackdrop } from './Background.js';

const container = document.getElementById('scene');
const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 820;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(CONFIG.background, 1);
// shader colors are authored as display values; keep the composer from re-encoding
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = createBackdrop();
const CAM = CONFIG.camera;
const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 0, CAM.distance);

const orb = createOrb(isMobile);
scene.add(orb.group);

const dust = createDust(isMobile);
scene.add(dust.object);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const B = CONFIG.bloom;
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  isMobile ? B.strengthMobile : B.strength,
  B.radius,
  B.threshold
);
composer.addPass(bloom);

// --- scroll -> repair progress ---
let repair = 0;
function scrollProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
}

// --- UI layers driven by scroll ---
const heroAnim = document.querySelector('#hero .anim');
const revealEl = document.getElementById('reveal');
const revealAnim = document.querySelector('#reveal .anim');
const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// --- noise reveals: crisp text dissolves in through a fractal noise mask.
// The filter thresholds a static noise field against the mask alpha; we
// sweep the threshold so the text appears blotch by blotch, undistorted.
const noiseReveals = [];
function startNoiseReveal(el, idx, delay, duration) {
  noiseReveals.push({
    el,
    func: document.getElementById(`nrf-${idx}`),
    filter: `url(#nr-${idx})`,
    delay, duration,
    start: null,
    done: false,
  });
}
function updateNoiseReveals(now) {
  for (const r of noiseReveals) {
    if (r.done) continue;
    if (r.start === null) {
      r.start = now + r.delay;
      r.func.setAttribute('intercept', '-9');
      r.el.style.filter = r.filter;
      r.el.style.opacity = '1';
    }
    const t = (now - r.start) / r.duration;
    if (t < 0) continue;
    if (t >= 1) {
      r.el.style.filter = 'none';
      r.done = true;
      continue;
    }
    const e = t * t * (3 - 2 * t);
    // slope 7 mask: intercept -9 hides everything, +0.6 passes everything
    r.func.setAttribute('intercept', String(-9 + 9.6 * e));
  }
}
let revealBlockShown = false;
document.fonts.ready.then(() => {
  startNoiseReveal(document.querySelector('#hero .wordmark'), 0, 150, 1600);
  startNoiseReveal(document.querySelector('#hero h1'), 1, 450, 2200);
});

// --- pointer parallax ---
const pointer = { x: 0, y: 0 };
const parallax = { x: 0, y: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  const h = renderer.domElement.height;
  orb.resize(h, CAM.fov);
  dust.resize(h, CAM.fov);
}
addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
let time = 0;
window.__state = () => ({ repair, target: scrollProgress(), spin: orb.group.rotation.y });

renderer.setAnimationLoop(() => {
  time += Math.min(clock.getDelta(), 0.05);

  // eased pursuit of the scroll target, then a cinematic ease-in-out
  const target = scrollProgress();
  repair += (target - repair) * CONFIG.scroll.smoothing;
  const eased = repair * repair * (3 - 2 * repair);

  orb.update(time, eased);
  orb.group.rotation.y = time * CONFIG.orb.spinSpeed;

  // travel: bottom-of-frame mound -> large sphere on the left
  const P = CONFIG.orbPath;
  const halfH = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * CAM.distance;
  const endX = -Math.min(P.endXMax, halfH * camera.aspect * P.endXFrac);
  orb.group.position.x = endX * eased;
  orb.group.position.y = P.startY * (1 - eased);
  orb.group.scale.set(
    P.startScaleXZ + (1 - P.startScaleXZ) * eased,
    P.startScaleY + (1 - P.startScaleY) * eased,
    P.startScaleXZ + (1 - P.startScaleXZ) * eased
  );

  // hero fades out early; reveal block fades in at the end
  const out = smooth01(P.uiFadeOut[0], P.uiFadeOut[1], eased);
  heroAnim.style.opacity = 1 - out;
  heroAnim.style.transform = `translateY(calc(-5vh - ${out * 60}px))`;
  const inn = smooth01(P.uiFadeIn[0], P.uiFadeIn[1], eased);
  revealEl.style.opacity = inn;
  revealAnim.style.transform = `translateY(${(1 - inn) * 40}px)`;
  if (!revealBlockShown && inn > 0.05) {
    revealBlockShown = true;
    startNoiseReveal(document.querySelector('#reveal h1'), 2, 0, 1200);
  }
  updateNoiseReveals(performance.now());

  dust.update(time);

  // slow drift + pointer parallax
  parallax.x += (pointer.x - parallax.x) * CAM.parallaxEase;
  parallax.y += (pointer.y - parallax.y) * CAM.parallaxEase;
  camera.position.x = Math.sin(time * CAM.driftSpeed) * CAM.driftAmpX + parallax.x * CAM.parallaxX;
  camera.position.y = Math.sin(time * CAM.driftSpeed * 0.66 + 1.7) * CAM.driftAmpY - parallax.y * CAM.parallaxY;
  camera.position.z = CAM.distance;
  camera.lookAt(0, 0, 0);

  composer.render();
});

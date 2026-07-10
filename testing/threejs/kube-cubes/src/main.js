// Entry point: scene setup, render loop, and the corruption → signal →
// repair state machine that cycles indefinitely.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { CONFIG } from './config.js';
import { CubeField } from './CubeField.js';
import { CorruptedCube } from './CorruptedCube.js';
import { Signals } from './Signals.js';
import { Interaction } from './Interaction.js';
import { tween, updateTweens, Ease } from './tween.js';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CONFIG.fogColor, 1);
// Shader colors are authored as display values; stop the composer's final
// pass from applying an extra linear→sRGB conversion that washes them out.
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  CONFIG.camFov,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);

// --- post-processing: subtle DOF focused on the middle area + bloom for the
// signal pulses and the corrupted cube's glow ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bokehPass = new BokehPass(scene, camera, {
  focus: CONFIG.camDistance,
  aperture: CONFIG.dof.aperture,
  maxblur: CONFIG.dof.maxblur,
});
composer.addPass(bokehPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold,
);
composer.addPass(bloomPass);

// BokehPass re-renders the scene with a depth override material; additive
// helper objects (signal lines/heads, halo, shells) must not stamp their
// quads into that depth buffer or they would punch sharp holes in the blur.
// They are flagged with userData.noDepth and hidden just for that pass.
const bokehRender = bokehPass.render.bind(bokehPass);
bokehPass.render = (...args) => {
  const hidden = [];
  scene.traverse((o) => {
    if (o.userData.noDepth && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });
  bokehRender(...args);
  for (const o of hidden) o.visible = true;
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------
const field = new CubeField(scene);
const corrupted = new CorruptedCube(scene);
const signals = new Signals(scene);
const interaction = new Interaction(canvas, camera, field);

// ---------------------------------------------------------------------------
// Corruption cycle state machine
// ---------------------------------------------------------------------------
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

const cycle = {
  state: 'idle',
  timer: 1.5,            // short first wait so the behaviour shows quickly
  lastIndex: -1,
  target: -1,
  targetPos: new THREE.Vector3(),

  update(t, dt) {
    this.timer -= dt;

    switch (this.state) {
      case 'idle':
        if (this.timer <= 0) this.beginCorruption(t);
        break;

      case 'corrupted':
        if (this.timer <= 0) this.beginSignals(t);
        break;

      case 'signaling':
        if (this.timer <= 0) this.beginRepair();
        break;

      // 'corrupting' and 'repairing' advance via tween completion.
    }
  },

  beginCorruption(t) {
    // Pick a cube in the middle area of the scene (never the previous one).
    const i = field.pickTarget(this.lastIndex, t);
    this.target = i;
    this.lastIndex = i;

    field.getPosition(i, t, this.targetPos);
    field.hideInstance(i);
    corrupted.begin(i, this.targetPos, field.getScale(i), field.cubes[i].seed);

    this.state = 'corrupting';
    tween({
      dur: CONFIG.corruptInDuration,
      ease: Ease.inOut,
      onUpdate: (v) => { corrupted.corruption = v; },
      onComplete: () => {
        this.state = 'corrupted';
        this.timer = rand(...CONFIG.corruptedHold);
      },
    });
  },

  beginSignals(t) {
    const count = Math.round(rand(...CONFIG.signalCount));
    const sources = field.signalSources(this.target, count, t);
    const to = field.getPosition(this.target, t);

    let latest = 0;
    sources.forEach((src, k) => {
      const delay = k * CONFIG.signalStagger;
      latest = Math.max(latest, delay + CONFIG.signalTravel);
      signals.spawn(field.getPosition(src, t), to.clone(), {
        delay,
        travel: CONFIG.signalTravel,
        seed: field.cubes[src].seed + k * 0.618,
      });
    });

    this.state = 'signaling';
    this.timer = latest;    // repair starts once the last pulse arrives
  },

  beginRepair() {
    this.state = 'repairing';
    signals.fadeOut();
    tween({
      dur: CONFIG.repairDuration,
      ease: Ease.inOut,
      onUpdate: (v) => { corrupted.corruption = 1 - v; },
      onComplete: () => {
        // Swap the healed instance back in and fire the confirmation pulse.
        const i = this.target;
        const pos = corrupted.basePos.clone();
        corrupted.end();
        field.showInstance(i);
        corrupted.confirmPulse(pos, field.getScale(i), tween, Ease.out);
        // Brief edge flash on the healed cube.
        field.glow[i] = 1.4;
        field.glowAttr.needsUpdate = true;

        this.state = 'idle';
        this.timer = rand(...CONFIG.idleBetween);
      },
    });
  },
};

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const bobbed = new THREE.Vector3();
// DOF focus eases between the middle of the field and the corrupted cube.
const middleFocus = new THREE.Vector3(0, 0, -4);
const focusTarget = new THREE.Vector3();
let focusDist = CONFIG.camDistance;
let last = performance.now();
let t = 0;

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  t += dt;

  updateTweens(dt);
  interaction.update(t, dt);
  cycle.update(t, dt);

  const scrollBefore = field.scroll;
  field.update(t, dt);
  const dScroll = field.scroll - scrollBefore;

  if (corrupted.index >= 0) {
    field.getPosition(corrupted.index, t, bobbed);
    corrupted.update(t, bobbed);
    field.setCorruptGlow(bobbed, corrupted.glowIntensity(t));
    focusTarget.copy(bobbed);
  } else {
    field.setCorruptGlow(bobbed.set(0, -999, 0), 0);
    focusTarget.copy(middleFocus);
  }
  signals.update(dt, dScroll);

  // Feed the travelling signal heads into both cube materials as moving
  // point lights so the field lights up around them.
  const lights = signals.getLights();
  for (const mat of [field.material, corrupted.material]) {
    const pos = mat.uniforms.uSignalPos.value;
    const ints = mat.uniforms.uSignalInt.value;
    for (let i = 0; i < 8; i++) {
      if (i < lights.length) {
        pos[i].copy(lights[i].pos);
        ints[i] = lights[i].intensity;
      } else {
        ints[i] = 0;
      }
    }
  }

  // Ease the focal plane toward the point of interest.
  const k = 1 - Math.exp(-dt * CONFIG.dof.focusLerp);
  focusDist += (camera.position.distanceTo(focusTarget) - focusDist) * k;
  bokehPass.uniforms.focus.value = focusDist;

  composer.render();
});

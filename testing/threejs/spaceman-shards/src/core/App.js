import * as THREE from 'three';
import { CameraRig } from './CameraRig.js';
import { PostFX } from './PostFX.js';
import { AdaptiveQuality } from './AdaptiveQuality.js';
import { ShardField } from '../scene/ShardField.js';
import { LightField } from '../scene/LightField.js';
import { Particles } from '../scene/Particles.js';
import { Sparkles } from '../scene/Sparkles.js';
import { Spaceman } from '../scene/Spaceman.js';

/**
 * App — owns the renderer and wires the subsystems together:
 * LightField (dynamic environment) → ShardField (geometry) → CameraRig →
 * PostFX (bloom/CA/vignette/FXAA) → AdaptiveQuality (DPR governor).
 */
export class App {
  constructor(canvas) {
    // Coarse pointer ≈ touch device: smaller env map, fewer instances,
    // lower DPR ceiling.
    const isMobile = window.matchMedia('(pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // FXAA runs in post instead
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    // Black fog: distant shards emerge from darkness instead of popping.
    // Full extinction (70) sits inside the shard-wrap re-entry distance
    // (74), so recycled shards are born invisible.
    this.scene.fog = new THREE.Fog(0x000000, 30, 70);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.rig = new CameraRig(this.camera);

    this.lights = new LightField({ resolution: isMobile ? 256 : 1024 });
    this.scene.environment = this.lights.texture;

    // Counts scale with the deeper wrap tile (80 units of populated depth).
    this.shards = new ShardField({
      heroCount: isMobile ? 44 : 64,
      farCount: isMobile ? 150 : 300,
    });
    this.scene.add(this.shards.group);

    this.particles = new Particles({ count: isMobile ? 240 : 400 });
    this.scene.add(this.particles.points);

    this.sparkles = new Sparkles({ count: isMobile ? 40 : 70 });
    this.scene.add(this.sparkles.points);

    this.spaceman = new Spaceman();
    this.scene.add(this.spaceman.group);

    this.post = new PostFX(this.renderer, this.scene, this.camera, {
      samples: isMobile ? 0 : 4,
    });
    this.quality = new AdaptiveQuality({
      maxDpr: Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2),
      onChange: (dpr) => this.#applyDpr(dpr),
    });

    this._lastNow = performance.now();
    this.time = 0;

    window.addEventListener('resize', () => this.#resize());
    this.#resize();
  }

  start() {
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  #tick() {
    // Hidden tab: rAF is throttled to a few Hz — freeze the simulation so
    // time doesn't crawl and the DPR governor doesn't misread throttled
    // frames as GPU load. Resumes seamlessly on return.
    if (document.visibilityState === 'hidden') {
      this._lastNow = performance.now();
      return;
    }

    // Clamp dt so a background-tab pause doesn't lurch the animation.
    const now = performance.now();
    const dt = Math.min((now - this._lastNow) / 1000, 0.05);
    this._lastNow = now;
    this.time += dt;
    const t = this.time;

    this.lights.update(t, this.renderer); // move bars + re-capture env cube
    this.rig.update(t, dt);               // camera first — the world wraps around it
    this.spaceman.update(t, this.camera);
    this.shards.update(t, this.camera.position.z);
    this.particles.update(t, this.camera.position.z, this.renderer.getPixelRatio());
    this.sparkles.update(t, this.camera.position.z, this.renderer.getPixelRatio());
    this.post.render(t);
    this.quality.update(dt);
  }

  #applyDpr(dpr) {
    this.renderer.setPixelRatio(dpr);
    this.post.setSize(window.innerWidth, window.innerHeight, dpr);
  }

  #resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, this.quality.dpr);
  }
}

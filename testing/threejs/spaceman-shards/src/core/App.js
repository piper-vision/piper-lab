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
    this.renderer.toneMappingExposure = 1.32;

    // Quality profile. Integrated GPUs (Apple M-series, Intel/Iris, mobile
    // parts) can't afford the full env-capture cadence, MSAA, or Retina
    // DPR — detect them via the renderer string. `?quality=low|high`
    // overrides for testing.
    const gl = this.renderer.getContext();
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const forced = new URLSearchParams(window.location.search).get('quality');
    const lowPower = forced === 'low' ? true
      : forced === 'high' ? false
      : isMobile || /apple|intel|iris|uhd|mali|adreno/i.test(gpu);
    this.lowPower = lowPower;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    // Black fog: distant shards emerge from darkness instead of popping.
    // Full extinction (70) sits inside the shard-wrap re-entry distance
    // (74), so recycled shards are born invisible.
    this.scene.fog = new THREE.Fog(0x000000, 30, 70);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.rig = new CameraRig(this.camera);

    // Low-power: 256 keeps the per-capture PMREM re-filter cheap enough
    // that capture frames don't spike above the frame budget (rhythmic
    // judder); the soft-edged bars barely show the resolution loss.
    this.lights = new LightField({ resolution: isMobile || lowPower ? 256 : 1024 });
    this.scene.environment = this.lights.texture;

    // Environment re-capture cadence: every Nth frame. Each capture also
    // triggers three's PMREM re-filter — the single most expensive step —
    // so low-power devices start sparser, and the quality governor
    // escalates/relaxes the interval when DPR alone isn't enough.
    this._envIntervalBase = lowPower ? 3 : 2;
    this._envInterval = this._envIntervalBase;
    this._frameIndex = 0;

    // Counts scale with the deeper wrap tile (80 units of populated depth).
    this.shards = new ShardField({
      heroCount: isMobile ? 44 : lowPower ? 52 : 64,
      farCount: isMobile ? 150 : lowPower ? 220 : 300,
    });
    this.scene.add(this.shards.group);

    this.particles = new Particles({ count: isMobile ? 240 : 400 });
    this.scene.add(this.particles.points);

    this.sparkles = new Sparkles({ count: isMobile ? 40 : 70 });
    this.scene.add(this.sparkles.points);

    this.spaceman = new Spaceman();
    this.scene.add(this.spaceman.group);

    this.post = new PostFX(this.renderer, this.scene, this.camera, {
      samples: isMobile || lowPower ? 0 : 4, // FXAA still smooths edges
    });
    this.quality = new AdaptiveQuality({
      maxDpr: Math.min(window.devicePixelRatio || 1, isMobile || lowPower ? 1.5 : 2),
      onChange: (dpr) => this.#applyDpr(dpr),
      // DPR exhausted and still slow → capture the env less often.
      onPressure: () => {
        this._envInterval = Math.min(this._envInterval + 1, 6);
      },
      // Sustained headroom at full DPR → restore capture rate.
      onRelax: () => {
        this._envInterval = Math.max(this._envIntervalBase, this._envInterval - 1);
      },
    });

    this._lastNow = performance.now();
    this.time = 0;

    // Auto-exposure: sample the rendered frame's mean luminance twice a
    // second and glide toneMappingExposure toward a target brightness —
    // dark light-orbit beats lift themselves, hot phases don't blow out.
    // NOTE: no willReadFrequently — that would make this canvas CPU-backed
    // and turn the drawImage below into a full GPU→CPU framebuffer
    // readback (a periodic multi-ms stall on integrated GPUs). Accelerated,
    // the copy stays on-GPU and only 32×18 pixels ever cross the bus.
    this._exposeCanvas = document.createElement('canvas');
    this._exposeCanvas.width = 32;
    this._exposeCanvas.height = 18;
    this._exposeCtx = this._exposeCanvas.getContext('2d');
    this._exposeTimer = 0;
    this._exposureGoal = this.renderer.toneMappingExposure;

    window.addEventListener('resize', () => this.#resize());
    this.#resize();
  }

  start() {
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  #tick() {
    // Hidden tab: rAF is throttled to a few Hz. Freeze simulation time
    // (dt = 0) so motion doesn't crawl and the DPR governor doesn't misread
    // throttled frames as GPU load — but still render the static frame, so
    // the page always has a presented frame. Resumes seamlessly on return.
    const hidden = document.visibilityState === 'hidden';

    // Clamp dt so a background-tab pause doesn't lurch the animation.
    const now = performance.now();
    const dt = hidden ? 0 : Math.min((now - this._lastNow) / 1000, 0.05);
    this._lastNow = now;

    this.step(dt);
    if (!hidden) this.quality.update(dt);
  }

  /** Advance the simulation by dt and render one frame. */
  step(dt) {
    this.time += dt;
    const t = this.time;

    // Bars are absolute-time driven, so skipped frames lose nothing.
    // Frame 1 always captures so the scene never renders against an
    // empty environment.
    this._frameIndex++;
    const capture = this._frameIndex === 1 || this._frameIndex % this._envInterval === 0;
    this.lights.update(t, this.renderer, capture);
    this.rig.update(t, dt);               // camera first — the world wraps around it
    this.spaceman.update(t, this.camera);
    this.shards.update(t, this.camera.position.z);
    this.particles.update(t, this.camera.position.z, this.renderer.getPixelRatio());
    this.sparkles.update(t, this.camera.position.z, this.renderer.getPixelRatio());
    this.post.render(t);
    this.#autoExpose(dt);
  }

  /**
   * Must run right after render (same task) — the WebGL back buffer is only
   * readable before the browser presents it.
   */
  #autoExpose(dt) {
    this._exposeTimer += dt;
    if (this._exposeTimer >= 1.0) {
      this._exposeTimer = 0;
      const src = this.renderer.domElement;
      if (src.width === 0 || src.height === 0) return; // not laid out yet
      const ctx = this._exposeCtx;
      ctx.drawImage(src, 0, 0, 32, 18);
      const d = ctx.getImageData(0, 0, 32, 18).data;
      let luma = 0;
      for (let i = 0; i < d.length; i += 4) {
        luma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      luma /= d.length / 4;

      // Gentle square-root response, hard bounds so it can never runaway.
      const TARGET = 115;
      const ratio = Math.sqrt(TARGET / Math.max(luma, 8));
      this._exposureGoal = THREE.MathUtils.clamp(
        this.renderer.toneMappingExposure * ratio, 1.05, 2.9
      );
    }
    // Slow cinematic adaptation, frame-rate independent.
    this.renderer.toneMappingExposure +=
      (this._exposureGoal - this.renderer.toneMappingExposure) * (1 - Math.exp(-dt * 0.9));
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

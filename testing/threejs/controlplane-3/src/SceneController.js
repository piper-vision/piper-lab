import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createEnvironment } from './Environment.js';
import { TriangleLayer } from './TriangleLayer.js';
import { BeamSystem } from './BeamSystem.js';
import { SurfaceGlowSystem } from './SurfaceGlow.js';
import { CameraController } from './CameraController.js';
import { InteractionManager } from './InteractionManager.js';
import { PostProcessing } from './PostProcessing.js';
import { ResizeManager } from './ResizeManager.js';

// ---------------------------------------------------------------------------
// Top-level orchestration: renderer, scene assembly, the animation loop.
// ---------------------------------------------------------------------------

// JS replica of three's ACES filmic fit (OutputShader), used to numerically
// invert tone mapping so the cleared background lands on EXACTLY #DFDAD5.
function acesFilmic(v, exposure) {
  const inM = [
    [0.59719, 0.35458, 0.04823],
    [0.07600, 0.90834, 0.01566],
    [0.02840, 0.13383, 0.83777],
  ];
  const outM = [
    [1.60475, -0.53108, -0.07367],
    [-0.10208, 1.10813, -0.00605],
    [-0.00327, -0.07276, 1.07602],
  ];
  const mul = (m, c) => [
    m[0][0] * c[0] + m[0][1] * c[1] + m[0][2] * c[2],
    m[1][0] * c[0] + m[1][1] * c[1] + m[1][2] * c[2],
    m[2][0] * c[0] + m[2][1] * c[1] + m[2][2] * c[2],
  ];
  let c = v.map((x) => (x * exposure) / 0.6);
  c = mul(inM, c);
  c = c.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
  c = mul(outM, c);
  return c.map((x) => Math.min(Math.max(x, 0), 1));
}

function inverseToneMappedColor(hex, exposure) {
  const target = new THREE.Color(hex); // sRGB in → linear working space
  const t = [target.r, target.g, target.b];
  let guess = t.slice();
  for (let i = 0; i < 40; i++) {
    const out = acesFilmic(guess, exposure);
    guess = guess.map((g, k) => Math.max(1e-5, g * (t[k] / Math.max(out[k], 1e-5))));
  }
  const c = new THREE.Color();
  c.setRGB(guess[0], guess[1], guess[2], THREE.LinearSRGBColorSpace);
  return c;
}

export class SceneController {
  constructor(container) {
    this.isMobile = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const quality = this.isMobile ? CONFIG.quality.mobile : CONFIG.quality.desktop;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.post.exposure;
    // Soft slab-on-slab drop shadows — VSM so the penumbra can be blurred wide.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = inverseToneMappedColor(CONFIG.colors.background, CONFIG.post.exposure);

    const envMap = createEnvironment(this.renderer);
    this.scene.environment = envMap;

    // Dark studio: barely-there ambient so the slabs stay near-black, a dim
    // overhead key for the top-face sheen and slab-on-slab shadows.
    this.scene.add(new THREE.HemisphereLight('#4A4A4A', '#060606', 0.42));
    const key = new THREE.DirectionalLight('#FFFFFF', 0.5);
    key.position.set(3.5, 8, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 10;
    key.shadow.blurSamples = 12;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const sc = key.shadow.camera;
    sc.left = -5; sc.right = 5; sc.top = 6; sc.bottom = -6;
    sc.near = 1; sc.far = 25;
    key.shadow.intensity = 1.0; // strong, clearly visible slab-on-slab shadows
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#CFCFCF', 0.15);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);
    // Frontal wash aimed at the extruded sides so the slab thickness reads
    // as visible dark grey against the black.
    const front = new THREE.DirectionalLight('#FFFFFF', 1.0);
    front.position.set(1, 0.5, 9);
    this.scene.add(front);

    // Control layers, top → bottom.
    this.layers = CONFIG.layers.map((def, i) => {
      const layer = new TriangleLayer(i, def, envMap, quality);
      this.scene.add(layer.group);
      return layer;
    });

    this.glows = new SurfaceGlowSystem(this.scene);
    this.beams = new BeamSystem(this.scene, this.layers, this.glows, this.isMobile);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 100);
    this.interaction = new InteractionManager();
    this.cameraController = new CameraController(this.camera, this.interaction);

    this.beams.setReducedMotion(this.interaction.reducedMotion);
    this.interaction.onReducedMotionChange = (on) => this.beams.setReducedMotion(on);

    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.resize = new ResizeManager(this.renderer, this.cameraController, this.post, quality.dprCap, container);

    this.clock = new THREE.Clock();
    this._parallax = new THREE.Vector3();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.elapsedTime;
    const reduced = this.interaction.reducedMotion;

    this.resize.check();
    this.cameraController.update(dt, t);
    this.cameraController.getParallax(this._parallax);
    if (reduced && CONFIG.reducedMotion.disableParallax) this._parallax.set(0, 0, 0);
    // With the wide orbit the camera can travel ~10 world units; saturate
    // the parallax input SMOOTHLY (tanh) so the slabs never drift off their
    // beam columns — a hard clamp reads as the slabs knocking into a wall.
    const pLen = this._parallax.length();
    if (pLen > 1e-6) {
      const limit = 1.6;
      this._parallax.multiplyScalar((limit * Math.tanh(pLen / limit)) / pLen);
    }

    for (const layer of this.layers) layer.update(t, this._parallax, reduced);
    this.beams.update(dt, t);
    this.glows.update(dt);

    this.post.render();
  }
}

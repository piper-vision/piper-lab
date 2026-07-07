import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { dispersedEnvChunk } from './envDispersion.js';

// Rim lights live on this layer so they touch only the suit — the shard
// field never sees them.
const RIM_LAYER = 1;

/**
 * Spaceman — the hero figure, falling endlessly through the crystal field.
 *
 * The model floats a fixed depth ahead of the camera (so the auto-fly never
 * leaves him behind) while drifting laterally on slow incommensurate sines
 * and tumbling gently on all three axes — weightless, never mechanical.
 *
 * Suit lighting: mostly dark, with small sharp specular touches —
 *  - the GLB's PBR material sharpened (lower roughness scalar over its
 *    metal/rough texture, so the visor and hard details sharpen most)
 *  - a clearcoat for thin white glints on curved edges
 *  - the same spectral env dispersion as the shards, so the brightest
 *    suit glints fringe into R/B at grazing angles
 *  - two small counter-orbiting rim lights (white + pale cyan) that sweep
 *    brief glancing highlights across shoulders, helmet and gloves
 */
export class Spaceman {
  /**
   * @param {object} opts
   * @param {string} opts.url    GLB path (Draco-compressed is fine).
   * @param {number} opts.size   Target size (bounding-sphere diameter).
   * @param {number} opts.ahead  Distance held in front of the camera.
   */
  constructor({ url = './assets/spaceman-falling.glb', size = 4.2, ahead = 5.5 } = {}) {
    this.group = new THREE.Group();
    this.ahead = ahead;
    this.inner = null; // set once the model arrives

    // Base pose the sway oscillates around — tuned visually so the suit's
    // front (visor, chest panel) faces the camera, head up, on a slight
    // falling recline.
    this.baseRotation = new THREE.Euler(0, -0.9, -1.1);

    // Rim lights: tight falloff keeps them personal to the suit; the layer
    // mask keeps them off the shards entirely.
    this.rimWhite = new THREE.PointLight(0xffffff, 40, 10, 2);
    this.rimCyan = new THREE.PointLight(0xbfffff, 26, 9, 2);
    this.rimWhite.layers.set(RIM_LAYER);
    this.rimCyan.layers.set(RIM_LAYER);
    this.group.add(this.rimWhite, this.rimCyan);

    const draco = new DRACOLoader();
    draco.setDecoderPath('vendor/three/examples/jsm/libs/draco/gltf/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // Normalize: scale to the target size and center on the origin so
        // the tumble rotates around the body, not some export pivot.
        const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
        model.scale.setScalar(size / (sphere.radius * 2));
        const box = new THREE.Box3().setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));

        model.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.layers.enable(RIM_LAYER); // receive the rim lights
          this.#polishSuit(obj.material);
        });

        // Tumble on an inner group; the outer group carries position only.
        this.inner = new THREE.Group();
        this.inner.add(model);
        this.group.add(this.inner);
        draco.dispose();
      },
      undefined,
      (err) => console.error('Spaceman failed to load:', err)
    );
  }

  /** Sharpen the suit's response to the moving environment. */
  #polishSuit(material) {
    // Scalars multiply the packed metal/rough texture, so relative detail
    // (visor vs fabric) is preserved — everything just gets glassier.
    material.roughness = 0.55;
    material.metalness = 1.0;
    material.envMapIntensity = 2.0;

    // Thin lacquer layer: sharp white glints on curved edges regardless of
    // the underlying fabric roughness.
    material.clearcoat = 0.6;
    material.clearcoatRoughness = 0.15;

    // Spectral fringing on the brightest glints, matching the shards.
    material.customProgramCacheKey = () => 'suit-dispersion';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDispersion = { value: 0.045 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDispersion;')
        .replace('#include <envmap_physical_pars_fragment>', dispersedEnvChunk());
      material.userData.shader = shader; // live-tuning handle
    };
    material.needsUpdate = true;
  }

  update(t, camera) {
    // Track the camera laterally (so he holds the center of frame through
    // the camera's own drift) with only a whisper of independent float.
    this.group.position.set(
      camera.position.x + Math.sin(t * 0.043) * 0.12,
      camera.position.y + Math.cos(t * 0.051) * 0.1,
      camera.position.z - this.ahead
    );

    if (this.inner) {
      // Weightless sway around a camera-facing base pose: three
      // incommensurate oscillations keep him alive and drifting, but the
      // amplitudes are bounded so his front never turns away from view.
      this.inner.rotation.set(
        this.baseRotation.x + Math.sin(t * 0.19) * 0.3,
        this.baseRotation.y + Math.sin(t * 0.14 + 1.2) * 0.45,
        this.baseRotation.z + Math.sin(t * 0.11 + 2.4) * 0.25
      );
    }

    // Counter-orbiting rim lights sweep glancing highlights across the
    // suit — biased toward the camera side so they read as rim, not fill.
    this.rimWhite.position.set(Math.cos(t * 0.31) * 3.2, Math.sin(t * 0.24) * 2.2, 2.6);
    this.rimCyan.position.set(Math.cos(-t * 0.27 + 2.1) * 3.0, Math.sin(-t * 0.21 + 2.1) * 2.4, 2.2);
  }
}

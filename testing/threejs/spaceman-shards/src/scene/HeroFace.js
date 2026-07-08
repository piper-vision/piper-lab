import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { dispersedEnvChunk } from './envDispersion.js';

/**
 * Shader for the noise-revealed RGB wireframe that plays over the head:
 * drifting 3D value noise gates which patches of the grid are visible
 * (appearing/dissolving organically), and a spectral ramp tied to the same
 * noise field colors the lines R→G→B. Additive, so the grid glows over the
 * black glass without occluding it.
 */
const GridShader = {
  uniforms: {
    uTime: { value: 0 },
    uIntensity: { value: 1.7 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    varying vec3 vPos;

    // Cheap hash-based 3D value noise (iq).
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
            mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
        mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
            mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
        f.z);
    }

    void main() {
      // Two drifting octaves gate the reveal; a slower macro field means
      // sometimes whole regions rest dark — organic, never uniform.
      float n = noise(vPos * 1.6 + uTime * 0.13)
              + 0.5 * noise(vPos * 3.4 - uTime * 0.09);
      // Floored macro: the effect breathes but never fully rests — some
      // grid is visible on the face almost all the time.
      float macro = 0.35 + 0.65 * smoothstep(0.28, 0.5, noise(vPos * 0.5 + uTime * 0.06));
      // Spend the reveal where it can be seen: full on the front, sides
      // and top of the head, fading out across the back of the skull.
      float facing = smoothstep(-0.55, -0.1, normalize(vPos).z);
      float reveal = smoothstep(0.55, 0.88, n) * macro * facing;

      // Spectral coloring rides the same noise field and cycles slowly.
      vec3 rgb = 0.5 + 0.5 * cos(6.28318 * (n * 0.9 + vec3(0.0, -0.33, -0.67)) + uTime * 0.25);
      gl_FragColor = vec4(rgb * reveal * uIntensity, reveal);
    }
  `,
};

// Rim lights live on this layer so they touch only the head — the shard
// field never sees them.
const RIM_LAYER = 1;

/**
 * HeroFace — the hero figure: a low-poly head pinned to the center of the
 * screen, drifting through the crystal field with the camera.
 *
 * The GLB's own materials are replaced with the scene's signature black
 * glass: near-black, mirror-smooth, clearcoat, spectral env dispersion (the
 * same patch the shards use), so its facets catch the moving beams as hot
 * blooming glints. Two counter-orbiting rim lights (white + pale cyan)
 * sweep glancing highlights across the features, and the face turns to
 * follow the cursor.
 */
export class HeroFace {
  /**
   * @param {object} opts
   * @param {string} opts.url    GLB path (Draco-compressed is fine).
   * @param {number} opts.size   Target size (bounding-sphere diameter).
   * @param {number} opts.ahead  Distance held in front of the camera.
   */
  constructor({ url = './assets/low-poly-head.glb', size = 4.2, ahead = 4.5 } = {}) {
    this.group = new THREE.Group();
    this.ahead = ahead;
    this.inner = null; // set once the model arrives

    // Cursor-follow state: smoothed separately from the camera parallax so
    // the head turn has its own weight.
    this._yaw = 0;
    this._pitch = 0;

    // Shared material for the noise-revealed wireframe overlay.
    this._gridMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GridShader.uniforms),
      vertexShader: GridShader.vertexShader,
      fragmentShader: GridShader.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Rim lights: tight falloff keeps them personal to the fox; the layer
    // mask keeps them off the shards entirely.
    this.rimWhite = new THREE.PointLight(0xffffff, 10, 10, 2);
    this.rimCyan = new THREE.PointLight(0xbfffff, 6.5, 9, 2);
    this.rimWhite.layers.set(RIM_LAYER);
    this.rimCyan.layers.set(RIM_LAYER);
    this.group.add(this.rimWhite, this.rimCyan);

    const draco = new DRACOLoader();
    draco.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // Normalize: scale to the target size and center on the origin so
        // the sway rotates around the mask, not some export pivot.
        const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
        model.scale.setScalar(size / (sphere.radius * 2));
        const box = new THREE.Box3().setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));

        let depthCleared = false;
        model.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.layers.enable(RIM_LAYER); // receive the rim lights
          obj.material = this.#makeBlackGlass(obj.material.normalMap ?? null);

          // The head renders dead last and clears the depth buffer first:
          // nothing in the scene can cover it or depth-cull it (shards
          // always read as behind the head), while its own faces still
          // self-occlude correctly against the fresh depth.
          obj.renderOrder = 9999;
          if (!depthCleared) {
            depthCleared = true;
            obj.onBeforeRender = (renderer) => renderer.clearDepth();
          }

          // Noise-revealed RGB wireframe, riding the same geometry. Child
          // of the mesh, so it inherits the exact transform.
          const grid = new THREE.LineSegments(
            new THREE.WireframeGeometry(obj.geometry),
            this._gridMaterial
          );
          grid.scale.setScalar(1.002); // a hair off the surface — no z-fighting
          grid.renderOrder = 10000; // over the head, tested against its depth
          obj.add(grid);
        });

        this.inner = new THREE.Group();
        this.inner.add(model);
        this.group.add(this.inner);
        draco.dispose();
      },
      undefined,
      (err) => console.error('Hero face failed to load:', err)
    );
  }

  /**
   * The scene's signature black glass, matching the shards: near-black,
   * mirror-smooth, clearcoat glints, spectral dispersion in reflections.
   * The GLB's normal map is kept for surface detail under the shine.
   */
  #makeBlackGlass(normalMap) {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x050607,
      // Low metalness on purpose: metal reflections get multiplied by the
      // near-black base color and vanish — dielectric specular + clearcoat
      // stay white/silver, which is how the shards get their shine.
      metalness: 0.25,
      roughness: 0.07,
      clearcoat: 0.7,
      clearcoatRoughness: 0.05,
      // Restrained on purpose: hot enough to glint, rarely hot enough to
      // bloom/starburst — those flares were swallowing the face.
      envMapIntensity: 0.8,
      normalMap,
      side: THREE.DoubleSide, // it's a hollow mask — back shows when swaying
    });
    // Transparent flag (at full opacity) places the head in the transparent
    // pass so renderOrder can schedule it after the wordmark. Safe from the
    // old depth-cull bug: the depth clear in onBeforeRender means no prior
    // geometry can cull it.
    material.transparent = true;
    material.opacity = 1.0;

    material.customProgramCacheKey = () => 'hero-face-dispersion';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDispersion = { value: 0.03 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDispersion;')
        .replace('#include <envmap_physical_pars_fragment>', dispersedEnvChunk());
      material.userData.shader = shader; // live-tuning handle
    };
    material.needsUpdate = true;
    return material;
  }

  /**
   * @param {number} t       Elapsed seconds.
   * @param {number} dt      Frame delta (for the head-turn damping).
   * @param {THREE.Vector2} pointer Smoothed cursor, normalized [-1, 1].
   */
  update(t, dt, pointer) {
    // The group is parented to the camera: a fixed local offset pins the
    // face to the exact center of the screen through every camera move.
    this.group.position.set(0, 0, -this.ahead);
    this._gridMaterial.uniforms.uTime.value = t;

    if (this.inner) {
      // The face turns to follow the cursor — heavily damped so the head
      // has weight — over a whisper of idle sway so it never feels frozen.
      const damp = 1 - Math.exp(-dt * 2.5);
      this._yaw += (pointer.x * 0.55 - this._yaw) * damp;
      this._pitch += (pointer.y * 0.4 - this._pitch) * damp;

      this.inner.rotation.set(
        this._pitch + Math.sin(t * 0.19) * 0.05,
        this._yaw + Math.sin(t * 0.14 + 1.2) * 0.06,
        Math.sin(t * 0.11 + 2.4) * 0.04
      );
    }

    // Counter-orbiting rim lights sweep glancing highlights across the
    // mask — biased toward the camera side so they read as rim, not fill.
    this.rimWhite.position.set(Math.cos(t * 0.31) * 3.2, Math.sin(t * 0.24) * 2.2, 2.6);
    this.rimCyan.position.set(Math.cos(-t * 0.27 + 2.1) * 3.0, Math.sin(-t * 0.21 + 2.1) * 2.4, 2.2);
  }
}

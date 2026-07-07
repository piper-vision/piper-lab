import * as THREE from 'three';

/**
 * LightField — the "moving light" system that drives every reflection.
 *
 * Instead of static lights, a private black scene contains several large,
 * HDR-bright rectangular panels orbiting slowly around the origin. A
 * CubeCamera re-captures that scene into an HDR cube render target every
 * frame, and the result is used as the main scene's environment map.
 *
 * Because the shards are near-mirror PBR surfaces, the orbiting panels show
 * up as sweeping bands of white / pale-cyan light travelling across them —
 * reflections evolve continuously while the environment stays black.
 */

// Panel configs. Colors are HDR (values > 1) so the brightest reflections
// cross the bloom threshold. Speeds are radians/second — deliberately slow.
const BARS = [
  // Primary long white blade — the main sweeping band.
  { size: [110, 9], color: [6.5, 6.6, 6.8],   radius: 26, speed: 0.045,  tilt: 0.45, phase: 0.0, roll: 0.05 },
  // Secondary white blade on a counter-rotating, steeper orbit.
  { size: [70, 4],  color: [4.6, 4.7, 4.9],   radius: 30, speed: -0.032, tilt: 1.15, phase: 2.1, roll: -0.04 },
  // Wide neutral wash.
  { size: [80, 14], color: [3.4, 3.45, 3.5],  radius: 34, speed: 0.021,  tilt: 0.85, phase: 4.2, roll: 0.03 },
  // Short intense sliver — sharp glints on bevels.
  { size: [46, 2.5], color: [8.0, 8.0, 8.2],  radius: 22, speed: 0.052,  tilt: 1.5,  phase: 1.2, roll: 0.07 },
  // Third white blade so at least two sweeps are always in view.
  { size: [85, 6],  color: [5.0, 5.1, 5.3],   radius: 28, speed: 0.027,  tilt: 2.3,  phase: 5.6, roll: -0.03 },
  // Fourth blade, staggered against the others' dark windows — the bar
  // orbits are deliberately phased so some bright source always faces the
  // field and the scene never drops into a fully dark beat.
  { size: [95, 7],  color: [5.6, 5.7, 5.9],   radius: 29, speed: -0.019, tilt: 2.85, phase: 1.7, roll: 0.04 },
  // Spectral panels: rainbow-gradient emitters (R→G→B along their length).
  // Two on opposed orbits so a prism smear is almost always in view.
  { size: [44, 24], color: [1.35, 1.35, 1.35], radius: 42, speed: 0.012, tilt: 0.7,  phase: 3.3, roll: 0.0, spectral: true },
  { size: [34, 17], color: [1.1, 1.1, 1.1],    radius: 38, speed: -0.016, tilt: 1.4, phase: 0.6, roll: 0.02, spectral: true },
  // Two broad fills on opposed orbits — one always faces the field, so
  // faces read as dark glass at worst, never black holes.
  { size: [95, 50], color: [0.22, 0.23, 0.25], radius: 48, speed: 0.008, tilt: 1.9,  phase: 5.1, roll: 0.0 },
  { size: [95, 50], color: [0.2, 0.21, 0.23],  radius: 48, speed: -0.007, tilt: 0.9, phase: 2.2, roll: 0.0 },
];

/**
 * Soft-falloff texture for the bars. Hard-edged panels land as one-texel
 * transitions in the environment cube map, which reads as jagged, pixelated
 * reflection borders — a smooth ramp across many texels fixes that and
 * matches the reference's soft gradient bands.
 */
function makeSoftBarTexture() {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);

  const falloff = (u) => {
    const edge = Math.min(u, 1 - u) * 2; // 0 at edges, 1 at center
    const x = Math.min(edge / 0.6, 1);   // ramp over the outer 30% each side
    return x * x * (3 - 2 * x);          // smoothstep
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round(255 * falloff((x + 0.5) / w) * falloff((y + 0.5) / h));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace; // it's an intensity mask, not a color
  return texture;
}

/**
 * Spectral variant of the soft bar: the same falloff envelope carrying a
 * R→G→B gradient along its length — matches the diffraction-streak ramp in
 * the starburst pass, so reflected accents read as the same optic.
 */
function makeSpectralBarTexture() {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);

  const falloff = (u) => {
    const edge = Math.min(u, 1 - u) * 2;
    const x = Math.min(edge / 0.6, 1);
    return x * x * (3 - 2 * x);
  };
  // Same cosine spectrum ramp the starburst streaks use.
  const spectrum = (t, phase) => 0.5 + 0.5 * Math.cos(2 * Math.PI * (t + phase));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const a = falloff(u) * falloff((y + 0.5) / h);
      const i = (y * w + x) * 4;
      // 40% white lift: pastel prism sheen, not a saturated rainbow flag.
      img.data[i] = Math.round(255 * a * (0.4 + 0.6 * spectrum(u * 0.75, 0.0)));
      img.data[i + 1] = Math.round(255 * a * (0.4 + 0.6 * spectrum(u * 0.75, -0.33)));
      img.data[i + 2] = Math.round(255 * a * (0.4 + 0.6 * spectrum(u * 0.75, -0.67)));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export class LightField {
  /**
   * @param {object} opts
   * @param {number} opts.resolution Cube face size (256 desktop, 128 mobile).
   */
  constructor({ resolution = 256 } = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.renderTarget = new THREE.WebGLCubeRenderTarget(resolution, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(0.5, 300, this.renderTarget);
    this.scene.add(this.cubeCamera);

    const softTexture = makeSoftBarTexture();
    const spectralTexture = makeSpectralBarTexture();
    this._softTexture = softTexture;
    this._spectralTexture = spectralTexture;

    // Each bar hangs off its own pivot; animating pivot.rotation.y orbits the
    // bar around the origin on a plane defined by the pivot's tilt.
    this.bars = BARS.map((cfg) => {
      const pivot = new THREE.Group();
      pivot.rotation.x = cfg.tilt;

      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(...cfg.color), // HDR tint × falloff map
        map: cfg.spectral ? spectralTexture : softTexture,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, // overlapping bars sum, never clip
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size[0], cfg.size[1]), material);
      mesh.position.x = cfg.radius;
      mesh.rotation.y = Math.PI / 2; // face the origin

      pivot.add(mesh);
      this.scene.add(pivot);
      return { pivot, mesh, cfg };
    });
  }

  /** Environment texture to assign to `scene.environment`. */
  get texture() {
    return this.renderTarget.texture;
  }

  /**
   * Advance bar orbits and re-capture the environment.
   * Absolute-time driven so motion is stable regardless of frame rate.
   */
  update(t, renderer) {
    for (const { pivot, mesh, cfg } of this.bars) {
      pivot.rotation.y = cfg.phase + t * cfg.speed;
      mesh.rotation.z = t * cfg.roll;                      // band angle slowly shears
      pivot.position.y = Math.sin(t * 0.07 + cfg.phase) * 3; // gentle vertical breathing
    }
    this.cubeCamera.update(renderer, this.scene);
  }

  dispose() {
    this.renderTarget.dispose();
    this._softTexture.dispose();
    this._spectralTexture.dispose();
    for (const { mesh } of this.bars) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

import * as THREE from 'three';
import { mulberry32, range, sign } from '../utils/random.js';
import { dispersedEnvChunk } from './envDispersion.js';

/**
 * ShardField — the fractured crystal geometry.
 *
 * Two layers share one bevelled-shard geometry pool and one PBR material:
 *  - "hero" shards: large individual meshes near the camera, each with an
 *    additive edge-line child whose opacity glints slowly.
 *  - "far" shards: InstancedMesh fill that extends the field to infinity.
 *
 * All motion is absolute-time driven (base transform + offset), so nothing
 * accumulates error and everything stays deterministic.
 */

const VARIANT_COUNT = 8;

// Depth of one repeating tile of the field. Shards are distributed
// uniformly across exactly this depth, so tiling is seamless by
// construction — no density pulses as the camera flies through.
// Exported so other layers (particles) wrap in lockstep.
export const WRAP_DEPTH = 80;

// How far behind the camera a shard may sit before wrapping ahead. Must be
// outside the frustum so the jump is never visible. A wrapped shard
// re-enters WRAP_DEPTH - WRAP_BEHIND = 74 units ahead — past the fog's
// full-extinction distance, so it is born invisible and fades in.
export const WRAP_BEHIND = 6;

// Near-camera dissolve: shards fade out between these view-space depths as
// the camera passes through them (world units in front of the camera).
const FADE_END = 1.5;
const FADE_START = 6.0;

/**
 * Inject a near-camera fade into any built-in material via onBeforeCompile.
 * Purely position-based, so one shared material still serves every mesh and
 * instance. 'alpha' dissolves transparency; 'color' darkens to black (for
 * opaque materials — identical on a black background, no sorting issues).
 */
function addNearFade(material, mode) {
  material.customProgramCacheKey = () => `near-fade-${mode}`;
  material.onBeforeCompile = (shader) => {
    patchNearFade(shader, mode);
  };
}

function patchNearFade(shader, mode) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vNearFadeDist;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvNearFadeDist = -mvPosition.z;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vNearFadeDist;')
    .replace(
      '#include <fog_fragment>',
      '#include <fog_fragment>\n' +
        `float nearFade = smoothstep(${FADE_END.toFixed(2)}, ${FADE_START.toFixed(2)}, vNearFadeDist);\n` +
        (mode === 'alpha' ? 'gl_FragColor.a *= nearFade;' : 'gl_FragColor.rgb *= nearFade;')
    );
}

/**
 * Shard material patch: near fade + spectral dispersion in the environment
 * reflection. getIBLRadiance is rewritten to sample the env map once per
 * color channel with slightly spread reflection vectors (long wavelengths
 * bending further), scaled up at grazing angles — bright reflections stay
 * white face-on and split into thin R/B fringes where light rakes across
 * the glass. The clearcoat layer calls the same function, so it disperses
 * too.
 */
function patchShardMaterial(material, fadeMode, dispersion) {
  material.customProgramCacheKey = () => `shard-${fadeMode}-dispersion`;
  material.onBeforeCompile = (shader) => {
    patchNearFade(shader, fadeMode);

    shader.uniforms.uDispersion = { value: dispersion };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uDispersion;'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <envmap_physical_pars_fragment>',
      dispersedEnvChunk()
    );

    material.userData.shader = shader; // live-tuning handle
  };
}

/** Build one bevelled, elongated angular shard (unit-ish scale). */
function makeShardGeometry(rng) {
  // Random convex-ish polygon: 3–5 points sorted by angle, stretched on X so
  // shards read as long blades rather than chunks.
  const pointCount = 3 + Math.floor(rng() * 3);
  const angles = Array.from({ length: pointCount }, () => rng() * Math.PI * 2).sort();
  const stretch = 1.6 + rng() * 1.4;
  const points = angles.map((a) => {
    const r = 0.45 + rng() * 0.55;
    return new THREE.Vector2(Math.cos(a) * r * stretch, Math.sin(a) * r);
  });

  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
    depth: 0.025 + rng() * 0.025, // thin — shards read as glass panes, not slabs
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.02,
    bevelSegments: 1, // a single hard bevel facet catches light as a bright line
  });
  geometry.center();
  return geometry;
}

export class ShardField {
  /**
   * @param {object} opts
   * @param {number} opts.heroCount  Large foreground shards.
   * @param {number} opts.farCount   Instanced background shards.
   * @param {number} opts.seed       PRNG seed (fixes the composition).
   */
  constructor({ heroCount = 26, farCount = 140, seed = 7 } = {}) {
    const rng = mulberry32(seed);
    this.group = new THREE.Group();

    // One shared physical material: near-black, glass-smooth, with a
    // clearcoat so reflections stay white instead of tinting black.
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x05070a,
      metalness: 0.35,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.92,
      // Push surfaces back a hair in depth so the coincident edge lines
      // pass the depth test cleanly instead of stitching into dashes.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    // Far shards are opaque — avoids transparency sorting across instances.
    this.farMaterial = this.material.clone();
    this.farMaterial.transparent = false;
    this.farMaterial.opacity = 1;

    // Dissolve shards as the camera passes through them (alpha for the
    // transparent hero material, darken-to-black for the opaque far one)
    // and disperse env reflections into spectral fringes at grazing angles.
    patchShardMaterial(this.material, 'alpha', 0.09);
    patchShardMaterial(this.farMaterial, 'color', 0.09);

    // Shared geometry pool + matching edge geometries.
    const variants = Array.from({ length: VARIANT_COUNT }, () => makeShardGeometry(rng));
    const edgeVariants = variants.map((g) => new THREE.EdgesGeometry(g, 12));
    this.geometries = variants;
    this.edgeGeometries = edgeVariants;

    this.hero = this.#buildHeroShards(rng, heroCount, variants, edgeVariants);
    this.farMeshes = this.#buildFarShards(rng, farCount, variants);

    // Scratch objects reused every frame (no per-frame allocation).
    this._q = new THREE.Quaternion();
    this._dummy = new THREE.Object3D();
  }

  #buildHeroShards(rng, count, variants, edgeVariants) {
    const hero = [];
    for (let i = 0; i < count; i++) {
      const vi = i % variants.length;
      const mesh = new THREE.Mesh(variants[vi], this.material);

      // Additive edge lines with an HDR color — bright glints bloom.
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(2.5, 2.5, 2.55),
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      addNearFade(edgeMaterial, 'alpha'); // edge glints dissolve with their shard
      const edgeLines = new THREE.LineSegments(edgeVariants[vi], edgeMaterial);
      // Inflate a hair so lines float just off the surface — coplanar lines
      // stitch into dashes against their own mesh in the depth buffer.
      edgeLines.scale.setScalar(1.004);
      mesh.add(edgeLines);

      // Placement: uniform across one full wrap tile (rear edge at the
      // initial camera's wrap boundary, z = 20) so depth density is even
      // and tiling never pulses.
      mesh.position.set(range(rng, -26, 26), range(rng, -15, 15), range(rng, 20 - WRAP_DEPTH, 20));
      mesh.scale.setScalar(range(rng, 5, 10));
      // Bias in-plane rotation toward two crossing diagonal families
      // (like the reference), with tilts so faces catch different bands.
      const diagonal = rng() < 0.6 ? -0.6 : 0.95;
      mesh.rotation.set(
        range(rng, -0.7, 0.7),
        range(rng, -0.8, 0.8),
        diagonal + range(rng, -0.45, 0.45)
      );

      hero.push({
        mesh,
        edgeMaterial,
        basePosition: mesh.position.clone(),
        baseQuaternion: mesh.quaternion.clone(),
        // Slow independent spin around a random axis.
        spinAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        spinSpeed: range(rng, 0.012, 0.035) * sign(rng),
        // Slow positional drift along a random direction.
        driftDirection: new THREE.Vector3(rng() - 0.5, rng() - 0.5, (rng() - 0.5) * 0.4).normalize(),
        driftAmplitude: range(rng, 0.15, 0.5),
        driftFrequency: range(rng, 0.05, 0.12),
        driftPhase: rng() * Math.PI * 2,
        // Edge glint cycle.
        edgeBase: range(rng, 0.15, 0.55),
        glintSpeed: range(rng, 0.12, 0.4),
        glintPhase: rng() * Math.PI * 2,
      });
      this.group.add(mesh);
    }
    return hero;
  }

  #buildFarShards(rng, count, variants) {
    // Spread across 3 InstancedMeshes (one per geometry variant used).
    const meshes = [];
    const perMesh = Math.ceil(count / 3);
    for (let m = 0; m < 3; m++) {
      const instanced = new THREE.InstancedMesh(variants[m * 2], this.farMaterial, perMesh);
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const items = [];
      for (let i = 0; i < perMesh; i++) {
        items.push({
          basePosition: new THREE.Vector3(range(rng, -44, 44), range(rng, -26, 26), range(rng, 20 - WRAP_DEPTH, 20)),
          baseRotation: new THREE.Euler(range(rng, -1, 1), range(rng, -1, 1), rng() * Math.PI * 2),
          scale: range(rng, 1.2, 3.2),
          spinAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
          spinSpeed: range(rng, 0.008, 0.03) * sign(rng),
          driftAmplitude: range(rng, 0.1, 0.4),
          driftFrequency: range(rng, 0.04, 0.1),
          driftPhase: rng() * Math.PI * 2,
        });
      }
      instanced.userData.items = items;
      meshes.push(instanced);
      this.group.add(instanced);
    }
    return meshes;
  }

  /**
   * Advance all shard motion. Absolute-time driven.
   * @param {number} t        Elapsed time in seconds.
   * @param {number} cameraZ  Camera depth — shards wrap to stay in a
   *                          WRAP_DEPTH-deep window ahead of it.
   */
  update(t, cameraZ = 14) {
    // Rear edge of the live window: shards with z beyond this (behind the
    // camera) are mapped WRAP_DEPTH forward — an infinite tiled field.
    const rear = cameraZ + WRAP_BEHIND;
    const wrapZ = (z) => rear - ((((rear - z) % WRAP_DEPTH) + WRAP_DEPTH) % WRAP_DEPTH);

    // Hero shards: quaternion = base * slow axis spin; position = base + drift.
    for (const s of this.hero) {
      this._q.setFromAxisAngle(s.spinAxis, t * s.spinSpeed);
      s.mesh.quaternion.multiplyQuaternions(s.baseQuaternion, this._q);
      s.mesh.position
        .copy(s.basePosition)
        .addScaledVector(s.driftDirection, Math.sin(t * s.driftFrequency + s.driftPhase) * s.driftAmplitude);
      s.mesh.position.z = wrapZ(s.mesh.position.z);

      // Edge glint: a slow pulse raised to the 6th power — lines idle dim,
      // and the brief peaks (opacity × HDR color ≈ 2.3) cross the starburst
      // threshold, so flaring edges grow diffraction spikes dynamically.
      const pulse = 0.5 + 0.5 * Math.sin(t * s.glintSpeed + s.glintPhase);
      s.edgeMaterial.opacity = s.edgeBase * (0.18 + 1.3 * pulse ** 6);
    }

    // Far instances: same motion model via a dummy transform.
    const dummy = this._dummy;
    for (const instanced of this.farMeshes) {
      const items = instanced.userData.items;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        dummy.position
          .copy(it.basePosition)
          .addScaledVector(it.spinAxis, Math.sin(t * it.driftFrequency + it.driftPhase) * it.driftAmplitude);
        dummy.position.z = wrapZ(dummy.position.z);
        dummy.rotation.copy(it.baseRotation);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        // Apply the slow spin on top of the base rotation.
        this._q.setFromAxisAngle(it.spinAxis, t * it.spinSpeed);
        dummy.quaternion.multiply(this._q);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
    }

    // The entire field leans almost imperceptibly — global slow parallax.
    this.group.rotation.z = Math.sin(t * 0.01) * 0.04;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const g of this.edgeGeometries) g.dispose();
    this.material.dispose();
    this.farMaterial.dispose();
    for (const s of this.hero) s.edgeMaterial.dispose();
  }
}

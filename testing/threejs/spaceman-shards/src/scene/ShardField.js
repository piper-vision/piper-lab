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
   * Radius of the spaceman's pressure bubble. Deliberately larger than his
   * body: contact at body range happens inside the near-camera dissolve
   * zone (and right before the shard wraps), where a reaction is invisible
   * — the bubble makes shards part around him mid-screen instead.
   */
  static REPEL_RADIUS = 5;

  /** Solid body radius — shards can never overlap this (plus their own). */
  static CORE_RADIUS = 2.3;

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
      envMapIntensity: 1.85,
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
    patchShardMaterial(this.material, 'alpha', 0.045);
    patchShardMaterial(this.farMaterial, 'color', 0.045);

    // Shared geometry pool + matching edge geometries.
    const variants = Array.from({ length: VARIANT_COUNT }, () => makeShardGeometry(rng));
    const edgeVariants = variants.map((g) => new THREE.EdgesGeometry(g, 12));
    this.geometries = variants;
    this.edgeGeometries = edgeVariants;

    this.hero = this.#buildHeroShards(rng, heroCount, variants, edgeVariants);
    this.farMeshes = this.#buildFarShards(rng, farCount, variants);

    // Scratch objects reused every frame (no per-frame allocation).
    this._q = new THREE.Quaternion();
    this._pushQ = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
  }

  /**
   * Soft collision against a sphere (the spaceman): a wide cushion zone
   * eases shards into a gentle outward drift with a slow tumble — they
   * float away and keep coasting (no spring pulling them back; the state
   * resets when the shard recycles through the wrap). Damping factors are
   * precomputed per frame by update().
   */
  #applyPush(s, pos, repel, dt) {
    if (repel) {
      this._v.copy(pos).add(s.pushOffset).sub(repel);
      const reach = ShardField.REPEL_RADIUS + s.radius + 3.5; // cushion zone
      const d = this._v.length();
      if (d < reach && d > 1e-4) {
        const pen = (1 - d / reach) ** 2; // quadratic — no jolt at first touch
        this._v.divideScalar(d);
        // Bias the shove sideways: on-screen parting reads far better than
        // depth-axis pushes, which just look like a speed change.
        this._v.z *= 0.25;
        this._v.normalize();
        s.pushVelocity.addScaledVector(this._v, pen * 9 * dt);
        // Tumble kick, roughly perpendicular to the shove — set once per
        // contact so an ongoing push doesn't thrash the axis.
        if (s.pushSpin < 0.01) {
          s.pushAxis.set(-this._v.y, this._v.x, 0.35).normalize();
        }
        s.pushSpin = Math.min(s.pushSpin + pen * 0.35 * dt, 0.3);
      }
    }
    s.pushVelocity.multiplyScalar(this._dragK);
    s.pushOffset.addScaledVector(s.pushVelocity, dt);
    s.pushAngle += s.pushSpin * dt;
    s.pushSpin *= this._spinDecayK;
    pos.add(s.pushOffset);

    // Hard core: the bubble only accelerates shards, so one aimed straight
    // at him would still sail through. Firmly (but smoothly) slide anything
    // inside his body space out sideways — reads as glass skating off an
    // invisible shell, and guarantees no clipping.
    if (repel) {
      const sep = this._v.copy(pos).sub(repel);
      const dist = sep.length();
      const minSep = ShardField.CORE_RADIUS + s.radius;
      if (dist < minSep) {
        if (dist < 1e-3) sep.set(1, 0, 0);
        else sep.divideScalar(dist);
        sep.z *= 0.3; // slide out sideways, not along the flight axis
        sep.normalize();
        const need = (minSep - dist) * (1 - Math.exp(-dt * 8));
        s.pushOffset.addScaledVector(sep, need);
        pos.addScaledVector(sep, need);
        s.pushVelocity.addScaledVector(sep, need * 2); // keep it floating on
      }
    }

    // Speed limit: keeps every knock a dreamy float — a dead-center pass
    // through the core could otherwise fling a shard across the field.
    if (s.pushVelocity.lengthSq() > 6.25) s.pushVelocity.setLength(2.5);
  }

  /**
   * Reset collision drift when a shard recycles through the wrap — the
   * jump is negative in forward flight, positive in reverse, so test the
   * magnitude.
   */
  #resetPushOnWrap(s, wrappedZ) {
    if (Math.abs(s.prevZ - wrappedZ) > WRAP_DEPTH * 0.5) {
      s.pushOffset.set(0, 0, 0);
      s.pushVelocity.set(0, 0, 0);
      s.pushSpin = 0;
      s.pushAngle = 0;
    }
    s.prevZ = wrappedZ;
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
        // Soft-collision state: offset/velocity accumulate when the shard
        // is shoved (e.g. by the spaceman) and relax back over time.
        radius: mesh.scale.x * 0.35, // effective radius — plates are thin
        pushOffset: new THREE.Vector3(),
        pushVelocity: new THREE.Vector3(),
        pushAxis: new THREE.Vector3(0, 0, 1),
        pushAngle: 0,
        pushSpin: 0,
        prevZ: 0,
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
        const scale = range(rng, 1.2, 3.2);
        items.push({
          basePosition: new THREE.Vector3(range(rng, -44, 44), range(rng, -26, 26), range(rng, 20 - WRAP_DEPTH, 20)),
          baseRotation: new THREE.Euler(range(rng, -1, 1), range(rng, -1, 1), rng() * Math.PI * 2),
          scale,
          radius: scale * 0.35,
          pushOffset: new THREE.Vector3(),
          pushVelocity: new THREE.Vector3(),
          pushAxis: new THREE.Vector3(0, 0, 1),
          pushAngle: 0,
          pushSpin: 0,
          prevZ: 0,
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
   * Advance all shard motion. Absolute-time driven (except the collision
   * response, which integrates with dt).
   * @param {number} t        Elapsed time in seconds.
   * @param {number} cameraZ  Camera depth — shards wrap to stay in a
   *                          WRAP_DEPTH-deep window ahead of it.
   * @param {number} dt       Frame delta, for the push physics.
   * @param {THREE.Vector3|null} repel World position shards bounce off
   *                          (the spaceman), or null to disable.
   */
  update(t, cameraZ = 14, dt = 0, repel = null) {
    // Rear edge of the live window: shards with z beyond this (behind the
    // camera) are mapped WRAP_DEPTH forward — an infinite tiled field.
    const rear = cameraZ + WRAP_BEHIND;
    const wrapZ = (z) => rear - ((((rear - z) % WRAP_DEPTH) + WRAP_DEPTH) % WRAP_DEPTH);

    // Per-frame damping factors for the push physics: light drag and slow
    // spin decay — knocked shards coast for a long while (half-life ~6 s).
    this._dragK = Math.exp(-dt * 0.12);
    this._spinDecayK = Math.exp(-dt * 0.12);

    // Hero shards: quaternion = base * slow axis spin; position = base + drift.
    for (const s of this.hero) {
      this._q.setFromAxisAngle(s.spinAxis, t * s.spinSpeed);
      s.mesh.quaternion.multiplyQuaternions(s.baseQuaternion, this._q);
      s.mesh.position
        .copy(s.basePosition)
        .addScaledVector(s.driftDirection, Math.sin(t * s.driftFrequency + s.driftPhase) * s.driftAmplitude);
      s.mesh.position.z = wrapZ(s.mesh.position.z);
      this.#resetPushOnWrap(s, s.mesh.position.z);
      this.#applyPush(s, s.mesh.position, repel, dt);
      if (s.pushAngle > 0.0001) {
        this._pushQ.setFromAxisAngle(s.pushAxis, s.pushAngle);
        s.mesh.quaternion.multiply(this._pushQ);
      }

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
        this.#resetPushOnWrap(it, dummy.position.z);
        this.#applyPush(it, dummy.position, repel, dt);
        dummy.rotation.copy(it.baseRotation);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        // Apply the slow spin (plus any collision tumble) on top.
        this._q.setFromAxisAngle(it.spinAxis, t * it.spinSpeed);
        dummy.quaternion.multiply(this._q);
        if (it.pushAngle > 0.0001) {
          this._pushQ.setFromAxisAngle(it.pushAxis, it.pushAngle);
          dummy.quaternion.multiply(this._pushQ);
        }
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

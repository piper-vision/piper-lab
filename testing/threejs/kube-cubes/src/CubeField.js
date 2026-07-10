// Cube field generation + the instanced material for all healthy cubes.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GLSL_COMMON, GLSL_SURFACE } from './shaders.js';

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aGlow;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vFogDepth;
  varying float vSeed;
  varying float vGlow;

  void main() {
    vUv = uv;
    vSeed = aSeed;
    vGlow = aGlow;
    vNormalW = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uCorruptPos;
  uniform float uCorruptGlow;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vFogDepth;
  varying float vSeed;
  varying float vGlow;

  ${GLSL_COMMON}
  ${GLSL_SURFACE}

  void main() {
    vec3 col = cubeSurface(
      vUv, vNormalW, vWorldPos, vFogDepth,
      vSeed, vGlow, 0.0, uTime,
      uCorruptPos, uCorruptGlow, uFogColor, uFogDensity
    );
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class CubeField {
  constructor(scene) {
    const C = CONFIG;
    this.cubes = [];   // { pos, scale, seed, bobPhase, bobSpeed, hidden }

    // --- generate a loose 3D grid with holes, jitter and varied heights ---
    const rng = mulberry32(1337);
    const halfX = ((C.gridCols - 1) * C.gridSpacing) / 2;
    const halfZ = ((C.gridRows - 1) * C.gridSpacing) / 2;
    for (let r = 0; r < C.gridRows; r++) {
      for (let c = 0; c < C.gridCols; c++) {
        if (rng() < C.skipChance) continue;
        let y = (rng() - 0.5) * C.heightSpread;
        if (rng() < C.raisedChance) y += C.raisedLift;
        this.cubes.push({
          pos: new THREE.Vector3(
            c * C.gridSpacing - halfX + (rng() - 0.5) * 2 * C.gridJitter,
            y,
            r * C.gridSpacing - halfZ + (rng() - 0.5) * 2 * C.gridJitter,
          ),
          scale: C.scaleMin + rng() * (C.scaleMax - C.scaleMin),
          seed: rng(),
          bobPhase: rng() * Math.PI * 2,
          bobSpeed: C.bobSpeedMin + rng() * (C.bobSpeedMax - C.bobSpeedMin),
          hidden: false,
        });
      }
    }
    this.count = this.cubes.length;

    // Continuous forward travel: the whole field drifts toward the camera
    // and cubes wrap back to the far edge (hidden in fog) when they pass it.
    this.scroll = 0;
    this.wrapMin = -halfZ - C.gridSpacing / 2;
    this.wrapLen = C.gridRows * C.gridSpacing;

    // --- instanced mesh ---
    const geo = new THREE.BoxGeometry(C.cubeSize, C.cubeSize, C.cubeSize);
    const seeds = new Float32Array(this.count);
    this.glow = new Float32Array(this.count);        // current hover glow
    this.glowTarget = new Float32Array(this.count);  // eased toward
    for (let i = 0; i < this.count; i++) seeds[i] = this.cubes[i].seed;
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.glowAttr = new THREE.InstancedBufferAttribute(this.glow, 1);
    this.glowAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGlow', this.glowAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: { FALLOFF: CONFIG.glowRadiusFalloff.toFixed(3) },
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(C.fogColor) },
        uFogDensity: { value: C.fogDensity },
        uCorruptPos: { value: new THREE.Vector3(0, -999, 0) },
        uCorruptGlow: { value: 0 },
        uSignalPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -999, 0)) },
        uSignalInt: { value: new Float32Array(8) },
      },
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this._m = new THREE.Matrix4();
    this.updateMatrices(0);
  }

  /** Scrolled z (wrapped into the field's depth range) for cube i. */
  scrolledZ(i) {
    const z = this.cubes[i].pos.z + this.scroll - this.wrapMin;
    return ((z % this.wrapLen) + this.wrapLen) % this.wrapLen + this.wrapMin;
  }

  /**
   * How far back in the field a scrolled z sits: 0 at the near edge,
   * 1 at the far edge. Drives the amphitheater rise and fade-in scale.
   */
  farness(z) {
    return (this.wrapMin + this.wrapLen - z) / this.wrapLen;
  }

  /** World position of cube i including scroll, rise and bob at time t. */
  getPosition(i, t, out = new THREE.Vector3()) {
    const cube = this.cubes[i];
    const z = this.scrolledZ(i);
    const far = this.farness(z);
    return out.set(
      cube.pos.x,
      cube.pos.y
        + far * far * CONFIG.farRise
        + Math.sin(t * cube.bobSpeed + cube.bobPhase) * CONFIG.bobAmplitude,
      z,
    );
  }

  getScale(i) {
    return this.cubes[i].scale;
  }

  /**
   * Pick the next corruption target: a visible cube in the middle area of
   * the scene (never `exclude`). Falls back to any cube if the middle is
   * momentarily empty.
   */
  pickTarget(exclude, t) {
    const { xMax, zMin, zMax } = CONFIG.middleArea;
    const p = new THREE.Vector3();
    const candidates = [];
    for (let i = 0; i < this.count; i++) {
      if (i === exclude || this.cubes[i].hidden) continue;
      this.getPosition(i, t, p);
      if (Math.abs(p.x) <= xMax && p.z >= zMin && p.z <= zMax) candidates.push(i);
    }
    if (!candidates.length) {
      let i;
      do {
        i = Math.floor(Math.random() * this.count);
      } while (i === exclude);
      return i;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Signal sources: far-away cubes in a distance ring around the target,
   * spread across direction quadrants so pulses converge from all sides.
   */
  signalSources(target, k, t) {
    const [minD, maxD] = CONFIG.signalSourceRange;
    const origin = this.getPosition(target, t);
    const p = new THREE.Vector3();
    const ring = [];
    for (let i = 0; i < this.count; i++) {
      if (i === target || this.cubes[i].hidden) continue;
      this.getPosition(i, t, p);
      const d = p.distanceTo(origin);
      if (d >= minD && d <= maxD) {
        const quad = (p.x - origin.x >= 0 ? 1 : 0) + (p.z - origin.z >= 0 ? 2 : 0);
        ring.push({ idx: i, d, quad });
      }
    }
    // Farthest first, but cap how many come from any one quadrant.
    ring.sort((a, b) => b.d - a.d);
    const perQuad = Math.ceil(k / 4);
    const taken = [0, 0, 0, 0];
    const picked = [];
    for (const e of ring) {
      if (picked.length >= k) break;
      if (taken[e.quad] >= perQuad) continue;
      taken[e.quad]++;
      picked.push(e.idx);
    }
    // Top up from the remainder if some quadrants were empty.
    for (const e of ring) {
      if (picked.length >= k) break;
      if (!picked.includes(e.idx)) picked.push(e.idx);
    }
    return picked;
  }

  /** Hide instance i (scaled to zero) while its standalone stand-in animates. */
  hideInstance(i) {
    this.cubes[i].hidden = true;
  }

  showInstance(i) {
    this.cubes[i].hidden = false;
  }

  setHoverTarget(i) {
    this.glowTarget.fill(0);
    if (i >= 0 && !this.cubes[i].hidden) this.glowTarget[i] = 1;
  }

  updateMatrices(t) {
    for (let i = 0; i < this.count; i++) {
      const cube = this.cubes[i];
      const z = this.scrolledZ(i);
      const far = this.farness(z);
      // Cubes materialize as they enter at the far edge instead of popping.
      const appear = smoothstep(1.0, 0.93, far);
      const sc = cube.hidden ? 0.0001 : cube.scale * appear;
      this._m.makeScale(sc, sc, sc);
      this._m.setPosition(
        cube.pos.x,
        cube.pos.y
          + far * far * CONFIG.farRise
          + Math.sin(t * cube.bobSpeed + cube.bobPhase) * CONFIG.bobAmplitude,
        z,
      );
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(t, dt) {
    this.scroll += dt * CONFIG.scrollSpeed;
    this.material.uniforms.uTime.value = t;
    this.updateMatrices(t);

    // Ease hover glows toward their targets.
    const k = 1 - Math.exp(-dt * 10);
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const next = this.glow[i] + (this.glowTarget[i] - this.glow[i]) * k;
      if (Math.abs(next - this.glow[i]) > 1e-4) {
        this.glow[i] = next;
        dirty = true;
      }
    }
    if (dirty) this.glowAttr.needsUpdate = true;
  }

  /** Feed the corrupted cube's position/intensity into the shared red bleed. */
  setCorruptGlow(pos, intensity) {
    this.material.uniforms.uCorruptPos.value.copy(pos);
    this.material.uniforms.uCorruptGlow.value = intensity * CONFIG.glowStrength;
  }
}

function smoothstep(edge0, edge1, x) {
  const u = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return u * u * (3 - 2 * u);
}

// Small deterministic PRNG so the layout is stable between reloads.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

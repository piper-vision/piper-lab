import * as THREE from 'three';
import { mulberry32, range } from '../utils/random.js';
import { WRAP_DEPTH, WRAP_BEHIND } from './ShardField.js';

/**
 * Particles — sparse, barely-there dust motes drifting between the shards.
 *
 * One THREE.Points draw call; every behavior lives in the vertex shader so
 * the CPU does no per-frame work:
 *  - slow sinusoidal drift (per-particle phase/speed attributes)
 *  - gentle twinkle
 *  - infinite z-wrap in lockstep with the shard field
 *  - far fade matching the scene fog + near dissolve matching the shards
 */

const VERTEX = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uCameraZ;
  uniform float uPixelRatio;

  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Slow independent drift — small, hypnotic, never chaotic.
    p.x += sin(uTime * aSpeed + aPhase) * 0.9;
    p.y += cos(uTime * aSpeed * 0.8 + aPhase * 1.7) * 0.7;

    // Infinite wrap: same scheme as the shard field, so dust and shards
    // recycle through the identical depth window around the camera.
    float rear = uCameraZ + ${WRAP_BEHIND.toFixed(1)};
    p.z = rear - mod(rear - p.z, ${WRAP_DEPTH.toFixed(1)});

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    // Twinkle plus the same near-dissolve / fog-range fade as the shards.
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.25 + aSpeed) + aPhase * 3.0);
    float nearFade = smoothstep(1.5, 6.0, dist);
    float farFade = 1.0 - smoothstep(30.0, 65.0, dist);
    vAlpha = twinkle * nearFade * farFade;

    gl_PointSize = min(aSize * uPixelRatio * (48.0 / dist), 7.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    // Soft round sprite — bright core, feathered rim.
    float d = length(gl_PointCoord - 0.5);
    float mask = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(uColor, vAlpha * mask * uOpacity);
  }
`;

export class Particles {
  /**
   * @param {object} opts
   * @param {number} opts.count Particle count.
   * @param {number} opts.seed  PRNG seed.
   */
  constructor({ count = 400, seed = 23 } = {}) {
    const rng = mulberry32(seed);

    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Same volume the shards occupy: one full wrap tile deep.
      positions[i * 3 + 0] = range(rng, -45, 45);
      positions[i * 3 + 1] = range(rng, -26, 26);
      positions[i * 3 + 2] = range(rng, 20 - WRAP_DEPTH, 20);
      phases[i] = rng() * Math.PI * 2;
      sizes[i] = range(rng, 0.9, 2.4);
      speeds[i] = range(rng, 0.04, 0.16);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    // Positions wrap around the camera in the shader — default bounds would
    // let three cull the whole cloud when the camera flies far from origin.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCameraZ: { value: 0 },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color(0.75, 0.95, 1.1) }, // pale cyan
        uOpacity: { value: 0.5 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false, // never occlude, only glow
    });

    this.points = new THREE.Points(geometry, this.material);
    this.geometry = geometry;
  }

  update(t, cameraZ, pixelRatio) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uCameraZ.value = cameraZ;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

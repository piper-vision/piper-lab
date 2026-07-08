import * as THREE from 'three';
import { mulberry32, range } from '../utils/random.js';
import { WRAP_DEPTH, WRAP_BEHIND } from './ShardField.js';

/**
 * Sparkles — sparse pin-prick stars scattered through the dark.
 *
 * Each point idles as a tiny dim speck, then rarely flares to an HDR peak
 * (a narrow pow() pulse). The flare crosses the bloom and starburst
 * thresholds, so the post stack grows a six-point diffraction glint around
 * it automatically — the "light catching polished glass" moments.
 *
 * One THREE.Points draw call; all animation in the vertex shader.
 */

const VERTEX = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uCameraZ;
  uniform float uPixelRatio;

  varying float vIntensity;

  void main() {
    vec3 p = position;

    // Barely-there drift so specks never feel pinned.
    p.x += sin(uTime * aSpeed * 0.5 + aPhase) * 0.5;
    p.y += cos(uTime * aSpeed * 0.4 + aPhase * 1.7) * 0.4;

    // Infinite wrap, in lockstep with the shard field.
    float rear = uCameraZ + ${WRAP_BEHIND.toFixed(1)};
    p.z = rear - mod(rear - p.z, ${WRAP_DEPTH.toFixed(1)});

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    // Rare flare: a narrow pow() pulse on a slow sine — mostly a faint
    // speck, occasionally a brief HDR spike the post stack turns into a
    // starburst.
    float flare = pow(max(sin(uTime * aSpeed + aPhase), 0.0), 24.0);
    float nearFade = smoothstep(1.5, 6.0, dist);
    float farFade = 1.0 - smoothstep(28.0, 60.0, dist);
    vIntensity = (0.3 + flare * 6.0) * nearFade * farFade;

    gl_PointSize = min(aSize * (1.0 + flare * 1.5) * uPixelRatio * (52.0 / dist), 10.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;

  varying float vIntensity;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(p);
    // Hot core plus a faint 4-point cross inside the sprite itself; the
    // long spikes come from the screen-space starburst pass.
    float core = pow(smoothstep(1.0, 0.0, d), 2.0);
    float cross = (exp(-abs(p.x) * 6.0) + exp(-abs(p.y) * 6.0)) * smoothstep(1.0, 0.2, d) * 0.35;
    gl_FragColor = vec4(uColor * (core + cross) * vIntensity, 1.0);
  }
`;

export class Sparkles {
  /**
   * @param {object} opts
   * @param {number} opts.count Sparkle count — keep sparse.
   * @param {number} opts.seed  PRNG seed.
   */
  constructor({ count = 70, seed = 41 } = {}) {
    const rng = mulberry32(seed);

    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = range(rng, -40, 40);
      positions[i * 3 + 1] = range(rng, -24, 24);
      positions[i * 3 + 2] = range(rng, 20 - WRAP_DEPTH, 20);
      phases[i] = rng() * Math.PI * 2;
      sizes[i] = range(rng, 1.6, 3.2);
      speeds[i] = range(rng, 0.06, 0.22); // slow → flares are rare and unhurried
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCameraZ: { value: 0 },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color(0.92, 1.0, 1.08) }, // white with a cool cast
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
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

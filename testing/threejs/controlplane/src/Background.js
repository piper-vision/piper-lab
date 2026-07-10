import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './rng.js';

// Faint cyan data particles drifting far behind the orb.
export function createDust(isMobile) {
  const D = CONFIG.dust;
  const rng = mulberry32(CONFIG.orb.seed ^ 0x9e3779b9);
  const count = isMobile ? D.countMobile : D.count;

  const pos = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    while (v.lengthSq() < 0.05) v.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    v.normalize().multiplyScalar(D.radiusMin + (D.radiusMax - D.radiusMin) * rng());
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    rand[i] = rng();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), D.radiusMax + 1);

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      attribute float aRand;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.15 + aRand * 6.2831) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.35 + 0.65 * fract(aRand * 7.13);
        // slow shimmer
        vA *= 0.6 + 0.4 * sin(uTime * (0.3 + aRand) + aRand * 40.0);
        gl_PointSize = (1.2 + 2.2 * aRand) * (uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(uColor, disc * vA * uAlpha);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uColor: { value: new THREE.Color(D.color) },
      uAlpha: { value: D.alpha },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const dust = new THREE.Points(geo, mat);
  return {
    object: dust,
    update(time) {
      mat.uniforms.uTime.value = time;
      dust.rotation.y = time * 0.008;
    },
    resize(heightPx, fovDeg) {
      mat.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) * 0.05;
    },
  };
}

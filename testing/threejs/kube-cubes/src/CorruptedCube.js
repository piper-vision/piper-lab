// The standalone stand-in mesh used while a cube is corrupted. It replaces
// the hidden instance so its vertices can be deformed individually, then is
// removed once the repair completes.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GLSL_COMMON, GLSL_SURFACE } from './shaders.js';

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uCorruption;
  uniform float uSeed;
  uniform float uSize;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  ${GLSL_COMMON}

  void main() {
    vUv = uv;
    vNormalW = mat3(modelMatrix) * normal;

    // Blocky, angular displacement: vertices are grouped into coarse cells
    // that shift together, and offsets are snapped to steps so the damage
    // reads as digital corruption rather than melting.
    vec3 cell = floor((position / uSize + 0.5001) * 3.0) + uSeed * 91.7;
    vec3 h1 = hash33(cell) - 0.5;
    vec3 h2 = hash33(cell + floor(uTime * 6.0) * 0.113) - 0.5;
    vec3 offs = mix(h1, h2, 0.35);
    offs = floor(offs * 4.0) / 3.0;   // coarse steps keep the damage angular
    vec3 pos = position + offs * uCorruption * uSize * DISPLACE;

    // A slight time-varying shear keeps faces uneven but planar-ish.
    pos.x += pos.y * uCorruption * 0.10 * sin(uTime * 1.7 + uSeed * 20.0);
    pos.z += pos.y * uCorruption * 0.08 * cos(uTime * 1.3 + uSeed * 30.0);

    // Slice glitch: horizontal bands of the cube shear sideways for a beat,
    // like a datamoshed video frame.
    float sliceId = floor((position.y / uSize + 0.5) * 7.0);
    float hs = hash21(vec2(sliceId, floor(uTime * 5.0) + uSeed * 10.0));
    float sliceOn = step(0.78, hs);
    pos.x += sliceOn * (fract(hs * 7.0) - 0.5) * uSize * 0.38 * uCorruption;
    pos.z += sliceOn * (fract(hs * 13.0) - 0.5) * uSize * 0.22 * uCorruption;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uCorruption;
  uniform float uSeed;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  ${GLSL_COMMON}
  ${GLSL_SURFACE}

  void main() {
    // Its own position is passed as the glow source with zero intensity —
    // the self-glow comes from the corruption term inside cubeSurface.
    vec3 col = cubeSurface(
      vUv, vNormalW, vWorldPos, vFogDepth,
      uSeed, 0.0, uCorruption, uTime,
      vWorldPos, 0.0, uFogColor, uFogDensity
    );
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class CorruptedCube {
  constructor(scene) {
    this.scene = scene;
    this.corruption = 0;      // 0 healthy → 1 fully corrupted (tweened outside)
    this.index = -1;          // which field instance it is standing in for
    this.basePos = new THREE.Vector3();

    const C = CONFIG;
    // Extra segments give the vertex displacement something to chew on.
    const geo = new THREE.BoxGeometry(C.cubeSize, C.cubeSize, C.cubeSize, 4, 4, 4);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: {
        FALLOFF: C.glowRadiusFalloff.toFixed(3),
        DISPLACE: C.corruptDisplacement.toFixed(3),
      },
      uniforms: {
        uTime: { value: 0 },
        uCorruption: { value: 0 },
        uSeed: { value: 0 },
        uSize: { value: C.cubeSize },
        uFogColor: { value: new THREE.Color(C.fogColor) },
        uFogDensity: { value: C.fogDensity },
        uSignalPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -999, 0)) },
        uSignalInt: { value: new Float32Array(8) },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    scene.add(this.mesh);

    // Soft additive halo sprite for the red glow around the damaged cube.
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeHaloTexture(),
        color: 0xff2010,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.halo.visible = false;
    this.halo.userData.noDepth = true;
    scene.add(this.halo);

    // Flickering "containment shell": ghost edge-cages that pop around the
    // damaged cube at glitchy offsets while it is corrupted.
    this.glitchShell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(C.cubeSize, C.cubeSize, C.cubeSize)),
      new THREE.LineBasicMaterial({
        color: 0xff3018,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glitchShell.visible = false;
    this.glitchShell.userData.noDepth = true;
    scene.add(this.glitchShell);

    // Expanding wireframe shell used for the repair confirmation pulse.
    this.pulseShell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(C.cubeSize, C.cubeSize, C.cubeSize)),
      new THREE.LineBasicMaterial({
        color: 0xbfd0dd,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.pulseShell.visible = false;
    this.pulseShell.userData.noDepth = true;
    scene.add(this.pulseShell);
  }

  /** Take over instance `i` of the field (which should be hidden). */
  begin(i, pos, scale, seed) {
    this.index = i;
    this.basePos.copy(pos);
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(scale);
    this.mesh.rotation.set(0, 0, 0);
    this.material.uniforms.uSeed.value = seed;
    this.mesh.visible = true;
    this.halo.visible = true;
    this.halo.position.copy(pos);
    this.halo.scale.setScalar(CONFIG.cubeSize * scale * 4.5);
  }

  end() {
    this.index = -1;
    this.mesh.visible = false;
    this.halo.visible = false;
    this.glitchShell.visible = false;
  }

  /** Fire the restrained confirmation pulse at the repaired cube. */
  confirmPulse(pos, scale, tweenFn, ease) {
    const shell = this.pulseShell;
    const mat = shell.material;
    shell.position.copy(pos);
    shell.visible = true;
    tweenFn({
      dur: 0.55,
      ease,
      onUpdate: (v) => {
        shell.scale.setScalar(scale * (1 + v * 0.85));
        mat.opacity = 0.85 * (1 - v);
      },
      onComplete: () => {
        shell.visible = false;
      },
    });
  }

  /** basePos should track the bobbing position of the replaced instance. */
  update(t, bobbedPos) {
    if (!this.mesh.visible) return;
    const c = this.corruption;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uCorruption.value = c;
    this.basePos.copy(bobbedPos);

    // Whole-mesh positional + rotational jitter, fading out with repair.
    const j = CONFIG.corruptJitterPos * c;
    this.mesh.position.set(
      bobbedPos.x + (Math.random() - 0.5) * j,
      bobbedPos.y + (Math.random() - 0.5) * j,
      bobbedPos.z + (Math.random() - 0.5) * j,
    );
    const r = CONFIG.corruptJitterRot * c;
    this.mesh.rotation.set(
      (Math.random() - 0.5) * r,
      (Math.random() - 0.5) * r,
      (Math.random() - 0.5) * r,
    );

    const pulse = 0.72 + 0.28 * Math.sin(t * 7.0);
    this.halo.position.copy(bobbedPos);
    this.halo.material.opacity = 0.32 * c * pulse;

    // Containment-shell flicker: a ghost cage pops at a random offset/scale
    // for a frame or two, only while corruption is strong.
    const shell = this.glitchShell;
    if (c > 0.3 && Math.random() < 0.22) {
      const s = this.mesh.scale.x * (1.03 + Math.random() * 0.12);
      shell.visible = true;
      shell.scale.setScalar(s);
      shell.position.set(
        bobbedPos.x + (Math.random() - 0.5) * 0.5,
        bobbedPos.y + (Math.random() - 0.5) * 0.5,
        bobbedPos.z + (Math.random() - 0.5) * 0.5,
      );
      shell.material.opacity = (0.25 + Math.random() * 0.5) * c;
    } else if (Math.random() < 0.4) {
      shell.visible = false;
    }
  }

  /** Current glow intensity for the red bleed onto neighbouring cubes. */
  glowIntensity(t) {
    return this.mesh.visible
      ? this.corruption * (0.72 + 0.28 * Math.sin(t * 7.0))
      : 0;
  }
}

function makeHaloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,120,90,0.55)');
  g.addColorStop(0.6, 'rgba(255,40,20,0.16)');
  g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

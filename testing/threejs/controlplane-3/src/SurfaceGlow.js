import * as THREE from 'three';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Pool of quads lying flat on slab surfaces. Where a filament touches a slab
// it briefly reveals the surface's underlying mesh: a world-aligned grid,
// masked by a radial falloff around the contact point.
//   • impact (blocked beam): light red grid, quick attack then soft decay
//   • pierce (successful beam): green grid while the filament crosses
// Quads live in world space; their height tracks the (bobbing) layer.
// ---------------------------------------------------------------------------

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uCell;
  uniform float uLine;
  // Slab footprint edges in world XZ (nx·x + nz·z + c >= 0 inside) — the
  // reveal exists only ON the triangle surface, never floating past an edge.
  uniform vec3 uEdge0;
  uniform vec3 uEdge1;
  uniform vec3 uEdge2;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    float d0 = uEdge0.x * vWorld.x + uEdge0.y * vWorld.z + uEdge0.z;
    float d1 = uEdge1.x * vWorld.x + uEdge1.y * vWorld.z + uEdge1.z;
    float d2 = uEdge2.x * vWorld.x + uEdge2.y * vWorld.z + uEdge2.z;
    float inside = smoothstep(0.0, 0.03, min(d0, min(d1, d2)));
    if (inside <= 0.0) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r2 = dot(p, p);
    // Radial reveal mask around the contact point.
    float mask = exp(-r2 * 2.2) * smoothstep(1.0, 0.7, sqrt(r2));

    // World-aligned grid so the mesh reads as a property of the slab
    // surface, continuous across neighbouring reveals.
    float dx = abs(fract(vWorld.x / uCell + 0.5) - 0.5) * uCell;
    float dz = abs(fract(vWorld.z / uCell + 0.5) - 0.5) * uCell;
    float grid = max(1.0 - smoothstep(0.0, uLine, dx),
                     1.0 - smoothstep(0.0, uLine, dz));

    // Bright foot at the contact point plus the revealed grid — additive,
    // so it glows out of the dark surface.
    float soft = exp(-r2 * 6.0) * 0.1;
    float i = (grid * mask + soft) * uIntensity * inside;
    gl_FragColor = vec4(uColor * i, 1.0);
  }
`;

export class SurfaceGlowSystem {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.baseMaterial = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: {
        uIntensity: { value: 0 },
        uColor: { value: new THREE.Color(CONFIG.glows.passColor) },
        uCell: { value: CONFIG.glows.gridCell },
        uLine: { value: CONFIG.glows.gridLineWidth },
        uEdge0: { value: new THREE.Vector3() },
        uEdge1: { value: new THREE.Vector3() },
        uEdge2: { value: new THREE.Vector3() },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // Depth-test against the slabs so a reveal on a lower layer is hidden
      // by the slab above it.
      depthTest: true,
    });
    this.glows = [];
  }

  acquire() {
    const material = this.baseMaterial.clone();
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 21;
    mesh.visible = false;
    this.scene.add(mesh);
    const glow = {
      mesh,
      u: material.uniforms,
      layer: null,
      mode: 'idle',       // idle | attack | decay | pierce
      intensity: 0,
      peak: 0,
      pierceTarget: 0,
    };
    this.glows.push(glow);
    return glow;
  }

  /** Blocked-beam reveal: light red grid, quick attack then a long decay. */
  trigger(glow, x, z, layer, peak) {
    const g = CONFIG.glows;
    glow.layer = layer;
    glow.peak = peak;
    glow.mode = 'attack';
    glow.u.uColor.value.set(g.blockedColor);
    glow.mesh.position.set(x, layer.topWorldY(), z);
    const r = g.impactRadius[0] + Math.random() * (g.impactRadius[1] - g.impactRadius[0]);
    glow.mesh.scale.set(r * 2, 1, r * 2);
    glow.mesh.visible = true;
  }

  /** Pass-through reveal: green grid, intensity follows the beam. */
  setPierce(glow, x, z, layer, intensity) {
    glow.layer = layer;
    glow.mode = 'pierce';
    glow.pierceTarget = intensity;
    if (intensity > 0) {
      glow.u.uColor.value.set(CONFIG.glows.passColor);
      glow.mesh.position.set(x, layer.topWorldY(), z);
      glow.mesh.scale.set(CONFIG.glows.pierceRadius * 2, 1, CONFIG.glows.pierceRadius * 2);
    }
  }

  update(dt) {
    const g = CONFIG.glows;
    for (const glow of this.glows) {
      switch (glow.mode) {
        case 'attack':
          glow.intensity += (glow.peak - glow.intensity) * Math.min(1, dt / g.impactAttack);
          if (glow.intensity > glow.peak * 0.96) glow.mode = 'decay';
          break;
        case 'decay':
          glow.intensity *= Math.exp(-dt / (g.impactDecay * 0.45));
          if (glow.intensity < 0.004) { glow.intensity = 0; glow.mode = 'idle'; }
          break;
        case 'pierce':
          glow.intensity += (glow.pierceTarget - glow.intensity) * Math.min(1, dt * 8);
          break;
      }
      if (glow.layer && glow.intensity > 0.001) {
        glow.mesh.position.y = glow.layer.topWorldY() + 0.01;
        glow.mesh.visible = true;
        glow.u.uIntensity.value = glow.intensity;
        // Track the slab footprint (it bobs and parallaxes) so the reveal
        // clips exactly to the triangle's current world position.
        const gp = glow.layer.group.position;
        const edges = glow.layer.edgesLocal;
        for (let i = 0; i < 3; i++) {
          const e = edges[i];
          glow.u['uEdge' + i].value.set(e.nx, e.nz, e.c - (e.nx * gp.x + e.nz * gp.z));
        }
      } else {
        glow.mesh.visible = false;
      }
    }
  }
}

import * as THREE from 'three';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// One continuous glowing filament. A single camera-facing quad spans the
// whole column; the visible segment (head → tail) moves entirely in the
// fragment shader, so no geometry is ever rebuilt.
//
// Lifecycle: waiting → falling → (draining | passing) → waiting …
// The outcome (which layer stops it, if any) is dealt by BeamSystem and
// stays fixed for the slot; position/speed/brightness reroll every cycle.
// ---------------------------------------------------------------------------

export const BEAM_VERTEX = /* glsl */ `
  uniform float uHalfWidth;
  uniform float uYTop;
  uniform float uYBottom;
  varying vec2 vUv;
  varying float vWorldY;

  void main() {
    vUv = uv;
    // View-space billboard: the filament's centre line is vertical in world
    // space; the width offset is applied along the camera's own x axis, so
    // the strip always faces the viewer exactly.
    vec3 anchor = vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
    float y = mix(uYBottom, uYTop, uv.y);
    vWorldY = y;
    vec4 viewPos = viewMatrix * vec4(anchor + vec3(0.0, y, 0.0), 1.0);
    viewPos.x += position.x * 2.0 * uHalfWidth;
    gl_Position = projectionMatrix * viewPos;
  }
`;

export const BEAM_FRAGMENT = /* glsl */ `
  uniform float uHead;        // world y of the descending tip
  uniform float uTail;        // world y of the trailing end (above head)
  uniform float uBrightness;
  uniform float uHeadGlow;    // pre-impact brightening
  uniform vec3 uColor;
  uniform vec3 uColorCore;
  uniform float uTopFadeStart;
  uniform float uTopFadeEnd;
  uniform float uBottomFadeStart;
  uniform float uBottomFadeEnd;
  varying vec2 vUv;
  varying float vWorldY;

  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float core = exp(-x * x * 42.0);
    float halo = exp(-x * x * 5.5) * 0.34;

    float span = max(uTail - uHead, 0.0001);
    float yn = clamp((vWorldY - uHead) / span, 0.0, 1.0);
    float inSeg = step(uHead, vWorldY) * step(vWorldY, uTail);

    // Rounded cap at the head, long soft comet fade toward the tail.
    float cap = smoothstep(uHead - 0.01, uHead + 0.14, vWorldY);
    float tailFade = 1.0 - smoothstep(0.32, 1.0, yn);
    // Warm swell just above the head (used while approaching a layer).
    float headBoost = exp(-pow((vWorldY - uHead) / 0.38, 2.0)) * uHeadGlow;

    // Column-level fades: materialise below the top edge, dissolve beneath
    // the composition.
    float topFade = 1.0 - smoothstep(uTopFadeStart, uTopFadeEnd, vWorldY);
    float bottomFade = smoothstep(uBottomFadeEnd, uBottomFadeStart, vWorldY);

    float i = (core + halo) * inSeg * cap * tailFade * (1.0 + headBoost)
            * uBrightness * topFade * bottomFade;

    vec3 col = mix(uColor, uColorCore, core * 0.85);
    gl_FragColor = vec4(col * i, 1.0);
  }
`;

export function createBeamBaseMaterial() {
  const b = CONFIG.beams;
  return new THREE.ShaderMaterial({
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    uniforms: {
      uHalfWidth: { value: 0.02 },
      uYTop: { value: b.columnTop },
      uYBottom: { value: b.columnBottom },
      uHead: { value: b.columnTop },
      uTail: { value: b.columnTop },
      uBrightness: { value: 0 },
      uHeadGlow: { value: 0 },
      uColor: { value: new THREE.Color(CONFIG.colors.beam) },
      uColorCore: { value: new THREE.Color(CONFIG.colors.beamCore) },
      uTopFadeStart: { value: b.topFade[0] },
      uTopFadeEnd: { value: b.topFade[1] },
      uBottomFadeStart: { value: b.bottomFade[0] },
      uBottomFadeEnd: { value: b.bottomFade[1] },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export class Beam {
  /**
   * @param {THREE.PlaneGeometry} geometry shared quad
   * @param {THREE.ShaderMaterial} baseMaterial cloned per beam
   * @param {'stop'|'pass'} outcomeKind
   * @param {TriangleLayer|null} targetLayer layer that stops this beam (null = pass)
   * @param {TriangleLayer[]} layers all layers, top → bottom
   * @param {SurfaceGlowSystem} glows
   */
  constructor(geometry, baseMaterial, targetLayer, layers, glows) {
    this.layers = layers;
    this.targetLayer = targetLayer;
    this.glows = glows;

    this.material = baseMaterial.clone();
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;

    this.u = this.material.uniforms;
    this.reducedMotion = false;

    // Glow handles: one impact glow for blocked beams; one pierce glow per
    // slab a successful beam crosses.
    if (targetLayer) {
      this.impactGlow = glows.acquire();
    } else {
      this.pierceGlows = layers.map(() => glows.acquire());
    }

    this.state = 'waiting';
    this.timer = Math.random() * CONFIG.beams.initialStagger;
    this._roll();
  }

  // New random parameters for the next cycle (outcome stays fixed).
  _roll() {
    const b = CONFIG.beams;
    // Blocked beams land inside their layer's footprint; successful beams
    // land inside the TOP layer's footprint so they genuinely thread all three.
    const src = this.targetLayer || this.layers[0];
    const p = src.samplePoint();
    this.x = p.x;
    this.z = p.z;
    this.mesh.position.set(this.x, 0, this.z);

    this.speed = rand(b.speed[0], b.speed[1]);
    this.len = rand(b.length[0], b.length[1]);
    this.halfWidth = rand(b.halfWidth[0], b.halfWidth[1]);
    this.brightness = rand(b.brightness[0], b.brightness[1]);
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = rand(b.pulseSpeed[0], b.pulseSpeed[1]);

    this.isHero = !this.targetLayer && Math.random() < b.heroChance;
    if (this.isHero) {
      this.brightness *= b.heroBrightness;
      this.halfWidth *= b.heroWidth;
    }

    this.head = rand(b.spawnY[0], b.spawnY[1]);
    this.tail = this.head;
    this.fade = 1;
    this.u.uHalfWidth.value = this.halfWidth;
  }

  update(dt, t) {
    const b = CONFIG.beams;
    const speed = this.speed * (this.reducedMotion ? CONFIG.reducedMotion.speedScale : 1);

    switch (this.state) {
      case 'waiting': {
        this.timer -= dt;
        this.u.uBrightness.value = 0;
        if (this.timer <= 0) this.state = 'falling';
        return;
      }

      case 'falling': {
        this.head -= speed * dt;
        this.tail = Math.min(this.head + this.len, b.columnTop);

        let headGlow = 0;
        if (this.targetLayer) {
          const surfaceY = this.targetLayer.topWorldY();
          const dist = this.head - surfaceY;
          if (dist <= 0) {
            this.head = surfaceY;
            this.state = 'draining';
            this.glows.trigger(
              this.impactGlow, this.x, this.z, this.targetLayer,
              CONFIG.glows.impactIntensity * (0.7 + this.brightness * 0.45),
            );
          } else if (dist < b.slowDistance) {
            headGlow = (1 - dist / b.slowDistance) * b.approachBoost;
          }
        } else if (this.head < b.exitY && this.tail < b.exitY) {
          // Fully off the bottom — recycle.
          this._recycle();
          return;
        }

        this.u.uHeadGlow.value = headGlow;
        this._applyBrightness(t);

        // Successful beams softly dot each slab they cross.
        if (!this.targetLayer) {
          for (let i = 0; i < this.layers.length; i++) {
            const ly = this.layers[i].topWorldY();
            const crossing = this.head < ly && this.tail > ly;
            this.glows.setPierce(
              this.pierceGlows[i], this.x, this.z, this.layers[i],
              crossing ? CONFIG.glows.pierceIntensity * this.brightness : 0,
            );
          }
        }
        break;
      }

      case 'draining': {
        // Head pinned to the (gently bobbing) surface while the rest of the
        // filament drains into the slab and fades.
        this.head = this.targetLayer.topWorldY();
        this.tail = Math.max(this.head, this.tail - speed * dt);
        this.fade = Math.max(0, this.fade - dt / b.drainFade);
        this.u.uHeadGlow.value = b.approachBoost * this.fade;
        this._applyBrightness(t);
        if (this.tail - this.head < 0.02 && this.fade <= 0) this._recycle();
        break;
      }
    }

    this.u.uHead.value = this.head;
    this.u.uTail.value = this.tail;
  }

  _applyBrightness(t) {
    const b = CONFIG.beams;
    const pulse = this.reducedMotion
      ? 0
      : Math.sin(t * this.pulseSpeed + this.pulsePhase) * b.pulseAmount;
    this.u.uBrightness.value = this.brightness * this.fade * (1 + pulse);
  }

  _recycle() {
    const b = CONFIG.beams;
    if (this.pierceGlows) {
      for (let i = 0; i < this.pierceGlows.length; i++) {
        this.glows.setPierce(this.pierceGlows[i], this.x, this.z, this.layers[i], 0);
      }
    }
    this.state = 'waiting';
    this.timer = rand(b.respawnDelay[0], b.respawnDelay[1]);
    this._roll();
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { StarburstPass } from './StarburstPass.js';

/**
 * Combined chromatic aberration + vignette in one cheap full-screen pass.
 * Both effects are radial, so they share the same distance term.
 */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0.003 }, // radial RGB split, masked to the far corners
    uVignette: { value: 0.3 },     // darkening toward the corners
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);

      // Chromatic aberration: shift R inward and B outward. Masked so the
      // central ~60% of the frame is untouched — thin edge lines would
      // otherwise split into magenta/green fringes across the whole image.
      vec2 offset = centered * (uAberration * smoothstep(0.55, 1.0, dist));
      float r = texture2D(tDiffuse, vUv - offset).r;
      vec4 base = texture2D(tDiffuse, vUv);
      float b = texture2D(tDiffuse, vUv + offset).b;
      vec3 color = vec3(r, base.g, b);

      // Very subtle vignette.
      color *= 1.0 - uVignette * smoothstep(0.35, 0.95, dist);
      gl_FragColor = vec4(color, base.a);
    }
  `,
};

/**
 * PostFX — render → bloom → CA/vignette (HDR, pre-tonemap) → ACES + sRGB
 * output → FXAA (on the final LDR image, where it works best).
 */
export class PostFX {
  /**
   * @param {number} samples MSAA samples for the scene render target —
   *   geometry silhouettes against HDR-bright reflections alias harder than
   *   FXAA alone can fix. 0 disables (mobile).
   */
  constructor(renderer, scene, camera, { samples = 4 } = {}) {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    // High threshold: only genuinely hot highlights (HDR light reflections,
    // edge glints) bloom — the black field stays pure black.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.55, 0.85);
    this.composer.addPass(this.bloomPass);

    // Diffraction starbursts on the hottest highlights only (post-bloom
    // HDR, threshold well above the bloom knee).
    this.starburstPass = new StarburstPass({ threshold: 1.9, intensity: 1.0, fringe: 2.4 });
    this.composer.addPass(this.starburstPass);

    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);

    this.composer.addPass(new OutputPass()); // tone mapping + sRGB

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
  }

  setSize(width, height, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.fxaaPass.material.uniforms.resolution.value.set(1 / (width * dpr), 1 / (height * dpr));
  }

  render(t = 0) {
    this.starburstPass.setTime(t); // slow star-angle shimmer
    this.composer.render();
  }
}

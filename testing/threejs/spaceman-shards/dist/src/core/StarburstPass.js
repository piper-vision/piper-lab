import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * StarburstPass — a diffraction / cross-screen lens filter.
 *
 * Screen-space, so it triggers dynamically on whatever is bright: sweeping
 * bar reflections, flaring shard edges, sparkle pin-pricks. Pipeline:
 *
 *   1. threshold: keep only pixels above a high HDR cutoff (quarter res)
 *   2. streak:    smear the survivors along three axes → six-point star,
 *                 with subtle spectral (rainbow) fringing toward the tips
 *   3. composite: scene + streaks, additive
 *
 * Both working targets are quarter resolution — the pass costs a fraction
 * of the bloom pass.
 */

const ThresholdShader = {
  uniforms: {
    tDiffuse: { value: null },
    uThreshold: { value: 1.6 },
    uTexelSrc: { value: new THREE.Vector2(1, 1) }, // full-res texel size
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
    uniform float uThreshold;
    uniform vec2 uTexelSrc;
    varying vec2 vUv;

    void main() {
      // Proper 4×4 box downsample (four bilinear taps): a thin bright line
      // must land in the quarter-res buffer as a continuous stroke — a
      // single center tap turns it into dashes that moiré with the streak
      // sampling further down the chain.
      vec3 c1 = texture2D(tDiffuse, vUv + uTexelSrc * vec2(-1.0, -1.0)).rgb;
      vec3 c2 = texture2D(tDiffuse, vUv + uTexelSrc * vec2( 1.0, -1.0)).rgb;
      vec3 c3 = texture2D(tDiffuse, vUv + uTexelSrc * vec2(-1.0,  1.0)).rgb;
      vec3 c4 = texture2D(tDiffuse, vUv + uTexelSrc * vec2( 1.0,  1.0)).rgb;
      vec3 c = (c1 + c2 + c3 + c4) * 0.25;

      // Detect on the brightest tap (box-averaging halves a thin line's
      // peak and would push it under the threshold), output the average.
      float peak = max(max(max(c1.r, max(c1.g, c1.b)), max(c2.r, max(c2.g, c2.b))),
                       max(max(c3.r, max(c3.g, c3.b)), max(c4.r, max(c4.g, c4.b))));
      // Soft knee: nothing below the threshold, full strength at 2×.
      float pass = smoothstep(uThreshold, uThreshold * 2.0, peak);
      gl_FragColor = vec4(c * pass, 1.0);
    }
  `,
};

const StreakShader = {
  defines: { TAPS: 40 },
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uFringe: { value: 0.5 },
  },
  vertexShader: ThresholdShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uTime;
    uniform float uFringe;
    varying vec2 vUv;

    void main() {
      // The un-smeared source stays as a hot core.
      vec3 acc = texture2D(tDiffuse, vUv).rgb * 0.2;

      // The whole star breathes ±1.7° very slowly — a live filter, not a decal.
      float wobble = sin(uTime * 0.11) * 0.03;

      // Spectral dispersion strength shimmers slowly, so the rainbow
      // splitting comes and goes rather than sitting statically.
      float disp = uFringe * (0.8 + 0.2 * sin(uTime * 0.23));

      for (int d = 0; d < 3; d++) {
        float ang = float(d) * 1.04720 + wobble;   // 3 axes, 60° apart → 6 spikes
        float stretch = d == 0 ? 1.7 : 0.9;        // long horizontal, shorter diagonals

        // Taps sit ~1.5·stretch texels apart — and the dispersed R channel
        // strides up to 26% wider still. Sample a mip level whose footprint
        // covers the widest gap (+0.6 ≈ ×1.5 margin), so the tap comb can't
        // beat against fine detail in the threshold buffer (the RGB
        // moiré-grid artifact).
        float lod = log2(max(1.5 * stretch, 1.0)) + 0.6;

        for (int i = 1; i <= TAPS; i++) {
          float fi = float(i);
          float w = exp(-fi * 0.10);

          // Prism dispersion, per channel: R/G/B streaks share the first few
          // taps (white-hot core), then peel apart toward the tail — each
          // channel on a slightly rotated axis with a slightly different
          // stride (long wavelengths diffract further).
          float split = disp * smoothstep(2.0, 16.0, fi);
          float aR = ang + split * 0.07;
          float aB = ang - split * 0.07;
          float base = fi * 1.5 * stretch;
          vec2 offR = vec2(cos(aR), sin(aR)) * uTexel * base * (1.0 + split * 0.26);
          vec2 offG = vec2(cos(ang), sin(ang)) * uTexel * base;
          vec2 offB = vec2(cos(aB), sin(aB)) * uTexel * base * (1.0 - split * 0.2);

          // Colored fringes run a touch dimmer than the white core region.
          float cw = w * mix(1.0, 0.8, smoothstep(2.0, 16.0, fi));
          // Streak tails soften progressively, like a real filter.
          float bias = lod + fi * 0.02;

          acc.r += (texture2D(tDiffuse, vUv + offR, bias).r + texture2D(tDiffuse, vUv - offR, bias).r) * cw;
          acc.g += (texture2D(tDiffuse, vUv + offG, bias).g + texture2D(tDiffuse, vUv - offG, bias).g) * cw;
          acc.b += (texture2D(tDiffuse, vUv + offB, bias).b + texture2D(tDiffuse, vUv - offB, bias).b) * cw;
        }
      }
      gl_FragColor = vec4(acc * 0.05, 1.0); // empirical gain: streaks stay quieter than sources
    }
  `,
};

const CompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tStreak: { value: null },
    uIntensity: { value: 1.0 },
  },
  vertexShader: ThresholdShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tStreak;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(base.rgb + texture2D(tStreak, vUv).rgb * uIntensity, base.a);
    }
  `,
};

export class StarburstPass extends Pass {
  constructor({ threshold = 1.6, intensity = 1.0, fringe = 0.5 } = {}) {
    super();

    // The threshold buffer carries mipmaps: the streak pass samples it with
    // an LOD bias so wide-spaced taps read a pre-blurred level instead of
    // aliasing against fine detail.
    this.thresholdRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.streakRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });

    this.thresholdMaterial = new THREE.ShaderMaterial(ThresholdShader);
    this.thresholdMaterial.uniforms.uThreshold.value = threshold;

    this.streakMaterial = new THREE.ShaderMaterial({
      defines: { ...StreakShader.defines },
      uniforms: THREE.UniformsUtils.clone(StreakShader.uniforms),
      vertexShader: StreakShader.vertexShader,
      fragmentShader: StreakShader.fragmentShader,
    });
    this.streakMaterial.uniforms.uFringe.value = fringe;

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CompositeShader.uniforms),
      vertexShader: CompositeShader.vertexShader,
      fragmentShader: CompositeShader.fragmentShader,
    });
    this.compositeMaterial.uniforms.uIntensity.value = intensity;

    this._quad = new FullScreenQuad(this.thresholdMaterial);
  }

  /** Called by PostFX each frame so the star angle can shimmer. */
  setTime(t) {
    this.streakMaterial.uniforms.uTime.value = t;
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width / 4));
    const h = Math.max(1, Math.floor(height / 4));
    this.thresholdRT.setSize(w, h);
    this.streakRT.setSize(w, h);
    this.streakMaterial.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.thresholdMaterial.uniforms.uTexelSrc.value.set(1 / width, 1 / height);
  }

  render(renderer, writeBuffer, readBuffer) {
    // 1. Extract highlights.
    this.thresholdMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this._quad.material = this.thresholdMaterial;
    renderer.setRenderTarget(this.thresholdRT);
    this._quad.render(renderer);

    // 2. Smear into star spikes.
    this.streakMaterial.uniforms.tDiffuse.value = this.thresholdRT.texture;
    this._quad.material = this.streakMaterial;
    renderer.setRenderTarget(this.streakRT);
    this._quad.render(renderer);

    // 3. Composite over the scene.
    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tStreak.value = this.streakRT.texture;
    this._quad.material = this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this._quad.render(renderer);
  }

  dispose() {
    this.thresholdRT.dispose();
    this.streakRT.dispose();
    this.thresholdMaterial.dispose();
    this.streakMaterial.dispose();
    this.compositeMaterial.dispose();
    this._quad.dispose();
  }
}

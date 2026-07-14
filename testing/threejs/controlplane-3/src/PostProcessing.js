import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// EffectComposer chain: render → subtle UnrealBloom → OutputPass
// (ACES filmic tone mapping + sRGB). Bloom threshold sits above the beige
// background's luminance so only the filaments and glows breathe light.
// ---------------------------------------------------------------------------

export class PostProcessing {
  constructor(renderer, scene, camera) {
    const p = CONFIG.post;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      p.bloomStrength, p.bloomRadius, p.bloomThreshold,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}

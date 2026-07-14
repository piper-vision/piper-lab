import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Beam, createBeamBaseMaterial } from './Beam.js';

// ---------------------------------------------------------------------------
// Owns the pool of filaments. Outcomes are dealt from an exact deck built
// from CONFIG.filter, then shuffled — so the distribution is deliberate and
// stable, never a run of lucky rolls. Geometry is one shared quad; each beam
// clones the base material for its own uniforms.
// ---------------------------------------------------------------------------

export class BeamSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {TriangleLayer[]} layers top → bottom
   * @param {SurfaceGlowSystem} glows
   * @param {boolean} isMobile
   */
  constructor(scene, layers, glows, isMobile) {
    const count = isMobile ? CONFIG.beams.countMobile : CONFIG.beams.countDesktop;

    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.baseMaterial = createBeamBaseMaterial();

    // Build the outcome deck: index of blocking layer, or -1 for pass.
    const f = CONFIG.filter;
    const deck = [];
    const quotas = [f.stopAtLayer1, f.stopAtLayer2, f.stopAtLayer3];
    quotas.forEach((q, layerIndex) => {
      for (let i = 0; i < Math.round(q * count); i++) deck.push(layerIndex);
    });
    while (deck.length < count) deck.push(-1); // remainder passes
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.beams = deck.map((layerIndex) => {
      const target = layerIndex >= 0 ? layers[layerIndex] : null;
      const beam = new Beam(this.geometry, this.baseMaterial, target, layers, glows);
      scene.add(beam.mesh);
      return beam;
    });
  }

  setReducedMotion(on) {
    for (const beam of this.beams) beam.reducedMotion = on;
  }

  update(dt, t) {
    for (const beam of this.beams) beam.update(dt, t);
  }
}

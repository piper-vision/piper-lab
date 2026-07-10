// All scene tuning lives here.
export const CONFIG = {
  background: 0x04060c,

  scroll: {
    // extra smoothing applied to scroll -> repair each frame (lower = lazier)
    smoothing: 0.055,
  },

  camera: {
    fov: 50,
    distance: 8.4,
    driftAmpX: 0.75,
    driftAmpY: 0.42,
    driftSpeed: 0.05,
    parallaxX: 0.65,
    parallaxY: 0.42,
    parallaxEase: 0.045,
  },

  orb: {
    seed: 1337,
    count: 1500,
    countMobile: 750,
    surfaceFraction: 0.68,     // rest are interior points
    radii: { x: 2.35, y: 2.35, z: 2.35 }, // clean sphere — resolves to a circle on screen
    corruptRadius: 2.55,       // rough sphere the corrupted anchors sit on
    corruptStretch: 0.35,      // asymmetry of the corrupted base form

    // spikes: clusters of nodes pulled outward in the corrupted state
    spikeClusters: 9,
    spikePow: 9.0,             // angular tightness of each spike group
    spikeAmp: 2.6,

    // procedural corruption displacement (shader)
    noiseAmp: 1.05,            // large slow folds
    noiseAmp2: 0.42,           // finer turbulence
    jitter: 0.05,              // high-frequency shake
    corruptFlow: 0.22,         // ambient drift while corrupted
    cleanFlow: 0.07,           // subtle residual motion when repaired
    staggerSpan: 0.5,          // per-node repair offset (0 = all at once)

    // connections
    connectRadius: 0.52,
    maxDegree: 3,
    maxSegments: 2600,
  },

  points: {
    size: 0.038,
    baseBrightness: 0.55,
    colorCalm: 0xbdf3ff,       // repaired: calm cyan-white
    colorHot: 0xffffff,        // corrupted flashes
    colorCyan: 0x59e6ff,
  },

  lines: {
    alphaClean: 0.13,
    alphaCorrupt: 0.24,
    pulseAlpha: 0.85,
    pulseRateClean: 0.22,      // how often signals fire when repaired
    pulseRateCorrupt: 0.9,     // ...and while corrupted
  },

  dust: {
    count: 320,
    countMobile: 140,
    radiusMin: 14,
    radiusMax: 42,
    color: 0x3fd9ff,
    alpha: 0.28,
  },

  fog: { near: 6.0, far: 20.0 }, // depth fade applied in the shaders

  bloom: {
    strength: 0.8,
    strengthMobile: 0.5,
    radius: 0.55,
    threshold: 0.3,
  },
};

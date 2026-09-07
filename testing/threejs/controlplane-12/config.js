// Tuning knobs for the glass-ribbon scene. Plain global so it can be edited
// without touching the module code.
window.CONFIG = {
  colors: {
    bright: 0x5ce5df,
    dark:   0x003732,
    mid:    0x007d6e,
  },

  background: {
    scale: 1.1,        // noise frequency across the view (lower = bigger blobs)
    speed: 0.05,       // how fast the gradients drift
    warp: 2.0,         // domain-warp strength (organic swirl amount)
    octaves: 3,        // fewer octaves = softer, less veiny
    brightAmount: 0.9, // how much of the light aqua shows through
    vignette: 0.5,     // darkening toward the edges (0 = none)
  },

  // Ribbon: one wide band of glass triangles running into the distance, flowing toward the camera.
  ribbon: {
    rows: 60,           // rows of triangles across the ribbon (its left-right width)
    edgeFadeStart: 0.3, // fraction of the half-width where the side rows start fading into the gradient (1 = hard edges)
    edgeFadePower: 1.6,
    fadeDepth: [7, 19],   // camera distance (world units) where the band starts / finishes fading into the background
    length: 40,         // world units the strip spans (runs from behind the camera to beyond the fade)
    segment: 0.55,      // base length of each triangle along the ribbon
    width: 0.28,        // height of each triangle row (total ribbon width = rows * width)
    extrude: 0.035,     // how thick each triangle prism is
    bevel: 0.014,       // bevel size (sub-pixel bevels alias badly; FXAA covers ~1px)
    gap: 0.008,         // seam between neighbouring triangles
    flowSpeed: 0.56,    // units/s the triangles travel toward the camera

    // Shape: one broad arch (rises then falls across the view) that slowly breathes, plus a faint secondary ripple.
    waveAmp: 1.1, waveFreq: 0.14, waveSpeed: 0.1, wavePhase: 1.2,
    wave2Amp: 0.25, wave2Freq: 0.4, wave2Speed: 0.25,
    growth: 0.0,        // 0 = even amplitude; >0 makes the arch grow toward the right

    // Depth wobble and roll about the flow direction (the "ribbon" twist).
    depthAmp: 0.35, depthFreq: 0.15, depthSpeed: 0.15,
    twistAmp: 0.25, twistFreq: 0.18, twistSpeed: 0.2,

    drift: 0.3, driftSpeed: 0.12, // slow vertical wander of the whole ribbon

    // Placement of the whole band in the scene.
    tiltX: 0.1,         // radians about X: small positive lifts the far end so it sits near the horizon
    yaw: -1.5708,       // -90 deg: the band runs into the depth; local +x (flow) points at the camera
    position: [0, -2.2, 0],
  },

  // Triangles occasionally lift off the ribbon and settle back.
  breakaway: {
    enabled: false,
    interval: [1.5, 4.0], // seconds between bursts (random in range)
    count: [1, 5],        // triangles per burst (random in range, inclusive)
    stagger: 0.6,         // max random delay within a burst so they don't move in lockstep
    distance: [0.6, 1.1], // how far a triangle lifts along the ribbon normal (random in range)
    lateral: 0.2,         // sideways drift while away
    tilt: 0.25,           // radians of tilt while away
    outDuration: 1.6,     // seconds to leave
    holdDuration: [1.2, 3.0], // random hold range
    backDuration: 2.0,    // seconds to return
  },

  glass: {
    mode: 'fake',      // 'real' = physically-based transmission (expensive); 'fake' = plain transparency + reflections (looks near-identical on this flat band)
    fakeOpacity: 0.55, // body opacity in fake mode (rows still fade toward the edges on top of this)
    fakeTint: 0x063d38, // body colour in fake mode: dark teal so diffuse light does not wash it out; the sheen comes from clearcoat/env reflections
    ior: 1.55,
    thickness: 0.6,    // ribbons are thin, so keep the simulated volume thin too
    dispersion: 9,     // chromatic split at the edges (safe to go high: only the gradient is refracted)
    roughness: 0.22,   // body roughness blurs the refraction; clearcoat keeps surface highlights sharp
    transmissionScale: 0.5, // refraction buffer resolution multiplier (0.5 = quarter the pixels; the roughness blur hides it)
    iridescence: 0.7,
    envIntensity: 0.45, // a flat band at grazing angles reflects the env hard; keep this modest
    tint: 0xffffff,
    attenuation: 0xbff5f1, // colour the body takes on as light travels through it
    attenuationDistance: 3.5,
  },

  bloom: {
    threshold: 1.6,    // luminance (linear, pre-tonemap) above which pixels glow
    strength: 0.3,     // how much glow is added back
    passes: 3,         // blur iterations at half resolution (wider glow per pass)
  },

  camera: { fov: 38, distance: 4.5, lookAtY: -1.1 }, // lookAtY < 0 pitches the view down onto the band
  exposure: 1.05,

  // Performance: fixed costs plus adaptive resolution. The renderer starts at
  // maxPixelRatio and steps down toward minPixelRatio while frames run slower
  // than targetFrameMs (Retina laptops with integrated GPUs need this).
  quality: {
    msaa: 4,             // MSAA samples on the HDR scene target (FXAA covers the rest)
    maxPixelRatio: 1.5,
    minPixelRatio: 0.75,
    targetFrameMs: 20,   // ~50 fps; drop resolution while slower than this
    stepEverySec: 1.5,   // how long to average before each step
  },
};

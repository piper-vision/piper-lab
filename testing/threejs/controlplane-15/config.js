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
    waveDwell: 5.0,     // 1 = plain sine; higher = the surface lingers near its crest (close to camera) and dips briefly
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
    fakeOpacity: 0.8,  // body opacity in fake mode (rows still fade toward the edges on top of this); higher = richer, less background bleed
    fakeTint: 0x021c19, // body colour in fake mode: very dark teal (darker = the shaped env lights read stronger against it)
    ior: 1.55,
    thickness: 0.6,    // ribbons are thin, so keep the simulated volume thin too
    dispersion: 9,     // chromatic split at the edges (safe to go high: only the gradient is refracted)
    roughness: 0.22,   // body roughness blurs the refraction; clearcoat keeps surface highlights sharp
    clearcoatRoughness: 0.2, // sharpness of surface glints. 0.04 let the directional lights clip into pure-white blobs; 0.2 keeps them as soft highlights
    transmissionScale: 0.5, // refraction buffer resolution multiplier (0.5 = quarter the pixels; the roughness blur hides it)
    iridescence: 0.7,
    envIntensity: 1.0,  // overall reflection strength
    washColor: [0.06, 0.14, 0.13], // linear HDR colour of the ambient env sphere: edge-free base sheen (too high = washed out / frosted)
    tint: 0xffffff,
    attenuation: 0xbff5f1, // colour the body takes on as light travels through it
    attenuationDistance: 3.5,
  },

  bloom: {
    threshold: 1.6,    // luminance (linear, pre-tonemap) above which pixels glow
    strength: 0.3,     // how much glow is added back
    passes: 3,         // blur iterations at half resolution (wider glow per pass)
  },

  motion: { paused: false },

  // Hover ripple: the triangle under the cursor and its neighbours lift along
  // the band's normal with a gaussian falloff, easing in and out so the wave
  // trails the pointer.
  hover: {
    enabled: true,
    radius: 0.35,      // falloff radius in world units (band rows are 0.28 apart): ~the hovered triangle + one ring of neighbours
    lift: 0.28,        // peak lift at the cursor, world units
    ease: 7,           // lift easing rate per second (higher = snappier, lower = more swell)
    follow: 18,        // how quickly the ripple centre glides after the cursor (per second)
    pickRadius: 0.6,   // outer cap (NDC) on the nearest-point search; the real hover test is cell-relative
  },

  // Directional lights (outside the env map). Their sharp clearcoat specular
  // shows as small glints on facets that happen to align; keep them modest and
  // palette-matched. Presets override these.
  sun: {
    key: { color: 'ffe0b0', intensity: 0.6 },
    rim: { color: '9fe8ff', intensity: 0.5 },
  },

  // Legibility fade behind the logo / H1 / bottom-left copy, rendered in the
  // final composite shader (float precision + dither = no banding, and it is
  // part of the canvas so stills/exports include it). Geometry from the
  // design's fade.svg: a blurred circle off the left edge at mid-height.
  fade: {
    enabled: true,
    color: '0C3838',   // hex, no '#'
    opacity: 0.73,     // James's tuned value
    size: 88,          // circle diameter as % of the frame width (svg was 127)
    x: 5,              // centre, % of frame width
    y: 55,             // centre, % of frame height (svg: 429 / 779)
    blur: 12.5,        // edge softness as % of the frame width (svg: 138px blur on 1035px)
  }, // freeze everything (ribbon flow, waves, twist, background drift); Space or the panel toggles it

  // Tilt-shift depth of field: sharp band around a horizontal focus line, blurring
  // progressively toward the bottom (near triangles) and top (far end).
  dof: {
    enabled: true,
    focus: 0.5,        // focus line as a fraction of screen height (0 = bottom, 1 = top)
    width: 0.08,       // half-height of the fully sharp band
    feather: 0.35,     // how far beyond the band the blur takes to reach full strength
    near: 1.0,         // blur strength below the focus line (0..1)
    far: 1.0,          // blur strength above the focus line (0..1)
    clampHighlights: 1.6, // cap HDR values before the DoF blur (1 = white); stops blurred speculars becoming glowing blobs. 0 = off
  },

  camera: { fov: 38, distance: 4.0, height: -0.6, lookAtY: -1.5 }, // height = camera y (band sits around y -2.2); lookAtY < 0 pitches the view down onto the band
  exposure: 1.05,

  // Performance. Render resolution is fixed: the device pixel ratio capped at
  // maxPixelRatio (adaptive step-down was removed at James's request).
  quality: {
    msaa: 4,             // MSAA samples on the HDR scene target (FXAA covers the rest)
    maxPixelRatio: 2,    // cap on device pixel ratio (2 = full Retina)
    // Frozen frames (Space / panel Motion) render as stills at higher quality:
    stillSupersample: 2,   // native device pixel ratio x this (2 = 4x the pixels, downscaled = clean bevel lines)
    stillPixelRatio: 4,    // hard cap on the still pixel ratio
    stillMaxPixels: 9e6,   // cap on rendered pixels for a still (GPU memory guard: ~9 MP is a few hundred MB of targets)
  },
};

// Tuning knobs for the glass-sphere scene. Plain global so it can be edited
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

  // Sphere: an icosphere whose faces are the extruded glass triangles.
  sphere: {
    radius: 1.9,        // sphere radius
    detail: 3,          // icosphere subdivision: faces = 20 * (detail + 1)^2 (3 -> 320 triangles)
    extrude: 0.045,     // how far each triangle stands proud of the sphere
    bevel: 0.02,        // bevel size on each prism (sub-pixel bevels alias badly)
    gap: 0.012,         // seam between neighbouring triangles
    core: false,        // solid glass sphere inside (off so the undulating shell reads as loose triangles)
    spinSpeed: 0.22,    // rad/s about Y
    tumbleAmp: 0.18,    // rad of slow X tumble
    tumbleSpeed: 0.25,
    tiltX: 0.35,        // resting tilt so the poles are not dead-on
    tiltZ: -0.15,
    floatAmp: 0.12,     // vertical bob
    floatSpeed: 0.6,
    position: [0, 0, 0],

    // Each triangle slides in/out along its own radial direction.
    undulate: {
      amp: 0.45,        // max radial travel (world units)
      freq: 2.4,        // spatial frequency of the wave field over the sphere (higher = choppier)
      speed: 0.7,       // how fast the field evolves
      jitter: 0.35,     // 0 = pure smooth waves, 1 = every triangle on its own random rhythm
    },
  },

  glass: {
    ior: 1.55,
    thickness: 1.8,    // simulated glass volume for the refraction
    dispersion: 9,     // chromatic split at the edges (safe to go high: only the gradient is refracted)
    roughness: 0.22,   // body roughness blurs the refraction; clearcoat keeps surface highlights sharp
    transmissionScale: 0.5, // refraction buffer resolution multiplier (the roughness blur hides the loss)
    iridescence: 0.7,
    envIntensity: 1.2,
    tint: 0xffffff,
    attenuation: 0xbff5f1, // colour the body takes on as light travels through it
    attenuationDistance: 3.5,
  },

  bloom: {
    threshold: 1.3,    // luminance (linear, pre-tonemap) above which pixels glow
    strength: 0.45,    // how much glow is added back
    passes: 3,         // blur iterations at half resolution (wider glow per pass)
  },

  camera: {
    fov: 38, distance: 10, lookAtY: 0,
    zoom: {
      min: 0.15,       // closest the camera can get to the look-at point (well inside the sphere)
      max: 30,         // furthest out
      speed: 0.0012,   // zoom per wheel pixel (exponential, so it feels even at all distances)
      smoothing: 0.1,  // 0-1 per frame easing toward the target distance
    },
  },
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

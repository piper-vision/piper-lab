// ---------------------------------------------------------------------------
// Central tuning knobs for the data-filter scene.
// An intelligent filtering system: streams of light descend from above and
// are selectively stopped by three translucent triangular control layers.
// All look/feel adjustments live here — colours, layer geometry, filter
// ratios, beam behaviour, camera choreography and post settings.
// ---------------------------------------------------------------------------

export const CONFIG = {
  colors: {
    background: '#020202',  // near-black, inverse-tonemapped at startup
    beam: '#D9D9D9',        // filament body — silver-white
    beamCore: '#FFFFFF',    // hot centre of each filament
    slabTint: '#3C3C3C',    // dark satin slabs — enough albedo to catch light
    slabEmissive: '#000000',
    edge: '#C9C9C9',        // rim line — stays below the bloom threshold so
                            // the edges never glow or flicker
  },

  // The three control layers, TOP (smallest, highest) → BOTTOM (largest,
  // lowest). Horizontal slabs whose triangular plan points toward the camera.
  // Concentric — all three share the same vertical axis, like the reference.
  layers: [
    { side: 3.0, y:  0.8, x: 0, z: 0 },
    { side: 3.95, y:  0.0, x: 0, z: 0 },
    { side: 4.9, y: -0.8, x: 0, z: 0 },
  ],
  slab: {
    thickness: 0.085,
    cornerRadius: 0,         // sharp corners
    // Near-black satin solid — definition comes from the white rim light and
    // a faint sheen off the dark studio environment.
    roughness: 0.3,
    emissiveIntensity: 0,
    envIntensity: 0.9,
    surfaceTintOpacity: 0,   // no top-face wash in the dark look
    // Hairline rim along the top perimeter — a flat mitred ring, so the
    // corners stay geometrically sharp (tubes gap at the vertices).
    // No halo, no additive blend, no shimmer: a clean constant line.
    rimWidth: 0.014,
    // The back edge is seen at a much more grazing angle — a wider strip
    // keeps it above a pixel on screen so it can't shimmer while floating.
    rimBackWidth: 0.036,
    rimOpacity: 1.0,
    // Very slow float. Metres and radians — keep tiny.
    bobAmplitude: 0.035,
    bobPeriod: [11, 14, 17],    // seconds, per layer
    shimmerAmount: 0.18,        // edge opacity oscillation fraction
  },

  // FILTERING ---------------------------------------------------------------
  // Each beam slot is dealt an outcome from this deck up front so the
  // behaviour is deliberate and the distribution exact, not random chaos.
  filter: {
    stopAtLayer1: 0.35,
    stopAtLayer2: 0.25,
    stopAtLayer3: 0.20,
    pass: 0.20,
  },

  beams: {
    countDesktop: 42,
    countMobile: 24,
    columnTop: 8.0,        // world y where the shader column ends (offscreen)
    columnBottom: -6.0,    // world y where the shader column ends
    spawnY: [4.6, 6.4],    // heads start just above the visible frame edge
    topFade: [5.2, 7.6],   // beams materialise between these heights
    bottomFade: [-1.7, -3.8], // successful beams dissolve between these
    exitY: -5.4,           // recycle once the tail crosses this
    footprintMargin: 0.8,  // beams land within this fraction of a layer's triangle
    speed: [0.75, 1.5],    // world units / s — calm, meditative
    length: [2.2, 3.8],
    halfWidth: [0.012, 0.026],
    // Wide spread — some filaments barely-there, some blazing.
    brightness: [0.15, 0.85],
    respawnDelay: [0.4, 2.4],
    initialStagger: 2.5,   // first-load spread so streams don't start in sync
    // Approach behaviour just above a blocking layer.
    slowDistance: 0.7,     // world units over which the head brightens
    approachBoost: 1.5,    // extra head glow at the moment of contact
    drainFade: 0.9,        // brightness fade time while the filament drains
    // Gentle per-beam breathing.
    pulseAmount: 0.16,
    pulseSpeed: [0.3, 0.8],
    // Occasional brighter successful beam.
    heroChance: 0.3,       // per pass-beam cycle
    heroBrightness: 1.5,
    heroWidth: 1.3,
  },

  glows: {
    impactRadius: [0.65, 0.95],
    impactIntensity: 0.4,
    impactAttack: 0.16,     // s to full brightness
    impactDecay: 1.4,       // s fade
    pierceRadius: 0.55,     // grid reveal where a successful beam crosses a slab
    pierceIntensity: 0.3,
    // Light touching a slab reveals its surface mesh: a world-aligned grid,
    // light red where the beam is blocked, green where it passes through.
    gridCell: 0.15,         // world units between grid lines
    gridLineWidth: 0.005,
    // Near-white with a whisper of the outcome colour (red = blocked,
    // green = passed) so the monochrome look holds.
    blockedColor: '#FFDCD2',
    passColor: '#E4FFD6',
  },

  camera: {
    fov: 32,
    distance: 10.2,
    elevation: 0.42,       // rad above the horizon — reveals slab tops + spacing
    // Orbit pivot is the middle slab centre; looking slightly above it drops
    // the stack below screen centre, leaving negative space above.
    frameOffsetY: -0.35,
    fitHalfWidth: 2.9,     // kept in frame on narrow viewports
    maxFov: 50,            // portrait widens fov before dollying out
    maxAzimuth: 1.3,       // ±75° — cursor at the screen edge looks at the
                           // stack almost side-on
    maxElevationShift: 0.052, // ±3°
    maxTranslateY: 0.5,
    smoothTime: 0.6,       // s — critically damped pursuit of the cursor
    returnTime: 1.4,       // s — drift home after the cursor leaves
    autoOrbitPeriod: 52,   // s per revolution on touch devices
  },

  parallax: {
    // Fraction of the camera's world displacement each layer inherits,
    // top → bottom. Upper slab moves the most.
    factors: [0.095, 0.06, 0.035],
  },

  post: {
    bloomStrength: 0.35,
    bloomRadius: 0.5,
    bloomThreshold: 0.65,  // dark scene — beams, rims and grids all breathe
    exposure: 1.0,
  },

  quality: {
    desktop: { dprCap: 1.75, tubeSegments: 96 },
    mobile:  { dprCap: 1.35, tubeSegments: 48 },
  },

  reducedMotion: {
    speedScale: 0.35,
    disableParallax: true,
    disableBob: true,
    disablePulse: true,
  },
};

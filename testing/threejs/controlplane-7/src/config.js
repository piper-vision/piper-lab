// All tuning knobs for the Particle Stream scene. Colors are CSS hex strings.
export const CONFIG = {
  colors: {
    background: '#000404',
    particle:   '#5fe9e4',  // small flowing points
    node:       '#cffffa',  // larger bright nodes
    line:       '#2fa8a4',  // plexus connections
  },

  camera: {
    fov: 45,
    z: 14,              // orbit radius
    yaw: 0.5,           // resting azimuth (rad) so the view isn't straight on
    pitch: 0.16,        // resting elevation (rad), looking slightly down
    sway: {             // slow wander around the resting angle
      yawAmp: 0.3, yawFreq: 0.11,
      pitchAmp: 0.09, pitchFreq: 0.07,
    },
    parallax: 0.9,      // how far (world units) the camera eases toward the cursor
    parallaxEase: 2.5,  // per-second lerp rate
    // mouse control (left-drag orbit/rotate, right-drag pan, wheel zoom).
    // The cinematic sway/parallax drives the camera until the first grab.
    // Note: with wheelZoom on, scrolling over the canvas zooms instead of
    // scrolling the page, and any wheel event permanently ends the
    // cinematic camera — set false if that matters for an embedded hero.
    controls: {
      damping: 0.08,
      minDistance: 5,
      maxDistance: 40,
      wheelZoom: true,
    },
  },

  // the stream: a narrow vertical cylinder of particles scrolling bottom->top.
  // Every particle moves at the same speed so the plexus links (precomputed in
  // cylinder space, wrap-aware) stay valid; a slow swirl + per-particle drift
  // keep it organic. Ends fade to black (invisible with additive blending).
  stream: {
    radius: 0.7,          // ~an inch on screen at camera.z 14
    height: 17,           // scroll wrap length; visible frustum is ~11.6 tall
    speed: 1.4,           // upward flow, units/s
    particleCount: 1300,
    particleSize: 0.07,
    nodeCount: 90,        // random particles promoted to bright nodes
    nodeSize: 0.16,
    linkDistance: 0.55,   // plexus: connect particles closer than this
    maxLinksPerParticle: 3,
    lineOpacity: 0.4,
    edgeFade: 2.6,        // fade-to-black length at the top/bottom ends
    swirl: 0.1,           // rad/s rotation of the whole stream around Y
    // organic snake: lateral displacement of the whole column as a function
    // of height and time (two axes at different frequencies so it never loops)
    wave: {
      ampX: 0.55, freqX: 0.5,  speedX: 0.45,
      ampZ: 0.4,  freqZ: 0.34, speedZ: 0.3,
    },
    drift: { amp: 0.11, freq: 0.9 },   // per-particle lateral wander
    twinkle: { amp: 0.3, freq: 1.6 },  // node brightness pulse
  },

  // particle-edge wireframe cubes riding alongside the flow, tumbling as
  // they rise. They flank the column (never inside it) but still track its
  // snaking wave so they read as carried by the same current.
  cubes: {
    count: 6,
    minSize: 0.42,
    maxSize: 0.8,
    sideMin: 1.35,        // flank distance from the stream axis...
    sideMax: 2.4,         // ...cube centres spawn in this ring
    speedMult: { min: 0.75, max: 1.05 }, // per-cube share of stream.speed
    pointsPerEdge: 6,
    pointSize: 0.06,
    cornerSize: 0.13,
    lineOpacity: 0.4,
    spinMax: 0.5,         // rad/s upper bound per axis (random per cube)
    margin: 1.2,          // spawn/despawn distance beyond the stream ends
  },

  // soft additive beam behind the stream so it reads as a column of light
  beamGlow: {
    color: '#178f96',
    width: 4.5,
    heightFraction: 0.75, // of stream.height
    opacity: 0.32,
    pulse: { amp: 0.12, freq: 0.5 },
  },

  // sparse background dust, drifting up at a fraction of the stream speed
  dust: {
    count: 110,
    spreadX: 9,
    spreadY: 13,          // half-extents of the dust box
    spreadZ: 5,
    size: 0.05,
    opacity: 0.4,
    riseFraction: 0.12,   // of stream.speed
  },
};

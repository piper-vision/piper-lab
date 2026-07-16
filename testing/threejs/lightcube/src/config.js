// All tuning knobs for the light-cube scene.
export const config = {
  grid: {
    strandsX: 39,          // strands along x (odd → strand on the centre line)
    strandsZ: 39,          // strands along z (depth)
    pointsY: 57,           // light points per strand (odd → row at eye level);
                           // 56 × 0.42 ≈ 38 × 0.62 so the volume is a true cube
    spacingXZ: 0.62,       // distance between strands
    spacingY: 0.42,        // distance between points on a strand
    jitterXZ: 0.03,        // small horizontal irregularity per strand
    jitterY: 0.05,         // vertical irregularity per point
  },

  points: {
    color: '#e9e9f0',      // dim-point tone (near-neutral white)
    brightColor: '#ffe9c0',// bright-sparkle tone (warm gold-white)
    exposure: 2.6,         // global brightness multiplier
    sizeBase: 48.0,        // shader point size scale (world → px)
    sizeMin: 2.2,          // floor on projected point size (px, at dpr 1) —
                           // keeps the deep field visible so it stacks bright
    sizeMax: 76.0,         // clamp on projected point size (px, at dpr 1)
    dimMin: 0.16,          // brightness range for ordinary points
    dimMax: 0.6,
    brightFraction: 0.09,  // share of points that are bright sparkles
    brightMin: 0.9,
    brightMax: 2.2,
    spikeThreshold: 0.55,  // brightness above which star spikes appear
    twinkleSpeed: 0.9,     // ordinary shimmer rate
    flareSpeed: 0.13,      // rate of slow roaming flare events on sparkles
    nearFade: [0.3, 1.0],  // fade points this close to camera (start, full)
    farFade: [26.0, 48.0], // distance fade (start, black) — keep the far
                           // side visible so it stacks into a bright core
  },

  strings: {
    color: '#6f7890',
    opacity: 0.1,
  },

  coreGlow: {
    // fake lens-bloom blaze around the vanishing point (no postprocessing)
    color: '#ffe2b0',
    scaleX: 11.0,
    scaleY: 3.2,
    opacity: 0.55,
  },

  interaction: {
    panX: 0.9,             // how far the camera pans toward the cursor (x)
    panY: 0.5,             // ... and vertically
    scrollStep: 0.011,     // world units per wheel deltaY unit (~1.1/notch)
    scrollMin: -9.0,       // deepest push into the cube (negative = inside)
    scrollMax: 30.0,       // furthest pull-back (whole cube in frame)
    ease: 5.0,             // smoothing rate (per second) for cursor pan
    zoomEase: 2.8,         // zoom smoothing rate; applied twice (S-curve),
                           // so the dolly starts and stops with no jolt
  },

  rotate: {
    // the cube spins slowly once you've pulled back far enough to see it
    startZoom: 7.0,        // zoom offset where rotation starts fading in
    fullZoom: 16.0,        // ... and is at full speed
    speed: 0.12,           // yaw rad/s at full speed
    tilt: 0.16,            // slight x-tilt at full pull-back (shows the top)
    tiltEase: 2.5,         // smoothing rate for the tilt
    settleSpeed: 0.4,      // hard cap (rad/s) on levelling speed — the cube
                           // can never snap, no matter how fast you scroll in
    settleEase: 1.2,       // proportional rate near level, for a soft landing
  },

  camera: {
    fov: 62,
    height: 0.0,           // y offset from grid centre
    distance: 0.9,         // how far outside the front face the camera sits
    driftX: 0.06,          // lateral sway amplitude (small, so the camera
                           // stays aligned with the centre strand column)
    driftZ: 0.55,          // push in/out amplitude
    cycleSeconds: 36,      // full drift loop
    lookAheadY: 0.0,
  },

  vignette: {
    // brightness falloff for points far above/below camera eye-line,
    // mimicking the photo's bright central band
    bandFalloff: 0.18,     // 0 = none
  },
};

// Central tuning knobs for the whole scene.

export const CONFIG = {
  // --- renderer ---
  maxPixelRatio: 1.75,

  // --- fog / atmosphere ---
  fogColor: 0x030304,
  fogDensity: 0.024,

  // --- cube field ---
  cubeSize: 3.6,
  gridCols: 11,          // along x
  gridRows: 10,          // along z
  gridSpacing: 4.8,
  gridJitter: 0.4,       // xz jitter per cell
  skipChance: 0.2,       // holes in the grid, keeps it "loose"
  farRise: 9.0,          // far rows climb so distant layers fill the frame
  heightSpread: 5.0,     // base y variation
  raisedChance: 0.2,     // some cubes float a level higher
  raisedLift: 3.2,
  scaleMin: 0.88,
  scaleMax: 1.12,

  // gentle floating motion
  bobAmplitude: 0.22,
  bobSpeedMin: 0.25,
  bobSpeedMax: 0.55,

  // --- camera rig ---
  camCenter: [0, -0.5, 0],
  camDistance: 26.5,
  camPitch: 0.65,        // radians above horizon (looking down across the field)
  camYaw: 0.0,
  camFov: 60,
  parallaxYaw: 0.05,     // mouse parallax strength
  parallaxPitch: 0.035,
  dragYawLimit: 0.3,     // drag rotation limits
  dragPitchLimit: 0.12,
  zoomMin: 0.82,
  zoomMax: 1.35,

  // --- continuous forward travel ---
  scrollSpeed: 0.55,             // world units/s the field drifts toward the camera

  // --- corruption cycle timing (seconds) ---
  corruptInDuration: 0.45,
  corruptedHold: [1.5, 2.0],     // random range while fully corrupted
  signalCount: [4, 6],           // sources per repair
  signalStagger: 0.18,
  signalTravel: 1.8,             // long streaking journeys from the outer field
  repairDuration: 1.25,
  idleBetween: [2.5, 4.5],       // pause before next corruption

  // corruption targets are picked from the middle of the scene
  middleArea: { xMax: 10, zMin: -9, zMax: 2 },
  // repair signals originate from far-away cubes in this distance ring
  signalSourceRange: [14, 40],

  // --- post-processing ---
  bloom: { strength: 0.85, radius: 0.55, threshold: 0.45 },
  dof: { aperture: 0.0022, maxblur: 0.008, focusLerp: 2.5 },

  // --- corruption look ---
  corruptDisplacement: 0.09,     // smooth swell amplitude as fraction of cube size
  corruptJitterPos: 0.025,       // whole-mesh positional jitter
  corruptJitterRot: 0.01,        // whole-mesh rotational jitter (radians)
  glowRadiusFalloff: 0.16,       // red light bleed onto neighbours
  glowStrength: 1.0,
};

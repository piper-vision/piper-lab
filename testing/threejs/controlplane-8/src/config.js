// Tuning knobs for the geodesic tile-sphere scene.
export const CONFIG = {
  sphere: {
    radius: 1.6,
    detail: 2,          // icosahedron subdivision: 1 = coarse, 2 = reference-like, 3 = dense
  },

  tiles: {
    gap: 0.06,          // 0..1 — how much each tile shrinks toward its centroid
    color: 0x0a0c10,
    opacity: 0.15,      // dark glass — the far side of the sphere shows through each tile
  },

  // Translucent octahedron at the sphere's core.
  core: {
    radius: 0.72,       // circumradius, in world units (sphere is 1.6)
    color: 0xd8dde4,    // neutral — lighting alone shades the faces
    opacity: 0.45,
    roughness: 0.35,
    metalness: 0.15,
    rim: { color: 0xffffff, opacity: 0.2 }, // faint edge outline
    // Light runners: bright heads with long fading tails that travel the
    // octahedron's edges, turning onto a new edge at each vertex.
    runners: {
      count: 3,
      speed: 0.5,       // world units/sec along the edges
      trailLength: 1.2, // tail length in world units (one edge ≈ 1.0)
      opacity: 0.9,     // head brightness (additive)
    },
    spin: { x: -0.03, y: 0.06 }, // independent slow tumble, radians/sec
  },

  rims: {
    color: 0xffffff,
    opacity: 0.9,       // outline brightness at full noise illumination
    // Flowing noise field that reveals the outlines: bright patches drift
    // around the shell; outside them the lines fall to `floor`.
    noise: {
      scale: 0.75,      // patch size — higher = smaller, busier patches
      speed: 0.18,      // how fast the field evolves
      drift: 0.1,       // radians/sec the field circulates around the sphere
      floor: 0.14,      // outline brightness where the noise is dark
      threshLo: 0.54,   // noise band mapped to dark → lit (0..1)
      threshHi: 0.82,
      // Camera-facing cap where the glow is suppressed (keeps the pyramid
      // view clear). Values are dot(surface dir, view dir): fade starts at
      // maskStart, fully dark by maskEnd (1 = dead center of the view).
      maskStart: 0.45,
      maskEnd: 0.8,
    },
  },

  // Small cubes drifting between the pyramid and the shell, each tethered
  // to the pyramid's center by a dotted line.
  cubes: {
    count: 10,
    seed: 7,            // change for a different random arrangement
    sizeMin: 0.09,
    sizeMax: 0.17,
    radiusMin: 1.0,     // placement band (pyramid is 0.85, shell is 1.6)
    radiusMax: 1.42,
    color: 0xd8dde4,
    opacity: 0.45,
    rim: { color: 0xffffff, opacity: 0.9 },
    spinMax: 0.5,       // max per-cube tumble speed, radians/sec
  },

  links: {
    color: 0xffffff,
    opacity: 0.45,
    dashSize: 0.035,
    gapSize: 0.028,
    flowSpeed: 0.07,    // world units/sec the dashes crawl toward the cubes
  },

  // Light pulses that travel outward from the pyramid along the tethers,
  // blooming the cube white on arrival.
  // One global cycle: pulses depart in positional order (top → bottom) and
  // each cube STAYS lit on arrival. Once all are lit they hold, fade out
  // together, rest, and the loop restarts.
  pulses: {
    interval: 0.9,      // seconds between one cube's pulse and the next
    travelTime: 1.4,    // seconds for a pulse to run core → cube
    hold: 1.4,          // seconds everything stays lit after the last arrival
    fadeTime: 1.6,      // seconds for the group fade-out
    rest: 0.8,          // dark pause before the loop restarts
    streakLength: 0.42, // as a fraction of the tether length
    color: 0xffffff,
    opacity: 0.95,      // streak brightness (additive, so it reads as light)
    glow: {
      attack: 0.3,          // seconds for a cube to ramp to full glow on arrival
      emissiveIntensity: 2.2,
      haloScale: 5,         // halo sprite size, multiples of the cube size
      haloOpacity: 1,
    },
  },

  // Black distance fog: darkens the far hemisphere so the back reads dimmer
  // through the glass. Offsets are in sphere radii from the sphere's center.
  depthFade: {
    nearOffset: -0.55,  // where fading starts (front of sphere ≈ -1)
    farOffset: 1.45,    // where it reaches full black (back of sphere ≈ +1)
  },

  spin: { x: 0.045, y: 0.1 },        // radians/sec auto-rotation
  parallax: { amount: 0.18, ease: 0.04 }, // pointer-follow tilt

  camera: { fov: 38, z: 5.2 },
  exposure: 1.4,
};

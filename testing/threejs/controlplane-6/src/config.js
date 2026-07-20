// All tuning knobs for the Hex Core scene. Colors are CSS hex strings.
export const CONFIG = {
  colors: {
    background: '#000404',
    particle:   '#5fe9e4',  // small drifting points
    node:       '#cffffa',  // larger bright nodes
    line:       '#2fa8a4',  // plexus / shell connections
    outline:    '#a4fff5',  // icosahedron edge outline + edge points
  },

  camera: {
    fov: 45,
    z: 24,              // orbit radius
    orbitSpeed: 0.18,   // rad/s around the scene (full circle ~35s)
    parallax: 1.1,      // how far (world units) the camera eases toward the cursor
    parallaxEase: 2.5,  // per-second lerp rate
  },

  // 1 - central icosahedron: particles sampled over the 20 faces (a fraction
  // filling the volume), plexus-linked, slowly tumbling on all three axes.
  ico: {
    radius: 2.7,
    particleCount: 620,
    particleSize: 0.075,
    interiorFraction: 0.35,   // share of particles pulled inside vs on the faces
    nodeCount: 46,            // random particles promoted to bright nodes
    nodeSize: 0.17,
    vertexSize: 0.22,         // the 12 polyhedron vertices
    edgePointsPerEdge: 14,    // points strung along the 30 outline edges
    edgePointSize: 0.08,
    linkDistance: 0.72,       // plexus: connect particles closer than this
    maxLinksPerParticle: 3,
    lineOpacity: 0.32,
    outlineOpacity: 0.75,
    drift: { amp: 0.075, freq: 0.55 },              // per-particle sinusoidal wander
    spin:  { x: 0.11, y: 0.16, z: 0.07 },           // rad/s per axis
  },

  // soft additive glow sprite sitting behind the hexagon so the centre reads
  // as a light source (the references' "blaze")
  coreGlow: {
    color: '#178f96',
    size: 10,
    opacity: 0.5,
    pulse: { amp: 0.12, freq: 0.5 },
  },

  // 2 - enclosing sphere: looser shell of nodes/particles, see-through.
  sphere: {
    radius: 5.4,
    particleCount: 950,
    particleSize: 0.095,
    nodeCount: 70,
    nodeSize: 0.2,
    jitter: 0.16,             // radial noise so the shell isn't a perfect ball
    linkDistance: 1.05,
    maxLinksPerParticle: 2,
    lineOpacity: 0.18,
    particleOpacity: 0.9,
    twinkle: { amp: 0.25, freq: 1.4 },              // node brightness pulse
    spin: { x: 0.015, y: -0.035, z: 0 },
  },

  // 3 - floating particle cubes scattered outside the sphere.
  cubes: {
    count: 16,
    minSize: 0.45,
    maxSize: 1.15,
    minDist: 6.4,             // spawn shell around the sphere
    maxDist: 10.5,
    pointsPerEdge: 7,
    pointSize: 0.07,
    cornerSize: 0.14,
    lineOpacity: 0.35,
    spinMax: 0.35,            // rad/s upper bound per axis (random per cube)
    drift: { amp: 0.5, freq: 0.12 },                // slow positional bob
    spreadCandidates: 14,     // spawn tries per cube; farthest-from-others wins
  },

  // cube journeys: every interval one cube flies at the core. Outcomes are
  // drawn from a shuffled bag of [pass, blocked, blocked] so exactly 1 in 3
  // gets through. Blocked cubes red-pulse the shell where they hit; passing
  // cubes green-flash the icosahedron. Dissolved cubes respawn outside.
  journey: {
    interval: 3,             // seconds between launches
    speed: 4.5,              // travel speed, units/s
    travelSpinMult: 2.5,     // cubes tumble faster while flying
    dissolveTime: 0.9,       // fade-out after impact/arrival
    respawnFade: 1.4,        // fade-in at the new spawn point
    pulseColor: '#FF6063',
    pulseRadius: 2.4,        // falloff radius of the red patch on the shell
    pulseTime: 1.0,
    pulseGlowOpacity: 0.25,  // peak opacity of the red cap glow on the shell
    flashColor: '#59E0AD',
    flashTime: 1.0,
  },

  // background dust for depth. Count 0 = disabled: with the camera orbiting
  // at radius 24, dust in a ±26 box flew right past the lens.
  dust: {
    count: 0,
    spread: 26,               // box half-extent
    size: 0.06,
    opacity: 0.5,
    spinY: 0.006,
  },
};

// All tunables for the rotating ControlPlane logo cube.
export const CONFIG = {
  background: '#000000',

  // One full 360° turn of both cube and logo, in seconds. Both spin at the
  // same rate in opposite directions, so the scene loops perfectly.
  loopSeconds: 10,

  camera: {
    fov: 16,          // narrow FOV ≈ near-orthographic, keeps the hexagon regular
    fitHeight: 1.6,   // world units visible vertically (logo is ~0.7 tall; 2.25 framed the cube)
    fitWidth: 1.6,    // minimum world width visible on portrait screens
  },

  cube: {
    visible: false,   // hide the cube (lines, haze, dots); the logo's view and spin are unchanged
    size: 1,
    opacity: 0.5,     // overall cube opacity (edges + face haze); 1 = original
    // 'face' = spin on the cube's own Y axis, pivoting on the centre of its
    // bottom face (the cube sits flat and turns like it's on a turntable,
    // seen from above). Or a world axis, e.g. [0,1,0] or [0,0,1].
    axis: 'face',
    direction: -1,    // -1 = clockwise seen from above
    // Edge line: core half-width and halo, in world units (cube is 1 wide).
    edgeStyle: { coreWidth: 0.0016, glowWidth: 0.012, glow: 0.3 },
    // Edge brightness per edge type. Silhouette = outer hexagon outline.
    edge: { silhouette: 1.0, front: 0.55, back: 0.38 },
    // Face haze: brightest along each face's border, fading to `base` inside.
    face: { base: 0.004, glow: 0.045, falloff: 0.13 },
    // Halftone dot screen on the faces (the "digital artifacts").
    dots: {
      count: 56,            // dots across each face
      radius: 0.22,         // dot radius as a fraction of the dot spacing
      brightness: 0.3,
      edgeFalloff: 0.16,    // dots are densest along face borders, fading inward
      edgeAmount: 0.4,
      patchAmount: 0.35,    // soft drifting patches of dots
      patchScale: 2.6,
      drift: 1.2,           // how far the patches wander per loop
    },
  },

  // Small rounded cubes that flicker on/off on the cube faces. Seeded and
  // keyed to the loop, so they repeat identically every loop.
  artifacts: {
    count: 0,             // events per loop (0 = off; replaced by cube.dots)
    maxCluster: 3,
    grid: 9,              // face grid the artifacts snap to (cells per side)
    size: [0.45, 0.85],   // cube size as a fraction of a grid cell
    cornerRadius: 0.14,   // rounding, as a fraction of the cube size
    lift: [0, 1],         // how far they sit out from the face (0 = straddling it)
    life: [0.35, 1.3],    // seconds each event is visible
    flicker: 0.14,        // seconds of on/off flicker at start and end
    stagger: 0.12,        // max delay between cubes in one cluster
    brightness: 0.55,
    seed: 7,
  },

  logo: {
    svg: './assets/logo.svg',
    width: 0.866,           // world width of the logo (cube is 1 wide)
    // The values below are in SVG units (the SVG is 209 wide).
    depth: 14,
    bevelThickness: 5,
    bevelSize: 4.5,
    bevelSegments: 8,
    // Stands upright on its bottom edge, spins on the cube's up axis
    // (pivot = centre of its bottom edge), opposite to the cube.
    direction: 1,           // +1 = anti-clockwise seen from above
    facing: 12,             // degrees turned at t=0 (right end of the bottom edge towards the viewer)
    // Halftone dots breaking off the logo's outline and hopping outward on
    // the dot grid. Seeded and keyed to the loop, so it repeats seamlessly.
    particles: {
      count: 0,             // 0 = off
      space: 'world',       // 'world' = dots stay put and the logo turns away from them; 'logo' = they spin with it
      events: 35,           // fragments breaking off per loop
      cluster: [1, 4],      // dots per fragment
      clusterSpread: 5,     // fragment width, in halftone cells
      stagger: 0.15,        // seconds between dots of one fragment leaving
      life: [1.2, 3.2],     // seconds each dot lives
      distance: [0.04, 0.45], // how far out it travels (world units; logo is ~0.87 wide)
      spread: 1.1,          // radians of random spread around the outward direction
      hops: 9,              // discrete grid hops over its travel (fewer = more digital)
      size: [0.9, 1.8],     // dot radius relative to a halftone dot (rare larger ones)
      flicker: 0.18,        // seconds of on/off flicker at birth and death
      brightness: 0.9,
      seed: 3,
    },
    autoCenter: true,     // centre the whole loop's sweep in the frame
    pivot: 'center',       // 'center' (even swing) or 'bottomEdge' (middle of the bottom edge)
    lift: 0,                // raise/lower the logo along the axis (0 = centred in the cube)
    // 'wire' = drawn in the cube's style (glowing outlines, edge haze, halftone
    // dots); 'glass' = the frosted solid (material/halo settings below).
    style: 'glass',
    wire: {
      opacity: 0.9,         // overall logo brightness (cube uses cube.opacity)
      edge: { front: 1.0, back: 0.5 }, // outline brightness, near cap vs far cap
      hazeWidth: 6,         // how far the face haze reaches in from the outline (SVG units)
      faceGlow: 1.6,        // face haze strength relative to the cube's
      sideGlow: 0.035,      // brightness of the thin side walls
      bevel: 0.8,           // small edge rounding (SVG units)
    },
    halo: { blur: 9, opacity: 0 },    // glow around (not inside) the logo
    // Halftone dots on the glass logo (pitch/drift shared with cube.dots).
    glassDots: {
      enabled: true,
      brightness: 1.1, 
      radius: 0.3,
      edgeAmount: 0.75,     // dots densest near the outline
      patchAmount: 0.45,    // plus soft drifting patches
      hazeWidth: 10,        // how far in from the outline the dots reach (SVG units)
    }, // soft glow behind the logo (blur in SVG units)
    alwaysInFront: true,    // logo is drawn over the cube's front edges, like the reference
    material: {
      color: '#0e0e0e',
      emissive: '#000000',
      roughness: 0.5,
      clearcoat: 0.05,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.25,
      opacity: 0.4,         // see-through frosted body (the cube shows through)
      rim: 1.8,             // whiteness added at glancing angles (bevels, sides)
      rimOpacity: 0.6,      // extra opacity at glancing angles
      rimPower: 1.8,
      rimStart: 0.5,        // faces closer than this to face-on get no rim (keeps the flat faces dark)
    },
  },

  // Optional soft bloom on top of the edge halos (0 strength = pass off).
  bloom: { strength: 0, radius: 0.2, threshold: 1.0 },
  maxPixelRatio: 2,
};

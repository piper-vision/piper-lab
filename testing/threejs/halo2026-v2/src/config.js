// Halo H intro — all knobs live here.
// Rects are in the 1920x1080 design frame: [x, y, w, h] for
// left bar, middle-top, middle-bottom, right bar (traced from James' scenes 1-4).
window.HALO_CONFIG = {
  background: '#FFF8E6',
  yellow: '#E3FF00',

  // fit: uniform scale, centred (keeps proportions on any aspect).
  // edge: stretch to the viewport inside `margin` (bars touch the frame like scenes 3/4).
  scenes: [
    { mode: 'fit',  rects: [[728, 292, 71, 469], [924, 292, 71, 191], [924, 570, 71, 191], [1121, 292, 71, 469]] },
    { mode: 'fit',  rects: [[172, 361, 119, 330], [900, 361, 119, 134], [900, 557, 119, 134], [1629, 361, 119, 330]] },
    { mode: 'edge', rects: [[40, 40, 352, 1000], [784, 40, 352, 399], [784, 660, 352, 380], [1528, 40, 352, 1000]] },
    { mode: 'edge', rects: [[40, 40, 30, 1000], [945, 40, 30, 399], [945, 660, 30, 380], [1850, 40, 30, 1000]] },
  ],
  margin: 40,            // design px, used by 'edge' scenes

  // Background per scene (null = plain cream). Swaps in on each shape transition.
  backgrounds: [null, 'assets/bg-2.jpg', 'assets/bg-3.jpg', 'assets/bg-4.jpg'],
  bgSwitchAt: 0.0,       // 0 = new image as the move starts, 0.5 = mid-move, 1 = when it lands
  bgFade: 0.12,          // crossfade length (s), 0 = hard cut
  // Image motion: punches in with the same ease as the shapes, then keeps a slow push.
  bgMotion: {
    enterScale: 1.22,    // scale when the image arrives
    restScale: 1.04,     // scale when the shapes land (same ease + duration as the morph)
    drift: 0.025,        // slow zoom-in per second after landing
    // pan on arrival, % of viewport [x, y] per scene; settles to 0 with the ease
    pan: [null, [-5, 2], [5, 0], [0, -5]],
  },

  // 3D pre-intro (from iso-h, src/intro3d.js): floor lines draw, the bars pop up out of the floor as
  // the negative-space H in an isometric view, then the camera swings snappily round to look straight
  // down and the H lands as the flat artwork exactly on scene 1, where the DOM timeline takes over.
  // When enabled it replaces the DOM scale-in below.
  pre3d: {
    enabled: true,
    elevation: 41, azimuth: 43,      // iso camera (iso-h's view)
    viewWidth: 23, viewWidthPortrait: 17.5,   // visible world width in the iso view (bar width = 1); bigger = further away
    lineWidth: 0.56,                 // outline + floor line weight (CSS px); was 0.75
    gridDraw: 0.9, gridStagger: 0.14, gridFamilyDelay: 0.25,   // floor lines trim-path in
    popAt: 0.6, popStagger: 0.1, popDur: 0.55,                 // bars rise out of the floor (overshoot, settle)
    swingAt: 1.75,                   // camera starts swinging to flat (s)
    swingDur: 0.75,                  // swing length (s), the site's snappy ease; hands over when it lands
  },

  // Intro: each bar scales in on its own before scene 1.
  intro: {
    enabled: true,
    delay: 0.2,                // blank cream before the first bar
    order: [0, 1, 2, 3],       // left, middle-top, middle-bottom, right
    stagger: 0.08,             // gap between each bar starting (s)
    duration: 0.45,            // each bar's scale-in (s)
    axis: 'y',                 // 'y' grow tall, 'x' grow wide, 'xy' both
    // where each bar grows from: 'center' | 'top' | 'bottom' (for axis y)
    // middle halves grow outward from the crossbar gap
    origin: ['center', 'bottom', 'top', 'center'],
  },

  // timing (seconds)
  startHold: 0.4,        // hold on scene 1 before the first move
  hold: 0.4,             // hold on each scene
  move: 0.55,            // duration of each morph
  endHold: 0.4,        // hold on the final shape (with its image) before the image goes
  loop: false,           // true = replay the intro forever (no gallery)
  stagger: 0.0,          // per-bar delay (s) inside a move, 0 = all together

  // Finale: final image goes, the middle bars shorten, the end layout comes in over the 3D gallery.
  finale: {
    imageOut: 0.6,       // image zooms on and fades to cream (s), shape ease
    imageOutScale: 0.12, // extra zoom while it goes
    galleryAt: 0.35,     // bars + end layout start this far into the image-out (s)
    photosAt: -0.6,      // gallery photos start streaming this long after the image-out begins (s);
                         // negative = already moving behind the final image, so the fade reveals them
    // middle bars shorten to frame the end layout (design px, from James' mock)
    rects: [[40, 40, 30, 1000], [945, 40, 30, 137], [945, 904, 30, 136], [1850, 40, 30, 1000]],
    barsAt: 0.0,         // bars start shortening this long after the gallery starts (s)
  },

  // 3D gallery. mode 'fall': photos drift slowly down at fixed depths (parallax).
  // mode 'approach': photos stream towards the camera (uses far/full/near/speed/width/clearAt below).
  gallery: {
    mode: 'approach',      // 'carousel' | 'fall' | 'approach'
    // carousel: photos on a slowly spinning 3D cylinder, tilted into a diagonal band (James' red mock)
    carousel: {
      center: [944, 499],  // design px (1920x1080) of the band's centre
      tilt: -18,           // band angle on screen (deg, negative = rising to the right)
      lean: 14,            // tip the cylinder so its far side shows above/below the front (deg)
      panel: [310, 280],   // photo size at the front (design px)
      gap: 28,             // space between photos (design px)
      strips: 10,          // slices per photo so it curves round the cylinder (more = smoother)
      count: 14,           // photos around the cylinder (more = bigger radius, flatter band)
      fade: [-0.3, 0.5],   // facing (cos) range over which photos go from the back opacity to full
      back: 0.35,          // opacity of photos on the far side of the cylinder (0 = hide the back)
      perspective: 2600,   // design px; smaller = stronger 3D
      speed: 9,            // degrees per second
    },
    fall: {
      speed: 0.06,         // screen heights per second at depth 1 (nearer photos fall faster)
      // near: big, full opacity, in front. far: a few small faded ones behind, for depth.
      layers: [
        // lanes: true = fall only down the gaps between the text columns, sized to fill the gap
        { count: 3, depth: [1.0, 1.0], width: [0.3, 0.38], opacity: 1, lanes: true, fill: 0.92 },
        { count: 3, depth: [2.4, 3.0], width: [0.3, 0.4], opacity: 0.3, behindText: 0 },   // fade away behind text
      ],
      lanePad: 0.012,      // space kept between lane photos and the text (screen widths)
      minLane: 0.1,        // narrower gaps than this (screen widths) are not used
      jitter: 0.6,         // how far photos wander from their even left-to-right slots
      behindText: 1,       // photo opacity while behind the text (1 = no dimming)
    },
    images: 16,          // assets/gallery/01.jpg .. 16.jpg
    count: 8,            // photos created (approach: 8, was 26, 20, 15; fall: sum of the layer counts, 6)
    seed: 7,             // change for a different arrangement
    far: 5.0,            // photos appear at this camera distance (1 = the H's plane) ..
    full: 3.3,           // .. are fully faded in by here ..
    near: 0.25,          // .. and loop back to far here (by then they're off-screen)
    nearFade: 0.2,       // fade out just before the loop point, in case one is still on screen
    speed: 0.3,          // camera distance covered per second (higher = faster approach)
    width: [0.508, 0.781], // photo width in screen widths at distance 1 (+25% three times on 0.26-0.4)
    portraitScale: 2,    // tall screens: photos grow by up to this
    clearAt: 3.4,        // photos never pass behind the end layout text from this distance in (bigger = stricter)
    textPad: 0.02,       // extra space around each text block (screen widths)
    candidates: 80,      // spots tried per photo, best spread wins
    depthWeight: 0.35,   // how much arrival time counts when spreading photos out
    revealStagger: 0.05, // first photos pop in one after another (s) ..
    // cursor steering: the camera slides towards the cursor so the stream drifts (near photos move most)
    // modular mode: modules per photo, how far apart in depth / sideways they fly, distance range where whole
    // lime squares flying in the stream among the photos: how many, size range (screen widths at d = 1);
    // overUI = they fly through (in front of) the text and buttons instead of keeping clear
    squares: { count: 12, size: [0.035, 0.08], overUI: false },   // false: behind the text (James), still flying straight through it
    // paper bend (3D Gallery): photos fly in like sheets of paper with their edges + corners bent back (bend = edge angle,
    // deg), flattening out by straightAt of the way through their fade-in; cols x rows tiles make the curve
    paper: { on: false, bend: 55, cols: 9, rows: 6, straightAt: 0.95 },   // off: James preferred flat photos
    // pieces: grid size, depth spread + sideways scatter + tilt (deg) + shrink while apart; assemble = [distance where they
    // start converging, distance where they've locked into the whole photo] (1 = the H's plane; photos appear at far 5)
    modular: { cols: 3, rows: 3, spread: 1.6, scatter: 1.6, spin: 16, shrink: 0.55, assemble: [5.0, 3.7] },
    steer: { shift: [0.06, 0.04], smooth: 2.5 },   // slide at the window edge (screen widths at d = 1); ease (1/s)
    // depth of field: soft far away, sharp through the middle, a little motion blur + stretch rushing past
    dof: { far: 3.5, near: 2, sharp: [0.9, 2.9], stretch: 0.08, stretchAt: 0.75 },   // blur px, sharp range (distance), stretch
    revealDur: 0,        // .. 0 = no pop: the field is already full behind the final image
  },

  // End layout (James' mock): comes in automatically as the intro ends, over the gallery,
  // which keeps streaming behind it.
  end: {
    at: -0.25,           // seconds after the gallery starts (negative = while the last image is still fading)
    stagger: 0.05,       // between pieces: logo, title lines, copy lines, buttons
    duration: 0.7,       // each piece slides up out of its mask
    title: ['Raising the bar', 'for temporary', 'structures.'],
    copy: ['People often think of us like architects', 'of adaptable space – a team of highly',
      'skilled designers, planners and', 'problem-solvers treating temporary', 'structures like they’re built to last.'],
    buttons: ['Start a project', 'See our work'],
    // gallery style switch (bottom-left): 3D Gallery = photos flying at the camera, Mouse Follow = photos trail the cursor
    // Modular = the 3D gallery, but each photo flies as separate modules that snap together as it nears
    // (Modular still works in code: add { key: 'modular', label: 'Modular' } to bring it back)
    modes: [{ key: 'gallery', label: '3D Gallery' }, { key: 'follow', label: 'Mouse Follow' }],
    nav: { links: ['The Halo Structure', 'What we offer', 'Company', 'Projects', 'News & Views'], cta: 'Contact' },
    // Layout options (design px in the 1920x1080 frame). Keys 0-8 or ?layout=N switch live.
    // Each block: x, y (top, or bottom with anchor:'bottom'), align left|center|right,
    // size = font size (w = width for the logo). Title lines may be ['text', indent px].
    // Bars: middle stubs fill y 40-177 and 904-1040 at x 945-975, so wide text lives in y 177-904.
    layout: 8,
    layouts: [
      { name: 'Mock: split columns',
        logo: { x: 130, y: 420, w: 500 },   // doubled from the mock (250), same centre line
        title: { x: 1025, y: 359, size: 110 },
        copy: { x: 131, y: 1046, anchor: 'bottom', size: 26 },
        buttons: { x: 1024, y: 1040, anchor: 'bottom', size: 20 } },
      { name: '1 Headline spread',
        logo: { x: 130, y: 90, w: 110 },
        meta: [{ text: '(01) Temporary structures', x: 1790, y: 100, align: 'right' }],
        title: { x: 130, y: 330, size: 150, lines: ['Raising the bar for', 'temporary structures.'] },
        copy: { x: 1025, y: 1046, anchor: 'bottom', size: 24 },
        buttons: { x: 130, y: 1040, anchor: 'bottom', size: 20 } },
      { name: '2 Monument logo',
        logo: { x: 130, y: 1040, anchor: 'bottom', w: 640 },
        meta: [{ text: 'Temporary structures', x: 130, y: 100 }],
        title: { x: 1025, y: 200, size: 92 },
        copy: { x: 1025, y: 600, size: 24 },
        buttons: { x: 1025, y: 1040, anchor: 'bottom', size: 20 } },
      { name: '3 Centred cover',
        logo: { x: 130, y: 90, w: 110 },
        meta: [{ text: 'Design — Planning — Problem-solving', x: 1790, y: 100, align: 'right' }],
        title: { x: 960, y: 300, size: 130, align: 'center', lines: ['Raising the bar for', 'temporary structures.'] },
        copy: { x: 960, y: 650, size: 24, align: 'center', lines: ['People often think of us like architects of adaptable space –',
          'a team of highly skilled designers, planners and problem-solvers', 'treating temporary structures like they’re built to last.'] },
        buttons: { x: 960, y: 800, size: 20, align: 'center' } },
      { name: '4 Staggered headline',
        logo: { x: 130, y: 90, w: 110 },
        meta: [{ text: '(01) Temporary structures', x: 1790, y: 100, align: 'right' }],
        title: { x: 130, y: 300, size: 140, lines: ['Raising the bar', ['for temporary', 430], ['structures.', 895]] },
        copy: { x: 130, y: 1046, anchor: 'bottom', size: 22 },
        buttons: { x: 1025, y: 1040, anchor: 'bottom', size: 20 } },
      { name: '5 Standfirst',
        logo: { x: 130, y: 90, w: 160 },
        meta: [{ text: 'Temporary structures', x: 1790, y: 100, align: 'right' }],
        title: { x: 130, y: 1040, anchor: 'bottom', size: 112, lines: ['Raising', 'the bar for', 'temporary', 'structures.'] },
        copy: { x: 1025, y: 230, size: 32, lh: 1.25 },
        buttons: { x: 1025, y: 1040, anchor: 'bottom', size: 20 } },
      { name: '6 Corners (with the carousel)',   // James' mock: assets/ref-end-2.webp
        logo: { x: 110, y: 40, w: 496 },
        // flipped (James): paragraph pushed over to the right, its right edge 41px in from the right bar
        // (mirroring the logo's 40px from the left bar); buttons line up under its left edge
        copy: { x: 1809, y: 968, anchor: 'bottom', size: 26, align: 'right', textAlign: 'left' },
        buttons: { x: 1809, y: 1040, anchor: 'bottom', size: 17.3, gap: 0.77, alignWith: 'copy' },
        // the R's ink lines up with the H of the logo (x 102.5 = 110 minus the R's side bearing)
        title: { x: 102.5, y: 1063, anchor: 'bottom', size: 104, ls: -0.05 } },   // ls: letter spacing (em), -5% as in Figma
      { name: '7 Centred headline (approaching gallery)',   // James' mock: assets/ref-end-3.webp
        // keepOut 0.5: photos may drift over the outer edges of the logo and headline (James is fine with that)
        logo: { x: 107, y: 40, w: 248, keepOut: 0.5 },
        title: { x: 962, y: 372, size: 114, ls: -0.05, lh: 0.87, align: 'center', keepOut: 0.5 },
        copy: { x: 1289, y: 968, anchor: 'bottom', size: 26 },
        buttons: { x: 1289, y: 1040, anchor: 'bottom', size: 17.3, gap: 0.77 },
        nav: { x: 1824, y: 38, size: 17, align: 'right' } },   // James' mock: assets/ref-end-4.webp
      { name: '8 Burger (small logo above the bar)',   // James' mock: assets/ref-end-5.webp
        logo: { x: 40, y: 40, w: 127, keepOut: 0 },   // keepOut 0: photos may pass behind the small corner UI (opens the diagonals)                     // sits above the left bar, aligned to its left edge
        burger: { x: 1880, y: 40, size: 52, align: 'right', keepOut: 0 },   // above the right bar, aligned to its right edge
        contact: { x: 1820, y: 40, size: 17, align: 'right', label: 'Contact us', keepOut: 0 },   // dark button just left of the burger, same height
        modes: { x: 110, y: 1040, anchor: 'bottom', size: 15, keepOut: 0 },   // gallery style switch, bottom-left
        title: { x: 962, y: 330, size: 142.5, ls: -0.05, lh: 0.87, align: 'center', keepOut: 0.5,
          // the three lines sit at different depths (design px, + = nearer); flat at rest, the cursor turns the stack
          depth: { z: [0, 0, 0], perspective: 1500, turn: [16, 10], smooth: 3 } },   // all lines on one plane; the cursor tilts the whole headline
        copy: { x: 1289, y: 968, anchor: 'bottom', size: 26 },
        buttons: { x: 1289, y: 1040, anchor: 'bottom', size: 17.3, gap: 0.77 },
        // outer bars drop to start below the logo + burger as the UI comes in
        bars: [[40, 125, 30, 915], [945, 40, 30, 137], [945, 904, 30, 136], [1850, 125, 30, 915]] },
    ],
  },

  // Strong in-out easing as a cubic-bezier. Lower x1 / higher y2 = snappier.
  ease: [0.8, 0, 0.1, 1],
};

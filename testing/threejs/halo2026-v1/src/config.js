// All tuning knobs for the iso-h hero. Units are world units; the bar width is
// 1 so everything else reads as "multiples of a bar width". Proportions are
// measured from the flat negative-space H artwork (bar = 170px of 2000x1125).
export const CONFIG = {
  // ---- look
  background: 0xfff8e6,      // cream of the flat artwork, used throughout
  yellow: 0xe5ff00,
  edgeColor: 0x151515,       // outline on every visible prism edge
  edgeOpacity: 0.7,          // lower = finer-looking outline (GL lines are always 1 device pixel)
  gridColor: 0x3a3a3a,       // thin dark floor line
  minDpr: 2,                 // render at least 2x so outlines are half a CSS pixel
  maxDpr: 2,
  clipBelow: 0.03,           // floor clip plane sits this far under y=0 (edge lines on the floor stay visible)
  clipAfterIntro: false,     // false = floor is transparent once the H has landed (tumbling bars can dip below the grid)

  // ---- camera (orthographic, "isometric" style)
  elevation: 41,             // degrees above the floor plane
  azimuth: 43,               // degrees around Y at the start; 45 = true diagonal
  orbitSpeed: 3,             // degrees per second the camera drifts around the H; 0 = static
  viewWidth: 13,             // visible world width on landscape screens (smaller = closer; the H is ~9.3 wide on the diagonal)
  viewWidthPortrait: 10.5,   // visible world width when the screen is taller than wide

  // ---- bars (the H is the gap between them: two full-length outer bars and a
  // middle bar split in two, all lying on the floor along Z)
  barWidth: 1,
  barHeight: 1.2,            // extrusion height
  barLength: 6.62,           // outer bars (1125 / 170)
  barSpacing: 2.78,          // centre-to-centre distance between neighbouring bars (472 / 170)
  middleGap: 1.22,           // the H's crossbar: gap between the two middle pieces (208 / 170)

  // ---- grid
  // four floor lines framing the H, derived from the bars (no spacing knob)
  gridDrawDuration: 0.9,     // seconds for one line to trim-path across the view
  gridDrawStagger: 0.14,     // seconds between successive lines of one family
  gridFamilyDelay: 0.25,     // second family starts this long after the first

  // ---- timeline (seconds from start)
  barsStart: 1.0,            // first bar launches; can overlap the tail of the grid draw
  barStagger: 0.12,          // between successive bars (left, middle far, middle near, right)

  // ---- physics (1-D vertical, gravity + a stiff spring floor)
  gravity: 40,
  popApex: 1.6,              // how far the bars overshoot above the floor
  floorStiffness: 3000,      // spring floor the bars can sink into (hidden by the clip plane)
  floorDamping: 40,
  airDrag: 0.12,             // per-second velocity loss, helps settle
  settleSpeed: 0.35,         // below this speed, near the floor, a bar is considered at rest

  // ---- hover tumble (active once the H has settled)
  tumbleFree: 0.5,           // seconds a kicked bar moves freely before being pulled back
  tumbleCooldown: 0.25,      // min seconds between kicks on the same bar
  kickUp: 3.0,               // upward velocity at full strength
  kickMinSpeed: 2.5,         // cursor must move faster than this (world units/s) to kick at all
  kickGain: 0.35,            // shove velocity = cursor speed (world units/s) * gain ...
  kickMin: 6,                //   ... clamped to this range (units/s)
  kickMax: 16,
  kickSpin: 4.0,             // rad/s tumble about the horizontal axis perpendicular to travel, at full strength
  kickYaw: 1.5,              // extra twist about vertical when hit near an end
  tumbleGravity: 6,          // light gravity during the free phase
  returnStiffness: 12,       // spring pulling position + rotation back to rest
  returnDamping: 4.2,        // lower = more overshoot on the way back
  collideBounce: 0.4,        // bar-on-bar restitution (0 = dead stop, 1 = fully elastic)
  collideSpin: 0.25,         // how much a bar-on-bar knock sets the bars tumbling
  floorFriction: 1.2,       // per-second slow-down of a bar sliding along the floor
  floorBounce: 0.3,        // a kicked bar that hits the floor bounces back up with this fraction of its speed

  // ---- scroll transition (progress 0..1 over the page's scroll distance)
  // scroll distance ~3.7 screens: swing 0.6 overlapping the start of the fly-through
  // (through the H ~0.4, then on through the photos ~2.9) so it is one continuous move
  scrollLength: 4.7,         // page height in screens; less = more camera movement per wheel step
  scrollSmooth: 6,           // how quickly the scene catches up with the scrollbar (1/s)
  faceEnd: 0.16,             // camera has swung face-on (flat H, no outlines) by here
  flyStart: 0.08,          // fly-through starts here, well before the swing ends, so the two blend
  flyEaseIn: 0.1,          // share of the fly-through spent picking up speed from rest
  flyEndFill: 0.8,           // at the end the view is this fraction of the crossbar gap (< 1 = screen fully cream)

  // ---- gallery (photos in depth behind the flat H, falling slowly; the fly-through passes them)
  // Units: 1 = the camera's distance from the H at the flat framing, and sizes
  // are in screen widths as they would look at the H's plane.
  galleryImages: 16,              // assets/gallery/01.jpg .. 16.jpg
  galleryCount: 22,              // photos to place (files repeat if more than 16); fewer = airier
  galleryCandidates: 80,          // spots tried per photo; the one furthest from the others wins (more = more even spread)
  galleryPortraitScale: 2,        // on tall screens photos grow by up to this (sizes are in screen widths)
  galleryAvoidBars: 0.5,          // how strongly photos avoid sitting behind the H's bars (0 = don't care, 1 = strongly)
  galleryHoldReveal: [0.03, 0.14],   // scroll range over which the hold photos start fading in, one by one (flat H is at ~0.16)
  galleryHoldRevealEach: 0.05,   // how much scroll each hold photo takes to fade in
  galleryLayers: [0.1, 0.6, 1.4, 2.6, 4.2],   // depth layers behind the H; on-screen fall speed is 1 / (1 + z), so ~4.5x from front to back
  galleryWidth: [0.18, 0.28],     // photo width range at the H's plane, before the depth adjustment below
  galleryDepthGrow: 0.5,          // deeper photos are scaled up by (1 + z)^this so they don't shrink to nothing (0 = pure perspective)
  galleryClear: 0.06,             // no photo comes closer than this to the centre line (the camera's path)
  galleryGap: 0,                  // extra space between photos at the flat framing (screen widths)
  galleryOverlap: 0.18,          // photos may overlap by up to this fraction of the smaller one's width or height (0 = never)
  gallerySpeed: 0.08,             // fall speed in screen heights per second at the H's plane (deeper layers fall slower on screen)
  gallerySpan: 1.45,              // photos loop over this many screen heights at the flat framing (more = sparser)
  galleryFog: [1, 5.2],           // camera distance where photos are fully solid .. most faded (flat view spans 1.1 .. 5.2)
  galleryFogMin: 0.3,           // opacity of the most distant photos
  galleryEndFade: 0.3,            // photos still on screen fade out over this last stretch of camera travel
  galleryNear: 0.04,              // a photo disappears once the camera is this close to it

  // flight photos: a bigger set lining the path behind the H, revealed only once you're through it
  galleryFlightCount: 20,        // files repeat (16 files)
  // spread along the path; the camera passes one at camera distance -z. The nearest
  // starts beyond reveal distance from where the camera clears the H, so none are
  // waiting to pop in together; they arrive one after another (~0.19 travel apart).
  // Runs past the end so the stream stays full to the last frame.
  galleryFlightDepth: [2.9, 6.6],
  galleryFlightWidth: [0.2, 0.32],// size in screen widths at camera distance 1
  galleryFlightReach: 0.65,     // photo centres stay within this distance of the path (so they're on screen when close)
  galleryFlightSpan: 1.1,        // fall loop height in screen heights
  galleryFlightDepthWeight: 1,    // how much depth counts when spreading them out (vs. sideways / vertical)
  galleryFlightReveal: [3, 1.3],  // camera distance where a flight photo starts fading in (faint, far off) .. is fully in
  galleryFlightGate: 0.3,         // camera travel after passing through the H over which flight photos are allowed in
  // ---- tagline ("Raising the bar for temporary structures."; text and type live in index.html)
  taglineStartDist: 0.68,        // camera distance where the first line starts (1 = flat H, ~0.12 = through it)
  taglineRevealTravel: 0.5,       // camera travel each line takes to tip into place
  taglineStagger: 0.2,          // camera travel between one line starting and the next
  taglineTilt: [-70, 12],         // starting rotation of each line: [tip back about X, turn about Y] in degrees

  // ---- end circle (yellow disc at the end of the path; fills the screen at the end of the scroll)
  circleFullAt: -5.05,            // camera distance where the circle has filled the screen; before flyEnd, so the hero ends on a short stretch of solid yellow
  circleEndDist: 0.15,            // camera's distance from the circle when it fills the screen (smaller = faster final rush)
  circleOverfill: 1.03,           // > 1 = it covers the corners with a little to spare at the end
  circleReveal: [4.8, 3.8],      // camera distance where the circle starts fading in (a small dot far ahead) .. is solid

  flyEnd: -5.5,                 // camera distance at the end of the scroll

  // ---- replay
  loop: false,               // true = replay automatically after `holdSeconds`
  holdSeconds: 4,
};

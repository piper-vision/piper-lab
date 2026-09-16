// All tuning knobs for the iso-hash hero. Units are world units; the bar
// width is 1 so everything else reads as "multiples of a bar width".
export const CONFIG = {
  // ---- look
  background: 0xe9e9e4,
  yellow: 0xe5ff00,
  edgeColor: 0x151515,       // outline on every visible prism edge
  edgeOpacity: 0.7,          // lower = finer-looking outline (GL lines are always 1 device pixel)
  gridColor: 0x3a3a3a,       // thin dark grid line
  minDpr: 2,                 // render at least 2x so outlines are half a CSS pixel
  maxDpr: 2,
  clipBelow: 0.03,           // floor clip plane sits this far under y=0 (edge lines on the floor stay visible)
  clipAfterIntro: false,     // false = floor is transparent once the # has landed (tumbling bars can dip below the grid)

  // ---- camera (orthographic, "isometric" style)
  elevation: 41,             // degrees above the floor plane
  azimuth: 43,               // degrees around Y at the start; 45 = true diagonal
  orbitSpeed: 3,             // degrees per second the camera drifts around the #; 0 = static
  viewWidth: 27,             // visible world width on landscape screens
  viewWidthPortrait: 16,     // visible world width when the screen is taller than wide

  // ---- bars (the # is 2 top bars along X resting on 2 bottom bars along Z)
  barWidth: 1,
  barHeight: 1.4,            // taller than wide, as in the reference
  barLength: 6.4,
  barOffset: 1.5,            // distance of each bar's centre-line from the origin

  // ---- grid
  // the single floor cell is derived from the bottom bars' footprint (no spacing knob)
  gridDrawDuration: 0.9,     // seconds for one line to trim-path across the view
  gridDrawStagger: 0.14,     // seconds between successive lines of one family
  gridFamilyDelay: 0.25,     // second family starts this long after the first

  // ---- timeline (seconds from start)
  barsStart: 1.0,            // first top bar launches; can overlap the tail of the grid draw
  topStagger: 0.12,          // between the two top bars
  bottomDelay: 0.38,         // bottom bars launch this long after the top bars
  bottomStagger: 0.12,

  // ---- physics (1-D vertical, gravity + restitution + a stiff spring floor)
  gravity: 40,
  topApex: 3.3,              // y of the top bars' underside at the peak of their pop-up
  bottomApex: 0.3,           // how far the bottom bars overshoot above the floor
  restitution: 0.3,          // bar-on-bar bounce
  floorStiffness: 3000,      // spring floor the bottom bars can sink into (hidden by the clip plane)
  floorDamping: 40,
  airDrag: 0.12,             // per-second velocity loss, helps settle
  settleSpeed: 0.35,         // below this speed, in contact, a bar is considered at rest

  // ---- hover tumble (active once the # has settled)
  tumbleFree: 0.5,           // seconds a kicked bar moves freely before being pulled back
  tumbleCooldown: 0.25,      // min seconds between kicks on the same bar
  kickUp: 3.0,               // upward velocity at full strength
  kickMinSpeed: 2.5,         // cursor must move faster than this (world units/s) to kick at all
  kickGain: 0.35,            // shove velocity = cursor speed (world units/s) * gain ...
  kickMin: 6,                //   ... clamped to this range (units/s). 27 units = full landscape view width
  kickMax: 16,
  kickSpin: 4.0,             // rad/s tumble about the horizontal axis perpendicular to travel, at full strength
  kickYaw: 1.5,              // extra twist about vertical when hit near an end
  tumbleGravity: 6,          // light gravity during the free phase
  returnStiffness: 12,       // spring pulling position + rotation back to rest
  returnDamping: 4.2,        // lower = more overshoot on the way back

  // ---- replay
  loop: false,               // true = replay automatically after `holdSeconds`
  holdSeconds: 4,
};

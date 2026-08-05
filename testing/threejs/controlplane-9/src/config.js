// Tri Floor — tuning knobs.
// All distances are in world units; the floor sits at y = 0.

export const CONFIG = {
  // ---- look ----
  background: 0x000000,
  lineColor: 0xffffff,
  fillColor: 0x000000,   // tile faces (occludes lines behind, reads as black)
  lineOpacity: 0.9,

  // ---- tiles ----
  tileSide: 2.4,         // triangle edge length (spacing grid)
  gapScale: 0.84,        // tile shrink toward centroid -> gap between tiles
  thickness: 0.1,        // prism depth (the thin 3D lip from the reference)

  // ---- floor extent ----
  cols: 29,              // triangles per row (row width = (cols+1) * side/2)
                         // keep ODD so a tile sits dead-centre on the camera
                         // axis and the floor is mirror-symmetric
  rowsAhead: 14,         // rows kept in front of the camera; also sets the
                         // distance of the big triangle's apex
  rowsBehind: 4,         // rows kept behind before recycling

  // ---- big-triangle footprint ----
  // The floor is a giant triangle: apex at the far spawn line, widening back
  // toward (and past) the camera. Tiles rise as its edges sweep over them.
  triHalfWidth: 17,      // half-width of the triangle at the camera (units)

  // ---- motion ----
  speed: 1.47,           // camera forward speed (units/s)
  dropHeight: -11,       // start offset from the floor: positive = fall from
                         // above, negative = rise up from below
  dropDuration: 7.3,     // seconds for a tile to settle (base, per-tile varied)
  dropStagger: 3.0,      // max extra per-tile random delay — adds organic fuzz
                         // to the triangle's building edges (too high blurs
                         // the shape)
  tiltMax: 0.9,          // radians of random tilt while a tile floats in
  driftX: 2.2,           // sideways drift while floating in
  easePower: 2.0,        // settle curve: higher = tiles snap into place early,
                         // lower = they stay visibly offset for most of the rise

  // ---- camera ----
  camHeight: 3.1,
  lookAhead: 17,         // distance in front of camera the view aims at
  lookHeight: 1.1,       // height of the look-at point
  swayAmp: 0,            // lateral sway (0 = locked straight ahead)
  swayPeriod: 28,        // seconds per sway cycle
  bobAmp: 0,             // vertical bob (0 = locked)
  bobPeriod: 18,

  // ---- depth fade (manual fog, fades lines to black) ----
  fogNear: 14,
  fogFar: 36,

  maxDpr: 2,
};

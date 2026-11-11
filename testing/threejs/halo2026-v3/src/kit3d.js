// THE KIT card (halo-h-v3): the "Structure Hero" from V1 (iso-h/src/structure.js), ported to draw inside the
// black Kit card (.kit-3d) as cream lines on near-black. It starts building the first time the card scrolls into
// view and only renders while the card is on screen. Original header:
//
// Option C hero: an exploded line drawing of a modular event structure (raised
// deck on adjustable feet, two-storey frames with a fence round the upper floor,
// straight stairs, and the roof lifted off), black lines on the background
// colour, with the camera slowly orbiting it. Loaded instead of main.js when
// ?option=c. It comes in ten formations, all built from the same kit so each is
// one a person could actually use (?formation=1..10, or the buttons); each
// builds itself in, piece by piece, in construction order.
//
// Hidden-line look: every surface is filled with the background colour (so it
// hides what is behind it) and only the outlines are drawn, as thick lines
// (three's LineSegments2, since plain GL lines are always 1 pixel).
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';

const C = {
  bg: 0x111111,           // the Kit card's colour, and the fill that hides lines behind faces
  ink: 0xebebe1,          // cream lines
  lineWidth: 0.5,         // CSS pixels, the same for every line incl. floor lines (James: thinner twice; V1 was 1, then 0.75)
  elevation: 30,          // degrees above the floor
  azimuth: 35,            // starting angle
  orbitSpeed: 7,          // degrees per second
  fill: 1.2,              // frame size relative to the structure (bigger = more room around it)
  offsetX: 0.07,          // landscape only: fraction of the card width the structure sits right of centre (mock: ~57% across)
  offsetY: 0.13,          // fraction of the card height it sits below centre (mock: ~63% down, under the text)
  mouseTilt: [0, 0],      // degrees the cursor adds to the orbit / elevation at the window edge (off, James; V1 had [10, 5])
  reframe: 3,             // how fast the camera re-centres when switching formation (per second)
  // build-in: each piece falls from `drop` above its place over `fall` seconds
  // (accelerating, like it's dropped), fading in over the start of the fall, then
  // settles with a small bounce
  // (speed: the whole build runs this many times faster; the numbers are at 1x).
  // On the way out the pieces lift back off in reverse order, `exitStagger` of
  // their build-in spacing apart.
  build: { start: 1.1, speed: 1.5, drop: 2.2, fall: 0.55, fadeIn: 0.2, bounce: 0.05, settle: 0.22, exitStagger: 0.35 },
  // the looping sequence (default, unless ?formation= picks one): build a
  // formation, hold it, lift it off, the floor lines slide to the next one's
  // footprint and it builds in (`next` seconds after the last piece has gone)
  sequence: { formations: [1, 9, 10], hold: 2, next: 0.33 },
  // Orbit-in intro (?option=e, "Structure Hero Flythrough"): while the first
  // formation builds, the camera starts close in (`startZoom` x the final view
  // size), low down (`startEl` degrees) and `sweep` degrees further back round
  // the orbit, with the structure centred; over `duration` s it pulls back
  // (slowing all the way) and, from `riseFrom` of the way through, rises up,
  // settling onto the usual view (the structure sliding over to the right) at
  // the usual orbit speed, which carries on from there. The H1 starts fading
  // up `titleAt` s in.
  intro: { duration: 5, sweep: 20, startEl: 5, riseFrom: 0.25, startZoom: 0.35, titleAt: 2 },
  // floor lines (as in the other scenes): four lines flush with the footprint's
  // outer edges, drawing themselves in before the build starts. Their far ends
  // fade to nothing between fade[0] and fade[1] (world units from the structure's
  // centre): well off screen in the settled view, but it hides the line ends
  // when the intro's low, zoomed-out camera can see that far.
  // (introFade: in the Flythrough intro the lines don't draw in, which whips
  // round from the low camera; they fade in at full length over this long)
  floor: { start: 0.15, draw: 0.8, stagger: 0.12, reach: 14, far: 60, fade: [30, 55], introFade: 1.6 },
};

const container = document.querySelector('.kit-3d');
const size = () => [Math.max(1, container.clientWidth), Math.max(1, container.clientHeight)];
const renderer = new THREE.WebGLRenderer({ antialias: true });
// always 2x, like Options A/B: the lines come out a whole number of pixels and
// are smoothed down, so they look the same weight on every screen
renderer.setPixelRatio(2);
renderer.setSize(...size());
Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);

// no orbit-in intro and no H1 here (those belonged to the V1 hero page)
const FLY = false;
const title = { style: {} };

// ---------------------------------------------------------------------------
// Drawing kit: fills that hide what's behind them, outlines as fat lines.
// Everything is drawn into the current *piece* (begin()), which builds in as
// one unit at its own time.
// ---------------------------------------------------------------------------
const fillMat = new THREE.MeshBasicMaterial({
  color: C.bg, side: THREE.DoubleSide, transparent: true,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,   // outlines win over their own faces
});
let lineMats = [];     // every line material, for resize + fade
let pieces = [];
let cur = null;
// start a new piece that drops in at `at` seconds (relative to the build start)
function begin(at, { dashed = false } = {}) {
  // each piece has its own fill, so it can fade with the piece's lines instead
  // of blinking out (it hides the lines behind it while it's solid)
  cur = { at, dashed, group: new THREE.Group(), segs: [], fill: fillMat.clone() };
  pieces.push(cur);
  scene.add(cur.group);
}

function addEdges(geo, matrix) {
  const pos = new THREE.EdgesGeometry(geo, 1).attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).applyMatrix4(matrix);
    cur.segs.push(v.x, v.y, v.z);
  }
}
function addMesh(geo, m = new THREE.Mesh(geo, cur.fill), edges = true) {
  m.updateMatrix();
  cur.group.add(m);
  if (edges) addEdges(geo, m.matrix);
}
// solid box between two corners (fill only when edges = false)
function box(x0, y0, z0, x1, y1, z1, edges = true) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(geo, cur.fill);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  addMesh(geo, m, edges);
}
// flat panel (single outline): 'x' = in the plane x = c, 'z' = in z = c, 'y' = horizontal at y = c
function panel(axis, c, a0, a1, b0, b1) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(geo, cur.fill);
  if (axis === 'x') { m.rotation.y = Math.PI / 2; m.scale.set(b1 - b0, a1 - a0, 1); m.position.set(c, (a0 + a1) / 2, (b0 + b1) / 2); }
  if (axis === 'z') { m.scale.set(a1 - a0, b1 - b0, 1); m.position.set((a0 + a1) / 2, (b0 + b1) / 2, c); }
  if (axis === 'y') { m.rotation.x = -Math.PI / 2; m.scale.set(a1 - a0, b1 - b0, 1); m.position.set((a0 + a1) / 2, c, (b0 + b1) / 2); }
  addMesh(geo, m);
}
const line = (x0, y0, z0, x1, y1, z1) => cur.segs.push(x0, y0, z0, x1, y1, z1);
// adjustable foot: a disc pad on the ground and a short stem up to the deck
function foot(x, z, top) {
  const r = 0.2, n = 28;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, n), cur.fill);
  disc.position.set(x, 0.035, z); disc.updateMatrix(); cur.group.add(disc);
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    for (const y of [0, 0.07]) line(x + r * Math.cos(a0), y, z + r * Math.sin(a0), x + r * Math.cos(a1), y, z + r * Math.sin(a1));
  }
  line(x, 0.07, z, x, top, z);
}

// Plan of several rectangles [x0, z0, x1, z1] as one shape with no seams where
// they meet: the plane is split on every rectangle edge into cells, and only
// the borders between covered and uncovered cells are drawn.
function plan(rects, extra = { xs: [], zs: [] }) {
  const uniq = a => [...new Set(a.map(v => +v.toFixed(4)))].sort((p, q) => p - q);
  const xs = uniq([...rects.flatMap(r => [r[0], r[2]]), ...extra.xs]);
  const zs = uniq([...rects.flatMap(r => [r[1], r[3]]), ...extra.zs]);
  const nx = xs.length - 1, nz = zs.length - 1, e = 1e-4;
  const grid = [];
  for (let i = 0; i < nx; i++) {
    grid[i] = [];
    for (let j = 0; j < nz; j++) {
      grid[i][j] = rects.some(r => xs[i] >= r[0] - e && xs[i + 1] <= r[2] + e && zs[j] >= r[1] - e && zs[j + 1] <= r[3] + e);
    }
  }
  const on = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && grid[i][j];
  const cells = [], edges = [], corners = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (on(i, j)) cells.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
  for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) {
    if (on(i, j - 1) !== on(i, j)) edges.push({ axis: 'z', c: zs[j], a: xs[i], b: xs[i + 1] });
  }
  for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) {
    if (on(i - 1, j) !== on(i, j)) edges.push({ axis: 'x', c: xs[i], a: zs[j], b: zs[j + 1] });
  }
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const q = [on(i - 1, j - 1), on(i, j - 1), on(i - 1, j), on(i, j)];
    const n = q.filter(Boolean).length;
    if (n === 1 || n === 3 || (n === 2 && q[0] === q[3])) {
      // a convex corner's one covered cell says which way is "inside"
      const k = q.indexOf(true);
      corners.push({ x: xs[i], z: zs[j], convex: n === 1, dx: k % 2 ? 1 : -1, dz: k > 1 ? 1 : -1 });
    }
  }
  const bounds = [xs[0], zs[0], xs[nx], zs[nz]];
  return { cells, edges, corners, bounds };
}
// a plan as a solid slab between y0 and y1: hidden fills per cell, outline only
// round the outside
function slab(p, y0, y1) {
  for (const [x0, z0, x1, z1] of p.cells) box(x0, y0, z0, x1, y1, z1, false);
  for (const ed of p.edges) for (const y of [y0, y1]) {
    if (ed.axis === 'z') line(ed.a, y, ed.c, ed.b, y, ed.c);
    else line(ed.c, y, ed.a, ed.c, y, ed.b);
  }
  for (const k of p.corners) line(k.x, y0, k.z, k.x, y1, k.z);
}

// ---------------------------------------------------------------------------
// The kit (units ~ metres; x across, z front-to-back, y up). Everything is
// laid out on shared lines: tower squares, stair lanes and steps all start and
// stop on the same edges.
// ---------------------------------------------------------------------------
const DECK = [0.45, 0.75];   // deck underside / top
const UPPER = 3.2;           // upper floor top
const SLAB = 0.25;           // upper floor thickness
const SIDE = 4.2;            // one tower module is square: SIDE x SIDE
const STAIR_W = 1.65;        // stair lane width
const STEPS = 4;             // steps per flight
const RISE = (UPPER - DECK[1]) / (2 * STEPS + 2);   // one riser height everywhere, deck to upper floor
const RUN = 0.5;             // one tread depth everywhere
const LAND = DECK[1] + (STEPS + 1) * RISE;          // landing top
// a stair lane, from its top forward: upper flight, landing (square, as wide as
// the stairs), lower flight, then a square pad of deck at the foot
const LANE = { top: 0, landing: STEPS * RUN };
LANE.front = LANE.landing + STAIR_W;
LANE.foot = LANE.front + STEPS * RUN;
LANE.end = LANE.foot + STAIR_W;
const FOOT_IN = 0.3;         // feet sit this far in from the deck's corners
const POST_TOP = 4.6;
const FENCE_H = 0.9;         // the fence / back wall standing on the upper floor's edges
const ROOF = 5.6;
const GROUND = { rise: 0.25, run: 0.3 };   // access steps from the ground up onto the deck

// Stairs and access steps are placed by where they start (x, z) and the way
// they run (dir: S = towards the front (+z), N, E, W). In their own frame the
// lane is x -width..0 across and z 0.. along; turning that frame by quarter
// turns keeps everything on the grid.
function toWorld({ x, z, dir }, lx, lz) {
  switch (dir) {
    case 'N': return [x - lx, z - lz];
    case 'E': return [x + lz, z - lx];
    case 'W': return [x - lz, z + lx];
    default: return [x + lx, z + lz];
  }
}
function localRect(T, lx0, lz0, lx1, lz1) {
  const [ax, az] = toWorld(T, lx0, lz0), [bx, bz] = toWorld(T, lx1, lz1);
  return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
}
function lbox(T, lx0, y0, lz0, lx1, y1, lz1) {
  const [x0, z0, x1, z1] = localRect(T, lx0, lz0, lx1, lz1);
  box(x0, y0, z0, x1, y1, z1);
}
// The gap in the upper floor's fence where a stair arrives: 'side' = the top
// step sits alongside the floor's edge (the floor on the lane's local +x side)
// and you step across; 'head' = the stair runs straight up to the edge.
function arrival(s) {
  const [ax, az] = s.arrive === 'head' ? toWorld(s, -STAIR_W, 0) : toWorld(s, 0, 0);
  const [bx, bz] = s.arrive === 'head' ? toWorld(s, 0, 0) : toWorld(s, 0, LANE.landing / 2);
  return Math.abs(ax - bx) < 1e-4
    ? { axis: 'x', c: ax, a: Math.min(az, bz), b: Math.max(az, bz) }
    : { axis: 'z', c: az, a: Math.min(ax, bx), b: Math.max(ax, bx) };
}

// ---------------------------------------------------------------------------
// Formations. Each one is: deck rectangles (stair lanes add their own), upper
// floor rectangles (fenced all round except where stairs arrive, a post at
// every corner), stairs from the deck to the upper floor, access steps from
// the ground onto the deck, ground-storey walls, extra posts, and roofs
// (lifted off, dotted lines down to the posts they sit on).
// ---------------------------------------------------------------------------
const S = SIDE, W = STAIR_W, L = LANE.end, G = 3;   // G: bridge span between two towers
const steps = (x, z, dir, w = W) => ({ x, z, dir, w });
const FORMATIONS = [
  { // the original drawing: one tower, stair alongside its left side
    name: 'Tower',
    deck: [[0, 0, S, S]], upper: [[0, 0, S, S]],
    stairs: [{ x: 0, z: 0, dir: 'S', arrive: 'side' }],
    walls: [[0, 0, S, 0], [0, 0, 0, S]],
    roofs: [[0, 0, S, S]],
  },
  { // single storey: a stage two modules wide, back wall, canopy on four posts
    name: 'Stage',
    deck: [[0, 0, 2 * S, S]],
    steps: [steps(S + 1.2, S, 'S', 2.4)],
    walls: [[0, 0, 2 * S, 0]],
    posts: [[0, 0], [2 * S, 0], [2 * S, S], [0, S], [S, 0], [S, S]], postTop: 3.6,
    roofs: [[0, 0, 2 * S, S, 4.6]],
  },
  { // two towers side by side: one wide upper floor, stair on the left
    name: 'Twin',
    deck: [[0, 0, 2 * S, S]], upper: [[0, 0, 2 * S, S]],
    stairs: [{ x: 0, z: 0, dir: 'S', arrive: 'side' }],
    steps: [steps(0, L, 'S')],
    walls: [[0, 0, 2 * S, 0], [0, 0, 0, S]],
    posts: [[S, 0], [S, S]],
    roofs: [[0, 0, 2 * S, S]],
  },
  { // one tower, stair straight up the middle of the front
    name: 'Centre',
    deck: [[0, 0, S, S]], upper: [[0, 0, S, S]],
    stairs: [{ x: S / 2 + W / 2, z: S, dir: 'S', arrive: 'head' }],
    steps: [steps(S / 2 + W / 2, S + L, 'S')],
    walls: [[0, 0, S, 0], [0, 0, 0, S], [S, 0, S, S]],
    roofs: [[0, 0, S, S]],
  },
  { // tower in the back corner of a big open terrace, stair along the back
    name: 'Terrace',
    deck: [[0, 0, S + L, 2 * S]], upper: [[0, 0, S, S]],
    stairs: [{ x: S, z: 0, dir: 'E', arrive: 'head' }],
    steps: [steps((S + L) / 2 + 1.2, 2 * S, 'S', 2.4)],
    walls: [[0, 0, S, 0], [0, 0, 0, S]],
    roofs: [[0, 0, S, S]],
  },
  { // two towers joined by a bridge, with a walkway underneath
    name: 'Bridge',
    deck: [[0, 0, 2 * S + G, S]],
    upper: [[0, 0, S, S], [S + G, 0, 2 * S + G, S], [S, S / 2 - W / 2, S + G, S / 2 + W / 2]],
    stairs: [{ x: 0, z: 0, dir: 'S', arrive: 'side' }],
    steps: [steps(0, L, 'S')],
    walls: [[0, 0, S, 0], [S + G, 0, 2 * S + G, 0], [0, 0, 0, S], [2 * S + G, 0, 2 * S + G, S]],
    roofs: [[0, 0, S, S], [S + G, 0, 2 * S + G, S]],
  },
  { // three modules in an L, stair in the inside corner
    name: 'Corner',
    deck: [[0, 0, S + L, 2 * S]], upper: [[0, 0, 2 * S, S], [0, S, S, 2 * S]],
    stairs: [{ x: S, z: S, dir: 'E', arrive: 'head' }],
    steps: [steps(S + L, S, 'E')],
    walls: [[0, 0, 2 * S, 0], [0, 0, 0, 2 * S]],
    roofs: [[0, 0, 2 * S, S], [0, S, S, 2 * S]],
  },
  { // one tower with a stair on each side (two ways down)
    name: 'Double',
    deck: [[0, 0, S, S]], upper: [[0, 0, S, S]],
    stairs: [{ x: 0, z: 0, dir: 'S', arrive: 'side' }, { x: S, z: S, dir: 'N', arrive: 'side' }],
    steps: [steps(0, L, 'S'), steps(S, S - L, 'N')],
    walls: [[0, 0, S, 0]],
    roofs: [[0, 0, S, S]],
  },
  { // a long viewing gallery three modules wide, a stair at each end
    name: 'Gallery',
    deck: [[0, 0, 3 * S, S]], upper: [[0, 0, 3 * S, S]],
    stairs: [{ x: 0, z: 0, dir: 'S', arrive: 'side' }, { x: 3 * S, z: S, dir: 'N', arrive: 'side' }],
    steps: [steps(0, L, 'S'), steps(3 * S, S - L, 'N')],
    walls: [[0, 0, 3 * S, 0]],
    posts: [[S, 0], [2 * S, 0], [S, S], [2 * S, S]],
    roofs: [[0, 0, 3 * S, S]],
  },
  { // two towers joined across the back, round a courtyard; one grand stair up the middle
    name: 'Courtyard',
    deck: [[0, 0, 3 * S, W + L]],
    upper: [[0, 0, S, S], [2 * S, 0, 3 * S, S], [S, 0, 2 * S, W]],
    stairs: [{ x: 1.5 * S + W / 2, z: W, dir: 'S', arrive: 'head' }],
    steps: [steps(1.5 * S + W / 2, W + L, 'S')],
    walls: [[0, 0, S, 0], [2 * S, 0, 3 * S, 0], [0, 0, 0, S], [3 * S, 0, 3 * S, S]],
    roofs: [[0, 0, S, S], [2 * S, 0, 3 * S, S]],
  },
];

// Build one formation's pieces, in construction order.
let footprint = [0, 0, 1, 1];
function buildFormation(f) {
  let t = 0;                   // build clock: when the next piece drops in
  const next = gap => (t += gap);
  const stairs = f.stairs ?? [], accesses = f.steps ?? [];

  // the deck drops in as one piece with all its feet (one foot in from every
  // outside corner, all level on the ground), then the access steps
  const deckRects = [...f.deck, ...stairs.map(s => localRect(s, -W, 0, 0, L))];
  const deck = plan(deckRects);
  begin(next(0));
  for (const k of deck.corners) if (k.convex) foot(k.x + k.dx * FOOT_IN, k.z + k.dz * FOOT_IN, DECK[0]);
  slab(deck, DECK[0], DECK[1]);
  const stepRects = [];
  for (const a of accesses) {
    for (let k = 0; k < 2; k++) {
      begin(next(0.08));
      lbox(a, -a.w, 0, k * GROUND.run, 0, DECK[1] - (k + 1) * GROUND.rise, (k + 1) * GROUND.run);
    }
    stepRects.push(localRect(a, -a.w, 0, 0, 2 * GROUND.run));
  }
  footprint = plan([...deckRects, ...stepRects]).bounds;

  // ground-storey walls, then the posts (one on every corner of the upper
  // floor, running on past it, plus any extras), then the upper floor
  next(0.25);
  for (const [x0, z0, x1, z1] of f.walls ?? []) {
    begin(next(0.12));
    if (z0 === z1) panel('z', z0, x0, x1, DECK[1], UPPER - SLAB);
    else panel('x', x0, DECK[1], UPPER - SLAB, z0, z1);
  }
  const gaps = stairs.map(arrival);
  const upper = f.upper && plan(f.upper, {
    xs: gaps.flatMap(g => (g.axis === 'z' ? [g.a, g.b] : [])),
    zs: gaps.flatMap(g => (g.axis === 'x' ? [g.a, g.b] : [])),
  });
  const posts = new Map();     // "x,z" -> top
  for (const k of upper?.corners ?? []) posts.set(`${k.x},${k.z}`, POST_TOP);
  for (const [x, z] of f.posts ?? []) posts.set(`${x},${z}`, f.postTop ?? POST_TOP);
  // any post under a roof (on its edge or inside) runs right up to it
  const roofs = f.roofs ?? [];
  for (const key of posts.keys()) {
    const [x, z] = key.split(',').map(Number);
    const roof = roofs.find(([x0, z0, x1, z1]) => x >= x0 - 1e-4 && x <= x1 + 1e-4 && z >= z0 - 1e-4 && z <= z1 + 1e-4);
    if (roof) posts.set(key, roof[4] ?? ROOF);
  }
  for (const [key, top] of posts) {
    const [x, z] = key.split(',').map(Number);
    begin(next(0.08)); line(x, DECK[1], z, x, top, z);
  }
  if (upper) { begin(next(0.25)); slab(upper, UPPER - SLAB, UPPER); }

  // each stair from the bottom up: the lower flight, the landing (as wide as
  // the stairs), then the upper flight; every step is one RISE x RUN, and the
  // top step is one riser below the upper floor. Several stairs build at the
  // same time.
  next(0.15);
  const stairsAt = t;
  let stairsEnd = t;
  for (const s of stairs) {
    t = stairsAt;
    for (let k = 0; k < STEPS; k++) {
      const z0 = LANE.front + RUN * (STEPS - 1 - k);
      begin(next(0.09)); lbox(s, -W, DECK[1], z0, 0, DECK[1] + RISE * (k + 1), z0 + RUN);
    }
    begin(next(0.09)); lbox(s, -W, DECK[1], LANE.landing, 0, LAND, LANE.front);
    for (let k = 0; k < STEPS; k++) {
      const z1 = LANE.landing - RUN * k;
      begin(next(0.09)); lbox(s, -W, DECK[1], z1 - RUN, 0, LAND + RISE * (k + 1), z1);
    }
    stairsEnd = Math.max(stairsEnd, t);
  }
  t = stairsEnd;

  // fence on the upper floor's outside edges, leaving a gap where each stair
  // arrives; straight runs are one panel each, placed going round from the back
  if (upper) {
    const inGap = ed => gaps.some(g => g.axis === ed.axis && Math.abs(g.c - ed.c) < 1e-4 && ed.a >= g.a - 1e-4 && ed.b <= g.b + 1e-4);
    const runs = [];
    for (const ed of upper.edges.filter(ed => !inGap(ed)).sort((p, q) => (p.axis + p.c).localeCompare(q.axis + q.c) || p.a - q.a)) {
      const last = runs[runs.length - 1];
      if (last && last.axis === ed.axis && Math.abs(last.c - ed.c) < 1e-4 && Math.abs(last.b - ed.a) < 1e-4) last.b = ed.b;
      else runs.push({ ...ed });
    }
    const [bx0, bz0, bx1, bz1] = upper.bounds, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const angle = r => {
      const [mx, mz] = r.axis === 'z' ? [(r.a + r.b) / 2, r.c] : [r.c, (r.a + r.b) / 2];
      return (Math.atan2(mx - cx, cz - mz) + 2 * Math.PI) % (2 * Math.PI);
    };
    next(0.1);
    for (const r of runs.sort((p, q) => angle(p) - angle(q))) {
      begin(next(0.1));
      if (r.axis === 'z') panel('z', r.c, r.a, r.b, UPPER, UPPER + FENCE_H);
      else panel('x', r.c, UPPER, UPPER + FENCE_H, r.a, r.b);
    }
  }

  // the roofs, sitting on the tops of the posts
  for (const [x0, z0, x1, z1, y = ROOF] of roofs) { begin(next(0.35)); panel('y', y, x0, x1, z0, z1); }

  // one outline per piece, so each can move and fade on its own
  const segs = [];
  for (const p of pieces) {
    const mat = new LineMaterial({ color: C.ink, linewidth: C.lineWidth, transparent: true, opacity: 0 });
    if (p.dashed) Object.assign(mat, { dashed: true, dashSize: 0.01, gapSize: 0.17 });
    const lines = new LineSegments2(new LineSegmentsGeometry().setPositions(p.segs), mat);
    if (p.dashed) lines.computeLineDistances();
    p.group.add(lines);
    p.mat = mat;
    lineMats.push(mat);
    segs.push(...p.segs);
    p.group.visible = false;
  }
  // lifting off goes in reverse: the last piece in is the first out
  for (const p of pieces) p.out = (t - p.at) * B.exitStagger;
  return segs;
}

// Floor lines: two along X flush with the back and front of the footprint, two
// along Z flush with its left and right. Each draws itself in across the view
// (its end sliding out from one side), then reaches far past the screen. They
// stay for the whole visit: on a change of formation they slide over to hug the
// new footprint (like the floor lines in Options A/B).
const F = C.floor;
const floorMat = new LineMaterial({ color: C.ink, linewidth: C.lineWidth, transparent: true, opacity: 0.3 });   // floor lines at 30% (James)
// the fade with distance: the shader gets each point's floor position and fades
// its alpha between two radii round the structure's centre (updated each frame)
const floorFade = { centre: { value: new THREE.Vector2() }, near: { value: 1 }, far: { value: 2 } };
floorMat.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, { fadeCentre: floorFade.centre, fadeNear: floorFade.near, fadeFar: floorFade.far });
  shader.vertexShader = shader.vertexShader
    .replace('#include <clipping_planes_pars_vertex>', '#include <clipping_planes_pars_vertex>\nvarying vec3 vFloorPos;')
    .replace('vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
      'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );\n\t\t\tvFloorPos = ( modelMatrix * vec4( position.y < 0.5 ? instanceStart : instanceEnd, 1.0 ) ).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <clipping_planes_pars_fragment>',
      '#include <clipping_planes_pars_fragment>\nvarying vec3 vFloorPos;\nuniform vec2 fadeCentre;\nuniform float fadeNear;\nuniform float fadeFar;')
    .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      'alpha *= 1.0 - smoothstep( fadeNear, fadeFar, length( vFloorPos.xz - fadeCentre ) );\n\t\t\tgl_FragColor = vec4( diffuseColor.rgb, alpha );');
};
function updateFloorFade() {
  floorFade.centre.value.set(centre.x, centre.z);
  floorFade.near.value = F.fade[0];
  floorFade.far.value = F.fade[1];
}
const floorLines = ['z0', 'z1', 'x0', 'x1'].map((side, i) => {
  const obj = new LineSegments2(new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]), floorMat);
  obj.visible = false;
  obj.frustumCulled = false;
  scene.add(obj);
  return { side, obj, at: F.start + i * F.stagger };
});
let fpNow = null;              // footprint the lines are on right now, easing to `footprint`
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
function updateFloor(time) {
  // the Flythrough intro fades them in at full length instead of drawing them
  if (FLY) floorMat.opacity = Math.min(1, Math.max(0, (time - F.start) / F.introFade)) ** 2;
  const [x0, z0, x1, z1] = fpNow, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (const l of floorLines) {
    const u = Math.min(1, (time - l.at) / F.draw);
    l.obj.visible = u > 0;
    if (u <= 0) continue;
    // distance a..b along the line: drawing in, then far past the screen
    const [a, b] = u < 1 && !FLY ? [-F.reach, -F.reach + 2 * F.reach * easeInOut(u)] : [-F.far, F.far];
    const p = {
      z0: [mx + a, z0, mx + b, z0], z1: [mx + a, z1, mx + b, z1],
      x0: [x0, mz + a, x0, mz + b], x1: [x1, mz + a, x1, mz + b],
    }[l.side];
    const seg = l.obj.geometry.attributes.instanceStart.data;   // [x0 y0 z0 x1 y1 z1], updated in place
    seg.array.set([p[0], 0, p[1], p[2], 0, p[3]]);
    seg.needsUpdate = true;
  }
}

// Build-in: each piece falls from above (accelerating), fading in as it starts,
// lands in place with a small settle. Lifting off is the same in reverse: each
// piece accelerates back up and fades out. Dotted lines just fade, no move.
const B = C.build;
let buildDelay = B.start;      // seconds after show() before the first piece drops
let exitAt = null;             // build time the lift-off started (null = standing)
const lastAt = () => Math.max(0, ...pieces.map(p => p.at));
const buildEnd = () => buildDelay + (lastAt() + B.fall + B.settle) / B.speed;
const exitLength = () => (lastAt() * B.exitStagger + B.fall) / B.speed;
function updateBuild(time) {
  const bt = (time - buildDelay) * B.speed;                     // build clock, sped up
  const xt = exitAt === null ? null : (time - exitAt) * B.speed;
  for (const p of pieces) {
    const u = (bt - p.at) / B.fall;
    p.group.visible = u > 0;
    if (u <= 0) continue;
    let alpha = Math.min(1, u * B.fall / B.fadeIn), y = 0;
    if (!p.dashed) {
      if (u < 1) y = B.drop * (1 - u * u);                     // falling under gravity
      else {
        const v = (bt - p.at - B.fall) / B.settle;
        if (v < 1) y = B.bounce * Math.sin(Math.PI * v) * (1 - v);   // tiny settle after landing
      }
    }
    if (xt !== null) {
      const w = (xt - p.out) / B.fall;
      if (w >= 1) { p.group.visible = false; continue; }
      if (w > 0) { alpha *= 1 - w; if (!p.dashed) y += B.drop * w * w; }
    }
    p.mat.opacity = alpha;
    // the fill fades with the lines: while it's see-through it stops hiding
    // the lines behind it, so they fade back in rather than popping
    p.fill.opacity = alpha;
    p.fill.depthWrite = alpha >= 1;
    p.group.position.y = y;
  }
}

// ---------------------------------------------------------------------------
// Camera: orthographic, orbiting the structure's centre. Switching formation
// eases the centre and framing over to the new one.
// ---------------------------------------------------------------------------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const centre = new THREE.Vector3(), targetCentre = new THREE.Vector3();
let radius = 1, targetRadius = 1;

// zoom: view size multiplier (> 1 = further out); slide: 0..1 of the move to the right
function frameCamera(zoom = 1, slide = 1) {
  const [w, h] = size(), aspect = w / h;
  const half = zoom * radius * C.fill / Math.min(1, aspect);   // fit the structure's sphere, landscape or portrait
  // slide the frame left/up so the structure sits right of and below centre, clear of the card's text
  const shift = aspect > 1 ? slide * C.offsetX * 2 * half * aspect : 0;
  const shiftY = C.offsetY * 2 * half;
  camera.top = half + shiftY; camera.bottom = -half + shiftY;
  camera.left = -half * aspect - shift; camera.right = half * aspect - shift;
  camera.updateProjectionMatrix();
}
function sizeLines() {
  const [w, h] = size(), px = renderer.getPixelRatio();
  for (const m of [floorMat, ...lineMats]) {
    m.resolution.set(w * px, h * px);
    m.linewidth = C.lineWidth * px;
  }
}
function resize() {
  renderer.setSize(...size());
  renderer.domElement.style.width = renderer.domElement.style.height = '100%';
  frameCamera();
  sizeLines();
}
new ResizeObserver(resize).observe(container);

// ---------------------------------------------------------------------------
// Switching: clear the pieces, build the new formation and play its build-in
// (the orbit and floor lines carry on). With the sequence on, it holds each
// formation, lifts it off and builds the next, round and round.
// ---------------------------------------------------------------------------
const clock0 = performance.now() / 1000;
const SQ = C.sequence;
let buildAt = 0, formation = 0, looping = false, loopIdx = 0;
function show(i, { snap = false, delay = B.start } = {}) {
  for (const p of pieces) {
    scene.remove(p.group);
    p.group.traverse(o => o.geometry?.dispose());
    p.mat.dispose();
    p.fill.dispose();
  }
  pieces = []; lineMats = [];
  formation = i;
  const segs = buildFormation(FORMATIONS[i]);
  if (snap || !fpNow) fpNow = [...footprint];
  const bounds = new THREE.Box3().setFromArray(segs);
  bounds.getCenter(targetCentre);
  targetRadius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  if (snap) { centre.copy(targetCentre); radius = targetRadius; }
  buildDelay = delay;
  exitAt = null;
  buildAt = performance.now() / 1000 - clock0;
  // only the new line materials need sizing; resizing the canvas here would
  // blank it for a frame (a flash)
  sizeLines();
}
function startLoop() {
  looping = true; loopIdx = 0;
  show(SQ.formations[0] - 1);
}

// the sequence plays by default; ?formation=1..10 in the URL shows just that one
const asked = parseInt(new URLSearchParams(location.search).get('formation'), 10);
let floorBorn = 0, started = false, visible = false;
// the build (and floor lines) start the first time the card is on screen, so it's seen building
function start() {
  started = true;
  floorBorn = performance.now() / 1000 - clock0;
  if (asked >= 1 && asked <= FORMATIONS.length) show(asked - 1, { snap: true });
  else { looping = true; show(SQ.formations[0] - 1, { snap: true }); }
}
// the build waits for the card's entrance (src/kit.js fires 'reveal:done' on the card once it has wiped in)
const revealHost = container.closest('[data-reveal-wait]');
let ready = !revealHost;
revealHost?.addEventListener('reveal:done', () => { ready = true; if (visible && !started) start(); });
new IntersectionObserver(([e]) => {
  visible = e.isIntersecting;
  if (visible && ready && !started) start();
}, { threshold: 0.25 }).observe(container);

let mx = 0, my = 0, tmx = 0, tmy = 0;
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  tmx = (e.clientX / window.innerWidth) * 2 - 1;
  tmy = (e.clientY / window.innerHeight) * 2 - 1;
});
document.documentElement.addEventListener('pointerleave', () => { tmx = tmy = 0; });

// ---------------------------------------------------------------------------
// Orbit-in intro (?option=e): the same orthographic camera, swinging round and
// moving in while the first formation builds. Every motion eases out with a
// cubic, so the camera decelerates smoothly; the orbit angle eases onto the
// regular orbit (rather than to a standstill), so it carries straight on.
// ---------------------------------------------------------------------------
const IN = C.intro;
let introDone = !FLY, introEndAt = 0, orbitFrom = 0;   // orbitFrom: clock when the regular orbit takes over
const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

let last = clock0, frozen = null;
function frame() {
  requestAnimationFrame(frame);
  if (!started || (!visible && frozen === null)) { last = performance.now() / 1000; return; }   // off screen: don't draw
  const now = performance.now() / 1000, dt = Math.min(now - last, 0.05);
  last = now;
  const clock = now - clock0;
  let time = frozen ?? clock - buildAt;
  // the sequence: hold the built formation, lift it off, then on to the next
  if (looping && frozen === null && introDone) {
    if (exitAt === null && time > Math.max(buildEnd(), introEndAt) + SQ.hold) exitAt = time;
    else if (exitAt !== null && time > exitAt + exitLength()) {
      loopIdx = (loopIdx + 1) % SQ.formations.length;
      show(SQ.formations[loopIdx] - 1, { delay: SQ.next });
      // the new formation's clock starts now; with the old one, its pieces
      // would all show fully built for this one frame (the flash)
      time = clock - buildAt;
    }
  }
  const k = 1 - Math.exp(-3 * dt);
  mx += (tmx - mx) * k; my += (tmy - my) * k;
  const kf = frozen === null ? 1 - Math.exp(-C.reframe * dt) : 1;
  centre.lerp(targetCentre, kf);
  radius += (targetRadius - radius) * kf;
  for (let j = 0; j < 4; j++) fpNow[j] += (footprint[j] - fpNow[j]) * kf;

  // orbit angle, height, zoom and sideways slide: the regular orbit, or the intro easing onto it
  let az = C.azimuth + C.orbitSpeed * (frozen ?? clock - orbitFrom), el = C.elevation, zoom = 1, slide = 1, tilt = 1;
  if (!introDone) {
    const p = Math.min(1, time / IN.duration), q = (1 - p) ** 3;   // q: 1 -> 0, easing out
    // the swing eases in and out (on top of the regular orbit speed), so it starts gently
    az = C.azimuth + C.orbitSpeed * (time - IN.duration) - IN.sweep * (1 - smooth(p));
    // the rise stays low while it moves in, then lifts (and settles)
    el = IN.startEl + (C.elevation - IN.startEl) * smooth((p - IN.riseFrom) / (1 - IN.riseFrom));
    zoom = IN.startZoom + (1 - IN.startZoom) * smooth(p);   // stays close while the first pieces land
    slide = smooth((p - 0.35) / 0.65);
    tilt = 1 - q;
    if (time >= IN.titleAt) title.style.display = 'block';   // its lines fade up (CSS)
    if (p >= 1 && frozen === null) {
      // landed: the regular orbit carries on from here
      introDone = true;
      introEndAt = time;
      orbitFrom = clock;
    }
  }
  frameCamera(zoom, slide);
  updateFloor(frozen ?? clock - floorBorn);
  updateFloorFade();
  updateBuild(time);
  const azR = THREE.MathUtils.degToRad(az + mx * C.mouseTilt[0] * tilt);
  const elR = THREE.MathUtils.degToRad(el - my * C.mouseTilt[1] * tilt);
  camera.position.set(Math.cos(elR) * Math.sin(azR), Math.sin(elR), Math.cos(elR) * Math.cos(azR)).multiplyScalar(60).add(centre);
  camera.lookAt(centre);
  renderer.render(scene, camera);
}
frame();

// Debug: structureDebug.freeze(seconds) holds the build (and orbit) at that
// moment, structureDebug.show(n) switches to formation n (1-10) and stops the
// loop, structureDebug.loop() restarts the sequence, structureDebug.replay()
// plays the current one again, structureDebug.buildEnd() when it finishes.
window.kitDebug = {
  start: () => { if (!started) start(); visible = true; },
  freeze: s => { frozen = s; },
  show: n => { looping = false; show(n - 1, { snap: true }); },
  loop: () => { frozen = null; startLoop(); },
  replay: () => { frozen = null; show(formation); },
  buildEnd,
  exitLength,
  state: () => ({ looping, formation: formation + 1, exiting: exitAt !== null, introDone }),
  formations: FORMATIONS.map(f => f.name),
};

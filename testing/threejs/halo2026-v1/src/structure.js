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
  bg: 0xe2baf6,           // background, and the fill that hides lines behind faces
  ink: 0x0b0b0b,
  lineWidth: 1.5,         // CSS pixels, the same for every line (solid and dotted)
  elevation: 30,          // degrees above the floor
  azimuth: 35,            // starting angle
  orbitSpeed: 7,          // degrees per second
  fill: 1.1,              // frame size relative to the structure (bigger = more room around it)
  offsetX: 0.2,           // landscape only: fraction of the screen width the structure sits right of centre
  mouseTilt: [10, 5],     // degrees the cursor adds to the orbit / elevation at the window edge
  reframe: 3,             // how fast the camera re-centres when switching formation (per second)
  // build-in: each piece falls from `drop` above its place over `fall` seconds
  // (accelerating, like it's dropped), fading in over the start of the fall, then
  // settles with a small bounce
  build: { start: 1.1, drop: 2.2, fall: 0.55, fadeIn: 0.2, bounce: 0.05, settle: 0.22 },
  // floor lines (as in the other scenes): four lines flush with the footprint's
  // outer edges, drawing themselves in before the build starts
  floor: { start: 0.15, draw: 0.8, stagger: 0.12, reach: 14, far: 60 },
};

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);

// This hero is one screen tall; the next section follows straight after.
document.getElementById('scroll').style.height = '100vh';
document.getElementById('tagline').style.display = 'none';
document.getElementById('structure-title').style.display = 'block';
document.documentElement.style.background = '#' + C.bg.toString(16).padStart(6, '0');

// ---------------------------------------------------------------------------
// Drawing kit: fills that hide what's behind them, outlines as fat lines.
// Everything is drawn into the current *piece* (begin()), which builds in as
// one unit at its own time.
// ---------------------------------------------------------------------------
const fillMat = new THREE.MeshBasicMaterial({
  color: C.bg, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,   // outlines win over their own faces
});
let lineMats = [];     // every line material, for resize + fade
let pieces = [];
let cur = null;
// start a new piece that drops in at `at` seconds (relative to the build start)
function begin(at, { dashed = false } = {}) {
  cur = { at, dashed, group: new THREE.Group(), segs: [] };
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
function addMesh(geo, m = new THREE.Mesh(geo, fillMat), edges = true) {
  m.updateMatrix();
  cur.group.add(m);
  if (edges) addEdges(geo, m.matrix);
}
// solid box between two corners (fill only when edges = false)
function box(x0, y0, z0, x1, y1, z1, edges = true) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(geo, fillMat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  addMesh(geo, m, edges);
}
// flat panel (single outline): 'x' = in the plane x = c, 'z' = in z = c, 'y' = horizontal at y = c
function panel(axis, c, a0, a1, b0, b1) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(geo, fillMat);
  if (axis === 'x') { m.rotation.y = Math.PI / 2; m.scale.set(b1 - b0, a1 - a0, 1); m.position.set(c, (a0 + a1) / 2, (b0 + b1) / 2); }
  if (axis === 'z') { m.scale.set(a1 - a0, b1 - b0, 1); m.position.set((a0 + a1) / 2, (b0 + b1) / 2, c); }
  if (axis === 'y') { m.rotation.x = -Math.PI / 2; m.scale.set(a1 - a0, b1 - b0, 1); m.position.set((a0 + a1) / 2, c, (b0 + b1) / 2); }
  addMesh(geo, m);
}
const line = (x0, y0, z0, x1, y1, z1) => cur.segs.push(x0, y0, z0, x1, y1, z1);
// adjustable foot: a disc pad on the ground and a short stem up to the deck
function foot(x, z, top) {
  const r = 0.2, n = 28;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, n), fillMat);
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
  for (const [key, top] of posts) {
    const [x, z] = key.split(',').map(Number);
    begin(next(0.08)); line(x, DECK[1], z, x, top, z);
  }
  if (upper) { begin(next(0.25)); slab(upper, UPPER - SLAB, UPPER); }

  // each stair from the bottom up: the lower flight, the landing (as wide as
  // the stairs), then the upper flight; every step is one RISE x RUN, and the
  // top step is one riser below the upper floor
  for (const s of stairs) {
    next(0.15);
    for (let k = 0; k < STEPS; k++) {
      const z0 = LANE.front + RUN * (STEPS - 1 - k);
      begin(next(0.09)); lbox(s, -W, DECK[1], z0, 0, DECK[1] + RISE * (k + 1), z0 + RUN);
    }
    begin(next(0.09)); lbox(s, -W, DECK[1], LANE.landing, 0, LAND, LANE.front);
    for (let k = 0; k < STEPS; k++) {
      const z1 = LANE.landing - RUN * k;
      begin(next(0.09)); lbox(s, -W, DECK[1], z1 - RUN, 0, LAND + RISE * (k + 1), z1);
    }
  }

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

  // the roofs, lifted straight off (exploded), then dotted lines from the posts
  // under their front corners showing where they go
  const roofs = f.roofs ?? [];
  for (const [x0, z0, x1, z1, y = ROOF] of roofs) { begin(next(0.35)); panel('y', y, x0, x1, z0, z1); }
  if (roofs.length) {
    begin(next(0.5), { dashed: true });
    for (const [x0, , x1, z1, y = ROOF] of roofs) {
      for (const x of [x0, x1]) {
        const top = posts.get(`${x},${z1}`);
        if (top !== undefined) line(x, top + 0.12, z1, x, y - 0.08, z1);
      }
    }
  }

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
  return segs;
}

// Floor lines: two along X flush with the back and front of the footprint, two
// along Z flush with its left and right. Each draws itself in across the view
// (its end sliding out from one side), then reaches far past the screen.
const F = C.floor;
let floorLines = [];
function makeFloorLines() {
  const [x0, z0, x1, z1] = footprint;
  const mat = new LineMaterial({ color: C.ink, linewidth: C.lineWidth });
  lineMats.push(mat);
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  floorLines = [{ along: 'x', z: z0 }, { along: 'x', z: z1 }, { along: 'z', x: x0 }, { along: 'z', x: x1 }].map((l, i) => {
    const obj = new LineSegments2(new LineSegmentsGeometry(), mat);
    obj.visible = false;
    scene.add(obj);
    return { ...l, mid, obj, at: F.start + i * F.stagger, done: false };
  });
}
// points at distance a and b along the line
const floorPoints = (l, a, b) => (l.along === 'x'
  ? [l.mid[0] + a, 0, l.z, l.mid[0] + b, 0, l.z]
  : [l.x, 0, l.mid[1] + a, l.x, 0, l.mid[1] + b]);
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
function updateFloor(time) {
  for (const l of floorLines) {
    if (l.done) continue;
    const u = Math.min(1, (time - l.at) / F.draw);
    l.obj.visible = u > 0;
    if (u <= 0) continue;
    if (u < 1) l.obj.geometry.setPositions(floorPoints(l, -F.reach, -F.reach + 2 * F.reach * easeInOut(u)));
    else { l.obj.geometry.setPositions(floorPoints(l, -F.far, F.far)); l.done = true; }   // off-screen swap
  }
}

// Build-in: each piece falls from above (accelerating), fading in as it starts,
// lands in place with a small settle. Dotted lines just fade in, no fall.
const B = C.build;
function updateBuild(time) {
  for (const p of pieces) {
    const u = (time - B.start - p.at) / B.fall;
    p.group.visible = u > 0;
    if (u <= 0) continue;
    p.mat.opacity = Math.min(1, u * B.fall / B.fadeIn);
    if (p.dashed) continue;
    let y = 0;
    if (u < 1) y = B.drop * (1 - u * u);             // falling under gravity
    else {
      const v = (time - B.start - p.at - B.fall) / B.settle;
      if (v < 1) y = B.bounce * Math.sin(Math.PI * v) * (1 - v);   // tiny settle after landing
    }
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

function frameCamera() {
  const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
  const half = radius * C.fill / Math.min(1, aspect);   // fit the structure's sphere, landscape or portrait
  camera.top = half; camera.bottom = -half;
  // landscape: slide the frame left so the structure sits right of centre,
  // leaving the left side clear for the H1
  const shift = aspect > 1 ? C.offsetX * 2 * half * aspect : 0;
  camera.left = -half * aspect - shift; camera.right = half * aspect - shift;
  camera.updateProjectionMatrix();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  frameCamera();
  const px = renderer.getPixelRatio();
  for (const m of lineMats) {
    m.resolution.set(w * px, h * px);
    m.linewidth = C.lineWidth * px;
  }
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Switching: clear the scene, build the new formation and play its build-in
// from the top (the orbit carries on).
// ---------------------------------------------------------------------------
const clock0 = performance.now() / 1000;
let buildAt = 0, formation = 0;
function show(i, { snap = false } = {}) {
  for (const obj of [...pieces.map(p => p.group), ...floorLines.map(l => l.obj)]) {
    scene.remove(obj);
    obj.traverse(o => o.geometry?.dispose());
  }
  for (const m of lineMats) m.dispose();
  pieces = []; lineMats = []; floorLines = [];
  formation = i;
  const segs = buildFormation(FORMATIONS[i]);
  makeFloorLines();
  const bounds = new THREE.Box3().setFromArray(segs);
  bounds.getCenter(targetCentre);
  targetRadius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  if (snap) { centre.copy(targetCentre); radius = targetRadius; }
  buildAt = performance.now() / 1000 - clock0;
  resize();
  for (const btn of document.querySelectorAll('#formations button')) btn.setAttribute('aria-pressed', String(+btn.dataset.i === i));
}

// formation buttons (1-10), and ?formation= in the URL so a layout can be linked
const bar = document.getElementById('formations');
FORMATIONS.forEach((f, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.i = i;
  btn.textContent = `${i + 1} ${f.name}`;
  btn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('formation', i + 1);
    history.replaceState(null, '', url);
    show(i);
  });
  bar.appendChild(btn);
});
bar.style.display = 'flex';
const asked = parseInt(new URLSearchParams(location.search).get('formation'), 10);
show(asked >= 1 && asked <= FORMATIONS.length ? asked - 1 : 0, { snap: true });

let mx = 0, my = 0, tmx = 0, tmy = 0;
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  tmx = (e.clientX / window.innerWidth) * 2 - 1;
  tmy = (e.clientY / window.innerHeight) * 2 - 1;
});
document.documentElement.addEventListener('pointerleave', () => { tmx = tmy = 0; });

let last = clock0, frozen = null;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000, dt = Math.min(now - last, 0.05);
  last = now;
  const clock = now - clock0;
  const time = frozen ?? clock - buildAt;
  const k = 1 - Math.exp(-3 * dt);
  mx += (tmx - mx) * k; my += (tmy - my) * k;
  const kf = frozen === null ? 1 - Math.exp(-C.reframe * dt) : 1;
  centre.lerp(targetCentre, kf);
  radius += (targetRadius - radius) * kf;
  frameCamera();
  updateFloor(time);
  updateBuild(time);
  const az = THREE.MathUtils.degToRad(C.azimuth + C.orbitSpeed * (frozen ?? clock) + mx * C.mouseTilt[0]);
  const el = THREE.MathUtils.degToRad(C.elevation - my * C.mouseTilt[1]);
  camera.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(60).add(centre);
  camera.lookAt(centre);
  renderer.render(scene, camera);
}
frame();

// Debug: structureDebug.freeze(seconds) holds the build (and orbit) at that
// moment, structureDebug.show(n) switches to formation n (1-10),
// structureDebug.replay() plays it again, structureDebug.buildEnd() when it finishes.
window.structureDebug = {
  freeze: s => { frozen = s; for (const l of floorLines) l.done = false; },
  show: n => show(n - 1, { snap: true }),
  replay: () => { frozen = null; show(formation); },
  buildEnd: () => B.start + Math.max(...pieces.map(p => p.at)) + B.fall + B.settle,
  formations: FORMATIONS.map(f => f.name),
};

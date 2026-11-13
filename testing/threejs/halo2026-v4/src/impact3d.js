// Impact & Sustainability card background (mock assets/ref-impact.webp): an isometric scene in three.js, a faint
// floor grid with simple line-drawn formations (hidden-line look, like the Kit card), and the camera panning slowly
// across it. The scene repeats every TILE units in both floor directions and the pan wraps on that, so it runs forever
// with no jump. Renders only while the card is on screen.
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';

const container = document.querySelector('#impact .im-3d');
if (container) {
  const C = {
    bg: 0x181818,          // card colour, also the fill that hides lines behind faces
    grid: 0x343434,        // floor grid lines
    ink: 0x7c7c78,         // formation outlines
    gridStep: 2,           // floor grid spacing in world units (mock: big, sparse diamonds)
    lineWidth: 1,          // CSS px
    elevation: 35.264,     // true isometric
    azimuth: 45,
    view: 30,              // world units visible across the card (bigger = smaller grid)
    tile: 32,              // the scene repeats every this many units in x and z (bigger = sparser formations)
    speed: 0.45,           // pan speed, world units per second, along the floor's X grid lines (screen-diagonal, James)
    orbit: [7, 3.5],       // degrees the cursor swings the camera round / up-down at the window edge (gives the 3D away)
    orbitEase: 2.5,        // how quickly the camera follows the cursor (per second)
  };
  const size = () => [Math.max(1, container.clientWidth), Math.max(1, container.clientHeight)];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(...size());
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);

  // ---- line + fill helpers --------------------------------------------------------------------------------------
  const mats = [];
  const lineMat = (color, opacity = 1) => { const m = new LineMaterial({ color, linewidth: C.lineWidth, transparent: opacity < 1, opacity }); mats.push(m); return m; };
  const fill = new THREE.MeshBasicMaterial({ color: C.bg, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const segs = [];               // formation outlines (all tiles)
  const edgesOf = (geo, matrix) => {
    const pos = new THREE.EdgesGeometry(geo, 1).attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(matrix); segs.push(v.x, v.y, v.z); }
  };
  function box(ox, oz, x0, y0, z0, x1, y1, z1) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(geo, fill);
    m.position.set(ox + (x0 + x1) / 2, (y0 + y1) / 2, oz + (z0 + z1) / 2);
    m.updateMatrix(); scene.add(m);
    edgesOf(geo, m.matrix);
  }
  const line = (ox, oz, x0, y0, z0, x1, y1, z1) => segs.push(ox + x0, y0, oz + z0, ox + x1, y1, oz + z1);

  // ---- the formations (one tile's worth, in tile coordinates 0..TILE) ------------------------------------------
  // simple kit pieces like the mock: a deck on legs, stepped cubes with a post, a crate, a low platform, a frame
  const FORMS = [
    // spread over the 32-unit tile, each sitting on grid lines (even numbers)
    (ox, oz) => {            // deck on four legs
      box(ox, oz, 2, 1.8, 4, 6, 2.0, 8);
      for (const [x, z] of [[2.15, 4.15], [5.85, 4.15], [2.15, 7.85], [5.85, 7.85]]) line(ox, oz, x, 0, z, x, 1.8, z);
    },
    (ox, oz) => {            // stepped cubes (the two loose posts beside them were removed: James, they read as stray lines)
      box(ox, oz, 20, 0, 2, 22, 2, 4);
      box(ox, oz, 21, 2, 2, 23, 4, 4);
    },
    (ox, oz) => box(ox, oz, 6, 0, 20, 10, 2.4, 23),            // crate
    (ox, oz) => box(ox, oz, 22, 0, 18, 26, 1.0, 22),           // low platform
    // a solid bench (was an open frame: two loose posts + a beam, whose posts read as stray lines when the beam was
    // hidden behind a pill)
    (ox, oz) => box(ox, oz, 13, 0, 10, 15, 1.2, 14),
    (ox, oz) => {            // small cube pair
      box(ox, oz, 28, 0, 28, 30, 2, 30); box(ox, oz, 30, 0, 28, 32, 2, 30);
    },
  ];
  const T = C.tile;
  for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) for (const f of FORMS) f(tx * T, tz * T);
  const formLines = new LineSegments2(new LineSegmentsGeometry().setPositions(segs), lineMat(C.ink));
  scene.add(formLines);

  // floor grid: every gridStep units, covering 3x3 tiles (gridStep divides TILE, so the wrap stays seamless)
  const g = [], R = 1.5 * T;
  for (let k = -R; k <= R; k += C.gridStep) { g.push(k, 0, -R, k, 0, R); g.push(-R, 0, k, R, 0, k); }
  const grid = new LineSegments2(new LineSegmentsGeometry().setPositions(g), lineMat(C.grid));
  grid.renderOrder = -1;
  scene.add(grid);

  // ---- camera ----------------------------------------------------------------------------------------------------
  // the pan runs along the floor's X grid lines, so on screen it moves diagonally at exactly the lines' angle
  const pan = new THREE.Vector3(1, 0, 0);
  const dir = new THREE.Vector3();
  // cursor (eased, -1..1 across the window, mouse only): swings the camera round a little
  let mx = 0, my = 0, tmx = 0, tmy = 0, lastNow = 0;
  addEventListener('pointermove', e => { if (e.pointerType && e.pointerType !== 'mouse') return; tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { tmx = tmy = 0; });
  function frame() {
    const [w, h] = size(), half = C.view / 2, aspect = w / h;
    camera.left = -half; camera.right = half; camera.top = half / aspect; camera.bottom = -half / aspect;
    camera.updateProjectionMatrix();
    const px = renderer.getPixelRatio();
    for (const m of mats) { m.resolution.set(w * px, h * px); m.linewidth = C.lineWidth * px; }
  }
  function resize() { renderer.setSize(...size()); renderer.domElement.style.width = renderer.domElement.style.height = '100%'; frame(); }
  new ResizeObserver(resize).observe(container);
  frame();

  // after one TILE along x the scene looks exactly the same (it repeats every tile): wrap there, seamlessly
  const wrap = T;
  const centre = new THREE.Vector3(T / 2, 0, T / 2);
  let visible = false, raf = 0, t0 = performance.now(), frozen = null;
  function render(now) {
    const t = frozen ?? (now - t0) / 1000;
    const dt = Math.min((now - (lastNow || now)) / 1000, 0.05); lastNow = now;
    const k = 1 - Math.exp(-C.orbitEase * dt);
    mx += (tmx - mx) * k; my += (tmy - my) * k;
    const s = (t * C.speed) % wrap;
    const target = centre.clone().addScaledVector(pan, s - wrap / 2);
    const el = THREE.MathUtils.degToRad(C.elevation - my * C.orbit[1]), az = THREE.MathUtils.degToRad(C.azimuth + mx * C.orbit[0]);
    dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.copy(target).addScaledVector(dir, 100);
    camera.lookAt(target);
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(render) : 0;
    if (!raf) lastNow = 0;
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(render); }).observe(container);

  window.impactDebug = { C, freeze: s => { frozen = s; if (!raf) raf = requestAnimationFrame(render); }, play: () => { frozen = null; },
    mouse: (x, y) => { tmx = mx = x; tmy = my = y; } };   // debug: -1..1, no easing
}

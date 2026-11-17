// Testimonial speech bubble (James): the isometric bubble from the Figma artwork as a live three.js object, black
// outlines on the lime (hidden edges removed by lime faces), three dots on the face, turning slowly about its
// vertical axis. Renders into .tm-bubble; only animates while the section is on screen.
import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/lines/LineMaterial.js';

const box = document.querySelector('.tm-bubble');
if (box) {
  const K = {
    lime: 0xE6FF00, ink: 0x191919,
    line: 1.2,          // outline width (CSS px)
    turn: 14,           // seconds per full turn
    w: 3, h: 2.1,       // bubble face (units)
    depth: 0.45,        // thickness
    tail: [[0.62, 0], [0.42, -0.62], [0.22, 0]],   // the tail's triangle on the bottom edge (from right to left)
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  box.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  cam.position.set(10, 8.2, 10);    // classic isometric view
  cam.lookAt(0, 0, 0);

  // the bubble outline: rectangle with the tail cut down out of its bottom edge
  const { w, h, depth } = K;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  K.tail.slice().reverse().forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(w, 0); shape.lineTo(w, h); shape.lineTo(0, h); shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(-w / 2, -h / 2 + 0.15, -depth / 2);

  const group = new THREE.Group();
  scene.add(group);
  // lime faces, pushed back a touch so the outlines always win the depth test
  const faces = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: K.lime, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  group.add(faces);
  const edges = new THREE.EdgesGeometry(geo, 20);
  const lg = new LineSegmentsGeometry().setPositions(edges.attributes.position.array);
  const lineMat = new LineMaterial({ color: K.ink, linewidth: K.line });
  group.add(new LineSegments2(lg, lineMat));

  // three dots on the front and back faces, rising left to right like the artwork
  const dotGeo = new THREE.CircleGeometry(0.25, 40);
  dotGeo.scale(0.78, 1, 1);
  const dotMat = new THREE.MeshBasicMaterial({ color: K.ink, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    [-0.62, 0, 0.62].forEach((x, i) => {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(x * side, -0.12 + (i - 1) * 0.06 + 0.15, side * (depth / 2 + 0.002));
      if (side < 0) d.rotation.y = Math.PI;
      group.add(d);
    });
  }

  // fit the camera to the bubble whatever the turn: frame its bounding sphere
  const r = Math.hypot(w / 2, h / 2 + 0.6, depth / 2) * 0.82;   // a turning bubble never shows its full diagonal at once
  function size() {
    const W = Math.max(1, box.clientWidth), H = Math.max(1, box.clientHeight), a = W / H;
    renderer.setSize(W, H, false);
    if (a >= 1) Object.assign(cam, { left: -r * a, right: r * a, top: r, bottom: -r });
    else Object.assign(cam, { left: -r, right: r, top: r / a, bottom: -r / a });
    cam.updateProjectionMatrix();
    lineMat.resolution.set(W, H);
  }
  new ResizeObserver(size).observe(box);
  size();

  let on = false, last = 0, angle = -0.35;
  new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) { last = 0; requestAnimationFrame(tick); } }, { rootMargin: '100px' }).observe(box);
  function tick(now) {
    if (!on) return;
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    angle += dt * (Math.PI * 2 / K.turn);
    group.rotation.y = angle;
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  renderer.render(scene, cam);
  window.haloBubble = { K, group };
}

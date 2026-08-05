import * as THREE from 'three';
import { CONFIG as C } from './config.js';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, C.maxDpr));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.background);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// ---------------------------------------------------------------------------
// Base tile geometry: a thin triangular prism, centroid at origin, top at y=0.
// Up-pointing (apex toward -Z); the flipped variant is a PI rotation about Y.
// ---------------------------------------------------------------------------
const side = C.tileSide;
const rowH = side * Math.sqrt(3) / 2;
const g = C.gapScale;
const th = C.thickness;

// top-face corners (relative to centroid, shrunk for the gap)
const A = new THREE.Vector3(-side / 2 * g, 0, rowH / 3 * g);
const B = new THREE.Vector3(side / 2 * g, 0, rowH / 3 * g);
const P = new THREE.Vector3(0, 0, -2 * rowH / 3 * g); // apex
const A2 = A.clone().setY(-th), B2 = B.clone().setY(-th), P2 = P.clone().setY(-th);

function pushTri(arr, a, b, c) { arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); }

const fillPos = [];
pushTri(fillPos, A, B, P);      // top
pushTri(fillPos, A2, P2, B2);   // bottom
pushTri(fillPos, A, P, A2); pushTri(fillPos, P, P2, A2);  // side A-P
pushTri(fillPos, P, B, P2); pushTri(fillPos, B, B2, P2);  // side P-B
pushTri(fillPos, B, A, B2); pushTri(fillPos, A, A2, B2);  // side B-A

const linePos = [];
function pushSeg(a, b) { linePos.push(a.x, a.y, a.z, b.x, b.y, b.z); }
pushSeg(A, B); pushSeg(B, P); pushSeg(P, A);        // top rim
pushSeg(A2, B2); pushSeg(B2, P2); pushSeg(P2, A2);  // bottom rim
pushSeg(A, A2); pushSeg(B, B2); pushSeg(P, P2);     // verticals

// ---------------------------------------------------------------------------
// Instancing: one slot per tile, animated entirely in the vertex shader.
// ---------------------------------------------------------------------------
const totalRows = C.rowsAhead + C.rowsBehind;
const N = totalRows * C.cols;

const aTarget = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
const aRot = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
const aSpawn = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
const aRand = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
aTarget.setUsage(THREE.DynamicDrawUsage);
aSpawn.setUsage(THREE.DynamicDrawUsage);
aRand.setUsage(THREE.DynamicDrawUsage);

function makeInstanced(basePositions) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(basePositions, 3));
  geo.setAttribute('aTarget', aTarget);
  geo.setAttribute('aRot', aRot);
  geo.setAttribute('aSpawn', aSpawn);
  geo.setAttribute('aRand', aRand);
  geo.instanceCount = N;
  return geo;
}

const uniforms = {
  uTime: { value: 0 },
  uDropHeight: { value: C.dropHeight },
  uDropDur: { value: C.dropDuration },
  uTiltMax: { value: C.tiltMax },
  uDriftX: { value: C.driftX },
  uEasePow: { value: C.easePower },
  uFogNear: { value: C.fogNear },
  uFogFar: { value: C.fogFar },
};

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uDropHeight, uDropDur, uTiltMax, uDriftX, uEasePow;
  attribute vec3 aTarget;
  attribute float aRot;
  attribute float aSpawn;
  attribute vec3 aRand;
  varying float vFade;
  varying float vDist;

  void main() {
    float dur = uDropDur * (0.75 + 0.5 * aRand.x);
    float t = clamp((uTime - aSpawn) / dur, 0.0, 1.0);
    // displacement factor: 1 at spawn -> 0 when settled. Lower uEasePow keeps
    // tiles visibly offset for more of their travel; high values snap early.
    float f = pow(1.0 - t, uEasePow);

    // flip (up/down tessellation) about Y
    float cr = cos(aRot), sr = sin(aRot);
    vec3 p = vec3(cr * position.x + sr * position.z, position.y,
                  -sr * position.x + cr * position.z);

    // random tilt about local X while floating down, easing flat
    float tilt = f * uTiltMax * (aRand.y - 0.5) * 2.0;
    float ct = cos(tilt), st = sin(tilt);
    p = vec3(p.x, ct * p.y - st * p.z, st * p.y + ct * p.z);

    // collapse to a point until the tile has spawned
    p *= step(1e-4, t);

    vec3 world = aTarget + p;
    world.y += f * uDropHeight * (0.7 + 0.6 * aRand.z);
    world.x += f * uDriftX * (aRand.z - 0.5) * 2.0;

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vDist = -mv.z;
    vFade = smoothstep(0.0, 0.25, t);
    gl_Position = projectionMatrix * mv;
  }
`;

const fillMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({ uFill: { value: new THREE.Color(C.fillColor) } }, uniforms),
  vertexShader,
  fragmentShader: /* glsl */`
    uniform vec3 uFill;
    void main() { gl_FragColor = vec4(uFill, 1.0); }
  `,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
});

const lineMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({
    uLine: { value: new THREE.Color(C.lineColor) },
    uOpacity: { value: C.lineOpacity },
  }, uniforms),
  vertexShader,
  fragmentShader: /* glsl */`
    uniform vec3 uLine;
    uniform float uOpacity;
    uniform float uFogNear, uFogFar;
    varying float vFade;
    varying float vDist;
    void main() {
      float depthFade = 1.0 - smoothstep(uFogNear, uFogFar, vDist);
      float a = uOpacity * vFade * depthFade;
      if (a < 0.003) discard;
      gl_FragColor = vec4(uLine, a);
    }
  `,
  transparent: true,
});

const fillMesh = new THREE.Mesh(makeInstanced(fillPos), fillMat);
const lineMesh = new THREE.LineSegments(makeInstanced(linePos), lineMat);
fillMesh.frustumCulled = false;
lineMesh.frustumCulled = false;
scene.add(fillMesh, lineMesh);

// ---------------------------------------------------------------------------
// Row management: camera travels toward -Z; rows recycle from behind to ahead.
// ---------------------------------------------------------------------------
const floorWidth = (C.cols + 1) * side / 2;
const rowZ = new Float32Array(totalRows);
const apexDist = C.rowsAhead * rowH;   // triangle apex = far spawn line
let minZ = 0;
let camZ = 0;

function assignRow(row, z, now) {
  rowZ[row] = z;
  for (let k = 0; k < C.cols; k++) {
    const i = row * C.cols + k;
    const up = (k % 2 === 0);
    const x = (k + 1) * side / 2 - floorWidth / 2;
    const zc = z - (up ? rowH / 3 : 2 * rowH / 3);

    // Big-triangle footprint: a tile spawns when the triangle's edge sweeps
    // over it. The shape's half-width at distance d ahead of the camera is
    // triHalfWidth * (1 - d/apexDist), so a tile at |x| enters the shape when
    // the row is dEdge ahead; outside triHalfWidth it never spawns.
    const ax = Math.abs(x);
    let spawn = 1e9;
    if (ax < C.triHalfWidth) {
      const dEdge = apexDist * (1 - ax / C.triHalfWidth);
      spawn = now + ((camZ - z) - dEdge) / C.speed + Math.random() * C.dropStagger;
    }

    aTarget.array[i * 3] = x;
    aTarget.array[i * 3 + 1] = 0;
    aTarget.array[i * 3 + 2] = zc;
    aRot.array[i] = up ? 0 : Math.PI;
    aSpawn.array[i] = spawn;
    aRand.array[i * 3] = Math.random();
    aRand.array[i * 3 + 1] = Math.random();
    aRand.array[i * 3 + 2] = Math.random();
  }
  aTarget.needsUpdate = true;
  aRot.needsUpdate = true;
  aSpawn.needsUpdate = true;
  aRand.needsUpdate = true;
}

// initial floor: the spawn formula settles everything already inside the
// triangle and schedules the rest as its edges sweep outward
const startZ = C.rowsBehind * rowH;
for (let r = 0; r < totalRows; r++) {
  const z = startZ - r * rowH;
  assignRow(r, z, 0);
  if (z < minZ) minZ = z;
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  uniforms.uTime.value = t;

  camZ -= C.speed * dt;

  // recycle rows that fell behind the camera to the far edge
  const behindLimit = camZ + C.rowsBehind * rowH;
  for (let r = 0; r < totalRows; r++) {
    if (rowZ[r] > behindLimit) {
      const z = minZ - rowH;
      minZ = z;
      assignRow(r, z, t);
    }
  }

  const sway = Math.sin(t * Math.PI * 2 / C.swayPeriod) * C.swayAmp;
  const bob = Math.sin(t * Math.PI * 2 / C.bobPeriod) * C.bobAmp;
  camera.position.set(sway, C.camHeight + bob, camZ);
  camera.lookAt(sway * 0.4, C.lookHeight, camZ - C.lookAhead);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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

// Outline (top rim) and the 3D "lip" (bottom rim + verticals) are separate
// meshes: the lip's near-coincident horizontal lines moiré at distance, so
// it fades out much earlier than the main outline.
const outlineSegs = [[A, B], [B, P], [P, A]];
const lipSegs = [[A2, B2], [B2, P2], [P2, A2], [A, A2], [B, B2], [P, P2]];

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

function addInstanceAttrs(geo) {
  geo.setAttribute('aTarget', aTarget);
  geo.setAttribute('aRot', aRot);
  geo.setAttribute('aSpawn', aSpawn);
  geo.setAttribute('aRand', aRand);
  geo.instanceCount = N;
  return geo;
}

function makeFillGeo() {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3));
  return addInstanceAttrs(geo);
}

// Lines are drawn as screen-space quads (2 triangles per segment) so the
// fragment shader can feather their edges — raw GL lines get no AA and
// shimmer/flicker as they cross pixel rows while the camera moves.
// Vertex layout: position = segment start, aB = segment end,
// aCorner = (which endpoint, which side).
function makeLineGeo(segs) {
  const n = segs.length;
  const pos = new Float32Array(n * 6 * 3);
  const bArr = new Float32Array(n * 6 * 3);
  const corner = new Float32Array(n * 6 * 2);
  const pattern = [[0, -1], [0, 1], [1, 1], [0, -1], [1, 1], [1, -1]];
  segs.forEach(([a, b], i) => {
    for (let v = 0; v < 6; v++) {
      const j = i * 6 + v;
      pos[j * 3] = a.x; pos[j * 3 + 1] = a.y; pos[j * 3 + 2] = a.z;
      bArr[j * 3] = b.x; bArr[j * 3 + 1] = b.y; bArr[j * 3 + 2] = b.z;
      corner[j * 2] = pattern[v][0]; corner[j * 2 + 1] = pattern[v][1];
    }
  });
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aB', new THREE.BufferAttribute(bArr, 3));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  return addInstanceAttrs(geo);
}

const uRes = { value: renderer.getDrawingBufferSize(new THREE.Vector2()) };
const uWidthPx = { value: C.lineWidth * renderer.getPixelRatio() };

const uniforms = {
  uTime: { value: 0 },
  uDropHeight: { value: C.dropHeight },
  uDropDur: { value: C.dropDuration },
  uTiltMax: { value: C.tiltMax },
  uDriftX: { value: C.driftX },
  uEasePow: { value: C.easePower },
};

// shared per-tile animation, used by both fill and line vertex shaders
const animChunk = /* glsl */`
  uniform float uTime;
  uniform float uDropHeight, uDropDur, uTiltMax, uDriftX, uEasePow;
  attribute vec3 aTarget;
  attribute float aRot;
  attribute float aSpawn;
  attribute vec3 aRand;

  float tileT() {
    float dur = uDropDur * (0.75 + 0.5 * aRand.x);
    return clamp((uTime - aSpawn) / dur, 0.0, 1.0);
  }

  vec3 animateLocal(vec3 pos, float t) {
    // flip (up/down tessellation) about Y
    float cr = cos(aRot), sr = sin(aRot);
    vec3 p = vec3(cr * pos.x + sr * pos.z, pos.y, -sr * pos.x + cr * pos.z);
    // displacement factor: 1 at spawn -> 0 when settled
    float f = pow(1.0 - t, uEasePow);
    // random tilt about local X while floating in, easing flat
    float tilt = f * uTiltMax * (aRand.y - 0.5) * 2.0;
    float ct = cos(tilt), st = sin(tilt);
    p = vec3(p.x, ct * p.y - st * p.z, st * p.y + ct * p.z);
    // collapse to a point until the tile has spawned
    p *= step(1e-4, t);
    vec3 world = aTarget + p;
    world.y += f * uDropHeight * (0.7 + 0.6 * aRand.z);
    world.x += f * uDriftX * (aRand.z - 0.5) * 2.0;
    return world;
  }
`;

const fillMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({ uFill: { value: new THREE.Color(C.fillColor) } }, uniforms),
  vertexShader: animChunk + /* glsl */`
    void main() {
      vec3 world = animateLocal(position, tileT());
      gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uFill;
    void main() { gl_FragColor = vec4(uFill, 1.0); }
  `,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
});

const lineVert = animChunk + /* glsl */`
  attribute vec3 aB;
  attribute vec2 aCorner;
  uniform vec2 uResolution;
  uniform float uWidthPx;
  varying float vFade;
  varying float vDist;
  varying float vAcross;
  varying float vHalfW;

  void main() {
    float t = tileT();
    vec3 wa = animateLocal(position, t);
    vec3 wb = animateLocal(aB, t);
    vec4 ca = projectionMatrix * modelViewMatrix * vec4(wa, 1.0);
    vec4 cb = projectionMatrix * modelViewMatrix * vec4(wb, 1.0);

    // expand the segment into a quad in screen space, half a pixel of
    // feather beyond the nominal width for analytic anti-aliasing
    vec2 sa = ca.xy / max(ca.w, 1e-4) * uResolution * 0.5;
    vec2 sb = cb.xy / max(cb.w, 1e-4) * uResolution * 0.5;
    vec2 d = sb - sa;
    vec2 dir = d / max(length(d), 1e-4);
    vec2 nrm = vec2(-dir.y, dir.x);
    float halfW = 0.5 * uWidthPx + 1.0;

    // no end-cap extension: capped quads turn near-zero-length segments
    // (e.g. the prism's vertical edges seen from above) into visible dots
    vec4 clip = mix(ca, cb, aCorner.x);
    vec2 offPx = nrm * (aCorner.y * halfW);
    clip.xy += offPx * 2.0 / uResolution * clip.w;

    vAcross = aCorner.y * halfW;
    vHalfW = halfW;
    vec4 mv = modelViewMatrix * vec4(mix(wa, wb, 0.5), 1.0);
    vDist = -mv.z;
    vFade = smoothstep(0.0, 0.25, t);
    gl_Position = clip;
  }
`;

const lineFrag = /* glsl */`
  uniform vec3 uLine;
  uniform float uOpacity;
  uniform float uFogNear, uFogFar;
  varying float vFade;
  varying float vDist;
  varying float vAcross;
  varying float vHalfW;
  void main() {
    float depthFade = 1.0 - smoothstep(uFogNear, uFogFar, vDist);
    // soft coverage falloff over the outer ~1.5px of the quad
    float cov = clamp((vHalfW - abs(vAcross)) / 1.5, 0.0, 1.0);
    float a = uOpacity * vFade * depthFade * cov;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uLine, a);
  }
`;

// own fog uniforms per line set (uTime etc. stay shared via `uniforms`)
function makeLineMat(fogNear, fogFar) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, uniforms, {
      uLine: { value: new THREE.Color(C.lineColor) },
      uOpacity: { value: C.lineOpacity },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uResolution: uRes,
      uWidthPx: uWidthPx,
    }),
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,   // quad winding depends on screen-space direction
  });
}

const fillMesh = new THREE.Mesh(makeFillGeo(), fillMat);
const outlineMesh = new THREE.Mesh(makeLineGeo(outlineSegs), makeLineMat(C.fogNear, C.fogFar));
const lipMesh = new THREE.Mesh(makeLineGeo(lipSegs), makeLineMat(C.fogNear, C.fogFar));
fillMesh.frustumCulled = false;
outlineMesh.frustumCulled = false;
lipMesh.frustumCulled = false;
scene.add(fillMesh, outlineMesh, lipMesh);

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
  renderer.getDrawingBufferSize(uRes.value);
  uWidthPx.value = C.lineWidth * renderer.getPixelRatio();
});

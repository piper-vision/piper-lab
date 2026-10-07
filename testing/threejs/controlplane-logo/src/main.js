import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';
import { createArtifacts } from './artifacts.js';
import { buildWireLogo, makeHazeTexture } from './logoWire.js';
import { createParticles } from './particles.js';

const container = document.getElementById('scene');
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 100);

// Two scenes: the cube, then the logo drawn on top with depth cleared, so the
// cube's front edges never cut across the logo (matches the reference).
const cubeScene = new THREE.Scene();
cubeScene.background = new THREE.Color(CONFIG.background);
const logoScene = new THREE.Scene();

// ---------------------------------------------------------------- cube
const S = CONFIG.cube.size;
const h = S / 2;

// Isometric view: the cube's body diagonal points at the camera (the
// reference's regular hexagon) with one hexagon vertex straight up. That is a
// cube sitting flat on its bottom face, seen from above at ~35°.
const cubeSpin = new THREE.Group();   // optional extra spin about a world axis
const cubeOrient = new THREE.Group(); // isometric orientation + spin about the cube's own up axis
cubeSpin.add(cubeOrient);
cubeScene.add(cubeSpin);
cubeSpin.visible = CONFIG.cube.visible !== false; // logo keeps using the cube's frame either way
const cubeIso = new THREE.Quaternion();
// Cube-local axis through the bottom and top face centres. In the iso view
// the bottom face is the lower rhombus; its centre is the pivot.
const cubeUp = new THREE.Vector3(0, 1, 0);
{
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 0, 1));
  const v = new THREE.Vector3(-h, h, -h).applyQuaternion(q); // vertex on the +y face
  const roll = Math.PI / 2 - Math.atan2(v.y, v.x);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
  cubeIso.copy(qz.multiply(q));
  cubeOrient.quaternion.copy(cubeIso);
}

// Faces: additive haze, brightest at each face's border.
const D = CONFIG.cube.dots;
const faceMat = new THREE.ShaderMaterial({
  uniforms: {
    uBase: { value: CONFIG.cube.face.base },
    uGlow: { value: CONFIG.cube.face.glow },
    uFalloff: { value: CONFIG.cube.face.falloff },
    uOpacity: { value: CONFIG.cube.opacity },
    uPhase: { value: 0 },                 // 0..1 through the loop
    uDotCount: { value: D.count },
    uDotRadius: { value: D.radius },
    uDotBright: { value: D.brightness },
    uDotEdge: { value: D.edgeFalloff },
    uDotEdgeAmt: { value: D.edgeAmount },
    uDotPatch: { value: D.patchAmount },
    uDotPatchScale: { value: D.patchScale },
    uDotDrift: { value: D.drift },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    varying vec3 vN;
    varying float vFacing;
    void main() {
      vUv = uv;
      vN = normal;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vFacing = dot(normalize(normalMatrix * normal), normalize(-mv.xyz));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform float uBase, uGlow, uFalloff, uOpacity, uPhase;
    uniform float uDotCount, uDotRadius, uDotBright, uDotEdge, uDotEdgeAmt;
    uniform float uDotPatch, uDotPatchScale, uDotDrift;
    varying vec2 vUv;
    varying vec3 vN;
    varying float vFacing;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }

    void main() {
      vec2 e = min(vUv, 1.0 - vUv);
      float d = min(e.x, e.y);
      // soft border glow plus a gentle wider haze
      float g = uBase + uGlow * exp(-d / uFalloff) + uGlow * 0.25 * exp(-d / (uFalloff * 3.5));

      // ---- halftone dot grid (hex-offset rows), like a printed screen
      float faceId = dot(vN, vec3(1.0, 2.0, 3.0));        // distinct per face
      vec2 p = vUv * uDotCount;
      float row = floor(p.y);
      p.x += mod(row, 2.0) * 0.5;
      vec2 cellId = floor(p);
      vec2 f = fract(p) - 0.5;
      float r = length(f);

      // where dots show: strongest along the face borders, plus soft patches
      // drifting in a circle (periodic, so the loop stays seamless)
      float edgeMask = exp(-d / uDotEdge) * uDotEdgeAmt;
      float ang = uPhase * 6.2831853;
      vec2 drift = vec2(cos(ang), sin(ang)) * uDotDrift;
      float n = noise(vUv * uDotPatchScale + drift + faceId * 3.7);
      float patchM = smoothstep(0.45, 0.85, n) * uDotPatch;

      float mask = clamp(edgeMask + patchM, 0.0, 1.0);
      // dither: each dot has its own threshold, so sparse areas break up into
      // scattered dots rather than dimming uniformly
      float on = step(hash(cellId + faceId * 17.0), mask * 1.6);
      float rad = uDotRadius * sqrt(mask);                // halftone: dot size follows the mask
      float aa = fwidth(p.x) * 0.8;
      float dotv = (1.0 - smoothstep(rad - aa, rad + aa, r)) * on;

      // dots only on camera-facing faces (front and back grids would overlap
      // into moiré), fading out as a face turns edge-on
      float facing = gl_FrontFacing ? smoothstep(0.08, 0.45, vFacing) : 0.0;
      g += dotv * uDotBright * (0.4 + 0.6 * mask) * facing;
      gl_FragColor = vec4(vec3(g * uOpacity), 1.0);
    }`,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
  extensions: { derivatives: true },
});
cubeOrient.add(new THREE.Mesh(new THREE.BoxGeometry(S, S, S), faceMat));

// Edges: camera-facing ribbons drawn as a capsule distance field — a crisp
// anti-aliased core line plus a tight gaussian halo (a real bloom pass smears
// far too wide for the reference look). Brightness is set per frame from
// whether the edge is on the silhouette, the front or the back of the cube.
const edgeVert = /* glsl */`
  attribute vec2 aCorner;           // x: 0 = end A, 1 = end B; y: side -1..1
  uniform vec3 uA, uB;
  uniform float uPad;
  varying vec2 vP;                  // (along, across) in world units
  varying float vLen;
  void main() {
    vec4 a = modelViewMatrix * vec4(uA, 1.0);
    vec4 b = modelViewMatrix * vec4(uB, 1.0);
    vec2 d2 = b.xy - a.xy;
    float len = max(length(d2), 1e-5);
    vec2 dir = d2 / len;
    vec2 perp = vec2(-dir.y, dir.x);
    float s = aCorner.x * 2.0 - 1.0;
    vec4 p = mix(a, b, aCorner.x);
    p.xy += dir * s * uPad + perp * aCorner.y * uPad;
    vP = vec2(aCorner.x * len + s * uPad, aCorner.y * uPad);
    vLen = len;
    gl_Position = projectionMatrix * p;
  }`;
const edgeFrag = /* glsl */`
  uniform float uCore, uGlowWidth, uGlow, uBright, uOpacity;
  varying vec2 vP;
  varying float vLen;
  void main() {
    float beyond = max(0.0, max(-vP.x, vP.x - vLen));
    float d = length(vec2(beyond, vP.y));
    float fw = fwidth(d) * 0.75;
    float core = 1.0 - smoothstep(uCore - fw, uCore + fw, d);
    float g = d / uGlowWidth;
    float glow = uGlow * exp(-g * g) + uGlow * 0.35 * exp(-g * 0.9);
    float v = uBright * core + uBright * uBright * glow;
    gl_FragColor = vec4(vec3(v * uOpacity), 1.0);
  }`;

const edges = [];
{
  const E = CONFIG.cube.edgeStyle;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  for (let k = 0; k < 3; k++) {
    const a = (k + 1) % 3, b = (k + 2) % 3;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const mid = new THREE.Vector3();
      mid.setComponent(a, sa * h).setComponent(b, sb * h);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: mid.clone().addScaledVector(axes[k], -h) },
          uB: { value: mid.clone().addScaledVector(axes[k], h) },
          uPad: { value: E.glowWidth * 3.5 },
          uCore: { value: E.coreWidth },
          uGlowWidth: { value: E.glowWidth },
          uGlow: { value: E.glow },
          uBright: { value: 1 },
          uOpacity: { value: CONFIG.cube.opacity },
        },
        vertexShader: edgeVert,
        fragmentShader: edgeFrag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      cubeOrient.add(m);
      edges.push({
        mat,
        n1: axes[a].clone().multiplyScalar(sa), // the two faces this edge joins
        n2: axes[b].clone().multiplyScalar(sb),
      });
    }
  }
}

const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _toCam = new THREE.Vector3();
function updateEdgeBrightness() {
  cubeOrient.getWorldQuaternion(_q);
  _toCam.copy(camera.position).normalize();
  const { silhouette, front, back } = CONFIG.cube.edge;
  const max = 2 / Math.sqrt(3); // facing sum of an edge seen straight on the diagonal
  for (const e of edges) {
    const f = _n.copy(e.n1).applyQuaternion(_q).dot(_toCam) +
              _n.copy(e.n2).applyQuaternion(_q).dot(_toCam);
    const t = Math.min(1, Math.abs(f) / max);
    const b = f >= 0 ? silhouette + (front - silhouette) * t : silhouette + (back - silhouette) * t;
    e.mat.uniforms.uBright.value = b;
  }
}

// Digital artifacts flickering on the faces (they ride along with the spin).
const artifacts = CONFIG.artifacts.count > 0
  ? createArtifacts(cubeOrient, S, CONFIG.loopSeconds, CONFIG.artifacts) : null;

// ---------------------------------------------------------------- logo
// The logo stands upright on its bottom edge in the same frame as the cube
// (so the camera looks down on it at the same ~35°) and spins on the cube's
// up axis, pivoting on the centre of its bottom edge.
const logoFrame = new THREE.Group();  // same orientation as the un-spun cube
logoFrame.quaternion.copy(cubeIso);
const logoSpin = new THREE.Group();   // spins about the frame's (cube's) up axis
const logoTilt = new THREE.Group();   // the logo body, offset so its pivot sits on the axis
logoFrame.add(logoSpin);
logoSpin.add(logoTilt);
(CONFIG.logo.alwaysInFront ? logoScene : cubeScene).add(logoFrame);

// Spin angle at t=0: the logo faces the camera, turned by CONFIG.logo.facing
// degrees so its bottom edge's right end comes towards the viewer.
const logoBaseAngle = (() => {
  const inv = cubeIso.clone().invert();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(inv).setY(0).normalize();
  const toward = new THREE.Vector3(0, 0, 1).applyQuaternion(inv).setY(0).normalize();
  const f = THREE.MathUtils.degToRad(CONFIG.logo.facing);
  const x = right.multiplyScalar(Math.cos(f)).addScaledVector(toward, Math.sin(f));
  return Math.atan2(-x.z, x.x); // rotation about +Y that takes (1,0,0) to x
})();

const pmrem = new THREE.PMREMGenerator(renderer);
logoScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
cubeScene.environment = logoScene.environment;
const key = new THREE.DirectionalLight(0xffffff, 0.4);
key.position.set(-2, 3, 4);
const rim = new THREE.DirectionalLight(0xffffff, 0.2);
rim.position.set(3, -1, 2);
logoScene.add(key, rim);
if (!CONFIG.logo.alwaysInFront) cubeScene.add(key.clone(), rim.clone());

const M = CONFIG.logo.material;
// Halftone dots on the glass logo, same pitch and treatment as the cube's.
// Shared uniforms; the SVG-mapping values are filled in once the SVG loads.
const GD = CONFIG.logo.glassDots, CD = CONFIG.cube.dots;
const glassDotU = {
  uHaze: { value: null },
  uOrigin: { value: new THREE.Vector3() },
  uK: { value: 1 },
  uFlip: { value: new THREE.Vector2(1, -1) },
  uBox: { value: new THREE.Vector2(1, 1) },
  uPhase: { value: 0 },
  uDotCount: { value: CD.count / CONFIG.cube.size },
  uDotRadius: { value: GD.radius ?? CD.radius },
  uDotBright: { value: GD.brightness },
  uDotEdgeAmt: { value: GD.edgeAmount ?? CD.edgeAmount },
  uDotPatch: { value: GD.patchAmount ?? CD.patchAmount },
  uDotPatchScale: { value: GD.patchScale ?? CD.patchScale },
  uDotDrift: { value: GD.drift ?? CD.drift },
  uDotCycles: { value: GD.cycles ?? 1 },
};
const glassDotHead = /* glsl */`
  uniform sampler2D uHaze;
  uniform vec3 uOrigin;
  uniform vec2 uFlip, uBox;
  uniform float uK, uPhase, uDotOn;
  uniform float uDotCount, uDotRadius, uDotBright, uDotEdgeAmt, uDotPatch, uDotPatchScale, uDotDrift, uDotCycles;
  varying vec3 vLocalPos, vLocalN;
  float gdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gdNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(gdHash(i), gdHash(i + vec2(1, 0)), f.x),
               mix(gdHash(i + vec2(0, 1)), gdHash(i + vec2(1, 1)), f.x), f.y);
  }
`;
const glassDotBody = /* glsl */`
  if (uDotOn > 0.5) {
    float capness = smoothstep(0.6, 0.9, abs(vLocalN.z));
    vec2 svg = vec2((vLocalPos.x - uOrigin.x) * uFlip.x, (vLocalPos.y - uOrigin.y) * uFlip.y) / uK;
    float B = texture2D(uHaze, vec2(svg.x / uBox.x, 1.0 - svg.y / uBox.y)).r;
    float edgeF = clamp((1.0 - B) * 2.0, 0.0, 1.0) * capness;
    // dot-grid coordinates: front/back faces use the logo plane (x, y); side
    // walls and bevels use (distance along the wall, depth), so every
    // surface carries the same dot pitch
    vec2 wallT = normalize(vec2(-vLocalN.y, vLocalN.x) + 1e-5);
    vec2 uvw = abs(vLocalN.z) > 0.7 ? vLocalPos.xy : vec2(dot(vLocalPos.xy, wallT), vLocalPos.z);
    vec2 p = uvw * uDotCount;
    p.x += mod(floor(p.y), 2.0) * 0.5;
    vec2 cellId = floor(p) + (abs(vLocalN.z) > 0.7 ? 0.0 : 57.0);
    float r = length(fract(p) - 0.5);
    // patches of dots sweep across the whole shape; uDotCycles whole turns of
    // the drift per loop keeps it seamless
    float ang = uPhase * 6.2831853 * uDotCycles;
    vec2 q = vLocalPos.xy * uDotPatchScale + vLocalPos.z * 3.0;
    float nz = gdNoise(q + vec2(cos(ang), sin(ang)) * uDotDrift + 5.3)
             * 0.65 + gdNoise(q * 2.1 - vec2(sin(ang), cos(ang)) * uDotDrift * 1.7 + 1.7) * 0.35;
    float mask = clamp(edgeF * uDotEdgeAmt + smoothstep(0.42, 0.72, nz) * uDotPatch, 0.0, 1.0);
    float on = step(gdHash(cellId + 31.0), mask * 1.6);
    float rad = uDotRadius * sqrt(mask);
    float aa = fwidth(p.x) * 0.8;
    float dotv = (1.0 - smoothstep(rad - aa, rad + aa, r)) * on;
    float facing = smoothstep(0.08, 0.45, abs(dot(normal, normalize(vViewPosition))));
    float dv = dotv * uDotBright * (0.4 + 0.6 * mask) * facing;
    gl_FragColor.rgb += dv;
    gl_FragColor.a = min(1.0, gl_FragColor.a + dv);
  }
`;
// Frosted see-through body: low base opacity, whiter and more opaque at
// glancing angles (fresnel), so faces read as shaded glass, not solid white.
function makeLogoMat(side) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: M.color,
    emissive: M.emissive,
    roughness: M.roughness,
    metalness: 0,
    clearcoat: M.clearcoat,
    clearcoatRoughness: M.clearcoatRoughness,
    envMapIntensity: M.envMapIntensity,
    transparent: true,
    opacity: M.opacity,
    side,
    depthWrite: side === THREE.FrontSide,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: M.rim };
    sh.uniforms.uRimOpacity = { value: M.rimOpacity };
    sh.uniforms.uRimPower = { value: M.rimPower };
    sh.uniforms.uRimStart = { value: M.rimStart ?? 0 };
    Object.assign(sh.uniforms, glassDotU, { uDotOn: { value: side === THREE.FrontSide && GD.enabled ? 1 : 0 } });
    sh.vertexShader = 'varying vec3 vLocalPos, vLocalN;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n  vLocalPos = position;\n  vLocalN = normal;');
    sh.fragmentShader = 'uniform float uRim, uRimOpacity, uRimPower, uRimStart;\n' + glassDotHead + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      // rim only past uRimStart, so the flat faces (seen at an angle from
      // above) stay dark and only bevels/sides catch the highlight
      float fr = pow(clamp((1.0 - abs(dot(normal, normalize(vViewPosition))) - uRimStart) / (1.0 - uRimStart), 0.0, 1.0), uRimPower);
      gl_FragColor.rgb += uRim * fr;
      gl_FragColor.a = min(1.0, gl_FragColor.a + uRimOpacity * fr);
      ` + glassDotBody);
  };
  return mat;
}
const logoMat = makeLogoMat(THREE.FrontSide);
const logoBackMat = makeLogoMat(THREE.BackSide);

new SVGLoader().load(CONFIG.logo.svg, (data) => {
  const shapes = data.paths.flatMap((p) => p.toShapes(true));
  const wire = CONFIG.logo.style === 'wire';
  // wire style uses a near-square slab edge so the outline reads crisply
  const L = wire ? { ...CONFIG.logo, bevelThickness: CONFIG.logo.wire.bevel, bevelSize: CONFIG.logo.wire.bevel, bevelSegments: 2 } : CONFIG.logo;
  let geo = new THREE.ExtrudeGeometry(shapes, {
    depth: L.depth,
    bevelEnabled: true,
    bevelThickness: L.bevelThickness,
    bevelSize: L.bevelSize,
    bevelOffset: -L.bevelSize, // keep the outer outline true to the SVG
    bevelSegments: L.bevelSegments,
    curveSegments: 16,
  });
  geo.rotateX(Math.PI); // SVG y is down; rotating (not mirroring) keeps winding
  geo.computeBoundingBox();
  const c0 = geo.boundingBox.getCenter(new THREE.Vector3());
  geo.center();
  const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
  const k = L.width / w;
  geo.scale(k, k, k);
  // SVG (x, y, z along the extrusion) -> logo-local, matching the transforms above
  const toLocal = (x, y, z) => new THREE.Vector3(x, -y, -z).sub(c0).multiplyScalar(k);
  geo = toCreasedNormals(geo, Math.PI / 4);
  // pivot = centre of the bottom edge; lift so the logo is centred in the cube
  geo.computeBoundingBox();
  const bb = geo.boundingBox, H = bb.max.y - bb.min.y;
  const pos = geo.attributes.position;
  let bx0 = Infinity, bx1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < bb.min.y + H * 0.01) { bx0 = Math.min(bx0, pos.getX(i)); bx1 = Math.max(bx1, pos.getX(i)); }
  }
  // pivot x: 'center' = middle of the shape's width, so it swings evenly
  // left and right as it turns; 'bottomEdge' = middle of the bottom edge
  const px = L.pivot === 'bottomEdge' ? (bx0 + bx1) / 2 : (bb.min.x + bb.max.x) / 2;
  logoTilt.position.set(-px, -bb.min.y - H / 2 + (L.lift || 0), 0);
  if (wire) {
    const view = data.xml.viewBox?.baseVal;
    wireLogo = buildWireLogo({
      shapes, geo, toLocal, k,
      svgBox: { w: view?.width || w, h: view?.height || w },
      cfg: L, cube: CONFIG.cube, dots: CONFIG.cube.dots,
    });
    logoTilt.add(wireLogo.group);
  } else {
    const view = data.xml.viewBox?.baseVal;
    const box = { w: view?.width || w, h: view?.height || w };
    glassDotU.uHaze.value = makeHazeTexture(shapes, box, GD.hazeWidth);
    glassDotU.uOrigin.value.copy(toLocal(0, 0, 0));
    glassDotU.uK.value = k;
    glassDotU.uBox.value.set(box.w, box.h);
    // back faces first, then front faces, so the far side shows through
    const back = new THREE.Mesh(geo, logoBackMat);
    const front = new THREE.Mesh(geo, logoMat);
    back.renderOrder = 0;
    front.renderOrder = 1;
    logoTilt.add(back, front);
    if (L.halo.opacity > 0) logoTilt.add(halo = makeHalo(data, w, k));
  }
  // halftone dots breaking off the outline (outer contours only)
  if (CONFIG.logo.particles.count > 0) {
    const outline = shapes.map((sh) => sh.getPoints(16).map((p) => {
      const v = toLocal(p.x, p.y, 0);
      return new THREE.Vector2(v.x, v.y);
    }));
    particles = createParticles(outline, {
      gridCount: CONFIG.cube.dots.count / CONFIG.cube.size, // same pitch as the halftone
      dotRadius: (CONFIG.logo.glassDots.radius ?? CONFIG.cube.dots.radius) / (CONFIG.cube.dots.count / CONFIG.cube.size),
      depth: (L.depth + 2 * L.bevelThickness) * k,
      loopSeconds: CONFIG.loopSeconds,
      cfg: CONFIG.logo.particles,
    });
    // 'world' = dots stay where they came off while the logo turns away;
    // 'logo' = dots ride round with the logo
    (CONFIG.logo.particles.space === 'logo' ? logoTilt : logoFrame).add(particles.points);
  }
  if (CONFIG.logo.autoCenter) centerLoop();
  if (frozen !== null) render(frozen);
});

let halo = null;
let wireLogo = null;
let particles = null;

// Soft glow around the logo: the SVG path blurred onto a canvas, on a plane
// just behind the mesh. (A bloom pass blows the white logo out.)
function makeHalo(data, svgW, scale) {
  const { blur, opacity } = CONFIG.logo.halo;
  const view = data.xml.viewBox?.baseVal;
  const vw = view?.width || svgW, vh = view?.height || svgW;
  const pad = blur * 3;
  const px = 2; // canvas pixels per SVG unit
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((vw + pad * 2) * px);
  cv.height = Math.ceil((vh + pad * 2) * px);
  const ctx = cv.getContext('2d');
  ctx.filter = `blur(${blur * px}px)`;
  ctx.setTransform(px, 0, 0, px, pad * px, pad * px);
  ctx.fillStyle = '#fff';
  const paths = data.paths.map((p) => p.userData?.node?.getAttribute('d')).filter(Boolean).map((d) => new Path2D(d));
  for (const p2 of paths) ctx.fill(p2);
  // cut the shape itself out, so the glow sits only around the logo and
  // doesn't shine through the see-through glass and grey out its darks
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'destination-out';
  for (const p2 of paths) ctx.fill(p2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((vw + pad * 2) * scale, (vh + pad * 2) * scale),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
  // geo.center() centred the path's bounding box; centre the plane the same way
  const box = new THREE.Box2();
  for (const p of data.paths) for (const sp of p.subPaths) for (const pt of sp.getPoints()) box.expandByPoint(pt);
  const c = box.getCenter(new THREE.Vector2());
  mesh.position.set((vw / 2 - c.x) * scale, -(vh / 2 - c.y) * scale, -CONFIG.logo.depth * scale);
  return mesh;
}

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(cubeScene, camera));
const logoPass = new RenderPass(logoScene, camera);
logoPass.clear = false;
logoPass.clearDepth = true;
composer.addPass(logoPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1),
  CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
bloom.enabled = CONFIG.bloom.strength > 0;
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = container.clientWidth, hgt = container.clientHeight;
  if (!w || !hgt) return; // hidden / not laid out yet: keep the last good size
  renderer.setSize(w, hgt);
  composer.setSize(w, hgt);
  composer.setPixelRatio(renderer.getPixelRatio());
  camera.aspect = w / hgt;
  const halfH = Math.max(CONFIG.camera.fitHeight, CONFIG.camera.fitWidth / camera.aspect) / 2;
  camera.position.set(0, 0, halfH / Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fov / 2)));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
// ResizeObserver also catches the container getting its first real size
// (e.g. a pane that loads hidden), which a window 'resize' never reports
new ResizeObserver(() => {
  resize();
  // re-centre for the new camera/aspect (centring depends on both)
  if (CONFIG.logo.autoCenter && logoTilt.children.length) centerLoop();
  if (frozen !== null) render(frozen);
}).observe(container);
resize();

// ---------------------------------------------------------------- loop
const cubeAxis = CONFIG.cube.axis === 'face' ? null : new THREE.Vector3(...CONFIG.cube.axis).normalize();
const _qs = new THREE.Quaternion();
const _hn = new THREE.Vector3();
function render(seconds) {
  const phase = ((seconds % CONFIG.loopSeconds) / CONFIG.loopSeconds) * TAU;
  if (cubeAxis) cubeSpin.quaternion.setFromAxisAngle(cubeAxis, phase * CONFIG.cube.direction);
  else cubeOrient.quaternion.copy(cubeIso).multiply(_qs.setFromAxisAngle(cubeUp, phase * CONFIG.cube.direction));
  logoSpin.rotation.y = logoBaseAngle + phase * CONFIG.logo.direction;
  if (halo) { // fade the flat halo as the logo turns edge-on
    halo.getWorldDirection(_hn);
    halo.material.opacity = CONFIG.logo.halo.opacity * Math.abs(_hn.z);
  }
  updateEdgeBrightness();
  if (artifacts) artifacts.update(seconds);
  faceMat.uniforms.uPhase.value = phase / TAU;
  if (wireLogo) wireLogo.faceMat.uniforms.uPhase.value = phase / TAU;
  glassDotU.uPhase.value = phase / TAU;
  if (particles) particles.update(seconds, renderer.domElement.height,
    CONFIG.logo.particles.space === 'logo' ? null : {
      offset: logoTilt.position,
      angleAt: (t) => logoBaseAngle + (t / CONFIG.loopSeconds) * TAU * CONFIG.logo.direction,
    });
  composer.render();
}

// Shift the logo so the space it sweeps over one loop is centred in the
// frame (equal margins left/right and top/bottom in a screen recording).
function centerLoop() {
  if (!camera.position.z) return; // camera not placed yet (no size); the resize observer re-runs this
  camera.updateMatrixWorld();
  logoFrame.position.set(0, 0, 0);
  const e = window.logoDebug.extents(120);
  const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  logoFrame.position.x -= ((e.minX + e.maxX) / 2) * halfH * camera.aspect;
  logoFrame.position.y -= ((e.minY + e.maxY) / 2) * halfH;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let frozen = reduceMotion ? 0 : null;
const t0 = performance.now();
renderer.setAnimationLoop(() => {
  if (frozen === null) render((performance.now() - t0) / 1000);
});
if (frozen !== null) render(frozen);

// Debug hooks: logoDebug.freeze(2.5) pauses at t=2.5s; play() resumes;
// snap(t) renders synchronously and returns a JPEG data URL (works even when
// the tab is hidden and rAF is paused).
window.logoDebug = {
  freeze(t = 0) { frozen = t; render(t); },
  play() { frozen = null; },
  parts: { artifacts, bloom, logoMat, logoBackMat, faceMat, edges, renderer, key, rim, logoTilt, camera },
  // screen-space (NDC) extents of the logo over one loop: how far it swings
  // left/right/up/down. Symmetric framing = minX ≈ -maxX.
  extents(steps = 120) {
    const mesh = logoTilt.children.find((m) => m.isMesh && m.geometry.type === "ExtrudeGeometry") || logoTilt.children[0];
    const pos = mesh.geometry.attributes.position, v = new THREE.Vector3();
    const e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const keep = logoSpin.rotation.y;
    for (let s = 0; s < steps; s++) {
      // pose only (no draw), so this is cheap enough to run on every resize
      logoSpin.rotation.y = logoBaseAngle + (s / steps) * TAU * CONFIG.logo.direction;
      logoFrame.updateMatrixWorld(true);
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera);
        e.minX = Math.min(e.minX, v.x); e.maxX = Math.max(e.maxX, v.x);
        e.minY = Math.min(e.minY, v.y); e.maxY = Math.max(e.maxY, v.y);
      }
    }
    logoSpin.rotation.y = keep;
    logoFrame.updateMatrixWorld(true);
    return e;
  },
  snap(t = 0, q = 0.9) { frozen = t; render(t); return renderer.domElement.toDataURL('image/jpeg', q); },
};

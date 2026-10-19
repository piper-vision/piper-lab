import * as THREE from 'three';
import { initPanel } from './panel.js';
import { initDiag } from './diag.js';

const C = window.CONFIG;

// ---------------------------------------------------------------- renderer
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
let pixelRatio = Math.min(window.devicePixelRatio, C.quality.maxPixelRatio);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
// The transmission buffer has no MSAA; a 1px bright edge in it mips down into
// a beaded line when refracted. Supersampling it gives the blur a clean base.
renderer.transmissionResolutionScale = C.glass.transmissionScale;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = C.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(C.camera.fov, container.clientWidth / container.clientHeight, 0.1, 200);
function applyCamera() {
  camera.position.set(0, C.camera.height ?? 0.3, C.camera.distance);
  camera.lookAt(0, C.camera.lookAtY || 0, 0);
}
applyCamera();

// ---------------------------------------------------------------- background
// Rendered as a back-facing sphere inside the scene (not scene.background) so
// the transmissive glass actually refracts it.
const bgUniforms = {
  uTime:   { value: 0 },
  uBright: { value: new THREE.Color(C.colors.bright) },
  uDark:   { value: new THREE.Color(C.colors.dark) },
  uMid:    { value: new THREE.Color(C.colors.mid) },
  uScale:  { value: C.background.scale },
  uSpeed:  { value: C.background.speed },
  uWarp:   { value: C.background.warp },
  uBrightAmt: { value: C.background.brightAmount },
  uVignette:  { value: C.background.vignette },
};
const BG_OCTAVES = C.background.octaves;

const bgMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: bgUniforms,
  defines: { OCTAVES: BG_OCTAVES },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec3 vDir;
    uniform float uTime, uScale, uSpeed, uWarp, uBrightAmt, uVignette;
    uniform vec3 uBright, uDark, uMid;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < OCTAVES; i++) {
        v += a * noise(p);
        p = rot * p * 1.9 + 11.7;
        a *= 0.55;
      }
      return v;
    }

    void main() {
      // Flatten the view direction into a plane so the gradient reads as a
      // 2D wash behind the object rather than a textured sphere.
      vec2 p = (vDir.xy / (1.0 + vDir.z * 0.35)) * uScale;
      float t = uTime * uSpeed;

      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
      vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7, 9.2) + t * 1.3),
                    fbm(p + uWarp * q + vec2(8.3, 2.8) - t * 1.1));
      float f = fbm(p + uWarp * r);

      // dark -> mid across the body of the noise, bright where the warp folds
      // 3-octave fbm sits mostly in 0.3–0.65, so the thresholds are tight
      vec3 col = mix(uDark, uMid, smoothstep(0.28, 0.62, f));
      float glow = smoothstep(0.46, 0.72, f) * smoothstep(0.25, 0.65, r.x);
      col = mix(col, uBright, glow * uBrightAmt);

      // soft darkening toward the edges of view
      float edge = length(vDir.xy);
      col *= 1.0 - uVignette * smoothstep(0.35, 1.0, edge);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const background = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 32), bgMaterial);
background.renderOrder = -1;
scene.add(background);

// ---------------------------------------------------------------- environment
// A synthetic studio for the glass: a dim teal wash plus a few soft coloured
// lights. Every light is a plane with a radial alpha falloff, so what the
// near-flat band mirrors is a feathered pool of colour rather than a shape
// with an edge. The studio scene is kept alive so the attributes panel can
// edit a light and re-bake the reflection map on the fly.
const envStudio = (() => {
  const env = new THREE.Scene();

  const wash = new THREE.Mesh(
    new THREE.SphereGeometry(30, 16, 8),
    // Edge-free ambient: the base sheen on the faces.
    new THREE.MeshBasicMaterial({ color: new THREE.Color(C.glass.washColor[0], C.glass.washColor[1], C.glass.washColor[2]), side: THREE.BackSide })
  );
  env.add(wash);

  // Shared radial falloff: opaque centre -> transparent rim.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 256;
  const g = glowCanvas.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);

  // Soft light: a w x h plane facing the origin, colour in linear HDR units,
  // feathered by the radial texture. Oversized relative to the old hard
  // panels so the visible core is about the same while the edges bleed out.
  const lights = [];
  const softLight = (name, color, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, map: glowTex, transparent: true, side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.lookAt(new THREE.Vector3());
    env.add(m);
    lights.push({ name, mesh: m });
  };

  // Colours are ~117% of the earlier hard-panel values (the feathering itself removes a lot of energy).
  softLight('Amber key',      new THREE.Color(14.0, 6.4, 1.6),   10, 3.5, new THREE.Vector3(-6, 5, 4));
  softLight('Cyan kicker',    new THREE.Color(1.75, 7.0, 11.75), 11, 5,   new THREE.Vector3(7, -2, 5));
  softLight('Lavender pool',  new THREE.Color(3.9, 3.0, 6.55),    7, 7,   new THREE.Vector3(1, 6, -4));    // what sweeps the surface
  softLight('White overhead', new THREE.Color(5.5, 5.6, 6.0),    20, 20,  new THREE.Vector3(-3, 8, -1));   // the silvery "shine" (large plane = broad soft sheen, not a hot spot)
  softLight('Warm bounce',    new THREE.Color(10.5, 4.25, 1.2),   8, 8,   new THREE.Vector3(4, -7, -2));
  softLight('Aqua backdrop',  new THREE.Color(0.6, 2.1, 1.9),    14, 14,  new THREE.Vector3(0, 0, -12));
  softLight('Warm side band', new THREE.Color(11.7, 7.0, 3.0),    4, 14,  new THREE.Vector3(-9, -1, -3));

  const pmrem = new THREE.PMREMGenerator(renderer);
  let target = null;
  function rebuild() {
    const next = pmrem.fromScene(env, 0.02);
    if (target) target.dispose();
    target = next;
    scene.environment = target.texture;
  }
  rebuild();
  return { env, wash, lights, rebuild };
})();

// ---------------------------------------------------------------- glass
// Two modes. 'real' is physically-based transmission: three renders the scene
// behind the glass into a mipmapped buffer every frame and samples it three
// times per pixel for dispersion. On this thin flat band over a smooth
// gradient that refracted view is near-identical to plain transparency, so
// 'fake' skips transmission entirely and blends the surface at a fixed
// opacity, keeping the clearcoat / env reflections that give it the look.
const REAL_GLASS = C.glass.mode === 'real';
const glass = new THREE.MeshPhysicalMaterial({
  color: REAL_GLASS ? C.glass.tint : C.glass.fakeTint,
  metalness: 0,
  roughness: C.glass.roughness,
  transmission: REAL_GLASS ? 1 : 0,
  thickness: REAL_GLASS ? C.glass.thickness : 0,
  ior: C.glass.ior,
  dispersion: REAL_GLASS ? C.glass.dispersion : 0,
  iridescence: C.glass.iridescence,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [120, 420],
  clearcoat: 1,
  clearcoatRoughness: C.glass.clearcoatRoughness,   // 0.04 was mirror-sharp: a directional light then clips to a white blob
  specularIntensity: 1,
  envMapIntensity: C.glass.envIntensity,
  attenuationColor: new THREE.Color(C.glass.attenuation),
  attenuationDistance: C.glass.attenuationDistance,
  // FrontSide on purpose: with DoubleSide three draws the back faces into the
  // refraction buffer, and their thin bevel highlights bead up when blurred.
  side: THREE.FrontSide,
});

// ---------------------------------------------------------------- ribbons
// Each ribbon is a triangle strip along a wavy path: vertices alternate
// above/below the path, and every three consecutive vertices form one
// triangle. Triangles are rigid glass prisms (one shared geometry) that get
// re-posed onto their three path points each frame.
const R = C.ribbon;

// Isosceles prism: base along local +x, apex at +y, centroid at the origin,
// extrusion centred on z so the pose can flip without changing which side
// the thickness sits on.
// apexScale stretches the top point only (1 = the band's triangle); the studio
// prism uses a slightly taller one.
function buildTriangleGeometry(apexScale = 1) {
  const L = R.segment, W = R.width;
  const pts = [
    new THREE.Vector2(-L / 2, -W / 3),
    new THREE.Vector2( L / 2, -W / 3),
    new THREE.Vector2( 0,  2 * W / 3 * apexScale),
  ];
  const inset = R.gap * 0.5 + R.bevel;
  const shrunk = pts.map((p) => {
    const len = p.length();
    return p.clone().multiplyScalar(Math.max(len - inset * 1.6, 0) / len);
  });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(shrunk), {
    depth: R.extrude,
    bevelEnabled: true,
    bevelThickness: R.bevel,
    bevelSize: R.bevel,
    bevelSegments: 5,
    curveSegments: 4,
  });
  geo.translate(0, 0, -R.extrude / 2);
  geo.computeVertexNormals();
  return geo;
}
const triGeo = buildTriangleGeometry();

const triangles = [];   // one InstancedMesh per row
const ribbons = [];

function newBreakawayState() {
  return {
    phase: 'idle', t0: 0, hold: 0, distance: 0, k: 0,
    lateral: new THREE.Vector2(), tilt: new THREE.Vector2(),
  };
}

// Distance fade: the far end of the band dissolves into the background so it
// reads as continuing to infinity. Alpha is scaled by camera distance inside
// the physical shader (the background is already drawn underneath).
const fadeDepthUniform = { value: new THREE.Vector2(R.fadeDepth[0], R.fadeDepth[1]) };

// Light pulses: shared uniforms (see the underlay material) and the JS-side
// state that moves them. Each pulse is (family, line constant, head, length).
const PULSE_MAX = 12;
const pulseUniforms = {
  uPulse: { value: Array.from({ length: PULSE_MAX }, () => new THREE.Vector4(0, 0, -1e3, 1)) },
  uPulseI: { value: new Float32Array(PULSE_MAX) },
  uPulseN: { value: 0 },
  uPulseW: { value: 0.18 },
  uPulseColor: { value: new THREE.Color(1, 1, 1) },
  uPulseNear: { value: new THREE.Vector2(2.5, 9) },
};
const pulseState = [];   // { fam, c, head, len, speed, dir, end }
// Bevel vs face gloss (panel: Face gloss / Bevel boost). The prism is an
// extrusion along local z, so |normal.z| ~ 1 on the flat faces and lower on
// the bevels; the environment reflection is scaled separately for each, which
// is how light mode gets bright edge highlights without whiting out the faces.
const glossUniforms = { face: { value: 1 }, bevel: { value: 0 } };
function injectDepthFade(shader) {
  shader.uniforms.uFadeDepth = fadeDepthUniform;
  shader.uniforms.uFaceGloss = glossUniforms.face;
  shader.uniforms.uBevelBoost = glossUniforms.bevel;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vDepthFade;\nvarying float vBevel;\nuniform vec2 uFadeDepth;')
    .replace('#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nvBevel = 1.0 - smoothstep(0.9, 0.995, abs(normal.z));')
    .replace('#include <project_vertex>',
      '#include <project_vertex>\nvDepthFade = 1.0 - smoothstep(uFadeDepth.x, uFadeDepth.y, -mvPosition.z);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDepthFade;\nvarying float vBevel;\nuniform float uFaceGloss, uBevelBoost;')
    // The include is still unexpanded at this point, so splice the chunk in
    // ourselves with the two IBL radiance lines scaled.
    .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps
      .replace('radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );',
        'radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * mix(uFaceGloss, 1.0 + uBevelBoost, vBevel);')
      .replace('clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );',
        'clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ) * mix(uFaceGloss, 1.0 + uBevelBoost, vBevel);'))
    // The edge tint (sheen) is a grazing-angle effect, so the far end of the
    // band - seen almost edge-on - would be the bluest part. Fade it with depth
    // so distant triangles dissolve into the background colour instead.
    .replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment
      .replace('material.sheenColor = sheenColor;', 'material.sheenColor = sheenColor * (vDepthFade * vDepthFade);'))
    .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vDepthFade;');
}

// One wide ribbon: a lattice of `columns` along the flow and `rows + 1`
// lines across the width. Row r is a triangle strip between lines r and
// r + 1; its vertex k sits on line r + ((k + r) % 2), so neighbouring rows
// share their vertices exactly and the whole band reads as one surface.
const rowMaterials = [];   // one material per row (edge fade), shared by the panel

function makeRibbon() {
  const half = R.segment / 2;
  const columns = Math.ceil(R.length / half) + 3;
  const group = new THREE.Group();
  group.rotation.set(R.tiltX, R.yaw, 0);
  group.position.fromArray(R.position);
  const rows = [];
  const mid = R.rows / 2;
  for (let r = 0; r < R.rows; r++) {
    // Side rows soften toward both edges of the band. One material per row so
    // the whole prism (body, bevel highlights, bloom) fades together; the
    // distance fade toward the far end is done in the shader.
    const d = Math.abs(r + 0.5 - mid) / (mid - 0.5);          // 0 at the centre, exactly 1 (fully faded) on the outermost rows
    const f = Math.max(0, (d - R.edgeFadeStart) / (1 - R.edgeFadeStart));
    const alpha = 1 - Math.pow(f, R.edgeFadePower);
    const mat = glass.clone();
    mat.transparent = true;
    mat.opacity = alpha * (REAL_GLASS ? 1 : C.glass.fakeOpacity);
    mat.userData.rowAlpha = alpha;   // kept so the attributes panel can re-derive opacity / reflections
    rowMaterials.push(mat);
    // Bevel highlights are far brighter than white, so even at low alpha they
    // stay visible; dim the reflective terms with the fade as well.
    mat.envMapIntensity *= alpha * alpha;
    mat.specularIntensity *= alpha;
    mat.clearcoat *= alpha;
    mat.iridescence *= alpha;
    mat.onBeforeCompile = injectDepthFade;
    mat.customProgramCacheKey = () => 'ribbon-depth-fade';

    // One InstancedMesh per row: every triangle in the row is an instance of
    // the shared prism, so the whole band is `rows` draw calls.
    const count = columns - 2;
    const inst = new THREE.InstancedMesh(triGeo, mat, count);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;   // bounds change every frame; the band always spans the view
    group.add(inst);
    const states = [];
    for (let k = 0; k < count; k++) states.push(newBreakawayState());
    triangles.push(inst);
    // lift = current hover ripple height per triangle; rand / jit = fixed per-triangle
    // randoms (0..1 and -1..1 pairs) for the facet tint variation and tilt jitter.
    const rand = new Float32Array(count), jit = new Float32Array(count * 2);
    for (let k = 0; k < count; k++) { rand[k] = Math.random(); jit[k * 2] = Math.random() * 2 - 1; jit[k * 2 + 1] = Math.random() * 2 - 1; }
    rows.push({ inst, count, states, lift: new Float32Array(count), rand, jit });
  }
  // Shadow underlay: one continuous dark sheet that follows the lattice just
  // beneath the prisms, so it only shows through the gaps and bevels (the
  // "shadow between the triangles"). Per-vertex alpha carries the same edge
  // fade as the rows; the depth fade is injected like the glass.
  const lines = R.rows + 1;
  const uGeo = new THREE.BufferGeometry();
  const uPos = new Float32Array(columns * lines * 3);
  const uCol = new Float32Array(columns * lines * 4);
  const lineAlpha = (l) => Math.max(l > 0 ? rowMaterials[l - 1].userData.rowAlpha : 0, l < R.rows ? rowMaterials[l].userData.rowAlpha : 0);
  for (let k = 0; k < columns; k++) for (let l = 0; l < lines; l++) {
    const i = (k * lines + l) * 4;
    uCol[i] = uCol[i + 1] = uCol[i + 2] = 1; uCol[i + 3] = lineAlpha(l);
  }
  const uIdx = [];
  for (let k = 0; k < columns - 1; k++) for (let l = 0; l < lines - 1; l++) {
    const a = k * lines + l, b = a + lines;
    uIdx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  uGeo.setAttribute('position', new THREE.BufferAttribute(uPos, 3).setUsage(THREE.DynamicDrawUsage));
  uGeo.setAttribute('color', new THREE.BufferAttribute(uCol, 4));
  // Lattice coordinates (column k, line l) so the light pulses can be drawn
  // along the groove lines in the fragment shader.
  const uLat = new Float32Array(columns * lines * 2);
  for (let k = 0; k < columns; k++) for (let l = 0; l < lines; l++) { uLat[(k * lines + l) * 2] = k; uLat[(k * lines + l) * 2 + 1] = l; }
  uGeo.setAttribute('lattice', new THREE.BufferAttribute(uLat, 2));
  uGeo.setIndex(uIdx);
  const uMat = new THREE.MeshBasicMaterial({
    color: '#' + (C.underlay?.color || '3a4e78'), transparent: true, opacity: C.underlay?.opacity ?? 0,
    vertexColors: true, side: THREE.DoubleSide, depthWrite: false,
  });
  // Light pulses (config.pulses): glowing streaks travelling along the groove
  // lines, drawn on this sheet so they only show between the triangles. The
  // three groove families in lattice space (u = column, v = line) are v = c
  // (along the flow) and u -/+ v = c (the two diagonals).
  uMat.onBeforeCompile = (shader) => {
    injectDepthFade(shader);
    Object.assign(shader.uniforms, pulseUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 lattice;\nvarying vec2 vLattice;\nvarying float vViewZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLattice = lattice;\nvViewZ = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vLattice; varying float vViewZ;
        uniform vec4 uPulse[${PULSE_MAX}]; uniform float uPulseI[${PULSE_MAX}];
        uniform int uPulseN; uniform float uPulseW; uniform vec3 uPulseColor; uniform vec2 uPulseNear;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float glow = 0.0;
          float u = vLattice.x, v = vLattice.y;
          for (int i = 0; i < ${PULSE_MAX}; i++) {
            if (i >= uPulseN) break;
            vec4 P = uPulse[i];                 // (family, c, head, length); family >= 3 travels the other way
            float fam = mod(P.x, 3.0), dir = P.x >= 3.0 ? -1.0 : 1.0;
            float dist, along;
            if (fam < 0.5)      { dist = abs(v - P.y);            along = u; }
            else if (fam < 1.5) { dist = abs(u - v - P.y) * 0.7071; along = v; }
            else                { dist = abs(u + v - P.y) * 0.7071; along = v; }
            along *= dir; float head = P.z * dir;
            float tail = smoothstep(head - P.w, head, along) * (1.0 - smoothstep(head, head + 0.4, along));
            glow += exp(-dist * dist / (uPulseW * uPulseW)) * tail * uPulseI[i];
          }
          glow *= 1.0 - smoothstep(uPulseNear.x, uPulseNear.y, vViewZ);   // near the camera only
          float g = clamp(glow, 0.0, 1.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uPulseColor * max(glow, 1.0), g);
          gl_FragColor.a = max(gl_FragColor.a, g * vColor.a * vDepthFade);
        }`);
  };
  uMat.customProgramCacheKey = () => 'underlay-depth-fade-pulses';
  const underlay = new THREE.Mesh(uGeo, uMat);
  underlay.renderOrder = -0.5;   // after the background sphere, before the glass
  underlay.frustumCulled = false;
  underlay.visible = uMat.opacity > 0 || !!(C.pulses && C.pulses.enabled);
  group.add(underlay);

  scene.add(group);
  ribbons.push({
    group,
    rows, columns,
    // grid[k][l]: column k, line l
    grid: Array.from({ length: columns }, () =>
      Array.from({ length: R.rows + 1 }, () => new THREE.Vector3())),
    lastWrap: 0,
    underlay,
  });
}
makeRibbon();

// Ribbon centreline at along-flow coordinate x.
function pathPoint(x, t, out) {
  const grow = 1 + R.growth * (x / (R.length / 2));   // amplitude ramps up toward the right
  // Main arch. waveDwell reshapes the sine so the surface lingers near its
  // crest (close to the camera) and dips through the trough quickly: s in
  // 0..1 is remapped to 1 - (1 - s)^dwell, so dwell = 1 is a plain sine and
  // larger values spend proportionally more time high.
  const s = (Math.sin(x * R.waveFreq - t * R.waveSpeed + R.wavePhase) + 1) * 0.5;
  const dwell = R.waveDwell || 1;
  const arch = dwell === 1 ? s : 1 - Math.pow(1 - s, dwell);
  const y = (arch * 2 - 1) * R.waveAmp * grow
    + Math.sin(x * R.wave2Freq + t * R.wave2Speed + 1.3) * R.wave2Amp
    + Math.sin(t * R.driftSpeed) * R.drift;
  const z = Math.sin(x * R.depthFreq - t * R.depthSpeed + 0.7) * R.depthAmp;
  return out.set(x, y, z);
}

const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _tan = new THREE.Vector3();
const _up = new THREE.Vector3(), _side = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _mid = new THREE.Vector3(), _g = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _uN = new THREE.Vector3();   // surface normal for the shadow underlay

// ---------------------------------------------------------------- hover ripple
// The cursor lifts the triangle under it and its neighbours along the band's
// normal with a smooth falloff. No raycasting: the lattice points are already
// known each frame, so they are projected to screen space and the nearest one
// to the pointer becomes the ripple centre (in the band's local space).
const hover = {
  ndc: new THREE.Vector2(),   // pointer in normalised device coords
  active: false,              // pointer is over the canvas
  centre: new THREE.Vector3(),
  hasCentre: false,
  settling: false,            // any lift still easing (keeps rendering while frozen)
};
// Listen on the whole frame (not just the canvas) so the ripple still follows
// the cursor over the headline, copy and nav, which sit above the canvas.
const frameEl = document.getElementById('frame') || container;
frameEl.addEventListener('pointermove', (e) => {
  const r = container.getBoundingClientRect();
  hover.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  hover.active = true;
  requestRender();
});
frameEl.addEventListener('pointerleave', () => { hover.active = false; requestRender(); });

const _mvp = new THREE.Matrix4();
// Ripple centre from the pointer, in band-local space. Every lattice point is
// projected to screen once; then the lattice quad (two triangles) whose
// projection contains the pointer is found - front-most if the band overlaps
// itself on screen - and the 3D point is interpolated with perspective-correct
// barycentrics. Continuous across cell edges, exact under foreshortening.
let _hsx = null, _hsy = null, _hsw = null;
function updateHoverCentre(rb) {
  hover.wasCentred = hover.hasCentre;
  hover.hasCentre = false;
  if (!hover.active || !C.hover.enabled) return;
  rb.group.updateMatrixWorld();
  _mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(rb.group.matrixWorld);
  const m = _mvp.elements;
  const L = R.rows + 1, N = rb.columns * L;
  if (!_hsx || _hsx.length !== N) { _hsx = new Float32Array(N); _hsy = new Float32Array(N); _hsw = new Float32Array(N); }
  for (let k = 0; k < rb.columns; k++) {
    const col = rb.grid[k];
    for (let l = 0; l < L; l++) {
      const p = col[l], i = k * L + l;
      const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
      _hsw[i] = w;
      if (w <= 0) continue;
      _hsx[i] = (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) / w;
      _hsy[i] = (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) / w;
    }
  }
  const px = hover.ndc.x, py = hover.ndc.y;
  let bestW = Infinity, bi0 = -1, bi1 = -1, bi2 = -1, bu = 0, bv = 0, bw = 0;
  const EPS = -1e-4;
  const tri = (i0, i1, i2) => {
    const x0 = _hsx[i0], y0 = _hsy[i0], x1 = _hsx[i1], y1 = _hsy[i1], x2 = _hsx[i2], y2 = _hsy[i2];
    const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(det) < 1e-12) return;
    const v = ((px - x0) * (y2 - y0) - (x2 - x0) * (py - y0)) / det;
    const w = ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)) / det;
    const u = 1 - v - w;
    if (u < EPS || v < EPS || w < EPS) return;
    const depth = u * _hsw[i0] + v * _hsw[i1] + w * _hsw[i2];
    if (depth < bestW) { bestW = depth; bi0 = i0; bi1 = i1; bi2 = i2; bu = u; bv = v; bw = w; }
  };
  for (let k = 0; k < rb.columns - 1; k++) {
    for (let l = 0; l < L - 1; l++) {
      const i00 = k * L + l, i10 = i00 + L, i01 = i00 + 1, i11 = i10 + 1;
      if (_hsw[i00] <= 0 || _hsw[i10] <= 0 || _hsw[i01] <= 0 || _hsw[i11] <= 0) continue;
      // quick reject on the quad's screen bounding box
      const minx = Math.min(_hsx[i00], _hsx[i10], _hsx[i01], _hsx[i11]), maxx = Math.max(_hsx[i00], _hsx[i10], _hsx[i01], _hsx[i11]);
      if (px < minx || px > maxx) continue;
      const miny = Math.min(_hsy[i00], _hsy[i10], _hsy[i01], _hsy[i11]), maxy = Math.max(_hsy[i00], _hsy[i10], _hsy[i01], _hsy[i11]);
      if (py < miny || py > maxy) continue;
      tri(i00, i10, i11);
      tri(i00, i11, i01);
    }
  }
  if (bi0 < 0) return;
  // perspective-correct interpolation of the 3D corners
  const P = (i) => rb.grid[Math.floor(i / L)][i % L];
  const iw0 = bu / _hsw[bi0], iw1 = bv / _hsw[bi1], iw2 = bw / _hsw[bi2];
  const sum = iw0 + iw1 + iw2;
  _hoverTarget.set(0, 0, 0)
    .addScaledVector(P(bi0), iw0 / sum)
    .addScaledVector(P(bi1), iw1 / sum)
    .addScaledVector(P(bi2), iw2 / sum);
  hover.dbg = { cell: [Math.floor(bi0 / L), bi0 % L], depth: +bestW.toFixed(2) };

  // Ease the centre too, so quick cursor moves glide rather than jump.
  if (!hover.wasCentred) hover.centre.copy(_hoverTarget);
  else hover.centre.lerp(_hoverTarget, 1 - Math.exp(-frameDt * C.hover.follow));
  hover.hasCentre = true;
}
const _tmpA = new THREE.Vector3(), _tmpB = new THREE.Vector3();
const _hoverCand = [];
const _hoverTarget = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _e = new THREE.Euler();

// Facet tint variation: each triangle's body colour is multiplied by a
// per-instance colour between white (unchanged) and C.facets.tintColor,
// by its own random amount scaled by C.facets.tint. Re-applied on strip wrap
// (the randoms move with their triangles) and whenever the panel changes it.
const _fc = new THREE.Color(), _ft = new THREE.Color();
function applyFacetTint(rb) {
  const F = C.facets || {};
  const amt = F.tint || 0;
  _ft.set('#' + (F.tintColor || '6f9fff'));
  for (const row of rb.rows) {
    for (let k = 0; k < row.count; k++) {
      const a = amt * row.rand[k];
      _fc.setRGB(1 + (_ft.r - 1) * a, 1 + (_ft.g - 1) * a, 1 + (_ft.b - 1) * a);
      row.inst.setColorAt(k, _fc);
    }
    row.inst.instanceColor.needsUpdate = true;
  }
}
const facetsApi = {
  refresh() { for (const rb of ribbons) applyFacetTint(rb); requestRender(); },
};

// ---------------------------------------------------------------- light pulses
// Runs once per posed frame (after the lattice is up to date). Finds which
// columns are near the camera, advances every pulse, respawns the ones that
// have run their course, and pushes the lot into the shader uniforms.
const _pw = new THREE.Vector3();
let pulseDt = 0;   // set from tick: 0 while frozen so pulses hold still
function updatePulses(rb) {
  const P = C.pulses;
  const n = Math.min(PULSE_MAX, Math.max(0, Math.round(P.count || 0)));
  // Column distances along the centre line -> the near / far lattice columns.
  rb.group.updateMatrixWorld(true);
  const mid = Math.floor(R.rows / 2);
  // Columns count up toward (and past) the camera, so the visible far edge of
  // the near zone is the lowest column within reach.
  let uNear = 0, uFar = -1, dNear = Infinity;
  for (let k = 0; k < rb.columns; k++) {
    const d = _pw.copy(rb.grid[k][mid]).applyMatrix4(rb.group.matrixWorld).distanceTo(camera.position);
    if (d < dNear) { dNear = d; uNear = k; }
    if (d <= P.near[1] && uFar < 0) uFar = k;
  }
  if (uFar < 0) uFar = Math.max(0, uNear - 40);
  if (uFar > uNear) [uFar, uNear] = [uNear, uFar];
  const band = R.rows * (P.rowBand ?? 0.6) / 2;
  const spawn = (s) => {
    const diagonal = Math.random() < (P.diagonalShare ?? 0.5);
    s.len = P.length * (0.7 + Math.random() * 0.6);
    s.speed = P.speed * (0.8 + Math.random() * 0.4);
    if (!diagonal) {
      // Along the flow, toward the camera: from the far edge of the near zone to past the near end.
      s.fam = 0; s.dir = 1;
      s.c = Math.round(R.rows / 2 + (Math.random() * 2 - 1) * band);
      s.head = uFar - Math.random() * s.len;
      s.end = uNear + s.len + 6;
    } else {
      // Across the band on a diagonal, either direction, through the near zone.
      s.fam = Math.random() < 0.5 ? 1 : 2;
      s.dir = Math.random() < 0.5 ? 1 : -1;
      const v0 = R.rows / 2, uMid = uFar + (uNear - uFar) * (0.35 + Math.random() * 0.5);
      s.c = Math.round(s.fam === 1 ? uMid - v0 : uMid + v0);
      s.c += (s.c + 0) % 2;   // groove lines sit on even constants
      s.head = s.dir > 0 ? -s.len : R.rows + s.len;
      s.end = s.dir > 0 ? R.rows + s.len : -s.len;
    }
  };
  while (pulseState.length < n) { const s = {}; spawn(s); s.head += (Math.random() - 0.5) * 20; pulseState.push(s); }
  pulseState.length = n;
  const U = pulseUniforms;
  for (let i = 0; i < n; i++) {
    const s = pulseState[i];
    s.head += s.dir * s.speed * pulseDt;
    if ((s.dir > 0 && s.head > s.end) || (s.dir < 0 && s.head < s.end)) spawn(s);
    U.uPulse.value[i].set(s.fam + (s.dir < 0 ? 3 : 0), s.c, s.head, s.len);
    U.uPulseI.value[i] = P.intensity;
  }
  U.uPulseN.value = n;
  U.uPulseW.value = P.width;
  U.uPulseColor.value.set('#' + P.color);
  U.uPulseNear.value.set(P.near[0], P.near[1]);
}
const pulsesApi = {
  refresh() {
    for (const rb of ribbons) rb.underlay.visible = rb.underlay.material.opacity > 0 || !!(C.pulses && C.pulses.enabled);
    requestRender();
  },
};

function updateRibbon(rb, t, flow) {
  const half = R.segment / 2;
  const total = R.segment;
  // `flow` is the accumulated travel distance (see tick), so speed can change live without a jump.
  const s = flow % total;

  // The strip advances continuously; when the offset wraps by a full segment
  // every mesh now sits where the one two columns back was, so shift the
  // breakaway states along to stay with their triangles.
  const wrap = Math.floor(flow / total);
  if (wrap !== rb.lastWrap) {
    for (let w = rb.lastWrap; w < wrap; w++) {
      for (const row of rb.rows) {
        row.states.unshift(row.states.pop());
        row.states.unshift(row.states.pop());
        // The hover lift rides with its triangle too, otherwise the bump
        // jumps two columns every time the strip wraps.
        row.lift.copyWithin(2, 0, row.count - 2);
        row.lift[0] = 0; row.lift[1] = 0;
        // Facet randoms ride with their triangles too; the two new ones get fresh values.
        row.rand.copyWithin(2, 0, row.count - 2);
        row.rand[0] = Math.random(); row.rand[1] = Math.random();
        row.jit.copyWithin(4, 0, (row.count - 2) * 2);
        for (let j = 0; j < 4; j++) row.jit[j] = Math.random() * 2 - 1;
      }
    }
    if ((C.facets?.tint || 0) > 0) applyFacetTint(rb);
    // A wrap re-labels the lattice: the same world position is now two columns
    // higher in u. Shift the pulses with it so they hold still in the world
    // (row pulses by head, diagonal pulses by their line constant).
    const du = 2 * (wrap - rb.lastWrap);
    for (const s of pulseState) { if (s.fam === 0) s.head += du; else s.c += du; }
    rb.lastWrap = wrap;
  }

  // Lattice: for each column, the path point plus offsets along the twisted
  // ribbon normal for every line across the width.
  const x0 = -R.length / 2 - total;
  const mid = R.rows / 2;
  for (let k = 0; k < rb.columns; k++) {
    const x = x0 + k * half + s;
    pathPoint(x, t, _pa);
    pathPoint(x + 0.02, t, _pb);
    pathPoint(x - 0.02, t, _tan);
    _tan.subVectors(_pb, _tan).normalize();

    // The band lies flat: rows spread along the side vector (perpendicular to
    // the flow, horizontal), and the twist rolls that toward up.
    _up.set(0, 1, 0).addScaledVector(_tan, -_tan.y).normalize();
    _side.crossVectors(_tan, _up);
    const theta = Math.sin(x * R.twistFreq - t * R.twistSpeed) * R.twistAmp;
    _n.copy(_side).multiplyScalar(Math.cos(theta)).addScaledVector(_up, Math.sin(theta));

    const col = rb.grid[k];
    for (let l = 0; l <= R.rows; l++) {
      col[l].copy(_pa).addScaledVector(_n, (l - mid) * R.width);
    }
    // Underlay vertices: the lattice pushed down the surface normal by the
    // prism thickness plus a little, so it sits just under the glass.
    if (rb.underlay.visible) {
      const pos = rb.underlay.geometry.attributes.position.array;
      _uN.crossVectors(_tan, _n).normalize();   // = -(surface up): points away from the camera side
      // Just under the TOP face (offset = distance below it), so what shows
      // through the gaps - shadow and light pulses - lines up with the grooves
      // instead of being displaced by perspective.
      const off = -R.extrude * 0.5 + (C.underlay?.offset ?? 0.004);
      const lines = R.rows + 1;
      for (let l = 0; l < lines; l++) {
        const i = (k * lines + l) * 3;
        pos[i] = col[l].x + _uN.x * off; pos[i + 1] = col[l].y + _uN.y * off; pos[i + 2] = col[l].z + _uN.z * off;
      }
    }
  }
  if (rb.underlay.visible) rb.underlay.geometry.attributes.position.needsUpdate = true;
  if (rb.underlay.visible && C.pulses && C.pulses.enabled) updatePulses(rb);

  const jitAmt = THREE.MathUtils.degToRad(C.facets?.jitter || 0);

  // Hover ripple: pick the centre once per frame, then ease every triangle's
  // lift toward a gaussian of its distance from it (0 when nothing is hovered).
  updateHoverCentre(rb);
  const H = C.hover;
  const sigma2 = 2 * H.radius * H.radius;
  const ease = 1 - Math.exp(-frameDt * H.ease);
  let settling = false;

  // Pose each rigid triangle onto its three lattice vertices: A and C share a
  // line (the base), B is the apex on the neighbouring line.
  for (let r = 0; r < R.rows; r++) {
    const row = rb.rows[r];
    const lift = row.lift;
    for (let k = 0; k < row.count; k++) {
      const A  = rb.grid[k    ][r + ((k     + r) % 2)];
      const Bp = rb.grid[k + 1][r + ((k + 1 + r) % 2)];
      const Cp = rb.grid[k + 2][r + ((k + 2 + r) % 2)];
      _g.copy(A).add(Bp).add(Cp).multiplyScalar(1 / 3);
      _x.subVectors(Cp, A).normalize();
      _mid.copy(A).add(Cp).multiplyScalar(0.5);
      _y.subVectors(Bp, _mid);
      _y.addScaledVector(_x, -_y.dot(_x)).normalize();
      _z.crossVectors(_x, _y);
      _m4.makeBasis(_x, _y, _z);
      _q.setFromRotationMatrix(_m4);
      // Facet jitter: a small fixed random tilt per triangle so neighbours
      // reflect slightly different parts of the environment.
      if (jitAmt > 0) {
        _qt.setFromEuler(_e.set(row.jit[k * 2] * jitAmt, row.jit[k * 2 + 1] * jitAmt, 0));
        _q.multiply(_qt);
      }

      // hover lift (eased toward the target so the wave trails the cursor)
      let target = 0;
      if (hover.hasCentre) {
        const dx = _g.x - hover.centre.x, dy = _g.y - hover.centre.y, dz = _g.z - hover.centre.z;
        target = H.lift * Math.exp(-(dx * dx + dy * dy + dz * dz) / sigma2);
      }
      const cur = lift[k] + (target - lift[k]) * ease;
      lift[k] = Math.abs(cur) < 1e-4 ? 0 : cur;
      if (lift[k] !== 0) { settling = true; _g.addScaledVector(_z, lift[k]); }

      const st = row.states[k];
      const kk = st.k;
      _g.addScaledVector(_x, st.lateral.x * kk)
        .addScaledVector(_y, st.lateral.y * kk)
        .addScaledVector(_z, st.distance * kk);
      if (kk > 0) {
        _qt.setFromEuler(_e.set(st.tilt.x * kk, st.tilt.y * kk, 0));
        _q.multiply(_qt);
      }
      _m4.compose(_g, _q, _one);
      row.inst.setMatrixAt(k, _m4);
    }
    row.inst.instanceMatrix.needsUpdate = true;
  }
  hover.settling = settling;
}

// Thin rim lights sharpen the bevel highlights beyond what the env gives.
// Two directional lights outside the environment map. Their clearcoat specular
// is what puts the sharp glints on individual facets, so they are exposed to
// the panel/presets (config.sun) rather than fixed.
const key = new THREE.DirectionalLight('#' + C.sun.key.color, C.sun.key.intensity);
key.position.set(-4, 5, 3);
scene.add(key);
const rim = new THREE.DirectionalLight('#' + C.sun.rim.color, C.sun.rim.intensity);
rim.position.set(5, -2, 4);
scene.add(rim);
const sunLights = { key, rim };

// ---------------------------------------------------------------- bloom
// Minimal post chain: scene -> HDR target, bright-pass to half res, separable
// blur, then composite + tone map. Tone mapping is deliberately deferred to
// the composite so the threshold works on linear HDR values.
// Single-triangle studio (key 1): hides the band and shows one prism at the
// origin that the mouse rotates (drag) and zooms (wheel). Fade and DoF are
// suppressed while it is on; E exports as usual. State lives here so the post
// chain can read it; the mesh and handlers are set up further down.
const single = { active: false, mesh: null, dist: 1.4, rotX: -0.55, rotY: 0.45, dragging: false, lastX: 0, lastY: 0, uiWasHidden: false };
// Cluster scene (key 2): triangles slide in and assemble into a random joined
// composition on the right of the frame. State here for the same reason.
const cluster = { active: false, group: null, inst: null, t: 0, items: [] };

const post = (() => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const hdr = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: C.quality.msaa });
  const mk = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const pingA = mk(), pingB = mk();
  // Depth of field (tilt-shift): two progressively softer copies of the whole
  // frame, half and quarter resolution, blended in by vertical screen position.
  const dofA = mk(), dofB = mk(), dofC = mk(), dofD = mk();
  const ldr = new THREE.WebGLRenderTarget(size.x, size.y); // tone-mapped sRGB frame, input to FXAA
  // Supersampling: when `scale` > 1 the whole chain renders at canvas size x
  // scale, FXAA writes into `aa`, and a box-filter pass downsamples that onto
  // the canvas (or an export target). The browser's own canvas scaling is
  // bilinear, which at 3:1 skips samples and leaves the bevel lines jagged;
  // this pass averages every source texel instead.
  let scale = 1;
  const base = new THREE.Vector2();
  const aa = new THREE.WebGLRenderTarget(size.x, size.y);

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);
  const vs = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThreshold: { value: C.bloom.threshold } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform float uThreshold;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float k = smoothstep(uThreshold, uThreshold + 0.6, l);
        gl_FragColor = vec4(c * k, 1.0);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() }, uClamp: { value: 0 } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir, uTexel; uniform float uClamp;
      // uClamp > 0 caps HDR values before blurring: a specular several times
      // brighter than white would otherwise smear into a glowing disc.
      vec3 tap(vec2 uv) { vec3 c = texture2D(tSrc, uv).rgb; return uClamp > 0.0 ? min(c, vec3(uClamp)) : c; }
      void main() {
        float w[5]; w[0]=0.2270270; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.0540541; w[4]=0.0162162;
        vec3 c = tap(vUv) * w[0];
        for (int i = 1; i < 5; i++) {
          vec2 o = uDir * uTexel * float(i) * 1.5;
          c += tap(vUv + o) * w[i];
          c += tap(vUv - o) * w[i];
        }
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  // Composite renders into a target, where three disables its own tone mapping
  // and colour-space output, so both are done explicitly here.
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tBloom: { value: null },
      uStrength: { value: C.bloom.strength },
      toneMappingExposure: { value: C.exposure },
      tBlur1: { value: null }, tBlur2: { value: null },
      // x = focus line (0 bottom .. 1 top), y = sharp half-width, z = feather, w = enabled
      uDof: { value: new THREE.Vector4(C.dof.focus, C.dof.width, C.dof.feather, C.dof.enabled ? 1 : 0) },
      uDofAmount: { value: new THREE.Vector2(C.dof.near, C.dof.far) },
      // Legibility fade: xy = centre (fractions of width / height), z = radius (fraction of width), w = blur (fraction of width)
      uFade: { value: new THREE.Vector4() },
      uFadeColor: { value: new THREE.Vector3() },   // display-space (sRGB) colour, mixed after tone mapping
      uFadeOpacity: { value: 0 },
      uAspect: { value: 1 },
      uTile: { value: new THREE.Vector4(0, 0, 1, 1) },   // this render's rectangle in full-frame uv (tiled exports); x, y, w, h
    },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tScene, tBloom, tBlur1, tBlur2; uniform float uStrength;
      uniform vec4 uDof; uniform vec2 uDofAmount;
      // Tilt-shift: 0 inside the sharp band around the focus line, ramping to 1
      // over the feather distance; scaled separately for near (below) and far (above).
      float blurAmount(vec2 uv) {
        float d = uv.y - uDof.x;
        float k = clamp((abs(d) - uDof.y) / max(uDof.z, 1e-4), 0.0, 1.0);
        k = k * k * (3.0 - 2.0 * k);
        return k * (d < 0.0 ? uDofAmount.x : uDofAmount.y) * uDof.w;
      }
      #include <tonemapping_pars_fragment>
      uniform vec4 uFade; uniform vec3 uFadeColor; uniform float uFadeOpacity, uAspect;
      uniform vec4 uTile;   // this render's rectangle in full-frame uv (x, y, w, h); (0,0,1,1) except for tiled exports
      // Blurred-disc coverage at this pixel, measured in frame-width units.
      float fadeCoverage(vec2 uv) {
        vec2 p = vec2(uv.x, (1.0 - uv.y) / uAspect);
        vec2 c = vec2(uFade.x, uFade.y / uAspect);
        float d = distance(p, c);
        float b = max(uFade.w, 1e-4);
        return 1.0 - smoothstep(uFade.z - b, uFade.z + b, d);
      }
      // Cheap per-pixel hash for the output dither.
      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        // Frame-relative effects (tilt-shift line, legibility fade) use the
        // full-frame uv, so a tiled export matches a single-pass one.
        vec2 fuv = uTile.xy + vUv * uTile.zw;
        float b = blurAmount(fuv);
        if (b > 0.0) {
          // 0..0.5 blends sharp -> soft, 0.5..1 blends soft -> softer
          vec3 soft = texture2D(tBlur1, vUv).rgb;
          vec3 softer = texture2D(tBlur2, vUv).rgb;
          c = mix(c, soft, clamp(b * 2.0, 0.0, 1.0));
          c = mix(c, softer, clamp(b * 2.0 - 1.0, 0.0, 1.0));
        }
        c += texture2D(tBloom, vUv).rgb * uStrength;
        c = ACESFilmicToneMapping(c);
        vec3 srgb = toSRGB(clamp(c, 0.0, 1.0));
        // Fade is a UI-space overlay, so it blends in display space like the CSS layer did.
        if (uFadeOpacity > 0.0) srgb = mix(srgb, uFadeColor, fadeCoverage(fuv) * uFadeOpacity);
        // Dither the 8-bit quantisation so the soft dark falloff does not band.
        srgb += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(srgb, 1.0);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  // FXAA on the final LDR frame: MSAA only fixes geometric edges, this
  // smooths the shading aliasing on the thin bevel highlights.
  const fxaaMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      void main() {
        vec3 rgbM = texture2D(tSrc, vUv).rgb;
        float lM  = luma(rgbM);
        float lNW = luma(texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb);
        float lNE = luma(texture2D(tSrc, vUv + vec2( 1.0, -1.0) * uTexel).rgb);
        float lSW = luma(texture2D(tSrc, vUv + vec2(-1.0,  1.0) * uTexel).rgb);
        float lSE = luma(texture2D(tSrc, vUv + vec2( 1.0,  1.0) * uTexel).rgb);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        if (lMax - lMin < max(0.0312, lMax * 0.125)) { gl_FragColor = vec4(rgbM, 1.0); return; }

        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
        float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = clamp(dir * rcpDirMin, -8.0, 8.0) * uTexel;

        vec3 rgbA = 0.5 * (texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)).rgb
                         + texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
        vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tSrc, vUv - dir * 0.5).rgb
                                       + texture2D(tSrc, vUv + dir * 0.5).rgb);
        float lB = luma(rgbB);
        gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  // Box-filter downsample: `uTaps` x `uTaps` samples spread over one output
  // pixel's footprint (`uRatio` source texels), with linear filtering between.
  const downMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRatio: { value: 1 }, uTaps: { value: 1 } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRatio; uniform float uTaps;
      void main() {
        vec4 sum = vec4(0.0); float n = 0.0;
        for (int i = 0; i < 4; i++) {
          if (float(i) >= uTaps) break;
          for (int j = 0; j < 4; j++) {
            if (float(j) >= uTaps) break;
            vec2 off = ((vec2(float(i), float(j)) + 0.5) / uTaps - 0.5) * uRatio * uTexel;
            sum += texture2D(tSrc, vUv + off); n += 1.0;
          }
        }
        gl_FragColor = sum / n;   // alpha rides along (1 for normal frames, coverage for transparent exports)
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  function resize() {
    renderer.getDrawingBufferSize(base);
    size.set(Math.max(1, Math.floor(base.x * scale)), Math.max(1, Math.floor(base.y * scale)));
    hdr.setSize(size.x, size.y);
    ldr.setSize(size.x, size.y);
    aa.setSize(size.x, size.y);
    fxaaMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    const hw = Math.max(1, Math.floor(size.x / 2)), hh = Math.max(1, Math.floor(size.y / 2));
    pingA.setSize(hw, hh);
    pingB.setSize(hw, hh);
    blurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    dofA.setSize(hw, hh); dofB.setSize(hw, hh);
    const qw = Math.max(1, Math.floor(hw / 2)), qh = Math.max(1, Math.floor(hh / 2));
    dofC.setSize(qw, qh); dofD.setSize(qw, qh);
    halfTexel.set(1 / hw, 1 / hh);
    quarterTexel.set(1 / qw, 1 / qh);
  }
  const halfTexel = new THREE.Vector2(), quarterTexel = new THREE.Vector2();
  resize();

  // One separable blur iteration: src -> a (horizontal) -> b (vertical).
  function blurInto(src, a, b, texel, clamp = 0) {
    blurMat.uniforms.uTexel.value.copy(texel);
    blurMat.uniforms.uClamp.value = clamp;
    blurMat.uniforms.tSrc.value = src; blurMat.uniforms.uDir.value.set(1, 0);
    blit(blurMat, a);
    blurMat.uniforms.tSrc.value = a.texture; blurMat.uniforms.uDir.value.set(0, 1);
    blit(blurMat, b);
  }

  function blit(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  // Draw the frame to the canvas (target = null) or into a render target of
  // any size (exports); the final pass downsamples when the sizes differ.
  // Tone map + sRGB with alpha preserved, for transparent exports. The scene
  // target holds premultiplied colour (blended onto clear alpha 0), so it is
  // un-premultiplied before tone mapping and written back as straight alpha.
  const alphaToneMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, toneMappingExposure: { value: C.exposure } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc;
      #include <tonemapping_pars_fragment>
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec4 s = texture2D(tSrc, vUv);
        vec3 c = s.a > 1e-4 ? s.rgb / s.a : vec3(0.0);
        c = ACESFilmicToneMapping(c);
        gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), clamp(s.a, 0.0, 1.0));
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  // Transparent render: no background sphere, no shadow sheet, no bloom / DoF /
  // FXAA (none of them carry alpha); MSAA + the supersample handle the edges.
  function renderTransparent(target) {
    const prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const bgWas = background.visible;
    const underWas = ribbons.map((rb) => rb.underlay.visible);
    background.visible = false;
    for (const rb of ribbons) rb.underlay.visible = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(hdr);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setClearColor(prevColor, prevAlpha);
    background.visible = bgWas;
    ribbons.forEach((rb, i) => { rb.underlay.visible = underWas[i]; });

    alphaToneMat.uniforms.tSrc.value = hdr.texture;
    alphaToneMat.uniforms.toneMappingExposure.value = C.exposure;
    blit(alphaToneMat, aa);
    const ratio = size.x / target.width;
    downMat.uniforms.tSrc.value = aa.texture;
    downMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    downMat.uniforms.uRatio.value = ratio;
    downMat.uniforms.uTaps.value = ratio <= 1.01 ? 1 : Math.min(4, Math.ceil(ratio) + 1);
    blit(downMat, target);
  }

  function render(target = null) {
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);

    brightMat.uniforms.tSrc.value = hdr.texture;
    blit(brightMat, pingA);
    blurMat.uniforms.uTexel.value.copy(halfTexel);
    blurMat.uniforms.uClamp.value = 0;
    for (let i = 0; i < C.bloom.passes; i++) {
      blurMat.uniforms.tSrc.value = pingA.texture; blurMat.uniforms.uDir.value.set(1, 0);
      blit(blurMat, pingB);
      blurMat.uniforms.tSrc.value = pingB.texture; blurMat.uniforms.uDir.value.set(0, 1);
      blit(blurMat, pingA);
    }

    // Depth of field copies: the first horizontal pass reads the full-res
    // frame with half-res offsets, which downsamples for free.
    const dofOn = C.dof.enabled && !single.active && !cluster.active;
    if (dofOn) {
      blurInto(hdr.texture, dofA, dofB, halfTexel, C.dof.clampHighlights);   // only the first pass sees raw HDR
      blurInto(dofB.texture, dofA, dofB, halfTexel);
      blurInto(dofB.texture, dofC, dofD, quarterTexel);
      blurInto(dofD.texture, dofC, dofD, quarterTexel);
    }

    compositeMat.uniforms.tScene.value = hdr.texture;
    compositeMat.uniforms.tBloom.value = pingA.texture;
    compositeMat.uniforms.tBlur1.value = dofB.texture;
    compositeMat.uniforms.tBlur2.value = dofD.texture;
    compositeMat.uniforms.uDof.value.set(C.dof.focus, C.dof.width, C.dof.feather, dofOn ? 1 : 0);
    compositeMat.uniforms.uDofAmount.value.set(C.dof.near, C.dof.far);
    {
      const F = C.fade;
      const hex = String(F.color).replace('#', '');
      const ch = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
      compositeMat.uniforms.uFade.value.set(F.x / 100, F.y / 100, F.size / 200, F.blur / 100);
      compositeMat.uniforms.uFadeColor.value.set(ch(0), ch(2), ch(4));
      compositeMat.uniforms.uFadeOpacity.value = F.enabled && !single.active ? F.opacity : 0;
      // Aspect of the whole frame (a tile is a sub-rectangle of it).
      const tile = compositeMat.uniforms.uTile.value;
      compositeMat.uniforms.uAspect.value = (size.x / tile.z) / (size.y / tile.w);
    }
    blit(compositeMat, ldr);

    fxaaMat.uniforms.tSrc.value = ldr.texture;
    if (scale === 1 && !target) { blit(fxaaMat, null); return; }
    blit(fxaaMat, aa);
    const outW = target ? target.width : base.x;
    const ratio = size.x / outW;
    downMat.uniforms.tSrc.value = aa.texture;
    downMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    downMat.uniforms.uRatio.value = ratio;
    downMat.uniforms.uTaps.value = ratio <= 1.01 ? 1 : Math.min(4, Math.ceil(ratio) + 1);
    blit(downMat, target);
  }

  return {
    render, renderTransparent, resize, ldr,
    setTile(x, y, w, h) { compositeMat.uniforms.uTile.value.set(x, y, w, h); },
    get scale() { return scale; },
    setScale(s) { scale = Math.max(1, s || 1); resize(); },
  };
})();


// ---------------------------------------------------------------- breakaway
// Drives each triangle's displacement factor k (0 = seated on the ribbon,
// 1 = fully lifted); updateRibbon applies it in the triangle's local frame.
const B = C.breakaway;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

let nextBurst = rand(0.5, 1.5);
const allStates = () => ribbons.flatMap((rb) => rb.rows.flatMap((row) => row.states));

function launch(s, t) {
  s.phase = 'out';
  s.t0 = t + Math.random() * B.stagger;
  s.hold = rand(B.holdDuration[0], B.holdDuration[1]);
  s.distance = rand(B.distance[0], B.distance[1]);
  const a = Math.random() * Math.PI * 2;
  s.lateral.set(Math.cos(a), Math.sin(a)).multiplyScalar(B.lateral * rand(0.4, 1));
  s.tilt.set(rand(-1, 1), rand(-1, 1)).multiplyScalar(B.tilt);
}

function updateBreakaway(t) {
  if (!B.enabled) return;

  // Bursts: every so often a random handful of seated triangles leave together.
  if (t >= nextBurst) {
    nextBurst = t + rand(B.interval[0], B.interval[1]);
    const idle = allStates().filter((s) => s.phase === 'idle');
    const n = Math.min(idle.length, Math.floor(rand(B.count[0], B.count[1] + 1)));
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (idle.length - i));
      [idle[i], idle[j]] = [idle[j], idle[i]];
      launch(idle[i], t);
    }
  }

  for (const s of allStates()) {
    if (s.phase === 'idle') { s.k = 0; continue; }
    let k;
    const e = t - s.t0;
    if (e < 0) {
      k = 0; // staggered start not reached yet
    } else if (s.phase === 'out') {
      k = easeInOut(Math.min(e / B.outDuration, 1));
      if (e >= B.outDuration) { s.phase = 'hold'; s.t0 = t; }
    } else if (s.phase === 'hold') {
      k = 1;
      if (e >= s.hold) { s.phase = 'back'; s.t0 = t; }
    } else {
      k = 1 - easeInOut(Math.min(e / B.backDuration, 1));
      if (e >= B.backDuration) { s.phase = 'idle'; k = 0; }
    }
    s.k = k;
  }
}

// ---------------------------------------------------------------- resolution
// Two budgets. Live: a fixed pixel ratio (device ratio capped at
// quality.maxPixelRatio - no adaptive stepping). Still: while motion is frozen
// the frame is rendered once at native ratio x supersample, capped by a pixel
// budget, and only re-rendered when something changes - so a frozen frame is
// print-quality and costs nothing per second.
const Q = C.quality;
let livePixelRatio = pixelRatio;
let stillMode = false;
let needsRender = true;

function stillPixelRatio() {
  const cssPixels = container.clientWidth * container.clientHeight;
  return Math.min(
    Q.stillPixelRatio,
    window.devicePixelRatio * Q.stillSupersample,
    Math.sqrt(Q.stillMaxPixels / cssPixels));
}

let evalRatio = null;   // temporary override while the randomizer renders low-res candidates
// Live: the canvas is drawn at livePixelRatio, no supersampling. Still: the
// canvas sits at the device ratio and the post chain renders at the still
// ratio, box-filtered down onto it (see post.setScale), so a 3x still really
// averages 9 samples per device pixel instead of the browser's bilinear pick.
function applySize() {
  let canvasRatio, internal = 1;
  if (evalRatio != null) canvasRatio = evalRatio;
  else if (stillMode) {
    const s = stillPixelRatio();
    canvasRatio = Math.min(window.devicePixelRatio, s);
    internal = s / canvasRatio;
  } else canvasRatio = livePixelRatio;
  pixelRatio = canvasRatio * internal;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(canvasRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  post.setScale(internal);   // also resizes every target
  needsRender = true;
}
function requestRender() { needsRender = true; }

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let flowDist = 0, lastTick = 0;   // accumulated ribbon travel; integrating speed lets the panel change it seamlessly
let sceneTime = 0;                // animation clock; stops advancing while C.motion.paused (everything keys off it)
// Loop mode state: t counts seconds since the loop started (never wraps; the
// maths is periodic), shapeStart / flowStart are the clocks at that moment.
const loop = { active: false, t: 0, shapeStart: 0, flowStart: 0 };
function startLoop() { loop.active = true; loop.t = 0; loop.shapeStart = sceneTime; loop.flowStart = flowDist; }
function stopLoop() { loop.active = false; }   // clocks carry on from where the loop left them, no jump
function tick() {
  const now = clock.getElapsedTime();
  const dt = Math.min(now - lastTick, 0.1);
  lastTick = now;

  const paused = !!C.motion.paused;
  if (paused !== stillMode) {
    stillMode = paused;
    applySize();                   // switch between the still and live budgets
  }

  pulseDt = paused ? 0 : dt;
  if (!paused) {
    if (loop.active) {
      // Exact loop (see config.loop): the flow advances a whole number of
      // triangle lengths per period; the shape clock swings about its start.
      loop.t += dt;
      const P = C.loop.period;
      const n = Math.max(1, Math.round(R.flowSpeed * P / R.segment));
      flowDist = loop.flowStart + (n * R.segment / P) * loop.t;
      sceneTime = loop.shapeStart + (C.loop.swing * P / (2 * Math.PI)) * Math.sin(2 * Math.PI * loop.t / P);
    } else {
      sceneTime += dt;
      flowDist += dt * R.flowSpeed;
    }
    needsRender = true;
  }
  // A hover ripple that is still easing needs frames even while frozen.
  if (hover.settling || (hover.active && C.hover.enabled)) needsRender = true;
  frameDt = dt;

  fpsTick(now);

  if (single.active) {
    // Studio camera: straight at the origin; the mouse rotates the prism, not the camera.
    camera.position.set(0, 0, single.dist);
    camera.lookAt(0, 0, 0);
    single.mesh.rotation.set(single.rotX, single.rotY, 0);
  }
  if (cluster.active) {
    camera.position.set(0, 0, C.cluster.dist);
    camera.lookAt(0, 0, 0);
    if (!paused) { cluster.t += dt; updateCluster(); needsRender = true; }
  }
  if (needsRender) renderFrame();
  requestAnimationFrame(tick);
}
// Pose the band for the current clock and draw one frame (also used by the
// randomizer to render candidates synchronously).
function renderFrame(target = null, transparent = false) {
  renderer.info.reset();   // per-frame draw call / triangle totals for the diagnostics overlay
  const t = sceneTime;
  bgUniforms.uTime.value = t;
  updateBreakaway(t);
  for (const rb of ribbons) updateRibbon(rb, t, flowDist);
  if (transparent) post.renderTransparent(target); else post.render(target);
  needsRender = false;
}

// Hooks for the randomizer (panel.js): jump the animation clock, render a
// candidate at a low resolution, read its luminance back and check the band
// is not touching the camera.
const _wp = new THREE.Vector3();
const sceneControl = {
  // Setting a clock (undo / randomize) also re-anchors an active loop on it.
  get time() { return sceneTime; }, set time(v) { sceneTime = v; if (loop.active) { loop.shapeStart = v; loop.t = 0; loop.flowStart = flowDist; } },
  get flow() { return flowDist; }, set flow(v) { flowDist = v; if (loop.active) { loop.flowStart = v; loop.t = 0; loop.shapeStart = sceneTime; } },
  loop, startLoop, stopLoop,
  renderFrame,
  setEvalRatio(r) { evalRatio = r; applySize(); },
  // Sub-sampled luminance (0..1) of the final LDR frame; row 0 is the bottom.
  sampleLuma(step = 4) {
    const t = post.ldr; const w = t.width, h = t.height;
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(t, 0, 0, w, h, buf);
    const sw = Math.floor(w / step), sh = Math.floor(h / step);
    const lum = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = (y * step * w + x * step) * 4;
      lum[y * sw + x] = (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255;
    }
    return { w: sw, h: sh, lum };
  },
  // Export the current scene (canvas only, no page UI) as a PNG at `scale` x
  // the frame's css size. Rendered at the still ratio (at least `scale`) and
  // downsampled, so bevel lines stay clean. Returns the output size.
  // Tiled export: the output (css size x `scale`) is rendered as a grid of
  // tiles, each supersampled `ss` times and kept under the pixel budget, with
  // an overlap margin so the screen-space blurs (bloom, DoF, FXAA) never see a
  // tile edge. camera.setViewOffset carves the sub-frustum; the composite gets
  // the tile's full-frame rectangle so the tilt-shift line and the fade land
  // where they would in a single render. Tiles are stitched into one canvas.
  exportPNG(scale = 2, filename, { transparent = false } = {}) {
    const cssW = container.clientWidth, cssH = container.clientHeight;
    const outW = Math.round(cssW * scale), outH = Math.round(cssH * scale);
    const ss = C.export?.supersample ?? 2;
    const margin = Math.ceil((C.export?.marginPx ?? 160) / ss);           // output px of overlap on every side
    const budget = Q.stillMaxPixels;
    // Grid: the smallest n x n (then trimmed per axis) whose tiles fit the budget at ss.
    let nx = 1, ny = 1;
    const fits = (nx, ny) => (Math.ceil(outW / nx) + 2 * margin) * (Math.ceil(outH / ny) + 2 * margin) * ss * ss <= budget;
    while (!fits(nx, ny) && nx * ny < 64) { if (outW / nx >= outH / ny) nx++; else ny++; }
    const cv = document.createElement('canvas');
    cv.width = outW; cv.height = outH;
    const ctx = cv.getContext('2d');
    post.setScale(1);
    renderer.setPixelRatio(ss);
    camera.aspect = outW / outH;
    let target = null;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = Math.floor(outW * i / nx), x1 = Math.floor(outW * (i + 1) / nx);
      const y0 = Math.floor(outH * j / ny), y1 = Math.floor(outH * (j + 1) / ny);
      const rx = x0 - margin, ry = y0 - margin, rw = x1 - x0 + 2 * margin, rh = y1 - y0 + 2 * margin;
      camera.setViewOffset(outW, outH, rx, ry, rw, rh);     // sub-frustum (offset y is from the top)
      renderer.setSize(rw, rh, false);                      // drawing buffer rw*ss x rh*ss
      post.resize();
      post.setTile(rx / outW, 1 - (ry + rh) / outH, rw / outW, rh / outH);
      if (!target || target.width !== rw || target.height !== rh) { if (target) target.dispose(); target = new THREE.WebGLRenderTarget(rw, rh); }
      renderFrame(target, transparent);
      const buf = new Uint8Array(rw * rh * 4);
      renderer.readRenderTargetPixels(target, 0, 0, rw, rh, buf);
      // GL rows run bottom-up; flip, then paste only the un-margined core.
      const img = new ImageData(rw, rh);
      const row = rw * 4;
      for (let y = 0; y < rh; y++) img.data.set(buf.subarray((rh - 1 - y) * row, (rh - y) * row), y * row);
      if (!transparent) for (let k = 3; k < img.data.length; k += 4) img.data[k] = 255;
      ctx.putImageData(img, rx, ry, margin, margin, x1 - x0, y1 - y0);
    }
    if (target) target.dispose();
    camera.clearViewOffset();
    post.setTile(0, 0, 1, 1);
    applySize();   // back to the live / still setup (restores aspect, size, scale)
    const renderRatio = ss * scale;
    const name = filename || ('controlplane-scene-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + (transparent ? '-transparent' : '') + '.png');
    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
    return { width: outW, height: outH, renderedAt: [Math.round(cssW * renderRatio), Math.round(cssH * renderRatio)], tiles: [nx, ny], name };
  },
  // Smallest distance from the camera to any lattice point of the posed band.
  clearance() {
    let best = Infinity;
    for (const rb of ribbons) {
      rb.group.updateMatrixWorld(true);
      for (const col of rb.grid) for (const p of col) {
        const d = _wp.copy(p).applyMatrix4(rb.group.matrixWorld).distanceTo(camera.position);
        if (d < best) best = d;
      }
    }
    return best;
  },
};
let frameDt = 1 / 60;   // last frame's delta, used by the hover ripple easing

// ---------------------------------------------------------------- diagnostics (D / ?diag)
// Frame timing plus machine / browser / WebGL facts, with a copy-to-clipboard
// report. renderer.info is reset once per frame (see renderFrame) so the draw
// call and triangle counts cover the whole post chain.
renderer.info.autoReset = false;
const diag = initDiag({
  renderer, container,
  getState: () => ({
    frozen: stillMode, loop: loop.active,
    canvasRatio: renderer.getPixelRatio(), renderRatio: pixelRatio, postScale: post.scale,
    livePixelRatio, maxPixelRatio: Q.maxPixelRatio, stillRatio: stillPixelRatio(),
    msaa: Q.msaa, bloomPasses: C.bloom.passes, dof: C.dof.enabled,
    rows: R.rows, perRow: ribbons[0] ? ribbons[0].rows[0].count : 0,
  }),
});
let noteAt = 0;
function fpsTick(now) {
  diag.frame(frameDt);
  diag.tick(now);
  // The panel's Render section shows what is actually being drawn right now.
  if (now - noteAt < 0.5) return;
  noteAt = now;
  const note = document.getElementById('attr-ratio-note');
  if (note && !note.closest('#attr-panel')?.hidden) {
    note.textContent = (stillMode ? 'frozen: rendering at ' : 'live: rendering at ') + pixelRatio.toFixed(2) + 'x'
      + ' · still quality ' + stillPixelRatio().toFixed(2) + 'x · device ' + window.devicePixelRatio.toFixed(2) + 'x · D for diagnostics';
  }
}
// (the render loop is started at the bottom of the file, after the default preset is applied)

window.addEventListener('resize', applySize);

// Debug hook for stills / tuning from the console.
window.glassDebug = {
  scene, camera, renderer, ribbons, triangles, glass, bgUniforms, post, rowMaterials, envStudio, hover,
  // Debug: read back the final LDR frame (sub-sampled) and report the brightest spot.
  readFrame(step = 4) {
    const t = post.ldr; const w = t.width, h = t.height;
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(t, 0, 0, w, h, buf);
    let best = { lum: -1 }; let sum = 0, n = 0;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4; const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; sum += lum; n++;
      if (lum > best.lum) best = { lum, r, g, b, x: x / w, y: 1 - y / h };
    }
    return { max: best, mean: sum / n, size: [w, h] };
  },
  get pixelRatio() { return pixelRatio; },
  get stillMode() { return stillMode; },
  setPixelRatio(r) { livePixelRatio = r; applySize(); },
  requestRender,
};

// ---------------------------------------------------------------- single triangle studio (1)
// One prism sharing the centre row's material, so every Triangles / lighting
// edit in the panel applies to it. Drag to rotate, wheel to zoom, E to export.
const singleBase = rowMaterials[Math.floor(R.rows / 2)];
// Two passes so the prism reads as a solid piece of glass: the back faces
// (far bevels and underside) are drawn first, then the front faces blend over
// them, so the far edges show through the body. Neither writes depth.
const singleGeo = buildTriangleGeometry(C.single?.apex ?? 1.2);   // taller middle point than the band's triangles
const singleBack = new THREE.Mesh(singleGeo, singleBase), singleFront = new THREE.Mesh(singleGeo, singleBase);
singleBack.renderOrder = 0; singleFront.renderOrder = 1;
singleBack.frustumCulled = singleFront.frustumCulled = false;
single.mesh = new THREE.Group();
single.mesh.add(singleBack, singleFront);
single.mesh.visible = false;
scene.add(single.mesh);
const uiOverlay = document.querySelector('.ui');
function setSingle(on) {
  if (on === single.active) return;
  if (on && cluster.active) setCluster(false);
  single.active = on;
  for (const rb of ribbons) rb.group.visible = !on;
  single.mesh.visible = on;
  if (on) {
    // Fresh copies of the current centre-row look, more see-through than the
    // band (config.single.opacity scales the body opacity).
    for (const [mesh, side] of [[singleBack, THREE.BackSide], [singleFront, THREE.FrontSide]]) {
      if (mesh.material !== singleBase) mesh.material.dispose();
      const m = singleBase.clone();
      m.onBeforeCompile = singleBase.onBeforeCompile;
      m.customProgramCacheKey = () => singleBase.customProgramCacheKey() + '-side' + side;
      m.userData = singleBase.userData;
      m.side = side;
      m.depthWrite = false;
      m.opacity = singleBase.opacity * (C.single?.opacity ?? 0.75);
      mesh.material = m;
    }
    single.uiWasHidden = !!(uiOverlay && uiOverlay.hidden);
    if (uiOverlay) uiOverlay.hidden = true;
  } else {
    if (uiOverlay) uiOverlay.hidden = single.uiWasHidden;
    applyCamera();
  }
  requestRender();
}
frameEl.addEventListener('pointerdown', (e) => {
  if (!single.active || e.button !== 0) return;
  single.dragging = true; single.lastX = e.clientX; single.lastY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!single.active || !single.dragging) return;
  single.rotY += (e.clientX - single.lastX) * 0.01;
  single.rotX += (e.clientY - single.lastY) * 0.01;
  single.lastX = e.clientX; single.lastY = e.clientY;
  requestRender();
});
window.addEventListener('pointerup', () => { single.dragging = false; });
frameEl.addEventListener('wheel', (e) => {
  if (!single.active) return;
  e.preventDefault();
  single.dist = Math.min(5, Math.max(0.5, single.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
  requestRender();
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key !== '1' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(t.type)))) return;
  e.preventDefault();
  setSingle(!single.active);
});

// ---------------------------------------------------------------- cluster scene (2)
// A connected random patch of the same triangular lattice as the band, laid
// flat, tilted toward the camera and parked on the right of the frame. Each
// triangle starts well outside the frame with a random tilt and slides into
// its slot with an ease-out, staggered so the composition grows from the middle.
cluster.group = new THREE.Group();
cluster.group.visible = false;
scene.add(cluster.group);
const _cq = new THREE.Quaternion(), _cq2 = new THREE.Quaternion(), _cp = new THREE.Vector3(), _cs = new THREE.Vector3(1, 1, 1);

function buildCluster() {
  const K = C.cluster;
  const half = R.segment / 2, W = R.width;
  // Lattice cell (k, r) -> its three corner points (same parity rule as the band).
  const point = (k, l) => new THREE.Vector3(k * half, l * W, 0);
  const corners = (k, r) => [
    point(k,     r + ((k     + r) % 2)),
    point(k + 1, r + ((k + 1 + r) % 2)),
    point(k + 2, r + ((k + 2 + r) % 2)),
  ];
  // Grow a connected blob from the centre cell: frontier cells join with
  // probability `fill`, so the outline stays organic rather than a hexagon.
  const cols = K.columns, rows = K.rows;
  const key = (k, r) => k + ',' + r;
  const chosen = new Map();
  const frontier = [];
  const start = [Math.floor(cols / 2) - 1, Math.floor(rows / 2)];
  const push = (k, r) => { if (k >= 0 && k < cols && r >= 0 && r < rows && !chosen.has(key(k, r))) frontier.push([k, r]); };
  chosen.set(key(...start), start);
  const neighbours = (k, r) => [[k - 1, r], [k + 1, r], (k + r) % 2 === 0 ? [k, r - 1] : [k, r + 1]];
  for (const [nk, nr] of neighbours(...start)) push(nk, nr);
  let guard = 0;
  while (chosen.size < K.cells && frontier.length && guard++ < 5000) {
    const i = Math.floor(Math.random() * frontier.length);
    const [k, r] = frontier.splice(i, 1)[0];
    if (chosen.has(key(k, r))) continue;
    if (Math.random() > K.fill) { frontier.push([k, r]); if (frontier.length > 400) frontier.shift(); continue; }
    chosen.set(key(k, r), [k, r]);
    for (const [nk, nr] of neighbours(k, r)) push(nk, nr);
  }

  // Shape override: one big upward triangle of `size` rows built from the small
  // ones (row r holds 2(size-1-r)+1 cells, alternating up / down, so the big
  // outline is a clean equilateral triangle).
  let cells = [...chosen.values()];
  if (K.shape === 'triangle') {
    cells = [];
    const n = Math.max(1, Math.round(K.size || 6));
    for (let r = 0; r < n; r++) for (let k = r; k <= 2 * n - 2 - r; k++) cells.push([k, r]);
  }

  // Poses. Centre the patch on the group origin.
  const centre = new THREE.Vector3();
  const poses = cells.map(([k, r]) => {
    const [A, B, Cc] = corners(k, r);
    const g = A.clone().add(B).add(Cc).multiplyScalar(1 / 3);
    centre.add(g);
    const x = Cc.clone().sub(A).normalize();
    const mid = A.clone().add(Cc).multiplyScalar(0.5);
    const y = B.clone().sub(mid); y.addScaledVector(x, -y.dot(x)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { g, q };
  });
  centre.multiplyScalar(1 / Math.max(1, poses.length));
  let maxD = 1e-6;
  for (const p of poses) { p.g.sub(centre); maxD = Math.max(maxD, p.g.length()); }

  // The shape is present from the first frame. Each triangle bobs up and down
  // along the group normal with its own phase and a whole number of cycles per
  // loop period, so the motion repeats exactly every C.loop.period seconds
  // while the big outline stays intact.
  const maxCycles = Math.max(1, Math.round(K.bob?.cycles ?? 2));
  cluster.items = poses.map((p) => ({
    g: p.g, q: p.q,
    phase: Math.random() * Math.PI * 2,
    cycles: 1 + Math.floor(Math.random() * maxCycles),
    amp: (K.bob?.amp ?? 0.08) * (0.6 + Math.random() * 0.8),
  }));

  // One instanced mesh sharing the centre row's material.
  if (cluster.inst) { cluster.group.remove(cluster.inst); cluster.inst.dispose(); }
  const inst = new THREE.InstancedMesh(triGeo, rowMaterials[Math.floor(R.rows / 2)], cluster.items.length);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  cluster.inst = inst;
  cluster.group.add(inst);
  cluster.group.position.set(K.offsetX, K.offsetY, 0);
  cluster.group.rotation.set(K.tiltX, K.tiltY, K.tiltZ || 0);
  cluster.group.scale.setScalar(K.scale);
  cluster.t = 0;
  updateCluster();
}

// Pose every triangle and turn the whole shape for the current clock. Both
// are periodic in C.loop.period: the group makes whole turns / whole wobble
// cycles per period, each triangle a whole number of bob cycles. Returns true
// (always animating).
function updateCluster() {
  if (!cluster.inst) return false;
  const K = C.cluster, P = C.loop.period;
  const t = cluster.t;
  const w = (2 * Math.PI * t) / P;
  cluster.items.forEach((it, i) => {
    _cp.copy(it.g);
    _cp.z += it.amp * Math.sin(w * it.cycles + it.phase);
    _m4.compose(_cp, it.q, _cs);
    cluster.inst.setMatrixAt(i, _m4);
  });
  cluster.inst.instanceMatrix.needsUpdate = true;
  // Whole-shape rotation: base tilt (drag-adjustable) + full turns + wobble.
  const turns = K.turns || {}, wob = K.wobble || {};
  cluster.group.rotation.set(
    K.tiltX + (turns.x || 0) * w + (wob.x || 0) * Math.sin(w * (wob.cyclesX || 1)),
    K.tiltY + (turns.y || 0) * w + (wob.y || 0) * Math.sin(w * (wob.cyclesY || 1) + 1.7),
    (K.tiltZ || 0) + (turns.z || 0) * w + (wob.z || 0) * Math.sin(w * (wob.cyclesZ || 1) + 0.9));
  return true;
}

// Drag to rotate the composition (writes straight into config.cluster.tiltX /
// tiltY so the readout shows values that can be pasted back as the default).
const clusterRot = document.createElement('div');
clusterRot.id = 'cluster-rot';
clusterRot.hidden = true;
clusterRot.style.cssText = 'position:absolute;left:var(--pad);top:calc(clamp(18px, 2vw, 36px) + 56px + 10px + 38px);z-index:3;' +
  'padding:6px 10px;border-radius:6px;background:rgba(0,0,0,0.35);backdrop-filter:blur(10px);color:#fff;' +
  'font:300 12px/1.4 ui-monospace,Consolas,monospace;pointer-events:none;';
frameEl.appendChild(clusterRot);
function updateClusterReadout() {
  const K = C.cluster;
  clusterRot.textContent = `cluster tiltX ${K.tiltX.toFixed(3)} · tiltY ${K.tiltY.toFixed(3)} · tiltZ ${(K.tiltZ || 0).toFixed(3)} · drag to rotate · C to copy`;
}
function applyClusterRotation() {
  updateCluster();          // rotation is composed from the base tilt each frame
  updateClusterReadout();
}
frameEl.addEventListener('pointerdown', (e) => {
  if (!cluster.active || e.button !== 0) return;
  cluster.dragging = true; cluster.lastX = e.clientX; cluster.lastY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!cluster.active || !cluster.dragging) return;
  C.cluster.tiltY += (e.clientX - cluster.lastX) * 0.006;
  C.cluster.tiltX += (e.clientY - cluster.lastY) * 0.006;
  cluster.lastX = e.clientX; cluster.lastY = e.clientY;
  applyClusterRotation();
  requestRender();
});
window.addEventListener('pointerup', () => { cluster.dragging = false; });

function setCluster(on) {
  if (on === cluster.active) return;
  if (on && single.active) setSingle(false);
  cluster.active = on;
  for (const rb of ribbons) rb.group.visible = !on;
  cluster.group.visible = on;
  clusterRot.hidden = !on;
  if (on) { buildCluster(); applyClusterRotation(); } else applyCamera();
  requestRender();
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(t.type)))) return;
  if (e.key === '2') { e.preventDefault(); setCluster(!cluster.active); return; }
  // In the cluster scene R builds a new composition instead of rolling the band.
  if ((e.key === 'r' || e.key === 'R') && cluster.active) { e.preventDefault(); e.stopImmediatePropagation(); buildCluster(); requestRender(); return; }
  // C copies the current rotation as JSON for pasting back into config.cluster.
  if ((e.key === 'c' || e.key === 'C') && cluster.active) {
    e.preventDefault();
    const K = C.cluster;
    const json = JSON.stringify({ tiltX: +K.tiltX.toFixed(3), tiltY: +K.tiltY.toFixed(3), tiltZ: +((K.tiltZ || 0).toFixed(3)) });
    navigator.clipboard?.writeText(json).then(() => { clusterRot.textContent = 'copied ' + json; }, () => { clusterRot.textContent = json; });
    console.log('cluster rotation', json);
  }
}, true);

// Attributes panel: press A to toggle.
const panelApi = initPanel({
  C, R,
  ribbonGroup: ribbons[0].group,
  envStudio,
  bgUniforms,
  rowMaterials,
  realGlass: REAL_GLASS,
  camera,
  applyCamera,
  sunLights,
  sceneControl,
  glossUniforms,
  fadeDepthUniform,
  facetsApi,
  pulsesApi,
  requestRender,
  getPixelRatio: () => livePixelRatio,
  setPixelRatio: (r) => { livePixelRatio = r; applySize(); },
});
window.glassDebug.panel = panelApi;   // panel.applySettings(json) / applyPreset(i) / exportSettings()
window.glassDebug.sceneControl = sceneControl;   // clocks, loop, renderFrame, exportPNG
window.glassDebug.diag = diag;                   // diag.reportText() / diag.setVisible(true)
window.glassDebug.pulses = { uniforms: pulseUniforms, state: pulseState };
window.glassDebug.single = single;               // single-triangle studio state (key 1)
window.glassDebug.setSingle = setSingle;
window.glassDebug.cluster = cluster;             // cluster scene state (key 2)
window.glassDebug.setCluster = setCluster;
window.glassDebug.buildCluster = buildCluster;
window.glassDebug.updateCluster = updateCluster;

// The site loads with preset 1 (presets.js) applied over the config.js
// defaults, before the first frame is rendered so there is no flash.
if (window.PRESETS && window.PRESETS[0]) panelApi.applyPreset(0);
panelApi.clearHistory();   // the initial preset is the baseline, not an undo step
tick();

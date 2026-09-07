import * as THREE from 'three';

const C = window.CONFIG;

// ---------------------------------------------------------------- renderer
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
let pixelRatio = Math.min(window.devicePixelRatio, C.quality.maxPixelRatio);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// The transmission buffer has no MSAA; a 1px bright edge in it mips down into
// a beaded line when refracted. Supersampling it gives the blur a clean base.
renderer.transmissionResolutionScale = C.glass.transmissionScale;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = C.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(C.camera.fov, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, C.camera.height ?? 0.3, C.camera.distance);
camera.lookAt(0, C.camera.lookAtY || 0, 0);

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
// with an edge. Intensities are deliberately low: the flat surface reflects
// this map at grazing angles across its whole width.
function buildEnvironment() {
  const env = new THREE.Scene();

  const wash = new THREE.Mesh(
    new THREE.SphereGeometry(30, 16, 8),
    // Bright, edge-free ambient: this is what gives the faces their silvery sheen now that the shaped lights are soft.
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
  const softLight = (color, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, map: glowTex, transparent: true, side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.lookAt(new THREE.Vector3());
    env.add(m);
  };

  // Colours are ~117% of the earlier hard-panel values (the feathering itself removes a lot of energy).
  softLight(new THREE.Color(14.0, 6.4, 1.6),  10, 3.5, new THREE.Vector3(-6, 5, 4));    // warm amber key
  softLight(new THREE.Color(1.75, 7.0, 11.75), 11, 5,  new THREE.Vector3(7, -2, 5));    // cool cyan-blue kicker
  softLight(new THREE.Color(3.9, 3.0, 6.55),   7, 7,   new THREE.Vector3(1, 6, -4));    // lavender pool up-forward (what sweeps the surface)
  softLight(new THREE.Color(5.5, 5.6, 6.0),   12, 12,  new THREE.Vector3(-3, 8, -1));   // broad soft white overhead: the silvery "shine" on the faces
  softLight(new THREE.Color(10.5, 4.25, 1.2),  8, 8,   new THREE.Vector3(4, -7, -2));   // warm bounce from below
  softLight(new THREE.Color(0.6, 2.1, 1.9),   14, 14,  new THREE.Vector3(0, 0, -12));   // aqua backdrop
  softLight(new THREE.Color(11.7, 7.0, 3.0),   4, 14,  new THREE.Vector3(-9, -1, -3));  // tall warm side band

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return target.texture;
}
scene.environment = buildEnvironment();

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
  clearcoatRoughness: 0.04,   // keep the surface highlights crisp while the body stays soft
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
function buildTriangleGeometry() {
  const L = R.segment, W = R.width;
  const pts = [
    new THREE.Vector2(-L / 2, -W / 3),
    new THREE.Vector2( L / 2, -W / 3),
    new THREE.Vector2( 0,  2 * W / 3),
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
function injectDepthFade(shader) {
  shader.uniforms.uFadeDepth = fadeDepthUniform;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vDepthFade;\nuniform vec2 uFadeDepth;')
    .replace('#include <project_vertex>',
      '#include <project_vertex>\nvDepthFade = 1.0 - smoothstep(uFadeDepth.x, uFadeDepth.y, -mvPosition.z);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDepthFade;')
    .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vDepthFade;');
}

// One wide ribbon: a lattice of `columns` along the flow and `rows + 1`
// lines across the width. Row r is a triangle strip between lines r and
// r + 1; its vertex k sits on line r + ((k + r) % 2), so neighbouring rows
// share their vertices exactly and the whole band reads as one surface.
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
    rows.push({ inst, count, states });
  }
  scene.add(group);
  ribbons.push({
    rows, columns,
    // grid[k][l]: column k, line l
    grid: Array.from({ length: columns }, () =>
      Array.from({ length: R.rows + 1 }, () => new THREE.Vector3())),
    lastWrap: 0,
  });
}
makeRibbon();

// Ribbon centreline at along-flow coordinate x.
function pathPoint(x, t, out) {
  const grow = 1 + R.growth * (x / (R.length / 2));   // amplitude ramps up toward the right
  const y = Math.sin(x * R.waveFreq - t * R.waveSpeed + R.wavePhase) * R.waveAmp * grow
    + Math.sin(x * R.wave2Freq + t * R.wave2Speed + 1.3) * R.wave2Amp
    + Math.sin(t * R.driftSpeed) * R.drift;
  const z = Math.sin(x * R.depthFreq - t * R.depthSpeed + 0.7) * R.depthAmp;
  return out.set(x, y, z);
}

const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _tan = new THREE.Vector3();
const _up = new THREE.Vector3(), _side = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _mid = new THREE.Vector3(), _g = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _e = new THREE.Euler();

function updateRibbon(rb, t) {
  const half = R.segment / 2;
  const total = R.segment;
  const flow = t * R.flowSpeed;
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
      }
    }
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
  }

  // Pose each rigid triangle onto its three lattice vertices: A and C share a
  // line (the base), B is the apex on the neighbouring line.
  for (let r = 0; r < R.rows; r++) {
    const row = rb.rows[r];
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
}

// Thin rim lights sharpen the bevel highlights beyond what the env gives.
const key = new THREE.DirectionalLight(0xffe0b0, 1.4);
key.position.set(-4, 5, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fe8ff, 1.0);
rim.position.set(5, -2, 4);
scene.add(rim);

// ---------------------------------------------------------------- bloom
// Minimal post chain: scene -> HDR target, bright-pass to half res, separable
// blur, then composite + tone map. Tone mapping is deliberately deferred to
// the composite so the threshold works on linear HDR values.
const post = (() => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const hdr = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: C.quality.msaa });
  const mk = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const pingA = mk(), pingB = mk();
  const ldr = new THREE.WebGLRenderTarget(size.x, size.y); // tone-mapped sRGB frame, input to FXAA

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
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir, uTexel;
      void main() {
        float w[5]; w[0]=0.2270270; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.0540541; w[4]=0.0162162;
        vec3 c = texture2D(tSrc, vUv).rgb * w[0];
        for (int i = 1; i < 5; i++) {
          vec2 o = uDir * uTexel * float(i) * 1.5;
          c += texture2D(tSrc, vUv + o).rgb * w[i];
          c += texture2D(tSrc, vUv - o).rgb * w[i];
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
    },
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform sampler2D tScene, tBloom; uniform float uStrength;
      #include <tonemapping_pars_fragment>
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength;
        c = ACESFilmicToneMapping(c);
        gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
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

  function resize() {
    renderer.getDrawingBufferSize(size);
    hdr.setSize(size.x, size.y);
    ldr.setSize(size.x, size.y);
    fxaaMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    const hw = Math.max(1, Math.floor(size.x / 2)), hh = Math.max(1, Math.floor(size.y / 2));
    pingA.setSize(hw, hh);
    pingB.setSize(hw, hh);
    blurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
  }
  resize();

  function blit(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  function render() {
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);

    brightMat.uniforms.tSrc.value = hdr.texture;
    blit(brightMat, pingA);
    for (let i = 0; i < C.bloom.passes; i++) {
      blurMat.uniforms.tSrc.value = pingA.texture; blurMat.uniforms.uDir.value.set(1, 0);
      blit(blurMat, pingB);
      blurMat.uniforms.tSrc.value = pingB.texture; blurMat.uniforms.uDir.value.set(0, 1);
      blit(blurMat, pingA);
    }

    compositeMat.uniforms.tScene.value = hdr.texture;
    compositeMat.uniforms.tBloom.value = pingA.texture;
    blit(compositeMat, ldr);

    fxaaMat.uniforms.tSrc.value = ldr.texture;
    blit(fxaaMat, null);
  }

  return { render, resize };
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
function applySize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.resize();
}

// Adaptive resolution: average the frame time over a window and, while it is
// slower than the target, step the pixel ratio down. It never steps back up,
// so the picture does not pulse between qualities.
const Q = C.quality;
let frameAccum = 0, frameCount = 0, lastFrame = performance.now();
function adaptResolution(now) {
  frameAccum += now - lastFrame;
  frameCount++;
  lastFrame = now;
  if (frameAccum < Q.stepEverySec * 1000) return;
  const avg = frameAccum / frameCount;
  frameAccum = 0; frameCount = 0;
  if (avg > Q.targetFrameMs && pixelRatio > Q.minPixelRatio) {
    pixelRatio = Math.max(Q.minPixelRatio, +(pixelRatio - 0.25).toFixed(2));
    applySize();
  }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  bgUniforms.uTime.value = t;
  updateBreakaway(t);
  for (const rb of ribbons) updateRibbon(rb, t);

  post.render();
  adaptResolution(performance.now());
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', applySize);

// Debug hook for stills / tuning from the console.
window.glassDebug = {
  scene, camera, renderer, ribbons, triangles, glass, bgUniforms,
  get pixelRatio() { return pixelRatio; },
  setPixelRatio(r) { pixelRatio = r; applySize(); },
};

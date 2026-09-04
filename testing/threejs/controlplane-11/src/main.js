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
camera.position.set(0, 0.3, C.camera.distance);
camera.lookAt(0, C.camera.lookAtY || 0, 0);

// Mouse-wheel zoom: the camera slides along its own line of sight toward the
// look-at point. Exponential steps feel even at every distance, and the
// minimum sits well inside the sphere so you can travel through the shell.
const Z = C.camera.zoom;
const lookTarget = new THREE.Vector3(0, C.camera.lookAtY || 0, 0);
const viewDir = camera.position.clone().sub(lookTarget).normalize();
let zoomTarget = camera.position.distanceTo(lookTarget);
let zoomCurrent = zoomTarget;
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomTarget = THREE.MathUtils.clamp(zoomTarget * Math.exp(e.deltaY * Z.speed), Z.min, Z.max);
}, { passive: false });
function updateZoom() {
  zoomCurrent += (zoomTarget - zoomCurrent) * Z.smoothing;
  camera.position.copy(lookTarget).addScaledVector(viewDir, zoomCurrent);
}

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
// A synthetic studio for the glass: mostly the teal wash with a couple of
// hot warm/cool panels so refraction picks up the amber/blue bands seen in
// the reference image.
function buildEnvironment() {
  const env = new THREE.Scene();

  const wash = new THREE.Mesh(
    new THREE.SphereGeometry(30, 16, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(C.colors.mid).multiplyScalar(0.35), side: THREE.BackSide })
  );
  env.add(wash);

  const panel = (color, w, h, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(look || new THREE.Vector3());
    env.add(m);
  };

  panel(new THREE.Color(12.0, 5.5, 1.4), 7, 1.6, new THREE.Vector3(-6, 5, 4));   // warm amber key (a band, not a wall)
  panel(new THREE.Color(1.5, 6.0, 10.0), 8, 2.6, new THREE.Vector3(7, -2, 5));   // cool cyan-blue kicker
  panel(new THREE.Color(4.0, 4.0, 4.4), 1.4, 9, new THREE.Vector3(1, 6, -4));    // white strip for specular lines (wider + dimmer = less beading when refracted)
  panel(new THREE.Color(9.0, 3.6, 1.0), 5, 5, new THREE.Vector3(4, -7, -2));     // warm bounce from below
  panel(new THREE.Color(0.5, 1.8, 1.6), 10, 10, new THREE.Vector3(0, 0, -12));   // aqua backdrop (kept dim: at grazing angles it washes the whole band)
  panel(new THREE.Color(10.0, 6.0, 2.5), 2, 12, new THREE.Vector3(-9, -1, -3));  // tall warm side band

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return target.texture;
}
scene.environment = buildEnvironment();

// ---------------------------------------------------------------- glass
const glass = new THREE.MeshPhysicalMaterial({
  color: C.glass.tint,
  metalness: 0,
  roughness: C.glass.roughness,
  transmission: 1,
  thickness: C.glass.thickness,
  ior: C.glass.ior,
  dispersion: C.glass.dispersion,
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

// ---------------------------------------------------------------- sphere
// An icosphere where every face is one of the extruded, bevelled glass
// triangles. Each face prism is built in its own tangent frame, transformed
// onto the sphere, and everything is merged into a single static mesh; the
// whole sphere then just rotates.
const S = C.sphere;

function buildTrianglePrism(a, b, c, normal) {
  // Local frame on the face plane: x along the first edge, y = n x x.
  const g = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
  const x = new THREE.Vector3().subVectors(b, a).normalize();
  const y = new THREE.Vector3().crossVectors(normal, x).normalize();
  const to2D = (p) => {
    const d = new THREE.Vector3().subVectors(p, g);
    return new THREE.Vector2(d.dot(x), d.dot(y));
  };
  const pts = [to2D(a), to2D(b), to2D(c)];

  // Pull the corners toward the centroid so the seams survive the bevel.
  const inset = S.gap * 0.5 + S.bevel;
  const shrunk = pts.map((p) => {
    const len = p.length();
    return p.clone().multiplyScalar(Math.max(len - inset * 1.6, 0) / len);
  });

  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(shrunk), {
    depth: S.extrude,
    bevelEnabled: true,
    bevelThickness: S.bevel,
    bevelSize: S.bevel,
    bevelSegments: 4,
    curveSegments: 3,
  });
  geo.translate(0, 0, -S.bevel);   // base sits on the face plane, prism stands proud outward
  const m = new THREE.Matrix4().makeBasis(x, y, normal).setPosition(g);
  geo.applyMatrix4(m);
  return geo;
}

// Shell material: the glass plus a vertex-shader displacement that moves each
// prism along its face normal by a smooth field over the sphere (three
// low-frequency sine waves in different directions) plus a per-face jitter.
const undulateUniforms = {
  uTime:   { value: 0 },
  uAmp:    { value: S.undulate.amp },
  uFreq:   { value: S.undulate.freq },
  uSpeed:  { value: S.undulate.speed },
  uJitter: { value: S.undulate.jitter },
};
const shellGlass = glass.clone();
shellGlass.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, undulateUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', /* glsl */`
      #include <common>
      attribute vec3 aFaceNormal;
      attribute float aPhase;
      uniform float uTime, uAmp, uFreq, uSpeed, uJitter;
      float undulation(vec3 n, float phase) {
        float t = uTime * uSpeed;
        float f = sin(dot(n, vec3( 0.80,  0.35,  0.49)) * uFreq       + t)
                + sin(dot(n, vec3(-0.36,  0.87,  0.34)) * uFreq * 1.3 - t * 0.8)
                + sin(dot(n, vec3( 0.20, -0.45,  0.87)) * uFreq * 0.7 + t * 1.2);
        f /= 3.0;
        f = mix(f, sin(t * 1.5 + phase * 6.2831), uJitter);
        return f * uAmp;
      }
    `)
    .replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      transformed += aFaceNormal * undulation(aFaceNormal, aPhase);
    `);
};
shellGlass.customProgramCacheKey = () => 'shell-undulate';

function buildSphere() {
  const ico = new THREE.IcosahedronGeometry(S.radius, S.detail);   // non-indexed: 3 vertices per face
  const pos = ico.getAttribute('position');
  const positions = [], normals = [], faceNormals = [], phases = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.copy(a).add(b).add(c).normalize();   // radial normal = face-plane normal on an icosphere
    const geo = buildTrianglePrism(a, b, c, n);
    geo.computeVertexNormals();
    positions.push(...geo.getAttribute('position').array);
    normals.push(...geo.getAttribute('normal').array);
    // Per-vertex copy of the face's radial direction and a random phase, so
    // the vertex shader can slide the whole prism in/out as a rigid unit.
    const count = geo.getAttribute('position').count;
    const phase = Math.random();
    for (let k = 0; k < count; k++) { faceNormals.push(n.x, n.y, n.z); phases.push(phase); }
    geo.dispose();
  }
  ico.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('aFaceNormal', new THREE.Float32BufferAttribute(faceNormals, 3));
  merged.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));

  const group = new THREE.Group();
  group.add(new THREE.Mesh(merged, shellGlass));

  // A solid glass core gives the transmission some body; without it the
  // thin prisms read as a hollow foil shell.
  if (S.core) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(S.radius - 0.02, 48, 32), glass);
    group.add(core);
  }
  group.position.fromArray(S.position);
  scene.add(group);
  return { group, faces: pos.count / 3 };
}

const sphere = buildSphere();
const baseRotation = new THREE.Euler(S.tiltX, 0, S.tiltZ);

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
  undulateUniforms.uTime.value = t;

  // Steady spin about Y with a slow tumble about X, plus a gentle bob.
  sphere.group.rotation.set(
    baseRotation.x + Math.sin(t * S.tumbleSpeed) * S.tumbleAmp,
    t * S.spinSpeed,
    baseRotation.z
  );
  sphere.group.position.y = S.position[1] + Math.sin(t * S.floatSpeed) * S.floatAmp;

  post.render();
  adaptResolution(performance.now());
  updateZoom();
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', applySize);

// Debug hook for stills / tuning from the console.
window.glassDebug = {
  scene, camera, renderer, sphere, glass, shellGlass, bgUniforms, undulateUniforms,
  get pixelRatio() { return pixelRatio; },
  setPixelRatio(r) { pixelRatio = r; applySize(); },
};

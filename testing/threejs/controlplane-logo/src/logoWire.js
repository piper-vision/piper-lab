import * as THREE from 'three';

// The logo drawn in the cube's style: glowing outline lines round the front
// and back of the extruded shape, faint additive haze on the faces (brightest
// near the outline) and the same halftone dot screen.
//
// `toLocal(x, y, z)` maps SVG coords (z along the extrusion) into the logo
// geometry's local space; `svgBox` is the SVG viewBox {w, h}.
export function buildWireLogo({ shapes, geo, toLocal, svgBox, k, cfg, cube, dots }) {
  const group = new THREE.Group();
  const W = cfg.wire;

  // ---------------------------------------------------------- outline lines
  const segs = [];
  const zs = [-cfg.bevelThickness, cfg.depth + cfg.bevelThickness]; // the two cap planes
  for (const shape of shapes) {
    const loops = [shape.getPoints(16), ...shape.holes.map((h) => h.getPoints(16))];
    for (const pts of loops) {
      for (const [ci, z] of zs.entries()) {
        const cap = ci === 0 ? 1 : -1; // cap normal along local z after the X flip
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (a.distanceTo(b) < 1e-4) continue;
          segs.push([toLocal(a.x, a.y, z), toLocal(b.x, b.y, z), cap]);
        }
      }
    }
  }
  const n = segs.length;
  const aA = new Float32Array(n * 12), aB = new Float32Array(n * 12);
  const aCorner = new Float32Array(n * 8), aCap = new Float32Array(n * 4);
  const index = [];
  const corners = [0, -1, 1, -1, 1, 1, 0, 1];
  segs.forEach(([A, B, cap], s) => {
    for (let v = 0; v < 4; v++) {
      const o = (s * 4 + v);
      aA.set([A.x, A.y, A.z], o * 3);
      aB.set([B.x, B.y, B.z], o * 3);
      aCorner.set(corners.slice(v * 2, v * 2 + 2), o * 2);
      aCap[o] = cap;
    }
    const b = s * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(aA.slice(), 3)); // only for bounds
  lineGeo.setAttribute('aA', new THREE.BufferAttribute(aA, 3));
  lineGeo.setAttribute('aB', new THREE.BufferAttribute(aB, 3));
  lineGeo.setAttribute('aCorner', new THREE.BufferAttribute(aCorner, 2));
  lineGeo.setAttribute('aCap', new THREE.BufferAttribute(aCap, 1));
  lineGeo.setIndex(index);

  const E = cube.edgeStyle;
  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      uPad: { value: E.glowWidth * 3.5 },
      uCore: { value: E.coreWidth },
      uGlowWidth: { value: E.glowWidth },
      uGlow: { value: E.glow },
      uFront: { value: W.edge.front },
      uBack: { value: W.edge.back },
      uOpacity: { value: W.opacity },
    },
    vertexShader: /* glsl */`
      attribute vec3 aA, aB;
      attribute vec2 aCorner;
      attribute float aCap;
      uniform float uPad, uFront, uBack;
      varying vec2 vP;
      varying float vLen, vBright;
      void main() {
        vec4 a = modelViewMatrix * vec4(aA, 1.0);
        vec4 b = modelViewMatrix * vec4(aB, 1.0);
        vec2 d2 = b.xy - a.xy;
        float len = max(length(d2), 1e-5);
        vec2 dir = d2 / len;
        vec2 perp = vec2(-dir.y, dir.x);
        float s = aCorner.x * 2.0 - 1.0;
        vec4 p = mix(a, b, aCorner.x);
        p.xy += dir * s * uPad + perp * aCorner.y * uPad;
        vP = vec2(aCorner.x * len + s * uPad, aCorner.y * uPad);
        vLen = len;
        // outline on the cap facing the camera is brighter than the far one
        vec3 capN = normalize(normalMatrix * vec3(0.0, 0.0, aCap));
        float f = dot(capN, normalize(-a.xyz));
        vBright = mix(uBack, uFront, smoothstep(-0.3, 0.3, f));
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */`
      uniform float uCore, uGlowWidth, uGlow, uOpacity;
      varying vec2 vP;
      varying float vLen, vBright;
      void main() {
        float beyond = max(0.0, max(-vP.x, vP.x - vLen));
        float d = length(vec2(beyond, vP.y));
        float fw = fwidth(d) * 0.75;
        float core = 1.0 - smoothstep(uCore - fw, uCore + fw, d);
        float g = d / uGlowWidth;
        float glow = uGlow * exp(-g * g) + uGlow * 0.35 * exp(-g * 0.9);
        float v = vBright * core + vBright * vBright * glow;
        gl_FragColor = vec4(vec3(v * uOpacity), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    // MAX (not additive) so the many short segments don't bead at the joins
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 2;

  // ---------------------------------------------------------- face haze + dots
  // Distance-to-outline approximation: the shape blurred onto a canvas. Inside
  // the shape the blur is ~0.5 at the outline and ~1 deep inside.
  const haze = makeHazeTexture(shapes, svgBox, W.hazeWidth);

  const origin = toLocal(0, 0, 0);
  const ux = toLocal(1, 0, 0).sub(origin); // local delta per SVG unit in x
  const uy = toLocal(0, 1, 0).sub(origin); // ... and in y
  const faceMat = new THREE.ShaderMaterial({
    uniforms: {
      uHaze: { value: haze },
      uOrigin: { value: origin },
      uK: { value: k },
      uFlipX: { value: Math.sign(ux.x) },
      uFlipY: { value: Math.sign(uy.y) },
      uBox: { value: new THREE.Vector2(svgBox.w, svgBox.h) },
      uBase: { value: cube.face.base },
      uGlow: { value: cube.face.glow * W.faceGlow },
      uSide: { value: W.sideGlow },
      uOpacity: { value: W.opacity },
      uPhase: { value: 0 },
      uDotCount: { value: dots.count / cube.size }, // same dot pitch as the cube
      uDotRadius: { value: dots.radius },
      uDotBright: { value: dots.brightness },
      uDotEdgeAmt: { value: dots.edgeAmount },
      uDotPatch: { value: dots.patchAmount },
      uDotPatchScale: { value: dots.patchScale },
      uDotDrift: { value: dots.drift },
    },
    vertexShader: /* glsl */`
      varying vec3 vLocal, vN;
      varying float vFacing;
      void main() {
        vLocal = position;
        vN = normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = dot(normalize(normalMatrix * normal), normalize(-mv.xyz));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uHaze;
      uniform vec3 uOrigin;
      uniform float uK, uFlipX, uFlipY, uBase, uGlow, uSide, uOpacity, uPhase;
      uniform vec2 uBox;
      uniform float uDotCount, uDotRadius, uDotBright, uDotEdgeAmt, uDotPatch, uDotPatchScale, uDotDrift;
      varying vec3 vLocal, vN;
      varying float vFacing;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      void main() {
        float capness = smoothstep(0.6, 0.9, abs(vN.z));
        // back to SVG units to sample the outline-distance texture
        vec2 svg = vec2((vLocal.x - uOrigin.x) * uFlipX, (vLocal.y - uOrigin.y) * uFlipY) / uK;
        float B = texture2D(uHaze, vec2(svg.x / uBox.x, 1.0 - svg.y / uBox.y)).r;
        float edgeF = clamp((1.0 - B) * 2.0, 0.0, 1.0);   // 1 at the outline, 0 deep inside

        float g = uBase + uGlow * edgeF;

        // halftone dots, same pitch and treatment as the cube faces
        vec2 p = vLocal.xy * uDotCount;
        float row = floor(p.y);
        p.x += mod(row, 2.0) * 0.5;
        vec2 cellId = floor(p);
        float r = length(fract(p) - 0.5);
        float ang = uPhase * 6.2831853;
        float nz = noise(vLocal.xy * uDotPatchScale + vec2(cos(ang), sin(ang)) * uDotDrift + 5.3);
        float mask = clamp(edgeF * uDotEdgeAmt + smoothstep(0.45, 0.85, nz) * uDotPatch, 0.0, 1.0);
        float on = step(hash(cellId + 31.0), mask * 1.6);
        float rad = uDotRadius * sqrt(mask);
        float aa = fwidth(p.x) * 0.8;
        float dotv = (1.0 - smoothstep(rad - aa, rad + aa, r)) * on;
        float facing = gl_FrontFacing ? smoothstep(0.08, 0.45, vFacing) : 0.0;
        g += dotv * uDotBright * (0.4 + 0.6 * mask) * facing;

        // side walls: thin glass, glowing like an edge
        g = mix(uBase + uSide, g, capness);
        gl_FragColor = vec4(vec3(g * uOpacity), 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const faces = new THREE.Mesh(geo, faceMat);
  faces.renderOrder = 1;

  group.add(faces, lines);
  return { group, faceMat, lineMat };
}

// Outline-distance approximation for halftone/haze masks: the shape blurred
// onto a canvas (in SVG units). Inside the shape the value is ~0.5 at the
// outline and ~1 deep inside.
export function makeHazeTexture(shapes, svgBox, hazeWidth) {
  const px = 4;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(svgBox.w * px);
  cv.height = Math.ceil(svgBox.h * px);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.filter = `blur(${hazeWidth * px}px)`;
  ctx.setTransform(px, 0, 0, px, 0, 0);
  ctx.fillStyle = '#fff';
  for (const shape of shapes) {
    const p2 = new Path2D();
    const addLoop = (pts) => { pts.forEach((p, i) => (i ? p2.lineTo(p.x, p.y) : p2.moveTo(p.x, p.y))); p2.closePath(); };
    addLoop(shape.getPoints(16));
    shape.holes.forEach((h) => addLoop(h.getPoints(16)));
    ctx.fill(p2, 'evenodd');
  }
  const haze = new THREE.CanvasTexture(cv);
  haze.colorSpace = THREE.NoColorSpace;
  return haze;
}

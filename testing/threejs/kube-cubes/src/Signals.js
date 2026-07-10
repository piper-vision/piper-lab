// Repair signals: long neon streaks that race along clean, axis-aligned
// network paths from distant cubes toward the corrupted one. Each streak is
// a camera-facing ribbon with a white-hot core and a deep-blue glow, and its
// head doubles as a moving point light that washes over nearby cubes.

import * as THREE from 'three';

const RIBBON_VERT = /* glsl */ `
  attribute vec3 aTangent;      // path direction at this sample
  attribute float aT;           // normalized arc length along the path
  attribute float aSide;        // -1 / +1, extruded across the ribbon
  uniform float uWidth;
  varying float vT;
  varying float vSide;

  void main() {
    vT = aT;
    vSide = aSide;
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    // Billboard the ribbon: extrude sideways, perpendicular to the view ray,
    // so the streak always presents its full width to the camera.
    vec3 viewDir = normalize(cameraPosition - wp);
    vec3 side = normalize(cross(aTangent, viewDir));
    wp += side * aSide * uWidth;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const RIBBON_FRAG = /* glsl */ `
  uniform float uHead;          // pulse head position along the path (0..1)
  uniform float uAlive;         // global fade in/out
  uniform vec3 uColor;
  varying float vT;
  varying float vSide;

  void main() {
    float d = uHead - vT;
    float head = smoothstep(0.03, 0.0, abs(d));          // white-hot head
    float trail = d > 0.0 ? exp(-d * 1.6) : 0.0;          // very long tail
    float along = head * 2.6 + trail * 1.4;

    // Cross-section: wide soft blue glow around a tight white core.
    float glow = exp(-vSide * vSide * 3.0);
    float core = exp(-vSide * vSide * 16.0);

    vec3 col = uColor * along * glow + vec3(1.0) * along * core * 0.75;
    gl_FragColor = vec4(col * uAlive, 1.0);
  }
`;

export class Signals {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.headTexture = makeDotTexture();
  }

  /**
   * Spawn one signal travelling from `from` to `to`.
   * `onArrive` fires when the pulse head reaches the corrupted cube.
   */
  spawn(from, to, { delay = 0, travel = 0.55, seed = 0, onArrive } = {}) {
    // Angular Manhattan-style route: three axis-aligned legs in a
    // seed-shuffled order, so signals approach from clean right-angled paths.
    const pts = buildRoute(from, to, seed);

    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    const total = lens[lens.length - 1];

    // Resample the polyline and build a two-sided ribbon strip.
    const n = Math.min(200, Math.max(24, Math.round(total * 2)));
    const positions = new Float32Array((n + 1) * 2 * 3);
    const tangents = new Float32Array((n + 1) * 2 * 3);
    const ts = new Float32Array((n + 1) * 2);
    const sides = new Float32Array((n + 1) * 2);
    const index = [];
    const p = new THREE.Vector3();
    const pPrev = new THREE.Vector3();
    const pNext = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const dist = (i / n) * total;
      placeAlong(pts, lens, dist, p);
      placeAlong(pts, lens, Math.max(0, dist - 0.25), pPrev);
      placeAlong(pts, lens, Math.min(total, dist + 0.25), pNext);
      tan.subVectors(pNext, pPrev).normalize();
      for (let s = 0; s < 2; s++) {
        const v = i * 2 + s;
        positions.set([p.x, p.y, p.z], v * 3);
        tangents.set([tan.x, tan.y, tan.z], v * 3);
        ts[v] = i / n;
        sides[v] = s === 0 ? -1 : 1;
      }
      if (i < n) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
    geo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
    geo.setIndex(index);

    const mat = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      uniforms: {
        uHead: { value: -0.1 },
        uAlive: { value: 0 },
        uWidth: { value: 0.42 },
        uColor: { value: new THREE.Color(0.28, 0.55, 1.0) },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ribbon = new THREE.Mesh(geo, mat);
    ribbon.frustumCulled = false;
    ribbon.userData.noDepth = true;
    this.scene.add(ribbon);

    // Glowing particle riding the pulse head.
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.headTexture,
        color: 0xcfe8ff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    head.scale.setScalar(2.8);
    head.visible = false;
    head.userData.noDepth = true;
    this.scene.add(head);

    this.active.push({
      ribbon, mat, head, pts, lens, total,
      t: -delay, travel, arrived: false, fade: 1, fading: false, onArrive,
      zOffset: 0,          // accumulated field scroll since spawn
      lightPos: new THREE.Vector3(),
      lightI: 0,           // current point-light intensity
      pulse: 0,            // arrival flash decay
    });
  }

  /** Smoothly retire all signals (called as the repair completes). */
  fadeOut() {
    for (const s of this.active) s.fading = true;
  }

  /** dScroll: how far the field drifted this frame — paths ride along. */
  update(dt, dScroll = 0) {
    for (const s of this.active) {
      s.t += dt;
      s.zOffset += dScroll;
      s.ribbon.position.z = s.zOffset;

      const raw = Math.max(s.t, 0) / s.travel;
      const p = Math.min(easeInOut(Math.min(raw, 1)), 1);
      s.mat.uniforms.uHead.value = p;
      s.mat.uniforms.uAlive.value = Math.min(Math.max(s.t * 6, 0), 1) * s.fade;

      // The head sprite + its light follow the pulse; after arrival the
      // light lingers on the target as a decaying flash.
      placeAlong(s.pts, s.lens, s.total * p, s.lightPos);
      s.lightPos.z += s.zOffset;
      if (s.t > 0 && !s.arrived) {
        s.head.visible = true;
        s.head.material.opacity = s.fade;
        s.head.position.copy(s.lightPos);
        s.lightI = Math.min(s.t * 5, 1.0) * s.fade;
      } else {
        s.pulse = Math.max(0, s.pulse - dt * 3.5);
        s.lightI = s.pulse * s.fade;
      }
      if (p >= 1 && !s.arrived) {
        s.arrived = true;
        s.head.visible = false;
        s.pulse = 1.2;       // arrival flash on the surrounding cubes
        s.onArrive?.();
      }
      if (s.fading) {
        s.fade = Math.max(0, s.fade - dt * 1.6);
        s.head.material.opacity = s.fade;
      }
    }
    // Dispose fully faded signals.
    this.active = this.active.filter((s) => {
      if (s.fading && s.fade <= 0) {
        this.scene.remove(s.ribbon, s.head);
        s.ribbon.geometry.dispose();
        s.mat.dispose();
        s.head.material.dispose();
        return false;
      }
      return true;
    });
  }

  /** Current point lights (position + intensity) for the cube shaders. */
  getLights() {
    return this.active
      .filter((s) => s.lightI > 0.01)
      .map((s) => ({ pos: s.lightPos, intensity: s.lightI }));
  }
}

// Route through axis-aligned legs; the axis order and a small lane offset are
// derived from the seed so concurrent signals don't overlap.
function buildRoute(from, to, seed) {
  const axes = ['x', 'y', 'z'];
  for (let i = axes.length - 1; i > 0; i--) {
    const j = Math.floor(fract(seed * 91.7 + i * 13.31) * (i + 1));
    [axes[i], axes[j]] = [axes[j], axes[i]];
  }
  const lane = (fract(seed * 47.9) - 0.5) * 1.4; // parallel-lane offset
  const p = from.clone();
  const pts = [p.clone()];
  for (const [k, axis] of axes.entries()) {
    p[axis] = to[axis];
    const corner = p.clone();
    if (k < axes.length - 1) corner[axes[(k + 1) % 3]] += lane;
    pts.push(corner);
  }
  pts.push(to.clone());
  return pts;
}

function placeAlong(pts, lens, dist, out) {
  for (let i = 1; i < pts.length; i++) {
    if (dist <= lens[i] || i === pts.length - 1) {
      const seg = lens[i] - lens[i - 1] || 1;
      const f = Math.min(Math.max((dist - lens[i - 1]) / seg, 0), 1);
      return out.lerpVectors(pts[i - 1], pts[i], f);
    }
  }
  return out.copy(pts[pts.length - 1]);
}

function makeDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(160,215,255,0.8)');
  g.addColorStop(1, 'rgba(50,120,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

import * as THREE from 'three';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// One floating triangular control layer: a solid matte-satin slab (pale
// green, like the reference) that casts and receives soft shadows, with a
// faint additive green wash on its top face. Points toward the camera (+z).
// ---------------------------------------------------------------------------

let sharedSlabMaterial = null;
let sharedTintTexture = null;

function slabMaterial(envMap) {
  if (sharedSlabMaterial) return sharedSlabMaterial;
  const c = CONFIG.colors, s = CONFIG.slab;
  sharedSlabMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.slabTint),
    roughness: s.roughness,
    metalness: 0,
    emissive: new THREE.Color(c.slabEmissive),
    emissiveIntensity: s.emissiveIntensity,
    envMap,
    envMapIntensity: s.envIntensity,
  });
  return sharedSlabMaterial;
}

// Soft blurred triangle drawn to a canvas — the pale green top-face wash.
function tintTexture() {
  if (sharedTintTexture) return sharedTintTexture;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Apex at canvas bottom (v = 0 after flipY) === world +z (toward camera).
  const pad = size * 0.16;
  const top = pad, bottom = size - pad;
  const cx = size / 2;
  const tri = (shrink) => {
    const t = top + (1 - shrink) * (bottom - top) * 0.5 * 0.6;
    const b = bottom - (1 - shrink) * (bottom - top) * 0.5;
    const half = (size / 2 - pad) * shrink;
    ctx.beginPath();
    ctx.moveTo(cx - half, t);
    ctx.lineTo(cx + half, t);
    ctx.lineTo(cx, b);
    ctx.closePath();
  };

  ctx.fillStyle = 'rgba(231, 255, 195, 0.5)';
  ctx.filter = 'blur(34px)';
  tri(1.0); ctx.fill();
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(238, 255, 210, 0.3)';
  tri(0.86); ctx.fill();

  sharedTintTexture = new THREE.CanvasTexture(canvas);
  sharedTintTexture.colorSpace = THREE.SRGBColorSpace;
  return sharedTintTexture;
}

export class TriangleLayer {
  /**
   * @param {number} index 0 = top (smallest) … 2 = bottom (largest)
   * @param {object} def   {side, y, x, z} from CONFIG.layers
   */
  constructor(index, def, envMap) {
    this.index = index;
    this.def = def;
    this.base = new THREE.Vector3(def.x, def.y, def.z);
    this.bobPeriod = CONFIG.slab.bobPeriod[index];
    this.bobPhase = index * 2.3;
    this.bobOffset = 0;

    const s = def.side;
    const h = s * 0.8660254; // equilateral height, s * sqrt(3)/2
    // Plan-view vertices (x, z), apex toward camera (+z), centroid at origin.
    this.vertices = [
      new THREE.Vector2(0, (2 * h) / 3),
      new THREE.Vector2(-s / 2, -h / 3),
      new THREE.Vector2(s / 2, -h / 3),
    ];

    // Inward-facing edge line equations in local plan XZ (nx·x + nz·z + c ≥ 0
    // inside) — the surface reveals clip themselves to this footprint.
    this.edgesLocal = this.vertices.map((vi, i) => {
      const vj = this.vertices[(i + 1) % 3];
      let nx = -(vj.y - vi.y), nz = vj.x - vi.x;
      const len = Math.hypot(nx, nz);
      nx /= len; nz /= len;
      let c = -(nx * vi.x + nz * vi.y);
      if (c < 0) { nx = -nx; nz = -nz; c = -c; } // centroid (0,0) must be inside
      return { nx, nz, c };
    });

    this.group = new THREE.Group();
    this.group.position.copy(this.base);

    this.group.add(this._buildSlab(envMap));
    this.group.add(this._buildSurfaceTint());
    this._buildEdgeRim().forEach((m) => this.group.add(m));
  }

  // Crisp light along the full top perimeter — a flat mitred ring, so every
  // corner is geometrically perfect. Per-edge widths: the back edge is seen
  // at a far more grazing angle, so it gets a wider strip to stay above a
  // pixel on screen (sub-pixel ribbons shimmer while the slabs float).
  _buildEdgeRim() {
    const s = CONFIG.slab;

    // vertices[0] = apex (toward camera), [1]/[2] = back corners.
    // Shape space is (x, -z); centroid at the origin.
    const [a, b, c] = this.vertices.map((v) => new THREE.Vector2(v.x, -v.y));

    // Inward-offset line of an edge (p→q) at distance w.
    const offsetLine = (p, q, w) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      let nx = -dy, ny = dx;
      const len = Math.hypot(nx, ny);
      nx /= len; ny /= len;
      if (nx * -p.x + ny * -p.y < 0) { nx = -nx; ny = -ny; } // aim at centroid
      return { nx, ny, c: nx * p.x + ny * p.y + w };
    };
    const intersect = (l1, l2) => {
      const det = l1.nx * l2.ny - l1.ny * l2.nx;
      return new THREE.Vector2(
        (l1.c * l2.ny - l1.ny * l2.c) / det,
        (l1.nx * l2.c - l1.c * l2.nx) / det,
      );
    };

    const lab = offsetLine(a, b, s.rimWidth);      // front-left
    const lbc = offsetLine(b, c, s.rimBackWidth);  // back
    const lca = offsetLine(c, a, s.rimWidth);      // front-right
    const ai = intersect(lca, lab);
    const bi = intersect(lab, lbc);
    const ci = intersect(lbc, lca);

    const shape = new THREE.Shape();
    shape.moveTo(a.x, a.y);
    shape.lineTo(b.x, b.y);
    shape.lineTo(c.x, c.y);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(ci.x, ci.y);
    hole.lineTo(bi.x, bi.y);
    hole.lineTo(ai.x, ai.y);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.colors.edge),
      transparent: s.rimOpacity < 1,
      opacity: s.rimOpacity,
      depthWrite: false,
      // Nudge toward the camera in depth so the ribbon never fights the
      // slab's top face at grazing angles.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = s.thickness / 2 + 0.003;
    mesh.renderOrder = 12;
    this.edgeCore = mesh;
    return [mesh];
  }

  _buildSlab(envMap) {
    const { thickness, cornerRadius } = CONFIG.slab;
    // Shape in XY with apex at -y; rotateX(-PI/2) maps shape (x, y) → world (x, 0, -y),
    // so the apex ends up at +z, toward the camera.
    const pts = this.vertices.map((v) => new THREE.Vector2(v.x, -v.y));
    const shape = new THREE.Shape();
    if (cornerRadius > 0) {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const prev = pts[(i + n - 1) % n], cur = pts[i], next = pts[(i + 1) % n];
        const inA = cur.clone().sub(prev).normalize();
        const outB = next.clone().sub(cur).normalize();
        const p1 = cur.clone().sub(inA.clone().multiplyScalar(cornerRadius * 2));
        const p2 = cur.clone().add(outB.clone().multiplyScalar(cornerRadius * 2));
        if (i === 0) shape.moveTo(p1.x, p1.y); else shape.lineTo(p1.x, p1.y);
        shape.quadraticCurveTo(cur.x, cur.y, p2.x, p2.y);
      }
      shape.closePath();
    } else {
      shape.moveTo(pts[0].x, pts[0].y);
      shape.lineTo(pts[1].x, pts[1].y);
      shape.lineTo(pts[2].x, pts[2].y);
      shape.closePath();
    }

    // No bevel — corners and edges stay geometrically sharp; the rim ring
    // provides the edge light.
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 6,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -thickness / 2, 0);

    const mesh = new THREE.Mesh(geo, slabMaterial(envMap));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 10;
    return mesh;
  }

  _buildSurfaceTint() {
    const s = this.def.side;
    const h = s * 0.8660254;
    // The canvas triangle sits inside a padded square — size the plane so the
    // drawn triangle matches the slab footprint (padding fraction = 0.16).
    const scale = 1 / (1 - 0.32);
    const geo = new THREE.PlaneGeometry(s * scale, h * scale);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tintTexture(),
      transparent: true,
      opacity: CONFIG.slab.surfaceTintOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // The canvas triangle is centred in its padded box, but the slab's local
    // origin is the triangle CENTROID (h/6 from the box centre, toward the apex).
    // Sits just above the top face as a soft illumination wash.
    mesh.position.set(0, CONFIG.slab.thickness / 2 + 0.004, h / 6);
    mesh.renderOrder = 11;
    mesh.visible = CONFIG.slab.surfaceTintOpacity > 0;
    this.tintMat = mat;
    return mesh;
  }

  /** World y of the slab's top surface right now (includes bob). */
  topWorldY() {
    return this.group.position.y + CONFIG.slab.thickness / 2 + 0.012;
  }

  /**
   * Uniform random point within the (shrunk) triangle footprint, in world XZ
   * at the layer's REST position.
   */
  samplePoint(margin = CONFIG.beams.footprintMargin) {
    const [a, b, c] = this.vertices;
    let r1 = Math.sqrt(Math.random()), r2 = Math.random();
    const px = (1 - r1) * a.x + r1 * (1 - r2) * b.x + r1 * r2 * c.x;
    const pz = (1 - r1) * a.y + r1 * (1 - r2) * b.y + r1 * r2 * c.y;
    return {
      x: this.base.x + px * margin,
      z: this.base.z + pz * margin,
    };
  }

  update(t, parallax, reducedMotion) {
    const s = CONFIG.slab;
    this.bobOffset = reducedMotion
      ? 0
      : Math.sin((t / this.bobPeriod) * Math.PI * 2 + this.bobPhase) * s.bobAmplitude;

    const f = CONFIG.parallax.factors[this.index];
    const px = reducedMotion ? 0 : parallax.x * f;
    const pz = reducedMotion ? 0 : parallax.z * f;
    const py = reducedMotion ? 0 : parallax.y * f * 0.6;
    this.group.position.set(this.base.x + px, this.base.y + this.bobOffset + py, this.base.z + pz);

    // Very slow breathing of the top-face wash. The rim stays constant —
    // any opacity modulation reads as flicker once bloom picks it up.
    const pulse = reducedMotion ? 0 : Math.sin(t * 0.4 + this.index) * 0.15;
    this.tintMat.opacity = s.surfaceTintOpacity * (1 + pulse);
  }
}

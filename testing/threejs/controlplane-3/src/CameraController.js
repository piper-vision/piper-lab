import * as THREE from 'three';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Cinematic camera. Orbits the middle slab from slightly above; the cursor
// gently steers azimuth (±8°), elevation (±3°) and a small vertical
// translation. Motion uses critically-damped smoothing with real velocity
// state, so the camera keeps drifting briefly after the cursor stops and
// eases home (~2 s) when the cursor leaves the window. Touch devices get a
// slow autonomous orbit instead.
// ---------------------------------------------------------------------------

// Unity-style SmoothDamp: critically damped spring with velocity state.
function smoothDamp(current, target, state, smoothTime, dt) {
  const omega = 2 / Math.max(smoothTime, 1e-4);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * decay;
  return target + (change + temp) * decay;
}

export class CameraController {
  constructor(camera, interaction) {
    this.camera = camera;
    this.interaction = interaction;
    const c = CONFIG.camera;

    this.pivot = new THREE.Vector3(
      CONFIG.layers[1].x, CONFIG.layers[1].y, CONFIG.layers[1].z,
    );
    this.distance = c.distance;
    this.fitDistance = c.distance;

    this.az = 0; this.azV = { v: 0 };
    this.el = 0; this.elV = { v: 0 };
    this.ty = 0; this.tyV = { v: 0 };

    this.restPosition = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this._apply(0, 0, 0, this.restPosition);
    camera.position.copy(this.restPosition);
    this._look();
  }

  /**
   * Keep the widest slab in frame on narrow viewports: first widen the
   * field of view (portrait compositions want the stack large, like the
   * reference), then dolly out for any remaining deficit.
   */
  setAspect(aspect) {
    const c = CONFIG.camera;
    this.camera.aspect = aspect;

    const neededVHalfTan = c.fitHalfWidth / c.distance / aspect;
    const neededFov = THREE.MathUtils.radToDeg(2 * Math.atan(neededVHalfTan));
    this.camera.fov = THREE.MathUtils.clamp(neededFov, c.fov, c.maxFov);

    const hHalfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect;
    this.fitDistance = Math.max(c.distance, c.fitHalfWidth / hHalfTan);
    this.camera.updateProjectionMatrix();
  }

  _apply(az, elShift, ty, out) {
    const c = CONFIG.camera;
    const elevation = c.elevation + elShift;
    const r = this.fitDistance;
    out.set(
      this.pivot.x + Math.sin(az) * Math.cos(elevation) * r,
      this.pivot.y + Math.sin(elevation) * r + ty,
      this.pivot.z + Math.cos(az) * Math.cos(elevation) * r,
    );
    return out;
  }

  _look() {
    this.camera.lookAt(
      this.pivot.x, this.pivot.y + CONFIG.camera.frameOffsetY, this.pivot.z,
    );
  }

  update(dt, t) {
    const c = CONFIG.camera;
    const ix = this.interaction;

    let targetAz = 0, targetEl = 0, targetTy = 0;
    let smoothTime = c.smoothTime;

    if (ix.reducedMotion) {
      // Static resting pose.
    } else if (ix.isTouch) {
      const w = (Math.PI * 2) / c.autoOrbitPeriod;
      targetAz = Math.sin(t * w) * c.maxAzimuth;
      targetEl = Math.sin(t * w * 0.7 + 1.3) * c.maxElevationShift * 0.6;
      smoothTime = 1.2;
    } else if (ix.pointerActive) {
      targetAz = -ix.nx * c.maxAzimuth;
      targetEl = -ix.ny * c.maxElevationShift;
      targetTy = -ix.ny * c.maxTranslateY;
    } else {
      smoothTime = c.returnTime; // drift home over ~2 s
    }

    this.az = smoothDamp(this.az, targetAz, this.azV, smoothTime, dt);
    this.el = smoothDamp(this.el, targetEl, this.elV, smoothTime, dt);
    this.ty = smoothDamp(this.ty, targetTy, this.tyV, smoothTime, dt);

    this._apply(this.az, this.el, this.ty, this.position);
    this._apply(0, 0, 0, this.restPosition);
    this.camera.position.copy(this.position);
    this._look();
  }

  /** World displacement from the rest pose — drives layer parallax. */
  getParallax(out) {
    out.x = this.position.x - this.restPosition.x;
    out.y = this.position.y - this.restPosition.y;
    out.z = this.position.z - this.restPosition.z;
    return out;
  }
}

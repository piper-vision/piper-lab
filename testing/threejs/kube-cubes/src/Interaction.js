// Pointer interaction + the camera rig: mouse parallax, drag-to-orbit within
// limits, clamped wheel zoom, hover highlighting, and slow autonomous drift.
// None of it touches the corruption cycle.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Interaction {
  constructor(dom, camera, field) {
    this.camera = camera;
    this.field = field;

    this.mouse = new THREE.Vector2(0, 0);       // normalized -1..1
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.zoom = 1;
    // Smoothed current values.
    this.curYaw = CONFIG.camYaw;
    this.curPitch = CONFIG.camPitch;
    this.curZoom = 1;
    this.lookOffset = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector3(...CONFIG.camCenter);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    this.pointerActive = false;   // no hover until the mouse actually moves
    dom.addEventListener('pointermove', (e) => {
      this.pointerActive = true;
      this.mouse.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
      if (dragging) {
        this.dragYaw = clamp(
          this.dragYaw + (e.clientX - lastX) * 0.0022,
          -CONFIG.dragYawLimit, CONFIG.dragYawLimit,
        );
        this.dragPitch = clamp(
          this.dragPitch - (e.clientY - lastY) * 0.0016,
          -CONFIG.dragPitchLimit, CONFIG.dragPitchLimit,
        );
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    dom.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointerup', (e) => {
      dragging = false;
      dom.releasePointerCapture(e.pointerId);
    });
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(
        this.zoom * Math.exp(e.deltaY * 0.0008),
        CONFIG.zoomMin, CONFIG.zoomMax,
      );
    }, { passive: false });
  }

  update(t, dt) {
    const C = CONFIG;
    const k = 1 - Math.exp(-dt * 4);

    // Slow autonomous drift keeps the scene alive when idle.
    const driftYaw = Math.sin(t * 0.07) * 0.035;
    const driftPitch = Math.sin(t * 0.05 + 2.0) * 0.015;

    const targetYaw = C.camYaw + this.dragYaw + this.mouse.x * C.parallaxYaw + driftYaw;
    const targetPitch = C.camPitch + this.dragPitch - this.mouse.y * C.parallaxPitch + driftPitch;

    this.curYaw += (targetYaw - this.curYaw) * k;
    this.curPitch += (targetPitch - this.curPitch) * k;
    this.curZoom += (this.zoom - this.curZoom) * k;

    const dist = C.camDistance * this.curZoom;
    const cp = Math.cos(this.curPitch);
    this.camera.position.set(
      this.center.x + Math.sin(this.curYaw) * cp * dist,
      this.center.y + Math.sin(this.curPitch) * dist,
      this.center.z + Math.cos(this.curYaw) * cp * dist,
    );

    // A small counter-shift of the look target deepens the parallax.
    this.lookOffset.lerp(
      new THREE.Vector3(this.mouse.x * 1.1, -this.mouse.y * 0.7, 0),
      k,
    );
    this.camera.lookAt(
      this.center.x + this.lookOffset.x,
      this.center.y + this.lookOffset.y,
      this.center.z,
    );

    // Hover highlight via instanced raycast (NDC wants y up, ours is down).
    if (this.pointerActive) {
      this._ndc = this._ndc || new THREE.Vector2();
      this._ndc.set(this.mouse.x, -this.mouse.y);
      this.raycaster.setFromCamera(this._ndc, this.camera);
      const hits = this.raycaster.intersectObject(this.field.mesh);
      this.field.setHoverTarget(hits.length ? hits[0].instanceId : -1);
    }
  }
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

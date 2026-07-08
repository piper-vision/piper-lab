import * as THREE from 'three';

/**
 * CameraRig — auto-fly with scroll-to-accelerate, slow cinematic drift, and
 * heavily damped mouse parallax. The camera cruises forward at a medium
 * pace on its own; wheel / touch-drag adds a speed boost that decays back
 * to cruise, so scrolling feels like leaning into the fall rather than
 * paging a document. No orbit controls.
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pointer = new THREE.Vector2();   // raw, normalized [-1, 1]
    this.smoothed = new THREE.Vector2();  // damped
    this.lookTarget = new THREE.Vector3();

    // Auto-fly: cruise speed plus a decaying scroll boost (world units/s).
    this.baseSpeed = 9.84;
    this.boost = 0;
    this.distance = 0;

    window.addEventListener('pointermove', (e) => {
      this.pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
    });

    window.addEventListener('wheel', (e) => {
      this.#addBoost(e.deltaY * 0.012); // scroll down = accelerate
    }, { passive: true });

    // Touch: dragging up accelerates (natural-scroll direction).
    this._touchY = null;
    window.addEventListener('touchstart', (e) => {
      this._touchY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      if (this._touchY !== null) this.#addBoost((this._touchY - y) * 0.035);
      this._touchY = y;
    }, { passive: true });
    window.addEventListener('touchend', () => {
      this._touchY = null;
    });
  }

  /**
   * Accumulate scroll into the boost — repeated scrolling stacks toward a
   * hard ceiling; scrolling up can slow to a drift but never reverses.
   */
  #addBoost(amount) {
    this.boost = THREE.MathUtils.clamp(this.boost + amount, -this.baseSpeed + 0.4, 22);
  }

  update(t, dt) {
    // Exponential damping — frame-rate independent, deliberately heavy.
    const damping = 1 - Math.exp(-dt * 1.6);
    this.smoothed.lerp(this.pointer, damping);

    // The boost bleeds off toward cruise (half-life ≈ 1.5 s), so a burst of
    // scrolling surges forward then settles back to the medium pace.
    this.boost *= Math.exp(-dt * 0.45);
    this.distance += (this.baseSpeed + this.boost) * dt;

    // Base path: incommensurate sine frequencies so the drift never loops
    // perceptibly. Amplitudes are small — a float, not a flight.
    // Reversed travel: the camera retreats along +Z while still facing -Z,
    // so shards materialize near the viewer and recede into the fog.
    const z = 14 + this.distance + Math.sin(t * 0.023) * 1.8;
    this.camera.position.set(
      Math.sin(t * 0.05) * 1.6 + this.smoothed.x * 1.5,
      Math.cos(t * 0.041) * 1.1 - this.smoothed.y * 1.0,
      z
    );

    // The look target drifts on its own slower path, plus a fraction of the
    // pointer offset — yields parallax rather than a hard pan. It leads the
    // camera by a fixed depth so we always look into the oncoming field.
    this.lookTarget.set(
      Math.sin(t * 0.031) * 0.8 + this.smoothed.x * 0.7,
      Math.cos(t * 0.043) * 0.6 - this.smoothed.y * 0.5,
      z - 14
    );
    this.camera.lookAt(this.lookTarget);
  }
}

// ---------------------------------------------------------------------------
// Normalised cursor state + capability queries. No Three.js in here.
// nx / ny are targets in [-1, 1]; `pointerActive` flips false when the
// cursor leaves the window so the camera can drift home.
// ---------------------------------------------------------------------------

export class InteractionManager {
  constructor() {
    this.nx = 0;
    this.ny = 0;
    this.pointerActive = false;

    const touchQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    this.isTouch = touchQuery.matches;
    touchQuery.addEventListener?.('change', (e) => { this.isTouch = e.matches; });

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motionQuery.matches;
    this.onReducedMotionChange = null;
    motionQuery.addEventListener?.('change', (e) => {
      this.reducedMotion = e.matches;
      this.onReducedMotionChange?.(e.matches);
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      this.nx = (e.clientX / window.innerWidth) * 2 - 1;
      this.ny = (e.clientY / window.innerHeight) * 2 - 1;
      this.pointerActive = true;
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      this.pointerActive = false;
    });
    window.addEventListener('blur', () => { this.pointerActive = false; });
  }
}

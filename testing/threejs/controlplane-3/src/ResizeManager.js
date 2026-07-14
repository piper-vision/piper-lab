// ---------------------------------------------------------------------------
// Keeps renderer, composer and camera in step with the SCENE CONTAINER (the
// canvas now lives inside a page panel, not the full window). Narrow panels
// dolly/widen the camera via CameraController.setAspect so the widest slab
// always stays in frame.
// ---------------------------------------------------------------------------

export class ResizeManager {
  constructor(renderer, cameraController, post, dprCap, container) {
    this.renderer = renderer;
    this.cameraController = cameraController;
    this.post = post;
    this.dprCap = dprCap;
    this.container = container;
    this.lastW = -1;
    this.lastH = -1;
    window.addEventListener('resize', () => this.apply());
    this.apply();
  }

  /** Cheap per-frame guard — panels can resize without a window event. */
  check() {
    if (this.container.clientWidth !== this.lastW || this.container.clientHeight !== this.lastH) {
      this.apply();
    }
  }

  apply() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.lastW = w;
    this.lastH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.cameraController.setAspect(w / h);
    this.post.setSize(w, h, dpr);
  }
}

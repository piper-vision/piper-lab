/**
 * AdaptiveQuality — keeps the frame rate smooth by stepping the render
 * pixel ratio up or down based on a rolling average of frame times.
 *
 * Down-steps are eager (dropped frames are visible immediately); up-steps
 * require sustained headroom so the DPR doesn't oscillate.
 */
export class AdaptiveQuality {
  /**
   * @param {object} opts
   * @param {number} opts.maxDpr    Upper bound (device pixel ratio, capped).
   * @param {number} opts.minDpr    Lower bound.
   * @param {(dpr: number) => void} opts.onChange Called when DPR changes.
   * @param {() => void} [opts.onPressure] Called when frames are still slow
   *   with DPR already at minimum — shed non-resolution quality next.
   * @param {() => void} [opts.onRelax]  Called on sustained headroom with
   *   DPR back at maximum — restore non-resolution quality.
   */
  constructor({ maxDpr = 2, minDpr = 0.75, onChange, onPressure, onRelax }) {
    this.maxDpr = maxDpr;
    this.minDpr = minDpr;
    this.onChange = onChange;
    this.onPressure = onPressure;
    this.onRelax = onRelax;

    this.dpr = maxDpr;
    this._accum = 0;
    this._frames = 0;
    this._calm = 0;     // consecutive fast windows before stepping back up
    this._calmNeed = 3; // grows every time we shed — stops up/down cycling

    onChange(this.dpr);
  }

  update(dt) {
    this._accum += dt;
    this._frames++;
    if (this._frames < 60) return;

    const avgMs = (this._accum / this._frames) * 1000;
    this._accum = 0;
    this._frames = 0;

    if (avgMs > 20) {
      // Missing 50fps — shed resolution now; if none left, escalate.
      // Every shed raises the bar for stepping back up: a device that sits
      // on the threshold would otherwise cycle up/down forever, and each
      // step reallocates every render target (a visible hitch).
      this._calm = 0;
      this._calmNeed = Math.min(this._calmNeed + 4, 30);
      if (this.dpr > this.minDpr) {
        this.#set(Math.max(this.minDpr, this.dpr - 0.25));
      } else {
        this.onPressure?.();
      }
    } else if (avgMs < 13) {
      // Comfortable headroom — step up only after sustained calm.
      this._calm++;
      if (this._calm >= this._calmNeed) {
        this._calm = 0;
        if (this.dpr < this.maxDpr) {
          this.#set(Math.min(this.maxDpr, this.dpr + 0.25));
        } else {
          this.onRelax?.();
        }
      }
    } else {
      this._calm = 0;
    }
  }

  #set(dpr) {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.onChange(dpr);
  }
}

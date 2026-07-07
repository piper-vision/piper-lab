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
   */
  constructor({ maxDpr = 2, minDpr = 0.75, onChange }) {
    this.maxDpr = maxDpr;
    this.minDpr = minDpr;
    this.onChange = onChange;

    this.dpr = maxDpr;
    this._accum = 0;
    this._frames = 0;
    this._calm = 0; // consecutive fast windows before stepping back up

    onChange(this.dpr);
  }

  update(dt) {
    this._accum += dt;
    this._frames++;
    if (this._frames < 60) return;

    const avgMs = (this._accum / this._frames) * 1000;
    this._accum = 0;
    this._frames = 0;

    if (avgMs > 20 && this.dpr > this.minDpr) {
      // Missing 50fps — shed resolution now.
      this._calm = 0;
      this.#set(Math.max(this.minDpr, this.dpr - 0.25));
    } else if (avgMs < 14.5 && this.dpr < this.maxDpr) {
      // Comfortable headroom — but only step up after 3 calm windows.
      this._calm++;
      if (this._calm >= 3) {
        this._calm = 0;
        this.#set(Math.min(this.maxDpr, this.dpr + 0.25));
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

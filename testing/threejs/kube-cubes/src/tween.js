// Minimal internal tween system — enough for the corruption / repair
// transitions without pulling in GSAP.

const active = new Set();

export const Ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t),
  outBack: (t) => {
    const c = 1.70158;
    const u = t - 1;
    return 1 + u * u * ((c + 1) * u + c);
  },
};

/**
 * tween({ dur, delay, ease, onUpdate(v01), onComplete }) — v01 runs 0→1.
 * Returns a handle with .cancel().
 */
export function tween({ dur, delay = 0, ease = Ease.inOut, onUpdate, onComplete }) {
  const tw = { t: -delay, dur, ease, onUpdate, onComplete, done: false };
  tw.cancel = () => active.delete(tw);
  active.add(tw);
  return tw;
}

export function updateTweens(dt) {
  for (const tw of active) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const raw = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate?.(tw.ease(raw));
    if (raw >= 1) {
      active.delete(tw);
      tw.onComplete?.();
    }
  }
}

# Light Cube

A true cube volume of ~87,000 twinkling light points hung on faint vertical strings,
viewed straight into one face so the rows radiate from a warm central blaze —
recreation of the classic "LED strand cube" installation photo.

## Run

```
npx --yes serve light-cube -l 5188
```

or via `.claude/launch.json` entry `light-cube` (port 5188).

## How it works

- No build step. three r185 vendored in `vendor/three/` (module + core only).
- One `THREE.Points` mesh with a custom shader: additive blending, per-point
  base brightness / phase / warmth attributes, shimmer + slow roaming flares
  in the vertex shader, soft core + 4-point star spikes in the fragment shader.
- `LineSegments` for the vertical strings (faint, fogged).
- No postprocessing — the central blaze is an additive gradient sprite at the
  vanishing point standing in for lens bloom.
- Camera sits just outside the front face at mid-height, drifting a few cm so
  it stays aligned with the centre strand column (odd strand/row counts keep a
  strand on the axis and a point row at eye level — that's what makes the
  bright centre column and equator).
- Interactive: the camera pans toward the cursor and the scroll wheel dollies
  in and out of the cube (eased, clamped by `interaction.scrollMin/Max`).
- Pull back far enough to frame the whole cube and it starts to rotate slowly
  (slight tilt shows the top). On the way back in, a velocity-capped seek
  (`rotate.settleSpeed`, rad/s) levels it to the nearest quarter turn — the
  cap means it can never snap, and because the seek engages as soon as the
  spin starts fading it is normally level well before the camera re-enters.
  The eye-line vignette relaxes and the far fade extends as you pull back so
  the full structure reads evenly (`rotate.*` knobs).
- `prefers-reduced-motion` renders a single static frame.

## Tuning

All knobs in [src/config.js](src/config.js): `grid.*` (counts, spacing,
jitter), `points.*` (exposure, sizes, brightness ranges, twinkle/flare speeds,
near/far fades), `strings.*`, `coreGlow.*`, `camera.*` (fov, distance, drift,
cycle length), `interaction.*` (cursor pan amplitudes, scroll step/limits,
easing rate), `vignette.bandFalloff` (dims rows away from the eye-line).

Debug hook: `window.__lightCube` →
`{ scene, camera, material, config, count, pan, zoom, zoomTarget }`.

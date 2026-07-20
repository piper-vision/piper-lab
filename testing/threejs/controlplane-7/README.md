# Particle Stream

A Three.js hero scene: a narrow (~1 inch on screen) vertical stream of
plexus-linked particles flowing bottom → top, with particle-edge wireframe
cubes riding the flow. Cyan-plexus style shared with `hex-core/`.

## Run

Served via the workspace `.claude/launch.json` entry `particle-stream`
(`npx serve particle-stream -l 5198`), then open http://localhost:5198.

No build step — three r185 is vendored in `vendor/three/` and loaded through
an import map.

## Tuning

All knobs live in `src/config.js`:

- `stream.*` — radius (screen width of the column), height, speed, particle
  and node counts, plexus link distance, end fade, swirl, drift, twinkle.
- `cubes.*` — count, size range, per-cube speed multiplier, spin, margin.
- `beamGlow.*` — the additive light column behind the stream.
- `dust.*` — sparse rising background dust.
- `camera.*` — fov, distance, resting yaw/pitch, sway, cursor parallax,
  `controls.*` (OrbitControls damping/min/max distance, `wheelZoom`).

## Camera controls

Left-drag orbits/rotates, right-drag pans, mousewheel zooms. The cinematic
sway + parallax drives the camera until the first grab or scroll, then the
user owns it. If the scene is embedded in a page that scrolls, consider
`camera.controls.wheelZoom: false` — with zoom on, scrolling over the
canvas zooms instead of scrolling the page, and any wheel event permanently
ends the cinematic camera.

## How it works

Particles have fixed (x, z) positions on a disc and a base y in `[0, H)`;
every frame y scrolls upward modulo H. Because all particles scroll at the
same rate, the wrapped vertical distance between any two is constant, so
plexus pairs are computed once (wrap-aware) and never rebuilt. Ends fade to
black via vertex colors (invisible under additive blending); a pair that
momentarily straddles the wrap boundary is collapsed to a zero-length
segment so no line ever spans the full height.

Debug hook: `window.__particleStream`.

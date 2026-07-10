// Shared GLSL for the cube surfaces. The healthy (instanced) material and the
// corrupted (standalone) material use the same surface routine so the swap
// between them is seamless — the corrupted shader simply feeds a non-zero
// corruption amount into it.

export const GLSL_COMMON = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  vec2 hash22(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(vec2(p.x * p.y, p.x + p.y));
  }
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }
`;

// Computes the cube surface colour: charcoal base, dot-grid pattern,
// soft grey edges, red corruption tint, red bleed from the corrupted cube,
// blue wash from travelling repair signals, then depth fog.
// `corruption` is 0 for healthy cubes.
export const GLSL_SURFACE = /* glsl */ `
  #define MAX_SIGNALS 8
  // Positions/intensities of the travelling signal heads — they behave as
  // moving point lights so the field visibly reacts as pulses pass through.
  uniform vec3 uSignalPos[MAX_SIGNALS];
  uniform float uSignalInt[MAX_SIGNALS];

  vec3 cubeSurface(
    vec2 uv, vec3 normalW, vec3 worldPos, float fogDepth,
    float seed, float hoverGlow, float corruption, float time,
    vec3 corruptPos, float corruptGlow, vec3 fogColor, float fogDensity
  ) {
    vec3 n = normalize(normalW);

    // Restrained key light from above-front — no real-time shadows.
    vec3 L = normalize(vec3(0.3, 0.85, 0.42));
    float shade = 0.28 + 0.72 * max(dot(n, L), 0.0);

    vec3 col = vec3(0.042, 0.044, 0.050) * shade;

    // Dot-grid data texture: a grid of dots, some lit and some dark,
    // hashed per cell so each cube reads like a panel of data.
    float cells = 17.0;
    vec2 gv = fract(uv * cells) - 0.5;
    vec2 id = floor(uv * cells);
    float h = hash21(id + seed * 17.0);
    float dotMask = smoothstep(0.14, 0.08, length(gv));
    float lit = step(0.32, h);
    // Corruption makes the data flicker.
    float flicker = 1.0 + corruption * (hash21(id + floor(time * 9.0)) - 0.5) * 2.2;
    vec3 dotCol = mix(vec3(0.55, 0.58, 0.62), vec3(1.0, 0.22, 0.12), corruption);
    col += dotCol * dotMask * lit * (0.09 + 0.20 * h) * (0.35 + 0.65 * shade) * flicker;

    // Thin soft grey edges (distance to face border in UV space).
    vec2 b = min(uv, 1.0 - uv);
    float m = min(b.x, b.y);
    float edge = 1.0 - smoothstep(0.006, 0.032, m);
    vec3 edgeCol = mix(vec3(0.42, 0.44, 0.48), vec3(1.0, 0.16, 0.08), corruption);
    col += edgeCol * edge * (0.35 + 0.65 * shade) * (0.75 + hoverGlow * 0.9 + corruption * 1.7);

    // Corrupted body glow + occasional horizontal glitch band.
    float pulse = 0.72 + 0.28 * sin(time * 7.0);
    col += vec3(0.50, 0.030, 0.018) * corruption * pulse * shade;
    float band = step(0.965, fract(uv.y * 3.0 + time * 2.3 + seed));
    col += vec3(0.9, 0.10, 0.05) * band * corruption * 0.35;

    // Damage detail is skipped entirely on healthy cubes (corruption == 0).
    if (corruption > 0.001) {
      // Glowing energy fractures: voronoi cell borders read as hot cracks
      // spidering across the faces, each segment flickering independently.
      vec2 cp = uv * 4.0 + seed * 31.0;
      vec2 ci = floor(cp);
      vec2 cf = fract(cp);
      float f1 = 8.0, f2 = 8.0;
      vec2 cell1 = vec2(0.0);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash22(ci + g);
          vec2 r = g + o - cf;
          float dd = dot(r, r);
          if (dd < f1) { f2 = f1; f1 = dd; cell1 = ci + g; }
          else if (dd < f2) { f2 = dd; }
        }
      }
      float crack = 1.0 - smoothstep(0.0, 0.10, f2 - f1);
      float segFlicker = 0.55 + 0.45 * hash21(cell1 + floor(time * 6.0));
      col += vec3(1.0, 0.30, 0.14) * crack * corruption * segFlicker * 1.1;

      // Sparse digital static, much quieter than the cracks.
      float staticN = hash21(floor(uv * 40.0) + floor(time * 14.0) * 0.71 + seed * 9.0);
      col += vec3(1.0, 0.30, 0.16) * step(0.94, staticN) * staticN * corruption * 0.22;

      // Rare white-hot flashes race across the edges of the damaged cube.
      float flash = step(0.90, hash21(vec2(floor(time * 11.0), seed * 5.0)));
      col += vec3(1.0, 0.75, 0.6) * edge * flash * corruption * 1.4;
    }

    // Red bleed from the currently corrupted cube onto neighbours,
    // strongest along their edges so it reads as reflected light.
    float dGlow = distance(worldPos, corruptPos);
    float rg = corruptGlow * exp(-dGlow * FALLOFF);
    col += vec3(1.0, 0.10, 0.06) * rg * (0.08 + edge * 0.9);

    // Blue light cast by travelling repair signals, brightest on edges and
    // the lit data dots so passing pulses visibly sweep across the field.
    float sig = 0.0;
    for (int i = 0; i < MAX_SIGNALS; i++) {
      float sd = distance(worldPos, uSignalPos[i]);
      sig += uSignalInt[i] / (1.0 + sd * sd * 0.16);
    }
    sig = min(sig, 1.1);
    col += vec3(0.40, 0.70, 1.0) * sig * (0.07 + edge * 0.6 + dotMask * lit * 0.45) * shade;

    // Exponential-squared depth fog into darkness.
    float f = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);
    return mix(col, fogColor, clamp(f, 0.0, 1.0));
  }
`;

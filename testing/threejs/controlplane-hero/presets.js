// The approved look. Applied over the config.js defaults before the first
// frame. Uses the exact shape produced by the panel's "Copy settings as JSON"
// button; missing keys leave the config value untouched.
//
// Presets 2 / 3 (green, sage) were removed after the client chose this one;
// they live in presets-archive.js (not loaded, not shipped).
window.PRESETS = [
  // ---- ControlPlane blue - James's tuned JSON (2026-09-08).
  {
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "motion": { "paused": false },
    "ribbon": { "flowSpeed": 0.56, "waveAmp": 1.1, "wave2Amp": 0.25, "twistAmp": 0.25 },
    "camera": { "distance": 4, "height": -0.6, "lookAtY": -1.5, "fov": 38 },
    "dof": { "enabled": true, "focus": 0.5, "width": 0.08, "feather": 0.35, "near": 1, "far": 1, "clampHighlights": 1.6 },
    "fade": { "enabled": true, "color": "061037", "opacity": 0.68, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "2158e8", "hover": "3a6cf0", "text": "ffffff" },
    "wash": { "hex": "bee3f4", "intensity": 0 },
    "lights": {
      "Amber key":      { "hex": "26a7df", "intensity": 12,   "opacity": 1 },
      "Cyan kicker":    { "hex": "2158e8", "intensity": 12,   "opacity": 1 },
      "Lavender pool":  { "hex": "bee3f4", "intensity": 10.5, "opacity": 1 },
      "White overhead": { "hex": "0b1023", "intensity": 4.6,  "opacity": 1 },
      "Warm bounce":    { "hex": "a6e6f8", "intensity": 12.3, "opacity": 1 },
      "Aqua backdrop":  { "hex": "3262d2", "intensity": 5.2,  "opacity": 0.97 },
      "Warm side band": { "hex": "bee3f4", "intensity": 8,    "opacity": 1 }
    },
    "sun": { "key": { "color": "bee3f4", "intensity": 0.3 }, "rim": { "color": "26a7df", "intensity": 0.25 } },
    "background": { "bright": "26a7df", "mid": "183789", "dark": "23243b" },
    "triangles": { "color": "141529", "opacity": 0.8, "glintSharpness": 0.2 },
    "reflections": 1
  }
];

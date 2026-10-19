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
    "ribbon": { "flowSpeed": 0.56, "waveAmp": 1.1, "wave2Amp": 0.25, "twistAmp": 0.25, "fadeNear": 7, "fadeFar": 19 },
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
    "triangles": { "color": "141529", "opacity": 0.8, "glintSharpness": 0.2, "edgeTint": "141529", "edgeTintAmount": 0, "faceGloss": 1, "bevelBoost": 0 },
    "shadow": { "color": "3a4e78", "opacity": 0 },
    "facets": { "jitter": 0, "tint": 0, "tintColor": "6f9fff" },
    "pulses": { "enabled": false },
    "reflections": 1
  }
];

// Light mode (panel "Light mode" button / T): the same scene restyled for the
// site's light sections (#EEEFEE page). Pale frosted glass, white sheen, cool
// blue in the valleys, near-white gradient behind. Only the colour keys are
// here, so toggling never touches camera / ribbon / motion; the dark look is
// taken from the same keys of PRESETS[0].
window.PRESET_LIGHT = {
  // Band dissolves into the grey sooner than in dark mode, so no blue lingers at the back.
  "ribbon": { "fadeNear": 5, "fadeFar": 14 },
  "fade": { "enabled": false, "color": "eeefee", "opacity": 0.35, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
  "buttons": { "fill": "2158e8", "hover": "3a6cf0", "text": "ffffff" },
  "wash": { "hex": "ffffff", "intensity": 0.1 },
  "lights": {
    "Amber key":      { "hex": "2158e8", "intensity": 14,  "opacity": 1 },   // saturated blue from front-left: faces tilted that way go blue
    "Cyan kicker":    { "hex": "3d7fff", "intensity": 16,  "opacity": 1 },
    "Lavender pool":  { "hex": "ffffff", "intensity": 14,  "opacity": 1 },   // white from behind-right: faces tilted that way go white
    "White overhead": { "hex": "ffffff", "intensity": 8,   "opacity": 1 },
    "Warm bounce":    { "hex": "4d8cff", "intensity": 10,  "opacity": 1 },
    "Aqua backdrop":  { "hex": "eeefee", "intensity": 3,   "opacity": 1 },   // straight ahead at the horizon = what the far faces reflect: keep it grey
    "Warm side band": { "hex": "3d7fff", "intensity": 14,  "opacity": 1 }
  },
  "sun": { "key": { "color": "ffffff", "intensity": 2.6 }, "rim": { "color": "3d7fff", "intensity": 1.4 } },
  // Light blue gradient (restored at James's request after a grey experiment).
  "background": { "bright": "e6ecf5", "mid": "a9bfe0", "dark": "6d8bbd" },
  // Translucent body (0.6) so the blue gradient shows through, plus a blue
  // sheen that only appears at grazing angles: the bevels and inner edges.
  // Faces reflect the environment at 35%, bevels at 4x: bright edge highlights, pale faces.
  "triangles": { "color": "8aa6cc", "opacity": 0.65, "glintSharpness": 0.12, "edgeTint": "2f6fff", "edgeTintAmount": 0.8, "faceGloss": 0.6, "bevelBoost": 3 },
  // Dark sheet under the glass: the grooves between triangles read as shadow.
  "shadow": { "color": "474b55", "opacity": 0.8 },   // neutral, so the grooves read as shadow rather than blue
  // Per-triangle variation: a little tilt so neighbours reflect differently, and a body tint that leans toward blue by a random amount.
  "facets": { "jitter": 0, "tint": 0.6, "tintColor": "6f9fff" },   // no tilt (it read as a wonky grid); the tint carries the variation
  // Glowing streaks along the grooves, near the camera only.
  "pulses": { "enabled": true, "count": 10, "speed": 4, "length": 10, "width": 0.12, "intensity": 8, "color": "dfeeff", "nearStart": 3, "nearEnd": 10, "diagonalShare": 0.5 },
  "reflections": 0.9
};

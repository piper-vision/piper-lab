// Colour presets for the client review. Keys 1 / 2 / 3 (or the Preset buttons
// in the attributes panel) apply PRESETS[0..2]. Each entry uses the exact
// shape produced by the panel's "Copy settings as JSON" button, and may be a
// subset: keys that are missing leave the current value untouched.
//
// Preset 1 is the approved teal look. Presets 2 and 3 are PLACEHOLDER
// colourways so the keys can be tested; replace them with the client JSON.
window.PRESETS = [
  // ---- 1: ControlPlane blue - James's tuned JSON (2026-09-08). The page loads this by default.
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
  },

  // ---- 2: ControlPlane brand palette, green set (primary 4c8055 / 68a4a5 / 012408, secondary a2bfa7 / 1a5974; accent teal 26a8a6 in the gradient glow + key/backdrop lights; CTAs 01844d)
  {
    "fade": { "color": "012408", "opacity": 0.73, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "01844d", "hover": "0a9a5c", "text": "ffffff" },
    "wash": { "hex": "a2bfa7", "intensity": 0.14 },
    "lights": {
      "Amber key":      { "hex": "26a8a6", "intensity": 13,    "opacity": 1 },
      "Cyan kicker":    { "hex": "1a5974", "intensity": 12,    "opacity": 1 },
      "Lavender pool":  { "hex": "a2bfa7", "intensity": 6,     "opacity": 1 },
      "White overhead": { "hex": "f5f7ff", "intensity": 4,     "opacity": 1 },
      "Warm bounce":    { "hex": "4c8055", "intensity": 9,     "opacity": 1 },
      "Aqua backdrop":  { "hex": "26a8a6", "intensity": 2.4,   "opacity": 1 },
      "Warm side band": { "hex": "a2bfa7", "intensity": 8,     "opacity": 1 }
    },
    "background": { "bright": "26a8a6", "mid": "1a5974", "dark": "012408" },
    "triangles": { "color": "011a06", "opacity": 0.8 },
    "sun": { "key": { "color": "a2bfa7", "intensity": 0.3 }, "rim": { "color": "26a8a6", "intensity": 0.25 } },
    "reflections": 1
  },

  // ---- 3: ControlPlane brand palette, bright-green set (primary 49ad5a / 1e4d26 / 001e06, secondary a2bfa7 / green ~00804a / yellow ffda46)
  {
    "fade": { "color": "001e06", "opacity": 0.73, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "49ad5a", "hover": "5abf6b", "text": "ffffff" },
    "wash": { "hex": "a2bfa7", "intensity": 0.14 },
    "lights": {
      "Amber key":      { "hex": "ffda46", "intensity": 10,    "opacity": 1 },
      "Cyan kicker":    { "hex": "00804a", "intensity": 12,    "opacity": 1 },
      "Lavender pool":  { "hex": "a2bfa7", "intensity": 6,     "opacity": 1 },
      "White overhead": { "hex": "f5f7ff", "intensity": 4,     "opacity": 1 },
      "Warm bounce":    { "hex": "1e4d26", "intensity": 9,     "opacity": 1 },
      "Aqua backdrop":  { "hex": "49ad5a", "intensity": 2.2,   "opacity": 1 },
      "Warm side band": { "hex": "ffda46", "intensity": 6,     "opacity": 1 }
    },
    "background": { "bright": "49ad5a", "mid": "1e4d26", "dark": "001e06" },
    "triangles": { "color": "00150a", "opacity": 0.8 },
    "sun": { "key": { "color": "ffda46", "intensity": 0.3 }, "rim": { "color": "a2bfa7", "intensity": 0.25 } },
    "reflections": 1
  }
];

// Previous preset 1 (first brand-palette mapping, before James's tuning), kept so it can be restored.
window.PRESET_1_PREVIOUS = {
    "fade": { "color": "23243b", "opacity": 0.73, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "2158e8", "hover": "3a6cf0", "text": "ffffff" },
    "wash": { "hex": "bee3f4", "intensity": 0.14 },
    "lights": {
      "Amber key":      { "hex": "26a7df", "intensity": 12,    "opacity": 1 },
      "Cyan kicker":    { "hex": "2158e8", "intensity": 12,    "opacity": 1 },
      "Lavender pool":  { "hex": "bee3f4", "intensity": 6,     "opacity": 1 },
      "White overhead": { "hex": "f5f7ff", "intensity": 4,     "opacity": 1 },
      "Warm bounce":    { "hex": "183789", "intensity": 9,     "opacity": 1 },
      "Aqua backdrop":  { "hex": "26a7df", "intensity": 2.2,   "opacity": 1 },
      "Warm side band": { "hex": "bee3f4", "intensity": 8,     "opacity": 1 }
    },
    "background": { "bright": "26a7df", "mid": "183789", "dark": "23243b" },
    "triangles": { "color": "141529", "opacity": 0.8 },
    "sun": { "key": { "color": "bee3f4", "intensity": 0.3 }, "rim": { "color": "26a7df", "intensity": 0.25 } },
    "reflections": 1
  };

// Previous preset 2 (the approved teal design), kept so it can be restored:
// swap it back into PRESETS[1] if the green brand version above is rejected.
window.PRESET_2_PREVIOUS = {
    "fade": { "color": "0C3838", "opacity": 0.73, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "0F8C4F", "hover": "12A05B", "text": "ffffff" },
    "wash": { "hex": "affff7", "intensity": 0.14 },
    "lights": {
      "Amber key":      { "hex": "ffb45f", "intensity": 14,    "opacity": 1 },
      "Cyan kicker":    { "hex": "6ccbff", "intensity": 11.75, "opacity": 1 },
      "Lavender pool":  { "hex": "cbb4ff", "intensity": 6.55,  "opacity": 1 },
      "White overhead": { "hex": "f5f7ff", "intensity": 4,     "opacity": 1 },
      "Warm bounce":    { "hex": "ffab5f", "intensity": 10.5,  "opacity": 1 },
      "Aqua backdrop":  { "hex": "92fff4", "intensity": 2.1,   "opacity": 1 },
      "Warm side band": { "hex": "ffcb8b", "intensity": 11.7,  "opacity": 1 }
    },
    "background": { "bright": "5ce5df", "mid": "007d6e", "dark": "003732" },
    "triangles": { "color": "021c19", "opacity": 0.8 },
    "reflections": 1
  };

// Previous preset 3 (warm amber / graphite placeholder), kept so it can be restored.
window.PRESET_3_PREVIOUS = {
    "fade": { "color": "2A1A0A", "opacity": 0.73, "size": 88, "x": 5, "y": 55, "blur": 12.5 },
    "buttons": { "fill": "E0742A", "hover": "F08A3E", "text": "ffffff" },
    "wash": { "hex": "ffe6c8", "intensity": 0.14 },
    "lights": {
      "Amber key":      { "hex": "ffb45f", "intensity": 16,    "opacity": 1 },
      "Cyan kicker":    { "hex": "ffd28a", "intensity": 8,     "opacity": 1 },
      "Lavender pool":  { "hex": "ffb3a0", "intensity": 6,     "opacity": 1 },
      "White overhead": { "hex": "fff4e6", "intensity": 4,     "opacity": 1 },
      "Warm bounce":    { "hex": "ff9a4a", "intensity": 12,    "opacity": 1 },
      "Aqua backdrop":  { "hex": "ffc98c", "intensity": 2,     "opacity": 1 },
      "Warm side band": { "hex": "ffd9a8", "intensity": 12,    "opacity": 1 }
    },
    "background": { "bright": "f2b56b", "mid": "7a4a1e", "dark": "1c1410" },
    "triangles": { "color": "1a120c", "opacity": 0.8 },
    "reflections": 1
  };

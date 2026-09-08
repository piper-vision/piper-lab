import * as THREE from 'three';

// Attributes panel (toggle with A). Plain DOM, no dependencies. Edits the
// live scene directly. Every control registers under a dotted path, so the
// same registry drives "Copy settings as JSON" (export) and presets (import):
// a preset is simply a JSON object in that exported shape, applied with
// applySettings(). Keys 1/2/3 apply window.PRESETS[0..2] (see presets.js).
export function initPanel({ C, R, ribbonGroup, envStudio, bgUniforms, rowMaterials, realGlass, camera, applyCamera, sunLights, requestRender, getPixelRatio, setPixelRatio }) {
  const css = `
    #attr-panel { position: fixed; top: 120px; right: 32px; width: 300px; max-height: calc(100vh - 140px);
      overflow-y: auto; background: rgba(0, 22, 20, 0.88); color: #d6efec; font: 12px/1.4 system-ui, sans-serif;
      border: 1px solid rgba(92, 229, 223, 0.25); border-radius: 10px; padding: 10px 12px 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45); z-index: 10; backdrop-filter: blur(6px); }
    #attr-panel[hidden] { display: none; }
    #attr-panel h1 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px; color: #5ce5df; display: flex; justify-content: space-between; align-items: center; }
    #attr-panel h1 span { font-weight: normal; letter-spacing: 0; text-transform: none; color: #8fbcb7; font-size: 11px; }
    #attr-panel details { border-top: 1px solid rgba(255,255,255,0.08); padding: 6px 0; }
    #attr-panel summary { cursor: pointer; font-weight: 600; color: #bfe9e5; user-select: none; }
    #attr-panel .row { display: grid; grid-template-columns: 92px 1fr 40px; gap: 6px; align-items: center; margin: 5px 0; }
    #attr-panel .row label { color: #9fcfca; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #attr-panel .row output { text-align: right; color: #d6efec; font-variant-numeric: tabular-nums; }
    #attr-panel input[type=range] { width: 100%; accent-color: #5ce5df; margin: 0; }
    #attr-panel .hex { display: flex; align-items: center; gap: 6px; grid-column: 2 / 4; }
    #attr-panel .hex .swatch { width: 22px; height: 22px; border-radius: 4px; flex: none; border: 1px solid rgba(255,255,255,0.18);
      position: relative; overflow: hidden; cursor: pointer; }
    #attr-panel .hex .swatch:hover { border-color: rgba(92,229,223,0.7); }
    /* the native picker is stretched over the swatch but invisible, so a click on the swatch opens it */
    #attr-panel .hex .swatch input[type=color] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; border: 0; padding: 0; cursor: pointer; }
    #attr-panel .hex input { flex: 1; min-width: 0; height: 22px; padding: 0 8px; border-radius: 4px; font: inherit;
      font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.04em; text-transform: uppercase;
      background: rgba(255,255,255,0.06); color: #d6efec; border: 1px solid rgba(255,255,255,0.14); outline: none; }
    #attr-panel .hex input:focus { border-color: rgba(92,229,223,0.6); }
    #attr-panel .hex input.invalid { border-color: rgba(255,120,120,0.8); }
    #attr-panel .sub { margin: 8px 0 2px; color: #7fb5b0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    #attr-panel button { padding: 7px; background: rgba(92,229,223,0.15); color: #5ce5df;
      border: 1px solid rgba(92,229,223,0.4); border-radius: 6px; font: inherit; cursor: pointer; }
    #attr-panel button:hover { background: rgba(92,229,223,0.28); }
    #attr-panel button.active { background: rgba(92,229,223,0.4); color: #fff; }
    #attr-panel .presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 4px 0 8px; }
    #attr-panel .export { width: 100%; margin-top: 10px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'attr-panel';
  panel.hidden = true;
  panel.innerHTML = '<h1>Attributes <span>A hide · 1/2/3 presets · Ctrl+Z undo</span></h1>';
  document.body.appendChild(panel);
  // While motion is frozen the scene only re-renders on demand; any edit here is a demand.
  panel.addEventListener('input', () => requestRender());

  // ---- registry: path -> { get, set, refresh }
  const registry = new Map();
  const reg = (path, handle) => { registry.set(path, handle); return handle; };

  // ---- DOM helpers
  const section = (title, open = true) => {
    const d = document.createElement('details');
    d.open = open;
    d.innerHTML = `<summary>${title}</summary>`;
    panel.appendChild(d);
    return d;
  };
  const sub = (parent, text) => {
    const el = document.createElement('div');
    el.className = 'sub';
    el.textContent = text;
    parent.appendChild(el);
  };
  // slider: registers a numeric control. `set` applies the value to the scene.
  const slider = (parent, path, label, min, max, step, get, set, fmt = (v) => v.toFixed(2)) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    const refresh = () => { input.value = get(); out.textContent = fmt(get()); };
    refresh();
    input.addEventListener('input', () => { record(path); set(parseFloat(input.value)); refresh(); });
    parent.appendChild(row);
    return reg(path, { get, set, refresh });
  };
  // color: registers a colour control as a HEX text field with a swatch preview.
  // Values are 6-digit hex without '#'. Accepts #RGB / #RRGGBB while typing and
  // applies as soon as the entry is valid.
  const color = (parent, path, label, get, set) => {
    const row = document.createElement('div');
    row.className = 'row';
    // The swatch doubles as a button: clicking it opens the native colour picker
    // (a visually hidden <input type="color"> sitting inside it).
    row.innerHTML = `<label>${label}</label><div class="hex"><span class="swatch" title="Pick a colour"><input type="color" tabindex="-1"></span><input type="text" maxlength="7" spellcheck="false" placeholder="#RRGGBB"></div>`;
    const input = row.querySelector('input[type=text]'), swatch = row.querySelector('.swatch'), picker = row.querySelector('input[type=color]');
    const normalise = (raw) => {
      let h = String(raw).trim().replace('#', '');
      if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((ch) => ch + ch).join('');
      return /^[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : null;
    };
    const refresh = () => {
      const h = get();
      input.value = '#' + String(h).toUpperCase();
      swatch.style.background = '#' + h;
      picker.value = '#' + String(h).toLowerCase();
      input.classList.remove('invalid');
    };
    refresh();
    input.addEventListener('input', () => {
      const h = normalise(input.value);
      input.classList.toggle('invalid', !h);
      if (h) { record(path); set(h); swatch.style.background = '#' + h; picker.value = '#' + h; }
    });
    picker.addEventListener('input', () => {                      // live while dragging in the picker
      const h = normalise(picker.value);
      if (h) { record(path); set(h); refresh(); }
    });
    input.addEventListener('blur', refresh);                      // snap the text back to the applied value
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    parent.appendChild(row);
    return reg(path, {
      get,
      set: (hex) => { const h = normalise(hex); if (h) set(h); },
      refresh,
    });
  };

  // ---- value helpers
  const splitHDR = (c) => {            // linear HDR colour -> display hex + intensity multiplier
    const m = Math.max(c.r, c.g, c.b, 1e-6);
    return { hex: new THREE.Color(c.r / m, c.g / m, c.b / m).getHexString(), intensity: m };
  };
  const joinHDR = (hex, intensity) => new THREE.Color('#' + hex).multiplyScalar(intensity);
  const root = document.documentElement;
  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const cssHex = (name) => {
    const v = cssVar(name);
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
    return v.replace('#', '');
  };
  const cssNum = (name, fallback) => { const n = parseFloat(cssVar(name)); return Number.isFinite(n) ? n : fallback; };

  // Env changes re-bake the reflection map; coalesce to one bake per frame.
  let bakeQueued = false;
  const queueBake = () => {
    if (bakeQueued) return;
    bakeQueued = true;
    requestAnimationFrame(() => { bakeQueued = false; envStudio.rebuild(); requestRender(); });
  };

  // ---- presets (keys 1/2/3 + buttons)
  const presetRow = document.createElement('div');
  presetRow.className = 'presets';
  const presetButtons = [0, 1, 2].map((i) => {
    const b = document.createElement('button');
    b.textContent = `Preset ${i + 1}`;
    b.addEventListener('click', () => applyPreset(i));
    presetRow.appendChild(b);
    return b;
  });
  panel.appendChild(presetRow);

  // ---- rotation
  {
    const s = section('Scene rotation');
    const rot = { x: 0, y: 0, z: 0 };
    const apply = () => ribbonGroup.rotation.set(
      R.tiltX + THREE.MathUtils.degToRad(rot.x),
      R.yaw + THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z));
    for (const axis of ['x', 'y', 'z']) {
      slider(s, `rotation.${axis}`, `Rotate ${axis.toUpperCase()}`, -180, 180, 1,
        () => rot[axis], (v) => { rot[axis] = v; apply(); }, (v) => v.toFixed(0) + '°');
    }
  }

  // ---- ribbon motion / shape (read live by the animation)
  {
    const s = section('Ribbon');
    const pause = slider(s, 'motion.paused', 'Motion', 0, 1, 1,
      () => (C.motion.paused ? 1 : 0), (v) => { C.motion.paused = !!(v > 0.5 || v === true); },
      (v) => (v > 0.5 ? 'frozen' : 'playing'));
    // Space also toggles it (outside text fields), for grabbing stills.
    window.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || isTyping(e.target)) return;
      e.preventDefault();
      C.motion.paused = !C.motion.paused;
      pause.refresh();
    });
    slider(s, 'ribbon.flowSpeed', 'Speed', 0, 3, 0.01, () => R.flowSpeed, (v) => { R.flowSpeed = v; });
    slider(s, 'ribbon.waveAmp', 'Wave amount', 0, 3, 0.01, () => R.waveAmp, (v) => { R.waveAmp = v; });
    slider(s, 'ribbon.waveDwell', 'Crest dwell', 1, 5, 0.1, () => R.waveDwell ?? 1, (v) => { R.waveDwell = v; }, (v) => v.toFixed(1));
    slider(s, 'ribbon.wave2Amp', 'Ripple', 0, 1, 0.01, () => R.wave2Amp, (v) => { R.wave2Amp = v; });
    slider(s, 'ribbon.twistAmp', 'Twist', 0, 1.5, 0.01, () => R.twistAmp, (v) => { R.twistAmp = v; });
  }

  // ---- hover ripple
  {
    const s = section('Hover ripple');
    const Hv = C.hover;
    slider(s, 'hover.enabled', 'Enabled', 0, 1, 1, () => (Hv.enabled ? 1 : 0), (v) => { Hv.enabled = !!(v > 0.5 || v === true); }, (v) => (v > 0.5 ? 'on' : 'off'));
    slider(s, 'hover.radius', 'Radius', 0.2, 4, 0.05, () => Hv.radius, (v) => { Hv.radius = v; });
    slider(s, 'hover.lift', 'Lift', 0, 1.5, 0.01, () => Hv.lift, (v) => { Hv.lift = v; });
    slider(s, 'hover.ease', 'Ease', 1, 30, 0.5, () => Hv.ease, (v) => { Hv.ease = v; }, (v) => v.toFixed(1));
    slider(s, 'hover.follow', 'Follow', 2, 40, 0.5, () => Hv.follow, (v) => { Hv.follow = v; }, (v) => v.toFixed(1));
  }

  // ---- render (device-specific; excluded from the JSON export so presets never carry it)
  {
    const s = section('Render');
    slider(s, 'render.pixelRatio', 'Pixel ratio', 0.5, 3, 0.05, () => getPixelRatio(), (v) => setPixelRatio(v),
      (v) => v.toFixed(2) + 'x');
    const note = document.createElement('div');
    note.className = 'sub';
    note.textContent = 'device ratio ' + window.devicePixelRatio.toFixed(2) + 'x · press F for fps';
    s.appendChild(note);
  }

  // ---- camera
  {
    const s = section('Camera');
    slider(s, 'camera.distance', 'Distance', 1, 16, 0.05, () => C.camera.distance, (v) => { C.camera.distance = v; applyCamera(); });
    slider(s, 'camera.height', 'Height', -3, 4, 0.05, () => C.camera.height, (v) => { C.camera.height = v; applyCamera(); });
    slider(s, 'camera.lookAtY', 'Look down', -4, 2, 0.05, () => C.camera.lookAtY, (v) => { C.camera.lookAtY = v; applyCamera(); });
    slider(s, 'camera.fov', 'Field of view', 15, 90, 1, () => camera.fov, (v) => { camera.fov = v; camera.updateProjectionMatrix(); }, (v) => v.toFixed(0) + '°');
  }

  // ---- depth of field (read every frame by the composite pass)
  {
    const s = section('Depth of field');
    const D = C.dof;
    slider(s, 'dof.enabled', 'Enabled', 0, 1, 1, () => (D.enabled ? 1 : 0), (v) => { D.enabled = !!(v > 0.5 || v === true); }, (v) => (v > 0.5 ? 'on' : 'off'));
    slider(s, 'dof.focus', 'Focus line', 0, 1, 0.01, () => D.focus, (v) => { D.focus = v; });
    slider(s, 'dof.width', 'Sharp band', 0, 0.5, 0.01, () => D.width, (v) => { D.width = v; });
    slider(s, 'dof.feather', 'Feather', 0.02, 0.8, 0.01, () => D.feather, (v) => { D.feather = v; });
    slider(s, 'dof.near', 'Near blur', 0, 1, 0.01, () => D.near, (v) => { D.near = v; });
    slider(s, 'dof.far', 'Far blur', 0, 1, 0.01, () => D.far, (v) => { D.far = v; });
    slider(s, 'dof.clampHighlights', 'Highlight cap', 0, 6, 0.1, () => D.clampHighlights, (v) => { D.clampHighlights = v; }, (v) => (v > 0 ? v.toFixed(1) : 'off'));
  }

  // ---- legibility fade (rendered in the composite shader; see config.fade)
  {
    const s = section('Legibility fade');
    const F = C.fade;
    slider(s, 'fade.enabled', 'Enabled', 0, 1, 1, () => (F.enabled ? 1 : 0), (v) => { F.enabled = !!(v > 0.5 || v === true); }, (v) => (v > 0.5 ? 'on' : 'off'));
    color(s, 'fade.color', 'Colour', () => String(F.color).replace('#', ''), (hex) => { F.color = hex; });
    slider(s, 'fade.opacity', 'Opacity', 0, 1, 0.01, () => F.opacity, (v) => { F.opacity = v; });
    slider(s, 'fade.size', 'Size %', 20, 250, 1, () => F.size, (v) => { F.size = v; }, (v) => v.toFixed(0) + '%');
    slider(s, 'fade.x', 'Centre X %', -60, 160, 1, () => F.x, (v) => { F.x = v; }, (v) => v.toFixed(0) + '%');
    slider(s, 'fade.y', 'Centre Y %', -60, 160, 1, () => F.y, (v) => { F.y = v; }, (v) => v.toFixed(0) + '%');
    slider(s, 'fade.blur', 'Blur %', 0, 30, 0.1, () => F.blur, (v) => { F.blur = v; }, (v) => v.toFixed(1));
  }

  // ---- UI buttons (Contact Us + Explore what we do share these CSS variables)
  {
    const s = section('UI buttons');
    const btn = { fill: cssHex('--green'), hover: cssHex('--green-hover'), text: cssHex('--btn-text') };
    color(s, 'buttons.fill', 'Fill', () => btn.fill, (hex) => { btn.fill = hex; root.style.setProperty('--green', '#' + hex); });
    color(s, 'buttons.hover', 'Hover fill', () => btn.hover, (hex) => { btn.hover = hex; root.style.setProperty('--green-hover', '#' + hex); });
    color(s, 'buttons.text', 'Text / badge', () => btn.text, (hex) => { btn.text = hex; root.style.setProperty('--btn-text', '#' + hex); });
  }

  // ---- env lights
  {
    const s = section('Env lights');
    const wash = splitHDR(envStudio.wash.material.color);
    sub(s, 'Ambient wash');
    color(s, 'wash.hex', 'Colour', () => wash.hex, (hex) => {
      wash.hex = hex; envStudio.wash.material.color.copy(joinHDR(hex, wash.intensity)); queueBake();
    });
    slider(s, 'wash.intensity', 'Intensity', 0, 2, 0.01, () => wash.intensity, (v) => {
      wash.intensity = v; envStudio.wash.material.color.copy(joinHDR(wash.hex, v)); queueBake();
    });

    for (const light of envStudio.lights) {
      const mat = light.mesh.material;
      const st = { ...splitHDR(mat.color), opacity: mat.opacity };
      const base = `lights.${light.name}`;
      sub(s, light.name);
      color(s, `${base}.hex`, 'Colour', () => st.hex, (hex) => {
        st.hex = hex; mat.color.copy(joinHDR(hex, st.intensity)); queueBake();
      });
      slider(s, `${base}.intensity`, 'Intensity', 0, 24, 0.1, () => st.intensity, (v) => {
        st.intensity = v; mat.color.copy(joinHDR(st.hex, v)); queueBake();
      }, (v) => v.toFixed(1));
      slider(s, `${base}.opacity`, 'Opacity', 0, 1, 0.01, () => st.opacity, (v) => {
        st.opacity = v; mat.opacity = v; queueBake();
      });
    }
  }

  // ---- directional lights (sharp facet glints)
  {
    const s = section('Direct lights');
    for (const [name, label] of [['key', 'Key'], ['rim', 'Rim']]) {
      const L = sunLights[name], cfg = C.sun[name];
      sub(s, `${label} light`);
      color(s, `sun.${name}.color`, 'Colour', () => cfg.color, (hex) => { cfg.color = hex; L.color.set('#' + hex); });
      slider(s, `sun.${name}.intensity`, 'Intensity', 0, 3, 0.01, () => cfg.intensity, (v) => { cfg.intensity = v; L.intensity = v; });
    }
  }

  // ---- background gradient
  {
    const s = section('Background gradient');
    for (const [label, key] of [['Bright', 'uBright'], ['Mid', 'uMid'], ['Dark', 'uDark']]) {
      const c = bgUniforms[key].value;
      color(s, `background.${label.toLowerCase()}`, label, () => c.getHexString(), (hex) => c.set('#' + hex));
    }
  }

  // ---- triangles
  {
    const s = section('Triangles');
    const tri = { color: rowMaterials[0].color.getHexString(), opacity: realGlass ? 1 : C.glass.fakeOpacity };
    color(s, 'triangles.color', 'Colour', () => tri.color, (hex) => {
      tri.color = hex; for (const m of rowMaterials) m.color.set('#' + hex);
    });
    slider(s, 'triangles.opacity', 'Opacity', 0, 1, 0.01, () => tri.opacity, (v) => {
      tri.opacity = v; for (const m of rowMaterials) m.opacity = m.userData.rowAlpha * v;
    });
    slider(s, 'triangles.glintSharpness', 'Glint softness', 0.02, 0.6, 0.01, () => C.glass.clearcoatRoughness, (v) => {
      C.glass.clearcoatRoughness = v;
      for (const m of rowMaterials) m.clearcoatRoughness = v;
    });
    slider(s, 'reflections', 'Reflections', 0, 3, 0.01, () => C.glass.envIntensity, (v) => {
      C.glass.envIntensity = v;
      for (const m of rowMaterials) m.envMapIntensity = v * m.userData.rowAlpha * m.userData.rowAlpha;
    });
  }

  // ---- undo / redo (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y)
  // Every UI edit records the state *before* it. Successive edits to the same
  // control within a second are coalesced, so a slider drag is one undo step.
  const history = [], future = [];
  const HISTORY_MAX = 200;
  let lastRecordPath = null, lastRecordTime = 0;
  function record(path) {
    const now = performance.now();
    if (path === lastRecordPath && now - lastRecordTime < 1000) { lastRecordTime = now; return; }
    history.push(exportSettings());
    if (history.length > HISTORY_MAX) history.shift();
    future.length = 0;
    lastRecordPath = path; lastRecordTime = now;
  }
  function undo() {
    if (!history.length) return false;
    future.push(exportSettings());
    applySettings(history.pop());
    lastRecordPath = null;
    return true;
  }
  function redo() {
    if (!future.length) return false;
    history.push(exportSettings());
    applySettings(future.pop());
    lastRecordPath = null;
    return true;
  }

  // ---- export / import through the registry
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const setPath = (obj, path, value) => {
    const keys = path.split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys[keys.length - 1]] = value;
  };

  function exportSettings() {
    const out = {};
    for (const [path, h] of registry) {
      if (path.startsWith('render.')) continue;   // device-specific, not part of a look
      let v = h.get();
      if (path === 'motion.paused' || path === 'dof.enabled' || path === 'fade.enabled' || path === 'hover.enabled') v = v > 0.5;   // booleans read nicer in JSON
      setPath(out, path, v);
    }
    return out;
  }

  // Apply any subset of the exported shape. Unknown keys are ignored, missing
  // keys leave the current value alone, so a preset can be colours only.
  function applySettings(json) {
    if (!json) return;
    for (const [path, h] of registry) {
      const v = getPath(json, path);
      if (v === undefined || v === null) continue;
      h.set(typeof v === 'boolean' ? (v ? 1 : 0) : v);
      h.refresh();
    }
    requestRender();
  }

  let activePreset = -1;
  function applyPreset(i) {
    const list = window.PRESETS || [];
    if (!list[i]) { console.warn(`No preset ${i + 1} defined in presets.js`); return; }
    record('preset:' + i + ':' + performance.now());   // never coalesced: each preset switch is its own undo step
    applySettings(list[i]);
    activePreset = i;
    presetButtons.forEach((b, k) => b.classList.toggle('active', k === i));
  }

  const exportBtn = document.createElement('button');
  exportBtn.className = 'export';
  exportBtn.textContent = 'Copy settings as JSON';
  exportBtn.addEventListener('click', async () => {
    const json = JSON.stringify(exportSettings(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      exportBtn.textContent = 'Copied';
    } catch {
      console.log(json);
      exportBtn.textContent = 'Printed to console';
    }
    setTimeout(() => { exportBtn.textContent = 'Copy settings as JSON'; }, 1500);
  });
  panel.appendChild(exportBtn);

  // ---- keys: A toggles the panel, 1/2/3 apply presets
  function isTyping(t) {
    return !!(t && (t.tagName === 'TEXTAREA' || t.isContentEditable ||
      (t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(t.type))));
  }
  window.addEventListener('keydown', (e) => {
    // Undo / redo work everywhere, including while a hex field has focus.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
    }
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); panel.hidden = !panel.hidden; return; }
    if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); applyPreset(+e.key - 1); }
  });

  return {
    panel, exportSettings, applySettings, applyPreset, undo, redo,
    clearHistory() { history.length = 0; future.length = 0; lastRecordPath = null; },
    get activePreset() { return activePreset; },
    get historyLength() { return history.length; },
  };
}

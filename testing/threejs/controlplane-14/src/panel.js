import * as THREE from 'three';

// Attributes panel (toggle with A). Plain DOM, no dependencies. Edits the
// live scene directly; "Copy settings" puts the current values on the
// clipboard as JSON so they can be baked into config.js later.
export function initPanel({ C, R, ribbonGroup, envStudio, bgUniforms, rowMaterials, realGlass, camera, applyCamera, requestRender }) {
  const css = `
    #attr-panel { position: fixed; top: 12px; right: 12px; width: 300px; max-height: calc(100vh - 24px);
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
    #attr-panel input[type=color] { width: 100%; height: 22px; border: none; background: none; padding: 0; cursor: pointer; }
    #attr-panel .sub { margin: 8px 0 2px; color: #7fb5b0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    #attr-panel button { width: 100%; margin-top: 10px; padding: 7px; background: rgba(92,229,223,0.15); color: #5ce5df;
      border: 1px solid rgba(92,229,223,0.4); border-radius: 6px; font: inherit; cursor: pointer; }
    #attr-panel button:hover { background: rgba(92,229,223,0.28); }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'attr-panel';
  panel.hidden = true;
  panel.innerHTML = '<h1>Attributes <span>A to hide</span></h1>';
  document.body.appendChild(panel);
  // While motion is frozen the scene only re-renders on demand; any edit here is a demand.
  panel.addEventListener('input', () => requestRender());

  // ---- helpers
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
  const slider = (parent, label, min, max, step, get, set, fmt = (v) => v.toFixed(2)) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.value = get();
    out.textContent = fmt(get());
    input.addEventListener('input', () => { const v = parseFloat(input.value); set(v); out.textContent = fmt(v); });
    parent.appendChild(row);
    return { refresh() { input.value = get(); out.textContent = fmt(get()); } };
  };
  const color = (parent, label, get, set) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${label}</label><input type="color"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.value = '#' + get();
    out.textContent = '';
    input.addEventListener('input', () => set(input.value));
    parent.appendChild(row);
    return { refresh() { input.value = '#' + get(); } };
  };
  // Split a linear HDR colour into a display hex (sRGB) + intensity multiplier.
  const splitHDR = (c) => {
    const m = Math.max(c.r, c.g, c.b, 1e-6);
    const n = new THREE.Color(c.r / m, c.g / m, c.b / m);
    return { hex: n.getHexString(), intensity: m };
  };
  const joinHDR = (hex, intensity) => new THREE.Color(hex).multiplyScalar(intensity);

  // Env changes re-bake the reflection map; coalesce to one bake per frame.
  let bakeQueued = false;
  const queueBake = () => {
    if (bakeQueued) return;
    bakeQueued = true;
    requestAnimationFrame(() => { bakeQueued = false; envStudio.rebuild(); requestRender(); });
  };

  const settings = {
    rotation: { x: 0, y: 0, z: 0 },
    lights: {},
    wash: null,
    background: {},
    triangles: {},
  };

  // ---- rotation
  {
    const s = section('Scene rotation');
    const deg = (v) => v.toFixed(0) + '°';
    const apply = () => {
      const r = settings.rotation;
      ribbonGroup.rotation.set(
        R.tiltX + THREE.MathUtils.degToRad(r.x),
        R.yaw + THREE.MathUtils.degToRad(r.y),
        THREE.MathUtils.degToRad(r.z));
    };
    for (const axis of ['x', 'y', 'z']) {
      slider(s, `Rotate ${axis.toUpperCase()}`, -180, 180, 1,
        () => settings.rotation[axis], (v) => { settings.rotation[axis] = v; apply(); }, deg);
    }
  }

  // ---- ribbon motion / shape (all read live by the animation, so these apply instantly)
  {
    const s = section('Ribbon');
    const pause = slider(s, 'Motion', 0, 1, 1, () => (C.motion.paused ? 0 : 1), (v) => { C.motion.paused = v < 0.5; },
      (v) => (v < 0.5 ? 'frozen' : 'playing'));
    // Space also toggles it (outside text fields), for grabbing stills.
    window.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || (e.target && (e.target.tagName === 'TEXTAREA' || e.target.isContentEditable ||
        (e.target.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(e.target.type))))) return;
      e.preventDefault();
      C.motion.paused = !C.motion.paused;
      pause.refresh();
    });
    slider(s, 'Speed', 0, 3, 0.01, () => R.flowSpeed, (v) => { R.flowSpeed = v; });
    slider(s, 'Wave amount', 0, 3, 0.01, () => R.waveAmp, (v) => { R.waveAmp = v; });
    slider(s, 'Ripple', 0, 1, 0.01, () => R.wave2Amp, (v) => { R.wave2Amp = v; });
    slider(s, 'Twist', 0, 1.5, 0.01, () => R.twistAmp, (v) => { R.twistAmp = v; });
  }

  // ---- camera
  {
    const s = section('Camera');
    slider(s, 'Distance', 1, 16, 0.05, () => C.camera.distance, (v) => { C.camera.distance = v; applyCamera(); });
    slider(s, 'Height', -3, 4, 0.05, () => C.camera.height, (v) => { C.camera.height = v; applyCamera(); });
    slider(s, 'Look down', -4, 2, 0.05, () => C.camera.lookAtY, (v) => { C.camera.lookAtY = v; applyCamera(); });
    slider(s, 'Field of view', 15, 90, 1, () => camera.fov, (v) => { camera.fov = v; camera.updateProjectionMatrix(); }, (v) => v.toFixed(0) + '°');
  }

  // ---- depth of field (read every frame by the composite pass)
  {
    const s = section('Depth of field');
    const D = C.dof;
    slider(s, 'Enabled', 0, 1, 1, () => (D.enabled ? 1 : 0), (v) => { D.enabled = v > 0.5; }, (v) => (v > 0.5 ? 'on' : 'off'));
    slider(s, 'Focus line', 0, 1, 0.01, () => D.focus, (v) => { D.focus = v; });
    slider(s, 'Sharp band', 0, 0.5, 0.01, () => D.width, (v) => { D.width = v; });
    slider(s, 'Feather', 0.02, 0.8, 0.01, () => D.feather, (v) => { D.feather = v; });
    slider(s, 'Near blur', 0, 1, 0.01, () => D.near, (v) => { D.near = v; });
    slider(s, 'Far blur', 0, 1, 0.01, () => D.far, (v) => { D.far = v; });
  }

  // ---- env lights
  {
    const s = section('Env lights');
    const washState = splitHDR(envStudio.wash.material.color);
    settings.wash = washState;
    sub(s, 'Ambient wash');
    color(s, 'Colour', () => washState.hex, (hex) => {
      washState.hex = hex.slice(1);
      envStudio.wash.material.color.copy(joinHDR(hex, washState.intensity));
      queueBake();
    });
    slider(s, 'Intensity', 0, 2, 0.01, () => washState.intensity, (v) => {
      washState.intensity = v;
      envStudio.wash.material.color.copy(joinHDR('#' + washState.hex, v));
      queueBake();
    });

    for (const light of envStudio.lights) {
      const mat = light.mesh.material;
      const st = { ...splitHDR(mat.color), opacity: mat.opacity };
      settings.lights[light.name] = st;
      sub(s, light.name);
      color(s, 'Colour', () => st.hex, (hex) => {
        st.hex = hex.slice(1);
        mat.color.copy(joinHDR(hex, st.intensity));
        queueBake();
      });
      slider(s, 'Intensity', 0, 24, 0.1, () => st.intensity, (v) => {
        st.intensity = v;
        mat.color.copy(joinHDR('#' + st.hex, v));
        queueBake();
      }, (v) => v.toFixed(1));
      slider(s, 'Opacity', 0, 1, 0.01, () => st.opacity, (v) => {
        st.opacity = v;
        mat.opacity = v;
        queueBake();
      });
    }
  }

  // ---- background
  {
    const s = section('Background gradient');
    const entries = [['Bright', 'uBright'], ['Mid', 'uMid'], ['Dark', 'uDark']];
    for (const [label, key] of entries) {
      const c = bgUniforms[key].value;
      settings.background[label.toLowerCase()] = c.getHexString();
      color(s, label, () => c.getHexString(), (hex) => {
        c.set(hex);
        settings.background[label.toLowerCase()] = hex.slice(1);
      });
    }
  }

  // ---- triangles
  {
    const s = section('Triangles');
    const tri = settings.triangles;
    tri.color = rowMaterials[0].color.getHexString();
    tri.opacity = realGlass ? 1 : C.glass.fakeOpacity;
    color(s, 'Colour', () => tri.color, (hex) => {
      tri.color = hex.slice(1);
      for (const m of rowMaterials) m.color.set(hex);
    });
    slider(s, 'Opacity', 0, 1, 0.01, () => tri.opacity, (v) => {
      tri.opacity = v;
      for (const m of rowMaterials) m.opacity = m.userData.rowAlpha * v;
    });
    slider(s, 'Reflections', 0, 3, 0.01, () => C.glass.envIntensity, (v) => {
      C.glass.envIntensity = v;
      for (const m of rowMaterials) m.envMapIntensity = v * m.userData.rowAlpha * m.userData.rowAlpha;
    });
  }

  // ---- export
  const btn = document.createElement('button');
  btn.textContent = 'Copy settings as JSON';
  btn.addEventListener('click', async () => {
    const json = JSON.stringify({
      ...settings,
      reflections: C.glass.envIntensity,
      ribbon: { flowSpeed: R.flowSpeed, waveAmp: R.waveAmp, wave2Amp: R.wave2Amp, twistAmp: R.twistAmp },
      camera: { distance: C.camera.distance, height: C.camera.height, lookAtY: C.camera.lookAtY, fov: camera.fov },
      dof: { ...C.dof },
      motion: { ...C.motion },
    }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      btn.textContent = 'Copied';
    } catch {
      console.log(json);
      btn.textContent = 'Printed to console';
    }
    setTimeout(() => { btn.textContent = 'Copy settings as JSON'; }, 1500);
  });
  panel.appendChild(btn);

  // ---- toggle
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'a' && e.key !== 'A') return;
    // Only text entry swallows the key; a focused slider or colour swatch
    // (which keeps focus after you drag it) must still let A toggle.
    const t = e.target;
    const typing = t && (t.tagName === 'TEXTAREA' || t.isContentEditable ||
      (t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(t.type)));
    if (typing) return;
    e.preventDefault();
    panel.hidden = !panel.hidden;
  });

  return { panel, settings };
}

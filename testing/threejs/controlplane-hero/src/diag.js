import * as THREE from 'three';

// Diagnostics overlay (D key, or ?diag in the URL). Live performance
// metrics plus everything about the machine, browser, screen and WebGL
// context that matters when a viewer reports poor performance. "Copy report"
// puts the whole thing on the clipboard as text so a client can paste it back.
export function initDiag({ renderer, container, getState }) {
  const css = `
    #diag { position: absolute; left: var(--pad); top: calc(clamp(18px, 2vw, 36px) + 56px + 10px + 38px);
      width: 400px; max-width: calc(100% - 2 * var(--pad)); max-height: calc(100% - 200px); overflow-y: auto;
      background: rgba(0, 8, 18, 0.78); color: #d6efec; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px;
      padding: 8px 10px 10px; font: 11px/1.45 ui-monospace, Consolas, Menlo, monospace; z-index: 4;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); pointer-events: auto; }
    #diag[hidden] { display: none; }
    #diag .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    #diag .head b { font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; font-size: 10px; color: #5ce5df; }
    #diag .head span { color: #8fbcb7; font-size: 10px; }
    #diag button { padding: 3px 8px; background: rgba(92,229,223,0.15); color: #5ce5df; border: 1px solid rgba(92,229,223,0.4);
      border-radius: 4px; font: inherit; font-size: 10px; cursor: pointer; }
    #diag button:hover { background: rgba(92,229,223,0.28); }
    #diag h2 { margin: 7px 0 2px; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #7fb5b0; font-weight: 600;
      border-top: 1px solid rgba(255,255,255,0.08); padding-top: 5px; }
    #diag .kv { display: grid; grid-template-columns: 118px 1fr; column-gap: 8px; }
    #diag .kv span:nth-child(odd) { color: #9fcfca; white-space: nowrap; }
    #diag .kv span:nth-child(even) { color: #e6f7f5; word-break: break-word; font-variant-numeric: tabular-nums; }
    #diag .warn { color: #ffb3a7; }
    #diag .good { color: #9cf7d9; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'diag';
  el.hidden = true;
  el.innerHTML = '<div class="head"><b>Diagnostics</b><span>D to hide</span><button type="button">Copy report</button></div><div class="body"></div>';
  const frameEl = document.getElementById('frame') || document.body;
  frameEl.appendChild(el);
  const body = el.querySelector('.body');
  const copyBtn = el.querySelector('button');

  // ---- WebGL / GPU facts (read once)
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const vendor = String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|warp|mesa offscreen/i.test(gpu + ' ' + vendor);
  const attrs = gl.getContextAttributes() || {};
  const caps = renderer.capabilities;
  const ext = (name) => !!gl.getExtension(name);
  const glFacts = {
    gpu, vendor,
    softwareRendering: software,
    webgl: caps.isWebGL2 ? 'WebGL 2' : 'WebGL 1',
    glVersion: String(gl.getParameter(gl.VERSION)),
    shadingLanguage: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    powerPreference: attrs.powerPreference || 'default',
    contextAntialias: !!attrs.antialias,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxSamples: caps.isWebGL2 ? gl.getParameter(gl.MAX_SAMPLES) : 0,
    maxTextureUnits: caps.maxTextures,
    precision: caps.precision,
    floatTargets: ext('EXT_color_buffer_float'),
    halfFloatTargets: ext('EXT_color_buffer_half_float') || ext('EXT_color_buffer_float'),
    floatLinear: ext('OES_texture_float_linear'),
    anisotropy: caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 0,
    threeRevision: THREE.REVISION,
  };
  let contextLost = 0;
  renderer.domElement.addEventListener('webglcontextlost', () => { contextLost++; }, false);

  // ---- device / browser facts (some arrive async)
  const nav = navigator;
  const device = {
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform || nav.platform || '?',
    browser: nav.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).filter((s) => !/Not.A.Brand/i.test(s)).join(', ') || '',
    mobile: nav.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(nav.userAgent),
    cpuThreads: nav.hardwareConcurrency || '?',
    deviceMemoryGB: nav.deviceMemory ? `${nav.deviceMemory} (browser-capped)` : 'n/a',
    touchPoints: nav.maxTouchPoints ?? 0,
    language: nav.language,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    hdrDisplay: matchMedia('(dynamic-range: high)').matches,
    colorGamutP3: matchMedia('(color-gamut: p3)').matches,
    connection: nav.connection ? `${nav.connection.effectiveType || ''} ${nav.connection.downlink ? nav.connection.downlink + ' Mbps' : ''}`.trim() : 'n/a',
    architecture: '', platformVersion: '', model: '', battery: '',
  };
  if (nav.userAgentData?.getHighEntropyValues) {
    nav.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model', 'fullVersionList'])
      .then((v) => {
        device.architecture = [v.architecture, v.bitness ? v.bitness + '-bit' : ''].filter(Boolean).join(' ');
        device.platformVersion = v.platformVersion || '';
        device.model = v.model || '';
        if (v.fullVersionList) device.browser = v.fullVersionList.map((b) => `${b.brand} ${b.version}`).filter((s) => !/Not.A.Brand/i.test(s)).join(', ');
      }).catch(() => {});
  }
  if (nav.getBattery) {
    nav.getBattery().then((b) => {
      const upd = () => { device.battery = `${Math.round(b.level * 100)}% ${b.charging ? 'charging' : 'on battery'}`; };
      upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
    }).catch(() => {});
  }

  // ---- frame timing: ring buffer of the last ~5 s of frame deltas
  const MAX = 600;
  const dts = new Float32Array(MAX);
  let head = 0, count = 0, lastUpdate = 0, lastRafGap = 0;
  const loadedAt = performance.now();
  function frame(dtSeconds) {
    dts[head] = dtSeconds; head = (head + 1) % MAX; if (count < MAX) count++;
    lastRafGap = dtSeconds;
  }
  function timing() {
    if (!count) return null;
    const n = Math.min(count, MAX);
    const arr = Array.from({ length: n }, (_, i) => dts[(head - 1 - i + MAX) % MAX]);
    let sum = 0, worst = 0;
    // recent window (~0.5 s) for the headline fps
    let recentN = 0, recentSum = 0;
    for (const d of arr) {
      sum += d; if (d > worst) worst = d;
      if (recentSum < 0.5) { recentSum += d; recentN++; }
    }
    const sorted = arr.slice().sort((a, b) => a - b);
    const p99 = sorted[Math.min(n - 1, Math.floor(n * 0.99))];
    const fps = recentN / recentSum;
    return { fps, avgMs: (sum / n) * 1000, p99Ms: p99 * 1000, worstMs: worst * 1000, spanS: sum, oneLow: 1 / p99 };
  }

  // ---- report
  const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v === true ? 'yes' : v === false ? 'no' : String(v ?? ''));
  function sections() {
    const s = getState();
    const t = timing();
    const info = renderer.info;
    const mem = performance.memory;
    const cssW = container.clientWidth, cssH = container.clientHeight;
    const dbW = Math.round(cssW * s.canvasRatio), dbH = Math.round(cssH * s.canvasRatio);
    const inW = Math.round(cssW * s.renderRatio), inH = Math.round(cssH * s.renderRatio);
    return [
      ['Performance', {
        'fps (0.5 s)': t ? (s.frozen ? 'frozen (renders on demand)' : t.fps.toFixed(0)) : '…',
        'frame time': t ? `${t.avgMs.toFixed(1)} ms avg · ${t.p99Ms.toFixed(1)} ms 99th · ${t.worstMs.toFixed(0)} ms worst (${t.spanS.toFixed(0)} s)` : '…',
        '1% low fps': t ? t.oneLow.toFixed(0) : '…',
        'draw calls / frame': `${info.render.calls} · ${(info.render.triangles / 1000).toFixed(0)}k tris`,
        'gpu resources': `${info.memory.geometries} geometries · ${info.memory.textures} textures · ${info.programs ? info.programs.length : '?'} programs`,
        'js heap': mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB used / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB limit` : 'n/a',
        'page uptime': `${((performance.now() - loadedAt) / 1000).toFixed(0)} s · visibility ${document.visibilityState}`,
        'context lost': contextLost,
      }],
      ['Render', {
        'mode': s.frozen ? 'frozen (still quality)' : s.loop ? 'live · 15 s loop' : 'live',
        'canvas': `${dbW}×${dbH} @ ${s.canvasRatio.toFixed(2)}x`,
        'internal render': `${inW}×${inH} @ ${s.renderRatio.toFixed(2)}x${s.postScale > 1 ? ` (supersample ${s.postScale.toFixed(2)}x)` : ''} · ${((inW * inH) / 1e6).toFixed(1)} MP`,
        'live ratio cap': `${s.livePixelRatio.toFixed(2)}x (config ${s.maxPixelRatio}x) · still ${s.stillRatio.toFixed(2)}x`,
        'msaa': `${s.msaa}x · fxaa on · bloom ${s.bloomPasses} passes · dof ${s.dof ? 'on' : 'off'}`,
        'instances': `${s.rows} rows × ${s.perRow} prisms = ${s.rows * s.perRow}`,
      }],
      ['GPU / WebGL', {
        'renderer': `${gpu}`,
        'vendor': vendor,
        'software rendering': software ? 'YES - no GPU acceleration' : 'no',
        'context': `${glFacts.webgl} · ${glFacts.glVersion}`,
        'power preference': glFacts.powerPreference,
        'limits': `tex ${glFacts.maxTextureSize} · rb ${glFacts.maxRenderbufferSize} · samples ${glFacts.maxSamples} · precision ${glFacts.precision}`,
        'float targets': `${glFacts.halfFloatTargets ? 'half' : 'NO half'} · ${glFacts.floatTargets ? 'full' : 'no full'} · linear ${glFacts.floatLinear ? 'yes' : 'no'}`,
        'three.js': `r${glFacts.threeRevision}`,
      }],
      ['Display', {
        'screen': `${screen.width}×${screen.height} css · ${Math.round(screen.width * devicePixelRatio)}×${Math.round(screen.height * devicePixelRatio)} px · ${screen.colorDepth}-bit`,
        'device pixel ratio': `${devicePixelRatio.toFixed(2)}${window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01 ? ` · pinch zoom ${window.visualViewport.scale.toFixed(2)}` : ''}`,
        'window': `${innerWidth}×${innerHeight} css · frame ${cssW}×${cssH}`,
        'display flags': [device.hdrDisplay ? 'HDR' : 'SDR', device.colorGamutP3 ? 'P3' : 'sRGB', device.reducedMotion ? 'reduced-motion' : ''].filter(Boolean).join(' · '),
      }],
      ['Device / browser', {
        'browser': device.browser || '(see user agent)',
        'platform': [device.platform, device.platformVersion, device.architecture].filter(Boolean).join(' · '),
        'model': device.model || (device.mobile ? 'mobile' : 'desktop'),
        'cpu threads': device.cpuThreads,
        'memory': device.deviceMemoryGB,
        'battery': device.battery || 'n/a',
        'touch / language': `${device.touchPoints} · ${device.language}`,
        'network': device.connection,
        'user agent': device.userAgent,
      }],
      ['Page', {
        'url': location.href,
        'time': new Date().toISOString(),
      }],
    ];
  }

  function render() {
    const parts = [];
    for (const [title, kv] of sections()) {
      parts.push(`<h2>${title}</h2><div class="kv">`);
      for (const [k, v] of Object.entries(kv)) {
        const text = fmt(v);
        const cls = /^YES|NO half/.test(text) ? ' class="warn"' : '';
        parts.push(`<span>${k}</span><span${cls}>${escapeHtml(text)}</span>`);
      }
      parts.push('</div>');
    }
    body.innerHTML = parts.join('');
  }
  function reportText() {
    const lines = ['ControlPlane hero diagnostics'];
    for (const [title, kv] of sections()) {
      lines.push('', `[${title}]`);
      for (const [k, v] of Object.entries(kv)) lines.push(`${k}: ${fmt(v)}`);
    }
    return lines.join('\n');
  }
  function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  // Copy to the clipboard; if the browser refuses (http, locked-down policy),
  // show the report in a selectable box instead so it can be copied by hand.
  copyBtn.addEventListener('click', async () => {
    const text = reportText();
    try {
      if (!navigator.clipboard) throw new Error('no clipboard API');
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
    } catch {
      let ta = el.querySelector('textarea');
      if (!ta) {
        ta = document.createElement('textarea');
        ta.readOnly = true;
        ta.style.cssText = 'width:100%;height:160px;margin-top:6px;box-sizing:border-box;background:rgba(255,255,255,0.06);color:#e6f7f5;border:1px solid rgba(255,255,255,0.14);border-radius:4px;font:inherit;padding:6px;resize:vertical;';
        el.insertBefore(ta, body);
      }
      ta.value = text;
      ta.focus(); ta.select();
      copyBtn.textContent = 'Select all & copy';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy report'; }, 2500);
  });

  // Refresh twice a second while visible.
  function tick(nowSeconds) {
    if (el.hidden || nowSeconds - lastUpdate < 0.5) return;
    lastUpdate = nowSeconds;
    render();
  }
  function setVisible(v) { el.hidden = !v; if (v) { lastUpdate = 0; render(); } }

  const isTyping = (t) => !!(t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !['range', 'color', 'checkbox', 'button'].includes(t.type))));
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'd' && e.key !== 'D') || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    e.preventDefault();
    setVisible(el.hidden);
  });
  if (new URLSearchParams(location.search).has('diag')) setVisible(true);

  return { el, frame, tick, setVisible, reportText, get software() { return software; }, gpu };
}

// FOOTER HOVER (James; replaces the glow, the blueprint grid and the pixels): soft lime smoke inside the giant Halo
// letters. A three.js full-screen shader (domain-warped fbm noise drifting upwards) is drawn on the .ft-pix canvas,
// which sits exactly over the logo and is CSS-masked to the letters. The smoke gathers around the cursor while it is
// over the logo (eased follow) and thins away when it leaves. Renders only while visible and active.
import * as THREE from 'three';

const sec = document.getElementById('footer');
const cv = sec?.querySelector('.ft-pix');
const logo = sec?.querySelector('.ft-logo');
if (cv && logo) {
  const S = {
    // HAZY FOG (James: "not literal smoke, more hazy fog"): big soft low-contrast patches drifting slowly, no wisps
    radius: 1.0,       // how far the fog spreads from the cursor (share of the logo's height; the logo is 80 x 34)
    follow: 2.5,       // how quickly the fog centre follows the cursor (per second; slower = floatier)
    fadeIn: 1.6,       // strength easing towards 1 while hovering (per second)
    fadeOut: 0.8,      // ... and towards 0 after leaving (per second)
    speed: 0.07,       // drift speed (slow)
    scale: 0.9,        // noise scale (small = big soft patches)
    opacity: 0.6,      // peak fog opacity
    lime: [0.902, 1.0, 0.0],   // #E6FF00
  };

  // mask the canvas to the letters, from the logo's own paths
  const paths = [...logo.querySelectorAll('path')].map(p => `<path d="${p.getAttribute('d')}"/>`).join('');
  const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 34">${paths}</svg>`)}")`;
  cv.style.webkitMaskImage = cv.style.maskImage = url;

  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = {
    uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uStrength: { value: 0 },
    uAspect: { value: 80 / 34 }, uRadius: { value: S.radius }, uScale: { value: S.scale }, uSpeed: { value: S.speed },
    uOpacity: { value: S.opacity }, uLime: { value: new THREE.Color(...S.lime) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uStrength, uAspect, uRadius, uScale, uSpeed, uOpacity;
      uniform vec2 uMouse; uniform vec3 uLime;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      // only 3 octaves: soft, smooth patches (no fine wisps)
      float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 3; i++){ v += a * noise(p); p = r * p * 2.02 + 3.1; a *= 0.5; } return v / 0.875; }
      void main(){
        vec2 p = vec2(vUv.x * uAspect, vUv.y) * uScale;
        float t = uTime * uSpeed;
        // a gentle warp so the banks of fog roll and drift sideways rather than rise in plumes
        vec2 q = vec2(fbm(p + vec2(t, 0.3 * t)), fbm(p + vec2(5.2, 1.3) - vec2(0.6 * t, 0.2 * t)));
        float n = fbm(p + 1.2 * q + vec2(0.4 * t, 0.0));
        float fog = smoothstep(0.15, 0.85, n);                 // wide, low-contrast ramp: haze, not edges
        // a broad soft pool of fog around the cursor
        vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
        float m = exp(-dot(d, d) / (uRadius * uRadius));
        float a = (0.35 + 0.65 * fog) * m * uStrength * uOpacity;   // always a little haze, thicker in the banks
        vec3 col = mix(uLime * 0.7, uLime, fog);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function size() {
    const r = cv.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
  }
  size(); addEventListener('resize', size);

  let over = false, visible = false, raf = 0, last = 0, tx = 0.5, ty = 0.5, mx = 0.5, my = 0.5, strength = 0, t0 = performance.now();
  function frame(now) {
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    const kf = 1 - Math.exp(-S.follow * dt);
    mx += (tx - mx) * kf; my += (ty - my) * kf;
    const goal = over ? 1 : 0, ks = 1 - Math.exp(-(over ? S.fadeIn : S.fadeOut) * dt);
    strength += (goal - strength) * ks;
    U.uTime.value = (now - t0) / 1000; U.uMouse.value.set(mx, my); U.uStrength.value = strength;
    renderer.render(scene, camera);
    raf = (visible && (over || strength > 0.003)) ? requestAnimationFrame(frame) : 0;
    if (!raf) { last = 0; if (strength <= 0.003) { strength = 0; renderer.clear(); } }
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = logo.getBoundingClientRect();
    over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (over) {
      tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height;
      if (strength < 0.02) { mx = tx; my = ty; }   // start where the cursor is, not sliding in from the last spot
      kick();
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { over = false; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(cv);

  // debug: haloSmoke.at(x, y) holds the smoke at (0..1, 0..1 from the bottom-left) of the logo; haloSmoke.off()
  window.haloSmoke = { S, at: (x, y) => { tx = mx = x; ty = my = y; over = true; strength = 1; kick(); }, off: () => { over = false; } };
}

# Crystal Hero — deploy notes

Fully static site: upload the contents of this folder to any web server or
static host (nginx, Apache, S3/CloudFront, Netlify, Vercel, GitHub Pages...).

- No build step, no server-side code, no external CDN dependencies — three.js
  is vendored under `vendor/`.
- All paths are relative, so it works at the domain root **or** in any
  subdirectory (e.g. `example.com/hero/`).
- Must be served over http(s) — ES modules don't load from `file://`.
- Optional: serve `.wasm` with `Content-Type: application/wasm` and enable
  gzip/brotli for `.js` (nice-to-have; it works without).

Entry point: `index.html`.

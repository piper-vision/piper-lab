import { defineConfig } from 'vite';

// Relative base so the built assets work when the site is deployed under a
// subpath (e.g. https://example.com/testing/threejs/controlplane-4/) rather
// than at the domain root.
export default defineConfig({
  base: './',
});

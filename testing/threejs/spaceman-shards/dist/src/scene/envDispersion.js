import * as THREE from 'three';

/**
 * Spectral dispersion for environment reflections, shared by the shards and
 * the spaceman's suit.
 *
 * Returns three's own envmap_physical_pars_fragment chunk with the radiance
 * lookup rewritten to sample once per color channel, spreading the red and
 * blue reflection vectors to either side of green (long wavelengths bend
 * further). The spread scales with a Fresnel-style grazing term, so
 * highlights stay white face-on and split into thin R/B fringes where light
 * rakes across the surface. Patching the resolved chunk (instead of
 * re-authoring it) keeps us in sync with the installed three version.
 *
 * The caller must declare `uniform float uDispersion;` and provide its
 * value via shader.uniforms.
 */
export function dispersedEnvChunk() {
  // The bare (non-PI) return line appears only inside getIBLRadiance.
  return THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
    'return envMapColor.rgb * envMapIntensity;',
    /* glsl */ `
      float dispGrazing = pow( 1.0 - saturate( dot( viewDir, normal ) ), 2.0 );
      float dispSpread = uDispersion * ( 0.3 + 0.7 * dispGrazing );
      vec3 dispNormal = inverseTransformDirection( normal, viewMatrix );
      float dispR = textureCubeUV( envMap, normalize( reflectVec + dispNormal * dispSpread ), roughness ).r;
      float dispB = textureCubeUV( envMap, normalize( reflectVec - dispNormal * dispSpread ), roughness ).b;
      return vec3( dispR, envMapColor.g, dispB ) * envMapIntensity;
    `
  );
}

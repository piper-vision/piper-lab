import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural PMREM environment — a handmade "softbox studio" so the
// MeshPhysicalMaterial slabs read as milky translucent resin on the flat
// beige background. No external HDRs; everything is emissive geometry.
// ---------------------------------------------------------------------------

export function createEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#060606');

  const panel = (color, intensity, w, h, pos, lookAtOrigin = true) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.copy(pos);
    if (lookAtOrigin) mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
    return mesh;
  };

  // Single overhead light strip — gives the dark slab tops a long soft
  // sheen gradient, like a studio product shot.
  panel('#FFFFFF', 2.2, 10, 3, new THREE.Vector3(0, 9, 2));
  // Very dim side cards so the thickness faces separate from the black.
  panel('#9A9A9A', 0.35, 8, 4, new THREE.Vector3(-7, 2, 6));
  panel('#7C7C7C', 0.25, 8, 4, new THREE.Vector3(7, 1.5, 5));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.35).texture;
  pmrem.dispose();

  envScene.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });

  return envMap;
}

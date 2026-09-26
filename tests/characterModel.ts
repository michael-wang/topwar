import * as THREE from 'three';

export function soldierModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
  const names = ['Character_Main', 'Grey', 'Black', 'Skin', 'Pants', 'DarkGrey'];
  const materials = names.map((name) => {
    const material = new THREE.MeshStandardMaterial({ color: 'white' });
    material.name = name;
    return material;
  });
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
}

export function zombieModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

export function giantModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

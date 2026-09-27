import * as THREE from 'three';

export function bodyModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: '#d8a275' });
  material.name = 'fixed-body';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function helmetModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: 'white' });
  material.name = 'armor';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function bowModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: '#4d2b14' });
  material.name = 'wood';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function arrowModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.ConeGeometry(.1, .5, 5),
    new THREE.MeshStandardMaterial({ color: '#ab6e33' }));
}

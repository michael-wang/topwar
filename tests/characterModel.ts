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
export function vestModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return helmetModel();
}
export function rifleModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: '#30353a' });
  material.name = 'rifle';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function bulletModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.ConeGeometry(.1, .5, 5),
    new THREE.MeshStandardMaterial({ color: '#f2c750' }));
}

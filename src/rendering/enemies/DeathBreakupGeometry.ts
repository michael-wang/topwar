import * as THREE from 'three';
// Presentation-only clone. Each whole triangle moves rigidly: no stretched
// vertices, fragment objects, gravity or debris. Spatial regions stay coherent.
export function deathBreakupGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute('position');
  geometry.computeBoundingBox(); const mid = (geometry.boundingBox!.min.y + geometry.boundingBox!.max.y) / 2;
  const directions = new Float32Array(position.count * 3);
  const direction = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    const x = (position.getX(i) + position.getX(i+1) + position.getX(i+2)) / 3;
    const y = (position.getY(i) + position.getY(i+1) + position.getY(i+2)) / 3;
    const z = (position.getZ(i) + position.getZ(i+1) + position.getZ(i+2)) / 3;
    const hash = (Math.imul(Math.round(x*997),73856093) ^ Math.imul(Math.round(y*991),19349663) ^ Math.imul(Math.round(z*983),83492791)) >>> 0;
    const jitter = ((hash % 101) / 100 - .5) * .08;
    direction.set((x < 0 ? -.65 : .65) + jitter, y > mid ? .55 : .12, (z < 0 ? -.40 : .40) - jitter).normalize();
    for (let vertex=0; vertex<3; vertex++) direction.toArray(directions,(i+vertex)*3);
  }
  geometry.setAttribute('deathBreakupDirection',new THREE.BufferAttribute(directions,3));
  return geometry;
}

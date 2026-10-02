import * as THREE from 'three';

// A chamfered, chipped silhouette shared by rubble, steel and distant ruins.
// Normalized bounds preserve the existing prop placement and corridor clearance.
export function paintedBlockGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-.44, -.5); shape.lineTo(.40, -.5); shape.lineTo(.5, -.39);
  shape.lineTo(.5, .32); shape.lineTo(.35, .48); shape.lineTo(-.25, .5);
  shape.lineTo(-.5, .36); shape.lineTo(-.5, -.35); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .8, bevelEnabled: true, bevelSize: .04,
    bevelThickness: .04, bevelSegments: 1, steps: 1, curveSegments: 1 });
  geometry.computeBoundingBox(); const box = geometry.boundingBox!;
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z); geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
  geometry.computeBoundingBox(); return geometry;
}

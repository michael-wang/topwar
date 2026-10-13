import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Organic padding stays curved; a straight middle gives the jacket structure.
export function paddedBarrel(rx: number, height: number, rz: number, y: number, capHeight: number,
  radialSegments = 20, waistY = y): THREE.BufferGeometry {
  const geometry = new THREE.CapsuleGeometry(1, (height - 2 * capHeight) / capHeight, 4, radialSegments, 2)
    .scale(rx, capHeight, rz).translate(0, y, 0);
  // Move the middle cylindrical ring to the clothing boundary; no added faces
  // and no diagonal shirt/trouser triangles across the padded jacket.
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - y) < .00001) p.setY(i, waistY);
  return geometry;
}

function canvasBlock(w: number, h: number, depth: number, radius: number, taper = 1): THREE.BufferGeometry {
  const x = w / 2, y = h / 2, r = radius, shape = new THREE.Shape();
  // Eight broad corners and one bevel ring. Function comes from the body/flap
  // silhouette, not high-segment spheres, buckles or texture detail.
  shape.moveTo(-x * taper + r, -y); shape.lineTo(x * taper - r, -y);
  shape.lineTo(x * taper, -y + r); shape.lineTo(x, y - r); shape.lineTo(x - r, y);
  shape.lineTo(-x + r, y); shape.lineTo(-x, y - r); shape.lineTo(-x * taper, -y + r); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * r, bevelEnabled: true,
    bevelSize: r, bevelThickness: r, bevelSegments: 1, steps: 1, curveSegments: 1 });
  // Normalize the bevel-expanded outline to the authored equipment dimensions.
  geometry.computeBoundingBox(); const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  return geometry.translate(-center.x, -center.y, -center.z).scale(w / size.x, h / size.y, depth / size.z);
}

export function canvasFieldBag(width: number, height: number, depth: number): THREE.BufferGeometry {
  const body = canvasBlock(width, height, depth, Math.min(width, height, depth) * .15, .94);
  const flap = canvasBlock(width * .95, height * .29, depth * .28, Math.min(width, height, depth) * .035)
    .translate(0, height * .24, depth * .50);
  const geometry = mergeGeometries([body, flap]); body.dispose(); flap.dispose();
  if (!geometry) throw new Error('Canvas field bag body and flap must merge');
  geometry.deleteAttribute('uv'); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

// Accepted Ink Spear: shared by both batches, head at z=0, pointed tail behind.
// This owned geometry never changes the borrowed Legacy bullet.
export function defenseTracerGeometry(): THREE.BufferGeometry {
  // Pointed head at the authoritative anchor; the entire spear trails behind it.
  // Two shoulders distinguish the short head from the longer, narrowing tail.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -.5, 0, -.22, -.34, 0, -.65, 0, 0, -1, .34, 0, -.65, .5, 0, -.22,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

// Scratch objects are retained; no per-shot objects, DOM reads or shader variants.
export class DefenseTracerTransform {
  private readonly projected = new THREE.Vector3();
  private readonly next = new THREE.Vector3();
  private readonly along = new THREE.Vector3();
  private readonly across = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();

  apply(transform: THREE.Object3D, camera: THREE.PerspectiveCamera, cssHeight: number,
    slopeX: number, tierLength: number, pulse: number, radiusBonus: number): number {
    const art = ART.defenseTracer;
    const depth = -this.projected.copy(transform.position).applyMatrix4(camera.matrixWorldInverse).z;
    const unitsPerPixel = 2 * Math.max(camera.near, depth) / (camera.projectionMatrix.elements[5] * cssHeight);
    this.projected.copy(transform.position).project(camera);
    this.next.copy(transform.position).add(this.along.set(-slopeX, 0, 1)).project(camera).sub(this.projected);
    // Correct the portrait NDC aspect before measuring projected motion.
    const dx = this.next.x * camera.aspect, dy = this.next.y;
    const magnitude = Math.hypot(dx, dy);
    const naturalLength = .52 * tierLength * magnitude * cssHeight / 2 * unitsPerPixel;
    const width = Math.max(.052 * (1 + .45 * radiusBonus), Math.min(art.maxCoreWidth, art.corePixels * unitsPerPixel));
    const length = Math.max(naturalLength, Math.min(art.maxLength, art.lengthPixels * unitsPerPixel)) * pulse;
    transform.scale.set(width, 1, length);
    // Longer camera-plane tails dip below the sand. Keep the spear at
    // muzzle height instead, solving its ground length for the same projected
    // target. Perspective along the tail is retained, including its hard cap.
    const norm = Math.hypot(slopeX, 1), inverse = camera.matrixWorldInverse.elements;
    const depthStep = inverse[2] * slopeX - inverse[10];
    const pixelsPerUnitNumerator = magnitude * cssHeight / 2 * (depth + depthStep) / norm;
    const targetPixels = length / unitsPerPixel;
    const groundLength = targetPixels * depth / Math.max(1e-8,
      pixelsPerUnitNumerator + targetPixels * depthStep / norm);
    this.along.set(-slopeX / norm, 0, 1 / norm);
    this.away.set(0, -1, 0);
    this.across.crossVectors(this.away, this.along);
    this.basis.makeBasis(this.across, this.away, this.along);
    transform.quaternion.setFromRotationMatrix(this.basis);
    // No tail through the squad on the first muzzle frame, or huge horizon beam.
    transform.scale.z = Math.min(8, Math.max(.1, transform.position.z), groundLength);
    return Math.min(art.maxOutlineWidth, art.outlinePixels * unitsPerPixel);
  }
}

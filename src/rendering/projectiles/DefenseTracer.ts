import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

export interface DefenseTracerSize {
  corePixels: number; outlinePixels: number; lengthPixels: number;
  maxCoreWidth: number; maxOutlineWidth: number; maxLength: number;
}

export interface DefenseTracerPresentation {
  /** Ownership transfers to the renderer; shared across review styles. */
  geometry: THREE.BufferGeometry;
  core: string; outline: string;
  size: DefenseTracerSize;
  coreLengthRatio: number;
}

// A tapered copy of the authored bullet, normalized with its head at z=0.
// Both batches share it. The borrowed GLB and the Legacy transforms stay untouched.
export function defenseTracerGeometry(bullet: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = bullet.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const along = (positions.getZ(i) - box.min.z) / (box.max.z - box.min.z);
    const across = (positions.getX(i) - (box.min.x + box.max.x) / 2) / (box.max.x - box.min.x);
    positions.setXYZ(i, across * (.25 + .75 * along), 0, along - 1);
  }
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
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
    slopeX: number, tierLength: number, pulse: number, radiusBonus: number,
    art: DefenseTracerSize = ART.defenseTracer, groundAligned = false): number {
    const depth = -this.projected.copy(transform.position).applyMatrix4(camera.matrixWorldInverse).z;
    const unitsPerPixel = 2 * Math.max(camera.near, depth) / (camera.projectionMatrix.elements[5] * cssHeight);
    this.projected.copy(transform.position).project(camera);
    this.next.copy(transform.position).add(this.along.set(-slopeX, 0, 1)).project(camera).sub(this.projected);
    // NDC x has a different scale from y on portrait screens. Undo that before
    // constructing camera-plane axes, so the tail follows the projected motion.
    const dx = this.next.x * camera.aspect, dy = this.next.y;
    const magnitude = Math.hypot(dx, dy);
    this.along.set(magnitude > 1e-8 ? dx / magnitude : 0, magnitude > 1e-8 ? dy / magnitude : 1, 0)
      .applyQuaternion(camera.quaternion);
    this.away.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this.across.crossVectors(this.away, this.along);
    this.basis.makeBasis(this.across, this.away, this.along);
    transform.quaternion.setFromRotationMatrix(this.basis);
    const naturalLength = .52 * tierLength * magnitude * cssHeight / 2 * unitsPerPixel;
    const width = Math.max(.052 * (1 + .45 * radiusBonus), Math.min(art.maxCoreWidth, art.corePixels * unitsPerPixel));
    const length = Math.max(naturalLength, Math.min(art.maxLength, art.lengthPixels * unitsPerPixel)) * pulse;
    transform.scale.set(width, 1, length);
    if (groundAligned) {
      // Longer camera-plane tails dip below the sand. Keep the review spear at
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
    }
    return Math.min(art.maxOutlineWidth, art.outlinePixels * unitsPerPixel);
  }
}

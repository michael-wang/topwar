import * as THREE from 'three';
import { ENEMY_DEATH_FALL_RADIANS, type enemyDeathPose } from '../../presentation/EnemyDeathTiming';

// Reused with the corpse slot. Frozen bound corners provide ground support for
// the intact role, including Giant's grip/maul; no physics or frame allocations.
export class EnemyDeathTransform {
  private readonly origin = new THREE.Vector3();
  private readonly rotation = new THREE.Euler();
  private readonly points: THREE.Vector3[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private bias = 0;
  capture(group: THREE.Group, id: number): void {
    this.origin.copy(group.position); this.rotation.copy(group.rotation);
    this.bias = (id % 2 === 0 ? -1 : 1) * .09;
    group.updateMatrixWorld(true); this.inverse.copy(group.matrixWorld).invert();
    let count = 0;
    group.traverseVisible(part => {
      if (!(part instanceof THREE.Mesh)) return;
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      const bounds = part.geometry.boundingBox!;
      this.local.multiplyMatrices(this.inverse, part.matrixWorld);
      for (let corner = 0; corner < 8; corner++) {
        const point = this.points[count] ?? (this.points[count] = new THREE.Vector3());
        point.set(corner & 1 ? bounds.max.x : bounds.min.x,
          corner & 2 ? bounds.max.y : bounds.min.y, corner & 4 ? bounds.max.z : bounds.min.z)
          .applyMatrix4(this.local); count++;
      }
    });
    this.points.length = count;
  }
  apply(group: THREE.Group, pose: ReturnType<typeof enemyDeathPose>): void {
    group.position.copy(this.origin);
    group.rotation.set(this.rotation.x * (1 - pose.fall) - ENEMY_DEATH_FALL_RADIANS * pose.fall,
      this.rotation.y, this.rotation.z * (1 - pose.fall) + this.bias * pose.fall);
    if (pose.fall === 0) return;
    group.updateMatrix();
    const e = group.matrix.elements;
    let bottom = Infinity;
    for (const point of this.points) bottom = Math.min(bottom, e[1] * point.x + e[5] * point.y + e[9] * point.z);
    group.position.y = Math.max(0, -bottom) + this.origin.y * (1 - pose.fall);
  }
}

import * as THREE from 'three';
import type { ProjectileRenderState } from '../RenderState';

export class ProjectileRenderer {
  private readonly geometry = new THREE.CylinderGeometry(0.055, 0.055, 0.32, 6);
  private readonly material = new THREE.MeshBasicMaterial({ color: '#ffcf32' });
  private readonly members: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(projectiles: readonly ProjectileRenderState[]): void {
    while (this.members.length < projectiles.length) {
      const member = new THREE.Mesh(this.geometry, this.material);
      member.rotation.x = Math.PI / 2;
      this.scene.add(member);
      this.members.push(member);
    }
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const projectile = projectiles[index];
      member.visible = projectile !== undefined;
      if (projectile) member.position.set(-projectile.x, 0.48, projectile.z);
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member);
    this.members.length = 0;
    this.geometry.dispose();
    this.material.dispose();
  }
}

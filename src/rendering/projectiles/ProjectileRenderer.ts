import * as THREE from 'three';
import type { ProjectileRenderState } from '../RenderState';

export class ProjectileRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6);
  private readonly tipGeometry = new THREE.SphereGeometry(0.085, 6, 4);
  private readonly bodyMaterial = new THREE.MeshBasicMaterial({ color: '#ff9c16' });
  private readonly tipMaterial = new THREE.MeshBasicMaterial({ color: '#fff6cf' });
  private readonly members: THREE.Group[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(projectiles: readonly ProjectileRenderState[]): void {
    while (this.members.length < projectiles.length) {
      const member = new THREE.Group();
      const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
      body.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(this.tipGeometry, this.tipMaterial);
      tip.position.z = 0.27;
      member.add(body, tip);
      this.scene.add(member);
      this.members.push(member);
    }
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const projectile = projectiles[index];
      member.visible = projectile !== undefined;
      if (projectile) member.position.set(-projectile.x, 0.58, projectile.z);
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member);
    this.members.length = 0;
    this.bodyGeometry.dispose();
    this.tipGeometry.dispose();
    this.bodyMaterial.dispose();
    this.tipMaterial.dispose();
  }
}

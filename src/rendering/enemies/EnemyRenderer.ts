import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';

export class EnemyRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: '#c93332' });
  private readonly headMaterial = new THREE.MeshStandardMaterial({ color: '#f15a4c' });
  private readonly members: THREE.Group[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(enemies: readonly EnemyRenderState[]): void {
    while (this.members.length < enemies.length) this.addMember();
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const enemy = enemies[index];
      member.visible = enemy !== undefined;
      // Match the squad's visual X flip for the camera that looks along +Z.
      if (enemy) member.position.set(-enemy.x, 0, enemy.z);
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member);
    this.members.length = 0;
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.bodyMaterial.dispose();
    this.headMaterial.dispose();
  }

  private addMember(): void {
    const member = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = 0.32;
    const head = new THREE.Mesh(this.headGeometry, this.headMaterial);
    head.position.y = 0.75;
    member.add(body, head);
    this.scene.add(member);
    this.members.push(member);
  }
}

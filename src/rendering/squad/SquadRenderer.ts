import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState } from '../RenderState';

export class SquadRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: '#1769ee' });
  private readonly headMaterial = new THREE.MeshStandardMaterial({ color: '#4b91ff' });
  private readonly members: THREE.Group[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(state: GameRenderState): void {
    const offsets = createSquadFormation(state.squad.count, state.squad.formationSpacing);
    while (this.members.length < offsets.length) this.addMember();

    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const offset = offsets[index];
      member.visible = offset !== undefined;
      if (offset) member.position.set(state.player.x + offset.x, 0, state.player.z + offset.z);
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

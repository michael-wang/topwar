import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState } from '../RenderState';

export class SquadRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(0.14, 0.21, 0.52, 8);
  private readonly headGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: '#1769ee' });
  private readonly headMaterial = new THREE.MeshStandardMaterial({ color: '#4b91ff' });
  private readonly launcherGeometry = new THREE.BoxGeometry(0.22, 0.17, 0.66);
  private readonly launcherMaterial = new THREE.MeshStandardMaterial({ color: '#173a77' });
  private readonly members: { group: THREE.Group; launcher: THREE.Mesh }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(state: GameRenderState): void {
    const offsets = createSquadFormation(state.squad.count, state.squad.formationSpacing);
    while (this.members.length < offsets.length) this.addMember();

    for (let index = 0; index < this.members.length; index++) {
      const { group, launcher } = this.members[index];
      const offset = offsets[index];
      group.visible = offset !== undefined;
      launcher.visible = index >= state.squad.count - state.squad.rocketCount;
      // The camera looks along +Z, which mirrors X on screen. Flip visual X so drag right reads right.
      if (offset) group.position.set(-(state.player.x + offset.x), 0, state.player.z + offset.z);
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member.group);
    this.members.length = 0;
    this.bodyGeometry.dispose();
    this.headGeometry.dispose();
    this.launcherGeometry.dispose();
    this.bodyMaterial.dispose();
    this.headMaterial.dispose();
    this.launcherMaterial.dispose();
  }

  private addMember(): void {
    const member = new THREE.Group();
    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = 0.32;
    const head = new THREE.Mesh(this.headGeometry, this.headMaterial);
    head.position.y = 0.75;
    const launcher = new THREE.Mesh(this.launcherGeometry, this.launcherMaterial);
    launcher.position.set(-0.22, 0.56, 0.1);
    launcher.visible = false;
    member.add(body, head, launcher);
    this.scene.add(member);
    this.members.push({ group: member, launcher });
  }
}

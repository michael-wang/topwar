import * as THREE from 'three';
import type { PlayerVisualFamily } from '../CharacterVisualFamilies';
import { PLAYER_PALETTE } from '../tierPalettes';

// Borrow the accepted soldier resources. These two guards never enter squad,
// shadow/combat pools, Simulation, or checkpoint state. Side facades hide retreat.
export class DioramaSentries {
  readonly group = new THREE.Group();
  private readonly gear: THREE.MeshStandardMaterial;
  constructor(scene: THREE.Scene, family: PlayerVisualFamily) {
    this.gear = (family.helmet.material as THREE.MeshStandardMaterial).clone();
    this.gear.color.set(PLAYER_PALETTE[0].body);
    family.presentation.prepareMaterial(this.gear, 'gear');
    this.group.name = 'diorama-side-sentries';
    for (let i = 0; i < 2; i++) {
      const guard = new THREE.Group();
      guard.name = `side-sentry-${i}`;
      for (const model of [family.body, family.helmet, family.vest, family.weapon]) {
        const part = new THREE.Mesh(model.geometry,
          model === family.helmet || model === family.vest ? this.gear : model.material);
        if (model === family.weapon) {
          part.position.fromArray(family.presentation.weaponPosition);
          part.rotation.fromArray([...family.presentation.weaponRotation ?? [0, 0, 0]]);
        }
        guard.add(part);
      }
      guard.scale.setScalar(family.presentation.rootScale);
      this.group.add(guard);
    }
    this.group.visible = false;
    scene.add(this.group);
  }
  update(halfWidth: number, retreat: number): void {
    this.group.visible = retreat < 1;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      // Idle-only side-edge guards move away into the existing village facades.
      // They have no combat identity; real squad placement is untouched.
      const x = halfWidth - (i === 0 ? .4 : .6);
      this.group.children[i].position.set(side * THREE.MathUtils.lerp(x, halfWidth + 3, retreat), 0,
        THREE.MathUtils.lerp(i === 0 ? 7 : 5.5, i === 0 ? 17.7 : 15.2, retreat));
    }
  }
  dispose(): void { this.group.removeFromParent(); this.gear.dispose(); }
}

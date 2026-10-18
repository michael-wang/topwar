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
      // Stay outside physical lanes; move behind the inner facade then disappear.
      this.group.children[i].position.set(side * (halfWidth + .5 + retreat * 2.5), 0,
        (i === 0 ? 16.5 : 14) + retreat * 1.2);
    }
  }
  dispose(): void { this.group.removeFromParent(); this.gear.dispose(); }
}

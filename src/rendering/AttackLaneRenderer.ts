import { ART } from '../art/ArtDirection';
import { paintDaubTexture } from './art/PaintedTextures';
import * as THREE from 'three';

// Current coastal sand scuffs; lane positions come from simulation config.
export class AttackLaneRenderer {
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly beachDetails = new THREE.Group();
  private readonly trackMaterial = new THREE.MeshBasicMaterial({ color: ART.coastalDefense.sandShade, transparent: true,
    opacity: .16, depthWrite: false });
  private layoutKey = '';
  private readonly daub = paintDaubTexture();

  constructor(private readonly scene: THREE.Scene) {
    this.trackMaterial.map = this.daub;
    this.geometry.rotateX(-Math.PI / 2);
    this.beachDetails.name = 'beach-corridor-openings';
    this.scene.add(this.beachDetails);
  }

  update(positions: readonly number[] | undefined, playerZ: number): void {
    this.beachDetails.position.z = playerZ;
    if (positions) {
      const key = positions.join(',');
      if (key !== this.layoutKey) {
        this.layoutKey = key;
        this.beachDetails.clear();
        const spacing = positions[1] - positions[0];
        // A civilian beach: only restrained sand scuffs, no prepared defenses.
        positions.forEach((x, lane) => {
          for (let patch = 0; patch < 9; patch++) {
            const scuff = new THREE.Mesh(this.geometry, this.trackMaterial);
            scuff.name = 'sand-scuff';
            scuff.position.set(-x + Math.sin(patch * 2 + lane) * spacing * .12, .026, 3 + patch * 5);
            scuff.scale.set(spacing * (.40 + .1 * (patch % 3)), 1, 2.2 + patch % 2);
            scuff.rotation.y = Math.sin(patch + lane) * .15;
            this.beachDetails.add(scuff);
          }
        });
      }
    }
  }

  dispose(): void {
    this.scene.remove(this.beachDetails);
    this.trackMaterial.dispose();
    this.daub.dispose();
    this.geometry.dispose();
  }
}

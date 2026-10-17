import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';

// Static distant decoration, never a gameplay naval unit or activity scheduler.
export const DISTANT_FLEET_LAYOUT = [
  { x: 19, z: 132, scale: .75 }, { x: 1.5, z: 145, scale: .85 }, { x: -18, z: 138, scale: .7 },
] as const;

export class DioramaFleet {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  constructor() {
    const block = new THREE.BoxGeometry(1, 1, 1), transform = new THREE.Object3D();
    const pieces: THREE.BufferGeometry[] = [];
    for (const ship of DISTANT_FLEET_LAYOUT) {
      // Long low hull, stepped bridge and a small mast, without active guns/FX.
      for (const [x, y, width, height, depth] of [
        [0, .25, 5.8, .5, 1.1], [.1, .65, 3.7, .3, .9],
        [-.4, 1, 1.5, .45, .7], [-.45, 1.6, .1, .9, .1],
        [-.45, 1.85, .8, .08, .1],
      ]) {
        transform.position.set(ship.x + x * ship.scale, y * ship.scale, ship.z);
        transform.scale.set(width * ship.scale, height * ship.scale, depth * ship.scale);
        transform.updateMatrix(); pieces.push(block.clone().applyMatrix4(transform.matrix));
      }
    }
    const geometry = mergeGeometries(pieces)!;
    pieces.forEach(piece => piece.dispose()); block.dispose();
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: ART.coastalDefense.shadow, transparent: true, opacity: .38,
      depthWrite: false, fog: false, toneMapped: false,
    }));
    this.mesh.name = 'diorama-distant-fleet'; this.mesh.visible = false;
  }
  update(playerZ: number, diorama: boolean): void { this.mesh.position.z = playerZ; this.mesh.visible = diorama; }
  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

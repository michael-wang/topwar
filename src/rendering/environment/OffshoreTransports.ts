import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

// Authored background actors, with no simulation collision or random allocation.
export class OffshoreTransports {
  readonly group = new THREE.Group();
  private readonly geometry = paintedBlockGeometry();
  private readonly hull = illustratedMaterial(new THREE.MeshStandardMaterial({ color: ART.world.steel, roughness: 1 }));
  private readonly deck = illustratedMaterial(new THREE.MeshStandardMaterial({ color: ART.world.midAccent, roughness: 1 }));
  private readonly hold = new THREE.MeshStandardMaterial({ color: ART.world.near, roughness: 1 });
  private readonly wake = new THREE.MeshBasicMaterial({ color: ART.world.foam, transparent: true, opacity: .16, depthWrite: false });
  private readonly baked: THREE.BufferGeometry[] = [];
  private readonly ships: THREE.Group[] = [];
  private readonly craft = new THREE.Group();
  constructor() {
    this.group.name = 'offshore-troop-transports';
    const part = (parent: THREE.Group, name: string, x: number, y: number, z: number,
      width: number, height: number, depth: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(this.geometry, material); mesh.name = name;
      mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); parent.add(mesh); return mesh;
    };
    for (const [i, x, z, scale, angle] of [[0,-5,67,.8,.16],[1,11,82,.7,-.22],[2,-12,94,.75,.34]]) {
      const ship = new THREE.Group(); ship.name = `troop-carrier-${i}`;
      part(ship, 'long-low-transport-hull', 0, .65, 0, 16, 1.8, 4.2, this.hull);
      part(ship, 'open-troop-deck', 0, 1.7, 0, 13.6, .55, 3.8, this.deck);
      part(ship, 'rear-bridge', -4.6, 3.1, 0, 3.2, 2.4, 3.1, this.deck);
      part(ship, 'bridge-windows', -4.6, 3.5, -1.6, 2.6, .45, .08, this.hold);
      part(ship, 'exhaust-stack', -5, 4.65, .3, .75, 1.4, .85, this.hull);
      for (let bay = 0; bay < 3; bay++) {
        part(ship, 'troop-hold', -.6 + bay * 2.7, 2.15, 0, 2, .65, 2.6, this.hull);
        part(ship, 'lifeboat', -1 + bay * 3, 2.1, -2, 1.65, .4, .5, this.deck);
      }
      const bow = part(ship, 'tapered-bow', 8, .7, 0, 2.7, 1.6, 3, this.hull); bow.rotation.y = .2;
      part(ship, 'faint-wake', 0, -.12, 0, 19, .025, 5.5, this.wake);
      ship.position.set(x, -.2, z); ship.scale.setScalar(scale); ship.rotation.y = angle;
      // Merge static parts per material once; each transport remains a cheap bobbing actor.
      for (const material of [this.hull, this.deck, this.hold, this.wake]) {
        const parts = ship.children.filter(child => child instanceof THREE.Mesh && child.material === material) as THREE.Mesh[];
        const copies = parts.map(mesh => { mesh.updateMatrix(); return this.geometry.clone().applyMatrix4(mesh.matrix); });
        const geometry = mergeGeometries(copies)!; copies.forEach(copy => copy.dispose());
        this.baked.push(geometry); parts.forEach(mesh => ship.remove(mesh));
        ship.add(new THREE.Mesh(geometry, material));
      }
      this.ships.push(ship); this.group.add(ship);
    }
    part(this.craft, 'landing-craft-hull', 0, .3, 0, 3.4, .7, 5.2, this.hull);
    part(this.craft, 'open-troop-well', 0, .7, 0, 2.5, .15, 3.4, this.hold);
    for (const side of [-1, 1]) part(this.craft, 'raised-side', side * 1.5, .9, 0, .3, .8, 5, this.deck);
    part(this.craft, 'bow-ramp', 0, .7, -2.5, 3.1, 1, .25, this.deck);
    part(this.craft, 'pilot-house', 0, 1.3, 1.8, 1.2, 1.3, 1.1, this.deck);
    part(this.craft, 'craft-wake', 0, -.13, .8, 4.5, .025, 6.5, this.wake);
    this.craft.position.set(7, -.15, 61); this.craft.rotation.y = -.2;
    this.group.add(this.craft);
  }
  update(playerZ: number, nowMs: number, defense: boolean, assaultAgeSeconds?: number): void {
    this.group.visible = defense; this.group.position.z = playerZ;
    this.ships.forEach((ship, index) => {
      ship.position.y = -.2 + Math.sin(nowMs * .00035 + index * 2.3) * .07;
      ship.rotation.z = Math.sin(nowMs * .00022 + index) * .004;
    });
    // The first landing force is telegraphed by a slow shoreward approach and opening ramp.
    const arrival = assaultAgeSeconds === undefined ? 0 : Math.min(1, Math.max(0, (assaultAgeSeconds + 4) / 8));
    this.craft.position.z = 61 - arrival * 8;
    this.craft.position.y = -.15 + Math.sin(nowMs * .0006) * .045;
    const ramp = this.craft.children.find(child => child.name === 'bow-ramp')!;
    ramp.rotation.x = arrival * -.8;
  }
  dispose(): void {
    this.baked.forEach(geometry => geometry.dispose());
    this.geometry.dispose(); this.hull.dispose(); this.deck.dispose(); this.hold.dispose(); this.wake.dispose();
  }
}

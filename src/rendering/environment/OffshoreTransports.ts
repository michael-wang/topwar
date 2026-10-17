import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

export const NAVAL_PALETTE = {
  hull: ART.enemyArmory.vehicle, upper: ART.enemyArmory.armor,
  well: ART.enemyArmory.iron, accent: ART.enemyArmory.steel,
} as const;

// Camera B mirrors world X: these loosely support screen lanes 1, 3 and 5.
export const LANDING_CRAFT_LAYOUT = [
  { lane: 1, x: 8.6, z: 76, heading: -.16 },
  { lane: 3, x: -.45, z: 71, heading: .08 },
  { lane: 5, x: -9.2, z: 80, heading: .20 },
] as const;

// Near-shore bows link the idle beachhead to its transports. Combat keeps the
// offshore layout above so the actual arriving Destroyer retains its silhouette.
export const DIORAMA_LANDING_CRAFT_LAYOUT = [
  { x: 6.8, z: 54 }, { x: -.45, z: 51 }, { x: -7.2, z: 56 },
] as const;

function paintedHull(): THREE.BufferGeometry {
  const geometry = paintedBlockGeometry(), positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3), color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 3) {
    const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    color.set(y > .32 ? NAVAL_PALETTE.accent : NAVAL_PALETTE.hull);
    for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geometry;
}

// Decorative landing craft only: no weapons, gameplay collision or random state.
export class OffshoreTransports {
  readonly group = new THREE.Group();
  private readonly geometry = paintedBlockGeometry();
  private readonly hullGeometry = paintedHull();
  private readonly hull = illustratedMaterial(new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, roughness: 1 }));
  private readonly deck = illustratedMaterial(new THREE.MeshStandardMaterial({ color: NAVAL_PALETTE.upper, roughness: 1 }));
  private readonly hold = new THREE.MeshStandardMaterial({ color: NAVAL_PALETTE.well, roughness: 1 });
  private readonly steel = illustratedMaterial(new THREE.MeshStandardMaterial({ color: NAVAL_PALETTE.accent, roughness: 1 }));
  private readonly wake = new THREE.MeshBasicMaterial({ color: ART.coastalDefense.foam, transparent: true, opacity: .16, depthWrite: false });
  private readonly baked: THREE.BufferGeometry[] = [];
  private readonly ships: THREE.Group[] = [];
  constructor() {
    this.group.name = 'offshore-troop-transports';
    const prototype = new THREE.Group();
    const part = (x: number, y: number, z: number, width: number, height: number,
      depth: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(material === this.hull ? this.hullGeometry : this.geometry, material);
      mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); prototype.add(mesh);
    };
    part(0, .45, 0, 4.1, .9, 7.2, this.hull);
    part(0, .94, -.3, 3.25, .14, 4.8, this.hold);
    for (const side of [-1, 1]) {
      part(side * 1.85, 1.1, 0, .34, 1.15, 6.8, this.deck);
      part(side * 1.3, 1.05, -.3, .28, .3, 3.8, this.steel);
      part(side * 2.04, .65, 1, .14, .25, 2.0, this.hold);
      part(side * 1.64, .82, -3.55, .16, 1.3, .16, this.hold);
    }
    part(0, 1.1, 3.2, 3.8, .95, .3, this.deck);
    // Broad flat bow ramp and open troop well, with a low stern pilot cabin.
    part(0, .86, -3.45, 3.55, 1.3, .24, this.steel);
    part(-.95, 1.75, 2.45, 1.45, 1.5, 1.4, this.deck);
    part(-.95, 2.54, 2.45, 1.65, .12, 1.6, this.steel);
    part(-.95, 2.05, 1.72, 1.0, .25, .08, this.hold);
    part(0, -.12, .7, 4.9, .025, 8.2, this.wake);
    // Five shared geometry/material batches, reused by all three craft.
    for (const [name, material] of [['hull', this.hull], ['armor', this.deck],
      ['well', this.hold], ['ramp', this.steel], ['wake', this.wake]] as const) {
      const parts = prototype.children.filter(child => child instanceof THREE.Mesh && child.material === material) as THREE.Mesh[];
      const copies = parts.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const geometry = mergeGeometries(copies)!; copies.forEach(copy => copy.dispose());
      this.baked.push(geometry);
      for (let i = 0; i < LANDING_CRAFT_LAYOUT.length; i++) {
        const layout = LANDING_CRAFT_LAYOUT[i];
        const ship = this.ships[i] ?? new THREE.Group();
        if (!this.ships[i]) {
          ship.name = 'enemy-landing-craft-' + layout.lane; ship.userData.supportedLane = layout.lane;
          ship.position.set(layout.x, -.15, layout.z); ship.rotation.y = layout.heading;
          this.ships.push(ship); this.group.add(ship);
        }
        const mesh = new THREE.Mesh(geometry, material); mesh.name = 'landing-craft-' + name; ship.add(mesh);
      }
    }
  }
  update(playerZ: number, nowMs: number, defense: boolean, diorama = false): void {
    this.group.visible = defense; this.group.position.z = playerZ;
    for (let i = 0; i < this.ships.length; i++) {
      const ship = this.ships[i];
      const layout = diorama ? DIORAMA_LANDING_CRAFT_LAYOUT[i] : LANDING_CRAFT_LAYOUT[i];
      ship.position.x = layout.x; ship.position.z = layout.z;
      ship.position.y = -.15 + Math.sin(nowMs * .00035 + i * 2.3) * .045;
      ship.rotation.z = Math.sin(nowMs * .00022 + i) * .004;
    }
  }
  dispose(): void {
    this.baked.forEach(geometry => geometry.dispose());
    this.geometry.dispose(); this.hullGeometry.dispose();
    this.hull.dispose(); this.deck.dispose(); this.hold.dispose(); this.steel.dispose(); this.wake.dispose();
  }
}

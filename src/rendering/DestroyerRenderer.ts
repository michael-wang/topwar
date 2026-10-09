import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedBlockGeometry } from './art/PaintedGeometry';
import { illustratedMaterial } from './art/IllustratedMaterial';
import { DESTROYER_MUZZLE, destroyerPose } from '../simulation/destroyer';
import type { GameRenderState } from './RenderState';

export class DestroyerRenderer {
  readonly group = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private readonly block = paintedBlockGeometry();
  private readonly hull = illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#253d55', roughness: .85 }));
  private readonly ivory = illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#ebe4ce', roughness: .85 }));
  private readonly ink = new THREE.MeshStandardMaterial({ color: '#152635', roughness: .75 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: '#dbaa4e', roughness: .65 });
  private readonly wakeMaterial = new THREE.MeshBasicMaterial({ color: '#e3f6ee', transparent: true, opacity: .22, depthWrite: false });
  private readonly wake = new THREE.Mesh(new THREE.PlaneGeometry(24, 5.8), this.wakeMaterial);
  private readonly geometries: THREE.BufferGeometry[] = [];
  constructor(private readonly scene: THREE.Scene) {
    this.group.name = 'enemy-destroyer'; this.group.scale.x = -1; this.muzzle.name = 'destroyer-muzzle';
    const part = (name: string, xyz: number[], scale: number[], material: THREE.Material) => {
      const mesh = new THREE.Mesh(this.block, material); mesh.name = name;
      mesh.position.set(...xyz as [number, number, number]); mesh.scale.set(...scale as [number, number, number]);
      this.group.add(mesh); return mesh;
    };
    part('navy-hull', [0, .65, 0], [17, 1.65, 3.8], this.hull);
    const bow = part('angular-forward-bow', [8.7, .75, 0], [3.2, 1.55, 2.5], this.hull); bow.rotation.y = -.25;
    part('ivory-deck-edge', [0, 1.5, 0], [16.4, .22, 3.65], this.ivory);
    part('rear-superstructure', [-4.5, 2.55, .1], [4.6, 2, 3.15], this.hull);
    part('bridge-cap', [-4.2, 3.6, -.1], [3.8, .55, 2.9], this.ivory);
    part('bridge-windows', [-4.2, 3.1, -1.55], [3.4, .52, .16], this.ink);
    part('funnel', [-6, 3.9, .3], [1.3, 1.6, 1.4], this.ink);
    part('mast', [-3.2, 5.15, .6], [.22, 3.1, .22], this.ink);
    part('radar', [-3, 6.5, .6], [2.5, .7, .25], this.ivory);
    part('radar-accent', [-2, 6.5, .4], [.4, .7, .12], this.gold);
    part('main-turret', [4, 1.95, -.5], [3, 1.2, 2.5], this.hull);
    part('turret-enamel', [4, 2.53, -.5], [2.6, .18, 2.2], this.ivory);
    const base = new THREE.Vector3(4, 2, -1.2), end = new THREE.Vector3(DESTROYER_MUZZLE.x, DESTROYER_MUZZLE.y, DESTROYER_MUZZLE.z);
    const direction = end.clone().sub(base), barrelGeometry = new THREE.CylinderGeometry(.22, .3, direction.length(), 8).toNonIndexed();
    this.geometries.push(barrelGeometry);
    const barrel = new THREE.Mesh(barrelGeometry, this.ink); barrel.position.copy(base).add(end).multiplyScalar(.5);
    barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); this.group.add(barrel);
    this.muzzle.position.copy(end); this.group.add(this.muzzle);
    // Bake the static ship to four material batches, rather than per-detail draw calls.
    for (const material of [this.hull, this.ivory, this.ink, this.gold]) {
      const parts = this.group.children.filter(o => o instanceof THREE.Mesh && o.material === material) as THREE.Mesh[];
      const copies = parts.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
      const geometry = mergeGeometries(copies)!; copies.forEach(g => g.dispose()); this.geometries.push(geometry);
      parts.forEach(m => this.group.remove(m)); this.group.add(new THREE.Mesh(geometry, material));
    }
    this.wake.rotation.x = -Math.PI / 2; this.wake.position.y = .005; this.group.add(this.wake);
    this.scene.add(this.group); this.group.visible = false;
  }
  update(frame: GameRenderState['destroyer']): void {
    this.group.visible = frame?.state.status === 'active'; if (!frame || !this.group.visible) return;
    const age = frame.elapsedSeconds - frame.state.startedAtSeconds!, p = destroyerPose(age, frame.config);
    this.group.position.set(-p.x, p.y, p.z);
    this.wake.position.y = .025 - p.y; this.wake.scale.set(1 + Math.sin(age * 2) * .025, 1 + Math.sin(age) * .04, 1);
    const identifying = age >= frame.config.radioAtSeconds && age < frame.config.radioAtSeconds + frame.config.radioDurationSeconds;
    this.hull.emissive.set(identifying ? '#5b4924' : '#000000'); this.hull.emissiveIntensity = identifying ? .12 + .07 * Math.sin(age * 4) ** 2 : 0;
  }
  reset(): void { this.group.visible = false; }
  dispose(): void { this.scene.remove(this.group); this.block.dispose(); this.wake.geometry.dispose();
    this.geometries.forEach(g => g.dispose()); [this.hull, this.ivory, this.ink, this.gold, this.wakeMaterial].forEach(m => m.dispose()); }
}

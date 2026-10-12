import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedBlockGeometry } from './art/PaintedGeometry';
import { illustratedMaterial } from './art/IllustratedMaterial';
import { GrenadeExplosion } from './GrenadeExplosion';
import type { GameRenderState } from './RenderState';

export const TANK_DEATH_MS = 3200;
export const TANK_EXPLOSION_TIMES_MS = [0, 350, 700, 1050, 1400, 1800, 2200] as const;

// One vehicle, merged armor and bounded moving track/smoke batches.
export class DefenseTankRenderer {
  readonly group = new THREE.Group();
  private readonly landing = new THREE.Group();
  private readonly turret = new THREE.Group();
  private readonly block = paintedBlockGeometry();
  private readonly wheelGeometry = new THREE.CylinderGeometry(.47, .47, .25, 10);
  private readonly barrelGeometry = new THREE.CylinderGeometry(.13, .22, 2.7, 10);
  private readonly smokeGeometry = new THREE.SphereGeometry(1, 8, 6);
  private readonly armor = illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#687049', roughness: .85 }));
  private readonly steel = illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#b4b295', roughness: .7 }));
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#202a24', roughness: .85 });
  private readonly damage = new THREE.MeshBasicMaterial({ color: '#2e241e' });
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({ color: '#454137', transparent: true, opacity: .3, depthWrite: false });
  private readonly tracks = new THREE.InstancedMesh(this.block, this.dark, 64);
  private readonly wheels = new THREE.InstancedMesh(this.wheelGeometry, this.steel, 12);
  private readonly smoke = new THREE.InstancedMesh(this.smokeGeometry, this.smokeMaterial, 8);
  private readonly scars = new THREE.InstancedMesh(this.block, this.damage, 6);
  private readonly ramp: THREE.Mesh;
  private readonly leftDoor: THREE.Mesh;
  private readonly rightDoor: THREE.Mesh;
  private readonly transform = new THREE.Object3D();
  private readonly explosions: GrenadeExplosion;
  private readonly merged: THREE.BufferGeometry[] = [];
  private deathAtMs = -Infinity;
  private lastBurst = -1;
  private defeated = false;

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = 'defense-tank'; this.turret.name = 'defense-tank-turret';
    this.landing.name = 'tank-landing-ramp'; this.tracks.name = 'tank-tracks';
    const part = (root: THREE.Group, xyz: number[], size: number[], material: THREE.Material) => {
      const mesh = new THREE.Mesh(this.block, material);
      mesh.position.set(...xyz as [number, number, number]); mesh.scale.set(...size as [number, number, number]);
      root.add(mesh); return mesh;
    };
    part(this.group, [0, .92, 0], [3.6, 1.15, 4.7], this.armor);
    part(this.group, [0, 1.48, -.65], [3.45, .55, 3.4], this.armor).rotation.x = -.12;
    part(this.group, [0, 1.16, -2.3], [3.5, .35, .3], this.steel);
    part(this.group, [0, 1.57, 1.65], [2.5, .12, 1], this.dark);
    for (const x of [-1.35, 1.35]) {
      part(this.group, [x, 1.85, 1.95], [.24, .65, .3], this.dark);
      part(this.group, [x, 1.5, -2.05], [.32, .18, .14], this.steel);
    }
    part(this.turret, [0, .18, 0], [2.5, .72, 2.3], this.armor);
    part(this.turret, [0, .55, .12], [2.1, .28, 1.9], this.steel);
    part(this.turret, [0, .83, .55], [.9, .22, .8], this.dark);
    part(this.turret, [0, .16, -1.1], [.65, .6, .6], this.steel);
    const barrel = new THREE.Mesh(this.barrelGeometry, this.dark); barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, .28, -2.25); this.turret.add(barrel);
    this.turret.position.y = 1.85;
    for (const root of [this.group, this.turret]) for (const material of [this.armor, this.steel, this.dark]) {
      const parts = root.children.filter(o => o instanceof THREE.Mesh && o.geometry === this.block && o.material === material) as THREE.Mesh[];
      if (!parts.length) continue;
      const copies = parts.map(p => { p.updateMatrix(); return p.geometry.clone().applyMatrix4(p.matrix); });
      const geometry = mergeGeometries(copies)!; copies.forEach(g => g.dispose()); this.merged.push(geometry);
      parts.forEach(p => root.remove(p)); root.add(new THREE.Mesh(geometry, material));
    }
    this.group.add(this.turret, this.tracks, this.wheels, this.smoke, this.scars);
    for (const batch of [this.tracks, this.wheels, this.smoke, this.scars]) {
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.frustumCulled = false;
    }
    for (let i = 0; i < 12; i++) {
      this.transform.position.set(i < 6 ? -1.8 : 1.8, .6, -2 + (i % 6) * .8);
      this.transform.rotation.set(0, 0, Math.PI / 2); this.transform.scale.setScalar(1); this.transform.updateMatrix();
      this.wheels.setMatrixAt(i, this.transform.matrix);
    }
    for (let i = 0; i < 6; i++) {
      this.transform.position.set((i % 3 - 1) * .95, 1.78, -.9 + Math.floor(i / 3) * 2);
      this.transform.rotation.set(0, i * .71, 0); this.transform.scale.set(.48, .025, .35); this.transform.updateMatrix();
      this.scars.setMatrixAt(i, this.transform.matrix);
    }
    this.ramp = part(this.landing, [0, .7, 47], [4.5, .18, 14], this.dark);
    this.ramp.rotation.x = -.1;
    this.leftDoor = part(this.landing, [-1.15, 2, 54], [2.2, 2.4, .18], this.armor);
    this.rightDoor = part(this.landing, [1.15, 2, 54], [2.2, 2.4, .18], this.armor);
    this.explosions = new GrenadeExplosion(scene, 4, false);
    scene.add(this.group, this.landing); this.reset();
  }
  update(frame: GameRenderState['defenseTank'], nowMs: number): void {
    this.group.visible = !!frame; this.landing.visible = !!frame;
    if (!frame) { this.explosions.update(nowMs, 0); return; }
    const s = frame.state, c = frame.config, entry = Math.min(1, Math.max(0, (frame.elapsedSeconds - s.startedAtSeconds) / c.entrySeconds));
    this.leftDoor.position.x = -1.15 - Math.min(1, entry * 4) * 2.1;
    this.rightDoor.position.x = 1.15 + Math.min(1, entry * 4) * 2.1;
    this.ramp.position.z = (c.startZ + c.battleZ) / 2; this.ramp.scale.z = c.startZ - c.battleZ;
    this.leftDoor.position.z = this.rightDoor.position.z = c.startZ;
    this.group.position.set(0, s.status === 'entering' ? (1 - entry) * 1.25 : 0, s.z);
    this.group.scale.set(c.halfWidth / 2.1, 1, c.halfDepth / 2.7);
    const speed = c.phases[s.phase - 1].speedUnitsPerSecond, age = frame.elapsedSeconds - s.startedAtSeconds;
    const hitAge = frame.elapsedSeconds - (s.lastHitAtSeconds ?? -Infinity);
    this.armor.emissive.set(hitAge < .09 ? '#d9813a' : '#000000'); this.armor.emissiveIntensity = hitAge < .09 ? .5 : 0;
    this.armor.color.set(s.phase === 1 ? '#687049' : s.phase === 2 ? '#575a3c' : '#484834');
    this.scars.visible = s.phase > 1;
    this.turret.position.z = 0;
    this.turret.rotation.x = Math.sin(age * (s.phase === 3 ? 25 : 12)) * (s.phase === 3 ? .018 : .004);
    for (let i = 0; i < 64; i++) {
      const t = ((i % 32) / 32 + age * (s.status === 'entering' ? .65 : speed * 1.5)) % 1;
      // Rectangle perimeter: top/bottom links move in opposite directions.
      let z: number, y: number, angle = 0;
      if (t < .4) { z = -2.4 + t / .4 * 4.8; y = 1.08; }
      else if (t < .5) { z = 2.4; y = 1.08 - (t - .4) / .1 * .9; angle = Math.PI / 2; }
      else if (t < .9) { z = 2.4 - (t - .5) / .4 * 4.8; y = .18; }
      else { z = -2.4; y = .18 + (t - .9) / .1 * .9; angle = Math.PI / 2; }
      this.transform.position.set(i < 32 ? -1.8 : 1.8, y, z);
      this.transform.rotation.set(angle, 0, 0); this.transform.scale.set(.7, .13, .29); this.transform.updateMatrix();
      this.tracks.setMatrixAt(i, this.transform.matrix);
    }
    this.tracks.instanceMatrix.needsUpdate = true;
    this.smoke.visible = s.status === 'active' || s.status === 'defeated';
    for (let i = 0; i < 8; i++) {
      const t = (age * (s.phase === 3 ? 1.4 : .6) + i / 4) % 2;
      this.transform.position.set(i % 2 ? -1.35 : 1.35, 2 + t * .8, 2 + t * .6);
      this.transform.rotation.set(0, i, 0); this.transform.scale.setScalar((.12 + t * .2) * (s.phase === 3 ? 1.6 : 1));
      this.transform.updateMatrix(); this.smoke.setMatrixAt(i, this.transform.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    if (s.status === 'defeated') {
      if (!this.defeated) { this.defeated = true; this.deathAtMs = nowMs; }
      const deathAge = nowMs - this.deathAtMs;
      for (let i = this.lastBurst + 1; i < TANK_EXPLOSION_TIMES_MS.length && deathAge >= TANK_EXPLOSION_TIMES_MS[i]; i++) {
        const final = i === TANK_EXPLOSION_TIMES_MS.length - 1;
        this.explosions.present(final ? 0 : (i % 3 - 1) * 1.1, s.z + (i % 2 ? 1 : -1), final ? 7 : 3.2,
          this.deathAtMs + TANK_EXPLOSION_TIMES_MS[i]); this.lastBurst = i;
      }
      this.group.rotation.z = Math.min(.09, deathAge / TANK_DEATH_MS * .09);
      this.turret.rotation.x = -Math.min(.3, deathAge / TANK_DEATH_MS * .3);
      this.group.position.y = -Math.min(.22, deathAge / TANK_DEATH_MS * .22);
      this.armor.color.set('#292c27'); // Keep an armored wreck after the final explosion.
    }
    this.explosions.update(nowMs, 0);
  }
  recoil(atSeconds: number, nowSeconds: number): void {
    const age = nowSeconds - atSeconds;
    if (age >= 0 && age < .25) this.turret.position.z = .4 * Math.sin(age / .25 * Math.PI);
  }
  restore(frame: GameRenderState['defenseTank'], nowMs: number): void {
    this.reset();
    if (frame?.state.status === 'defeated') { this.defeated = true; this.deathAtMs = nowMs - TANK_DEATH_MS; this.lastBurst = TANK_EXPLOSION_TIMES_MS.length - 1; }
  }
  reset(): void { this.group.visible = this.landing.visible = false; this.group.rotation.set(0, 0, 0);
    this.deathAtMs = -Infinity; this.lastBurst = -1; this.defeated = false; this.explosions.reset(); }
  dispose(): void {
    this.scene.remove(this.group, this.landing); this.explosions.dispose();
    for (const batch of [this.tracks, this.wheels, this.smoke, this.scars]) batch.dispose();
    for (const g of [this.block, this.wheelGeometry, this.barrelGeometry, this.smokeGeometry, ...this.merged]) g.dispose();
    for (const m of [this.armor, this.steel, this.dark, this.damage, this.smokeMaterial]) m.dispose();
  }
}

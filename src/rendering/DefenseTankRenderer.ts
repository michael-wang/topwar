import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintedBlockGeometry } from './art/PaintedGeometry';
import { illustratedMaterial } from './art/IllustratedMaterial';
import { ART } from '../art/ArtDirection';
import { GrenadeExplosion } from './GrenadeExplosion';
import type { GameRenderState } from './RenderState';
import { TANK_ENTRANCE_CLEAR_FRACTION, type TankEntranceEvent } from '../simulation/defenseTank';
import type { GrenadeEvent } from '../simulation/grenade';
import { CannonMuzzleFeedback } from './CannonMuzzleFeedback';

export const TANK_DEATH_MS = 3200;
export const TANK_EXPLOSION_TIMES_MS = [0, 350, 700, 1050, 1400, 1800, 2200] as const;

// One vehicle, merged armor and bounded moving track/smoke batches.
export class DefenseTankRenderer {
  readonly group = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private readonly cannon: CannonMuzzleFeedback;
  private readonly landing = new THREE.Group();
  private readonly turret = new THREE.Group();
  private readonly block = paintedBlockGeometry();
  private readonly wheelGeometry = new THREE.CylinderGeometry(.47, .47, .25, 10);
  private readonly barrelGeometry = new THREE.CylinderGeometry(.22, .32, 2.7, 10);
  private readonly smokeGeometry = new THREE.SphereGeometry(1, 8, 6);
  private readonly flameGeometry = new THREE.ConeGeometry(.3, 1, 7);
  private readonly flameMaterial = new THREE.MeshBasicMaterial({ color: '#ff5f19', transparent: true,
    opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly flameCoreMaterial = new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true,
    opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly armor = illustratedMaterial(new THREE.MeshStandardMaterial({ color: ART.enemyArmory.vehicle, roughness: .85 }));
  private readonly steel = illustratedMaterial(new THREE.MeshStandardMaterial({ color: ART.enemyArmory.ivory, roughness: .7 }));
  private readonly dark = new THREE.MeshStandardMaterial({ color: ART.enemyArmory.iron, roughness: .85 });
  private readonly accent = new THREE.MeshStandardMaterial({ color: ART.enemyArmory.warning, roughness: .75 });
  private readonly landingArmor = illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#687049', roughness: .85 }));
  private readonly hitFlash = new THREE.MeshBasicMaterial({ color: '#fff4c4', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private readonly hitMeshes: THREE.Mesh[] = [];
  private observedHit: number | null = null;
  private hitAtMs = -Infinity;
  private hitDurationMs = 90;
  private hitStrength = .6;
  private readonly damage = new THREE.MeshBasicMaterial({ color: '#2e241e' });
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({ color: '#454137', transparent: true, opacity: .3, depthWrite: false });
  private readonly shock = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 32, 1, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: '#ffe0b4', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  private entranceAtMs = -Infinity;
  private shockDepth = 1;
  private readonly tracks = new THREE.InstancedMesh(this.block, this.dark, 64);
  private readonly wheels = new THREE.InstancedMesh(this.wheelGeometry, this.steel, 12);
  private readonly smoke = new THREE.InstancedMesh(this.smokeGeometry, this.smokeMaterial, 8);
  private readonly flames = new THREE.InstancedMesh(this.flameGeometry, this.flameMaterial, 3);
  private readonly flameCores = new THREE.InstancedMesh(this.flameGeometry, this.flameCoreMaterial, 3);
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
    part(this.group, [0, 1.75, -.65], [3.45, 1, 3.4], this.armor).rotation.x = -.12;
    // Broad sloped front wall, spaced cheek armor and huge dark tracks.
    part(this.group, [0, 1.26, -2.24], [3.8, .88, .55], this.armor).rotation.x = -.18;
    part(this.group, [0, 1.69, -2.25], [3.55, .18, .56], this.steel);
    part(this.group, [0, 2.02, 1.65], [2.5, .12, 1], this.dark);
    for (const x of [-1.35, 1.35]) {
      part(this.group, [x, 1.65, -1.35], [.8, .8, 1.35], this.armor).rotation.z = x < 0 ? -.12 : .12;
      part(this.group, [x, 2.2, 1.95], [.24, .65, .3], this.dark);
      part(this.group, [x, 1.5, -2.05], [.32, .18, .14], this.steel);
      part(this.group, [x, 1.3, -2.56], [.28, .35, .08], this.accent);
    }
    part(this.turret, [0, .3, 0], [2.8, 1.1, 2.4], this.armor);
    part(this.turret, [0, .9, .12], [2.35, .28, 1.95], this.steel);
    part(this.turret, [0, 1.18, .55], [.9, .22, .8], this.dark);
    part(this.turret, [0, .35, -1.1], [.75, .82, .75], this.steel);
    part(this.turret, [0, .77, -1.18], [1.9, .26, .18], this.dark);
    for (const x of [-.63, .63]) part(this.turret, [x, .79, -1.28], [.47, .09, .06], this.accent);
    const barrel = new THREE.Mesh(this.barrelGeometry, this.dark); barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, .35, -2.25); this.turret.add(barrel);
    this.muzzle.name = 'tank-muzzle'; this.muzzle.position.set(0,.35,-3.6);
    this.muzzle.rotation.x = -Math.PI/2; this.turret.add(this.muzzle);
    this.cannon = new CannonMuzzleFeedback(scene,this.muzzle,'tank');
    this.turret.position.y = 2.4;
    for (const root of [this.group, this.turret]) for (const material of [this.armor, this.steel, this.dark, this.accent]) {
      const parts = root.children.filter(o => o instanceof THREE.Mesh && o.geometry === this.block && o.material === material) as THREE.Mesh[];
      if (!parts.length) continue;
      const copies = parts.map(p => { p.updateMatrix(); return p.geometry.clone().applyMatrix4(p.matrix); });
      const geometry = mergeGeometries(copies)!; copies.forEach(g => g.dispose()); this.merged.push(geometry);
      parts.forEach(p => root.remove(p)); root.add(new THREE.Mesh(geometry, material));
      if (material === this.armor || material === this.steel) {
        const flash = new THREE.Mesh(geometry, this.hitFlash); flash.name = 'tank-hit-flash'; flash.visible = false;
        root.add(flash); this.hitMeshes.push(flash);
      }
    }
    this.flames.name = 'tank-wreck-flames'; this.flameCores.name = 'tank-wreck-fire-cores';
    this.group.add(this.turret, this.tracks, this.wheels, this.smoke, this.scars, this.flames, this.flameCores);
    for (const batch of [this.tracks, this.wheels, this.smoke, this.scars, this.flames, this.flameCores]) {
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.frustumCulled = false;
    }
    for (let i = 0; i < 12; i++) {
      this.transform.position.set(i < 6 ? -1.8 : 1.8, .6, -2 + (i % 6) * .8);
      this.transform.rotation.set(0, 0, Math.PI / 2); this.transform.scale.setScalar(1); this.transform.updateMatrix();
      this.wheels.setMatrixAt(i, this.transform.matrix);
    }
    for (let i = 0; i < 6; i++) {
      this.transform.position.set((i % 3 - 1) * .95, 2.22, -.9 + Math.floor(i / 3) * 2);
      this.transform.rotation.set(0, i * .71, 0); this.transform.scale.set(.48, .025, .35); this.transform.updateMatrix();
      this.scars.setMatrixAt(i, this.transform.matrix);
    }
    this.ramp = part(this.landing, [0, .7, 47], [4.5, .18, 14], this.dark);
    this.ramp.rotation.x = -.1;
    this.leftDoor = part(this.landing, [-1.15, 2, 54], [2.2, 2.4, .18], this.landingArmor);
    this.rightDoor = part(this.landing, [1.15, 2, 54], [2.2, 2.4, .18], this.landingArmor);
    this.explosions = new GrenadeExplosion(scene, 4, false);
    this.shock.name = 'tank-entrance-shockwave'; this.shock.rotation.x = -Math.PI / 2;
    scene.add(this.group, this.landing, this.shock); this.reset();
  }
  presentEntrance(event: TankEntranceEvent, nowMs: number): void {
    if (!event.shockwave) return;
    this.entranceAtMs = nowMs;
    this.shock.position.set(0, .09, event.z);
    this.shockDepth = event.z - event.victims.reduce((z, v) => Math.min(z, v.z), event.z - 8) + 3;
  }
  presentCannon(atSeconds:number,nowMs:number):void {this.cannon.present(atSeconds,nowMs);}
  healthBarPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.turret.localToWorld(target.set(0, 1.5, 0));
  }
  presentGrenade(events: readonly GrenadeEvent[], nowMs: number): void {
    for (const event of events) if (event.kind === 'grenadeDetonated' && (event.tankDamage ?? 0) > 0) {
      this.hitAtMs = nowMs; this.hitDurationMs = 230; this.hitStrength = .9;
      break;
    }
  }
    presentSupport(events: readonly import('../simulation/commanderSupport').SupportEvent[], nowMs: number): void {
      if (events.some(e => e.kind === 'supportBomb' && (e.tankDamage ?? 0) > 0)) {
        this.hitAtMs = nowMs; this.hitDurationMs = 350; this.hitStrength = 1;
      }
    }
    update(frame: GameRenderState['defenseTank'], nowMs: number): void {
    this.group.visible = !!frame; this.landing.visible = !!frame;
    if(frame?.state.status!=='active')this.cannon.reset();
    const shockProgress = (nowMs - this.entranceAtMs) / 700;
    this.shock.visible = !!frame && shockProgress >= 0 && shockProgress < 1;
    if (this.shock.visible) {
      this.shock.scale.set(2.1 + shockProgress, 1 + this.shockDepth * shockProgress, 1);
      this.shock.material.opacity = .45 * (1 - shockProgress);
    }
    if (!frame) { this.explosions.update(nowMs, 0); return; }
    const s = frame.state, c = frame.config, entry = Math.min(1, Math.max(0, (frame.elapsedSeconds - s.startedAtSeconds) / c.entrySeconds));
    if (s.status === 'defeated' && !this.defeated) { this.defeated = true; this.deathAtMs = nowMs; }
    this.group.visible = s.status !== 'entering' || entry >= TANK_ENTRANCE_CLEAR_FRACTION;
    const door = Math.min(1, Math.max(0, entry - TANK_ENTRANCE_CLEAR_FRACTION) * 8);
    this.leftDoor.position.x = -1.15 - door * 2.1;
    this.rightDoor.position.x = 1.15 + door * 2.1;
    this.ramp.position.z = (c.startZ + c.battleZ) / 2; this.ramp.scale.z = c.startZ - c.battleZ;
    this.leftDoor.position.z = this.rightDoor.position.z = c.startZ;
    this.group.position.set(0, s.status === 'entering' ? (1 - entry) * 1.25 : 0, s.z);
    this.group.scale.set(c.halfWidth / 2.1, 1, c.halfDepth / 2.7);
    const speed = c.phases[s.phase - 1].speedUnitsPerSecond, age = frame.elapsedSeconds - s.startedAtSeconds;
    const hitAge = frame.elapsedSeconds - (s.lastHitAtSeconds ?? -Infinity);
    if (s.lastHitAtSeconds !== this.observedHit) {
      this.observedHit = s.lastHitAtSeconds;
      // Let the base armor show between MG hits; do not sustain a whole-body recolor.
      if (hitAge >= 0 && hitAge < .09 && nowMs - this.hitAtMs >= this.hitDurationMs + 50) {
        this.hitAtMs = nowMs; this.hitDurationMs = 90; this.hitStrength = .6;
      }
    }
    const flashAge = nowMs - this.hitAtMs;
    this.hitFlash.opacity = this.hitStrength * Math.max(0, 1 - flashAge / this.hitDurationMs);
    for (const mesh of this.hitMeshes) mesh.visible = s.status === 'active' && flashAge >= 0 && flashAge < this.hitDurationMs;
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
      this.transform.rotation.set(angle, 0, 0); this.transform.scale.set(.82, .16, .32); this.transform.updateMatrix();
      this.tracks.setMatrixAt(i, this.transform.matrix);
    }
    this.tracks.instanceMatrix.needsUpdate = true;
    this.smoke.visible = s.status === 'active' || s.status === 'defeated';
    this.smokeMaterial.opacity = s.status === 'defeated' ? .56 : .3;
    this.smokeMaterial.color.set(s.status === 'defeated' ? '#282b2d' : '#454137');
    // Combat time freezes on the lethal tick; victory smoke follows the pause-aware presentation clock.
    const smokeAge = age + (s.status === 'defeated' ? Math.max(0, nowMs - this.deathAtMs) / 1000 : 0);
    for (let i = 0; i < 8; i++) {
      const t = (smokeAge * (s.status === 'defeated' ? .35 : s.phase === 3 ? 1.4 : .6) + i / 4) % 2;
      this.transform.position.set(i % 2 ? -1.35 : 1.35, 2.4 + t * (s.status === 'defeated' ? 1.5 : .8), 2 + t * .6);
      this.transform.rotation.set(0, i, 0); this.transform.scale.setScalar((.12 + t * .2) * (s.phase === 3 ? 1.6 : 1)
        * (s.status === 'defeated' ? 1.8 : 1));
      this.transform.updateMatrix(); this.smoke.setMatrixAt(i, this.transform.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    this.flames.visible = this.flameCores.visible = s.status === 'defeated';
    if (s.status === 'defeated') {
      const deathAge = nowMs - this.deathAtMs;
      const fireSeconds = Math.max(0, deathAge / 1000);
      for (let i = 0; i < 3; i++) {
        const flicker = 1 + .12 * Math.sin(fireSeconds * 3.1 + i * 2.4);
        this.transform.position.set(i === 0 ? -1.4 : i === 1 ? 1.4 : .65, 2.35, i === 2 ? -1.9 : 1.55);
        this.transform.rotation.set(.08 * Math.sin(fireSeconds + i), 0, -.1 * Math.sin(fireSeconds * 1.7 + i));
        this.transform.scale.set(.85, 1.1 * flicker, .85); this.transform.updateMatrix();
        this.flames.setMatrixAt(i, this.transform.matrix);
        this.transform.position.y -= .16; this.transform.scale.multiplyScalar(.58); this.transform.updateMatrix();
        this.flameCores.setMatrixAt(i, this.transform.matrix);
      }
      this.flames.instanceMatrix.needsUpdate = this.flameCores.instanceMatrix.needsUpdate = true;
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
    if(s.status==='active')this.cannon.update(nowMs);
  }
  recoil(atSeconds: number, nowSeconds: number): void {
    const age = nowSeconds - atSeconds;
    if (age >= 0 && age < .25) this.turret.position.z = .4 * Math.sin(age / .25 * Math.PI);
  }
  restore(frame: GameRenderState['defenseTank'], nowMs: number, victoryElapsedMs = TANK_DEATH_MS): void {
    this.reset();
    this.observedHit = frame?.state.lastHitAtSeconds ?? null;
    if (frame?.state.status === 'defeated') { this.defeated = true; this.deathAtMs = nowMs - victoryElapsedMs;
      this.lastBurst = TANK_EXPLOSION_TIMES_MS.filter(at => at <= victoryElapsedMs).length - 1; }
  }
  reset(): void { this.group.visible = this.landing.visible = false; this.group.rotation.set(0, 0, 0);
    this.cannon.reset();
    this.flames.visible = this.flameCores.visible = false;
    this.armor.color.set(ART.enemyArmory.vehicle);
    this.shock.visible = false; this.entranceAtMs = -Infinity;
    this.hitAtMs = -Infinity; this.observedHit = null; this.hitFlash.opacity = 0;
    for (const mesh of this.hitMeshes) mesh.visible = false;
    this.deathAtMs = -Infinity; this.lastBurst = -1; this.defeated = false; this.explosions.reset(); }
  dispose(): void {
    this.cannon.dispose();
    this.scene.remove(this.group, this.landing, this.shock); this.explosions.dispose();
    this.shock.geometry.dispose(); this.shock.material.dispose();
    for (const batch of [this.tracks, this.wheels, this.smoke, this.scars, this.flames, this.flameCores]) batch.dispose();
    for (const g of [this.block, this.wheelGeometry, this.barrelGeometry, this.smokeGeometry, this.flameGeometry, ...this.merged]) g.dispose();
    for (const m of [this.armor, this.steel, this.dark, this.accent, this.landingArmor, this.hitFlash, this.damage, this.smokeMaterial,
      this.flameMaterial, this.flameCoreMaterial]) m.dispose();
  }
}

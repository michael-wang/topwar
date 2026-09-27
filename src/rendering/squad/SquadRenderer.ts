import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState, ProjectileRenderState } from '../RenderState';
import { PLAYER_PALETTE, paletteIndex } from '../tierPalettes';

const RECOIL_MS = 85;
const FLASH_MS = 50;
const SPAWN_MS = 190;
const TIER_UP_MS = 360;
const TIER_GLOW_MS = 150;

export function soldierSpawnScale(ageMs: number): number {
  return 1 + 0.35 * Math.max(0, 1 - ageMs / SPAWN_MS);
}

export function tierUpScale(ageMs: number): number {
  return 1 + 0.25 * Math.max(0, 1 - ageMs / TIER_UP_MS);
}

export function firingRecoil(nowMs: number, firedAtMs: number): number {
  return Math.max(0, 1 - (nowMs - firedAtMs) / RECOIL_MS);
}

interface SoldierVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  armor: THREE.Mesh;
  bow: THREE.Mesh;
  muzzle: THREE.Mesh;
  appearedAtMs: number;
}

export class SquadRenderer {
  private readonly muzzleGeometry = new THREE.SphereGeometry(0.055, 6, 4);
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly upgradeMaterial: THREE.MeshStandardMaterial;
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#fff1a0' });
  private readonly ringGeometry = new THREE.RingGeometry(0.42, 0.55, 32);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#fff0a4',
    transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  private readonly tierRing = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly members: SoldierVisual[] = [];
  private previousRifleCounts: number[] = [];
  private tierUpTier: number | null = null;
  private tierUpAtMs = -Infinity;
  private lastSeenProjectileId = 0;
  private readonly rifleFiredAtMs = new Map<number, number>();
  private rocketFiredAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene,
    private readonly bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly armorModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly bowModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = armorModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Samurai armor needs a standard material');
    this.tierMaterials = PLAYER_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
    this.upgradeMaterial = source.clone();
    this.upgradeMaterial.color.set('#b9eaff');
    this.tierRing.rotation.x = -Math.PI / 2;
    this.tierRing.position.y = 0.035;
    this.tierRing.visible = false;
    this.scene.add(this.tierRing);
  }

  update(state: GameRenderState, nowMs = performance.now()): void {
    this.observeShots(state.projectiles, nowMs);
    let higherTierDecreased = false;
    const tierSlots = Math.max(state.squad.rifleCounts.length, this.previousRifleCounts.length);
    for (let index = tierSlots - 1; index >= 1; index--) {
      const currentCount = state.squad.rifleCounts[index] ?? 0;
      const previousCount = this.previousRifleCounts[index] ?? 0;
      if (!higherTierDecreased && currentCount > previousCount) {
        this.tierUpAtMs = nowMs;
        this.tierUpTier = index + 1;
        break;
      }
      if (currentCount < previousCount) higherTierDecreased = true;
    }
    this.previousRifleCounts = [...state.squad.rifleCounts];
    for (const tier of this.rifleFiredAtMs.keys()) {
      if (!state.squad.rifleCounts[tier - 1]) this.rifleFiredAtMs.delete(tier);
    }
    const tierAgeMs = nowMs - this.tierUpAtMs;
    const tierActive = tierAgeMs >= 0 && tierAgeMs < TIER_UP_MS;
    this.tierRing.visible = tierActive;
    if (tierActive) {
      const progress = tierAgeMs / TIER_UP_MS;
      this.tierRing.position.set(-state.player.x, 0.035, state.player.z);
      this.tierRing.scale.setScalar(0.5 + 1.8 * progress);
    }
    const offsets = createSquadFormation(state.squad.count, state.squad.formationSpacing);
    while (this.members.length < offsets.length) this.addMember();

    const rocketStart = state.squad.count - state.squad.rocketCount;
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const offset = offsets[index];
      const wasVisible = member.group.visible;
      member.group.visible = offset !== undefined;
      if (!offset) continue;
      if (!wasVisible) member.appearedAtMs = nowMs;
      const isRocket = index >= rocketStart;
      let tier = 0;
      if (!isRocket) {
        let roleIndex = index;
        for (let tierIndex = 0; tierIndex < state.squad.rifleCounts.length; tierIndex++) {
          roleIndex -= state.squad.rifleCounts[tierIndex];
          if (roleIndex < 0) { tier = tierIndex + 1; break; }
        }
      }
      const firedAt = isRocket ? this.rocketFiredAtMs : this.rifleFiredAtMs.get(tier) ?? -Infinity;
      const recoil = firingRecoil(nowMs, firedAt);
      const spawnScale = soldierSpawnScale(nowMs - member.appearedAtMs);
      const upgrading = tierActive && tier === this.tierUpTier;
      member.group.scale.setScalar(upgrading ? tierUpScale(tierAgeMs) : spawnScale);
      const glowing = upgrading && tierAgeMs < TIER_GLOW_MS;
      member.armor.material = glowing ? this.upgradeMaterial
        : this.tierMaterials[paletteIndex(tier || 1, PLAYER_PALETTE.length)];
      member.body.scale.y = 1 - 0.09 * recoil;
      member.armor.scale.y = 1 - 0.09 * recoil;
      member.body.rotation.x = -0.09 * recoil;
      member.armor.rotation.x = -0.09 * recoil;
      member.bow.rotation.x = -0.18 * recoil;
      member.bow.position.z = -0.08 * recoil;
      member.bow.scale.setScalar(isRocket ? 1.15 : 1);
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < FLASH_MS;
      // The camera looks along +Z, which mirrors X on screen.
      member.group.position.set(-(state.player.x + offset.x), 0, state.player.z + offset.z);
    }
  }

  reset(): void {
    this.lastSeenProjectileId = 0;
    this.rifleFiredAtMs.clear();
    this.rocketFiredAtMs = -Infinity;
    this.previousRifleCounts = [];
    this.tierUpTier = null;
    this.tierUpAtMs = -Infinity;
    this.tierRing.visible = false;
    for (const member of this.members) {
      member.group.visible = false;
      member.appearedAtMs = -Infinity;
      member.muzzle.visible = false;
    }
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member.group);
    this.members.length = 0;
    this.scene.remove(this.tierRing);
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
    this.muzzleGeometry.dispose();
    for (const material of [...this.tierMaterials, this.upgradeMaterial,
      this.muzzleMaterial]) material.dispose();
  }

  private observeShots(projectiles: readonly ProjectileRenderState[], nowMs: number): void {
    for (const projectile of projectiles) {
      if (projectile.id > this.lastSeenProjectileId) {
        if (projectile.kind === 'rifle') this.rifleFiredAtMs.set(projectile.tier, nowMs);
        if (projectile.kind === 'rocket') this.rocketFiredAtMs = nowMs;
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
  }

  private addMember(): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.bodyModel.geometry, this.bodyModel.material);
    body.name = 'samurai-body';
    const armor = new THREE.Mesh(this.armorModel.geometry, this.tierMaterials[0]);
    armor.name = 'samurai-armor';
    const bow = new THREE.Mesh(this.bowModel.geometry, this.bowModel.material);
    bow.name = 'wooden-bow';
    const muzzle = new THREE.Mesh(this.muzzleGeometry, this.muzzleMaterial);
    muzzle.name = 'bow-release-glint';
    muzzle.position.set(0.20, 0.57, 0.05);
    muzzle.visible = false;
    group.add(body, armor, bow, muzzle);
    this.scene.add(group);
    group.visible = false;
    this.members.push({ group, body, armor, bow, muzzle,
      appearedAtMs: -Infinity });
  }
}

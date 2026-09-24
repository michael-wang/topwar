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
  torso: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rifle: THREE.Mesh;
  launcher: THREE.Mesh;
  muzzle: THREE.Mesh;
  appearedAtMs: number;
}

export class SquadRenderer {
  private readonly torsoGeometry = new THREE.BoxGeometry(0.32, 0.43, 0.23);
  private readonly headGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  private readonly armGeometry = new THREE.BoxGeometry(0.10, 0.35, 0.12);
  private readonly legGeometry = new THREE.BoxGeometry(0.12, 0.34, 0.14);
  private readonly rifleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.58);
  private readonly launcherGeometry = new THREE.BoxGeometry(0.22, 0.17, 0.66);
  private readonly muzzleGeometry = new THREE.SphereGeometry(0.085, 6, 4);
  private readonly bodyMaterials = PLAYER_PALETTE.map((entry) =>
    new THREE.MeshStandardMaterial({ color: entry.body }));
  private readonly headMaterials = PLAYER_PALETTE.map((entry) =>
    new THREE.MeshStandardMaterial({ color: entry.head }));
  private readonly rifleMaterial = new THREE.MeshStandardMaterial({ color: '#173a77' });
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#ffe26b' });
  private readonly upgradeBodyMaterial = new THREE.MeshStandardMaterial({ color: '#fff0a4' });
  private readonly upgradeHeadMaterial = new THREE.MeshStandardMaterial({ color: '#fff9d8' });
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

  constructor(private readonly scene: THREE.Scene) {
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
      for (const part of [member.torso, member.leftArm, member.rightArm, member.leftLeg, member.rightLeg]) {
        part.material = glowing ? this.upgradeBodyMaterial
          : this.bodyMaterials[paletteIndex(tier || 1, PLAYER_PALETTE.length)];
      }
      member.head.material = glowing ? this.upgradeHeadMaterial
        : this.headMaterials[paletteIndex(tier || 1, PLAYER_PALETTE.length)];
      member.rifle.visible = !isRocket;
      member.rifle.scale.setScalar(tier >= 3 ? 1.25 : tier === 2 ? 1.12 : 1);
      member.rifle.position.z = 0.38 - (tier >= 3 ? 0.16 : 0.11) * recoil;
      member.launcher.visible = isRocket;
      member.launcher.position.z = 0.12 - 0.09 * recoil;
      member.leftArm.rotation.x = -0.78 + 0.20 * recoil;
      member.rightArm.rotation.x = -0.78 + 0.20 * recoil;
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < FLASH_MS;
      member.muzzle.position.z = member.rifle.position.z + (tier >= 3 ? 0.48 : tier === 2 ? 0.40 : 0.32);
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
    for (const geometry of [this.torsoGeometry, this.headGeometry, this.armGeometry, this.legGeometry,
      this.rifleGeometry, this.launcherGeometry, this.muzzleGeometry]) geometry.dispose();
    for (const material of [...this.bodyMaterials, ...this.headMaterials,
      this.rifleMaterial, this.muzzleMaterial,
      this.upgradeBodyMaterial, this.upgradeHeadMaterial]) material.dispose();
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
    const torso = new THREE.Mesh(this.torsoGeometry, this.bodyMaterials[0]);
    torso.position.y = 0.53;
    const head = new THREE.Mesh(this.headGeometry, this.headMaterials[0]);
    head.position.y = 0.90;
    const leftArm = new THREE.Mesh(this.armGeometry, this.bodyMaterials[0]);
    leftArm.position.set(-0.23, 0.49, 0.09);
    const rightArm = new THREE.Mesh(this.armGeometry, this.bodyMaterials[0]);
    rightArm.position.set(0.23, 0.49, 0.09);
    const leftLeg = new THREE.Mesh(this.legGeometry, this.bodyMaterials[0]);
    leftLeg.position.set(-0.10, 0.17, 0);
    const rightLeg = new THREE.Mesh(this.legGeometry, this.bodyMaterials[0]);
    rightLeg.position.set(0.10, 0.17, 0);
    const rifle = new THREE.Mesh(this.rifleGeometry, this.rifleMaterial);
    rifle.position.set(0.20, 0.54, 0.38);
    const launcher = new THREE.Mesh(this.launcherGeometry, this.rifleMaterial);
    launcher.position.set(-0.22, 0.67, 0.12);
    launcher.visible = false;
    const muzzle = new THREE.Mesh(this.muzzleGeometry, this.muzzleMaterial);
    muzzle.position.set(0.20, 0.54, 0.70);
    muzzle.visible = false;
    group.add(torso, head, leftArm, rightArm, leftLeg, rightLeg, rifle, launcher, muzzle);
    this.scene.add(group);
    group.visible = false;
    this.members.push({ group, torso, head, leftArm, rightArm, leftLeg, rightLeg, rifle, launcher, muzzle,
      appearedAtMs: -Infinity });
  }
}

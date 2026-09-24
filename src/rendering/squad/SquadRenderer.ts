import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState, ProjectileRenderState } from '../RenderState';

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
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: '#1769ee' });
  private readonly headMaterial = new THREE.MeshStandardMaterial({ color: '#4b91ff' });
  private readonly heavyBodyMaterial = new THREE.MeshStandardMaterial({ color: '#10429b' });
  private readonly heavyHeadMaterial = new THREE.MeshStandardMaterial({ color: '#3579d6' });
  private readonly tier3BodyMaterial = new THREE.MeshStandardMaterial({ color: '#2938c7' });
  private readonly tier3HeadMaterial = new THREE.MeshStandardMaterial({ color: '#6677ff' });
  private readonly rifleMaterial = new THREE.MeshStandardMaterial({ color: '#173a77' });
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#ffe26b' });
  private readonly upgradeBodyMaterial = new THREE.MeshStandardMaterial({ color: '#fff0a4' });
  private readonly upgradeHeadMaterial = new THREE.MeshStandardMaterial({ color: '#fff9d8' });
  private readonly ringGeometry = new THREE.RingGeometry(0.42, 0.55, 32);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#fff0a4',
    transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  private readonly tierRing = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly members: SoldierVisual[] = [];
  private previousTier2RifleCount = 0;
  private previousTier3RifleCount = 0;
  private tierUpTier: 2 | 3 | null = null;
  private tierUpAtMs = -Infinity;
  private lastSeenProjectileId = 0;
  private rifleFiredAtMs = -Infinity;
  private heavyFiredAtMs = -Infinity;
  private tier3FiredAtMs = -Infinity;
  private rocketFiredAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene) {
    this.tierRing.rotation.x = -Math.PI / 2;
    this.tierRing.position.y = 0.035;
    this.tierRing.visible = false;
    this.scene.add(this.tierRing);
  }

  update(state: GameRenderState, nowMs = performance.now()): void {
    this.observeShots(state.projectiles, nowMs);
    if (state.squad.tier3RifleCount > this.previousTier3RifleCount) {
      this.tierUpAtMs = nowMs;
      this.tierUpTier = 3;
    } else if (state.squad.tier2RifleCount > this.previousTier2RifleCount) {
      this.tierUpAtMs = nowMs;
      this.tierUpTier = 2;
    }
    this.previousTier2RifleCount = state.squad.tier2RifleCount;
    this.previousTier3RifleCount = state.squad.tier3RifleCount;
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
    const tier3Start = rocketStart - state.squad.tier3RifleCount;
    const heavyStart = tier3Start - state.squad.tier2RifleCount;
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const offset = offsets[index];
      const wasVisible = member.group.visible;
      member.group.visible = offset !== undefined;
      if (!offset) continue;
      if (!wasVisible) member.appearedAtMs = nowMs;
      const isRocket = index >= rocketStart;
      const isTier3 = index >= tier3Start && !isRocket;
      const isHeavy = index >= heavyStart && !isTier3 && !isRocket;
      const firedAt = isRocket ? this.rocketFiredAtMs : isTier3 ? this.tier3FiredAtMs
        : isHeavy ? this.heavyFiredAtMs : this.rifleFiredAtMs;
      const recoil = firingRecoil(nowMs, firedAt);
      const spawnScale = soldierSpawnScale(nowMs - member.appearedAtMs);
      const upgrading = tierActive && ((isTier3 && this.tierUpTier === 3)
        || (isHeavy && this.tierUpTier === 2));
      member.group.scale.setScalar(upgrading ? tierUpScale(tierAgeMs) : spawnScale);
      const glowing = upgrading && tierAgeMs < TIER_GLOW_MS;
      for (const part of [member.torso, member.leftArm, member.rightArm, member.leftLeg, member.rightLeg]) {
        part.material = glowing ? this.upgradeBodyMaterial
          : isTier3 ? this.tier3BodyMaterial : isHeavy ? this.heavyBodyMaterial : this.bodyMaterial;
      }
      member.head.material = glowing ? this.upgradeHeadMaterial
        : isTier3 ? this.tier3HeadMaterial : isHeavy ? this.heavyHeadMaterial : this.headMaterial;
      member.rifle.visible = !isRocket;
      member.rifle.scale.setScalar(isTier3 ? 1.25 : isHeavy ? 1.12 : 1);
      member.rifle.position.z = 0.38 - (isTier3 ? 0.16 : 0.11) * recoil;
      member.launcher.visible = isRocket;
      member.launcher.position.z = 0.12 - 0.09 * recoil;
      member.leftArm.rotation.x = -0.78 + 0.20 * recoil;
      member.rightArm.rotation.x = -0.78 + 0.20 * recoil;
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < FLASH_MS;
      member.muzzle.position.z = member.rifle.position.z + (isTier3 ? 0.48 : isHeavy ? 0.40 : 0.32);
      // The camera looks along +Z, which mirrors X on screen.
      member.group.position.set(-(state.player.x + offset.x), 0, state.player.z + offset.z);
    }
  }

  reset(): void {
    this.lastSeenProjectileId = 0;
    this.rifleFiredAtMs = this.heavyFiredAtMs = this.tier3FiredAtMs = this.rocketFiredAtMs = -Infinity;
    this.previousTier2RifleCount = 0;
    this.previousTier3RifleCount = 0;
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
    for (const material of [this.bodyMaterial, this.headMaterial, this.heavyBodyMaterial,
      this.heavyHeadMaterial, this.tier3BodyMaterial, this.tier3HeadMaterial,
      this.rifleMaterial, this.muzzleMaterial,
      this.upgradeBodyMaterial, this.upgradeHeadMaterial]) material.dispose();
  }

  private observeShots(projectiles: readonly ProjectileRenderState[], nowMs: number): void {
    for (const projectile of projectiles) {
      if (projectile.id > this.lastSeenProjectileId) {
        if (projectile.kind === 'rifle') this.rifleFiredAtMs = nowMs;
        if (projectile.kind === 'heavyRifle') this.heavyFiredAtMs = nowMs;
        if (projectile.kind === 'tier3Rifle') this.tier3FiredAtMs = nowMs;
        if (projectile.kind === 'rocket') this.rocketFiredAtMs = nowMs;
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
  }

  private addMember(): void {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(this.torsoGeometry, this.bodyMaterial);
    torso.position.y = 0.53;
    const head = new THREE.Mesh(this.headGeometry, this.headMaterial);
    head.position.y = 0.90;
    const leftArm = new THREE.Mesh(this.armGeometry, this.bodyMaterial);
    leftArm.position.set(-0.23, 0.49, 0.09);
    const rightArm = new THREE.Mesh(this.armGeometry, this.bodyMaterial);
    rightArm.position.set(0.23, 0.49, 0.09);
    const leftLeg = new THREE.Mesh(this.legGeometry, this.bodyMaterial);
    leftLeg.position.set(-0.10, 0.17, 0);
    const rightLeg = new THREE.Mesh(this.legGeometry, this.bodyMaterial);
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

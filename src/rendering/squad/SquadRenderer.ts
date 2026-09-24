import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState, ProjectileRenderState } from '../RenderState';

const RECOIL_MS = 85;
const FLASH_MS = 50;

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
  private readonly rifleMaterial = new THREE.MeshStandardMaterial({ color: '#173a77' });
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#ffe26b' });
  private readonly members: SoldierVisual[] = [];
  private lastSeenProjectileId = 0;
  private rifleFiredAtMs = -Infinity;
  private heavyFiredAtMs = -Infinity;
  private rocketFiredAtMs = -Infinity;

  constructor(private readonly scene: THREE.Scene) {}

  update(state: GameRenderState, nowMs = performance.now()): void {
    this.observeShots(state.projectiles, nowMs);
    const offsets = createSquadFormation(state.squad.count, state.squad.formationSpacing);
    while (this.members.length < offsets.length) this.addMember();

    const rocketStart = state.squad.count - state.squad.rocketCount;
    const heavyStart = rocketStart - state.squad.tier2RifleCount;
    for (let index = 0; index < this.members.length; index++) {
      const member = this.members[index];
      const offset = offsets[index];
      member.group.visible = offset !== undefined;
      if (!offset) continue;
      const isRocket = index >= rocketStart;
      const isHeavy = index >= heavyStart && !isRocket;
      const firedAt = isRocket ? this.rocketFiredAtMs : isHeavy ? this.heavyFiredAtMs : this.rifleFiredAtMs;
      const recoil = firingRecoil(nowMs, firedAt);
      member.group.scale.setScalar(isHeavy ? 1.85 : 1);
      for (const part of [member.torso, member.leftArm, member.rightArm, member.leftLeg, member.rightLeg]) {
        part.material = isHeavy ? this.heavyBodyMaterial : this.bodyMaterial;
      }
      member.head.material = isHeavy ? this.heavyHeadMaterial : this.headMaterial;
      member.rifle.visible = !isRocket;
      member.rifle.scale.setScalar(isHeavy ? 1.25 : 1);
      member.rifle.position.z = 0.38 - 0.11 * recoil;
      member.launcher.visible = isRocket;
      member.launcher.position.z = 0.12 - 0.09 * recoil;
      member.leftArm.rotation.x = -0.78 + 0.20 * recoil;
      member.rightArm.rotation.x = -0.78 + 0.20 * recoil;
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < FLASH_MS;
      member.muzzle.position.z = member.rifle.position.z + (isHeavy ? 0.40 : 0.32);
      // The camera looks along +Z, which mirrors X on screen.
      member.group.position.set(-(state.player.x + offset.x), 0, state.player.z + offset.z);
    }
  }

  reset(): void {
    this.lastSeenProjectileId = 0;
    this.rifleFiredAtMs = this.heavyFiredAtMs = this.rocketFiredAtMs = -Infinity;
    for (const member of this.members) member.muzzle.visible = false;
  }

  dispose(): void {
    for (const member of this.members) this.scene.remove(member.group);
    this.members.length = 0;
    for (const geometry of [this.torsoGeometry, this.headGeometry, this.armGeometry, this.legGeometry,
      this.rifleGeometry, this.launcherGeometry, this.muzzleGeometry]) geometry.dispose();
    for (const material of [this.bodyMaterial, this.headMaterial, this.heavyBodyMaterial,
      this.heavyHeadMaterial, this.rifleMaterial, this.muzzleMaterial]) material.dispose();
  }

  private observeShots(projectiles: readonly ProjectileRenderState[], nowMs: number): void {
    for (const projectile of projectiles) {
      if (projectile.id > this.lastSeenProjectileId) {
        if (projectile.kind === 'rifle') this.rifleFiredAtMs = nowMs;
        if (projectile.kind === 'heavyRifle') this.heavyFiredAtMs = nowMs;
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
    this.members.push({ group, torso, head, leftArm, rightArm, leftLeg, rightLeg, rifle, launcher, muzzle });
  }
}

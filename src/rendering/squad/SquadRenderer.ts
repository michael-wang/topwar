import * as THREE from 'three';
import { createSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState, ProjectileRenderState } from '../RenderState';
import { PLAYER_PALETTE, paletteIndex } from '../tierPalettes';

const RECOIL_MS = 85;
const FLASH_MS = 50;
const SPAWN_MS = 190;
const TIER_UP_MS = 360;
const TIER_GLOW_MS = 150;
export const PLAYER_VISUAL_SCALE = 0.85;
const VISUAL_FORMATION_SPREAD = 2;

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
  helmet: THREE.Mesh;
  vest: THREE.Mesh;
  rifle: THREE.Mesh;
  muzzle: THREE.Mesh;
  appearedAtMs: number;
}

export class SquadRenderer {
  private readonly muzzleGeometry = new THREE.ConeGeometry(0.11, 0.24, 5);
  private readonly muzzleCoreGeometry = new THREE.ConeGeometry(0.048, 0.15, 5);
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly upgradeMaterial: THREE.MeshStandardMaterial;
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#ffd15b', toneMapped: false });
  private readonly muzzleCoreMaterial = new THREE.MeshBasicMaterial({ color: '#fffbd1', toneMapped: false });
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
    private readonly helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly rifleModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
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
    const maxOffsetX = offsets.reduce((max, offset) => Math.max(max, Math.abs(offset.x)), 0);
    // Only the rendered anchors spread out; simulation formation and collision stay unchanged.
    const visualSpread = maxOffsetX === 0 ? 1 : Math.max(1, Math.min(VISUAL_FORMATION_SPREAD,
      (state.track.halfWidth - 0.4) / maxOffsetX));
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
      member.group.scale.setScalar(PLAYER_VISUAL_SCALE
        * (upgrading ? tierUpScale(tierAgeMs) : spawnScale));
      const glowing = upgrading && tierAgeMs < TIER_GLOW_MS;
      member.helmet.material = glowing ? this.upgradeMaterial
        : this.tierMaterials[paletteIndex(tier || 1, PLAYER_PALETTE.length)];
      member.vest.material = member.helmet.material;
      member.body.scale.y = 1 - 0.09 * recoil;
      member.helmet.scale.y = 1 - 0.09 * recoil;
      member.vest.scale.y = 1 - 0.09 * recoil;
      member.body.rotation.x = -0.09 * recoil;
      member.helmet.rotation.x = -0.09 * recoil;
      member.vest.rotation.x = -0.09 * recoil;
      member.rifle.rotation.x = -0.18 * recoil;
      member.rifle.position.z = -0.08 * recoil;
      member.rifle.scale.setScalar(isRocket ? 1.15 : 1);
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < FLASH_MS;
      // The camera looks along +Z, which mirrors X on screen.
      member.group.position.set(-(state.player.x + offset.x * visualSpread), 0,
        state.player.z + offset.z * visualSpread);
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
    this.muzzleCoreGeometry.dispose();
    for (const material of [...this.tierMaterials, this.upgradeMaterial,
      this.muzzleMaterial, this.muzzleCoreMaterial]) material.dispose();
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
    body.name = 'toy-soldier-body';
    const helmet = new THREE.Mesh(this.helmetModel.geometry, this.tierMaterials[0]);
    helmet.name = 'toy-soldier-helmet';
    const vest = new THREE.Mesh(this.vestModel.geometry, this.tierMaterials[0]);
    vest.name = 'toy-soldier-vest';
    const rifle = new THREE.Mesh(this.rifleModel.geometry, this.rifleModel.material);
    rifle.name = 'toy-rifle';
    rifle.position.x = .13;
    const muzzle = new THREE.Mesh(this.muzzleGeometry, this.muzzleMaterial);
    muzzle.name = 'muzzle-flash';
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(.38, .46, .93);
    muzzle.add(new THREE.Mesh(this.muzzleCoreGeometry, this.muzzleCoreMaterial));
    muzzle.visible = false;
    group.add(body, helmet, vest, rifle, muzzle);
    this.scene.add(group);
    group.visible = false;
    this.members.push({ group, body, helmet, vest, rifle, muzzle,
      appearedAtMs: -Infinity });
  }
}

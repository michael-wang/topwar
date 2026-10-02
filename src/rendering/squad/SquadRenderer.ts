import { laneLocomotion, recoilEnvelope, RECOIL_SETTLE_MS } from '../../presentation/CharacterMotion';
import { PlayerBodyMotion } from './PlayerBodyMotion';
import { reinforcementArrivalPose } from '../../presentation/ReinforcementArrival';
import { LEVEL_UP_MS, WEAPON_AFTERGLOW_MS, type ProgressionLevelUpEvent } from '../../presentation/ProgressionLevelUp';
import { PlayerLevelUpEffect } from './PlayerLevelUpEffect';
import * as THREE from 'three';
import { createSquadFormation, createDefenseSquadFormation } from '../../simulation/squad/formation';
import type { GameRenderState, ProjectileRenderState } from '../RenderState';
import { PLAYER_PALETTE, paletteIndex } from '../tierPalettes';
import type { PresentationEvent } from '../../simulation/PresentationEvent';
import { removedVisualMembers } from './casualtyVisuals';

const FLASH_MS = 50;
const SPAWN_MS = 190;
const TIER_UP_MS = 360;
const TIER_GLOW_MS = 150;
export const PLAYER_VISUAL_SCALE = 0.85;
const VISUAL_FORMATION_SPREAD = 2;
export const PLAYER_HIT_FLASH_MS = 130;
export const PLAYER_KNOCKOUT_MS = 360;
export const MAX_PLAYER_CASUALTY_VISUALS = 48;

export function soldierSpawnScale(ageMs: number): number {
  return 1 + 0.35 * Math.max(0, 1 - ageMs / SPAWN_MS);
}

export function tierUpScale(ageMs: number): number {
  return 1 + 0.25 * Math.max(0, 1 - ageMs / TIER_UP_MS);
}

export function firingRecoil(nowMs: number, firedAtMs: number): number {
  return recoilEnvelope(nowMs - firedAtMs);
}

interface SoldierVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  helmet: THREE.Mesh;
  vest: THREE.Mesh;
  rifle: THREE.Mesh;
  muzzle: THREE.Mesh;
  appearedAtMs: number;
  motion: PlayerBodyMotion;
  recoil: number;
  lastFiredAtMs: number;
}

interface CasualtyVisual {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  tier: number;
  startedAtMs: number;
  spread: number;
  originX: number;
  originZ: number;
}

export class SquadRenderer {
  getVisibleCount(): number {
    let count = 0;
    for (const member of this.members) if (member.group.visible) count++;
    return count;
  }
  private readonly muzzleGeometry = new THREE.ConeGeometry(0.11, 0.24, 5);
  private readonly muzzleCoreGeometry = new THREE.ConeGeometry(0.048, 0.15, 5);
  private readonly levelEffect: PlayerLevelUpEffect;
  private levelUpAtMs = -Infinity;
  private readonly levelBodyMaterial: THREE.MeshStandardMaterial;
  private readonly levelGearMaterial: THREE.MeshStandardMaterial;
  private readonly poweredMuzzleMaterial = new THREE.MeshBasicMaterial({ color: '#fff3ab', toneMapped: false });
  private readonly tierMaterials: THREE.MeshStandardMaterial[];
  private readonly upgradeMaterial: THREE.MeshStandardMaterial;
  private readonly hitMaterial = new THREE.MeshBasicMaterial({ color: '#ff3030', toneMapped: false });
  private readonly muzzleMaterial = new THREE.MeshBasicMaterial({ color: '#ffd15b', toneMapped: false });
  private readonly muzzleCoreMaterial = new THREE.MeshBasicMaterial({ color: '#fffbd1', toneMapped: false });
  private readonly ringGeometry = new THREE.RingGeometry(0.42, 0.55, 32);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#fff0a4',
    transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  private readonly tierRing = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly members: SoldierVisual[] = [];
  private readonly casualtyVisuals: CasualtyVisual[] = [];
  private readonly hitMemberIndices = new Map<number, number>();
  private lastRenderedSquadCount = 0;
  private previousRifleCounts: number[] = [];
  private tierUpTier: number | null = null;
  private tierUpAtMs = -Infinity;
  private lastSeenProjectileId = 0;
  private readonly rifleFiredAtMs = new Map<number, number>();
  private readonly memberFiredAtMs = new Map<number, number>();
  private rocketFiredAtMs = -Infinity;
  private lastLane: number | undefined;
  private laneMotionAt = -Infinity;
  private laneDirection = 0;
  private laneLeanStart = 0;
  private lastLaneLean = 0;
  private lastUpdateMs = -Infinity;

  forEachVisibleMemberPosition(visit: (position: THREE.Vector3) => void): void {
    for (const member of this.members) if (member.group.visible) visit(member.group.position);
  }

  constructor(private readonly scene: THREE.Scene,
    private readonly bodyModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly vestModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly rifleModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Toy soldier helmet needs a standard material');
    if (!(bodyModel.material instanceof THREE.MeshStandardMaterial)) throw new Error('Player body needs a standard material');
    this.levelBodyMaterial = bodyModel.material.clone();
    this.levelBodyMaterial.emissive.set('#ffbd36');
    this.levelGearMaterial = source.clone();
    this.levelGearMaterial.color.set('#fff0ae');
    this.levelGearMaterial.emissive.set('#ffd052');
    this.levelEffect = new PlayerLevelUpEffect(scene);
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

  present(events: readonly PresentationEvent[], nowMs: number,
    trackHalfWidth: number, formationSpacing: number): void {
    for (const event of events) {
      const removed = event.affectedMembers ?? removedVisualMembers(event.before, event.after);
      const offsets = createSquadFormation(event.before.count, formationSpacing);
      const maxOffsetX = offsets.reduce((max, offset) => Math.max(max, Math.abs(offset.x)), 0);
      const visualSpread = maxOffsetX === 0 ? 1 : Math.max(1, Math.min(VISUAL_FORMATION_SPREAD,
        (trackHalfWidth - .4) / maxOffsetX));
      for (const affected of removed) {
        const offset = offsets[affected.index];
        if (!offset) continue;
        const prior = this.members[affected.index];
        const useRendered = this.lastRenderedSquadCount === event.before.count && prior?.group.visible;
        const x = useRendered ? prior.group.position.x
          : -(event.playerX + offset.x * visualSpread);
        const z = useRendered ? prior.group.position.z
          : event.playerZ + offset.z * visualSpread;
        this.spawnCasualty(affected.tier, x, z, affected.index,
          event.attackerX - event.playerX, nowMs);
      }
      // Exact remainder damage can reduce defense without removing a visible body.
      if (removed.length === 0 && event.before.count > 0) {
        const target = Math.min(event.after.count - 1, event.before.count - 1);
        if (target >= 0) this.hitMemberIndices.set(target, nowMs + PLAYER_HIT_FLASH_MS);
      }
    }
  }

  presentLevelUp(_event: ProgressionLevelUpEvent, nowMs: number): void {
    this.levelUpAtMs = nowMs;
    this.levelEffect.present(nowMs);
  }

  update(state: GameRenderState, nowMs = performance.now()): void {
    this.observeShots(state.projectiles, nowMs);
    if (this.lastLane !== undefined && state.player.selectedLane !== this.lastLane) {
      this.laneLeanStart = this.lastLaneLean;
      this.laneMotionAt = nowMs;
      this.laneDirection = Math.sign((state.player.selectedLane ?? 0) - this.lastLane);
    }
    this.lastLane = state.player.selectedLane;
    const dt = Math.max(0, Math.min(1000, nowMs - this.lastUpdateMs));
    this.lastUpdateMs = nowMs;
    const levelAge = nowMs - this.levelUpAtMs;
    const levelActive = levelAge >= 0 && levelAge < LEVEL_UP_MS;
    const levelStrength = levelActive ? Math.pow(1 - levelAge / LEVEL_UP_MS, .7) : 0;
    const afterglow = levelAge >= 0 && levelAge < WEAPON_AFTERGLOW_MS;
    this.levelBodyMaterial.emissiveIntensity = 1.8 * levelStrength;
    this.levelGearMaterial.emissiveIntensity = 1.6 * levelStrength;
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
    const arrival = state.squad.reinforcement;
    const entering = !!arrival && arrival.progress < 1 && state.squad.count > 0;
    const offsets = createDefenseSquadFormation(entering ? 2 : state.squad.count,
      state.squad.formationSpacing, state.defenseMode ? arrival : undefined);
    if (entering && state.squad.count === 1) offsets[0].x *= Math.min(1, arrival!.progress / .82);
    const maxOffsetX = offsets.reduce((max, offset) => Math.max(max, Math.abs(offset.x)), 0);
    // Only the rendered anchors spread out; simulation formation and collision stay unchanged.
    const visualSpread = state.defenseMode && arrival ? 1 : maxOffsetX === 0 ? 1 : Math.max(1, Math.min(VISUAL_FORMATION_SPREAD,
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
      const recruit = entering && index === state.squad.count;
      const isRocket = !recruit && index >= rocketStart;
      let tier = 0;
      if (!isRocket) {
        let roleIndex = index;
        for (let tierIndex = 0; tierIndex < state.squad.rifleCounts.length; tierIndex++) {
          roleIndex -= state.squad.rifleCounts[tierIndex];
          if (roleIndex < 0) { tier = tierIndex + 1; break; }
        }
      }
      const firedAt = recruit ? -Infinity : isRocket ? this.rocketFiredAtMs
        : state.defenseMode ? this.memberFiredAtMs.get(index) ?? -Infinity : this.rifleFiredAtMs.get(tier) ?? -Infinity;
      // Add a decaying shot impulse; rapid fire blends rather than restarting a pose.
      member.recoil *= Math.exp(-dt / 38);
      if (firedAt !== member.lastFiredAtMs) {
        member.recoil = Math.min(1.35, member.recoil + 1 + (index % 2) * .035);
        member.lastFiredAtMs = firedAt;
      }
      const shotAge = nowMs - firedAt;
      if (shotAge >= RECOIL_SETTLE_MS) member.recoil = 0;
      const recoil = member.recoil * Math.cos(Math.min(RECOIL_SETTLE_MS, shotAge) / 37);
      const moving = laneLocomotion(nowMs - this.laneMotionAt, this.laneDirection, index, this.laneLeanStart);
      if (index === 0) this.lastLaneLean = moving.lean;
      const spawnScale = soldierSpawnScale(nowMs - member.appearedAtMs);
      const upgrading = tierActive && tier === this.tierUpTier;
      member.group.scale.setScalar(PLAYER_VISUAL_SCALE
        * (levelActive ? 1 + .2 * Math.sin(Math.PI * Math.min(1, levelAge / 400))
          : upgrading ? tierUpScale(tierAgeMs) : spawnScale));
      const glowing = upgrading && tierAgeMs < TIER_GLOW_MS;
      const hit = (this.hitMemberIndices.get(index) ?? -Infinity) > nowMs;
      member.body.material = hit ? this.hitMaterial : levelActive ? member.motion.level
        : Math.abs(moving.stride) > .001 || Math.abs(recoil) > .001 || recruit ? member.motion.normal : this.bodyModel.material;
      member.helmet.material = hit ? this.hitMaterial : levelActive ? this.levelGearMaterial : glowing ? this.upgradeMaterial
        : this.tierMaterials[paletteIndex(tier || 1, PLAYER_PALETTE.length)];
      member.vest.material = member.helmet.material;
      const entrance = recruit ? reinforcementArrivalPose(arrival!.progress) : undefined;
      const entranceStride = entrance ? Math.sin(arrival!.progress * Math.PI * 10 + index * .65)
        * Math.max(0, 1 - (arrival!.progress / .90) ** 3) : 0;
      member.motion.update(moving.stride + entranceStride, recoil, 1.8 * levelStrength, entrance?.weaponLower ?? 0);
      member.body.rotation.set(-.025 * recoil, 0, moving.lean);
      member.body.position.z = -.015 * recoil;
      const idle = Math.sin(nowMs * .0026 + index * 1.7) * .007;
      member.helmet.rotation.z = moving.lean * .82 + idle;
      member.vest.rotation.z = moving.lean * .90 + idle * .5;
      member.vest.rotation.x = -.018 * recoil;
      member.rifle.rotation.z = moving.lean * .65 + idle * 1.3;
      member.rifle.position.x = .13 + moving.lag;
      member.rifle.rotation.x = (entrance?.weaponLower ?? 0) - 0.18 * recoil;
      member.rifle.position.z = -0.08 * recoil;
      member.rifle.scale.setScalar(isRocket ? 1.15 : 1);
      member.muzzle.visible = !isRocket && nowMs - firedAt >= 0 && nowMs - firedAt < (afterglow ? 90 : FLASH_MS);
      member.muzzle.material = afterglow ? this.poweredMuzzleMaterial : this.muzzleMaterial;
      member.muzzle.scale.setScalar((afterglow ? 1.9 : 1) * (1 + 0.2 * Math.min(2, Math.max(0, tier - 1))));
      // The camera looks along +Z, which mirrors X on screen.
      member.group.position.set(-(state.player.x + offset.x * visualSpread + (entrance?.sideOffset ?? 0)), (entrance?.bob ?? 0) + moving.bob,
        state.player.z + offset.z * visualSpread + (entrance?.backOffset ?? 0));
      member.group.rotation.set((entrance?.lean ?? 0) - .022 * recoil, 0, entrance ? Math.sin(arrival!.progress * Math.PI * 10) * .035 : idle * .4);
    }
    this.lastRenderedSquadCount = state.squad.count;
    for (const [index, until] of this.hitMemberIndices) {
      if (until <= nowMs) this.hitMemberIndices.delete(index);
    }
    this.updateCasualties(nowMs);
    this.levelEffect.update(this.members, nowMs);
  }

  reset(): void {
    this.lastLane = undefined; this.laneMotionAt = -Infinity; this.lastUpdateMs = -Infinity;
    this.lastLaneLean = this.laneLeanStart = 0;
    this.levelUpAtMs = -Infinity;
    this.levelEffect.reset();
    this.lastSeenProjectileId = 0;
    this.rifleFiredAtMs.clear();
    this.memberFiredAtMs.clear();
    this.rocketFiredAtMs = -Infinity;
    this.previousRifleCounts = [];
    this.tierUpTier = null;
    this.tierUpAtMs = -Infinity;
    this.tierRing.visible = false;
    this.hitMemberIndices.clear();
    this.lastRenderedSquadCount = 0;
    for (const visual of this.casualtyVisuals) visual.group.visible = false;
    for (const member of this.members) {
      member.group.visible = false;
      member.appearedAtMs = -Infinity;
      member.muzzle.visible = false;
      member.recoil = 0; member.lastFiredAtMs = -Infinity;
    }
  }

  dispose(): void {
    this.levelEffect.dispose();
    for (const member of this.members) { this.scene.remove(member.group); member.motion.dispose(); }
    this.members.length = 0;
    for (const visual of this.casualtyVisuals) {
      this.scene.remove(visual.group);
      for (const material of visual.materials) material.dispose();
    }
    this.casualtyVisuals.length = 0;
    this.scene.remove(this.tierRing);
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
    this.muzzleGeometry.dispose();
    this.muzzleCoreGeometry.dispose();
    for (const material of [...this.tierMaterials, this.upgradeMaterial, this.hitMaterial,
      this.muzzleMaterial, this.muzzleCoreMaterial, this.levelBodyMaterial, this.levelGearMaterial, this.poweredMuzzleMaterial]) material.dispose();
  }

  private observeShots(projectiles: readonly ProjectileRenderState[], nowMs: number): void {
    for (const projectile of projectiles) {
      if (projectile.id > this.lastSeenProjectileId) {
        if (projectile.kind === 'rifle') {
          this.rifleFiredAtMs.set(projectile.tier, nowMs);
          this.memberFiredAtMs.set(projectile.memberIndex ?? 0, nowMs);
        }
        if (projectile.kind === 'rocket') this.rocketFiredAtMs = nowMs;
      }
      this.lastSeenProjectileId = Math.max(this.lastSeenProjectileId, projectile.id);
    }
  }

  private spawnCasualty(tier: number, x: number, z: number, index: number,
    attackerDeltaX: number, nowMs: number): void {
    let visual = this.casualtyVisuals.find((candidate) => !candidate.group.visible);
    if (!visual && this.casualtyVisuals.length < MAX_PLAYER_CASUALTY_VISUALS) {
      const sources = [this.bodyModel, this.helmetModel, this.vestModel, this.rifleModel];
      const group = new THREE.Group();
      group.name = 'player-casualty';
      const materials = sources.map((source) => {
        if (!(source.material instanceof THREE.MeshStandardMaterial)) {
          throw new Error('Player casualty visuals require standard materials');
        }
        const material = source.material.clone();
        material.transparent = true;
        material.depthWrite = false;
        return material;
      });
      sources.forEach((source, part) => group.add(new THREE.Mesh(source.geometry, materials[part])));
      (group.children[3] as THREE.Mesh).position.x = .13;
      group.visible = false;
      this.scene.add(group);
      visual = { group, materials, tier, startedAtMs: nowMs,
        spread: 0, originX: x, originZ: z };
      this.casualtyVisuals.push(visual);
    }
    if (!visual) visual = this.casualtyVisuals.reduce((oldest, candidate) =>
      candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
    visual.tier = tier;
    visual.startedAtMs = nowMs;
    visual.originX = x;
    visual.originZ = z;
    visual.spread = (index % 2 === 0 ? -.24 : .24) + Math.sign(attackerDeltaX) * .16;
    visual.group.visible = true;
    visual.group.position.set(x, 0, z);
    visual.group.rotation.set(0, 0, 0);
    visual.group.scale.setScalar(PLAYER_VISUAL_SCALE);
    const color = PLAYER_PALETTE[paletteIndex(tier || 1, PLAYER_PALETTE.length)].body;
    for (const material of visual.materials) material.opacity = 1;
    visual.materials[1].color.set(color);
    visual.materials[2].color.set(color);
  }

  private updateCasualties(nowMs: number): void {
    for (const visual of this.casualtyVisuals) {
      if (!visual.group.visible) continue;
      const age = nowMs - visual.startedAtMs;
      if (age >= PLAYER_KNOCKOUT_MS) { visual.group.visible = false; continue; }
      const progress = Math.max(0, age / PLAYER_KNOCKOUT_MS);
      const flashing = age < PLAYER_HIT_FLASH_MS;
      visual.group.children.forEach((part, index) => {
        (part as THREE.Mesh).material = flashing ? this.hitMaterial : visual.materials[index];
        visual.materials[index].opacity = flashing ? 1
          : Math.max(0, 1 - (age - PLAYER_HIT_FLASH_MS)
            / (PLAYER_KNOCKOUT_MS - PLAYER_HIT_FLASH_MS));
      });
      visual.group.position.set(visual.originX + visual.spread * progress,
        .38 * Math.sin(Math.PI * progress) + .24 * progress,
        visual.originZ - .65 * progress);
      visual.group.rotation.set(-.65 * progress, 0, visual.spread * 1.8 * progress);
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
      appearedAtMs: -Infinity, motion: new PlayerBodyMotion(this.bodyModel.material as THREE.MeshStandardMaterial, this.levelBodyMaterial),
      recoil: 0, lastFiredAtMs: -Infinity });
  }
}

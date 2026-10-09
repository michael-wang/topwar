import { advanceLandingAssault, emptyLandingAssault } from './enemies/landingAssault';
import { admitDefenseGroup } from './enemies/defenseGroup';
import { advancePostCapSurvival, emptyPostCapSurvival, postCapOrdinarySettings,
  PostCapSurvivalStateSchema, type PostCapSurvivalState } from './postCapSurvival';
import { emptyGrenade, GrenadeStateSchema, grenadeTarget, placeGrenadeSupply, enemiesInBlast,
  type GrenadeState, type GrenadeEvent } from './grenade';
import { pressureGroupSize, pressureWaveSettings, enemyApproachSpeed, advanceGiantEncounter } from './enemies/latePressure';
import { grantXp, requiredXp, effectiveRifleFireRate, effectivePrimaryFireRate, progressionStage, maxProgressionLevel, type ProgressionState } from './progression';
import { SeededRng } from '../core/Rng';
import { LevelDefinitionSchema, UpgradeRewardSchema, type EnemyStreamDefinition, type LevelDefinition } from '../level/LevelDefinition';
import { createEnemyFormation } from './enemies/formation';
import { createEnemyStreamRow } from './enemies/streamRow';
import { rewardPlacementForBlock } from './enemies/streamRewards';
import { effectiveSeed } from './enemies/effectiveSeed';
import { EnemyCollisionIndex, type EnemyCandidateSource } from './enemies/EnemyCollisionIndex';
import { addRifleSoldiers, afterCasualtiesWithBreakdown, normalizeRifleSquad, validateSquad } from './squad/composition';
import { createDefenseSquadFormation } from './squad/formation';
import { readExactValue, storeExactValue } from './tiers/exactValue';
import { bossMaxHpForTier, bossRowForTier, enemyTierForRow, exchangeValueForTier,
  enemyPowerForTier, riflePowerForTier, rewardTierForRow, validTier, type TierPower } from './tiers/tierRules';
import type { BossSimulationState, EnemySimulationState, EnemyStreamSimulationState, ProjectileSimulationState, SimulationState, SimulationFrameState, StreamRewardSimulationState, UpgradeGateSimulationState, UpgradePickupSimulationState } from './SimulationState';
import { copySquadForPresentation, type PresentationEvent } from './PresentationEvent';
import { rifleHitRadiusBonusForTier } from './weapons/rifleHitRadius';
import { CatharsisConfigSchema, type CatharsisConfig } from '../config/catharsisConfig';
import { attackLanePositions, laneCompositionForRow, rewardLaneXForRow } from './enemies/laneComposition';

export interface SimulationOptions {
  catharsis?: { balance: CatharsisConfig; trackHalfWidth: number };
  seed: number;
  level: LevelDefinition;
  startSquad: number;
  startRocketCount: number;
  tiers: TierPower;
  rewardRowsPerReward?: number;
  bossHpScale?: number;
  collisionDiagnostics?: CollisionDiagnostics;
}

// Optional operation counts, kept outside serialized simulation state.
export interface CollisionDiagnostics {
  findFirstHitCalls: number;
  enemyCandidateChecks: number;
  projectilePasses: number;
  penetrationPasses: number;
}

export interface RuntimeBalance {
  rewardRowsPerReward: number;
  enemyHigherTierPowerMultiplier: number;
  rifleHigherTierPowerMultiplier: number;
  bossHpScale?: number;
}

export interface SimulationInput {
  targetX: number;
  throwGrenade?: boolean;
}

export interface SimulationTuning {
  moveSpeed: number;
  forwardSpeed: number;
  trackHalfWidth: number;
  defenseLineOffset: number;
  formationSpacing: number;
  memberRadius: number;
  normalEnemyRadius: number;
  bossRadius?: number;
  rifle: { fireRate: number; projectileSpeed: number; range: number;
    tierHitRadiusStep: number; maxHitRadiusBonus: number };
  rocket: { damage: number; fireRate: number; projectileSpeed: number; range: number; blastRadius: number };
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// Retain existing shot phases and place each new member in the largest gap.
function appendMemberClocks(clocks: number[], count: number, interval: number): void {
  while (clocks.length < count) {
    const phases = clocks.map(clock => clock % interval).sort((a, b) => a - b);
    let gap = -1, phase = interval / 2;
    phases.forEach((start, index) => {
      const end = phases[(index + 1) % phases.length] + (index === phases.length - 1 ? interval : 0);
      if (end - start > gap) { gap = end - start; phase = (start + gap / 2) % interval; }
    });
    clocks.push(phase || interval);
  }
}

function validateCatharsis(value: unknown): NonNullable<SimulationState['catharsis']> {
  if (!isPlainObject(value) || Object.keys(value).length !== (Object.hasOwn(value, 'rewardRowsPerReward') ? 3 : 2)) {
    throw new Error('Invalid lane experiment state');
  }
  const balance = CatharsisConfigSchema.parse(value.balance);
  const trackHalfWidth = value.trackHalfWidth as number;
  attackLanePositions(balance.laneCount, trackHalfWidth, balance.edgeInset);
  if (balance.rewardAimRadius >= trackHalfWidth - balance.edgeInset) {
    throw new Error('Reward aim radius must leave another lane to pursue');
  }
  const rewardRowsPerReward = value.rewardRowsPerReward;
  if (rewardRowsPerReward !== undefined && (!Number.isSafeInteger(rewardRowsPerReward)
    || (rewardRowsPerReward as number) <= 0)) throw new Error('Invalid experiment reward density');
  return { balance, trackHalfWidth,
    ...(rewardRowsPerReward !== undefined ? { rewardRowsPerReward: rewardRowsPerReward as number } : {}) };
}

type ProjectileHit = { kind: 'enemy'; enemy: EnemySimulationState; fraction: number; z: number }
  | { kind: 'grenadeSupply'; fraction: number; z: number }
  | { kind: 'boss'; boss: BossSimulationState; fraction: number; z: number }
  | { kind: 'streamReward'; reward: StreamRewardSimulationState; fraction: number; z: number }
  | { kind: 'gate'; gate: UpgradeGateSimulationState; fraction: number; z: number };

export function findFirstHit(projectile: ProjectileSimulationState, endZ: number,
  enemyCandidates: EnemyCandidateSource, boss: BossSimulationState | null,
  rewards: StreamRewardSimulationState[], gates: UpgradeGateSimulationState[],
  normalEnemyRadius: number,
  bossRadius: number | undefined,
  currentPlayerZ: number, nextPlayerZ: number, minimumFraction = 0,
  piercedEnemyIds?: ReadonlySet<number>, diagnostics?: CollisionDiagnostics,
  grenadeSupply?: GrenadeState['supply']): ProjectileHit | undefined {
  if (diagnostics) diagnostics.findFirstHitCalls++;
  let first: ProjectileHit | undefined;
  const travel = endZ - projectile.z;
  const minimumZ = projectile.z + travel * minimumFraction;
  const radius = normalEnemyRadius + (projectile.kind === 'rifle' ? projectile.hitRadiusBonus : 0);
  const laneShot = projectile.kind !== 'rocket' && projectile.lane !== undefined;
  enemyCandidates.forEachCandidate(laneShot ? -Infinity : projectile.x - radius, laneShot ? Infinity : projectile.x + radius,
    minimumZ - radius, endZ + radius, (enemy) => {
      if (piercedEnemyIds?.has(enemy.id)) return;
      if (laneShot && enemy.lane !== projectile.lane) return;
      if (diagnostics) diagnostics.enemyCandidateChecks++;
      const dx = projectile.x - enemy.x;
      if (!laneShot && Math.abs(dx) > radius) return;
      const halfChord = laneShot ? normalEnemyRadius : Math.sqrt(radius * radius - dx * dx);
      const entryZ = enemy.z - halfChord;
      const exitZ = enemy.z + halfChord;
      if (exitZ < minimumZ || entryZ > endZ) return;
      const hitZ = Math.max(minimumZ, entryZ);
      const fraction = travel === 0 ? 0 : (hitZ - projectile.z) / travel;
      if (!first || fraction < first.fraction
        || (fraction === first.fraction && first.kind === 'enemy' && enemy.id < first.enemy.id)) {
        first = { kind: 'enemy', enemy, fraction, z: hitZ };
      }
    });
  if (boss && bossRadius !== undefined && Math.abs(projectile.x - boss.x) <= bossRadius) {
    const dx = projectile.x - boss.x;
    const halfChord = Math.sqrt(bossRadius * bossRadius - dx * dx);
    const entryZ = boss.z - halfChord;
    const exitZ = boss.z + halfChord;
    if (exitZ >= minimumZ && entryZ <= endZ) {
      const hitZ = Math.max(minimumZ, entryZ);
      const fraction = travel === 0 ? 0 : (hitZ - projectile.z) / travel;
      if (!first || fraction <= first.fraction) first = { kind: 'boss', boss, fraction, z: hitZ };
    }
  }
  for (const reward of rewards) {
    if (projectile.kind === 'rocket') continue;
    const radius = normalEnemyRadius;
    const dx = projectile.x - reward.x;
    if (Math.abs(dx) > radius) continue;
    const halfChord = Math.sqrt(radius * radius - dx * dx);
    const entryZ = reward.z - halfChord;
    const exitZ = reward.z + halfChord;
    if (exitZ < minimumZ || entryZ > endZ) continue;
    const hitZ = Math.max(minimumZ, entryZ);
    const fraction = travel === 0 ? 0 : (hitZ - projectile.z) / travel;
    if (!first || fraction < first.fraction
      || (fraction === first.fraction && (first.kind === 'enemy'
        || (first.kind === 'streamReward' && reward.id < first.reward.id)))) {
      first = { kind: 'streamReward', reward, fraction, z: hitZ };
    }
  }
  for (const gate of gates) {
    if (Math.abs(projectile.x - gate.x) > gate.width / 2) continue;
    const gateStartZ = currentPlayerZ + gate.zOffset;
    const relativeTravel = travel - (nextPlayerZ - currentPlayerZ);
    if (projectile.z > gateStartZ || relativeTravel <= 0) continue;
    const fraction = (gateStartZ - projectile.z) / relativeTravel;
    if (fraction < minimumFraction || fraction > 1) continue;
    const hitZ = projectile.z + travel * fraction;
    // A gate wins an exact-distance tie so it cannot be shot through.
    if (!first || fraction < first.fraction
      || (fraction === first.fraction && (first.kind !== 'gate' || gate.id < first.gate.id))) {
      first = { kind: 'gate', gate, fraction, z: hitZ };
    }
  }
  if (grenadeSupply && projectile.kind !== 'rocket' && projectile.lane === grenadeSupply.lane) {
    const relativeTravel = travel - (nextPlayerZ - currentPlayerZ);
    const supplyZ = currentPlayerZ + grenadeSupply.depth;
    const fraction = (supplyZ - projectile.z) / relativeTravel;
    if (relativeTravel > 0 && fraction >= minimumFraction && fraction <= 1
      && (!first || fraction <= first.fraction)) first = { kind: 'grenadeSupply', fraction, z: supplyZ };
  }
  return first;
}

function segmentTouchesCircle(startX: number, startZ: number, endX: number, endZ: number,
  centerX: number, centerZ: number, radius: number): boolean {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((centerX - startX) * deltaX + (centerZ - startZ) * deltaZ) / lengthSquared));
  const distanceX = centerX - (startX + fraction * deltaX);
  const distanceZ = centerZ - (startZ + fraction * deltaZ);
  return distanceX * distanceX + distanceZ * distanceZ <= radius * radius;
}

function validLevelId(levelId: unknown): levelId is string {
  return typeof levelId === 'string' && levelId.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validSquadCount(count: unknown): count is number {
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
}

function extendEnemyStream(enemies: EnemySimulationState[], cursor: EnemyStreamSimulationState,
  stream: EnemyStreamDefinition, playerZ: number, power: TierPower,
  boss: BossSimulationState | null, bossHpScale: number,
  catharsis?: SimulationState['catharsis'], progression: ProgressionState = { level: 1, xp: 0 },
  postCapSurvival?: PostCapSurvivalState): BossSimulationState | null {
  const horizonZ = playerZ + (catharsis?.balance.defenseMode
    ? catharsis.balance.defenseSpawnAheadDistance : stream.spawnAheadDistance);
  if (!Number.isFinite(horizonZ)) throw new Error('Simulation enemy stream horizon is non-finite');
  while (true) {
    const rowZ = stream.startZ + cursor.nextRowIndex * stream.spacing;
    if (!Number.isFinite(rowZ)) throw new Error('Simulation enemy stream row position is non-finite');
    if (rowZ > horizonZ) break;
    const bossTier = cursor.nextBossTier;
    if (!catharsis?.balance.defenseMode && cursor.nextRowIndex === bossRowForTier(bossTier, stream.tierProgression)) {
      // One active Boss is supported; authored encounters must not overlap in play.
      if (boss) throw new Error('Simulation cannot spawn a Boss while another Boss is active');
      const maxHp = bossMaxHpForTier(bossTier, stream.tierProgression, power) * bossHpScale;
      if (!positiveFinite(maxHp)) throw new Error('Scaled Boss HP exceeds the supported range');
      if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) {
        throw new Error('Simulation Boss ID exceeds the supported range');
      }
      boss = { id: cursor.nextEnemyId++, tier: bossTier, x: 0, z: rowZ, hp: maxHp, maxHp,
        engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
      cursor.nextBossTier++;
      cursor.nextRowIndex++;
      continue;
    }
    if (!Number.isSafeInteger(cursor.nextRowIndex + 1)
      || !Number.isSafeInteger(cursor.nextEnemyId + stream.columns)) {
      throw new Error('Simulation enemy stream exceeds the supported range');
    }
    if (catharsis?.balance.defenseMode) {
      admitDefenseGroup(enemies, cursor, cursor.nextRowIndex, stream.seed,
        { ...catharsis.balance, ...pressureWaveSettings(catharsis.balance, progression),
          groupSize: pressureGroupSize(catharsis.balance, progression.level),
          ...postCapOrdinarySettings(catharsis.balance, postCapSurvival) }, catharsis.trackHalfWidth, rowZ);
      cursor.nextRowIndex++;
      continue;
    }
    const offsets = catharsis
      ? laneCompositionForRow(cursor.nextRowIndex, stream.seed, catharsis.balance.defenseMode
        ? { ...catharsis.balance, ...pressureWaveSettings(catharsis.balance, progression),
          groupSize: pressureGroupSize(catharsis.balance, progression.level) } : catharsis.balance, catharsis.trackHalfWidth)
      : createEnemyStreamRow(cursor.nextRowIndex, stream.columns,
        stream.columnSpacing ?? stream.spacing, stream.jitter, stream.seed);
    if (!Number.isSafeInteger(cursor.nextEnemyId + offsets.length)) throw new Error('Enemy group ID exceeds supported range');
    const rowIndex = cursor.nextRowIndex;
    let revealColumn = 0;
    for (let column = 1; column < offsets.length; column++) {
      if (Math.abs(offsets[column].x) < Math.abs(offsets[revealColumn].x)) revealColumn = column;
    }
    for (let column = 0; column < offsets.length; column++) {
      const offset = offsets[column];
      const z = rowZ + offset.z;
      if (!Number.isFinite(offset.x) || !Number.isFinite(z)) {
        throw new Error('Simulation enemy stream produces a non-finite position');
      }
      const tier = catharsis?.balance.defenseMode ? 1
        : enemyTierForRow(rowIndex, column, revealColumn, stream.seed, stream.tierProgression);
      const enemyId = cursor.nextEnemyId++;
      const archetype = 'archetype' in offset ? offset.archetype as 'grunt' | 'heavy' | 'giant' : undefined;
      enemies.push({ id: enemyId, tier, x: offset.x, z,
        hp: archetype ? (archetype === 'heavy' ? catharsis!.balance.heavyHp : 1) : enemyPowerForTier(tier, power),
        ...(archetype ? { archetype } : {}) });
      if ('lane' in offset) enemies.at(-1)!.lane = offset.lane as number;
    }
    cursor.nextRowIndex++;
  }
  return boss;
}

function extendRewardStream(rewards: StreamRewardSimulationState[], cursor: EnemyStreamSimulationState,
  stream: EnemyStreamDefinition, playerZ: number, catharsis?: SimulationState['catharsis'], playerX = 0): void {
  const definition = stream.rewards;
  if (catharsis?.balance.defenseMode) return;
  if (!definition) return;
  const horizonZ = playerZ + definition.spawnAheadDistance;
  if (!Number.isFinite(horizonZ)) throw new Error('Simulation reward stream horizon is non-finite');
  while (true) {
    const placement = rewardPlacementForBlock(cursor.nextRewardBlockIndex, stream.columns, definition);
    const rowZ = stream.startZ + placement.rowIndex * stream.spacing;
    if (!Number.isFinite(rowZ)) throw new Error('Simulation reward row position is non-finite');
    if (rowZ > horizonZ) break;
    const offsets = createEnemyStreamRow(placement.rowIndex, stream.columns,
      stream.columnSpacing ?? stream.spacing, stream.jitter, stream.seed);
    const z = rowZ + offsets[placement.zSlot].z;
    if (!Number.isFinite(z)) throw new Error('Simulation reward position is non-finite');
    if (placement.rowIndex >= cursor.nextRowIndex) {
      throw new Error('Simulation reward row must be generated after its enemy row');
    }
    if (!Number.isSafeInteger(cursor.nextRewardId + 1)
      || !Number.isSafeInteger(cursor.nextRewardBlockIndex + 1)) {
      throw new Error('Simulation reward stream exceeds the supported range');
    }
    rewards.push({ id: cursor.nextRewardId++, tier: rewardTierForRow(placement.rowIndex, stream.tierProgression),
      x: catharsis ? rewardLaneXForRow(placement.rowIndex, stream.seed, catharsis.balance,
        catharsis.trackHalfWidth, playerX) : placement.side * definition.sideX, z,
      hitProgress: 0, hitsRequired: definition.hitsRequired });
    cursor.nextRewardBlockIndex++;
  }
}

function validateState(value: unknown, mergeCount: number): { state: SimulationState; rng: SeededRng } {
  if (!isPlainObject(value)) {
    throw new Error('Simulation state must be a plain object');
  }
  const state = value;
  const fields = ['tick', 'elapsedSeconds', 'levelId', 'seed', 'rngState', 'player', 'squad', 'enemies', 'boss', 'enemyStream', 'streamRewards', 'gates', 'pickups', 'nextPickupId', 'projectiles', 'weapons'];
  if (Object.hasOwn(state, 'catharsis')) fields.push('catharsis');
  if (Object.hasOwn(state, 'progression')) fields.push('progression');
  if (Object.hasOwn(state, 'reinforcement')) fields.push('reinforcement');
  if (Object.hasOwn(state, 'giantEncounter')) fields.push('giantEncounter');
  if (Object.hasOwn(state, 'machineGunReleaseAtSeconds')) fields.push('machineGunReleaseAtSeconds');
  if (Object.hasOwn(state, 'landingAssault')) fields.push('landingAssault');
  if (Object.hasOwn(state, 'grenade')) fields.push('grenade');
  if (Object.hasOwn(state, 'postCapSurvival')) fields.push('postCapSurvival');
  if (Object.keys(state).length !== fields.length || fields.some((field) => !Object.hasOwn(state, field))) {
    throw new Error('Simulation state has missing or unknown fields');
  }
  const catharsis = Object.hasOwn(state, 'catharsis') ? validateCatharsis(state.catharsis) : undefined;
  const grenade = state.grenade === undefined ? undefined : GrenadeStateSchema.parse(state.grenade);
  if (grenade && (!catharsis?.balance.defenseMode
    || grenade.inventory > catharsis.balance.grenade.capacity
    || [grenade.lv3EnteredAtSeconds, grenade.supplySpawnedAtSeconds, grenade.acquiredAtSeconds,
      grenade.flight?.startedAtSeconds].some(t => t != null && t > (state.elapsedSeconds as number))
    || (grenade.supply && (grenade.supply.lane >= catharsis.balance.laneCount
      || Math.abs(grenade.supply.x - attackLanePositions(catharsis.balance.laneCount,
        catharsis.trackHalfWidth, catharsis.balance.edgeInset)[grenade.supply.lane]) > 1e-9))))
    throw new Error('Invalid Grenade snapshot');
  const progression = state.progression;
  // Disabled config discards even stale temporary state; old snapshots start fresh.
  const postCapSurvival = catharsis?.balance.defenseMode && catharsis.balance.postCapSurvival.enabled
    ? PostCapSurvivalStateSchema.parse(state.postCapSurvival ?? emptyPostCapSurvival()) : emptyPostCapSurvival();
  if (postCapSurvival.startedAtSeconds !== null && (postCapSurvival.startedAtSeconds > (state.elapsedSeconds as number)
    || !isPlainObject(progression) || (progression.level as number) < catharsis!.balance.postCapSurvival.startLevel
    || state.machineGunReleaseAtSeconds == null)) throw new Error('Invalid post-cap activation');
  if (progression !== undefined && (!catharsis?.balance.defenseMode || !isPlainObject(progression)
    || Object.keys(progression).length !== 2 || !Number.isSafeInteger(progression.level)
    || (progression.level as number) < 1 || !Number.isSafeInteger(progression.xp)
    || (progression.xp as number) < 0
    || ((progression.level as number) >= maxProgressionLevel(catharsis.balance.progression) && progression.xp !== 0)
    || (progression.xp as number) >= requiredXp(progression.level as number, catharsis.balance.progression))) {
    throw new Error('Simulation progression must have a valid level and current-level XP');
  }
  const landingAssault = state.landingAssault;
  if (landingAssault !== undefined && (!catharsis?.balance.defenseMode || !isPlainObject(landingAssault)
    || Object.keys(landingAssault).length !== (Object.hasOwn(landingAssault, 'nextGiantAtSeconds') ? 6 : 5) || !Number.isSafeInteger(landingAssault.waveIndex)
    || (landingAssault.waveIndex as number) < 0 || typeof landingAssault.secondGiantSpawned !== 'boolean'
    || !['reinforcementActiveAtSeconds', 'startedAtSeconds', 'nextWaveAtSeconds'].every(key =>
      landingAssault[key] === null || (typeof landingAssault[key] === 'number'
        && Number.isFinite(landingAssault[key]) && landingAssault[key] >= 0))
    || (landingAssault.reinforcementActiveAtSeconds !== null && (!isPlainObject(state.reinforcement)
      || state.reinforcement.arrived !== true || (landingAssault.reinforcementActiveAtSeconds as number) > (state.elapsedSeconds as number)))
    || (landingAssault.startedAtSeconds !== null && (landingAssault.reinforcementActiveAtSeconds === null
      || (landingAssault.startedAtSeconds as number) > (state.elapsedSeconds as number)
      || landingAssault.nextWaveAtSeconds === null
      || (landingAssault.startedAtSeconds as number) < (landingAssault.reinforcementActiveAtSeconds as number)
      || (landingAssault.nextWaveAtSeconds as number) < (landingAssault.startedAtSeconds as number)))
    || (landingAssault.startedAtSeconds === null && (landingAssault.nextWaveAtSeconds !== null
      || landingAssault.waveIndex !== 0 || landingAssault.secondGiantSpawned))
    || (Object.hasOwn(landingAssault, 'nextGiantAtSeconds') && !(landingAssault.nextGiantAtSeconds === null
      || (typeof landingAssault.nextGiantAtSeconds === 'number' && Number.isFinite(landingAssault.nextGiantAtSeconds)
        && landingAssault.secondGiantSpawned && landingAssault.startedAtSeconds !== null
        && landingAssault.nextGiantAtSeconds >= (landingAssault.startedAtSeconds as number)))))) throw new Error('Invalid landing assault state');
  const reinforcement = state.reinforcement;
  if (reinforcement !== undefined && (!catharsis?.balance.defenseMode || !isPlainObject(reinforcement)
    || Object.keys(reinforcement).length !== 2 || typeof reinforcement.arrived !== 'boolean'
    || !(reinforcement.startedAtSeconds === null || (typeof reinforcement.startedAtSeconds === 'number'
      && Number.isFinite(reinforcement.startedAtSeconds) && reinforcement.startedAtSeconds >= 0
      && reinforcement.startedAtSeconds <= (state.elapsedSeconds as number)))
    || (reinforcement.arrived && reinforcement.startedAtSeconds === null)
    || (reinforcement.startedAtSeconds !== null && (!isPlainObject(progression)
      || (progression.level as number) < catharsis.balance.progression.reinforcementLevel)))) {
    throw new Error('Invalid reinforcement state');
  }
  // An already-spawned threat may be forced by an art fixture below natural unlock.
  const giantEncounter = state.giantEncounter;
  const releaseAt = state.machineGunReleaseAtSeconds;
  if (releaseAt !== undefined && !catharsis?.balance.defenseMode) throw new Error('Release requires defense mode');
  if (releaseAt !== undefined && releaseAt !== null && (!catharsis?.balance.defenseMode
    || typeof releaseAt !== 'number' || !Number.isFinite(releaseAt) || releaseAt < 0
    || releaseAt > (state.elapsedSeconds as number) || !isPlainObject(progression)
    || (progression.level as number) < 6)) throw new Error('Invalid Machine Gun release state');
  if (giantEncounter !== undefined && (!catharsis?.balance.defenseMode || !isPlainObject(giantEncounter)
    || Object.keys(giantEncounter).length !== 2 || typeof giantEncounter.spawned !== 'boolean'
    || !(giantEncounter.scheduledAtSeconds === null || (typeof giantEncounter.scheduledAtSeconds === 'number'
      && Number.isFinite(giantEncounter.scheduledAtSeconds) && giantEncounter.scheduledAtSeconds >= 0))
    || (giantEncounter.spawned && giantEncounter.scheduledAtSeconds === null)
    || (giantEncounter.scheduledAtSeconds !== null && (!isPlainObject(progression)
      || (!giantEncounter.spawned && (progression.level as number) < catharsis.balance.giant.unlockLevel))))) {
    throw new Error('Invalid first Giant encounter state');
  }
  if (!Number.isSafeInteger(state.tick) || (state.tick as number) < 0) {
    throw new Error('Simulation tick must be a non-negative integer');
  }
  if (typeof state.elapsedSeconds !== 'number' || !Number.isFinite(state.elapsedSeconds) || state.elapsedSeconds < 0) {
    throw new Error('Simulation elapsedSeconds must be finite and non-negative');
  }
  if (!validLevelId(state.levelId)) throw new Error('Simulation levelId must be a non-empty string');

  const rng = new SeededRng(state.seed as number);
  rng.setState(state.rngState as number);

  if (!isPlainObject(state.player)) {
    throw new Error('Simulation player must be a plain object');
  }
  const player = state.player;
  const selectedLane = player.selectedLane;
  const laneIsValid = (lane: unknown): lane is number => typeof lane === 'number' && Number.isInteger(lane)
    && lane >= 0 && !!catharsis && lane < catharsis.balance.laneCount;
  if (Object.keys(player).length !== (selectedLane === undefined ? 2 : 3)
    || (selectedLane !== undefined && !laneIsValid(selectedLane))
    || (catharsis?.balance.defenseMode && selectedLane === undefined)
    || !Object.hasOwn(player, 'x') || !Object.hasOwn(player, 'z')) {
    throw new Error('Simulation player has missing or unknown fields');
  }
  if (typeof player.x !== 'number' || !Number.isFinite(player.x)) {
    throw new Error('Simulation player.x must be finite');
  }
  if (typeof player.z !== 'number' || !Number.isFinite(player.z)) {
    throw new Error('Simulation player.z must be finite');
  }

  if (!isPlainObject(state.squad)) {
    throw new Error('Simulation squad must be a plain object');
  }
  const squad = state.squad;
  if (Object.keys(squad).length !== 4 || !Object.hasOwn(squad, 'count')
    || !Object.hasOwn(squad, 'rocketCount') || !Object.hasOwn(squad, 'rifleCounts')
    || !Object.hasOwn(squad, 'rifleRemainder')) {
    throw new Error('Simulation squad has missing or unknown fields');
  }
  validateSquad(squad as unknown as SimulationState['squad'], mergeCount);
  if (progression && catharsis && (progression as {level:number}).level <= maxProgressionLevel(catharsis.balance.progression)
    && progressionStage((progression as {level:number}).level, catharsis.balance.progression).weaponFamily === 'machineGun'
    && ((squad.count as number) > progressionStage((progression as {level:number}).level, catharsis.balance.progression).squadStage
      || squad.rocketCount !== 0 || (squad.rifleCounts as number[]).slice(1).some(Boolean)
      || squad.rifleRemainder !== 0)) throw new Error('Machine Gun squad exceeds its unlocked stage or contains non-specialists');

  if (!Array.isArray(state.enemies)) throw new Error('Simulation enemies must be an array');
  const enemyIds = new Set<number>();
  const enemies: EnemySimulationState[] = state.enemies.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation enemy ${index} must be a plain object`);
    const archetype = value.archetype;
    if (Object.keys(value).length !== 5 + (archetype === undefined ? 0 : 1) + (value.lane === undefined ? 0 : 1)
      || (value.lane !== undefined && !laneIsValid(value.lane))
      || (catharsis?.balance.defenseMode && (!laneIsValid(value.lane) || value.tier !== 1))
      || (archetype !== undefined && archetype !== 'grunt' && archetype !== 'heavy' && archetype !== 'giant')
      || ['id', 'tier', 'x', 'z', 'hp'].some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation enemy ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0) {
      throw new Error(`Simulation enemy ${index} id must be a positive safe integer`);
    }
    const id = value.id as number;
    if (enemyIds.has(id)) throw new Error(`Simulation enemy id ${id} is duplicated`);
    enemyIds.add(id);
    if (!validTier(value.tier as number)) throw new Error(`Simulation enemy ${index} tier is invalid`);
    if (typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation enemy ${index} position must be finite`);
    }
    if (!positiveFinite(value.hp)) throw new Error(`Simulation enemy ${index} hp must be positive and finite`);
    if (catharsis && (!archetype || value.hp > (archetype === 'giant' ? catharsis.balance.giant.hp : archetype === 'heavy' ? catharsis.balance.heavyHp : 1))) {
      throw new Error(`Simulation enemy ${index} violates experiment health`);
    }
    return { id, tier: value.tier as number, x: value.x, z: value.z, hp: value.hp,
      ...(value.lane !== undefined ? { lane: value.lane as number } : {}),
      ...(archetype ? { archetype: archetype as 'grunt' | 'heavy' | 'giant' } : {}) };
  });

  if (enemies.filter(e => e.archetype === 'giant').length > 1
    || (enemies.some(e => e.archetype === 'giant') && !(giantEncounter as { spawned?: boolean } | undefined)?.spawned)) {
    throw new Error('Only one introduced Giant is supported');
  }
  let boss: BossSimulationState | null = null;
  if (state.boss !== null) {
    const value = state.boss;
    if (!isPlainObject(value) || Object.keys(value).length !== 9
      || ['id', 'tier', 'x', 'z', 'hp', 'maxHp', 'engaged', 'slamCooldownRemainingSeconds', 'slamCount']
        .some((field) => !Object.hasOwn(value, field))
      || !Number.isSafeInteger(value.id) || (value.id as number) <= 0
      || enemyIds.has(value.id as number) || !validTier(value.tier as number)
      || typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z)
      || !positiveFinite(value.hp) || !positiveFinite(value.maxHp)
      || value.hp > value.maxHp || typeof value.engaged !== 'boolean'
      || typeof value.slamCooldownRemainingSeconds !== 'number'
      || !Number.isFinite(value.slamCooldownRemainingSeconds)
      || value.slamCooldownRemainingSeconds < 0
      || (!value.engaged && (value.slamCooldownRemainingSeconds !== 0 || value.slamCount !== 0))
      || !Number.isSafeInteger(value.slamCount) || (value.slamCount as number) < 0) {
      throw new Error('Simulation Boss state is invalid');
    }
    boss = { id: value.id as number, tier: value.tier as number, x: value.x, z: value.z,
      hp: value.hp, maxHp: value.maxHp, engaged: value.engaged,
      slamCooldownRemainingSeconds: value.slamCooldownRemainingSeconds,
      slamCount: value.slamCount as number };
  }

  let enemyStream: EnemyStreamSimulationState | null = null;
  if (state.enemyStream !== null) {
    const cursor = state.enemyStream;
    if (!isPlainObject(cursor) || Object.keys(cursor).length !== 5
      || !Object.hasOwn(cursor, 'nextRowIndex') || !Object.hasOwn(cursor, 'nextEnemyId')
      || !Object.hasOwn(cursor, 'nextRewardBlockIndex') || !Object.hasOwn(cursor, 'nextRewardId')
      || !Object.hasOwn(cursor, 'nextBossTier')
      || !Number.isSafeInteger(cursor.nextRowIndex) || (cursor.nextRowIndex as number) < 0
      || !Number.isSafeInteger(cursor.nextEnemyId) || (cursor.nextEnemyId as number) <= 0
      || !Number.isSafeInteger(cursor.nextRewardBlockIndex) || (cursor.nextRewardBlockIndex as number) < 0
      || !Number.isSafeInteger(cursor.nextRewardId) || (cursor.nextRewardId as number) <= 0
      || !validTier(cursor.nextBossTier as number)
      || enemies.some((enemy) => enemy.id >= (cursor.nextEnemyId as number))
      || (boss && (boss.id >= (cursor.nextEnemyId as number) || cursor.nextBossTier === 1))) {
      throw new Error('Simulation enemy stream cursor is invalid');
    }
    enemyStream = { nextRowIndex: cursor.nextRowIndex as number,
      nextEnemyId: cursor.nextEnemyId as number,
      nextRewardBlockIndex: cursor.nextRewardBlockIndex as number,
      nextRewardId: cursor.nextRewardId as number,
      nextBossTier: cursor.nextBossTier as number };
  }
  if (boss && !enemyStream) throw new Error('Simulation Boss requires an enemy stream');

  if (!Array.isArray(state.streamRewards)) throw new Error('Simulation streamRewards must be an array');
  const rewardIds = new Set<number>();
  const streamRewards: StreamRewardSimulationState[] = state.streamRewards.map((value: unknown, index: number) => {
    if (!isPlainObject(value) || Object.keys(value).length !== 6
      || ['id', 'tier', 'x', 'z', 'hitProgress', 'hitsRequired'].some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation stream reward ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || rewardIds.has(value.id as number)) {
      throw new Error(`Simulation stream reward ${index} id is invalid or duplicated`);
    }
    rewardIds.add(value.id as number);
    if (!validTier(value.tier as number)) throw new Error(`Simulation stream reward ${index} tier is invalid`);
    if (typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation stream reward ${index} position is invalid`);
    }
    if (!Number.isSafeInteger(value.hitsRequired) || (value.hitsRequired as number) <= 0
      || !Number.isSafeInteger(value.hitProgress) || (value.hitProgress as number) < 0
      || (value.hitProgress as number) >= (value.hitsRequired as number)) {
      throw new Error(`Simulation stream reward ${index} hit progress is invalid`);
    }
    return { id: value.id as number, tier: value.tier as number, x: value.x, z: value.z,
      hitProgress: value.hitProgress as number, hitsRequired: value.hitsRequired as number };
  });
  if ((!enemyStream && streamRewards.length > 0)
    || (enemyStream && streamRewards.some((reward) => reward.id >= enemyStream.nextRewardId))) {
    throw new Error('Simulation stream reward allocator is invalid');
  }

  if (!Array.isArray(state.gates)) throw new Error('Simulation gates must be an array');
  const gateIds = new Set<string>();
  const gates: UpgradeGateSimulationState[] = state.gates.map((value: unknown, index: number) => {
    if (!isPlainObject(value) || Object.keys(value).length !== 6
      || ['id', 'x', 'zOffset', 'width', 'reward', 'hitProgress']
        .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation gate ${index} has missing or unknown fields`);
    }
    if (!validLevelId(value.id) || gateIds.has(value.id)) throw new Error(`Simulation gate ${index} id is invalid or duplicated`);
    gateIds.add(value.id);
    if (typeof value.x !== 'number' || !Number.isFinite(value.x)
      || !positiveFinite(value.zOffset) || !positiveFinite(value.width)) {
      throw new Error(`Simulation gate ${index} has invalid position or width`);
    }
    const parsedReward = UpgradeRewardSchema.safeParse(value.reward);
    if (!parsedReward.success) {
      throw new Error(`Simulation gate ${index} reward is invalid`);
    }
    const reward = parsedReward.data;
    if (!Number.isSafeInteger(value.hitProgress) || (value.hitProgress as number) < 0
      || (value.hitProgress as number) >= reward.hitsRequired) {
      throw new Error(`Simulation gate ${index} hitProgress is invalid`);
    }
    return { id: value.id, x: value.x, zOffset: value.zOffset, width: value.width,
      reward, hitProgress: value.hitProgress as number };
  });

  if (!Array.isArray(state.pickups)) throw new Error('Simulation pickups must be an array');
  const pickupIds = new Set<number>();
  const pickups: UpgradePickupSimulationState[] = state.pickups.map((value: unknown, index: number) => {
    if (!isPlainObject(value) || Object.keys(value).length !== 8
      || ['id', 'sourceGateId', 'x', 'zOffset', 'width', 'rewardKind', 'rewardAmount', 'dropSpeed']
        .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation pickup ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || pickupIds.has(value.id as number)) {
      throw new Error(`Simulation pickup ${index} id must be unique and positive`);
    }
    pickupIds.add(value.id as number);
    if (!validLevelId(value.sourceGateId) || typeof value.x !== 'number' || !Number.isFinite(value.x)
      || !positiveFinite(value.zOffset)
      || !positiveFinite(value.width) || (value.rewardKind !== 'rifle' && value.rewardKind !== 'tier2Rifle')
      || !Number.isSafeInteger(value.rewardAmount) || (value.rewardAmount as number) <= 0
      || !positiveFinite(value.dropSpeed)) {
      throw new Error(`Simulation pickup ${index} has invalid position or reward`);
    }
    return { id: value.id as number, sourceGateId: value.sourceGateId, x: value.x,
      zOffset: value.zOffset, width: value.width, rewardKind: value.rewardKind,
      rewardAmount: value.rewardAmount as number, dropSpeed: value.dropSpeed };
  });
  if (!Number.isSafeInteger(state.nextPickupId) || (state.nextPickupId as number) <= 0
    || pickups.some((pickup) => pickup.id >= (state.nextPickupId as number))) {
    throw new Error('Simulation nextPickupId must exceed active pickup IDs');
  }

  if (!Array.isArray(state.projectiles)) throw new Error('Simulation projectiles must be an array');
  const projectileIds = new Set<number>();
  const projectiles: ProjectileSimulationState[] = state.projectiles.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation projectile ${index} must be a plain object`);
    if (Object.keys(value).length !== 11 + (value.lane === undefined ? 0 : 2) + (value.memberIndex === undefined ? 0 : 1)
      || (value.memberIndex !== undefined && (value.kind === 'rocket' || value.lane === undefined
        || !Number.isSafeInteger(value.memberIndex) || (value.memberIndex as number) < 0))
      || (value.lane !== undefined && (!laneIsValid(value.lane) || value.kind === 'rocket'
        || typeof value.slopeX !== 'number' || !Number.isFinite(value.slopeX)))
      || ['id', 'kind', 'tier', 'x', 'z', 'speed', 'damage', 'remainingRange', 'blastRadius', 'hitRadiusBonus', 'penetrationRemaining']
      .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation projectile ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || projectileIds.has(value.id as number)) {
      throw new Error(`Simulation projectile ${index} id must be unique and positive`);
    }
    projectileIds.add(value.id as number);
    if (value.kind !== 'rifle' && value.kind !== 'machineGun' && value.kind !== 'rocket') {
      throw new Error(`Simulation projectile ${index} kind is unsupported`);
    }
    if (value.kind === 'rifle' ? !validTier(value.tier as number) : value.kind === 'machineGun' ? value.tier !== 1 : value.tier !== 0) {
      throw new Error(`Simulation projectile ${index} tier is invalid`);
    }
    if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation projectile ${index} position must be finite`);
    }
    if (!positiveFinite(value.speed) || !positiveFinite(value.damage) || !positiveFinite(value.remainingRange)) {
      throw new Error(`Simulation projectile ${index} speed, damage, and remainingRange must be positive and finite`);
    }
    if (typeof value.blastRadius !== 'number' || !Number.isFinite(value.blastRadius)
      || (value.kind !== 'rocket' && value.blastRadius !== 0)
      || (value.kind === 'rocket' && value.blastRadius <= 0)) {
      throw new Error(`Simulation projectile ${index} blastRadius is invalid for its kind`);
    }
    if (typeof value.hitRadiusBonus !== 'number' || !Number.isFinite(value.hitRadiusBonus)
      || value.hitRadiusBonus < 0 || (value.kind !== 'rifle' && value.hitRadiusBonus !== 0)) {
      throw new Error(`Simulation projectile ${index} hitRadiusBonus is invalid for its kind`);
    }
    let penetrationRemaining: bigint;
    try { penetrationRemaining = readExactValue(value.penetrationRemaining, 'Projectile penetration'); }
    catch { throw new Error(`Simulation projectile ${index} penetrationRemaining is invalid for its kind`); }
    if ((value.kind !== 'rifle' && penetrationRemaining !== 0n)
      || (value.kind === 'rifle' && ((value.tier === 1 && penetrationRemaining !== 0n)
        || (value.tier !== 1 && (penetrationRemaining < 1n
          || penetrationRemaining > exchangeValueForTier(value.tier as number, mergeCount)))))) {
      throw new Error(`Simulation projectile ${index} penetrationRemaining is invalid for its kind`);
    }
    return { id: value.id as number, kind: value.kind as ProjectileSimulationState['kind'],
      ...(value.memberIndex !== undefined ? { memberIndex: value.memberIndex as number } : {}),
      ...(value.lane !== undefined ? { lane: value.lane as number, slopeX: value.slopeX as number } : {}),
      tier: value.tier as number,
      x: value.x, z: value.z, speed: value.speed,
      damage: value.damage, remainingRange: value.remainingRange, blastRadius: value.blastRadius,
      hitRadiusBonus: value.hitRadiusBonus,
      penetrationRemaining: storeExactValue(penetrationRemaining) };
  });
  const weapons = state.weapons;
  if (!isPlainObject(weapons) || Object.keys(weapons).length !== 3 + (weapons.rifleMemberCooldowns === undefined ? 0 : 1)
    || ['rifleCooldownRemainingSeconds', 'rocketCooldownRemainingSeconds', 'nextProjectileId']
      .some((field) => !Object.hasOwn(weapons, field))) {
    throw new Error('Simulation weapons state has missing or unknown fields');
  }
  for (const key of ['rifleCooldownRemainingSeconds', 'rocketCooldownRemainingSeconds'] as const) {
    const cooldown = weapons[key];
    if (typeof cooldown !== 'number' || !Number.isFinite(cooldown) || cooldown < 0) {
      throw new Error(`Simulation ${key} must be finite and non-negative`);
    }
  }
  if (weapons.rifleMemberCooldowns !== undefined && (!catharsis?.balance.defenseMode
    || !Array.isArray(weapons.rifleMemberCooldowns)
    || weapons.rifleMemberCooldowns.length !== (squad.count as number) - (squad.rocketCount as number)
    || weapons.rifleMemberCooldowns.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0))) {
    throw new Error('Invalid Rifle member clocks');
  }
  const nextProjectileId = weapons.nextProjectileId;
  if (!Number.isSafeInteger(nextProjectileId) || (nextProjectileId as number) <= 0
    || projectiles.some((projectile) => projectile.id >= (nextProjectileId as number))) {
    throw new Error('Simulation weapons nextProjectileId must exceed active projectile IDs');
  }

  return {
    state: {
      ...(catharsis ? { catharsis } : {}),
      ...(catharsis?.balance.defenseMode ? { grenade: grenade ?? emptyGrenade() } : {}),
      ...(catharsis?.balance.defenseMode ? { postCapSurvival } : {}),
      // Older Lv6 snapshots already represent an established MG run; never inject a retroactive wave.
      ...(catharsis?.balance.defenseMode ? { machineGunReleaseAtSeconds: releaseAt === undefined
        ? ((progression?.level as number) >= 6 ? 0 : null) : releaseAt as number | null } : {}),
      ...(catharsis?.balance.defenseMode ? { landingAssault: landingAssault ? { ...landingAssault } as unknown as NonNullable<SimulationState['landingAssault']> : emptyLandingAssault() } : {}),
      ...(catharsis?.balance.defenseMode ? { reinforcement: reinforcement
        ? { startedAtSeconds: reinforcement.startedAtSeconds as number | null, arrived: reinforcement.arrived as boolean }
        : { startedAtSeconds: null, arrived: false } } : {}),
      ...(catharsis?.balance.defenseMode ? { giantEncounter: giantEncounter
        ? { scheduledAtSeconds: giantEncounter.scheduledAtSeconds as number | null, spawned: giantEncounter.spawned as boolean }
        : { scheduledAtSeconds: null, spawned: false } } : {}),
      ...(catharsis?.balance.defenseMode ? { progression: progression ? { level: progression.level as number, xp: progression.xp as number } : { level: 1, xp: 0 } } : {}),
      tick: state.tick as number,
      elapsedSeconds: state.elapsedSeconds,
      levelId: state.levelId,
      seed: state.seed as number,
      rngState: rng.getState(),
      player: { x: player.x as number, z: player.z as number,
        ...(selectedLane !== undefined ? { selectedLane: selectedLane as number } : {}) },
      squad: { count: squad.count as number, rocketCount: squad.rocketCount as number,
        rifleCounts: [...(squad.rifleCounts as number[])],
        rifleRemainder: storeExactValue(readExactValue(squad.rifleRemainder, 'Squad rifle remainder')) },
      enemies,
      boss,
      enemyStream,
      streamRewards,
      gates,
      pickups,
      nextPickupId: state.nextPickupId as number,
      projectiles,
      weapons: { ...(Array.isArray(weapons.rifleMemberCooldowns) ? { rifleMemberCooldowns: [...weapons.rifleMemberCooldowns] as number[] } : {}),
        rifleCooldownRemainingSeconds: weapons.rifleCooldownRemainingSeconds as number,
        rocketCooldownRemainingSeconds: weapons.rocketCooldownRemainingSeconds as number,
        nextProjectileId: nextProjectileId as number },
    },
    rng,
  };
}

export class Simulation {
  private readonly collisionDiagnostics: CollisionDiagnostics | undefined;
  private rng: SeededRng;
  private state: SimulationState;
  private enemyStreamDefinition: EnemyStreamDefinition | undefined;
  private readonly authoredEnemyStreamDefinition: EnemyStreamDefinition | undefined;
  private tiers: TierPower;
  private bossHpScale: number;
  private presentationEvents: PresentationEvent[] = [];
  private grenadeEvents: GrenadeEvent[] = [];
  private static readonly MAX_PRESENTATION_EVENTS = 256;

  constructor(options: SimulationOptions) {
    const catharsis = options.catharsis ? validateCatharsis({ ...options.catharsis,
      rewardRowsPerReward: options.rewardRowsPerReward ?? options.catharsis.balance.waveRows }) : undefined;
    this.collisionDiagnostics = options.collisionDiagnostics;
    this.rng = new SeededRng(options.seed);
    const level = LevelDefinitionSchema.parse(options.level);
    if (!validSquadCount(options.startSquad)) {
      throw new Error('Simulation startSquad must be a non-negative safe integer');
    }
    if (!validSquadCount(options.startRocketCount) || options.startRocketCount > options.startSquad) {
      throw new Error('Simulation startRocketCount must be a non-negative safe integer within startSquad');
    }
    if (!options.tiers || !Number.isSafeInteger(options.tiers.mergeCount) || options.tiers.mergeCount < 2
      || !positiveFinite(options.tiers.tier1Power) || !positiveFinite(options.tiers.tier2Power)
      || !Number.isFinite(options.tiers.enemyHigherTierPowerMultiplier)
      || options.tiers.enemyHigherTierPowerMultiplier <= 1
      || !Number.isFinite(options.tiers.rifleHigherTierPowerMultiplier)
      || options.tiers.rifleHigherTierPowerMultiplier <= 1
      || !positiveFinite(options.tiers.normalEnemyRadius)) throw new Error('Simulation tiers are invalid');
    if (options.rewardRowsPerReward !== undefined
      && (!Number.isSafeInteger(options.rewardRowsPerReward) || options.rewardRowsPerReward <= 0)) {
      throw new Error('Simulation reward rows per reward must be a positive safe integer');
    }
    this.bossHpScale = options.bossHpScale ?? 1;
    if (!Number.isFinite(this.bossHpScale) || this.bossHpScale < .25 || this.bossHpScale > 100) {
      throw new Error('Simulation Boss HP scale must be between 0.25 and 100');
    }
    this.authoredEnemyStreamDefinition = level.enemyStream;
    this.enemyStreamDefinition = this.effectiveStreamDefinition(options.seed,
      options.rewardRowsPerReward ?? catharsis?.balance.waveRows);
    this.tiers = { ...options.tiers };
    const enemies: EnemySimulationState[] = [];
    for (const group of level.enemyGroups) {
      for (const offset of createEnemyFormation(group.count, group.formation.columns,
        group.formation.spacing, group.formation.jitter, group.formation.seed)) {
        const z = group.z + offset.z;
        if (!Number.isFinite(offset.x) || !Number.isFinite(z)) {
          throw new Error(`Enemy group ${group.id} produces a non-finite position`);
        }
        enemies.push({
          id: enemies.length + 1,
          tier: 1,
          x: offset.x,
          z,
          hp: catharsis ? 1 : enemyPowerForTier(1, this.tiers),
          ...(catharsis ? { archetype: 'grunt' as const } : {}),
        });
      }
    }
    const streamRewards: StreamRewardSimulationState[] = [];
    const enemyStream = level.enemyStream
      ? { nextRowIndex: 0, nextEnemyId: enemies.length + 1, nextRewardBlockIndex: 0,
        nextRewardId: 1, nextBossTier: 1 }
      : null;
    let boss: BossSimulationState | null = null;
    if (enemyStream && this.enemyStreamDefinition) {
      boss = extendEnemyStream(enemies, enemyStream, this.enemyStreamDefinition,
        0, this.tiers, boss, this.bossHpScale, catharsis);
      extendRewardStream(streamRewards, enemyStream, this.enemyStreamDefinition, 0, catharsis);
    }
    this.state = {
      ...(catharsis ? { catharsis } : {}),
      ...(catharsis?.balance.defenseMode ? { grenade: emptyGrenade() } : {}),
      ...(catharsis?.balance.defenseMode ? { postCapSurvival: emptyPostCapSurvival() } : {}),
      ...(catharsis?.balance.defenseMode ? { progression: { level: 1, xp: 0 }, reinforcement: { startedAtSeconds: null, arrived: false } } : {}),
      ...(catharsis?.balance.defenseMode ? { landingAssault: emptyLandingAssault() } : {}),
      ...(catharsis?.balance.defenseMode ? { giantEncounter: { scheduledAtSeconds: null, spawned: false } } : {}),
      ...(catharsis?.balance.defenseMode ? { machineGunReleaseAtSeconds: null } : {}),
      tick: 0,
      elapsedSeconds: 0,
      levelId: level.id,
      seed: options.seed,
      rngState: this.rng.getState(),
      player: catharsis?.balance.defenseMode ? {
        x: attackLanePositions(catharsis.balance.laneCount, catharsis.trackHalfWidth, catharsis.balance.edgeInset)[Math.floor(catharsis.balance.laneCount / 2)],
        z: 0, selectedLane: Math.floor(catharsis.balance.laneCount / 2) } : { x: 0, z: 0 },
      squad: normalizeRifleSquad({ count: options.startSquad, rocketCount: options.startRocketCount,
        rifleCounts: [options.startSquad - options.startRocketCount], rifleRemainder: 0 }, this.tiers.mergeCount),
      enemies,
      boss,
      enemyStream,
      streamRewards,
      gates: level.upgradeGates.map((gate) => ({ ...gate, reward: { ...gate.reward }, hitProgress: 0 })),
      projectiles: [],
      pickups: [],
      nextPickupId: 1,
      weapons: { rifleCooldownRemainingSeconds: 0, rocketCooldownRemainingSeconds: 0, nextProjectileId: 1 },
    };
  }

  setRuntimeBalance(balance: RuntimeBalance): void {
    if (!Number.isSafeInteger(balance.rewardRowsPerReward) || balance.rewardRowsPerReward <= 0
      || !Number.isFinite(balance.enemyHigherTierPowerMultiplier)
      || balance.enemyHigherTierPowerMultiplier <= 1
      || !Number.isFinite(balance.rifleHigherTierPowerMultiplier)
      || balance.rifleHigherTierPowerMultiplier <= 1) {
      throw new Error('Simulation runtime balance is invalid');
    }
    const nextBossHpScale = balance.bossHpScale ?? this.bossHpScale;
    if (!Number.isFinite(nextBossHpScale) || nextBossHpScale < .25 || nextBossHpScale > 100) {
      throw new Error('Simulation Boss HP scale must be between 0.25 and 100');
    }
    const nextTiers = { ...this.tiers,
      enemyHigherTierPowerMultiplier: balance.enemyHigherTierPowerMultiplier,
      rifleHigherTierPowerMultiplier: balance.rifleHigherTierPowerMultiplier };
    const rescaleHp = nextTiers.enemyHigherTierPowerMultiplier
      !== this.tiers.enemyHigherTierPowerMultiplier;
    const enemies = !rescaleHp ? this.state.enemies : this.state.enemies.map((enemy) => {
      if (enemy.archetype) return enemy;
      const oldMax = enemyPowerForTier(enemy.tier, this.tiers);
      const nextMax = enemyPowerForTier(enemy.tier, nextTiers);
      return { ...enemy, hp: Math.min(nextMax, Math.max(0, enemy.hp / oldMax * nextMax)) };
    });
    const boss = (rescaleHp || nextBossHpScale !== this.bossHpScale)
      && this.state.boss && this.enemyStreamDefinition
      ? (() => {
        const nextMax = bossMaxHpForTier(this.state.boss!.tier,
          this.enemyStreamDefinition!.tierProgression, nextTiers) * nextBossHpScale;
        if (!positiveFinite(nextMax)) throw new Error('Scaled Boss HP exceeds the supported range');
        return { ...this.state.boss!, maxHp: nextMax,
          hp: Math.min(nextMax, Math.max(0, this.state.boss!.hp / this.state.boss!.maxHp * nextMax)) };
      })() : this.state.boss;
    const rewards = this.enemyStreamDefinition?.rewards;
    const cursor = this.state.enemyStream;
    let nextRewardBlockIndex = cursor?.nextRewardBlockIndex;
    if (rewards && cursor && rewards.rowsPerReward !== balance.rewardRowsPerReward) {
      const previousRow = cursor.nextRewardBlockIndex === 0 ? -1
        : rewardPlacementForBlock(cursor.nextRewardBlockIndex - 1,
          this.enemyStreamDefinition!.columns, rewards).rowIndex;
      const playerRow = Math.max(-1, Math.floor((this.state.player.z
        - this.enemyStreamDefinition!.startZ) / this.enemyStreamDefinition!.spacing));
      const activeRow = this.state.streamRewards.reduce((furthest, reward) => Math.max(furthest,
        Math.round((reward.z - this.enemyStreamDefinition!.startZ)
          / this.enemyStreamDefinition!.spacing)), -1);
      const processedRow = Math.max(previousRow, playerRow, activeRow);
      const nextDefinition = { ...rewards, rowsPerReward: balance.rewardRowsPerReward };
      nextRewardBlockIndex = Math.floor((processedRow + 1) / balance.rewardRowsPerReward);
      while (rewardPlacementForBlock(nextRewardBlockIndex,
        this.enemyStreamDefinition!.columns, nextDefinition).rowIndex <= processedRow) {
        nextRewardBlockIndex++;
      }
    }
    this.tiers = nextTiers;
    this.bossHpScale = nextBossHpScale;
    if (rewards) rewards.rowsPerReward = balance.rewardRowsPerReward;
    this.state = { ...this.state, enemies, boss,
      ...(this.state.catharsis ? { catharsis: { ...this.state.catharsis,
        rewardRowsPerReward: balance.rewardRowsPerReward } } : {}),
      enemyStream: cursor ? { ...cursor, nextRewardBlockIndex: nextRewardBlockIndex! } : null };
  }

  setCatharsisBalance(balance: CatharsisConfig): void {
    const previous = this.state.catharsis;
    if (!previous) throw new Error('Lane experiment is not active');
    const next = validateCatharsis({ ...previous, balance });
    const progression = this.state.progression
      ? grantXp(this.state.progression, 0, next.balance.progression) : undefined;
    const evolves = progression && this.state.progression && this.state.squad.count > 0
      && progressionStage(this.state.progression.level, previous.balance.progression).weaponFamily !== 'machineGun'
      && progressionStage(progression.level, next.balance.progression).weaponFamily === 'machineGun';
    // Live XP/plan edits must retain the same family/squad invariant as a kill.
    const evolvedCount = progression ? progressionStage(progression.level, next.balance.progression).squadStage : 1;
    const evolved: Partial<SimulationState> = evolves ? {
      squad: { count: evolvedCount, rocketCount: 0, rifleCounts: [evolvedCount], rifleRemainder: 0 }, projectiles: [],
      weapons: { ...this.state.weapons, rifleCooldownRemainingSeconds: 1 / next.balance.machineGun.fireRate,
        rocketCooldownRemainingSeconds: 0, rifleMemberCooldowns: [1 / next.balance.machineGun.fireRate] },
    } : {};
    if (evolves) appendMemberClocks(evolved.weapons!.rifleMemberCooldowns!, evolvedCount, 1 / next.balance.machineGun.fireRate);
    else if (progression && this.state.progression && this.state.squad.count > 0
      && progression.level > this.state.progression.level
      && progressionStage(progression.level, next.balance.progression).weaponFamily === 'machineGun') {
      const delta = evolvedCount - progressionStage(this.state.progression.level, previous.balance.progression).squadStage;
      if (delta > 0) {
        evolved.squad = addRifleSoldiers(this.state.squad, delta, 1, this.tiers.mergeCount);
        const clocks = [...(this.state.weapons.rifleMemberCooldowns ?? [this.state.weapons.rifleCooldownRemainingSeconds])];
        appendMemberClocks(clocks, evolved.squad.count, 1 / next.balance.machineGun.fireRate);
        evolved.weapons = { ...this.state.weapons, rifleMemberCooldowns: clocks };
      }
    }
    this.state = { ...this.state, ...evolved, catharsis: next, ...(progression ? { progression } : {}), enemies: this.state.enemies.map((enemy) =>
      enemy.archetype === 'heavy' ? { ...enemy,
        hp: enemy.hp / previous.balance.heavyHp * next.balance.heavyHp }
        : enemy.archetype === 'giant' ? { ...enemy, hp: enemy.hp / previous.balance.giant.hp * next.balance.giant.hp } : enemy) };
  }

  // Return whether this direction can repeat; moving onto an edge stops input timers.
  stepLane(direction: -1 | 1): boolean {
    const experiment = this.state.catharsis;
    if (!experiment?.balance.defenseMode || (direction !== -1 && direction !== 1)) throw new Error('Invalid lane step');
    if (this.state.squad.count === 0) return false;
    const selectedLane = Math.max(0, Math.min(experiment.balance.laneCount - 1, this.state.player.selectedLane! + direction));
    if (selectedLane === this.state.player.selectedLane) return false;
    this.state = { ...this.state, player: { ...this.state.player, selectedLane } };
    return selectedLane + direction >= 0 && selectedLane + direction < experiment.balance.laneCount;
  }

  step(dtSeconds: number, input: SimulationInput, tuning: SimulationTuning): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      throw new Error('Simulation dtSeconds must be finite and greater than zero');
    }
    if (!input || !Number.isFinite(input.targetX)) {
      throw new Error('Simulation targetX must be finite');
    }
    if (!tuning || !Number.isFinite(tuning.moveSpeed) || tuning.moveSpeed < 0) {
      throw new Error('Simulation moveSpeed must be finite and non-negative');
    }
    if (!Number.isFinite(tuning.forwardSpeed) || tuning.forwardSpeed < 0) {
      throw new Error('Simulation forwardSpeed must be finite and non-negative');
    }
    if (!Number.isFinite(tuning.trackHalfWidth) || tuning.trackHalfWidth <= 0) {
      throw new Error('Simulation trackHalfWidth must be finite and greater than zero');
    }
    if (!positiveFinite(tuning.defenseLineOffset)) {
      throw new Error('Simulation defenseLineOffset must be finite and greater than zero');
    }
    if (!positiveFinite(tuning.formationSpacing) || !positiveFinite(tuning.memberRadius)
      || !positiveFinite(tuning.normalEnemyRadius)) {
      throw new Error('Simulation formationSpacing, memberRadius, and enemy radii must be positive and finite');
    }
    if (this.enemyStreamDefinition && !positiveFinite(tuning.bossRadius)) {
      throw new Error('Simulation bossRadius must be positive and finite for a Boss level');
    }
    if (!tuning.rifle || !positiveFinite(tuning.rifle.fireRate)
      || !positiveFinite(tuning.rifle.projectileSpeed) || !positiveFinite(tuning.rifle.range)
      || !Number.isFinite(tuning.rifle.tierHitRadiusStep) || tuning.rifle.tierHitRadiusStep < 0
      || !Number.isFinite(tuning.rifle.maxHitRadiusBonus) || tuning.rifle.maxHitRadiusBonus < 0) {
      throw new Error('Simulation rifle tuning must be positive and finite');
    }
    if (!tuning.rocket || !positiveFinite(tuning.rocket.damage) || !positiveFinite(tuning.rocket.fireRate)
      || !positiveFinite(tuning.rocket.projectileSpeed) || !positiveFinite(tuning.rocket.range)
      || !positiveFinite(tuning.rocket.blastRadius)) {
      throw new Error('Simulation rocket tuning must be positive and finite');
    }
    if (this.state.squad.count === 0) return;
    const nextElapsedSeconds = this.state.elapsedSeconds + dtSeconds;
    if (!Number.isFinite(nextElapsedSeconds) || !Number.isSafeInteger(this.state.tick + 1)) {
      throw new Error('Simulation time or tick exceeds the supported range');
    }

    // Full steering reaches the outer attack corridor instead of overshooting
    // its narrow rifle collision width. Drag remains continuous between lanes.
    const halfWidth = this.state.catharsis
      ? this.state.catharsis.trackHalfWidth - this.state.catharsis.balance.edgeInset : tuning.trackHalfWidth;
    const currentX = Math.max(-halfWidth, Math.min(halfWidth, this.state.player.x));
    const lanePositions = this.state.catharsis?.balance.defenseMode
      ? attackLanePositions(this.state.catharsis.balance.laneCount, this.state.catharsis.trackHalfWidth, this.state.catharsis.balance.edgeInset) : undefined;
    const targetX = lanePositions ? lanePositions[this.state.player.selectedLane!] : Math.max(-halfWidth, Math.min(halfWidth, input.targetX));
    const maxHorizontalDelta = (lanePositions ? (lanePositions[1] - lanePositions[0]) / this.state.catharsis!.balance.laneSwitchSeconds : tuning.moveSpeed) * dtSeconds;
    const difference = targetX - currentX;
    const nextX = Math.abs(difference) <= maxHorizontalDelta
      ? targetX
      : currentX + Math.sign(difference) * maxHorizontalDelta;
    const proposedNextZ = this.state.player.z + tuning.forwardSpeed * dtSeconds;
    const offsets = createDefenseSquadFormation(this.state.squad.count, tuning.formationSpacing, this.state.catharsis?.balance.defenseMode ? this.state.catharsis.balance.progression : undefined);
    const currentBoss = this.state.boss;
    const bossContact = currentBoss && !currentBoss.engaged && (
      currentBoss.z <= proposedNextZ - tuning.defenseLineOffset
      || offsets.some((offset) =>
        segmentTouchesCircle(this.state.player.x + offset.x, this.state.player.z + offset.z,
          nextX + offset.x, proposedNextZ + offset.z, currentBoss.x, currentBoss.z,
          tuning.memberRadius + tuning.bossRadius!)));
    const justEngaged = Boolean(bossContact);
    const nextZ = currentBoss?.engaged || bossContact ? this.state.player.z : proposedNextZ;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) {
      throw new Error('Simulation movement exceeds the supported range');
    }
    if (this.state.gates.some((gate) => !Number.isFinite(this.state.player.z + gate.zOffset)
      || !Number.isFinite(nextZ + gate.zOffset))) {
      throw new Error('Simulation armory position exceeds the supported range');
    }
    const catharsis = this.state.catharsis;
    const grenade = this.state.grenade ? structuredClone(this.state.grenade) : undefined;
    const grenadeConfig = catharsis?.balance.grenade;
    if (input.throwGrenade && grenade && grenade.inventory > 0 && !grenade.flight && grenadeConfig) {
      const target = grenadeTarget(this.state, grenadeConfig);
      if (target) {
        grenade.inventory -= 1;
        grenade.flight = { startX: this.state.player.x, startZ: this.state.player.z,
          targetX: target.x, targetZ: target.z, startedAtSeconds: this.state.elapsedSeconds,
          flightSeconds: grenadeConfig.flightSeconds, damageEnemyHp: grenadeConfig.damageEnemyHp,
          blastRadius: grenadeConfig.blastRadius };
      }
    }
    const enemies = this.state.enemies.map((enemy) => ({ ...enemy,
      z: enemy.z - (catharsis && !currentBoss?.engaged && !bossContact && enemy.archetype
        ? enemyApproachSpeed(enemy, catharsis.balance) * dtSeconds : 0) }));
    let progression = this.state.progression;
    const awardKill = (enemy: EnemySimulationState): number => {
      if (!progression || !catharsis?.balance.defenseMode) return 0;
      const amount = enemy.archetype === 'giant' ? catharsis.balance.giant.xp
        : enemy.archetype === 'heavy' ? catharsis.balance.progression.heavyKillXp : catharsis.balance.progression.gruntKillXp;
      progression = grantXp(progression, amount, catharsis.balance.progression);
      return amount; // Nominal kill reward; grantXp alone owns overflow and cap semantics.
    };
    const stepEvents: PresentationEvent[] = [];
    let boss = this.state.boss ? { ...this.state.boss } : null;
    if (boss && justEngaged) {
      boss.engaged = true;
      boss.slamCooldownRemainingSeconds = 0.6;
    }
    const streamRewards = this.state.streamRewards.map((reward) => ({ ...reward }));
    const enemyStream = this.state.enemyStream ? { ...this.state.enemyStream } : null;
    let landingAssault = this.state.landingAssault ? { ...this.state.landingAssault } : undefined;
    // Old snapshots with an already-arrived reinforcement receive the full reward window on load.
    if (landingAssault && this.state.reinforcement?.arrived && landingAssault.reinforcementActiveAtSeconds === null)
      landingAssault.reinforcementActiveAtSeconds = this.state.elapsedSeconds;
    const legacyReinforcement = progression && catharsis
      && progression.level > maxProgressionLevel(catharsis.balance.progression);
    const assaultDue = legacyReinforcement && catharsis?.balance.landingAssault.enabled && landingAssault?.reinforcementActiveAtSeconds !== null
      && landingAssault?.reinforcementActiveAtSeconds !== undefined
      && nextElapsedSeconds + 1e-9 >= landingAssault.reinforcementActiveAtSeconds + catharsis.balance.landingAssault.powerWindowSeconds;
    if (enemyStream && this.enemyStreamDefinition && !boss?.engaged && !assaultDue) {
      boss = extendEnemyStream(enemies, enemyStream, this.enemyStreamDefinition,
        nextZ, this.tiers, boss, this.bossHpScale, catharsis, progression, this.state.postCapSurvival);
      extendRewardStream(streamRewards, enemyStream, this.enemyStreamDefinition, nextZ, catharsis, nextX);
    }
    let giantEncounter = this.state.giantEncounter;
    if (landingAssault && catharsis && enemyStream && this.enemyStreamDefinition && assaultDue) {
      const interval = this.enemyStreamDefinition.spacing * catharsis.balance.waveRows / tuning.forwardSpeed;
      // Consume dormant legacy rows without spawning: disabling the experiment later must not
      // dump a backlog of distance-based waves into the restored beach.
      const nextRow = Math.floor((nextZ + catharsis.balance.defenseSpawnAheadDistance
        - this.enemyStreamDefinition.startZ) / this.enemyStreamDefinition.spacing) + 1;
      if (!Number.isSafeInteger(nextRow)) throw new Error('Landing stream row exceeds supported range');
      enemyStream.nextRowIndex = Math.max(enemyStream.nextRowIndex, nextRow);
      // A paused approach cannot generate an infinite/zero cadence; wait until it resumes.
      if (tuning.forwardSpeed > 0) landingAssault = advanceLandingAssault(landingAssault, nextElapsedSeconds,
        nextZ, catharsis.balance, catharsis.trackHalfWidth, this.enemyStreamDefinition.seed, interval, enemies, enemyStream);
    }
    const enemyCollisionIndex = new EnemyCollisionIndex(enemies);
    // Every player damage source shares exactly one lethal-removal / XP boundary.
    const damageEnemy = (enemy: EnemySimulationState, damageEnemyHp: number): number => {
      if (enemy.hp <= 0) return 0;
      enemy.hp -= damageEnemyHp;
      if (enemy.hp <= 0) {
        enemies.splice(enemies.indexOf(enemy), 1);
        enemyCollisionIndex.remove(enemy);
        return awardKill(enemy);
      }
      return 0;
    };
    if (grenade && grenadeConfig && grenade.lv3EnteredAtSeconds !== null
      && grenade.supplySpawnedAtSeconds === null
      && nextElapsedSeconds + 1e-9 >= grenade.lv3EnteredAtSeconds + grenadeConfig.supplyDelaySeconds) {
      grenade.supplySpawnedAtSeconds = nextElapsedSeconds;
      grenade.supply = placeGrenadeSupply({ ...this.state, enemies, player: { ...this.state.player, z: nextZ } }, grenadeConfig);
    }
    const gates = this.state.gates.map((gate) => ({ ...gate, reward: { ...gate.reward } }));
    let squad = { ...this.state.squad };
    const projectiles = this.state.projectiles.map((projectile) => ({ ...projectile }));
    let nextProjectileId = this.state.weapons.nextProjectileId;
    const rifleEnd = this.state.squad.count - this.state.squad.rocketCount;
    const nextCooldowns = { rifle: this.state.weapons.rifleCooldownRemainingSeconds,
      rocket: this.state.weapons.rocketCooldownRemainingSeconds };
    const memberCooldowns: number[] | undefined = catharsis?.balance.defenseMode ? [] : undefined;
    // Fire before travel; projectiles created this tick travel for this full fixed step.
    for (const kind of ['rifle', 'rocket'] as const) {
      const startIndex = kind === 'rifle' ? 0 : rifleEnd;
      const endIndex = kind === 'rifle' ? rifleEnd : offsets.length;
      const machineGun = kind === 'rifle' && progression && catharsis?.balance.defenseMode
        && progressionStage(progression.level, catharsis.balance.progression).weaponFamily === 'machineGun';
      const weapon = machineGun ? catharsis!.balance.machineGun : tuning[kind];
      const fireRate = kind === 'rifle' && progression && catharsis
        ? effectivePrimaryFireRate(tuning.rifle.fireRate, progression.level, catharsis.balance) : weapon.fireRate;
      const interval = 1 / fireRate;
      if (!positiveFinite(interval)) throw new Error('Simulation fire interval exceeds the supported range');
      if (startIndex === endIndex) {
        nextCooldowns[kind] = 0;
        continue;
      }
      const schedules = kind === 'rifle' && memberCooldowns ? Array.from({ length: endIndex }, (_, index) => ({
        start: index, end: index + 1, cooldown: index === 0 ? nextCooldowns.rifle : this.state.weapons.rifleMemberCooldowns?.[index]
          ?? (nextCooldowns.rifle + index * interval / endIndex),
      })) : [{ start: startIndex, end: endIndex, cooldown: nextCooldowns[kind] }];
      for (const schedule of schedules) {
        let cooldown = schedule.cooldown - dtSeconds;
        // A malformed direct step must not turn into an unbounded catch-up loop.
        if (cooldown <= 0 && Math.floor(-cooldown / interval) + 1 > 10_000) {
          throw new Error('Simulation step requests too many weapon volleys');
        }
        while (cooldown <= 0) {
          for (let index = schedule.start; index < schedule.end; index++) {
            const offset = offsets[index];
            let tier = 0;
            if (kind === 'rifle') {
              let roleIndex = index;
              for (let tierIndex = 0; tierIndex < this.state.squad.rifleCounts.length; tierIndex++) {
                roleIndex -= this.state.squad.rifleCounts[tierIndex];
                if (roleIndex < 0) { tier = tierIndex + 1; break; }
              }
            }
            if (machineGun) tier = 1;
            const damage = machineGun ? catharsis!.balance.machineGun.damageEnemyHp * this.tiers.tier1Power
              : kind === 'rifle' ? riflePowerForTier(tier, this.tiers) : tuning.rocket.damage;
            if (!positiveFinite(damage)) throw new Error('Simulation rifle damage exceeds the supported range');
            if (!Number.isSafeInteger(nextProjectileId) || nextProjectileId <= 0) throw new Error('Simulation projectile ID exceeds the supported range');
            const x = nextX + offset.x;
            const z = nextZ + offset.z;
            const lane = catharsis?.balance.defenseMode && kind === 'rifle' ? this.state.player.selectedLane : undefined;
            const target = lane === undefined ? undefined : enemies.filter((enemy) => enemy.lane === lane && enemy.z > z
              && enemy.z - z <= weapon.range).sort((a, b) => a.z - b.z || a.id - b.id)[0];
            const slopeX = target ? (target.x - x) / Math.max(tuning.normalEnemyRadius, target.z - z) : 0;
            if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Simulation projectile origin is non-finite');
            projectiles.push({ id: nextProjectileId++, kind: machineGun ? 'machineGun' : kind, tier, x, z, speed: weapon.projectileSpeed,
              ...(lane !== undefined ? { lane, slopeX, memberIndex: index } : {}),
              damage, remainingRange: weapon.range,
              blastRadius: kind === 'rocket' ? tuning.rocket.blastRadius : 0,
              hitRadiusBonus: kind === 'rifle' && !machineGun ? rifleHitRadiusBonusForTier(tier,
                tuning.rifle.tierHitRadiusStep, tuning.rifle.maxHitRadiusBonus) : 0,
              penetrationRemaining: tier > 1
                ? storeExactValue(exchangeValueForTier(tier, this.tiers.mergeCount)) : 0 });
          }
          cooldown += interval;
          if (!Number.isFinite(cooldown)) throw new Error('Simulation weapon cooldown exceeds the supported range');
        }
        if (kind === 'rifle' && memberCooldowns) memberCooldowns[schedule.start] = cooldown;
        if (schedule.start === startIndex) nextCooldowns[kind] = cooldown;
      }
    }
    if (!Number.isSafeInteger(nextProjectileId)) throw new Error('Simulation projectile ID exceeds the supported range');

    const survivingProjectiles: ProjectileSimulationState[] = [];
    const travelingPickups = this.state.pickups.map((pickup) => ({ pickup: { ...pickup }, travelSeconds: dtSeconds }));
    let nextPickupId = this.state.nextPickupId;
    for (const projectile of projectiles) {
      if (this.collisionDiagnostics) this.collisionDiagnostics.projectilePasses++;
      const travel = Math.min(projectile.speed * dtSeconds, projectile.remainingRange);
      const endZ = projectile.z + travel;
      if (!Number.isFinite(travel) || !Number.isFinite(endZ)) throw new Error('Simulation projectile movement exceeds the supported range');
      let penetrationRemaining = readExactValue(projectile.penetrationRemaining, 'Projectile penetration');
      let minimumFraction = 0;
      let consumed = false;
      const piercedEnemyIds = projectile.tier > 1 ? new Set<number>() : undefined;
      while (true) {
        // Rewards require the squad center to defend their corridor; wide merged
        // formations cannot collect a remote crate incidentally.
        const aimedRewards = catharsis ? streamRewards.filter((reward) =>
          Math.abs(nextX - reward.x) <= catharsis.balance.rewardAimRadius) : streamRewards;
        const hit = findFirstHit(projectile, endZ, enemyCollisionIndex, boss, aimedRewards, gates,
          tuning.normalEnemyRadius,
          tuning.bossRadius,
          this.state.player.z, nextZ, minimumFraction, piercedEnemyIds, this.collisionDiagnostics, grenade?.supply);
        if (!hit) break;
        if (hit.kind === 'grenadeSupply') {
          const rewardAmount = grenade!.supply!.rewardAmount;
          grenade!.supply = null;
          grenade!.inventory = rewardAmount === undefined ? grenadeConfig!.capacity
            : Math.min(grenadeConfig!.capacity, grenade!.inventory + rewardAmount);
          grenade!.acquiredAtSeconds ??= nextElapsedSeconds;
          this.grenadeEvents.push({ kind: 'grenadeAcquired' });
        } else if (hit.kind === 'gate') {
          hit.gate.hitProgress++;
          if (hit.gate.hitProgress === hit.gate.reward.hitsRequired) {
            hit.gate.hitProgress = 0;
            if (!Number.isSafeInteger(nextPickupId + 1)) {
              throw new Error('Simulation pickup ID exceeds the supported range');
            }
            travelingPickups.push({ pickup: { id: nextPickupId++, sourceGateId: hit.gate.id,
              x: hit.gate.x, zOffset: hit.gate.zOffset, width: hit.gate.width,
              rewardKind: hit.gate.reward.kind, rewardAmount: hit.gate.reward.amount,
              dropSpeed: hit.gate.reward.dropSpeed }, travelSeconds: 0 });
          }
        } else if (hit.kind === 'streamReward') {
          hit.reward.hitProgress++;
          if (hit.reward.hitProgress === hit.reward.hitsRequired) {
            streamRewards.splice(streamRewards.indexOf(hit.reward), 1);
            squad = addRifleSoldiers(squad, 1, hit.reward.tier, this.tiers.mergeCount);
          }
        } else if (hit.kind === 'boss') {
          hit.boss.hp -= projectile.damage;
          if (hit.boss.hp <= 0) boss = null;
        } else if (projectile.kind !== 'rocket') {
          // Keep the retained tier/Boss power economy intact while expressing
          // experiment health in Tier-1 rifle-hit units (Grunt = one hit).
          damageEnemy(hit.enemy, hit.enemy.archetype ? projectile.damage / this.tiers.tier1Power : projectile.damage);
          const penetrationCost = projectile.tier > hit.enemy.tier
            ? exchangeValueForTier(hit.enemy.tier, this.tiers.mergeCount) : 0n;
          if (penetrationCost > 0n) {
            penetrationRemaining -= penetrationCost;
            if (penetrationRemaining > 0n) {
              // The cursor keeps the original step time for moving gates. Skipping
              // this enemy also handles overlapping circles and exact-position ties.
              minimumFraction = hit.fraction;
              piercedEnemyIds!.add(hit.enemy.id);
              if (this.collisionDiagnostics) this.collisionDiagnostics.penetrationPasses++;
              continue;
            }
          }
        }
        if (projectile.kind === 'rocket' && hit.kind !== 'streamReward' && hit.kind !== 'grenadeSupply') {
          const radiusSquared = projectile.blastRadius * projectile.blastRadius;
          const blastX = hit.kind === 'gate' ? projectile.x : hit.kind === 'boss' ? hit.boss.x : hit.enemy.x;
          const blastZ = hit.kind === 'gate' ? hit.z : hit.kind === 'boss' ? hit.boss.z : hit.enemy.z;
          // Only enemies receive blast damage; ID order makes multi-target resolution stable.
          for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
            const dx = enemy.x - blastX;
            const dz = enemy.z - blastZ;
            if (dx * dx + dz * dz <= radiusSquared) {
              damageEnemy(enemy, projectile.damage);
            }
          }
        }
        consumed = true;
        break;
      }
      const remainingRange = projectile.remainingRange - travel;
      if (!consumed && remainingRange > 0) {
        survivingProjectiles.push({ ...projectile, x: projectile.x + travel * (projectile.slopeX ?? 0), z: endZ, remainingRange,
          penetrationRemaining: storeExactValue(penetrationRemaining > 0n ? penetrationRemaining : 0n) });
      }
    }
    if (grenade?.flight && nextElapsedSeconds + 1e-9 >= grenade.flight.startedAtSeconds + grenade.flight.flightSeconds) {
      const flight = grenade.flight;
      const victims = enemiesInBlast(enemies, flight.targetX, flight.targetZ, flight.blastRadius).map(enemy => {
        const damage = Math.min(enemy.hp, flight.damageEnemyHp);
        const killXp = damageEnemy(enemy, flight.damageEnemyHp);
        return { id: enemy.id, archetype: enemy.archetype!, damage, killed: enemy.hp <= 0, killXp };
      });
      this.grenadeEvents.push({ kind: 'grenadeDetonated', x: flight.targetX, z: flight.targetZ, radius: flight.blastRadius, victims });
      grenade.flight = null;
    }
    const survivingPickups: UpgradePickupSimulationState[] = [];
    for (const { pickup, travelSeconds } of travelingPickups.sort((a, b) => a.pickup.id - b.pickup.id)) {
      const endOffset = pickup.zOffset - pickup.dropSpeed * travelSeconds;
      if (!Number.isFinite(endOffset)) throw new Error('Simulation pickup movement exceeds the supported range');
      if (endOffset > 0) {
        survivingPickups.push({ ...pickup, zOffset: endOffset });
        continue;
      }
      const crossingFraction = (dtSeconds - travelSeconds + pickup.zOffset / pickup.dropSpeed) / dtSeconds;
      const playerXAtCrossing = this.state.player.x + (nextX - this.state.player.x) * crossingFraction;
      if (Math.abs(playerXAtCrossing - pickup.x) <= pickup.width / 2) {
        squad = addRifleSoldiers(squad, pickup.rewardAmount,
          pickup.rewardKind === 'tier2Rifle' ? 2 : 1, this.tiers.mergeCount);
      }
      // Both a collected and a missed plaque disappear once it passes the player.
    }
    // Contact follows projectile deaths; each removed enemy can cause at most one casualty event.
    let contactFormationCount = this.state.squad.count;
    let contactOffsets = offsets;
    if (squad.count > 0 && squad.count !== contactFormationCount) {
      contactFormationCount = squad.count;
      contactOffsets = createDefenseSquadFormation(squad.count, tuning.formationSpacing, catharsis?.balance.defenseMode ? catharsis.balance.progression : undefined);
    }
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      const contactRadius = tuning.memberRadius + tuning.normalEnemyRadius;
      if (!positiveFinite(contactRadius)) throw new Error('Simulation contact radius exceeds the supported range');
      const enemyTravel = catharsis && !currentBoss?.engaged && !bossContact && enemy.archetype
        ? enemyApproachSpeed(enemy, catharsis.balance) * dtSeconds : 0;
      // Sweep in the enemy's final coordinate space, accounting for its approach.
      let contact = false;
      for (const offset of contactOffsets) {
        const startX = this.state.player.x + offset.x;
        const startZ = this.state.player.z + offset.z - enemyTravel;
        const endX = nextX + offset.x;
        const endZ = nextZ + offset.z;
        if (!Number.isFinite(startX) || !Number.isFinite(startZ)
          || !Number.isFinite(endX) || !Number.isFinite(endZ)) {
          throw new Error('Simulation squad contact position is non-finite');
        }
        if (segmentTouchesCircle(startX, startZ, endX, endZ, enemy.x, enemy.z, contactRadius)) {
          contact = true;
          break;
        }
      }
      if (contact) {
        enemies.splice(enemies.indexOf(enemy), 1);
        const before = copySquadForPresentation(squad);
        const casualty = afterCasualtiesWithBreakdown(squad,
          exchangeValueForTier(enemy.tier, this.tiers.mergeCount), this.tiers.mergeCount);
        squad = casualty.squad;
        stepEvents.push({ kind: 'normalEnemyContact', enemyId: enemy.id, enemyTier: enemy.tier,
          attackerX: enemy.x, attackerZ: enemy.z, playerX: nextX, playerZ: nextZ,
          before, after: copySquadForPresentation(squad), affectedMembers: casualty.affectedMembers });
        if (squad.count > 0 && squad.count !== contactFormationCount) {
          contactFormationCount = squad.count;
          // Contact can only reduce the count; reuse the pre-contact formation if it returns there.
          contactOffsets = squad.count === this.state.squad.count ? offsets
            : createDefenseSquadFormation(squad.count, tuning.formationSpacing, catharsis?.balance.defenseMode ? catharsis.balance.progression : undefined);
        }
      }
    }
    const defenseLineZ = nextZ - tuning.defenseLineOffset;
    if (!Number.isFinite(defenseLineZ)) throw new Error('Simulation defense line exceeds the supported range');
    // Only survivors can leak; contact and projectile kills have already removed their enemies.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      if (enemy.z <= defenseLineZ) {
        enemies.splice(enemies.indexOf(enemy), 1);
        const before = copySquadForPresentation(squad);
        const casualty = afterCasualtiesWithBreakdown(squad,
          exchangeValueForTier(enemy.tier, this.tiers.mergeCount), this.tiers.mergeCount);
        squad = casualty.squad;
        stepEvents.push({ kind: 'normalEnemyContact', enemyId: enemy.id, enemyTier: enemy.tier,
          attackerX: enemy.x, attackerZ: enemy.z, playerX: nextX, playerZ: nextZ,
          before, after: copySquadForPresentation(squad), affectedMembers: casualty.affectedMembers });
      }
    }
    if (boss?.engaged && !justEngaged && squad.count > 0) {
      boss.slamCooldownRemainingSeconds -= dtSeconds;
      while (boss.slamCooldownRemainingSeconds <= 1e-9 && squad.count > 0) {
        const before = copySquadForPresentation(squad);
        // A Tier N slam removes ten Tier N+1 soldiers' exact exchange value.
        const casualty = afterCasualtiesWithBreakdown(squad,
          10n * exchangeValueForTier(boss.tier + 1, this.tiers.mergeCount),
          this.tiers.mergeCount);
        squad = casualty.squad;
        boss.slamCount++;
        stepEvents.push({ kind: 'bossSlam', bossId: boss.id, bossTier: boss.tier,
          slamCount: boss.slamCount, attackerX: boss.x, attackerZ: boss.z,
          playerX: nextX, playerZ: nextZ, before, after: copySquadForPresentation(squad),
          affectedMembers: casualty.affectedMembers });
        boss.slamCooldownRemainingSeconds += 2;
      }
      if (boss.slamCooldownRemainingSeconds < 0) boss.slamCooldownRemainingSeconds = 0;
    }
    if (squad.count === 0 && stepEvents.length > 0) survivingProjectiles.length = 0;
    // MG casualties consume the front of the Tier-1 roster. Keep each survivor's
    // shot phase when its index shifts; do not inherit a removed member's clock.
    if (memberCooldowns && this.state.progression && catharsis
      && progressionStage(this.state.progression.level, catharsis.balance.progression).weaponFamily === 'machineGun') {
      const lost = this.state.squad.count - squad.count;
      if (lost > 0) {
        memberCooldowns.splice(0, lost);
        nextCooldowns.rifle = memberCooldowns[0] ?? 0;
      }
    }
    // Stream rewards expire harmlessly behind the moving defense line.
    const survivingStreamRewards = streamRewards.filter((reward) => reward.z > defenseLineZ);
    // A gained level shortens the next scheduled shot without restarting the weapon clock.
    if (progression && this.state.progression && progression.level > this.state.progression.level && catharsis) {
      nextCooldowns.rifle = Math.min(nextCooldowns.rifle,
        1 / effectivePrimaryFireRate(tuning.rifle.fireRate, progression.level, catharsis.balance));
    }
    if (memberCooldowns && progression && catharsis && this.state.progression
      && progression.level > this.state.progression.level) {
      const interval = 1 / effectivePrimaryFireRate(tuning.rifle.fireRate, progression.level, catharsis.balance);
      memberCooldowns.forEach((clock, index) => memberCooldowns[index] = Math.min(clock, interval));
    }
    // Apply every crossed stage as a reward delta, never a living-squad target.
    if (progression && this.state.progression && catharsis) {
      for (let level = this.state.progression.level + 1; level <= progression.level; level++) {
        const stage = progressionStage(level, catharsis.balance.progression);
        const previous = progressionStage(level - 1, catharsis.balance.progression);
        if (stage.weaponFamily !== previous.weaponFamily) {
          // Evolution replaces living members; it is never a contact/casualty.
          if (squad.count > 0) squad = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
          nextCooldowns.rifle = 1 / effectivePrimaryFireRate(tuning.rifle.fireRate, level, catharsis.balance);
          nextCooldowns.rocket = 0;
          if (memberCooldowns) { memberCooldowns.length = 0; if (squad.count) memberCooldowns.push(nextCooldowns.rifle); }
          // Discard pending old-family shots, including any stale volley.
          survivingProjectiles.length = 0;
          continue;
        }
        const delta = stage.squadStage - previous.squadStage;
        if (delta > 0 && (stage.weaponFamily === 'rifle' || squad.count > 0)) {
          const before = squad.count - squad.rocketCount;
          squad = addRifleSoldiers(squad, delta, 1, this.tiers.mergeCount);
          const interval = 1 / effectivePrimaryFireRate(tuning.rifle.fireRate, level, catharsis.balance);
          if (memberCooldowns) {
            memberCooldowns.length = before;
            appendMemberClocks(memberCooldowns, squad.count - squad.rocketCount, interval);
          }
        }
      }
    }
    if (grenade && grenade.lv3EnteredAtSeconds === null && this.state.progression!.level < 3 && progression!.level >= 3)
      grenade.lv3EnteredAtSeconds = nextElapsedSeconds;
    // Retained out-of-plan experiment only. Authored stages own their rewards.
    let reinforcement = this.state.reinforcement;
    if (reinforcement && progression && catharsis && squad.count > 0
      && progression.level > maxProgressionLevel(catharsis.balance.progression)) {
      const balance = catharsis.balance.progression;
      if (reinforcement.startedAtSeconds === null && progression.level >= balance.reinforcementLevel)
        reinforcement = { startedAtSeconds: nextElapsedSeconds, arrived: false };
      if (!reinforcement.arrived && reinforcement.startedAtSeconds !== null
        && nextElapsedSeconds - reinforcement.startedAtSeconds >= balance.reinforcementArrivalSeconds - 1e-9) {
        reinforcement = { ...reinforcement, arrived: true };
        if (landingAssault) landingAssault.reinforcementActiveAtSeconds = nextElapsedSeconds;
        squad = addRifleSoldiers(squad, 1, 1, this.tiers.mergeCount);
        const interval = 1 / effectiveRifleFireRate(tuning.rifle.fireRate, progression.level, balance);
        memberCooldowns?.push(nextCooldowns.rifle + interval / 2);
      }
    }
    if (memberCooldowns) memberCooldowns.length = squad.count - squad.rocketCount;
    if (giantEncounter && catharsis && enemyStream && squad.count > 0)
      giantEncounter = advanceGiantEncounter(giantEncounter, progression!.level, nextElapsedSeconds, nextZ,
        catharsis.balance, catharsis.trackHalfWidth, enemies, enemyStream);
    let machineGunReleaseAtSeconds = this.state.machineGunReleaseAtSeconds;
    if (machineGunReleaseAtSeconds === null && progression && progression.level >= 6 && squad.count > 0
      && catharsis?.balance.pressureRamp?.lv6 && enemyStream && this.enemyStreamDefinition) {
      const balance = catharsis.balance;
      // Consume the next group row, even when evolution occurs between stream rows.
      // Its crowd enters at today's shoreline, and that row can never be admitted again.
      const row = Math.ceil(enemyStream.nextRowIndex / balance.waveRows) * balance.waveRows;
      if (!Number.isSafeInteger(row + 1)) throw new Error('Release row exceeds supported range');
      admitDefenseGroup(enemies, enemyStream, row, this.enemyStreamDefinition.seed,
        { ...balance, ...pressureWaveSettings(balance, { level: 6, xp: 0 }), groupSize: pressureGroupSize(balance, 6) },
        catharsis.trackHalfWidth, nextZ + balance.defenseSpawnAheadDistance);
      enemyStream.nextRowIndex = row + 1;
      machineGunReleaseAtSeconds = nextElapsedSeconds;
    }
    const postCapSurvival = advancePostCapSurvival(this.state.postCapSurvival,
      { ...this.state, elapsedSeconds: nextElapsedSeconds, progression, machineGunReleaseAtSeconds,
        player: { ...this.state.player, x: nextX, z: nextZ }, squad, enemies, enemyStream, grenade });
    this.state = { ...this.state, ...(landingAssault ? { landingAssault } : {}), ...(reinforcement ? { reinforcement } : {}), ...(giantEncounter ? { giantEncounter } : {}), ...(progression ? { progression } : {}), player: { ...this.state.player, x: nextX, z: nextZ }, squad, enemies, boss, enemyStream, gates,
      ...(catharsis?.balance.defenseMode ? { postCapSurvival } : {}),
      ...(grenade ? { grenade } : {}), streamRewards: survivingStreamRewards,
      ...(machineGunReleaseAtSeconds !== undefined ? { machineGunReleaseAtSeconds } : {}),
      pickups: survivingPickups, nextPickupId, projectiles: survivingProjectiles,
      weapons: { ...(memberCooldowns ? { rifleMemberCooldowns: memberCooldowns } : {}), rifleCooldownRemainingSeconds: nextCooldowns.rifle, rocketCooldownRemainingSeconds: nextCooldowns.rocket,
        nextProjectileId }, tick: this.state.tick + 1,
      elapsedSeconds: nextElapsedSeconds, rngState: this.rng.getState() };
    if (stepEvents.length > 0) {
      this.presentationEvents.push(...stepEvents);
      if (this.presentationEvents.length > Simulation.MAX_PRESENTATION_EVENTS) {
        this.presentationEvents.splice(0,
          this.presentationEvents.length - Simulation.MAX_PRESENTATION_EVENTS);
      }
    }
  }

  consumeGrenadeEvents(): GrenadeEvent[] {
    const events = this.grenadeEvents;
    this.grenadeEvents = [];
    return events;
  }

  consumePresentationEvents(): PresentationEvent[] {
    const events = this.presentationEvents;
    this.presentationEvents = [];
    return events;
  }

  // Trusted frame consumers may read this until the next simulation mutation. References are shared
  // with live state; use getState() for independent snapshots or any retained/mutable data.
  getFrameState(): SimulationFrameState { return this.state; }

  getState(): SimulationState {
    return {
      ...this.state,
      ...(this.state.catharsis ? { catharsis: structuredClone(this.state.catharsis) } : {}),
      ...(this.state.grenade ? { grenade: structuredClone(this.state.grenade) } : {}),
      ...(this.state.postCapSurvival ? { postCapSurvival: { ...this.state.postCapSurvival } } : {}),
      ...(this.state.progression ? { progression: { ...this.state.progression } } : {}),
      ...(this.state.reinforcement ? { reinforcement: { ...this.state.reinforcement } } : {}),
      ...(this.state.giantEncounter ? { giantEncounter: { ...this.state.giantEncounter } } : {}),
      ...(this.state.landingAssault ? { landingAssault: { ...this.state.landingAssault } } : {}),
      rngState: this.rng.getState(),
      player: { ...this.state.player },
      squad: { ...this.state.squad, rifleCounts: [...this.state.squad.rifleCounts] },
      enemies: this.state.enemies.map((enemy) => ({ ...enemy })),
      boss: this.state.boss ? { ...this.state.boss } : null,
      enemyStream: this.state.enemyStream ? { ...this.state.enemyStream } : null,
      streamRewards: this.state.streamRewards.map((reward) => ({ ...reward })),
      gates: this.state.gates.map((gate) => ({ ...gate, reward: { ...gate.reward } })),
      pickups: this.state.pickups.map((pickup) => ({ ...pickup })),
      projectiles: this.state.projectiles.map((projectile) => ({ ...projectile })),
      weapons: { ...this.state.weapons, ...(this.state.weapons.rifleMemberCooldowns ? { rifleMemberCooldowns: [...this.state.weapons.rifleMemberCooldowns] } : {}) },
    };
  }

  restoreState(state: SimulationState): void {
    const candidate = validateState(state, this.tiers.mergeCount);
    if ((candidate.state.enemyStream !== null) !== (this.enemyStreamDefinition !== undefined)) {
      throw new Error('Simulation enemy stream state does not match the loaded level');
    }
    const progression = this.enemyStreamDefinition?.tierProgression;
    const cursor = candidate.state.enemyStream;
    const boss = candidate.state.boss;
    const expectedTier = cursor && progression ? 1 + Math.max(0, Math.ceil(
      (cursor.nextRowIndex - bossRowForTier(1, progression))
        / (progression.transitionRows + progression.stableRows))) : 1;
    const defenseMode = candidate.state.catharsis?.balance.defenseMode;
    if (defenseMode && (boss || candidate.state.streamRewards.length || candidate.state.enemies.some((enemy) => enemy.tier !== 1)
      || (cursor && cursor.nextBossTier !== 1))) throw new Error('Disabled systems are present in defense snapshot');
    if (!defenseMode && cursor && (cursor.nextBossTier !== expectedTier
      || (boss && (boss.tier !== cursor.nextBossTier - 1
        || boss.z !== this.enemyStreamDefinition!.startZ
          + bossRowForTier(boss.tier, progression!) * this.enemyStreamDefinition!.spacing || boss.x !== 0
        || boss.maxHp !== bossMaxHpForTier(boss.tier, progression!, this.tiers) * this.bossHpScale)))) {
      throw new Error('Simulation Boss progression does not match the loaded level');
    }
    this.state = candidate.state;
    this.grenadeEvents = [];
    this.rng = candidate.rng;
    this.enemyStreamDefinition = this.effectiveStreamDefinition(candidate.state.seed,
      candidate.state.catharsis?.rewardRowsPerReward ?? this.enemyStreamDefinition?.rewards?.rowsPerReward);
    this.presentationEvents = [];
  }

  private effectiveStreamDefinition(runSeed: number,
    rowsPerReward?: number): EnemyStreamDefinition | undefined {
    const authored = this.authoredEnemyStreamDefinition;
    if (!authored) return undefined;
    return { ...authored, seed: effectiveSeed(runSeed, authored.seed),
      rewards: authored.rewards ? { ...authored.rewards,
        seed: effectiveSeed(runSeed, authored.rewards.seed),
        rowsPerReward: rowsPerReward ?? authored.rewards.rowsPerReward } : undefined };
  }
}

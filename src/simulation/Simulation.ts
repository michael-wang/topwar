import { SeededRng } from '../core/Rng';
import { LevelDefinitionSchema, UpgradeRewardSchema, type EnemyStreamDefinition, type LevelDefinition } from '../level/LevelDefinition';
import { createEnemyFormation } from './enemies/formation';
import { createEnemyStreamRow } from './enemies/streamRow';
import { rewardPlacementForBlock } from './enemies/streamRewards';
import { addRifleSoldiers, afterCasualties, normalizeRifleSquad, validateSquad } from './squad/composition';
import { createSquadFormation } from './squad/formation';
import { bossMaxHpForTier, bossRowForTier, enemyTierForRow, exchangeValueForTier,
  powerForTier, rewardTierForRow, validTier, type TierPower } from './tiers/tierRules';
import type { BossSimulationState, EnemySimulationState, EnemyStreamSimulationState, ProjectileSimulationState, SimulationState, StreamRewardSimulationState, UpgradeGateSimulationState, UpgradePickupSimulationState } from './SimulationState';

export interface SimulationOptions {
  seed: number;
  level: LevelDefinition;
  startSquad: number;
  startRocketCount: number;
  tiers: TierPower;
}

export interface SimulationInput {
  targetX: number;
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
  rifle: { fireRate: number; projectileSpeed: number; range: number };
  rocket: { damage: number; fireRate: number; projectileSpeed: number; range: number; blastRadius: number };
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

type ProjectileHit = { kind: 'enemy'; enemy: EnemySimulationState; fraction: number; z: number }
  | { kind: 'boss'; boss: BossSimulationState; fraction: number; z: number }
  | { kind: 'streamReward'; reward: StreamRewardSimulationState; fraction: number; z: number }
  | { kind: 'gate'; gate: UpgradeGateSimulationState; fraction: number; z: number };

function findFirstHit(projectile: ProjectileSimulationState, endZ: number,
  enemies: EnemySimulationState[], boss: BossSimulationState | null,
  rewards: StreamRewardSimulationState[], gates: UpgradeGateSimulationState[],
  normalEnemyRadius: number,
  bossRadius: number | undefined,
  currentPlayerZ: number, nextPlayerZ: number, minimumFraction = 0,
  piercedEnemyIds?: ReadonlySet<number>): ProjectileHit | undefined {
  let first: ProjectileHit | undefined;
  const travel = endZ - projectile.z;
  const minimumZ = projectile.z + travel * minimumFraction;
  for (const enemy of enemies) {
    if (piercedEnemyIds?.has(enemy.id)) continue;
    const radius = normalEnemyRadius;
    const dx = projectile.x - enemy.x;
    if (Math.abs(dx) > radius) continue;
    const halfChord = Math.sqrt(radius * radius - dx * dx);
    const entryZ = enemy.z - halfChord;
    const exitZ = enemy.z + halfChord;
    if (exitZ < minimumZ || entryZ > endZ) continue;
    const hitZ = Math.max(minimumZ, entryZ);
    const fraction = travel === 0 ? 0 : (hitZ - projectile.z) / travel;
    if (!first || fraction < first.fraction
      || (fraction === first.fraction && first.kind === 'enemy' && enemy.id < first.enemy.id)) {
      first = { kind: 'enemy', enemy, fraction, z: hitZ };
    }
  }
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
  boss: BossSimulationState | null): BossSimulationState | null {
  const horizonZ = playerZ + stream.spawnAheadDistance;
  if (!Number.isFinite(horizonZ)) throw new Error('Simulation enemy stream horizon is non-finite');
  while (true) {
    const rowZ = stream.startZ + cursor.nextRowIndex * stream.spacing;
    if (!Number.isFinite(rowZ)) throw new Error('Simulation enemy stream row position is non-finite');
    if (rowZ > horizonZ) break;
    const bossTier = cursor.nextBossTier;
    if (cursor.nextRowIndex === bossRowForTier(bossTier, stream.tierProgression)) {
      // One active Boss is supported; authored encounters must not overlap in play.
      if (boss) throw new Error('Simulation cannot spawn a Boss while another Boss is active');
      const maxHp = bossMaxHpForTier(bossTier, stream.tierProgression, power);
      if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) {
        throw new Error('Simulation Boss ID exceeds the supported range');
      }
      boss = { id: cursor.nextEnemyId++, tier: bossTier, x: 0, z: rowZ, hp: maxHp, maxHp };
      cursor.nextBossTier++;
      cursor.nextRowIndex++;
      continue;
    }
    if (!Number.isSafeInteger(cursor.nextRowIndex + 1)
      || !Number.isSafeInteger(cursor.nextEnemyId + stream.columns)) {
      throw new Error('Simulation enemy stream exceeds the supported range');
    }
    const offsets = createEnemyStreamRow(cursor.nextRowIndex, stream.columns,
      stream.spacing, stream.jitter, stream.seed);
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
      const tier = enemyTierForRow(rowIndex, column, revealColumn, stream.seed, stream.tierProgression);
      const enemyId = cursor.nextEnemyId++;
      enemies.push({ id: enemyId, tier, x: offset.x, z, hp: powerForTier(tier, power) });
    }
    cursor.nextRowIndex++;
  }
  return boss;
}

function extendRewardStream(rewards: StreamRewardSimulationState[], cursor: EnemyStreamSimulationState,
  stream: EnemyStreamDefinition, playerZ: number): void {
  const definition = stream.rewards;
  if (!definition) return;
  const horizonZ = playerZ + definition.spawnAheadDistance;
  if (!Number.isFinite(horizonZ)) throw new Error('Simulation reward stream horizon is non-finite');
  while (true) {
    const placement = rewardPlacementForBlock(cursor.nextRewardBlockIndex, stream.columns, definition);
    const rowZ = stream.startZ + placement.rowIndex * stream.spacing;
    if (!Number.isFinite(rowZ)) throw new Error('Simulation reward row position is non-finite');
    if (rowZ > horizonZ) break;
    const offsets = createEnemyStreamRow(placement.rowIndex, stream.columns,
      stream.spacing, stream.jitter, stream.seed);
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
      x: placement.side * definition.sideX, z,
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
  if (Object.keys(state).length !== fields.length || fields.some((field) => !Object.hasOwn(state, field))) {
    throw new Error('Simulation state has missing or unknown fields');
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
  if (Object.keys(player).length !== 2 || !Object.hasOwn(player, 'x') || !Object.hasOwn(player, 'z')) {
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

  if (!Array.isArray(state.enemies)) throw new Error('Simulation enemies must be an array');
  const enemyIds = new Set<number>();
  const enemies: EnemySimulationState[] = state.enemies.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation enemy ${index} must be a plain object`);
    if (Object.keys(value).length !== 5 || ['id', 'tier', 'x', 'z', 'hp'].some((field) => !Object.hasOwn(value, field))) {
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
    return { id, tier: value.tier as number, x: value.x, z: value.z, hp: value.hp };
  });

  let boss: BossSimulationState | null = null;
  if (state.boss !== null) {
    const value = state.boss;
    if (!isPlainObject(value) || Object.keys(value).length !== 6
      || ['id', 'tier', 'x', 'z', 'hp', 'maxHp'].some((field) => !Object.hasOwn(value, field))
      || !Number.isSafeInteger(value.id) || (value.id as number) <= 0
      || enemyIds.has(value.id as number) || !validTier(value.tier as number)
      || typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z)
      || !positiveFinite(value.hp) || !positiveFinite(value.maxHp)
      || value.hp > value.maxHp) {
      throw new Error('Simulation Boss state is invalid');
    }
    boss = { id: value.id as number, tier: value.tier as number, x: value.x, z: value.z,
      hp: value.hp, maxHp: value.maxHp };
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
    if (Object.keys(value).length !== 10 || ['id', 'kind', 'tier', 'x', 'z', 'speed', 'damage', 'remainingRange', 'blastRadius', 'penetrationRemaining']
      .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation projectile ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || projectileIds.has(value.id as number)) {
      throw new Error(`Simulation projectile ${index} id must be unique and positive`);
    }
    projectileIds.add(value.id as number);
    if (value.kind !== 'rifle' && value.kind !== 'rocket') {
      throw new Error(`Simulation projectile ${index} kind is unsupported`);
    }
    if (value.kind === 'rifle' ? !validTier(value.tier as number) : value.tier !== 0) {
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
    if (!Number.isSafeInteger(value.penetrationRemaining)
      || (value.kind === 'rocket' && value.penetrationRemaining !== 0)
      || (value.kind === 'rifle' && ((value.tier === 1 && value.penetrationRemaining !== 0)
        || (value.tier !== 1 && ((value.penetrationRemaining as number) < 1
          || (value.penetrationRemaining as number) > exchangeValueForTier(value.tier as number, mergeCount)))))) {
      throw new Error(`Simulation projectile ${index} penetrationRemaining is invalid for its kind`);
    }
    return { id: value.id as number, kind: value.kind as ProjectileSimulationState['kind'],
      tier: value.tier as number,
      x: value.x, z: value.z, speed: value.speed,
      damage: value.damage, remainingRange: value.remainingRange, blastRadius: value.blastRadius,
      penetrationRemaining: value.penetrationRemaining as number };
  });
  const weapons = state.weapons;
  if (!isPlainObject(weapons) || Object.keys(weapons).length !== 3
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
  const nextProjectileId = weapons.nextProjectileId;
  if (!Number.isSafeInteger(nextProjectileId) || (nextProjectileId as number) <= 0
    || projectiles.some((projectile) => projectile.id >= (nextProjectileId as number))) {
    throw new Error('Simulation weapons nextProjectileId must exceed active projectile IDs');
  }

  return {
    state: {
      tick: state.tick as number,
      elapsedSeconds: state.elapsedSeconds,
      levelId: state.levelId,
      seed: state.seed as number,
      rngState: rng.getState(),
      player: { x: player.x as number, z: player.z as number },
      squad: { count: squad.count as number, rocketCount: squad.rocketCount as number,
        rifleCounts: [...(squad.rifleCounts as number[])], rifleRemainder: squad.rifleRemainder as number },
      enemies,
      boss,
      enemyStream,
      streamRewards,
      gates,
      pickups,
      nextPickupId: state.nextPickupId as number,
      projectiles,
      weapons: { rifleCooldownRemainingSeconds: weapons.rifleCooldownRemainingSeconds as number,
        rocketCooldownRemainingSeconds: weapons.rocketCooldownRemainingSeconds as number,
        nextProjectileId: nextProjectileId as number },
    },
    rng,
  };
}

export class Simulation {
  private rng: SeededRng;
  private state: SimulationState;
  private readonly enemyStreamDefinition: EnemyStreamDefinition | undefined;
  private readonly tiers: TierPower;

  constructor(options: SimulationOptions) {
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
      || !Number.isFinite(options.tiers.higherTierPowerMultiplier)
      || options.tiers.higherTierPowerMultiplier <= 1
      || !positiveFinite(options.tiers.normalEnemyRadius)) throw new Error('Simulation tiers are invalid');
    this.enemyStreamDefinition = level.enemyStream;
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
          hp: powerForTier(1, this.tiers),
        });
      }
    }
    const streamRewards: StreamRewardSimulationState[] = [];
    const enemyStream = level.enemyStream
      ? { nextRowIndex: 0, nextEnemyId: enemies.length + 1, nextRewardBlockIndex: 0,
        nextRewardId: 1, nextBossTier: 1 }
      : null;
    let boss: BossSimulationState | null = null;
    if (enemyStream && level.enemyStream) {
      boss = extendEnemyStream(enemies, enemyStream, level.enemyStream, 0, this.tiers, boss);
      extendRewardStream(streamRewards, enemyStream, level.enemyStream, 0);
    }
    this.state = {
      tick: 0,
      elapsedSeconds: 0,
      levelId: level.id,
      seed: options.seed,
      rngState: this.rng.getState(),
      player: { x: 0, z: 0 },
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
      || !positiveFinite(tuning.rifle.projectileSpeed) || !positiveFinite(tuning.rifle.range)) {
      throw new Error('Simulation rifle tuning must be positive and finite');
    }
    if (!tuning.rocket || !positiveFinite(tuning.rocket.damage) || !positiveFinite(tuning.rocket.fireRate)
      || !positiveFinite(tuning.rocket.projectileSpeed) || !positiveFinite(tuning.rocket.range)
      || !positiveFinite(tuning.rocket.blastRadius)) {
      throw new Error('Simulation rocket tuning must be positive and finite');
    }
    const nextElapsedSeconds = this.state.elapsedSeconds + dtSeconds;
    if (!Number.isFinite(nextElapsedSeconds) || !Number.isSafeInteger(this.state.tick + 1)) {
      throw new Error('Simulation time or tick exceeds the supported range');
    }
    if (this.state.squad.count === 0) {
      this.state = { ...this.state, tick: this.state.tick + 1, elapsedSeconds: nextElapsedSeconds };
      return;
    }

    const halfWidth = tuning.trackHalfWidth;
    const currentX = Math.max(-halfWidth, Math.min(halfWidth, this.state.player.x));
    const targetX = Math.max(-halfWidth, Math.min(halfWidth, input.targetX));
    const maxHorizontalDelta = tuning.moveSpeed * dtSeconds;
    const difference = targetX - currentX;
    const nextX = Math.abs(difference) <= maxHorizontalDelta
      ? targetX
      : currentX + Math.sign(difference) * maxHorizontalDelta;
    const nextZ = this.state.player.z + tuning.forwardSpeed * dtSeconds;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) {
      throw new Error('Simulation movement exceeds the supported range');
    }
    if (this.state.gates.some((gate) => !Number.isFinite(this.state.player.z + gate.zOffset)
      || !Number.isFinite(nextZ + gate.zOffset))) {
      throw new Error('Simulation armory position exceeds the supported range');
    }
    const enemies = this.state.enemies.map((enemy) => ({ ...enemy }));
    let boss = this.state.boss ? { ...this.state.boss } : null;
    const streamRewards = this.state.streamRewards.map((reward) => ({ ...reward }));
    const enemyStream = this.state.enemyStream ? { ...this.state.enemyStream } : null;
    if (enemyStream && this.enemyStreamDefinition) {
      boss = extendEnemyStream(enemies, enemyStream, this.enemyStreamDefinition,
        nextZ, this.tiers, boss);
      extendRewardStream(streamRewards, enemyStream, this.enemyStreamDefinition, nextZ);
    }
    const gates = this.state.gates.map((gate) => ({ ...gate, reward: { ...gate.reward } }));
    let squad = { ...this.state.squad };
    const projectiles = this.state.projectiles.map((projectile) => ({ ...projectile }));
    let nextProjectileId = this.state.weapons.nextProjectileId;
    const offsets = createSquadFormation(this.state.squad.count, tuning.formationSpacing);
    const rifleEnd = this.state.squad.count - this.state.squad.rocketCount;
    const nextCooldowns = { rifle: this.state.weapons.rifleCooldownRemainingSeconds,
      rocket: this.state.weapons.rocketCooldownRemainingSeconds };
    // Fire before travel; projectiles created this tick travel for this full fixed step.
    for (const kind of ['rifle', 'rocket'] as const) {
      const activeOffsets = kind === 'rifle' ? offsets.slice(0, rifleEnd) : offsets.slice(rifleEnd);
      const weapon = tuning[kind];
      const interval = 1 / weapon.fireRate;
      if (!positiveFinite(interval)) throw new Error('Simulation fire interval exceeds the supported range');
      if (activeOffsets.length === 0) {
        nextCooldowns[kind] = 0;
        continue;
      }
      let cooldown = nextCooldowns[kind] - dtSeconds;
      // A malformed direct step must not turn into an unbounded catch-up loop.
      if (cooldown <= 0 && Math.floor(-cooldown / interval) + 1 > 10_000) {
        throw new Error('Simulation step requests too many weapon volleys');
      }
      while (cooldown <= 0) {
        for (let index = 0; index < activeOffsets.length; index++) {
          const offset = activeOffsets[index];
          let tier = 0;
          if (kind === 'rifle') {
            let roleIndex = index;
            for (let tierIndex = 0; tierIndex < this.state.squad.rifleCounts.length; tierIndex++) {
              roleIndex -= this.state.squad.rifleCounts[tierIndex];
              if (roleIndex < 0) { tier = tierIndex + 1; break; }
            }
          }
          const damage = kind === 'rifle' ? powerForTier(tier, this.tiers) : tuning.rocket.damage;
          if (!positiveFinite(damage)) throw new Error('Simulation rifle damage exceeds the supported range');
          if (!Number.isSafeInteger(nextProjectileId) || nextProjectileId <= 0) throw new Error('Simulation projectile ID exceeds the supported range');
          const x = nextX + offset.x;
          const z = nextZ + offset.z;
          if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Simulation projectile origin is non-finite');
          projectiles.push({ id: nextProjectileId++, kind, tier, x, z, speed: weapon.projectileSpeed,
            damage, remainingRange: weapon.range,
            blastRadius: kind === 'rocket' ? tuning.rocket.blastRadius : 0,
            penetrationRemaining: tier > 1 ? exchangeValueForTier(tier, this.tiers.mergeCount) : 0 });
        }
        cooldown += interval;
        if (!Number.isFinite(cooldown)) throw new Error('Simulation weapon cooldown exceeds the supported range');
      }
      nextCooldowns[kind] = cooldown;
    }
    if (!Number.isSafeInteger(nextProjectileId)) throw new Error('Simulation projectile ID exceeds the supported range');

    const survivingProjectiles: ProjectileSimulationState[] = [];
    const travelingPickups = this.state.pickups.map((pickup) => ({ pickup: { ...pickup }, travelSeconds: dtSeconds }));
    let nextPickupId = this.state.nextPickupId;
    for (const projectile of projectiles) {
      const travel = Math.min(projectile.speed * dtSeconds, projectile.remainingRange);
      const endZ = projectile.z + travel;
      if (!Number.isFinite(travel) || !Number.isFinite(endZ)) throw new Error('Simulation projectile movement exceeds the supported range');
      let penetrationRemaining = projectile.penetrationRemaining;
      let minimumFraction = 0;
      let consumed = false;
      const piercedEnemyIds = projectile.tier > 1 ? new Set<number>() : undefined;
      while (true) {
        const hit = findFirstHit(projectile, endZ, enemies, boss, streamRewards, gates,
          tuning.normalEnemyRadius,
          tuning.bossRadius,
          this.state.player.z, nextZ, minimumFraction, piercedEnemyIds);
        if (!hit) break;
        if (hit.kind === 'gate') {
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
          hit.enemy.hp -= projectile.damage;
          if (hit.enemy.hp <= 0) enemies.splice(enemies.indexOf(hit.enemy), 1);
          const penetrationCost = projectile.tier > hit.enemy.tier
            ? exchangeValueForTier(hit.enemy.tier, this.tiers.mergeCount) : 0;
          if (penetrationCost > 0) {
            penetrationRemaining -= penetrationCost;
            if (penetrationRemaining > 0) {
              // The cursor keeps the original step time for moving gates. Skipping
              // this enemy also handles overlapping circles and exact-position ties.
              minimumFraction = hit.fraction;
              piercedEnemyIds!.add(hit.enemy.id);
              continue;
            }
          }
        }
        if (projectile.kind === 'rocket' && hit.kind !== 'streamReward') {
          const radiusSquared = projectile.blastRadius * projectile.blastRadius;
          const blastX = hit.kind === 'gate' ? projectile.x : hit.kind === 'boss' ? hit.boss.x : hit.enemy.x;
          const blastZ = hit.kind === 'gate' ? hit.z : hit.kind === 'boss' ? hit.boss.z : hit.enemy.z;
          // Only enemies receive blast damage; ID order makes multi-target resolution stable.
          for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
            const dx = enemy.x - blastX;
            const dz = enemy.z - blastZ;
            if (dx * dx + dz * dz <= radiusSquared) {
              enemy.hp -= projectile.damage;
              if (enemy.hp <= 0) enemies.splice(enemies.indexOf(enemy), 1);
            }
          }
        }
        consumed = true;
        break;
      }
      const remainingRange = projectile.remainingRange - travel;
      if (!consumed && remainingRange > 0) {
        survivingProjectiles.push({ ...projectile, z: endZ, remainingRange, penetrationRemaining });
      }
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
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      const contactRadius = tuning.memberRadius + tuning.normalEnemyRadius;
      if (!positiveFinite(contactRadius)) throw new Error('Simulation contact radius exceeds the supported range');
      // Sweep each moving squad member against the stationary enemy.
      const contact = createSquadFormation(squad.count, tuning.formationSpacing).some((offset) => {
        const startX = this.state.player.x + offset.x;
        const startZ = this.state.player.z + offset.z;
        const endX = nextX + offset.x;
        const endZ = nextZ + offset.z;
        if (![startX, startZ, endX, endZ].every(Number.isFinite)) {
          throw new Error('Simulation squad contact position is non-finite');
        }
        return segmentTouchesCircle(startX, startZ, endX, endZ, enemy.x, enemy.z, contactRadius);
      });
      if (contact) {
        enemies.splice(enemies.indexOf(enemy), 1);
        squad = afterCasualties(squad, exchangeValueForTier(enemy.tier, this.tiers.mergeCount),
          this.tiers.mergeCount);
      }
    }
    const defenseLineZ = nextZ - tuning.defenseLineOffset;
    if (!Number.isFinite(defenseLineZ)) throw new Error('Simulation defense line exceeds the supported range');
    if (boss) {
      const radius = tuning.memberRadius + tuning.bossRadius!;
      const contact = createSquadFormation(squad.count, tuning.formationSpacing).some((offset) =>
        segmentTouchesCircle(this.state.player.x + offset.x, this.state.player.z + offset.z,
          nextX + offset.x, nextZ + offset.z, boss!.x, boss!.z, radius));
      if (contact || boss.z <= defenseLineZ) squad = { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 };
    }
    // Only survivors can leak; contact and projectile kills have already removed their enemies.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      if (enemy.z <= defenseLineZ) {
        enemies.splice(enemies.indexOf(enemy), 1);
        squad = afterCasualties(squad, exchangeValueForTier(enemy.tier, this.tiers.mergeCount),
          this.tiers.mergeCount);
      }
    }
    // Stream rewards expire harmlessly behind the moving defense line.
    const survivingStreamRewards = streamRewards.filter((reward) => reward.z > defenseLineZ);
    this.state = { ...this.state, player: { x: nextX, z: nextZ }, squad, enemies, boss, enemyStream, gates,
      streamRewards: survivingStreamRewards,
      pickups: survivingPickups, nextPickupId, projectiles: survivingProjectiles,
      weapons: { rifleCooldownRemainingSeconds: nextCooldowns.rifle, rocketCooldownRemainingSeconds: nextCooldowns.rocket,
        nextProjectileId }, tick: this.state.tick + 1,
      elapsedSeconds: nextElapsedSeconds, rngState: this.rng.getState() };
  }

  getState(): SimulationState {
    return {
      ...this.state,
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
      weapons: { ...this.state.weapons },
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
    if (cursor && (cursor.nextBossTier !== expectedTier
      || (boss && (boss.tier !== cursor.nextBossTier - 1
        || boss.z !== this.enemyStreamDefinition!.startZ
          + bossRowForTier(boss.tier, progression!) * this.enemyStreamDefinition!.spacing || boss.x !== 0
        || boss.maxHp !== bossMaxHpForTier(boss.tier, progression!, this.tiers))))) {
      throw new Error('Simulation Boss progression does not match the loaded level');
    }
    this.state = candidate.state;
    this.rng = candidate.rng;
  }
}

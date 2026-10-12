import { advanceLevelEncounters, applyEncounterAction, emptyLevelEncounters, validateLevelEncounters } from './levelEncounters';
import { advanceNavalPresence, emptyNavalPresence, validateNavalPresence } from './navalPresence';
import { advanceNavalBarrage, emptyNavalBarrage, validateNavalBarrage, hasUnresolvedDestroyerSalvo,
  recordNavalSalvo, cancelNavalSalvo } from './navalBarrage';
import { navalPresenceMuzzle } from './navalPresence';
import type { EncounterAction } from '../config/levelEncounterConfig';
import { artilleryDefaults } from '../config/artilleryConfig';
import { advanceDestroyer, destroyerMuzzle, emptyDestroyer, validateDestroyer } from './destroyer';
import { artilleryHits, effectiveArtilleryLane, makeArtilleryShell, validateArtillery,
  type ArtilleryLaunch, type ArtilleryEvent } from './artillery';
import { afterOneSoldierCasualty } from './squad/composition';
import { advanceCarnival, carnivalOwnsSpawning, CarnivalStateSchema, emptyCarnival } from './carnival';
import { admitDefenseGroup } from './enemies/defenseGroup';
import { advanceDefenseWaves, DefenseWaveStateSchema } from './enemies/defenseWaves';
import { LEGACY_DEFENSE_FORWARD_SPEED } from '../config/defenseConfig';
import { advancePostCapSurvival, emptyPostCapSurvival, PostCapSurvivalStateSchema } from './postCapSurvival';
import { teachingGrenadeGrant } from '../config/grenadeConfig';
import { emptyGrenade, GrenadeStateSchema, grenadeTarget, placeGrenadeSupply, enemiesInBlast, awardGrenades,
  type GrenadeState, type GrenadeEvent } from './grenade';
import { pressureGroupSize, pressureWaveSettings, enemyApproachSpeed, advanceGiantEncounter } from './enemies/latePressure';
import { grantXp, requiredXp, effectivePrimaryFireRate, progressionStage, maxProgressionLevel } from './progression';
import { SeededRng } from '../core/Rng';
import { LevelDefinitionSchema, type EnemyStreamDefinition, type LevelDefinition } from '../level/LevelDefinition';
import { effectiveSeed } from './enemies/effectiveSeed';
import { EnemyCollisionIndex, type EnemyCandidateSource } from './enemies/EnemyCollisionIndex';
import { addRifleSoldiers, normalizeRifleSquad, validateSquad } from './squad/composition';
import { createDefenseSquadFormation } from './squad/formation';
import type { GameConfig } from '../config/configSchema';
const validTier = (tier: number): boolean => tier === 1;
import type { EnemySimulationState, EnemyStreamSimulationState, ProjectileSimulationState, SimulationState, SimulationFrameState,  } from './SimulationState';
import { copySquadForPresentation, type PresentationEvent } from './PresentationEvent';
import { CatharsisConfigSchema, type CatharsisConfig } from '../config/catharsisConfig';
import { attackLanePositions } from './enemies/laneComposition';

export interface SimulationOptions {
  catharsis?: { balance: CatharsisConfig; trackHalfWidth: number };
  seed: number;
  level: LevelDefinition;
  startSquad: number;
  startRocketCount: number;
  tiers: GameConfig['tiers'];
  collisionDiagnostics?: CollisionDiagnostics;
}

// Optional operation counts, kept outside serialized simulation state.
export interface CollisionDiagnostics {
  findFirstHitCalls: number;
  enemyCandidateChecks: number;
  projectilePasses: number;
}

export interface SimulationInput {
  artilleryLaunches?: readonly ArtilleryLaunch[];
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
  if (!balance.defenseMode) throw Error('Retired prototype mode is unsupported');
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
;

export function findFirstHit(projectile: ProjectileSimulationState, endZ: number,
  enemyCandidates: EnemyCandidateSource,
  normalEnemyRadius: number,
  currentPlayerZ: number, nextPlayerZ: number, diagnostics?: CollisionDiagnostics,
  grenadeSupply?: GrenadeState['supply']): ProjectileHit | undefined {
  if (diagnostics) diagnostics.findFirstHitCalls++;
  let first: ProjectileHit | undefined;
  const travel = endZ - projectile.z;
  const minimumZ = projectile.z;
  const radius = normalEnemyRadius + (projectile.kind === 'rifle' ? projectile.hitRadiusBonus : 0);
  const laneShot = projectile.lane !== undefined;
  enemyCandidates.forEachCandidate(laneShot ? -Infinity : projectile.x - radius, laneShot ? Infinity : projectile.x + radius,
    minimumZ - radius, endZ + radius, (enemy) => {
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
  if (grenadeSupply && projectile.lane === grenadeSupply.lane) {
    const relativeTravel = travel - (nextPlayerZ - currentPlayerZ);
    const supplyZ = currentPlayerZ + grenadeSupply.depth;
    const fraction = (supplyZ - projectile.z) / relativeTravel;
    if (relativeTravel > 0 && fraction >= 0 && fraction <= 1
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
  stream: EnemyStreamDefinition, playerZ: number, catharsis: NonNullable<SimulationState['catharsis']>): void {
  const horizonZ = playerZ + catharsis.balance.defenseSpawnAheadDistance;
  if (!Number.isFinite(horizonZ)) throw new Error('Simulation enemy stream horizon is non-finite');
  while (true) {
    const rowZ = stream.startZ + cursor.nextRowIndex * stream.spacing;
    if (!Number.isFinite(rowZ)) throw new Error('Simulation enemy stream row position is non-finite');
    if (rowZ > horizonZ) break;
    if (!Number.isSafeInteger(cursor.nextRowIndex + 1)) throw Error('Enemy stream exceeds supported range');
    admitDefenseGroup(enemies, cursor, cursor.nextRowIndex, stream.seed,
      { ...catharsis.balance, ...pressureWaveSettings(catharsis.balance, {level:1,xp:0}),
        groupSize: pressureGroupSize(catharsis.balance, 1) }, catharsis.trackHalfWidth, rowZ);
    cursor.nextRowIndex++;
  }
}

const emptyLandingAssault = () => ({ reinforcementActiveAtSeconds: null, startedAtSeconds: null,
  nextWaveAtSeconds: null, waveIndex: 0, secondGiantSpawned: false, nextGiantAtSeconds: null });

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
  if (Object.hasOwn(state, 'carnival')) fields.push('carnival');
  if (Object.hasOwn(state, 'defenseWaves')) fields.push('defenseWaves');
  if (Object.hasOwn(state, 'artillery')) fields.push('artillery');
  if (Object.hasOwn(state, 'destroyer')) fields.push('destroyer');
  if (Object.hasOwn(state, 'levelEncounters')) fields.push('levelEncounters');
  if (Object.hasOwn(state, 'navalPresence')) fields.push('navalPresence');
  if (Object.hasOwn(state, 'navalBarrage')) fields.push('navalBarrage');
  if (Object.keys(state).length !== fields.length || fields.some((field) => !Object.hasOwn(state, field))) {
    throw new Error('Simulation state has missing or unknown fields');
  }
  const catharsis = Object.hasOwn(state, 'catharsis') ? validateCatharsis(state.catharsis) : undefined;
  if (!catharsis) throw Error('Retired prototype snapshot is unsupported');
  if (state.artillery !== undefined && !catharsis?.balance.defenseMode) throw Error('Artillery requires Defense Mode');
  if (state.defenseWaves !== undefined && (!catharsis?.balance.defenseMode || state.enemyStream === null))
    throw new Error('Defense wave clock requires a defense stream');
  const grenade = state.grenade === undefined ? undefined : GrenadeStateSchema.parse(state.grenade);
  if (grenade?.supply?.destruction && grenade.supply.destruction.recoverAtSeconds
    > (state.elapsedSeconds as number) + grenade.supply.destruction.recoverySeconds + 1e-9)
    throw new Error('Invalid supply recovery clock');
  if (grenade && (!catharsis?.balance.defenseMode
    || [grenade.lv3EnteredAtSeconds, grenade.supplySpawnedAtSeconds, grenade.acquiredAtSeconds,
      grenade.flight?.startedAtSeconds].some(t => t != null && t > (state.elapsedSeconds as number))
    || (grenade.supply && (grenade.supply.lane >= catharsis.balance.laneCount
      || Math.abs(grenade.supply.x - attackLanePositions(catharsis.balance.laneCount,
        catharsis.trackHalfWidth, catharsis.balance.edgeInset)[grenade.supply.lane]) > 1e-9))))
    throw new Error('Invalid Grenade snapshot');
  const progression = state.progression;
  // Established snapshots predate authored phases: never replay their evolution.
  const carnival = CarnivalStateSchema.parse(state.carnival ?? emptyCarnival(
    state.machineGunReleaseAtSeconds != null || (isPlainObject(progression) && (progression.level as number) >= 6)));
  if (carnival.startedAtSeconds !== null && (!catharsis?.balance.defenseMode
    || carnival.startedAtSeconds !== state.machineGunReleaseAtSeconds
    || !isPlainObject(progression) || (progression.level as number) < 6
    || carnival.startedAtSeconds + carnival.elapsedSeconds > (state.elapsedSeconds as number) + 1e-8
    || (carnival.status === 'active' && Math.abs(carnival.startedAtSeconds + carnival.elapsedSeconds - (state.elapsedSeconds as number)) > 1e-8)))
    throw new Error('Invalid Carnival activation or elapsed time');
  const carnivalConfig = catharsis?.balance.carnival;
  if (carnival.startedAtSeconds !== null && carnivalConfig?.enabled) {
    // Active saves must have consumed every due opportunity, even when the cap
    // blocked admission. Completed large-step saves may retain an older cursor:
    // they never admit again, and remain compatible with historical snapshots.
    const age = carnival.elapsedSeconds;
    const atEnd = age + 1e-9 >= carnivalConfig.durationSeconds;
    const last = atEnd ? carnivalConfig.durationSeconds - 1e-8 : age + 1e-9;
    const consumed = Math.max(0, Math.floor((last - carnivalConfig.firstWaveSeconds) / carnivalConfig.waveIntervalSeconds) + 1);
    const alive = isPlainObject(state.squad) && (state.squad.count as number) > 0;
    if (carnival.nextWaveIndex > consumed || (alive && carnival.status === 'active'
      && (atEnd || carnival.nextWaveIndex !== consumed))) throw Error('Invalid Carnival clock or consumed opportunity cursor');
  }
  // Disabled config discards even stale temporary state; old snapshots start fresh.
  const postCapSurvival = catharsis?.balance.defenseMode && catharsis.balance.postCapSurvival.enabled
    ? PostCapSurvivalStateSchema.parse(state.postCapSurvival ?? emptyPostCapSurvival()) : emptyPostCapSurvival();
  if (postCapSurvival.startedAtSeconds !== null && (postCapSurvival.startedAtSeconds > (state.elapsedSeconds as number)
    || !isPlainObject(progression) || (progression.level as number) < catharsis!.balance.postCapSurvival.startLevel
    || (!catharsis?.balance.levelEncounters && state.machineGunReleaseAtSeconds == null))) throw new Error('Invalid post-cap activation');
  if (carnival.status === 'active' && postCapSurvival.startedAtSeconds !== null)
    throw new Error('Carnival and survival cannot own spawning together');
  const destroyer = catharsis?.balance.defenseMode && catharsis.balance.destroyer
    ? validateDestroyer(state.destroyer ?? emptyDestroyer(carnival.status === 'complete' || carnival.status === 'skipped'
      || postCapSurvival.startedAtSeconds !== null), catharsis.balance.destroyer, state.elapsedSeconds as number,
      isPlainObject(state.squad) && (state.squad.count as number) > 0) : undefined;
  if (state.destroyer !== undefined && !destroyer) throw Error('Destroyer requires Defense configuration');
  const navalConfig = catharsis?.balance.destroyer;
  const encounterConfig = catharsis?.balance.levelEncounters;
  if ((state.levelEncounters !== undefined || state.navalPresence !== undefined) && !encounterConfig)
    throw Error('Modular naval state requires its saved opt-in policy');
  const levelEncounters = encounterConfig ? validateLevelEncounters(state.levelEncounters, encounterConfig,
    state.elapsedSeconds as number, isPlainObject(progression) ? progression.level as number : 0, state.machineGunReleaseAtSeconds as number | null,
    isPlainObject(state.squad) && (state.squad.count as number) > 0) : undefined;
  const navalPresence = encounterConfig ? validateNavalPresence(state.navalPresence, state.elapsedSeconds as number,
    navalConfig, isPlainObject(state.squad) && (state.squad.count as number) > 0) : undefined;
  const barrageConfig=catharsis?.balance.navalBarrage;
  if(state.navalBarrage!==undefined && !barrageConfig) throw Error('Barrage state requires its saved configuration');
  if (levelEncounters && (!catharsis?.balance.defenseMode || postCapSurvival.startedAtSeconds !== null && !levelEncounters.survivalEnabled))
    throw Error('Invalid modular Survival ownership');
  if (!encounterConfig && destroyer?.status === 'active' && postCapSurvival.startedAtSeconds !== null)
    throw Error('Destroyer and survival cannot share spawning ownership');
  if (!encounterConfig && destroyer?.startedAtSeconds != null && carnival.startedAtSeconds !== null) {
    if (navalConfig?.startPolicy === 'withCarnival'
      ? destroyer.startedAtSeconds !== carnival.startedAtSeconds
      : carnival.status === 'active' || destroyer.startedAtSeconds + 1e-8 < carnival.startedAtSeconds + carnival.elapsedSeconds)
      throw Error('Invalid Destroyer encounter-start policy or phase clock');
  }
  if (!encounterConfig && navalConfig?.enabled && navalConfig.startPolicy === 'withCarnival' && destroyer?.status === 'pending'
    && (carnival.status === 'active' || carnival.status === 'complete'))
    throw Error('Concurrent Destroyer must start with Carnival');
  if (!encounterConfig && postCapSurvival.startedAtSeconds !== null && destroyer?.status === 'pending' && navalConfig?.enabled
    && carnival.status !== 'skipped') throw Error('Survival cannot precede Destroyer');
  if (postCapSurvival.startedAtSeconds !== null
    && ((carnival.startedAtSeconds !== null
      && postCapSurvival.startedAtSeconds + 1e-8 < carnival.startedAtSeconds + carnival.elapsedSeconds)
      || (!encounterConfig && navalConfig?.enabled && destroyer?.status === 'complete' && destroyer.startedAtSeconds !== null
        && postCapSurvival.startedAtSeconds + 1e-8 < destroyer.startedAtSeconds + navalConfig.durationSeconds)))
    throw Error('Survival clock precedes authored encounter completion');
  if (progression !== undefined && (!catharsis?.balance.defenseMode || !isPlainObject(progression)
    || Object.keys(progression).length !== 2 || !Number.isSafeInteger(progression.level)
    || (progression.level as number) < 1 || (progression.level as number) > maxProgressionLevel(catharsis.balance.progression) || !Number.isSafeInteger(progression.xp)
    || (progression.xp as number) < 0
    || ((progression.level as number) >= maxProgressionLevel(catharsis.balance.progression) && progression.xp !== 0)
    || (progression.xp as number) >= requiredXp(progression.level as number, catharsis.balance.progression))) {
    throw new Error('Simulation progression must have a valid level and current-level XP');
  }
  // Released Defense snapshots carried these inert prototype fields. Accept only
  // their unused shapes; an active retired experiment is never reinterpreted.
  const landingAssault = state.landingAssault;
  if (landingAssault !== undefined && (!isPlainObject(landingAssault)
    || Object.keys(landingAssault).some(k => ![...Object.keys(emptyLandingAssault()),'nextGiantAtSeconds'].includes(k))
    || Object.entries(emptyLandingAssault()).some(([k,v]) => landingAssault[k] !== v)
    || (landingAssault.nextGiantAtSeconds !== undefined && landingAssault.nextGiantAtSeconds !== null)))
    throw Error('Retired landing assault snapshot is unsupported');
  const reinforcement = state.reinforcement;
  if (reinforcement !== undefined && (!isPlainObject(reinforcement) || Object.keys(reinforcement).length !== 2
    || reinforcement.startedAtSeconds !== null || reinforcement.arrived !== false))
    throw Error('Retired reinforcement snapshot is unsupported');
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
      + (value.survivalSpeedMultiplier === undefined ? 0 : 1)
      || (value.lane !== undefined && !laneIsValid(value.lane))
      || (catharsis?.balance.defenseMode && (!laneIsValid(value.lane) || value.tier !== 1))
      || (archetype !== undefined && archetype !== 'grunt' && archetype !== 'heavy' && archetype !== 'giant')
      || (value.survivalSpeedMultiplier !== undefined && (!catharsis?.balance.defenseMode
        || (archetype !== 'grunt' && archetype !== 'heavy') || !positiveFinite(value.survivalSpeedMultiplier)
        || (value.survivalSpeedMultiplier as number) > 4))
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
      ...(value.survivalSpeedMultiplier !== undefined ? { survivalSpeedMultiplier: value.survivalSpeedMultiplier as number } : {}),
      ...(value.lane !== undefined ? { lane: value.lane as number } : {}),
      ...(archetype ? { archetype: archetype as 'grunt' | 'heavy' | 'giant' } : {}) };
  });

  if (enemies.filter(e => e.archetype === 'giant').length > 1
    || (enemies.some(e => e.archetype === 'giant') && !(giantEncounter as { spawned?: boolean } | undefined)?.spawned)) {
    throw new Error('Only one introduced Giant is supported');
  }
  if (state.boss !== null) throw Error('Retired Boss snapshot is unsupported');
  const boss = null;

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
) {
      throw new Error('Simulation enemy stream cursor is invalid');
    }
    enemyStream = { nextRowIndex: cursor.nextRowIndex as number,
      nextEnemyId: cursor.nextEnemyId as number,
      nextRewardBlockIndex: cursor.nextRewardBlockIndex as number,
      nextRewardId: cursor.nextRewardId as number,
      nextBossTier: cursor.nextBossTier as number };
  }
  if (!Array.isArray(state.streamRewards) || state.streamRewards.length
    || !Array.isArray(state.gates) || state.gates.length || !Array.isArray(state.pickups) || state.pickups.length
    || state.nextPickupId !== 1) throw Error('Retired reward/gate snapshot is unsupported');
  const streamRewards: never[] = [], gates: never[] = [], pickups: never[] = [];

  if (!Array.isArray(state.projectiles)) throw new Error('Simulation projectiles must be an array');
  const projectileIds = new Set<number>();
  const projectiles: ProjectileSimulationState[] = state.projectiles.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation projectile ${index} must be a plain object`);
    if (Object.keys(value).length !== 11 + (value.lane === undefined ? 0 : 2) + (value.memberIndex === undefined ? 0 : 1)
      || (value.memberIndex !== undefined && (value.lane === undefined
        || !Number.isSafeInteger(value.memberIndex) || (value.memberIndex as number) < 0))
      || (value.lane !== undefined && (!laneIsValid(value.lane)
        || typeof value.slopeX !== 'number' || !Number.isFinite(value.slopeX)))
      || ['id', 'kind', 'tier', 'x', 'z', 'speed', 'damage', 'remainingRange', 'blastRadius', 'hitRadiusBonus', 'penetrationRemaining']
      .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation projectile ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || projectileIds.has(value.id as number)) {
      throw new Error(`Simulation projectile ${index} id must be unique and positive`);
    }
    projectileIds.add(value.id as number);
    if (value.kind !== 'rifle' && value.kind !== 'machineGun') {
      throw new Error(`Simulation projectile ${index} kind is unsupported`);
    }
    if (value.tier !== 1) {
      throw new Error(`Simulation projectile ${index} tier is invalid`);
    }
    if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation projectile ${index} position must be finite`);
    }
    if (!positiveFinite(value.speed) || !positiveFinite(value.damage) || !positiveFinite(value.remainingRange)) {
      throw new Error(`Simulation projectile ${index} speed, damage, and remainingRange must be positive and finite`);
    }
    if (typeof value.blastRadius !== 'number' || !Number.isFinite(value.blastRadius)
      || value.blastRadius !== 0) {
      throw new Error(`Simulation projectile ${index} blastRadius is invalid for its kind`);
    }
    if (typeof value.hitRadiusBonus !== 'number' || !Number.isFinite(value.hitRadiusBonus)
      || value.hitRadiusBonus < 0 || (value.kind !== 'rifle' && value.hitRadiusBonus !== 0)) {
      throw new Error(`Simulation projectile ${index} hitRadiusBonus is invalid for its kind`);
    }
    if (value.penetrationRemaining !== 0) throw Error('Retired penetrating projectile is unsupported');
    return { id: value.id as number, kind: value.kind as ProjectileSimulationState['kind'],
      ...(value.memberIndex !== undefined ? { memberIndex: value.memberIndex as number } : {}),
      ...(value.lane !== undefined ? { lane: value.lane as number, slopeX: value.slopeX as number } : {}),
      tier: value.tier as number,
      x: value.x, z: value.z, speed: value.speed,
      damage: value.damage, remainingRange: value.remainingRange, blastRadius: value.blastRadius,
      hitRadiusBonus: value.hitRadiusBonus,
      penetrationRemaining: 0 };
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

  const artillery = state.artillery !== undefined ? validateArtillery(state.artillery,
    state.elapsedSeconds as number, attackLanePositions(catharsis!.balance.laneCount,
      catharsis!.trackHalfWidth, catharsis!.balance.edgeInset), player.z as number, (squad.count as number)>0) : undefined;
  const navalBarrage=barrageConfig ? validateNavalBarrage(state.navalBarrage,barrageConfig,state.elapsedSeconds as number,
    (squad.count as number)>0,hasUnresolvedDestroyerSalvo(artillery?.shells ?? []),artillery?.shells ?? []) : undefined;
  return {
    state: {
      ...(artillery ? {artillery} : {}),
      ...(catharsis ? { catharsis } : {}),
      ...(catharsis?.balance.defenseMode ? { grenade: grenade ?? emptyGrenade() } : {}),
      ...(catharsis?.balance.defenseMode ? { postCapSurvival } : {}),
      ...(catharsis?.balance.defenseMode ? { carnival } : {}),
      ...(destroyer ? { destroyer } : {}),
      ...(levelEncounters && navalPresence ? { levelEncounters, navalPresence } : {}),
      ...(navalBarrage ? { navalBarrage } : {}),
      ...(state.defenseWaves !== undefined ? { defenseWaves: DefenseWaveStateSchema.parse(state.defenseWaves) } : {}),
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
        rifleRemainder: 0 },
      enemies,
      boss,
      enemyStream,
      streamRewards: [],
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
  private tiers: GameConfig['tiers'];
  private presentationEvents: PresentationEvent[] = [];
  private grenadeEvents: GrenadeEvent[] = [];
  private artilleryEvents: ArtilleryEvent[] = [];
  private static readonly MAX_PRESENTATION_EVENTS = 256;

  constructor(options: SimulationOptions) {
    const catharsis = options.catharsis ? validateCatharsis({ ...options.catharsis,
      rewardRowsPerReward: options.catharsis.balance.waveRows }) : undefined;
    if (!catharsis) throw Error('Beachhead Defense configuration is required');
    this.collisionDiagnostics = options.collisionDiagnostics;
    this.rng = new SeededRng(options.seed);
    const level = LevelDefinitionSchema.parse(options.level);
    if (!validSquadCount(options.startSquad)) {
      throw new Error('Simulation startSquad must be a non-negative safe integer');
    }
    if (options.startRocketCount !== 0) {
      throw new Error('Simulation startRocketCount must be a non-negative safe integer within startSquad');
    }
    if (!options.tiers || !Number.isSafeInteger(options.tiers.mergeCount) || options.tiers.mergeCount < 2
      || !positiveFinite(options.tiers.tier1Power) || !positiveFinite(options.tiers.tier2Power)
      || !Number.isFinite(options.tiers.enemyHigherTierPowerMultiplier)
      || options.tiers.enemyHigherTierPowerMultiplier <= 1
      || !Number.isFinite(options.tiers.rifleHigherTierPowerMultiplier)
      || options.tiers.rifleHigherTierPowerMultiplier <= 1
      || !positiveFinite(options.tiers.normalEnemyRadius)) throw new Error('Simulation tiers are invalid');
    this.authoredEnemyStreamDefinition = level.enemyStream;
    this.enemyStreamDefinition = this.effectiveStreamDefinition(options.seed);
    this.tiers = { ...options.tiers };
    const enemies: EnemySimulationState[] = [];
    const enemyStream = level.enemyStream
      ? { nextRowIndex: 0, nextEnemyId: enemies.length + 1, nextRewardBlockIndex: 0,
        nextRewardId: 1, nextBossTier: 1 }
      : null;
    const boss = null;
    if (enemyStream && this.enemyStreamDefinition) extendEnemyStream(enemies, enemyStream, this.enemyStreamDefinition, 0, catharsis);
    this.state = {
      ...(catharsis ? { catharsis } : {}),
      ...(catharsis?.balance.defenseMode ? { grenade: emptyGrenade() } : {}),
      ...(catharsis?.balance.defenseMode ? { postCapSurvival: emptyPostCapSurvival() } : {}),
      ...(catharsis?.balance.defenseMode ? { carnival: emptyCarnival() } : {}),
      ...(catharsis?.balance.defenseMode && catharsis.balance.destroyer ? { destroyer: emptyDestroyer() } : {}),
      ...(catharsis?.balance.defenseMode && catharsis.balance.levelEncounters ? {
        levelEncounters: emptyLevelEncounters(catharsis.balance.levelEncounters), navalPresence: emptyNavalPresence() } : {}),
      ...(catharsis?.balance.defenseMode && catharsis.balance.navalBarrage ? {
        navalBarrage:emptyNavalBarrage(options.seed,catharsis.balance.navalBarrage) } : {}),
      ...(catharsis?.balance.defenseMode && enemyStream ? { defenseWaves: { nextAtSeconds: catharsis.balance.defenseWaves.firstWaveDelaySeconds } } : {}),
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
      streamRewards: [],
      gates: [],
      projectiles: [],
      pickups: [],
      nextPickupId: 1,
      weapons: { rifleCooldownRemainingSeconds: 0, rocketCooldownRemainingSeconds: 0, nextProjectileId: 1 },
    };
  }

  setCatharsisBalance(balance: NonNullable<SimulationFrameState['catharsis']>['balance']): void {
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
    const interval = 1 / effectivePrimaryFireRate(1, progression?.level ?? 1, next.balance);
    const evolved: Partial<SimulationState> = evolves ? {
      squad: { count: evolvedCount, rocketCount: 0, rifleCounts: [evolvedCount], rifleRemainder: 0 }, projectiles: [],
      weapons: { ...this.state.weapons, rifleCooldownRemainingSeconds: interval,
        rocketCooldownRemainingSeconds: 0, rifleMemberCooldowns: [interval] },
    } : {};
    if (evolves) appendMemberClocks(evolved.weapons!.rifleMemberCooldowns!, evolvedCount, interval);
    else if (progression && this.state.progression && this.state.squad.count > 0
      && progression.level > this.state.progression.level
      && progressionStage(progression.level, next.balance.progression).weaponFamily === 'machineGun') {
      const delta = evolvedCount - progressionStage(this.state.progression.level, previous.balance.progression).squadStage;
      if (delta > 0) {
        evolved.squad = addRifleSoldiers(this.state.squad, delta, 1, this.tiers.mergeCount);
        const clocks = [...(this.state.weapons.rifleMemberCooldowns ?? [this.state.weapons.rifleCooldownRemainingSeconds])];
        clocks.forEach((clock, index) => clocks[index] = Math.min(clock, interval));
        appendMemberClocks(clocks, evolved.squad.count, interval);
        evolved.weapons = { ...this.state.weapons, rifleMemberCooldowns: clocks };
      }
    }
    if (progression && progressionStage(progression.level, next.balance.progression).weaponFamily === 'machineGun'
      && (progression.level > this.state.progression!.level
        || effectivePrimaryFireRate(1, progression.level, next.balance)
          > effectivePrimaryFireRate(1, this.state.progression!.level, previous.balance))) {
      const weapons = evolved.weapons ?? this.state.weapons;
      evolved.weapons = { ...weapons, rifleCooldownRemainingSeconds: Math.min(weapons.rifleCooldownRemainingSeconds, interval),
        ...(weapons.rifleMemberCooldowns ? { rifleMemberCooldowns: weapons.rifleMemberCooldowns.map(clock => Math.min(clock, interval)) } : {}) };
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

  // Encounter adapters supply muzzle transforms and optional per-source flight parameters.
  // No production scheduler invokes this in P3-A.
  launchArtillery(launch: ArtilleryLaunch): number | null {
    const state = this.state, c = state.catharsis;
    if (!c?.balance.defenseMode || state.squad.count === 0) return null;
    const config = c.balance.artillery ?? artilleryDefaults;
    const artillery = state.artillery ?? { version: 1 as const, nextId: 1, shells: [] };
    if (artillery.shells.length >= config.maxActive) return null;
    const lanes = attackLanePositions(c.balance.laneCount, c.trackHalfWidth, c.balance.edgeInset);
    const shell = makeArtilleryShell(artillery.nextId, launch,
      launch.targetLane ?? effectiveArtilleryLane(state.player.x, lanes), lanes, state.player.z,
      state.elapsedSeconds, config, (lanes[1] - lanes[0]) * config.impactLaneFraction);
    this.state = { ...state, artillery: { version: 1, nextId: shell.id + 1, shells: [...artillery.shells, shell] } };
    this.artilleryEvents.push({ kind: 'artilleryLaunch', shell: structuredClone(shell) });
    return shell.id;
  }
  commandEncounter(action: EncounterAction): void { applyEncounterAction(this.state, action); }

  cancelArtillery(id?: number): void {
    if (this.state.artillery) this.state = { ...this.state, artillery: { ...this.state.artillery,
      shells: id === undefined ? [] : this.state.artillery.shells.filter(shell => shell.id !== id) } };
    const c=this.state.catharsis?.balance.navalBarrage;
    if(c&&this.state.navalBarrage)this.state.navalBarrage=cancelNavalSalvo(this.state.navalBarrage,c,
      this.state.artillery?.shells??[],this.state.elapsedSeconds);
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
    if (!tuning.rifle || !positiveFinite(tuning.rifle.fireRate)
      || !positiveFinite(tuning.rifle.projectileSpeed) || !positiveFinite(tuning.rifle.range)
      || !Number.isFinite(tuning.rifle.tierHitRadiusStep) || tuning.rifle.tierHitRadiusStep < 0
      || !Number.isFinite(tuning.rifle.maxHitRadiusBonus) || tuning.rifle.maxHitRadiusBonus < 0) {
      throw new Error('Simulation rifle tuning must be positive and finite');
    }
    if (this.state.squad.count === 0) return;
    const nextElapsedSeconds = this.state.elapsedSeconds + dtSeconds;
    if (!Number.isFinite(nextElapsedSeconds) || !Number.isSafeInteger(this.state.tick + 1)) {
      throw new Error('Simulation time or tick exceeds the supported range');
    }
    for (const launch of input.artilleryLaunches ?? []) this.launchArtillery(launch);

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
    const offsets = createDefenseSquadFormation(this.state.squad.count, tuning.formationSpacing, this.state.catharsis!.balance.progression);
    const nextZ = 0;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) {
      throw new Error('Simulation movement exceeds the supported range');
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
        this.grenadeEvents.push({ kind: 'grenadeThrown' });
      }
    }
    const enemies = this.state.enemies.map((enemy) => ({ ...enemy,
      z: enemy.z - (catharsis && enemy.archetype
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
    const enemyStream = this.state.enemyStream ? { ...this.state.enemyStream } : null;
    const carnivalSpawning = carnivalOwnsSpawning(this.state);
    const ordinarySuppressed = this.state.levelEncounters ? !this.state.levelEncounters.ordinaryEnabled
      : this.state.destroyer?.status === 'active';
    let defenseWaves = this.state.defenseWaves;
    if (catharsis?.balance.defenseMode && defenseWaves && enemyStream && this.enemyStreamDefinition)
      defenseWaves = advanceDefenseWaves(defenseWaves, { ...this.state, enemies, enemyStream }, nextElapsedSeconds,
        this.enemyStreamDefinition.seed, !carnivalSpawning && !ordinarySuppressed);
    let giantEncounter = this.state.giantEncounter;
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
    let squad = { ...this.state.squad };
    const projectiles = this.state.projectiles.map((projectile) => ({ ...projectile }));
    let nextProjectileId = this.state.weapons.nextProjectileId;
    const rifleEnd = this.state.squad.count - this.state.squad.rocketCount;
    const nextCooldowns = { rifle: this.state.weapons.rifleCooldownRemainingSeconds,
      rocket: this.state.weapons.rocketCooldownRemainingSeconds };
    const memberCooldowns: number[] | undefined = catharsis?.balance.defenseMode ? [] : undefined;
    // Fire before travel; projectiles created this tick travel for this full fixed step.
    for (const kind of ['rifle'] as const) {
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
            const tier = 1;
            const damage = machineGun ? catharsis!.balance.machineGun.damageEnemyHp * this.tiers.tier1Power
              : this.tiers.tier1Power;
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
              blastRadius: 0,
              hitRadiusBonus: 0,
              penetrationRemaining: 0 });
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
    for (const projectile of projectiles) {
      if (this.collisionDiagnostics) this.collisionDiagnostics.projectilePasses++;
      const travel = Math.min(projectile.speed * dtSeconds, projectile.remainingRange);
      const endZ = projectile.z + travel;
      if (!Number.isFinite(travel) || !Number.isFinite(endZ)) throw new Error('Simulation projectile movement exceeds the supported range');
      let consumed = false;
      const hit = findFirstHit(projectile, endZ, enemyCollisionIndex, tuning.normalEnemyRadius,
          this.state.player.z, nextZ, this.collisionDiagnostics, grenade?.supply);
      if (hit) {
        if (hit.kind === 'grenadeSupply') {
          const supply = grenade!.supply!;
          const destruction = supply.destruction;
          const progress = (supply.hitProgress ?? 0) + 1;
          // Acquisition counts successful projectiles, never their damage.
          const eligible = !destruction || nextElapsedSeconds + 1e-9 >= destruction.recoverAtSeconds;
          const opened = eligible && (destruction ? destruction.stage === 2 : progress >= (supply.hitsRequired ?? 1));
          if (opened) {
            grenade!.supply = null;
            const beforeInventory = grenade!.inventory;
            grenade!.inventory = awardGrenades(beforeInventory, supply.rewardAmount ?? teachingGrenadeGrant(grenadeConfig!));
            const actualAward = grenade!.inventory - beforeInventory;
            grenade!.acquiredAtSeconds ??= nextElapsedSeconds;
            if (actualAward > 0) this.grenadeEvents.push(destruction ? { kind: 'grenadeSupplyOpened', x: supply.x,
              z: nextZ + supply.depth, amount: actualAward } : { kind: 'grenadeAcquired', amount: actualAward });
          } else if (destruction && eligible) {
            destruction.stage = (destruction.stage + 1) as 1 | 2;
            destruction.recoverAtSeconds = nextElapsedSeconds + destruction.recoverySeconds;
            this.grenadeEvents.push({ kind: 'grenadeSupplyDamaged', stage: destruction.stage });
          } else if (!destruction) {
            supply.hitProgress = progress;
            this.grenadeEvents.push({ kind: 'grenadeSupplyHit' });
          }
        } else {
          damageEnemy(hit.enemy, projectile.damage / this.tiers.tier1Power);
        }
        consumed = true;
      }
      const remainingRange = projectile.remainingRange - travel;
      if (!consumed && remainingRange > 0) {
        survivingProjectiles.push({ ...projectile, x: projectile.x + travel * (projectile.slopeX ?? 0), z: endZ, remainingRange,
          penetrationRemaining: 0 });
      }
    }
    if (grenade?.flight && nextElapsedSeconds + 1e-9 >= grenade.flight.startedAtSeconds + grenade.flight.flightSeconds) {
      const flight = grenade.flight;
      const victims = enemiesInBlast(enemies, flight.targetX, flight.targetZ, flight.blastRadius).map(enemy => {
        const damage = Math.min(enemy.hp, flight.damageEnemyHp);
        const killXp = damageEnemy(enemy, flight.damageEnemyHp);
        return { id: enemy.id, x: enemy.x, z: enemy.z, archetype: enemy.archetype!, damage, killed: enemy.hp <= 0, killXp };
      });
      this.grenadeEvents.push({ kind: 'grenadeDetonated', x: flight.targetX, z: flight.targetZ, radius: flight.blastRadius, victims });
      grenade.flight = null;
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
      const enemyTravel = catharsis && enemy.archetype
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
        const casualty = afterOneSoldierCasualty(squad);
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
        const casualty = afterOneSoldierCasualty(squad);
        squad = casualty.squad;
        stepEvents.push({ kind: 'normalEnemyContact', enemyId: enemy.id, enemyTier: enemy.tier,
          attackerX: enemy.x, attackerZ: enemy.z, playerX: nextX, playerZ: nextZ,
          before, after: copySquadForPresentation(squad), affectedMembers: casualty.affectedMembers });
      }
    }
    let artillery = this.state.artillery;
    if (artillery) {
      const pending = [] as typeof artillery.shells;
      for (const shell of [...artillery.shells].sort((a, b) => a.impactAtSeconds - b.impactAtSeconds || a.id - b.id)) {
        if (squad.count === 0) break;
        if (shell.impactAtSeconds > nextElapsedSeconds + 1e-9) { pending.push(shell); continue; }
        // Sample the real constant-speed lane motion, including arrival before step end.
        const age = Math.max(0, shell.impactAtSeconds - this.state.elapsedSeconds);
        const impactX = currentX + Math.sign(difference) * Math.min(Math.abs(difference), maxHorizontalDelta * age / dtSeconds);
        const hit = artilleryHits(shell, impactX, nextZ);
        this.artilleryEvents.push({ kind: 'artilleryImpact', id: shell.id,
          x: shell.target.x, z: shell.target.z, radius: shell.radius, atSeconds: shell.impactAtSeconds, hit });
        if (hit) {
          const before = copySquadForPresentation(squad), casualty = afterOneSoldierCasualty(squad);
          squad = casualty.squad;
          stepEvents.push({ kind: 'artilleryContact', shellId: shell.id,
            attackerX: shell.target.x, attackerZ: shell.target.z, playerX: impactX, playerZ: nextZ,
            before, after: copySquadForPresentation(squad), affectedMembers: casualty.affectedMembers });
        }
      }
      artillery = { ...artillery, shells: squad.count > 0 ? pending : [] };
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
    // Preserve the historical clamp before squad rewards, including restored
    // pending clocks longer than one period. Later rate stages also clamp below.
    if (progression && this.state.progression && progression.level > this.state.progression.level && catharsis) {
      const interval = 1 / effectivePrimaryFireRate(tuning.rifle.fireRate, progression.level, catharsis.balance);
      nextCooldowns.rifle = Math.min(nextCooldowns.rifle, interval);
      memberCooldowns?.forEach((clock, index) => memberCooldowns[index] = Math.min(clock, interval));
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
        if (stage.fireRateStage > previous.fireRateStage) {
          // Set the new period before placing later squad rewards into unused
          // phases. Otherwise overflow through Evolution can duplicate clocks.
          const interval = 1 / effectivePrimaryFireRate(tuning.rifle.fireRate, level, catharsis.balance);
          nextCooldowns.rifle = Math.min(nextCooldowns.rifle, interval);
          memberCooldowns?.forEach((clock, index) => memberCooldowns[index] = Math.min(clock, interval));
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
    if (memberCooldowns) memberCooldowns.length = squad.count - squad.rocketCount;
    if (giantEncounter && catharsis && enemyStream && squad.count > 0 && !carnivalSpawning && !ordinarySuppressed
      && !(catharsis.balance.carnival.enabled && this.state.carnival?.status === 'pending' && progression!.level >= 6))
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
      if (defenseWaves) defenseWaves.nextAtSeconds += balance.defenseWaves.intervalSeconds;
      machineGunReleaseAtSeconds = nextElapsedSeconds;
    }
    const phaseFrame: SimulationState = { ...this.state, elapsedSeconds: nextElapsedSeconds, progression, machineGunReleaseAtSeconds,
      player: { ...this.state.player, x: nextX, z: nextZ }, squad, enemies, enemyStream, grenade };
    const carnival = advanceCarnival(this.state.carnival, phaseFrame, this.enemyStreamDefinition?.seed ?? this.state.seed);
    if (phaseFrame.levelEncounters && catharsis?.balance.levelEncounters && squad.count > 0) {
      const triggers = advanceLevelEncounters(phaseFrame.levelEncounters, catharsis.balance.levelEncounters,
        nextElapsedSeconds, progression?.level ?? 0, machineGunReleaseAtSeconds ?? null);
      phaseFrame.levelEncounters = triggers.state === this.state.levelEncounters ? { ...triggers.state } : triggers.state;
      for (const action of triggers.actions ?? []) applyEncounterAction(phaseFrame, action);
      if (phaseFrame.navalPresence && catharsis.balance.destroyer)
        phaseFrame.navalPresence = advanceNavalPresence(phaseFrame.navalPresence, nextElapsedSeconds, catharsis.balance.destroyer);
    }
    const naval = phaseFrame.destroyer ? advanceDestroyer(phaseFrame.destroyer, catharsis?.balance.destroyer,
      phaseFrame.levelEncounters ? undefined : carnival, nextElapsedSeconds, squad.count > 0) : undefined;
    const survivalBlocked = carnival.status === 'active' || (phaseFrame.levelEncounters
      ? !phaseFrame.levelEncounters.survivalEnabled : naval?.state.status === 'active');
    const postCapSurvival = survivalBlocked ? emptyPostCapSurvival()
      : advancePostCapSurvival(this.state.postCapSurvival, phaseFrame);
    if (defenseWaves && this.state.postCapSurvival?.startedAtSeconds == null && postCapSurvival.startedAtSeconds !== null
      && catharsis?.balance.postCapSurvival.firstWaveDelaySeconds !== undefined)
      defenseWaves = { nextAtSeconds: postCapSurvival.startedAtSeconds + catharsis.balance.postCapSurvival.firstWaveDelaySeconds };
    this.state = { ...this.state, ...(giantEncounter ? { giantEncounter } : {}), ...(progression ? { progression } : {}), player: { ...this.state.player, x: nextX, z: nextZ }, squad, enemies, enemyStream,
      ...(catharsis?.balance.defenseMode ? { postCapSurvival } : {}),
      ...(catharsis?.balance.defenseMode ? { carnival } : {}),
      ...(naval ? { destroyer: naval.state } : {}),
      ...(phaseFrame.levelEncounters && phaseFrame.navalPresence ? {
        levelEncounters: phaseFrame.levelEncounters, navalPresence: phaseFrame.navalPresence } : {}),
      ...(phaseFrame.navalBarrage ? {navalBarrage:phaseFrame.navalBarrage} : {}),
      ...(defenseWaves ? { defenseWaves } : {}),
      ...(artillery ? { artillery } : {}),
      ...(grenade ? { grenade } : {}), streamRewards: [],
      ...(machineGunReleaseAtSeconds !== undefined ? { machineGunReleaseAtSeconds } : {}),
      pickups: [], nextPickupId: 1, projectiles: survivingProjectiles,
      weapons: { ...(memberCooldowns ? { rifleMemberCooldowns: memberCooldowns } : {}), rifleCooldownRemainingSeconds: nextCooldowns.rifle, rocketCooldownRemainingSeconds: nextCooldowns.rocket,
        nextProjectileId }, tick: this.state.tick + 1,
      elapsedSeconds: nextElapsedSeconds, rngState: this.rng.getState() };
    if (naval?.fire) this.launchArtillery({ source: destroyerMuzzle(nextElapsedSeconds - naval.state.startedAtSeconds!, catharsis!.balance.destroyer!) });
    if(this.state.navalBarrage && catharsis?.balance.navalBarrage) {
      const previous=this.state.navalBarrage, presence=this.state.navalPresence;
      const next=advanceNavalBarrage(previous,catharsis.balance.navalBarrage,nextElapsedSeconds,
        (catharsis.balance.artillery?.maxActive ?? artilleryDefaults.maxActive)-(this.state.artillery?.shells.length ?? 0),
        !!presence && presence.status!=='absent',squad.count>0,hasUnresolvedDestroyerSalvo(this.state.artillery?.shells ?? []));
      this.state.navalBarrage=next;
      if(next.opportunities!==previous.opportunities && next.lastSalvo!.outcome==='launched') {
        const source=navalPresenceMuzzle(presence!,nextElapsedSeconds,catharsis.balance.destroyer!);
        const ids=next.lastSalvo!.lanes.map(lane=>this.launchArtillery({source,targetLane:lane}));
        this.state.navalBarrage=recordNavalSalvo(next,catharsis.balance.navalBarrage,
          this.state.artillery!.shells.filter(shell=>ids.includes(shell.id)));
      }
    }
    if (stepEvents.length > 0) {
      this.presentationEvents.push(...stepEvents);
      if (this.presentationEvents.length > Simulation.MAX_PRESENTATION_EVENTS) {
        this.presentationEvents.splice(0,
          this.presentationEvents.length - Simulation.MAX_PRESENTATION_EVENTS);
      }
    }
  }

  consumeArtilleryEvents(): ArtilleryEvent[] {
    const events = this.artilleryEvents; this.artilleryEvents = []; return events;
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
      ...(this.state.artillery ? { artillery: structuredClone(this.state.artillery) } : {}),
      ...(this.state.catharsis ? { catharsis: structuredClone(this.state.catharsis) } : {}),
      ...(this.state.grenade ? { grenade: structuredClone(this.state.grenade) } : {}),
      ...(this.state.postCapSurvival ? { postCapSurvival: { ...this.state.postCapSurvival } } : {}),
      ...(this.state.carnival ? { carnival: { ...this.state.carnival } } : {}),
      ...(this.state.destroyer ? { destroyer: { ...this.state.destroyer } } : {}),
      ...(this.state.levelEncounters ? { levelEncounters: { ...this.state.levelEncounters,
        triggers: this.state.levelEncounters.triggers.map(t => ({ ...t })) } } : {}),
      ...(this.state.navalPresence ? { navalPresence: { ...this.state.navalPresence } } : {}),
      ...(this.state.navalBarrage ? { navalBarrage:structuredClone(this.state.navalBarrage) } : {}),
      ...(this.state.defenseWaves ? { defenseWaves: { ...this.state.defenseWaves } } : {}),
      ...(this.state.progression ? { progression: { ...this.state.progression } } : {}),
      ...(this.state.reinforcement ? { reinforcement: { ...this.state.reinforcement } } : {}),
      ...(this.state.giantEncounter ? { giantEncounter: { ...this.state.giantEncounter } } : {}),
      ...(this.state.landingAssault ? { landingAssault: { ...this.state.landingAssault } } : {}),
      rngState: this.rng.getState(),
      player: { ...this.state.player },
      squad: { ...this.state.squad, rifleCounts: [...this.state.squad.rifleCounts] },
      enemies: this.state.enemies.map((enemy) => ({ ...enemy })),
      boss: null,
      enemyStream: this.state.enemyStream ? { ...this.state.enemyStream } : null,
      streamRewards: [],
      gates: [],
      pickups: [],
      projectiles: this.state.projectiles.map((projectile) => ({ ...projectile })),
      weapons: { ...this.state.weapons, ...(this.state.weapons.rifleMemberCooldowns ? { rifleMemberCooldowns: [...this.state.weapons.rifleMemberCooldowns] } : {}) },
    };
  }

  restoreState(state: SimulationState): void {
    const candidate = validateState(state, this.tiers.mergeCount);
    if (candidate.state.catharsis?.balance.defenseMode) {
      const s = candidate.state, origin = s.player.z, balance = s.catharsis!.balance;
      if (!s.defenseWaves && s.enemyStream && this.authoredEnemyStreamDefinition) {
        const stream = this.authoredEnemyStreamDefinition;
        const nextRow = Math.ceil(s.enemyStream.nextRowIndex / balance.waveRows) * balance.waveRows;
        // One-time conversion of old distance cursor to a deadline, not a virtual player.
        s.defenseWaves = { nextAtSeconds: s.elapsedSeconds + Math.max(0,
          (stream.startZ + nextRow * stream.spacing - origin - balance.defenseSpawnAheadDistance) / LEGACY_DEFENSE_FORWARD_SPEED) };
      }
      s.player.z = 0;
      for (const shell of s.artillery?.shells ?? []) { shell.source.position.z -= origin; shell.target.z -= origin; }
      for (const enemy of s.enemies) enemy.z -= origin;
      for (const projectile of s.projectiles) projectile.z -= origin;
      if (s.grenade?.flight) { s.grenade.flight.startZ -= origin; s.grenade.flight.targetZ -= origin; }
      if ([...s.enemies.map(e => e.z), ...s.projectiles.map(p => p.z),
        ...(s.grenade?.flight ? [s.grenade.flight.startZ, s.grenade.flight.targetZ] : []),
        ...(s.defenseWaves ? [s.defenseWaves.nextAtSeconds] : [])].some(n => !Number.isFinite(n)))
        throw new Error('Defense snapshot rebase exceeds supported range');
    }
    if ((candidate.state.enemyStream !== null) !== (this.enemyStreamDefinition !== undefined)) {
      throw new Error('Simulation enemy stream state does not match the loaded level');
    }
    if (candidate.state.enemyStream?.nextBossTier !== undefined && candidate.state.enemyStream.nextBossTier !== 1)
      throw Error('Retired tier stream is unsupported');
    this.state = candidate.state;
    this.grenadeEvents = [];
    this.artilleryEvents = [];
    this.rng = candidate.rng;
    this.enemyStreamDefinition = this.effectiveStreamDefinition(candidate.state.seed);
    this.presentationEvents = [];
  }

  private effectiveStreamDefinition(runSeed: number): EnemyStreamDefinition | undefined {
    const authored = this.authoredEnemyStreamDefinition;
    if (!authored) return undefined;
    return { ...authored, seed: effectiveSeed(runSeed, authored.seed) };
  }
}



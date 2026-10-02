import type { CatharsisConfig } from '../../config/catharsisConfig';
import type { EnemySimulationState, EnemyStreamSimulationState, LandingAssaultState } from '../SimulationState';
import { SeededRng } from '../../core/Rng';
import { attackLanePositions } from './laneComposition';
import { pressureGroupSize } from './latePressure';

export const emptyLandingAssault = (): LandingAssaultState => ({ reinforcementActiveAtSeconds: null,
  startedAtSeconds: null, nextWaveAtSeconds: null, waveIndex: 0, secondGiantSpawned: false, nextGiantAtSeconds: null });

export function landingPrimaryLanes(index: number, seed: number, count: number): number[] {
  // Rotate through distinct pairs; a seeded offset/order gives each run a stable invasion plan.
  const pairs: number[][] = [];
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) pairs.push([a, b]);
  const rng = new SeededRng((seed ^ 0x51ed270b) >>> 0);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1); [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs[index % pairs.length];
}

export function landingComposition(index: number, seed: number, balance: CatharsisConfig, halfWidth: number) {
  const config = balance.landingAssault, positions = attackLanePositions(balance.laneCount, halfWidth, balance.edgeInset);
  const primary = landingPrimaryLanes(index, seed, positions.length);
  const secondary = positions.map((_, lane) => lane).filter(lane => !primary.includes(lane));
  const primaryCount = Math.round(config.groupSize * config.primaryLaneShare);
  const rng = new SeededRng((seed ^ Math.imul(index + 1, 0xc2b2ae35)) >>> 0);
  // Split authored expected Heavy quantity across primary lanes, without HP inflation or extra population.
  const heavyChance = Math.min(config.heavyChanceCap, balance.heavyChance
    * config.groupSize / pressureGroupSize(balance, balance.progression.reinforcementLevel) * config.heavyMultiplier / primary.length);
  const heavyLanes = primary.filter(() => rng.nextFloat() < heavyChance);
  const spacing = positions[1] - positions[0];
  const members = Array.from({ length: config.groupSize }, (_, member) => {
    const lane = member < primaryCount ? primary[member % primary.length]
      : secondary[(member - primaryCount) % secondary.length];
    const spread = spacing * balance.lateralSpreadFraction;
    const low = Math.max(positions[0], positions[lane] - spread);
    const high = Math.min(positions.at(-1)!, positions[lane] + spread);
    return { lane, x: low + rng.nextFloat() * (high - low), z: -rng.nextFloat() * balance.crowdDepthSpan,
      archetype: member < primary.length && heavyLanes.includes(lane) ? 'heavy' as const : 'grunt' as const };
  });
  for (const leader of members.filter(member => member.archetype === 'heavy')) {
    leader.x = positions[leader.lane]; leader.z = -balance.crowdDepthSpan;
    const clearance = Math.min(balance.heavyFrontClearance, balance.crowdDepthSpan);
    for (const member of members) if (member !== leader && member.lane === leader.lane)
      member.z = -balance.crowdDepthSpan + clearance
        + (member.z + balance.crowdDepthSpan) * (balance.crowdDepthSpan - clearance) / balance.crowdDepthSpan;
  }
  return members;
}

export function advanceLandingAssault(previous: LandingAssaultState, now: number, playerZ: number,
  balance: CatharsisConfig, halfWidth: number, seed: number, intervalSeconds: number,
  enemies: EnemySimulationState[], cursor: EnemyStreamSimulationState): LandingAssaultState {
  const state = { ...previous }, config = balance.landingAssault;
  if (!config.enabled || state.reinforcementActiveAtSeconds === null) return state;
  const start = state.reinforcementActiveAtSeconds + config.powerWindowSeconds;
  if (now + 1e-9 < start) return state;
  state.startedAtSeconds ??= start;
  state.nextWaveAtSeconds ??= start;
  // One pending group: no catch-up burst after a soft-cap delay.
  if (now + 1e-9 >= state.nextWaveAtSeconds && enemies.length + config.groupSize <= config.activeSoftCap) {
    if (!Number.isSafeInteger(cursor.nextEnemyId + config.groupSize) || !Number.isSafeInteger(state.waveIndex + 1))
      throw new Error('Landing stream exceeds supported ID range');
    const members = landingComposition(state.waveIndex, seed, balance, halfWidth);
    for (const member of members) enemies.push({ ...member, id: cursor.nextEnemyId++, tier: 1,
      z: playerZ + balance.defenseSpawnAheadDistance + member.z,
      hp: member.archetype === 'heavy' ? balance.heavyHp : 1 });
    state.waveIndex++;
    state.nextWaveAtSeconds = now + intervalSeconds * config.cadenceMultiplier;
  }
  const giants = enemies.filter(enemy => enemy.archetype === 'giant');
  const eligibleAt = !state.secondGiantSpawned ? state.startedAtSeconds + config.secondGiantDelaySeconds
    : config.maxSimultaneousGiants > 1 ? state.nextGiantAtSeconds : null;
  if (balance.giant.enabled && state.waveIndex > 0 && eligibleAt != null && now + 1e-9 >= eligibleAt
    && giants.length < config.maxSimultaneousGiants && enemies.length < config.activeSoftCap) {
    if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) throw new Error('Giant ID exceeds supported range');
    const primary = landingPrimaryLanes(Math.max(0, state.waveIndex - 1), seed, balance.laneCount);
    const interior = primary.filter(lane => lane > 0 && lane < balance.laneCount - 1);
    const free = (lane: number) => !giants.some(giant => giant.lane === lane);
    const separated = (lane: number) => free(lane) && giants.every(giant => Math.abs(lane - giant.lane!) >= 2);
    const preferred = interior.filter(separated);
    const wider = Array.from({ length: balance.laneCount }, (_, lane) => lane).filter(separated);
    const interiorFree = Array.from({ length: balance.laneCount - 2 }, (_, lane) => lane + 1).filter(free);
    const candidates = preferred.length ? preferred : wider.length ? wider : interiorFree.length ? interiorFree
      : Array.from({ length: balance.laneCount }, (_, lane) => lane).filter(free);
    const lane = candidates.reduce((a, b) => enemies.filter(e => e.lane === a).length
      >= enemies.filter(e => e.lane === b).length ? a : b);
    const positions = attackLanePositions(balance.laneCount, halfWidth, balance.edgeInset);
    enemies.push({ id: cursor.nextEnemyId++, tier: 1, lane, x: positions[lane],
      z: playerZ + balance.defenseSpawnAheadDistance - balance.crowdDepthSpan,
      archetype: 'giant', hp: balance.giant.hp });
    state.nextGiantAtSeconds = state.secondGiantSpawned || config.maxSimultaneousGiants === 1
      ? null : now + config.giantFollowupDelaySeconds;
    state.secondGiantSpawned = true;
  }
  return state;
}

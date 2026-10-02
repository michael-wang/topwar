import type { CatharsisConfig } from '../../config/catharsisConfig';
import type { EnemySimulationState, EnemyStreamSimulationState, SimulationState } from '../SimulationState';
import { attackLanePositions } from './laneComposition';

// Quantity only; future groups use the current level, existing enemies stay untouched.
export function pressureGroupSize(balance: CatharsisConfig, level: number): number {
  const multiplier = balance.pressureMultipliers[Math.min(level - 1, balance.pressureMultipliers.length - 1)];
  return Math.round(balance.groupSize * multiplier);
}

export function enemyApproachSpeed(enemy: EnemySimulationState, balance: CatharsisConfig): number {
  return enemy.archetype === 'giant' ? balance.giant.speed
    : enemy.archetype === 'heavy' ? balance.heavySpeed : balance.gruntSpeed;
}

export function advanceGiantEncounter(previous: NonNullable<SimulationState['giantEncounter']>,
  level: number, nowSeconds: number, playerZ: number, balance: CatharsisConfig, halfWidth: number,
  enemies: EnemySimulationState[], cursor: EnemyStreamSimulationState): NonNullable<SimulationState['giantEncounter']> {
  const state = { ...previous };
  if (!balance.giant.enabled || state.spawned || level < balance.giant.unlockLevel) return state;
  state.scheduledAtSeconds ??= nowSeconds + balance.giant.introDelaySeconds;
  if (nowSeconds < state.scheduledAtSeconds) return state;
  const lanes = attackLanePositions(balance.laneCount, halfWidth, balance.edgeInset);
  const counts = lanes.map((_, lane) => enemies.filter(e => e.lane === lane && e.z > playerZ).length);
  // Interior corridors keep the large first silhouette inside the portrait framing.
  // Choose the least crowded, then prefer the center; no gameplay RNG is consumed.
  const lane = lanes.map((_, lane) => lane).filter(lane => lane > 0 && lane < lanes.length - 1)
    .sort((a, b) => counts[a] - counts[b] || Math.abs(a - (lanes.length - 1) / 2)
      - Math.abs(b - (lanes.length - 1) / 2) || a - b)[0];
  if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) throw new Error('Giant ID exceeds supported range');
  enemies.push({ id: cursor.nextEnemyId++, tier: 1, archetype: 'giant', lane, x: lanes[lane],
    z: playerZ + balance.defenseSpawnAheadDistance - balance.crowdDepthSpan, hp: balance.giant.hp });
  state.spawned = true;
  return state;
}

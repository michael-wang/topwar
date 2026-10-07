import type { CatharsisConfig } from '../../config/catharsisConfig';
import type { EnemySimulationState, EnemyStreamSimulationState } from '../SimulationState';
import { laneCompositionForRow } from './laneComposition';

// Shared by ordinary admissions and the one-time MG release. IDs and HP remain authoritative.
export function admitDefenseGroup(enemies: EnemySimulationState[], cursor: EnemyStreamSimulationState,
  row: number, seed: number, balance: CatharsisConfig & { heavyCount?: number }, halfWidth: number, originZ: number): void {
  const members = laneCompositionForRow(row, seed, balance, halfWidth);
  if (!Number.isSafeInteger(cursor.nextEnemyId + members.length)) throw new Error('Enemy group ID exceeds supported range');
  for (const member of members) enemies.push({ id: cursor.nextEnemyId++, tier: 1,
    archetype: member.archetype, lane: member.lane, x: member.x, z: originZ + member.z,
    hp: member.archetype === 'heavy' ? balance.heavyHp : 1 });
}

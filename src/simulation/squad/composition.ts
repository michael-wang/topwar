import type { SquadSimulationState, SimulationFrameState } from '../SimulationState';

// Keep the released roster wire shape, but the Defense game has physical members,
// no tier exchange, rockets or hidden defensive value.
export function validateSquad(squad: SimulationFrameState['squad'], _mergeCount?: number): void {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0 || squad.rocketCount !== 0
    || squad.rifleRemainder !== 0 || !Array.isArray(squad.rifleCounts)
    || (squad.count === 0 ? squad.rifleCounts.length !== 0
      : squad.rifleCounts.length !== 1 || squad.rifleCounts[0] !== squad.count)) {
    throw Error('Unsupported or invalid Defense squad roster');
  }
}
export function normalizeRifleSquad(squad: SquadSimulationState, _mergeCount?: number): SquadSimulationState {
  const result = { ...squad, rifleCounts: squad.count ? [squad.count] : [] };
  validateSquad(result); return result;
}
export function rifleDefenseValue(squad: SimulationFrameState['squad'], _mergeCount?: number): bigint {
  validateSquad(squad); return BigInt(squad.count);
}
export function addRifleSoldiers(squad: SquadSimulationState, amount: number,
  tier = 1, _mergeCount?: number): SquadSimulationState {
  validateSquad(squad);
  if (tier !== 1 || !Number.isSafeInteger(amount) || amount <= 0
    || !Number.isSafeInteger(squad.count + amount)) throw Error('Invalid Defense squad addition');
  const count = squad.count + amount;
  return { count, rocketCount: 0, rifleCounts: [count], rifleRemainder: 0 };
}
export interface CasualtyMember { index: number; tier: number; rocket: boolean }
export function afterOneSoldierCasualty(squad: SquadSimulationState): {
  squad: SquadSimulationState; affectedMembers: CasualtyMember[] } {
  validateSquad(squad);
  if (!squad.count) return { squad, affectedMembers: [] };
  const count = squad.count - 1;
  return { squad: { count, rocketCount: 0, rifleCounts: count ? [count] : [], rifleRemainder: 0 },
    affectedMembers: [{ index: 0, tier: 1, rocket: false }] };
}

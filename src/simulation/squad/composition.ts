import type { SquadSimulationState } from '../SimulationState';

export function afterCasualties(squad: SquadSimulationState, casualties: number): SquadSimulationState {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0 || !Number.isSafeInteger(squad.rocketCount)
    || squad.rocketCount < 0 || squad.rocketCount > squad.count
    || !Number.isSafeInteger(casualties) || casualties < 0) {
    throw new Error('Squad composition and casualties must be valid non-negative safe integers');
  }
  const count = Math.max(0, squad.count - casualties);
  return { count, rocketCount: Math.min(squad.rocketCount, count) };
}

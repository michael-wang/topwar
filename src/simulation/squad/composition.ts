import type { SquadSimulationState } from '../SimulationState';

export function tier1RifleCount(squad: SquadSimulationState): number {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0
    || !Number.isSafeInteger(squad.rocketCount) || squad.rocketCount < 0
    || !Number.isSafeInteger(squad.tier2RifleCount) || squad.tier2RifleCount < 0
    || squad.rocketCount + squad.tier2RifleCount > squad.count) {
    throw new Error('Squad composition must contain valid non-negative safe integers');
  }
  return squad.count - squad.rocketCount - squad.tier2RifleCount;
}

export function normalizeRifleSquad(squad: SquadSimulationState): SquadSimulationState {
  const upgrades = Math.floor(tier1RifleCount(squad) / 100);
  return { count: squad.count - 99 * upgrades, rocketCount: squad.rocketCount,
    tier2RifleCount: squad.tier2RifleCount + upgrades };
}

export function addRifleSoldiers(squad: SquadSimulationState, amount: number,
  tier: 1 | 2): SquadSimulationState {
  tier1RifleCount(squad);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(squad.count + amount)
    || (tier === 2 && !Number.isSafeInteger(squad.tier2RifleCount + amount))) {
    throw new Error('Simulation squad reward exceeds the supported range');
  }
  const grown = { ...squad, count: squad.count + amount,
    tier2RifleCount: squad.tier2RifleCount + (tier === 2 ? amount : 0) };
  return tier === 1 ? normalizeRifleSquad(grown) : grown;
}

export function afterCasualties(squad: SquadSimulationState, casualties: number): SquadSimulationState {
  const tier1 = tier1RifleCount(squad);
  if (!Number.isSafeInteger(casualties) || casualties < 0) {
    throw new Error('Squad composition and casualties must be valid non-negative safe integers');
  }
  const count = Math.max(0, squad.count - casualties);
  const afterTier1 = Math.max(0, casualties - tier1);
  const tier2RifleCount = Math.max(0, squad.tier2RifleCount - afterTier1);
  const afterTier2 = Math.max(0, afterTier1 - squad.tier2RifleCount);
  return { count, tier2RifleCount, rocketCount: Math.max(0, squad.rocketCount - afterTier2) };
}

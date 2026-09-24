import type { SquadSimulationState } from '../SimulationState';
import { TIER2_EXCHANGE_VALUE } from '../tierExchange';

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
  const upgrades = Math.floor(tier1RifleCount(squad) / TIER2_EXCHANGE_VALUE);
  return { count: squad.count - (TIER2_EXCHANGE_VALUE - 1) * upgrades,
    rocketCount: squad.rocketCount,
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
  let tier1 = tier1RifleCount(squad);
  if (!Number.isSafeInteger(casualties) || casualties < 0) {
    throw new Error('Squad composition and casualties must be valid non-negative safe integers');
  }
  let remaining = casualties;
  const lostTier1 = Math.min(tier1, remaining);
  tier1 -= lostTier1;
  remaining -= lostTier1;
  const lostTier2 = Math.min(squad.tier2RifleCount,
    Math.floor(remaining / TIER2_EXCHANGE_VALUE));
  let tier2RifleCount = squad.tier2RifleCount - lostTier2;
  remaining -= lostTier2 * TIER2_EXCHANGE_VALUE;
  if (remaining > 0 && tier2RifleCount > 0) {
    // One damaged Tier-2 body becomes its unspent Tier-1 defensive value.
    tier2RifleCount--;
    tier1 += TIER2_EXCHANGE_VALUE - remaining;
    remaining = 0;
  }
  const rocketCount = Math.max(0, squad.rocketCount - remaining);
  const count = tier1 + tier2RifleCount + rocketCount;
  if (!Number.isSafeInteger(count)) throw new Error('Simulation squad casualty result exceeds the supported range');
  return { count, tier2RifleCount, rocketCount };
}

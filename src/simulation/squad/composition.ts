import type { SquadSimulationState } from '../SimulationState';
import { TIER2_EXCHANGE_VALUE, TIER3_EXCHANGE_VALUE } from '../tierExchange';

export function tier1RifleCount(squad: SquadSimulationState): number {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0
    || !Number.isSafeInteger(squad.rocketCount) || squad.rocketCount < 0
    || !Number.isSafeInteger(squad.tier2RifleCount) || squad.tier2RifleCount < 0
    || !Number.isSafeInteger(squad.tier3RifleCount) || squad.tier3RifleCount < 0
    || !Number.isSafeInteger(squad.rocketCount + squad.tier2RifleCount + squad.tier3RifleCount)
    || squad.rocketCount + squad.tier2RifleCount + squad.tier3RifleCount > squad.count) {
    throw new Error('Squad composition must contain valid non-negative safe integers');
  }
  return squad.count - squad.rocketCount - squad.tier2RifleCount - squad.tier3RifleCount;
}

export function normalizeRifleSquad(squad: SquadSimulationState): SquadSimulationState {
  const tier1 = tier1RifleCount(squad);
  const tier2Total = squad.tier2RifleCount + Math.floor(tier1 / TIER2_EXCHANGE_VALUE);
  const tier3 = squad.tier3RifleCount + Math.floor(tier2Total / TIER2_EXCHANGE_VALUE);
  const tier2 = tier2Total % TIER2_EXCHANGE_VALUE;
  const count = tier1 % TIER2_EXCHANGE_VALUE + tier2 + tier3 + squad.rocketCount;
  if (![tier2Total, tier3, count].every(Number.isSafeInteger)) {
    throw new Error('Simulation squad normalization exceeds the supported range');
  }
  return { count, rocketCount: squad.rocketCount, tier2RifleCount: tier2, tier3RifleCount: tier3 };
}

export function addRifleSoldiers(squad: SquadSimulationState, amount: number,
  tier: 1 | 2 | 3): SquadSimulationState {
  tier1RifleCount(squad);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(squad.count + amount)
    || (tier === 2 && !Number.isSafeInteger(squad.tier2RifleCount + amount))
    || (tier === 3 && !Number.isSafeInteger(squad.tier3RifleCount + amount))) {
    throw new Error('Simulation squad reward exceeds the supported range');
  }
  return normalizeRifleSquad({ count: squad.count + amount, rocketCount: squad.rocketCount,
    tier2RifleCount: squad.tier2RifleCount + (tier === 2 ? amount : 0),
    tier3RifleCount: squad.tier3RifleCount + (tier === 3 ? amount : 0) });
}

export function afterCasualties(squad: SquadSimulationState, casualties: number): SquadSimulationState {
  const tier1 = tier1RifleCount(squad);
  if (!Number.isSafeInteger(casualties) || casualties < 0) {
    throw new Error('Squad composition and casualties must be valid non-negative safe integers');
  }
  const rifleDefense = tier1 + squad.tier2RifleCount * TIER2_EXCHANGE_VALUE
    + squad.tier3RifleCount * TIER3_EXCHANGE_VALUE;
  if (!Number.isSafeInteger(rifleDefense)) {
    throw new Error('Simulation squad defensive value exceeds the supported range');
  }
  const remainingRifleDefense = Math.max(0, rifleDefense - casualties);
  const rocketCount = Math.max(0, squad.rocketCount - Math.max(0, casualties - rifleDefense));
  const tier3RifleCount = Math.floor(remainingRifleDefense / TIER3_EXCHANGE_VALUE);
  const tier2RifleCount = Math.floor((remainingRifleDefense % TIER3_EXCHANGE_VALUE) / TIER2_EXCHANGE_VALUE);
  const tier1Remainder = remainingRifleDefense % TIER2_EXCHANGE_VALUE;
  const count = tier1Remainder + tier2RifleCount + tier3RifleCount + rocketCount;
  if (!Number.isSafeInteger(count)) throw new Error('Simulation squad casualty result exceeds the supported range');
  return { count, tier2RifleCount, tier3RifleCount, rocketCount };
}

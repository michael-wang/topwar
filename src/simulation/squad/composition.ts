import type { SquadSimulationState } from '../SimulationState';
import { exchangeValueForTier } from '../tiers/tierRules';

export function validateSquad(squad: SquadSimulationState): void {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0
    || !Number.isSafeInteger(squad.rocketCount) || squad.rocketCount < 0
    || !Array.isArray(squad.rifleCounts)) {
    throw new Error('Squad composition must contain valid non-negative safe integers');
  }
  let total = squad.rocketCount;
  for (let index = 0; index < squad.rifleCounts.length; index++) {
    const count = squad.rifleCounts[index];
    if (!Object.hasOwn(squad.rifleCounts, index) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('Squad rifle counts must be dense non-negative safe integers');
    }
    total += count;
    if (!Number.isSafeInteger(total)) throw new Error('Squad count exceeds the supported range');
  }
  if (total !== squad.count) throw new Error('Squad count must equal visible rifle and rocket bodies');
}

export function normalizeRifleSquad(squad: SquadSimulationState, mergeCount: number): SquadSimulationState {
  validateSquad(squad);
  if (!Number.isSafeInteger(mergeCount) || mergeCount < 2) throw new Error('Invalid rifle merge count');
  const counts = [...squad.rifleCounts];
  for (let index = 0; index < counts.length; index++) {
    const upgrades = Math.floor(counts[index] / mergeCount);
    counts[index] %= mergeCount;
    if (upgrades) {
      counts[index + 1] = (counts[index + 1] ?? 0) + upgrades;
      if (!Number.isSafeInteger(counts[index + 1])) throw new Error('Squad normalization exceeds the supported range');
    }
  }
  while (counts.length && counts[counts.length - 1] === 0) counts.pop();
  const count = squad.rocketCount + counts.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(count)) throw new Error('Squad normalization exceeds the supported range');
  return { count, rocketCount: squad.rocketCount, rifleCounts: counts };
}

export function addRifleSoldiers(squad: SquadSimulationState, amount: number,
  tier: number, mergeCount: number): SquadSimulationState {
  validateSquad(squad);
  if (!Number.isSafeInteger(tier) || tier < 1 || !Number.isSafeInteger(amount) || amount <= 0
    || !Number.isSafeInteger(squad.count + amount)) throw new Error('Squad reward exceeds the supported range');
  const counts = [...squad.rifleCounts];
  counts[tier - 1] = (counts[tier - 1] ?? 0) + amount;
  if (!Number.isSafeInteger(counts[tier - 1])) throw new Error('Squad reward exceeds the supported range');
  for (let index = 0; index < counts.length; index++) counts[index] ??= 0;
  return normalizeRifleSquad({ count: squad.count + amount,
    rocketCount: squad.rocketCount, rifleCounts: counts }, mergeCount);
}

export function rifleDefenseValue(squad: SquadSimulationState, mergeCount: number): number {
  validateSquad(squad);
  let value = 0;
  squad.rifleCounts.forEach((count, index) => {
    if (!count) return;
    value += count * exchangeValueForTier(index + 1, mergeCount);
    if (!Number.isSafeInteger(value)) throw new Error('Squad defense exceeds the supported range');
  });
  return value;
}

export function afterCasualties(squad: SquadSimulationState, casualties: number,
  mergeCount: number): SquadSimulationState {
  if (!Number.isSafeInteger(casualties) || casualties < 0) throw new Error('Invalid casualty count');
  const rifleDefense = rifleDefenseValue(squad, mergeCount);
  let remaining = Math.max(0, rifleDefense - casualties);
  const rocketCount = Math.max(0, squad.rocketCount - Math.max(0, casualties - rifleDefense));
  const counts: number[] = [];
  while (remaining > 0) {
    counts.push(remaining % mergeCount);
    remaining = Math.floor(remaining / mergeCount);
  }
  const count = rocketCount + counts.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(count)) throw new Error('Squad casualty result exceeds the supported range');
  return { count, rocketCount, rifleCounts: counts };
}

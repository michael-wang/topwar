import type { SquadSimulationState } from '../SimulationState';
import { exchangeValueForTier } from '../tiers/tierRules';

function validateRawSquad(squad: SquadSimulationState): void {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0
    || !Number.isSafeInteger(squad.rocketCount) || squad.rocketCount < 0
    || !Number.isSafeInteger(squad.rifleRemainder) || squad.rifleRemainder < 0
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

export function validateSquad(squad: SquadSimulationState, mergeCount: number): void {
  validateRawSquad(squad);
  if (!Number.isSafeInteger(mergeCount) || mergeCount < 2) throw new Error('Invalid rifle merge count');
  let highestIndex = squad.rifleCounts.length - 1;
  while (highestIndex >= 0 && squad.rifleCounts[highestIndex] === 0) highestIndex--;
  if (highestIndex < 0) {
    if (squad.rifleRemainder !== 0 || squad.rifleCounts.length !== 0) {
      throw new Error('Squad without active rifles must have no rifle value');
    }
    return;
  }
  if (squad.rifleCounts.length !== highestIndex + 1
    || squad.rifleCounts.some((count, index) => count >= mergeCount || (index < highestIndex - 1 && count > 0))) {
    throw new Error('Squad active rifle tiers must be canonical and adjacent');
  }
  const remainderLimit = highestIndex < 2 ? 0 : exchangeValueForTier(highestIndex, mergeCount);
  if ((highestIndex < 2 && squad.rifleRemainder !== 0)
    || (highestIndex >= 2 && squad.rifleRemainder >= remainderLimit)) {
    throw new Error('Squad rifle remainder exceeds the active tier floor');
  }
}

export function compactRifleValue(value: number, mergeCount: number, rocketCount = 0): SquadSimulationState {
  if (!Number.isSafeInteger(value) || value < 0
    || !Number.isSafeInteger(rocketCount) || rocketCount < 0
    || !Number.isSafeInteger(mergeCount) || mergeCount < 2) {
    throw new Error('Invalid rifle value, rocket count, or merge count');
  }
  const digits: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    digits.push(remaining % mergeCount);
    remaining = Math.floor(remaining / mergeCount);
  }
  const highestTier = digits.length;
  const lowestVisibleIndex = Math.max(0, highestTier - 2);
  const rifleRemainder = highestTier <= 2 ? 0
    : value % exchangeValueForTier(highestTier - 1, mergeCount);
  for (let index = 0; index < lowestVisibleIndex; index++) digits[index] = 0;
  const count = rocketCount + digits.reduce((sum, digit) => sum + digit, 0);
  if (!Number.isSafeInteger(count)) throw new Error('Squad visible count exceeds the supported range');
  return { count, rocketCount, rifleCounts: digits, rifleRemainder };
}

export function rifleDefenseValue(squad: SquadSimulationState, mergeCount: number): number {
  validateRawSquad(squad);
  let value = squad.rifleRemainder;
  squad.rifleCounts.forEach((count, index) => {
    if (!count) return;
    value += count * exchangeValueForTier(index + 1, mergeCount);
    if (!Number.isSafeInteger(value)) throw new Error('Squad defense exceeds the supported range');
  });
  return value;
}

export function normalizeRifleSquad(squad: SquadSimulationState, mergeCount: number): SquadSimulationState {
  return compactRifleValue(rifleDefenseValue(squad, mergeCount), mergeCount, squad.rocketCount);
}

export function addRifleSoldiers(squad: SquadSimulationState, amount: number,
  tier: number, mergeCount: number): SquadSimulationState {
  validateSquad(squad, mergeCount);
  if (!Number.isSafeInteger(tier) || tier < 1 || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Squad reward tier or amount is invalid');
  }
  const addedValue = amount * exchangeValueForTier(tier, mergeCount);
  const nextValue = rifleDefenseValue(squad, mergeCount) + addedValue;
  if (!Number.isSafeInteger(addedValue) || !Number.isSafeInteger(nextValue)) {
    throw new Error('Squad reward exceeds the supported range');
  }
  return compactRifleValue(nextValue, mergeCount, squad.rocketCount);
}

export function afterCasualties(squad: SquadSimulationState, casualties: number,
  mergeCount: number): SquadSimulationState {
  validateSquad(squad, mergeCount);
  if (!Number.isSafeInteger(casualties) || casualties < 0) throw new Error('Invalid casualty count');
  const rifleDefense = rifleDefenseValue(squad, mergeCount);
  const remainingRifleValue = Math.max(0, rifleDefense - casualties);
  const remainingRockets = Math.max(0, squad.rocketCount - Math.max(0, casualties - rifleDefense));
  return compactRifleValue(remainingRifleValue, mergeCount, remainingRockets);
}

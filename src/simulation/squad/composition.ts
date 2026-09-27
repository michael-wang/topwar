import type { SquadSimulationState } from '../SimulationState';
import { readExactValue, storeExactValue } from '../tiers/exactValue';
import { exchangeValueForTier } from '../tiers/tierRules';

function validateRawSquad(squad: SquadSimulationState): void {
  if (!Number.isSafeInteger(squad.count) || squad.count < 0
    || !Number.isSafeInteger(squad.rocketCount) || squad.rocketCount < 0
    || !Array.isArray(squad.rifleCounts)) {
    throw new Error('Squad composition must contain valid non-negative safe integers');
  }
  readExactValue(squad.rifleRemainder, 'Squad rifle remainder');
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
    if (readExactValue(squad.rifleRemainder, 'Squad rifle remainder') !== 0n || squad.rifleCounts.length !== 0) {
      throw new Error('Squad without active rifles must have no rifle value');
    }
    return;
  }
  if (squad.rifleCounts.length !== highestIndex + 1
    || squad.rifleCounts.some((count, index) => count >= mergeCount || (index < highestIndex - 1 && count > 0))) {
    throw new Error('Squad active rifle tiers must be canonical and adjacent');
  }
  const remainder = readExactValue(squad.rifleRemainder, 'Squad rifle remainder');
  const remainderLimit = highestIndex < 2 ? 0n : exchangeValueForTier(highestIndex, mergeCount);
  if ((highestIndex < 2 && remainder !== 0n)
    || (highestIndex >= 2 && remainder >= remainderLimit)) {
    throw new Error('Squad rifle remainder exceeds the active tier floor');
  }
}

export function compactRifleValue(value: number | bigint, mergeCount: number, rocketCount = 0): SquadSimulationState {
  if (!Number.isSafeInteger(rocketCount) || rocketCount < 0
    || !Number.isSafeInteger(mergeCount) || mergeCount < 2) {
    throw new Error('Invalid rifle value, rocket count, or merge count');
  }
  const exactValue = readExactValue(value, 'Rifle value');
  const radix = BigInt(mergeCount);
  const digits: number[] = [];
  let remaining = exactValue;
  while (remaining > 0n) {
    digits.push(Number(remaining % radix));
    remaining /= radix;
  }
  const highestTier = digits.length;
  const lowestVisibleIndex = Math.max(0, highestTier - 2);
  const rifleRemainder = highestTier <= 2 ? 0
    : storeExactValue(exactValue % exchangeValueForTier(highestTier - 1, mergeCount));
  for (let index = 0; index < lowestVisibleIndex; index++) digits[index] = 0;
  const count = rocketCount + digits.reduce((sum, digit) => sum + digit, 0);
  if (!Number.isSafeInteger(count)) throw new Error('Squad visible count exceeds the supported range');
  return { count, rocketCount, rifleCounts: digits, rifleRemainder };
}

export function rifleDefenseValue(squad: SquadSimulationState, mergeCount: number): bigint {
  validateRawSquad(squad);
  let value = readExactValue(squad.rifleRemainder, 'Squad rifle remainder');
  squad.rifleCounts.forEach((count, index) => {
    if (!count) return;
    value += BigInt(count) * exchangeValueForTier(index + 1, mergeCount);
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
  const addedValue = BigInt(amount) * exchangeValueForTier(tier, mergeCount);
  const nextValue = rifleDefenseValue(squad, mergeCount) + addedValue;
  return compactRifleValue(nextValue, mergeCount, squad.rocketCount);
}

export function afterCasualties(squad: SquadSimulationState, casualties: number | bigint,
  mergeCount: number): SquadSimulationState {
  validateSquad(squad, mergeCount);
  const loss = readExactValue(casualties, 'Casualty count');
  const rifleDefense = rifleDefenseValue(squad, mergeCount);
  const remainingRifleValue = rifleDefense > loss ? rifleDefense - loss : 0n;
  const rocketLoss = loss > rifleDefense ? loss - rifleDefense : 0n;
  const remainingRockets = rocketLoss >= BigInt(squad.rocketCount)
    ? 0 : squad.rocketCount - Number(rocketLoss);
  return compactRifleValue(remainingRifleValue, mergeCount, remainingRockets);
}

export interface CasualtyMember { index: number; tier: number; rocket: boolean }
const MAX_PRESENTED_CASUALTIES = 48;

export function afterCasualtiesWithBreakdown(squad: SquadSimulationState,
  casualties: number | bigint, mergeCount: number): {
    squad: SquadSimulationState; affectedMembers: CasualtyMember[] } {
  const result = afterCasualties(squad, casualties, mergeCount);
  let remaining = readExactValue(casualties, 'Casualty count');
  const remainder = readExactValue(squad.rifleRemainder, 'Squad rifle remainder');
  remaining = remaining > remainder ? remaining - remainder : 0n;
  const affectedMembers: CasualtyMember[] = [];
  let index = 0;
  // Consume the old visible roster from its lowest rifle tier upward. A partial
  // higher-tier loss still affects that old body, which reappears as demoted tiers.
  for (let tier = 1; tier <= squad.rifleCounts.length; tier++) {
    const count = squad.rifleCounts[tier - 1];
    const value = exchangeValueForTier(tier, mergeCount);
    const affected = Number((remaining + value - 1n) / value > BigInt(count)
      ? BigInt(count) : (remaining + value - 1n) / value);
    for (let local = 0; local < affected && affectedMembers.length < MAX_PRESENTED_CASUALTIES; local++) {
      affectedMembers.push({ index: index + local, tier, rocket: false });
    }
    const capacity = BigInt(count) * value;
    remaining = remaining > capacity ? remaining - capacity : 0n;
    index += count;
  }
  const rocketLoss = Math.min(squad.rocketCount, Number(remaining));
  for (let local = 0; local < rocketLoss && affectedMembers.length < MAX_PRESENTED_CASUALTIES; local++) {
    affectedMembers.push({ index: index + local, tier: 0, rocket: true });
  }
  return { squad: result, affectedMembers };
}

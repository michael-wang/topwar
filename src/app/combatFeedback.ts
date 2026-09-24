import type { SquadSimulationState } from '../simulation/SimulationState';
import { tier1RifleCount } from '../simulation/squad/composition';
import { TIER2_EXCHANGE_VALUE } from '../simulation/tierExchange';

export function squadDefenseValue(squad: SquadSimulationState): number {
  return tier1RifleCount(squad) + squad.tier2RifleCount * TIER2_EXCHANGE_VALUE
    + squad.rocketCount;
}

export function damageFeedback(previousDefense: number, currentDefense: number): 'normal' | 'fatal' | null {
  if (currentDefense >= previousDefense) return null;
  return currentDefense === 0 ? 'fatal' : 'normal';
}

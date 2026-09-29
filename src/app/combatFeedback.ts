import type { SimulationFrameState } from '../simulation/SimulationState';
import { rifleDefenseValue } from '../simulation/squad/composition';

export function squadDefenseValue(squad: SimulationFrameState['squad'], mergeCount: number): bigint {
  return rifleDefenseValue(squad, mergeCount) + BigInt(squad.rocketCount);
}

export function damageFeedback(previousDefense: number | bigint, currentDefense: number | bigint): 'normal' | 'fatal' | null {
  if (currentDefense >= previousDefense) return null;
  return currentDefense === 0 || currentDefense === 0n ? 'fatal' : 'normal';
}

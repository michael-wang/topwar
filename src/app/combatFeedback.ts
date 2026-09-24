import type { SquadSimulationState } from '../simulation/SimulationState';
import { rifleDefenseValue } from '../simulation/squad/composition';

export function squadDefenseValue(squad: SquadSimulationState, mergeCount: number): number {
  return rifleDefenseValue(squad, mergeCount) + squad.rocketCount;
}

export function damageFeedback(previousDefense: number, currentDefense: number): 'normal' | 'fatal' | null {
  if (currentDefense >= previousDefense) return null;
  return currentDefense === 0 ? 'fatal' : 'normal';
}

import type { SimulationOptions } from '../simulation/Simulation';
import { createNavalReview } from './NavalReview';
import { createTankPlaytest, createVictoryReview } from './TankPlaytest';

export const PLAYTEST_ENTRIES = [
  { role: 'naval', label: '🚢 驅逐艦進場' },
  { role: 'boss-intro', label: '🚨 BOSS 進場' },
  { role: 'victory', label: '🏆 勝利結算' },
] as const;
export type PlaytestScene = typeof PLAYTEST_ENTRIES[number]['role'];
export function isPlaytestScene(role: unknown): role is PlaytestScene {
  return PLAYTEST_ENTRIES.some(entry => entry.role === role);
}
export function createPlaytestScenario(options: SimulationOptions, rate: number, role: PlaytestScene) {
  if (role === 'naval') return createNavalReview(options);
  if (role === 'victory') return createVictoryReview(options, rate);
  return createTankPlaytest(options, rate, true);
}

import type { SimulationOptions } from '../simulation/Simulation';
import { createNavalReview } from './NavalReview';
import { createAirSupportPlaytest, createTankPlaytest, createVictoryReview } from './TankPlaytest';

export const PLAYTEST_ENTRIES = [
  { role: 'naval', label: '🚢 驅逐艦進場' },
  { role: 'boss-intro', label: '🚨 BOSS 進場' },
  { role: 'victory', label: '🏆 勝利結算' },
  { role: 'air-support', label: '✈️ 空中支援' },
] as const;
export type PlaytestScene = typeof PLAYTEST_ENTRIES[number]['role'];
export function isPlaytestScene(role: unknown): role is PlaytestScene {
  return PLAYTEST_ENTRIES.some(entry => entry.role === role);
}
export function createPlaytestScenario(options: SimulationOptions, rate: number, role: PlaytestScene) {
  if (role === 'naval') return createNavalReview(options);
  if (role === 'victory') return createVictoryReview(options, rate);
  if (role === 'air-support') return createAirSupportPlaytest(options, rate);
  return createTankPlaytest(options, rate, true);
}

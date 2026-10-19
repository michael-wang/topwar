import type { Simulation } from '../simulation/Simulation';
import { attackLanePositions } from '../simulation/enemies/laneComposition';

export const landingSurfZ = 45.5;
export const landingHandoffSeconds = 11.424;
export const landingFirstSeconds = 5.1;
export const landingIntervalSeconds = .34;
export const landingCount = 16;

/** Fresh Stage-1 runs only. Keep generated identities, stats, RNG and wave cursors. */
export function prepareOpeningCohort(simulation: Simulation): void {
  const state = simulation.getState();
  if (!state.catharsis?.balance.defenseMode || state.tick !== 0) return;
  const balance = state.catharsis.balance;
  const lanes = attackLanePositions(balance.laneCount, state.catharsis.trackHalfWidth, balance.edgeInset);
  state.enemies = state.enemies.slice(0, landingCount).map((enemy, index) => ({
    ...enemy,
    lane: 1 + index % 3,
    x: lanes[1 + index % 3] + Math.max(-.25, Math.min(.25, enemy.x-lanes[enemy.lane ?? 2])),
    z: landingSurfZ - (enemy.archetype === 'heavy' ? balance.heavySpeed : balance.gruntSpeed)
      * (landingHandoffSeconds - landingFirstSeconds - index * landingIntervalSeconds),
  }));
  simulation.restoreState(state);
}

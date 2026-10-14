import { artilleryHits, type ArtilleryShell } from '../simulation/artillery';
import type { SimulationFrameState } from '../simulation/SimulationState';

export const ARTILLERY_EMERGENCY_SECONDS = .5;

// Reuse the exact authoritative radial hit predicate. Selected lanes and renderer mirroring
// cannot decide whether the moving squad is currently at risk. No state or RNG is changed.
export function personalArtilleryThreat(state: SimulationFrameState): Readonly<ArtilleryShell> | undefined {
  if (state.catharsis?.balance.artillery?.warningPresentation !== 'personalEmergency'
    || state.squad.count === 0 || state.defenseTank?.status === 'defeated') return;
  const shells = state.artillery?.shells;
  if (!shells?.length) return;
  let first: Readonly<ArtilleryShell> | undefined;
  for (const shell of shells) {
    const remaining = shell.impactAtSeconds - state.elapsedSeconds;
    if (remaining >= 0 && remaining <= ARTILLERY_EMERGENCY_SECONDS
      && artilleryHits(shell, state.player.x, state.player.z)
      && (!first || shell.impactAtSeconds < first.impactAtSeconds)) first = shell;
  }
  return first;
}

// Two to three pulses/second, increasing in size/contrast as the deadline approaches.
// Simulation time drives it, so paused and restored frames reproduce the same presentation.
export function emergencyPulse(remaining: number): number {
  const age = Math.max(0, Math.min(.5, ARTILLERY_EMERGENCY_SECONDS - remaining));
  return Math.sin(Math.PI * (2 * age + age * age)) ** 2;
}

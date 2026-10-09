import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import type { SimulationFrameState } from '../simulation/SimulationState';
import type { ArtilleryLaunch } from '../simulation/artillery';
import { emptyCarnival } from '../simulation/carnival';

// DEV-only source/schedule. No encounter pattern lives in the shared artillery engine.
export const SHELL_REVIEW_SOURCE = { id: 'shell-review-muzzle', type: 'offshore-test',
  position: { x: -3, y: 1.2, z: 52 } } as const;
const launchTicks = [60, 300, 540, 780, 819, 1080, 1119];
const cycleTicks = 1440;
export function shellReviewLaunches(state: SimulationFrameState): readonly ArtilleryLaunch[] {
  return state.squad.count > 0 && launchTicks.includes(state.tick % cycleTicks)
    ? [{ source: SHELL_REVIEW_SOURCE }] : [];
}
export function createShellReview(options: SimulationOptions): Simulation {
  const simulation = new Simulation({ ...options, seed: 0x3a1100, startSquad: 3, startRocketCount: 0,
    level: { ...options.level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } });
  const state = simulation.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode || balance.progression.levelPlan.length < 8)
    throw Error('SHELL review requires Lv8 Defense progression');
  balance.carnival.enabled = false; balance.postCapSurvival.enabled = false;
  state.carnival = emptyCarnival(true); state.progression = { level: 8, xp: 0 };
  state.machineGunReleaseAtSeconds = 0; state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: 0, supply: null, flight: null };
  state.artillery = { version: 1, nextId: 1, shells: [] };
  state.weapons.rifleMemberCooldowns = [0, 1 / (balance.machineGun.fireRate * 3), 2 / (balance.machineGun.fireRate * 3)];
  simulation.restoreState(state); return simulation;
}

import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { isolatedReviewOptions } from './DevReviewPolicy';
import { emptyCarnival } from '../simulation/carnival';
import { effectivePrimaryFireRate, maxProgressionLevel, progressionStage } from '../simulation/progression';

export function createNavalReview(options: SimulationOptions): Simulation {
  options = isolatedReviewOptions(options);
  const simulation = new Simulation({ ...options, seed: 0x3a1100, startSquad: 3, startRocketCount: 0,
    level: { ...options.level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } });
  const state = simulation.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode || balance.progression.levelPlan.length < 8)
    throw Error('NAVAL review requires Lv8 Defense progression');
  balance.carnival.enabled = false; balance.postCapSurvival.enabled = false;
  const level = Math.min(10, maxProgressionLevel(balance.progression));
  if (progressionStage(level, balance.progression).squadStage !== 3) throw Error('NAVAL review requires a three-MG cap');
  state.carnival = emptyCarnival(true); state.progression = { level, xp: 0 };
  state.machineGunReleaseAtSeconds = 0; state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: 0, supply: null, flight: null };
  state.artillery = { version: 1, nextId: 1, shells: [] };
  const rate = effectivePrimaryFireRate(1, level, balance);
  state.weapons.rifleMemberCooldowns = [0, 1 / (rate * 3), 2 / (rate * 3)];
  if (!balance.destroyer) throw Error('NAVAL review requires Destroyer configuration');
  balance.destroyer.enabled = true;
  state.destroyer = { status: 'active', startedAtSeconds: 0, nextShotIndex: 0 };
  simulation.restoreState(state); return simulation;
}

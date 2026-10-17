import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { isolatedReviewOptions } from './DevReviewPolicy';
import { emptyCarnival } from '../simulation/carnival';
import { emptyDestroyer } from '../simulation/destroyer';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { effectivePrimaryFireRate, progressionStage } from '../simulation/progression';

// One ordinary full-HP robot, real Lv9 MGs, no unrelated admissions or encounters.
export function createGiantReview(options: SimulationOptions, baseFireRate: number): Simulation {
  options = isolatedReviewOptions(options);
  const sim = new Simulation({ ...options, seed: 0x21b631, startSquad: 2, startRocketCount: 0,
    level: { ...options.level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } });
  const state = sim.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode) throw Error('GIANT review requires Defense');
  const stage = progressionStage(9, balance.progression);
  if (stage.weaponFamily !== 'machineGun' || stage.squadStage !== 2)
    throw Error('GIANT review requires the authored Lv9 MG stage');
  balance.carnival.enabled = false; state.carnival = emptyCarnival(true);
  balance.postCapSurvival.enabled = false;
  if (balance.destroyer) { balance.destroyer.enabled = false; state.destroyer = emptyDestroyer(true); }
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.machineGunReleaseAtSeconds = 0;
  state.progression = { level: 9, xp: 0 };
  const lanes = attackLanePositions(balance.laneCount, state.catharsis!.trackHalfWidth, balance.edgeInset);
  const lane = Math.floor(lanes.length / 2);
  state.player = { x: lanes[lane], z: 0, selectedLane: lane };
  state.enemies = [{ id: 1, tier: 1, archetype: 'giant', lane, x: lanes[lane], z: 22, hp: balance.giant.hp }];
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: 0, supply: null, flight: null };
  const interval = 1 / effectivePrimaryFireRate(baseFireRate, 9, balance);
  state.weapons.rifleMemberCooldowns = [0, interval / 2];
  sim.restoreState(state);
  return sim;
}

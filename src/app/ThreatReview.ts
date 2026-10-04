import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { addRifleSoldiers } from '../simulation/squad/composition';
import { effectiveRifleFireRate } from '../simulation/progression';

export const THREAT_REVIEW_SEED = 0x4a070;
export function threatReviewEnabled(search: string): boolean {
  // Explicit review only. Both development and production root use normal pacing.
  return new URLSearchParams(search).get('review') === 'threats';
}

// App-owned initialization only: ordinary validated state, ordinary combat thereafter.
// Reconstructing this adapter on Retry reproduces the opening without a save flag.
export function createThreatReview(options: SimulationOptions, baseFireRate: number): Simulation {
  const simulation = new Simulation({ ...options, seed: THREAT_REVIEW_SEED });
  const state = simulation.getState();
  const catharsis = state.catharsis;
  if (!catharsis?.balance.defenseMode || !state.enemyStream || catharsis.balance.laneCount !== 5)
    throw new Error('Threat review requires the five-lane defense level');
  const balance = catharsis.balance;
  state.progression = { level: 5, xp: 0 };
  state.elapsedSeconds = balance.progression.reinforcementArrivalSeconds;
  state.tick = Math.round(state.elapsedSeconds * 60);

  state.squad = addRifleSoldiers(state.squad, 2, 1, options.tiers.mergeCount);

  // Force art-review threats without entering the deferred natural Lv6 encounter.
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  const lanes = attackLanePositions(5, catharsis.trackHalfWidth, balance.edgeInset);
  state.enemies = [
    { id: 1, tier: 1, archetype: 'grunt', lane: 4, x: lanes[4], z: 8, hp: 1 },
    { id: 2, tier: 1, archetype: 'heavy', lane: 3, x: lanes[3], z: 12, hp: balance.heavyHp },
    { id: 3, tier: 1, archetype: 'giant', lane: 1, x: lanes[1], z: 22, hp: balance.giant.hp },
  ];
  state.enemyStream.nextEnemyId = Math.max(state.enemyStream.nextEnemyId, 4);
  const interval = 1 / effectiveRifleFireRate(baseFireRate, 5, balance.progression);
  state.weapons.rifleMemberCooldowns = [0, interval / 3, 2 * interval / 3];
  simulation.restoreState(state);
  return simulation;
}

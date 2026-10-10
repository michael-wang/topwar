import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { createNavalReview } from './NavalReview';
import { emptyCarnival } from '../simulation/carnival';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { admitDefenseGroup } from '../simulation/enemies/defenseGroup';
import { effectiveSeed } from '../simulation/enemies/effectiveSeed';
import { pressureGroupSize, pressureWaveSettings } from '../simulation/enemies/latePressure';
import { advancePostCapSurvival, postCapOrdinarySettings } from '../simulation/postCapSurvival';
import { effectivePrimaryFireRate, maxProgressionLevel, progressionStage } from '../simulation/progression';
import { placeGrenadeSupply } from '../simulation/grenade';

export type DevReviewFixture = 'late' | 'crate3' | 'crate8' | 'naval';
export const DEV_REVIEW_FIXTURES = {
  late: { level: 6, soldiers: 1 }, crate3: { level: 3, soldiers: 1 },
  crate8: { level: 8, soldiers: 3 }, naval: { level: 8, soldiers: 3 },
} as const;

// Human DEV entries only. Historical isolated scenarios live in tests/helpers.
export function createDevReviewFixture(options: SimulationOptions, baseFireRate: number,
  role: DevReviewFixture): Simulation {
  if (role === 'naval') return createNavalReview(options);
  if (role === 'crate3' || role === 'crate8') return createSupplyReview(options, baseFireRate, role);
  const fixture = DEV_REVIEW_FIXTURES.late;
  const simulation = new Simulation({ ...options, seed: 0x21b100 + fixture.level,
    startSquad: 1, startRocketCount: 0 });
  const state = simulation.getState(), catharsis = state.catharsis;
  if (!catharsis?.balance.defenseMode || !state.enemyStream || !options.level.enemyStream)
    throw new Error('DEV Review requires the defense enemy stream');
  const balance = catharsis.balance;
  if (fixture.level > maxProgressionLevel(balance.progression)
    || progressionStage(fixture.level, balance.progression).weaponFamily !== 'machineGun'
    || progressionStage(fixture.level, balance.progression).squadStage !== fixture.soldiers)
    throw new Error('Late DEV entry requires its authored Machine Gun squad stage');
  balance.carnival.enabled = false;
  state.carnival = emptyCarnival(true);
  balance.postCapSurvival.enabled = true;
  const lane = Math.floor(balance.laneCount / 2);
  const lanes = attackLanePositions(balance.laneCount, catharsis.trackHalfWidth, balance.edgeInset);
  state.player = { x: lanes[lane], z: 0, selectedLane: lane };
  state.progression = { level: fixture.level, xp: 0 };
  // Skip the completed teaching encounters; retain ordinary admission and Survival.
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.machineGunReleaseAtSeconds = 0;
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
    inventory: balance.grenade.capacity, supply: null, flight: null };
  state.postCapSurvival = advancePostCapSurvival(state.postCapSurvival, state);
  state.enemies = [];
  state.enemyStream.nextEnemyId = 1;
  const stream = options.level.enemyStream;
  const row = Math.max(0, Math.floor((balance.defenseSpawnAheadDistance - stream.startZ)
    / (stream.spacing * balance.waveRows)) * balance.waveRows);
  admitDefenseGroup(state.enemies, state.enemyStream, row, effectiveSeed(state.seed, stream.seed),
    { ...balance, ...pressureWaveSettings(balance, state.progression),
      groupSize: pressureGroupSize(balance, fixture.level), ...postCapOrdinarySettings(balance, state.postCapSurvival) },
    catharsis.trackHalfWidth, stream.startZ + row * stream.spacing);
  state.enemyStream.nextRowIndex = row + 1;
  state.projectiles = []; state.streamRewards = []; state.gates = []; state.pickups = [];
  state.enemyStream.nextEnemyId = state.enemies.length + 1;
  state.weapons.rifleMemberCooldowns = [0];
  simulation.restoreState(state);
  return simulation;
}

function createSupplyReview(options: SimulationOptions, baseFireRate: number,
  role: 'crate3' | 'crate8'): Simulation {
  const fixture = DEV_REVIEW_FIXTURES[role];
  // An empty level definition removes admission entirely, including after long
  // pauses/restores. No distant wave clock, fake hits or simulation debug mode.
  const simulation = new Simulation({ ...options, seed: 0x21b100 + fixture.level,
    startSquad: fixture.soldiers, startRocketCount: 0,
    level: { ...options.level, enemyStream: undefined, enemyGroups: [], upgradeGates: [] } });
  const state = simulation.getState(), balance = state.catharsis?.balance;
  if (!balance?.defenseMode || !balance.grenade.supplyDestruction
    || fixture.level > maxProgressionLevel(balance.progression))
    throw new Error('Supply DEV review requires staged Defense supplies and its authored level');
  balance.carnival.enabled = false;
  balance.postCapSurvival.enabled = false;
  state.carnival = emptyCarnival(true);
  state.progression = { level: fixture.level, xp: 0 };
  state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
  state.machineGunReleaseAtSeconds = role === 'crate8' ? 0 : null;
  const lanes = attackLanePositions(balance.laneCount, state.catharsis!.trackHalfWidth, balance.edgeInset);
  state.player = { x: lanes[1], z: 0, selectedLane: 1 };
  // QA coordinates only: separated shooting corridor, ordinary HP/movement.
  // The compact right-hand group puts all three roles inside one initial blast.
  const right = balance.laneCount - 2;
  state.enemies = Array.from({ length: 36 }, (_, index) => {
    const lane = right + index % 2;
    return { id: index + 1, tier: 1, archetype: 'grunt' as const, lane,
      x: lanes[lane] + (Math.floor(index / 2) % 3 - 1) * .25,
      z: 18 + Math.floor(index / 6) * .4, hp: 1 };
  });
  state.enemies.push(
    { id: 37, tier: 1, archetype: 'heavy', lane: right, x: lanes[right], z: 20, hp: balance.heavyHp },
    { id: 38, tier: 1, archetype: 'giant', lane: right + 1, x: lanes[right + 1], z: 20.5, hp: balance.giant.hp });
  state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0,
    acquiredAtSeconds: role === 'crate8' ? 0 : null, inventory: role === 'crate8' ? 1 : 0,
    supply: { ...placeGrenadeSupply(state, balance.grenade), ...(role === 'crate8' ? { rewardAmount: 1 as const } : {}) },
    flight: null };
  const interval = 1 / effectivePrimaryFireRate(baseFireRate, fixture.level, balance);
  state.weapons.rifleMemberCooldowns = Array.from({ length: fixture.soldiers },
    (_, index) => index * interval / fixture.soldiers);
  simulation.restoreState(state);
  return simulation;
}

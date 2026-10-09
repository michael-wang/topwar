import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { emptyCarnival } from '../simulation/carnival';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { admitDefenseGroup } from '../simulation/enemies/defenseGroup';
import { effectiveSeed } from '../simulation/enemies/effectiveSeed';
import { pressureGroupSize, pressureWaveSettings } from '../simulation/enemies/latePressure';
import { advancePostCapSurvival, postCapOrdinarySettings } from '../simulation/postCapSurvival';
import { addRifleSoldiers } from '../simulation/squad/composition';
import { effectivePrimaryFireRate, maxProgressionLevel, progressionStage, requiredXp } from '../simulation/progression';

export type DevReviewFixture = 'grenade' | 'curve' | 'evolve' | 'machineGun' | 'late' | 'mg7' | 'mg8' | 'carnival';
export const DEV_REVIEW_FIXTURES = {
  grenade: { level: 3, soldiers: 1 },
  curve: { level: 4, soldiers: 2 },
  evolve: { level: 5, soldiers: 3 },
  machineGun: { level: 6, soldiers: 1 },
  late: { level: 6, soldiers: 1 },
  mg7: { level: 7, soldiers: 2 },
  mg8: { level: 8, soldiers: 3 },
  carnival: { level: 6, soldiers: 1 },
} as const;

// App-owned QA adapter, never a simulation mode or serialized debug flag.
// Ordinary HP, damage, movement, lane targeting and progression apply thereafter.
export function createDevReviewFixture(options: SimulationOptions, baseFireRate: number,
  role: DevReviewFixture): Simulation {
  const fixture = DEV_REVIEW_FIXTURES[role];
  const simulation = new Simulation({ ...options, seed: 0x21b100 + fixture.level,
    startSquad: 1, startRocketCount: 0 });
  const state = simulation.getState(), catharsis = state.catharsis;
  if (!catharsis?.balance.defenseMode || !state.enemyStream || !options.level.enemyStream)
    throw new Error('DEV Review requires the defense enemy stream');
  const balance = catharsis.balance;
  const playableLate = role === 'late' || role === 'mg7' || role === 'mg8';
  if ((playableLate || role === 'carnival') && (fixture.level > maxProgressionLevel(balance.progression)
    || progressionStage(fixture.level, balance.progression).weaponFamily !== 'machineGun'
    || progressionStage(fixture.level, balance.progression).squadStage !== fixture.soldiers))
    throw new Error('Late DEV entry requires its authored Machine Gun squad stage');
  // Isolated short reviews must not acquire recurring threats/pickups. CURVE
  // intentionally follows the natural progression and post-cap continuation.
  if (role !== 'curve' && role !== 'carnival') {
    balance.carnival.enabled = false;
    state.carnival = emptyCarnival(true);
  }
  if (role === 'carnival') balance.carnival.enabled = true;
  if (playableLate || role === 'carnival') balance.postCapSurvival.enabled = true;
  else if (role !== 'curve') balance.postCapSurvival.enabled = false;
  const lane = Math.floor(balance.laneCount / 2);
  const lanes = attackLanePositions(balance.laneCount, catharsis.trackHalfWidth, balance.edgeInset);
  const x = lanes[lane];
  state.player = { x, z: 0, selectedLane: lane };
  state.progression = { level: fixture.level, xp: role === 'evolve'
    ? Math.max(0, requiredXp(fixture.level, balance.progression) - 10) : role === 'curve' ? 150 : 0 };
  if (fixture.soldiers > 1)
    state.squad = addRifleSoldiers(state.squad, fixture.soldiers - 1, 1, options.tiers.mergeCount);
  if (playableLate || role === 'carnival') {
    // Skip the already-completed Lv5 introduction and Lv6 release, not future
    // encounters. Teaching Supply is acquired; reserves can be used immediately.
    state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
    state.machineGunReleaseAtSeconds = 0;
    state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
      inventory: balance.grenade.capacity, supply: null, flight: null };
    if (playableLate) state.postCapSurvival = advancePostCapSurvival(state.postCapSurvival, state);
    state.enemies = [];
    state.enemyStream.nextEnemyId = 1;
    // Admit one ordinary late group at the current horizon's last wave row.
    // Consume only that row: all future groups use the normal stream scheduler.
    const stream = options.level.enemyStream;
    const row = Math.max(0, Math.floor((balance.defenseSpawnAheadDistance - stream.startZ)
      / (stream.spacing * balance.waveRows)) * balance.waveRows);
    if (playableLate) admitDefenseGroup(state.enemies, state.enemyStream, row, effectiveSeed(state.seed, stream.seed),
      { ...balance, ...pressureWaveSettings(balance, state.progression),
        groupSize: pressureGroupSize(balance, fixture.level), ...postCapOrdinarySettings(balance, state.postCapSurvival) },
      catharsis.trackHalfWidth, stream.startZ + row * stream.spacing);
    state.enemyStream.nextRowIndex = row + 1;
  } else if (role === 'curve') {
    state.enemies = [];
    state.enemyStream.nextEnemyId = 1;
    for (const [wave, depth] of [24, 31].entries()) admitDefenseGroup(state.enemies, state.enemyStream,
      wave * balance.waveRows, effectiveSeed(state.seed, options.level.enemyStream.seed),
      { ...balance, ...pressureWaveSettings(balance, state.progression) }, catharsis.trackHalfWidth, depth);
  } else if (role === 'evolve') {
    // Ten ordinary Grunt kills cross the authored boundary. No scripted level
    // change: three staggered Rifles earn the upgrade through normal combat.
    state.enemies = Array.from({ length: 18 }, (_, index) => {
      const enemyLane = index < 12 ? lane : [0, 1, 3, 4, 1, 3][index - 12];
      return { id: index + 1, tier: 1, archetype: 'grunt' as const, lane: enemyLane,
        x: lanes[enemyLane], z: index < 12 ? 16 + ((index * 7) % 12) * .55
          : 14 + ((index * 13) % 61) / 10, hp: 1 };
    });
    for (const [index, enemyLane] of [1, 3].entries())
      state.enemies.push({ id: 19 + index, tier: 1, archetype: 'heavy', lane: enemyLane,
        x: lanes[enemyLane], z: 20.5 + index * 1.7, hp: balance.heavyHp });
  } else if (role === 'grenade' || role === 'machineGun') {
    // Fixed uneven depths, distributed across all attack lanes. QA coordinates
    // only: combat uses the same authored HP, movement, damage and XP as a run.
    const gruntCount = role === 'machineGun' ? 60 : 45;
    state.enemies = Array.from({ length: gruntCount }, (_, index) => {
      const enemyLane = index % lanes.length;
      return { id: index + 1, tier: 1, archetype: 'grunt' as const,
        lane: enemyLane, x: lanes[enemyLane], z: role === 'machineGun'
          ? 8 + ((index * 37 + enemyLane * 11) % 161) / 10
          : 10 + ((index * 37 + enemyLane * 11) % 81) / 10, hp: 1 };
    });
    const heavyLanes = role === 'machineGun' ? [lane, 0, 1, 3, 4] : [1, lane, lanes.length - 1];
    for (const [index, enemyLane] of heavyLanes.entries())
      state.enemies.push({ id: gruntCount + 1 + index, tier: 1, archetype: 'heavy', lane: enemyLane,
        x: lanes[enemyLane], z: role === 'machineGun' ? 10.8 + index * 2.8 : 13.3 + index * 1.7, hp: balance.heavyHp });
    if (role === 'grenade') state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
      inventory: balance.grenade.capacity, supply: null, flight: null };
  }
  state.projectiles = []; state.streamRewards = []; state.gates = []; state.pickups = [];
  const isolatedGiant = role === 'evolve' || role === 'machineGun' || playableLate || role === 'carnival';
  state.giantEncounter = { scheduledAtSeconds: isolatedGiant ? 0 : null, spawned: isolatedGiant };
  state.machineGunReleaseAtSeconds = role === 'machineGun' || playableLate ? 0 : null;
  // Preserve each review's seeded composition cursor. Isolated reviews defer
  // ordinary admission with an explicit clock, independent of player position.
  const stream = options.level.enemyStream;
  if (!playableLate && role !== 'carnival') state.enemyStream.nextRowIndex = role === 'curve'
    ? Math.ceil((balance.defenseSpawnAheadDistance - stream.startZ) / (stream.spacing * balance.waveRows)) * balance.waveRows
    : Math.max(state.enemyStream.nextRowIndex,
      Math.ceil((balance.defenseSpawnAheadDistance + 600 - stream.startZ) / stream.spacing) + 1);
  state.enemyStream.nextEnemyId = state.enemies.length + 1;
  if (!playableLate && role !== 'curve' && role !== 'carnival')
    state.defenseWaves = { nextAtSeconds: 1000 };
  const interval = 1 / effectivePrimaryFireRate(baseFireRate, fixture.level, balance);
  state.weapons.rifleMemberCooldowns = Array.from({ length: fixture.soldiers },
    (_, index) => index * interval / fixture.soldiers);
  simulation.restoreState(state);
  return simulation;
}

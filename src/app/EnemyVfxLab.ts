import { Simulation, type SimulationOptions } from '../simulation/Simulation';
import { attackLanePositions } from '../simulation/enemies/laneComposition';
import { addRifleSoldiers } from '../simulation/squad/composition';
import { effectiveRifleFireRate } from '../simulation/progression';

export type EnemyVfxLabRole = 'grunt' | 'heavy' | 'giant' | 'grenade';
export const ENEMY_VFX_LAB = {
  grunt: { level: 1, soldiers: 1, depths: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26] },
  heavy: { level: 3, soldiers: 1, depths: [10, 15, 20] },
  giant: { level: 5, soldiers: 3, depths: [14] },
  grenade: { level: 3, soldiers: 1 },
} as const;

// App-owned QA adapter, never a simulation mode or serialized debug flag.
// Ordinary HP, damage, movement, lane targeting and progression apply thereafter.
export function createEnemyVfxLab(options: SimulationOptions, baseFireRate: number,
  role: EnemyVfxLabRole): Simulation {
  const fixture = ENEMY_VFX_LAB[role];
  const simulation = new Simulation({ ...options, seed: 0x21b100 + fixture.level,
    startSquad: 1, startRocketCount: 0 });
  const state = simulation.getState(), catharsis = state.catharsis;
  if (!catharsis?.balance.defenseMode || !state.enemyStream || !options.level.enemyStream)
    throw new Error('Enemy VFX Lab requires the defense enemy stream');
  const balance = catharsis.balance;
  const lane = Math.floor(balance.laneCount / 2);
  const lanes = attackLanePositions(balance.laneCount, catharsis.trackHalfWidth, balance.edgeInset);
  const x = lanes[lane];
  state.player = { x, z: 0, selectedLane: lane };
  state.progression = { level: fixture.level, xp: 0 };
  if (fixture.soldiers > 1)
    state.squad = addRifleSoldiers(state.squad, fixture.soldiers - 1, 1, options.tiers.mergeCount);
  if (role === 'grenade') {
    // Fixed uneven depths, distributed across all attack lanes. QA coordinates
    // only: combat uses the same authored HP, movement, damage and XP as a run.
    state.enemies = Array.from({ length: 45 }, (_, index) => {
      const enemyLane = index % lanes.length;
      return { id: index + 1, tier: 1, archetype: 'grunt' as const,
        lane: enemyLane, x: lanes[enemyLane], z: 10 + ((index * 37 + enemyLane * 11) % 81) / 10, hp: 1 };
    });
    for (const [index, enemyLane] of [1, lane, lanes.length - 1].entries())
      state.enemies.push({ id: 46 + index, tier: 1, archetype: 'heavy', lane: enemyLane,
        x: lanes[enemyLane], z: 13.3 + index * 1.7, hp: balance.heavyHp });
    state.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
      inventory: 1, supply: null, flight: null };
  } else {
    const combatFixture = ENEMY_VFX_LAB[role];
    state.enemies = combatFixture.depths.map((z, index) => ({ id: index + 1, tier: 1,
      archetype: role, lane, x, z, hp: role === 'giant' ? balance.giant.hp : role === 'heavy' ? balance.heavyHp : 1 }));
  }
  state.projectiles = []; state.streamRewards = []; state.gates = []; state.pickups = [];
  state.giantEncounter = { scheduledAtSeconds: role === 'giant' ? 0 : null, spawned: role === 'giant' };
  // The defense camera is fixed but authoritative player Z advances. Place the
  // validated cursor well beyond a review run, without changing stream rules.
  const stream = options.level.enemyStream;
  state.enemyStream.nextRowIndex = Math.max(state.enemyStream.nextRowIndex,
    Math.ceil((balance.defenseSpawnAheadDistance + 600 - stream.startZ) / stream.spacing) + 1);
  state.enemyStream.nextEnemyId = state.enemies.length + 1;
  const interval = 1 / effectiveRifleFireRate(baseFireRate, fixture.level, balance.progression);
  state.weapons.rifleMemberCooldowns = Array.from({ length: fixture.soldiers },
    (_, index) => index * interval / fixture.soldiers);
  simulation.restoreState(state);
  return simulation;
}

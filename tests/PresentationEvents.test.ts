import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { compactRifleValue, rifleDefenseValue } from '../src/simulation/squad/composition';
import { exchangeValueForTier } from '../src/simulation/tiers/tierRules';

const config = GameConfigSchema.parse(configData);
const isolated = LevelDefinitionSchema.parse({ id: 'contact-events', length: 1000,
  enemyGroups: [], upgradeGates: [] });
const bossLevel = LevelDefinitionSchema.parse({ ...levelData,
  enemyStream: { ...levelData.enemyStream, spawnAheadDistance: 110 } });
const tuning: SimulationTuning = { moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3,
  defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22,
  normalEnemyRadius: .3, bossRadius: 2,
  rifle: { ...config.weapon.rifle, fireRate: .01 }, rocket: { ...config.weapon.rocket } };
function make(level = isolated): Simulation {
  return new Simulation({ seed: 1, level, startSquad: 1, startRocketCount: 0,
    tiers: config.tiers });
}
function step(simulation: Simulation, ticks = 1): void {
  for (let i = 0; i < ticks; i++) simulation.step(1 / 60, { targetX: 0 }, tuning);
}

describe('transient combat presentation events', () => {
  it('names the exact contact grunt and carries before/after composition without changing damage', () => {
    const simulation = make();
    const state = simulation.getState();
    state.squad = compactRifleValue(2n, 10);
    state.enemies = [{ id: 77, tier: 1, x: 0, z: .1, hp: 3 }];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation);
    const events = simulation.consumePresentationEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'normalEnemyContact', enemyId: 77,
      enemyTier: 1, attackerX: 0, attackerZ: .1,
      before: { count: 2, rifleCounts: [2] },
      after: { count: 1, rifleCounts: [1] } });
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(1n);
    expect(JSON.stringify(events)).not.toContain('BigInt');
    expect(simulation.consumePresentationEvents()).toEqual([]);
  });

  it('does not label projectile kills as contact', () => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies = [{ id: 7, tier: 1, x: 0, z: 5, hp: 3 }];
    state.projectiles = [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: 4,
      speed: 60, damage: 3, remainingRange: 80, blastRadius: 0,
      penetrationRemaining: 0 }];
    state.weapons.nextProjectileId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation);
    expect(simulation.getState().enemies).toHaveLength(0);
    expect(simulation.consumePresentationEvents()).toEqual([]);
  });

  it('emits leak exchange and freezes fatal gameplay without accumulating events', () => {
    const simulation = make();
    const state = simulation.getState();
    state.enemies = [{ id: 9, tier: 1, x: 0, z: -2, hp: 3 }];
    state.projectiles = [{ id: 1, kind: 'rifle', tier: 1, x: 2, z: 0,
      speed: 60, damage: 3, remainingRange: 80, blastRadius: 0,
      penetrationRemaining: 0 }];
    state.weapons.nextProjectileId = 2;
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().projectiles).toEqual([]);
    expect(simulation.consumePresentationEvents()).toMatchObject([{ kind: 'normalEnemyContact',
      enemyId: 9, before: { count: 1 }, after: { count: 0 } }]);
    const frozen = simulation.getState();
    step(simulation, 1000);
    expect(simulation.getState()).toEqual(frozen);
    expect(simulation.consumePresentationEvents()).toEqual([]);
  });

  it('keeps two Boss impacts across fixed steps until consumed once', () => {
    const simulation = make(bossLevel);
    const state = simulation.getState();
    state.player.z = state.boss!.z - 2.1;
    state.enemies = [];
    state.streamRewards = [];
    state.squad = compactRifleValue(30n * exchangeValueForTier(2, 10), 10);
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, { ...tuning, forwardSpeed: 2 });
    expect(simulation.getState().boss?.engaged).toBe(true);
    step(simulation, 156);
    const events = simulation.consumePresentationEvents();
    expect(events.map((event) => event.kind)).toEqual(['bossSlam', 'bossSlam']);
    expect(events.map((event) => event.kind === 'bossSlam' && event.slamCount)).toEqual([1, 2]);
    expect(events[0].before).toMatchObject({ count: 3, rifleCounts: [0, 0, 3] });
    expect(events[0].after).toMatchObject({ count: 2, rifleCounts: [0, 0, 2] });
    expect(simulation.consumePresentationEvents()).toEqual([]);
  });

  it('reports low-tier visible casualties before high-tier demotion for a Boss slam', () => {
    const simulation = make(bossLevel);
    const state = simulation.getState();
    state.player.z = state.boss!.z - 2.1;
    state.enemies = [];
    state.streamRewards = [];
    state.squad = compactRifleValue(120n, 10);
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, { ...tuning, forwardSpeed: 2 });
    step(simulation, 36);
    const events = simulation.consumePresentationEvents();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('bossSlam');
    expect(events[0].affectedMembers?.map((member) => member.tier)).toEqual([2, 2, 3]);
    expect(rifleDefenseValue(simulation.getState().squad, 10)).toBe(20n);
  });

  it('bounds pending events and clears them on snapshot restore', () => {
    const simulation = make();
    const state = simulation.getState();
    state.squad = compactRifleValue(100000n, 10);
    state.enemies = Array.from({ length: 300 }, (_, index) =>
      ({ id: index + 1, tier: 1, x: 0, z: -2, hp: 3 }));
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    step(simulation);
    expect(simulation.consumePresentationEvents()).toHaveLength(256);
    simulation.restoreState(state);
    step(simulation);
    simulation.restoreState(simulation.getState());
    expect(simulation.consumePresentationEvents()).toEqual([]);
  });
});

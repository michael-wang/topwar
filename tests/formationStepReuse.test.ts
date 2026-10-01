import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema, type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { compactRifleValue } from '../src/simulation/squad/composition';
import { createSquadFormation } from '../src/simulation/squad/formation';
import { enemyPowerForTier } from '../src/simulation/tiers/tierRules';

const config = GameConfigSchema.parse(configData);
const isolated: LevelDefinition = { id: 'formation-step', length: 1000, enemyGroups: [], upgradeGates: [] };
const bossLevel = LevelDefinitionSchema.parse({ ...levelData,
  enemyStream: { ...levelData.enemyStream, spawnAheadDistance: 116 } });
const baseTuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: 0.8, memberRadius: 0.01, normalEnemyRadius: 0.01,
  // Keep the recorded legacy formation fixture at its original cadence.
  bossRadius: 0.01, rifle: { ...config.weapon.rifle, fireRate: 10 }, rocket: { ...config.weapon.rocket },
};

function fingerprint(value: unknown): string {
  // Values below were recorded from origin/main before the formation reuse change.
  let hash = 0xcbf29ce484222325n;
  for (const char of JSON.stringify(value)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

describe('step-local formation reuse', () => {
  it('preserves mixed rifle and rocket spawn order and formation coordinates', () => {
    const simulation = new Simulation({ seed: 17, level: isolated, startSquad: 4,
      startRocketCount: 1, tiers: config.tiers });
    const state = simulation.getState();
    state.squad = compactRifleValue(12n, config.tiers.mergeCount, 1);
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, baseTuning);
    const projectiles = simulation.getState().projectiles;
    const offsets = createSquadFormation(4, baseTuning.formationSpacing);
    expect(projectiles.map((projectile) => [projectile.id, projectile.kind, projectile.tier]))
      .toEqual([[1, 'rifle', 1], [2, 'rifle', 1], [3, 'rifle', 2], [4, 'rocket', 0]]);
    expect(projectiles.map((projectile) => projectile.x)).toEqual(offsets.map((offset) => offset.x));
    expect(projectiles.map((projectile) => projectile.z)).toEqual(offsets.map((offset, index) =>
      offset.z + (index < 3 ? baseTuning.rifle.projectileSpeed : baseTuning.rocket.projectileSpeed) / 60));
    expect(fingerprint(simulation.getState())).toBe('b1e7b4605e6a2b38');
  });

  it('preserves Boss formation contact', () => {
    const simulation = new Simulation({ seed: 17, level: bossLevel, startSquad: 3,
      startRocketCount: 0, tiers: config.tiers });
    const state = simulation.getState();
    const offset = createSquadFormation(3, baseTuning.formationSpacing)[0];
    state.player.x = -offset.x;
    state.player.z = state.boss!.z - offset.z;
    state.enemies = [];
    state.streamRewards = [];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: state.player.x }, baseTuning);
    expect(simulation.getState().boss?.engaged).toBe(true);
    expect(fingerprint(simulation.getState())).toBe('b9dc73e752b3da19');
  });

  it('updates contact formation after each casualty in the same step', () => {
    const simulation = new Simulation({ seed: 17, level: isolated, startSquad: 3,
      startRocketCount: 0, tiers: config.tiers });
    const state = simulation.getState();
    const offsets = [3, 2, 1].map((count) => createSquadFormation(count, baseTuning.formationSpacing)[0]);
    const contactRadius = baseTuning.memberRadius + baseTuning.normalEnemyRadius;
    for (const [index, count] of [[1, 3], [2, 2]] as const) {
      expect(createSquadFormation(count, baseTuning.formationSpacing).every((member) =>
        Math.hypot(member.x - offsets[index].x, member.z - offsets[index].z) > contactRadius)).toBe(true);
    }
    state.enemies = offsets.map((offset, index) => ({ id: index + 1, tier: 1,
      x: offset.x, z: offset.z, hp: enemyPowerForTier(1, config.tiers) }));
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, baseTuning);
    expect(simulation.consumePresentationEvents().map((event) => event.kind))
      .toEqual(['normalEnemyContact', 'normalEnemyContact', 'normalEnemyContact']);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies).toHaveLength(0);
    expect(fingerprint(simulation.getState())).toBe('48c28a7a3137b498');
  });

  it('refreshes after a pickup and reuses the starting count after a casualty', () => {
    const simulation = new Simulation({ seed: 17, level: isolated, startSquad: 1,
      startRocketCount: 0, tiers: config.tiers });
    const state = simulation.getState();
    const offset = createSquadFormation(2, baseTuning.formationSpacing)[0];
    state.pickups = [{ id: 1, sourceGateId: 'test', x: 0, zOffset: 0.001, width: 1,
      rewardKind: 'rifle', rewardAmount: 1, dropSpeed: 1 }];
    state.nextPickupId = 2;
    state.enemies = [{ id: 1, tier: 1, x: offset.x, z: offset.z,
      hp: enemyPowerForTier(1, config.tiers) },
    { id: 2, tier: 1, x: 0, z: 0, hp: enemyPowerForTier(1, config.tiers) }];
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, baseTuning);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies).toHaveLength(0);
    expect(simulation.consumePresentationEvents().map((event) =>
      event.kind === 'normalEnemyContact' ? event.enemyId : undefined)).toEqual([1, 2]);
  });

  it('matches seeded multi-step snapshot fingerprints', () => {
    const tuning = { ...baseTuning, forwardSpeed: 2, memberRadius: config.player.memberRadius,
      normalEnemyRadius: config.tiers.normalEnemyRadius, bossRadius: config.bosses.basic.radius,
      formationSpacing: config.player.formationSpacing };
    for (const seed of [17, 29]) {
      const simulation = new Simulation({ seed, level: bossLevel, startSquad: 18,
        startRocketCount: 2, tiers: config.tiers });
      const hashes: string[] = [];
      for (let tick = 1; tick <= 30; tick++) {
        simulation.step(1 / 60, { targetX: Math.sin(tick * 0.13) }, tuning);
        if ([1, 15, 30].includes(tick)) hashes.push(fingerprint(simulation.getState()));
      }
      expect(hashes).toEqual(seed === 17
        ? ['842080aa051ab056', '298727a71aa785e8', '6867b1d668a22107']
        : ['c5389d87998eed4d', '0a3170a75820986c', '46fc274a302cb305']);
    }
  });
});

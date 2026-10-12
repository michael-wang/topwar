import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';

import { GameConfigSchema } from '../src/config/configSchema';
import { type LevelDefinition } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';
import { createDefenseSquadFormation } from '../src/simulation/squad/formation';

const config = GameConfigSchema.parse(configData);
const isolated: LevelDefinition = { id: 'formation-step', length: 1000, enemyGroups: [], upgradeGates: [] };
const baseTuning: SimulationTuning = {
  moveSpeed: 0, forwardSpeed: 0, trackHalfWidth: 3, defenseLineOffset: 1.5,
  formationSpacing: 0.8, memberRadius: 0.01, normalEnemyRadius: 0.01,
  // Isolate current same-tick casualty formation updates.
  bossRadius: 0.01, rifle: { ...config.weapon.rifle, fireRate: 10 }, rocket: { ...config.weapon.rocket },
};

describe('step-local formation reuse', () => {

  it('updates contact formation after each casualty in the same step', () => {
    const simulation = new Simulation({ seed: 17, level: isolated, startSquad: 3,
      startRocketCount: 0, tiers: config.tiers, catharsis: { balance: { ...config.catharsis!, gruntSpeed: 0, heavySpeed: 0, defenseWaves: { ...config.catharsis!.defenseWaves, firstWaveDelaySeconds: 1000 } }, trackHalfWidth: 3.2 } });
    const state = simulation.getState();
    const offsets = [3, 2, 1].map((count) => createDefenseSquadFormation(count, baseTuning.formationSpacing, config.catharsis!.progression)[0]);
    const contactRadius = baseTuning.memberRadius + baseTuning.normalEnemyRadius;
    for (const [index, count] of [[1, 3], [2, 2]] as const) {
      expect(createDefenseSquadFormation(count, baseTuning.formationSpacing, config.catharsis!.progression).every((member) =>
        Math.hypot(member.x - offsets[index].x, member.z - offsets[index].z) > contactRadius)).toBe(true);
    }
    state.enemies = offsets.map((offset, index) => ({ id: index + 1, tier: 1, lane: 2, archetype: 'grunt' as const,
      x: offset.x, z: offset.z, hp: 1 }));
    state.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(state);
    simulation.step(1 / 60, { targetX: 0 }, baseTuning);
    expect(simulation.consumePresentationEvents().map((event) => event.kind))
      .toEqual(['normalEnemyContact', 'normalEnemyContact', 'normalEnemyContact']);
    expect(simulation.getState().squad.count).toBe(0);
    expect(simulation.getState().enemies).toHaveLength(0);
    expect(simulation.getState().elapsedSeconds).toBe(1 / 60);
  });
});

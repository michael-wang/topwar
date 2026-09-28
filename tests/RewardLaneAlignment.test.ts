import { describe, expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation, type SimulationTuning } from '../src/simulation/Simulation';

const config = GameConfigSchema.parse(gameData);
const level = LevelDefinitionSchema.parse(levelData);
const rewardX = level.enemyStream!.rewards!.sideX;
const radius = config.tiers.normalEnemyRadius;
const tuning: SimulationTuning = {
  moveSpeed: config.player.moveSpeed, forwardSpeed: 0,
  trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: config.track.defenseLineOffset,
  formationSpacing: config.player.formationSpacing,
  memberRadius: config.player.memberRadius,
  normalEnemyRadius: radius, bossRadius: config.bosses.basic.radius,
  rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket },
};

describe('authored reward lane alignment', () => {
  it.each([-1, 1])('lets both rifles hit the %i side reward at full steer', (side) => {
    expect(config.track.halfWidth).toBe(3.2);
    expect(rewardX).toBe(3.2);
    expect(radius).toBe(0.3);
    const x = side * rewardX;
    const simulation = new Simulation({ seed: 1, level, startSquad: 1,
      startRocketCount: 0, tiers: config.tiers });
    const state = simulation.getState();
    state.player.x = x;
    state.squad = { count: 2, rocketCount: 0, rifleCounts: [2], rifleRemainder: 0 };
    state.enemies = [];
    state.streamRewards = [{ id: state.enemyStream!.nextRewardId++, tier: 1,
      x, z: 5, hitProgress: 0, hitsRequired: 10 }];
    simulation.restoreState(state);
    simulation.step(.01, { targetX: x }, tuning);
    const fired = simulation.getState();
    expect(fired.player.x).toBe(x);
    expect(fired.projectiles).toHaveLength(2);
    expect(fired.projectiles.every((shot) => Math.abs(shot.x - x) < radius)).toBe(true);
    fired.weapons.rifleCooldownRemainingSeconds = 100;
    simulation.restoreState(fired);
    simulation.step(.1, { targetX: x }, tuning);
    expect(simulation.getState().streamRewards[0].hitProgress).toBe(2);
  });
});

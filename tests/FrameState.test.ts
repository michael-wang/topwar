import { describe, expect, it } from 'vitest';
import configData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { projectRenderState } from '../src/app/projectRenderState';
import { GameAudio } from '../src/audio/GameAudio';

const config = GameConfigSchema.parse(configData);
const level = LevelDefinitionSchema.parse(levelData);
const create = () => new Simulation({ seed: 71, level, startSquad: 2,
  startRocketCount: 0, tiers: config.tiers });
const projection = { formationSpacing: .45, trackHalfWidth: 3.2,
  defenseLineOffset: 1.5, bossVisualScale: 7 };

describe('ephemeral simulation frame state', () => {
  it('matches a defensive snapshot while retaining large internal array identities', () => {
    const simulation = create();
    const frame = simulation.getFrameState();
    const snapshot = simulation.getState();
    expect(frame).toEqual(snapshot);
    expect(simulation.getFrameState()).toBe(frame);
    expect(simulation.getFrameState().enemies).toBe(frame.enemies);
    expect(simulation.getFrameState().projectiles).toBe(frame.projectiles);
    expect(simulation.getFrameState().streamRewards).toBe(frame.streamRewards);
    expect(snapshot.enemies).not.toBe(frame.enemies);
    expect(snapshot.projectiles).not.toBe(frame.projectiles);
    expect(snapshot.streamRewards).not.toBe(frame.streamRewards);
    expect(snapshot.squad.rifleCounts).not.toBe(frame.squad.rifleCounts);
    snapshot.player.x = 100;
    snapshot.enemies[0].x = 100;
    snapshot.squad.rifleCounts[0] = 0;
    snapshot.projectiles.push({ id: 1, kind: 'rifle', tier: 1, x: 0, z: 0,
      speed: 1, damage: 1, remainingRange: 1, blastRadius: 0,
      hitRadiusBonus: 0, penetrationRemaining: 0 });
    expect(simulation.getState()).toEqual(frame);
  });

  it('does not affect deterministic stepping when observed between steps', () => {
    const observed = create();
    const unobserved = create();
    const tuning = { moveSpeed: 5, forwardSpeed: 3, trackHalfWidth: 3.2,
      defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22,
      normalEnemyRadius: config.tiers.normalEnemyRadius,
      bossRadius: config.bosses.basic.radius,
      rifle: { ...config.weapon.rifle }, rocket: { ...config.weapon.rocket } };
    for (let tick = 0; tick < 8; tick++) {
      observed.getFrameState();
      observed.step(1 / 60, { targetX: .3 }, tuning);
      unobserved.step(1 / 60, { targetX: .3 }, tuning);
      expect(observed.getState()).toEqual(unobserved.getState());
    }
  });
});

describe('render frame projection', () => {
  it('shares compatible arrays and preserves Boss and relative-Z conversions', () => {
    const state = create().getState();
    state.player.z = 20;
    state.boss = { id: 9, tier: 2, x: 0, z: 30, hp: 50, maxHp: 100,
      engaged: true, slamCooldownRemainingSeconds: .5, slamCount: 1 };
    state.gates = [{ id: 'gate', x: 1, zOffset: 6, width: 2, hitProgress: 2,
      reward: { mode: 'hitPickup', kind: 'rifle', amount: 3,
        hitsRequired: 5, dropSpeed: 2 } }];
    state.pickups = [{ id: 4, sourceGateId: 'gate', x: -1, zOffset: 3,
      width: 2, rewardKind: 'tier2Rifle', rewardAmount: 1, dropSpeed: 2 }];
    const before = structuredClone(state);
    const render = projectRenderState(state, projection);
    expect(render.enemies).toBe(state.enemies);
    expect(render.projectiles).toBe(state.projectiles);
    expect(render.streamRewards).toBe(state.streamRewards);
    expect(render.squad.rifleCounts).toBe(state.squad.rifleCounts);
    expect(render.player).toBe(state.player);
    expect(render.boss).toEqual({ ...state.boss, visualScale: 7 });
    expect(render.boss).not.toBe(state.boss);
    expect(render.track.defenseLineZ).toBe(18.5);
    expect(render.gates[0]).toMatchObject({ z: 26, rewardAmount: 3, hitProgress: 2 });
    expect(render.pickups[0]).toMatchObject({ z: 23, rewardKind: 'tier2Rifle' });
    expect(state).toEqual(before);
  });

  it('does not mutate frame entities while projecting or observing audio', () => {
    const state = create().getState();
    const before = structuredClone(state);
    Object.freeze(state.enemies);
    Object.freeze(state.projectiles);
    Object.freeze(state.streamRewards);
    Object.freeze(state.squad.rifleCounts);
    const render = projectRenderState(state, projection);
    const viewport = new EventTarget() as HTMLElement;
    const audio = new GameAudio(viewport, new EventTarget() as Window);
    audio.observe(2, 2, state.enemies, state.streamRewards, state.boss, 0, state.projectiles);
    expect(render.enemies).toBe(state.enemies);
    expect(state).toEqual(before);
    audio.dispose();
  });
});

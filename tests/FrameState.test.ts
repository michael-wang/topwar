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
  startRocketCount: 0, tiers: config.tiers, catharsis: { balance: { ...config.catharsis!, gruntSpeed: 0, heavySpeed: 0, defenseWaves: { ...config.catharsis!.defenseWaves, firstWaveDelaySeconds: 1000 } }, trackHalfWidth: 3.2 } });
const projection = { formationSpacing: .45, trackHalfWidth: 3.2,
  defenseLineOffset: 1.5, };

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
    snapshot.enemies.push({id:1,tier:1,archetype:'grunt',x:100,z:10,hp:1});
    snapshot.squad.rifleCounts[0] = 0;
    snapshot.projectiles.push({ id: 1, kind: 'rifle', tier: 1, lane: 2, x: 0, z: 0,
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
  it('shares compatible combat arrays and computes the stationary defense line without mutating state', () => {
    const state = create().getState(), before = structuredClone(state);
    const render = projectRenderState(state, projection);
    expect(render.enemies).toBe(state.enemies);
    expect(render.projectiles).toBe(state.projectiles);
    expect(render.squad.rifleCounts).toBe(state.squad.rifleCounts);
    expect(render.player).toBe(state.player);
    expect(render.track.defenseLineZ).toBe(-1.5);
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
    const audio = new GameAudio();
    audio.observe(2, 2, state.enemies, 0, state.projectiles);
    expect(render.enemies).toBe(state.enemies);
    expect(state).toEqual(before);
    audio.dispose();
  });
});

import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src/core/Rng';
import { Simulation } from '../src/simulation/Simulation';
import type { SimulationState } from '../src/simulation/SimulationState';

const create = () => new Simulation({ seed: 1, levelId: 'prototype', startSquad: 1 });

describe('Simulation', () => {
  it('starts with plain session state and does not consume its seed', () => {
    expect(create().getState()).toEqual({
      tick: 0,
      elapsedSeconds: 0,
      levelId: 'prototype',
      seed: 1,
      rngState: 1,
      player: { x: 0, z: 0 },
      squad: { count: 1 },
    });
  });

  it('accepts a zero-soldier start and rejects invalid squad counts', () => {
    expect(new Simulation({ seed: 1, levelId: 'prototype', startSquad: 0 }).getState().squad.count).toBe(0);
    for (const startSquad of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity]) {
      expect(() => new Simulation({ seed: 1, levelId: 'prototype', startSquad })).toThrow(/startSquad/);
    }
  });

  it('advances tick and time without moving the player or consuming RNG', () => {
    const simulation = create();
    simulation.step(1 / 60);
    expect(simulation.getState()).toEqual({
      tick: 1,
      elapsedSeconds: 1 / 60,
      levelId: 'prototype',
      seed: 1,
      rngState: 1,
      player: { x: 0, z: 0 },
      squad: { count: 1 },
    });
    simulation.step(1 / 60);
    simulation.step(1 / 30);
    expect(simulation.getState().tick).toBe(3);
    expect(simulation.getState().elapsedSeconds).toBeCloseTo(1 / 15);
    expect(simulation.getState().rngState).toBe(1);
    expect(simulation.getState().player).toEqual({ x: 0, z: 0 });
    expect(simulation.getState().squad.count).toBe(1);
  });

  it('produces identical state for the same seed, level, and step sequence', () => {
    const first = new Simulation({ seed: 0xffffffff, levelId: 'repeat', startSquad: 3 });
    const second = new Simulation({ seed: 0xffffffff, levelId: 'repeat', startSquad: 3 });
    for (const dt of [1 / 60, 1 / 60, 0.125, 1 / 60]) {
      first.step(dt);
      second.step(dt);
    }
    expect(first.getState()).toEqual(second.getState());
  });

  it('returns owned copies and restores a JSON round-trip including RNG state', () => {
    const simulation = create();
    simulation.step(0.125);
    const exposed = simulation.getState();
    exposed.player.x = 999;
    exposed.squad.count = 999;
    exposed.tick = 999;
    expect(simulation.getState().player.x).toBe(0);
    expect(simulation.getState().squad.count).toBe(1);
    expect(simulation.getState().tick).toBe(1);

    const restored = JSON.parse(JSON.stringify(simulation.getState())) as SimulationState;
    const rng = new SeededRng(restored.seed);
    rng.nextFloat();
    restored.rngState = rng.getState();
    restored.player = { x: -2.5, z: 4 };
    restored.squad.count = 5;
    const another = new Simulation({ seed: 99, levelId: 'other', startSquad: 0 });
    another.restoreState(JSON.parse(JSON.stringify(restored)) as SimulationState);
    expect(another.getState()).toEqual(restored);
    expect(another.getState().squad.count).toBe(5);
    another.step(0.125);
    expect(another.getState().rngState).toBe(restored.rngState);
  });

  it.each([0, -1, Number.NaN, Infinity, -Infinity])('rejects invalid dt %s without mutation', (dt) => {
    const simulation = create();
    expect(() => simulation.step(dt)).toThrow();
    expect(simulation.getState().tick).toBe(0);
  });

  it.each([-1, 1.5, 4294967296, Number.NaN, Infinity])('rejects invalid seed %s', (seed) => {
    expect(() => new Simulation({ seed, levelId: 'prototype', startSquad: 1 })).toThrow();
  });

  it.each(['', '   ', null, 7])('rejects invalid level id %s', (levelId) => {
    expect(() => new Simulation({ seed: 1, levelId: levelId as string, startSquad: 1 })).toThrow();
  });

  it.each([
    (state: SimulationState) => { state.tick = -1; },
    (state: SimulationState) => { state.tick = 1.5; },
    (state: SimulationState) => { state.elapsedSeconds = Infinity; },
    (state: SimulationState) => { state.elapsedSeconds = -1; },
    (state: SimulationState) => { state.levelId = ''; },
    (state: SimulationState) => { state.seed = 4294967296; },
    (state: SimulationState) => { state.rngState = -1; },
    (state: SimulationState) => { state.player.x = Number.NaN; },
    (state: SimulationState) => { state.player.z = Infinity; },
    (state: SimulationState) => { (state as unknown as Record<string, unknown>).extra = 1; },
    (state: SimulationState) => { (state.player as unknown as Record<string, unknown>).extra = 1; },
    (state: SimulationState) => { delete (state as unknown as Record<string, unknown>).squad; },
    (state: SimulationState) => { state.squad = null as unknown as SimulationState['squad']; },
    (state: SimulationState) => { (state.squad as unknown as Record<string, unknown>).extra = 1; },
    (state: SimulationState) => { delete (state.squad as unknown as Record<string, unknown>).count; },
    (state: SimulationState) => { state.squad.count = -1; },
    (state: SimulationState) => { state.squad.count = 1.5; },
    (state: SimulationState) => { state.squad.count = Number.MAX_SAFE_INTEGER + 1; },
  ])('rejects invalid restored state transactionally', (damage) => {
    const simulation = create();
    simulation.step(0.125);
    const valid = simulation.getState();
    const rng = new SeededRng(1);
    rng.nextFloat();
    valid.rngState = rng.getState();
    simulation.restoreState(valid);
    const previous = simulation.getState();
    const invalid = simulation.getState();
    damage(invalid);
    expect(() => simulation.restoreState(invalid)).toThrow();
    expect(simulation.getState()).toEqual(previous);
  });
});

import { SeededRng } from '../core/Rng';
import type { SimulationState } from './SimulationState';

export interface SimulationOptions {
  seed: number;
  levelId: string;
}

function validLevelId(levelId: unknown): levelId is string {
  return typeof levelId === 'string' && levelId.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateState(value: unknown): { state: SimulationState; rng: SeededRng } {
  if (!isPlainObject(value)) {
    throw new Error('Simulation state must be a plain object');
  }
  const state = value;
  const fields = ['tick', 'elapsedSeconds', 'levelId', 'seed', 'rngState', 'player'];
  if (Object.keys(state).length !== fields.length || fields.some((field) => !Object.hasOwn(state, field))) {
    throw new Error('Simulation state has missing or unknown fields');
  }
  if (!Number.isSafeInteger(state.tick) || (state.tick as number) < 0) {
    throw new Error('Simulation tick must be a non-negative integer');
  }
  if (typeof state.elapsedSeconds !== 'number' || !Number.isFinite(state.elapsedSeconds) || state.elapsedSeconds < 0) {
    throw new Error('Simulation elapsedSeconds must be finite and non-negative');
  }
  if (!validLevelId(state.levelId)) throw new Error('Simulation levelId must be a non-empty string');

  const rng = new SeededRng(state.seed as number);
  rng.setState(state.rngState as number);

  if (!isPlainObject(state.player)) {
    throw new Error('Simulation player must be a plain object');
  }
  const player = state.player;
  if (Object.keys(player).length !== 2 || !Object.hasOwn(player, 'x') || !Object.hasOwn(player, 'z')) {
    throw new Error('Simulation player has missing or unknown fields');
  }
  if (typeof player.x !== 'number' || !Number.isFinite(player.x)) {
    throw new Error('Simulation player.x must be finite');
  }
  if (typeof player.z !== 'number' || !Number.isFinite(player.z)) {
    throw new Error('Simulation player.z must be finite');
  }

  return {
    state: {
      tick: state.tick as number,
      elapsedSeconds: state.elapsedSeconds,
      levelId: state.levelId,
      seed: state.seed as number,
      rngState: rng.getState(),
      player: { x: player.x, z: player.z },
    },
    rng,
  };
}

export class Simulation {
  private rng: SeededRng;
  private state: SimulationState;

  constructor(options: SimulationOptions) {
    this.rng = new SeededRng(options.seed);
    if (!validLevelId(options.levelId)) throw new Error('Simulation levelId must be a non-empty string');
    this.state = {
      tick: 0,
      elapsedSeconds: 0,
      levelId: options.levelId,
      seed: options.seed,
      rngState: this.rng.getState(),
      player: { x: 0, z: 0 },
    };
  }

  step(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      throw new Error('Simulation dtSeconds must be finite and greater than zero');
    }
    const nextElapsedSeconds = this.state.elapsedSeconds + dtSeconds;
    if (!Number.isFinite(nextElapsedSeconds) || !Number.isSafeInteger(this.state.tick + 1)) {
      throw new Error('Simulation time or tick exceeds the supported range');
    }
    this.state.tick += 1;
    this.state.elapsedSeconds = nextElapsedSeconds;
    this.state.rngState = this.rng.getState();
  }

  getState(): SimulationState {
    return { ...this.state, rngState: this.rng.getState(), player: { ...this.state.player } };
  }

  restoreState(state: SimulationState): void {
    const candidate = validateState(state);
    this.state = candidate.state;
    this.rng = candidate.rng;
  }
}

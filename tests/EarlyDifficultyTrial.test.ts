import { expect, it } from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { prepareOpeningCohort } from '../src/app/openingCohort';
import { defaultRuntimeTuning } from '../src/app/runtimeTuning';
import { readCheckpoint, writeCheckpoint, simulationFromCheckpoint, type SessionCheckpoint } from '../src/app/SessionCheckpoint';
import { pilotTuning } from '../scripts/qa/DefensePilot';

it('uses Trial A only for new games, retaining the pre-Trial balance, wave clock and RNG through real Continue', () => {
  const level = LevelDefinitionSchema.parse(levelData);
  const old = structuredClone(config);
  old.catharsis!.defenseWaves.intervalSeconds = 6;
  old.catharsis!.pressureRamp!.lv4.heavyCount = 2;
  old.catharsis!.pressureRamp!.lv5.heavyCount = 3;
  const make = (c = config) => new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0,
    tiers: c.tiers, catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } });
  const legacy = make(old), fresh = make();
  prepareOpeningCohort(legacy); prepareOpeningCohort(fresh);
  expect(fresh.getState().enemies).toEqual(legacy.getState().enemies);
  expect(fresh.getState().enemies).toHaveLength(16);
  expect(fresh.getState().rngState).toBe(legacy.getState().rngState);
  expect(config.catharsis!.defenseWaves.intervalSeconds).toBe(5);
  expect(config.catharsis!.pressureRamp!.lv4.heavyCount).toBe(3);
  expect(config.catharsis!.pressureRamp!.lv5.heavyCount).toBe(4);
  for (let tick = 0; tick < 110; tick++) legacy.step(1 / 60, { targetX: 0 }, pilotTuning);
  const c: SessionCheckpoint = { version: 1, simulationContract: 1, game: 'topwar', mode: 'defense',
    build: 'pre-trial-a', savedAt: 1, paused: true, hidden: false, reason: 'pause', fixture: null,
    config: old, level, tuning: defaultRuntimeTuning(old, level), state: legacy.getState() };
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, text: string) => { entries.set(key, text); }, removeItem: (key: string) => { entries.delete(key); } };
  expect(writeCheckpoint(c, storage).ok).toBe(true);
  const loaded = readCheckpoint(storage); expect(loaded.status).toBe('valid');
  if (loaded.status !== 'valid') throw Error('Historical checkpoint rejected');
  const restored = simulationFromCheckpoint(loaded.checkpoint);
  expect(restored.getState()).toEqual(legacy.getState());
  for (let tick = 0; tick < 420; tick++) {
    legacy.step(1 / 60, { targetX: 0 }, pilotTuning);
    restored.step(1 / 60, { targetX: 0 }, pilotTuning);
  }
  expect(restored.getState()).toEqual(legacy.getState());
  expect(restored.getState().catharsis!.balance).toEqual(old.catharsis);
  expect(loaded.checkpoint.config.catharsis).toEqual(old.catharsis);
});

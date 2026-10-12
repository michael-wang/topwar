import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import released from './fixtures/released-b7-checkpoint.json';
import deployed from './fixtures/released-pages-checkpoint.json';
import { CHECKPOINT_KEY, readCheckpoint, simulationFromCheckpoint } from '../src/app/SessionCheckpoint';
import { pilotTuning } from '../scripts/qa/DefensePilot';

const canonical = (value) => JSON.stringify(value, (_key, v) => v && !Array.isArray(v)
  && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
it.each([{name:'B7',data:released},{name:'published B6B5',data:deployed}])('recovers the exact $name checkpoint and replays its next 600 recorded inputs', ({data:released}) => {
  const text = JSON.stringify(released.checkpoint);
  const saved = readCheckpoint({getItem: key => key === CHECKPOINT_KEY ? text : null,
    setItem: () => {}, removeItem: () => {}});
  expect(saved.status).toBe('valid'); if (saved.status !== 'valid') throw Error(saved.status);
  const sim = simulationFromCheckpoint(saved.checkpoint);
  expect(sim.getState()).toEqual(released.checkpoint.state);
  expect(sim.consumeArtilleryEvents()).toEqual([]); expect(sim.consumeGrenadeEvents()).toEqual([]);
  expect(sim.consumePresentationEvents()).toEqual([]);
  for (const decision of released.inputs) {
    const delta = decision.lane - sim.getFrameState().player.selectedLane;
    expect(Math.abs(delta)).toBeLessThanOrEqual(1); if (delta) sim.stepLane(delta);
    sim.step(1 / 60, decision.input, pilotTuning);
    sim.consumeArtilleryEvents(); sim.consumeGrenadeEvents(); sim.consumePresentationEvents();
  }
  expect(createHash('sha256').update(canonical(sim.getState())).digest('hex')).toBe(released.expectedStateHash);
});
it('rejects retired prototype checkpoints through the safe recovery result', () => {
  const store = (checkpoint) => ({ getItem: () => JSON.stringify(checkpoint), setItem: () => {}, removeItem: () => {} });
  expect(readCheckpoint(store({...released.checkpoint, mode:'legacy'})).status).toBe('invalid');
  const state = {...released.checkpoint.state, catharsis:undefined};
  expect(readCheckpoint(store({...released.checkpoint,state})).status).toBe('invalid');
});

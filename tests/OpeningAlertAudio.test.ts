import { expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';

it('holds one siren through the briefing, resumes its phase, and releases every node', () => {
  const sources: any[] = [], filters: any[] = [], gains: any[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = { state: 'running', close: vi.fn(async () => {}),
    createOscillator: () => { const n = { ...node(), frequency: { value: 0 }, start: vi.fn(), stop: vi.fn() }; sources.push(n); return n; },
    createBiquadFilter: () => { const n = { ...node(), frequency: { value: 0 } }; filters.push(n); return n; },
    createGain: () => { const n = { ...node(), gain: { value: 0 } }; gains.push(n); return n; },
  };
  const audio = new GameAudio(); Object.assign(audio, { context, unlocked: true, master: node() });
  for (let tick = 0; tick < 600; tick++) audio.syncOpeningAlert(tick / 60, false);
  expect(sources).toHaveLength(1); expect(sources[0].stop).not.toHaveBeenCalled();
  expect(gains[0].gain.value).toBe(.018); expect(audio.getDebugStats().sfxSources).toBe(1);
  audio.syncOpeningAlert(10, true); expect(audio.getDebugStats().sfxSources).toBe(0);
  audio.syncOpeningAlert(10, false); expect(sources).toHaveLength(2);
  expect(gains[1].gain.value).toBe(.018);
  expect(sources[1].frequency.value).toBeCloseTo(240 + 110 * Math.sin(2 * Math.PI * 8.8 / 2.6));
  audio.syncOpeningAlert(null, false); audio.syncOpeningAlert(null, false);
  audio.syncOpeningAlert(6, false); audio.resetObservation();
  audio.syncOpeningAlert(7, false); audio.dispose();
  for (const n of [...sources, ...filters, ...gains]) expect(n.disconnect).toHaveBeenCalledOnce();
  for (const n of sources) expect(n.stop).toHaveBeenCalledOnce();
});

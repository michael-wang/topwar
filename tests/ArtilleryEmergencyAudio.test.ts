import { afterEach, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
import { emergencyPulse } from '../src/presentation/ArtilleryEmergency';

afterEach(() => vi.unstubAllGlobals());
it('keeps one master-volume-controlled siren, seeks its remaining phase, and releases it on every lifecycle exit', async () => {
  const param = () => ({ value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const sources: any[] = [], gains: any[] = [];
  const context = { state: 'running', currentTime: 2, destination: {}, resume: async () => {}, close: async () => {},
    createGain: () => { const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; },
    createOscillator: () => { const source = { frequency: param(), type: '', connect: vi.fn(), disconnect: vi.fn(),
      start: vi.fn(), stop: vi.fn(), onended: null }; sources.push(source); return source; } };
  vi.stubGlobal('AudioContext', function () { return context; });
  const audio = new GameAudio(); await audio.activate();
  audio.syncArtilleryEmergency(.6, false); expect(sources).toHaveLength(0);
  for (let i = 0; i < 60; i++) audio.syncArtilleryEmergency(.4, false);
  expect(sources).toHaveLength(1); expect(sources[0].start).toHaveBeenCalledOnce();
  expect(gains[1].connect).toHaveBeenCalledWith(gains[0]);
  expect(sources[0].stop).toHaveBeenLastCalledWith(2.4);
  audio.syncArtilleryEmergency(.4, true); expect(sources[0].disconnect).toHaveBeenCalled(); expect(gains[1].disconnect).toHaveBeenCalled();
  audio.syncArtilleryEmergency(.15, false); expect(sources).toHaveLength(2);
  expect(sources[1].frequency.setValueAtTime).toHaveBeenLastCalledWith(950 + 850 * emergencyPulse(.15), 2);
  expect(sources[1].stop).toHaveBeenLastCalledWith(2.15);
  audio.syncArtilleryEmergency(null, false); expect(sources[1].disconnect).toHaveBeenCalled();
  audio.syncArtilleryEmergency(.1, false); expect(sources).toHaveLength(3); // re-entry, with no overlapping voice
  audio.silenceArtillery(); expect(sources[2].disconnect).toHaveBeenCalled();
  audio.syncArtilleryEmergency(.2, false); audio.resetObservation(); expect(sources[3].disconnect).toHaveBeenCalled();
  audio.syncArtilleryEmergency(.2, false); audio.dispose(); expect(sources[4].disconnect).toHaveBeenCalled();
  expect(gains.slice(1).every(g => g.disconnect.mock.calls.length > 0)).toBe(true);
});

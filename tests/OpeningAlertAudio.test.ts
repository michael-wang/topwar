import { expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
import { openingAlertPulse, openingAlertOpacity, openingSirenFrequency, openingSirenGain } from '../src/presentation/OpeningAlertPulse';

it('aligns pitch, audible gain and red intensity throughout the briefing',()=>{
  for(const t of [1.2,2.5,3.8,5.1,6.4,7.7,9,10.3]) {
    const pulse=openingAlertPulse(t);
    expect((openingSirenGain(t)-.045)/.035).toBeCloseTo(pulse);
    expect((openingSirenFrequency(t)-180)/240).toBeCloseTo(pulse);
    expect((openingAlertOpacity(t,false)-.28)/.62).toBeCloseTo(pulse);
    expect(openingAlertOpacity(t,true)).toBe(.8);
    expect(openingSirenGain(t)).toBeGreaterThan(.018*2);
  }
  expect(openingAlertPulse(2.5)).toBeCloseTo(1);expect(openingAlertPulse(3.8)).toBeCloseTo(0);
});
it('keeps one silent oscillator on Pause, resumes phase and releases its entire chain on end/retry/dispose', () => {
  const sources: any[] = [], filters: any[] = [], gains: any[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const param = () => ({ value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
  const context = { state: 'running', currentTime: 10, close: vi.fn(async () => {}),
    createOscillator: () => { const n = { ...node(), frequency: param(), start: vi.fn(), stop: vi.fn(), onended: null as any }; sources.push(n); return n; },
    createBiquadFilter: () => { const n = { ...node(), frequency: param() }; filters.push(n); return n; },
    createGain: () => { const n = { ...node(), gain: param() }; gains.push(n); return n; },
  };
  const master=node(), audio = new GameAudio(); Object.assign(audio, { context, unlocked: true, master });
  for (let tick = 0; tick < 600; tick++) audio.syncOpeningAlert(tick / 60, false);
  expect(sources).toHaveLength(1);expect(gains[0].connect).toHaveBeenCalledWith(master);
  audio.syncOpeningAlert(null, true);expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0,10,.008);
  audio.syncOpeningAlert(10, false);expect(sources).toHaveLength(1);
  expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(openingSirenGain(10),10,.008);
  expect(sources[0].frequency.value).toBeCloseTo(openingSirenFrequency(10));
  audio.syncOpeningAlert(null, false);expect(sources[0].stop).toHaveBeenCalledWith(10.03);
  sources[0].onended();expect(audio.getDebugStats().sfxSources).toBe(0);
  audio.syncOpeningAlert(6,false);audio.resetObservation();sources[1].onended();
  audio.syncOpeningAlert(7,false);audio.dispose();sources[2].onended();
  for(const n of [...filters,...gains])expect(n.disconnect).toHaveBeenCalledOnce();
  expect(audio.getDebugStats().sfxSources).toBe(0);
});

import { describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
import { MAX_MUSIC_VOICES, MUSIC_BPM, MUSIC_STEP_MS, ProceduralMusic,
  MUSIC_MAX_VOLUME, musicNotesForStep, musicStateFor, musicStepAt,
  type MusicFrame } from '../src/audio/ProceduralMusic';

const normal: MusicFrame = { playerZ: 0, squadCount: 4, boss: null,
  paused: false, musicVolume: .22 };

function audioHarness() {
  const gains: any[] = [];
  const oscillators: any[] = [];
  const filters: any[] = [];
  const parameter = (value = 0) => ({ value, setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn() });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createGain: vi.fn(() => {
      const node = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    }),
    createOscillator: vi.fn(() => {
      const node = { type: 'sine', frequency: parameter(), connect: vi.fn(),
        disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
      oscillators.push(node);
      return node;
    }),
    createBiquadFilter: vi.fn(() => {
      const node = { type: '', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      filters.push(node);
      return node;
    }),
    resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
  };
  return { context, gains, oscillators, filters };
}

describe('original procedural battlefield score', () => {
  it('uses one deterministic 88 BPM grid with sparse, varied modal phrases', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Music must not consume Math.random');
    });
    try {
      expect(MUSIC_BPM).toBe(88);
      expect(MUSIC_STEP_MS).toBeCloseTo(60_000 / 88 / 2);
      expect(musicStepAt(0)).toBe(0);
      expect(musicStepAt(MUSIC_STEP_MS * 7 + 1)).toBe(7);
      const sequence = (seed: number, state: 'NORMAL' | 'BOSS_APPROACH' | 'BOSS_SHOWDOWN') =>
        Array.from({ length: 128 }, (_, step) => musicNotesForStep(seed, step, state));
      const base = sequence(17, 'NORMAL');
      const approach = sequence(17, 'BOSS_APPROACH');
      const showdown = sequence(17, 'BOSS_SHOWDOWN');
      expect(sequence(17, 'NORMAL')).toEqual(base);
      expect(sequence(18, 'NORMAL')).not.toEqual(base);
      const count = (phrase: ReturnType<typeof sequence>) =>
        phrase.reduce((sum, notes) => sum + notes.length, 0);
      expect(count(base)).toBeLessThan(count(approach));
      expect(count(approach)).toBeLessThan(count(showdown));
      expect(base.filter((notes) => notes.length === 0).length).toBeGreaterThan(80);
      expect(new Set([0, 32, 64, 96].map((start) => JSON.stringify(base.slice(start,
        start + 32)))).size).toBeGreaterThan(1);
      expect(approach.flat().some((note) => note.frequencyHz === 311.13)).toBe(true);
      expect(MUSIC_MAX_VOLUME).toBe(.5);
      expect(base.flat().some((note) => note.voice === 'pulse' && note.frequencyHz >= 200))
        .toBe(true);
      expect(base.flat().some((note) => note.voice === 'texture' && note.frequencyHz >= 290))
        .toBe(true);
      expect(musicNotesForStep(17, 5, 'GAME_OVER')).toEqual([]);
    } finally { random.mockRestore(); }
  });

  it('selects Boss approach only nearby and keeps showdown and Game Over distinct', () => {
    expect(musicStateFor(normal)).toBe('NORMAL');
    expect(musicStateFor({ ...normal, boss: { z: 96, engaged: false } })).toBe('NORMAL');
    expect(musicStateFor({ ...normal, boss: { z: 42, engaged: false } })).toBe('BOSS_APPROACH');
    expect(musicStateFor({ ...normal, boss: { z: 96, engaged: true } })).toBe('BOSS_SHOWDOWN');
    expect(musicStateFor({ ...normal, squadCount: 0, boss: { z: 10, engaged: true } }))
      .toBe('GAME_OVER');
  });

  it('routes bounded synth voices through a music bus, fades pause, ducks death, and cleans up', () => {
    const { context, gains, oscillators, filters } = audioHarness();
    const master = context.createGain();
    const music = new ProceduralMusic(context as unknown as AudioContext,
      master as unknown as GainNode, 17);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(oscillators.slice(0, 3).map((oscillator) => oscillator.frequency.value))
      .toEqual([73.42, 146.83, 220]);
    expect(oscillators.slice(0, 3).map((oscillator) => oscillator.type))
      .toEqual(['sine', 'triangle', 'triangle']);
    expect(oscillators.slice(0, 3).every((oscillator) => oscillator.start.mock.calls.length === 1))
      .toBe(true);
    expect(music.bus).toBe(gains[1]);
    expect(gains[1].connect).toHaveBeenCalledWith(master);
    expect(filters.every((filter) => filter.type === 'lowpass')).toBe(true);
    expect(filters.map((filter) => filter.frequency.value)).toEqual([520, 720, 1300, 950]);
    music.update(0, normal);
    expect(music.currentStepIndex).toBe(0);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 0, .07);
    expect(gains[2].gain.setTargetAtTime).toHaveBeenCalledWith(.25, 0, .35);
    music.update(MUSIC_STEP_MS + 1, normal);
    const voiceCount = music.activeVoiceCount;
    music.update(MUSIC_STEP_MS + 1, { ...normal,
      boss: { z: 35, engaged: false } });
    expect(music.currentStepIndex).toBe(1);
    expect(music.activeVoiceCount).toBe(voiceCount);
    const beforePause = oscillators.length;
    music.update(MUSIC_STEP_MS + 1, { ...normal, paused: true });
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, .035);
    music.update(MUSIC_STEP_MS + 1, normal);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 0, .07);
    expect(oscillators).toHaveLength(beforePause);
    music.duck(100);
    music.update(100, normal);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .28, 0, .035);
    music.update(2600, normal);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 0, .07);
    music.update(2700, { ...normal, musicVolume: 0 });
    expect(gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    music.update(2750, normal);
    music.update(2800, { ...normal, squadCount: 0 });
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, .22);
    music.reset();
    music.update(0, normal);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 0, .07);
    for (let step = 1; step < 300; step++) {
      music.update(step * MUSIC_STEP_MS + 1, { ...normal,
        boss: { z: 10, engaged: true } });
    }
    expect(music.activeVoiceCount).toBeLessThanOrEqual(MAX_MUSIC_VOICES + 3);
    expect(context.createOscillator.mock.calls.length).toBeLessThan(300);
    music.dispose();
    expect(gains[1].disconnect).toHaveBeenCalledOnce();
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(true);
  });

  it('stays silent before unlock and shares GameAudio’s one context and master', async () => {
    const { context, gains, oscillators } = audioHarness();
    const constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    try {
      const viewport = new EventTarget();
      const keys = new EventTarget();
      const audio = new GameAudio(viewport as HTMLElement, keys as Window);
      audio.updateMusic(0, normal);
      expect(constructor).not.toHaveBeenCalled();
      viewport.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();
      audio.updateMusic(0, normal);
      expect(constructor).toHaveBeenCalledOnce();
      expect(gains[1].connect).toHaveBeenCalledWith(gains[0]);
      expect(oscillators).toHaveLength(3);
      expect(oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1))
        .toBe(true);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(.22, 0, .07);
      for (let step = 1; step <= 32; step++) {
        audio.updateMusic(step * MUSIC_STEP_MS + 1, { ...normal, musicVolume: .5 });
      }
      expect(oscillators.length).toBeGreaterThan(3);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(.5, 0, .07);
      audio.observe(1, 1, [], [], { id: 1, hp: 10 }, 100);
      audio.observe(1, 1, [], [], null, 120);
      audio.updateMusic(120, normal);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .28, 0, .035);
      audio.resetObservation();
      audio.updateMusic(0, { ...normal, musicVolume: .24 });
      expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.24, 0, .07);
      expect(constructor).toHaveBeenCalledOnce();
      audio.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});

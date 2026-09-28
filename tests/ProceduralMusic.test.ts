import { describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
import { MAX_MUSIC_VOICES, MUSIC_LOOKAHEAD_SECONDS, ProceduralMusic } from '../src/audio/ProceduralMusic';
import { MUSIC_BAR_SECONDS, MUSIC_BPM, MUSIC_MAX_VOLUME, MUSIC_STEP_MS,
  MUSIC_STEPS_PER_BAR, musicEventsForStep, musicHarmonyForBar, musicMotifVariant,
  musicPhraseIntensity, musicStateFor, musicStepAt, type MusicFrame,
  type MusicState } from '../src/audio/MusicComposition';

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
  const advance = (music: ProceduralMusic, presentationMs: number,
    frame = normal, audioSeconds = presentationMs / 1000) => {
    context.currentTime = audioSeconds;
    for (const oscillator of oscillators) {
      const stoppedAt = oscillator.stop.mock.lastCall?.[0];
      if (oscillator.onended && typeof stoppedAt === 'number'
        && stoppedAt <= audioSeconds) {
        const onended = oscillator.onended;
        oscillator.onended = null;
        onended();
      }
    }
    music.update(presentationMs, frame);
  };
  return { context, gains, oscillators, filters, advance };
}

describe('original procedural battlefield composition', () => {
  it('moves through Dm, Bb, C and Dm/A over eight bars with tonal, overlapping pads', () => {
    expect(MUSIC_BPM).toBe(88);
    expect(MUSIC_STEPS_PER_BAR).toBe(8);
    expect(MUSIC_BAR_SECONDS).toBeCloseTo(60 / 88 * 4);
    expect(musicStepAt(MUSIC_STEP_MS * 9 + 1)).toBe(9);
    expect(Array.from({ length: 8 }, (_, bar) => musicHarmonyForBar(bar, 'NORMAL').name))
      .toEqual(['Dm', 'Dm', 'Bb', 'Bb', 'C', 'C', 'Dm/A', 'Dm/A']);
    const pads = Array.from({ length: 8 }, (_, bar) =>
      musicEventsForStep(17, bar * 8, 'NORMAL').filter((event) => event.instrument === 'pad'));
    expect(pads.every((chord) => chord.length === 3
      && chord.every((note) => note.durationSeconds > MUSIC_BAR_SECONDS))).toBe(true);
    expect(new Set(pads.flat().map((note) => note.frequencyHz)).size).toBeGreaterThan(6);
    const aeolian = new Set([0, 2, 3, 5, 7, 8, 10]); // D E F G A Bb C, relative to D.
    const pitchClass = (hz: number) => ((Math.round(69 + 12 * Math.log2(hz / 440)) - 2) % 12 + 12) % 12;
    for (let step = 0; step < 64; step++) {
      for (const event of musicEventsForStep(17, step, 'NORMAL')) {
        expect(aeolian.has(pitchClass(event.frequencyHz))).toBe(true);
      }
    }
  });

  it('states an original motif, leaves answer spaces, and varies related phrases deterministically', () => {
    const motif = (seed: number, bar: number, state: MusicState = 'NORMAL') =>
      Array.from({ length: 8 }, (_, inBar) => musicEventsForStep(seed, bar * 8 + inBar, state)
        .filter((event) => event.instrument === 'motif')).flat();
    expect(motif(17, 0).map((note) => note.frequencyHz))
      .toEqual([349.23, 392, 440, 329.63, 293.66]); // F4 G4 A4 E4 D4.
    expect(motif(17, 1)).toEqual([]);
    expect(motif(17, 2)).toHaveLength(3);
    expect(motif(17, 3)).toEqual([]);
    expect(motif(17, 4)).toHaveLength(5);
    expect(motif(17, 5)).toEqual([]);
    const variants = Array.from({ length: 24 }, (_, phrase) => musicMotifVariant(17, phrase));
    expect(variants).toEqual(Array.from({ length: 24 }, (_, phrase) =>
      musicMotifVariant(17, phrase)));
    expect(new Set(variants).size).toBeGreaterThan(1);
    expect(Array.from({ length: 24 }, (_, phrase) => musicMotifVariant(18, phrase)))
      .not.toEqual(variants);
    const later = motif(17, 12);
    expect(later.length).toBeGreaterThanOrEqual(4);
    expect(later[0].frequencyHz).toBe(musicHarmonyForBar(12, 'NORMAL').motifHz[0]);
    expect(later[1].frequencyHz).toBe(musicHarmonyForBar(12, 'NORMAL').motifHz[1]);
  });

  it('ties bass movement and macro dynamics to the harmonic phrase', () => {
    const bass = (bar: number, state: MusicState) =>
      Array.from({ length: 8 }, (_, step) => musicEventsForStep(17, bar * 8 + step, state)
        .filter((event) => event.instrument === 'bass')).flat();
    for (let bar = 0; bar < 8; bar++) {
      const notes = bass(bar, 'NORMAL');
      expect(notes[0].frequencyHz).toBe(musicHarmonyForBar(bar, 'NORMAL').rootHz);
      expect(new Set(notes.map((note) => note.frequencyHz)).size).toBeGreaterThan(1);
      expect(notes).toHaveLength(3);
      expect(bass(bar, 'BOSS_APPROACH')).toHaveLength(4);
      expect(bass(bar, 'BOSS_SHOWDOWN')).toHaveLength(5);
    }
    expect(musicEventsForStep(17, 1, 'NORMAL').some((event) => event.instrument === 'bass'))
      .toBe(false);
    expect(Array.from({ length: 8 }, (_, bar) => musicPhraseIntensity(bar)))
      .toEqual([.75, .75, .85, .85, 1, 1, .8, .8]);
    expect(musicEventsForStep(17, 0, 'NORMAL').find((event) => event.instrument === 'pad')!.peakGain)
      .toBeLessThan(musicEventsForStep(17, 4 * 8, 'NORMAL')
        .find((event) => event.instrument === 'pad')!.peakGain);
  });

  it('keeps one clock while approach adds Eb and showdown changes related harmony', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Music must not consume Math.random');
    });
    try {
      expect(musicStateFor(normal)).toBe('NORMAL');
      expect(musicStateFor({ ...normal, boss: { z: 96, engaged: false } })).toBe('NORMAL');
      expect(musicStateFor({ ...normal, boss: { z: 42, engaged: false } })).toBe('BOSS_APPROACH');
      expect(musicStateFor({ ...normal, boss: { z: 96, engaged: true } })).toBe('BOSS_SHOWDOWN');
      expect(musicStateFor({ ...normal, squadCount: 0 })).toBe('GAME_OVER');
      expect(musicHarmonyForBar(0, 'BOSS_SHOWDOWN').name).toBe('Dm');
      expect(musicHarmonyForBar(1, 'BOSS_SHOWDOWN').name).toBe('Eb');
      expect(musicHarmonyForBar(2, 'BOSS_SHOWDOWN').name).toBe('C');
      const normalPad = musicEventsForStep(17, 0, 'NORMAL').find((event) =>
        event.instrument === 'pad')!;
      const approachPad = musicEventsForStep(17, 0, 'BOSS_APPROACH').find((event) =>
        event.instrument === 'pad')!;
      expect(approachPad.chord).toBe(normalPad.chord);
      expect(approachPad.frequencyHz).toBeCloseTo(normalPad.frequencyHz * 2);
      expect(musicEventsForStep(17, 8 + 5, 'BOSS_APPROACH')
        .some((event) => event.instrument === 'tension' && event.frequencyHz === 311.13))
        .toBe(true);
      const count = (state: MusicState) => Array.from({ length: 64 }, (_, step) =>
        musicEventsForStep(17, step, state).length).reduce((sum, n) => sum + n, 0);
      expect(count('NORMAL')).toBeLessThan(count('BOSS_APPROACH'));
      expect(count('BOSS_APPROACH')).toBeLessThan(count('BOSS_SHOWDOWN'));
      expect(musicEventsForStep(17, 0, 'GAME_OVER')).toEqual([]);
    } finally { random.mockRestore(); }
  });

  it('schedules ahead on one AudioContext clock, pauses/resumes, ducks, and bounds nodes', () => {
    const { context, gains, oscillators, filters, advance } = audioHarness();
    const master = context.createGain();
    const music = new ProceduralMusic(context as unknown as AudioContext,
      master as unknown as GainNode, 17);
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(music.bus).toBe(gains[1]);
    expect(gains[1].connect).toHaveBeenCalledWith(master);
    expect(filters.map((filter) => filter.frequency.value)).toEqual([1200, 700, 1900, 1300]);
    advance(music, 0);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 0, .07);
    expect(oscillators).toHaveLength(6); // Three pad tones, two oscillators each.
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true);
    expect(oscillators.some((oscillator) => oscillator.type === 'sawtooth')).toBe(true);
    advance(music, MUSIC_STEP_MS - 100);
    expect(MUSIC_LOOKAHEAD_SECONDS).toBeGreaterThan(.08);
    expect(oscillators.length).toBeGreaterThan(6);
    expect(oscillators.at(-1)!.start.mock.lastCall![0]).toBeGreaterThan(context.currentTime);
    const stepBefore = music.currentStepIndex;
    advance(music, MUSIC_STEP_MS - 100, { ...normal, boss: { z: 35, engaged: false } });
    expect(music.currentStepIndex).toBe(stepBefore);
    advance(music, MUSIC_STEP_MS * 2, { ...normal, paused: true });
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0,
      context.currentTime, .035);
    const pausedStep = music.currentStepIndex;
    advance(music, MUSIC_STEP_MS * 2, { ...normal, paused: true }, 4);
    expect(music.currentStepIndex).toBe(pausedStep);
    advance(music, MUSIC_STEP_MS * 2, normal, 4);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 4, .07);
    expect(music.currentStepIndex).toBe(2);
    music.duck(MUSIC_STEP_MS * 2);
    advance(music, MUSIC_STEP_MS * 2 + 10, normal, 4.01);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .28, 4.01, .035);
    advance(music, MUSIC_STEP_MS * 2 + 2500, normal, 6.5);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 6.5, .07);
    advance(music, MUSIC_STEP_MS * 2 + 2600, { ...normal, musicVolume: 0 }, 6.6);
    expect(gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 6.6);
    advance(music, MUSIC_STEP_MS * 2 + 2650, normal, 6.65);
    advance(music, MUSIC_STEP_MS * 2 + 2700, { ...normal, squadCount: 0 }, 6.7);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 6.7, .22);
    music.reset();
    advance(music, 0);
    expect(music.currentStepIndex).toBe(0);
    for (let ms = 100; ms < 8 * MUSIC_BAR_SECONDS * 1000; ms += 50) {
      advance(music, ms, { ...normal, boss: { z: 8, engaged: true } });
      expect(music.activeVoiceCount).toBeLessThanOrEqual(MAX_MUSIC_VOICES);
    }
    expect(context.createOscillator.mock.calls.length).toBeLessThan(300);
    music.dispose();
    expect(gains[1].disconnect).toHaveBeenCalledOnce();
    expect(filters.every((filter) => filter.disconnect.mock.calls.length === 1)).toBe(true);
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(true);
  });

  it('creates music only after unlock and shares GameAudio’s existing master bus', async () => {
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
      expect(oscillators).toHaveLength(6);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(.22, 0, .07);
      context.currentTime = (MUSIC_STEP_MS - 100) / 1000;
      audio.updateMusic(MUSIC_STEP_MS - 100, normal);
      expect(oscillators.length).toBeGreaterThan(6);
      audio.observe(1, 1, [], [], { id: 1, hp: 10 }, 1000);
      audio.observe(1, 1, [], [], null, 1020);
      context.currentTime = 1.02;
      audio.updateMusic(1020, normal);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .28,
        1.02, .035);
      audio.resetObservation();
      context.currentTime = 2;
      audio.updateMusic(0, { ...normal, musicVolume: .24 });
      expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.24, 2, .07);
      expect(constructor).toHaveBeenCalledOnce();
      audio.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});

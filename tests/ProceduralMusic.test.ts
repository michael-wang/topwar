import { describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
import { MAX_MUSIC_VOICES, MUSIC_LOOKAHEAD_SECONDS, ProceduralMusic } from '../src/audio/ProceduralMusic';
import { BOSS_MUSIC_BPM, VICTORY_MUSIC_BPM, VICTORY_THEME_STEPS, MUSIC_BAR_SECONDS, MUSIC_BPM, MUSIC_STEP_MS, MUSIC_STEPS_PER_BAR, musicEventsForStep, musicHarmonyForBar, musicMotifVariant, musicPhraseIntensity, musicStateFor, musicStepAt, musicStepMs, type MusicFrame, type MusicState } from '../src/audio/MusicComposition';

const normal: MusicFrame = { squadCount: 3,
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
  it('gives the Boss an independent melody and harmony at 116 BPM, building drums and melody across phases', () => {
    expect(BOSS_MUSIC_BPM).toBe(116); expect(musicStepMs('BOSS_1')).toBeCloseTo(60_000 / 116 / 2);
    expect(Array.from({ length: 4 }, (_, bar) => musicHarmonyForBar(bar, 'BOSS_1').name)).toEqual(['Am', 'F', 'Dm', 'E']);
    const phrase = (state: MusicState) => Array.from({ length: 8 }, (_, step) => musicEventsForStep(17, step, state)).flat();
    const bossMotif = phrase('BOSS_2').filter(e => e.instrument === 'motif').map(e => Math.round(69 + 12 * Math.log2(e.frequencyHz / 440)));
    expect(bossMotif).toEqual([57, 64, 69, 72, 71, 67, 69, 64]);
    expect(bossMotif).not.toEqual(phrase('NORMAL').filter(e => e.instrument === 'motif').map(e => Math.round(69 + 12 * Math.log2(e.frequencyHz / 440))));
    expect(phrase('BOSS_INTRO').every(e => e.instrument === 'pad' || e.instrument === 'bass')).toBe(true);
    expect(['BOSS_1', 'BOSS_2', 'BOSS_3'].map(state => phrase(state as MusicState).filter(e => e.instrument === 'drum').length)).toEqual([2, 4, 8]);
    expect(['BOSS_1', 'BOSS_2', 'BOSS_3'].map(state => phrase(state as MusicState).filter(e => e.instrument === 'motif').length)).toEqual([6, 8, 10]);
    expect(musicEventsForStep(17, 0, 'VICTORY').map(e => e.instrument)).toEqual(['pad', 'pad', 'pad', 'bass', 'brass']);
  });
  it('follows the saved Tank clock and phase, freezes on Pause, resumes and changes to victory with bounded voices', () => {
    const { context, gains, filters, advance } = audioHarness();
    const music = new ProceduralMusic(context as unknown as AudioContext, context.createGain() as unknown as GainNode, 17);
    const boss: MusicFrame = { ...normal, tank: { status: 'entering', phase: 1, elapsedSeconds: 0, entrySeconds: 2.5 } };
    advance(music, 90000, normal, 0);
    advance(music, 90020, boss, .02);
    expect(musicStateFor(boss)).toBe('BOSS_INTRO');
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .55, .02, .2);
    boss.tank!.status = 'active'; boss.tank!.elapsedSeconds = 3.35;
    advance(music, 0, boss, 2.52); // Presentation starts at zero after a restored checkpoint.
    expect(music.currentStepIndex).toBe(musicStepAt(850, 'BOSS_1'));
    advance(music, 0, { ...boss, paused: true }, 3);
    const frozen = music.currentStepIndex;
    advance(music, 0, { ...boss, paused: true }, 6);
    expect(music.currentStepIndex).toBe(frozen);
    advance(music, 0, boss, 6.01);
    expect(music.currentStepIndex).toBe(musicStepAt(850, 'BOSS_1'));
    for (const phase of [1, 2, 3] as const) {
      boss.tank!.phase = phase;
      expect(musicStateFor(boss)).toBe(`BOSS_${phase}`);
      for (let tick = 0; tick < 100; tick++) {
        boss.tank!.elapsedSeconds += .05;
        advance(music, 0, boss, 6.06 + (phase - 1) * 5 + tick * .05);
        expect(music.activeVoiceCount).toBeLessThanOrEqual(MAX_MUSIC_VOICES);
      }
    }
    expect(music.activeVoiceCount).toBeGreaterThan(0);
    boss.tank!.status = 'defeated'; boss.victorySeconds = 0; advance(music, 0, boss, 21.1);
    expect(musicStateFor(boss)).toBe('VICTORY');
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22 * .65, 21.1, .05);
    advance(music, 0, boss, 21.3); expect(music.activeVoiceCount).toBeGreaterThan(0);
    boss.tank!.status = 'breached'; expect(musicStateFor(boss)).toBe('GAME_OVER');
    music.dispose(); expect(filters.every(filter => filter.disconnect.mock.calls.length === 1)).toBe(true);
  });
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
    }
    expect(musicEventsForStep(17, 1, 'NORMAL').some((event) => event.instrument === 'bass'))
      .toBe(false);
    expect(Array.from({ length: 8 }, (_, bar) => musicPhraseIntensity(bar)))
      .toEqual([.75, .75, .85, .85, 1, 1, .8, .8]);
    expect(musicEventsForStep(17, 0, 'NORMAL').find((event) => event.instrument === 'pad')!.peakGain)
      .toBeLessThan(musicEventsForStep(17, 4 * 8, 'NORMAL')
        .find((event) => event.instrument === 'pad')!.peakGain);
  });

  it('selects silence only after actual Game Over without consuming gameplay randomness', () => {
    expect(musicStateFor(normal)).toBe('NORMAL');
    expect(musicStateFor({ squadCount: 0 })).toBe('GAME_OVER');
    expect(musicEventsForStep(17, 0, 'GAME_OVER')).toEqual([]);
  });

  it('schedules ahead on one AudioContext clock, pauses/resumes and bounds nodes', () => {
    const { context, gains, oscillators, filters, advance } = audioHarness();
    const master = context.createGain();
    const music = new ProceduralMusic(context as unknown as AudioContext,
      master as unknown as GainNode, 17);
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(music.bus).toBe(gains[1]);
    expect(gains[1].connect).toHaveBeenCalledWith(master);
    expect(filters.map((filter) => filter.frequency.value)).toEqual([1200, 700, 1900, 900, 2600]);
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
    advance(music, MUSIC_STEP_MS - 100, normal);
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
    advance(music, MUSIC_STEP_MS * 2 + 2500, normal, 6.5);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 4, .07);
    advance(music, MUSIC_STEP_MS * 2 + 2600, { ...normal, musicVolume: 0 }, 6.6);
    expect(gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 6.6);
    advance(music, MUSIC_STEP_MS * 2 + 2650, normal, 6.65);
    advance(music, MUSIC_STEP_MS * 2 + 2700, { ...normal, squadCount: 0 }, 6.7);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 6.7, .22);
    music.reset();
    advance(music, 0);
    expect(music.currentStepIndex).toBe(0);
    for (let ms = 100; ms < 8 * MUSIC_BAR_SECONDS * 1000; ms += 50) {
      advance(music, ms, normal);
      expect(music.activeVoiceCount).toBeLessThanOrEqual(MAX_MUSIC_VOICES);
    }
    expect(context.createOscillator.mock.calls.length).toBeLessThan(300);
    music.dispose();
    expect(gains[1].disconnect).toHaveBeenCalledOnce();
    expect(filters.every((filter) => filter.disconnect.mock.calls.length === 1)).toBe(true);
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(true);
  });

  it('creates music only after explicit activation and shares GameAudio’s existing master bus', async () => {
    const { context, gains, oscillators } = audioHarness();
    const constructor = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', constructor);
    try {
      const viewport = new EventTarget();
      const keys = new EventTarget();
      const audio = new GameAudio();
      audio.updateMusic(0, normal);
      expect(constructor).not.toHaveBeenCalled();
      expect(await audio.activate()).toBe('running');
      audio.updateMusic(0, normal);
      expect(constructor).toHaveBeenCalledOnce();
      expect(gains[1].connect).toHaveBeenCalledWith(gains[0]);
      expect(oscillators).toHaveLength(6);
      expect(gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(.22, 0, .07);
      context.currentTime = (MUSIC_STEP_MS - 100) / 1000;
      audio.updateMusic(MUSIC_STEP_MS - 100, normal);
      expect(oscillators.length).toBeGreaterThan(6);
      audio.resetObservation();
      context.currentTime = 2;
      audio.updateMusic(0, { ...normal, musicVolume: .24 });
      expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.24, 2, .07);
      expect(constructor).toHaveBeenCalledOnce();
      audio.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});

it('plays an original twenty-second victory melody with a resolved soft ending, never repeating battle music', () => {
  expect(VICTORY_MUSIC_BPM).toBe(96);
  expect(VICTORY_THEME_STEPS * musicStepMs('VICTORY') / 1000).toBe(20);
  const events = Array.from({ length: VICTORY_THEME_STEPS }, (_, step) => musicEventsForStep(17, step, 'VICTORY')).flat();
  const melody = events.filter(e => e.instrument === 'brass');
  expect(melody.length).toBeGreaterThan(30);
  expect(new Set(melody.map(e => e.frequencyHz)).size).toBeGreaterThan(8);
  expect(events.some(e => e.instrument === 'drum')).toBe(false);
  expect(Math.round(69 + 12 * Math.log2(melody.at(-1)!.frequencyHz / 440))).toBe(65); // F-major resolution.
  expect(musicEventsForStep(17, 64, 'VICTORY').every(e => e.instrument === 'pad' && e.peakGain < .06)).toBe(true);
  expect(musicEventsForStep(17, 65, 'VICTORY')).toEqual([]);
  expect(musicEventsForStep(17, 128, 'VICTORY')).toEqual([]);
});

it('waits for the victory speech to finish, follows the results clock across Pause/Resume, and releases its voices', () => {
  const { context, oscillators, advance } = audioHarness();
  const music = new ProceduralMusic(context as unknown as AudioContext, context.createGain() as unknown as GainNode);
  const frame: MusicFrame = { ...normal, victorySeconds: null,
    tank: { status: 'defeated', phase: 3, elapsedSeconds: 0, entrySeconds: 2.5 } };
  advance(music, 0, frame); advance(music, 12000, frame, 12);
  expect(oscillators).toHaveLength(0);
  frame.victorySeconds = 0; advance(music, 12000, frame, 12);
  expect(music.currentStepIndex).toBe(0); expect(oscillators.some(o => o.type === 'sawtooth')).toBe(true);
  for (let ms = 50; ms <= 25000; ms += 50) {
    frame.victorySeconds = ms / 1000; advance(music, 12000 + ms, frame, 12 + ms / 1000);
    expect(music.activeVoiceCount).toBeLessThanOrEqual(MAX_MUSIC_VOICES);
    if (ms === 3000) {
      advance(music, 15000, { ...frame, paused: true }, 30);
      const step = music.currentStepIndex;
      advance(music, 15000, { ...frame, paused: true }, 32); expect(music.currentStepIndex).toBe(step);
      const previousVoices = oscillators.length;
      advance(music, 15000, frame, 32); expect(music.currentStepIndex).toBe(musicStepAt(3000, 'VICTORY'));
      expect(oscillators.slice(previousVoices).some(o => o.type === 'sawtooth'
        && Math.abs(o.frequency.setValueAtTime.mock.lastCall![0] - 440 * 2 ** ((74 - 69) / 12)) < .01)).toBe(true);
    }
  }
  expect(music.activeVoiceCount).toBe(0);
  music.reset(); advance(music, 0, { ...frame, victorySeconds: 0 }, 40);
  expect(music.currentStepIndex).toBe(0); music.dispose(); expect(music.activeVoiceCount).toBe(0);
});

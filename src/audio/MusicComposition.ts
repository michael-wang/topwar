export const MUSIC_BPM = 88;
export const BOSS_MUSIC_BPM = 116;
export const MUSIC_STEP_MS = 60_000 / MUSIC_BPM / 2;
export const MUSIC_STEPS_PER_BAR = 8;
export const MUSIC_BAR_SECONDS = MUSIC_STEP_MS * MUSIC_STEPS_PER_BAR / 1000;
export const MUSIC_MAX_VOLUME = .5;

export type MusicState = 'NORMAL' | 'GAME_OVER' | 'BOSS_INTRO' | 'BOSS_1' | 'BOSS_2' | 'BOSS_3' | 'VICTORY';
export interface MusicFrame {
  squadCount: number;
  paused: boolean;
  musicVolume: number;
  tank?: { status: 'entering' | 'active' | 'defeated' | 'breached'; phase: 1 | 2 | 3;
    elapsedSeconds: number; entrySeconds: number };
}
export type ChordName = 'Dm' | 'Bb' | 'C' | 'Dm/A' | 'Am' | 'F' | 'E';
export type MusicInstrument = 'pad' | 'bass' | 'motif' | 'drum';
export interface MusicEvent {
  instrument: MusicInstrument;
  frequencyHz: number;
  durationSeconds: number;
  peakGain: number;
  chord: ChordName;
}

interface Harmony {
  name: ChordName;
  rootHz: number;
  fifthHz: number;
  octaveHz: number;
  padHz: readonly [number, number, number];
  motifHz: readonly [number, number, number, number, number];
}

const HARMONY = {
  Dm: { name: 'Dm', rootHz: 73.42, fifthHz: 110, octaveHz: 146.83,
    padHz: [146.83, 220, 349.23], motifHz: [349.23, 392, 440, 329.63, 293.66] },
  Bb: { name: 'Bb', rootHz: 58.27, fifthHz: 87.31, octaveHz: 116.54,
    padHz: [116.54, 174.61, 293.66], motifHz: [293.66, 349.23, 392, 261.63, 233.08] },
  C: { name: 'C', rootHz: 65.41, fifthHz: 98, octaveHz: 130.81,
    padHz: [130.81, 196, 329.63], motifHz: [329.63, 392, 440, 293.66, 261.63] },
  'Dm/A': { name: 'Dm/A', rootHz: 55, fifthHz: 73.42, octaveHz: 110,
    padHz: [110, 146.83, 349.23], motifHz: [349.23, 392, 440, 329.63, 293.66] },
} satisfies Partial<Record<ChordName, Harmony>>;
const BOSS_HARMONY: Record<'Am' | 'F' | 'Dm' | 'E', Harmony> = {
  Am: { name: 'Am', rootHz: 55, fifthHz: 82.41, octaveHz: 110,
    padHz: [110, 164.81, 261.63], motifHz: [220, 329.63, 440, 523.25, 493.88] },
  F: { name: 'F', rootHz: 43.65, fifthHz: 65.41, octaveHz: 87.31,
    padHz: [87.31, 130.81, 220], motifHz: [349.23, 329.63, 261.63, 220, 392] },
  Dm: { name: 'Dm', rootHz: 36.71, fifthHz: 55, octaveHz: 73.42,
    padHz: [73.42, 110, 174.61], motifHz: [293.66, 440, 587.33, 523.25, 349.23] },
  E: { name: 'E', rootHz: 41.2, fifthHz: 61.74, octaveHz: 82.41,
    padHz: [82.41, 123.47, 207.65], motifHz: [329.63, 415.3, 493.88, 659.25, 587.33] },
};
const BOSS_FORM = ['Am', 'F', 'Dm', 'E'] as const;
// Original four-bar military/arcade call and answer, independent of the normal motif.
const BOSS_MELODY = [
  [57, 64, 69, 72, 71, 67, 69, 64],
  [65, 64, 60, 57, 60, 65, 67, 64],
  [62, 69, 74, 72, 69, 65, 64, 62],
  [64, 68, 71, 76, 74, 71, 68, 64],
] as const;
const NORMAL_FORM: readonly ChordName[] = ['Dm', 'Dm', 'Bb', 'Bb', 'C', 'C', 'Dm/A', 'Dm/A'];
const PHRASE_DYNAMICS = [.75, .75, .85, .85, 1, 1, .8, .8] as const;
const MOTIF_STEPS = [1, 2, 4, 6, 7] as const;
const ANSWER_STEPS = [1, 4, 6] as const;
const NORMAL_BASS_STEPS = [0, 3, 6] as const;

function hash(value: number): number {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function musicStateFor(frame: Pick<MusicFrame, 'squadCount' | 'tank'>): MusicState {
  if (frame.squadCount === 0 || frame.tank?.status === 'breached') return 'GAME_OVER';
  if (frame.tank?.status === 'defeated') return 'VICTORY';
  if (frame.tank?.status === 'entering') return 'BOSS_INTRO';
  if (frame.tank?.status === 'active') return `BOSS_${frame.tank.phase}`;
  return 'NORMAL';
}

export const isBossMusic = (state: MusicState): boolean => state.startsWith('BOSS_');
export const musicStepMs = (state: MusicState): number => isBossMusic(state) ? 60_000 / BOSS_MUSIC_BPM / 2 : MUSIC_STEP_MS;
export function musicStepAt(presentationMs: number, state: MusicState = 'NORMAL'): number {
  return Math.floor(Math.max(0, presentationMs) / musicStepMs(state));
}

export function musicHarmonyForBar(bar: number, state: MusicState): Harmony {
  if (isBossMusic(state)) return BOSS_HARMONY[BOSS_FORM[((bar % 4) + 4) % 4]];
  const form = NORMAL_FORM;
  return HARMONY[form[((bar % form.length) + form.length) % form.length] as keyof typeof HARMONY];
}

export function musicPhraseIntensity(bar: number): number {
  return PHRASE_DYNAMICS[((bar % 8) + 8) % 8];
}

// The first phrase states the motif plainly; later phrases vary its answer or timing as a unit.
export function musicMotifVariant(seed: number, phrase: number): number {
  return phrase === 0 ? 0 : hash(seed ^ Math.imul(phrase, 0x9e3779b1)) % 3;
}

export function musicEventsForStep(seed: number, step: number, state: MusicState): MusicEvent[] {
  if (state === 'GAME_OVER' || state === 'VICTORY') return [];
  if (isBossMusic(state)) return bossEventsForStep(step, state);
  const bar = Math.floor(step / MUSIC_STEPS_PER_BAR);
  const inBar = ((step % MUSIC_STEPS_PER_BAR) + MUSIC_STEPS_PER_BAR) % MUSIC_STEPS_PER_BAR;
  const withinPhrase = ((bar % 8) + 8) % 8;
  const harmony = musicHarmonyForBar(bar, state);
  const intensity = musicPhraseIntensity(bar);
  const events: MusicEvent[] = [];
  if (inBar === 0) {
    for (const [index, frequencyHz] of harmony.padHz.entries()) {
      events.push({ instrument: 'pad',
        frequencyHz,
        durationSeconds: MUSIC_BAR_SECONDS + .32,
        peakGain: .12 * intensity, chord: harmony.name });
    }
  }

  const bassSteps: readonly number[] = NORMAL_BASS_STEPS;
  const bassIndex = bassSteps.indexOf(inBar);
  if (bassIndex >= 0) {
    const bassHz = [harmony.rootHz, harmony.fifthHz, harmony.octaveHz,
      harmony.fifthHz, harmony.rootHz][bassIndex];
    events.push({ instrument: 'bass', frequencyHz: bassHz,
      durationSeconds: bassIndex === 0 ? .62 : .42,
      peakGain: .16 * intensity,
      chord: harmony.name });
  }

  const phrase = Math.floor(bar / 8);
  const variant = musicMotifVariant(seed, phrase);
  const call = withinPhrase === 0 || withinPhrase === 4;
  const answer = withinPhrase === 2 || withinPhrase === 6;
  if (call || answer) {
    const steps: readonly number[] = call ? (withinPhrase === 4 && variant === 1
      ? [0, 2, 3, 5, 7] : MOTIF_STEPS) : ANSWER_STEPS;
    const index = steps.indexOf(inBar);
    if (index >= 0 && !(call && withinPhrase === 4 && variant === 2 && index === 3)) {
      const motifIndex = call ? index : [0, 2, 4][index];
      const alteredEnding = call && withinPhrase === 4 && variant === 2 && motifIndex === 4;
      const frequencyHz = alteredEnding ? harmony.motifHz[0] : harmony.motifHz[motifIndex];
      events.push({ instrument: 'motif',
        frequencyHz,
        durationSeconds: .26,
        peakGain: .15 * intensity,
        chord: harmony.name });
    }
  }
  return events;
}

function bossEventsForStep(step: number, state: MusicState): MusicEvent[] {
  const bar = Math.floor(step / MUSIC_STEPS_PER_BAR), inBar = step % MUSIC_STEPS_PER_BAR;
  const harmony = musicHarmonyForBar(bar, state), events: MusicEvent[] = [];
  const phase = state === 'BOSS_3' ? 3 : state === 'BOSS_2' ? 2 : 1;
  const add = (instrument: MusicInstrument, frequencyHz: number, durationSeconds: number, peakGain: number) =>
    events.push({ instrument, frequencyHz, durationSeconds, peakGain, chord: harmony.name });
  if (inBar === 0) for (const hz of harmony.padHz) add('pad', hz,
    musicStepMs(state) * MUSIC_STEPS_PER_BAR / 1000 + .2, state === 'BOSS_INTRO' ? .07 : .09);
  if (state === 'BOSS_INTRO') {
    if (inBar === 0 || inBar === 4) add('bass', harmony.rootHz, .8, .2);
    return events;
  }
  if (phase === 3 || inBar % (phase === 2 ? 2 : 4) === 0) {
    add('bass', inBar % 4 === 0 ? harmony.rootHz : harmony.fifthHz, .3, .2 + phase * .015);
    add('drum', inBar % 4 === 0 ? 72 : 150, .16, .16 + phase * .025);
  }
  if (phase > 1 || inBar !== 1 && inBar !== 5) {
    const note = BOSS_MELODY[((bar % 4) + 4) % 4][inBar];
    add('motif', 440 * 2 ** ((note - 69) / 12), .25, .14 + phase * .025);
    if (phase === 3 && inBar % 4 === 0) add('motif', 440 * 2 ** ((note + 12 - 69) / 12), .24, .09);
  }
  return events;
}


export const MUSIC_BPM = 88;
export const MUSIC_STEP_MS = 60_000 / MUSIC_BPM / 2;
export const MUSIC_STEPS_PER_BAR = 8;
export const MUSIC_BAR_SECONDS = MUSIC_STEP_MS * MUSIC_STEPS_PER_BAR / 1000;
export const MUSIC_APPROACH_DISTANCE = 42;
export const MUSIC_MAX_VOLUME = .5;

export type MusicState = 'NORMAL' | 'BOSS_APPROACH' | 'BOSS_SHOWDOWN' | 'GAME_OVER';
export interface MusicFrame {
  playerZ: number;
  squadCount: number;
  boss: { z: number; engaged: boolean } | null;
  paused: boolean;
  musicVolume: number;
}
export type ChordName = 'Dm' | 'Bb' | 'C' | 'Dm/A' | 'Eb';
export type MusicInstrument = 'pad' | 'bass' | 'motif' | 'tension';
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

const HARMONY: Record<ChordName, Harmony> = {
  Dm: { name: 'Dm', rootHz: 73.42, fifthHz: 110, octaveHz: 146.83,
    padHz: [146.83, 220, 349.23], motifHz: [349.23, 392, 440, 329.63, 293.66] },
  Bb: { name: 'Bb', rootHz: 58.27, fifthHz: 87.31, octaveHz: 116.54,
    padHz: [116.54, 174.61, 293.66], motifHz: [293.66, 349.23, 392, 261.63, 233.08] },
  C: { name: 'C', rootHz: 65.41, fifthHz: 98, octaveHz: 130.81,
    padHz: [130.81, 196, 329.63], motifHz: [329.63, 392, 440, 293.66, 261.63] },
  'Dm/A': { name: 'Dm/A', rootHz: 55, fifthHz: 73.42, octaveHz: 110,
    padHz: [110, 146.83, 349.23], motifHz: [349.23, 392, 440, 329.63, 293.66] },
  Eb: { name: 'Eb', rootHz: 77.78, fifthHz: 116.54, octaveHz: 155.56,
    padHz: [155.56, 233.08, 392], motifHz: [392, 466.16, 523.25, 349.23, 311.13] },
};
const NORMAL_FORM: readonly ChordName[] = ['Dm', 'Dm', 'Bb', 'Bb', 'C', 'C', 'Dm/A', 'Dm/A'];
const SHOWDOWN_FORM: readonly ChordName[] = ['Dm', 'Eb', 'C', 'Dm'];
const PHRASE_DYNAMICS = [.75, .75, .85, .85, 1, 1, .8, .8] as const;
const MOTIF_STEPS = [1, 2, 4, 6, 7] as const;
const ANSWER_STEPS = [1, 4, 6] as const;
const NORMAL_BASS_STEPS = [0, 3, 6] as const;
const APPROACH_BASS_STEPS = [0, 2, 4, 6] as const;
const SHOWDOWN_BASS_STEPS = [0, 2, 4, 6, 7] as const;

function hash(value: number): number {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function musicStateFor(frame: Pick<MusicFrame, 'playerZ' | 'squadCount' | 'boss'>): MusicState {
  if (frame.squadCount === 0) return 'GAME_OVER';
  if (frame.boss?.engaged) return 'BOSS_SHOWDOWN';
  if (frame.boss && frame.boss.z - frame.playerZ <= MUSIC_APPROACH_DISTANCE) {
    return 'BOSS_APPROACH';
  }
  return 'NORMAL';
}

export function musicStepAt(presentationMs: number): number {
  return Math.floor(Math.max(0, presentationMs) / MUSIC_STEP_MS);
}

export function musicHarmonyForBar(bar: number, state: MusicState): Harmony {
  const form = state === 'BOSS_SHOWDOWN' ? SHOWDOWN_FORM : NORMAL_FORM;
  return HARMONY[form[((bar % form.length) + form.length) % form.length]];
}

export function musicPhraseIntensity(bar: number): number {
  return PHRASE_DYNAMICS[((bar % 8) + 8) % 8];
}

// The first phrase states the motif plainly; later phrases vary its answer or timing as a unit.
export function musicMotifVariant(seed: number, phrase: number): number {
  return phrase === 0 ? 0 : hash(seed ^ Math.imul(phrase, 0x9e3779b1)) % 3;
}

export function musicEventsForStep(seed: number, step: number, state: MusicState): MusicEvent[] {
  if (state === 'GAME_OVER') return [];
  const bar = Math.floor(step / MUSIC_STEPS_PER_BAR);
  const inBar = ((step % MUSIC_STEPS_PER_BAR) + MUSIC_STEPS_PER_BAR) % MUSIC_STEPS_PER_BAR;
  const withinPhrase = ((bar % 8) + 8) % 8;
  const harmony = musicHarmonyForBar(bar, state);
  const intensity = musicPhraseIntensity(bar);
  const events: MusicEvent[] = [];
  if (inBar === 0) {
    for (const [index, frequencyHz] of harmony.padHz.entries()) {
      events.push({ instrument: 'pad',
        frequencyHz: state === 'BOSS_APPROACH' && index === 0 ? frequencyHz * 2 : frequencyHz,
        durationSeconds: MUSIC_BAR_SECONDS + .32,
        peakGain: .12 * intensity, chord: harmony.name });
    }
  }

  const bassSteps: readonly number[] = state === 'BOSS_SHOWDOWN' ? SHOWDOWN_BASS_STEPS
    : state === 'BOSS_APPROACH' ? APPROACH_BASS_STEPS : NORMAL_BASS_STEPS;
  const bassIndex = bassSteps.indexOf(inBar);
  if (bassIndex >= 0) {
    const bassHz = [harmony.rootHz, harmony.fifthHz, harmony.octaveHz,
      harmony.fifthHz, harmony.rootHz][bassIndex];
    events.push({ instrument: 'bass', frequencyHz: bassHz,
      durationSeconds: bassIndex === 0 ? .62 : .42,
      peakGain: (state === 'BOSS_SHOWDOWN' ? .19 : .16) * intensity,
      chord: harmony.name });
  }

  const phrase = Math.floor(bar / 8);
  const variant = musicMotifVariant(seed, phrase);
  const call = withinPhrase === 0 || withinPhrase === 4;
  const answer = withinPhrase === 2 || withinPhrase === 6;
  if (call || answer || (state === 'BOSS_SHOWDOWN' && withinPhrase % 2 === 1)) {
    const steps: readonly number[] = call ? (withinPhrase === 4 && variant === 1
      ? [0, 2, 3, 5, 7] : MOTIF_STEPS) : ANSWER_STEPS;
    const index = steps.indexOf(inBar);
    if (index >= 0 && !(call && withinPhrase === 4 && variant === 2 && index === 3)) {
      const motifIndex = call ? index : [0, 2, 4][index];
      const alteredEnding = call && withinPhrase === 4 && variant === 2 && motifIndex === 4;
      const frequencyHz = alteredEnding ? harmony.motifHz[0] : harmony.motifHz[motifIndex];
      events.push({ instrument: 'motif',
        frequencyHz: state === 'BOSS_SHOWDOWN' ? frequencyHz / 2 : frequencyHz,
        durationSeconds: state === 'BOSS_SHOWDOWN' ? .32 : .26,
        peakGain: (state === 'BOSS_SHOWDOWN' ? .17 : .15) * intensity,
        chord: harmony.name });
    }
  }
  if (state === 'BOSS_APPROACH' && withinPhrase % 2 === 1 && inBar === 5) {
    events.push({ instrument: 'tension', frequencyHz: 311.13,
      durationSeconds: .45, peakGain: .075 * intensity, chord: harmony.name });
  }
  return events;
}

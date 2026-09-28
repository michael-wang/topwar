export const MUSIC_BPM = 88;
export const MUSIC_STEP_MS = 60_000 / MUSIC_BPM / 2;
export const MUSIC_APPROACH_DISTANCE = 42;
export const MAX_MUSIC_VOICES = 12;
export const MUSIC_MAX_VOLUME = .5;

export type MusicState = 'NORMAL' | 'BOSS_APPROACH' | 'BOSS_SHOWDOWN' | 'GAME_OVER';
export interface MusicFrame {
  playerZ: number;
  squadCount: number;
  boss: { z: number; engaged: boolean } | null;
  paused: boolean;
  musicVolume: number;
}
export interface MusicNote {
  layer: 'base' | 'approach' | 'showdown';
  voice: 'pulse' | 'texture' | 'tension';
  frequencyHz: number;
  peakGain: number;
  durationSeconds: number;
}

const PULSE = [
  [0, 6, 13, 23, 29], [0, 9, 15, 21, 30],
  [2, 8, 14, 24, 31], [0, 7, 17, 25, 30],
] as const;
const TEXTURE = [
  [5, 18, 27], [3, 19, 28], [10, 22, 31], [4, 16, 26],
] as const;
const APPROACH = [
  [3, 11, 19, 27, 31], [5, 13, 20, 26, 31],
  [1, 11, 18, 25, 29], [4, 12, 21, 26, 30],
] as const;
const SHOWDOWN = [
  [1, 4, 10, 12, 18, 20, 26, 28], [2, 6, 9, 14, 17, 22, 25, 30],
  [1, 5, 8, 13, 17, 21, 27, 30], [2, 4, 11, 15, 18, 23, 25, 29],
] as const;
const MODAL_PITCHES = [293.66, 349.23, 392, 440, 523.25]; // D F G A C

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

// Four-bar phrases share one clock; only the sparse placements change per phrase.
export function musicNotesForStep(seed: number, step: number, state: MusicState): MusicNote[] {
  if (state === 'GAME_OVER') return [];
  const phrase = Math.floor(step / 32);
  const withinPhrase = ((step % 32) + 32) % 32;
  const variant = hash(seed ^ Math.imul(phrase + 1, 0x9e3779b1)) % 4;
  const notes: MusicNote[] = [];
  if ((PULSE[variant] as readonly number[]).includes(withinPhrase)) {
    notes.push({ layer: 'base', voice: 'pulse',
      frequencyHz: hash(seed ^ step) % 4 === 0 ? 220 : 146.83,
      peakGain: .28, durationSeconds: .19 });
  }
  if ((TEXTURE[variant] as readonly number[]).includes(withinPhrase)) {
    notes.push({ layer: 'base', voice: 'texture',
      frequencyHz: MODAL_PITCHES[hash(seed ^ Math.imul(step + 1, 37)) % MODAL_PITCHES.length],
      peakGain: .16, durationSeconds: .3 });
  }
  if (state === 'NORMAL') return notes;
  if ((APPROACH[variant] as readonly number[]).includes(withinPhrase)) {
    notes.push({ layer: 'approach', voice: 'tension',
      frequencyHz: hash(seed ^ step) % 3 === 0 ? 311.13 : 293.66, // Eb against D
      peakGain: .12, durationSeconds: .22 });
  }
  if (state !== 'BOSS_SHOWDOWN') return notes;
  if ((SHOWDOWN[variant] as readonly number[]).includes(withinPhrase)) {
    notes.push({ layer: 'showdown', voice: 'pulse',
      frequencyHz: withinPhrase % 2 === 0 ? 146.83 : 155.56,
      peakGain: .22, durationSeconds: .23 });
  }
  return notes;
}

export class ProceduralMusic {
  readonly bus: GainNode;
  private readonly droneGain: GainNode;
  private readonly foundationGain: GainNode;
  private readonly fifthGain: GainNode;
  private readonly filters: Record<MusicNote['voice'], BiquadFilterNode>;
  private readonly drones: OscillatorNode[] = [];
  private readonly active = new Map<OscillatorNode, GainNode>();
  private lastStep = -1;
  private lastPresentationMs = 0;
  private approachMix = 0;
  private showdownMix = 0;
  private duckStartedAtMs = -Infinity;
  private lastBusTarget = NaN;
  private lastDroneTarget = NaN;
  private disposed = false;

  constructor(private readonly context: AudioContext, master: GainNode,
    private readonly seed = 0x4d25317b) {
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(master);
    this.droneGain = context.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.bus);
    this.foundationGain = context.createGain();
    this.foundationGain.gain.value = .35;
    this.fifthGain = context.createGain();
    this.fifthGain.gain.value = .55;
    const filter = (frequency: number, destination: AudioNode): BiquadFilterNode => {
      const node = context.createBiquadFilter();
      node.type = 'lowpass';
      node.frequency.value = frequency;
      node.connect(destination);
      return node;
    };
    const droneFilter = filter(520, this.droneGain);
    this.foundationGain.connect(droneFilter);
    this.fifthGain.connect(droneFilter);
    this.filters = { pulse: filter(720, this.bus), texture: filter(1300, this.bus),
      tension: filter(950, this.bus) };
    for (const [frequency, wave, destination] of [
      [73.42, 'sine', this.foundationGain], [146.83, 'triangle', droneFilter],
      [220, 'triangle', this.fifthGain],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.value = frequency;
      oscillator.connect(destination);
      oscillator.start();
      this.drones.push(oscillator);
    }
    this.droneFilter = droneFilter;
  }

  private readonly droneFilter: BiquadFilterNode;

  get activeVoiceCount(): number { return this.active.size + this.drones.length; }
  get currentStepIndex(): number { return this.lastStep; }

  update(presentationMs: number, frame: MusicFrame): void {
    if (this.disposed) return;
    const state = musicStateFor(frame);
    const deltaMs = Math.max(0, Math.min(100, presentationMs - this.lastPresentationMs));
    this.lastPresentationMs = presentationMs;
    const blend = 1 - Math.exp(-deltaMs / 550);
    this.approachMix += ((state === 'BOSS_APPROACH' || state === 'BOSS_SHOWDOWN' ? 1 : 0)
      - this.approachMix) * blend;
    this.showdownMix += ((state === 'BOSS_SHOWDOWN' ? 1 : 0) - this.showdownMix) * blend;
    const volume = Math.max(0, Math.min(MUSIC_MAX_VOLUME, frame.musicVolume));
    const now = this.context.currentTime;
    const duck = this.duckFactor(presentationMs);
    const target = frame.paused || state === 'GAME_OVER' ? 0 : volume * duck;
    if (volume === 0) {
      this.bus.gain.cancelScheduledValues(now);
      this.bus.gain.setValueAtTime(0, now);
      this.lastBusTarget = 0;
    } else if (Math.abs(target - this.lastBusTarget) > .001 || Number.isNaN(this.lastBusTarget)) {
      this.bus.gain.setTargetAtTime(target, now,
        frame.paused ? .035 : state === 'GAME_OVER' ? .22 : duck < 1 ? .035 : .07);
      this.lastBusTarget = target;
    }
    const droneTarget = .25 + .065 * this.approachMix + .045 * this.showdownMix;
    if (Math.abs(droneTarget - this.lastDroneTarget) > .002 || Number.isNaN(this.lastDroneTarget)) {
      this.droneGain.gain.setTargetAtTime(droneTarget, now, .35);
      this.lastDroneTarget = droneTarget;
    }
    const step = musicStepAt(presentationMs);
    if (this.lastStep < 0 || frame.paused || state === 'GAME_OVER' || volume === 0) {
      this.lastStep = step;
      return;
    }
    if (step === this.lastStep) return;
    this.lastStep = step;
    for (const note of musicNotesForStep(this.seed, step, 'BOSS_SHOWDOWN')) {
      const layerGain = note.layer === 'base' ? 1
        : note.layer === 'approach' ? this.approachMix : this.showdownMix;
      if (layerGain < .025 || this.active.size >= MAX_MUSIC_VOICES) continue;
      this.playNote(note, layerGain);
    }
  }

  duck(presentationMs: number): void { this.duckStartedAtMs = presentationMs; }

  reset(): void {
    this.stopTransientVoices();
    this.lastStep = -1;
    this.lastPresentationMs = 0;
    this.approachMix = 0;
    this.showdownMix = 0;
    this.duckStartedAtMs = -Infinity;
    this.lastBusTarget = NaN;
    this.lastDroneTarget = NaN;
    this.bus.gain.setTargetAtTime(0, this.context.currentTime, .03);
  }

  silence(): void {
    if (this.disposed) return;
    this.bus.gain.setTargetAtTime(0, this.context.currentTime, .035);
    this.lastBusTarget = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTransientVoices();
    for (const oscillator of this.drones) {
      oscillator.stop();
      oscillator.disconnect();
    }
    this.drones.length = 0;
    this.droneFilter.disconnect();
    this.foundationGain.disconnect();
    this.fifthGain.disconnect();
    this.droneGain.disconnect();
    for (const filter of Object.values(this.filters)) filter.disconnect();
    this.bus.disconnect();
  }

  private duckFactor(presentationMs: number): number {
    const elapsed = presentationMs - this.duckStartedAtMs;
    if (elapsed < 0 || elapsed >= 2400) return 1;
    if (elapsed <= 1000) return .28;
    const progress = (elapsed - 1000) / 1400;
    return .28 + .72 * progress * progress * (3 - 2 * progress);
  }

  private playNote(note: MusicNote, layerGain: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    const end = start + note.durationSeconds;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(note.frequencyHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(note.frequencyHz * .96, end);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(note.peakGain * layerGain, start + .018);
    gain.gain.exponentialRampToValueAtTime(.001, end);
    oscillator.connect(gain);
    gain.connect(this.filters[note.voice]);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.active.delete(oscillator);
    };
    this.active.set(oscillator, gain);
    oscillator.start(start);
    oscillator.stop(end);
  }

  private stopTransientVoices(): void {
    for (const [oscillator, gain] of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.active.clear();
  }
}

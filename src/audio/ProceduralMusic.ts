import { MUSIC_BAR_SECONDS, MUSIC_MAX_VOLUME, MUSIC_STEP_MS,
  MUSIC_STEPS_PER_BAR, musicEventsForStep, musicStateFor, musicStepAt,
  type MusicEvent, type MusicFrame, type MusicInstrument, type MusicState,
} from './MusicComposition';

export { MUSIC_BPM, MUSIC_STEP_MS, MUSIC_APPROACH_DISTANCE, MUSIC_MAX_VOLUME,
  musicStateFor, musicStepAt } from './MusicComposition';
export type { MusicFrame, MusicState, MusicEvent } from './MusicComposition';

export const MAX_MUSIC_VOICES = 24;
export const MUSIC_LOOKAHEAD_SECONDS = .12;

export class ProceduralMusic {
  readonly bus: GainNode;
  private readonly filters: Record<MusicInstrument, BiquadFilterNode>;
  private readonly active = new Map<OscillatorNode, GainNode>();
  private nextStep = -1;
  private clockOffsetSeconds = 0;
  private duckStartedAtMs = -Infinity;
  private lastBusTarget = NaN;
  private wasPaused = false;
  private wasSilent = true;
  private disposed = false;

  constructor(private readonly context: AudioContext, master: GainNode,
    private readonly seed = 0x4d25317b) {
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(master);
    const filter = (cutoffHz: number): BiquadFilterNode => {
      const node = context.createBiquadFilter();
      node.type = 'lowpass';
      node.frequency.value = cutoffHz;
      node.connect(this.bus);
      return node;
    };
    this.filters = { pad: filter(1200), bass: filter(700),
      motif: filter(1900), tension: filter(1300) };
  }

  get activeVoiceCount(): number { return this.active.size; }
  get currentStepIndex(): number { return this.nextStep - 1; }

  update(presentationMs: number, frame: MusicFrame): void {
    if (this.disposed) return;
    const state = musicStateFor(frame);
    const volume = Math.max(0, Math.min(MUSIC_MAX_VOLUME, frame.musicVolume));
    const now = this.context.currentTime;
    const silent = frame.paused || state === 'GAME_OVER' || volume === 0;
    const target = silent ? 0 : volume * this.duckFactor(presentationMs);
    if (volume === 0) {
      this.bus.gain.cancelScheduledValues(now);
      this.bus.gain.setValueAtTime(0, now);
      this.lastBusTarget = 0;
    } else if (Number.isNaN(this.lastBusTarget) || Math.abs(target - this.lastBusTarget) > .001) {
      this.bus.gain.setTargetAtTime(target, now,
        frame.paused ? .035 : state === 'GAME_OVER' ? .22
          : target < volume ? .035 : .07);
      this.lastBusTarget = target;
    }
    if (silent) {
      if (!this.wasSilent && (frame.paused || volume === 0)) this.releaseVoices(now);
      this.wasPaused = frame.paused;
      this.wasSilent = true;
      return;
    }

    const expectedNow = presentationMs / 1000 + this.clockOffsetSeconds;
    if (this.nextStep < 0 || this.wasPaused || this.wasSilent
      || Math.abs(now - expectedNow) > .25) {
      if (this.nextStep >= 0 && Math.abs(now - expectedNow) > .25) this.releaseVoices(now);
      this.clockOffsetSeconds = now - presentationMs / 1000;
      this.nextStep = musicStepAt(presentationMs) + 1;
      this.voiceCurrentChord(presentationMs, state, now + .008);
    }
    this.wasPaused = false;
    this.wasSilent = false;

    // The next grid event is queued before its audible time; late frames skip missed steps.
    const horizon = now + MUSIC_LOOKAHEAD_SECONDS;
    for (let queued = 0; queued < 4; queued++) {
      const start = this.clockOffsetSeconds + this.nextStep * MUSIC_STEP_MS / 1000;
      if (start > horizon) break;
      if (start >= now - .06) {
        for (const event of musicEventsForStep(this.seed, this.nextStep, state)) {
          this.schedule(event, Math.max(now + .003, start));
        }
      }
      this.nextStep++;
    }
  }

  duck(presentationMs: number): void { this.duckStartedAtMs = presentationMs; }

  reset(): void {
    this.stopVoices();
    this.nextStep = -1;
    this.clockOffsetSeconds = 0;
    this.duckStartedAtMs = -Infinity;
    this.lastBusTarget = NaN;
    this.wasPaused = false;
    this.wasSilent = true;
    this.bus.gain.setTargetAtTime(0, this.context.currentTime, .03);
  }

  silence(): void {
    if (this.disposed) return;
    this.bus.gain.setTargetAtTime(0, this.context.currentTime, .035);
    this.lastBusTarget = 0;
    this.releaseVoices(this.context.currentTime);
    this.wasSilent = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopVoices();
    for (const filter of Object.values(this.filters)) filter.disconnect();
    this.bus.disconnect();
  }

  private voiceCurrentChord(presentationMs: number, state: MusicState,
    startSeconds: number): void {
    const step = musicStepAt(presentationMs);
    const barStartStep = Math.floor(step / MUSIC_STEPS_PER_BAR) * MUSIC_STEPS_PER_BAR;
    const elapsedInBarSeconds = (presentationMs - barStartStep * MUSIC_STEP_MS) / 1000;
    const remaining = Math.max(.4, MUSIC_BAR_SECONDS - elapsedInBarSeconds + .32);
    for (const event of musicEventsForStep(this.seed, barStartStep, state)) {
      if (event.instrument === 'pad') this.schedule({ ...event, durationSeconds: remaining }, startSeconds);
    }
  }

  private duckFactor(presentationMs: number): number {
    const elapsed = presentationMs - this.duckStartedAtMs;
    if (elapsed < 0 || elapsed >= 2400) return 1;
    if (elapsed <= 1000) return .28;
    const progress = (elapsed - 1000) / 1400;
    return .28 + .72 * progress * progress * (3 - 2 * progress);
  }

  private schedule(event: MusicEvent, start: number): void {
    const voices = event.instrument === 'pad'
      ? [[1, 'triangle', .7], [1.004, 'sawtooth', .3]] as const
      : event.instrument === 'bass'
        ? [[1, 'sine', .65], [2, 'triangle', .35]] as const
        : [[1, 'triangle', 1]] as const;
    if (this.active.size + voices.length > MAX_MUSIC_VOICES) return;
    const end = start + event.durationSeconds;
    const attack = event.instrument === 'pad' ? .25
      : event.instrument === 'bass' ? .016 : .012;
    const release = event.instrument === 'pad' ? .48
      : event.instrument === 'bass' ? .28 : .2;
    for (const [ratio, wave, share] of voices) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(event.frequencyHz * ratio, start);
      const peak = event.peakGain * share;
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
      gain.gain.exponentialRampToValueAtTime(.001, end);
      oscillator.connect(gain);
      gain.connect(this.filters[event.instrument]);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.active.delete(oscillator);
      };
      this.active.set(oscillator, gain);
      oscillator.start(start);
      oscillator.stop(end);
    }
  }

  private releaseVoices(now: number): void {
    for (const [oscillator, gain] of this.active) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, .025);
      try { oscillator.stop(now + .12); } catch { /* already stopped */ }
    }
  }

  private stopVoices(): void {
    for (const [oscillator, gain] of this.active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.active.clear();
  }
}

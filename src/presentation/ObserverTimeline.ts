import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';

// Subtitle-only defaults; decoded Commander recordings determine their complete window.
export const missionIntroTiming = { atSeconds: .2, durationSeconds: 10.54,
  readinessWaitSeconds: 2.5, phraseAtSeconds: [0, 2.06, 6.14, 8.48] } as const;
export const victoryTiming = { atSeconds: 0, durationSeconds: 9.03,
  readinessWaitSeconds: 2.5, phraseAtSeconds: [0, 3.76, 5.56, 7.38] } as const;
// The approved 4.6-second clip outlasts landing; this never gates Tank combat.
export const tankIntroTiming = { atSeconds: .3, durationSeconds: 5 } as const;
export interface VictoryCommunicationCheckpoint {
  finished: boolean;
  offsetSeconds: number | null;
  durationSeconds: number;
  voiced: boolean;
}

/** Disposable presentation clock; never gates simulation or the Destroyer schedule. */
export class MissionObserverTimeline {
  private attempt: number | null = null;
  private previous = 0;
  private started: number | null = null;
  private voiced = false;
  private duration = 0;
  constructor(private readonly timing: { atSeconds: number; durationSeconds: number; readinessWaitSeconds: number }
    = missionIntroTiming) {}
  get active(): boolean { return this.attempt !== null; }
  reset(): void { this.attempt = null; this.started = null; this.voiced = false; this.duration = 0; }
  start(now: number): void { this.reset(); this.attempt = now; this.previous = now; }
  checkpoint(now: number) {
    return { offsetSeconds: this.started === null ? null : Math.max(0, now - this.started),
      durationSeconds: this.duration || this.timing.durationSeconds, voiced: this.voiced };
  }
  restore(checkpoint: Omit<VictoryCommunicationCheckpoint, 'finished'>, now: number): void {
    this.start(now);
    this.started = checkpoint.offsetSeconds === null ? null : now - checkpoint.offsetSeconds;
    this.duration = checkpoint.durationSeconds; this.voiced = checkpoint.voiced;
  }
  update(now: number, alive: boolean, paused: boolean, readiness: 'pending' | 'ready' | 'unavailable', portraitsPending = false,
    voiceDurationSeconds: number | null = null) {
    const hidden = { owns: false, visible: false, begin: false, end: false,
      offset: 0, duration: this.timing.durationSeconds, audible: false };
    if (this.attempt === null || !alive) { this.reset(); return hidden; }
    const discontinuity = now < this.previous - 1e-8 || now - this.previous > .3;
    this.previous = now;
    if (discontinuity) {
      // A restore may show remaining subtitles, but never starts/replays speech.
      this.started ??= this.attempt + this.timing.atSeconds;
      this.duration ||= this.timing.durationSeconds;
      this.voiced = false;
    }
    let begin = false;
    if (this.started === null) {
      const cue = this.attempt + this.timing.atSeconds;
      if (paused || now < cue || ((readiness === 'pending' || portraitsPending) && now < cue + this.timing.readinessWaitSeconds))
        return { ...hidden, owns: true };
      this.started = now; this.voiced = readiness === 'ready'; begin = true;
      this.duration = this.voiced && voiceDurationSeconds !== null ? voiceDurationSeconds + .35 : this.timing.durationSeconds;
    }
    const offset = now - this.started;
    const visible = offset >= 0 && offset < this.duration;
    const end = offset >= this.duration && !discontinuity;
    const audible = visible && this.voiced;
    const duration = this.duration;
    if (offset >= duration) this.reset();
    return { owns: true, visible, begin, end, offset, duration, audible };
  }
}

export class ObserverTimeline {
  private previous: number | null = null;
  private start: number | null = null;
  private audible = false;
  private active = false;
  private announcedStart: number | null = null;
  reset(): void { this.previous = null; this.start = null; this.audible = false; this.active = false; this.announcedStart = null; }
  update(state: DestroyerState | undefined, config: DestroyerSettings | undefined, now: number, alive: boolean) {
    return this.updateWindow(state?.startedAtSeconds ?? null, config?.radioAtSeconds ?? 0,
      config?.radioDurationSeconds ?? 0, now, alive && !!config && state?.status === 'active');
  }
  updateWindow(start: number | null, atSeconds: number, duration: number, now: number, alive: boolean) {
    const offset = start === null ? -1 : now - start - atSeconds;
    const visible = start !== null && alive && offset >= 0 && offset < duration;
    // Loading into a message displays the remaining subtitle, but never replays an awarded announcement.
    const discontinuity = this.previous === null || now < this.previous - 1e-8 || now - this.previous > .3
      || this.start !== start;
    const begin = visible && !this.active && !discontinuity && this.announcedStart !== start;
    const end = !visible && this.active && this.audible && !discontinuity && alive;
    if (discontinuity || !visible) this.audible = false;
    if (begin) this.audible = true;
    if (visible && (begin || discontinuity)) this.announcedStart = start;
    this.previous = now; this.start = start; this.active = visible;
    return { visible, begin, end, offset, audible: this.audible, duration };
  }
}

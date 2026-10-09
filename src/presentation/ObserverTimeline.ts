import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';

// Presentation only: a short lead-in for the beep/preload, then three readable phrases.
export const missionIntroTiming = { atSeconds: .2, durationSeconds: 6.2,
  readinessWaitSeconds: 2.5, phraseAtSeconds: [0, 1.5, 3.7] } as const;

/** Disposable presentation clock; never gates simulation or the Destroyer schedule. */
export class MissionObserverTimeline {
  private attempt: number | null = null;
  private previous = 0;
  private started: number | null = null;
  private voiced = false;
  get active(): boolean { return this.attempt !== null; }
  reset(): void { this.attempt = null; this.started = null; this.voiced = false; }
  start(now: number): void { this.reset(); if (now === 0) { this.attempt = now; this.previous = now; } }
  update(now: number, alive: boolean, paused: boolean, readiness: 'pending' | 'ready' | 'unavailable') {
    const hidden = { owns: false, visible: false, begin: false, end: false,
      offset: 0, duration: missionIntroTiming.durationSeconds, audible: false };
    if (this.attempt === null || !alive) { this.reset(); return hidden; }
    const discontinuity = now < this.previous - 1e-8 || now - this.previous > .3;
    this.previous = now;
    if (discontinuity) {
      // A restore may show remaining subtitles, but never starts/replays speech.
      this.started ??= this.attempt + missionIntroTiming.atSeconds;
      this.voiced = false;
    }
    let begin = false;
    if (this.started === null) {
      const cue = this.attempt + missionIntroTiming.atSeconds;
      if (paused || now < cue || (readiness === 'pending' && now < cue + missionIntroTiming.readinessWaitSeconds))
        return { ...hidden, owns: true };
      this.started = now; this.voiced = readiness === 'ready'; begin = true;
    }
    const offset = now - this.started;
    const visible = offset >= 0 && offset < missionIntroTiming.durationSeconds;
    const end = offset >= missionIntroTiming.durationSeconds && !discontinuity;
    const audible = visible && this.voiced;
    if (offset >= missionIntroTiming.durationSeconds) this.reset();
    return { owns: true, visible, begin, end, offset, duration: missionIntroTiming.durationSeconds, audible };
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

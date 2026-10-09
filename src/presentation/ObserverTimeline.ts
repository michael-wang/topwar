import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';

// Presentation only: a short lead-in for the beep/preload, then three readable phrases.
export const missionIntroTiming = { atSeconds: .2, durationSeconds: 6.2,
  phraseAtSeconds: [0, 1.5, 3.7] } as const;

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

import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';

export class ObserverTimeline {
  private previous: number | null = null;
  private start: number | null = null;
  private audible = false;
  private active = false;
  private announcedStart: number | null = null;
  reset(): void { this.previous = null; this.start = null; this.audible = false; this.active = false; this.announcedStart = null; }
  update(state: DestroyerState | undefined, config: DestroyerSettings | undefined, now: number, alive: boolean) {
    const age = state?.startedAtSeconds == null ? -1 : now - state.startedAtSeconds;
    const offset = config ? age - config.radioAtSeconds : -1;
    const visible = !!config && state?.status === 'active' && alive && offset >= 0 && offset < config.radioDurationSeconds;
    // Loading into a message displays the remaining subtitle, but never replays an awarded announcement.
    const discontinuity = this.previous === null || now < this.previous - 1e-8 || now - this.previous > .3
      || this.start !== (state?.startedAtSeconds ?? null);
    const begin = visible && !this.active && !discontinuity && this.announcedStart !== state!.startedAtSeconds;
    const end = !visible && this.active && this.audible && !discontinuity && alive;
    if (discontinuity || !visible) this.audible = false;
    if (begin) this.audible = true;
    if (visible && (begin || discontinuity)) this.announcedStart = state!.startedAtSeconds;
    this.previous = now; this.start = state?.startedAtSeconds ?? null; this.active = visible;
    return { visible, begin, end, offset, audible: this.audible,
      duration: config?.radioDurationSeconds ?? 0 };
  }
}

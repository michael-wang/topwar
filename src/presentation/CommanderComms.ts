import type { ObserverMessage } from '../ui/observerLocale';
import type { ObserverTimeline } from './ObserverTimeline';

type Frame = ReturnType<ObserverTimeline['updateWindow']>;
type Request = { message: ObserverMessage; frame: Frame };
const priority: Record<ObserverMessage, number> = { victory: 6, tankBoss: 5, airSupport: 4, destroyer: 3, giant: 2, missionIntro: 1 };
const hidden: Frame = { visible: false, begin: false, end: false, offset: 0, duration: 0, audible: false };

/** A small per-attempt radio queue. A recorded transmission always finishes first. */
export class CommanderComms {
  private seen = new Set<ObserverMessage>();
  private pending: Request[] = [];
  private current: Request | null = null;
  private currentAt: number | null = null;
  reset(): void { this.seen.clear(); this.pending = []; this.current = null; this.currentAt = null; }
  rebase(): void { this.currentAt = null; }
  finishBattle(): void { this.pending = []; if (this.current && !this.current.frame.audible) this.current = null; }
  get busy(): boolean { return this.current !== null || this.pending.length > 0; }
  update(requests: Request[], now: number, paused: boolean, alive = true): Request {
    if (this.current && this.currentAt === null) this.currentAt = now - this.current.frame.offset;
    if (!alive) { this.current = null; this.pending = []; return { message: 'missionIntro', frame: hidden }; }
    for (const request of requests) if (request.frame.visible && !this.seen.has(request.message)) {
      this.seen.add(request.message);
      // Queued live cues get their whole window; restores only show the remaining subtitle.
      this.pending.push({ message: request.message, frame: { ...request.frame,
        offset: request.frame.begin ? 0 : request.frame.offset } });
    }
    let end = false;
    const closing = this.current;
    if (this.current) {
      this.current.frame.offset = Math.max(0, now - this.currentAt!);
      if (this.current.frame.offset >= this.current.frame.duration) { end = this.current.frame.begin; this.current = null; }
      else if (!this.current.frame.audible && this.pending.some(r => priority[r.message] > priority[this.current!.message])) {
        end = this.current.frame.begin; this.current = null;
      }
    }
    let begin = false;
    if (!this.current && !paused && this.pending.length) {
      this.pending.sort((a, b) => priority[b.message] - priority[a.message]);
      this.current = this.pending.shift()!;
      this.currentAt = now - this.current.frame.offset;
      begin = this.current.frame.begin;
    }
    if (!this.current) return { message: closing?.message ?? 'missionIntro', frame: { ...hidden, duration: closing?.frame.duration ?? 0, end } };
    return { message: this.current.message, frame: { ...this.current.frame, begin, end } };
  }
}

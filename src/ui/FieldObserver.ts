import { ObserverPortraits, type PreparedObserverPortraits, type ObserverExpression } from './ObserverPortraits';
import { ObserverTimeline, MissionObserverTimeline, missionIntroTiming } from '../presentation/ObserverTimeline';
import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';
import { FIELD_OBSERVER_LOCALE, observerDialogue, observerMissionDialogue,
  type ObserverLocale, type ObserverMessage } from './observerLocale';

export interface ObserverAudio {
  prepareRadio(locale: ObserverLocale, message: ObserverMessage): 'pending' | 'ready' | 'unavailable';
  play(cue: 'radioOpen' | 'radioClose'): void;
  syncRadio(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds?: number,
    message?: ObserverMessage): void;
}
export class FieldObserver {
  readonly element = document.createElement('aside');
  private portrait = document.createElement('img');
  private presented = false;
  private attemptPortraits: Record<ObserverExpression, HTMLImageElement | null> = { neutral: null, alert: null };
  private readonly text = document.createElement('p');
  private readonly lamp = document.createElement('span');
  private readonly timeline = new ObserverTimeline();
  private readonly missionTimeline = new MissionObserverTimeline();
  private message: ObserverMessage = 'destroyer';
  private phrase = 0;
  private readonly locale = FIELD_OBSERVER_LOCALE;
  private expression = '';
  private frame = { offset: null as number | null, paused: false, duration: 0 };
  constructor(host: HTMLElement, private readonly audio: ObserverAudio,
    private readonly portraits: PreparedObserverPortraits = new ObserverPortraits()) {
    this.audio.prepareRadio(this.locale, 'missionIntro');
    this.element.className = 'field-observer'; this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    this.portrait.alt = ''; this.portrait.width = 110; this.portrait.height = 110;
    this.lamp.className = 'observer-radio-light'; this.lamp.setAttribute('aria-hidden', 'true');
    this.element.append(this.portrait, this.text, this.lamp);
    this.updateText(); host.append(this.element);
  }
  private updateText(): void {
    this.text.textContent = this.message === 'missionIntro'
      ? observerMissionDialogue[this.locale][this.phrase] : observerDialogue[this.locale];
    this.text.lang = this.locale;
  }
  startMission(now: number): void {
    this.reset();
    // Only an explicit fresh attempt can arm the intro. Restoring a snapshot is
    // never a new mission, and a completed intro stays retired after rewinds.
    this.missionTimeline.start(now);
  }
  update(state: DestroyerState | undefined, config: DestroyerSettings | undefined, now: number, alive: boolean, paused: boolean): void {
    if (state?.status === 'active') this.audio.prepareRadio(this.locale, 'destroyer');
    const navalFrame = this.timeline.update(state, config, now, alive);
    let frame = navalFrame;
    let message: ObserverMessage = 'destroyer';
    if (this.missionTimeline.active) {
      if (navalFrame.visible || !alive) this.missionTimeline.reset();
      else {
        const audioReady = this.audio.prepareRadio(this.locale, 'missionIntro');
        const intro = this.missionTimeline.update(now, alive, paused,
          this.portraits.readiness === 'pending' ? 'pending' : audioReady);
        if (intro.owns) { frame = intro; message = 'missionIntro'; }
      }
    }
    const phrase = message === 'missionIntro'
      ? missionIntroTiming.phraseAtSeconds.reduce<number>((index, at, i) => frame.offset >= at ? i : index, 0) : 0;
    if (message !== this.message || phrase !== this.phrase) {
      this.message = message; this.phrase = phrase; this.updateText();
    }
    if (frame.visible && !this.presented) {
      // Freeze this communication's available portraits. A timed-out/failed
      // download cannot pop in after its subtitles, radio cue or speech begin.
      this.attemptPortraits = { neutral: this.portraits.get('neutral'), alert: this.portraits.get('alert') };
      this.presented = true;
    }
    const canPresent = !!this.attemptPortraits.neutral;
    this.element.hidden = !frame.visible || !canPresent;
    if (frame.visible) {
      const expression = message === 'missionIntro' || frame.offset < .32 || frame.offset > frame.duration - .45 ? 'neutral' : 'alert';
      const prepared = this.attemptPortraits[expression];
      if (prepared && prepared !== this.portrait) { this.portrait.replaceWith(prepared); this.portrait = prepared; }
      this.expression = expression;
      const fade = Math.min(1, frame.offset / .18, (frame.duration - frame.offset) / .22);
      this.element.style.transform = `translateX(${(1 - fade) * -12}px)`;
      this.lamp.style.transform = `scale(${.8 + .2 * Math.sin(frame.offset * 12) ** 2})`;
    }
    if (frame.begin && canPresent) this.audio.play('radioOpen');
    if (frame.end && canPresent) this.audio.play('radioClose');
    this.frame = { offset: frame.audible && canPresent ? frame.offset : null, paused, duration: frame.duration };
    this.audio.syncRadio(this.locale, this.frame.offset, paused, this.frame.duration, message);
    if (!frame.visible) this.presented = false;
  }
  reset(): void {
    this.timeline.reset(); this.missionTimeline.reset();
    this.presented = false;
    this.element.hidden = true; this.frame.offset = null; this.audio.syncRadio(this.locale, null, false);
  }
  dispose(): void { this.reset(); this.element.remove(); if (this.portraits instanceof ObserverPortraits) this.portraits.dispose(); }
}

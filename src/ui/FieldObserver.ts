import { ObserverPortraits, type PreparedObserverPortraits, type ObserverExpression } from './ObserverPortraits';
import { observerEmblem } from './observerEmblem';
import { ObserverTimeline, MissionObserverTimeline, missionIntroTiming, tankIntroTiming, victoryTiming } from '../presentation/ObserverTimeline';
import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';
import type { DefenseTankState } from '../simulation/defenseTank';
import { FIELD_OBSERVER_LOCALE, observerDialogue, observerMissionDialogue, observerTankDialogue, observerVictoryDialogue,
  type ObserverLocale, type ObserverMessage } from './observerLocale';

export interface ObserverAudio {
  prepareRadio(locale: ObserverLocale, message: ObserverMessage): 'pending' | 'ready' | 'unavailable';
  radioDurationSeconds?(locale: ObserverLocale, message: ObserverMessage): number | null;
  play(cue: 'radioOpen' | 'radioClose'): void;
  syncRadio(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds?: number,
    message?: ObserverMessage): void;
}
export class FieldObserver {
  readonly element = document.createElement('aside');
  private readonly fallback = document.createElement('div');
  private portrait: HTMLElement = this.fallback;
  private presented = false;
  private attemptPortraits: Record<ObserverExpression, HTMLImageElement | null> = { neutral: null, alert: null, victory: null };
  private readonly skip = document.createElement('button');
  private readonly victoryTimeline = new MissionObserverTimeline(victoryTiming);
  private victoryStarted = false;
  private victoryFinished = false;
  private readonly text = document.createElement('p');
  private readonly lamp = document.createElement('span');
  private readonly timeline = new ObserverTimeline();
  private readonly tankTimeline = new ObserverTimeline();
  private readonly missionTimeline = new MissionObserverTimeline();
  private message: ObserverMessage = 'destroyer';
  private phrase = 0;
  private readonly locale = FIELD_OBSERVER_LOCALE;
  private expression = '';
  private tankVoiceStartedAtSeconds: number | null = null;
  private frame = { offset: null as number | null, paused: false, duration: 0 };
  constructor(host: HTMLElement, private readonly audio: ObserverAudio,
    private readonly portraits: PreparedObserverPortraits = new ObserverPortraits()) {
    this.audio.prepareRadio(this.locale, 'missionIntro');
    this.audio.prepareRadio(this.locale, 'tankBoss');
    this.audio.prepareRadio(this.locale, 'victory');
    this.element.className = 'field-observer'; this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-label', '海防指揮官通訊');
    this.fallback.className = 'observer-fallback'; this.fallback.setAttribute('aria-hidden', 'true');
    this.fallback.innerHTML = observerEmblem;
    this.lamp.className = 'observer-radio-light'; this.lamp.setAttribute('aria-hidden', 'true');
    this.skip.className = 'commander-skip'; this.skip.textContent = '略過'; this.skip.hidden = true;
    this.skip.setAttribute('type', 'button');
    this.skip.onclick = () => {
      if (!this.victoryStarted || this.victoryFinished || this.frame.paused) return;
      this.victoryFinished = true; this.victoryTimeline.reset(); this.element.hidden = true;
      this.audio.play('radioClose');
      this.audio.syncRadio(this.locale, null, false);
    };
    this.element.append(this.portrait, this.text, this.lamp, this.skip);
    this.updateText(); host.append(this.element);
  }
  private updateText(): void {
    this.text.textContent = this.message === 'missionIntro'
      ? observerMissionDialogue[this.locale][this.phrase] : this.message === 'victory'
        ? observerVictoryDialogue[this.locale][this.phrase] : this.message === 'tankBoss'
        ? observerTankDialogue[this.locale] : observerDialogue[this.locale];
    this.text.lang = this.locale;
  }
  startMission(now: number): void {
    this.reset();
    // Only an explicit fresh attempt can arm the intro. Restoring a snapshot is
    // never a new mission, and a completed intro stays retired after rewinds.
    if (now === 0) this.missionTimeline.start(now);
  }
  update(state: DestroyerState | undefined, config: DestroyerSettings | undefined, now: number, alive: boolean, paused: boolean,
    tank?: Readonly<DefenseTankState>): void {
    if (state?.status === 'active') this.audio.prepareRadio(this.locale, 'destroyer');
    const navalFrame = this.timeline.update(state, config, now, alive);
    let frame = navalFrame;
    let message: ObserverMessage = 'destroyer';
    if (this.missionTimeline.active) {
      if (navalFrame.visible || !alive) this.missionTimeline.reset();
      else {
        const audioReady = this.audio.prepareRadio(this.locale, 'missionIntro');
        const intro = this.missionTimeline.update(now, alive, paused, audioReady,
          this.portraits.readiness === 'pending', this.audio.radioDurationSeconds?.(this.locale, 'missionIntro') ?? null);
        if (intro.owns) { frame = intro; message = 'missionIntro'; }
      }
    }
    const tankFrame = this.tankTimeline.updateWindow(tank?.startedAtSeconds ?? null, tankIntroTiming.atSeconds,
      tankIntroTiming.durationSeconds, now, alive && !!tank && tank.status !== 'defeated');
    if (tankFrame.begin) this.tankVoiceStartedAtSeconds = now;
    if (tankFrame.visible || tankFrame.end) { frame = tankFrame; message = 'tankBoss'; }
    this.present(frame, message, now, paused);
  }
  /** Called only after the Tank finale, on the pause-aware presentation clock. */
  updateVictory(now: number, paused: boolean): boolean {
    if (this.victoryFinished) return true;
    if (!this.victoryStarted) { this.reset(); this.victoryStarted = true; this.victoryTimeline.start(now); }
    const frame = this.victoryTimeline.update(now, true, paused, this.audio.prepareRadio(this.locale, 'victory'),
      this.portraits.readiness === 'pending', this.audio.radioDurationSeconds?.(this.locale, 'victory') ?? null);
    this.present(frame, 'victory', now, paused);
    this.victoryFinished = !this.victoryTimeline.active;
    return this.victoryFinished;
  }
  private present(frame: ReturnType<ObserverTimeline['updateWindow']>, message: ObserverMessage, now: number, paused: boolean): void {
    const timing = message === 'victory' ? victoryTiming : missionIntroTiming;
    const phrase = message === 'missionIntro' || message === 'victory'
      ? timing.phraseAtSeconds.reduce<number>((index, at, i) => frame.offset >= at * frame.duration / timing.durationSeconds ? i : index, 0) : 0;
    if (message !== this.message) this.presented = false;
    if (message !== this.message || phrase !== this.phrase) {
      this.message = message; this.phrase = phrase; this.updateText();
    }
    if (frame.visible && !this.presented) {
      // Freeze this communication's available portraits. A timed-out/failed
      // download cannot pop in after its subtitles, radio cue or speech begin.
      this.attemptPortraits = { neutral: this.portraits.get('neutral'), alert: this.portraits.get('alert'), victory: this.portraits.get('victory') };
      this.presented = true;
    }
    this.element.hidden = !frame.visible;
    this.skip.hidden = message !== 'victory' || !frame.visible; this.skip.disabled = paused;
    if (frame.visible) {
      const expression = message === 'victory' ? 'victory' : message === 'tankBoss' ? 'alert'
        : message === 'missionIntro' || frame.offset < .32 || frame.offset > frame.duration - .45 ? 'neutral' : 'alert';
      const prepared = this.attemptPortraits[expression] ?? this.fallback;
      if (prepared !== this.portrait) { this.portrait.replaceWith(prepared); this.portrait = prepared; }
      this.expression = expression;
      const fade = Math.min(1, frame.offset / .18, (frame.duration - frame.offset) / .22);
      this.element.style.transform = `translateX(${(1 - fade) * -12}px)`;
      this.lamp.style.transform = `scale(${.8 + .2 * Math.sin(frame.offset * 12) ** 2})`;
    }
    if (frame.begin && !paused) this.audio.play('radioOpen');
    if (frame.end && !paused) this.audio.play('radioClose');
    // Begin at the first rendered cue, preserving the opening syllable if a frame crosses +0.3s.
    const voiceOffset = message === 'tankBoss' && this.tankVoiceStartedAtSeconds !== null
      ? now - this.tankVoiceStartedAtSeconds : frame.offset;
    this.frame = { offset: frame.audible ? voiceOffset : null, paused, duration: frame.duration };
    this.audio.syncRadio(this.locale, this.frame.offset, paused, this.frame.duration, message);
    if (!frame.visible) this.presented = false;
  }
  reset(): void {
    this.timeline.reset(); this.tankTimeline.reset(); this.missionTimeline.reset();
    this.victoryTimeline.reset(); this.victoryStarted = false; this.victoryFinished = false; this.skip.hidden = true;
    this.tankVoiceStartedAtSeconds = null;
    this.presented = false;
    this.element.hidden = true; this.frame.offset = null; this.audio.syncRadio(this.locale, null, false);
  }
  dispose(): void { this.reset(); this.element.remove(); if (this.portraits instanceof ObserverPortraits) this.portraits.dispose(); }
}

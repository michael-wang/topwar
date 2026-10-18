import { CommanderComms } from '../presentation/CommanderComms';
import type { SimulationFrameState } from '../simulation/SimulationState';
import { ObserverPortraits, type PreparedObserverPortraits, type ObserverExpression } from './ObserverPortraits';
import { observerEmblem } from './observerEmblem';
import { ObserverTimeline, MissionObserverTimeline, missionIntroTiming, tankIntroTiming, victoryTiming, type VictoryCommunicationCheckpoint } from '../presentation/ObserverTimeline';
import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';
import type { DefenseTankState } from '../simulation/defenseTank';
import type { CommanderSupportConfig } from '../simulation/commanderSupport';
import { airSupportTiming, observerAirSupportDialogue } from './observerLocale';
import { FIELD_OBSERVER_LOCALE, observerDialogue, observerMissionDialogue, observerTankDialogue, observerVictoryDialogue, observerSupportDialogue,
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
  private victoryPresented = false;
  get victoryPresentationStarted(): boolean { return this.victoryPresented; }
  private readonly text = document.createElement('p');
  private readonly lamp = document.createElement('span');
  private readonly timeline = new ObserverTimeline();
  private readonly comms = new CommanderComms();
  private observedSupport = false;
  private giantAt: number | null = null;
  private airAt: number | null = null;
  private manualNoticePresented = false;
  private manualNoticeElapsed = false;
  get supportNoticeStarted(): boolean { return this.manualNoticePresented; }
  get supportNoticeComplete(): boolean { return this.manualNoticeElapsed || this.comms.hasCompleted('airSupportReady'); }
  private finaleClock = false;
  private readonly tankTimeline = new ObserverTimeline();
  private readonly missionTimeline = new MissionObserverTimeline();
  private message: ObserverMessage = 'destroyer';
  private phrase = 0;
  private readonly locale = FIELD_OBSERVER_LOCALE;
  private expression = '';
  private frame = { offset: null as number | null, paused: false, duration: 0 };
  constructor(host: HTMLElement, private readonly audio: ObserverAudio,
    private readonly portraits: PreparedObserverPortraits = new ObserverPortraits()) {
    this.audio.prepareRadio(this.locale, 'missionIntro');
    this.audio.prepareRadio(this.locale, 'tankBoss');
    this.audio.prepareRadio(this.locale, 'victory');
    this.audio.prepareRadio(this.locale, 'airSupport');
    this.element.className = 'field-observer'; this.element.hidden = true;
    // Reversible placement trial only; production retains the authored upper slot.
    if (import.meta.env.DEV) {
      const placement = new URLSearchParams(window.location?.search).get('commander-placement');
      const height = placement === 'a' ? 64 : placement === 'a1' ? 58 : placement === 'a2' ? 56 : null;
      if (height !== null) {
        this.element.style.left = 'max(12px, calc(50% - 155px))';
        // Retain A's inset compensation so only the requested percentage differs.
        this.element.style.top = `calc(${height}% + var(--hud-inset-top, 0px) * .36 - var(--hud-inset-bottom, 0px) * .64)`;
      }
    }
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
    this.text.textContent = this.message === 'airSupport' || this.message === 'airSupportReady' || this.message === 'airSupportCalled'
      ? observerAirSupportDialogue[this.locale][this.phrase] : this.message === 'giant'
      ? observerSupportDialogue[this.message][this.locale] : this.message === 'missionIntro'
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
    tank?: Readonly<DefenseTankState>, support?: SimulationFrameState['commanderSupport'], supportConfig?: CommanderSupportConfig): void {
    const requests: Parameters<CommanderComms['update']>[0] = [];
    if (state?.status === 'active') this.audio.prepareRadio(this.locale, 'destroyer');
    const navalFrame = this.timeline.update(state, config, now, alive);
    let message: ObserverMessage = 'destroyer';
    if (this.missionTimeline.active) {
      if (!alive) this.missionTimeline.reset();
      else {
        const audioReady = this.audio.prepareRadio(this.locale, 'missionIntro');
        const intro = this.missionTimeline.update(now, alive, paused, audioReady,
          this.portraits.readiness === 'pending', this.audio.radioDurationSeconds?.(this.locale, 'missionIntro') ?? null);
        if (intro.owns) { message = 'missionIntro'; requests.push({ frame: intro, message }); }
      }
    }
    const tankFrame = this.tankTimeline.updateWindow(tank?.startedAtSeconds ?? null, tankIntroTiming.atSeconds,
      tankIntroTiming.durationSeconds, now, alive && !!tank && tank.status !== 'defeated');

    requests.push({ frame: navalFrame, message: 'destroyer' }, { frame: tankFrame, message: 'tankBoss' });
    const giantAt = support?.giantAtSeconds ?? null, airAt = support?.airstrike?.triggeredAtSeconds ?? null;
    const notice = { visible: true, begin: true, end: false, offset: 0, duration: 3.8, audible: false };
    const manual = support?.airstrike?.manual;
    const manualPolicy = supportConfig?.heavyRaid?.lastStand?.triggerPolicy === 'manualPlayerCall';
    if (alive && manualPolicy && manual && support?.airstrike?.status === 'ready' && !manual.ready) {
      const offset = manual.announcementAtSeconds === null ? 0 : Math.max(0, now - manual.announcementAtSeconds);
      if (offset >= airSupportTiming.phraseAtSeconds) {
        this.manualNoticePresented = this.manualNoticeElapsed = true;
      } else requests.push({ message: 'airSupportReady', frame: { ...notice, begin: this.observedSupport,
        offset, duration: airSupportTiming.phraseAtSeconds, audible: true } });
    }
    if (this.observedSupport && alive) {
      if (giantAt !== null && giantAt !== this.giantAt) requests.push({ frame: notice, message: 'giant' });
    }
    if (alive && airAt !== null && support?.airstrike?.status !== 'cancelled'
      && (this.observedSupport ? airAt !== this.airAt : !!supportConfig?.heavyRaid && now - airAt
        < (manualPolicy ? airSupportTiming.durationSeconds - airSupportTiming.phraseAtSeconds : airSupportTiming.durationSeconds))) {
      const modern = !!supportConfig?.heavyRaid;
      requests.push({ frame: { ...notice, begin: this.observedSupport, offset: Math.max(0, now - airAt),
        duration: manualPolicy ? airSupportTiming.durationSeconds - airSupportTiming.phraseAtSeconds : modern ? airSupportTiming.durationSeconds : 3.8,
        audible: modern }, message: manualPolicy ? 'airSupportCalled' : 'airSupport' });
    }
    this.observedSupport = true; this.giantAt = giantAt; this.airAt = airAt;
    const selected = this.comms.update(requests, now, paused, alive);
    this.present(selected.frame, selected.message, now, paused);
  }
  finishCombat(now: number, paused: boolean): void {
    if (!this.finaleClock) { this.comms.finishBattle(); this.comms.rebase(); this.finaleClock = true; }
    const selected = this.comms.update([], now, paused);
    this.present(selected.frame, selected.message, now, paused);
  }
  /** Called only after the Tank finale, on the pause-aware presentation clock. */
  victoryCheckpoint(now: number): VictoryCommunicationCheckpoint | undefined {
    return this.victoryStarted ? { ...this.victoryTimeline.checkpoint(now), finished: this.victoryFinished } : undefined;
  }
  restoreVictory(checkpoint: VictoryCommunicationCheckpoint, now: number): void {
    this.reset(); this.victoryStarted = true; this.victoryFinished = checkpoint.finished; this.finaleClock = true;
    this.victoryPresented = checkpoint.finished || checkpoint.offsetSeconds !== null;
    if (!checkpoint.finished) this.victoryTimeline.restore(checkpoint, now);
  }
  updateVictory(now: number, paused: boolean): boolean {
    if (this.victoryFinished) return true;
    if (!this.finaleClock) { this.comms.finishBattle(); this.comms.rebase(); this.finaleClock = true; }
    if (!this.victoryStarted && this.comms.busy) { this.finishCombat(now, paused); return false; }
    if (!this.victoryStarted) { this.victoryStarted = true; this.victoryTimeline.start(now); }
    const frame = this.victoryTimeline.update(now, true, paused, this.audio.prepareRadio(this.locale, 'victory'),
      this.portraits.readiness === 'pending', this.audio.radioDurationSeconds?.(this.locale, 'victory') ?? null);
    this.present(frame, 'victory', now, paused);
    this.victoryFinished = !this.victoryTimeline.active;
    return this.victoryFinished;
  }
  private present(frame: ReturnType<ObserverTimeline['updateWindow']>, message: ObserverMessage, _now: number, paused: boolean): void {
    if (message === 'victory' && frame.visible) this.victoryPresented = true;
    if (message === 'airSupportReady' && frame.visible) this.manualNoticePresented = true;
    const timing = message === 'victory' ? victoryTiming : missionIntroTiming;
    const phrase = message === 'airSupportCalled' ? 1 : message === 'airSupport' ? Number(frame.offset >= airSupportTiming.phraseAtSeconds) : message === 'missionIntro' || message === 'victory'
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
      const expression = message === 'victory' ? 'victory' : message === 'tankBoss' || message === 'giant' || message.startsWith('airSupport') ? 'alert'
        : message === 'missionIntro' || frame.offset < .32 || frame.offset > frame.duration - .45 ? 'neutral' : 'alert';
      const prepared = this.attemptPortraits[expression] ?? this.fallback;
      if (prepared !== this.portrait) { this.portrait.replaceWith(prepared); this.portrait = prepared; }
      this.expression = expression;
      const fade = Math.min(1, frame.offset / .18, (frame.duration - frame.offset) / .22);
      this.element.style.transform = `translateX(${(1 - fade) * -12}px)`;
      this.lamp.style.transform = `scale(${.8 + .2 * Math.sin(frame.offset * 12) ** 2})`;
    }
    if (frame.end && !paused) this.audio.play('radioClose');
    if (frame.begin && !paused) this.audio.play('radioOpen');
    // Begin at the first rendered cue, preserving the opening syllable if a frame crosses +0.3s.
    const voiceOffset = frame.offset;
    this.frame = { offset: frame.audible ? voiceOffset : null, paused, duration: frame.duration };
    this.audio.syncRadio(this.locale, this.frame.offset, paused, this.frame.duration, message);
    if (!frame.visible) this.presented = false;
  }
  reset(): void {
    this.timeline.reset(); this.tankTimeline.reset(); this.missionTimeline.reset();
    this.victoryTimeline.reset(); this.victoryStarted = false; this.victoryFinished = false; this.skip.hidden = true;
    this.victoryPresented = false;
    this.comms.reset(); this.observedSupport = false; this.giantAt = this.airAt = null; this.finaleClock = false;
    this.manualNoticePresented = this.manualNoticeElapsed = false;
    this.presented = false;
    this.element.hidden = true; this.frame.offset = null; this.audio.syncRadio(this.locale, null, false);
  }
  dispose(): void { this.reset(); this.element.remove(); if (this.portraits instanceof ObserverPortraits) this.portraits.dispose(); }
}

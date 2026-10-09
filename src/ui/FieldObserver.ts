import { publicAssetUrl } from '../core/publicAssetUrl';
import { ObserverTimeline, MissionObserverTimeline, missionIntroTiming } from '../presentation/ObserverTimeline';
import type { DestroyerState } from '../simulation/destroyer';
import type { DestroyerSettings } from '../config/destroyerConfig';
import { loadObserverLocale, saveObserverLocale, observerDialogue, observerMissionDialogue,
  type ObserverLocale, type ObserverMessage } from './observerLocale';

export interface ObserverAudio {
  prepareRadio(locale: ObserverLocale, message: ObserverMessage): 'pending' | 'ready' | 'unavailable';
  play(cue: 'radioOpen' | 'radioClose'): void;
  syncRadio(locale: ObserverLocale, offset: number | null, paused: boolean, windowSeconds?: number,
    message?: ObserverMessage): void;
}
export class FieldObserver {
  readonly element = document.createElement('aside');
  readonly selector = document.createElement('div');
  private readonly portrait = document.createElement('img');
  private readonly text = document.createElement('p');
  private readonly lamp = document.createElement('span');
  private readonly timeline = new ObserverTimeline();
  private readonly missionTimeline = new MissionObserverTimeline();
  private message: ObserverMessage = 'destroyer';
  private phrase = 0;
  private readonly buttons: HTMLButtonElement[] = [];
  private locale: ObserverLocale;
  private expression = '';
  private frame = { offset: null as number | null, paused: false, duration: 0 };
  private storage: Storage | undefined;
  constructor(host: HTMLElement, private readonly audio: ObserverAudio) {
    try { this.storage = window.localStorage; } catch { /* Browser may deny storage access itself. */ }
    this.locale = loadObserverLocale(navigator.languages, this.storage);
    this.audio.prepareRadio(this.locale, 'missionIntro');
    this.element.className = 'field-observer'; this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    this.portrait.alt = ''; this.portrait.width = 72; this.portrait.height = 82;
    this.lamp.className = 'observer-radio-light'; this.lamp.setAttribute('aria-hidden', 'true');
    this.element.append(this.portrait, this.text, this.lamp);
    this.selector.className = 'observer-languages'; this.selector.setAttribute('aria-label', 'Radio language');
    this.selector.addEventListener('pointerdown', event => event.stopPropagation());
    for (const locale of ['zh-TW', 'en'] as const) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = locale === 'zh-TW' ? '繁中' : 'EN'; button.lang = locale;
      button.addEventListener('click', () => {
        this.locale = locale; saveObserverLocale(locale, this.storage); this.updateText();
        this.audio.prepareRadio(this.locale, this.element.hidden ? 'missionIntro' : this.message);
        this.audio.syncRadio(this.locale, this.frame.offset, this.frame.paused, this.frame.duration, this.message);
        button.blur(); // Return keyboard lane/Q input to combat, as the DEV selector does.
      });
      this.buttons.push(button); this.selector.append(button);
    }
    this.updateText(); host.append(this.element, this.selector);
  }
  private updateText(): void {
    this.text.textContent = this.message === 'missionIntro'
      ? observerMissionDialogue[this.locale][this.phrase] : observerDialogue[this.locale];
    this.text.lang = this.locale;
    this.buttons.forEach(button => button.setAttribute('aria-pressed', String(button.lang === this.locale)));
  }
  startMission(now: number): void {
    this.reset();
    // Only an explicit fresh attempt can arm the intro. Restoring a snapshot is
    // never a new mission, and a completed intro stays retired after rewinds.
    this.missionTimeline.start(now);
  }
  update(state: DestroyerState | undefined, config: DestroyerSettings | undefined, now: number, alive: boolean, paused: boolean): void {
    const navalFrame = this.timeline.update(state, config, now, alive);
    let frame = navalFrame;
    let message: ObserverMessage = 'destroyer';
    if (this.missionTimeline.active) {
      if (navalFrame.visible || !alive) this.missionTimeline.reset();
      else {
        const intro = this.missionTimeline.update(now, alive, paused, this.audio.prepareRadio(this.locale, 'missionIntro'));
        if (intro.owns) { frame = intro; message = 'missionIntro'; }
      }
    }
    const phrase = message === 'missionIntro'
      ? missionIntroTiming.phraseAtSeconds.reduce<number>((index, at, i) => frame.offset >= at ? i : index, 0) : 0;
    if (message !== this.message || phrase !== this.phrase) {
      this.message = message; this.phrase = phrase; this.updateText();
    }
    this.element.hidden = !frame.visible;
    if (frame.visible) {
      const expression = message === 'missionIntro' || frame.offset < .32 || frame.offset > frame.duration - .45 ? 'neutral' : 'alert';
      if (expression !== this.expression) { this.expression = expression; this.portrait.src = publicAssetUrl(`art/observer/${expression}.webp`); }
      const fade = Math.min(1, frame.offset / .18, (frame.duration - frame.offset) / .22);
      this.element.style.transform = `translateX(${(1 - fade) * -12}px)`;
      this.lamp.style.transform = `scale(${.8 + .2 * Math.sin(frame.offset * 12) ** 2})`;
    }
    if (frame.begin) this.audio.play('radioOpen');
    if (frame.end) this.audio.play('radioClose');
    this.frame = { offset: frame.audible ? frame.offset : null, paused, duration: frame.duration };
    this.audio.syncRadio(this.locale, this.frame.offset, paused, this.frame.duration, message);
  }
  reset(): void {
    this.timeline.reset(); this.missionTimeline.reset();
    this.element.hidden = true; this.frame.offset = null; this.audio.syncRadio(this.locale, null, false);
  }
  dispose(): void { this.reset(); this.element.remove(); this.selector.remove(); }
}

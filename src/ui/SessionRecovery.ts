export class SessionRecovery {
  private readonly element: HTMLElement;
  private decided = false;
  private armed: EventTarget | null = null;
  private armedKey: EventTarget | null = null;
  private readonly heldPointers = new Set<number>();
  private readonly heldKeys = new Set<string>();
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private ready: boolean;
  get blocking(): boolean { return !this.disposed; }
  private readonly previousFocus = document.activeElement as HTMLElement | null;

  static loading(host: HTMLElement): HTMLElement {
    host.inert = true; host.setAttribute('data-recovery-pending', '');
    let cover = document.getElementById('session-recovery-loading');
    if (!cover) {
      cover = document.createElement('div'); cover.id = 'session-recovery-loading';
      cover.textContent = '正在載入上次進度…'; host.parentElement!.append(cover);
    }
    cover.className = 'session-recovery'; cover.lang = 'zh-Hant';
    cover.setAttribute('role', 'dialog'); cover.setAttribute('aria-modal', 'true');
    cover.setAttribute('aria-label', '遊戲進度'); cover.setAttribute('aria-busy', 'true');
    return cover;
  }
  static clearLoading(host: HTMLElement): void {
    document.dispatchEvent(new Event('topwar:boot-ready'));
    document.getElementById('session-recovery-loading')?.remove();
    host.inert = false; host.removeAttribute('data-recovery-pending');
  }
  constructor(private readonly host: HTMLElement, valid: boolean, choose: (continueGame: boolean) => void,
    waitForInitialization = false) {
    this.ready = !waitForInitialization;
    this.element = SessionRecovery.loading(host);
    document.dispatchEvent(new Event('topwar:boot-ready'));
    this.element.removeAttribute('style'); this.element.replaceChildren();
    this.element.setAttribute('aria-busy', 'false');
    const card = document.createElement('div'), title = document.createElement('strong');
    title.textContent = valid ? '已保留上次遊戲進度' : '無法讀取上次進度'; card.append(title);
    for (const resume of valid ? [true, false] : [false]) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = resume ? '繼續上次遊戲' : '重新開始';
      button.addEventListener('pointerdown', () => { this.armed = button; });
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.decided || (event.detail > 0 && this.armed !== button)) return;
        this.decided = true;
        this.element.setAttribute('aria-busy', 'true');
        for (const b of Array.from(card.querySelectorAll('button'))) b.disabled = true;
        if (waitForInitialization) this.element.textContent = resume ? '正在恢復遊戲…' : '正在開始遊戲…';
        try { choose(resume); } finally { this.finishWhenQuiet(); }
      }); card.append(button);
    }
    this.element.append(card); document.addEventListener('keydown', this.guardKeyboard, true);
    document.addEventListener('keyup', this.guardKeyUp, true);
    document.addEventListener('pointerdown', this.guardPointer, true);
    document.addEventListener('pointerup', this.guardPointer, true);
    document.addEventListener('pointercancel', this.guardPointer, true);
    document.addEventListener('click', this.guardRepeat, true);
    window.addEventListener('blur', this.clearHeld);
    document.addEventListener('visibilitychange', this.hidden);
    document.addEventListener('freeze', this.clearHeld);
    card.querySelector('button')?.focus();
  }
  private readonly guardKeyboard = (event: KeyboardEvent): void => {
    this.heldKeys.add(event.code);
    if (this.decided) { event.preventDefault(); event.stopImmediatePropagation(); this.finishWhenQuiet(); return; }
    if (!this.element.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    event.stopPropagation();
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) this.armedKey = event.target;
    if (event.key === 'Tab') {
      event.preventDefault(); const buttons = Array.from(this.element.querySelectorAll('button'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    }
  };
  private readonly guardKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
    if (this.decided) { event.preventDefault(); event.stopImmediatePropagation(); this.finishWhenQuiet(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      if (this.armedKey !== event.target) event.preventDefault();
      this.armedKey = null;
    }
    event.stopPropagation();
  };
  private readonly guardPointer = (event: PointerEvent): void => {
    if (event.type === 'pointerdown') this.heldPointers.add(event.pointerId);
    else this.heldPointers.delete(event.pointerId);
    if (this.decided) { event.preventDefault(); event.stopImmediatePropagation(); this.finishWhenQuiet(); }
  };
  private readonly guardRepeat = (event: MouseEvent): void => {
    if (this.decided) { event.preventDefault(); event.stopImmediatePropagation(); this.finishWhenQuiet(); }
  };
  private finishWhenQuiet(): void {
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    // Keep the inert surface through repeat taps/held inputs; never pass them to Start/Resume.
    if (this.ready && !this.heldPointers.size && !this.heldKeys.size && !this.disposed)
      this.releaseTimer = setTimeout(() => this.dispose(), 350);
  }
  initializationReady(): void { this.ready = true; if (this.decided) this.finishWhenQuiet(); }
  private readonly clearHeld = (): void => {
    this.armed = null; this.armedKey = null;
    this.heldPointers.clear(); this.heldKeys.clear(); if (this.decided) this.finishWhenQuiet();
  };
  private readonly hidden = (): void => { if (document.visibilityState === 'hidden') this.clearHeld(); };
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    document.removeEventListener('keydown', this.guardKeyboard, true);
    document.removeEventListener('keyup', this.guardKeyUp, true);
    document.removeEventListener('pointerdown', this.guardPointer, true);
    document.removeEventListener('pointerup', this.guardPointer, true);
    document.removeEventListener('pointercancel', this.guardPointer, true);
    document.removeEventListener('click', this.guardRepeat, true);
    window.removeEventListener('blur', this.clearHeld);
    document.removeEventListener('visibilitychange', this.hidden);
    document.removeEventListener('freeze', this.clearHeld);
    SessionRecovery.clearLoading(this.host); this.previousFocus?.focus?.();
  }
}

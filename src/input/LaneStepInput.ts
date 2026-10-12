const HOLD_INITIAL_DELAY_MS = 180;
const HOLD_REPEAT_INTERVAL_MS = 120;
type Direction = -1 | 1;
type Hold = { kind: 'key'; key: string; direction: Direction }
  | { kind: 'pointer'; id: number; button: HTMLButtonElement; direction: Direction };
type PointerHold = Extract<Hold, { kind: 'pointer' }>;

// One repeat clock, with each captured finger retaining its own press order.
export class LaneStepInput {
  private readonly heldKeys = new Set<string>();
  private readonly heldPointers = new Map<number, PointerHold>();
  private listening = false;
  private hold: Hold | null = null;
  private repeatTimer: ReturnType<typeof setTimeout> | null = null;

  // onStep applies the move and reports whether another step in that direction is possible.
  constructor(private readonly viewport: HTMLElement, private readonly keys: Window,
    private readonly onStep: (direction: Direction) => boolean,
    private readonly buttons: readonly [HTMLButtonElement, HTMLButtonElement]) {
    for (const button of buttons) {
      button.disabled = true;
      for (const type of ['contextmenu', 'selectstart', 'dragstart']) button.addEventListener(type, this.nativeGesture);
      for (const type of ['touchstart', 'touchmove']) button.addEventListener(type, this.touchDefault, { passive: false });
      // Pointercancel identifies the canceled finger; touchcancel has no pointerId.
      button.addEventListener('touchcancel', this.nativeGesture, { passive: false });
      button.addEventListener('click', this.click);
    }
  }
  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.keys.addEventListener('keydown', this.keyDown);
    this.keys.addEventListener('keyup', this.keyUp);
    this.keys.addEventListener('blur', this.clear);
    this.keys.addEventListener('focusin', this.focusChanged);
    this.viewport.ownerDocument?.addEventListener('visibilitychange', this.visibilityChanged);
    for (const button of this.buttons) {
      button.disabled = false;
      button.addEventListener('pointerdown', this.down);
      button.addEventListener('pointerup', this.endPointer);
      button.addEventListener('pointercancel', this.endPointer);
      button.addEventListener('lostpointercapture', this.endPointer);
    }
  }
  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    this.keys.removeEventListener('keydown', this.keyDown);
    this.keys.removeEventListener('keyup', this.keyUp);
    this.keys.removeEventListener('blur', this.clear);
    this.keys.removeEventListener('focusin', this.focusChanged);
    this.viewport.ownerDocument?.removeEventListener('visibilitychange', this.visibilityChanged);
    this.clear();
    for (const button of this.buttons) {
      button.disabled = true;
      button.removeEventListener('pointerdown', this.down);
      button.removeEventListener('pointerup', this.endPointer);
      button.removeEventListener('pointercancel', this.endPointer);
      button.removeEventListener('lostpointercapture', this.endPointer);
    }
  }
  dispose(): void {
    this.stop();
    for (const button of this.buttons) {
      for (const type of ['contextmenu', 'selectstart', 'dragstart']) button.removeEventListener(type, this.nativeGesture);
      for (const type of ['touchstart', 'touchmove']) button.removeEventListener(type, this.touchDefault);
      button.removeEventListener('touchcancel', this.nativeGesture);
      button.removeEventListener('click', this.click);
    }
  }
  private interactive(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return Boolean(element?.isContentEditable || element?.closest?.('button,input,select,textarea,summary,a,details,.hud-actions,.game-over-overlay,[contenteditable]:not([contenteditable="false"])'));
  }
  private buttonFor(direction: Direction): HTMLButtonElement { return this.buttons[direction === -1 ? 0 : 1]; }
  private stopTimer(): void {
    if (this.repeatTimer !== null) clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
  }
  private clearHold(): void {
    this.stopTimer();
    const previous = this.hold;
    this.hold = null;
    if (!previous) return;
    const button = this.buttonFor(previous.direction);
    button.classList.remove('is-held'); button.setAttribute('aria-pressed', 'false');
  }
  private releasePointer(pointer: PointerHold): void {
    try {
      if (pointer.button.hasPointerCapture(pointer.id)) pointer.button.releasePointerCapture(pointer.id);
    } catch { /* The browser may already have canceled this pointer. */ }
  }
  private clearPointers(): void {
    const pointers = [...this.heldPointers.values()];
    this.heldPointers.clear(); // Remove ownership before synchronous lost capture events.
    for (const pointer of pointers) this.releasePointer(pointer);
  }
  private selectPointer(pointer: PointerHold): void {
    if (this.hold?.kind === 'pointer' && this.hold.direction === pointer.direction) {
      this.hold = pointer; // Same direction retains its cadence; no duplicate immediate step.
      return;
    }
    this.clearHold(); this.beginHold(pointer);
  }
  private scheduleRepeat(direction: Direction, delayMs: number): void {
    this.repeatTimer = setTimeout(() => {
      this.repeatTimer = null;
      if (!this.hold || !this.listening) return;
      if (this.hold.kind === 'key' && this.interactive(this.viewport.ownerDocument?.activeElement ?? null)) { this.clear(); return; }
      // At the lane edge, retain press feedback until release but schedule no useless steps.
      if (this.onStep(direction)) this.scheduleRepeat(direction, HOLD_REPEAT_INTERVAL_MS);
    }, delayMs);
  }
  private beginHold(hold: Hold): void {
    this.hold = hold;
    const button = this.buttonFor(hold.direction);
    button.classList.add('is-held'); button.setAttribute('aria-pressed', 'true');
    if (this.onStep(hold.direction)) this.scheduleRepeat(hold.direction, HOLD_INITIAL_DELAY_MS);
  }
  private readonly focusChanged = (event: FocusEvent): void => {
    if (this.interactive(event.target)) this.clear();
  };
  private readonly visibilityChanged = (): void => { if (this.viewport.ownerDocument.hidden) this.clear(); };
  private readonly clear = (): void => { this.clearHold(); this.clearPointers(); this.heldKeys.clear(); };
  private readonly keyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const direction = ['a', 'arrowleft'].includes(key) ? -1 : ['d', 'arrowright'].includes(key) ? 1 : 0;
    if (!direction || this.interactive(event.target)) return;
    event.preventDefault();
    if (event.repeat || this.heldKeys.has(key)) return;
    this.heldKeys.add(key);
    // Most recent key wins; releasing it never revives an older hold.
    this.clearHold(); this.clearPointers(); this.beginHold({ kind: 'key', key, direction });
  };
  private readonly keyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase(); this.heldKeys.delete(key);
    if (this.hold?.kind === 'key' && key === this.hold.key) this.clearHold();
  };
  private readonly down = (event: PointerEvent): void => {
    event.preventDefault(); event.stopPropagation();
    if ((event.pointerType === 'mouse' && event.button !== 0) || this.heldPointers.has(event.pointerId)) return;
    const button = event.currentTarget as HTMLButtonElement;
    if (button.disabled) return;
    try { button.setPointerCapture(event.pointerId); } catch { return; }
    const pointer: PointerHold = { kind: 'pointer', id: event.pointerId, button, direction: button === this.buttons[0] ? -1 : 1 };
    this.heldPointers.set(pointer.id, pointer); this.selectPointer(pointer);
  };
  private readonly endPointer = (event: PointerEvent): void => {
    const pointer = this.heldPointers.get(event.pointerId);
    if (!pointer) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation(); this.heldPointers.delete(pointer.id); this.releasePointer(pointer);
    if (this.hold?.kind !== 'pointer' || this.hold.id !== pointer.id) return;
    let latest: PointerHold | undefined;
    for (const held of this.heldPointers.values()) latest = held;
    if (latest) this.selectPointer(latest); else this.clearHold();
  };
  private readonly nativeGesture = (event: Event): void => { if (event.cancelable) event.preventDefault(); event.stopPropagation(); };
  private readonly touchDefault = (event: Event): void => { if (event.cancelable) event.preventDefault(); };
  private readonly click = (event: MouseEvent): void => {
    event.preventDefault(); event.stopPropagation();
    // Pointerdown owns physical presses; compatibility clicks must not add a second step.
    // Zero-detail activation retains keyboard/assistive-technology button semantics.
    const button = event.currentTarget as HTMLButtonElement;
    if (!this.listening || button.disabled || event.detail !== 0 || this.hold?.kind === 'pointer') return;
    this.onStep(button === this.buttons[0] ? -1 : 1);
  };
}

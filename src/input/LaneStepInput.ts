// One physical press/tap is one command. Drag position and key repeat never steer.
export class LaneStepInput {
  private readonly heldKeys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private listening = false;
  constructor(private readonly viewport: HTMLElement, private readonly keys: Window,
    private readonly onStep: (direction: -1 | 1) => void) {}

  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.keys.addEventListener('keydown', this.keyDown);
    this.keys.addEventListener('keyup', this.keyUp);
    this.keys.addEventListener('blur', this.clear);
    this.viewport.addEventListener('pointerdown', this.down);
    this.viewport.addEventListener('pointerup', this.up);
    this.viewport.addEventListener('pointercancel', this.cancel);
  }
  stop(): void {
    this.listening = false;
    this.keys.removeEventListener('keydown', this.keyDown);
    this.keys.removeEventListener('keyup', this.keyUp);
    this.keys.removeEventListener('blur', this.clear);
    this.viewport.removeEventListener('pointerdown', this.down);
    this.viewport.removeEventListener('pointerup', this.up);
    this.viewport.removeEventListener('pointercancel', this.cancel);
    this.clear();
  }
  dispose(): void { this.stop(); }
  private interactive(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return Boolean(element?.closest?.('button,input,select,textarea,summary,a,details,.hud-actions,.game-over-overlay,[contenteditable="true"]'));
  }
  private readonly clear = (): void => { this.heldKeys.clear(); this.pointers.clear(); };
  private readonly keyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const direction = ['a', 'arrowleft'].includes(key) ? -1 : ['d', 'arrowright'].includes(key) ? 1 : 0;
    if (!direction || this.interactive(event.target)) return;
    event.preventDefault();
    if (event.repeat || this.heldKeys.has(key)) return;
    this.heldKeys.add(key);
    this.onStep(direction);
  };
  private readonly keyUp = (event: KeyboardEvent): void => { this.heldKeys.delete(event.key.toLowerCase()); };
  private readonly down = (event: PointerEvent): void => {
    if (this.interactive(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (this.pointers.size) return; // A second finger cannot multiply lane steps.
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  private readonly up = (event: PointerEvent): void => {
    const start = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (!start || this.interactive(event.target)) return;
    // Gesture slop is an input threshold, not gameplay balance. Swipes are ignored.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 24) return;
    const bounds = this.viewport.getBoundingClientRect();
    this.onStep(start.x < bounds.left + bounds.width / 2 ? -1 : 1);
    event.preventDefault();
  };
  private readonly cancel = (event: PointerEvent): void => { this.pointers.delete(event.pointerId); };
}

export type HorizontalAxis = -1 | 0 | 1;

export interface KeyboardSteeringCallbacks {
  onAxisChange(axis: HorizontalAxis): void;
}

function directionForKey(key: string): HorizontalAxis {
  switch (key.toLowerCase()) {
    case 'a':
    case 'arrowleft':
      return -1;
    case 'd':
    case 'arrowright':
      return 1;
    default:
      return 0;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    || element.isContentEditable === true;
}

export class KeyboardSteeringInput {
  private readonly heldKeys = new Set<string>();
  private axis: HorizontalAxis = 0;
  private listening = false;
  private disposed = false;

  constructor(
    private readonly eventTarget: Window,
    private readonly callbacks: KeyboardSteeringCallbacks,
  ) {}

  start(): void {
    if (this.disposed) throw new Error('Cannot start disposed keyboard input');
    if (this.listening) return;
    this.eventTarget.addEventListener('keydown', this.onKeyDown);
    this.eventTarget.addEventListener('keyup', this.onKeyUp);
    this.eventTarget.addEventListener('blur', this.onBlur);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    this.eventTarget.removeEventListener('keydown', this.onKeyDown);
    this.eventTarget.removeEventListener('keyup', this.onKeyUp);
    this.eventTarget.removeEventListener('blur', this.onBlur);
    this.listening = false;
    this.clearHeldKeys();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (directionForKey(key) === 0 || isEditableTarget(event.target)) return;
    if (key.startsWith('arrow')) event.preventDefault();
    this.heldKeys.add(key);
    this.updateAxis();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!this.heldKeys.has(key)) return;
    if (key.startsWith('arrow') && !isEditableTarget(event.target)) event.preventDefault();
    this.heldKeys.delete(key);
    this.updateAxis();
  };

  private readonly onBlur = (): void => {
    this.clearHeldKeys();
  };

  private clearHeldKeys(): void {
    this.heldKeys.clear();
    this.updateAxis();
  }

  private updateAxis(): void {
    const left = this.heldKeys.has('a') || this.heldKeys.has('arrowleft');
    const right = this.heldKeys.has('d') || this.heldKeys.has('arrowright');
    const nextAxis: HorizontalAxis = left === right ? 0 : left ? -1 : 1;
    if (nextAxis !== this.axis) {
      this.axis = nextAxis;
      this.callbacks.onAxisChange(nextAxis);
    }
  }
}

import type { DevCameraMode } from '../rendering/DevCameraPerspective';

export class DevCameraSwitch {
  readonly element = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  constructor(host: HTMLElement, private readonly select: (mode: DevCameraMode) => void) {
    this.element.className = 'dev-camera-switch';
    this.element.style.cssText = 'position:absolute;z-index:17;top:var(--hud-safe-top,12px);left:50%;transform:translateX(-50%);padding:3px;background:#162533e8;border-radius:8px;color:white;font:12px sans-serif;text-align:center';
    const label = document.createElement('div'); label.textContent = 'DEV 鏡頭'; this.element.append(label);
    for (const mode of ['A', 'B'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = mode; button.dataset.camera = mode;
      button.setAttribute('aria-label', `Camera ${mode}`);
      button.style.cssText = 'min-width:44px;min-height:44px;border:0;border-radius:5px;color:white;font:bold 16px sans-serif;touch-action:manipulation';
      button.addEventListener('click', () => { this.setMode(mode); button.blur(); });
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', event => event.stopPropagation());
    this.element.hidden = true; host.append(this.element);
  }
  private setMode(mode: DevCameraMode): void {
    for (const button of this.buttons) {
      const selected = button.dataset.camera === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.style.background = selected ? '#795627' : '#263444';
    }
    this.select(mode);
  }
  setActive(active: boolean): void { this.element.hidden = !active; this.setMode('A'); }
  dispose(): void { this.element.remove(); }
}

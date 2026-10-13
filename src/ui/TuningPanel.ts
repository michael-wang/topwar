import type { RuntimeTuning } from '../app/runtimeTuning';
import { testingHatch } from './TestingHatch';

type Key = keyof RuntimeTuning;
type Control = { key: Key; label: string; min: number; max: number; step: number };
const controls: readonly Control[] = [
  { key: 'groupSize', label: 'Enemies / wave (future groups; Retry refills)', min: 10, max: 60, step: 2 },
  { key: 'enemyVisualScale', label: 'Enemy visual size', min: 1, max: 2, step: 0.05 },
  { key: 'gruntSpeed', label: 'Grunt speed', min: 0, max: 2, step: 0.05 },
  { key: 'heavyHp', label: 'Heavy HP (rifle hits)', min: 2, max: 40, step: 1 },
  { key: 'heavySpeed', label: 'Heavy speed', min: 0, max: 1.5, step: 0.01 },
  { key: 'heavyChance', label: 'Heavy chance / wave', min: 0, max: 1, step: 0.05 },
  { key: 'bulletSpeed', label: 'Bullet speed', min: 10, max: 60, step: 1 },
  { key: 'bulletRange', label: 'Bullet range', min: 10, max: 80, step: 1 },
  { key: 'fireRate', label: 'Fire rate', min: 1, max: 15, step: 0.5 },
  { key: 'musicVolume', label: 'Music volume', min: 0, max: 0.50, step: 0.01 },
];

export class TuningPanel {
  readonly reviewControlsHost = document.createElement('div');
  readonly advancedControlsHost = document.createElement('div');
  private readonly advanced = document.createElement('details');
  private readonly element: HTMLDetailsElement;
  private readonly resetButton = document.createElement('button');
  private readonly inputs = new Map<Key, HTMLInputElement>();
  private readonly outputs = new Map<Key, HTMLOutputElement>();
  private readonly onPointerDown = (event: PointerEvent): void => { event.stopPropagation(); };
  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const key = input.dataset.key as Key;
    this.values = { ...this.values, [key]: Number(input.value) };
    this.updateDisplay();
    this.onChange({ ...this.values });
  };
  private readonly onReset = (): void => {
    this.setValues(this.defaults);
    this.onChange({ ...this.values });
  };
  private values: RuntimeTuning;
  private readonly releaseClosedFocus = (): void => {
    if (this.element.open) return;
    const focused = this.element.ownerDocument?.activeElement as HTMLElement | null;
    if (focused && this.element.contains(focused)) focused.blur();
  };

  constructor(viewport: HTMLElement, private readonly defaults: RuntimeTuning,
    private readonly onChange: (values: RuntimeTuning) => void) {
    this.values = { ...defaults };
    this.element = document.createElement('details');
    this.element.className = 'tuning-panel tuning-panel--coastal-anchor';
    const summary = document.createElement('summary');
    testingHatch(summary);
    const content = document.createElement('div');
    content.className = 'tuning-panel-content';
    {
      const heading = document.createElement('strong'); heading.className = 'tuning-heading';
      heading.textContent = '測試場景'; content.append(heading);
      this.reviewControlsHost.className = 'dev-review-host';
      content.append(this.reviewControlsHost);
    }
    if (import.meta.env.DEV) {
      this.advanced.className = 'dev-advanced';
      const summary = document.createElement('summary'); summary.textContent = '進階調校';
      summary.style.cssText = 'width:100%;box-sizing:border-box;min-height:44px;padding:10px;font-size:14px';
      this.advanced.append(summary, this.advancedControlsHost); content.append(this.advanced);
    }
    this.element.append(summary, content);
    if (import.meta.env.DEV) {
      for (const control of controls) {
        if (defaults[control.key] === undefined) continue;
        const label = document.createElement('label');
        label.textContent = control.key === 'fireRate' ? 'Base fire rate' : control.label;
        const input = document.createElement('input');
        input.type = 'range'; input.min = String(control.min);
        input.max = String(control.max); input.step = String(control.step);
        input.dataset.key = control.key;
        const output = document.createElement('output');
        label.append(input, output);
        this.advancedControlsHost.append(label);
        this.inputs.set(control.key, input);
        this.outputs.set(control.key, output);
        input.addEventListener('input', this.onInput);
      }
      const reset = this.resetButton;
      reset.type = 'button';
      reset.textContent = 'Reset Defaults';
      reset.addEventListener('click', this.onReset);
      this.advancedControlsHost.append(reset);
    }
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('toggle', this.releaseClosedFocus);
    viewport.append(this.element);
    this.setValues(defaults);
  }

  setValues(values: RuntimeTuning): void {
    this.values = { ...values };
    for (const [key, input] of this.inputs) input.value = String(values[key]);
    this.updateDisplay();
  }

  toggle(): void {
    this.element.open = !this.element.open;
    // Escape must release hidden slider focus synchronously, before the next key press.
    this.releaseClosedFocus();
  }

  close(): void { this.element.open = false; this.advanced.open = false; this.releaseClosedFocus(); }
  openAdvanced(): void { this.element.open = this.advanced.open = true; }

  dispose(): void {
    for (const input of this.inputs.values()) input.removeEventListener('input', this.onInput);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('toggle', this.releaseClosedFocus);
    this.resetButton.removeEventListener('click', this.onReset);
    this.element.remove();
  }

  private updateDisplay(): void {
    for (const [key, output] of this.outputs) {
      const value = this.values[key]!;
      output.textContent = key === 'musicVolume' ? value.toFixed(2) : String(value);
    }
  }
}

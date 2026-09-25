import type { RuntimeTuning } from '../app/runtimeTuning';

type Key = keyof RuntimeTuning;
const controls: readonly { key: Key; label: string; min: number; max: number; step: number }[] = [
  { key: 'bulletSpeed', label: 'Bullet speed', min: 10, max: 60, step: 1 },
  { key: 'bulletRange', label: 'Bullet range', min: 10, max: 80, step: 1 },
  { key: 'rewardRowsPerReward', label: 'Reward density', min: 2, max: 20, step: 1 },
  { key: 'enemyHigherTierPowerMultiplier', label: 'Enemy HP / tier', min: 2, max: 20, step: 0.5 },
  { key: 'rifleHigherTierPowerMultiplier', label: 'Rifle power / tier', min: 2, max: 20, step: 0.5 },
  { key: 'fireRate', label: 'Fire rate', min: 1, max: 15, step: 0.5 },
  { key: 'moveSpeed', label: 'Move speed', min: 1, max: 10, step: 0.5 },
  { key: 'forwardSpeed', label: 'Forward speed', min: 0.5, max: 3, step: 0.1 },
];

export class TuningPanel {
  private readonly element: HTMLDetailsElement;
  private readonly inputs = new Map<Key, HTMLInputElement>();
  private readonly outputs = new Map<Key, HTMLOutputElement>();
  private readonly onPointerDown = (event: PointerEvent): void => { event.stopPropagation(); };
  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
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

  constructor(viewport: HTMLElement, private readonly defaults: RuntimeTuning,
    private readonly onChange: (values: RuntimeTuning) => void) {
    this.values = { ...defaults };
    this.element = document.createElement('details');
    this.element.className = 'tuning-panel';
    const summary = document.createElement('summary');
    summary.textContent = 'TUNE';
    this.element.append(summary);
    for (const control of controls) {
      const label = document.createElement('label');
      label.textContent = control.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step);
      input.dataset.key = control.key;
      const output = document.createElement('output');
      label.append(input, output);
      this.element.append(label);
      this.inputs.set(control.key, input);
      this.outputs.set(control.key, output);
      input.addEventListener('input', this.onInput);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset Defaults';
    reset.addEventListener('click', this.onReset);
    this.element.append(reset);
    this.element.addEventListener('pointerdown', this.onPointerDown);
    viewport.append(this.element);
    this.setValues(defaults);
  }

  setValues(values: RuntimeTuning): void {
    this.values = { ...values };
    for (const [key, input] of this.inputs) input.value = String(values[key]);
    this.updateDisplay();
  }

  dispose(): void {
    for (const input of this.inputs.values()) input.removeEventListener('input', this.onInput);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.querySelector('button')?.removeEventListener('click', this.onReset);
    this.element.remove();
  }

  private updateDisplay(): void {
    for (const [key, output] of this.outputs) {
      const value = this.values[key];
      output.textContent = key === 'rewardRowsPerReward'
        ? `1 / ${value} rows (≈${Number((100 / value).toFixed(1))}%)` : String(value);
    }
  }
}

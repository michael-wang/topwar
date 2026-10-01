import type { RuntimeTuning } from '../app/runtimeTuning';

type Key = keyof RuntimeTuning;
type Control = { key: Key; label: string; min: number; max: number; step: number }
  | { key: 'bossHpScale'; label: string; choices: readonly number[] };
const controls: readonly Control[] = [
  { key: 'groupSize', label: 'Enemies / wave (future groups; Retry refills)', min: 10, max: 100, step: 5 },
  { key: 'enemyVisualScale', label: 'Enemy visual size', min: 1, max: 2, step: 0.05 },
  { key: 'gruntSpeed', label: 'Grunt speed', min: 0, max: 2, step: 0.05 },
  { key: 'heavyHp', label: 'Heavy HP (rifle hits)', min: 2, max: 40, step: 1 },
  { key: 'heavySpeed', label: 'Heavy speed', min: 0, max: 1.5, step: 0.01 },
  { key: 'heavyChance', label: 'Heavy chance / wave', min: 0, max: 1, step: 0.05 },
  { key: 'bulletSpeed', label: 'Bullet speed', min: 10, max: 60, step: 1 },
  { key: 'bulletRange', label: 'Bullet range', min: 10, max: 80, step: 1 },
  { key: 'rewardRowsPerReward', label: 'Reward density', min: 2, max: 20, step: 1 },
  { key: 'enemyHigherTierPowerMultiplier', label: 'Enemy HP / tier', min: 2, max: 20, step: 0.5 },
  { key: 'rifleHigherTierPowerMultiplier', label: 'Rifle power / tier', min: 2, max: 20, step: 0.5 },
  { key: 'fireRate', label: 'Fire rate', min: 1, max: 15, step: 0.5 },
  { key: 'moveSpeed', label: 'Move speed', min: 1, max: 10, step: 0.5 },
  { key: 'forwardSpeed', label: 'Forward speed', min: 0.5, max: 3, step: 0.1 },
  { key: 'bossHpScale', label: 'Boss HP scale', choices: [.25, .5, 1, 2, 3, 5, 10, 20, 50, 100] },
  { key: 'musicVolume', label: 'Music volume', min: 0, max: 0.50, step: 0.01 },
];

export class TuningPanel {
  private readonly element: HTMLDetailsElement;
  private readonly inputs = new Map<Key, HTMLInputElement | HTMLSelectElement>();
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
    private readonly onChange: (values: RuntimeTuning) => void, defenseMode = false) {
    this.values = { ...defaults };
    this.element = document.createElement('details');
    this.element.className = 'tuning-panel';
    const summary = document.createElement('summary');
    summary.textContent = 'TUNE';
    const content = document.createElement('div');
    content.className = 'tuning-panel-content';
    this.element.append(summary, content);
    for (const control of controls) {
      if (defenseMode && ['rewardRowsPerReward', 'enemyHigherTierPowerMultiplier', 'rifleHigherTierPowerMultiplier', 'bossHpScale', 'moveSpeed'].includes(control.key)) continue;
      if (defaults[control.key] === undefined) continue;
      const label = document.createElement('label');
      label.textContent = control.key === 'enemyHigherTierPowerMultiplier' && defaults.enemyVisualScale !== undefined
        ? 'Boss base HP / tier' : defenseMode && control.key === 'forwardSpeed' ? 'Approach pace' : control.label;
      const input = control.key === 'bossHpScale'
        ? document.createElement('select') : document.createElement('input');
      if ('choices' in control) {
        for (const value of control.choices) {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = `${value}×`;
          input.append(option);
        }
      } else {
        const slider = input as HTMLInputElement;
        slider.type = 'range';
        slider.min = String(control.min);
        slider.max = String(control.max);
        slider.step = String(control.step);
      }
      input.dataset.key = control.key;
      const output = document.createElement('output');
      label.append(input, output);
      content.append(label);
      this.inputs.set(control.key, input);
      this.outputs.set(control.key, output);
      input.addEventListener('input', this.onInput);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset Defaults';
    reset.addEventListener('click', this.onReset);
    content.append(reset);
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

  dispose(): void {
    for (const input of this.inputs.values()) input.removeEventListener('input', this.onInput);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('toggle', this.releaseClosedFocus);
    this.element.querySelector('button')?.removeEventListener('click', this.onReset);
    this.element.remove();
  }

  private updateDisplay(): void {
    for (const [key, output] of this.outputs) {
      const value = this.values[key]!;
      output.textContent = key === 'rewardRowsPerReward'
        ? `1 / ${value} rows (≈${Number((100 / value).toFixed(1))}%)`
        : key === 'bossHpScale' ? `${value}×`
          : key === 'musicVolume' ? value.toFixed(2) : String(value);
    }
  }
}

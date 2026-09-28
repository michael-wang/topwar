import { afterEach, describe, expect, it, vi } from 'vitest';
import { TuningPanel } from '../src/ui/TuningPanel';
import type { RuntimeTuning } from '../src/app/runtimeTuning';

class ElementStub extends EventTarget {
  readonly children: ElementStub[] = [];
  readonly dataset: Record<string, string> = {};
  className = '';
  textContent = '';
  type = '';
  min = '';
  max = '';
  step = '';
  value = '';
  open = false;
  removed = false;
  constructor(readonly tagName: string) { super(); }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  remove(): void { this.removed = true; }
  querySelector(tag: string): ElementStub | null {
    for (const child of this.children) {
      if (child.tagName === tag) return child;
      const nested = child.querySelector(tag);
      if (nested) return nested;
    }
    return null;
  }
  findAll(tag: string): ElementStub[] {
    return this.children.flatMap((child) => [
      ...(child.tagName === tag ? [child] : []), ...child.findAll(tag),
    ]);
  }
}

const defaults: RuntimeTuning = { bulletSpeed: 28, bulletRange: 40, rewardRowsPerReward: 7,
  enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10,
  fireRate: 7, moveSpeed: 5, forwardSpeed: 1.5, bossHpScale: 3, musicVolume: .16 };

describe('temporary tuning panel', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('offers music volume with the other sliders and Reset restores authored defaults', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag) });
    const viewport = new ElementStub('div');
    const onChange = vi.fn();
    const panel = new TuningPanel(viewport as unknown as HTMLElement, defaults, onChange);
    const root = viewport.children[0];
    const inputs = root.findAll('input');
    expect(inputs).toHaveLength(9);
    expect(inputs.every((input) => input.type === 'range')).toBe(true);
    const bossScale = root.findAll('select')[0];
    expect(bossScale.findAll('option').map((option) => option.value))
      .toEqual(['0.25', '0.5', '1', '2', '3', '5', '10', '20', '50', '100']);
    bossScale.value = '20';
    bossScale.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, bossHpScale: 20 });
    expect(root.findAll('output')[2].textContent).toContain('1 / 7 rows (≈14.3%)');
    const density = inputs[2];
    density.value = '4';
    density.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, rewardRowsPerReward: 4,
      bossHpScale: 20 });
    expect(root.findAll('output')[2].textContent).toContain('1 / 4 rows (≈25%)');
    const music = inputs[8];
    expect(music.dataset.key).toBe('musicVolume');
    expect([music.min, music.max, music.step]).toEqual(['0', '0.3', '0.01']);
    expect(root.findAll('output').at(-1)?.textContent).toBe('0.16');
    music.value = '0.24';
    music.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, rewardRowsPerReward: 4,
      bossHpScale: 20, musicVolume: .24 });
    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(onChange).toHaveBeenLastCalledWith(defaults);
    expect(density.value).toBe('7');
    expect(bossScale.value).toBe('3');
    expect(music.value).toBe('0.16');
    panel.toggle();
    expect(root.open).toBe(true);
    panel.toggle();
    expect(root.open).toBe(false);
    panel.dispose();
    expect(root.removed).toBe(true);
  });
});

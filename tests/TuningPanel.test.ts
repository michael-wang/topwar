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

const defaults: RuntimeTuning = { bulletSpeed: 28, bulletRange: 40, rewardRowsPerReward: 8,
  enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10,
  fireRate: 7, moveSpeed: 5, forwardSpeed: 1.5 };

describe('temporary tuning panel', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('offers exactly eight sliders, shows density, and Reset restores authored defaults', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag) });
    const viewport = new ElementStub('div');
    const onChange = vi.fn();
    const panel = new TuningPanel(viewport as unknown as HTMLElement, defaults, onChange);
    const root = viewport.children[0];
    const inputs = root.findAll('input');
    expect(inputs).toHaveLength(8);
    expect(inputs.every((input) => input.type === 'range')).toBe(true);
    expect(root.findAll('output')[2].textContent).toContain('1 / 8 rows (≈12.5%)');
    const density = inputs[2];
    density.value = '4';
    density.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, rewardRowsPerReward: 4 });
    expect(root.findAll('output')[2].textContent).toContain('1 / 4 rows (≈25%)');
    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(onChange).toHaveBeenLastCalledWith(defaults);
    expect(density.value).toBe('8');
    panel.dispose();
    expect(root.removed).toBe(true);
  });
});

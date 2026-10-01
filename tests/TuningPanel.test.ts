import { afterEach, describe, expect, it, vi } from 'vitest';
import { TuningPanel } from '../src/ui/TuningPanel';
import type { RuntimeTuning } from '../src/app/runtimeTuning';
import { LaneStepInput } from '../src/input/LaneStepInput';

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
  get ownerDocument(): Document { return document; }
  contains(element: ElementStub): boolean {
    return this === element || this.children.some((child) => child.contains(element));
  }
  focus(): void { Object.defineProperty(document, 'activeElement', { configurable: true, value: this }); }
  blur(): void { Object.defineProperty(document, 'activeElement', { configurable: true, value: null }); }
  closest(): ElementStub | null { return ['input', 'select', 'summary'].includes(this.tagName) ? this : null; }
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
  fireRate: 7, moveSpeed: 5, forwardSpeed: 1.5, bossHpScale: 3, musicVolume: .50 };

describe('temporary tuning panel', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps slider keys native while open and releases hidden focus immediately on Escape-style close', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag), activeElement: null });
    const viewport = new ElementStub('div');
    const keys = new EventTarget();
    const step = vi.fn(() => false);
    const input = new LaneStepInput(viewport as unknown as HTMLElement, keys as unknown as Window, step);
    input.start();
    const panel = new TuningPanel(viewport as unknown as HTMLElement, defaults, vi.fn(), true);
    const slider = viewport.children[0].findAll('input').find((input) => input.dataset.key === 'fireRate')!;
    const keyDown = (key: string) => {
      const event = new Event('keydown', { cancelable: true });
      Object.defineProperties(event, { key: { value: key }, target: { value: document.activeElement } });
      keys.dispatchEvent(event);
      return event;
    };
    panel.toggle();
    slider.focus();
    expect(keyDown('ArrowRight').defaultPrevented).toBe(false);
    expect(step).not.toHaveBeenCalled();
    slider.value = '6';
    slider.dispatchEvent(new Event('input'));
    panel.toggle();
    expect(document.activeElement).toBeNull();
    expect(keyDown('ArrowRight').defaultPrevented).toBe(true);
    expect(step).toHaveBeenCalledWith(1);
    expect(keyDown('a').defaultPrevented).toBe(true);
    expect(step).toHaveBeenCalledWith(-1);
    input.dispose();
    panel.dispose();
  });

  it('releases focus for native details close but leaves outside focus and open controls alone', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag), activeElement: null });
    const viewport = new ElementStub('div');
    const panel = new TuningPanel(viewport as unknown as HTMLElement, defaults, vi.fn());
    const root = viewport.children[0];
    const select = root.findAll('select')[0];
    root.open = true;
    select.focus();
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBe(select);
    root.open = false;
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBeNull();
    const outside = new ElementStub('input');
    outside.focus();
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBe(outside);
    panel.dispose();
  });
  it('applies each live Catharsis control and restores all experiment defaults', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag) });
    const viewport = new ElementStub('div');
    const onChange = vi.fn();
    const experiment = { ...defaults, enemyVisualScale: 1.4, gruntSpeed: .8,
      heavyHp: 15, heavySpeed: .12, heavyChance: .25 };
    const panel = new TuningPanel(viewport as unknown as HTMLElement, experiment, onChange);
    const root = viewport.children[0];
    const heavy = root.findAll('input').find(input => input.dataset.key === 'heavyHp')!;
    expect(heavy.max).toBe('40');
    for (const [key, value] of Object.entries({ enemyVisualScale: 1.6, gruntSpeed: 1,
      heavyHp: 40, heavySpeed: .5, heavyChance: .4 })) {
      const input = root.findAll('input').find((input) => input.dataset.key === key)!;
      input.value = String(value);
      input.dispatchEvent(new Event('input'));
      expect(onChange.mock.lastCall?.[0][key]).toBe(value);
    }
    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(onChange).toHaveBeenLastCalledWith(experiment);
    panel.dispose();
  });
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
    expect([music.min, music.max, music.step]).toEqual(['0', '0.5', '0.01']);
    expect(root.findAll('output').at(-1)?.textContent).toBe('0.50');
    music.value = '0.24';
    music.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, rewardRowsPerReward: 4,
      bossHpScale: 20, musicVolume: .24 });
    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(onChange).toHaveBeenLastCalledWith(defaults);
    expect(density.value).toBe('7');
    expect(bossScale.value).toBe('3');
    expect(music.value).toBe('0.5');
    panel.toggle();
    expect(root.open).toBe(true);
    const pointer = new Event('pointerdown');
    const stop = vi.spyOn(pointer, 'stopPropagation');
    root.dispatchEvent(pointer);
    expect(stop).toHaveBeenCalledOnce();
    panel.toggle();
    expect(root.open).toBe(false);
    panel.dispose();
    expect(root.removed).toBe(true);
  });
});

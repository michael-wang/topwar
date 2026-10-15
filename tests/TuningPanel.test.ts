import { afterEach, describe, expect, it, vi } from 'vitest';
import { TuningPanel } from '../src/ui/TuningPanel';
import type { RuntimeTuning } from '../src/app/runtimeTuning';
import { LaneStepInput } from '../src/input/LaneStepInput';

class ElementStub extends EventTarget {
  readonly children: ElementStub[] = [];
  readonly dataset: Record<string, string> = {};
  className = '';
  style = { cssText: '' };
  textContent = '';
  type = '';
  min = '';
  max = '';
  step = '';
  value = '';
  open = false;
  removed = false;
  classList={add:vi.fn(),remove:vi.fn()};
  setAttribute() {}
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
  it('exposes the defense crowd range and resets it to the authored density', () => {
    vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag) });
    const viewport = new ElementStub('div');
    const onChange = vi.fn();
    const values = { ...defaults, groupSize: 24 };
    const panel = new TuningPanel(viewport as unknown as HTMLElement, values, onChange);
    const slider = viewport.children[0].findAll('input').find(input => input.dataset.key === 'groupSize')!;
    expect([slider.min, slider.max, slider.step, slider.value]).toEqual(['10', '60', '2', '24']);
    slider.value = '60';
    slider.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, groupSize: 60 });
    viewport.children[0].querySelector('button')!.dispatchEvent(new Event('click'));
    expect(slider.value).toBe('24');
    expect(onChange).toHaveBeenLastCalledWith(values);
    panel.dispose();
  });

  afterEach(() => vi.unstubAllGlobals());
  it('keeps slider keys native while open and releases hidden focus immediately on Escape-style close', () => {
    vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: (tag: string) => new ElementStub(tag), activeElement: null }));
    const viewport = new ElementStub('div');
    const keys = new EventTarget();
    const step = vi.fn(() => false);
    const input = new LaneStepInput(viewport as unknown as HTMLElement, keys as unknown as Window, step,
      [new ElementStub('button'),new ElementStub('button')] as unknown as [HTMLButtonElement,HTMLButtonElement]);
    input.start();
    const panel = new TuningPanel(viewport as unknown as HTMLElement, defaults, vi.fn());
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
    expect(document.activeElement).toBe(viewport.children[0].children[0]);
    expect(keyDown('ArrowRight').defaultPrevented).toBe(false);
    viewport.children[0].children[0].blur();
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
    const select = root.findAll('input')[0];
    root.open = true;
    select.focus();
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBe(select);
    root.open = false;
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBe(root.children[0]);
    const outside = new ElementStub('input');
    outside.focus();
    root.dispatchEvent(new Event('toggle'));
    expect(document.activeElement).toBe(outside);
    panel.dispose();
  });
  it('notifies native and Escape-style changes once and does not replay queued toggle events',()=>{
    vi.stubGlobal('document',{createElement:(tag:string)=>new ElementStub(tag),activeElement:null});
    const viewport=new ElementStub('div'),change=vi.fn();
    const panel=new TuningPanel(viewport as unknown as HTMLElement,defaults,vi.fn(),change),root=viewport.children[0];
    root.open=true;root.dispatchEvent(new Event('toggle'));expect(change.mock.calls).toEqual([[true]]);
    root.dispatchEvent(new Event('toggle'));expect(change).toHaveBeenCalledOnce();
    panel.close();root.dispatchEvent(new Event('toggle'));expect(change.mock.calls).toEqual([[true],[false]]);
    panel.toggle();root.dispatchEvent(new Event('toggle'));expect(change.mock.calls).toEqual([[true],[false],[true]]);
    expect(document.activeElement).toBe(root.children[0]);
    panel.close();panel.close();expect(change.mock.calls).toEqual([[true],[false],[true],[false]]);panel.dispose();
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
    expect(inputs).toHaveLength(4);
    expect(root.findAll('select')).toHaveLength(0);
    expect(inputs.every(input=>input.type==='range')).toBe(true);
    const music = inputs[3];
    expect(music.dataset.key).toBe('musicVolume');
    expect([music.min, music.max, music.step]).toEqual(['0', '0.5', '0.01']);
    expect(root.findAll('output').at(-1)?.textContent).toBe('0.50');
    music.value = '0.24';
    music.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaults, musicVolume: .24 });
    root.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(onChange).toHaveBeenLastCalledWith(defaults);
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


it('uses the coastal testing hatch without a retired TUNE entry', () => {
  vi.stubGlobal('document', {createElement: (tag: string) => new ElementStub(tag)});
  const viewport = new ElementStub('div');
  const defense = new TuningPanel(viewport as unknown as HTMLElement, defaults, vi.fn());
  expect(viewport.children[0].className).toBe('tuning-panel tuning-panel--coastal-anchor');
  const summary = viewport.children[0].children[0];
  expect((summary as unknown as HTMLElement).innerHTML).toContain('<svg');
  expect((summary as unknown as HTMLElement).innerHTML).not.toContain('DEV');
  expect((summary as unknown as HTMLElement).ariaLabel).toBe('封閉測試工具');
  expect((summary as unknown as HTMLElement).title).toBe('封閉測試工具');
  expect(viewport.children[0].children[1].children[0].textContent).toBe('測試場景');
  expect(viewport.children[0].children[1].children[1]).toBe(defense.reviewControlsHost);
  const advanced = viewport.children[0].children[1].children[2];
  expect(advanced.tagName).toBe('details'); expect(advanced.open).toBe(false);
  expect(advanced.children[0].textContent).toBe('進階調校');
  expect(advanced.children[1]).toBe(defense.advancedControlsHost);
  defense.openAdvanced(); expect(advanced.open).toBe(true);
  defense.close(); expect(advanced.open).toBe(false);
  defense.toggle(); expect(viewport.children[0].open).toBe(true);
  defense.close(); expect(viewport.children[0].open).toBe(false);
  defense.dispose(); vi.unstubAllGlobals();
});

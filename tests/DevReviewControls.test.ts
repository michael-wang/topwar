import { afterEach, expect, it, vi } from 'vitest';
import { DevReviewControls } from '../src/ui/DevReviewControls';
import type { DevReviewFixture } from '../src/app/DevReviewFixtures';

class ElementStub extends EventTarget {
  children: ElementStub[] = [];
  style = { cssText: '', background: '' };
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  textContent = '';
  blur = vi.fn(); remove = vi.fn();
  constructor(readonly tagName = 'DIV') { super(); }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  append(...children: ElementStub[]) { this.children.push(...children); }
}
afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag.toUpperCase()) });
  const select = vi.fn(), controls = new DevReviewControls(new ElementStub() as unknown as HTMLElement, select);
  const root = controls.element as unknown as ElementStub;
  return { controls, root, select, buttons: root.children.filter(b => b.dataset.role) };
}
it('offers exactly four Traditional Chinese one-tap scenarios with selection and pressed feedback', () => {
  const { controls, root, buttons, select } = setup();
  expect(buttons.map(b => b.textContent)).toEqual(['🚢 驅逐艦進場', '🚨 BOSS 進場', '🏆 勝利結算', '✈️ 空中支援']);
  expect(root.children[0].textContent).toContain('min-height:52px');
  expect(root.children[0].textContent).toContain(':active');
  expect(root.children.some(b=>b.textContent.includes('取代目前進度'))).toBe(true);
  for (const button of buttons) {
    button.dispatchEvent(new Event('click'));
    expect(select.mock.lastCall).toEqual([button.dataset.role]);
    controls.setSelected(button.dataset.role as DevReviewFixture);
    expect(button.attrs['aria-pressed']).toBe('true');
    expect(buttons.filter(b => b.attrs['aria-pressed'] === 'true')).toEqual([button]);
    expect(button.blur).toHaveBeenCalledOnce();
  }
  controls.setSelected('mg8'); expect(buttons.every(b => b.attrs['aria-pressed'] === 'false')).toBe(true);
  controls.dispose(); expect(root.remove).toHaveBeenCalledOnce();
});
it('returns to normal play separately from the four scenarios and stops battlefield pointer propagation', () => {
  const { controls, root, select } = setup(), back = root.children.find(b => b.dataset.action === 'normal')!;
  expect(back.textContent).toBe('返回一般遊戲'); expect(back.dataset.role).toBeUndefined();
  back.dispatchEvent(new Event('click')); expect(select).toHaveBeenCalledWith(null); expect(back.blur).toHaveBeenCalledOnce();
  const event = new Event('pointerdown'), stop = vi.spyOn(event, 'stopPropagation');
  root.dispatchEvent(event); expect(stop).toHaveBeenCalledOnce();
  controls.dispose(); root.dispatchEvent(event); expect(stop).toHaveBeenCalledOnce();
});

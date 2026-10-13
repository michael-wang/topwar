import { afterEach, expect, it, vi } from 'vitest';
import { StageClearOverlay, clearResultRows } from '../src/ui/StageClearOverlay';

class Element extends EventTarget {
  hidden = false;
  className = '';
  textContent = '';
  id = '';
  lang = '';
  type = '';
  clientHeight = 844;
  dataset: Record<string, string> = {};
  style = { setProperty: vi.fn() };
  children: Element[] = [];
  setAttribute = vi.fn();
  remove = vi.fn();
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren(...children: Element[]) { this.children = children; }
}
afterEach(() => vi.unstubAllGlobals());

it('preserves final results and replay, rebuilding only for a new clear after Retry', () => {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const replay = vi.fn(), viewport = new Element();
  const overlay = new StageClearOverlay(viewport as unknown as HTMLElement, replay);
  const root = overlay.element as unknown as Element;
  const [, results, button] = root.children;
  const stats = { gruntKills: 5, heavyKills: 3, giantKills: 1, shotsFired: 100, shotsHit: 35, grenadesUsed: 2 };
  expect(root.hidden).toBe(true);
  overlay.show(stats, 90);
  expect(results.children.map(row => row.children.map(child => child.textContent)))
    .toEqual(clearResultRows(stats, 90));
  const first = results.children;
  overlay.show({ ...stats, shotsHit: 80 }, 100);
  expect(results.children).toBe(first);
  button.dispatchEvent(new Event('click')); expect(replay).toHaveBeenCalledOnce();
  const pointer = new Event('pointerdown'); const stop = vi.spyOn(pointer, 'stopPropagation');
  root.dispatchEvent(pointer); expect(stop).toHaveBeenCalledOnce();
  overlay.reset(); expect(root.hidden).toBe(true);
  overlay.show({ ...stats, shotsHit: 80 }, 100);
  expect(results.children).toHaveLength(7);
  expect(results.children[5].children[1].textContent).toBe('80.0%');
  overlay.dispose(); expect(root.remove).toHaveBeenCalledOnce();
  button.dispatchEvent(new Event('click')); expect(replay).toHaveBeenCalledOnce();
});

it('keeps results away from both distant and close wrecks and follows viewport changes', () => {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const viewport = new Element(), overlay = new StageClearOverlay(viewport as unknown as HTMLElement, vi.fn());
  const root = overlay.element as unknown as Element;
  overlay.update({ x: 175, y: 500 }); expect(root.dataset.layout).toBeUndefined();
  overlay.show({ gruntKills: 0, heavyKills: 0, giantKills: 0, shotsFired: 0, shotsHit: 0, grenadesUsed: 0 }, 0);
  overlay.update({ x: 175, y: 240 }); expect(root.dataset.layout).toBe('lower');
  overlay.update({ x: 175, y: 500 }); expect(root.dataset.layout).toBe('upper');
  viewport.clientHeight = 1440;
  overlay.update({ x: 175, y: 500 }); expect(root.dataset.layout).toBe('lower');
  overlay.update(null); expect(root.dataset.layout).toBe('lower');
  overlay.dispose();
});

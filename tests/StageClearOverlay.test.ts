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
  const [, results, illustration, button] = root.children;
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
  expect(root.children[2]).toBe(illustration); // Retry reuses the fully preloaded scene, not separate portraits.
  expect(results.children[5].children[1].textContent).toBe('80.0%');
  overlay.dispose(); expect(root.remove).toHaveBeenCalledOnce();
  button.dispatchEvent(new Event('click')); expect(replay).toHaveBeenCalledOnce();
});

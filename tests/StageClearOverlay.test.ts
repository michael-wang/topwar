import { afterEach, expect, it, vi } from 'vitest';
import { StageClearOverlay, clearResultRows, defeatResultRows } from '../src/ui/StageClearOverlay';
import { GameOverOverlay } from '../src/ui/GameOverOverlay';

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

it('shows three stable defeat results and seated art, then rebuilds after Retry and cleans listeners', () => {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const retry = vi.fn(), viewport = new Element();
  const overlay = new GameOverOverlay(viewport as unknown as HTMLElement, retry);
  const root = viewport.children[0], [title, results, illustration, button] = root.children;
  const stats = { gruntKills: 5, heavyKills: 3, giantKills: 1, shotsFired: 100, shotsHit: 35, grenadesUsed: 2 };
  expect(overlay.visible).toBe(false);
  overlay.setVisible(true, stats, 90);
  expect(overlay.visible).toBe(true);
  expect(title.textContent).toBe('作戰失敗'); expect(button.textContent).toBe('再試一次');
  expect((illustration as unknown as HTMLImageElement).src).toContain('art/defeat/commander-soldier.webp');
  expect((illustration as unknown as HTMLImageElement).alt).toContain('蹲坐在地上');
  expect(results.children.map(row => row.children.map(child => child.textContent)))
    .toEqual([['存活時間', '1:30.0'], ['擊殺總數', '9'], ['命中率', '35.0%']]);
  expect(results.children.map(row => row.dataset.result)).toEqual(['0', '1', '5']);
  const first = results.children; overlay.setVisible(true, { ...stats, shotsHit: 80 }, 120);
  expect(results.children).toBe(first);
  button.dispatchEvent(new Event('click')); expect(retry).toHaveBeenCalledOnce();
  const pointer = new Event('pointerdown'); const stop = vi.spyOn(pointer, 'stopPropagation');
  root.dispatchEvent(pointer); expect(stop).toHaveBeenCalledOnce();
  overlay.setVisible(false); expect(overlay.visible).toBe(false);
  overlay.setVisible(true, undefined, 60);
  expect(results.children.map(row => row.children[1].textContent)).toEqual(['1:00.0', '0', '0.0%']);
  overlay.setVisible(false);
  overlay.setVisible(true, { ...stats, shotsHit: 80 }, 120);
  expect(results.children[2].children[1].textContent).toBe('80.0%');
  expect(root.children[2]).toBe(illustration);
  overlay.dispose(); expect(root.remove).toHaveBeenCalledOnce();
  button.dispatchEvent(new Event('click')); expect(retry).toHaveBeenCalledOnce();
});

it('reports zero-shot defeats without NaN accuracy', () => {
  expect(defeatResultRows({ gruntKills: 0, heavyKills: 0, giantKills: 0,
    shotsFired: 0, shotsHit: 0, grenadesUsed: 0 }, 0))
    .toEqual([['存活時間', '0:00.0'], ['擊殺總數', '0'], ['命中率', '0.0%']]);
});

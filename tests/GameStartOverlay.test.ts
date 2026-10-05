// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { readFileSync } from 'node:fs';
const stylesheet: string = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
import { afterEach, expect, it, vi } from 'vitest';
import { GameStartOverlay } from '../src/ui/GameStartOverlay';

class Element {
  type = ''; className = ''; textContent = ''; disabled = false; removed = false;
  children: Element[] = []; attributes = new Map<string, string>();
  classes = new Set<string>(); classList = { add: (name: string) => this.classes.add(name) };
  focus = vi.fn();
  append(child: Element) { this.children.push(child); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  remove() { this.removed = true; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('offers a real focusable button, gives activation feedback, and removes its DOM after start', () => {
  vi.useFakeTimers();
  const tags: string[] = [];
  vi.stubGlobal('document', { createElement: (tag: string) => { tags.push(tag); return new Element(); } });
  const viewport = new Element();
  const overlay = new GameStartOverlay(viewport as unknown as HTMLElement);
  overlay.show();
  const button = viewport.children[0];
  expect(tags).toEqual(['button', 'span']);
  expect(button.type).toBe('button');
  expect(button.attributes.get('aria-label')).toBe('Start game with audio');
  expect(button.children[0].textContent).toBe('TAP TO START');
  expect(button.disabled).toBe(false);
  overlay.setActivating();
  expect(button.attributes.get('aria-busy')).toBe('true');
  expect(button.classes.has('is-activating')).toBe(true);
  overlay.finish();
  expect(button.disabled).toBe(true);
  expect(button.classes.has('is-leaving')).toBe(true);
  vi.advanceTimersByTime(160);
  expect(button.removed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps the battlefield visible and uses raw safe-area insets around the gesture surface', () => {
  const css = stylesheet.split('.game-start-overlay {')[1].split('}')[0];
  expect(css).toContain('background: transparent');
  expect(css).toContain('inset: 0');
  for (const edge of ['top', 'right', 'bottom', 'left']) expect(css).toContain(`--hud-inset-${edge}`);
  expect(css).not.toContain('animation:');
});

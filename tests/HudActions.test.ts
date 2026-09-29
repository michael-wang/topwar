import { afterEach, describe, expect, it, vi } from 'vitest';
import { HudActions } from '../src/ui/HudActions';

class ElementStub extends EventTarget {
  className = '';
  type = '';
  textContent = '';
  title = '';
  removed = false;
  readonly children: ElementStub[] = [];
  private readonly attributes = new Map<string, string>();
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  getAttribute(key: string): string | undefined { return this.attributes.get(key); }
  remove(): void { this.removed = true; }
}

afterEach(() => vi.unstubAllGlobals());

describe('HUD actions', () => {
  it('reflects Pause/Resume state and invokes the shared toggle callback', () => {
    vi.stubGlobal('document', { createElement: () => new ElementStub() });
    const viewport = new ElementStub();
    const toggle = vi.fn();
    const actions = new HudActions(viewport as unknown as HTMLElement, toggle);
    const root = viewport.children[0];
    const button = root.children[0];
    expect(button.getAttribute('aria-label')).toBe('Pause game');
    expect(button.textContent).toBe('Ⅱ');
    button.dispatchEvent(new Event('click'));
    expect(toggle).toHaveBeenCalledOnce();
    actions.setPaused(true);
    expect(button.getAttribute('aria-label')).toBe('Resume game');
    expect(button.textContent).toBe('▶');
    actions.setPaused(false);
    expect(button.getAttribute('aria-label')).toBe('Pause game');
    const pointer = new Event('pointerdown');
    const stop = vi.spyOn(pointer, 'stopPropagation');
    root.dispatchEvent(pointer);
    expect(stop).toHaveBeenCalledOnce();
    actions.dispose();
    expect(root.removed).toBe(true);
    button.dispatchEvent(new Event('click'));
    expect(toggle).toHaveBeenCalledOnce();
  });
});

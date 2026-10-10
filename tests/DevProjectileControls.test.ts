import { afterEach, expect, it, vi } from 'vitest';
import { DEV_TRACERS, DevProjectileControls } from '../src/ui/DevProjectileControls';

class ElementStub extends EventTarget {
  children: ElementStub[] = [];
  style = { cssText: '', background: '' };
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  textContent = ''; title = ''; blur = vi.fn(); remove = vi.fn();
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  append(child: ElementStub) { this.children.push(child); }
}
afterEach(() => vi.unstubAllGlobals());

it('defaults to P1, exposes accessible 48px controls and applies live styles using one geometry', () => {
  vi.stubGlobal('document', { createElement: () => new ElementStub() });
  const select = vi.fn(), close = vi.fn();
  const controls = new DevProjectileControls(new ElementStub() as unknown as HTMLElement, select, close);
  const root = controls.element as unknown as ElementStub;
  const geometry = select.mock.lastCall![0].geometry;
  expect(root.children[0].textContent).toContain('TRACER: P1');
  for (const [index, variant] of ['P1', 'P2', 'P3'].entries()) {
    const button = root.children[index + 1]; button.dispatchEvent(new Event('click'));
    expect(button.style.cssText).toContain('min-height:48px');
    expect(button.blur).toHaveBeenCalledOnce(); expect(button.attrs['aria-pressed']).toBe('true');
    expect(root.children.slice(1).filter(b => b.attrs['aria-pressed'] === 'true')).toHaveLength(1);
    expect(root.children[0].textContent).toContain(`TRACER: ${variant}`);
    expect(select.mock.lastCall![0]).toEqual({ ...DEV_TRACERS[variant as keyof typeof DEV_TRACERS], geometry });
  }
  expect(close).toHaveBeenCalledTimes(3);
  const disposal = vi.spyOn(geometry, 'dispose'); controls.dispose();
  expect(root.remove).toHaveBeenCalledOnce(); expect(disposal).not.toHaveBeenCalled();
  geometry.dispose();
});

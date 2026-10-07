import { afterEach, expect, it, vi } from 'vitest';
import { ControlHint } from '../src/ui/ControlHint';

afterEach(() => vi.unstubAllGlobals());
it.each([false, true])('shows only device-appropriate defense movement (coarse=%s)', coarse => {
  const element = { className: '', textContent: '', innerHTML: '', remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => element });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: coarse }) });
  const viewport = { append: vi.fn() };
  const hint = new ControlHint(viewport as unknown as HTMLElement, true);
  expect(element.textContent).toBe(coarse ? 'HOLD ARROWS TO MOVE' : 'A / D or ← / →   STEP LANE');
  expect(element.textContent).not.toMatch(/PAUSE|TUNE|ESC|SPACE/);
  expect(element.innerHTML).toBe('');
  hint.dispose(); expect(element.remove).toHaveBeenCalledOnce();
});

it('retains legacy keyboard hints', () => {
  const element = { className: '', innerHTML: '', remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => element });
  const hint = new ControlHint({ append: vi.fn() } as unknown as HTMLElement);
  expect(element.innerHTML).toContain('PAUSE');
  expect(element.innerHTML).toContain('TUNE');
  hint.dispose();
});

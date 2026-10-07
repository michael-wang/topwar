import { afterEach, expect, it, vi } from 'vitest';
import { ControlHint } from '../src/ui/ControlHint';

afterEach(() => vi.unstubAllGlobals());
it('retains legacy keyboard hints', () => {
  const element = { className: '', innerHTML: '', remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => element });
  const hint = new ControlHint({ append: vi.fn() } as unknown as HTMLElement);
  expect(element.innerHTML).toContain('PAUSE');
  expect(element.innerHTML).toContain('TUNE');
  hint.dispose();
});

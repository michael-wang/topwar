import { afterEach, expect, it, vi } from 'vitest';
import { DevFps } from '../src/ui/DevFps';
afterEach(() => vi.unstubAllGlobals());
it('uses actual RAF intervals, changes DOM at most three times per second and discards sleep/pause gaps', () => {
  let writes = 0, text: string | null = null;
  const element = { className: '', style: { cssText: '' }, remove: vi.fn(),
    get textContent() { return text; }, set textContent(v: string | null) { text = v; writes++; } };
  vi.stubGlobal('document', { createElement: () => element });
  const fps = new DevFps({ append() {} } as unknown as HTMLElement);
  expect(element.style.cssText).toContain('700 14px');
  expect(element.style.cssText).not.toMatch(/background:|border:|padding:/);
  expect(element.style.cssText).toContain('+ 50px');
  for (let i = 0; i < 31; i++) fps.frame(i * 1000 / 30, true);
  expect(text).toBe('FPS 30'); expect(writes).toBeLessThanOrEqual(4);
  fps.reset('PAUSED'); fps.frame(100_000, false); expect(text).toBe('PAUSED');
  fps.reset(); for (let i = 0; i < 31; i++) fps.frame(200_000 + i * 1000 / 60, true);
  expect(text).toBe('FPS 60'); fps.frame(300_000, true); expect(text).toBe('FPS —'); fps.dispose();
});

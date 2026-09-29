import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBuildLabel, mountBuildLabel, refreshDevBuildLabel } from '../src/ui/BuildLabel';

afterEach(() => vi.unstubAllGlobals());

describe('build label', () => {
  it('formats a package version and seven-character Git SHA with a metadata fallback', () => {
    expect(formatBuildLabel('0.1.0', 'fd060e5599b1d7ff')).toBe('v0.1.0 · fd060e5');
    expect(formatBuildLabel('0.1.0', '')).toBe('v0.1.0 · unknown');
    expect(formatBuildLabel('0.1.0', 'invalid')).toBe('v0.1.0 · unknown');
  });

  it('mounts one unobtrusive label inside the viewport', () => {
    const element = { className: '', textContent: '' };
    vi.stubGlobal('document', { createElement: vi.fn(() => element) });
    const viewport = { append: vi.fn() } as unknown as HTMLElement;
    mountBuildLabel(viewport, '0.1.0', 'abcdef123');
    expect(element.className).toBe('build-label');
    expect(element.textContent).toBe('v0.1.0 · abcdef1');
    expect(viewport.append).toHaveBeenCalledWith(element);
  });

  it('reads the local dev SHA once and falls back to the injected SHA', async () => {
    const label = { textContent: '' } as HTMLElement;
    const load = vi.fn(async () => ({ ok: true, json: async () => ({ shortSha: 'abcdef123' }) }));
    await refreshDevBuildLabel(label, '0.1.0', '1234567', load);
    expect(load).toHaveBeenCalledWith('/__topwar/build-info', { cache: 'no-store' });
    expect(label.textContent).toBe('v0.1.0 · abcdef1');
    await refreshDevBuildLabel(label, '0.1.0', '1234567',
      async () => ({ ok: true, json: async () => ({ shortSha: 'unknown' }) }));
    expect(label.textContent).toBe('v0.1.0 · 1234567');
    await refreshDevBuildLabel(label, '0.1.0', '1234567',
      async () => { throw new Error('unavailable'); });
    expect(label.textContent).toBe('v0.1.0 · 1234567');
  });
});

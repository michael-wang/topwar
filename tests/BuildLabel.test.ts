import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBuildLabel, mountBuildLabel } from '../src/ui/BuildLabel';

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
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBuildLabel, mountBuildLabel, refreshDevBuildLabel } from '../src/ui/BuildLabel';
// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { readFileSync } from 'node:fs';
const css: string = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('build label', () => {
  it('uses raw defense safe-area inset plus 3px without the normal HUD margin', () => {
    const rule = css.match(/\.beachhead-defense \.build-label\s*\{([^}]+)\}/)![1];
    expect(rule).toContain('right: calc(var(--hud-inset-right) + 3px)');
    expect(rule).toContain('bottom: calc(var(--hud-inset-bottom) + 3px)');
    expect(rule).not.toMatch(/(?:right|bottom):\s*3px/);
    expect(rule).not.toContain('--hud-safe-');
    const xp = css.match(/\.xp-hud\s*\{([^}]+)\}/)![1];
    expect(xp).toContain('left: var(--hud-safe-left); right: var(--hud-safe-right); bottom: var(--hud-safe-bottom)');
    expect(css).toContain('--hud-safe-bottom: calc(var(--hud-inset-bottom) + var(--hud-margin))');
  });
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

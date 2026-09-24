import { afterEach, describe, expect, it, vi } from 'vitest';
import { DamageFlashOverlay } from '../src/ui/DamageFlashOverlay';

afterEach(() => vi.unstubAllGlobals());

describe('DamageFlashOverlay', () => {
  it('restarts normal/fatal flashes and clears them on reset and dispose', () => {
    const classes = new Set<string>();
    const element = { className: '', offsetWidth: 1, setAttribute: vi.fn(), remove: vi.fn(),
      classList: { add: (value: string) => classes.add(value),
        remove: (...values: string[]) => values.forEach((value) => classes.delete(value)) } };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: () => element });
    const overlay = new DamageFlashOverlay({ append } as unknown as HTMLElement);
    expect(append).toHaveBeenCalledWith(element);
    expect(element.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
    overlay.flash(false);
    expect(classes.has('damage-flash-overlay--normal')).toBe(true);
    overlay.flash(true);
    expect(classes.has('damage-flash-overlay--normal')).toBe(false);
    expect(classes.has('damage-flash-overlay--fatal')).toBe(true);
    overlay.reset();
    expect(classes.size).toBe(0);
    overlay.dispose();
    expect(element.remove).toHaveBeenCalledOnce();
  });
});

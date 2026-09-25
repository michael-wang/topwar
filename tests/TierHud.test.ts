import { afterEach, describe, expect, it, vi } from 'vitest';
import { TierHud } from '../src/ui/TierHud';

afterEach(() => vi.unstubAllGlobals());

describe('TierHud', () => {
  it('updates only on tier changes and removes its element on dispose', () => {
    const remove = vi.fn();
    const element = { className: '', textContent: '', style: { borderColor: '' }, remove };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => element) });
    const hud = new TierHud({ append } as unknown as HTMLElement);
    expect(append).toHaveBeenCalledOnce();
    expect(element.className).toBe('tier-hud');
    expect(element.textContent).toBe('ENEMY LV 1');
    const color = element.style.borderColor;
    hud.setTier(1);
    expect(element.textContent).toBe('ENEMY LV 1');
    expect(element.style.borderColor).toBe(color);
    hud.setTier(2);
    expect(element.textContent).toBe('ENEMY LV 2');
    expect(element.style.borderColor).not.toBe(color);
    hud.setTier(1);
    expect(element.textContent).toBe('ENEMY LV 1');
    hud.dispose();
    expect(remove).toHaveBeenCalledOnce();
  });
});

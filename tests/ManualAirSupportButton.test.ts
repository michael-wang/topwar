import { expect, it, vi } from 'vitest';
import { ManualAirSupportButton } from '../src/ui/ManualAirSupportButton';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
class ElementStub extends EventTarget {
  type = ''; className = ''; title = ''; innerHTML = ''; hidden = true; disabled = true;
  style = { cssText: '', display: '' }; attrs: Record<string, string> = {}; remove = vi.fn(); append = vi.fn();
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  querySelector() { return { style: { cssText: '' } }; }
}
it('uses native click activation, gates readiness/playing state and latches repeated activation immediately', () => {
  vi.stubGlobal('document', { createElement: () => new ElementStub() });
  try {
    const call = vi.fn(() => true), control = new ManualAirSupportButton(new ElementStub() as unknown as HTMLElement, call);
    const button = control.element as unknown as ElementStub;
    const sim = createDevReviewFixture({ seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1, startRocketCount: 0, tiers: config.tiers,
      catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } }, 27, 'manual-air-3');
    const s = sim.getState(); control.update(s, true); expect(button.hidden).toBe(true);
    s.commanderSupport!.airstrike!.manual = { availableAtSeconds: 60, announcementAtSeconds: 60, ready: true };
    control.update(s, false); expect(button.hidden).toBe(false); expect(button.disabled).toBe(true);
    button.dispatchEvent(new Event('click')); expect(call).not.toHaveBeenCalled();
    control.update(s, true); expect(button.attrs['aria-label']).toBe('呼叫空襲'); expect(button.type).toBe('button');
    button.dispatchEvent(new Event('click')); button.dispatchEvent(new Event('click')); expect(call).toHaveBeenCalledOnce();
    const pointer = new Event('pointerdown'), stop = vi.spyOn(pointer, 'stopPropagation'); button.dispatchEvent(pointer); expect(stop).toHaveBeenCalledOnce();
    s.commanderSupport!.airstrike!.status = 'waiting'; control.update(s, true); expect(button.hidden).toBe(true);
    s.commanderSupport!.airstrike!.status = 'ready'; s.defenseTank!.status = 'defeated'; control.update(s, true); expect(button.hidden).toBe(true);
    control.reset(); expect(button.disabled).toBe(true); control.dispose(); expect(button.remove).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});

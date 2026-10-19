import { expect, it, vi } from 'vitest';
import { CommanderFocus } from '../src/ui/CommanderFocus';
class Element {
  hidden = false; style = {}; children: Element[] = []; attributes: Record<string,string> = {};
  append(e: Element) { this.children.push(e); }
  setAttribute(k: string, v: string) { this.attributes[k] = v; }
  remove() {}
}
it('keeps a single stationary area, replaces cues, recalculates resize and clears invalid/hidden targets', () => {
  vi.stubGlobal('document', { createElement: () => new Element() });
  try {
    const host = new Element(), focus = new CommanderFocus(host as unknown as HTMLElement);
    const a = { x: 20, y: 100, width: 90, height: 60 }, b = { ...a, x: 60 };
    focus.update('giant:0', a, '350:844', false);
    expect(host.children).toHaveLength(1); expect(focus.element.hidden).toBe(false);
    const probe = vi.fn(() => b);
    focus.update('giant:0', probe, '350:844', true); expect(probe).not.toHaveBeenCalled();
    expect(focus.element.style.left).toBe('20px');
    expect((focus.element as unknown as Element).attributes['data-paused']).toBe('true');
    focus.update('tankBoss:0', b, '350:844', false); expect(focus.element.style.left).toBe('60px');
    focus.update('tankBoss:0', a, '390:844', false); expect(focus.element.style.left).toBe('20px');
    focus.update('tankBoss:0', null, '390:844', false); expect(focus.element.hidden).toBe(false);
    focus.update('destroyer', null, '390:844', false); expect(focus.element.hidden).toBe(true);
    focus.update('airSupportReady:0', b, '390:844', false);
    focus.update(null, b, '390:844', false); expect(focus.element.hidden).toBe(true);
    focus.clear(); expect(focus.element.hidden).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});

import { afterEach, expect, it, vi } from 'vitest';
import { XpHud } from '../src/ui/XpHud';
class Element {
  children: Element[] = []; className = ''; textContent = ''; style: Record<string, string> = {};
  classes = new Set<string>(); classList = { toggle: (key: string, on: boolean) => on ? this.classes.add(key) : this.classes.delete(key), remove: (key: string) => this.classes.delete(key) };
  append(...children: Element[]): void { this.children.push(...children); }
  remove(): void {}
}
afterEach(() => vi.unstubAllGlobals());
it('projects XP truth and a nonblocking 800ms level beat, and resets on Retry', () => {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const viewport = new Element(); const hud = new XpHud(viewport as unknown as HTMLElement);
  const balance = { firstLevelXp: 16, xpRequirementStep: 12, gruntKillXp: 1, heavyKillXp: 10, fireRatePerLevel: 1 };
  expect(hud.update({ level: 1, xp: 8 }, balance, 0)).toBe(false);
  const root = viewport.children[0];
  expect(root.children[0].textContent).toBe('LV 1   8 / 16');
  expect(root.children[1].children[0].style.width).toBe('50%');
  expect(hud.update({ level: 2, xp: 7 }, balance, 100)).toBe(true);
  expect(root.classes.has('level-up')).toBe(true);
  expect(root.children[2].textContent).toBe('LEVEL UP · FIRE RATE +1');
  hud.update({ level: 2, xp: 7 }, balance, 901);
  expect(root.classes.has('level-up')).toBe(false);
  hud.reset(); expect(hud.update({ level: 1, xp: 0 }, balance, 0)).toBe(false);
});

import { afterEach, expect, it, vi } from 'vitest';
import { XpHud } from '../src/ui/XpHud';
class Element {
  children: Element[] = []; className = ''; textContent = ''; style: Record<string, string> = {};
  classes = new Set<string>(); classList = { toggle: (key: string, on: boolean) => on ? this.classes.add(key) : this.classes.delete(key), remove: (key: string) => this.classes.delete(key) };
  append(...children: Element[]): void { this.children.push(...children); }
  remove(): void {}
}
const balance = { xpRequirements: [28, 60, 110, 180, 280, 420], xpFallbackMultiplier: 1.45, gruntKillXp: 1, heavyKillXp: 10, fireRatePerLevel: 1, fireRateTaperStartLevel: 5, fireRateTaperFirstGain: .5, fireRateTaperDecay: .8 };
function make() {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const viewport = new Element(); const hud = new XpHud(viewport as unknown as HTMLElement);
  return { hud, root: viewport.children[0] };
}
afterEach(() => vi.unstubAllGlobals());
it('shows only the level and truthful fill percentage, with anticipation at 70/90 percent', () => {
  const { hud, root } = make();
  hud.update({ level: 1, xp: 14 }, balance, 0);
  expect(root.children[0].textContent).toBe('LV 1');
  expect(root.children[1].children[0].style.clipPath).toBe('inset(0 50% 0 0 round .45rem)');
  expect(root.classes.has('xp-charged')).toBe(false);
  hud.update({ level: 1, xp: 20 }, balance, 100);
  expect(root.classes.has('xp-charged')).toBe(true);
  expect(root.classes.has('xp-imminent')).toBe(false);
  hud.update({ level: 1, xp: 26 }, balance, 200);
  expect(root.classes.has('xp-imminent')).toBe(true);
});
it('flashes full then resets cleanly to new-level truth, pops the label and expires without pausing', () => {
  const { hud, root } = make(); const fill = root.children[1].children[0];
  hud.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 }, 100);
  hud.update({ level: 2, xp: 15 }, balance, 100);
  expect(root.classes.has('level-up')).toBe(true);
  expect(fill.style.clipPath).toBe('inset(0 0% 0 0 round .45rem)'); expect(root.children[0].textContent).toBe('LV 1');
  expect(root.children[2].children.map(child => child.textContent)).toEqual(['LEVEL UP', 'FIRE RATE ↑']);
  hud.update({ level: 2, xp: 15 }, balance, 250);
  expect(root.children[0].textContent).toBe('LV 2'); expect(root.classes.has('level-label-pop')).toBe(true);
  hud.update({ level: 2, xp: 15 }, balance, 341);
  expect(fill.style.clipPath).toBe('inset(0 75% 0 0 round .45rem)'); expect(fill.style.transition).toBe('none');
  hud.update({ level: 2, xp: 16 }, balance, 360);
  expect(fill.style.transition).toBe('clip-path 120ms ease-out');
  hud.update({ level: 2, xp: 16 }, balance, 901);
  expect(root.classes.has('level-up')).toBe(false);
  hud.reset(); expect(fill.style.clipPath).toBe('inset(0 100% 0 0 round .45rem)'); expect(root.children[0].textContent).toBe('LV 1');
});

it('reveals a full-track gradient with a mask rather than resizing the gradient', () => {
  const {hud,root}=make();
  for(const percentage of [15,50,75,90,99]) {
    hud.update({level:3,xp:percentage}, {...balance,xpRequirements:[28,60,100]},percentage);
    const track=root.children[1],fill=track.children[0],edge=track.children[1];
    expect(Number.parseFloat(fill.style.clipPath.split(' ')[1])).toBeCloseTo(100-percentage);
    expect(fill.style.width).toBeUndefined();
    expect(Number.parseFloat(edge.style.left)).toBe(percentage);
    expect(root.children[0].textContent).toBe('LV 3');
  }
});

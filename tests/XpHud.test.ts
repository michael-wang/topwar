import { afterEach, expect, it, vi } from 'vitest';
import { XpHud } from '../src/ui/XpHud';
class Element {
  children: Element[] = []; className = ''; textContent = ''; style: Record<string, string> = {};
  classes = new Set<string>(); classList = { toggle: (key: string, on: boolean) => on ? this.classes.add(key) : this.classes.delete(key), remove: (key: string) => this.classes.delete(key) };
  append(...children: Element[]): void { this.children.push(...children); }
  remove(): void {}
}
const balance = { xpRequirements: [28, 60, 110, 180, 280, 420], xpFallbackMultiplier: 1.45, gruntKillXp: 1, heavyKillXp: 10, fireRatePerLevel: 1, fireRateTaperStartLevel: 5, fireRateTaperFirstGain: .5, fireRateTaperDecay: .8, reinforcementLevel: 7, reinforcementArrivalSeconds: 1.1, reinforcementSpacing: .72, reinforcementStagger: .18 };
function make() {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const viewport = new Element(); const hud = new XpHud(viewport as unknown as HTMLElement);
  return { hud, root: viewport.children[0] };
}
afterEach(() => vi.unstubAllGlobals());
it('shows only the level and truthful fill percentage, with anticipation at 70/90 percent', () => {
  const { hud, root } = make();
  hud.update({ level: 1, xp: 14 }, balance, 0);
  expect(root.style.pointerEvents).toBe('none');
  expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 1');
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
  expect(fill.style.clipPath).toBe('inset(0 0% 0 0 round .45rem)'); expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 1');
  expect(root.children[2].children.map(child => child.textContent)).toEqual(['LEVEL UP']);
  hud.update({ level: 2, xp: 15 }, balance, 250);
  expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 2'); expect(root.classes.has('level-label-pop')).toBe(true);
  hud.update({ level: 2, xp: 15 }, balance, 341);
  expect(fill.style.clipPath).toBe('inset(0 75% 0 0 round .45rem)'); expect(fill.style.transition).toBe('none');
  hud.update({ level: 2, xp: 16 }, balance, 360);
  expect(fill.style.transition).toBe('clip-path 120ms ease-out');
  hud.update({ level: 2, xp: 16 }, balance, 901);
  expect(root.classes.has('level-up')).toBe(false);
  hud.reset(); expect(fill.style.clipPath).toBe('inset(0 100% 0 0 round .45rem)'); expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 1');
});

it('reveals a full-track gradient with a mask rather than resizing the gradient', () => {
  const {hud,root}=make();
  for(const percentage of [20,50,75,90,99]) {
    hud.update({level:3,xp:percentage}, {...balance,xpRequirements:[28,60,100]},percentage);
    const track=root.children[1],fill=track.children[0],edge=track.children[1];
    expect(Number.parseFloat(fill.style.clipPath.split(' ')[1])).toBeCloseTo(100-percentage);
    expect(fill.style.width).toBeUndefined();
    expect(Number.parseFloat(edge.style.left)).toBe(percentage);
    expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 3');
  }
});


it('visibly interpolates a large Giant XP grant without numeric text and keeps the reinforcement beat free of explanatory text', () => {
  const { hud, root } = make(); const fill = root.children[1].children[0];
  hud.update({ level: 6, xp: 40 }, balance, 0);
  hud.update({ level: 6, xp: 160 }, balance, 100);
  expect(fill.style.transition).toBe('clip-path 260ms ease-out');
  expect(Number.parseFloat(fill.style.clipPath.split(' ')[1])).toBeCloseTo(100 - 160 / 420 * 100);
  expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 6');
  hud.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 6, toLevel: 7 }, 500);
  hud.update({ level: 7, xp: 0 }, balance, 600);
  expect(root.children[2].children.map(child => child.textContent)).toEqual(['LEVEL UP']);
  hud.reset(); hud.update({ level: 1, xp: 1 }, balance, 1000);
  expect(fill.style.transition).toBe('clip-path 120ms ease-out');
});

it('uses a deep-sea XP edge early and a sunlight crest near full without changing the frame/mask semantics', () => {
  const { hud, root } = make(), edge = root.children[1].children[1];
  const testBalance = { ...balance, xpRequirements: [100] };
  hud.update({ level: 1, xp: 20 }, testBalance, 0);
  expect(edge.style.color).toBe('#2b8ea4');
  hud.update({ level: 1, xp: 90 }, testBalance, 100);
  expect(edge.style.color).toBe('#f7cd76');
  expect(root.classes.has('xp-imminent')).toBe(true);
});


it('gives level a dedicated large number and keeps the HUD container structural', () => {
  const {hud, root} = make();
  hud.update({level:4, xp:30}, balance, 0);
  expect(root.className).toBe('xp-hud');
  const badge = root.children[0];
  expect(badge.children.map(child => [child.className, child.textContent])).toEqual([
    ['xp-level-prefix', 'LV'], ['xp-level-number', '4']]);
  expect(root.children[1].className).toBe('xp-track');
});

it('uses icon-only loadout identity and truthful active reinforcement, resetting on Retry', () => {
  const {hud,root}=make(), context={baseFireRate:3,squadCount:1,initialSquadCount:1,reinforcementArrived:false};
  hud.update({level:3,xp:10},balance,0,context);
  const loadout=root.children[3], trait=loadout.children[1];
  expect(loadout.children[0].className).toBe('xp-weapon-slot');
  expect(trait.className).toBe('xp-enhancement-slot xp-power');
  expect((loadout.children[0].children[0] as unknown as HTMLElement).innerHTML).toContain('viewBox="0 0 44 20"');
  expect(trait.children[1].textContent).toBe('+67%');
  expect(loadout.children[0].textContent).toBe('');
  hud.update({level:7,xp:0},balance,100,context);
  expect(trait.children[1].textContent).toBe('+130%');
  hud.update({level:7,xp:0},balance,1200,{...context,squadCount:2,reinforcementArrived:true});
  expect(trait.children[1].textContent).toBe('×2');
  hud.reset(); expect(trait.children[1].textContent).toBe('');
});

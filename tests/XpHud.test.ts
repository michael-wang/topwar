import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { afterEach, expect, it, vi } from 'vitest';
import { XpHud } from '../src/ui/XpHud';
class Element {
  dataset: Record<string, string> = {}; children: Element[] = []; className = ''; textContent = ''; style: Record<string, string> = {};
  classes = new Set<string>(); classList = { toggle: (key: string, on: boolean) => on ? this.classes.add(key) : this.classes.delete(key), remove: (key: string) => this.classes.delete(key) };
  append(...children: Element[]): void { this.children.push(...children); }
  remove(): void {}
}
const balance = GameConfigSchema.parse(data).catharsis!.progression;
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
  hud.update({ level: 4, xp: 40 }, balance, 0);
  hud.update({ level: 4, xp: 160 }, balance, 100);
  expect(fill.style.transition).toBe('clip-path 260ms ease-out');
  expect(Number.parseFloat(fill.style.clipPath.split(' ')[1])).toBeCloseTo(100 - 160 / 180 * 100);
  expect(root.children[0].children.map(child => child.textContent).join(' ')).toBe('LV 4');
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

it.each([[1,'cartridge',1],[2,'cartridge',2],[3,'cartridge',3],[4,'soldier',2],[5,'soldier',3],[6,'cartridge',1]] as const)(
  'renders Level %i with three %s silhouettes and %i filled', (level,kind,stage)=>{
    const {hud,root}=make();hud.update({level,xp:0},balance,0);
    const loadout=root.children[3],trait=loadout.children[1];
    expect(loadout.children[0].className).toBe('xp-weapon-slot');
    expect((loadout.children[0].children[0] as unknown as HTMLElement).innerHTML).toContain('viewBox="0 0 44 20"');
    expect(trait.children).toHaveLength(3);
    expect(trait.children.filter(pip=>pip.className.includes('is-filled'))).toHaveLength(stage);
    expect(trait.children.every(pip=>pip.className.includes(`xp-pip-${kind}`))).toBe(true);
    expect(trait.children.map(pip=>pip.textContent).join('')).toBe('');
    for(const pip of trait.children.filter(pip=>pip.className.includes('is-empty')))
      expect((pip as unknown as HTMLElement).innerHTML).toContain('fill="none"');
    hud.reset();expect(trait.children.every(pip=>(pip as unknown as HTMLElement).innerHTML==='')).toBe(true);
  });
it('keeps the max-level bar full without charged or imminent animation and resets on Retry',()=>{
  const {hud,root}=make();hud.update({level:6,xp:0},balance,0);
  expect(root.children[1].children[0].style.clipPath).toBe('inset(0 0% 0 0 round .45rem)');
  expect(root.classes.has('xp-complete')).toBe(true);
  expect(root.classes.has('xp-charged')).toBe(false);expect(root.classes.has('xp-imminent')).toBe(false);
  expect(root.children[1].children[1].style.visibility).toBe('hidden');
  hud.reset();expect(root.classes.has('xp-complete')).toBe(false);
});

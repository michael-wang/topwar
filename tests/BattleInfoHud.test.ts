import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { afterEach, expect, it, vi } from 'vitest';
import { BattleInfoHud } from '../src/ui/BattleInfoHud';

class Element {
  dataset: Record<string, string> = {}; children: Element[] = []; className = ''; textContent = '';
  style: Record<string, string> = {}; hidden = false; innerHTML = ''; removed = false; ariaLabel = '';
  attributes: Record<string, string> = {};
  append(...children: Element[]): void { this.children.push(...children); }
  setAttribute(key: string, value: string): void { this.attributes[key] = value; }
  remove(): void { this.removed = true; }
}
const balance = GameConfigSchema.parse(data).catharsis!;
function make() {
  vi.stubGlobal('document', { createElement: () => new Element() });
  const viewport = new Element(), hud = new BattleInfoHud(viewport as unknown as HTMLElement);
  return { hud, root: viewport.children[0] };
}
afterEach(() => vi.unstubAllGlobals());

it.each([[1,'cartridge',1],[2,'cartridge',2],[3,'cartridge',3],[4,'soldier',2],[5,'soldier',3],[6,'cartridge',1]] as const)(
  'shows Lv%i permanent %s stage %i in a noninteractive battle panel', (level, kind, stage) => {
    const { hud, root } = make(); hud.update({ level, xp: 0 }, balance, 1, 3);
    expect(root.style.pointerEvents).toBe('none'); expect(root.attributes.role).toBe('group');
    expect(root.children[0].className).toBe('xp-weapon-slot');
    expect(root.children[0].children[0].innerHTML).toContain('viewBox="0 0 44 20"');
    const trait = root.children[2]; expect(trait.children).toHaveLength(3);
    expect(trait.children.filter(pip => pip.className.includes('is-filled'))).toHaveLength(stage);
    expect(trait.children.every(pip => pip.className.includes(`xp-pip-${kind}`))).toBe(true);
    for (const pip of trait.children.filter(pip => pip.className.includes('is-empty')))
      expect(pip.innerHTML).toContain('fill="none"');
    hud.reset(); expect(root.hidden).toBe(true);
    hud.update({ level: 1, xp: 0 }, balance, 1, 3); expect(root.hidden).toBe(false);
    expect(root.children[2].children.filter(pip => pip.className.includes('is-filled'))).toHaveLength(1);
    hud.dispose(); expect(root.removed).toBe(true);
  });
it('distinguishes living soldiers and total firing rate from permanent upgrade pips, then replaces Rifle with MG', () => {
  const { hud, root } = make(), identity = root.children[1], metrics = root.children[3];
  hud.update({ level: 5, xp: 210 }, balance, 3, 3);
  expect(identity.children.map(e => e.textContent)).toEqual(['RIFLE', 'STAGE III']);
  expect(metrics.children.map(row => row.children[1].textContent)).toEqual(['13.5', '3']);
  hud.update({ level: 5, xp: 210 }, balance, 2, 3);
  expect(metrics.children.map(row => row.children[1].textContent)).toEqual(['9', '2']);
  expect(root.children[2].children.filter(e => e.className.includes('is-filled'))).toHaveLength(3);
  const rifle = root.children[0].children[0].innerHTML;
  hud.update({ level: 6, xp: 0 }, balance, 1, 3);
  expect(root.dataset.weaponFamily).toBe('machineGun');
  expect(root.children[0].children[0].innerHTML).not.toBe(rifle);
  expect(identity.children.map(e => e.textContent)).toEqual(['MG', 'STAGE I']);
  expect(metrics.children.map(row => row.children[1].textContent)).toEqual(['18', '1']);
});
it('reflects runtime Rifle tuning and zero living soldiers truthfully', () => {
  const { hud, root } = make(), metrics = root.children[3];
  hud.update({ level: 4, xp: 0 }, balance, 2, 4);
  expect(metrics.children[0].children[1].textContent).toBe('12');
  hud.update({ level: 6, xp: 0 }, balance, 1, 4);
  expect(metrics.children[0].children[1].textContent).toBe('18');
  hud.update({ level: 6, xp: 0 }, balance, 0, 4);
  expect(metrics.children.map(row => row.children[1].textContent)).toEqual(['0', '0']);
});

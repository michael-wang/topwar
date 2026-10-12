import { afterEach, expect, it, vi } from 'vitest';
import { TankBossHud } from '../src/ui/TankBossHud';
import { startDefenseTank } from '../src/simulation/defenseTank';
import type { SimulationFrameState } from '../src/simulation/SimulationState';
import config from './helpers/ShippingConfig';

afterEach(() => vi.unstubAllGlobals());
it('reports actual Tank Grenade damage beside its accurate HP, freezes on Pause, expires and resets without replay', () => {
  const make = () => ({ hidden: false, textContent: '', style: {}, dataset: {}, children: [] as any[],
    append(...children: any[]) { this.children.push(...children); }, setAttribute: vi.fn(), remove: vi.fn() });
  vi.stubGlobal('document', { createElement: make });
  const hud = new TankBossHud(make() as unknown as HTMLElement), tank = startDefenseTank(0, 17, config.catharsis!.defenseTank!);
  tank.status = 'active'; tank.hp = 1941; tank.phase = 3;
  const state = { defenseTank: tank, catharsis: { balance: config.catharsis } } as unknown as SimulationFrameState;
  const root = hud.element as unknown as ReturnType<typeof make>, [label, bar, damage] = root.children;
  hud.update(state, 1000); expect(label.textContent).toContain('1941 / 6500');
  expect(bar.setAttribute).toHaveBeenCalledWith('aria-valuenow', '1941');
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [] }], 1000);
  expect(damage.hidden).toBe(true);
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [], tankDamage: 9 }], 1000);
  expect(damage.textContent).toBe('GRENADE −9 HP');
  for (let i = 0; i < 20; i++) hud.update(state, 1000);
  expect(damage.hidden).toBe(false); hud.update(state, 1750); expect(damage.hidden).toBe(true);
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [], tankDamage: 3 }], 1800);
  expect(damage.textContent).toBe('GRENADE −3 HP'); hud.reset(); hud.update(state, 1800);
  expect(damage.hidden).toBe(true); hud.dispose(); expect(root.remove).toHaveBeenCalledOnce();
});

import { afterEach, expect, it, vi } from 'vitest';
import { TankBossHud } from '../src/ui/TankBossHud';
import { startDefenseTank } from '../src/simulation/defenseTank';
import type { SimulationFrameState } from '../src/simulation/SimulationState';
import config from './helpers/ShippingConfig';

afterEach(() => vi.unstubAllGlobals());
it('reports actual Tank Grenade damage beside its accurate HP, freezes on Pause, expires and resets without replay', () => {
  const make = () => ({ hidden: false, textContent: '', style: {} as Record<string, string>, dataset: {}, children: [] as any[],
    append(...children: any[]) { this.children.push(...children); }, setAttribute: vi.fn(), remove: vi.fn() });
  vi.stubGlobal('document', { createElement: make });
  const hud = new TankBossHud(make() as unknown as HTMLElement), tank = startDefenseTank(0, 17, config.catharsis!.defenseTank!);
  tank.status = 'active'; tank.hp = 1941; tank.phase = 3;
  const state = { defenseTank: tank, catharsis: { balance: config.catharsis } } as unknown as SimulationFrameState;
  const root = hud.element as unknown as ReturnType<typeof make>, [bar, damage] = root.children, label = bar.children[1];
  const position = { x: 195, y: 240 };
  hud.update(state, 1000, position); expect(label.textContent).toBe('1941 / 6500');
  expect(root.style).toMatchObject({ left: '195px', top: '232px' });
  hud.update(state, 1000, { x: 175, y: 330 }); expect(root.style.top).toBe('322px');
  tank.status = 'entering'; hud.update(state, 1000, position); expect(root.hidden).toBe(true);
  tank.status = 'active'; hud.update(state, 1000, position); expect(root.hidden).toBe(false);
  expect(bar.setAttribute).toHaveBeenCalledWith('aria-valuenow', '1941');
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [] }], 1000);
  expect(damage.hidden).toBe(true);
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [], tankDamage: 9 }], 1000);
  expect(damage.textContent).toBe('榴彈 −9 HP');
  for (let i = 0; i < 20; i++) hud.update(state, 1000, position);
  expect(damage.hidden).toBe(false); hud.update(state, 1750, position); expect(damage.hidden).toBe(true);
  hud.presentGrenade([{ kind: 'grenadeDetonated', x: 0, z: 40, radius: 4, victims: [], tankDamage: 3 }], 1800);
  expect(damage.textContent).toBe('榴彈 −3 HP'); hud.reset(); hud.update(state, 1800, position);
  expect(damage.hidden).toBe(true); hud.dispose(); expect(root.remove).toHaveBeenCalledOnce();
});

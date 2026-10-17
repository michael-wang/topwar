import { expect, it } from 'vitest';
import { BattlefieldDiorama } from '../src/presentation/BattlefieldDiorama';
import type { GameRenderState } from '../src/rendering/RenderState';

it('authors only reusable decorative state with repeatable, nearby distant formations', () => {
  const base: GameRenderState = { player: { x: 0, z: 0 },
    squad: { count: 1, rifleCounts: [1], rocketCount: 0, formationSpacing: .45 },
    track: { halfWidth: 3.2, defenseLineZ: -1.5 }, enemies: [], projectiles: [] };
  const original = structuredClone(base), diorama = new BattlefieldDiorama(base);
  const first = structuredClone(diorama.sample(0));
  for (const t of [3500, 7000, 10500, 14000]) {
    const state = diorama.sample(t);
    expect(state).toBe(diorama.state);
    expect(state.enemies).toHaveLength(12);
    expect(state.enemies.every(enemy => enemy.z >= 24 && Math.abs(enemy.x) < 2)).toBe(true);
    expect(state.projectiles).toEqual([]);
    expect(state.artillery).toBeUndefined(); expect(state.commanderSupport).toBeUndefined();
  }
  expect(diorama.sample(0)).toEqual(first);
  expect(base).toEqual(original);
});

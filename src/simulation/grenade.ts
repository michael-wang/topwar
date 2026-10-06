import { z } from 'zod';
import type { GrenadeConfig } from '../config/grenadeConfig';
import type { SimulationFrameState } from './SimulationState';
import { attackLanePositions } from './enemies/laneComposition';

const finite = z.number().finite();
const clock = finite.nonnegative();
export const GrenadeStateSchema = z.strictObject({
  lv3EnteredAtSeconds: clock.nullable(), supplySpawnedAtSeconds: clock.nullable(),
  acquiredAtSeconds: clock.nullable(), inventory: z.union([z.literal(0), z.literal(1)]),
  supply: z.strictObject({ lane: z.number().int().nonnegative(), x: finite, depth: finite.positive() }).nullable(),
  flight: z.strictObject({ startX: finite, startZ: finite, targetX: finite, targetZ: finite,
    startedAtSeconds: clock, flightSeconds: finite.positive(), damageEnemyHp: finite.positive(),
    blastRadius: finite.positive() }).nullable(),
}).superRefine((s, ctx) => {
  const invalid = (s.supplySpawnedAtSeconds !== null && (s.lv3EnteredAtSeconds === null
    || s.supplySpawnedAtSeconds < s.lv3EnteredAtSeconds))
    || (s.acquiredAtSeconds !== null && (s.supplySpawnedAtSeconds === null || s.acquiredAtSeconds < s.supplySpawnedAtSeconds))
    || (!!s.supply !== (s.supplySpawnedAtSeconds !== null && s.acquiredAtSeconds === null))
    || ((s.inventory > 0 || s.flight !== null) && s.acquiredAtSeconds === null)
    || (s.flight !== null && (s.inventory !== 0 || s.flight.startedAtSeconds < s.acquiredAtSeconds!));
  if (invalid) ctx.addIssue({ code: 'custom', message: 'Inconsistent Grenade lifecycle' });
});
export type GrenadeState = z.infer<typeof GrenadeStateSchema>;
export type GrenadeEvent = { kind: 'grenadeAcquired' } | {
  kind: 'grenadeDetonated'; x: number; z: number; radius: number;
  victims: { id: number; archetype: 'grunt' | 'heavy' | 'giant'; damage: number; killed: boolean; killXp: number }[];
};
export const emptyGrenade = (): GrenadeState => ({ lv3EnteredAtSeconds: null,
  supplySpawnedAtSeconds: null, acquiredAtSeconds: null, inventory: 0, supply: null, flight: null });

type Enemy = SimulationFrameState['enemies'][number];
export function enemiesInBlast<T extends Enemy>(enemies: readonly T[], x: number, z: number, radius: number): T[] {
  return enemies.filter(e => e.hp > 0 && e.archetype !== undefined
    && (e.x - x) ** 2 + (e.z - z) ** 2 <= radius ** 2).sort((a, b) => a.id - b.id);
}

export function grenadeTarget(state: SimulationFrameState, config: GrenadeConfig): Enemy | undefined {
  if (!state.catharsis?.balance.defenseMode || !state.squad.count) return undefined;
  const anchors = state.enemies.filter(e => e.archetype !== undefined && e.hp > 0
    && e.lane === state.player.selectedLane && e.z > state.player.z
    && e.z - state.player.z <= config.throwRange);
  return anchors.map(enemy => ({ enemy, count: enemiesInBlast(state.enemies, enemy.x, enemy.z, config.blastRadius).length }))
    .sort((a, b) => b.count - a.count || a.enemy.z - b.enemy.z || a.enemy.id - b.enemy.id)[0]?.enemy;
}

export function placeGrenadeSupply(state: SimulationFrameState, config: GrenadeConfig): NonNullable<GrenadeState['supply']> {
  const c = state.catharsis!;
  const lanes = attackLanePositions(c.balance.laneCount, c.trackHalfWidth, c.balance.edgeInset);
  const candidates = lanes.map((x, lane) => {
    const ahead = state.enemies.filter(e => e.lane === lane && e.z > state.player.z);
    const nearest = Math.min(Infinity, ...ahead.map(e => e.z - state.player.z));
    const debt = ahead.filter(e => e.z - state.player.z <= config.throwRange).reduce((sum, e) => sum + e.hp, 0);
    return { lane, x, nearest, score: debt + Math.abs(lane - state.player.selectedLane!) * config.supplyLaneDistancePenalty };
  });
  const readable = candidates.filter(c => c.nearest >= config.supplyMinDepth + config.supplyFrontClearance);
  // Prefer a clear mid-field line. In an already surrounded state, use the most
  // open lane and move the supply closer rather than hiding it behind an enemy.
  const choice = readable.length ? readable.sort((a, b) => a.score - b.score || a.lane - b.lane)[0]
    : candidates.sort((a, b) => b.nearest - a.nearest || a.score - b.score || a.lane - b.lane)[0];
  return { lane: choice.lane, x: choice.x,
    depth: Math.min(config.supplyDepth, Math.max(config.supplyFrontClearance, choice.nearest - config.supplyFrontClearance)) };
}

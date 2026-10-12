import { z } from 'zod';
import { SeededRng } from '../core/Rng';
import type { DefenseTankConfig } from '../config/defenseTankConfig';
import type { SimulationState } from './SimulationState';
import type { ArtilleryShell } from './artillery';
import { attackLanePositions } from './enemies/laneComposition';

const clock = z.number().finite().nonnegative();
const schema = z.strictObject({ version: z.literal(1), status: z.enum(['entering', 'active', 'defeated', 'breached']),
  hp: z.number().finite().nonnegative(), phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  z: z.number().finite(), startedAtSeconds: clock, activeAtSeconds: clock,
  nextAttackAtSeconds: clock.nullable(), pendingImpactAtSeconds: clock.nullable(),
  nextFlankAtSeconds: clock, nextGiantAtSeconds: clock.nullable(),
  giantLane: z.union([z.literal(0), z.literal(4)]), rngState: z.number().int().min(0).max(0xffffffff),
  defeatedAtSeconds: clock.nullable(), lastHitAtSeconds: clock.nullable(),
});
export type DefenseTankState = z.infer<typeof schema>;
export const tankPhase = (hp: number, c: DefenseTankConfig): 1 | 2 | 3 =>
  hp / c.hp > c.phase2HpFraction ? 1 : hp / c.hp > c.phase3HpFraction ? 2 : 3;
export function startDefenseTank(now: number, seed: number, c: DefenseTankConfig): DefenseTankState {
  const active = now + c.entrySeconds;
  return { version: 1, status: 'entering', hp: c.hp, phase: 1, z: c.startZ,
    startedAtSeconds: now, activeAtSeconds: active, nextAttackAtSeconds: active,
    pendingImpactAtSeconds: null, nextFlankAtSeconds: active, nextGiantAtSeconds: null,
    giantLane: 0, rngState: (seed ^ c.streamSeed) >>> 0, defeatedAtSeconds: null, lastHitAtSeconds: null };
}
export function advanceTankPosition(tank: DefenseTankState, c: DefenseTankConfig, now: number, dt: number): void {
  if (tank.status === 'defeated' || tank.status === 'breached') return;
  if (now + 1e-9 < tank.activeAtSeconds) {
    const t = Math.max(0, (now - tank.startedAtSeconds) / c.entrySeconds);
    tank.z = c.startZ + (c.battleZ - c.startZ) * t;
  } else {
    const movingSeconds = Math.max(0, Math.min(dt, now - tank.activeAtSeconds));
    if (tank.status === 'entering') { tank.status = 'active'; tank.z = c.battleZ; }
    tank.z -= c.phases[tank.phase - 1].speedUnitsPerSecond * movingSeconds;
  }
}
// Sweep the projectile against the same rectangular armor in all three middle lanes.
export function tankHitZ(tank: Readonly<DefenseTankState> | undefined, c: DefenseTankConfig | undefined,
  lane: number | undefined, startZ: number, endZ: number): number | undefined {
  if (!tank || !c || tank.status !== 'active' || tank.hp <= 0 || lane === undefined || lane < 1 || lane > 3) return;
  const front = tank.z - c.halfDepth, back = tank.z + c.halfDepth;
  if (startZ > back || endZ < front) return;
  return Math.max(startZ, front);
}
export function tankInBlast(tank: Readonly<DefenseTankState>, c: DefenseTankConfig, x: number, z: number, radius: number): boolean {
  const dx = Math.max(0, Math.abs(x) - c.halfWidth), dz = Math.max(0, Math.abs(z - tank.z) - c.halfDepth);
  return tank.status === 'active' && tank.hp > 0 && dx * dx + dz * dz <= radius * radius;
}
function nextSlot(at: number, now: number, interval: number): number {
  return at + (Math.floor((now - at + 1e-9) / interval) + 1) * interval;
}
export function admitTankFlanks(frame: SimulationState, tank: DefenseTankState, c: DefenseTankConfig): void {
  if (tank.status !== 'active' || !frame.enemyStream || !frame.squad.count) return;
  const { balance, trackHalfWidth } = frame.catharsis!, now = frame.elapsedSeconds, p = c.phases[tank.phase - 1];
  const lanes = attackLanePositions(balance.laneCount, trackHalfWidth, balance.edgeInset);
  const spawn = (lane: number, archetype: 'grunt' | 'heavy' | 'giant', depth: number) => {
    const cursor = frame.enemyStream!;
    if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) throw Error('Tank flank enemy ID overflow');
    frame.enemies.push({ id: cursor.nextEnemyId++, tier: 1, archetype, lane, x: lanes[lane], z: depth,
      hp: archetype === 'giant' ? balance.giant.hp : archetype === 'heavy' ? balance.heavyHp : 1 });
  };
  if (now + 1e-9 >= tank.nextFlankAtSeconds) {
    for (const lane of [0, 4]) {
      for (let i = 0; i < p.heaviesPerLane + p.gruntsPerLane; i++)
        spawn(lane, i < p.heaviesPerLane ? 'heavy' : 'grunt', balance.defenseSpawnAheadDistance + i * balance.memberDepthSpacing);
    }
    tank.nextFlankAtSeconds = nextSlot(tank.nextFlankAtSeconds, now, p.flankIntervalSeconds);
  }
  if (p.giantIntervalSeconds !== null) {
    tank.nextGiantAtSeconds ??= now + p.giantIntervalSeconds;
    if (now + 1e-9 >= tank.nextGiantAtSeconds) {
      spawn(tank.giantLane, 'giant', balance.defenseSpawnAheadDistance);
      tank.giantLane = tank.giantLane === 0 ? 4 : 0;
      tank.nextGiantAtSeconds = nextSlot(tank.nextGiantAtSeconds, now, p.giantIntervalSeconds);
    }
  }
}
export function tankSalvo(tank: DefenseTankState, c: DefenseTankConfig, now: number,
  shells: readonly ArtilleryShell[], available: number): number[] {
  if (tank.status !== 'active') return [];
  if (tank.pendingImpactAtSeconds !== null) {
    if (shells.some(s => s.source.type === 'defenseTank')) return [];
    tank.nextAttackAtSeconds = tank.pendingImpactAtSeconds + c.phases[tank.phase - 1].cooldownSeconds;
    tank.pendingImpactAtSeconds = null;
  }
  const count = c.phases[tank.phase - 1].shells;
  if (tank.nextAttackAtSeconds === null || now + 1e-9 < tank.nextAttackAtSeconds || available < count) return [];
  const rng = new SeededRng(tank.rngState), pool = [0, 1, 2, 3, 4], lanes: number[] = [];
  for (let i = 0; i < count; i++) lanes.push(pool.splice(rng.nextInt(pool.length), 1)[0]);
  tank.rngState = rng.getState(); tank.nextAttackAtSeconds = null;
  return lanes;
}
export function validateDefenseTank(value: unknown, c: DefenseTankConfig, now: number, shells: readonly ArtilleryShell[]): DefenseTankState {
  const tank = schema.parse(value), active = shells.filter(s => s.source.type === 'defenseTank');
  if (tank.hp > c.hp || tank.phase !== tankPhase(tank.hp, c) || tank.startedAtSeconds > now
    || Math.abs(tank.activeAtSeconds - tank.startedAtSeconds - c.entrySeconds) > 1e-8
    || (tank.status === 'defeated') !== (tank.hp === 0) || (tank.status === 'defeated') !== (tank.defeatedAtSeconds !== null)
    || tank.defeatedAtSeconds !== null && tank.defeatedAtSeconds > now
    || tank.lastHitAtSeconds !== null && tank.lastHitAtSeconds > now
    || tank.status === 'entering' && now + 1e-9 >= tank.activeAtSeconds
    || tank.status === 'active' && now + 1e-9 < tank.activeAtSeconds
    || tank.z > c.startZ || tank.nextFlankAtSeconds < tank.activeAtSeconds
    || (tank.pendingImpactAtSeconds !== null ? tank.nextAttackAtSeconds !== null || !active.length
      || Math.abs(tank.pendingImpactAtSeconds - Math.max(...active.map(s => s.impactAtSeconds))) > 1e-8 : active.length > 0))
    throw Error('Invalid Defense tank checkpoint');
  return tank;
}

import { z } from 'zod';
import { SeededRng } from '../core/Rng';
import type { DefenseTankConfig } from '../config/defenseTankConfig';
import type { SimulationState, EnemySimulationState } from './SimulationState';
import type { ArtilleryShell } from './artillery';
import { attackLanePositions } from './enemies/laneComposition';

const clock = z.number().finite().nonnegative();
const rngState = z.number().int().min(0).max(0xffffffff);
const rhythm = z.strictObject({ cooldownRngState: rngState, gapRngState: rngState,
  pendingShots: z.array(z.strictObject({ targetLane: z.number().int().min(0).max(4), launchAtSeconds: clock })).max(2).readonly() });
export const TANK_ENTRANCE_CLEAR_FRACTION = .2;
export interface TankEntranceEvent {
  z: number;
  shockwave: boolean;
  victims: Pick<EnemySimulationState, 'id' | 'x' | 'z' | 'archetype'>[];
}
const schema = z.strictObject({ version: z.literal(1), status: z.enum(['entering', 'active', 'defeated', 'breached']),
  entranceCleared: z.boolean().optional(),
  hp: z.number().finite().nonnegative(), phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  z: z.number().finite(), startedAtSeconds: clock, activeAtSeconds: clock,
  nextAttackAtSeconds: clock.nullable(), pendingImpactAtSeconds: clock.nullable(),
  rhythm: rhythm.optional(),
  nextFlankAtSeconds: clock, nextGiantAtSeconds: clock.nullable(),
  giantLane: z.union([z.literal(0), z.literal(4)]), rngState: z.number().int().min(0).max(0xffffffff),
  defeatedAtSeconds: clock.nullable(), lastHitAtSeconds: clock.nullable(),
});
export type DefenseTankState = z.infer<typeof schema>;
export function copyDefenseTank(tank: DefenseTankState): DefenseTankState {
  return { ...tank, ...(tank.rhythm ? { rhythm: { ...tank.rhythm,
    pendingShots: tank.rhythm.pendingShots.map(s => ({ ...s })) } } : {}) };
}
export const tankPhase = (hp: number, c: DefenseTankConfig): 1 | 2 | 3 =>
  hp / c.hp > c.phase2HpFraction ? 1 : hp / c.hp > c.phase3HpFraction ? 2 : 3;
export function startDefenseTank(now: number, seed: number, c: DefenseTankConfig): DefenseTankState {
  const active = now + c.entrySeconds;
  return { version: 1, status: 'entering', entranceCleared: false, hp: c.hp, phase: 1, z: c.startZ,
    startedAtSeconds: now, activeAtSeconds: active, nextAttackAtSeconds: active,
    pendingImpactAtSeconds: null, nextFlankAtSeconds: active, nextGiantAtSeconds: null,
    ...(c.salvoPolicy ? { rhythm: { cooldownRngState: (seed ^ c.streamSeed ^ 0x434f4f4c) >>> 0,
      gapRngState: (seed ^ c.streamSeed ^ 0x47415053) >>> 0, pendingShots: [] } } : {}),
    giantLane: 0, rngState: (seed ^ c.streamSeed) >>> 0, defeatedAtSeconds: null, lastHitAtSeconds: null };
}
function entranceZ(tank: Readonly<DefenseTankState>, c: DefenseTankConfig, now: number): number {
  const t = Math.min(1, Math.max(0, (now - tank.startedAtSeconds) / c.entrySeconds));
  return c.startZ + (c.battleZ - c.startZ) * t;
}
export function clearTankEntrance(tank: DefenseTankState, c: DefenseTankConfig,
  enemies: EnemySimulationState[], previousEnemies: readonly EnemySimulationState[],
  now: number, dt: number, enemyRadius: number): TankEntranceEvent | null {
  if (tank.status !== 'entering') return null;
  const shockwave = !tank.entranceCleared
    && now + 1e-9 >= tank.startedAtSeconds + c.entrySeconds * TANK_ENTRANCE_CLEAR_FRACTION;
  if (shockwave) tank.entranceCleared = true;
  // Only sweep this step's remaining entrance, never the future route or active
  // combat motion. Both arrays still share indices before any admission/removal.
  const fraction = Math.max(0, Math.min(1, (tank.activeAtSeconds - (now - dt)) / dt));
  const endZ = entranceZ(tank, c, now - dt + dt * fraction);
  let victims: TankEntranceEvent['victims'] | undefined;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i], previous = previousEnemies[i];
    // The Tank is centered at world X=0. Use circle/rectangle contact, including
    // rounded corners, rather than lane membership or an inflated square zone.
    const dx = Math.max(0, Math.abs(enemy.x) - c.halfWidth);
    if (dx > enemyRadius) continue;
    const depth = c.halfDepth + Math.sqrt(Math.max(0, enemyRadius * enemyRadius - dx * dx));
    const from = previous.z - tank.z;
    const enemyEndZ = previous.z + (enemy.z - previous.z) * fraction;
    const to = enemyEndZ - endZ;
    if (Math.min(from, to) > depth || Math.max(from, to) < -depth) continue;
    const contact = from > depth ? (from - depth) / (from - to)
      : from < -depth ? (-depth - from) / (to - from) : 0;
    (victims ??= []).push({ id: enemy.id, x: enemy.x,
      z: previous.z + (enemyEndZ - previous.z) * contact, archetype: enemy.archetype });
    enemies.splice(i, 1); // Tank contact grants no player XP or kill credit.
  }
  return shockwave || victims ? { z: tank.z, shockwave, victims: victims ?? [] } : null;
}
export function advanceTankPosition(tank: DefenseTankState, c: DefenseTankConfig, now: number, dt: number): void {
  if (tank.status === 'defeated' || tank.status === 'breached') return;
  if (now + 1e-9 < tank.activeAtSeconds) {
    tank.z = entranceZ(tank, c, now);
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
    const speed = archetype === 'heavy' ? p.heavySpeedUnitsPerSecond : archetype === 'giant' ? p.giantSpeedUnitsPerSecond : undefined;
    if (!Number.isSafeInteger(cursor.nextEnemyId + 1)) throw Error('Tank flank enemy ID overflow');
    frame.enemies.push({ id: cursor.nextEnemyId++, tier: 1, archetype, lane, x: lanes[lane], z: depth,
      ...(speed !== undefined ? { bossFlankSpeedUnitsPerSecond: speed } : {}),
      hp: archetype === 'giant' ? balance.giant.hp : archetype === 'heavy' ? balance.heavyHp : 1 });
  };
  if (now + 1e-9 >= tank.nextFlankAtSeconds) {
    for (const lane of [0, 4]) {
      for (let i = 0; i < p.heaviesPerLane + p.gruntsPerLane; i++)
        spawn(lane, i < p.heaviesPerLane ? 'heavy' : 'grunt', (c.flankSpawnAheadDistance ?? balance.defenseSpawnAheadDistance) + i * balance.memberDepthSpacing);
    }
    tank.nextFlankAtSeconds = nextSlot(tank.nextFlankAtSeconds, now, p.flankIntervalSeconds);
  }
  if (p.giantIntervalSeconds !== null) {
    tank.nextGiantAtSeconds ??= now + p.giantIntervalSeconds;
    if (now + 1e-9 >= tank.nextGiantAtSeconds) {
      spawn(tank.giantLane, 'giant', c.flankSpawnAheadDistance ?? balance.defenseSpawnAheadDistance);
      tank.giantLane = tank.giantLane === 0 ? 4 : 0;
      tank.nextGiantAtSeconds = nextSlot(tank.nextGiantAtSeconds, now, p.giantIntervalSeconds);
    }
  }
}
export function tankSalvo(tank: DefenseTankState, c: DefenseTankConfig, now: number,
  shells: readonly ArtilleryShell[], available: number, lanePositions: readonly number[], playerX: number): number[] {
  if (tank.status !== 'active') return [];
  const pending = tank.rhythm?.pendingShots;
  if (pending?.length) {
    if (available < 1 || now + 1e-9 < pending[0].launchAtSeconds) return [];
    const shot = pending[0];
    // One actual shot per step, never catch up a burst after a long/blocked step.
    const delay = Math.max(0, now - shot.launchAtSeconds);
    tank.rhythm!.pendingShots = pending.slice(1).map(next => ({ ...next, launchAtSeconds: next.launchAtSeconds + delay }));
    return [shot.targetLane];
  }
  if (tank.pendingImpactAtSeconds !== null) {
    if (shells.some(s => s.source.type === 'defenseTank')) return [];
    tank.nextAttackAtSeconds = tank.pendingImpactAtSeconds + tankCooldown(tank, c);
    tank.pendingImpactAtSeconds = null;
  }
  const count = c.phases[tank.phase - 1].shells;
  if (tank.nextAttackAtSeconds === null || now + 1e-9 < tank.nextAttackAtSeconds || available < count) return [];
  // Aim at the physical position at launch, even during a lane transition.
  // Equal distances choose the lower lane index deterministically.
  const aimed = lanePositions.reduce((nearest, x, lane) =>
    Math.abs(x - playerX) < Math.abs(lanePositions[nearest] - playerX) ? lane : nearest, 0);
  const rng = new SeededRng(tank.rngState), pool = lanePositions.map((_, lane) => lane).filter(lane => lane !== aimed), lanes = [aimed];
  for (let i = 1; i < count; i++) lanes.push(pool.splice(rng.nextInt(pool.length), 1)[0]);
  tank.rngState = rng.getState(); tank.nextAttackAtSeconds = null;
  if (c.salvoPolicy?.mode === 'randomStaggered') {
    const gapRng = new SeededRng(tank.rhythm!.gapRngState), range = c.salvoPolicy.gapSeconds;
    let launchAtSeconds = now;
    tank.rhythm!.pendingShots = lanes.slice(1).map(targetLane => {
      launchAtSeconds += range.min + gapRng.nextFloat() * (range.max - range.min);
      return { targetLane, launchAtSeconds };
    });
    tank.rhythm!.gapRngState = gapRng.getState();
    return [lanes[0]];
  }
  return lanes;
}
function tankCooldown(tank: DefenseTankState, c: DefenseTankConfig): number {
  if (!c.salvoPolicy) return c.phases[tank.phase - 1].cooldownSeconds;
  const rng = new SeededRng(tank.rhythm!.cooldownRngState), range = c.salvoPolicy.cooldownSeconds[tank.phase - 1];
  const seconds = range.min + rng.nextFloat() * (range.max - range.min);
  tank.rhythm!.cooldownRngState = rng.getState();
  return seconds;
}
export function cancelTankSalvo(tank: DefenseTankState, c: DefenseTankConfig, now: number,
  shells: readonly ArtilleryShell[]): void {
  const hadVolley = tank.pendingImpactAtSeconds !== null || !!tank.rhythm?.pendingShots.length;
  if (tank.rhythm) tank.rhythm.pendingShots = [];
  const active = shells.filter(s => s.source.type === 'defenseTank');
  tank.pendingImpactAtSeconds = active.length ? Math.max(...active.map(s => s.impactAtSeconds)) : null;
  if (hadVolley) tank.nextAttackAtSeconds = active.length ? null : now + tankCooldown(tank, c);
}
export function validateDefenseTank(value: unknown, c: DefenseTankConfig, now: number, shells: readonly ArtilleryShell[]): DefenseTankState {
  const tank = schema.parse(value), active = shells.filter(s => s.source.type === 'defenseTank');
  tank.entranceCleared ??= tank.status !== 'entering';
  const shots = tank.rhythm?.pendingShots ?? [];
  if (tank.hp > c.hp || tank.phase !== tankPhase(tank.hp, c) || tank.startedAtSeconds > now
    || Math.abs(tank.activeAtSeconds - tank.startedAtSeconds - c.entrySeconds) > 1e-8
    || (tank.status === 'defeated') !== (tank.hp === 0) || (tank.status === 'defeated') !== (tank.defeatedAtSeconds !== null)
    || tank.defeatedAtSeconds !== null && tank.defeatedAtSeconds > now
    || tank.lastHitAtSeconds !== null && tank.lastHitAtSeconds > now
    || tank.status === 'entering' && now + 1e-9 >= tank.activeAtSeconds
    || tank.status === 'active' && now + 1e-9 < tank.activeAtSeconds
    || tank.z > c.startZ || tank.nextFlankAtSeconds < tank.activeAtSeconds
    || !!tank.rhythm !== !!c.salvoPolicy
    || shots.length > 0 && (c.salvoPolicy?.mode !== 'randomStaggered' || tank.status !== 'active'
      || tank.nextAttackAtSeconds !== null || tank.pendingImpactAtSeconds === null
      || shots.length + active.length > 3
      || new Set([...shots.map(s => s.targetLane), ...active.map(s => s.targetLane)]).size !== shots.length + active.length
      || shots.some((s, i) => s.launchAtSeconds < tank.activeAtSeconds
        || i > 0 && s.launchAtSeconds <= shots[i - 1].launchAtSeconds))
    || (tank.pendingImpactAtSeconds !== null ? tank.nextAttackAtSeconds !== null
      || (!active.length ? !shots.length || tank.pendingImpactAtSeconds > now
        : Math.abs(tank.pendingImpactAtSeconds - Math.max(...active.map(s => s.impactAtSeconds))) > 1e-8) : active.length > 0))
    throw Error('Invalid Defense tank checkpoint');
  return tank;
}

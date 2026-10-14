import { z } from 'zod';
import type { SimulationState, EnemySimulationState } from './SimulationState';
import { enemyApproachSpeed } from './enemies/latePressure';
import { attackLanePositions } from './enemies/laneComposition';

const clock = z.number().finite().nonnegative();
export const HEAVY_RAID_LANES = [0, 2, 4] as const;
export const HEAVY_RAID_ROUNDS = 6;
export const CommanderSupportConfigSchema = z.strictObject({
  dangerDistance: z.number().finite().positive(),
  earliestBossSeconds: clock,
  warningSeconds: z.number().finite().positive(),
  strikeSpacingSeconds: z.number().finite().positive(),
  clearFraction: z.number().finite().gt(0).lt(1),
  // Absent in released checkpoints: keep their original quota-based three rounds.
  heavyRaid: z.strictObject({ bossDamage: z.number().finite().positive(), giantDamageFraction: z.number().finite().gt(0).lte(1), bandDepthUnits: z.number().finite().positive(),
    // Missing in released six-round raids: retain their original trigger and three Tank hits.
    lastStand: z.strictObject({ bossHpThreshold: z.number().finite().positive(), etaSafetySeconds: clock,
      minimumBossHp: clock, triggerPolicy: z.literal('bossHpOnly').optional() }).optional(),
  }).optional(),
});
export type CommanderSupportConfig = z.infer<typeof CommanderSupportConfigSchema>;
const airSchema = z.strictObject({
  status: z.enum(['ready', 'waiting', 'completed', 'cancelled']),
  triggeredAtSeconds: clock.nullable(),
  bombAtSeconds: clock.nullable(),
  strikesCompleted: z.number().int().min(0).max(6),
  targets: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
  tankZAtWarning: z.number().finite().positive().optional(),
  impacts: z.array(z.strictObject({ x: z.number().finite(), z: z.number().finite(), atSeconds: clock })).max(12).optional(),
});
const schema = z.strictObject({ giantSeen: z.boolean(), giantAtSeconds: clock.nullable(), airstrike: airSchema.nullable() });
export type CommanderSupportState = z.infer<typeof schema>;
export type SupportBombEvent = { kind: 'supportBomb'; index: number;
  heavy?: boolean; tankDamage?: number;
  blasts: { x: number; z: number }[];
  victims: Pick<EnemySimulationState, 'id' | 'x' | 'z' | 'archetype' | 'lane'>[] };
export type SupportEvent = { kind: 'supportFlyover' } | SupportBombEvent;
export const emptyCommanderSupport = (enabled: boolean, giantSeen = false): CommanderSupportState => ({
  giantSeen, giantAtSeconds: null, airstrike: enabled ? { status: 'ready', triggeredAtSeconds: null,
    bombAtSeconds: null, strikesCompleted: 0, targets: [] } : null,
});

/** Later bombs advance beyond the Tank; a Tank already at the HP floor is also bypassed. */
export function supportTankBombZ(round: number, tankZ: number, bossHp: number, c: CommanderSupportConfig): number {
  if (!c.heavyRaid?.lastStand || round === 3 && bossHp > c.heavyRaid.lastStand.minimumBossHp) return tankZ;
  return tankZ + (round === 3 ? .5 : round - 3) * c.heavyRaid.bandDepthUnits;
}

export function advanceCommanderSupport(frame: SimulationState, c: CommanderSupportConfig | undefined,
  state: CommanderSupportState, defenseLineZ: number): SupportEvent[] {
  const events: SupportEvent[] = [], now = frame.elapsedSeconds, tank = frame.defenseTank;
  // The authoritative spawn, including a Boss flank Giant, is the announcement source.
  if (!state.giantSeen && frame.enemies.some(e => e.hp > 0 && e.archetype === 'giant')) {
    state.giantSeen = true; state.giantAtSeconds = now;
  }
  const air = state.airstrike;
  if (!c || !air) return events;
  if (!frame.squad.count || tank?.status === 'defeated' || tank?.status === 'breached' || c.heavyRaid && air.status === 'waiting' && tank?.status !== 'active') {
    if (air.status === 'waiting') { air.status = 'cancelled'; air.targets = []; }
    return events;
  }
  // Also allow a queued Boss introduction to finish after a late naval radio window.
  const navalEnd = frame.destroyer?.startedAtSeconds !== null && frame.destroyer?.startedAtSeconds !== undefined
    ? frame.destroyer.startedAtSeconds + (frame.catharsis?.balance.destroyer?.radioAtSeconds ?? 0)
      + (frame.catharsis?.balance.destroyer?.radioDurationSeconds ?? 0) : -Infinity;
  const lastStand = c.heavyRaid?.lastStand;
  if (air.status === 'ready' && tank?.status === 'active' && (lastStand ? tank.phase === 3 : tank.phase >= 2)
    && now >= Math.max(tank.startedAtSeconds, navalEnd) + c.earliestBossSeconds) {
    const flank = (lane: number) => frame.enemies.filter(e => e.lane === lane && e.hp > 0);
    const left = flank(0), right = flank(4);
    const danger = (enemies: EnemySimulationState[]) => enemies.some(e =>
      (e.archetype === 'heavy' || e.archetype === 'giant') && e.z >= frame.player.z && e.z - frame.player.z <= c.dangerDistance);
    const imminentBreach = (enemy: EnemySimulationState) => {
      if (enemy.archetype !== 'heavy' && enemy.archetype !== 'giant') return false;
      const speed = enemyApproachSpeed(enemy, frame.catharsis!.balance);
      return speed > 0 && (enemy.z - defenseLineZ) / speed <= c.warningSeconds + lastStand!.etaSafetySeconds;
    };
    if (lastStand ? tank.hp <= lastStand.bossHpThreshold
      || lastStand.triggerPolicy !== 'bossHpOnly' && (left.some(imminentBreach) || right.some(imminentBreach)) : danger(left) && danger(right)) {
      if (c.heavyRaid) { air.targets = []; air.impacts = []; air.tankZAtWarning = tank.z; }
      else {
        // Released checkpoints retain their fixed nearest-first quota.
        const select = (enemies: EnemySimulationState[]) => enemies.sort((a, b) => a.z - b.z || a.id - b.id)
          .slice(0, Math.min(enemies.length - 1, Math.floor(enemies.length * c.clearFraction))).map(e => e.id);
        air.targets = [...select(left), ...select(right)];
      }
      air.status = 'waiting'; air.triggeredAtSeconds = now; air.bombAtSeconds = now + c.warningSeconds;
    }
  }
  if (air.status !== 'waiting') return events;
  const rounds = c.heavyRaid ? HEAVY_RAID_ROUNDS : 3;
  while (air.strikesCompleted < rounds && now + 1e-9 >= air.bombAtSeconds! + air.strikesCompleted * c.strikeSpacingSeconds) {
    const index = air.strikesCompleted;
    if (c.heavyRaid) {
      const lanePositions = attackLanePositions(5, frame.catharsis!.trackHalfWidth, frame.catharsis!.balance.edgeInset);
      const victims: SupportBombEvent['victims'] = [], blasts: SupportBombEvent['blasts'] = [];
      // Three moving bombing bands, then central impacts. A short trailing
      // overlap follows enemies crossing the previous boundary during the fixed cadence.
      for (const lane of index < 3 ? HEAVY_RAID_LANES : [2]) {
        const depth = lane === 2 ? Math.max(1, air.tankZAtWarning! - frame.player.z) / 3 : c.heavyRaid.bandDepthUnits;
        const lower = frame.player.z + index * depth, upper = lower + depth;
        const centerZ = index < 3 ? lower + depth / 2 : supportTankBombZ(index, tank!.z, tank!.hp, c);
        blasts.push({ x: lanePositions[lane], z: centerZ });
        const hit = frame.enemies.filter(e => e.lane === lane && e.hp > 0 && (index < 3
          ? e.z > lower - (index > 0 ? enemyApproachSpeed(e, frame.catharsis!.balance) * c.strikeSpacingSeconds : 0) && e.z <= upper
          : Math.abs(e.z - centerZ) <= c.heavyRaid!.bandDepthUnits / 2));
        for (const enemy of hit) {
          enemy.hp = enemy.archetype === 'giant' ? Math.max(0, enemy.hp - frame.catharsis!.balance.giant.hp * c.heavyRaid.giantDamageFraction) : 0;
          if (enemy.hp === 0) {
            victims.push({ id: enemy.id, x: enemy.x, z: enemy.z, archetype: enemy.archetype, lane: enemy.lane });
            frame.enemies.splice(frame.enemies.indexOf(enemy), 1);
          }
        }
      }
      const tankDamage = lastStand ? index === 3 ? Math.min(c.heavyRaid.bossDamage, Math.max(0, tank!.hp - lastStand.minimumBossHp)) : 0
        : index >= 3 ? Math.min(tank!.hp, c.heavyRaid.bossDamage) : 0;
      if (tankDamage) { tank!.hp -= tankDamage; tank!.lastHitAtSeconds = now; }
      events.push({ kind: 'supportBomb', heavy: true, index, victims, blasts, tankDamage });
      air.impacts = [...(air.impacts ?? []), ...blasts.map(p => ({ ...p, atSeconds: now }))];
      air.strikesCompleted++;
      if (tank!.hp === 0) { air.status = 'cancelled'; air.targets = []; break; }
      continue;
    }
    if (index === 0) events.push({ kind: 'supportFlyover' });
    const ids = new Set(air.targets.filter((_, i) => i % 3 === index));
    const victims: SupportBombEvent['victims'] = [], blasts: SupportBombEvent['blasts'] = [];
    for (const lane of [0, 4]) {
      const hit = frame.enemies.filter(e => e.lane === lane && e.hp > 0 && ids.has(e.id));
      const anchor = hit[0] ?? frame.enemies.find(e => e.lane === lane && e.hp > 0);
      if (anchor) blasts.push({ x: anchor.x, z: anchor.z });
      for (const e of hit) victims.push({ id: e.id, x: e.x, z: e.z, archetype: e.archetype });
    }
    for (let i = frame.enemies.length - 1; i >= 0; i--) {
      const e = frame.enemies[i];
      if (ids.has(e.id) && (e.lane === 0 || e.lane === 4)) frame.enemies.splice(i, 1);
    }
    events.push({ kind: 'supportBomb', index, victims, blasts });
    air.strikesCompleted++;
  }
  if (air.status === 'waiting' && air.strikesCompleted === rounds) { air.status = 'completed'; air.targets = []; }
  return events;
}

export function validateCommanderSupport(value: unknown, config: CommanderSupportConfig | undefined, now: number): CommanderSupportState {
  const s = schema.parse(value), a = s.airstrike;
  const rounds = config?.heavyRaid ? HEAVY_RAID_ROUNDS : 3;
  if (s.giantAtSeconds !== null && (!s.giantSeen || s.giantAtSeconds > now)
    || a && (!config || a.strikesCompleted > rounds || config.heavyRaid && a.targets.length > 0
      || config.heavyRaid && a.status !== 'ready' && (a.tankZAtWarning === undefined || a.impacts === undefined)
      || a.tankZAtWarning !== undefined && !config.heavyRaid
      || a.impacts && (!config.heavyRaid || a.impacts.length !== 3 * Math.min(3, a.strikesCompleted) + Math.max(0, a.strikesCompleted - 3)
        || a.impacts.some((p, i) => p.atSeconds > now || p.atSeconds + 1e-9 < a.bombAtSeconds! + (i < 9 ? Math.floor(i / 3) : i - 6) * config.strikeSpacingSeconds
          || i > 0 && p.atSeconds < a.impacts![i - 1].atSeconds))
      || new Set(a.targets).size !== a.targets.length
      || a.triggeredAtSeconds !== null && a.triggeredAtSeconds > now
      || (a.status === 'ready' ? a.triggeredAtSeconds !== null || a.bombAtSeconds !== null || a.strikesCompleted !== 0 || a.targets.length > 0
        : a.triggeredAtSeconds === null || a.bombAtSeconds === null
          || Math.abs(a.bombAtSeconds - a.triggeredAtSeconds - config.warningSeconds) > 1e-8)
      || a.status === 'waiting' && (a.strikesCompleted >= rounds
        || a.strikesCompleted > 0 && now + 1e-9 < a.bombAtSeconds! + (a.strikesCompleted - 1) * config.strikeSpacingSeconds)
      || a.status === 'completed' && (a.strikesCompleted !== rounds || a.targets.length > 0)
      || a.status === 'cancelled' && a.targets.length > 0)) throw Error('Invalid Commander support checkpoint');
  return s;
}

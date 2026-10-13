import { z } from 'zod';
import type { SimulationState, EnemySimulationState } from './SimulationState';

const clock = z.number().finite().nonnegative();
export const CommanderSupportConfigSchema = z.strictObject({
  dangerDistance: z.number().finite().positive(),
  earliestBossSeconds: clock,
  warningSeconds: z.number().finite().positive(),
  strikeSpacingSeconds: z.number().finite().positive(),
  clearFraction: z.number().finite().gt(0).lt(1),
});
export type CommanderSupportConfig = z.infer<typeof CommanderSupportConfigSchema>;
const airSchema = z.strictObject({
  status: z.enum(['ready', 'waiting', 'completed', 'cancelled']),
  triggeredAtSeconds: clock.nullable(),
  bombAtSeconds: clock.nullable(),
  strikesCompleted: z.number().int().min(0).max(3),
  targets: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
});
const schema = z.strictObject({ giantSeen: z.boolean(), giantAtSeconds: clock.nullable(), airstrike: airSchema.nullable() });
export type CommanderSupportState = z.infer<typeof schema>;
export type SupportBombEvent = { kind: 'supportBomb'; index: number;
  blasts: { x: number; z: number }[];
  victims: Pick<EnemySimulationState, 'id' | 'x' | 'z' | 'archetype'>[] };
export type SupportEvent = { kind: 'supportFlyover' } | SupportBombEvent;
export const emptyCommanderSupport = (enabled: boolean, giantSeen = false): CommanderSupportState => ({
  giantSeen, giantAtSeconds: null, airstrike: enabled ? { status: 'ready', triggeredAtSeconds: null,
    bombAtSeconds: null, strikesCompleted: 0, targets: [] } : null,
});

export function advanceCommanderSupport(frame: SimulationState, c: CommanderSupportConfig | undefined,
  state: CommanderSupportState): SupportEvent[] {
  const events: SupportEvent[] = [], now = frame.elapsedSeconds, tank = frame.defenseTank;
  // The authoritative spawn, including a Boss flank Giant, is the announcement source.
  if (!state.giantSeen && frame.enemies.some(e => e.hp > 0 && e.archetype === 'giant')) {
    state.giantSeen = true; state.giantAtSeconds = now;
  }
  const air = state.airstrike;
  if (!c || !air) return events;
  if (!frame.squad.count || tank?.status === 'defeated' || tank?.status === 'breached') {
    if (air.status === 'waiting') { air.status = 'cancelled'; air.targets = []; }
    return events;
  }
  // Also allow a queued Boss introduction to finish after a late naval radio window.
  const navalEnd = frame.destroyer?.startedAtSeconds !== null && frame.destroyer?.startedAtSeconds !== undefined
    ? frame.destroyer.startedAtSeconds + (frame.catharsis?.balance.destroyer?.radioAtSeconds ?? 0)
      + (frame.catharsis?.balance.destroyer?.radioDurationSeconds ?? 0) : -Infinity;
  if (air.status === 'ready' && tank?.status === 'active' && tank.phase >= 2
    && now >= Math.max(tank.startedAtSeconds, navalEnd) + c.earliestBossSeconds) {
    const flank = (lane: number) => frame.enemies.filter(e => e.lane === lane && e.hp > 0);
    const left = flank(0), right = flank(4);
    const danger = (enemies: EnemySimulationState[]) => enemies.some(e =>
      (e.archetype === 'heavy' || e.archetype === 'giant') && e.z >= frame.player.z && e.z - frame.player.z <= c.dangerDistance);
    if (danger(left) && danger(right)) {
      // Fix the quota at warning time; later admissions keep their normal schedule.
      const select = (enemies: EnemySimulationState[]) => enemies.sort((a, b) => a.z - b.z || a.id - b.id)
        .slice(0, Math.min(enemies.length - 1, Math.floor(enemies.length * c.clearFraction))).map(e => e.id);
      air.targets = [...select(left), ...select(right)];
      air.status = 'waiting'; air.triggeredAtSeconds = now; air.bombAtSeconds = now + c.warningSeconds;
    }
  }
  if (air.status !== 'waiting') return events;
  while (air.strikesCompleted < 3 && now + 1e-9 >= air.bombAtSeconds! + air.strikesCompleted * c.strikeSpacingSeconds) {
    const index = air.strikesCompleted;
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
  if (air.strikesCompleted === 3) { air.status = 'completed'; air.targets = []; }
  return events;
}

export function validateCommanderSupport(value: unknown, config: CommanderSupportConfig | undefined, now: number): CommanderSupportState {
  const s = schema.parse(value), a = s.airstrike;
  if (s.giantAtSeconds !== null && (!s.giantSeen || s.giantAtSeconds > now)
    || a && (!config || new Set(a.targets).size !== a.targets.length
      || a.triggeredAtSeconds !== null && a.triggeredAtSeconds > now
      || (a.status === 'ready' ? a.triggeredAtSeconds !== null || a.bombAtSeconds !== null || a.strikesCompleted !== 0 || a.targets.length > 0
        : a.triggeredAtSeconds === null || a.bombAtSeconds === null
          || Math.abs(a.bombAtSeconds - a.triggeredAtSeconds - config.warningSeconds) > 1e-8)
      || a.status === 'waiting' && (a.strikesCompleted >= 3
        || a.strikesCompleted > 0 && now + 1e-9 < a.bombAtSeconds! + (a.strikesCompleted - 1) * config.strikeSpacingSeconds)
      || a.status === 'completed' && (a.strikesCompleted !== 3 || a.targets.length > 0)
      || a.status === 'cancelled' && a.targets.length > 0)) throw Error('Invalid Commander support checkpoint');
  return s;
}

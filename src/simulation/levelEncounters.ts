import { z } from 'zod';
import type { EncounterAction, LevelEncounterConfig } from '../config/levelEncounterConfig';
import type { SimulationState } from './SimulationState';
import { enterNavalPresence, retreatNavalPresence } from './navalPresence';
import { setNavalBarrage } from './navalBarrage';

const clock = z.number().finite().nonnegative().nullable();
const schema = z.strictObject({ version: z.literal(1), ordinaryEnabled: z.boolean(), survivalEnabled: z.boolean(),
  triggers: z.array(z.strictObject({ id: z.string(), anchorAtSeconds: clock, consumedAtSeconds: clock })).max(32) });
export type LevelEncounterState = z.infer<typeof schema>;
export function emptyLevelEncounters(c: LevelEncounterConfig): LevelEncounterState {
  return { version: 1, ordinaryEnabled: c.initialOrdinaryEnabled, survivalEnabled: false,
    triggers: c.triggers.map(t => ({ id: t.id, anchorAtSeconds: null, consumedAtSeconds: null })) };
}
export function advanceLevelEncounters(previous: LevelEncounterState, c: LevelEncounterConfig,
  now: number, level: number, release: number | null): { state: LevelEncounterState; actions: EncounterAction[] | null } {
  let changed: LevelEncounterState['triggers'] | null = null, actions: EncounterAction[] | null = null;
  for (let i = 0; i < c.triggers.length; i++) {
    const trigger = c.triggers[i], old = previous.triggers[i];
    if (old.consumedAtSeconds !== null) continue;
    const when = trigger.when;
    const anchor = old.anchorAtSeconds ?? (when.kind === 'time' ? when.seconds
      : when.kind === 'machineGunRelease' ? release : level >= when.level ? now : null);
    if (anchor === null) continue;
    const due = anchor + (when.kind === 'time' ? 0 : when.delaySeconds);
    const consumed = now + 1e-9 >= due;
    if (old.anchorAtSeconds !== anchor || consumed) {
      changed ??= [...previous.triggers];
      changed[i] = { id: trigger.id, anchorAtSeconds: anchor, consumedAtSeconds: consumed ? now : null };
    }
    if (consumed) { actions ??= []; actions.push(...trigger.actions); }
  }
  return { state: changed ? { ...previous, triggers: changed } : previous, actions };
}
export function validateLevelEncounters(value: unknown, c: LevelEncounterConfig, now: number,
  level: number, release: number | null, alive: boolean): LevelEncounterState {
  const state = schema.parse(value);
  if (state.triggers.length !== c.triggers.length) throw Error('Invalid encounter cursor count');
  state.triggers.forEach((s, i) => {
    const t = c.triggers[i], when = t.when;
    const expected = when.kind === 'time' ? when.seconds : when.kind === 'machineGunRelease' ? release : undefined;
    const delay = when.kind === 'time' ? 0 : when.delaySeconds;
    const anchor = s.anchorAtSeconds ?? expected;
    if (alive && now > 0 && (when.kind === 'level' ? level >= when.level : expected !== null)
      && (s.anchorAtSeconds === null || anchor != null && now + 1e-8 >= anchor + delay && s.consumedAtSeconds === null))
      throw Error('Unconsumed encounter opportunity');
    if (s.id !== t.id || s.anchorAtSeconds !== null && (when.kind === 'time' ? s.anchorAtSeconds !== expected
      : s.anchorAtSeconds > now || expected !== undefined && s.anchorAtSeconds !== expected
        || when.kind === 'level' && level < when.level)
      || s.consumedAtSeconds !== null && (s.anchorAtSeconds === null || s.consumedAtSeconds > now
        || s.consumedAtSeconds + 1e-8 < s.anchorAtSeconds + delay)) throw Error('Invalid encounter trigger clock');
  });
  return state;
}

// Explicit level/Boss commands share the authored-trigger path. No wave function owns naval control.
export function applyEncounterAction(frame: SimulationState, action: EncounterAction): void {
  const control = frame.levelEncounters, config = frame.catharsis?.balance.destroyer;
  if (!control) throw Error('Encounter commands require the modular policy');
  if (!frame.squad.count) return;
  if (action === 'ordinaryOn' || action === 'ordinaryOff') control.ordinaryEnabled = action === 'ordinaryOn';
  else if (action === 'startSurvival') control.survivalEnabled = true;
  else if ((action === 'barrageOn' || action === 'barrageOff') && frame.navalBarrage && frame.catharsis?.balance.navalBarrage)
    frame.navalBarrage = setNavalBarrage(frame.navalBarrage,frame.catharsis.balance.navalBarrage,frame.elapsedSeconds,action==='barrageOn');
  else if (action === 'destroyerRetreat' && config && frame.navalPresence)
    frame.navalPresence = retreatNavalPresence(frame.navalPresence, frame.elapsedSeconds, config);
  else if ((action === 'destroyerIntro' || action === 'destroyerEnter') && config?.enabled && frame.navalPresence) {
    frame.navalPresence = enterNavalPresence(frame.navalPresence, frame.elapsedSeconds);
    if (action === 'destroyerIntro' && frame.destroyer?.status === 'pending')
      frame.destroyer = { status: 'active', startedAtSeconds: frame.elapsedSeconds, nextShotIndex: 0 };
  }
}

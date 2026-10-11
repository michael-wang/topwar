import { z } from 'zod';
import type { DestroyerSettings } from '../config/destroyerConfig';
import { DESTROYER_MUZZLE } from './destroyer';
import type { ArtillerySource } from './artillery';

const clock = z.number().finite().nonnegative().nullable();
const schema = z.strictObject({ version: z.literal(1), status: z.enum(['absent', 'entering', 'stationed', 'retreating']),
  enteredAtSeconds: clock, retreatAtSeconds: clock, retreatFromX: z.number().finite().min(-100).max(100).nullable() });
export type NavalPresenceState = z.infer<typeof schema>;
export const emptyNavalPresence = (): NavalPresenceState => ({ version: 1, status: 'absent',
  enteredAtSeconds: null, retreatAtSeconds: null, retreatFromX: null });
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
export function navalPresencePose(state: NavalPresenceState, now: number, c: DestroyerSettings) {
  const age = now - (state.enteredAtSeconds ?? now);
  const x = state.status === 'retreating' ? state.retreatFromX! + (c.exitX - state.retreatFromX!)
    * smooth((now - state.retreatAtSeconds!) / (c.durationSeconds - c.exitAtSeconds))
    : age < c.entrySeconds ? c.startX + (c.stationX - c.startX) * smooth(age / c.entrySeconds) : c.stationX;
  return { x, y: -.12 + Math.sin(age * 1.4) * .045, z: c.z };
}
export function enterNavalPresence(previous: NavalPresenceState, now: number): NavalPresenceState {
  return previous.status !== 'absent' ? previous : { version: 1, status: 'entering', enteredAtSeconds: now,
    retreatAtSeconds: null, retreatFromX: null };
}
export function retreatNavalPresence(previous: NavalPresenceState, now: number, c: DestroyerSettings): NavalPresenceState {
  return previous.status === 'absent' || previous.status === 'retreating' ? previous : { ...previous,
    status: 'retreating', retreatAtSeconds: now, retreatFromX: navalPresencePose(previous, now, c).x };
}
export function advanceNavalPresence(previous: NavalPresenceState, now: number, c: DestroyerSettings): NavalPresenceState {
  if (previous.status === 'entering' && now + 1e-9 >= previous.enteredAtSeconds! + c.entrySeconds)
    return { ...previous, status: 'stationed' };
  if (previous.status === 'retreating' && now + 1e-9 >= previous.retreatAtSeconds! + c.durationSeconds - c.exitAtSeconds)
    return emptyNavalPresence();
  return previous;
}
export function navalPresenceMuzzle(state: NavalPresenceState, now: number, c: DestroyerSettings): ArtillerySource {
  const p = navalPresencePose(state, now, c);
  return { id: 'stage1-destroyer', type: 'destroyer', position: { x: p.x + DESTROYER_MUZZLE.x,
    y: p.y + DESTROYER_MUZZLE.y, z: p.z + DESTROYER_MUZZLE.z } };
}
export function validateNavalPresence(value: unknown, now: number, c: DestroyerSettings | undefined, alive: boolean): NavalPresenceState {
  const s = schema.parse(value);
  if (s.status === 'absent') {
    if (s.enteredAtSeconds !== null || s.retreatAtSeconds !== null || s.retreatFromX !== null) throw Error('Invalid absent naval presence');
  } else if (!c || s.enteredAtSeconds === null || s.enteredAtSeconds > now
    || (s.status === 'retreating' ? s.retreatAtSeconds === null || s.retreatAtSeconds < s.enteredAtSeconds
      || s.retreatAtSeconds > now || s.retreatFromX === null
      || alive && now > s.retreatAtSeconds + c.durationSeconds - c.exitAtSeconds + 1e-8
      : s.retreatAtSeconds !== null || s.retreatFromX !== null
        || s.status === 'stationed' && now + 1e-8 < s.enteredAtSeconds + c.entrySeconds
        || alive && s.status === 'entering' && now > s.enteredAtSeconds + c.entrySeconds + 1e-8)) throw Error('Invalid naval presence clock');
  return s;
}

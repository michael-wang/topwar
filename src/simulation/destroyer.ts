import { z } from 'zod';
import type { DestroyerSettings } from '../config/destroyerConfig';
import type { ArtillerySource } from './artillery';
import type { CarnivalState } from './carnival';

export const DestroyerStateSchema = z.strictObject({
  status: z.enum(['pending', 'active', 'complete', 'skipped']),
  startedAtSeconds: z.number().finite().nonnegative().nullable(),
  nextShotIndex: z.number().int().min(0).max(16),
}).refine(s => s.status === 'pending' || s.status === 'skipped'
  ? s.startedAtSeconds === null && s.nextShotIndex === 0 : s.startedAtSeconds !== null,
  'Invalid Destroyer lifecycle');
export type DestroyerState = z.infer<typeof DestroyerStateSchema>;
export const emptyDestroyer = (skipped = false): DestroyerState => ({ status: skipped ? 'skipped' : 'pending', startedAtSeconds: null, nextShotIndex: 0 });
export const DESTROYER_MUZZLE = { x: 4, y: 2.55, z: -5.2 } as const;
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

// Simulation coordinates. Rendering mirrors X once, including this exact muzzle offset.
export function destroyerPose(age: number, c: DestroyerSettings) {
  const x = age < c.entrySeconds ? c.startX + (c.stationX - c.startX) * smooth(age / c.entrySeconds)
    : age >= c.exitAtSeconds ? c.stationX + (c.exitX - c.stationX) * smooth((age - c.exitAtSeconds) / (c.durationSeconds - c.exitAtSeconds)) : c.stationX;
  return { x, y: -.12 + Math.sin(age * 1.4) * .045, z: c.z };
}
export function destroyerMuzzle(age: number, c: DestroyerSettings): ArtillerySource {
  const p = destroyerPose(age, c);
  return { id: 'stage1-destroyer', type: 'destroyer', position: { x: p.x + DESTROYER_MUZZLE.x,
    y: p.y + DESTROYER_MUZZLE.y, z: p.z + DESTROYER_MUZZLE.z } };
}
export function advanceDestroyer(previous: DestroyerState, c: DestroyerSettings | undefined,
  carnival: CarnivalState | undefined, now: number, alive: boolean): { state: DestroyerState; fire: boolean } {
  let state = { ...previous };
  if (!c?.enabled) return { state: state.status === 'active' ? { ...state, status: 'complete' } : emptyDestroyer(true), fire: false };
  if (!alive) return { state, fire: false };
  if (state.status === 'pending') {
    if (carnival?.status === 'skipped') return { state: emptyDestroyer(true), fire: false };
    if (c.startPolicy === 'withCarnival' && (carnival?.status === 'active' || carnival?.status === 'complete'))
      state = { status: 'active', startedAtSeconds: carnival.startedAtSeconds, nextShotIndex: 0 };
    else if (c.startPolicy !== 'withCarnival' && carnival?.status === 'complete')
      state = { status: 'active', startedAtSeconds: now, nextShotIndex: 0 };
  }
  if (state.status !== 'active') return { state, fire: false };
  const age = now - state.startedAtSeconds!;
  if (age + 1e-9 >= c.durationSeconds) return { state: { ...state, status: 'complete', nextShotIndex: c.shotTimes.length }, fire: false };
  // Consume missed opportunities without a burst. A fixed step normally consumes exactly one.
  let fire = false;
  while (state.nextShotIndex < c.shotTimes.length && age + 1e-9 >= c.shotTimes[state.nextShotIndex]) {
    fire = age < c.exitAtSeconds; state.nextShotIndex++;
  }
  return { state, fire };
}
export function validateDestroyer(value: unknown, c: DestroyerSettings | undefined, now: number, alive: boolean): DestroyerState {
  const s = DestroyerStateSchema.parse(value);
  if (s.startedAtSeconds !== null) {
    const age = now - s.startedAtSeconds;
    if (!c || age < 0 || s.nextShotIndex > c.shotTimes.length
      || (c.enabled && s.status === 'complete' && age + 1e-8 < c.durationSeconds)
      || (alive && s.status === 'active' && age >= c.durationSeconds + 1e-8)
      || (alive && s.status === 'active' && s.nextShotIndex !== c.shotTimes.filter(t => t <= age + 1e-9).length)
      || (s.nextShotIndex > 0 && age + 1e-8 < c.shotTimes[s.nextShotIndex - 1])) throw Error('Invalid Destroyer clock or shot cursor');
  }
  return s;
}

import { z } from 'zod';
import { SeededRng } from '../core/Rng';
import type { NavalBarrageConfig } from '../config/navalBarrageConfig';
const clock = z.number().finite().nonnegative().nullable();
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
const schema = z.strictObject({ version: z.literal(1), enabled: z.boolean(), enabledAtSeconds: clock,
  nextAtSeconds: clock, rngState: z.number().int().min(0).max(0xffffffff),
  opportunities: counter, launchedSalvos: counter, capacitySkipped: counter, absentSkipped: counter,
  lastSalvo: z.strictObject({ atSeconds: z.number().finite().nonnegative(),
    lanes: z.array(z.number().int().nonnegative()).min(1).max(8), outcome: z.enum(['launched', 'capacity', 'absent']) }).nullable() });
export type NavalBarrageState = z.infer<typeof schema>;
export function emptyNavalBarrage(seed: number, c: NavalBarrageConfig): NavalBarrageState {
  return { version:1, enabled:false, enabledAtSeconds:null, nextAtSeconds:null, rngState:(seed ^ c.streamSeed) >>> 0,
    opportunities:0, launchedSalvos:0, capacitySkipped:0, absentSkipped:0, lastSalvo:null };
}
const interval = (rng: SeededRng, c: NavalBarrageConfig) => c.minimumIntervalSeconds + rng.nextFloat() * (c.maximumIntervalSeconds - c.minimumIntervalSeconds);
export function setNavalBarrage(previous: NavalBarrageState, c: NavalBarrageConfig, now: number, enabled: boolean): NavalBarrageState {
  enabled &&= c.enabled;
  if (previous.enabled === enabled) return previous;
  if (!enabled) return { ...previous, enabled:false, nextAtSeconds:null };
  const rng = new SeededRng(previous.rngState), next = now + interval(rng,c);
  return { ...previous, enabled:true, enabledAtSeconds:now, nextAtSeconds:next, rngState:rng.getState() };
}
// Consume one opportunity after a large step. Draws are identical when capacity
// blocks a whole salvo: no partial launches, catch-up queue or safe-lane policy.
export function advanceNavalBarrage(previous: NavalBarrageState, c: NavalBarrageConfig,
  now: number, available: number, present: boolean, alive: boolean): NavalBarrageState {
  if (!alive) return setNavalBarrage(previous,c,now,false);
  if (!previous.enabled || now + 1e-9 < previous.nextAtSeconds!) return previous;
  const rng = new SeededRng(previous.rngState);
  const count = c.minimumShells + rng.nextInt(c.maximumShells-c.minimumShells+1);
  const remaining = [...c.targetLanes], lanes: number[] = [];
  for(let i=0;i<count;i++) lanes.push(remaining.splice(rng.nextInt(remaining.length),1)[0]);
  const outcome = !present ? 'absent' : available < count ? 'capacity' : 'launched';
  return { ...previous, nextAtSeconds:now+interval(rng,c), rngState:rng.getState(),
    opportunities:previous.opportunities+1, launchedSalvos:previous.launchedSalvos+(outcome==='launched'?1:0),
    capacitySkipped:previous.capacitySkipped+(outcome==='capacity'?1:0), absentSkipped:previous.absentSkipped+(outcome==='absent'?1:0),
    lastSalvo:{atSeconds:now,lanes,outcome} };
}
export function validateNavalBarrage(value: unknown, c: NavalBarrageConfig, now: number, alive: boolean): NavalBarrageState {
  const s=schema.parse(value), last=s.lastSalvo;
  if (s.enabled ? !c.enabled || s.enabledAtSeconds===null || s.nextAtSeconds===null
      || alive && s.nextAtSeconds<=now+1e-9 || s.nextAtSeconds>now+c.maximumIntervalSeconds+1e-8
    : s.nextAtSeconds!==null) throw Error('Invalid barrage deadline');
  const anchor=last && last.atSeconds>=(s.enabledAtSeconds??Infinity) ? last.atSeconds : s.enabledAtSeconds;
  if(s.enabled && (anchor===null || s.nextAtSeconds!<anchor+c.minimumIntervalSeconds-1e-8
    || s.nextAtSeconds!>anchor+c.maximumIntervalSeconds+1e-8))throw Error('Invalid barrage launch interval');
  if (s.enabledAtSeconds!==null && s.enabledAtSeconds>now || s.opportunities!==s.launchedSalvos+s.capacitySkipped+s.absentSkipped
    || (s.opportunities===0)!==(last===null)
    || last && (s.enabledAtSeconds===null || last.atSeconds>now || last.lanes.length<c.minimumShells
      || last.lanes.length>c.maximumShells || new Set(last.lanes).size!==last.lanes.length
      || last.lanes.some(l=>!c.targetLanes.includes(l)) || s.enabled && s.nextAtSeconds!<last.atSeconds+c.minimumIntervalSeconds-1e-8
      || (last.outcome==='launched'?s.launchedSalvos:last.outcome==='capacity'?s.capacitySkipped:s.absentSkipped)===0))
    throw Error('Invalid barrage opportunity or random lane state');
  return s;
}

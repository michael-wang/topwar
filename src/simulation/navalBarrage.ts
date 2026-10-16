import { z } from 'zod';
import { SeededRng } from '../core/Rng';
import type { NavalBarrageConfig } from '../config/navalBarrageConfig';
import type { ArtilleryShell } from './artillery';

export const hasUnresolvedDestroyerSalvo = (shells: readonly Readonly<ArtilleryShell>[]) =>
  shells.some(shell => shell.source.type === 'destroyer');
const clock = z.number().finite().nonnegative().nullable();
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
const schema = z.strictObject({ version: z.literal(1), enabled: z.boolean(), enabledAtSeconds: clock,
  nextAtSeconds: clock, rngState: z.number().int().min(0).max(0xffffffff),
  rhythm: z.strictObject({ gapRngState: z.number().int().min(0).max(0xffffffff),
    pendingShot: z.strictObject({ targetLane:z.number().int().min(0).max(15), launchAtSeconds:z.number().finite().nonnegative() }).optional() }).optional(),
  // Optional: a held opportunity remains recoverable if its final shell is
  // explicitly cancelled while paused, before the next simulation tick.
  heldAtSeconds: z.number().finite().nonnegative().optional(),
  pendingImpact: z.strictObject({ shellIds:z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(8),
    finalImpactAtSeconds:z.number().finite().nonnegative() }).optional(),
  cooldown: z.strictObject({ resolvedAtSeconds:z.number().finite().nonnegative(),
    gapSeconds:z.number().finite().nonnegative() }).optional(),
  opportunities: counter, launchedSalvos: counter, capacitySkipped: counter, absentSkipped: counter,
  lastSalvo: z.strictObject({ atSeconds: z.number().finite().nonnegative(),
    lanes: z.array(z.number().int().nonnegative()).min(1).max(8), outcome: z.enum(['launched', 'capacity', 'absent']) }).nullable() });
export type NavalBarrageState = z.infer<typeof schema>;
export function emptyNavalBarrage(seed: number, c: NavalBarrageConfig): NavalBarrageState {
  return { version:1, enabled:false, enabledAtSeconds:null, nextAtSeconds:null, rngState:(seed ^ c.streamSeed) >>> 0,
    ...(c.salvoPolicy ? {rhythm:{gapRngState:(seed ^ c.streamSeed ^ 0x47415053) >>> 0}} : {}),
    opportunities:0, launchedSalvos:0, capacitySkipped:0, absentSkipped:0, lastSalvo:null };
}
const interval = (rng: SeededRng, c: NavalBarrageConfig) => c.minimumIntervalSeconds + rng.nextFloat() * (c.maximumIntervalSeconds - c.minimumIntervalSeconds);
const quietGap = (rng: SeededRng, c: NonNullable<NavalBarrageConfig['postImpactCooldown']>) =>
  c.gapsSeconds ? c.gapsSeconds[rng.nextInt(c.gapsSeconds.length)]
    : c.minimumGapSeconds! + rng.nextFloat() * (c.maximumGapSeconds! - c.minimumGapSeconds!);
const validGap = (gap: number, c: NonNullable<NavalBarrageConfig['postImpactCooldown']>) =>
  c.gapsSeconds ? c.gapsSeconds.includes(gap) : gap >= c.minimumGapSeconds! && gap <= c.maximumGapSeconds!;
export function setNavalBarrage(previous: NavalBarrageState, c: NavalBarrageConfig, now: number, enabled: boolean): NavalBarrageState {
  enabled &&= c.enabled;
  if (previous.enabled === enabled) return previous;
  const {heldAtSeconds: _held,pendingImpact:_flight,cooldown:_gap,...state}=previous;
  if(state.rhythm)state.rhythm={gapRngState:state.rhythm.gapRngState};
  if (!enabled) return { ...state, enabled:false, nextAtSeconds:null };
  const rng = new SeededRng(previous.rngState), next = now + (c.postImpactCooldown?.initialDelaySeconds ?? interval(rng,c));
  return { ...state, enabled:true, enabledAtSeconds:now, nextAtSeconds:next, rngState:rng.getState() };
}
export function resolveNavalSalvo(previous:NavalBarrageState,c:NavalBarrageConfig,atSeconds:number):NavalBarrageState {
  if(!previous.pendingImpact || previous.rhythm?.pendingShot || !c.postImpactCooldown)return previous;
  const rng=new SeededRng(previous.rngState),gap=quietGap(rng,c.postImpactCooldown);
  const {pendingImpact:_flight,heldAtSeconds:_held,...state}=previous;
  return {...state,nextAtSeconds:atSeconds+gap,rngState:rng.getState(),cooldown:{resolvedAtSeconds:atSeconds,gapSeconds:gap}};
}
export function recordNavalSalvo(previous:NavalBarrageState,c:NavalBarrageConfig,shells:readonly ArtilleryShell[]):NavalBarrageState {
  if(!c.postImpactCooldown)return previous;
  if(!shells.length)throw Error('A launched naval salvo must have authoritative shells');
  return {...previous,nextAtSeconds:null,pendingImpact:{shellIds:[...(previous.pendingImpact?.shellIds ?? []),...shells.map(s=>s.id)],
    finalImpactAtSeconds:Math.max(previous.pendingImpact?.finalImpactAtSeconds ?? 0,...shells.map(s=>s.impactAtSeconds))}};
}
export function cancelNavalSalvo(previous:NavalBarrageState,c:NavalBarrageConfig,shells:readonly ArtilleryShell[],now:number,cancelPending=false):NavalBarrageState {
  if(!previous.pendingImpact)return previous;
  if(cancelPending && previous.rhythm?.pendingShot)previous={...previous,rhythm:{gapRngState:previous.rhythm.gapRngState}};
  const impact=previous.pendingImpact!,remaining=shells.filter(s=>impact.shellIds.includes(s.id));
  return remaining.length ? {...previous,pendingImpact:{...impact,
    finalImpactAtSeconds:Math.max(...remaining.map(s=>s.impactAtSeconds))}} : resolveNavalSalvo(previous,c,now);
}
// Consume one opportunity after a large step. Draws are identical when capacity
// blocks a whole salvo: no partial launches, catch-up queue or safe-lane policy.
export function advanceNavalBarrage(previous: NavalBarrageState, c: NavalBarrageConfig,
  now: number, available: number, present: boolean, alive: boolean, unresolved = false): NavalBarrageState {
  if (!alive) return setNavalBarrage(previous,c,now,false);
  if(previous.rhythm?.pendingShot)return previous;
  if(previous.pendingImpact){
    if(unresolved)return previous;
    previous=resolveNavalSalvo(previous,c,Math.min(now,previous.pendingImpact.finalImpactAtSeconds));
  }
  if (!previous.enabled || now + 1e-9 < previous.nextAtSeconds!) return previous;
  // Keep the original deadline/RNG intact while a predecessor is in flight.
  // The first legal post-impact tick consumes exactly this one opportunity.
  if (c.overlapPolicy === 'waitForImpact' && unresolved)
    return previous.heldAtSeconds===undefined ? {...previous,heldAtSeconds:now} : previous;
  const rng = new SeededRng(previous.rngState);
  const count = c.salvoPolicy ? previous.launchedSalvos < c.salvoPolicy.singleSalvos ? 1 : 2
    : c.minimumShells + rng.nextInt(c.maximumShells-c.minimumShells+1);
  const remaining = [...c.targetLanes], lanes: number[] = [];
  for(let i=0;i<count;i++) lanes.push(remaining.splice(rng.nextInt(remaining.length),1)[0]);
  const outcome = !present ? 'absent' : available < count ? 'capacity' : 'launched';
  const {heldAtSeconds: _held,cooldown:_cooldown,...state}=previous;
  const skippedGap=c.postImpactCooldown && outcome!=='launched'
    ? quietGap(rng,c.postImpactCooldown) : undefined;
  let rhythm=previous.rhythm;
  if(c.salvoPolicy && outcome==='launched' && count===2){
    const gapRng=new SeededRng(rhythm!.gapRngState),gap=c.salvoPolicy.gapSeconds;
    const launchAtSeconds=now+gap.minimum+gapRng.nextFloat()*(gap.maximum-gap.minimum);
    rhythm={gapRngState:gapRng.getState(),pendingShot:{targetLane:lanes[1],launchAtSeconds}};
  }
  return { ...state, nextAtSeconds:c.postImpactCooldown ? skippedGap===undefined ? null : now+skippedGap : now+interval(rng,c),
    ...(rhythm ? {rhythm} : {}),
    ...(skippedGap===undefined?{}:{cooldown:{resolvedAtSeconds:now,gapSeconds:skippedGap}}),rngState:rng.getState(),
    opportunities:previous.opportunities+1, launchedSalvos:previous.launchedSalvos+(outcome==='launched'?1:0),
    capacitySkipped:previous.capacitySkipped+(outcome==='capacity'?1:0), absentSkipped:previous.absentSkipped+(outcome==='absent'?1:0),
    lastSalvo:{atSeconds:now,lanes,outcome} };
}
export function validateNavalBarrage(value: unknown, c: NavalBarrageConfig, now: number, alive: boolean, unresolved = false,
  shells:readonly ArtilleryShell[]=[]): NavalBarrageState {
  const s=schema.parse(value), last=s.lastSalvo;
  const pending=s.rhythm?.pendingShot,policy=c.salvoPolicy;
  if(!!s.rhythm!==!!policy || pending && (!s.enabled || !s.pendingImpact || !last || last.outcome!=='launched'
    || last.lanes.length!==2 || pending.targetLane!==last.lanes[1]
    || pending.launchAtSeconds < last.atSeconds+policy!.gapSeconds.minimum-1e-8
    || pending.launchAtSeconds > last.atSeconds+policy!.gapSeconds.maximum+1e-8))throw Error('Invalid naval shot queue');
  if(s.enabled&&!c.enabled || !s.enabled&&(s.nextAtSeconds!==null||s.pendingImpact||s.cooldown))
    throw Error('Invalid naval activation state');
  if(c.postImpactCooldown){
    if(s.pendingImpact){
      const p=s.pendingImpact,active=shells.filter(shell=>p.shellIds.includes(shell.id));
      if(!s.enabled || s.nextAtSeconds!==null || s.cooldown || s.heldAtSeconds!==undefined || !last || last.outcome!=='launched'
        || (policy ? p.shellIds.length>last.lanes.length || pending && p.shellIds.length!==1 : p.shellIds.length!==last.lanes.length)
        || new Set(p.shellIds).size!==p.shellIds.length || !active.length && !pending
        || active.some(shell=>shell.source.type!=='destroyer' || (policy
          ? shell.targetLane!==last.lanes[p.shellIds.indexOf(shell.id)]
            || (p.shellIds.indexOf(shell.id)===0 ? shell.launchedAtSeconds!==last.atSeconds
              : shell.launchedAtSeconds<last.atSeconds+policy.gapSeconds.minimum-1e-8)
          : shell.launchedAtSeconds!==last.atSeconds))
        || active.length>0 && Math.abs(Math.max(...active.map(shell=>shell.impactAtSeconds))-p.finalImpactAtSeconds)>1e-8)
        throw Error('Invalid pending naval impact');
    }else if(s.enabled){
      if(s.nextAtSeconds===null || s.enabledAtSeconds===null)throw Error('Invalid cooldown deadline');
      if(s.cooldown){const g=s.cooldown;
        if(g.resolvedAtSeconds>now || !validGap(g.gapSeconds,c.postImpactCooldown)
          || !last || g.resolvedAtSeconds<last.atSeconds || Math.abs(s.nextAtSeconds-g.resolvedAtSeconds-g.gapSeconds)>1e-8)
          throw Error('Invalid naval cooldown');
      }else if(Math.abs(s.nextAtSeconds-s.enabledAtSeconds-c.postImpactCooldown.initialDelaySeconds)>1e-8)
        throw Error('Invalid initial naval delay');
      if(alive&&s.nextAtSeconds<now-1e-8&&!unresolved&&s.heldAtSeconds===undefined)throw Error('Overdue naval cooldown');
    }
  }else if(s.pendingImpact||s.cooldown)throw Error('Historical naval policy cannot contain cooldown state');
  if(s.heldAtSeconds!==undefined && (c.overlapPolicy!=='waitForImpact' || !s.enabled || s.nextAtSeconds===null
    || s.heldAtSeconds<s.nextAtSeconds-1e-9 || s.heldAtSeconds>now))throw Error('Invalid held barrage opportunity');
  if (!c.postImpactCooldown && (s.enabled ? !c.enabled || s.enabledAtSeconds===null || s.nextAtSeconds===null
      || alive && s.nextAtSeconds<=now+1e-9 && !(c.overlapPolicy==='waitForImpact' && (unresolved || s.heldAtSeconds!==undefined))
      || s.nextAtSeconds>now+c.maximumIntervalSeconds+1e-8
    : s.nextAtSeconds!==null)) throw Error('Invalid barrage deadline');
  const anchor=last && last.atSeconds>=(s.enabledAtSeconds??Infinity) ? last.atSeconds : s.enabledAtSeconds;
  if(policy && last && last.lanes.length!==((s.launchedSalvos-(last.outcome==='launched'?1:0))<policy.singleSalvos?1:2))
    throw Error('Invalid phased naval shell count');
  if(!c.postImpactCooldown && s.enabled && (anchor===null || s.nextAtSeconds!<anchor+c.minimumIntervalSeconds-1e-8
    || s.nextAtSeconds!>anchor+c.maximumIntervalSeconds+1e-8))throw Error('Invalid barrage launch interval');
  if (s.enabledAtSeconds!==null && s.enabledAtSeconds>now || s.opportunities!==s.launchedSalvos+s.capacitySkipped+s.absentSkipped
    || (s.opportunities===0)!==(last===null)
    || last && (s.enabledAtSeconds===null || last.atSeconds>now || last.lanes.length<c.minimumShells
      || last.lanes.length>c.maximumShells || new Set(last.lanes).size!==last.lanes.length
      || last.lanes.some(l=>!c.targetLanes.includes(l)) || !c.postImpactCooldown && s.enabled && s.nextAtSeconds!<last.atSeconds+c.minimumIntervalSeconds-1e-8
      || (last.outcome==='launched'?s.launchedSalvos:last.outcome==='capacity'?s.capacitySkipped:s.absentSkipped)===0))
    throw Error('Invalid barrage opportunity or random lane state');
  return s;
}

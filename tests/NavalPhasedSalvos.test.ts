import {expect,it} from 'vitest';
import config from './helpers/ShippingConfig';
import {advanceNavalBarrage,emptyNavalBarrage,setNavalBarrage} from '../src/simulation/navalBarrage';
import {createNavalBarrageReview} from '../src/app/DevNavalBarrageReview';
import {carnivalOptionsFor} from '../scripts/qa/carnivalPilot';
import {survivalDecision} from '../scripts/qa/survivalPilot';
import {pilotTuning} from '../scripts/qa/DefensePilot';
import {readCheckpoint,writeCheckpoint,simulationFromCheckpoint,type SessionCheckpoint} from '../src/app/SessionCheckpoint';
import {defaultRuntimeTuning} from '../src/app/runtimeTuning';
const c=config.catharsis!.navalBarrage!;
const make=()=>createNavalBarrageReview(carnivalOptionsFor(config),config.weapon.rifle.fireRate,'barrage8-on',17);
function tick(sim:ReturnType<typeof make>,n=1){for(let i=0;i<n;i++)sim.step(1/60,survivalDecision(sim,i,'competent'),pilotTuning);}
function fourth(){const sim=make();for(let i=0;i<3600&&!sim.getFrameState().navalBarrage!.rhythm?.pendingShot;i++)tick(sim);
 expect(sim.getState().navalBarrage!.launchedSalvos).toBe(4);return sim;}
it('authors three successful singles then pairs and does not count capacity/absence skips',()=>{
 expect(c.salvoPolicy).toEqual({mode:'threeSinglesThenPairs',singleSalvos:3,gapSeconds:{minimum:.3,maximum:.6}});
 let s=setNavalBarrage(emptyNavalBarrage(17,c),c,0,true);
 s=advanceNavalBarrage(s,c,2,0,true,true);expect(s.capacitySkipped).toBe(1);expect(s.launchedSalvos).toBe(0);
 s=advanceNavalBarrage(s,c,s.nextAtSeconds!,8,false,true);expect(s.absentSkipped).toBe(1);
 s=advanceNavalBarrage(s,c,s.nextAtSeconds!,8,true,true);expect(s.lastSalvo!.lanes).toHaveLength(1);expect(s.launchedSalvos).toBe(1);
});
it('fires three singles, then a distinct staggered pair with warnings only at each launch and final-impact cooldown',()=>{
 const sim=make(),launches:{at:number;lane:number;salvo:number}[]=[];
 for(let i=0;i<3600;i++){
  tick(sim);const s=sim.getState();
  for(const e of sim.consumeArtilleryEvents())if(e.kind==='artilleryLaunch')launches.push({at:e.shell.launchedAtSeconds,lane:e.shell.targetLane,salvo:s.navalBarrage!.launchedSalvos});
  if(launches.length===5)break;
 }
 expect(launches.map(s=>s.salvo)).toEqual([1,2,3,4,4]);
 const [first,second]=launches.slice(3);expect(first.lane).not.toBe(second.lane);
 expect(second.at-first.at).toBeGreaterThanOrEqual(.3-1e-8);expect(second.at-first.at).toBeLessThan(.6+1/60);
 const state=sim.getState(),b=state.navalBarrage!;expect(b.rhythm!.pendingShot).toBeUndefined();expect(b.pendingImpact!.shellIds).toHaveLength(2);
 expect(state.artillery!.shells.map(s=>s.launchedAtSeconds)).toEqual([first.at,second.at]);
 const finalImpact=b.pendingImpact!.finalImpactAtSeconds;
 while(sim.getFrameState().elapsedSeconds<finalImpact+1/60)tick(sim);
 const after=sim.getState().navalBarrage!;expect(after.cooldown!.resolvedAtSeconds).toBeCloseTo(finalImpact,8);
 expect(after.nextAtSeconds!-finalImpact).toBeGreaterThanOrEqual(2);expect(after.nextAtSeconds!-finalImpact).toBeLessThan(5);
});
it('round-trips a pending second shot through the production checkpoint without replay or RNG drift',()=>{
 const sim=fourth(),s=sim.getState(),options=carnivalOptionsFor(config);
 const checkpoint:SessionCheckpoint={version:1,simulationContract:1,game:'topwar',mode:'defense',savedAt:1,build:'phased',paused:true,hidden:false,reason:'pause',fixture:null,config,level:options.level,tuning:defaultRuntimeTuning(config,options.level),state:s};
 let value:string|null=null;const storage={getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;},removeItem:()=>{value=null;}};
 expect(writeCheckpoint(checkpoint,storage).ok).toBe(true);const found=readCheckpoint(storage);expect(found.status).toBe('valid');if(found.status!=='valid')throw Error('Checkpoint rejected');
 const copy=simulationFromCheckpoint(found.checkpoint);sim.consumeArtilleryEvents();expect(copy.consumeArtilleryEvents()).toEqual([]);
 for(let i=0;i<600;i++){const input=survivalDecision(sim,i,'competent');expect(survivalDecision(copy,i,'competent')).toEqual(input);sim.step(1/60,input,pilotTuning);copy.step(1/60,input,pilotTuning);expect(copy.consumeArtilleryEvents()).toEqual(sim.consumeArtilleryEvents());}
 expect(copy.getState()).toEqual(sim.getState());
 for(const mutate of [(v:typeof s)=>delete v.navalBarrage!.rhythm,(v:typeof s)=>v.navalBarrage!.rhythm!.pendingShot!.targetLane=99,(v:typeof s)=>v.navalBarrage!.rhythm!.pendingShot!.launchAtSeconds+=1]){
  const bad=structuredClone(s);mutate(bad);expect(()=>copy.restoreState(bad)).toThrow();
 }
});
it('blocks a delayed shot when capacity is occupied and launches it once after a late step',()=>{
 const sim=fourth(),s=sim.getState(),first=s.artillery!.shells[0];
 s.catharsis!.balance.artillery!.maxActive=1;sim.restoreState(s);tick(sim,50);
 expect(sim.getState().navalBarrage!.rhythm!.pendingShot).toBeDefined();
 expect(sim.getState().artillery!.shells).toHaveLength(1);
 // Let the first real shell resolve; the queued shot must still get its own launch.
 sim.consumeArtilleryEvents();let second=0;
 for(let i=0;i<300&&second===0;i++){tick(sim);second+=sim.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch').length;}
 expect(second).toBe(1);expect(sim.getState().artillery!.shells[0].launchedAtSeconds).toBeGreaterThan(first.impactAtSeconds);
 sim.restoreState(sim.getState());expect(sim.getState().navalBarrage!.cooldown).toBeUndefined();
});
it('cancels queued shots explicitly and at Tank introduction without deleting legal airborne shells',()=>{
 const sim=fourth(),s=sim.getState();sim.cancelArtillery();expect(sim.getState().navalBarrage!.rhythm!.pendingShot).toBeUndefined();sim.restoreState(sim.getState());
 sim.restoreState(s);const tank=sim.getState();tank.catharsis!.balance.defenseTank=structuredClone(config.catharsis!.defenseTank);tank.progression={level:9,xp:0};tank.squad={count:2,rifleCounts:[2],rifleRemainder:0,rocketCount:0};tank.weapons.rifleMemberCooldowns=[0,0];
 sim.restoreState(tank);sim.consumeArtilleryEvents();tick(sim);
 const after=sim.getState();expect(after.defenseTank!.status).toBe('entering');expect(after.navalBarrage!.enabled).toBe(false);expect(after.navalBarrage!.rhythm!.pendingShot).toBeUndefined();
 expect(after.artillery!.shells.map(s=>s.id)).toEqual(s.artillery!.shells.map(s=>s.id));
 tick(sim,40);expect(sim.consumeArtilleryEvents().filter(e=>e.kind==='artilleryLaunch'&&e.shell.source.type==='destroyer')).toEqual([]);sim.restoreState(sim.getState());
});

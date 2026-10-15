import {expect,it,vi} from 'vitest';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import {LevelDefinitionSchema} from '../src/level/LevelDefinition';
import {createDevReviewFixture} from '../src/app/DevReviewFixtures';
import {AIR_SUPPORT_THRESHOLD_COUNTS,type AirSupportThresholdFixture} from '../src/app/DevAirSupportReview';
import {qaSimulationTuning} from '../src/app/QaStressFixture';
import {defaultRuntimeTuning} from '../src/app/runtimeTuning';
import {readCheckpoint,writeCheckpoint,simulationFromCheckpoint,type SessionCheckpoint} from '../src/app/SessionCheckpoint';
import {supportBossHpThreshold} from '../src/simulation/commanderSupport';
import {PLAYTEST_ENTRIES} from '../src/app/PlaytestScenarios';
import type {Simulation} from '../src/simulation/Simulation';
const level=LevelDefinitionSchema.parse(levelData),tuning=qaSimulationTuning(config),options={seed:17,level,startSquad:1,startRocketCount:0,
  tiers:config.tiers,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}};
function recover(sim:Simulation,fixture:AirSupportThresholdFixture,dev=true){
  const c:SessionCheckpoint={version:1,simulationContract:1,game:'topwar',mode:'defense',savedAt:1,build:'threshold-review',paused:true,
    hidden:false,reason:'pause',fixture,config,level,tuning:defaultRuntimeTuning(config,level),state:sim.getState()};
  let text:string|null=null;const storage={getItem:()=>text,setItem:(_k:string,v:string)=>{text=v;},removeItem:()=>{text=null;}};
  expect(writeCheckpoint(c,storage).ok).toBe(true);vi.stubEnv('DEV',dev);try{return readCheckpoint(storage);}finally{vi.unstubAllEnvs();}
}
it.each(AIR_SUPPORT_THRESHOLD_COUNTS)('runs the real %i-MG review from above threshold through six rounds and a player kill, with deterministic Continue/Retry',count=>{
  const role:AirSupportThresholdFixture=`air-threshold-${count}`,before=structuredClone(options),sim=createDevReviewFixture(options,config.weapon.rifle.fireRate,role);
  const initial=sim.getState(),threshold=supportBossHpThreshold(config.catharsis!.commanderSupport!,count)!;
  expect(options).toEqual(before);expect(initial.progression).toEqual({level:count+7,xp:0});expect(initial.squad.count).toBe(count);
  expect(initial.weapons.rifleMemberCooldowns).toHaveLength(count);expect(new Set(initial.weapons.rifleMemberCooldowns).size).toBe(count);
  expect(initial.defenseTank).toMatchObject({status:'active',phase:3,hp:threshold+20});expect(initial.player).toMatchObject({x:0,selectedLane:2});
  expect(initial.commanderSupport!.airstrike).toMatchObject({status:'ready',triggeredAtSeconds:null,bombAtSeconds:null,strikesCompleted:0});
  expect(initial.enemies).toHaveLength(8);expect(initial.enemies.every(e=>e.lane===0||e.lane===4)).toBe(true);
  expect(initial.elapsedSeconds-initial.defenseTank!.startedAtSeconds).toBeGreaterThan(config.catharsis!.commanderSupport!.earliestBossSeconds);
  expect(createDevReviewFixture(options,config.weapon.rifle.fireRate,role).getState()).toEqual(initial);
  const restored=recover(sim,role);expect(restored.status).toBe('valid');expect(recover(sim,role,false).status).toBe('invalid');
  let copy:Simulation|undefined,trigger:number|null=null,totalDamage=0,rounds=0,completed=false,finalPlayerHit=false;
  for(let tick=0;tick<1800;tick++){
    const s=sim.getState();if(s.defenseTank!.status==='defeated')break;
    expect(s.squad.count).toBeGreaterThan(0);
    const danger=s.artillery?.shells.filter(p=>p.impactAtSeconds-s.elapsedSeconds<1.1)??[];
    const target=danger.length?[0,1,2,3,4].filter(l=>!danger.some(p=>p.targetLane===l)).sort((a,b)=>Math.abs(a-2)-Math.abs(b-2))[0]:2;
    for(const runner of copy?[sim,copy]:[sim]){
      if(target!==undefined&&target!==s.player.selectedLane)runner.stepLane(target<s.player.selectedLane!?-1:1);
      runner.step(1/60,{targetX:s.player.x},tuning);
    }
    const next=sim.getState(),events=sim.consumeSupportEvents();if(copy)expect(copy.consumeSupportEvents()).toEqual(events);
    const air=next.commanderSupport!.airstrike!;
    if(air.triggeredAtSeconds!==null){if(trigger===null){trigger=air.triggeredAtSeconds;expect(next.defenseTank!.hp).toBeLessThanOrEqual(threshold);expect(next.squad.count).toBe(count);}
      expect(air.triggeredAtSeconds).toBe(trigger);expect(air.bombAtSeconds!-trigger).toBe(7.5);}
    for(const event of events)if(event.kind==='supportBomb'){
      expect(next.elapsedSeconds-trigger!).toBeCloseTo(7.5+rounds*.65,6);rounds++;totalDamage+=event.tankDamage??0;
      expect(event.tankDamage??0).toBeLessThanOrEqual(500);if(event.tankDamage)expect(next.defenseTank!.hp).toBeGreaterThanOrEqual(150);
    }
    if(tick===80){const result=recover(sim,role);expect(result.status).toBe('valid');if(result.status!=='valid')throw Error('Invalid fixture checkpoint');copy=simulationFromCheckpoint(result.checkpoint);expect(copy.consumeSupportEvents()).toEqual([]);}
    if(air.status==='completed'&&!completed){completed=true;expect(recover(sim,role).status).toBe('valid');}
    if(next.defenseTank!.status==='defeated')finalPlayerHit=next.combatStats!.shotsHit>s.combatStats!.shotsHit;
  }
  expect(rounds).toBe(6);expect(totalDamage).toBeGreaterThan(0);expect(totalDamage).toBeLessThanOrEqual(500);expect(completed).toBe(true);
  expect(sim.getState().defenseTank).toMatchObject({hp:0,status:'defeated'});expect(finalPlayerHit).toBe(true);expect(copy!.getState()).toEqual(sim.getState());
  expect(createDevReviewFixture(options,config.weapon.rifle.fireRate,role).getState()).toEqual(initial);
});
it('retains exactly the four shared entries and the independent dense Tank review',()=>{
  expect(PLAYTEST_ENTRIES.map(e=>e.role)).toEqual(['naval','boss-intro','victory','air-support']);
  expect(createDevReviewFixture(options,config.weapon.rifle.fireRate,'boss-dense').getState().enemies).toHaveLength(67);
});

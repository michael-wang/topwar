import { expect, it } from 'vitest';
// @ts-expect-error QA diagnostics use Node, outside the browser application.
import { mkdirSync, writeFileSync } from 'node:fs';
const evidence=(name:string,value:unknown)=>{mkdirSync('artifacts/p4.45c',{recursive:true});writeFileSync('artifacts/p4.45c/'+name+'.json',JSON.stringify(value,null,2));};
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { qaSimulationTuning } from '../src/app/QaStressFixture';
import { createTankPlaytest } from '../src/app/TankPlaytest';
import { prepareOpeningCohort } from '../src/app/openingCohort';
import { createDefenseSquadFormation } from '../src/simulation/squad/formation';
import { attackLanePositions } from '../src/simulation/enemies/laneComposition';

const level=LevelDefinitionSchema.parse(levelData), tuning=qaSimulationTuning(config);
const options={seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
  catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}};
it('bounds every authored formation muzzle and aimed projectile at the shoreline, with no invisible offshore hits',()=>{
  expect(config.weapon.rifle.range).toBe(44.25);expect(config.catharsis!.machineGun.range).toBe(44.25);
  const lanes=attackLanePositions(5,config.track.halfWidth,config.catharsis!.edgeInset);
  for(const lv of [1,4,5,6,9,10,11,12])for(const lane of [0,1,2,3,4]){
    const sim=new Simulation(options),s=sim.getState(),count=config.catharsis!.progression.levelPlan[lv-1].squadStage;
    s.progression={level:lv,xp:0};s.squad={count,rifleCounts:[count],rocketCount:0,rifleRemainder:0};
    s.player={x:lanes[lane],z:0,selectedLane:lane};s.weapons.rifleMemberCooldowns=Array(count).fill(0);
    s.enemies=[{id:999,tier:1,lane,x:lanes[lane],z:60,hp:15,archetype:'heavy'},
      {id:998,tier:1,lane,x:lanes[lane]+.2,z:43,hp:15,archetype:'heavy'}];
    s.enemyStream!.nextEnemyId=1000;s.defenseWaves!.nextAtSeconds=1000;sim.restoreState(s);
    sim.step(1/60,{targetX:lanes[lane]},tuning);
    const offsets=createDefenseSquadFormation(count,config.player.formationSpacing,config.catharsis!.progression,lanes[lane],config.track.halfWidth-config.catharsis!.edgeInset);
    for(const p of sim.getState().projectiles){expect(p.z+p.remainingRange).toBeCloseTo(offsets[p.memberIndex!].z+44.25);expect(p.z+p.remainingRange).toBeLessThanOrEqual(45.500001);}
    const fired=sim.getState();fired.weapons.rifleMemberCooldowns=Array(count).fill(100);sim.restoreState(fired);
    for(let i=0;i<60;i++)sim.step(1/60,{targetX:lanes[lane]},tuning);
    expect(sim.getState().projectiles.some(p=>fired.projectiles.some(old=>old.id===p.id))).toBe(false);expect(sim.getState().projectiles.every(p=>p.z<=45.5)).toBe(true);expect(sim.getState().enemies.find(e=>e.id===999)?.hp).toBe(15);
  }
});
it.each([1,6])('hits ordinary beach enemies with the actual Lv%i weapon',lv=>{
  const sim=new Simulation(options),s=sim.getState();s.progression={level:lv,xp:0};
  s.enemies=[{id:999,tier:1,lane:2,x:0,z:44.5,hp:15,archetype:'heavy'}];s.enemyStream!.nextEnemyId=1000;s.defenseWaves!.nextAtSeconds=1000;
  sim.restoreState(s);for(let i=0;i<120;i++)sim.step(1/60,{targetX:0},tuning);
  expect(sim.getState().enemies.find(e=>e.id===999)?.hp??0).toBeLessThan(15);
});
it('keeps an embedded historical 80 range executable and deterministic after restore',()=>{
  const old=structuredClone(config);old.weapon.rifle.range=80;old.catharsis!.machineGun.range=80;
  const sim=new Simulation({...options,catharsis:{...options.catharsis,balance:old.catharsis!}}),s=sim.getState();
  s.enemies=[];s.enemyStream!.nextEnemyId=1000;s.defenseWaves!.nextAtSeconds=1000;sim.restoreState(s);const clone=new Simulation(options);clone.restoreState(s);
  for(let i=0;i<60;i++){sim.step(1/60,{targetX:0},qaSimulationTuning(old));clone.step(1/60,{targetX:0},qaSimulationTuning(old));}
  expect(clone.getState()).toEqual(sim.getState());expect(sim.getState().projectiles.some(p=>p.z>45.5)).toBe(true);
});
it('compares the real 16-person opening for 60 seconds without changing other balance',()=>{
  const reports=[];
  for(const range of [80,44.25]){
    const c=structuredClone(config);c.weapon.rifle.range=range;c.catharsis!.machineGun.range=range;
    const sim=new Simulation({...options,catharsis:{...options.catharsis,balance:c.catharsis!}});prepareOpeningCohort(sim);
    const milestones:Record<number,number>={};
    for(let i=0;i<3600&&sim.getFrameState().squad.count;i++){
      const s=sim.getFrameState();milestones[s.progression!.level]??=s.elapsedSeconds;
      if(i%12===0){const enemy=[...s.enemies].sort((a,b)=>a.z-b.z)[0];const lane=s.grenade?.supply?.lane??enemy?.lane??2;
        for(let j=0;j<4&&sim.getFrameState().player.selectedLane!==lane;j++)sim.stepLane(lane>sim.getFrameState().player.selectedLane!?1:-1);}
      sim.step(1/60,{targetX:0,throwGrenade:(s.grenade?.inventory??0)>0&&s.enemies.some(e=>e.z<12)},qaSimulationTuning(c));
    }
    const s=sim.getState();reports.push({range,seconds:s.elapsedSeconds,level:s.progression,kills:s.combatStats,milestones,squad:s.squad.count});
    expect(s.elapsedSeconds).toBeCloseTo(60);expect(s.squad.count).toBeGreaterThan(0);
  }
  evidence('range-60s',reports);
});
it('finishes the full-HP shipping Boss with shoreline MGs and ordinary support inputs',()=>{
  const sim=createTankPlaytest(options,config.weapon.rifle.fireRate,false);let firstHit:number|undefined;
  for(let i=0;i<60*210&&sim.getFrameState().squad.count&&sim.getFrameState().defenseTank?.status!=='defeated';i++){
    const s=sim.getFrameState();const danger=(s.artillery?.shells??[]);
    const threat=[...s.enemies].filter(e=>e.z<22).sort((a,b)=>a.z-b.z)[0];const lane=[threat?.lane??2,2,1,3,0,4].find(l=>!danger.some(p=>p.targetLane===l))!;
    if(s.player.selectedLane!==lane)sim.stepLane(lane>s.player.selectedLane!?1:-1);
    sim.step(1/60,{targetX:0,throwGrenade:(s.grenade?.inventory??0)>0&&!!threat,supportNoticeStarted:true,supportNoticeComplete:true,callAirSupport:true},tuning);
    if(sim.getFrameState().defenseTank!.hp<config.catharsis!.defenseTank!.hp)firstHit??=sim.getFrameState().elapsedSeconds;
  }
  const s=sim.getState();evidence('range-boss',{firstHit,seconds:s.elapsedSeconds,hp:s.defenseTank!.hp,status:s.defenseTank!.status,squad:s.squad.count,stats:s.combatStats,enemies:s.enemies.filter(e=>e.z<5)});
  expect(firstHit).toBeDefined();expect(s.defenseTank!.status).toBe('defeated');
});
it('preserves Boss entry invulnerability and first hit when active armor is within shoreline range',()=>{
  const report=[];
  for(const range of [80,44.25]){
    const c=structuredClone(config);c.weapon.rifle.range=range;c.catharsis!.machineGun.range=range;
    const sim=createTankPlaytest({...options,catharsis:{...options.catharsis,balance:c.catharsis!}},c.weapon.rifle.fireRate,true);
    const initial=sim.getState();initial.enemies=[];sim.restoreState(initial);
    let hit: {range:number;seconds:number;frontZ:number}|undefined;
    for(let i=0;i<60*15&&!hit;i++){
      sim.step(1/60,{targetX:0},qaSimulationTuning(c));const s=sim.getFrameState();
      if(s.defenseTank&&s.defenseTank.hp<c.catharsis!.defenseTank!.hp)
        hit={range,seconds:s.elapsedSeconds-initial.elapsedSeconds,frontZ:s.defenseTank.z-c.catharsis!.defenseTank!.halfDepth};
    }
    expect(hit).toBeDefined();report.push(hit!);
  }
  expect(report[1].frontZ).toBeLessThanOrEqual(44.34);expect(report[1].frontZ).toBeCloseTo(37.3);expect(report[1].seconds).toBeCloseTo(report[0].seconds);
  evidence('range-boss-entry',report);
});

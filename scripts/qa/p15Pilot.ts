import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import type { SimulationFrameState } from '../../src/simulation/SimulationState';
import { grenadeTarget, enemiesInBlast } from '../../src/simulation/grenade';
import { enemyApproachSpeed, pressureWaveSettings } from '../../src/simulation/enemies/latePressure';

const config = GameConfigSchema.parse(data), balance = config.catharsis!;
export const pilotTuning = { ...config.player, trackHalfWidth: config.track.halfWidth,
  defenseLineOffset: config.track.defenseLineOffset, normalEnemyRadius: config.tiers.normalEnemyRadius,
  bossRadius: config.bosses.basic.radius, rifle: config.weapon.rifle, rocket: config.weapon.rocket };
export function pressure(state: SimulationFrameState) {
  const ahead = state.enemies.filter(e => e.z > state.player.z - config.track.defenseLineOffset);
  const distances = ahead.map(e => Math.max(0,e.z-state.player.z));
  const debt = Array.from({length:balance.laneCount},(_,lane)=>ahead.filter(e=>e.lane===lane).reduce((sum,e)=>sum+e.hp,0));
  const near = ahead.filter(e=>e.z-state.player.z<=10);
  return { active: state.enemies.length, nearDefense: near.length, rifleHitDebt: debt,
    nearLaneDebt: debt.map((_,lane)=>near.filter(e=>e.lane===lane).reduce((sum,e)=>sum+e.hp,0)),
    nearestDistance: distances.length ? Math.min(...distances) : null,
    approximateTimeToContact: ahead.length ? Math.min(...ahead.map(e=>Math.max(0,e.z-state.player.z
      -config.player.memberRadius-config.tiers.normalEnemyRadius)/(config.player.forwardSpeed+enemyApproachSpeed(e,balance)))) : null,
    heavyOverlap: ahead.filter(e=>e.archetype==='heavy').length };
}
export function runPilot(seed: number, hesitation = false, useGrenade = true, adjacentOnly = false, targetLevel = 5,
  includeFinalState = false, balance = config.catharsis!) {
  const sim = new Simulation({seed,level:LevelDefinitionSchema.parse(levelData),startSquad:1,startRocketCount:0,
    tiers:config.tiers,catharsis:{balance,trackHalfWidth:config.track.halfWidth}});
  const milestones: Record<number,number> = {}, phasePeaks: Record<number,{near:number;debt:number;heavy:number}> = {};
  let activation: number|null=null, detonation: number|null=null, xpAtSpawn:unknown=null, xpAtDetonation:unknown=null;
  let beforeBlast:ReturnType<typeof pressure>|null=null, afterBlast:ReturnType<typeof pressure>|null=null, twoSecondsAfter:ReturnType<typeof pressure>|null=null;
  let grenadeVictims:any[] = [], contactCasualties=0, gruntKills=0, heavyKills=0, peakHeavyOverlap=0;
  let hesitationStart:ReturnType<typeof pressure>|null=null, hesitationEnd:ReturnType<typeof pressure>|null=null;
  let evolution:unknown=null;
  const ramps:unknown[]=[], groupAdmissions:unknown[]=[];
  const rampLevels=new Set<number>();
  const timeline:unknown[]=[];
  for(let tick=0;tick<60*180 && sim.getFrameState().squad.count;tick++) {
    const before=sim.getState(), lv3=milestones[3], elapsed=before.elapsedSeconds;
    // One 1.8s lane-choice lapse begins 3s into Lv3. Auto-fire is unchanged.
    const hesitating=hesitation && lv3!==undefined && elapsed>=lv3+3 && elapsed<lv3+4.8;
    if(hesitating && !hesitationStart)hesitationStart=pressure(before);
    if(hesitationStart && !hesitating && !hesitationEnd)hesitationEnd=pressure(before);
    if(tick%12===0 && !hesitating) {
      const threat=[...before.enemies].filter(e=>e.z>before.player.z).sort((a,b)=>a.z-b.z||a.id-b.id)[0];
      const lane=before.grenade?.supply?.lane ?? threat?.lane ?? before.player.selectedLane!;
      let difference=lane-before.player.selectedLane!;
      while(difference) {sim.stepLane(difference>0?1:-1);difference-=Math.sign(difference);if(adjacentOnly)break;}
    }
    const current=sim.getFrameState(), target=current.grenade?.inventory===1 ? grenadeTarget(current,balance.grenade) : undefined;
    const members=target ? enemiesInBlast(current.enemies,target.x,target.z,balance.grenade.blastRadius) : [];
    const nearest=Math.min(Infinity,...current.enemies.map(e=>e.z-current.player.z).filter(d=>d>0));
    const heldSeconds=elapsed-(current.grenade?.acquiredAtSeconds??elapsed);
    const targetDepth=target?target.z-current.player.z:Infinity;
    const throwGrenade=useGrenade && !hesitating && !!target && ((members.length>=6 && targetDepth<=10)
      || (nearest<4 && members.length>=3 && targetDepth<=6) || (heldSeconds>=8 && members.length>=6 && targetDepth<=14));
    if(throwGrenade && activation===null)activation=elapsed;
    sim.step(1/60,{targetX:0,throwGrenade},pilotTuning);
    const after=sim.getFrameState();
    const settings=pressureWaveSettings(balance,after.progression!);
    if(settings.pressureLaneCount!==balance.pressureLaneCount && !rampLevels.has(after.progression!.level)) {
      rampLevels.add(after.progression!.level);
      ramps.push({seconds:after.elapsedSeconds,...after.progression,...settings,pressure:pressure(after)});
    }
    const admitted=after.enemies.filter(e=>e.id>=before.enemyStream!.nextEnemyId);
    if(admitted.length)groupAdmissions.push({seconds:after.elapsedSeconds,...before.progression,
      population:after.enemyStream!.nextEnemyId-before.enemyStream!.nextEnemyId,
      survivingPopulation:admitted.length,fronts:new Set(admitted.map(e=>e.lane)).size,
      heavies:admitted.filter(e=>e.archetype==='heavy').length});
    const contacts=sim.consumePresentationEvents();
    contactCasualties+=contacts.reduce((sum,e)=>sum+Math.max(0,e.before.count-e.after.count),0);
    const contactIds=new Set(contacts.filter(e=>e.kind==='normalEnemyContact').map(e=>e.enemyId));
    const remaining=new Set(after.enemies.map(e=>e.id));
    for(const enemy of before.enemies)if(!remaining.has(enemy.id)&&!contactIds.has(enemy.id)) {
      if(enemy.archetype==='heavy')heavyKills++;else if(enemy.archetype==='grunt')gruntKills++;
    }
    const p=pressure(after);peakHeavyOverlap=Math.max(peakHeavyOverlap,p.heavyOverlap);
    const peak=phasePeaks[before.progression!.level]??={near:0,debt:0,heavy:0};
    peak.near=Math.max(peak.near,p.nearDefense);peak.debt=Math.max(peak.debt,p.rifleHitDebt.reduce((a,b)=>a+b,0));peak.heavy=Math.max(peak.heavy,p.heavyOverlap);
    if(after.progression!.level>before.progression!.level) for(let lv=before.progression!.level+1;lv<=after.progression!.level;lv++)milestones[lv]=after.elapsedSeconds;
    if(before.grenade!.supplySpawnedAtSeconds===null && after.grenade!.supplySpawnedAtSeconds!==null)xpAtSpawn={...before.progression};
    for(const event of sim.consumeGrenadeEvents())if(event.kind==='grenadeDetonated') {
      detonation=after.elapsedSeconds;grenadeVictims=event.victims;
      beforeBlast=pressure(before);afterBlast=p;xpAtDetonation={before:{...before.progression},after:{...after.progression}};
    }
    if(detonation!==null && !twoSecondsAfter && after.elapsedSeconds>=detonation+2)twoSecondsAfter=p;
    if(tick%60===0)timeline.push({seconds:after.elapsedSeconds,level:after.progression!.level,xp:after.progression!.xp,...p});
    if(before.progression!.level<6 && after.progression!.level>=6)evolution={seconds:after.elapsedSeconds,beforeSquad:before.squad.count,afterSquad:after.squad.count,xpBefore:before.progression!.xp,xpAfter:after.progression!.xp,pressure:p};
    if(after.progression!.level>=targetLevel && (detonation===null || twoSecondsAfter))break;
  }
  const end=sim.getFrameState();
  return {seed,pilot:hesitation?'hesitation':'normal',useGrenade,adjacentOnly,milestones,
    evolution,ramps,groupAdmissions,lv5Duration:milestones[6]===undefined?null:milestones[6]-milestones[5],
    lv3Duration:milestones[4]===undefined?null:milestones[4]-milestones[3],
    supplySpawn:end.grenade!.supplySpawnedAtSeconds,acquisition:end.grenade!.acquiredAtSeconds,activation,detonation,
    xpAtSpawn,xpAtDetonation,grenadeVictims,grenadeKills:grenadeVictims.filter(v=>v.killed).length,
    grenadeKillXp:grenadeVictims.reduce((sum,v)=>sum+v.killXp,0),gruntKills,heavyKills,peakHeavyOverlap,
    contactCasualties,failed:end.squad.count===0,finalLevel:end.progression!.level,endSeconds:end.elapsedSeconds,
    hesitationStart,hesitationEnd,beforeBlast,afterBlast,twoSecondsAfter,phasePeaks,timeline,
    ...(includeFinalState ? { finalState:sim.getState() } : {})};
}

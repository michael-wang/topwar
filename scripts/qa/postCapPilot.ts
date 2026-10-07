import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import { grenadeTarget, enemiesInBlast } from '../../src/simulation/grenade';
import { pilotTuning, pressure } from './p15Pilot';

const config=GameConfigSchema.parse(data);
export function runPostCapPilot(seed:number,seconds=150,enabled=true,exerciseRecurringUse=false) {
  const balance=structuredClone(config.catharsis!);balance.postCapSurvival.enabled=enabled;
  const sim=new Simulation({seed,level:LevelDefinitionSchema.parse(levelData),startSquad:1,startRocketCount:0,
    tiers:config.tiers,catharsis:{balance,trackHalfWidth:config.track.halfWidth}});
  const milestones:Record<number,number>={},groups:any[]=[],giants:any[]=[],supplies:any[]=[],acquisitions:any[]=[],
    throws:any[]=[],timeline:any[]=[],inventory:any[]=[],giantDeaths:any[]=[];
  let activation:number|null=null,release:any=null,casualties=0,maxNear=0,maxActive=0,maxHeavy=0,
    maxGiant=0,lastInventory=0,emptySeconds=0,emptySince:number|null=null,longestEmptySeconds=0;
  for(let tick=0;tick<60*(seconds+200)&&sim.getFrameState().squad.count;tick++) {
    const before=sim.getState();
    if(tick%12===0) {
      const nearest=[...before.enemies].sort((a,b)=>a.z-b.z||a.id-b.id)[0],giant=before.enemies.find(e=>e.archetype==='giant');
      const threat=giant&&(!nearest||nearest.z-before.player.z>10)?giant:nearest;
      const lane=before.grenade?.supply?.lane??threat?.lane??before.player.selectedLane!;
      if(lane!==before.player.selectedLane)sim.stepLane(lane<before.player.selectedLane!?-1:1);
    }
    const state=sim.getFrameState(),target=state.grenade!.inventory>0&&!state.grenade!.flight?grenadeTarget(state,balance.grenade):undefined;
    const victims=target?enemiesInBlast(state.enemies,target.x,target.z,balance.grenade.blastRadius):[];
    const depth=target?target.z-state.player.z:Infinity;
    const throwGrenade=!!target&&((exerciseRecurringUse&&activation!==null)
      || (victims.length>=6&&depth<=14)
      || (depth<=10&&victims.reduce((sum,e)=>sum+e.hp,0)>=12));
    sim.step(1/60,{targetX:0,throwGrenade},pilotTuning);const after=sim.getFrameState();
    const post=after.postCapSurvival!,prior=before.postCapSurvival!;
    for(let lv=before.progression!.level+1;lv<=after.progression!.level;lv++)milestones[lv]=after.elapsedSeconds;
    if(activation===null&&post.startedAtSeconds!==null)activation=post.startedAtSeconds;
    const newEnemies=after.enemies.filter(e=>e.id>=before.enemyStream!.nextEnemyId),newGiants=newEnemies.filter(e=>e.archetype==='giant'),ordinary=newEnemies.filter(e=>e.archetype!=='giant');
    if(before.machineGunReleaseAtSeconds===null&&after.machineGunReleaseAtSeconds!==null)
      release={seconds:after.elapsedSeconds,grunt:ordinary.filter(e=>e.archetype==='grunt').length,
        heavy:ordinary.filter(e=>e.archetype==='heavy').length,fronts:new Set(ordinary.map(e=>e.lane)).size};
    else if(ordinary.length)groups.push({seconds:after.elapsedSeconds,postCap:prior.startedAtSeconds!==null,
      count:after.enemyStream!.nextEnemyId-before.enemyStream!.nextEnemyId-newGiants.length,
      heavy:ordinary.filter(e=>e.archetype==='heavy').length,grunt:ordinary.filter(e=>e.archetype==='grunt').length,
      fronts:new Set(ordinary.map(e=>e.lane)).size});
    if(prior.startedAtSeconds!==null&&post.nextGiantAtSeconds!==prior.nextGiantAtSeconds)
      giants.push({due:prior.nextGiantAtSeconds,seconds:after.elapsedSeconds,
        result:newGiants.length?'spawn':'skip-occupied',ids:newGiants.map(e=>e.id)});
    if(prior.startedAtSeconds!==null&&post.nextGrenadeSupplyAtSeconds!==prior.nextGrenadeSupplyAtSeconds)
      supplies.push({due:prior.nextGrenadeSupplyAtSeconds,seconds:after.elapsedSeconds,
        result:!before.grenade!.supply&&after.grenade!.supply?.rewardAmount!==undefined?'spawn'
          :before.grenade!.supply?'skip-existing':after.grenade!.inventory>=balance.grenade.capacity?'skip-full'
          :'skip-teaching-pending',inventory:after.grenade!.inventory});
    const contacts=sim.consumePresentationEvents();casualties+=contacts.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0);
    const contactIds=new Set(contacts.map(e=>e.kind==='normalEnemyContact'?e.enemyId:-1));
    for(const giant of before.enemies.filter(e=>e.archetype==='giant'))if(!after.enemies.some(e=>e.id===giant.id))
      giantDeaths.push({seconds:after.elapsedSeconds,id:giant.id,killed:!contactIds.has(giant.id),xpBefore:before.progression,xpAfter:after.progression});
    for(const event of sim.consumeGrenadeEvents()) {
      if(event.kind==='grenadeAcquired')acquisitions.push({seconds:after.elapsedSeconds,postCap:activation!==null,
        amount:before.grenade!.supply?.rewardAmount??balance.grenade.capacity,before:before.grenade!.inventory,after:after.grenade!.inventory});
      else throws.push({seconds:after.elapsedSeconds,postCap:activation!==null,kills:event.victims.filter(v=>v.killed).length,
        xp:event.victims.reduce((sum,v)=>sum+v.killXp,0),inventory:after.grenade!.inventory});
    }
    if(after.grenade!.inventory!==lastInventory) {inventory.push({seconds:after.elapsedSeconds,count:after.grenade!.inventory});lastInventory=after.grenade!.inventory;}
    if(activation!==null) {
      const p=pressure(after),heavy=after.enemies.filter(e=>e.archetype==='heavy').length,giant=after.enemies.filter(e=>e.archetype==='giant').length;
      maxNear=Math.max(maxNear,p.nearDefense);maxActive=Math.max(maxActive,p.active);maxHeavy=Math.max(maxHeavy,heavy);maxGiant=Math.max(maxGiant,giant);
      if(!after.enemies.length){emptySeconds+=1/60;emptySince??=after.elapsedSeconds;longestEmptySeconds=Math.max(longestEmptySeconds,after.elapsedSeconds-emptySince);}
      else emptySince=null;
      if(tick%60===0)timeline.push({seconds:after.elapsedSeconds,postSeconds:after.elapsedSeconds-activation,active:p.active,
        near:p.nearDefense,heavy,giant,inventory:after.grenade!.inventory,hitDebt:p.rifleHitDebt});
      if(after.elapsedSeconds-activation>=seconds-1e-9)break;
    } else if(!enabled&&milestones[6]!==undefined&&after.elapsedSeconds>=milestones[6]+10)break;
  }
  const end=sim.getFrameState();
  return {seed,enabled,exerciseRecurringUse,secondsRequested:seconds,milestones,activation,secondsAfterActivation:activation===null?0:end.elapsedSeconds-activation,
    release,groups,giants,giantDeaths,supplies,acquisitions,throws,inventory,timeline,
    peak:{active:maxActive,near:maxNear,heavy:maxHeavy,giant:maxGiant},emptySeconds,longestEmptySeconds,
    permanentlyEmpty:!!emptySince&&end.elapsedSeconds-emptySince>balance.postCapSurvival.giantIntervalSeconds,
    casualties,failed:!end.squad.count,failureSeconds:!end.squad.count?end.elapsedSeconds:null,
    final:{seconds:end.elapsedSeconds,active:end.enemies.length,level:end.progression,postCapSurvival:end.postCapSurvival}};
}

import data from '../../public/game-data/game.json';
import levelData from '../../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { LevelDefinitionSchema } from '../../src/level/LevelDefinition';
import { Simulation } from '../../src/simulation/Simulation';
import type { SimulationFrameState } from '../../src/simulation/SimulationState';
import { createDevReviewFixture } from '../../tests/helpers/ReviewFixtures';
import { grenadeTarget, enemiesInBlast } from '../../src/simulation/grenade';
import { pilotTuning } from './p15Pilot';

export const carnivalConfig = GameConfigSchema.parse(data);
export const carnivalOptions = { seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1,
  startRocketCount: 0, tiers: carnivalConfig.tiers,
  catharsis: { balance: carnivalConfig.catharsis!, trackHalfWidth: carnivalConfig.track.halfWidth } };
export function carnivalEntry(seed = 17) {
  const sim = new Simulation({ ...carnivalOptions, seed });
  const state = createDevReviewFixture(carnivalOptions, carnivalConfig.weapon.rifle.fireRate, 'carnival').getState();
  state.seed = seed; state.rngState = sim.getState().rngState; sim.restoreState(state); return sim;
}
// Adjacent step at most every 200ms; nearest threat, with the original teaching
// Giant prioritized while safe. No teleporting, hit guarantees, or XP injection.
export function carnivalPilotLane(s: SimulationFrameState): number {
  const nearest = [...s.enemies].filter(e => e.z > s.player.z).sort((a,b) => a.z-b.z || a.id-b.id)[0];
  const giant = s.enemies.find(e => e.archetype === 'giant');
  return s.grenade?.supply?.lane ?? (giant && (!nearest || nearest.z-s.player.z>10) ? giant : nearest)?.lane ?? s.player.selectedLane!;
}
export function carnivalPilotGrenade(s: SimulationFrameState, distant = false): boolean {
  const c=s.catharsis!.balance.grenade, target=grenadeTarget(s,c);
  return !!target && (s.grenade?.inventory??0)>0 && !s.grenade?.flight && (distant || target.z-s.player.z<=14)
    && enemiesInBlast(s.enemies,target.x,target.z,c.blastRadius).length>=6;
}
export function runCarnivalPilot(seed: number, natural = false, grenades = false, activeLimit?: number) {
  const sim = natural ? new Simulation({...carnivalOptions,seed}) : carnivalEntry(seed);
  if(activeLimit!==undefined)sim.setCatharsisBalance({...sim.getState().catharsis!.balance,
    carnival:{...carnivalConfig.catharsis!.carnival,activeEnemyLimit:activeLimit}});
  let start: number|null=null, lv7: number|null=null, available20=0, samples20=0, available=0, samples=0;
  let gap=0,longestGap=0,peakEnemies=0,peakProjectiles=0,casualties=0,grunts=0,heavies=0,kills=0,throws=0;
  const timeline: {seconds:number;survivors:number;grunts:number;heavies:number;level:number;xp:number}[]=[];
  const waves: {seconds:number;grunts:number;heavies:number;lanes:number[]}[]=[];
  let nextSample=0;
  for(let tick=0;tick<60*240 && sim.getFrameState().squad.count;tick++) {
    const b=sim.getFrameState();
    if(tick%12===0) { const lane=carnivalPilotLane(b); if(lane!==b.player.selectedLane) sim.stepLane(lane<b.player.selectedLane! ? -1:1); }
    sim.step(1/60,{targetX:0,throwGrenade:(grenades || natural && start===null)
      && carnivalPilotGrenade(sim.getFrameState(),grenades && start!==null)},pilotTuning);
    const s=sim.getFrameState(), phase=s.carnival!;
    const contacts=sim.consumePresentationEvents();sim.consumeGrenadeEvents();
    if(phase.startedAtSeconds===null)continue;
    start??=phase.startedAtSeconds;
    if(!b.grenade?.flight && s.grenade?.flight)throws++;
    const elapsed=s.elapsedSeconds-start;
    if(s.progression!.level>=7 && lv7===null)lv7=elapsed;
    const added=s.enemies.filter(e=>e.id>=b.enemyStream!.nextEnemyId);
    const newGrunts=added.filter(e=>e.archetype==='grunt').length,newHeavies=added.filter(e=>e.archetype==='heavy').length;
    grunts+=newGrunts;heavies+=newHeavies;
    if(added.length)waves.push({seconds:elapsed,grunts:newGrunts,heavies:newHeavies,lanes:[...new Set(added.map(e=>e.lane!))]});
    const survivors=new Set(s.enemies.map(e=>e.id));kills+=b.enemies.filter(e=>!survivors.has(e.id)).length;
    casualties+=contacts.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0);
    peakEnemies=Math.max(peakEnemies,s.enemies.length);peakProjectiles=Math.max(peakProjectiles,s.projectiles.length);
    // Meaningful availability: >=6 living Grunts ahead of the player and within
    // the visible spawn horizon (47 units), across any reachable attack lanes.
    // Counts availability, not selected-lane alignment or guaranteed hits.
    const meaningful=s.enemies.filter(e=>e.archetype==='grunt' && e.hp>0 && e.z>s.player.z
      && e.z-s.player.z<=s.catharsis!.balance.defenseSpawnAheadDistance).length>=6;
    if(elapsed<24-1e-8) { samples++;if(meaningful)available++;
      if(elapsed<20-1e-8){samples20++;if(meaningful)available20++;}
      gap=meaningful?0:gap+1/60;longestGap=Math.max(longestGap,gap);
    }
    if(elapsed+1e-8>=nextSample) {timeline.push({seconds:nextSample,survivors:s.enemies.length,
      grunts:s.enemies.filter(e=>e.archetype==='grunt').length,heavies:s.enemies.filter(e=>e.archetype==='heavy').length,
      level:s.progression!.level,xp:s.progression!.xp});nextSample+=2;}
    if(phase.status==='complete')break;
  }
  const end=sim.getState();
  return {seed,natural,grenades,duration:end.carnival!.elapsedSeconds,phase:end.carnival!.status,
    spawned:{grunts,heavies},survivors:timeline,availabilityFirst20Percent:samples20?100*available20/samples20:0,
    availabilityFullPercent:samples?100*available/samples:0,longestGapSeconds:longestGap,lv7Seconds:lv7,
    peakEnemies,peakProjectiles,casualties,failure:end.squad.count===0,kills,throws,waves};
}

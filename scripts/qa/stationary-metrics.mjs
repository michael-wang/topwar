import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.argv[2]??'artifacts/stage1-p25/after';mkdirSync(out,{recursive:true});
const server=await createServer({...(process.env.TOPWAR_QA_ROOT?{root:process.env.TOPWAR_QA_ROOT,configFile:false}:{}),
 server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {Simulation}=await server.ssrLoadModule('/src/simulation/Simulation.ts');
 const {carnivalOptions,carnivalPilotLane,carnivalPilotGrenade,runCarnivalPilot}=await server.ssrLoadModule('/scripts/qa/carnivalPilot.ts');
 const {pilotTuning}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
 const approaches=[];
 for(const archetype of ['grunt','heavy','giant']) {
  const sim=new Simulation({...carnivalOptions,level:{id:'approach',length:100,enemyGroups:[],upgradeGates:[]}}),s=sim.getState();
  s.enemies=[{id:1,tier:1,archetype,lane:4,x:2.8,z:20,hp:archetype==='grunt'?1:archetype==='heavy'?15:172}];
  s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;
  if(archetype==='giant')s.giantEncounter={scheduledAtSeconds:0,spawned:true};sim.restoreState(s);
  while(sim.getFrameState().squad.count && sim.getFrameState().elapsedSeconds<60)sim.step(1/60,{targetX:0},pilotTuning);
  approaches.push({archetype,startDepth:20,defenseLineOffset:pilotTuning.defenseLineOffset,crossingSeconds:sim.getFrameState().elapsedSeconds});
 }
 const runs=[];
 for(const seed of [1,17,42,99,2026]) {
  const sim=new Simulation({...carnivalOptions,seed}),milestones={},waves=[],timeline=[],snapshots={};
  let casualties=0,peak=0,releases=0,lastSample=-1;
  for(let tick=0;tick<60*240&&sim.getFrameState().squad.count;tick++) {
   const b=sim.getFrameState();if(tick%12===0){const lane=carnivalPilotLane(b);if(lane!==b.player.selectedLane)sim.stepLane(lane<b.player.selectedLane?-1:1);}
   sim.step(1/60,{targetX:0,throwGrenade:carnivalPilotGrenade(sim.getFrameState())},pilotTuning);
   const s=sim.getFrameState();milestones[s.progression.level]??=s.elapsedSeconds;
   for(const [name,condition]of [['lv5',s.progression.level===5],['flight',!!s.grenade.flight],['release',s.carnival?.status==='active'],['carnival',s.carnival?.elapsedSeconds>=10],['handoff',s.carnival?.status==='complete']])
    if(condition&&!snapshots[name])snapshots[name]=sim.getState();
   const release=b.machineGunReleaseAtSeconds===null&&s.machineGunReleaseAtSeconds!==null;if(release)releases++;
   const added=s.enemies.filter(e=>e.id>=b.enemyStream.nextEnemyId),ordinary=added.filter(e=>e.archetype!=='giant');
   if(ordinary.length)waves.push({time:s.elapsedSeconds,phase:release?'release':s.carnival?.status==='active'?'carnival':s.postCapSurvival?.startedAtSeconds!=null?'survival':'normal',
    count:s.enemyStream.nextEnemyId-b.enemyStream.nextEnemyId-added.filter(e=>e.archetype==='giant').length,heavy:ordinary.filter(e=>e.archetype==='heavy').length,lanes:[...new Set(ordinary.map(e=>e.lane))]});
   casualties+=sim.consumePresentationEvents().reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0);sim.consumeGrenadeEvents();peak=Math.max(peak,s.enemies.length);
   const sample=Math.floor(s.elapsedSeconds/10);if(sample!==lastSample){lastSample=sample;timeline.push({seconds:s.elapsedSeconds,active:s.enemies.length,level:s.progression.level,z:s.player.z});}
  }
  const s=sim.getState();runs.push({seed,milestones,peak,casualties,failure:s.squad.count===0,releases,carnival:s.carnival,waves,timeline,finalZ:s.player.z});
  writeFileSync(`${out}/snapshots-${seed}.json`,JSON.stringify(snapshots));
 }
 const carnival=[];for(const seed of [1,17,42,99,2026])carnival.push(runCarnivalPilot(seed,true));
 writeFileSync(`${out}/metrics.json`,JSON.stringify({approaches,runs,carnival},null,2));
 console.log(JSON.stringify(runs.map(({waves,timeline,...r})=>({...r,waves:waves.length})),null,2));
}finally{await server.close();}

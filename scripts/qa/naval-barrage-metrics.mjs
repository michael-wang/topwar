import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { diagnosticTransform } from './survival-diagnosis-transform.mjs';
const out=process.argv[2]??'artifacts/p3b6b4/combat';mkdirSync(out,{recursive:true});
const configPath=process.argv.find(a=>a.startsWith('--config='))?.slice(9);
const config=configPath?JSON.parse(readFileSync(configPath,'utf8')):undefined;
const servers=[];
async function load(observed) {
  const server=await createServer({configFile:false,cacheDir:`${out}/${observed?'observed':'plain'}-cache`,
    server:{middlewareMode:true,hmr:{port:observed?14980:14981},watch:{ignored:['**/artifacts/**']}},appType:'custom',
    optimizeDeps:{noDiscovery:true,include:[]},plugins:observed?[diagnosticTransform()]:[]});servers.push(server);
  return server.ssrLoadModule('/scripts/qa/navalBarrageRun.ts');
}
const events=s=>({presentation:s.consumePresentationEvents(),grenade:s.consumeGrenadeEvents(),artillery:s.consumeArtilleryEvents()});
const summary=[];
try {
  const observed=await load(true),plain=await load(false);
  for(const barrage of [false,true]) for(const scenario of ['natural','lv8','lv9','lv10'])
    for(const policy of ['competent','slower','fixed']) for(const seed of [1,17,42,99,2026]) {
      const sim=observed.makeNavalRun(seed,scenario,barrage,config),control=plain.makeNavalRun(seed,scenario,barrage,config);
      assert.deepEqual(sim.getState(),control.getState());
      const collector=new observed.SurvivalDiagnosis(sim.getState());observed.bindObserver(collector);
      const salvos=[],intro=[],impacts=[],waveClocks=[],costs=[];let peakShells=0,checked=1,heldTicks=0;
      try {for(let tick=0;tick<600*60&&sim.getFrameState().squad.count;tick++) {
        const before=sim.getState(),lane=before.player.selectedLane;
        const input=observed.survivalDecision(sim,tick,policy), direction=sim.getFrameState().player.selectedLane-lane;
        if(direction)control.stepLane(direction);
        collector.begin(before);const start=performance.now();sim.step(1/60,input,observed.pilotTuning);costs.push(performance.now()-start);
        control.step(1/60,input,plain.pilotTuning);const after=sim.getState(),e=events(sim);
        assert.deepEqual(e,events(control));collector.end(after,before,e.presentation);
        if(tick%60===0){assert.deepEqual(after,control.getState());checked++;}
        const wait=before.catharsis.balance.navalBarrage.overlapPolicy==='waitForImpact',
          unresolved=before.artillery?.shells.some(s=>s.source.type==='destroyer'&&s.impactAtSeconds>after.elapsedSeconds+1e-9);
        if(wait&&before.navalBarrage.enabled&&after.squad.count&&before.navalBarrage.nextAtSeconds<=after.elapsedSeconds+1e-9&&unresolved){
          heldTicks++;assert.equal(after.navalBarrage.rngState,before.navalBarrage.rngState);
          assert.equal(after.navalBarrage.nextAtSeconds,before.navalBarrage.nextAtSeconds);
          assert.equal(after.navalBarrage.opportunities,before.navalBarrage.opportunities);
        }
        if(after.navalBarrage?.opportunities!==before.navalBarrage?.opportunities){
          if(wait)assert(!unresolved);
          salvos.push({...after.navalBarrage.lastSalvo,nominalAtSeconds:before.navalBarrage.nextAtSeconds});
        }
        for(const event of e.artillery) {
          if(event.kind==='artilleryLaunch' && after.postCapSurvival.startedAtSeconds===null)intro.push(event.shell);
          if(event.kind==='artilleryImpact')impacts.push(event);
        }
        if(after.defenseWaves?.nextAtSeconds!==before.defenseWaves?.nextAtSeconds)waveClocks.push({at:after.elapsedSeconds,
          next:after.defenseWaves.nextAtSeconds,admitted:after.enemyStream.nextEnemyId-before.enemyStream.nextEnemyId,
          naval:after.navalPresence.status,barrage:after.navalBarrage.enabled});
        peakShells=Math.max(peakShells,after.artillery?.shells.length??0);
        if(after.postCapSurvival.startedAtSeconds!==null && after.elapsedSeconds-after.postCapSurvival.startedAtSeconds>=180-1e-9)break;
      }}finally{observed.bindObserver();}
      const final=sim.getState();assert.deepEqual(final,control.getState());costs.sort((a,b)=>a-b);
      const result={barrage,scenario,policy,seed,...collector.finish(final),salvos,intro,impacts,waveClocks,peakShells,heldSeconds:heldTicks/60,
        barrageState:final.navalBarrage,navalPresence:final.navalPresence,stepMs:{mean:costs.reduce((a,b)=>a+b,0)/costs.length,
          p95:costs[Math.floor(costs.length*.95)],max:costs.at(-1)},deterministic:{checked,
          sha256:createHash('sha256').update(JSON.stringify(final)).digest('hex')}};
      writeFileSync(`${out}/${barrage?'on':'off'}-${scenario}-${policy}-${seed}.json`,JSON.stringify(result,null,2));
      const {cohorts,samples,survivalGiants,...compact}=result;summary.push(compact);
      writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));
      console.log(JSON.stringify({barrage,scenario,policy,seed,end:result.end,survival:result.activation,level:result.endLevel,
        soldiers:result.endSquad,casualties:result.casualties.length,salvos:salvos.length,peakShells,peak:result.peaks.active,checked}));
    }
}finally{for(const server of servers)await server.close();}

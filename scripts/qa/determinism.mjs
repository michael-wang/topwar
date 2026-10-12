// Capture/compare fixed-input released Defense traces before structural cleanup.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
const mode = process.argv[2] ?? 'capture';
const dir = process.argv[3]?.startsWith('--') ? 'artifacts/p3b6b8/traces' : process.argv[3] ?? 'artifacts/p3b6b8/traces';
mkdirSync(dir, {recursive:true});
const revision=process.argv.find(a=>a.startsWith('--revision='))?.slice(11);
const canonical=value=>JSON.stringify(value,(_key,v)=>v && !Array.isArray(v) && typeof v==='object'
  ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
const server = await createServer({configFile:false, cacheDir:'artifacts/p3b6b8/trace-cache', server:{middlewareMode:true}, appType:'custom',
  plugins:revision ? [{name:'baseline-source',enforce:'pre',load(id){
    const path=relative(process.cwd(),id.split('?')[0]).replaceAll('\\','/');
    if(path.startsWith('src/'))return execFileSync('git',['show',`${revision}:${path}`],{encoding:'utf8'});
  }}] : []});
try {
  const { makeNavalRun, survivalDecision, pilotTuning } = await server.ssrLoadModule('/scripts/qa/navalBarrageRun.ts');
  const summaries = [];
  for (const seed of [1,17,42,99,2026]) for (const scenario of ['natural','lv8','lv9','lv10']) {
    const key = `${seed}-${scenario}`, file = `${dir}/${key}.json`;
    const baseline = mode==='compare' ? JSON.parse(readFileSync(file,'utf8')) : null;
    const sim = makeNavalRun(seed,scenario,true), digest = createHash('sha256'), checkpoints=[];
    const inputs = []; let survival = null; const levels={};
    for(let tick=0;tick<360*60 && sim.getFrameState().squad.count;tick++) {
      // Compare against the captured decisions, including adjacent lane steps.
      const beforeLane=sim.getFrameState().player.selectedLane;
      const input=survivalDecision(sim,tick,'competent');
      const lane=sim.getFrameState().player.selectedLane;
      const decision={lane,input};
      if(baseline && JSON.stringify(decision)!==JSON.stringify(baseline.inputs[tick])) throw Error(`${key}: input drift at ${tick}`);
      inputs.push(decision);
      sim.step(1/60,input,pilotTuning);
      const events=[sim.consumePresentationEvents(),sim.consumeGrenadeEvents(),sim.consumeArtilleryEvents()];
      const state=sim.getState();
      digest.update(canonical({state,events}));
      const saved=baseline?.checkpoints.find(c=>c.tick===tick);
      if(saved && canonical(state)!==canonical(saved.state)) {
        writeFileSync(`${dir}/drift.json`,JSON.stringify({key,tick,before:saved.state,after:state},null,2));
        throw Error(`${key}: state drift at ${tick}`);
      }
      if(state.postCapSurvival?.startedAtSeconds!=null) survival=state.postCapSurvival.startedAtSeconds;
      levels[state.progression.level]??=state.elapsedSeconds;
      if(tick%600===0)checkpoints.push({tick,state});
      if(survival!==null && state.elapsedSeconds-survival>=180)break;
    }
    const result={seed,scenario,hash:digest.digest('hex'),inputs,checkpoints,end:sim.getState(),levels,survival};
    if(baseline && (result.hash!==baseline.hash || canonical(result.end)!==canonical(baseline.end))) {
      writeFileSync(`${dir}/drift.json`,JSON.stringify({key,before:baseline.end,after:result.end},null,2));
      throw Error(`${key}: simulation/event drift`);
    }
    if(!baseline)writeFileSync(file,JSON.stringify(result));
    summaries.push({seed,scenario,hash:result.hash,ticks:inputs.length,levels,survival,finalSoldiers:result.end.squad.count});
    console.log(key,inputs.length,result.hash);
  }
  writeFileSync(`${dir}/${mode}-summary.json`,JSON.stringify(summaries,null,2));
} finally { await server.close(); }

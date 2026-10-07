import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/postcap';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {runPostCapPilot}=await server.ssrLoadModule('/scripts/qa/postCapPilot.ts');
 const seeds=[...new Set([1,17,42,...Array.from({length:10},(_,i)=>i+1)])];
 const runs=seeds.map(seed=>runPostCapPilot(seed));
 const longRun=runPostCapPilot(1,360);
 const supplyCycle=runPostCapPilot(42,180,true,true);
 const disabled=[1,17,42].map(seed=>runPostCapPilot(seed,10,false));
 for(const r of [...runs,longRun,supplyCycle]) {
  if(r.release?.grunt!==59||r.release?.heavy!==1||r.groups.filter(g=>g.postCap).some(g=>g.count!==3||g.heavy!==3||g.grunt!==0||g.fronts!==3)
    || r.peak.giant>1 || r.final.level.level!==6 || r.final.level.xp!==0)throw Error('Invalid post-cap composition/state '+r.seed);
 }
 for(const r of disabled)if(JSON.stringify(r.milestones)!==JSON.stringify(runs.find(n=>n.seed===r.seed).milestones))
  throw Error('Pre-cap progression changed '+r.seed);
 if(supplyCycle.acquisitions.filter(a=>a.postCap).length<5||supplyCycle.throws.filter(t=>t.postCap).length<5)
  throw Error('Recurring supply/use loop did not continue');
 writeFileSync(`${out}/metrics.json`,JSON.stringify({policy:'60Hz; one adjacent lane tap every 200ms; Supply priority; Giant priority while nearest threat >10 units; Grenade >=6 victims within depth14 or >=12 HP within depth10. Supply-cycle policy additionally spends held charges whenever a valid enemy exists after cap, solely to exercise recurring acquisition. No gameplay overrides.',runs,longRun,supplyCycle,disabled},null,2));
 console.log(JSON.stringify([...runs,longRun,supplyCycle].map(r=>({seed:r.seed,duration:r.secondsAfterActivation,activation:r.activation,
  groups:r.groups.filter(g=>g.postCap).length,giants:r.giants.map(g=>g.result),supplies:r.supplies.map(g=>g.result),
  acquired:r.acquisitions.filter(a=>a.postCap).length,throws:r.throws.filter(t=>t.postCap).length,peak:r.peak,
  emptySeconds:r.emptySeconds,longestEmptySeconds:r.longestEmptySeconds,failed:r.failed,casualties:r.casualties})),null,2));
}finally{await server.close();}

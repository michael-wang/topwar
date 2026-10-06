import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p2a';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {runPilot}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const {comparePrimary}=await server.ssrLoadModule('/scripts/qa/p2aComparison.ts');
  const runs=[];
  for(let seed=1;seed<=50;seed++)for(const hesitation of [false,true])runs.push(runPilot(seed,hesitation,true,false,6));
  const result={policy:'Existing 60Hz P1.5 pilot, with Grenade; stop at Lv6. One 1.8s hesitation at Lv3+3s. No runtime balance overrides.',
    comparison:[comparePrimary(5),comparePrimary(6)],runs:runs.map(({timeline,...run})=>run)};
  writeFileSync(`${out}/metrics.json`,JSON.stringify(result,null,2));
  writeFileSync(`${out}/timelines.json`,JSON.stringify(runs.filter(r=>[1,17,42].includes(r.seed)),null,2));
  console.log(JSON.stringify({...result,runs:result.runs.filter(r=>[1,17,42].includes(r.seed)).map(r=>({seed:r.seed,pilot:r.pilot,
    milestones:r.milestones,lv5Duration:r.lv5Duration,evolution:r.evolution,casualties:r.contactCasualties,failed:r.failed}))},null,2));
} finally {await server.close();}

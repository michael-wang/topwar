import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p15';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {runPilot}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const runs=[];
  for(let seed=1;seed<=50;seed++)for(const hesitation of [false,true])for(const use of [false,true])
    runs.push(runPilot(seed,hesitation,use));
  const summary=runs.map(({timeline,...run})=>run);
  writeFileSync(`${out}/metrics.json`,JSON.stringify({policy:'60Hz; nearest threat lane every 200ms via stepLane taps (same existing P1 pilot convention); prioritize supply. Hesitation: hold lane 1.8s at Lv3+3s. Throw: >=6 targets at anchor depth <=10; emergency >=3 at depth <=6 when nearest <4; after holding 8s accept >=6 at depth <=14. Controls acquire supply but never throw. Near-defense <=10; TTC approximate front contact.',runs:summary},null,2));
  writeFileSync(`${out}/timelines.json`,JSON.stringify(runs.filter(r=>[1,17,42].includes(r.seed)),null,2));
  console.log(JSON.stringify(summary.filter(r=>[1,17,42].includes(r.seed)).map(r=>({seed:r.seed,pilot:r.pilot,use:r.useGrenade,levels:r.milestones,kills:r.grenadeKills,xp:r.grenadeKillXp,failed:r.failed,spawn:r.supplySpawn,acquired:r.acquisition,activation:r.activation,near:[r.beforeBlast?.nearDefense,r.afterBlast?.nearDefense,r.twoSecondsAfter?.nearDefense]})),null,2));
} finally {await server.close();}

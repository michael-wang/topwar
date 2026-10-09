import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/stage1-p2';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {runCarnivalPilot}=await server.ssrLoadModule('/scripts/qa/carnivalPilot.ts');
  const runs=[];
  for(const natural of [false,true])for(const grenades of [false,true])for(const seed of [1,17,42,99,2026]) {
    const r=runCarnivalPilot(seed,natural,grenades,process.env.TOPWAR_CARNIVAL_CAP?Number(process.env.TOPWAR_CARNIVAL_CAP):undefined);runs.push(r);
    console.log(JSON.stringify({...r,survivors:undefined,waves:undefined}));
  }
  writeFileSync(`${out}/metrics.json`,JSON.stringify(runs,null,2));
} finally {await server.close();}

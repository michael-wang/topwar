import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p3b6a/final',revision=process.argv[3]?.startsWith('--')?undefined:process.argv[3];mkdirSync(out,{recursive:true});
const historical=revision?new Set(execFileSync('git',['ls-tree','-r','--name-only',revision,'src','tests/helpers','public/game-data'],{encoding:'utf8'}).trim().split('\n')):new Set();
const server=await createServer({cacheDir:`${out}/vite-cache`,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},plugins:revision?[{
 name:'historical-mg-plan',enforce:'pre',load(id){const path=relative(process.cwd(),id.split('?')[0]).replaceAll('\\','/');
  if(historical.has(path))return execFileSync('git',['show',revision+':'+path],{encoding:'utf8'});}
}]:[]});
try {
 const {runSurvivalPilot}=await server.ssrLoadModule('/scripts/qa/survivalPilot.ts');
 if(process.argv.includes('--encounters-only')) {
  const {runDifficultyPilot}=await server.ssrLoadModule('/scripts/qa/difficultyPilot.ts');
  const runs=[1,17,42,99,2026].map(seed=>runDifficultyPilot(seed));
  writeFileSync(`${out}/encounters.json`,JSON.stringify({revision:revision??'working-tree',runs},null,2));
  console.log(JSON.stringify(runs.map(({waves,stepMs,...r})=>r)));await server.close();process.exit(0);
 }
 const runs=[];
 for(const scenario of ['natural','lv6','lv7','lv8','lv9','lv10'])for(const seed of [1,17,42,99,2026]) {
  const r=runSurvivalPilot(seed,scenario);runs.push(r);
  console.log(JSON.stringify({...r,entry:undefined,end:undefined,samples:undefined,waves:undefined,opportunities:undefined}));
 }
 for(const policy of ['slower','fixed'])for(const seed of [1,17,42,99,2026])runs.push(runSurvivalPilot(seed,'lv10',policy));
 writeFileSync(`${out}/metrics.json`,JSON.stringify({revision:revision??'working-tree',policy:'60Hz; 180s Survival or ordinary Game Over; adjacent 200/600ms and fixed-lane/no-Grenade pilots; historical scenarios clamp to their own cap.',runs},null,2));
} finally {await server.close();}

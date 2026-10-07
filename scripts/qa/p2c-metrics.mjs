import {createServer} from 'vite';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const out=process.argv[2]??'artifacts/p2c/current',baseline=process.argv.includes('--baseline');mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {runPilot}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const {comparePrimary}=await server.ssrLoadModule('/scripts/qa/p2aComparison.ts');
  const {GameConfigSchema}=await server.ssrLoadModule('/src/config/configSchema.ts');
  const baselineConfig=process.argv.find(a=>a.startsWith('--baseline-config='))?.split('=')[1];
  const balance=baselineConfig?GameConfigSchema.parse(JSON.parse(readFileSync(baselineConfig,'utf8'))).catharsis:undefined;
  const runs=[];
  for(let seed=1;seed<=50;seed++)for(const hesitation of [false,true]) {
    runs.push(runPilot(seed,hesitation,true,true,6,false,balance,{afterLv6Seconds:10}));
    if(!baseline)runs.push({...runPilot(seed,hesitation,true,true,6,false,balance,{afterLv6Seconds:10,prioritizeGiant:true}),priorityPilot:true});
  }
  writeFileSync(`${out}/runs.json`,JSON.stringify(runs,null,2));
  writeFileSync(`${out}/representative.json`,JSON.stringify(runs.filter(r=>[1,17,42].includes(r.seed)),null,2));
  const summaries=[false,true].map(priority=>{
    const group=runs.filter(r=>!!r.priorityPilot===priority),reached=group.filter(r=>r.milestones[6]!==undefined);
    const mean=fn=>reached.reduce((s,r)=>s+fn(r),0)/reached.length;
    return{priority,runs:group.length,reached:reached.length,failed:group.filter(r=>r.failed).map(r=>({seed:r.seed,pilot:r.pilot,level:r.finalLevel})),
      lv4Duration:mean(r=>r.lv4Duration),lv5Duration:mean(r=>r.lv5Duration),
      giantKills:group.filter(r=>r.ladder.giant.death?.killed).length,giantTriggersLv6:group.filter(r=>r.ladder.giant.death?.triggersLv6).length,
      activeAtLv6:mean(r=>r.ladder.release.afterActive),empty:reached.filter(r=>r.ladder.emptyAfterLv6).length,
      afterLv6:Object.fromEntries([2,5,10].map(t=>[t,{active:mean(r=>r.ladder.afterLv6[t]?.pressure.active??0),kills:mean(r=>r.ladder.afterLv6[t]?.mgKills??0)}]))};
  });
  const result={policy:'Adjacent step every 200ms. Normal/1.8s Lv3 hesitation, unchanged Grenade policy. Priority variant selects Giant unless any threat is within 10 approach units. Follow 10 seconds after Lv6.',summaries,comparison:[comparePrimary(5),comparePrimary(6)]};
  writeFileSync(`${out}/summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await server.close();}

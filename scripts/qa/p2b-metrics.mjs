import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p2b';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const summarize=runs=>{
  const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
  const range=values=>({min:Math.min(...values),mean:mean(values),max:Math.max(...values)});
  const reached=runs.filter(r=>r.evolution);
  return {runs:runs.length,reachedLv6:reached.length,failures:runs.filter(r=>r.failed).length,
    casualties:runs.reduce((s,r)=>s+r.contactCasualties,0),
    lv5Duration:range(reached.map(r=>r.lv5Duration)),
    atLv6:{active:range(reached.map(r=>r.evolution.pressure.active)),
      nearDefense:range(reached.map(r=>r.evolution.pressure.nearDefense)),
      debt:range(reached.map(r=>r.evolution.pressure.rifleHitDebt.reduce((a,b)=>a+b,0))),
      nearestDistance:range(reached.map(r=>r.evolution.pressure.nearestDistance)),
      heavies:range(reached.map(r=>r.evolution.pressure.heavyOverlap))},
    phases:Object.fromEntries([3,4,5].map(level=>[level,{
      nearPeak:range(runs.map(r=>r.phasePeaks[level]?.near??0)),
      debtPeak:range(runs.map(r=>r.phasePeaks[level]?.debt??0)),
      heavyPeak:range(runs.map(r=>r.phasePeaks[level]?.heavy??0))}])),
    grenadeKills:range(runs.map(r=>r.grenadeKills)),grenadeKillXp:range(runs.map(r=>r.grenadeKillXp))};
};
try {
  const {runPilot}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const {GameConfigSchema}=await server.ssrLoadModule('/src/config/configSchema.ts');
  const balance=GameConfigSchema.parse(JSON.parse(readFileSync('public/game-data/game.json','utf8'))).catharsis;
  const baselinePath=`${out}/baseline/metrics.json`;
  const original=existsSync(baselinePath)?JSON.parse(readFileSync(baselinePath,'utf8')).runs:null;
  const noRamp=structuredClone(balance);delete noRamp.pressureRamp;
  const groups={current:[],adjacentWithRamp:[],adjacentWithoutRamp:[]};
  for(let seed=1;seed<=50;seed++)for(const hesitation of [false,true]) {
    groups.current.push(runPilot(seed,hesitation,true,false,6));
    groups.adjacentWithRamp.push(runPilot(seed,hesitation,true,true,6));
    groups.adjacentWithoutRamp.push(runPilot(seed,hesitation,true,true,6,false,noRamp));
  }
  for(const runs of Object.values(groups))for(const run of runs)for(const group of run.groupAdmissions) {
    if(group.population!==(group.level<5?24:30))throw Error('P2B changed generated group population');
    const late=(group.level===4&&group.xp>=63)||(group.level===5&&group.xp>=55);
    const withRamp=runs!==groups.adjacentWithoutRamp;
    if(group.fronts!==((late&&withRamp)?4:3))throw Error('P2B admitted unexpected pressure fronts');
  }
  const report={policy:'60Hz; nearest threat/supply every 200ms, ordinary auto-fire and existing Grenade-use policy. Current matches historical multi-step lane pilot. Adjacent pilots permit one lane step per decision; with/without ramp both use P2B emergency Grenade. Hesitation holds lane 1.8s at Lv3+3s.',
    summaries:{...(original?{baseline:summarize(original)}:{}),...Object.fromEntries(Object.entries(groups).map(([k,r])=>[k,summarize(r)]))},
    representative:Object.fromEntries(Object.entries(groups).map(([k,runs])=>[k,runs.filter(r=>[1,17,42].includes(r.seed)).map(({timeline,...run})=>run)]))};
  writeFileSync(`${out}/comparison.json`,JSON.stringify(report,null,2));
  writeFileSync(`${out}/runs.json`,JSON.stringify(groups,null,2));
  console.log(JSON.stringify(report.summaries,null,2));
} finally {await server.close();}

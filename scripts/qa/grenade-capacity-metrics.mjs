import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/pre-release';mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {runPilot}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const {GameConfigSchema}=await server.ssrLoadModule('/src/config/configSchema.ts');
  const authored=GameConfigSchema.parse(JSON.parse(readFileSync('public/game-data/game.json','utf8'))).catharsis;
  const runs=[];
  for(let seed=1;seed<=50;seed++)for(const hesitation of [false,true])for(const capacity of [1,3]) {
    const balance={...authored,grenade:{...authored.grenade,capacity}};
    const {timeline,grenadeVictims,ladder,...r}=runPilot(seed,hesitation,true,true,6,false,balance,{afterLv6Seconds:2,prioritizeGiant:true});
    runs.push({...r,capacity,throws:r.throws.map(({victims,...t})=>t)});
  }
  const cohort=[];
  for(const capacity of [1,3])for(const pilot of ['normal','hesitation']) {
    const rs=runs.filter(r=>r.capacity===capacity&&r.pilot===pilot);
    const mean=key=>{const values=rs.map(r=>r[key]).filter(v=>v!==null);return values.reduce((s,v)=>s+v,0)/values.length;};
    const durations=rs.map(r=>r.lv3Duration).filter(v=>v!==null);
    const launched=rs.flatMap(r=>r.throws),detonated=launched.filter(t=>t.detonation!==null);
    cohort.push({capacity,pilot,runs:rs.length,failures:rs.filter(r=>r.failed).length,
      casualties:rs.reduce((s,r)=>s+r.contactCasualties,0),meanLv3Duration:mean('lv3Duration'),
      completedLv3:durations.length,minLv3Duration:Math.min(...durations),maxLv3Duration:Math.max(...durations),
      meanThrows:rs.reduce((s,r)=>s+r.throws.length,0)/rs.length,meanGrenadeXp:mean('grenadeKillXp'),
      skippedLevels:rs.flatMap(r=>r.throws).filter(t=>t.xpAfter && t.xpAfter.level-t.xpBefore.level>1).length,
      detonatedThrows:detonated.length,unfinishedFlights:launched.length-detonated.length,
      perThrow:detonated.map(t=>({kills:t.kills,xp:t.xp,level:t.levelAtActivation}))});
  }
  const report={policy:'Fixed 60Hz; one adjacent lane step per 200ms toward nearest threat or supply. Prioritize Giant when nearest ordinary enemy >10 units. Hesitation holds lane 1.8s at Lv3+3s. Existing P1.5 emergency/crowd throw policy, serialized flights, all charges usable. Stop two seconds after Lv6 or death/180s. Capacity1 is the exact counterfactual; all other current config values identical.',cohort,runs};
  writeFileSync(`${out}/capacity-metrics.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({cohort:cohort.map(({perThrow,...c})=>c),seeds:runs.filter(r=>[1,17,42].includes(r.seed)).map(r=>({seed:r.seed,pilot:r.pilot,capacity:r.capacity,lv3:r.milestones[3],acquired:r.acquisition,lv4:r.milestones[4],lv3Duration:r.lv3Duration,throws:r.throws.map(t=>({at:t.activation,kills:t.kills,xp:t.xp,level:t.levelAtActivation,near:[t.before?.nearDefense,t.after?.nearDefense]})),failed:r.failed,casualties:r.contactCasualties}))},null,2));
} finally {await server.close();}

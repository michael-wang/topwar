import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const out=process.argv[2]??'artifacts/p3b6b2';
const summary=JSON.parse(readFileSync(`${out}/summary.json`,'utf8'));
const range=values=>values.length?[Math.min(...values),Math.max(...values)]:null;
const candidates=[];
for(const candidate of ['baseline','experimental','staged','ahead']) {
  const runs=summary.runs.filter(r=>r.candidate===candidate);
  writeFileSync(`${out}/${candidate}/summary.json`,JSON.stringify({baseline:summary.baseline,runs}));
  execFileSync(process.execPath,['scripts/qa/survival-diagnosis-analysis.mjs',`${out}/${candidate}`]);
  const detail=runs.map(r=>JSON.parse(readFileSync(`${out}/${candidate}/${r.scenario}-${r.policy}-${r.seed}.json`,'utf8')));
  const existing=JSON.parse(readFileSync(`${out}/${candidate}/analysis.json`,'utf8'));
  const groups=existing.groups.filter(g=>g.n).map(g=>{
    const matching=detail.filter(r=>r.scenario===g.scenario&&r.policy===g.policy);
    const at=(r,l)=>r.timeline.find(t=>t.level===l)?.at;
    return {...g,level9Age:range(matching.filter(r=>at(r,9)!==undefined).map(r=>at(r,9)-(r.activation??0))),
      level10Age:range(matching.filter(r=>at(r,10)!==undefined).map(r=>at(r,10)-(r.activation??0))),
      crossed30:range(matching.filter(r=>r.crossedFraction[30]!==null).map(r=>r.crossedFraction[30])),
      hitsAdmittedPerSecond:range(matching.filter(r=>r.survivalSeconds>0).map(r=>r.cohorts.filter(c=>['survival-wave','survival-initial'].includes(c.kind)).reduce((n,c)=>n+c.mgHits,0)/r.survivalSeconds)),
      giantXp:range(matching.map(r=>r.survivalGiants.reduce((n,c)=>n+c.nominalXp,0))),
      ordinaryXp:range(matching.map(r=>r.cohorts.filter(c=>['survival-wave','survival-initial'].includes(c.kind)).reduce((n,c)=>n+c.nominalXp,0))),
      upgradeWindows:[9,10].flatMap(level=>[-1/60,0,5,10,20].map(offset=>{
        const rows=matching.flatMap(r=>r.upgrades.filter(u=>u.level===level).flatMap(u=>u.windows.filter(w=>w.offset===offset)));
        return {level,offset,observed:rows.length,active:range(rows.map(w=>w.active)),hp:range(rows.map(w=>w.hp)),
          near: [0,1,2].map(i=>range(rows.map(w=>w.near[i]))),cohorts:range(rows.map(w=>w.cohorts.length))};
      }))};
  });
  const late=detail.flatMap(r=>r.cohorts.filter(c=>['survival-wave','survival-initial'].includes(c.kind)&&c.spawn.level===8&&c.spawn.xp>=245).map(c=>{
    const first=r.engagements.filter(e=>e.cohort===c.id),u=r.upgrades.find(u=>u.level===9);
    return {scenario:r.scenario,policy:r.policy,seed:r.seed,cohort:c.id,at:c.at,xp:c.spawn.xp,speeds:[...new Set(c.members.map(e=>e.speed))],
      lanes:[...new Set(c.members.map(e=>e.lane))],counts:c.counts,closest:c.closest,crossings:c.crossings,clearedAt:c.clearedAt,
      firstHitLevels:Object.fromEntries([8,9,10].map(l=>[l,first.filter(e=>e.level===l).length])),
      atUpgrade:u?.windows.map(w=>({offset:w.offset,...(w.cohorts.find(row=>row.id===c.id)??{id:c.id,count:0,hp:0})}))??null,
      censoredMembers:c.members.filter(e=>!e.death).length};
  }));
  candidates.push({candidate,groups,late,natural:existing.natural,verification:existing.verification});
}
writeFileSync(`${out}/comparison.json`,JSON.stringify({baseline:summary.baseline,candidates,
  notes:'Ranges over matched seeds. Before-upgrade window is one fixed tick before resolved upgrade; after windows are actual surviving enemies. First engagement is first actual damage hook at tick resolution. Missing windows are censored, never zero-filled.'},null,2));
console.log(JSON.stringify(candidates.map(c=>({candidate:c.candidate,runs:c.verification.runs,lateCohorts:c.late.length,verification:c.verification}))));
if(existsSync(`${out}/performance/results.json`)) {
  const {results}=JSON.parse(readFileSync(`${out}/performance/results.json`,'utf8'));
  const performance=results.map(r=>{
    const control=results.find(b=>b.width===r.width&&b.mode==='experimental'&&b.temperature===r.temperature);
    const growth=[];let previous='';
    for(const sample of r.resources){const stats=sample.stats,resource={geometries:stats.geometries,textures:stats.textures,
      projectile:stats.projectiles.pool,body:stats.enemies.bodyCapacities,tier:stats.enemies.tierCapacities,shadow:stats.shadows.enemy.capacity};
      const key=JSON.stringify(resource);if(key!==previous){growth.push({age:sample.age,...resource});previous=key;}}
    return {width:r.width,mode:r.mode,temperature:r.temperature,...r.overall,highWater:r.highWater,
      simulationSeconds:r.final.elapsedSeconds,level:r.final.progression.level,soldiers:r.final.squad.count,
      meanCostVsExperimental:control?r.overall.mean/control.overall.mean-1:null,growth,
      windows:r.windows,stepP95:r.stepP95,renderP95:r.renderP95,
      stalls:r.rows.flatMap((row,i)=>row.ms>200?[{...row,precedingFrameCpuMs:r.rows[i-1]?.cpuMs}]:[]),
      assetRequests:r.network,errors:r.errors};
  });
  writeFileSync(`${out}/performance-analysis.json`,JSON.stringify(performance,null,2));
}

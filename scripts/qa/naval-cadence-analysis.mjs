import { readFileSync,writeFileSync } from 'node:fs';
const root=process.argv[2]??'artifacts/p3b6b5',rows=JSON.parse(readFileSync(`${root}/combat/summary.json`,'utf8'));
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null,round=x=>x==null?null:+x.toFixed(3);
const groups=[];
for(const scenario of ['natural','lv8','lv9','lv10'])for(const policy of ['competent','slower','fixed'])for(const on of [false,true]){
 const rs=rows.filter(r=>r.scenario===scenario&&r.policy===policy&&r.barrage===on),active=rs.filter(r=>r.activation!==null);
 groups.push({scenario,policy,on,activated:active.length,gameOvers:rs.filter(r=>r.gameOver).length,
  duration:round(average(active.map(r=>r.survivalSeconds))),active:round(average(active.map(r=>r.mean.active))),
  peak:Math.max(...rs.map(r=>r.peaks.active)),shellPeak:Math.max(...rs.map(r=>r.peakShells)),
  casualties:round(average(rs.map(r=>r.casualties.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0)))),
  waves:round(average(active.map(r=>r.ordinaryWaves))),blocked:round(average(active.map(r=>r.admissions.filter(a=>!a.admitted).length)))});
}
const salvos=rows.flatMap(r=>r.salvos),intervals=rows.flatMap(r=>r.salvos.slice(1).map((s,i)=>s.atSeconds-r.salvos[i].atSeconds)),
 delayed=salvos.filter(s=>s.atSeconds-s.nominalAtSeconds>1/60+1e-8);
const result={groups,patterns:{salvos:salvos.length,singles:salvos.filter(s=>s.lanes.length===1).length,doubles:salvos.filter(s=>s.lanes.length===2).length,
  meanActualInterval:round(average(intervals)),minActualInterval:round(Math.min(...intervals)),maxActualInterval:round(Math.max(...intervals)),
  heldSeconds:round(rows.reduce((n,r)=>n+r.heldSeconds,0)),heldOpportunities:delayed.length,
  maximumHold:round(Math.max(0,...salvos.map(s=>s.atSeconds-s.nominalAtSeconds))),
  capacitySkipped:rows.reduce((n,r)=>n+(r.barrageState?.capacitySkipped??0),0)},
 natural:rows.filter(r=>r.scenario==='natural'&&r.policy==='competent').map(r=>({on:r.barrage,seed:r.seed,activation:r.activation,end:r.end,
   duration:r.survivalSeconds,level:r.endLevel,dead:r.gameOver,salvos:r.salvos.length,first:r.salvos[0]?.atSeconds,
   release:r.timeline.find(t=>t.level===6)?.at,casualties:r.casualties.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0)}))};
writeFileSync(`${root}/analysis.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

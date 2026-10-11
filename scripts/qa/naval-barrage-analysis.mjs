import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=process.argv[2]??'artifacts/p3b6b4',read=p=>JSON.parse(readFileSync(`${root}/${p}`,'utf8'));
const rows=read('combat/summary.json'),round=n=>n==null?'—':Number(n.toFixed(2)),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
let text='Natural competent timelines (absolute simulation seconds)\n';
for(const on of [false,true])for(const seed of [1,17,42,99,2026]) {
  const r=rows.find(r=>r.barrage===on&&r.scenario==='natural'&&r.policy==='competent'&&r.seed===seed);
  text+=JSON.stringify({barrage:on,seed,levels:Object.fromEntries([4,6,7,8,9,10].map(l=>[l,round(r.timeline.find(t=>t.level===l)?.at)])),
    activation:round(r.activation),end:round(r.end),survival:round(r.survivalSeconds),dead:r.gameOver,peak:r.peaks.active,salvos:r.salvos.length})+'\n';
}
text+='\nGroup means across five seeds (failure durations are real, not forced)\n';
for(const scenario of ['natural','lv8','lv9','lv10'])for(const policy of ['competent','slower','fixed'])for(const barrage of [false,true]) {
  const group=rows.filter(r=>r.scenario===scenario&&r.policy===policy&&r.barrage===barrage),active=group.filter(r=>r.activation!==null);
  text+=JSON.stringify({scenario,policy,barrage,activated:active.length,gameOvers:group.filter(r=>r.gameOver).length,
    meanSurvival:round(mean(active.map(r=>r.survivalSeconds))),meanPopulation:round(mean(active.map(r=>r.mean.active))),
    peak:Math.max(...group.map(r=>r.peaks.active)),near10:round(mean(active.map(r=>r.mean.near10))),
    casualties:round(mean(group.map(r=>r.casualties.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0)))),
    shellPeak:Math.max(...group.map(r=>r.peakShells)),ordinaryWaves:round(mean(active.map(r=>r.ordinaryWaves))),
    blocked:round(mean(active.map(r=>r.admissions.filter(a=>!a.admitted).length)))})+'\n';
}
// New random scheduling cannot alter the accepted five introductory launches.
for(const policy of ['competent','slower','fixed'])for(const seed of [1,17,42,99,2026]) {
  const on=rows.find(r=>r.barrage&&r.scenario==='natural'&&r.policy===policy&&r.seed===seed),
    off=rows.find(r=>!r.barrage&&r.scenario==='natural'&&r.policy===policy&&r.seed===seed);
  assert.deepEqual(on.intro,off.intro);
  const loadout=r=>r.timeline.filter(t=>t.at<=Math.min(on.activation??on.end,off.activation??off.end)+1e-8);
  assert.deepEqual(loadout(on),loadout(off));
}
const salvos=rows.flatMap(r=>r.salvos),counts=salvos.reduce((a,s)=>(a[s.lanes.length]++,a),{1:0,2:0}),lanes=[0,0,0,0,0];
salvos.forEach(s=>s.lanes.forEach(l=>lanes[l]++));
text+='\nMeasured salvos '+JSON.stringify({counts,lanes,capacitySkipped:rows.reduce((n,r)=>n+(r.barrageState?.capacitySkipped??0),0),
  intervals:rows.filter(r=>r.barrage).flatMap(r=>r.salvos.slice(1).map((s,i)=>s.atSeconds-r.salvos[i].atSeconds)).reduce((a,n)=>(a.min=Math.min(a.min,n),a.max=Math.max(a.max,n),a.sum+=n,a.count++,a),{min:Infinity,max:0,sum:0,count:0})})+'\n';
for(const path of ['performance/results.json','performance-repeat/results.json'])for(const r of read(path)) {
  const samples=r.samples,tail=samples.filter(s=>s.seconds>=r.seconds-20);
  text+='\nPerformance '+JSON.stringify({source:path,width:r.width,mode:r.mode,phase:r.phase,mean:round(r.frameMs.mean),p95:round(r.frameMs.p95),max:round(r.frameMs.max),
    over100:r.frameMs.over100,over200:r.frameMs.over200,seconds:round(r.seconds),peak:r.peakEnemies,shells:r.peakShells,
    tailGeometry:[Math.min(...tail.map(s=>s.geometries)),Math.max(...tail.map(s=>s.geometries))],tailTextures:[Math.min(...tail.map(s=>s.textures)),Math.max(...tail.map(s=>s.textures))]});
}
const matched=read('matched-render/results.json');text+='\n\nMatched identical crowd\n';
for(const width of [350,390])for(const mode of ['off','on']) {
  const group=matched.filter(r=>r.width===width&&r.mode===mode);
  text+=JSON.stringify({width,mode,mean:round(mean(group.map(r=>r.frameMs.mean))),range:group.map(r=>round(r.frameMs.mean)),
    over200:group.reduce((n,r)=>n+r.frameMs.over200,0),calls:group.map(r=>r.stats.drawCalls),triangles:group.map(r=>r.stats.triangles),
    geometries:group.map(r=>r.stats.geometries),textures:group.map(r=>r.stats.textures),enemies:group[0].enemies,heavies:group[0].heavies,shells:group[0].shells})+'\n';
}
writeFileSync(`${root}/analysis.txt`,text);console.log(text);

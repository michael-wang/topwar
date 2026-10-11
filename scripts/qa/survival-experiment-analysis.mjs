import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const out = process.argv[2] ?? 'artifacts/p3b6b1';
const summary = JSON.parse(readFileSync(`${out}/summary.json`, 'utf8'));
const range = v => v.length ? [Math.min(...v), Math.max(...v)] : null;
const candidates = [];
for (const candidate of ['baseline', 'heavy', 'speed', 'combined-six', 'combined']) {
  const runs = summary.runs.filter(r => r.candidate === candidate);
  writeFileSync(`${out}/${candidate}/summary.json`, JSON.stringify({ baseline: summary.baseline, runs }));
  execFileSync(process.execPath, ['scripts/qa/survival-diagnosis-analysis.mjs', `${out}/${candidate}`]);
  const detail = runs.map(r => JSON.parse(readFileSync(`${out}/${candidate}/${r.scenario}-${r.policy}-${r.seed}.json`, 'utf8')));
  const existing = JSON.parse(readFileSync(`${out}/${candidate}/analysis.json`, 'utf8'));
  const groups = existing.groups.map(g => {
    const matching = detail.filter(r => r.scenario === g.scenario && r.policy === g.policy);
    const at = (r, level) => r.timeline.find(t => t.level === level)?.at;
    return { ...g, level9Age: range(matching.filter(r => at(r,9)!==undefined).map(r=>at(r,9)-(r.activation??0))),
      level10Age: range(matching.filter(r => at(r,10)!==undefined).map(r=>at(r,10)-(r.activation??0))),
      crossed30: range(matching.filter(r=>r.crossedFraction[30]!==null).map(r=>r.crossedFraction[30])),
      earnedWaveXp: range(matching.flatMap(r=>r.cohorts.filter(c=>c.kind==='survival-wave'||c.kind==='survival-initial').map(c=>c.nominalXp))),
      survivalGiantXp: range(matching.map(r=>r.survivalGiants.reduce((sum,c)=>sum+c.nominalXp,0))) };
  });
  const firstLv8 = detail.filter(r=>r.scenario==='lv8').map(r=>{
    const c=r.cohorts.find(c=>c.kind==='survival-initial'), next=r.timeline.find(t=>t.level===9), cap=r.timeline.find(t=>t.level===10);
    return { policy:r.policy,seed:r.seed,hits:c.mgHits,hp:c.initialHp,closest:c.closest,
      cleared:c.clearedAt,deathKinds:c.deaths,crossings:c.crossings,earned:c.nominalXp,usable:c.usableXp,
      nextLevel:c.nextLevel,eliminatedBeforeNext:c.eliminatedBeforeNextLevel,remaining:c.remainingAfterNextLevel,
      level9At:next?.at??null,level10At:cap?.at??null,arrivals:c.arrivals };
  });
  candidates.push({ candidate, groups, firstLv8, natural:existing.natural, verification:existing.verification });
}
writeFileSync(`${out}/comparison.json`,JSON.stringify({baseline:summary.baseline,candidates,
  notes:'Same seeds and existing pilots. Heavy-only and combined-six retain 6-second cadence; combined adds 4.5 seconds at Lv10. All cohorts include same-tick kills, nominal/usable XP and censored theoretical future loadouts.'},null,2));
console.log(JSON.stringify(candidates.map(c=>({candidate:c.candidate,runs:c.verification.runs,natural:c.groups.filter(g=>g.scenario==='natural')}))));

// Offline analysis only: no candidate balance is passed to Simulation.
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b0';
const summary = JSON.parse(readFileSync(`${out}/summary.json`, 'utf8'));
const hz = [0, 3, 3.75, 4.5, 9, 13.5, 18, 22.5, 27, 54, 81];
const range = values => values.length ? [Math.min(...values), Math.max(...values)] : null;
const groups = [];
const future = [], examples = [], natural = [], xp = [], waves = [], giants = [];
let checkpoints = 0, eventTicks = 0, immediateKills = 0;
for (const scenario of ['natural', 'lv7', 'lv8', 'lv9', 'lv10']) for (const policy of ['competent', 'slower', 'fixed']) {
  const runs = summary.runs.filter(r => r.scenario === scenario && r.policy === policy);
  const detail = runs.map(r => JSON.parse(readFileSync(`${out}/${scenario}-${policy}-${r.seed}.json`, 'utf8')));
  groups.push({ scenario, policy, n: runs.length, deaths: runs.filter(r => r.gameOver).length,
    survivalReached: runs.filter(r => r.activation !== null).length,
    survivalSeconds: range(runs.map(r => r.survivalSeconds)), meanActive: range(runs.filter(r => r.activation !== null).map(r => r.mean.active)),
    peakActive: range(runs.filter(r => r.activation !== null).map(r => r.peaks.active)), peakProjectiles: range(runs.map(r => r.peaks.projectiles)),
    peakNear30: range(runs.map(r => r.peaks.near30)), peakNear20: range(runs.map(r => r.peaks.near20)), peakNear10: range(runs.map(r => r.peaks.near10)),
    noTarget: range(runs.map(r => r.longestNoTarget)), noLaneTarget: range(runs.map(r => r.longestNoLaneTarget)),
    availability: range(runs.filter(r => r.activation !== null).map(r => r.mean.globalTarget)), laneAvailability: range(runs.filter(r => r.activation !== null).map(r => r.mean.laneTarget)),
    spawnPerSecond: range(runs.filter(r => r.spawnPerSecond !== null).map(r => r.spawnPerSecond)), killsPerSecond: range(runs.filter(r => r.killsPerSecond !== null).map(r => r.killsPerSecond)),
    nominalXp: range(runs.map(r => r.survivalNominalXp)), usableXp: range(runs.map(r => r.survivalUsableXp)),
    longRangeClear: range(runs.filter(r => r.longRangeClearFraction !== null).map(r => r.longRangeClearFraction)),
    crossed20: range(runs.filter(r => r.crossedFraction[20] !== null).map(r => r.crossedFraction[20])), crossed10: range(runs.filter(r => r.crossedFraction[10] !== null).map(r => r.crossedFraction[10])),
    casualties: range(runs.map(r => r.casualties.reduce((sum, e) => sum + e.before.count - e.after.count, 0))),
    meanHp: range(runs.filter(r => r.activation !== null).map(r => r.mean.hp)), laneHpMean: range(runs.flatMap(r => r.laneHpMean.filter(v => v !== null))),
    laneHpPeak: range(runs.flatMap(r => r.laneHpPeak)), admitted: range(runs.map(r => r.admissions.filter(a => a.admitted).length)),
    blocked: range(runs.map(r => r.admissions.filter(a => !a.admitted).length)), clearMedian: range(runs.map(r => r.waveClearMedian)),
    firstWaveDelay: range(detail.filter(r => r.activation !== null).map(r => r.cohorts.find(c => c.kind === 'survival-wave' || c.kind === 'survival-initial').at - r.activation)),
    giantOpportunities: range(runs.map(r => r.opportunities.filter(o => o.kind === 'nextGiantAtSeconds').length)),
    giantAdmissions: range(runs.map(r => r.opportunities.filter(o => o.kind === 'nextGiantAtSeconds' && o.admitted).length)),
    supplyOpportunities: range(runs.map(r => r.opportunities.filter(o => o.kind === 'nextGrenadeSupplyAtSeconds').length)),
    supplyAdmissions: range(runs.map(r => r.opportunities.filter(o => o.kind === 'nextGrenadeSupplyAtSeconds' && o.admitted).length)),
  });
  for (const r of detail) {
    checkpoints += r.deterministic.checkpoints; eventTicks += r.deterministic.eventTicks;
    immediateKills += r.cohorts.flatMap(c => c.members).filter(e => e.death?.at === r.cohorts[e.cohort].at).length;
    for (const c of r.cohorts.filter(c => c.counts.giant)) giants.push({ scenario, policy, seed: r.seed,
      at: c.at, kind: c.kind, clearedAt: c.clearedAt, closest: c.closest, death: c.members[0].death ?? null });
    if (scenario === 'natural') natural.push({ seed: r.seed, policy, activation: r.activation, end: r.end,
      timeline: r.timeline, giants: r.cohorts.filter(c => c.counts.giant).map(c => ({ at: c.at, kind: c.kind, closest: c.closest, death: c.members[0].death ?? null })) });
    for (const c of r.cohorts.filter(c => c.kind === 'survival-wave' || c.kind === 'survival-initial')) {
      waves.push({ scenario, policy, seed: r.seed, at: c.at, level: c.spawn.level, counts: c.counts,
        clearSeconds: c.clearedAt === null ? null : c.clearedAt - c.at, combatCleared: c.combatCleared,
        closest: c.closest, crossings: c.crossings, hp: c.initialHp, mgHits: c.mgHits, deaths: c.deaths,
        immediateKills: c.members.filter(e => e.death?.at === c.at).length, population: c.members.length });
      xp.push({ scenario, policy, seed: r.seed, at: c.at, level: c.spawn.level, xp: c.spawn.xp,
        nominal: c.nominalXp, usable: c.usableXp, nextLevel: c.nextLevel?.level ?? null,
        eliminatedBeforeNextLevel: c.eliminatedBeforeNextLevel, remainingAfterNextLevel: c.remainingAfterNextLevel });
      for (const b of [20, 10]) {
        const actual = c.arrivals[b].firstLoadout;
        const item = { scenario, policy, seed: r.seed, at: c.at, boundary: b, level: c.spawn.level,
          arrival: c.arrivals[b].firstAt, actualLevel: actual?.level ?? null, actualHz: actual?.hz ?? null,
          actualLastLevel: c.arrivals[b].lastLoadout?.level ?? null, actualLastHz: c.arrivals[b].lastLoadout?.hz ?? null,
          spawnHz: c.spawn.hz, predictions: [c.spawn.hz, hz[Math.min(10, c.spawn.level + 1)], hz[Math.min(10, c.spawn.level + 2)]] };
        future.push(item);
        if (scenario === 'natural' && policy === 'competent' && r.seed === 1 && c.spawn.level < 10) examples.push(item);
      }
    }
  }
}
const heuristic = [];
for (const scenario of ['all', 'natural']) for (const policy of ['competent', 'slower', 'fixed']) for (const boundary of [20, 10]) for (const level of [7, 8, 9, 10]) {
  const all = future.filter(f => (scenario === 'all' || f.scenario === scenario) && f.policy === policy && f.boundary === boundary && f.level === level);
  const observed = all.filter(f => f.actualLevel !== null);
  heuristic.push({ scenario, policy, boundary, spawnLevel: level, n: all.length, observed: observed.length, censored: all.length - observed.length,
    actualLevels: Object.fromEntries([7, 8, 9, 10].map(l => [l, observed.filter(f => f.actualLevel === l).length])),
    underestimateFraction: [0, 1, 2].map(i => observed.length ? observed.filter(f => f.predictions[i] < f.actualHz - 1e-9).length / observed.length : null),
    overestimateFraction: [0, 1, 2].map(i => observed.length ? observed.filter(f => f.predictions[i] > f.actualHz + 1e-9).length / observed.length : null),
    firepowerRatio: range(observed.filter(f => f.spawnHz > 0).map(f => f.actualHz / f.spawnHz)) });
}
const workload = [];
for (const [grunts, heavies] of [[26, 4], [36, 6]]) for (const factor of [1, 1.5, 2]) {
  const hits = grunts + heavies * 15;
  const target = Math.ceil(hits * factor);
  // Replace Grunts first; closest workload at the same original population.
  const count = grunts + heavies, heavy = Math.min(count, Math.round((target - count) / 14));
  workload.push({ original: `${grunts}G/${heavies}H`, factor, targetHits: target,
    countOnly: { population: Math.ceil(count * factor), nominalXp: (grunts + heavies * 10) * factor },
    replacement: { grunts: count - heavy, heavies: heavy, population: count, hits: count + heavy * 14,
      nominalXp: count + heavy * 9 },
    idealServiceSecondsAt: Object.fromEntries([22.5, 27, 54, 81].map(rate => [rate, target / rate])) });
}
const result = { baseline: summary.baseline, groups, natural, heuristic, examples, xp, waves, giants, workload,
  verification: { runs: summary.runs.length, checkpoints, eventTicks, immediateKills },
  travelSeconds: [1, 1.4, 1.6].map(factor => ({ factor, grunts20: [38, 47].map(z => (z - 20) / (.85 * factor)),
    grunts10: [38, 47].map(z => (z - 10) / (.85 * factor)), heavy20: [38, 47].map(z => (z - 20) / (.72 * factor)),
    heavy10: [38, 47].map(z => (z - 10) / (.72 * factor)), giant20: (38 - 20) / (.68 * factor), giant10: (38 - 10) / (.68 * factor) })),
  notes: 'Wave-size and speed candidates are arithmetic estimates only, never simulated. Future comparison uses first member arrival; raw cohorts contain every member theoretical loadout and last member arrival. Full-squad +1/+2 estimates ignore casualties; observed future firepower includes casualties.' };
writeFileSync(`${out}/analysis.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ verification: result.verification, output: `${out}/analysis.json` }));

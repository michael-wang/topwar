import { createServer } from 'vite';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { diagnosticTransform } from './survival-diagnosis-transform.mjs';

const baseline = '56a4f1647b7badd94b33bb77bb1d1e71fcbed87b';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/p3b6b2';
mkdirSync(out, { recursive: true });
const servers = [];
async function load(observed, historical = false) {
  const originals = new Map();
  const historicPlugin = { name: 'historical-baseline', enforce: 'pre', load(id) {
    const path = relative(process.cwd(), id.split('?')[0]).replaceAll('\\', '/');
    if (!path || (!path.startsWith('src/') && path !== 'public/game-data/game.json'
      && path !== 'scripts/qa/survivalExperimentRun.ts')) return;
    if (!originals.has(path)) {
      try { originals.set(path, execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
      catch { originals.set(path, null); }
    }
    return originals.get(path);
  } };
  const server = await createServer({ configFile: false, cacheDir: `${out}/vite-${observed ? 'observed' : 'control'}`,
    server: { middlewareMode: true, hmr: { port: historical ? 14882 : observed ? 14881 : 14880 }, watch: { ignored: ['**/artifacts/**'] } },
    appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] }, plugins: historical ? [historicPlugin] : observed ? [diagnosticTransform()] : [] });
  servers.push(server); return server.ssrLoadModule(historical ? '/scripts/qa/survivalExperimentRun.ts' : '/scripts/qa/survivalPressureRun.ts');
}
const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
const events = sim => ({ presentation: sim.consumePresentationEvents(), grenade: sim.consumeGrenadeEvents(), artillery: sim.consumeArtilleryEvents() });
try {
  const observed = await load(true), control = await load(false), historicalEngine = await load(false, true), runs = [], preludes = new Map();
  if(process.argv.includes('--self-test')) {
    const {checkDiagnosticHooks}=await import('./survival-diagnosis-check.mjs');await checkDiagnosticHooks(observed,control);
  } else {
  const seeds = process.argv.includes('--quick') ? [1] : [1, 17, 42, 99, 2026];
  for (const candidate of ['baseline', 'experimental', 'staged', 'ahead']) {
    mkdirSync(`${out}/${candidate}`, { recursive: true });
    for (const scenario of ['natural', 'lv8', 'lv9', 'lv10']) for (const policy of ['competent', 'slower', 'fixed']) for (const seed of seeds) {
      const sim = observed.makeRun(seed, scenario, candidate), plain = control.makeRun(seed, scenario, candidate);
      const old = candidate === 'baseline' || candidate === 'experimental'
        ? historicalEngine.makeRun(seed, scenario, candidate === 'baseline' ? 'baseline' : 'combined') : null;
      const entry = sim.getState(); assert.deepEqual(entry, plain.getState());
      const collector = new observed.SurvivalDiagnosis(entry); observed.bindObserver(collector);
      const inputs = createHash('sha256'), prelude = createHash('sha256');
      let checked = 1, eventTicks = 0;
      try {
        for (let tick = 0; tick < 600 * 60; tick++) {
          const before = sim.getState(); if (!before.squad.count) break;
          const lane = before.player.selectedLane, input = observed.survivalDecision(sim, tick, policy);
          const direction = sim.getFrameState().player.selectedLane - lane;
          if (direction) plain.stepLane(direction);
          inputs.update(JSON.stringify({ direction, input })); collector.begin(before);
          sim.step(1 / 60, input, observed.pilotTuning); plain.step(1 / 60, input, control.pilotTuning);
          if (old) { if (direction) old.stepLane(direction); old.step(1 / 60, input, historicalEngine.pilotTuning); }
          const after = sim.getState(), a = events(sim), b = events(plain);
          assert.deepEqual(a, b, `Event divergence ${candidate}/${scenario}/${policy}/${seed}/${tick}`);
          eventTicks++; collector.end(after, before, a.presentation);
          if (old) assert.deepEqual(a, events(old), 'Historical event divergence');
          if (tick % 60 === 0) { assert.deepEqual(after, plain.getState()); checked++; }
          if (scenario === 'natural' && before.postCapSurvival.startedAtSeconds === null) {
            const { catharsis, ...gameplay } = after;
            prelude.update(JSON.stringify({ gameplay, events: a, direction, input }));
          }
          if (after.postCapSurvival.startedAtSeconds !== null && after.elapsedSeconds - after.postCapSurvival.startedAtSeconds >= 180 - 1e-9) break;
        }
      } finally { observed.bindObserver(); }
      const final = sim.getState(); assert.deepEqual(final, plain.getState()); checked++;
      if (old) assert.deepEqual(final, old.getState(), 'Historical state divergence');
      const run = { candidate, scenario, policy, seed, ...collector.finish(final), deterministic: {
        checkpoints: checked, eventTicks, finalSha256: digest(final),
        ...(old ? { historicalFinalSha256: digest(old.getState()) } : {}),
        inputSha256: inputs.digest('hex'), preludeSha256: prelude.digest('hex') } };
      if (old) {
        const retained=`artifacts/p3b6b1/${candidate==='baseline'?'baseline':'combined'}/${scenario}-${policy}-${seed}.json`;
        run.deterministic.retainedBaselineChecked=existsSync(retained);
        if(existsSync(retained)) {
          const historical = JSON.parse(readFileSync(retained, 'utf8'));
          assert.equal(digest(old.getState()), historical.deterministic.finalSha256, 'Retained B6B1 comparison changed');
          assert.equal(run.deterministic.inputSha256, historical.deterministic.inputSha256, 'Historical pilot changed');
        }
      }
      if(candidate==='baseline')preludes.set(`${scenario}/${policy}/${seed}`,run.deterministic.preludeSha256);
      else assert.equal(run.deterministic.preludeSha256, preludes.get(`${scenario}/${policy}/${seed}`), 'Pre-Survival gameplay changed');
      writeFileSync(`${out}/${candidate}/${scenario}-${policy}-${seed}.json`, JSON.stringify(run));
      const { cohorts, samples, survivalGiants, engagements, ...summary } = run;
      runs.push(summary);
      console.log(JSON.stringify({ candidate, scenario, policy, seed, activation: run.activation,
        end: run.end, level: run.endLevel, soldiers: run.endSquad, peak: run.peaks.active, near10: run.peaks.near10 }));
    }
  }
  writeFileSync(`${out}/summary.json`, JSON.stringify({ baseline, generatedAt: new Date().toISOString(), runs,
    policies: 'Unmodified B6B0 adjacent competent 200 ms/slower 600 ms pilots and center-lane no-grenade negligent policy.',
    candidates: 'Exact BASELINE/EXPERIMENTAL B6B1 controls, STAGED late-level profiles and AHEAD late-Lv8 XP threshold.',
    checks: 'Every event and 1-second full-state parity observed/unobserved; both controls exactly match B6B1 engine and retained metrics; every natural pre-Survival tick hashed across all modes.' }, null, 2));
  }
} finally { for (const server of servers) await server.close(); }

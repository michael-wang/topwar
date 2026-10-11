import { createServer } from 'vite';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { diagnosticTransform } from './survival-diagnosis-transform.mjs';

const baseline = 'dc8131e0451fb2c752246614b3e610539963f032';
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/p3b6b0';
mkdirSync(out, { recursive: true });
const changed = execFileSync('git', ['diff', baseline, '--name-only', '--', 'src', 'public', 'vite.config.ts', 'package.json',
  'package-lock.json', 'tests/helpers', 'scripts/qa/survivalPilot.ts', 'scripts/qa/p15Pilot.ts'], { encoding: 'utf8' }).trim();
assert.equal(changed, '', 'Diagnosis requires unchanged production code and balance');
const servers = [];
async function load(observed) {
  const server = await createServer({ configFile: false, cacheDir: `${out}/vite-${observed ? 'observed' : 'control'}`,
    server: { middlewareMode: true, hmr: { port: observed ? 14781 : 14780 }, watch: { ignored: ['**/artifacts/**'] } }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }, plugins: observed ? [diagnosticTransform()] : [] });
  servers.push(server);
  return server.ssrLoadModule('/scripts/qa/survivalDiagnosticRun.ts');
}
function events(sim) { return { presentation: sim.consumePresentationEvents(), grenade: sim.consumeGrenadeEvents(), artillery: sim.consumeArtilleryEvents() }; }
const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');

try {
  const observed = await load(true), control = await load(false);
  if (process.argv.includes('--self-test')) {
    const { checkDiagnosticHooks } = await import('./survival-diagnosis-check.mjs');
    await checkDiagnosticHooks(observed, control);
  } else {
  const runs = [], seedList = process.argv.includes('--quick') ? [1] : [1, 17, 42, 99, 2026];
  for (const scenario of ['natural', 'lv7', 'lv8', 'lv9', 'lv10']) for (const policy of ['competent', 'slower', 'fixed']) for (const seed of seedList) {
    const sim = observed.makeRun(seed, scenario), plain = control.makeRun(seed, scenario), entry = sim.getState();
    assert.deepEqual(entry, plain.getState());
    const collector = new observed.SurvivalDiagnosis(entry);
    observed.bindObserver(collector);
    const inputHash = createHash('sha256');
    let checked = 1, ticks = 0, eventTicks = 0;
    try {
      for (; ticks < 600 * 60; ticks++) {
        const before = sim.getState();
        if (!before.squad.count) break;
        const laneBefore = before.player.selectedLane;
        const input = observed.survivalDecision(sim, ticks, policy);
        const direction = sim.getState().player.selectedLane - laneBefore;
        if (direction) plain.stepLane(direction);
        inputHash.update(JSON.stringify({ direction, input }));
        collector.begin(before);
        sim.step(1 / 60, input, observed.pilotTuning);
        plain.step(1 / 60, input, control.pilotTuning);
        const after = sim.getState(), aEvents = events(sim), bEvents = events(plain);
        assert.deepEqual(aEvents, bEvents, `${scenario}/${policy}/${seed}: event divergence at ${ticks}`);
        eventTicks++;
        collector.end(after, before, aEvents.presentation);
        if (ticks % 60 === 0) { assert.deepEqual(after, plain.getState(), `State divergence at ${ticks}`); checked++; }
        if (after.postCapSurvival?.startedAtSeconds != null && after.elapsedSeconds - after.postCapSurvival.startedAtSeconds >= 180 - 1e-9) break;
      }
    } finally { observed.bindObserver(); }
    const final = sim.getState(); assert.deepEqual(final, plain.getState()); checked++;
    const run = { scenario, policy, seed, ...collector.finish(final), deterministic: { checkpoints: checked,
      eventTicks, finalSha256: digest(final), inputSha256: inputHash.digest('hex') } };
    runs.push(run);
    writeFileSync(`${out}/${scenario}-${policy}-${seed}.json`, JSON.stringify(run, null, 2));
    console.log(JSON.stringify({ scenario, policy, seed, activation: run.activation, end: run.end, level: run.endLevel,
      squad: run.endSquad, peak: run.peaks.active, waves: run.ordinaryWaves, longRange: run.longRangeClearFraction, checked }));
  }
  const summaries = runs.map(({ cohorts, samples, survivalGiants, ...run }) => ({ ...run,
    giants: survivalGiants.map(g => ({ at: g.at, death: g.members[0].death ?? null, closest: g.closest })) }));
  writeFileSync(`${out}/summary.json`, JSON.stringify({ baseline, generatedAt: new Date().toISOString(),
    policies: { competent: 'Adjacent movement every 12 ticks (200 ms), artillery target lanes excluded; nearest enemy, except Supply first and distant Giant preference; grenade emergency cluster policy every tick.',
      slower: 'Same adjacent movement every 36 ticks (600 ms); same grenade predicate evaluated only every 36 ticks.',
      fixed: 'Initial center lane, no lane changes and no Grenades.' },
    isolated: 'Unmodified existing survivalSimulation QA fixture: actual authored level, zero XP, Survival age zero, one seeded group at t=0, next opportunity t=6; normal XP growth, casualties, supplies and recurring Giants.',
    stop: '60 Hz, 180 seconds after activation or Game Over; natural prelude bounded to 600 seconds and censored if it never activates.',
    definitions: 'Distances are longitudinal z-player.z; unique live crossings observed before tick combat (within 1/60 s). Global and selected-lane availability use current primary weapon range. Mean population/HP uses every post-step Survival frame, including activation frame. Contacts/leaks yield zero XP. Future loadout is observed at projected first and last member arrival; null means censored.',
    runs: summaries }, null, 2));
  }
} finally { for (const server of servers) await server.close(); }

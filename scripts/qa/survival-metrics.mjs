import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b5/baseline'; mkdirSync(out, { recursive: true });
const revision = process.argv[3];
const historical = revision ? new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', revision, 'src', 'tests/helpers', 'public/game-data'], {encoding:'utf8'}).trim().split('\n')) : new Set();
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', plugins: revision ? [{
 name:'historical-survival', enforce:'pre', load(id) {
 const path=relative(process.cwd(),id.split('?')[0]).replaceAll('\\','/');
 if(historical.has(path)) return execFileSync('git',['show',revision+':'+path],{encoding:'utf8'});
 }
}] : [] });
try {
  const { runSurvivalPilot } = await server.ssrLoadModule('/scripts/qa/survivalPilot.ts');
  const runs = [];
  for (const scenario of ['natural', 'lv7', 'lv8']) for (const seed of [1, 17, 42, 99, 2026]) {
    const r = runSurvivalPilot(seed, scenario); runs.push(r);
    console.log(JSON.stringify({ ...r, entry: undefined, end: undefined, samples: undefined, waves: undefined, opportunities: undefined }));
  }
  for (const policy of ['slower','fixed']) for (const seed of [1, 17, 42, 99, 2026]) runs.push(runSurvivalPilot(seed, 'lv8', policy));
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ policy: '60Hz; up to 180s Survival, 200ms adjacent decision; ordinary damage/grenades, no overrides. Fixed pilot holds its initial lane without grenades.', runs }, null, 2));
} finally { await server.close(); }

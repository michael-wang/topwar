// Repository inventory; no gameplay instrumentation or production imports.
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
const output = process.argv[2] ?? 'artifacts/p3b6b8/baseline-inventory.json';
const files = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard'], { encoding: 'utf8' }).trim().split('\n');
const rows = files.filter(p => { try { return statSync(p).isFile(); } catch { return false; } }).map(path => {
  const bytes = readFileSync(path);
  return { path, bytes: bytes.length, ...(/\.(ts|mjs|css)$/.test(path) ? { lines: bytes.toString().split(/\r?\n/).length } : {}) };
});
const select = fn => rows.filter(r => fn(r.path));
const bundles = readdirSync('dist/assets').filter(p => /\.(js|css)$/.test(p)).map(p => {
  const b = readFileSync(`dist/assets/${p}`); return { path: p, bytes: b.length, gzipBytes: gzipSync(b).length };
});
const inventory = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source: select(p => p.startsWith('src/')), tests: select(p => /^tests\/.*\.test\.(ts|mjs)$/.test(p)),
  qa: select(p => p.startsWith('scripts/qa/')), fixtures: select(p => p.startsWith('tests/fixtures/')),
  publicAssets: select(p => p.startsWith('public/')), showcase: select(p => p.startsWith('art-showcase/') || p.startsWith('src/art-showcase/')),
  documents: select(p => p.endsWith('.md')), workflows: select(p => p.startsWith('.github/workflows/')), bundles };
mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true });
writeFileSync(output, JSON.stringify(inventory, null, 2));
console.log(JSON.stringify({ sha: inventory.sha, sourceFiles: inventory.source.length,
  sourceLines: inventory.source.reduce((s,r) => s+(r.lines??0),0), testFiles: inventory.tests.length,
  qaFiles: inventory.qa.length, fixtureFiles: inventory.fixtures.length, assetFiles: inventory.publicAssets.length,
  assetBytes: inventory.publicAssets.reduce((s,r)=>s+r.bytes,0), bundles }, null, 2));

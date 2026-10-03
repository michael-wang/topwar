import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { files } from './baseline-server.mjs';
const baseline = '17fffdcac3abde4c08492cc66ab271c8cf777ad2';
const sources = new Map([...files.map(f => `src/rendering/${f}`), 'src/app/GameApp.ts', 'src/main.ts', 'src/app/ThreatReview.ts', 'src/presentation/CharacterMotion.ts', 'src/art/ArtDirection.ts'].map(path =>
  [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })]));
const result = {};
for (const phase of ['baseline', 'polish']) {
  const outputs = await build({ logLevel: 'warn', build: { write: false }, plugins: phase === 'baseline'
    ? [{ name: 'r1-bundle-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }] : [] });
  const code = (Array.isArray(outputs) ? outputs : [outputs]).flatMap(o => o.output).filter(o => o.type === 'chunk').map(o => o.code).join('');
  const loader = phase === 'baseline' ? execFileSync('git', ['show', `${baseline}:src/rendering/CharacterAssets.ts`], { encoding: 'utf8' })
    : readFileSync('src/rendering/CharacterAssets.ts', 'utf8');
  const names = [...loader.split('const files = {')[1].split('} as const')[0].matchAll(/: '([a-z0-9-]+)'/g)].map(m => m[1]);
  result[phase] = { jsBytes: Buffer.byteLength(code), jsGzipBytes: gzipSync(code).length, assetRequests: names.length,
    assetBytes: names.reduce((sum, name) => sum + statSync(`public/models/toy-soldier-${name}.glb`).size, 0) };
}
writeFileSync('artifacts/coastal-r3/bundle-comparison.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

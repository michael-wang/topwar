// Build comparison without replacing dist or changing the checkout.
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { statSync, writeFileSync } from 'node:fs';
const baseline = 'ee59abdf7c41b3fd8b22bd6fe9fcc700dc360238';
const files = ['enemies/ChibiGruntFamily.ts', 'enemies/EnemyRenderer.ts', 'CharacterVisualFamilies.ts'];
const sources = new Map(files.map(file => {
  const path = `src/rendering/${file}`;
  return [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })];
}));
const sizes = {};
for (const phase of ['baseline', 'prototype']) {
  const result = await build({ logLevel: 'warn', build: { write: false },
    plugins: phase === 'baseline' ? [{ name: 'phase-one-bundle', enforce: 'pre',
      load(id) { return sources.get(id.split('?')[0]); } }] : [] });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
  const code = outputs.filter(o => o.type === 'chunk').map(o => o.code).join('');
  sizes[phase] = { jsBytes: Buffer.byteLength(code), jsGzipBytes: gzipSync(code).length };
}
const manifest = execFileSync('git', ['show', `${baseline}:src/rendering/CharacterAssets.ts`], { encoding: 'utf8' });
const resources = [...manifest.matchAll(/: '([a-z0-9-]+)'/g)].map(m => m[1]);
const bytes = resource => statSync(`public/models/toy-soldier-${resource}.glb`).size;
sizes.characterDownloads = { baseline: resources.reduce((n, r) => n + bytes(r), 0),
  prototype: resources.filter(r => !['player-body', 'rifle'].includes(r)).reduce((n, r) => n + bytes(r), 0),
  removedRequests: resources.filter(r => ['player-body', 'rifle'].includes(r)).map(r => `toy-soldier-${r}.glb`) };
writeFileSync('artifacts/grunt-chibi-simplify/bundle-comparison.json', JSON.stringify(sizes, null, 2));
console.log(JSON.stringify(sizes, null, 2));

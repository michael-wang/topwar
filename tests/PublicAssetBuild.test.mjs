import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { publicAssets } from '../scripts/public-assets.mjs';

it('emits each asset once with a content hash that agrees with the JS manifest', () => {
  const { manifest, plugin } = publicAssets('public'), emitted = [];
  plugin.buildStart.call({ emitFile: file => emitted.push(file) });
  expect(new Set(emitted.map(f => f.fileName)).size).toBe(emitted.length);
  for (const [path, filename] of Object.entries(manifest)) {
    const bytes = readFileSync(`public/${path}`);
    expect(filename).toContain(createHash('sha256').update(bytes).digest('hex').slice(0, 16));
    expect(emitted.find(f => f.fileName === filename).source).toEqual(bytes);
    expect(emitted.some(f => f.fileName === path)).toBe(false);
  }
  expect(publicAssets('public').manifest).toEqual(manifest);
});

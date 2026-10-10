import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

// The URL names the bytes, not the commit. Emit exactly one copy of each file.
// Old JS can reuse unchanged assets; a removed hash fails instead of serving
// different bytes under an old URL during a deployment transition.
export function publicAssets(directory) {
  const files = [], manifest = {};
  function walk(relative = '') {
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { walk(path); continue; }
      const source = readFileSync(join(directory, path));
      const extension = extname(path);
      const versioned = ['.glb', '.webp', '.mp3', '.json'].includes(extension);
      const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
      const fileName = versioned ? `${path.slice(0, -extension.length)}.${hash}${extension}` : path;
      if (versioned) manifest[path] = fileName;
      files.push({ fileName, source });
    }
  }
  walk();
  return { manifest, plugin: { name: 'content-addressed-public-assets', apply: 'build', buildStart() {
    for (const file of files) this.emitFile({ type: 'asset', ...file });
  } } };
}

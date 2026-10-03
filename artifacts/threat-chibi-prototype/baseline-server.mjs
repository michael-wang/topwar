import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const baseline = '83234e8877e3dc3803aa9029520aef6317409d6f';
export const files = ['CharacterAssets.ts', 'CharacterVisualFamilies.ts', 'GameRenderer.ts', 'ContactShadowRenderer.ts', 'enemies/CrowdPresentation.ts', 'enemies/EnemyRenderer.ts', 'enemies/GiantRenderer.ts'];
export async function baselineServer() {
  const sources = new Map(files.map(file => {
    const path = `src/rendering/${file}`;
    return [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })];
  }));
  const server = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true },
    plugins: [{ name: 'phase3b-rendering-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }] });
  await server.listen(); return server;
}
if (process.argv[2] === 'preset') {
  const server = await baselineServer();
  // Async child permits the server to answer requests while QA runs.
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['artifacts/threat-chibi-prototype/live-sanity.mjs', 'preset'],
    { stdio: 'inherit', env: { ...process.env, TOPWAR_QA_URL: 'http://127.0.0.1:5180' } });
  const code = await new Promise(resolve => child.on('exit', resolve));
  await server.close(); process.exitCode = code;
}

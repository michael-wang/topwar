import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const baseline = '17fffdcac3abde4c08492cc66ab271c8cf777ad2';
export const files = ['CharacterAssets.ts', 'CharacterVisualFamilies.ts', 'GameRenderer.ts', 'ContactShadowRenderer.ts', 'enemies/CrowdPresentation.ts', 'enemies/EnemyRenderer.ts', 'enemies/DeathBurst.ts', 'enemies/GiantHealthBar.ts', 'enemies/GiantRenderer.ts', 'enemies/HeavyHitFeedback.ts', 'environment/BridgeEnvironment.ts', 'environment/CoastalArchitecture.ts', 'environment/OffshoreTransports.ts', 'squad/ChibiPlayerFamily.ts', 'boss/BossRenderer.ts', 'tierPalettes.ts', 'art/FramedBarTextures.ts'];
export async function baselineServer() {
  const sources = new Map([...files.map(file => `src/rendering/${file}`), 'src/presentation/CharacterMotion.ts', 'src/presentation/EnemyDeathTiming.ts', 'src/presentation/GiantDrama.ts', 'src/art/ArtDirection.ts'].map(path => {
    return [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })];
  }));
  const server = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true },
    plugins: [{ name: 'r1-rendering-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }] });
  await server.listen(); return server;
}
if (process.argv[2] === 'preset') {
  const server = await baselineServer();
  // Async child permits the server to answer requests while QA runs.
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['artifacts/coastal-r3/live-sanity.mjs', 'preset'],
    { stdio: 'inherit', env: { ...process.env, TOPWAR_QA_URL: 'http://127.0.0.1:5180' } });
  const code = await new Promise(resolve => child.on('exit', resolve));
  await server.close(); process.exitCode = code;
}

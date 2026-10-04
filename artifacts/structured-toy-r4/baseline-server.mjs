import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
export const baseline = 'a4a530447d833ee341805ee6df02f947cd435aa7';
export const files = ['environment/CoastalForeground.ts', 'enemies/ChibiThreatFamilies.ts',
  'characters/ToyCombatGear.ts', 'characters/ToyGeometry.ts'];
export const paths = [...files.map(file => `src/rendering/${file}`), 'src/ui/XpHud.ts',
  'src/ui/loadoutPresentation.ts', 'src/ui/GameIcons.ts', 'src/style.css'];
export async function baselineServer() {
  const sources = new Map(paths.map(path => [resolve(path).replaceAll('\\', '/'),
    execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })]));
  const server = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true },
    plugins: [{ name: 'r3-presentation-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }] });
  await server.listen(); return server;
}

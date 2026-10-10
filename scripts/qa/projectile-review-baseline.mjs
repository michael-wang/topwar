import { execFileSync } from 'node:child_process';
import { transformWithEsbuild } from 'vite';

// Freeze just the baseline projectile path for matched 54 Hz runs. The current
// DEV UI remains mounted; its presentation setter is inert in this QA baseline.
export async function installReviewBaseline(page) {
  for (const name of ['ProjectileRenderer', 'DefenseTracer']) {
    let source = execFileSync('git', ['show', `79c6bf33644f0451523617e3e6f24d9f9d815369:src/rendering/projectiles/${name}.ts`], { encoding: 'utf8' });
    if (name === 'ProjectileRenderer') source = source.replace('  presentLevelUp(', '  setDefensePresentation() {}\n  presentLevelUp(');
    const { code } = await transformWithEsbuild(source, `${name}.ts`);
    await page.route(new RegExp(`/src/rendering/projectiles/${name}\\.ts(\\?.*)?$`), route => route.fulfill({ contentType: 'application/javascript', body: code
      .replaceAll('../../art/ArtDirection', '/src/art/ArtDirection.ts')
      .replaceAll('../../presentation/ProgressionLevelUp', '/src/presentation/ProgressionLevelUp.ts')
      .replaceAll('./DefenseTracer', '/src/rendering/projectiles/DefenseTracer.ts')
      .replaceAll('"three"', '"/node_modules/.vite/deps/three.js"') }));
  }
}

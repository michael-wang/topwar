import { execFileSync } from 'node:child_process';
import { transformWithEsbuild } from 'vite';
// Freeze the accepted renderer for repeatable A/B runs after the implementation changes.
export async function installProjectileBaseline(page) {
 const source=execFileSync('git',['show','f74ab61a3280e899be63ddb270a0dbb7b0231f9c:src/rendering/projectiles/ProjectileRenderer.ts'],{encoding:'utf8'});
 const {code}=await transformWithEsbuild(source,'ProjectileRenderer.ts');
 await page.route(/\/src\/rendering\/projectiles\/ProjectileRenderer\.ts(\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:code
  .replaceAll('../../art/ArtDirection','/src/art/ArtDirection.ts')
  .replaceAll('../../presentation/ProgressionLevelUp','/src/presentation/ProgressionLevelUp.ts')
  .replaceAll('"three"','"/node_modules/.vite/deps/three.js"')}));
}

import { execFileSync } from 'node:child_process';
import { transformWithEsbuild } from 'vite';

// QA-only replay of the physical-phone-selected P3 at the accepted baseline.
export async function installReviewBaseline(page) {
  const baseline = '2081abe74baf5928984584a552c394c86f626297';
  for (const path of ['rendering/projectiles/ProjectileRenderer', 'rendering/projectiles/DefenseTracer', 'ui/DevProjectileControls']) {
    let source = execFileSync('git', ['show', baseline + ':src/' + path + '.ts'], { encoding: 'utf8' });
    if (path.endsWith('ProjectileRenderer')) source = "import { DEV_TRACERS, devTracerGeometry } from '/src/ui/DevProjectileControls.ts';\n" + source.replace('this.defenseGeometry = defenseTracerGeometry(bullet.geometry);', 'this.defenseGeometry = defenseTracerGeometry(bullet.geometry); this.setDefensePresentation({...DEV_TRACERS.P3,geometry:devTracerGeometry()});');
    const { code } = await transformWithEsbuild(source, path + '.ts');
    await page.route(new RegExp('/src/' + path + '\\.ts(\\?.*)?$'), route => route.fulfill({ contentType: 'application/javascript', body: code
      .replaceAll('../../art/ArtDirection', '/src/art/ArtDirection.ts')
      .replaceAll('./DefenseTracer', '/src/rendering/projectiles/DefenseTracer.ts')
      .replaceAll('"three"', '"/node_modules/.vite/deps/three.js"') }));
  }
}

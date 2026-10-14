// P4.2 matched-state camera diagnostics. Private app access exists only in this test response.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { preview } from 'vite';
const out = process.argv[2] ?? 'artifacts/p4.2-camera';
mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
let production;
try {
  for (const width of [350, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
    });
    await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5175/');
    await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp?.startup === 'started');
    await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
    await page.locator('.tuning-panel > summary').tap();
    assert.equal(await page.locator('.dev-review-controls [data-role]').count(), 5);
    assert.equal(await page.locator('.dev-advanced').evaluate(e => e.open), false);
    await page.screenshot({ path: `${out}/${width}-menu.png` });
    await page.getByRole('button', { name: '🎥 鏡頭 A/B 測試', exact: true }).tap();
    const initial = await page.evaluate(() => window.__testApp.simulation.getState());
    assert.equal(initial.seed, 17); assert.equal(initial.progression.level, 8); assert.equal(initial.enemies.length, 42);
    assert.equal(await page.getByRole('button', { name: 'Camera A', exact: true }).getAttribute('aria-pressed'), 'true');

    for (const [role, ticks, label] of [['camera-ab', 30, 'lv8'], ['boss-intro', 75, 'boss-entrance'],
      ['boss-phase2', 120, 'boss-combat'], ['barrage8-on', 0, 'artillery']]) {
      await page.evaluate(({ role, ticks }) => {
        const a = window.__testApp;
        a.devReviewFixture = role; a.retry(); cancelAnimationFrame(a.frameId);
        // Existing fixtures only; the menu experiment itself remains exactly Lv8 AHEAD.
        a.devCameraSwitch.setActive(true);
        const c = a.config, t = a.runtimeTuning;
        const tuning = { ...c.player, moveSpeed: t.moveSpeed, forwardSpeed: t.forwardSpeed,
          trackHalfWidth: c.track.halfWidth, defenseLineOffset: c.track.defenseLineOffset,
          normalEnemyRadius: c.tiers.normalEnemyRadius, bossRadius: c.bosses.basic.radius,
          rifle: { ...c.weapon.rifle, fireRate: t.fireRate, projectileSpeed: t.bulletSpeed, range: t.bulletRange }, rocket: c.weapon.rocket };
        let tick = 0;
        while (tick < ticks || (role === 'barrage8-on' && !a.simulation.getFrameState().artillery?.shells.length && tick < 900)) {
          a.simulation.step(1 / 60, { targetX: 0 }, tuning); tick++;
        }
        a.presentationMs = a.simulation.getFrameState().elapsedSeconds * 1000;
        a.setPaused(true); a.renderFrame(0); cancelAnimationFrame(a.frameId);
        window.__cameraSimulation = a.simulation;
      }, { role, ticks });
      const before = await page.evaluate(() => window.__testApp.simulation.getState());
      if (label === 'artillery') assert(before.artillery.shells.length > 0);
      // Real Pause overlay and touch switch work together; hide only its veil for comparison captures.
      await page.getByRole('button', { name: 'Camera B', exact: true }).tap();
      assert.deepEqual(await page.evaluate(() => window.__testApp.simulation.getState()), before);
      if (label === 'lv8') await page.screenshot({ path: `${out}/${width}-paused-switch.png` });
      await page.evaluate(() => window.__testApp.pauseOverlay.setVisible(false));
      const row = { width, scene: label, tick: before.tick, enemies: before.enemies.length,
        projectiles: before.projectiles.length, shells: before.artillery?.shells.length ?? 0, cameras: {} };
      for (const mode of ['A', 'B']) {
        await page.getByRole('button', { name: `Camera ${mode}`, exact: true }).tap();
        row.cameras[mode] = await page.evaluate(() => {
          const a = window.__testApp; a.renderFrame(0); cancelAnimationFrame(a.frameId);
          const camera = a.renderer.camera, v = camera.position.clone();
          const point = (x,y,z) => { v.set(x,y,z).project(camera); return { x:(v.x+1)*innerWidth/2, y:(1-v.y)*innerHeight/2 }; };
          return { fov: camera.fov, player: point(0,.8,0), feet: point(0,0,0), head: point(0,1.6,0),
            laneSpacing: Math.abs(point(1,0,40).x-point(0,0,40).x), tankHealth: a.renderer.projectTankHealthPosition() };
        });
        await page.screenshot({ path: `${out}/${width}-${label}-${mode}.png` });
        assert.deepEqual(await page.evaluate(() => window.__testApp.simulation.getState()), before);
        assert(await page.evaluate(() => window.__testApp.simulation === window.__cameraSimulation));
        assert(await page.evaluate(() => {
          const a = window.__testApp, camera = a.renderer.camera;
          const mesh = a.renderer.scene.getObjectByName('artillery-lane-danger');
          const shells = a.simulation.getFrameState().artillery?.shells ?? [];
          const lanes = [...new Set(shells.map(s => s.targetLane))].sort((x,y) => x-y);
          if (!mesh) return lanes.length === 0;
          const m = camera.matrixWorld.clone(), v = camera.position.clone();
          return mesh.count === lanes.length && lanes.every((lane, i) => {
            mesh.getMatrixAt(i,m); const actual = v.setFromMatrixPosition(m).project(camera).clone();
            const shell = shells.filter(s => s.targetLane === lane).sort((x,y) => x.impactAtSeconds-y.impactAtSeconds)[0];
            return actual.distanceTo(v.set(-shell.target.x,2.05,shell.target.z+1.2).project(camera)) < 1e-6;
          });
        }), 'warning projection must follow the active camera and unchanged locked targets');
      }
      const ratio = row.cameras.B.laneSpacing / row.cameras.A.laneSpacing;
      assert(ratio > 1.2 && ratio < 1.26);
      assert(Math.abs(row.cameras.A.player.y - row.cameras.B.player.y) < .01);
      // A/B/A returns exactly the original projection and pixels for the same render state/time.
      const exactA = await page.evaluate(async () => {
        const a = window.__testApp;
        a.renderer.setDevCameraMode('A'); a.renderFrame(0); cancelAnimationFrame(a.frameId);
        const imageA = a.renderer.renderer.domElement.toDataURL();
        const { coastalCameraFov } = await import('/src/rendering/renderSize.ts');
        const c = a.renderer.camera; c.position.set(0,6.5,-10); c.lookAt(0,0,12.5);
        c.fov = coastalCameraFov(c.aspect); c.updateProjectionMatrix(); c.updateMatrixWorld();
        a.renderFrame(0); cancelAnimationFrame(a.frameId);
        return imageA === a.renderer.renderer.domElement.toDataURL();
      });
      assert(exactA); row.originalPixelsMatch = exactA;
      results.push(row);
    }
    // Resize an active B, then leave through the real first-level menu.
    await page.getByRole('button', { name: 'Camera B', exact: true }).tap();
    await page.setViewportSize({ width: width === 350 ? 390 : 350, height: 844 });
    await page.waitForFunction(() => window.__testApp.renderer.camera.aspect === innerWidth / innerHeight);
    assert(await page.evaluate(() => window.__testApp.renderer.devCameraMode === 'B'));
    await page.locator('.tuning-panel > summary').tap();
    await page.getByRole('button', { name: '返回一般遊戲', exact: true }).tap();
    assert(await page.locator('.dev-camera-switch').isHidden());
    assert(await page.evaluate(() => window.__testApp.renderer.devCameraMode === 'A'));
    await page.locator('.tuning-panel > summary').tap();
    await page.getByRole('button', { name: '🎥 鏡頭 A/B 測試', exact: true }).tap();
    await page.getByRole('button', { name: 'Camera B', exact: true }).tap();
    const saved = await page.evaluate(() => {
      const a = window.__testApp; a.setPaused(true); a.saveCheckpoint('pause');
      return a.simulation.getState();
    });
    await page.reload();
    await page.getByRole('button', { name: '繼續上次遊戲', exact: true }).tap();
    await page.waitForFunction(() => window.__testApp?.startup === 'started');
    assert.deepEqual(await page.evaluate(() => window.__testApp.simulation.getState()), saved);
    assert(await page.evaluate(() => window.__testApp.renderer.devCameraMode === 'A'));
    assert(await page.locator('.dev-camera-switch').isHidden());
    assert.deepEqual(errors, []); await page.close();
  }
  const bundle = readdirSync('dist/assets').filter(f => f.endsWith('.js')).map(f => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
  for (const token of ['鏡頭 A/B 測試', 'dev-camera-switch', 'DEV 鏡頭', 'playerDepth /']) assert(!bundle.includes(token), token);
  production = await preview({ preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
  const page = await browser.newPage({ viewport: { width: 350, height: 844 } });
  await page.goto('http://127.0.0.1:5196/topwar/');
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.locator('.game-start-overlay').waitFor({ state: 'detached' }).catch(() => {});
  await page.locator('.tuning-panel > summary').click();
  assert.deepEqual(await page.locator('.dev-review-controls [data-role]').allTextContents(),
    ['🚢 驅逐艦進場', '🚨 BOSS 進場', '🏆 勝利結算', '✈️ 空中支援']);
  assert.equal(await page.locator('.dev-camera-switch').count(), 0);
  await page.screenshot({ path: `${out}/production-menu.png` });
  console.log('Matched A/B states, original A pixels, Pause touch switching, resize/reset and production exclusion passed.');
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close(); await new Promise(resolve => production ? production.httpServer.close(resolve) : resolve());
}

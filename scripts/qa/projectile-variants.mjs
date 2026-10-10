// Test-side hooks only; the human path is DEV -> P1/P2/P3 and a combat entry.
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { startGameRecording } from './browser-recording.mjs';
const out = 'artifacts/p3b33/visual'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of [350, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  await page.goto('http://127.0.0.1:5173/'); await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.waitForTimeout(1600);
  for (const variant of ['P1', 'P2', 'P3']) {
    await page.locator('.tuning-panel > summary').tap();
    // Frozen simulation establishes that switching itself does not mutate a tick.
    await page.evaluate(() => { const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__before = JSON.stringify(a.simulation.getState()); });
    await page.locator(`[data-tracer="${variant}"]`).tap();
    assert(await page.evaluate(() => window.__before === JSON.stringify(window.__testApp.simulation.getState())));
    await page.locator('.tuning-panel > summary').tap();
    assert.match(await page.locator('.dev-projectile-controls').innerText(), new RegExp(`TRACER: ${variant}`));
    const bounds = await page.locator(`[data-tracer="${variant}"]`).boundingBox();
    assert(bounds.height >= 48 && bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `${out}/${variant}-controls-${width}.png` });
    await page.locator('.tuning-panel > summary').tap();
    const stop = await startGameRecording(page, width);
    for (const [level, fixture] of [[1, 'rifle'], [3, 'grenade'], [6, 'machineGun'], [8, 'mg8']]) {
      await selectDevFixture(page, fixture);
      await page.evaluate(() => { const a = window.__testApp; a.previousFrameTimestampMs = null; a.frameId = requestAnimationFrame(a.renderFrame); });
      await page.waitForTimeout(level === 1 ? 1800 : 900);
      await page.screenshot({ path: `${out}/${variant}-lv${level}-${width}.png` });
      const sample = await page.evaluate(() => { const a = window.__testApp, p = a.renderer.projectileRenderer; return { level: a.simulation.getState().progression.level, core: p.tracerMaterial.color.getHexString(), edge: p.glowMaterial.color.getHexString(), stats: p.getDebugStats() }; });
      assert.equal(sample.level, level); results.push({ variant, width, ...sample });
      await page.waitForTimeout(level === 1 ? 1700 : 1500);
      await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
    }
    writeFileSync(`${out}/${variant}-${width}.webm`, await stop());
    const stable = await page.evaluate(() => {
      const a = window.__testApp, r = a.renderer, p = r.projectileRenderer;
      const shots = [{ id: 99999, kind: 'rifle', tier: 1, x: 0, z: 30, hitRadiusBonus: 0 }];
      p.reset(); p.update(shots, 0, r.camera, 844); p.update(shots, 100, r.camera, 844);
      const signature = () => JSON.stringify([p.tracerMaterial.color, p.glowMaterial.color, p.glowMaterial.blending, p.glowMaterial.opacity, [...p.body.instanceMatrix.array], [...p.glow.instanceMatrix.array]]);
      const before = signature(); r.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 }, 100);
      p.update(shots, 200, r.camera, 844); const stable = signature() === before;
      const saved = JSON.stringify(a.simulation.getState()), selected = p.presentation;
      a.simulation.restoreState(JSON.parse(saved)); a.renderer.resetFeedback();
      const restore = p.presentation === selected; a.retry(); cancelAnimationFrame(a.frameId);
      return { stable, restore, retry: p.presentation === selected };
    });
    assert.deepEqual(stable, { stable: true, restore: true, retry: true });
    // Pause uses the actual UI and must not advance simulation or lose the selection.
    await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
    const paused = await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState()));
    await page.waitForTimeout(100); assert.equal(await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState())), paused);
    await page.getByRole('button', { name: 'Resume game', exact: true }).tap();
  }
  assert.deepEqual(errors, []); await page.close();
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
} } finally { await browser.close(); }

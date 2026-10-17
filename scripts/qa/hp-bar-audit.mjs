import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b3a/hp-bars'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of [350, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  // Measurement-only response transform: only the Heavy bar section loses pulse work.
  // No accepted renderer file or production toggle is edited.
  await page.route(/\/src\/rendering\/enemies\/EnemyRenderer\.ts(\?.*)?$/, async route => {
    const r = await route.fetch(), body = await r.text();
    const start = body.indexOf('const giantCount ='), end = body.indexOf('for (; barIndex <', start);
    assert(start > 0 && end > start, 'HP audit transform must find existing bar section');
    const block = body.slice(start, end), matches = [...block.matchAll(/this\.heavyHits\.strength\(enemy\.id, nowMs\)/g)];
    assert.equal(matches.length, 2);
    assert(block.includes('bar.backing.visible = true;'));
    await route.fulfill({ response: r, body: body.slice(0, start) + block.replace(/this\.heavyHits\.strength\(enemy\.id, nowMs\)/g,
      '(globalThis.__qaHpMode === "no-pulse" && enemy.archetype === "heavy" ? 0 : this.heavyHits.strength(enemy.id, nowMs))')
      .replace('bar.backing.visible = true;', 'bar.backing.userData.qaArchetype = enemy.archetype; bar.backing.visible = true;') + body.slice(end) });
  });
  await page.goto('http://127.0.0.1:5175/?perf=1');
  await page.getByRole('button', { name: '開始遊戲' }).tap(); await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  await selectDevFixture(page, 'survival10-ahead');
  const setup = await page.evaluate(async () => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); a.renderer.preparation?.dispose();
    const { projectRenderState } = await import('/src/app/projectRenderState.ts');
    const { writeCheckpoint, readCheckpoint } = await import('/src/app/SessionCheckpoint.ts');
    const c = a.config, r = a.runtimeTuning;
    const tuning = { ...c.player, moveSpeed: r.moveSpeed, forwardSpeed: r.forwardSpeed,
      trackHalfWidth: c.track.halfWidth, defenseLineOffset: c.track.defenseLineOffset,
      normalEnemyRadius: c.tiers.normalEnemyRadius, bossRadius: c.bosses.basic.radius,
      rifle: { ...c.weapon.rifle, fireRate: r.fireRate, projectileSpeed: r.bulletSpeed, range: r.bulletRange }, rocket: c.weapon.rocket };
    let dense = a.simulation.getState();
    for (let i = 0; i < 1800; i++) {
      const s = a.simulation.getFrameState();
      if (s.squad.count && s.enemies.length > dense.enemies.length) dense = a.simulation.getState();
      // Fixed-lane play accumulates a real dense crowd; stop before first contacts.
      a.simulation.step(1 / 60, { targetX: a.simulation.getFrameState().player.x }, tuning);
      if (!a.simulation.getFrameState().squad.count) break;
    }
    a.simulation.restoreState(dense);
    const s = a.simulation.getState();
    window.__hpRenderState = projectRenderState(s, { formationSpacing: c.player.formationSpacing, trackHalfWidth: c.track.halfWidth,
      defenseLineOffset: c.track.defenseLineOffset, bossVisualScale: c.bosses.basic.visualScale, catharsis: s.catharsis });
    window.__hpNow = s.elapsedSeconds * 1000;
    a.renderer.restoreFeedback(window.__hpRenderState, window.__hpNow);
    // Freeze the real crowd and half-intensity Heavy bar flashes for a matched stress comparison.
    a.renderer.enemyRenderer.heavyHits.lastHit.clear();
    for (const e of s.enemies) if (e.archetype === 'heavy') a.renderer.enemyRenderer.heavyHits.lastHit.set(e.id, window.__hpNow - 50);
    const native = a.renderer.renderer.render.bind(a.renderer.renderer);
    a.renderer.renderer.render = (scene, camera) => {
      if (window.__qaHpMode === 'no-bars') for (const bar of a.renderer.enemyRenderer.healthBars)
        if (bar.backing.userData.qaArchetype === 'heavy') { bar.backing.visible = false; bar.fill.visible = false; }
      if (window.__qaHpMode === 'no-bodies') for (const batch of a.renderer.enemyRenderer.batches)
        for (const mesh of [...batch.bodyMeshes, ...batch.helmetMeshes, ...batch.vestMeshes]) mesh.visible = false;
      native(scene, camera);
      if (window.__qaHpMode === 'no-bodies') for (const batch of a.renderer.enemyRenderer.batches)
        for (const mesh of [...batch.bodyMeshes, ...batch.helmetMeshes, ...batch.vestMeshes]) mesh.visible = true;
    };
    window.__hpDraw = () => a.renderer.render(window.__hpRenderState, window.__hpNow);
    window.__qaHpMode = 'normal'; window.__hpDraw();
    const { Frustum, Matrix4, Vector3 } = await import('/node_modules/.vite/deps/three.js');
    const camera = a.renderer.camera, frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const centerVisibleEnemies = window.__hpRenderState.enemies.filter(e => frustum.containsPoint(new Vector3(-e.x, .5, e.z))).length;
    // Representative durable-save sizes/cost including clone, serialization and synchronous storage.
    a.setPaused(true); const timings = [];
    for (let i = 0; i < 25; i++) { const start = performance.now(); a.saveCheckpoint('pause');
      const write = a.lifecycle.events.at(-1).detail; timings.push({ ...write, elapsed: performance.now() - start }); }
    const reads = []; for (let i = 0; i < 10; i++) { const start = performance.now(); const found = readCheckpoint();
      if (found.status !== 'valid') throw Error('Dense save not valid'); reads.push(performance.now() - start); }
    return { enemies: s.enemies.length, heavy: s.enemies.filter(e => e.archetype === 'heavy').length,
      giant: s.enemies.filter(e => e.archetype === 'giant').length, projectiles: s.projectiles.length, soldiers: s.squad.count,
      renderEnemies: window.__hpRenderState.enemies.length, centerVisibleEnemies, state: s, writes: timings, reads };
  });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const throttledWrites = await page.evaluate(() => {
    const a = window.__testApp, rows = [];
    for (let i = 0; i < 25; i++) { const start = performance.now(); a.saveCheckpoint('pause');
      rows.push({ ...a.lifecycle.events.at(-1).detail, elapsed: performance.now() - start }); }
    return rows;
  });
  setup.throttledWrites = throttledWrites;
  await page.evaluate(async () => { await new Promise(resolve => { let n = 0; requestAnimationFrame(function warm() {
    window.__hpDraw(); if (++n < 90) requestAnimationFrame(warm); else resolve(); }); }); });
  const trials = [];
  for (let repeat = 0; repeat < 3; repeat++) for (const mode of repeat % 2 ? ['no-bodies', 'no-pulse', 'no-bars', 'normal'] : ['normal', 'no-bars', 'no-pulse', 'no-bodies']) {
    const trial = await page.evaluate(async mode => {
      window.__qaHpMode = mode; const rows = []; let start, previous;
      await new Promise(resolve => requestAnimationFrame(function frame(ts) {
        start ??= ts; const cpu = performance.now(); window.__hpDraw();
        rows.push({ ms: previous == null ? 0 : ts - previous, cpu: performance.now() - cpu }); previous = ts;
        if (ts - start < 5000) requestAnimationFrame(frame); else resolve();
      }));
      const sorted = rows.slice(1).map(r => r.ms).sort((a, b) => a - b), cpu = rows.slice(1).map(r => r.cpu).sort((a, b) => a - b);
      return { mode, frames: sorted.length, mean: sorted.reduce((n, v) => n + v, 0) / sorted.length,
        p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1),
        over100: sorted.filter(v => v > 100).length, over200: sorted.filter(v => v > 200).length,
        cpuMean: cpu.reduce((n, v) => n + v, 0) / cpu.length, cpuP95: cpu[Math.floor(cpu.length * .95)],
        stats: window.__testApp.renderer.getDebugStats() };
    }, mode);
    trials.push({ repeat, ...trial }); console.log(JSON.stringify({ width, repeat, mode, mean: trial.mean, calls: trial.stats.drawCalls, triangles: trial.stats.triangles }));
  }
  assert.deepEqual(errors, []); results.push({ width, setup, trials, errors });
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); await page.close();
} } finally { await browser.close(); }

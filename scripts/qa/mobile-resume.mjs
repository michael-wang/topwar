import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b3a/resume'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of [350, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  const load = async () => { await page.goto('http://127.0.0.1:5175/'); await page.waitForFunction(() => window.__testApp?.running); };
  const stopFrames = async () => page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  const start = async () => { await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started'); await stopFrames(); };
  const ahead = async () => {
    await page.locator('.tuning-panel > summary').tap();
    if (!await page.locator('.dev-survival-test').evaluate(e => e.open)) await page.locator('.dev-survival-test > summary').tap();
    await page.locator('[data-survival="ahead"]').tap();
    await page.locator('.tuning-panel > summary').tap(); await page.locator('[data-survival="10"]').tap(); await stopFrames();
  };
  const advance = async (ticks, pilot = true) => page.evaluate(({ ticks, pilot }) => {
    const a = window.__testApp, gpu = a.renderer.renderer, native = gpu.render;
    gpu.render = () => {}; let clock = performance.now();
    a.previousFrameTimestampMs = null; a.fixedStepLoop.reset();
    try { a.renderFrame(clock); cancelAnimationFrame(a.frameId);
      for (let i = 0; i < ticks; i++) {
        const s = a.simulation.getFrameState();
        if (pilot && i % 12 === 0) {
          const n = s.enemies.reduce((n, e) => !n || e.z < n.z ? e : n, null);
          const lane = s.grenade?.supply?.lane ?? n?.lane ?? s.player.selectedLane;
          if (lane !== s.player.selectedLane) a.simulation.stepLane(lane < s.player.selectedLane ? -1 : 1);
        }
        clock += 1000 / 60; a.renderFrame(clock); cancelAnimationFrame(a.frameId);
      }
    } finally { gpu.render = native; }
    return a.simulation.getState();
  }, { ticks, pilot });
  const snapshot = async () => page.evaluate(() => window.__testApp.simulation.getState());
  const continueGame = async () => { await page.getByRole('button', { name: '繼續上次遊戲' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started'); await stopFrames();
    // Paint the restored paused state before capturing HUD/battlefield evidence.
    await page.evaluate(() => { const a = window.__testApp; a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId); });
    assert(await page.getByRole('button', { name: 'Resume game', exact: true }).isVisible()); };
  await load(); await start(); await advance(200);
  const introSafe = await page.evaluate(() => {
    const fps = document.querySelector('.dev-fps').getBoundingClientRect();
    const portrait = document.querySelector('.field-observer img,.field-observer .observer-fallback').getBoundingClientRect();
    return { visible: !document.querySelector('.field-observer').hidden, fpsBottom: fps.bottom, portraitTop: portrait.top };
  }); assert(introSafe.visible && introSafe.fpsBottom < introSafe.portraitTop, JSON.stringify(introSafe));
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stopFrames();
  const regular = await snapshot(); await page.reload(); await page.waitForFunction(() => window.__testApp?.running);
  await continueGame(); assert.deepEqual(await snapshot(), regular);
  await page.getByRole('button', { name: 'Resume game', exact: true }).tap(); await stopFrames();
  await ahead(); await advance(1800);
  await page.evaluate(() => document.querySelector('.beachhead-defense').style.setProperty('--hud-inset-bottom', '34px'));
  // Sample real RAF rather than synthetic fixed-step ticks for the visible counter.
  await page.evaluate(() => { const a = window.__testApp; a.previousFrameTimestampMs = null; a.frameId = requestAnimationFrame(a.renderFrame); });
  await page.waitForTimeout(1100); await stopFrames();
  const fps = await page.locator('.dev-fps').textContent(); assert.match(fps, /^FPS \d+$/);
  const boxes = await page.evaluate(() => {
    const names = ['.dev-fps', '.tuning-panel > summary', '.pause-button', '.battle-info', '.combat-control-strip'];
    return names.map(selector => { const r = document.querySelector(selector).getBoundingClientRect();
      return { selector, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; });
  });
  for (const b of boxes) assert(b.x >= 0 && b.right <= width + .1, JSON.stringify(b));
  const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y);
  assert(!overlap(boxes[0], boxes[1]) && !overlap(boxes[0], boxes[2]));
  await page.screenshot({ path: `${out}/${width}-fps-ahead10.png` });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stopFrames();
  const paused = await snapshot(), diagnostics = await page.evaluate(() => window.__testApp.lifecycle);
  assert.equal(await page.locator('.dev-fps').textContent(), 'PAUSED');
  await page.reload(); await page.waitForFunction(() => window.__testApp?.running);
  await page.screenshot({ path: `${out}/${width}-continue.png` });
  await continueGame(); assert.deepEqual(await snapshot(), paused);
  await page.screenshot({ path: `${out}/${width}-restored-ahead10.png` });
  assert.equal(await page.evaluate(() => window.__testApp.devReviewFixture), 'survival10-ahead');
  const initial = await page.evaluate(() => window.__testApp.lifecycle.initial);
  assert.equal(initial.navigation, 'reload'); assert.equal(initial.checkpoint, 'valid'); assert.equal(initial.previousPaused, true);
  // Full application Restore must not emit intro, level-up/acquisition or old shot cues.
  const presentation = await page.evaluate(() => {
    const a = window.__testApp, cues = [], original = a.audio.play;
    a.audio.play = cue => cues.push(cue); a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId); a.audio.play = original;
    const liveGiants = a.simulation.getFrameState().enemies.filter(e => e.archetype === 'giant');
    const giantsSettled = liveGiants.every(e => a.renderer.enemyRenderer.giantRenderers.find(slot => slot.id === e.id)?.barVisible(a.presentationMs));
    return { cues, giantsSettled, intro: a.fieldObserver.missionTimeline.active, acquired: document.querySelector('.grenade-button').classList.contains('grenade-acquired'),
      selected: [...document.querySelectorAll('.dev-survival-test [aria-pressed=true]')].map(e => e.textContent) };
  });
  assert.deepEqual(presentation.cues, []); assert(presentation.giantsSettled); assert.equal(presentation.intro, false); assert.equal(presentation.acquired, false);
  assert.deepEqual(presentation.selected, ['AHEAD', 'LV10']);
  // Save grenade in flight, damaged enemy and real Giant/Supply clocks; compare exact future states.
  await page.getByRole('button', { name: 'Resume game', exact: true }).tap(); await stopFrames();
  await page.evaluate(() => window.__testApp.requestGrenade()); await advance(8);
  const flight = await snapshot(); assert(flight.grenade.flight);
  assert(flight.enemies.some(e => e.archetype === 'heavy' && e.hp < flight.catharsis.balance.heavyHp));
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stopFrames(); const savedFlight = await snapshot();
  const expected = await page.evaluate(async () => {
    const a = window.__testApp, { readCheckpoint, simulationFromCheckpoint } = await import('/src/app/SessionCheckpoint.ts');
    const sim = simulationFromCheckpoint(readCheckpoint().checkpoint), c = a.config, r = a.runtimeTuning;
    const tuning = { ...c.player, moveSpeed: r.moveSpeed, forwardSpeed: r.forwardSpeed, trackHalfWidth: c.track.halfWidth,
      defenseLineOffset: c.track.defenseLineOffset, normalEnemyRadius: c.tiers.normalEnemyRadius, bossRadius: c.bosses.basic.radius,
      rifle: { ...c.weapon.rifle, fireRate: r.fireRate, projectileSpeed: r.bulletSpeed, range: r.bulletRange }, rocket: c.weapon.rocket };
    for (let i = 0; i < 240; i++) sim.step(1 / 60, { targetX: savedX() }, tuning);
    function savedX() { return a.simulation.getFrameState().player.x; }
    return { state: sim.getState(), tuning };
  });
  await page.reload(); await page.waitForFunction(() => window.__testApp?.running); await continueGame();
  assert.deepEqual(await snapshot(), savedFlight);
  const actual = await page.evaluate(({ tuning }) => { const a = window.__testApp, x = a.simulation.getFrameState().player.x;
    for (let i = 0; i < 240; i++) a.simulation.step(1 / 60, { targetX: x }, tuning); return a.simulation.getState(); }, expected);
  assert.deepEqual(actual, expected.state);
  // Hidden/visible and pagehide/pageshow same-page events: paused identity, no catch-up or held input.
  const lifecycle = await page.evaluate(async () => {
    const a = window.__testApp, sim = a.simulation;
    a.togglePaused(); a.grenadeRequested = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
    const before = JSON.stringify(sim.getState()); a.renderFrame(1e9); cancelAnimationFrame(a.frameId);
    if (!a.paused || a.grenadeRequested || JSON.stringify(sim.getState()) !== before) throw Error('Hidden advanced or held input persisted');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.dispatchEvent(new Event('freeze')); document.dispatchEvent(new Event('resume'));
    if (a.simulation !== sim || !a.paused || a.previousFrameTimestampMs !== null) throw Error('Same-page lifecycle reset run or timing');
    return { state: sim.getState(), diagnostics: a.lifecycle };
  });
  await page.reload(); await page.waitForFunction(() => window.__testApp?.running); await continueGame(); assert.deepEqual(await snapshot(), lifecycle.state);
  // Running -> hidden -> reload separately, plus real Chromium freeze/active (not Android discard).
  await page.getByRole('button', { name: 'Resume game', exact: true }).tap(); await stopFrames(); await advance(30);
  const hidden = await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); return window.__testApp.simulation.getState(); });
  await page.reload(); await page.waitForFunction(() => window.__testApp?.running); await continueGame(); assert.deepEqual(await snapshot(), hidden);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  assert(await page.evaluate(() => window.__testApp.paused));
  const beforeContext = await snapshot();
  await page.evaluate(() => { window.__contextExtension = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__contextExtension.loseContext(); });
  await page.waitForFunction(() => window.__testApp.contextLost);
  await page.evaluate(() => window.__contextExtension.restoreContext());
  await page.waitForFunction(() => !window.__testApp.contextLost); assert.deepEqual(await snapshot(), beforeContext);
  // Retry invalidates old run, retains fixture; New Game removes saved run and returns to real Start.
  await page.evaluate(() => window.__testApp.retry()); await stopFrames();
  assert.equal(await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev')), null);
  assert.equal(await page.evaluate(() => window.__testApp.devReviewFixture), 'survival10-ahead');
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stopFrames();
  await page.reload(); await page.waitForFunction(() => window.__testApp?.running);
  await page.getByRole('button', { name: '重新開始' }).tap(); assert.equal(await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev')), null);
  await start(); assert.equal((await snapshot()).progression.level, 1);
  // Invalid records offer a fresh game, never a failing Continue.
  for (const bad of ['{', JSON.stringify({ version: 999 })]) {
    await page.evaluate(bad => { window.__testApp.stop(); localStorage.setItem('topwar:session:v1:dev', bad); }, bad);
    await page.reload(); await page.waitForFunction(() => window.__testApp?.running);
    assert.equal(await page.getByRole('button', { name: '繼續上次遊戲' }).count(), 0);
    await page.getByRole('button', { name: '重新開始' }).tap(); await start();
  }
  // No storage / quota failures: gameplay stays alive and Pause shows a truthful notice.
  const failures = await page.evaluate(() => {
    const a = window.__testApp, original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    a.togglePaused(); Storage.prototype.setItem = original;
    const notice = document.querySelector('.checkpoint-notice').textContent;
    return { paused: a.paused, notice, alive: a.running };
  }); assert(failures.paused && failures.alive && failures.notice);
  await page.evaluate(() => { const a = window.__testApp; a.togglePaused(); a.retry(); cancelAnimationFrame(a.frameId); });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stopFrames();
  await page.evaluate(() => { const a = window.__testApp, s = a.simulation.getState();
    s.squad.count = 0; s.squad.rifleCounts = []; s.squad.rifleRemainder = 0; s.squad.rocketCount = 0;
    s.weapons.rifleMemberCooldowns = []; a.simulation.restoreState(s); a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId); });
  assert.equal(await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev')), null);
  assert.deepEqual(errors, []);
  results.push({ width, fps, boxes, introSafe, regularReload: true, pausedTick: paused.tick, savedEnemies: paused.enemies.length,
    manualReload: true, flightSnapshot: true, hiddenReload: true, samePageIdentity: true,
    freezeResume: true, webglRestore: true, retryNewGame: true, corruptionQuotaGameOver: true,
    diagnostics, initial, lifecycle: lifecycle.diagnostics, presentation, errors });
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await context.close();
  const denied = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await denied.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
  const blockedPage = await denied.newPage(), blockedErrors = [];
  blockedPage.on('pageerror', e => blockedErrors.push(e.message)); await blockedPage.goto('http://127.0.0.1:5175/');
  await blockedPage.getByRole('button', { name: 'Start game with audio' }).tap();
  await blockedPage.getByRole('button', { name: 'Pause game', exact: true }).tap();
  assert(await blockedPage.locator('.checkpoint-notice').isVisible()); assert.deepEqual(blockedErrors, []);
  results.at(-1).unavailableStorage = true; writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await denied.close();
  const legacyPage = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await legacyPage.route(/\/game-data\/game\.json$/, async route => {
    const response = await route.fetch(), data = await response.json(); delete data.catharsis; await route.fulfill({ response, json: data });
  });
  await legacyPage.goto('http://127.0.0.1:5175/'); await legacyPage.getByRole('button', { name: 'Start game with audio' }).tap();
  const legacyClear = await legacyPage.evaluate(() => {
    const fps = document.querySelector('.dev-fps').getBoundingClientRect(), tier = document.querySelector('.tier-hud').getBoundingClientRect(),
      actions = document.querySelector('.hud-actions').getBoundingClientRect();
    const overlap = b => Math.min(fps.right, b.right) > Math.max(fps.left, b.left) && Math.min(fps.bottom, b.bottom) > Math.max(fps.top, b.top);
    return !overlap(tier) && !overlap(actions);
  }); assert(legacyClear); await legacyPage.screenshot({ path: `${out}/${width}-fps-legacy.png` }); await legacyPage.close();
  results.at(-1).legacyFpsClear = true; writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`Resume/FPS mobile QA passed ${width}`);
} } finally { await browser.close(); }

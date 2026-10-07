import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/combat-hud'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const report = { portraits: {}, fixtures: [], errors: [] };
const assert = (ok, message) => { if (!ok) throw Error(message); };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
  });
  await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
  await page.waitForSelector('.game-start-overlay');
  await page.keyboard.press('q'); await page.keyboard.press('4');
  assert(await page.locator('.game-start-overlay').isVisible(), 'Q/DEV shortcuts preserve Tap-to-Start');
  assert(await page.locator('.enemy-vfx-lab').isHidden(), 'No permanent DEV fixture stack');
  await page.screenshot({ path: `${out}/start-390.png` });
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0;
    window.__advance = ms => { for (let t = 0; t < ms; t += 20) {
      window.__clock += Math.min(20, ms - t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
    } };
  });
  const advance = ms => page.evaluate(ms => window.__advance(ms), ms);
  const state = () => page.evaluate(() => window.__testApp.simulation.getState());
  const capture = async name => {
    // Manual simulation ticks do not advance CSS time; let the existing XP reveal settle.
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  const boxes = () => page.evaluate(() => {
    const selectors = ['.grenade-button', '.battle-info', '.xp-hud', '.build-label', '.pause-button', '.tuning-panel > summary'];
    return Object.fromEntries(selectors.map(selector => {
      const e = document.querySelector(selector), r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return [selector, { x: r.x, y: r.y, width: r.width, height: r.height,
        background: s.backgroundColor, pointerEvents: s.pointerEvents, display: s.display }];
    }));
  });
  // All fixture actions still reset exactly; the disclosure returns focus and closes.
  for (const role of ['grunt', 'heavy', 'giant', 'grenade', 'curve', 'evolve', 'machineGun']) {
    await selectDevFixture(page, role); const first = await state();
    assert(await page.locator('.enemy-vfx-lab').isHidden(), `${role}: menu auto-closes`);
    await selectDevFixture(page, role);
    assert(JSON.stringify(await state()) === JSON.stringify(first), `${role}: exact deterministic reset`);
    report.fixtures.push({ role, level: first.progression.level, enemies: first.enemies.length });
  }
  for (const width of [390, 350]) {
    await page.setViewportSize({ width, height: 844 });
    await selectDevFixture(page, 'grenade'); await advance(40);
    const before = await state(), b = await boxes();
    assert(b['.grenade-button'].y > 350 && b['.grenade-button'].y + b['.grenade-button'].height < 600, 'Left-middle skill, clear of lower movement space');
    assert(b['.battle-info'].x > width / 2 && b['.battle-info'].pointerEvents === 'none', 'Right-middle info passes lane taps');
    assert(await page.locator('.battle-identity > span').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 9), 'Stage label remains readable at narrow width');
    assert(b['.pause-button'].background !== 'rgba(0, 0, 0, 0)' && b['.pause-button'].width >= 44, 'Visible Pause surface and touch target');
    await capture(`grenade-ready-${width}`);
    await page.getByRole('button', { name: 'Pause game' }).click(); await advance(100);
    assert(await page.locator('.grenade-button').isDisabled(), 'Paused skill disabled');
    await page.keyboard.press('q'); await advance(100);
    assert((await state()).grenade.inventory === 1, 'Pause blocks Q');
    await capture(`paused-${width}`);
    await page.getByRole('button', { name: 'Resume game' }).click(); await advance(40);
    await page.locator('.tuning-panel > summary').click();
    await capture(`dev-menu-${width}`);
    const lane = (await state()).player.selectedLane;
    await page.locator('.tuning-panel input').first().focus(); await page.keyboard.press('q');
    assert(!await page.evaluate(() => window.__testApp.grenadeRequested), 'DEV focus blocks Q');
    await page.keyboard.press('Escape');
    assert(await page.locator('.enemy-vfx-lab').isHidden(), 'Escape closes DEV menu');
    assert((await state()).player.selectedLane === lane, 'Menu does not steer');
    if (width === 390) await page.keyboard.press('q'); else await page.locator('.grenade-button').tap();
    await advance(760);
    const after = await state();
    assert(after.grenade.inventory === 0 && after.player.selectedLane === before.player.selectedLane, 'Q/button share activation and isolate lane input');
    assert(after.enemies.length < before.enemies.length, 'Normal grenade kill path');
    assert(await page.locator('.grenade-status').textContent() === 'EMPTY', 'Readable empty state');
    await capture(`grenade-empty-${width}`);
    await page.keyboard.press('5');
    // Review both side panels together, including a legally held charge carried into MG.
    await page.evaluate(() => {
      const a = window.__testApp, s = a.simulation.getState();
      s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0,
        inventory: 1, supply: null, flight: null };
      a.simulation.restoreState(s);
    });
    await advance(40);
    assert((await state()).progression.level === 5, 'Physical 5 / Lv5 Rifle');
    assert(await page.locator('.battle-identity strong').textContent() === 'RIFLE', 'Rifle info');
    assert(await page.locator('.battle-metrics strong').allTextContents().then(values => values.join(',') === '13.5,3'), 'Three living Rifles / total rate');
    await capture(`rifle-lv5-${width}`);
    await advance(2500);
    assert((await state()).progression.level === 6, 'Real XP evolution');
    assert((await state()).grenade.inventory === 1, 'Held charge remains visible across evolution');
    assert(await page.locator('.battle-identity strong').textContent() === 'MG', 'MG info replacement');
    assert(await page.locator('.battle-metrics strong').allTextContents().then(values => values.join(',') === '18,1'), 'One MG / total rate');
    await capture(`evolved-lv6-${width}`);
    await page.keyboard.press('6'); await advance(300); await capture(`mg-lv6-${width}`);
    await page.keyboard.press('4'); await advance(40);
    assert((await state()).progression.level === 4, 'Physical 4 / CURVE');
    await selectDevFixture(page, 'giant'); await advance(2000); await capture(`giant-${width}`);
    report.portraits[width] = { boxes: b, grenadeKills: before.enemies.length - after.enemies.length, realEvolution: true };
  }
  // Synthetic notch/home-indicator insets, independent of desktop env() values.
  await selectDevFixture(page, 'grenade'); await advance(40);
  await page.evaluate(() => {
    const v = document.querySelector('#game-viewport');
    for (const [edge, value] of Object.entries({ top: 28, left: 18, right: 18, bottom: 24 }))
      v.style.setProperty(`--hud-inset-${edge}`, `${value}px`);
  });
  const inset = await boxes();
  for (const [selector, b] of Object.entries(inset)) {
    assert(b.x >= 18 && b.x + b.width <= 350 - 18 && b.y >= 28 && b.y + b.height <= 844 - 24,
      `${selector}: inside synthetic safe area`);
  }
  report.syntheticSafeArea = inset; await capture('safe-area-350');
  assert(!report.errors.length, report.errors.join('\n'));
  writeFileSync(`${out}/combat-hud-sanity.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ widths: Object.keys(report.portraits), fixtureResets: report.fixtures.length, errors: report.errors }));
} finally { await browser.close(); }

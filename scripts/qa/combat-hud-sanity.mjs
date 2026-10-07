import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/combat-hud'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const report = { portraits: {}, fixtures: [], upgrades: [], errors: [] };
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
    const selectors = ['.grenade-button', '.battle-info', '.combat-control-strip', '.xp-hud', '.movement-left', '.movement-right', '.build-label', '.pause-button', '.tuning-panel > summary'];
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
    // Presentation review snapshots use ordinary authored stages; combat upgrades below use real kills.
    for (const [level, weaponStage, squadStage] of [[1,1,null],[2,2,null],[3,3,null],[4,3,2],[5,3,3]]) {
      await selectDevFixture(page, 'grenade');
      await page.evaluate(level => {
        const a = window.__testApp, s = a.simulation.getState(), count = Math.max(1, level - 2);
        s.progression = { level, xp: 0 }; s.squad = { count, rocketCount: 0, rifleCounts: [count], rifleRemainder: 0 };
        s.weapons.rifleMemberCooldowns = Array(count).fill(100); s.projectiles = [];
        a.simulation.restoreState(s); a.progressionObserver.observe(level); a.battleInfo.reset();
      }, level); await advance(40);
      assert(await page.locator('.battle-weapon-pips .is-filled').count() === weaponStage, `Lv${level}: authored cartridge pips`);
      assert(await page.locator('.battle-squad-pips').isHidden() === (squadStage === null), `Lv${level}: optional squad emphasis`);
      if (squadStage) assert(await page.locator('.battle-squad-pips .is-filled').count() === squadStage, `Lv${level}: unlocked squad pips`);
      await capture(`rifle-lv${level}-${width}`);
      if (level === 5) {
        await page.evaluate(() => {
          const a = window.__testApp, s = a.simulation.getState(); s.squad.count = 1; s.squad.rifleCounts = [1];
          s.weapons.rifleMemberCooldowns = [100]; a.simulation.restoreState(s);
        }); await advance(40);
        assert(await page.locator('.battle-squad-pips .is-filled').count() === 3, 'Casualty does not erase permanent squad unlocks');
      }
    }
    await selectDevFixture(page, 'grenade'); await advance(40);
    const before = await state(), b = await boxes();
    for (const selector of ['.grenade-button', '.battle-info']) {
      assert(b[selector].y > 844 * .75 && b[selector].y + b[selector].height <= b['.combat-control-strip'].y - 14,
        `${selector}: lower battlefield, separated from movement/XP strip`);
    }
    assert(Math.abs(b['.grenade-button'].x - b['.movement-left'].x) < 1, 'Grenade aligned above left movement');
    assert(Math.abs(b['.battle-info'].x + b['.battle-info'].width - b['.movement-right'].x - b['.movement-right'].width) < 1, 'Telemetry aligned above right movement');
    assert(b['.battle-info'].x > width / 2 && b['.battle-info'].pointerEvents === 'none' && b['.battle-info'].background === 'rgba(0, 0, 0, 0)', 'Transparent passive telemetry');
    assert((await page.locator('.battle-info').textContent()).trim() === '', 'No visible weapon/stage/rate/living labels');
    assert((await page.locator('.grenade-button').textContent()).trim() === '1', 'Grenade contains only icon and charge');
    assert(b['.pause-button'].background !== 'rgba(0, 0, 0, 0)' && b['.pause-button'].width >= 44, 'Visible Pause surface and touch target');
    await capture(`grenade-ready-${width}`);
    await page.evaluate(() => {
      const a = window.__testApp, s = a.simulation.getState(); window.__savedEnemies = s.enemies;
      s.enemies = []; a.simulation.restoreState(s);
    }); await advance(40); await page.keyboard.press('q'); await advance(40);
    assert(await page.locator('.grenade-button').isDisabled() && (await state()).grenade.inventory === 1, 'Unavailable with no target preserves charge');
    assert(await page.locator('.grenade-button').evaluate(e => getComputedStyle(e).animationName === 'none'), 'Unavailable charge has no ready glow');
    await capture(`grenade-unavailable-${width}`);
    await page.evaluate(() => {
      const a = window.__testApp, s = a.simulation.getState(); s.enemies = window.__savedEnemies; a.simulation.restoreState(s);
    }); await advance(40);
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
    assert(await page.locator('.grenade-button strong').textContent() === '0' && await page.locator('.grenade-button').isDisabled(), 'Readable empty charge and disabled state');
    assert(await page.locator('.grenade-button').evaluate(e => e.classList.contains('grenade-empty') && getComputedStyle(e).animationName === 'none'), 'Empty is subdued without ready glow');
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
    assert(await page.locator('.battle-info').getAttribute('data-weapon-family') === 'rifle', 'Rifle silhouette identity');
    assert(await page.locator('.battle-weapon-pips .is-filled').count() === 3 && await page.locator('.battle-squad-pips .is-filled').count() === 3, 'Rifle stage 3 and unlocked squad stage 3');
    await capture(`rifle-lv5-${width}`);
    while ((await state()).progression.level === 5) await advance(20);
    assert((await state()).progression.level === 6, 'Real XP evolution');
    assert((await state()).grenade.inventory === 1, 'Held charge remains visible across evolution');
    assert(await page.locator('.battle-info').getAttribute('data-weapon-family') === 'machineGun', 'MG silhouette replacement');
    assert(await page.locator('.battle-weapon-pips .is-filled').count() === 1 && await page.locator('.battle-squad-pips').isHidden(), 'MG stage 1, no redundant squad row');
    assert(await page.locator('.battle-weapon-icon').evaluate(e => e.classList.contains('weapon-evolution')), 'Real evolution pulses the changed silhouette');
    await page.getByRole('button', { name: 'Pause game' }).click(); await advance(40);
    assert(await page.locator('.battle-weapon-icon').evaluate(e => getComputedStyle(e).animationPlayState === 'paused'), 'Pause freezes evolution animation');
    await page.getByRole('button', { name: 'Resume game' }).click(); await advance(140);
    await page.evaluate(() => document.activeElement.blur()); // DEV keys intentionally ignore focused system buttons.
    await capture(`mg-evolution-${width}`);
    await advance(1500);
    await capture(`evolved-lv6-${width}`);
    await page.keyboard.press('6'); await advance(300); await capture(`mg-lv6-${width}`);
    await page.keyboard.press('4'); await advance(40);
    assert((await state()).progression.level === 4, 'Physical 4 / CURVE');
    await selectDevFixture(page, 'giant'); await advance(2000); await capture(`giant-${width}`);
    for (const fromLevel of [1,2,3,4]) {
      await selectDevFixture(page, 'grenade');
      await page.evaluate(level => {
        const a = window.__testApp, s = a.simulation.getState(), count = Math.max(1, level - 2);
        s.progression = { level, xp: s.catharsis.balance.progression.xpRequirements[level - 1] - 1 };
        s.squad = { count, rocketCount: 0, rifleCounts: [count], rifleRemainder: 0 };
        s.weapons.rifleMemberCooldowns = Array(count).fill(0); s.projectiles = [];
        s.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: s.player.z + 8, hp: 1 }];
        s.enemyStream.nextEnemyId = 2; a.simulation.restoreState(s);
        a.battleInfo.reset(); a.progressionObserver.observe(level);
      }, fromLevel); await advance(40);
      while ((await state()).progression.level === fromLevel) await advance(20);
      const expected = fromLevel <= 2 ? `.battle-weapon-pips .xp-pip:nth-child(${fromLevel + 1})` : `.battle-squad-pips .xp-pip:nth-child(${fromLevel - 1})`;
      assert(await page.locator('.battle-info .is-upgraded').count() === 1 && await page.locator(expected).evaluate(e => e.classList.contains('is-upgraded')), `Lv${fromLevel + 1}: only newly filled pip animates`);
      assert(await page.locator('.battle-weapon-icon').evaluate(e => !e.classList.contains('weapon-evolution')), 'Stage upgrade does not animate weapon family');
      await capture(`upgrade-lv${fromLevel + 1}-${width}`); await advance(600);
      assert(await page.locator('.battle-info .is-upgraded').count() === 0, 'Pip pulse expires without timers');
      report.upgrades.push({ width, fromLevel, toLevel: fromLevel + 1, newPip: expected });
    }
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

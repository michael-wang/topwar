import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = {};
for (const mode of ['default', 'normal', 'review']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
  });
  await page.goto(`${process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173'}/${mode === 'review' ? '?review=threats' : mode === 'normal' ? '?review=normal' : ''}`);
  await page.waitForFunction(() => window.__testApp?.simulation.getState().tick > 0);
  const sample = () => page.evaluate(() => {
    const a = window.__testApp, s = a.simulation.getState();
    return { level: s.progression.level, xp: s.progression.xp, elapsed: s.elapsedSeconds, seed: s.seed,
      count: s.squad.count, arrived: s.reinforcement.arrived, lane: s.player.selectedLane,
      roles: s.enemies.map(e => e.archetype), nextShot: s.weapons.nextProjectileId };
  });
  const opening = await sample();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `artifacts/coastal-r3/${process.argv[2] ?? 'prototype'}-live-${mode}.png` });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); const right = await sample();
  await page.touchscreen.tap(80, 600); await page.waitForTimeout(250); const left = await sample();
  await page.keyboard.press('p'); const paused = await page.evaluate(() => window.__testApp.paused);
  await page.keyboard.press('p'); const resumed = await page.evaluate(() => !window.__testApp.paused);
  // Present the actual Retry button; no production state/logic changes.
  await page.evaluate(() => {
    const sim = window.__testApp.simulation, state = sim.getState();
    state.squad = { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 };
    state.weapons.rifleMemberCooldowns = []; sim.restoreState(state);
  });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  const retry = await sample();
  const checks = { correctLevel: opening.level === (mode !== 'normal' ? 7 : 1),
    correctSquad: opening.count === (mode !== 'normal' ? 2 : 1),
    roles: mode === 'normal' ? !opening.roles.includes('giant') : ['grunt', 'heavy', 'giant'].every(r => opening.roles.includes(r)),
    reinforcement: opening.arrived === (mode !== 'normal'), keyboard: right.lane === opening.lane + 1,
    touch: left.lane === opening.lane, combat: left.nextShot > opening.nextShot,
    pauseResume: paused && resumed, retry: retry.level === opening.level && retry.count === opening.count
      && (mode === 'normal' || (retry.seed === opening.seed && ['grunt', 'heavy', 'giant'].every(r => retry.roles.includes(r)))),
    noErrors: errors.length === 0 };
  results[mode] = { opening, right, left, retry, checks, errors };
  await page.close();
}
writeFileSync(`artifacts/coastal-r3/${process.argv[2] ?? 'prototype'}-live-sanity.json`, JSON.stringify(results, null, 2));
await browser.close();
if (!Object.values(results).every(r => Object.values(r.checks).every(Boolean))) throw new Error(JSON.stringify(results));

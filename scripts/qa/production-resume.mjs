import { exposeProductionApp } from './production-app-hook.mjs';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? 'artifacts/p3b6b3a/production-resume'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const server = await preview({ preview: { host: '127.0.0.1', port: 5186, strictPort: true } });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of [350, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await exposeProductionApp(page);
  await page.goto('http://127.0.0.1:5186/topwar/'); await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  assert.equal(await page.locator('.dev-fps,.dev-wake-status,.qa-panel,.dev-advanced,.dev-survival-test').count(), 0);
  const saved = await page.evaluate(() => {
    const a = window.__testApp, c = a.config, r = a.runtimeTuning;
    const tuning = { ...c.player, forwardSpeed: r.forwardSpeed, trackHalfWidth: c.track.halfWidth,
      defenseLineOffset: c.track.defenseLineOffset, normalEnemyRadius: c.tiers.normalEnemyRadius,
      bossRadius: c.bosses.basic.radius, rifle: c.weapon.rifle, rocket: c.weapon.rocket };
    for (let i = 0; i < 180; i++) a.simulation.step(1 / 60, { targetX: 0 }, tuning);
    return { state: a.simulation.getState(), tuning };
  });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const text = await page.evaluate(() => localStorage.getItem('topwar:session:v1:release')); assert(text);
  await page.reload(); await page.locator('.session-recovery button').first().waitFor();
  await page.getByRole('button', { name: '繼續上次遊戲' }).tap();
  await page.locator('.session-recovery').waitFor({ state: 'detached' });
  await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  assert.deepEqual(await page.evaluate(() => window.__testApp.simulation.getState()), saved.state);
  assert(await page.evaluate(() => window.__testApp.paused && window.__testApp.lifecycle === null && window.__testApp.fps === null));
  assert.equal(await page.locator('.dev-fps,.qa-panel,.dev-survival-test').count(), 0);
  const identical = await page.evaluate(({ state, tuning }) => {
    const sim = window.__testApp.simulation, canonical = value => JSON.stringify(value);
    for (let i = 0; i < 120; i++) sim.step(1 / 60, { targetX: 0 }, tuning);
    const first = canonical(sim.getState()); sim.restoreState(state);
    for (let i = 0; i < 120; i++) sim.step(1 / 60, { targetX: 0 }, tuning);
    return first === canonical(sim.getState());
  }, saved); assert(identical);
  await page.evaluate(() => window.__testApp.retry()); assert.equal(await page.evaluate(() => localStorage.getItem('topwar:session:v1:release')), null);
  assert.deepEqual(errors, []); results.push({ width, restored: true, paused: true, identical, devExcluded: true, characters: text.length, errors });
  await page.close();
} } finally { writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); await new Promise(r => server.httpServer.close(r)); }

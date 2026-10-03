// Actual running game: no fixture or gameplay overrides.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = [], shots = new Set();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
});
await page.goto('http://127.0.0.1:5173/');
await page.waitForFunction(() => window.__testApp?.simulation.getState().elapsedSeconds > 3);
const sample = () => page.evaluate(() => {
  const a = window.__testApp, s = a.simulation.getState();
  return { elapsedSeconds: s.elapsedSeconds, lane: s.player.selectedLane, count: s.squad.count,
    shots: s.projectiles.map(p => p.id), stats: a.renderer.getDebugStats() };
});
const before = await sample();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(250);
const right = await sample();
await page.touchscreen.tap(80, 1200 / 2);
await page.waitForTimeout(250);
const left = await sample();
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(250);
  const state = await sample(); for (const id of state.shots) shots.add(id);
}
await page.screenshot({ path: 'artifacts/player-chibi-prototype/live-sanity.png' });
const end = await sample();
await page.keyboard.press('p');
const paused = await page.evaluate(() => window.__testApp.paused);
await page.keyboard.press('p');
const resumed = await page.evaluate(() => !window.__testApp.paused);
const result = { errors, before, right, left, end, shotsObserved: shots.size, paused, resumed,
  checks: { keyboardLane: right.lane === before.lane + 1, touchLane: left.lane === before.lane,
    simulationAdvanced: end.elapsedSeconds > before.elapsedSeconds, firing: shots.size > 0,
    pauseResume: paused && resumed, noErrors: errors.length === 0 } };
writeFileSync('artifacts/player-chibi-prototype/live-sanity.json', JSON.stringify(result, null, 2));
await browser.close();
if (!Object.values(result.checks).every(Boolean)) throw new Error(JSON.stringify(result.checks));

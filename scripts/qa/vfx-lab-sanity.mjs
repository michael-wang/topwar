import { selectDevFixture } from './dev-fixture-controls.mjs';
// Reusable app-level fixture/reset QA. No shipping debug endpoint or dependency.
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/sanity'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [], result = { fixtures: {}, switches: [] };
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
});
const assert = (ok, message) => { if (!ok) throw Error(message); };
try {
  const url = process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173';
  await page.goto(url); await page.waitForSelector('.game-start-overlay');
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => { const a = window.__testApp; cancelAnimationFrame(a.frameId); a.retry(); });
  // Drive the real app clock deterministically and cancel its scheduled RAF.
  // The ordinary fixed-step simulation and all render/reset owners stay active.
  await page.evaluate(() => {
    window.__advance = milliseconds => {
      const a = window.__testApp; a.running = true;
      for (let t = 0; t <= milliseconds; t += 100) {
        a.renderFrame(t); cancelAnimationFrame(a.frameId);
      }
    };
    window.__advance(0);
  });
  const sample = () => page.evaluate(() => {
    const a = window.__testApp;
    return { state: a.simulation.getState(), salt: a.vfxLabVisualSalt,
      hud: Number(document.querySelector('.xp-level-number').textContent),
      stats: a.renderer.getDebugStats(),
      stains: a.renderer.scene.getObjectByName('enemy-ground-blood-stains').count,
      hits: a.renderer.scene.getObjectByName('enemy-hit-blood').count,
      blood: ['grunt', 'heavy', 'giant'].map(r => a.renderer.scene.getObjectByName('enemy-3d-blood-' + r).count),
      dust: a.renderer.scene.getObjectByName('giant-death-impact-dust').visible };
  });
  const clear = s => !s.stains && !s.hits && !s.blood.some(Boolean) && !s.dust
    && s.stats.enemies.deathVisuals === 0 && s.state.projectiles.length === 0;
  result.normalLevel = (await sample()).state.progression.level;
  assert(result.normalLevel === 1, 'Normal root must remain Lv1');
  for (const [role, level, soldiers, count] of [['grunt', 1, 1, 10], ['heavy', 3, 1, 3], ['giant', 5, 3, 1]]) {
    await selectDevFixture(page, role);
    const initial = await sample();
    assert(initial.state.progression.level === level && initial.hud === level
      && initial.state.squad.count === soldiers && initial.state.enemies.length === count, role + ' loadout');
    assert(clear(initial), role + ' switch residue');
    await page.evaluate(() => window.__advance(35000));
    const final = await sample();
    assert(final.state.enemies.length === 0 && final.stains === count, role + ' combat/stains');
    await page.evaluate(() => window.__testApp.retry());
    const retry = await sample();
    assert(JSON.stringify(retry.state) === JSON.stringify(initial.state) && clear(retry), role + ' Retry');
    result.fixtures[role] = { initial, final, retry };
    await page.evaluate(() => window.__advance(0));
    await page.screenshot({ path: `${out}/lab-${role}-390.png` });
  }
  // Warm every role batch, then repeated switches must not grow GPU ownership.
  for (let cycle = 0; cycle < 3; cycle++) for (const role of ['grunt', 'heavy', 'giant']) {
    await selectDevFixture(page, role);
    const switched = await sample(); assert(clear(switched), 'Repeated switch residue');
    await page.evaluate(() => window.__advance(35000));
    const end = await sample(); result.switches.push({ cycle, role, salt: switched.salt, geometries: end.stats.geometries, textures: end.stats.textures });
  }
  for (const role of ['grunt', 'heavy', 'giant']) {
    const samples = result.switches.filter(s => s.role === role);
    assert(samples.every(s => s.geometries === samples[0].geometries && s.textures === samples[0].textures), role + ' resource growth');
  }
  await page.setViewportSize({ width: 350, height: 844 });
  await page.evaluate(() => window.__testApp.renderer.startResizeHandling());
  await page.screenshot({ path: `${out}/lab-350.png` });
  await page.goto(url + '/?review=threats'); await page.waitForSelector('.game-start-overlay');
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => { const a = window.__testApp; cancelAnimationFrame(a.frameId); a.retry(); });
  await page.evaluate(() => {
    const a = window.__testApp; a.running = true;
    // Preserve the existing threat-review badge intro; inspect after its first 120ms.
    for (const t of [0, 200]) { a.renderFrame(t); cancelAnimationFrame(a.frameId); }
  });
  result.threat = await sample();
  assert(result.threat.state.progression.level === 5 && result.threat.hud === 5
    && ['grunt', 'heavy', 'giant'].every(r => result.threat.state.enemies.some(e => e.archetype === r)), 'Separate threat review');
  assert(errors.length === 0, errors.join('\n')); result.errors = errors;
  writeFileSync(`${out}/vfx-lab-sanity.json`, JSON.stringify(result, null, 2));
} finally { await browser.close(); }

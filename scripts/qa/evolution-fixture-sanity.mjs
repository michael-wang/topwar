import { selectDevFixture } from './dev-fixture-controls.mjs';
// Test-only fixtures use ordinary simulation; removed keys remain inert.
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/evolve-review';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const results = { portraits: {}, cycles: [], errors: [] };
const assert = (ok, message) => { if (!ok) throw Error(message); };
page.on('pageerror', e => results.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') results.errors.push(m.text()); });
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', `window.__testApp=app;
      window.__cues=[];const play=app.audio.play.bind(app.audio);app.audio.play=(...args)=>{window.__cues.push(args[0]);return play(...args)};app.start();`) });
  });
  await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
  await page.waitForSelector('.game-start-overlay');
  await page.keyboard.press('5'); await page.keyboard.press('6');
  assert(await page.evaluate(() => window.__testApp.devReviewFixture === null && window.__testApp.simulation.getState().progression.level === 1), 'Pre-start shortcuts ignored');
  assert(await page.locator('.dev-review-controls button').count() === 4, 'Four DEV review controls');
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0;
    window.__advance = ms => { for (let t = 0; t < ms; t += 20) {
      window.__clock += Math.min(20, ms - t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
    } };
  });
  const sample = () => page.evaluate(() => {
    const a = window.__testApp;
    return { state: a.simulation.getState(), role: a.devReviewFixture,
      stats: a.renderer.getDebugStats(), weapon: document.querySelector('.xp-loadout')?.dataset.weaponFamily,
      levelUp: document.querySelector('.xp-hud')?.classList.contains('level-up'), cues: window.__cues };
  });
  const click = role => selectDevFixture(page, role);
  const advance = ms => page.evaluate(ms => window.__advance(ms), ms);
  let evolveInitial, mgInitial;
  for (const width of [390, 350]) {
    await page.setViewportSize({ width, height: 844 });
    await click('evolve'); const before = await sample();
    evolveInitial ??= before.state;
    assert(JSON.stringify(before.state) === JSON.stringify(evolveInitial), 'Exact EVOLVE reset');
    assert(before.state.progression.level === 5 && before.state.progression.xp === 210 && before.state.squad.count === 3, 'Lv5 / 210 / three Rifles');
    assert(before.state.enemies.length === 20 && before.state.enemies.filter(e => e.archetype === 'heavy').length === 2, '18 Grunts / two Heavies');
    assert(before.state.player.selectedLane === 2 && !before.state.boss && before.state.grenade.inventory === 0, 'Center / no Boss / no Grenade dependency');
    await advance(300); await page.screenshot({ path: `${out}/evolve-before-${width}.png` });
    await page.evaluate(() => { window.__cues = []; });
    let evolved;
    for (let i = 0; i < 150; i++) {
      await advance(20); evolved = await sample();
      if (evolved.state.progression.level === 6) break;
    }
    const seconds = evolved.state.elapsedSeconds;
    assert(evolved.state.progression.level === 6 && seconds >= 1 && seconds <= 3, 'Natural kill XP evolves within 1–3 seconds');
    assert(evolved.state.squad.count === 1 && evolved.weapon === 'machineGun' && evolved.levelUp, 'One specialist / MG HUD / level-up');
    assert(evolved.state.enemies.filter(e => e.archetype === 'grunt' && e.id <= 18).length === 8, 'Ten ordinary Grunt kills');
    assert(!evolved.cues.some(c => c === 'damage' || c === 'fatal'), 'No transformation damage feedback');
    await page.screenshot({ path: `${out}/evolve-unlock-${width}.png` });
    await advance(200); const firing = await sample();
    assert(firing.state.projectiles.some(p => p.kind === 'machineGun'), 'First MG shots');
    await page.screenshot({ path: `${out}/evolve-mg-${width}.png` });
    results.portraits[width] = { evolutionSeconds: seconds, rifleBefore: 3, specialistAfter: 1, ordinaryKillsToUnlock: 10, weapon: evolved.weapon };
    await selectDevFixture(page, 'machineGun'); const mg = await sample(); mgInitial ??= mg.state;
    assert(JSON.stringify(mg.state) === JSON.stringify(mgInitial), 'QA MG restarts exact MG fixture');
    assert(mg.state.enemies.filter(e => e.archetype === 'grunt').length === 60 && mg.state.enemies.filter(e => e.archetype === 'heavy').length === 5, 'MG 60/5 crowd');
    assert(new Set(mg.state.enemies.map(e => e.lane)).size === 5 && !mg.state.boss && !mg.state.enemies.some(e => e.archetype === 'giant'), 'MG five lanes / no Giant or Boss');
    await advance(3200); const cleared = await sample();
    assert(!cleared.state.enemies.some(e => e.lane === 2), 'MG clears center Grunts and Heavy');
    await page.keyboard.press('p'); const frozen = (await sample()).state;
    await advance(500); assert(JSON.stringify((await sample()).state) === JSON.stringify(frozen), 'Pause freezes fixture');
    await page.keyboard.press('p');
    await selectDevFixture(page, 'machineGun'); assert(JSON.stringify((await sample()).state) === JSON.stringify(mgInitial), 'Repeated QA MG resets');
    await selectDevFixture(page, 'evolve'); assert(JSON.stringify((await sample()).state) === JSON.stringify(evolveInitial), 'QA EVOLVE returns to exact EVOLVE');
    await page.evaluate(() => window.__testApp.retry());
    assert(JSON.stringify((await sample()).state) === JSON.stringify(evolveInitial), 'Retry preserves EVOLVE');
  }
  // Guard tests start from an advanced MG fixture, making any reset observable.
  await click('machineGun'); await advance(400); const guarded = (await sample()).state;
  await page.evaluate(() => {
    for (const code of ['Digit5', 'Digit6']) window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat: true }));
  });
  assert(JSON.stringify((await sample()).state) === JSON.stringify(guarded), 'Key repeats ignored');
  for (const tag of ['input', 'select', 'textarea', 'button', 'editable', 'tune']) {
    await page.evaluate(tag => {
      const root = document.createElement('div'); root.id = '__focusGuard';
      if (tag === 'tune') root.className = 'tuning-panel';
      const node = document.createElement(tag === 'editable' || tag === 'tune' ? 'div' : tag);
      if (tag === 'editable') node.contentEditable = 'true'; else node.tabIndex = 0;
      root.append(node); document.body.append(root); node.focus();
    }, tag);
    await page.keyboard.press('5'); await page.keyboard.press('6');
    assert(JSON.stringify((await sample()).state) === JSON.stringify(guarded), `${tag} focus ignores shortcuts`);
    await page.evaluate(() => document.querySelector('#__focusGuard').remove());
  }
  // Warm the two disposable weapon presentations, then alternate repeatedly.
  for (let i = 0; i < 6; i++) {
    await selectDevFixture(page, 'evolve'); await advance(1500);
    await selectDevFixture(page, 'machineGun'); await advance(3200);
    const { stats } = await sample();
    results.cycles.push({ geometries: stats.geometries, textures: stats.textures, projectilePool: stats.projectiles.pool });
  }
  assert(results.cycles.slice(1).every(c => JSON.stringify(c) === JSON.stringify(results.cycles[1])), 'Bounded repeated reset resources');
  assert(!results.errors.length, results.errors.join('\n'));
  writeFileSync(`${out}/browser.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }

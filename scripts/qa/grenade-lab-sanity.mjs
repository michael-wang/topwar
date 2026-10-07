import { selectDevFixture } from './dev-fixture-controls.mjs';
// Actual DEV fixture/button/Q paths. No altered HP, firing, damage or XP.
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/p15-radius4'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], result = { portraits: {}, cycles: [] };
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const assert = (ok, message) => { if (!ok) throw Error(message); };
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
  });
  await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
  await page.waitForSelector('.game-start-overlay');
  await page.keyboard.press('q');
  assert(await page.locator('.game-start-overlay').isVisible(), 'Q cannot start gameplay');
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0; window.__blasts = [];
    window.__observe = () => {
      const sim = a.simulation, original = sim.consumeGrenadeEvents.bind(sim);
      sim.consumeGrenadeEvents = () => { const events = original(); window.__blasts.push(...events); return events; };
    };
    window.__advance = ms => {
      for (let t = 0; t < ms; t += 20) {
        window.__clock += Math.min(20, ms - t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
      }
    };
  });
  const sample = () => page.evaluate(() => ({ state: window.__testApp.simulation.getState(),
    stats: window.__testApp.renderer.getDebugStats(), events: window.__blasts,
    focus: document.activeElement?.tagName }));
  const reset = async () => {
    await selectDevFixture(page, 'grenade');
    await page.evaluate(() => { window.__blasts = []; window.__observe(); });
    const s = await sample();
    assert(s.state.progression.level === 3 && s.state.squad.count === 1 && s.state.player.selectedLane === 2, 'Grenade loadout');
    assert(s.state.grenade.inventory === 1 && !s.state.grenade.supply, 'Fresh held charge');
    assert(s.state.enemies.filter(e => e.archetype === 'grunt').length === 45
      && s.state.enemies.filter(e => e.archetype === 'heavy').length === 3, '45/3 fixture');
    assert(s.focus !== 'BUTTON', 'Fixture returns focus for Q');
    return s;
  };
  let initial;
  for (const width of [390, 350]) {
    await page.setViewportSize({ width, height: 844 });
    const resetState = await reset(); initial ??= resetState.state;
    assert(JSON.stringify(resetState.state) === JSON.stringify(initial), 'Deterministic reset');
    await page.evaluate(() => { window.__testApp.renderer.resize(); window.__advance(340); });
    const before = await sample();
    await page.screenshot({ path: `${out}/grenade-before-${width}.png` });
    if (width === 390) {
      await page.keyboard.press('p');await page.keyboard.press('q');
      await page.evaluate(() => window.__advance(800));
      const paused = await sample(); assert(paused.state.grenade.inventory === 1 && !paused.state.grenade.flight, 'Pause blocks Q');
      await page.keyboard.press('p');
      await page.locator('.tuning-panel summary').click();
      await page.locator('.tuning-panel input').first().focus();
      await page.keyboard.press('q');
      assert(!(await page.evaluate(() => window.__testApp.grenadeRequested)), 'TUNE focus blocks Q');
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.activeElement?.blur());
    }
    if (width === 390) await page.keyboard.press('q');
    else await page.locator('.grenade-button').tap();
    // Pause clears the RAF baseline, so allow its first zero-delta frame too.
    await page.evaluate(() => window.__advance(700));
    const immediate = await sample();
    const blast = immediate.events.find(e => e.kind === 'grenadeDetonated');
    assert(blast && blast.radius === 4, 'Authoritative radius-four blast');
    assert(immediate.state.grenade.inventory === 0 && immediate.state.player.selectedLane === 2, 'Shared request, one charge, no lane tap');
    const gruntKills = blast.victims.filter(v => v.archetype === 'grunt' && v.killed).length;
    const xp = blast.victims.reduce((sum, v) => sum + v.killXp, 0);
    // P2B prioritizes the nearest emergency; it need not maximize this lab's kills.
    assert(gruntKills > 0, 'Nearest-cluster throw clears ordinary Grunts');
    assert(immediate.state.progression.xp === 45 - immediate.state.enemies.filter(e => e.archetype === 'grunt').length,
      'Ordinary XP for all removed Grunts, including concurrent Rifle kills');
    for (const victim of blast.victims.filter(v => v.archetype === 'heavy'))
      assert(victim.damage === 9 && !victim.killed, 'Full-health Heavy still survives');
    await page.evaluate(() => window.__advance(80));
    await page.screenshot({ path: `${out}/grenade-blast-${width}.png` });
    await page.evaluate(() => window.__advance(1000));
    const after = await sample();
    await page.screenshot({ path: `${out}/grenade-after-${width}.png` });
    await page.keyboard.press('q');await page.evaluate(() => window.__advance(100));
    assert((await sample()).events.filter(e => e.kind === 'grenadeDetonated').length === 1, 'Empty charge cannot throw again');
    result.portraits[width] = { before, immediate, after, gruntKills, xp,
      otherKillXpDuringFlight: immediate.state.progression.xp - before.state.progression.xp - xp,
      fractionOfInitialGrunts: gruntKills / 45, heavyHp: immediate.state.enemies.filter(e => e.archetype === 'heavy').map(e => ({id:e.id,hp:e.hp})) };
  }
  for (let cycle = 0; cycle < 5; cycle++) {
    const s = await reset(); assert(JSON.stringify(s.state) === JSON.stringify(initial), 'Repeated crowd reset');
    await page.evaluate(() => window.__advance(340));
    const before = await sample();await page.keyboard.press('q');
    await page.evaluate(() => window.__advance(1800));const after = await sample();
    result.cycles.push({ cycle, before: { geometries: before.stats.geometries, textures: before.stats.textures },
      after: { geometries: after.stats.geometries, textures: after.stats.textures }, dustCapacity: after.stats.grenade.dustCapacity });
  }
  assert(result.cycles.every(c => c.before.geometries === c.after.geometries
    && c.after.geometries === result.cycles[0].after.geometries
    && c.before.textures === c.after.textures && c.after.textures === result.cycles[0].after.textures
    && c.dustCapacity === 16), 'Bounded repeated explosions');
  result.errors = errors;assert(!errors.length, errors.join('\n'));
  writeFileSync(`${out}/grenade-lab.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result.portraits).map(([width,r]) =>
    [width, {gruntKills:r.gruntKills,xp:r.xp,heavyHp:r.heavyHp,fraction:r.fractionOfInitialGrunts}]))));
} finally { await browser.close(); }

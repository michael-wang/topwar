import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/p2b'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const report = { portraits: {}, resources: [], errors: [] };
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
  await page.getByRole('button', { name: 'Start game with audio' }).click();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0;
    window.__advance = ms => { for (let t = 0; t < ms; t += 20) {
      window.__clock += Math.min(20, ms - t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
    } };
    window.__fixture = () => {
      a.devReviewFixture = null; a.retry(); const s = a.simulation.getState();
      s.progression = { level: 3, xp: 0 }; s.player.selectedLane = 4; s.player.x = 2.8;
      s.squad = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
      s.weapons.rifleCooldownRemainingSeconds = 100; s.weapons.rifleMemberCooldowns = [100];
      s.projectiles = []; s.enemyStream.nextRowIndex = 10000; s.enemyStream.nextEnemyId = 35;
      s.boss = null; s.giantEncounter = { scheduledAtSeconds: null, spawned: false };
      s.grenade = { lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0, acquiredAtSeconds: 0, inventory: 1, supply: null, flight: null };
      s.enemies = [
        { id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -2.8, z: 2.5, hp: 1 },
        { id: 2, tier: 1, archetype: 'grunt', lane: 1, x: -1.4, z: 3, hp: 1 },
        { id: 3, tier: 1, archetype: 'grunt', lane: 0, x: -2.8, z: 3.5, hp: 1 },
        { id: 4, tier: 1, archetype: 'heavy', lane: 1, x: -1.4, z: 4, hp: 15 },
        ...Array.from({ length: 30 }, (_, i) => ({ id: 5 + i, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 14 + i * .02, hp: 1 })),
      ];
      a.simulation.restoreState(s); a.previousDefenseValue = 1n; a.progressionObserver.observe(3);
      window.__events = []; const consume = a.simulation.consumeGrenadeEvents.bind(a.simulation);
      a.simulation.consumeGrenadeEvents = () => { const events = consume(); window.__events.push(...events); return events; };
      window.__advance(40);
    };
  });
  const advance = ms => page.evaluate(ms => window.__advance(ms), ms);
  const sample = () => page.evaluate(() => ({ state: window.__testApp.simulation.getState(),
    events: window.__events, stats: window.__testApp.renderer.getDebugStats() }));
  for (const width of [390, 350]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.__fixture());
    const before = await sample();
    assert(await page.locator('.grenade-button').isEnabled(), 'Empty selected lane allows global Grenade');
    await page.screenshot({ path: `${out}/emergency-before-${width}.png` });
    await page.keyboard.press('p'); await page.keyboard.press('q'); await advance(100);
    assert((await sample()).state.grenade.inventory === 1, 'Pause blocks Q'); await page.keyboard.press('p');
    // Manual RAF must refresh the HUD after unpausing before a real button tap.
    await advance(40); const atActivation=await sample();
    if (width === 390) await page.keyboard.press('q'); else await page.locator('.grenade-button').tap();
    await advance(80); const flight = (await sample()).state.grenade.flight;
    assert(flight && Math.abs(flight.targetX + 2.1) < 1e-9, 'Near unweighted centroid captured');
    assert(Math.abs(flight.targetZ - (atActivation.state.enemies.slice(0,4).reduce((sum,e)=>sum+e.z,0)/4)) < 1e-9, 'Ordinary Z centroid');
    await advance(700); const after = await sample();
    const blast = after.events.find(e => e.kind === 'grenadeDetonated');
    assert(blast && blast.victims.map(v => v.id).join(',') === '1,2,3,4', 'Near emergency targeted instead of dense far cluster');
    assert(after.state.enemies.filter(e => e.id >= 5).length === 30, 'Distant Grunts preserved');
    assert(after.state.enemies.find(e => e.id === 4).hp === 6 && after.state.progression.xp === 3, 'Normal 9 HP damage / three ordinary XP');
    assert(after.state.player.selectedLane === 4, 'Q/button does not change lane');
    await page.screenshot({ path: `${out}/emergency-blast-${width}.png` });
    await advance(1000); await page.screenshot({ path: `${out}/emergency-after-${width}.png` });
    report.portraits[width] = { kills: 3, ordinaryXp: 3, heavyHp: 6, farGrunts: 30, target: {x:flight.targetX,z:flight.targetZ} };
    // Capture an authoritative flight, restore it, then compare exact continuation.
    await page.evaluate(() => window.__fixture()); await page.keyboard.press('q'); await advance(100);
    assert(await page.evaluate(async () => {
      const a=window.__testApp,{Simulation}=await import('/src/simulation/Simulation.ts');
      const {pilotTuning}=await import('/scripts/qa/p15Pilot.ts');
      const {default:level}=await import('/public/game-data/levels/level-001.json?import');
      const snapshot=JSON.parse(JSON.stringify(a.simulation.getState()));
      const clone=new Simulation({seed:snapshot.seed,level,startSquad:1,startRocketCount:0,
        tiers:a.config.tiers,catharsis:snapshot.catharsis});
      clone.restoreState(snapshot);
      for(let i=0;i<60;i++) {a.simulation.step(1/60,{targetX:0},pilotTuning);clone.step(1/60,{targetX:0},pilotTuning);}
      return JSON.stringify(a.simulation.getState())===JSON.stringify(clone.getState());
    }), 'Captured emergency flight restores deterministically');
    await page.evaluate(() => window.__testApp.retry());
    assert((await sample()).state.progression.level === 1, 'Normal Retry restores Lv1');
  }
  for(let i=0;i<5;i++) {
    await page.evaluate(() => window.__fixture()); await page.keyboard.press('q'); await advance(1800);
    const {stats}=await sample(); report.resources.push({geometries:stats.geometries,textures:stats.textures,dustCapacity:stats.grenade.dustCapacity});
  }
  assert(report.resources.every(r=>JSON.stringify(r)===JSON.stringify(report.resources[0])), 'Bounded repeated emergency explosions');
  assert(!report.errors.length,report.errors.join('\n'));
  writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }

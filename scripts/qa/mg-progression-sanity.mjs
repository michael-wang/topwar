// Test-side app hook only; no shipping debug API or new gameplay fixture.
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/stage1-p1';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = { portraits: {}, errors: [] };
const assert = (value, message) => { if (!value) throw Error(message); };
try {
  for (const width of [390, 350]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', e => results.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') results.errors.push(m.text()); });
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('app.start();',
        'window.__testApp=app;app.start();') });
    });
    await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
    await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started');
    await page.evaluate(() => {
      const a = window.__testApp;
      cancelAnimationFrame(a.frameId); window.__clock = 0; a.retry();
      window.__cues = [];
      const play = a.audio.play.bind(a.audio);
      a.audio.play = (...args) => { window.__cues.push(args[0]); return play(...args); };
      window.__advance = ms => {
        for (let t = 0; t < ms; t += 20) {
          window.__clock += Math.min(20, ms - t);
          a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
        }
      };
      const state = a.simulation.getState(); state.progression = { level: 5, xp: 219 };
      state.squad = { count: 3, rifleCounts: [3], rocketCount: 0, rifleRemainder: 0 };
      state.weapons.rifleCooldownRemainingSeconds = .1; state.weapons.rifleMemberCooldowns = [.1, .15, .2];
      state.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
      state.grenade = { ...state.grenade, lv3EnteredAtSeconds: 0, supplySpawnedAtSeconds: 0,
        acquiredAtSeconds: 0, inventory: 3 };
      a.simulation.restoreState(state); a.previousDefenseValue = 3n;
      a.progressionObserver.observe(5); window.__advance(20);
    });
    const records = [];
    for (const level of [6, 7, 8]) {
      // One real ordinary Grunt kill earns each boundary; the existing crowd,
      // combat configuration, level-up observer and presentation remain active.
      await page.evaluate(level => {
        const a = window.__testApp, s = a.simulation.getState();
        s.progression.xp = s.catharsis.balance.progression.xpRequirements[level - 2] - 1;
        const id = s.enemyStream.nextEnemyId++;
        s.enemies.push({ id, tier: 1, archetype: 'grunt', lane: s.player.selectedLane, x: s.player.x, z: s.player.z + 3, hp: 1 });
        s.projectiles.push({ id: s.weapons.nextProjectileId++, kind: level === 6 ? 'rifle' : 'machineGun', tier: 1,
          memberIndex: 0, lane: s.player.selectedLane, slopeX: 0, x: s.player.x, z: s.player.z + 2.5,
          speed: 60, damage: 3, remainingRange: 80, blastRadius: 0, hitRadiusBonus: 0, penetrationRemaining: 0 });
        a.simulation.restoreState(s); window.__cues = []; window.__advance(200);
      }, level);
      await page.screenshot({ path: `${out}/${width}-lv${level}-upgrade.png` });
      await page.evaluate(() => window.__advance(1000));
      const record = await page.evaluate(() => {
        const a = window.__testApp, s = a.simulation.getState();
        const members = a.renderer.squadRenderer.members.filter(m => m.group.visible);
        const boxes = ['.grenade-button', '.battle-info', '.movement-left', '.movement-right', '.xp-hud']
          .map(selector => { const r = document.querySelector(selector).getBoundingClientRect();
            return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom }; });
        return { level: s.progression.level, count: s.squad.count, clocks: s.weapons.rifleMemberCooldowns,
          visible: members.length, models: members.map(m => m.rifle.name), firedAt: members.map(m => m.lastFiredAtMs),
          weapon: document.querySelector('.battle-info').dataset.weaponFamily,
          squadPips: document.querySelectorAll('.battle-squad-pips .is-filled').length,
          squadRowHidden: document.querySelector('.battle-squad-pips').hidden,
          cartridgePips: document.querySelectorAll('.battle-weapon-pips .is-filled').length,
          maxBar: document.querySelector('.xp-hud').classList.contains('xp-complete'),
          legacy: s.reinforcement, assault: s.landingAssault.startedAtSeconds,
          release: s.machineGunReleaseAtSeconds, cues: window.__cues, boxes,
          stats: a.renderer.getDebugStats() };
      });
      assert(record.level === level && record.count === level - 5 && record.visible === level - 5, `Lv${level} real/rendered members`);
      assert(record.clocks.length === record.count && record.models.every(m => m === 'toy-machine-gun'), 'Independent MG members');
      assert(record.firedAt.every(Number.isFinite), 'Every member has firing feedback');
      assert(record.weapon === 'machineGun' && record.cartridgePips === 1, 'MG weapon HUD');
      assert(level === 6 ? record.squadRowHidden : !record.squadRowHidden && record.squadPips === level - 5, 'MG squad HUD');
      assert(record.maxBar === (level === 8), 'XP caps only at Lv8');
      assert(!record.legacy.arrived && record.legacy.startedAtSeconds === null && record.assault === null, 'No legacy rewards/assault');
      assert(record.release !== null && (!records.length || record.release === records[0].release), 'Single Lv6 release');
      assert(record.cues.includes('levelUp') && record.cues.includes('machineGun') && !record.cues.includes('damage') && !record.cues.includes('fatal'), 'Upgrade/firing audio');
      for (const b of record.boxes) assert(b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= 844, `HUD bounds: ${b.selector}`);
      for (let i = 0; i < record.boxes.length; i++) for (let j = i + 1; j < record.boxes.length; j++) {
        const a = record.boxes[i], b = record.boxes[j];
        assert(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `HUD overlap ${a.selector}/${b.selector}`);
      }
      await page.screenshot({ path: `${out}/${width}-lv${level}-firing.png` }); records.push(record);
    }
    await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
    const frozen = await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState()));
    await page.evaluate(() => window.__advance(1000));
    assert(await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState())) === frozen, 'Lv8 Pause');
    await page.getByRole('button', { name: 'Resume game', exact: true }).tap();
    await page.getByRole('button', { name: 'Move left', exact: true }).tap();
    await page.evaluate(() => window.__advance(200));
    assert(await page.evaluate(() => window.__testApp.simulation.getState().player.selectedLane) === 1, 'Touch lane after Pause');
    const replay = await page.evaluate(async () => {
      const a = window.__testApp, { pilotTuning } = await import('/scripts/qa/p15Pilot.ts');
      const saved = JSON.parse(JSON.stringify(a.simulation.getState()));
      const advance = () => { for (let i = 0; i < 120; i++) a.simulation.step(1 / 60, { targetX: 0 }, pilotTuning); };
      advance(); const expected = JSON.stringify(a.simulation.getState());
      a.simulation.restoreState(saved); advance(); return expected === JSON.stringify(a.simulation.getState());
    });
    assert(replay, 'Lv8 deterministic snapshot continuation');
    await page.evaluate(() => { window.__testApp.retry(); window.__advance(100); });
    assert(await page.evaluate(() => {
      const a = window.__testApp, s = a.simulation.getState();
      return s.progression.level === 1 && s.squad.count === 1 && a.renderer.getDebugStats().visibleSquad === 1
        && s.machineGunReleaseAtSeconds === null && document.querySelector('.battle-info').dataset.weaponFamily === 'rifle';
    }), 'Retry resets Lv8 simulation/render/HUD');
    results.portraits[width] = { stages: records, pause: true, touch: true, snapshotReplay: replay, retry: true };
    await page.close();
  }
  assert(results.errors.length === 0, results.errors.join('\n'));
  console.log(JSON.stringify({ passed: true, widths: Object.keys(results.portraits), errors: results.errors }));
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}

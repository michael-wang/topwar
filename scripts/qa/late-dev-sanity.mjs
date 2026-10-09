// Real DEV menu paths; the app observation hook exists only in this QA response.
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/stage1-p1-late'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { portraits: {}, errors: [] }, assert = (ok, message) => { if (!ok) throw Error(message); };
try {
  for (const width of [390, 350]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
      const response = await route.fetch(); await route.fulfill({ response,
        body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
    });
    await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
    await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started');
    await page.evaluate(() => {
      const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0;
      const gpu = a.renderer.renderer, draw = gpu.render.bind(gpu);
      gpu.render = (...args) => { if (!window.__skipDraw) draw(...args); };
      window.__key = (key, code) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
      };
      window.__advance = (ms, pilot = false) => {
        window.__skipDraw = true;
        try { for (let t = 0; t < ms; t += 100) {
          const s = a.simulation.getState();
          if (pilot && s.squad.count) {
            const nearest = [...s.enemies].sort((a,b) => a.z-b.z || a.id-b.id)[0];
            const giant = s.enemies.find(e => e.archetype === 'giant');
            const threat = giant && (!nearest || nearest.z-s.player.z > 10) ? giant : nearest;
            const lane = s.grenade.supply?.lane ?? threat?.lane ?? s.player.selectedLane;
            if (lane !== s.player.selectedLane) window.__key(lane < s.player.selectedLane ? 'a' : 'd', lane < s.player.selectedLane ? 'KeyA' : 'KeyD');
            if (Math.floor(s.elapsedSeconds * 10) % 100 === 0) window.__key('q', 'KeyQ');
          }
          window.__clock += Math.min(100, ms-t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
        } } finally { window.__skipDraw = false; }
        a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
      };
    });
    const state = () => page.evaluate(() => window.__testApp.simulation.getState());
    const advance = (ms, pilot = false) => page.evaluate(({ ms, pilot }) => window.__advance(ms, pilot), { ms, pilot });
    await page.locator('.tuning-panel > summary').tap();
    const buttons = await page.locator('.dev-review-controls button').evaluateAll(bs => bs.map(b => {
      const r = b.getBoundingClientRect(); return { label: b.textContent, x:r.x, right:r.right, y:r.y, bottom:r.bottom, height:r.height };
    }));
    assert(buttons.map(b=>b.label).join(',') === 'GRENADE,CURVE,EVOLVE,MG,LATE,MG7,MG8', 'All seven entries');
    assert(buttons.every(b => b.x >= 0 && b.right <= width && b.y >= 0 && b.bottom <= 844 && b.height >= 44), 'Menu touch bounds');
    await page.screenshot({ path: `${out}/${width}-menu.png` });
    const runs = [];
    for (const [role, level, count] of [['late',6,1], ['mg7',7,2], ['mg8',8,3]]) {
      await selectDevFixture(page, role); const initial = await state();
      assert(initial.progression.level === level && initial.progression.xp === 0 && initial.squad.count === count, `${role} initial progression`);
      assert(initial.machineGunReleaseAtSeconds === 0 && initial.postCapSurvival.startedAtSeconds === 0, 'Consumed release/active scheduler');
      assert(await page.locator('.dev-review-controls').isHidden(), 'Selection closes DEV');
      await advance(1200);
      const visual = await page.evaluate(() => {
        const a = window.__testApp, members = a.renderer.squadRenderer.members.filter(m=>m.group.visible);
        const boxes = ['.grenade-button','.battle-info','.movement-left','.movement-right','.xp-hud'].map(selector => {
          const r = document.querySelector(selector).getBoundingClientRect(); return { selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom };
        });
        return { visible:members.length, models:members.map(m=>m.rifle.name), shots:members.map(m=>m.lastFiredAtMs),
          pips:document.querySelectorAll('.battle-squad-pips .is-filled').length,
          hidden:document.querySelector('.battle-squad-pips').hidden,
          max:document.querySelector('.xp-hud').classList.contains('xp-complete'), boxes };
      });
      assert(visual.visible === count && visual.models.every(m=>m==='toy-machine-gun') && visual.shots.every(Number.isFinite), 'Rendered firing MG members');
      assert(count === 1 ? visual.hidden : !visual.hidden && visual.pips === count, 'Squad HUD');
      assert(visual.max === (level === 8), 'Max XP HUD');
      for (const b of visual.boxes) assert(b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= 844, 'HUD bounds');
      for (const [i,a] of visual.boxes.entries()) for (const b of visual.boxes.slice(i+1))
        assert(a.right<=b.x || b.right<=a.x || a.bottom<=b.y || b.bottom<=a.y, 'HUD overlap');
      await page.screenshot({ path: `${out}/${width}-${role}-firing.png` });
      await page.getByRole('button',{name:'Pause game',exact:true}).tap();
      const frozen = await state(); await advance(500);
      assert(JSON.stringify(await state()) === JSON.stringify(frozen), `${role} Pause`);
      await page.getByRole('button',{name:'Resume game',exact:true}).tap();
      // Resume changes state immediately; the manually driven next frame updates
      // button availability, and a target must enter the ordinary throw range.
      for (let i = 0; i < 150 && !await page.locator('.grenade-button').isEnabled(); i++) await advance(100);
      await page.locator('.grenade-button').tap(); await advance(200);
      assert((await state()).grenade.inventory === 2, 'Real touch Grenade consumption');
      const levels = new Set([level]);
      for (let seconds = 0; seconds < 150; seconds++) {
        await advance(1000, true); const s = await state(); levels.add(s.progression.level);
        assert(s.squad.count > 0 && s.machineGunReleaseAtSeconds === 0 && !s.reinforcement.arrived
          && s.landingAssault.reinforcementActiveAtSeconds === null, 'Playable survival, no duplicate release/legacy reward');
      }
      const end = await state();
      assert(end.progression.level === 8 && end.squad.count === 3 && end.enemyStream.nextEnemyId > 70, 'Natural progress/spawning');
      assert(end.postCapSurvival.nextGiantAtSeconds > 150 && end.postCapSurvival.nextGrenadeSupplyAtSeconds > 150, 'Recurring opportunities');
      const replay = await page.evaluate(async () => {
        const a=window.__testApp, {pilotTuning}=await import('/scripts/qa/p15Pilot.ts');
        const saved=JSON.parse(JSON.stringify(a.simulation.getState()));
        const run=()=>{for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},pilotTuning);return JSON.stringify(a.simulation.getState());};
        const expected=run();a.simulation.restoreState(saved);return expected===run();
      });
      assert(replay, 'Snapshot replay');
      // Show the real Retry action from a validated defeated state.
      await page.evaluate(() => {
        const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rifleCounts:[],rocketCount:0,rifleRemainder:0};
        s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);window.__advance(100);
      });
      await page.getByRole('button',{name:'Retry',exact:true}).tap();
      assert(JSON.stringify(await state()) === JSON.stringify(initial), `${role} exact Retry`);
      runs.push({ role, level, count, visual, reached:[...levels], endLevel:end.progression.level,
        nextEnemyId:end.enemyStream.nextEnemyId, pause:true, retry:true, snapshotReplay:replay });
      console.log('Passed', width, role);
    }
    // Retry leaves focus on a button; shortcuts intentionally ignore that focus.
    await page.evaluate(() => document.activeElement?.blur());
    for (const [key, level] of [['4',4],['5',5],['6',6]]) {
      await page.keyboard.press(key); assert((await state()).progression.level === level, `Shortcut ${key}`);
    }
    assert((await state()).enemies.length === 65 && !(await state()).catharsis.balance.postCapSurvival.enabled, 'Original isolated MG unchanged');
    report.portraits[width] = { buttons, runs }; await page.close();
  }
  assert(report.errors.length === 0, report.errors.join('\n'));
  console.log('Late DEV browser validation passed at both portrait widths');
} finally { writeFileSync(`${out}/results.json`, JSON.stringify(report,null,2)); await browser.close(); }

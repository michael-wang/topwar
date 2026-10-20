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
  await page.goto('http://127.0.0.1:5186/topwar/'); await page.getByRole('button', { name: '開始遊戲' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.getByRole('button',{name:'跳過開場簡報，開始遊戲'}).tap();
  await page.waitForFunction(()=>!window.__testApp.invasion);
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
  await page.getByRole('button', { name: '暫停遊戲', exact: true }).tap();
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
  assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().enemies.length),16);assert.equal(await page.locator('.opening-alert').count(),0);
  // Resume via the real user gesture before probing audio (Continue intentionally stays suspended).
  await page.getByRole('button',{name:'暫停遊戲',exact:true}).tap();
  await page.locator('.hud-actions').getByRole('button',{name:'繼續遊戲',exact:true}).tap();
  // Release-path smoke: real Giant admission/voice, then terminal Defeat -> touch Retry.
  await page.evaluate(()=>{
    const a=window.__testApp;cancelAnimationFrame(a.frameId);let stamp=a.previousFrameTimestampMs??performance.now();
    window.__releaseAdvance=seconds=>{const gpu=a.renderer.renderer,draw=gpu.render;gpu.render=()=>{};try{for(let i=0;i<Math.ceil(seconds*60);i++){stamp+=1000/60;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);}}finally{gpu.render=draw;}a.renderFrame(stamp);cancelAnimationFrame(a.frameId);};
    const s=a.simulation.getState();s.progression={level:4,xp:0};s.squad={count:2,rifleCounts:[2],rocketCount:0,rifleRemainder:0};
    s.weapons.rifleMemberCooldowns=[0,0];s.giantEncounter={scheduledAtSeconds:0,spawned:false};a.simulation.restoreState(s);window.__releaseAdvance(.2);
  });
  assert(await page.evaluate(()=>window.__testApp.simulation.getFrameState().enemies.some(e=>e.archetype==='giant')));
  await page.waitForFunction(()=>window.__testApp.audio.radioDurationSeconds('zh-TW','giant')>4);
  await page.evaluate(()=>window.__releaseAdvance(.5));
  assert(await page.evaluate(()=>window.__testApp.fieldObserver.visibleCue?.message==='giant'));
  assert.equal(await page.locator('.commander-focus:not([hidden])').count(),1);
  await page.evaluate(()=>window.__releaseAdvance(4.6));
  assert.equal(await page.locator('.commander-focus:not([hidden])').count(),0);
  await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rifleCounts:[],rocketCount:0,rifleRemainder:0};s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);window.__releaseAdvance(1);});
  assert(await page.getByText('作戰失敗',{exact:true}).isVisible());
  await page.getByRole('button',{name:'再試一次',exact:true}).tap();
  assert(await page.evaluate(()=>window.__testApp.simulation.getState().squad.count===1&&!window.__testApp.invasion));
  assert.deepEqual(errors, []); results.push({ width, restored: true, paused: true, identical, giantVoiceAndFocus:true, defeatReplay:true, devExcluded: true, characters: text.length, errors });
  await page.close();
} } finally { writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); await new Promise(r => server.httpServer.close(r)); }

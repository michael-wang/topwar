// QA-only matched frozen-presentation comparison; no shipping instrumentation or quality changes.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b3c/performance'; mkdirSync(out, { recursive: true });
const baseline = 'ea6994470b6c8d6ab8e0eb6e9739362ddd17e047';
const files = ['src/main.ts', 'src/app/GameApp.ts', 'src/ui/SessionRecovery.ts', 'src/ui/GrenadeButton.ts', 'src/audio/GameAudio.ts', 'src/rendering/GrenadeRenderer.ts', 'src/simulation/grenade.ts', 'src/simulation/Simulation.ts', 'src/style.css'];
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const results = [], browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try { for (const phase of ['before', 'after']) {
  const server = await createServer({ cacheDir: `${out}/${phase}-cache`, server: { host: '127.0.0.1', port: 5186, strictPort: true, watch: { ignored: ['**/artifacts/**'] } },
    plugins: [{ name: 'recovery-performance-baseline', enforce: 'pre', transform(source, id) {
      if (phase === 'before' && files.some(file => id.replaceAll('\\', '/').endsWith('/' + file))) return execFileSync('git', ['show', `${baseline}:${files.find(file => id.replaceAll('\\', '/').endsWith('/' + file))}`], { encoding: 'utf8' });
      return source;
    } }] }); await server.listen();
  try { for (const width of [350, 390]) for (const flight of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    // Cancel optional idle preparation consistently; warm the identical visible scene via RAF below.
    await page.addInitScript(() => { window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {}; });
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch(); await route.fulfill({ response: r,
      body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5186/?perf=1'); await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started');
    const setup = await page.evaluate(flight => {
      const a = window.__testApp; cancelAnimationFrame(a.frameId); a.renderer.preparation?.dispose();
      // Retry synchronously starts the same deterministic fixture before any RAF advance.
      a.devReviewFixture = 'survival10-ahead';
      a.retry(); cancelAnimationFrame(a.frameId);
      const c = a.config, r = a.runtimeTuning, tuning = { ...c.player, moveSpeed: r.moveSpeed, forwardSpeed: r.forwardSpeed,
        trackHalfWidth: c.track.halfWidth, defenseLineOffset: c.track.defenseLineOffset, normalEnemyRadius: c.tiers.normalEnemyRadius,
        bossRadius: c.bosses.basic.radius, rifle: { ...c.weapon.rifle, fireRate: r.fireRate, projectileSpeed: r.bulletSpeed, range: r.bulletRange }, rocket: c.weapon.rocket };
      let dense = a.simulation.getState();
      for (let i = 0; i < 1800; i++) { const s = a.simulation.getFrameState();
        if (s.squad.count && s.enemies.length > dense.enemies.length) dense = a.simulation.getState();
        a.simulation.step(1 / 60, { targetX: s.player.x }, tuning); if (!a.simulation.getFrameState().squad.count) break;
      }
      a.simulation.restoreState(dense);
      if(flight){for(let i=0;i<12;i++)a.simulation.step(1/60,{targetX:dense.player.x,...(i===0?{throwGrenade:true}:{})},tuning);dense=a.simulation.getState();}
      a.audio.restoreObservation(a.previousDefenseValue, dense.enemies, dense.streamRewards, dense.boss, dense.projectiles);
      a.simulation.consumePresentationEvents(); a.simulation.consumeArtilleryEvents(); a.simulation.consumeGrenadeEvents();
      // Hold an identical real crowd so frame cost is not confounded by different deaths/XP/timing.
      a.simulation.step = () => {}; a.presentationMs = dense.elapsedSeconds * 1000;
      a.previousFrameTimestampMs = null; a.fixedStepLoop.reset();
      window.__stamps = []; window.__submission = []; window.__measure = false;
      const native = a.renderFrame;
      a.renderFrame = stamp => { const at = performance.now(); native(stamp);
        if (window.__measure) { window.__stamps.push(stamp); window.__submission.push(performance.now() - at); } };
      a.frameId = requestAnimationFrame(a.renderFrame);
      window.__denseState=dense;
      return { enemies: dense.enemies.length, heavies: dense.enemies.filter(e => e.archetype === 'heavy').length, projectiles: dense.projectiles.length,
        tick: dense.tick, seconds: dense.elapsedSeconds, soldierCount: dense.squad.count };
    },flight);
    if(!flight){assert.equal(setup.enemies, 171); assert.equal(setup.projectiles, 100);}
    const state=await page.evaluate(()=>window.__denseState);const statePath=`${out}/${phase}-${width}-${flight?'flight':'idle'}-state.json`;writeFileSync(statePath,JSON.stringify(state));
    if(phase==='after'){const {readFileSync}=await import('node:fs');assert.deepEqual(state,JSON.parse(readFileSync(`${out}/before-${width}-${flight?'flight':'idle'}-state.json`)));}
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(async () => { await new Promise(resolve => { let frames = 0; requestAnimationFrame(function warm() { if (++frames < 60) requestAnimationFrame(warm); else resolve(); }); }); });
    for (let repeat = 0; repeat < 3; repeat++) {
      await page.evaluate(() => { window.__stamps = []; window.__submission = []; window.__measure = true; }); await page.waitForTimeout(5000);
      const data = await page.evaluate(() => {
        window.__measure = false; const a = window.__testApp;
        const summary = values => { const v = [...values].sort((a, b) => a - b); return { mean: v.reduce((a,b) => a+b,0)/v.length,
          p95: v[Math.floor(v.length*.95)], max: v.at(-1), frames: v.length, over100: v.filter(n => n>100).length, over200: v.filter(n => n>200).length }; };
        return { frames: summary(window.__stamps.slice(1).map((v,i) => v-window.__stamps[i])), submission: summary(window.__submission),
          calls: a.renderer.renderer.info.render.calls, triangles: a.renderer.renderer.info.render.triangles, stats: a.renderer.getDebugStats(), wake: a.wakeLock?.status ?? 'baseline-no-lock' };
      }); results.push({ phase, width, flight, repeat, setup, ...data }); writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ phase, width, flight, repeat, setup, ...data, stats: undefined }));
    }
    assert.deepEqual(errors, []); await page.close();
  } } finally { await server.close(); }
} } finally { await browser.close(); }

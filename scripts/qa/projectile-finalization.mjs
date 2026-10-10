// Actual shipping bundle, with test-side observation only, plus the normal DEV path.
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const out = process.argv[2] ?? 'artifacts/p3b34/visual'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const server = await preview({ preview: { host: '127.0.0.1', port: 5186, strictPort: true } });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const production of [false, true]) for (const width of [350, 390]) {
  const mode = production ? 'production' : 'dev';
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const native = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => a instanceof Uint32Array && a.length === 1 ? (a[0] = 17, a) : native(a); });
  if (production) await page.route(/\/topwar\/assets\/index-.*\.js$/, async route => {
    const response = await route.fetch(), body = await response.text();
    const pattern = /new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)\.start\(\)/g;
    assert.equal([...body.matchAll(pattern)].length, 1);
    await route.fulfill({ response, body: body.replace(pattern, m => `(window.__testApp=${m.slice(0, -8)}).start()`) });
  });
  else await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  await page.goto(production ? 'http://127.0.0.1:5186/topwar/' : 'http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  assert.equal(await page.locator('.dev-projectile-controls,[data-tracer]').count(), 0);
  if (production) assert.equal(await page.locator('.tuning-panel,.dev-review-controls').count(), 0);
  else {
    await page.locator('.tuning-panel > summary').tap();
    assert.deepEqual(await page.locator('.dev-review-controls button').allTextContents(), ['LATE', 'CRATE3', 'CRATE8', 'NAVAL']);
    for (const box of await page.locator('.dev-review-controls button').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return { x: r.x, right: r.right, bottom: r.bottom, height: r.height }; }))) {
      assert(box.x >= 0 && box.right <= width && box.bottom < 844 && box.height >= 44);
    }
    await page.screenshot({ path: `${out}/dev-menu-${width}.png` });
    await page.locator('.tuning-panel > summary').tap();
  }
  const stop = await startGameRecording(page, width);
  // Normal fresh Lv1 first, without fixture intervention or a level-up effect.
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/${mode}-lv1-${width}.png` });
  const sample = async () => page.evaluate(() => {
    const a = window.__testApp, p = a.renderer.projectileRenderer;
    return { level: a.simulation.getState().progression.level, core: p.tracerMaterial.color.getHexString(),
      edge: p.glowMaterial.color.getHexString(), positions: [...p.body.geometry.getAttribute('position').array],
      indices: [...p.body.geometry.index.array], stats: p.getDebugStats() };
  });
  const first = await sample(); assert.equal(first.level, 1); assert.equal(first.core, 'fff2ce'); assert.equal(first.edge, '080b10');
  assert.deepEqual(first.positions, [...new Float32Array([0,0,0,-.5,0,-.22,-.34,0,-.65,0,0,-1,.34,0,-.65,.5,0,-.22])]);
  assert.deepEqual(first.indices, [0,1,2,0,2,3,0,3,4,0,4,5]);
  await page.waitForTimeout(2800);
  const levels = [first];
  if (!production) {
    for (const [level, role] of [[3,'grenade'],[6,'machineGun'],[8,'mg8']]) {
      await selectDevFixture(page, role); await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${mode}-lv${level}-${width}.png` });
      const row = await sample(); assert.equal(row.level, level); assert.equal(row.core, 'fff2ce'); assert.equal(row.edge, '080b10'); levels.push(row);
      await page.waitForTimeout(1000);
    }
  }
  const recording = await stop(); writeFileSync(`${out}/${mode}-${width}.webm`, recording);
  // Freeze for strict no-step key and presentation comparisons.
  await page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  const saved = await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState()));
  for (const key of ['4','5','6']) await page.keyboard.press(key);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState())), saved);
  const stable = await page.evaluate(() => {
    const a = window.__testApp, r = a.renderer, p = r.projectileRenderer;
    const shots = [{ id:99999,kind:'rifle',tier:1,x:0,z:30,hitRadiusBonus:0 }];
    p.reset(); p.update(shots,0,r.camera,844); p.update(shots,100,r.camera,844);
    const geometry = p.body.geometry;
    const signature = () => JSON.stringify([p.tracerMaterial.color,p.glowMaterial.color,p.glowMaterial.blending,p.glowMaterial.opacity,[...p.body.instanceMatrix.array],[...p.glow.instanceMatrix.array]]);
    const before = signature(); r.presentLevelUp({kind:'progressionLevelUp',fromLevel:1,toLevel:2},100);
    p.update(shots,200,r.camera,844); const levelUp = signature() === before;
    const saved = a.simulation.getState(); a.simulation.restoreState(JSON.parse(JSON.stringify(saved))); r.resetFeedback();
    p.update(shots,0,r.camera,844); p.update(shots,100,r.camera,844); const snapshot = signature() === before && p.body.geometry === geometry;
    a.retry(); cancelAnimationFrame(a.frameId); p.update(shots,0,r.camera,844); p.update(shots,100,r.camera,844);
    return {levelUp,snapshot,retry:signature() === before && p.body.geometry === geometry};
  });
  assert.deepEqual(stable,{levelUp:true,snapshot:true,retry:true});
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  const paused = await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState()));
  await page.waitForTimeout(100); assert.equal(await page.evaluate(() => JSON.stringify(window.__testApp.simulation.getState())),paused);
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  if (!production) for (const role of ['late','crate3','crate8','naval']) {
    await selectDevFixture(page,role);
    assert.equal(await page.evaluate(() => window.__testApp.devReviewFixture),role);
    assert.equal(await page.locator(`.dev-review-controls [data-role="${role}"]`).getAttribute('aria-pressed'),'true');
  }
  assert.deepEqual(errors,[]); await page.close();
  await inspectRecordingFrames(browser,recording,width,`${out}/${mode}-${width}`,[2,4]);
  results.push({mode,width,levels,stable,removedKeysInert:true,recordingBytes:recording.length,errors});
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2)); console.log('P3 verified',mode,width);
} } finally { await browser.close(); await new Promise(r => server.httpServer.close(r)); }

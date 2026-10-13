import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase='after',out=process.argv[2]??'artifacts/qa/instant-recovery';
mkdirSync(out, { recursive: true });
const url=process.env.TOPWAR_QA_URL??'http://127.0.0.1:5175/';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of [350, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__marks = {};
    document.addEventListener('click',e=>{if(e.target.closest?.('.session-recovery button'))window.__marks.decision??=performance.now();},true);
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__marks.firstPaint = e.startTime; }).observe({ type: 'paint', buffered: true });
    new MutationObserver(() => {
      const m = window.__marks;
      if (!m.surface && document.querySelector('#session-recovery-loading')) m.surface = performance.now();
      if (!m.choice && [...document.querySelectorAll('.session-recovery button')].some(b => b.textContent === '繼續上次遊戲' && !b.disabled)) m.choice = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
  let delayed = false;
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const r = await route.fetch(); let body = await r.text();
    body = body.replace('readCheckpoint()', '(window.__marks.validationStart=performance.now(),window.__saved=readCheckpoint(),window.__marks.validationEnd=performance.now(),window.__saved)')
      .replace('assets = await loadCharacterAssets();', 'assets = await loadCharacterAssets();window.__marks.assets=performance.now();')
      .replace('app.start();', 'window.__testApp=app;app.start();window.__marks.app=performance.now();');
    await route.fulfill({ response: r, body });
  });
  await page.route(/\/(game-data\/game\.json|models\/.*\.glb)(\?.*)?$/, async route => {
    if (delayed) await new Promise(r => setTimeout(r, route.request().url().includes('models/') ? 2200 : 1500)); await route.continue();
  });
  await page.goto(url); await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await selectDevFixture(page, 'survival10-ahead');
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const saved = await page.evaluate(() => window.__testApp.simulation.getState()); delayed = true;
  for (let repeat = 0; repeat < 3; repeat++) {
    const navigation = page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '繼續上次遊戲' }).waitFor();
    const before = await page.evaluate(() => ({ ...window.__marks, appPresent: !!window.__testApp, inert: document.querySelector('#game-viewport').inert }));
    if (phase === 'after') { assert(!before.appPresent && before.inert && !before.assets); }
    if (!repeat) await page.screenshot({ path: `${out}/${width}-choice.png` });
    await page.mouse.click(width - 32, 35); await page.keyboard.press('q'); await page.keyboard.press('ArrowLeft');
    const chosen = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: '繼續上次遊戲' }).tap();
    if (phase === 'after') {
      assert(await page.locator('.session-recovery').evaluate(e => e.textContent.includes('正在恢復遊戲')));
      await page.mouse.click(width / 2, 420); await page.keyboard.press('p');
      assert.equal(await page.evaluate(() => !!window.__testApp), false);
    }
    await navigation; await page.waitForFunction(() => window.__testApp?.running);
    await page.locator('.session-recovery').waitFor({ state: 'detached' });
    const restored = await page.evaluate(() => { const a=window.__testApp; cancelAnimationFrame(a.frameId); a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId); return { state:a.simulation.getState(), paused:a.paused, ...window.__marks, restored:performance.now(), resources:performance.getEntriesByType('resource').map(e=>e.name) }; });
    assert(restored.paused); assert.deepEqual(restored.state, saved); delete restored.state;
    assert.equal(restored.resources.filter(u=>u.includes('.glb')).length,0);assert.equal(await page.locator('canvas').count(),1);
    if (!repeat) await page.screenshot({ path: `${out}/${width}-restored.png` });
    results.push({ width, repeat, phase, ...restored, chosen, continueToPaused:restored.restored-restored.decision, before });
  }
  assert.deepEqual(errors, []); await context.close();
} } finally { writeFileSync(`${out}/results.json`, JSON.stringify(results,null,2)); await browser.close(); }

import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b3b/browser'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const mockWake = ({ mode = 'normal' } = {}) => {
  const qa = window.__wakeQA = { requests: 0, releases: 0, live: [], pending: [], defer: false, mode };
  if (mode === 'insecure') Object.defineProperty(window, 'isSecureContext', { value: false });
  class Sentinel extends EventTarget {
    released = false; type = 'screen';
    async release() { if (!this.released) { this.released = true; qa.releases++; this.dispatchEvent(new Event('release')); } }
  }
  const grant = () => { const s = new Sentinel(); qa.live.push(s); return s; };
  qa.grant = () => qa.pending.shift()(grant());
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: mode === 'unsupported' ? undefined : { request(type) {
    if (type !== 'screen') throw Error('Wrong lock type'); qa.requests++;
    if (qa.mode === 'denied') return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    return qa.defer ? new Promise(resolve => qa.pending.push(resolve)) : Promise.resolve(grant());
  } } });
};
try { for (const width of [350, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(mockWake, {});
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  let delayed = false;
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    if (delayed) await new Promise(r => setTimeout(r, 700));
    const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
  });
  await page.route(/\/(game-data\/game\.json|models\/.*\.glb)(\?.*)?$/, async route => {
    if (delayed) await new Promise(r => setTimeout(r, 1200)); await route.continue();
  });
  const stop = () => page.evaluate(() => cancelAnimationFrame(window.__testApp.frameId));
  const status = async expected => page.waitForFunction(expected => window.__testApp.wakeLock.status === expected, expected);
  const pause = async () => { await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stop(); await status('released'); };
  const resume = async () => { await page.getByRole('button', { name: 'Resume game', exact: true }).tap(); await stop(); await status('active'); };
  await page.goto('http://127.0.0.1:5175/?perf=1');
  assert.equal(await page.locator('#session-recovery-loading').count(), 0);
  await page.getByRole('button', { name: '開始遊戲' }).tap(); await stop(); await status('active');
  await selectDevFixture(page, 'survival10-ahead'); await stop();
  assert.equal(await page.evaluate(() => window.__testApp.simulation.getState().progression.level), 10);
  await pause(); const saved = await page.evaluate(() => window.__testApp.simulation.getState());
  let text = await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev'));
  delayed = true; const navigation = page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#session-recovery-loading');
  const early = await page.evaluate(() => ({ at: performance.now(), text: document.querySelector('#session-recovery-loading').textContent,
    inert: document.querySelector('#game-viewport').inert, app: !!window.__testApp }));
  assert(early.inert && !early.app && early.text.includes('正在載入'));
  await page.screenshot({ path: `${out}/${width}-early-loading.png` });
  await page.mouse.click(width - 32, 35); await page.keyboard.press('Escape'); await page.keyboard.press('p'); await page.keyboard.press('q'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.down(' ');
  const loadingTouch = await context.newCDPSession(page);
  await loadingTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: 405 }] });
  await navigation; await page.locator('.session-recovery button').first().waitFor();
  await loadingTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.keyboard.up(' '); assert(await page.getByRole('button', { name: '繼續上次遊戲' }).isVisible());
  // The departing paused page may refresh lifecycle metadata; the saved run must be identical.
  text = await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev'));
  assert.deepEqual(JSON.parse(text).state, saved);
  const readyAt = await page.evaluate(() => performance.now());
  const pending = await page.evaluate(() => {
    return { appAbsent: !window.__testApp, controlsAbsent: !document.querySelector('.pause-button,.grenade-button,.tuning-panel'),
      checkpoint: localStorage.getItem('topwar:session:v1:dev'), requests: window.__wakeQA.requests,
      inert: document.querySelector('#game-viewport').inert };
  }); assert(pending.appAbsent && pending.controlsAbsent && pending.requests === 0 && pending.inert); assert.equal(pending.checkpoint, text);
  await page.keyboard.press('Tab'); assert(await page.getByRole('button', { name: '重新開始' }).evaluate(e => e === document.activeElement));
  await page.keyboard.press('Tab'); assert(await page.getByRole('button', { name: '繼續上次遊戲' }).evaluate(e => e === document.activeElement));
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.session-recovery button')];
    buttons[0].click(); buttons[1].click(); buttons[0].click();
  });
  await page.touchscreen.tap(width / 2, 405); await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__testApp?.running);
  const callbackCount = await page.evaluate(() => {
    const a = window.__testApp; a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId);
    return { restored: a.restored, startup: a.startup, fixture: a.devReviewFixture, state: a.simulation.getState(), paused: a.paused,
      checkpoint: localStorage.getItem('topwar:session:v1:dev'), requests: window.__wakeQA.requests };
  }); assert.deepEqual(callbackCount.state, saved); assert(callbackCount.paused && callbackCount.restored);
  assert.equal(callbackCount.fixture, 'survival10-ahead'); assert.equal(callbackCount.checkpoint, text); assert.equal(callbackCount.requests, 0);
  await page.touchscreen.tap(width / 2, 250); assert(await page.evaluate(() => window.__testApp.paused));
  await page.locator('.session-recovery').waitFor({ state: 'detached' });
  await page.screenshot({ path: `${out}/${width}-recovered-paused.png` });
  await resume(); await page.locator('.tuning-panel > summary').tap(); await status('released');
  await page.getByText('進階調校',{exact:true}).tap(); await page.getByText('熄屏與存檔 QA',{exact:true}).tap();
  assert.match(await page.locator('.qa-panel-content').textContent(), /Wake Lock: RELEASED/);
  await page.screenshot({ path: `${out}/${width}-wake-paused.png` }); await page.locator('.tuning-panel > summary').tap(); await resume();
  await pause(); await page.evaluate(() => { window.__wakeQA.defer = true; });
  await page.getByRole('button', { name: 'Resume game', exact: true }).tap(); await stop(); await status('requesting');
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap(); await stop();
  await page.evaluate(() => { window.__wakeQA.grant(); window.__wakeQA.defer = false; }); await status('released');
  assert(await page.evaluate(() => window.__wakeQA.live.every(s => s.released)));
  await resume(); await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('freeze')); window.dispatchEvent(new PageTransitionEvent('pagehide'));
  }); await status('released');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('resume')); window.dispatchEvent(new PageTransitionEvent('pageshow')); });
  assert(await page.evaluate(() => window.__testApp.paused)); await resume();
  await page.evaluate(() => { window.__extension = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__extension.loseContext(); });
  await page.waitForFunction(() => window.__testApp.contextLost); await status('released');
  await page.evaluate(() => window.__extension.restoreContext()); await page.waitForFunction(() => !window.__testApp.contextLost);
  assert(await page.evaluate(() => window.__testApp.paused)); await resume();
  await page.evaluate(() => { const a = window.__testApp, s = a.simulation.getState(); s.squad.count = 0; s.squad.rifleCounts = []; s.squad.rifleRemainder = 0; s.squad.rocketCount = 0;
    s.weapons.rifleMemberCooldowns = []; a.simulation.restoreState(s); a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId); }); await status('released');
  await page.evaluate(() => { window.__testApp.retry(); cancelAnimationFrame(window.__testApp.frameId); }); await status('active');
  await page.evaluate(() => window.__testApp.dispose()); await status('released'); assert(await page.evaluate(() => window.__wakeQA.live.every(s => s.released)));
  // New Game also has a once-only decision; invalid storage cannot leak through.
  await page.evaluate(text => localStorage.setItem('topwar:session:v1:dev', text), text); delayed = false;
  await page.reload(); await page.locator('.session-recovery button').first().waitFor();
  await page.evaluate(() => { const b = [...document.querySelectorAll('.session-recovery button')]; b[1].click(); b[0].click(); });
  // A real fast repeated touch and key press must not reach the newly displayed Start surface.
  await page.touchscreen.tap(width / 2, 460); await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__testApp?.running);
  assert.equal(await page.evaluate(() => window.__testApp.startup), 'awaiting-start');
  await page.locator('.session-recovery').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('topwar:session:v1:dev')), null);
  assert.equal(await page.evaluate(() => window.__testApp.startup), 'awaiting-start');
  await page.evaluate(() => { window.__testApp.stop(); localStorage.setItem('topwar:session:v1:dev', '{'); }); await page.reload();
  await page.locator('.session-recovery button').first().waitFor(); assert.equal(await page.getByRole('button', { name: '繼續上次遊戲' }).count(), 0);
  await page.getByRole('button', { name: '重新開始' }).tap(); await page.locator('.session-recovery').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#session-recovery-loading').count(), 0);
  assert.deepEqual(errors, []); results.push({ width, early, readyAt, pendingBlocked: true, exactRestore: true, races: true, lifecycle: true, gameOverDispose: true, duplicateDecisions: true, errors });
  await context.close();
  for (const mode of ['denied', 'unsupported', 'insecure']) {
    const c = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true }); await c.addInitScript(mockWake, { mode });
    const p = await c.newPage(); await p.goto('http://127.0.0.1:5175/'); await p.getByRole('button', { name: '開始遊戲' }).tap();
    await p.locator('.tuning-panel > summary').tap(); await p.getByText('進階調校',{exact:true}).tap(); await p.getByText('熄屏與存檔 QA',{exact:true}).tap();
    const label = await p.locator('.qa-panel-content').textContent();
    assert.match(label, mode === 'denied' ? /DENIED/ : mode === 'unsupported' ? /UNSUPPORTED/ : /INSECURE/);
    assert(await p.getByRole('button',{name:'Resume game',exact:true}).isVisible()); results.push({ width, mode, label, harmless: true }); await c.close();
  }
  console.log(`Recovery/Wake mobile QA passed ${width}`);
}
  const native = await browser.newPage();
  await native.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch(); await route.fulfill({ response: r,
    body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  await native.goto('http://localhost:5175/'); await native.getByRole('button', { name: '開始遊戲' }).click();
  await native.waitForFunction(() => window.__testApp.wakeLock.status !== 'requesting');
  const nativeResult = await native.evaluate(() => ({ native: true, secure: isSecureContext, supported: !!navigator.wakeLock, status: window.__testApp.wakeLock.status }));
  assert(nativeResult.secure); results.push(nativeResult); await native.getByRole('button', { name: 'Pause game', exact: true }).click();
  await native.waitForFunction(() => window.__testApp.wakeLock.status !== 'active'); await native.close();
} finally { writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }

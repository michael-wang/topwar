import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/p3b6b3b/origins'; mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const secure of [true, false]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let hmrConnected = false; const errors = [], badResponses = [], assets = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('websocket', socket => socket.on('framereceived', frame => { if (String(frame.payload).includes('"type":"connected"')) hmrConnected = true; }));
  page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url());
    if (/\.(glb|webp|mp3)(\?|$)/.test(response.url())) assets.push(response.url()); });
  // Proxy only test responses; Chrome computes a genuinely non-trustworthy HTTP origin.
  // No secure-context override or unsafe-origin flags.
  await page.route(secure ? /\/src\/main\.ts(\?.*)?$/ : 'http://topwar.test:5175/**', async route => {
    const url = new URL(route.request().url()); if (!secure) url.hostname = '127.0.0.1';
    const r = await route.fetch({ url: url.href });
    if (url.pathname === '/src/main.ts') await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
    else await route.fulfill({ response: r });
  });
  await page.goto(secure ? 'http://localhost:5175/' : 'http://topwar.test:5175/');
  await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started' && window.__testApp.wakeLock.status !== 'requesting');
  const data = await page.evaluate(() => ({ secure: isSecureContext, supported: !!navigator.wakeLock, status: window.__testApp.wakeLock.status,
    realSentinel: !!window.__testApp.wakeLock.sentinel && !window.__testApp.wakeLock.sentinel.released }));
  assert.equal(data.secure, secure); assert.equal(data.status, secure ? 'active' : 'insecure'); assert.equal(data.realSentinel, secure);
  assert.equal(assets.filter(url => url.includes('.glb')).length, 1); assert.equal(assets.filter(url => url.includes('.webp')).length, 2);
  if (secure) assert(hmrConnected, 'Native localhost Vite HMR WebSocket must connect');
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await page.waitForFunction(() => window.__testApp.wakeLock.status !== 'active');
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  results.push({ ...data, pausedStatus: await page.evaluate(() => window.__testApp.wakeLock.status), hmrConnected: secure ? hmrConnected : 'not tested on proxy origin', assets, errors });
  await page.close();
} } finally { writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }

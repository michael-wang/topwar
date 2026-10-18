import { exposeProductionApp } from './production-app-hook.mjs';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? 'artifacts/p4.42/after';
mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const server = await preview({ preview: { host: '127.0.0.1', port: 5186, strictPort: true } });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const { width, variant } of [350, 390].flatMap(width =>
    ['normal', 'safe-fullscreen', 'reduced-motion'].map(variant => ({ width, variant })))) {
    const label = `${width}${variant === 'normal' ? '' : '-' + variant}`;
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
      reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await exposeProductionApp(page);
    if (variant === 'safe-fullscreen') {
      // Inject device safe-area values into the test response only, not production CSS.
      await page.route(/\/assets\/.*\.css$/, async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/env\(safe-area-inset-top(?:,[^)]*)?\)/g, '24px')
          .replace(/env\(safe-area-inset-bottom(?:,[^)]*)?\)/g, '20px');
        await route.fulfill({ response, body });
      });
    }
    await page.goto('http://127.0.0.1:5186/topwar/');
    await page.getByRole('button', { name: '開始遊戲', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    const idle = await page.evaluate(reduced => {
      const a = window.__testApp; cancelAnimationFrame(a.frameId);
      a.renderer.renderDiorama(a.diorama.sample(reduced ? 0 : 1200), reduced ? 0 : 1200);
      const landmarks = ['coastal-defensive-compound', 'coastal-foreground-village', 'coastal-olive-and-vines']
        .map(name => { const o = a.renderer.scene.getObjectByName(name); return [name, o.matrixWorld.toArray()]; });
      return { stats: a.renderer.getDebugStats(), state: a.simulation.getState(), landmarks,
        enemies: a.diorama.state.enemies.length, guards: a.renderer.sentries.group.children.length };
    }, variant === 'reduced-motion');
    assert.equal(idle.enemies, 0); assert.equal(idle.guards, 2); assert.equal(idle.stats.visibleSquad, 1);
    await page.screenshot({ path: `${out}/${label}-idle.png` });
    const longIdle = await page.evaluate(() => {
      const a = window.__testApp, r = a.renderer;
      // Sample ten minutes of presentation time; this is not a phone soak test.
      const state = a.diorama.state;
      const snapshots = [];
      for (const time of [60000, 300000, 600000, 60000, 300000, 600000]) {
        r.renderDiorama(state, time); const s = r.getDebugStats();
        snapshots.push({ time, geometries: s.geometries, textures: s.textures, draws: s.drawCalls });
      }
      r.renderDiorama(state, a.reducedMotion?.matches ? 0 : 1200);
      return snapshots;
    });
    assert.equal(longIdle[3].geometries, longIdle[5].geometries);
    assert.equal(longIdle[3].textures, longIdle[5].textures);
    assert.deepEqual(longIdle[5], longIdle[2]);
    const idleLifecycle = await page.evaluate(() => {
      const a = window.__testApp, before = JSON.stringify(a.simulation.getState());
      const age = a.idleAgeMs, frames = a.renderer.renderer.info.render.frame;
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      a.renderFrame(performance.now() + 60000); cancelAnimationFrame(a.frameId);
      const hiddenStatic = frames === a.renderer.renderer.info.render.frame && age === a.idleAgeMs;
      delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));
      a.renderFrame(performance.now()); cancelAnimationFrame(a.frameId);
      a.onContextLost();
      const contextFrames = a.renderer.renderer.info.render.frame;
      a.renderFrame(performance.now() + 60000); cancelAnimationFrame(a.frameId);
      const contextStatic = contextFrames === a.renderer.renderer.info.render.frame;
      a.onContextRestored();
      return { hiddenStatic, contextStatic, stateUnchanged: before === JSON.stringify(a.simulation.getState()) };
    });
    assert.deepEqual(idleLifecycle, { hiddenStatic: true, contextStatic: true, stateUnchanged: true });
    await page.getByRole('button', { name: '開始遊戲', exact: true }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started');
    // Real GameApp frames and original Simulation, stopped at a controlled age.
    const captures = {};
    for (const [name, age] of [['transition', 500], ['gameplay', 1200]]) {
      captures[name] = await page.evaluate(age => {
        const a = window.__testApp;
        if (a.previousFrameTimestampMs === null) a.renderFrame(performance.now());
        cancelAnimationFrame(a.frameId);
        let steps = 0;
        while (a.presentationMs + .01 < age && steps++ < 120) {
          a.renderFrame(a.previousFrameTimestampMs + Math.min(1000 / 60, age - a.presentationMs));
          cancelAnimationFrame(a.frameId);
        }
        if (a.presentationMs + .01 < age) throw Error('Gameplay clock did not advance');
        const landmarks = ['coastal-defensive-compound', 'coastal-foreground-village', 'coastal-olive-and-vines']
          .map(name => { const o = a.renderer.scene.getObjectByName(name); return [name, o.matrixWorld.toArray()]; });
        return { stats: a.renderer.getDebugStats(), state: a.simulation.getState(), landmarks,
          guardsVisible: a.renderer.sentries.group.visible, fullscreen: !!document.fullscreenElement,
          presentationMs: a.presentationMs };
      }, age);
      assert.deepEqual(captures[name].landmarks, idle.landmarks);
      await page.screenshot({ path: `${out}/${label}-${name}.png` });
    }
    assert.equal(captures.gameplay.guardsVisible, false);
    assert.equal(captures.gameplay.stats.visibleSquad, 1);
    let newGameErrors = null;
    if (variant === 'normal') {
      await page.evaluate(() => window.__testApp.setPaused(true));
      await page.reload();
      await page.getByRole('button', { name: '重新開始', exact: true }).tap();
      await page.getByRole('button', { name: '開始遊戲', exact: true }).waitFor();
      await page.evaluate(() => {
        const a = window.__testApp; cancelAnimationFrame(a.frameId);
        a.audio.activate = () => Promise.reject(new Error('QA optional audio denied'));
        a.viewport.requestFullscreen = () => Promise.reject(new Error('QA optional fullscreen denied'));
      });
      await page.getByRole('button', { name: '開始遊戲', exact: true }).tap();
      await page.waitForFunction(() => window.__testApp.startup === 'started');
      newGameErrors = await page.evaluate(() => {
        const a = window.__testApp; cancelAnimationFrame(a.frameId);
        a.retry(); cancelAnimationFrame(a.frameId);
        return { started: a.startup === 'started', noDiorama: a.diorama === null, noSentries: !a.renderer.sentries.group.visible };
      });
      assert.deepEqual(newGameErrors, { started: true, noDiorama: true, noSentries: true });
    }
    assert.deepEqual(errors, []);
    results.push({ width, variant, idle, idleLifecycle, longIdle, newGameErrors, ...captures, errors });
    await page.close();
  }
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}

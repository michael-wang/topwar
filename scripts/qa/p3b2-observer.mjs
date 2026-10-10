// Reproducible portrait comparisons at native mobile CSS scale; no gameplay changes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const phase = process.argv[2] ?? 'after', out = process.env.TOPWAR_OBSERVER_OUT ?? `artifacts/p3b2/${phase}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const width of [350, 390]) for (const inset of [0, 34]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: true, hasTouch: true, locale: 'en-US' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => localStorage.setItem('topwar.observer.locale', 'en'));
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.audio.prepareRadio('zh-TW', 'missionIntro') === 'ready');
    await page.evaluate(inset => {
      const a = window.__testApp; cancelAnimationFrame(a.frameId);
      const host = document.querySelector('.beachhead-defense');
      host.style.setProperty('--hud-inset-bottom', `${inset}px`);
      host.style.setProperty('--hud-inset-top', `${inset ? 20 : 0}px`);
      window.__advanceTo = seconds => {
        let now = performance.now(); a.previousFrameTimestampMs = null;
        a.renderFrame(now); cancelAnimationFrame(a.frameId);
        while (a.simulation.getState().elapsedSeconds < seconds) {
          a.renderFrame(now += 1000 / 60); cancelAnimationFrame(a.frameId);
        }
      };
      a.retry(); window.__advanceTo(.8);
    }, inset);
    const capture = async name => {
      await page.locator('.field-observer img').evaluate(img => img.decode());
      assert(await page.locator('.field-observer').isVisible());
      assert.equal(await page.locator('.observer-languages').count(), 0);
      assert.equal(await page.locator('.field-observer p').getAttribute('lang'), 'zh-TW');
      const boxes = await page.evaluate(() => {
        const box = selector => {
          const e = document.querySelector(selector), r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        return { panel: box('.field-observer'), portrait: box('.field-observer img'),
          text: box('.field-observer p'), dev: box('.tuning-panel > summary'),
          pause: box('[aria-label="Pause game"]'), words: document.querySelector('.field-observer p').textContent };
      });
      const overlap = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      assert(!overlap(boxes.portrait, boxes.dev)); assert(!overlap(boxes.portrait, boxes.pause));
      assert(!overlap(boxes.portrait, boxes.text));
      assert(boxes.portrait.x >= 0 && boxes.portrait.right <= width);
      assert(boxes.text.right < boxes.panel.right && boxes.text.bottom <= boxes.panel.bottom);
      if (phase === 'after') {
        assert(boxes.portrait.y < boxes.panel.y, 'Hat should break above the plaque');
        assert(boxes.portrait.bottom > boxes.panel.bottom, 'Shoulder crop should break below the plaque');
      }
      await page.screenshot({ path: `${out}/${width}-inset${inset}-${name}.png` });
      results.push({ width, inset, name, ...boxes }); return boxes;
    };
    const short = await capture('mission-short');
    await page.evaluate(() => window.__advanceTo(2.5)); const middle = await capture('mission-middle');
    await page.evaluate(() => window.__advanceTo(4.5)); const long = await capture('mission-long');
    assert.deepEqual(short.portrait, middle.portrait); assert.deepEqual(short.portrait, long.portrait);
    assert.deepEqual(short.panel, long.panel);
    await selectDevFixture(page, 'naval');
    await page.evaluate(() => window.__advanceTo(2.1)); await capture('destroyer-warning');
    await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
    const state = await page.evaluate(() => window.__testApp.simulation.getState());
    await page.screenshot({ path: `${out}/${width}-inset${inset}-paused.png` });
    assert.deepEqual(await page.evaluate(() => window.__testApp.simulation.getState()), state);
    await page.getByRole('button', { name: 'Resume game', exact: true }).tap();
    await page.locator('.tuning-panel > summary').click();
    await page.screenshot({ path: `${out}/${width}-inset${inset}-dev-open.png` });
    assert.deepEqual(errors, []); await page.close();
    console.log('Observer comparison captured', phase, width, inset);
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }

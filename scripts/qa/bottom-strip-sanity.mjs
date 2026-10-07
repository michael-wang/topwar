import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/bottom-strip'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const cdp = await page.context().newCDPSession(page);
const result = { portraits: {}, cancellations: [], errors: [] };
const assert = (ok, message) => { if (!ok) throw Error(message); };
page.on('pageerror', e => result.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const point = async direction => {
  const b = await page.locator(`.movement-${direction}`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 0 };
};
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
  });
  await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173');
  await page.waitForSelector('.game-start-overlay');
  assert(await page.locator('.movement-button:disabled').count() === 2, 'Pre-start movement disabled');
  assert(await page.locator('.touch-steering-band,.touch-steering-zone').count() === 0, 'No hidden legacy movement DOM');
  await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId); window.__clock = 0;
    window.__advance = ms => { for (let t = 0; t < ms; t += 20) {
      window.__clock += Math.min(20, ms - t); a.renderFrame(window.__clock); cancelAnimationFrame(a.frameId);
    } };
    window.__observeSteps = () => {
      window.__steps = []; const sim = a.simulation, step = sim.stepLane.bind(sim);
      sim.stepLane = direction => {
        const from = sim.getState().player.selectedLane, keepGoing = step(direction);
        window.__steps.push({ at: performance.now(), direction, from, to: sim.getState().player.selectedLane });
        return keepGoing;
      };
    };
    for (const button of document.querySelectorAll('.movement-button')) {
      button.addEventListener('pointerdown', e => { window.__pointerId = e.pointerId; });
      for (const type of ['contextmenu', 'selectstart', 'dragstart'])
        button.addEventListener(type, e => { (window.__nativeEvents ??= []).push({ type, prevented: e.defaultPrevented }); });
    }
  });
  const advance = ms => page.evaluate(ms => window.__advance(ms), ms);
  const sample = () => page.evaluate(() => ({ state: window.__testApp.simulation.getState(), steps: window.__steps,
    held: [...document.querySelectorAll('.movement-button')].map(b => b.getAttribute('aria-pressed')) }));
  const reset = async () => { await selectDevFixture(page, 'machineGun'); await advance(40); await page.evaluate(() => window.__observeSteps()); };
  const capture = async name => { await page.waitForTimeout(280); await page.screenshot({ path: `${out}/${name}.png` }); };
  for (const width of [390, 350]) {
    await page.setViewportSize({ width, height: 844 }); await reset();
    assert(await page.locator('.movement-button:visible').count() === 2, 'Two visible movement controls');
    const layout = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      return { left: rect('.movement-left'), right: rect('.movement-right'), track: rect('.xp-track'), level: rect('.xp-level-number'), label: rect('.xp-level'),
        strip: rect('.combat-control-strip'), build: rect('.build-label'),
        flow: getComputedStyle(document.querySelector('.xp-fill'), '::before').animationName,
        userSelect: getComputedStyle(document.querySelector('.movement-left')).userSelect,
        touchAction: getComputedStyle(document.querySelector('.movement-left')).touchAction };
    });
    assert(layout.left.width >= 44 && layout.left.height >= 44 && layout.right.width >= 44, 'Thumb target size');
    assert(layout.left.x + layout.left.width < layout.track.x && layout.track.x + layout.track.width < layout.right.x, 'Movement / progression / movement order');
    assert(Math.abs(layout.label.x + layout.label.width / 2 - (layout.track.x + layout.track.width / 2)) < 1, 'Level centered in XP');
    assert(layout.level.height > layout.track.height && layout.level.height >= 32, 'Focal level exceeds physical bar');
    assert(layout.strip.y + layout.strip.height < layout.build.y, 'Build label clear');
    assert(layout.flow === 'xp-sheen' && layout.userSelect === 'none' && layout.touchAction === 'none', 'Flow and native-gesture CSS');
    // No movement from the removed invisible surface, including the center progression region.
    const initialLane = (await sample()).state.player.selectedLane;
    for (const [x, y] of [[5, 810], [width / 2, 790], [80, 700]]) await page.touchscreen.tap(x, y);
    assert((await sample()).state.player.selectedLane === initialLane, 'Old viewport/bottom tap input removed');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    assert((await sample()).state.player.selectedLane === 4, 'Existing keyboard hold reaches edge');
    const holds = {};
    for (const direction of ['left', 'right']) {
      await page.evaluate(() => { window.__steps = []; });
      await touch('touchStart', [await point(direction)]); await page.waitForTimeout(1300);
      const held = await sample(), index = direction === 'left' ? 0 : 1;
      assert(held.state.player.selectedLane === (direction === 'left' ? 0 : 4), `${direction}: continuous touch movement`);
      assert(held.steps.length === 4 && held.held[index] === 'true', `${direction}: no duplicate steps / held edge feedback`);
      const intervals = held.steps.slice(1).map((s, i) => s.at - held.steps[i].at);
      assert(intervals[0] >= 160 && intervals.slice(1).every(ms => ms >= 100), 'Authored hold timing, independent of OS repeat');
      await advance(200); await capture(`held-${direction}-${width}`);
      if (direction === 'right') await touch('touchMove', [{ x: width / 2, y: 650, id: 0 }]);
      await touch('touchEnd'); await page.waitForTimeout(400);
      const released = await sample();
      assert(released.steps.length === 4 && released.held.every(v => v === 'false'), 'Release outside capture stops immediately');
      assert(await page.evaluate(() => !getSelection()?.toString() && window.scrollY === 0), 'No selection or page scroll during long press');
      holds[direction] = { steps: held.steps, intervals, heldAtEdge: true, releaseClean: true };
    }
    await reset(); const tapLane = (await sample()).state.player.selectedLane;
    await page.getByRole('button', { name: 'Move left', exact: true }).tap(); await page.waitForTimeout(350);
    assert((await sample()).state.player.selectedLane === tapLane - 1 && (await sample()).steps.length === 1, 'Real tap advances exactly once');
    await page.getByRole('button', { name: 'Move right', exact: true }).focus(); await page.keyboard.press('Enter');
    assert((await sample()).state.player.selectedLane === tapLane, 'Keyboard/assistive button activation');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('5'); await advance(40);
    assert(await page.locator('.xp-level-number').textContent() === '5', 'Lv5 readable');
    const clip = await page.locator('.xp-fill').evaluate(e => e.style.clipPath);
    assert(Math.abs(parseFloat(clip.split(' ')[1]) - (1 - 210 / 220) * 100) < .001, 'Exact 210/220 XP fill');
    await capture(`lv5-${width}`);
    while ((await sample()).state.progression.level === 5) await advance(20);
    await advance(140);
    assert(await page.locator('.xp-hud').evaluate(e => e.classList.contains('level-flash') && e.classList.contains('level-label-pop')), 'Strong brief real level-up accent');
    // Flush authored classes, then observe real browser animation time while simulation is held.
    await page.locator('.level-up-message').evaluate(e => getComputedStyle(e).opacity);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.level-up-message')).opacity) > .8);
    const announcement = await page.locator('.level-up-message').evaluate(e => ({ opacity: getComputedStyle(e).opacity,
      animation: getComputedStyle(e).animationName, class: e.parentElement.className,
      animations: e.getAnimations().map(a => ({ currentTime: a.currentTime, state: a.playState })) }));
    assert(Number(announcement.opacity) > .8, `Visible non-modal level-up announcement: ${JSON.stringify(announcement)}`);
    await page.screenshot({ path: `${out}/level-up-${width}.png` });
    await advance(1000); await capture(`lv6-${width}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await page.locator('.xp-fill').evaluate(e => getComputedStyle(e, '::before').animationName === 'none'), 'Reduced-motion flow disabled');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    result.portraits[width] = { layout, holds, tapAndKeyboardButton: true, xpAccuracy: true, realEvolution: true };
  }
  // Test actual pointer/touch capture cancellation paths, including canceled browser gestures.
  for (const reason of ['touchCancel', 'lostCapture', 'blur', 'pause', 'death', 'retry']) {
    await reset(); const start = await sample();
    await touch('touchStart', [await point('left')]);
    if (reason === 'touchCancel') await touch('touchCancel');
    if (reason === 'lostCapture') {
      await page.evaluate(() => document.querySelector('.movement-left').releasePointerCapture(window.__pointerId));
      await touch('touchMove', [await point('left')]);
    }
    if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (reason === 'pause') { await page.getByRole('button', { name: 'Pause game' }).click(); await advance(40); }
    if (reason === 'death') await page.evaluate(() => {
      const a = window.__testApp, s = a.simulation.getState();
      s.squad = { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 }; s.weapons.rifleMemberCooldowns = [];
      a.simulation.restoreState(s); window.__advance(40);
    });
    if (reason === 'retry') await page.evaluate(() => window.__testApp.retry());
    if (reason !== 'touchCancel') await touch('touchEnd');
    await page.waitForTimeout(400);
    const ended = await sample();
    assert(ended.held.every(v => v === 'false'), `${reason}: no stranded pressed state`);
    assert(ended.state.player.selectedLane === (reason === 'retry' ? start.state.player.selectedLane : start.state.player.selectedLane - 1), `${reason}: no stale repeat`);
    if (reason === 'pause' || reason === 'death') assert(await page.locator('.movement-button:disabled').count() === 2, `${reason}: disabled`);
    if (reason === 'pause') { await page.getByRole('button', { name: 'Resume game' }).click(); await advance(40); }
    if (reason === 'death') { await page.getByRole('button', { name: 'Retry', exact: true }).click(); await advance(40); }
    result.cancellations.push(reason);
  }
  const native = await page.evaluate(() => {
    const b = document.querySelector('.movement-left'), prevented = {};
    for (const type of ['contextmenu', 'selectstart', 'dragstart', 'touchstart', 'touchmove']) {
      const e = new Event(type, { bubbles: true, cancelable: true }); b.dispatchEvent(e); prevented[type] = e.defaultPrevented;
    }
    return { prevented, observed: window.__nativeEvents ?? [] };
  });
  assert(Object.values(native.prevented).every(Boolean), 'Native long-press defaults canceled');
  result.native = native;
  assert(!result.errors.length, result.errors.join('\n'));
  writeFileSync(`${out}/bottom-strip-sanity.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ widths: Object.keys(result.portraits), cancellationPaths: result.cancellations, errors: result.errors }));
} finally { await browser.close(); }

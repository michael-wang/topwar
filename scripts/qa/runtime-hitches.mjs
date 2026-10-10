// QA-only: real RAF, matched CPU throttling, first/repeated fixture in one context.
import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/p3b31/before'; mkdirSync(out, { recursive: true });
const roles = (process.env.TOPWAR_PROFILE_ROLES ?? 'crate3,crate8').split(',');
const browser = await chromium.launch({ headless: true, executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try { for (const width of (process.env.TOPWAR_PROFILE_WIDTHS ?? '350,390').split(',').map(Number)) for (const role of roles) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__qa = { frames: [], events: [], calls: [], requests: [], shaders: [] };
    const source=WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource=function(shader,code){window.__qa.shaders.push({at:performance.now(),code});return source.call(this,shader,code);};
    for (const name of ['compileShader', 'linkProgram', 'getProgramParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getActiveUniform', 'getUniformLocation', 'texImage2D', 'bufferData']) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        const at = performance.now(); const result = original.apply(this, args);
        window.__qa.calls.push({ name: 'gl.' + name, at, ms: performance.now() - at }); return result;
      };
    }
  });
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('app.start();', 'window.__testApp=app;app.start();') }); });
  await page.goto(process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Start game with audio' }).tap();
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  if(process.env.TOPWAR_NO_REWARD_FILTER==='1')await page.addStyleTag({content:'.supply-reward-item { filter:none !important; }'});
  if(process.env.TOPWAR_NO_TRANSFER==='1')await page.addStyleTag({content:'.supply-reward-transfer { display:none !important; } .grenade-button {filter:none !important;transform:none !important;}'});
  if(process.env.TOPWAR_NO_SVG==='1')await page.addStyleTag({content:'.supply-reward-transfer { display:none !important; }'});
  if(process.env.TOPWAR_NO_BUTTON_PULSE==='1')await page.addStyleTag({content:'.grenade-button {filter:none !important;transform:none !important;}'});
  if(process.env.TOPWAR_COMPOSITE_SVG==='1')await page.addStyleTag({content:'.supply-reward-item {will-change:transform;}'});
  await page.evaluate(noDiagnostics => {
    const a = window.__testApp, q = window.__qa;
    if(noDiagnostics)a.renderer.renderer.debug.checkShaderErrors=false;
    const direct=a.renderer.renderer.renderBufferDirect;
    a.renderer.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
      const at=performance.now();const result=direct.call(this,camera,scene,geometry,material,object,group);
      const ms=performance.now()-at;if(ms>5)q.calls.push({name:'draw:'+object.name,at,ms,material:material.type,fog:material.fog,transparent:material.transparent});return result;
    };
    const wrap = (object, name, label) => {
      if (!object?.[name]) return;
      const original = object[name]; object[name] = function (...args) {
        const at = performance.now(); const result = original.apply(this, args);
        q.calls.push({ name: label ?? name, at, ms: performance.now() - at }); return result;
      };
    };
    for (const [object, names, prefix] of [
      [a.audio, ['presentSupply', 'play', 'createGrenadeBuffer', 'createRumbleBuffer'], 'audio.'],
      [a.supplyTransfer, ['present', 'update'], 'transfer.'], [a.grenadeButton, ['update', 'getIconBounds'], 'button.'],
      [a.renderer, ['presentGrenade', 'presentArtillery', 'render', 'presentLevelUp'], 'renderer.'],
      [a.renderer.renderer, ['render', 'compile'], 'three.'], [Object.getPrototypeOf(a.simulation), ['step'], 'simulation.'],
    ]) for (const name of names) wrap(object, name, prefix + name);
    const simulation = Object.getPrototypeOf(a.simulation), consume = simulation.consumeGrenadeEvents;
    simulation.consumeGrenadeEvents = function () {
      const events = consume.call(this); for (const event of events) {
        q.events.push({ ...event, at: performance.now(), sim: a.simulation.getFrameState().elapsedSeconds, presentation: a.presentationMs });
        performance.mark('qa:' + event.kind);
      } return events;
    };
    const render = a.renderFrame; cancelAnimationFrame(a.frameId);
    let last = null;
    a.renderFrame = t => {
      const at = performance.now(); render(t);
      q.frames.push({ at, t, gap: last === null ? 0 : t - last, cpu: performance.now() - at, sim: a.simulation.getFrameState().elapsedSeconds, presentation: a.presentationMs }); last = t;
    };
    a.frameId = requestAnimationFrame(a.renderFrame);
  }, process.env.TOPWAR_NO_SHADER_DIAGNOSTICS==='1');
  for (let attempt = 0; attempt < Number(process.env.TOPWAR_PROFILE_ATTEMPTS ?? 3); attempt++) {
    await page.evaluate(() => { window.__qa.frames = []; window.__qa.calls = []; window.__qa.events = []; performance.clearResourceTimings(); });
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
    await selectDevFixture(page, role === 'casualty' ? 'grenade' : role);
    if (role === 'casualty') await page.evaluate(() => {
      // Test-side snapshot only: exercise Giant/Heavy death and a full casualty
      // burst together. Authored HP/damage and shipping fixtures stay unchanged.
      const a = window.__testApp, s = a.simulation.getState();
      s.enemies.push({ id: s.enemyStream.nextEnemyId++, tier: 1, archetype: 'giant', lane: 2, x: 0, z: 12, hp: 1 });
      s.giantEncounter = { scheduledAtSeconds: 0, spawned: true };
      s.projectiles = [];
      for (const enemy of s.enemies) { enemy.hp = 1; enemy.x = 0; enemy.z = 12; enemy.lane = 2; }
      s.weapons.rifleCooldownRemainingSeconds = 100;
      s.weapons.rifleMemberCooldowns = s.weapons.rifleMemberCooldowns.map(() => 100);
      a.simulation.restoreState(s);
    });
    if (role.startsWith('crate')) {
      await page.waitForFunction(() => window.__qa.events.some(e => e.kind === 'grenadeSupplyOpened'), null, { timeout: 30000 });
      await page.waitForFunction(() => !window.__testApp.supplyTransfer.transfer);
    } else if (role === 'grenade' || role === 'casualty') {
      await page.locator('.grenade-button').tap();
      await page.waitForTimeout(4000);
    } else {
      await page.waitForTimeout(8000);
    }
    await page.waitForTimeout(400);
    const traceDone = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); const { stream } = await traceDone;
    let traceText = ''; for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); traceText += chunk.data; if (chunk.eof) break; } await cdp.send('IO.close', { handle: stream });
    const data = await page.evaluate(() => ({ ...window.__qa, resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, at: r.startTime, bytes: r.transferSize })) }));
    if (role === 'casualty') {
      const victims = data.events.find(e => e.kind === 'grenadeDetonated')?.victims ?? [];
      if (!['grunt', 'heavy', 'giant'].every(role => victims.some(v => v.archetype === role && v.killed)))
        throw Error('Casualty profile must contain lethal Grunt, Heavy and Giant reactions');
    }
    const event = data.events.find(e => e.kind === 'grenadeSupplyOpened');
    const start = event ? event.at - 250 : data.frames[0].at, end = event ? event.at + 1800 : Infinity;
    const frames = data.frames.filter(f => f.at >= start && f.at <= end);
    const calls = data.calls.filter(c => c.at >= start && c.at <= end);
    const byName = {}; for (const c of calls) { const row = byName[c.name] ??= { count: 0, total: 0, max: 0 }; row.count++; row.total += c.ms; row.max = Math.max(row.max, c.ms); }
    const trace = JSON.parse(traceText).traceEvents;
    const mark = trace.find(e => e.name === 'qa:grenadeSupplyOpened');
    const traceCosts = {};
    for (const e of trace) if (e.ph === 'X' && e.dur && (!mark || e.ts >= mark.ts - 250000 && e.ts <= mark.ts + 1800000) && ['Layout', 'UpdateLayoutTree', 'Paint', 'RasterTask', 'FunctionCall', 'RunTask', 'V8.GC_SCAVENGER'].includes(e.name)) {
      const row = traceCosts[e.name] ??= { count: 0, total: 0, max: 0 }; row.count++; row.total += e.dur / 1000; row.max = Math.max(row.max, e.dur / 1000);
    }
    const summary = { width, role, attempt, event, frames: frames.length, longestFrame: Math.max(...frames.map(f => f.gap)), over50: frames.filter(f => f.gap > 50).length, over100: frames.filter(f => f.gap > 100).length, over200: frames.filter(f => f.gap > 200).length, maxCpu: Math.max(...frames.map(f => f.cpu)), byName, traceCosts, resources: data.resources, errors };
    const name = `${width}-${role}-${attempt}`;
    writeFileSync(`${out}/${name}.trace.json`, traceText); writeFileSync(`${out}/${name}.json`, JSON.stringify(data));
    results.push(summary); console.log(JSON.stringify(summary));
  }
  await page.close();
} } finally { writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2)); await browser.close(); }

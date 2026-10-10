import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const phase = process.argv[2] ?? 'final', url = process.argv[3] ?? 'http://127.0.0.1:5173/';
const out = `artifacts/p3b4/${phase}-browser`; mkdirSync(out, { recursive: true });
const evidenceOnly = process.argv.includes('--evidence-only');
const saved = JSON.parse(readFileSync(`artifacts/p3b4/${phase}/metrics.json`)).runs.find(r => r.seed === 17).snapshots['carnival-start'];
const { chromium } = await import('file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const width of [350, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
      const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;app.start();') });
    });
    await page.goto(`${url}?perf=1`); await page.getByRole('button', { name: 'Start game with audio' }).tap();
    await page.waitForFunction(() => window.__testApp.startup === 'started');
    // Allow bounded presentation preparation to run normally. No synthetic GPU
    // backlog, no simultaneous recording during the performance measurements.
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const a = window.__testApp; cancelAnimationFrame(a.frameId); });
    const samples = [];
    const setup = async () => page.evaluate(saved => {
      const a = window.__testApp; a.retry(); cancelAnimationFrame(a.frameId);
      a.simulation.restoreState(saved); a.fixedStepLoop.reset(); a.previousFrameTimestampMs = null; a.perf.reset();
      // Recreate the real Lv5→6 presentation edge, rather than a synthetic Lv1→6.
      a.progressionObserver.observe(saved.progression.level - 1);
      window.__decision = saved.tick;
      window.__pilot = () => {
        const s = a.simulation.getFrameState(); if (s.tick < window.__decision) return; window.__decision = s.tick + 12;
        const nearest = [...s.enemies].sort((a, b) => a.z - b.z || a.id - b.id)[0], giant = s.enemies.find(e => e.archetype === 'giant');
        const preferred = s.grenade.supply?.lane ?? (giant && (!nearest || nearest.z > 10) ? giant : nearest)?.lane ?? s.player.selectedLane;
        const danger = new Set(s.artillery?.shells.map(s => s.targetLane));
        const lane = [s.player.selectedLane - 1, s.player.selectedLane, s.player.selectedLane + 1].filter(l => l >= 0 && l < 5 && !danger.has(l))
          .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b)[0] ?? s.player.selectedLane;
        if (lane !== s.player.selectedLane) a.simulation.stepLane(lane < s.player.selectedLane ? -1 : 1);
      };
    }, saved);
    for (let repeat = 0; repeat < (evidenceOnly ? 0 : 3); repeat++) {
      await setup(); const requestStart = requests.length;
      const sample = await page.evaluate(async () => {
        const a = window.__testApp, rows = []; let start, previous;
        await new Promise(resolve => requestAnimationFrame(function frame(ts) {
          start ??= ts; window.__pilot(); const cpuStart = performance.now(); a.renderFrame(ts); cancelAnimationFrame(a.frameId);
          rows.push({ ms: previous == null ? 0 : ts - previous, cpuMs: performance.now() - cpuStart,
            age: a.simulation.getFrameState().elapsedSeconds - a.simulation.getFrameState().machineGunReleaseAtSeconds }); previous = ts;
          if (ts - start < 28000 && a.simulation.getFrameState().squad.count) requestAnimationFrame(frame); else resolve();
        }));
        const frames = rows.slice(1), sorted = frames.map(r => r.ms).sort((a, b) => a - b);
        return { rows, mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1),
          over50: frames.filter(r => r.ms > 50).length, over100: frames.filter(r => r.ms > 100).length, over200: frames.filter(r => r.ms > 200).length,
          stepP95: a.perf.stepCpu.p95(), renderP95: a.perf.render.p95(), highWater: { ...a.perf.highWater }, stats: a.renderer.getDebugStats(),
          state: { level: a.simulation.getState().progression, soldiers: a.simulation.getState().squad.count,
            carnival: a.simulation.getState().carnival, destroyer: a.simulation.getState().destroyer, survival: a.simulation.getState().postCapSurvival } };
      });
      sample.requests = requests.slice(requestStart); samples.push(sample); console.log(JSON.stringify({ phase, width, repeat, ...sample, rows: undefined }));
      assert(sample.state.soldiers > 0, 'Artillery-aware pilot remains alive');
    }
    if (phase === 'final') {
      await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
      await setup(); const stop = await startGameRecording(page, width);
      // Captures are a separate presentation run, not performance samples.
      const evidence = await page.evaluate(async () => {
        const a = window.__testApp; window.__captures = {};
        await new Promise(resolve => { let start; requestAnimationFrame(function frame(ts) {
          start ??= ts; window.__pilot(); a.renderFrame(ts); cancelAnimationFrame(a.frameId);
          const s = a.simulation.getFrameState(), age = s.elapsedSeconds - s.machineGunReleaseAtSeconds;
          const observer = document.querySelector('.field-observer');
          if (age > 2 && age < 6) window.__captures.warning = { text: observer?.textContent, image: observer?.querySelector('img')?.getAttribute('src'), age };
          if (ts - start < 28000) requestAnimationFrame(frame); else resolve();
        }); }); return { ...window.__captures, state: a.simulation.getState().destroyer };
      });
      const recording = await stop(); writeFileSync(`${out}/${width}-concurrent.webm`, recording);
      assert(evidence.warning?.image && evidence.warning.text.includes('驅逐'), 'Visible portrait and Traditional Chinese warning during combat');
      assert.equal(evidence.state.status, 'complete');
      // Review actual recorded frames, preserving the presentation clocks and HUD.
      await inspectRecordingFrames(browser, recording, width, `${out}/${width}-concurrent`, [3.5, 17.7]);
    }
    assert.deepEqual(errors, []); results.push({ width, samples }); await page.close();
    if (!evidenceOnly) writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  }
} finally { await browser.close(); }

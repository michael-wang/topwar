import { selectDevFixture } from './dev-fixture-controls.mjs';
// Real gestures and native Web Audio only. Captures are ignored/local.
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/a1-audio-start';
const url = process.env.TOPWAR_QA_URL ?? 'http://127.0.0.1:5173';
mkdirSync(out, { recursive: true }); mkdirSync(`${out}/frames`, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const assert = (condition, message) => { if (!condition) throw Error(message); };
const results = { inputs: {}, errors: [] };
async function open({ mobile = true, width = 390, query = '', audioCapture = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', e => results.errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('app.start();', `
      window.__testApp=app;
      window.__cues=[];
      const play=app.audio.play.bind(app.audio);
      app.audio.play=(...args)=>{window.__cues.push({cue:args[0],at:performance.now(),presentation:app.presentationMs});return play(...args)};
      app.start();`) });
  });
  if (audioCapture) await page.addInitScript(() => {
    // Mirror the real master output for QA. Original speaker connection/policy
    // stays intact. No context is created until GameAudio activates on a gesture.
    const NativeContext = window.AudioContext, connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args) {
      const result = connect.apply(this, args);
      if (window.__audio && args[0] === window.__audio.context.destination)
        connect.call(this, window.__audio.capture);
      return result;
    };
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        const capture = this.createMediaStreamDestination(), chunks = [];
        const recorder = new MediaRecorder(capture.stream, { mimeType: 'audio/webm;codecs=opus' });
        window.__audio = { context: this, capture, recorder, chunks, startedEpochMs: Date.now(), resumeCalls: 0 };
        const resume = this.resume.bind(this);
        this.resume = () => { window.__audio.resumeCalls++; return resume(); };
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.start();
      }
    };
  });
  await page.goto(url + '/' + query);
  await page.waitForSelector('.game-start-overlay');
  await page.waitForFunction(() => window.__testApp.renderer.renderer.info.render.calls > 0);
  return page;
}
const sample = page => page.evaluate(() => {
  const a = window.__testApp, s = a.simulation.getState();
  return { tick: s.tick, elapsed: s.elapsedSeconds, presentation: a.presentationMs,
    startup: a.startup, paused: a.paused, state: s, cues: window.__cues.slice(),
    audio: a.audio.context?.state ?? null, stats: a.renderer.getDebugStats() };
});
try {
  const page = await open({ audioCapture: true });
  const cdp = await page.context().newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', async event => {
    const file = `frames/${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ file, epochMs: event.metadata.timestamp * 1000 });
    writeFileSync(`${out}/${file}`, Buffer.from(event.data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
  const initial = await sample(page);
  await page.screenshot({ path: `${out}/pre-start-390.png` });
  await page.waitForTimeout(3000);
  const waited = await sample(page);
  await page.screenshot({ path: `${out}/pre-start-after-3s.png` });
  await page.waitForTimeout(2000);
  const fiveSeconds = await sample(page);
  assert(JSON.stringify(initial.state) === JSON.stringify(fiveSeconds.state), 'Simulation changed while waiting');
  assert(fiveSeconds.presentation === 0 && fiveSeconds.cues.length === 0 && fiveSeconds.audio === null, 'Pre-start clocks/audio advanced');
  const tapEpochMs = Date.now();
  await page.touchscreen.tap(195, 480);
  await page.waitForFunction(() => window.__testApp.startup === 'started');
  await page.screenshot({ path: `${out}/immediate-post-tap.png` });
  await page.waitForTimeout(1800);
  const started = await sample(page);
  assert(started.tick > 0 && started.audio === 'running' && started.cues.some(c => c.cue === 'rifle'), 'First volley/audio missing');
  assert(await page.locator('.game-start-overlay').count() === 0, 'Overlay left steady-state DOM');
  await page.getByRole('button', { name: 'Pause game' }).click();
  const paused = await sample(page); await page.waitForTimeout(300);
  assert((await sample(page)).tick === paused.tick, 'Pause changed');
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForTimeout(700);
  // Exercise the actual Retry button without waiting for a natural defeat.
  await page.evaluate(() => {
    const a = window.__testApp, s = a.simulation.getState();
    s.squad = { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 };
    s.weapons.rifleMemberCooldowns = []; a.simulation.restoreState(s);
  });
  const retryEpochMs = Date.now();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForTimeout(1000);
  const retried = await sample(page);
  const calls = await page.evaluate(() => window.__audio.resumeCalls);
  assert(retried.tick > 0 && retried.audio === 'running' && calls === 1, 'Retry needs another activation');
  assert(await page.locator('.game-start-overlay').count() === 0, 'Retry re-gated');
  await page.screenshot({ path: `${out}/retry-running.png` });
  const stoppedEpochMs = Date.now();
  await cdp.send('Page.stopScreencast');
  const captured = await page.evaluate(async () => {
    const a = window.__audio;
    const stopped = new Promise(resolve => { a.recorder.onstop = resolve; });
    a.recorder.stop(); await stopped;
    const bytes = new Uint8Array(await new Blob(a.chunks).arrayBuffer());
    const decoded = await a.context.decodeAudioData(bytes.buffer.slice(0));
    const channel = decoded.getChannelData(0), windows = [];
    const size = Math.round(decoded.sampleRate * .01);
    for (let i = 0; i < channel.length; i += size) {
      let sum = 0; for (let j = i; j < Math.min(i + size, channel.length); j++) sum += channel[j] ** 2;
      windows.push({ ms: i / decoded.sampleRate * 1000, rms: Math.sqrt(sum / size) });
    }
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { data: btoa(binary), startedEpochMs: a.startedEpochMs, windows, duration: decoded.duration };
  });
  writeFileSync(`${out}/native-browser-audio.webm`, Buffer.from(captured.data, 'base64'));
  const timing = { frames, tapEpochMs, retryEpochMs, audioStartedEpochMs: captured.startedEpochMs, stoppedEpochMs,
    firstSignalMs: captured.windows.find(w => w.rms > .0001)?.ms, rms10ms: captured.windows };
  writeFileSync(`${out}/recording-timing.json`, JSON.stringify(timing, null, 2));
  assert(timing.firstSignalMs < 150, 'Audio joins late');
  results.wait = { initial, waited, fiveSeconds, started, retried, resumeCalls: calls, firstSignalMs: timing.firstSignalMs };
  await page.close();
  for (const [name, options, gesture] of [
    ['mouse', { mobile: false }, p => p.mouse.click(195, 480)],
    ['enter', { mobile: false }, p => p.keyboard.press('Enter')],
    ['space', { mobile: false }, p => p.keyboard.press('Space')],
    ['narrow-touch', { width: 350 }, p => p.touchscreen.tap(175, 480)],
    ['threats', { query: '?review=threats' }, p => p.touchscreen.tap(195, 480)],
  ]) {
    const p = await open(options);
    if (name === 'narrow-touch') await p.screenshot({ path: `${out}/pre-start-350.png` });
    await gesture(p); await p.waitForFunction(() => window.__testApp.simulation.getState().tick > 0);
    await p.waitForTimeout(200);
    const state = await sample(p);
    assert(!state.paused && state.audio === 'running', name + ' activation');
    results.inputs[name] = state;
    if (name === 'mouse') {
      // Controls are usable after the start surface leaves.
      await selectDevFixture(p, 'heavy');
      results.lab = await sample(p);
      assert(results.lab.state.progression.level === 3 && results.lab.state.squad.count === 1, 'Lab after startup');
    }
    await p.close();
  }
  assert(!results.errors.length, results.errors.join('\n'));
  writeFileSync(`${out}/audio-start-sanity.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }

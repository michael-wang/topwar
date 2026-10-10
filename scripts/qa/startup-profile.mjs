// QA-only production instrumentation. No route interception: Chromium HTTP cache stays enabled.
import { build, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const phase = process.argv[2] ?? 'after', out = resolve(process.env.TOPWAR_STARTUP_OUT ?? `artifacts/p3b3/${phase}`);
mkdirSync(out, { recursive: true });
await build({ build: { outDir: `${out}/dist` }, plugins: [{
  name: 'startup-qa-only', enforce: 'pre', transform(source, id) {
    const mark = name => `performance.mark('qa:${name}');`;
    if (id.endsWith('/src/main.ts')) source = source.replace('const configStore =', `${mark('main')}const configStore =`)
      .replace('app.start();', `window.__testApp=app;app.start();${mark('start-overlay')}`);
    if (id.endsWith('/src/config/ConfigStore.ts')) source = source.replace('async load(): Promise<void> {', `async load(): Promise<void> {${mark('config-start')}`)
      .replace('this.effective = effective;', `this.effective = effective;${mark('config-end')}`);
    if (id.endsWith('/src/level/LevelLoader.ts')) source = source.replace('let data: unknown;', `${mark('level-start')}let data: unknown;`)
      .replace('return parsed.data;', `${mark('level-end')}return parsed.data;`);
    if (id.endsWith('/src/rendering/CharacterAssets.ts')) source = source.replace('const loader = new GLTFLoader();', `${mark('assets-start')}const loader = new GLTFLoader();`)
      .replace('const player = createChibiPlayerFamily();', `${mark('glbs-end')}const player = createChibiPlayerFamily();`);
    if (id.endsWith('/src/app/GameApp.ts')) source = source.replace('this.renderer = new GameRenderer(viewport, assets);', `${mark('renderer-start')}this.renderer = new GameRenderer(viewport, assets);${mark('renderer-end')}`);
    if (id.endsWith('/src/rendering/GameRenderer.ts')) source = source.replace('if (this.disposed) return;', `if (this.disposed) return; const qaFirst=!performance.getEntriesByName('qa:scene-start').length;if(qaFirst){${mark('scene-start')}}`)
      .replace('this.renderer.render(this.scene, this.camera);', `if(qaFirst){${mark('scene-end')}}this.renderer.render(this.scene, this.camera);if(qaFirst){${mark('first-render')}}`);
    if (id.includes('/GLTFLoader.js')) source = source.replace('parse( data, path, onLoad, onError ) {', `parse( data, path, onLoad, onError ) { const qaStart=performance.now(),qaLoad=onLoad;onLoad=(gltf)=>{performance.measure('qa:glb-parse',{start:qaStart,end:performance.now()});qaLoad(gltf);};`);
    return source;
  },
}] });
const server = await preview({ build: { outDir: `${out}/dist` }, preview: { host: '127.0.0.1', port: 5183, strictPort: true }, plugins: [{
  name: 'representative-static-cache', configurePreviewServer(s) {
    s.middlewares.use((req, res, next) => { if (!req.url?.split('?')[0].endsWith('/')) res.setHeader('Cache-Control', 'public, max-age=600'); next(); });
  },
}] });
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const width of [350, 390]) for (let repeat = 0; repeat < 3; repeat++) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, connectionType: 'cellular4g' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      const q = window.__qa = { speech: [], decodes: [], portraits: {}, tap: null, interactive: null, panel: null, blankFrames: 0, shadersMs: 0 };
      document.addEventListener('pointerdown', () => q.tap ??= performance.now(), true);
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function(bytes, ...args) {
        const row = { bytes: bytes.byteLength, start: performance.now() }; q.decodes.push(row);
        return decode.call(this, bytes, ...args).then(buffer => { row.end = performance.now(); return buffer; });
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        if (window.__testApp?.audio.voice?.source === this) {
          const img = document.querySelector('.field-observer img:not([hidden])');
          q.speech.push({ at: performance.now(), offset: args[1] ?? 0, portraitReady: !!img?.complete && img.naturalWidth > 0 });
        }
        return start.apply(this, args);
      };
      const decodeImage = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function() { const at = performance.now(); return decodeImage.call(this).then(() => { if (this.src.includes('/observer/')) q.portraits[this.src] = { start: at, ready: performance.now() }; }); };
      for (const key of ['compileShader', 'linkProgram', 'getProgramParameter']) {
        const native = WebGL2RenderingContext.prototype[key];
        WebGL2RenderingContext.prototype[key] = function(...args) { const at=performance.now();try{return native.apply(this,args);}finally{q.shadersMs+=performance.now()-at;} };
      }
      const poll = () => {
        if (window.__testApp?.startup === 'started') q.interactive ??= performance.now();
        const panel = document.querySelector('.field-observer');
        if (panel && !panel.hidden) {
          q.panel ??= performance.now();const img=panel.querySelector('img:not([hidden])');
          if (!img?.complete || !img.naturalWidth) q.blankFrames++;
          else q.firstVisiblePortrait ??= performance.now();
        }
        requestAnimationFrame(poll);
      };requestAnimationFrame(poll);
    });
    for (const cache of ['cold', 'warm']) {
      const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
      await page.goto('http://127.0.0.1:5183/topwar/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => performance.getEntriesByName('qa:first-render').length > 0);
      await page.getByRole('button', { name: 'Start game with audio' }).tap();
      await page.waitForFunction(() => window.__qa.speech.length > 0 || window.__testApp.simulation.getState().elapsedSeconds > 3.5);
      await page.waitForTimeout(700);
      const data = await page.evaluate(() => ({ qa: window.__qa, marks: performance.getEntriesByType('mark').map(({ name, startTime }) => ({ name, startTime })), parses: performance.getEntriesByName('qa:glb-parse').map(e=>e.duration), resources: performance.getEntriesByType('resource').map(({ name, startTime, responseStart, responseEnd, transferSize, encodedBodySize, decodedBodySize }) => ({ name, startTime, responseStart, responseEnd, transferSize, encodedBodySize, decodedBodySize })) }));
      assert.deepEqual(errors, []);
      if (phase === 'after') { assert.equal(data.qa.blankFrames, 0); assert.equal(data.qa.speech.length, 1); assert.equal(data.qa.speech[0].offset, 0); assert(data.qa.speech[0].portraitReady); }
      const m=Object.fromEntries(data.marks.map(e=>[e.name.slice(3),e.startTime]));
      const row={width,repeat,cache,navToStart:m['start-overlay'],navToFirstFrame:m['first-render'],tapToInteractive:data.qa.interactive-data.qa.tap,rendererMs:m['renderer-end']-m['renderer-start'],sceneMs:m['scene-end']-m['scene-start'],firstRenderMs:m['first-render']-m['scene-end'],transferBytes:data.resources.reduce((s,r)=>s+r.transferSize,0),requests:data.resources.length,...data};
      results.push(row);writeFileSync(`${out}/startup.json`,JSON.stringify(results,null,2));
      if(repeat===0)await page.screenshot({path:`${out}/${width}-${cache}.png`});
      console.log(JSON.stringify({width,repeat,cache,start:row.navToStart,first:row.navToFirstFrame,tap:row.tapToInteractive,bytes:row.transferBytes,requests:row.requests,blankFrames:data.qa.blankFrames}));
      page.off('pageerror',listener);
    }
    await context.close();
  }
} finally { await browser.close(); await new Promise(r=>server.httpServer.close(r)); }

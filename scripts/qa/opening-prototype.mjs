// Real GameApp/Simulation; instrumentation is confined to intercepted DEV responses.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p4.44f';mkdirSync(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5177,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--window-size=500,1000','--auto-select-tab-capture-source-by-title=TopWar','--enable-usermedia-screen-capturing','--allow-http-screen-capture','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];const errors=[];
async function pageFor(width,query='?opening-review=1',variant='normal',video=false){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:variant!=='recording',hasTouch:true,reducedMotion:variant==='reduced'?'reduce':'no-preference',...(video?{recordVideo:{dir:out,size:{width,height:844}}}:{})});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app = new GameApp(','app = window.__testApp = new GameApp(')});});
 await page.route(/\/src\/app\/GameApp\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('crypto.getRandomValues(randomWord);','randomWord[0] = 17476;')});});
 if(variant==='insets')await page.route(/\/src\/style\.css(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/env\(safe-area-inset-top(?:,[^)]*)?\)/g,'24px').replace(/env\(safe-area-inset-bottom(?:,[^)]*)?\)/g,'20px')});});
 await page.goto(`http://127.0.0.1:5177/${query}`);await page.getByRole('button',{name:'開始遊戲',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
 return page;
}
async function freeze(page){await page.evaluate(()=>{
 const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__stamp=a.previousFrameTimestampMs??performance.now();
 window.__advance=seconds=>{const gpu=a.renderer.renderer,draw=gpu.render;gpu.render=()=>{};try{for(let i=0;i<Math.ceil(seconds*60);i++){window.__stamp+=1000/60;a.renderFrame(window.__stamp);cancelAnimationFrame(a.frameId);}}finally{gpu.render=draw;}a.renderFrame(window.__stamp);cancelAnimationFrame(a.frameId);};
});}
async function start(page){await page.getByRole('button',{name:'開始遊戲',exact:true}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');await freeze(page);await page.locator('.game-start-overlay').waitFor({state:'detached'});}
async function inspect(page){return page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState(),e=document.querySelector('.field-observer'),r=e.getBoundingClientRect();return{state:JSON.stringify(s),tick:s.tick,elapsed:s.elapsedSeconds,opening:!!a.invasion,seconds:a.openingSeconds,count:a.invasion?.state.enemies.length,paused:a.paused,ships:a.renderer.environment.transports.ships.map(s=>({x:s.position.x,z:s.position.z})),stats:a.renderer.getDebugStats(),panel:{x:r.x,y:r.y,width:r.width,height:r.height},subtitle:e.querySelector('p').textContent,voice:a.audio.voice?.message,red:!!document.querySelector('.opening-alert'),skip:!!document.querySelector('.commander-skip:not([hidden])')};});}
async function finish(page){await page.evaluate(()=>{const a=window.__testApp,gpu=a.renderer.renderer,draw=gpu.render;gpu.render=()=>{};try{let n=0;while(a.invasion&&n++<1200)window.__advance(1/60);if(a.invasion)throw Error('Opening hung');}finally{gpu.render=draw;}gpu.render(a.renderer.scene,a.renderer.camera);});}
try{
 for(const width of [350,390])for(const variant of ['normal','insets','reduced']){
  console.log(`Checking ${width} ${variant}`);
  const page=await pageFor(width,'?opening-review=1',variant);const before=await inspect(page);await start(page);
  const phases=[];
  for(const target of [.6,4.5,5.12,6.9,11.1]){
   await page.evaluate(target=>window.__advance(Math.max(0,target-window.__testApp.openingSeconds)),target);
   const d=await inspect(page);assert.equal(d.state,before.state);assert(d.red);phases.push(d);
   if(variant==='normal'&&width===390)await page.screenshot({path:`${out}/opening-${target}.png`});
  }
  assert.equal(phases[0].count,0);assert.equal(phases[1].count,0);assert.equal(phases[2].count,1);assert.equal(phases[3].count,6);assert.equal(phases[4].count,16);
  assert.equal(phases[4].panel.width,310);assert.equal(phases[4].panel.height,88);
  assert(Math.abs(phases[4].panel.y-(844*.5-41+(variant==='insets'?(24-20)*.5:0)))<.1);
  const resources=await page.evaluate(()=>{const a=window.__testApp,samples=[];for(let i=0;i<12;i++){a.renderer.renderInvasion(a.invasion.sample(11.1),11.1,!!a.reducedMotion?.matches);samples.push(a.renderer.getDebugStats());}return samples;});
  assert.equal(resources[0].geometries,resources.at(-1).geometries);assert.equal(resources[0].textures,resources.at(-1).textures);
  await finish(page);const handoff=await inspect(page);assert.equal(handoff.state,before.state);assert(!handoff.red&&!handoff.skip);
  await page.evaluate(()=>window.__advance(0)); // First regular render remains T=0.
  assert.equal((await inspect(page)).tick,0);
  if(variant==='normal'&&width===390)await page.screenshot({path:`${out}/opening-handoff.png`});
  await page.evaluate(()=>window.__advance(2));const after=await inspect(page);
  const control=await pageFor(width,'',variant);await start(control);await control.evaluate(()=>{const a=window.__testApp;a.retry();cancelAnimationFrame(a.frameId);});
  // New Game seed is 17476; restore the same T=0 snapshot into the control,
  // retaining production app clocks and original fixed-step code.
  await control.evaluate(state=>{const a=window.__testApp;a.simulation.restoreState(JSON.parse(state));a.presentationMs=0;a.previousFrameTimestampMs=null;window.__advance(0);window.__advance(2);},before.state);
  const baseline=await inspect(control);
  writeFileSync(`${out}/trace-comparison.json`,JSON.stringify({trial:JSON.parse(after.state),baseline:JSON.parse(baseline.state)},null,2));
  assert.deepEqual(JSON.parse(baseline.state),JSON.parse(after.state));
  await control.context().close();
  await page.evaluate(()=>{const a=window.__testApp;a.retry();cancelAnimationFrame(a.frameId);});assert(!(await inspect(page)).opening);
  results.push({width,variant,phases:phases.map(({state,...r})=>r),handoffT0:true,first120TicksMatch:true,retryBypasses:true,resourcesStable:true});await page.context().close();
 }
 // Optional audio rejection and bounded loading fallback, Skip + suspension races.
 for(const mode of ['denied','pending','skip']){
  console.log(`Checking ${mode}`);
  const page=await pageFor(390);const initial=await inspect(page);
  await page.evaluate(mode=>{const a=window.__testApp;if(mode==='denied'){a.audio.activate=()=>Promise.reject(Error('QA denied'));a.audio.prepareRadio=()=> 'unavailable';}if(mode==='pending')a.audio.prepareRadio=()=> 'pending';},mode);
  await start(page);await page.evaluate(()=>window.__advance(1.5));assert(await page.getByRole('button',{name:'跳過開場簡報，開始遊戲'}).isVisible());
  const pausedAt=(await inspect(page)).seconds;
  await page.evaluate(()=>{const a=window.__testApp;Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.__advance(3);});
  assert.equal((await inspect(page)).seconds,pausedAt);assert.equal((await inspect(page)).state,initial.state);
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));window.__advance(1);});assert((await inspect(page)).paused);
  await page.evaluate(()=>{window.__testApp.togglePaused();window.__advance(0);});
  if(mode==='skip'){
   await page.getByRole('button',{name:'跳過開場簡報，開始遊戲'}).tap();
   await page.evaluate(()=>{const a=window.__testApp;a.skipOpening();a.onContextLost();window.__advance(1);});assert((await inspect(page)).opening);assert((await inspect(page)).paused);
   await page.evaluate(()=>{const a=window.__testApp;a.onContextRestored();a.togglePaused();});
  }
  await finish(page);const end=await inspect(page);assert.equal(end.state,initial.state);assert(!end.red&&!end.skip);
  assert(end.seconds< (mode==='pending'?14.4:mode==='skip'?1.9:12));
  results.push({mode,seconds:end.seconds,T0:true,hiddenResume:true,skipRace:mode==='skip'});await page.context().close();
 }
 console.log('Checking review bypass and original Boss route');
 const fixtures=await pageFor(390);await start(fixtures);
 for(const fixture of ['naval','boss-intro','air-support','victory','giant']){
  await fixtures.evaluate(fixture=>{const a=window.__testApp;a.devReviewFixture=fixture;a.retry();cancelAnimationFrame(a.frameId);window.__advance(1.2);},fixture);
  const d=await inspect(fixtures);assert(!d.opening&&!d.red);assert.notEqual(d.voice,'missionIntro');
  if(fixture==='giant'){
   await fixtures.waitForFunction(()=>window.__testApp.audio.voice?.message==='giant'&&window.__testApp.audio.voice.source!==null);
   const duration=await fixtures.evaluate(()=>window.__testApp.audio.voice.source.buffer.duration);
   assert(Math.abs(duration-4.3624375)<.002);
  }
  if(fixture==='boss-intro')await fixtures.screenshot({path:`${out}/opening-boss.png`});
  results.push({fixture,bypasses:true,ships:d.ships});
 }
 await fixtures.context().close();
 console.log('Checking save preservation and Continue');
 // Preserve an older valid checkpoint while a fresh trial intro is unsaved.
 const savePage=await pageFor(390);await start(savePage);await finish(savePage);await savePage.evaluate(()=>{window.__advance(1);window.__testApp.setPaused(true);window.__testApp.saveCheckpoint('pause');});
 await savePage.reload();await savePage.getByRole('button',{name:'重新開始',exact:true}).waitFor();
 const stored=await savePage.evaluate(()=>JSON.stringify({...localStorage}));
 await savePage.getByRole('button',{name:'重新開始',exact:true}).tap();await savePage.getByRole('button',{name:'開始遊戲',exact:true}).waitFor();await start(savePage);await savePage.evaluate(()=>{window.__advance(3);window.__testApp.setPaused(true);window.__testApp.saveCheckpoint('pause');});assert.equal(await savePage.evaluate(()=>JSON.stringify({...localStorage})),stored);
 await savePage.reload();await savePage.getByRole('button',{name:'繼續上次遊戲',exact:true}).tap();await savePage.waitForFunction(()=>window.__testApp?.startup==='started');assert((await inspect(savePage)).paused);assert(!(await inspect(savePage)).opening);results.push({oldCheckpointPreserved:true,continueBypassesPaused:true});await savePage.context().close();
 console.log('Checking historical cohorts and A2 reference');
 for(const width of [350,390]) {
  const page=await pageFor(width,'');await start(page);await page.evaluate(()=>{window.__advance(1);window.__testApp.setPaused(true);window.__testApp.saveCheckpoint('pause');});
  const historical=(await inspect(page)).state;assert(JSON.parse(historical).enemies.length>16);
  await page.goto('http://127.0.0.1:5177/?opening-review=1');await page.getByRole('button',{name:'繼續上次遊戲',exact:true}).tap();await page.waitForFunction(()=>window.__testApp?.startup==='started');
  const continued=await inspect(page);assert(continued.paused&&!continued.opening);assert.deepEqual(JSON.parse(continued.state),JSON.parse(historical));
  await page.waitForFunction(()=>!window.__testApp.recovery?.blocking);
  await page.evaluate(()=>{window.__testApp.retry();cancelAnimationFrame(window.__testApp.frameId);});
  const retried=await inspect(page);assert.equal(JSON.parse(retried.state).enemies.length,16);assert.equal(retried.tick,0);assert(!retried.opening);
  results.push({width,historicalCohortPreserved:true,retryRealCohort:true});await page.context().close();
 }
 const a2=await pageFor(390,'?opening-review=1&commander-placement=a2');await start(a2);await a2.evaluate(()=>window.__advance(2));
 const reference=await inspect(a2);assert(Math.abs(reference.panel.y-844*.56)<.1);assert.equal(reference.panel.width,310);assert.equal(reference.panel.height,88);results.push({a2Preserved:true});await a2.context().close();
 console.log('Recording continuous opening');
 // Capture actual viewport frames + the live WebAudio master on one MediaRecorder clock.
 const video=await pageFor(390,'?opening-review=1','recording');
 // Windowed portrait capture avoids Chrome mobile-emulation fullscreen scaling.
 await video.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Windowed QA recording'));});
 const captureSession=await video.context().newCDPSession(video);
 const captureResult=await captureSession.send('Runtime.evaluate',{expression:"navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:30},audio:false,preferCurrentTab:true}).then(async s=>{window.__captureStream=s;await s.getVideoTracks()[0].applyConstraints({width:{exact:390},height:{exact:844},frameRate:{min:24,ideal:30,max:30}});return s.getVideoTracks()[0].getSettings()})",awaitPromise:true,userGesture:true,returnByValue:true});
 assert(!captureResult.exceptionDetails,JSON.stringify(captureResult));
 await video.evaluate(async()=>{

  const a=window.__testApp,activate=a.audio.activate.bind(a.audio);
  a.audio.activate=()=>{const result=activate();if(!window.__recorder&&a.audio.context&&a.audio.master){
   const destination=a.audio.context.createMediaStreamDestination();a.audio.master.connect(destination);
   window.__captureStream.addTrack(destination.stream.getAudioTracks()[0]);
   const chunks=[];const recorder=new MediaRecorder(window.__captureStream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:1800000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   window.__recorded=new Promise(resolve=>recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);resolve(btoa(binary));destination.disconnect();window.__captureStream.getTracks().forEach(t=>t.stop());});
   window.__recorder=recorder;recorder.start();
  }return result;};
 });
 await video.getByRole('button',{name:'開始遊戲',exact:true}).tap();
 const started=Date.now();await video.waitForFunction(()=>window.__testApp.startup==='started'&&!window.__testApp.invasion,null,{timeout:35000});await video.waitForTimeout(3000);
 const bytes=await video.evaluate(async()=>{window.__recorder.stop();return await window.__recorded;});
 writeFileSync(`${out}/opening-full.webm`,Buffer.from(bytes,'base64'));results.push({audiovisual:true,capture:captureResult.result.value,wallSeconds:(Date.now()-started)/1000});await video.context().close();
 assert.deepEqual(errors,[]);
 writeFileSync(`${out}/index.html`,`<!doctype html><meta charset="utf-8"><title>TopWar P4.44f</title><style>body{background:#102532;color:#f4efdc;font:18px system-ui;margin:24px}video{max-height:844px;max-width:100%;display:block}a{color:#99dfff}</style><h1>P4.44f — True Individual Landings</h1><p>DEV 真實初始隊伍 16 人，逐人從浪線上岸，正常速度前進。完整開場與其後 3 秒實際 Gameplay，含遊戲即時音軌。正式版不變；Pixel 8 敵軍登陸藝術驗收待定。</p><video controls preload="metadata" src="opening-full.webm"></video><p><a href="opening-results.json">回歸檢查</a> · <a href="http://localhost:5173/?opening-review=1">Pixel 8 DEV 入口</a></p>`);
}finally{writeFileSync(`${out}/opening-results.json`,JSON.stringify({results,errors},null,2));await browser.close();await server.close();}
console.log(`Opening checks passed: ${results.length} scenarios.`);

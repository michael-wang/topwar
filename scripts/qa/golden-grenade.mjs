import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const glInspect=process.argv.includes('--gl'),record=!process.argv.includes('--no-record')&&!glInspect,out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??`artifacts/qa/golden-grenade${glInspect?'-gl':!record?'-timing':''}`;mkdirSync(out,{recursive:true});
const server=await createServer({cacheDir:`${out}/cache`,server:{host:'127.0.0.1',port:5187,strictPort:true,watch:{ignored:['**/artifacts/**']}}});await server.listen();
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const width of [350,390])for(const role of glInspect?['survival10-ahead']:['crate3','survival8-ahead','survival10-ahead']){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto('http://127.0.0.1:5187/');await page.getByRole('button',{name:'開始遊戲'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(({role,glInspect})=>{
  const a=window.__testApp;cancelAnimationFrame(a.frameId);a.devReviewFixture=role;a.retry();cancelAnimationFrame(a.frameId);
  const gpu=a.renderer.renderer,native=gpu.render;gpu.render=()=>{};let stamp=0;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);
  const ticks=role==='crate3'?600:role==='survival10-ahead'?960:120;
  for(let i=0;i<ticks;i++){stamp+=1000/60;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);}
  gpu.render=native;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();
  document.querySelector('#game-viewport').style.setProperty('--hud-inset-bottom','34px');
  window.__throwQA={cues:[],confirms:[],rows:[],gl:[]};const play=a.audio.play.bind(a.audio);
  if(glInspect){const gl=gpu.getContext();for(const method of ['compileShader','linkProgram','getProgramParameter','getShaderParameter','getActiveUniform','getUniformLocation']){
   const native=gl[method].bind(gl);gl[method]=(...args)=>{const at=performance.now();try{return native(...args);}finally{window.__throwQA.gl.push({method,at,ms:performance.now()-at,tick:a.simulation.getFrameState().tick});}};
  }}
  a.audio.play=(cue,...args)=>{window.__throwQA.cues.push({cue,ms:performance.now(),tick:a.simulation.getFrameState().tick,audio:a.audio.context.currentTime});play(cue,...args);};
  if(a.grenadeButton.presentThrow){const show=a.grenadeButton.presentThrow.bind(a.grenadeButton);a.grenadeButton.presentThrow=now=>{window.__throwQA.confirms.push({now,tick:a.simulation.getFrameState().tick});show(now);};}
  const render=a.renderFrame;a.renderFrame=stamp=>{const start=performance.now();render(stamp);const s=a.simulation.getFrameState();
   window.__throwQA.rows.push({stamp,cpu:performance.now()-start,tick:s.tick,enemies:s.enemies.length,projectiles:s.projectiles.length,flight:!!s.grenade.flight,calls:a.renderer.renderer.info.render.calls,triangles:a.renderer.renderer.info.render.triangles});};
  a.frameId=requestAnimationFrame(a.renderFrame);
 },{role,glInspect});
 await page.waitForTimeout(2500);
 const stateBefore=await page.evaluate(()=>window.__testApp.simulation.getState());assert(stateBefore.squad.count>0);assert(stateBefore.grenade.inventory>0);
 if(role==='crate3')assert(stateBefore.grenade.acquiredAtSeconds!==null);
 const networkAt=requests.length;const stopRecord=record?await startGameRecording(page,width):null;
 const input=role==='survival8-ahead'?'q':'button';
 const trigger=async()=>{if(input==='q')await page.keyboard.press('q');else await page.locator('.grenade-button').tap({force:true});};
 const launchAt=await page.evaluate(()=>performance.now());await trigger();
 await page.waitForFunction(()=>!!window.__testApp.simulation.getFrameState().grenade.flight);
 await page.evaluate(()=>{const a=window.__testApp;assertFlight();a.requestGrenade();document.querySelector('.grenade-button').click();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'q',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'q',bubbles:true}));
  function assertFlight(){if(!a.simulation.getFrameState().grenade.flight)throw Error('Blocked-input check requires an active flight');}});
 const flying=await page.evaluate(()=>({state:window.__testApp.simulation.getState(),thrown:document.querySelector('.grenade-button').classList.contains('grenade-thrown')}));
 assert.equal(flying.state.grenade.inventory,stateBefore.grenade.inventory-1);assert(flying.thrown);
 await page.screenshot({path:`${out}/${width}-${role}-launch.png`});
 await page.waitForFunction(()=>!window.__testApp.simulation.getFrameState().grenade.flight);await page.waitForTimeout(350);
 const first=await page.evaluate(({launchAt})=>{
  const q=window.__throwQA,rows=q.rows.filter(r=>r.stamp>=launchAt-500&&r.stamp<=launchAt+2000),times=rows.slice(1).map((r,i)=>r.stamp-rows[i].stamp).sort((a,b)=>a-b);
  return{cues:q.cues.filter(e=>e.ms>=launchAt),confirms:q.confirms,gl:q.gl.filter(e=>e.at>=launchAt),frames:times.length,mean:times.reduce((a,b)=>a+b,0)/times.length,p95:times[Math.floor(times.length*.95)],max:times.at(-1),over100:times.filter(n=>n>100).length,over200:times.filter(n=>n>200).length,rows};
 },{launchAt});
 assert.equal(first.cues.filter(e=>e.cue==='grenadeExplosion').length,1);
 assert.equal(first.cues.filter(e=>e.cue==='grenadeLaunch').length,1);assert.equal(first.confirms.length,1);
 const feedbackRequests=requests.slice(networkAt).filter(u=>/\.(glb|webp|png|mp3|ogg|wav)(\?|$)/.test(u));assert.deepEqual(feedbackRequests,[]);
 // A second real throw, then Pause/reload in flight: restoration must not replay release feedback.
 if(await page.evaluate(()=>window.__testApp.simulation.getFrameState().grenade.inventory>0)){
  await trigger();await page.waitForFunction(()=>!!window.__testApp.simulation.getFrameState().grenade.flight);
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  const saved=await page.evaluate(()=>{cancelAnimationFrame(window.__testApp.frameId);return window.__testApp.simulation.getState();});assert(saved.grenade.flight);
  if(stopRecord){const recordingInfo=await page.evaluate(()=>({frames:window.__capture.frames,chunks:window.__capture.chunks.map(c=>c.size),audio:window.__testApp.audio.context.state,elapsed:performance.now()-window.__capture.startedAt}));writeFileSync(`${out}/${width}-${role}-capture.json`,JSON.stringify(recordingInfo,null,2));const bytes=await stopRecord();writeFileSync(`${out}/${width}-${role}.webm`,bytes);assert(bytes.length>1000,'Capture must contain actual encoded media');await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-${role}`,[.9,1.3]);}
  if(role==='survival10-ahead'){const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame()});server.ws.send({type:'full-reload'});await navigation;}
  else await page.reload();
  await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved);
  const restore=await page.evaluate(()=>{const a=window.__testApp,cues=[],play=a.audio.play.bind(a.audio);a.audio.play=(cue,...args)=>{cues.push(cue);play(cue,...args);};window.__restoredCues=cues;return{paused:a.paused,flash:document.querySelector('.grenade-button').classList.contains('grenade-thrown'),audio:a.audio.context?.state??'not-created'};});
  assert(restore.paused&&!restore.flash);assert.equal(restore.audio,'not-created');
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();await page.waitForFunction(()=>!window.__testApp.simulation.getFrameState().grenade.flight);
  const cues=await page.evaluate(()=>window.__restoredCues);assert(!cues.includes('grenadeLaunch'));assert.equal(cues.filter(c=>c==='grenadeExplosion').length,1);
  await page.evaluate(()=>{const a=window.__testApp;a.retry();cancelAnimationFrame(a.frameId);});assert.equal(await page.locator('.grenade-thrown').count(),0);
 }else if(stopRecord){writeFileSync(`${out}/${width}-${role}.webm`,await stopRecord());}
 assert.deepEqual(errors,[]);
 results.push({width,role,input,levelAtThrow:stateBefore.progression.level,enemies:stateBefore.enemies.length,inventoryBefore:stateBefore.grenade.inventory,first,feedbackRequests,errors});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await page.close();
 console.log(`${width} ${role}: one impact, one launch, safe in-flight restore`);
}}finally{await browser.close();await server.close();}

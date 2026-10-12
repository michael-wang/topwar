import { exposeProductionApp } from './production-app-hook.mjs';
// Shipping QA UI/recovery checks. Private app access and Wake Lock mocks exist
// only in intercepted test responses; no debug endpoint is shipped.
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { mkdirSync,writeFileSync } from 'node:fs';
import { startGameRecording,inspectRecordingFrames } from './browser-recording.mjs';
const out=process.argv[2]??'artifacts/p3b6b6/mobile';mkdirSync(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5196,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[];
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const state=page=>page.evaluate(()=>window.__testApp.simulation.getState());
const key='topwar:session:v1:release';
async function install(page,platform='mock'){
  await exposeProductionApp(page);
  await page.addInitScript(platform=>{
    window.__wake={requests:0,releases:0,held:[],mode:platform};
    if(platform==='insecure')Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});
    Object.defineProperty(navigator,'wakeLock',{configurable:true,value:platform==='unsupported'?undefined:{request:async()=>{
      window.__wake.requests++;if(platform==='denied')throw new DOMException('Test denial','NotAllowedError');
      const sentinel=new EventTarget();sentinel.released=false;
      sentinel.release=async()=>{if(!sentinel.released){sentinel.released=true;window.__wake.releases++;sentinel.dispatchEvent(new Event('release'));}};
      window.__wake.held.push(sentinel);return sentinel;
    }}});
  },platform);
}
async function start(page){await page.goto('http://127.0.0.1:5196/topwar/');await button(page,'Start game with audio').tap();await page.waitForFunction(()=>window.__testApp.startup==='started');}
async function sleepFixture(page){await page.locator('.qa-panel>summary').tap();await button(page,'15 秒熄屏 / Resume 測試').tap();await button(page,'確認開始測試').tap();
  await page.waitForFunction(()=>window.__testApp.qaSleepActive&&!window.__testApp.qaPreparing&&document.querySelector('.qa-panel [role="status"]').textContent.includes('請勿觸碰'),{},{timeout:45000});}
function quantiles(values){const s=[...values].sort((a,b)=>a-b);return {mean:s.reduce((a,b)=>a+b,0)/s.length,p95:s[Math.floor(s.length*.95)],max:s.at(-1),over100:s.filter(x=>x>100).length,over200:s.filter(x=>x>200).length,frames:s.length};}
try{
 for(const width of [350,390]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await install(page);await start(page);
  await page.waitForFunction(()=>window.__testApp.wakeLock.status==='active');
  const hatch=await page.locator('.qa-panel>summary').boundingBox();assert.equal(hatch.width,44);assert.equal(hatch.height,44);assert(hatch.x>=0&&hatch.x+hatch.width<width);
  assert.equal(await page.locator('.dev-fps,.tuning-panel,.dev-survival-test,.dev-mg-test').count(),0);
  assert.equal(await page.locator('[aria-label="開發測試工具"]').count(),1);
  await page.screenshot({path:`${out}/${width}-hatch.png`});
  await button(page,'Pause game').tap();const ordinary=await state(page),normalSave=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('.qa-panel>summary').tap();await button(page,'15 秒熄屏 / Resume 測試').tap();await button(page,'取消').tap();
  assert.deepEqual(await state(page),ordinary);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),normalSave);
  await page.locator('.qa-panel>summary').tap();const begin=performance.now();await sleepFixture(page);
  const prepared=await state(page),boundary=requests.length;
  if(process.argv.includes('--phases-only')){
    await page.locator('.qa-panel>summary').tap();const shell=prepared.artillery.shells[0],samples=[];
    for(const [phase,seconds] of [['early',shell.launchedAtSeconds+.05],['middle',(shell.launchedAtSeconds+shell.impactAtSeconds)/2],['final150',shell.impactAtSeconds-.15],['pulse',shell.impactAtSeconds-.04]]){
      const sample=await page.evaluate(({seconds})=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.pauseOverlay.setVisible(false);
        const original=a.simulation.getFrameState.bind(a.simulation),s=original();a.simulation.getFrameState=()=>({...s,elapsedSeconds:seconds});
        a.renderFrame(performance.now());cancelAnimationFrame(a.frameId);a.simulation.getFrameState=original;
        const m=a.renderer.scene.getObjectByName('artillery-lane-danger');return {seconds,colors:Array.from(m.instanceColor.array.slice(0,m.count*3)),opacity:m.material.opacity,alphas:Array.from(m.geometry.getAttribute('warningOpacity').array.slice(0,m.count))};
      },{seconds});samples.push({phase,...sample});await page.screenshot({path:`${out}/${width}-warning-${phase}.png`});
    }
    assert.notDeepEqual(samples[0].colors,samples[2].colors);writeFileSync(`${out}/${width}-warning-phases.json`,JSON.stringify(samples,null,2));
    await page.close();continue;
  }
  const footprint=await page.evaluate(key=>{const a=window.__testApp,s=a.simulation.getState();
    const before=performance.now();a.saveCheckpoint('pause');const writeMs=performance.now()-before,text=localStorage.getItem(key),info=a.renderer.getDebugStats();
    return {seconds:s.elapsedSeconds,tick:s.tick,soldiers:s.squad.count,enemies:s.enemies.length,heavies:s.enemies.filter(e=>e.archetype==='heavy').length,
      projectiles:s.projectiles.length,shells:s.artillery.shells.length,writeMs,characters:text.length,utf8Bytes:new TextEncoder().encode(text).length,
      qa:JSON.parse(text).qa,info,wake:{requests:window.__wake.requests,releases:window.__wake.releases,active:window.__wake.held.filter(s=>!s.released).length}};
  },key);assert(footprint.enemies>=100&&footprint.heavies>10&&footprint.projectiles>=20&&footprint.shells>0);assert.equal(footprint.wake.active,0);
  await page.screenshot({path:`${out}/${width}-sleep-panel.png`});
  const touch=await page.locator('.qa-panel button').evaluateAll(buttons=>buttons.map(b=>({text:b.textContent,height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width})));
  assert(touch.filter(b=>b.width).every(b=>b.height>=44));
  await page.locator('.qa-panel>summary').tap();await page.screenshot({path:`${out}/${width}-sleep-scene.png`});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>{window.__pausedStamps=[];window.__pausedMeasure=true;
    const frame=stamp=>{if(window.__pausedMeasure){window.__pausedStamps.push(stamp);requestAnimationFrame(frame);}};requestAnimationFrame(frame);});
  await page.waitForTimeout(10000);
  const paused=await page.evaluate(()=>{window.__pausedMeasure=false;return {stamps:window.__pausedStamps,stats:window.__testApp.renderer.getDebugStats()};});
  const pausedFrameMs=quantiles(paused.stamps.slice(1).map((t,i)=>t-paused.stamps[i]));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();await page.locator('.qa-panel>summary').tap();
  await button(page,'Resume game').tap();await page.keyboard.press('Escape');await page.keyboard.press('q');await page.waitForTimeout(300);
  assert.deepEqual(await state(page),prepared);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);assert.deepEqual(await state(page),prepared);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  assert(await page.locator('.qa-panel').textContent().then(s=>s.includes('同一頁面返回')));
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    document.dispatchEvent(new Event('freeze'));document.dispatchEvent(new Event('resume'));});
  assert.deepEqual(await state(page),prepared);assert(await page.evaluate(()=>window.__testApp.paused&&window.__testApp.wakeLock.status==='released'));
  // Real WebGL loss/restoration, separate from simulated document lifecycle.
  await page.evaluate(()=>{window.__lose=window.__testApp.renderer.renderer.getContext().getExtension('WEBGL_lose_context');window.__lose.loseContext();});
  await page.waitForFunction(()=>window.__testApp.contextLost);await page.waitForTimeout(100);await page.evaluate(()=>window.__lose.restoreContext());
  await page.waitForFunction(()=>!window.__testApp.contextLost);assert.deepEqual(await state(page),prepared);
  const preparedMs=performance.now()-begin;
  await page.reload();await button(page,'繼續上次遊戲').tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  await page.waitForFunction(()=>window.__testApp.startup==='started');assert.deepEqual(await state(page),prepared);
  assert(await page.evaluate(()=>window.__testApp.qaSleepActive&&window.__testApp.paused&&window.__wake.requests===0));
  assert(await page.locator('.qa-panel').textContent().then(s=>s.includes('已重新載入')));
  await page.screenshot({path:`${out}/${width}-restored.png`});
  const restoredStats=await page.evaluate(()=>window.__testApp.renderer.getDebugStats());
  await button(page,'結束測試（保持暫停）').tap();assert(await page.evaluate(()=>window.__testApp.paused&&!window.__testApp.qaSleepActive));
  await page.locator('.qa-panel>summary').tap();await button(page,'Resume game').tap();await page.waitForFunction(()=>window.__testApp.wakeLock.status==='active');
  // Record complete real flights and phase colors. No simulation time scaling.
  await page.evaluate(()=>{window.__frames=[];const a=window.__testApp,original=a.renderFrame;
    a.renderFrame=stamp=>{original(stamp);const s=a.simulation.getFrameState(),mesh=a.renderer.scene.getObjectByName('artillery-lane-danger');
      window.__frames.push({stamp,seconds:s.elapsedSeconds,enemies:s.enemies.length,projectiles:s.projectiles.length,
        warnings:mesh?.count??0,opacity:mesh?.material.opacity,alphas:Array.from(mesh.geometry.getAttribute('warningOpacity').array.slice(0,mesh.count)),shells:s.artillery.shells.map(x=>({id:x.id,lane:x.targetLane,start:x.launchedAtSeconds,end:x.impactAtSeconds})),
        colors:mesh?.instanceColor?Array.from(mesh.instanceColor.array.slice(0,mesh.count*3)):[],
        ground:a.renderer.scene.children.filter(m=>m.visible&&m.name.startsWith('enemy-shell-warning-')).length});};
    cancelAnimationFrame(a.frameId);a.frameId=requestAnimationFrame(a.renderFrame);
  });
  const stop=await startGameRecording(page,width);await page.waitForTimeout(7000);const bytes=await stop();writeFileSync(`${out}/${width}-warning-flight.webm`,bytes);
  await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-warning-flight`,[.5,2,4]);
  const frames=await page.evaluate(()=>window.__frames),active=frames.filter(f=>f.shells.length);
  for(const f of active){assert.equal(f.ground,0);assert.equal(f.opacity,1);assert(f.alphas.every(a=>a>=.149&&a<=1));assert.equal(f.warnings,new Set(f.shells.map(s=>s.lane)).size);}
  writeFileSync(`${out}/${width}-warning-flight.json`,JSON.stringify(frames,null,2));
  // Paused, exact authoritative samples for early/middle/final 150ms screenshots.
  await button(page,'Pause game').tap();const shell=prepared.artillery.shells[0];
  for(const [phase,seconds] of [['early',shell.launchedAtSeconds+.05],['middle',(shell.launchedAtSeconds+shell.impactAtSeconds)/2],['final150',shell.impactAtSeconds-.15],['pulse',shell.impactAtSeconds-.04]]){
    await page.evaluate(({prepared,seconds})=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.pauseOverlay.setVisible(false);
      a.simulation.restoreState(prepared);a.simulation.consumeArtilleryEvents();
      window.__warningSample=seconds;const original=a.simulation.getFrameState.bind(a.simulation);
      a.simulation.getFrameState=()=>({...a.simulation.getState(),elapsedSeconds:seconds});a.renderer.resetFeedback();
      a.renderFrame(performance.now());a.simulation.getFrameState=original;cancelAnimationFrame(a.frameId);
    },{prepared,seconds});
    await page.screenshot({path:`${out}/${width}-warning-${phase}.png`});
  }
  await page.evaluate(()=>window.__testApp.retry());assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
  assert.deepEqual(errors,[]);rows.push({width,hatch,touch,preparedMs,footprint,restoredStats,strictRestored:true,samePageFrozen:true,
    actualContextRestored:true,wakeReleased:true,pausedFrameMs,plateau:paused.stats,recordingFrameMs:quantiles(frames.slice(1).map((f,i)=>f.stamp-frames[i].stamp)),
    recordedFlightFrames:active.length,requestsAfterPreparation:requests.slice(boundary),errors});writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));await page.close();
 }
 for(const platform of process.argv.includes('--phases-only')?[]:['denied','unsupported','insecure']){
  const page=await browser.newPage({viewport:{width:350,height:844},isMobile:true,hasTouch:true});await install(page,platform);await start(page);
  await sleepFixture(page);assert(await page.evaluate(()=>window.__testApp.paused&&window.__testApp.qaSleepActive));
  const label=await page.locator('.qa-panel').textContent();assert(label.includes(platform==='denied'?'DENIED':platform==='insecure'?'INSECURE':'UNSUPPORTED'));
  rows.push({platform,harmless:true,label});writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

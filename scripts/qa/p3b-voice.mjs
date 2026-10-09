import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b-voice/lifecycle';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:350,height:844},isMobile:true,hasTouch:true,locale:'zh-TW'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/audio/'))requests.push(r.url());});
 await page.addInitScript(()=>{
  window.__voiceEvents=[];const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>5&&this.buffer.duration<7){
   const a=window.__testApp;this.__voice=true;window.__voiceEvents.push({kind:'start',offset:args[1]??0,time:a.simulation.getState().elapsedSeconds,locale:a.fieldObserver.locale,rate:this.playbackRate.value,duration:this.buffer.duration});
   const end=this.onended;this.onended=()=>{window.__voiceEvents.push({kind:'end',time:a.simulation.getState().elapsedSeconds});end?.();};
  }return start.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.__voice)window.__voiceEvents.push({kind:'stop',time:window.__testApp.simulation.getState().elapsedSeconds});return stop.apply(this,args);};
 });
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('.game-start-overlay');await page.waitForTimeout(350);
 assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>window.__testApp.audio.context),null);
 await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');await selectDevFixture(page,'naval');
 const stopRecording=await startGameRecording(page,350);
 await page.waitForFunction(()=>window.__testApp.audio.voice?.source!==null&&window.__testApp.audio.voice?.source!==undefined);
 await page.waitForTimeout(900);const before=await page.evaluate(()=>({offset:window.__testApp.audio.voice.offset,time:window.__testApp.simulation.getState().elapsedSeconds}));
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();await page.waitForTimeout(400);
 const paused=await page.evaluate(()=>({source:window.__testApp.audio.voice.source,time:window.__testApp.simulation.getState().elapsedSeconds}));assert.equal(paused.source,null);assert(Math.abs(paused.time-before.time)<.1);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();await page.waitForTimeout(300);
 const resumed=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').at(-1));assert(resumed.offset>.7&&resumed.offset<1.3);
 await page.locator('.observer-languages button[lang="en"]').tap();await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);assert.equal(await page.locator('.field-observer p').getAttribute('lang'),'en');
 await page.locator('.observer-languages button[lang="zh-TW"]').tap();await page.waitForTimeout(250);
 assert(await page.evaluate(()=>!!window.__testApp.audio.voice.source));
 const duck=await page.evaluate(()=>window.__testApp.audio.radioDuckBus.gain.value);assert(duck<.65);
 // Selection uses the same Retry path; a cached clip must not resume the old sentence.
 await selectDevFixture(page,'naval');const count=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').length);
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').length),count);
 await page.waitForFunction(count=>window.__voiceEvents.filter(e=>e.kind==='start').length>count,count);
 const restart=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').at(-1));assert(restart.offset<.06);
 await page.waitForFunction(()=>window.__voiceEvents.some(e=>e.kind==='end'),null,{timeout:12000});
 const ended=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='end').at(-1));assert(ended.time<8.8);
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().destroyer.nextShotIndex),0);
 await page.waitForFunction(()=>window.__testApp.simulation.getState().destroyer.nextShotIndex===1);
 const bytes=await stopRecording();writeFileSync(`${out}/350-voice-pause-switch-retry.webm`,bytes);
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 const events=await page.evaluate(()=>window.__voiceEvents);assert(events.filter(e=>e.kind==='start').every(e=>e.locale==='zh-TW'&&e.rate===1));
 assert.equal(requests.length,1);assert.deepEqual(errors,[]);
 writeFileSync(`${out}/results.json`,JSON.stringify({events,requests,errors,duck,before,paused,resumed,restart,ended},null,2));
 await inspectRecordingFrames(browser,bytes,350,`${out}/350-voice`,[1.8,2.6,3.3,6.0,10.0]);console.log('Approved voice lifecycle passed',events);
}finally{await browser.close();}

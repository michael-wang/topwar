import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b-mission-intro';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
async function setup(width,locale='en-US',beforeNavigate=async()=>{}){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,locale}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/audio/'))requests.push(r.url());});
 await page.addInitScript(()=>{
  localStorage.setItem('topwar.observer.locale','en');
  window.__voiceEvents=[];const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){const a=window.__testApp;
   if(a?.audio.voice?.source===this){this.__voice=true;window.__voiceEvents.push({kind:'start',offset:args[1]??0,time:a.simulation.getState().elapsedSeconds,locale:a.fieldObserver.locale,message:a.audio.voice.message,duration:this.buffer.duration});}
   return start.apply(this,args);
  };
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.__voice)window.__voiceEvents.push({kind:'stop',time:window.__testApp.simulation.getState().elapsedSeconds});return stop.apply(this,args);};
 });
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await beforeNavigate(page);
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('.game-start-overlay');
 return {page,errors,requests};
}
try{
 for(const width of [390,350]){
  const {page,errors,requests}=await setup(width);
  if(width===350)await page.locator('.beachhead-defense').evaluate(e=>e.style.setProperty('--hud-inset-bottom','34px'));
  assert.equal(requests.length,1);assert(await page.locator('.field-observer').isHidden());
  assert.equal(await page.evaluate(()=>window.__testApp.audio.context),null);
  await page.getByRole('button',{name:'Start game with audio'}).tap();
  const stopRecording=await startGameRecording(page,width);
  await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=.5);
  assert.equal(await page.locator('.field-observer p').textContent(),'這裡是觀測官。');
  assert.equal(await page.locator('.field-observer').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await page.screenshot({path:`${out}/${width}-phrase-1.png`});
  await page.getByRole('button',{name:'Move left',exact:true}).tap();
  await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=2.1);
  const active=await page.evaluate(()=>window.__testApp.simulation.getState());
  assert.equal(active.player.selectedLane,1);assert(active.enemies.length>0);assert(active.projectiles.length>0);
  assert.equal(await page.locator('.field-observer p').textContent(),'敵軍正朝港口逼近！');
  await page.screenshot({path:`${out}/${width}-phrase-2.png`});
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  const paused=await page.evaluate(()=>window.__testApp.simulation.getState());await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),paused);
  assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);
  await page.screenshot({path:`${out}/${width}-paused.png`});await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=4.3);
  assert.equal(await page.locator('.field-observer p').textContent(),'請守住防線。完畢！');
  await page.screenshot({path:`${out}/${width}-phrase-3.png`});
  await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=6.7&&!window.__testApp.fieldObserver.missionTimeline.active);
  assert(await page.locator('.field-observer').isHidden());
  const finished=await page.evaluate(()=>window.__testApp.simulation.getState());
  assert(finished.enemies.some(e=>active.enemies.some(before=>before.id===e.id&&before.z>e.z)));
  const starts=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').length);
  const bytes=await stopRecording();writeFileSync(`${out}/${width}-mission-intro.webm`,bytes);
  // Rewind to an earlier snapshot after completion: no repeat speech or panel.
  await page.evaluate(s=>window.__testApp.simulation.restoreState(s),active);await page.waitForTimeout(150);
  assert(await page.locator('.field-observer').isHidden());assert.equal(await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').length),starts);
  await page.evaluate(()=>window.__testApp.retry());
  await page.waitForFunction(n=>window.__voiceEvents.filter(e=>e.kind==='start').length>n,starts);
  const retried=await page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start').at(-1));
  assert(retried.offset<.06,JSON.stringify(retried));
  assert.equal(await page.locator('.observer-languages').count(),0);
  assert.equal(await page.locator('.field-observer p').textContent(),'這裡是觀測官。');
  assert(await page.evaluate(()=>!!window.__testApp.audio.voice.source));
  // Restoring forward into an active phrase also cancels speech without restarting it.
  await page.evaluate(s=>window.__testApp.simulation.restoreState(s),active);await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);
  assert.equal(await page.locator('.field-observer p').textContent(),'敵軍正朝港口逼近！');
  const events=await page.evaluate(()=>window.__voiceEvents);
  assert(events.filter(e=>e.kind==='start').every(e=>e.locale==='zh-TW'&&e.message==='missionIntro'));
  assert.equal(new Set(requests).size,requests.length);assert.deepEqual(errors,[]);
  results.push({width,errors,requests,events,gameplay:{startTime:active.elapsedSeconds,endTime:finished.elapsedSeconds,enemies:finished.enemies.length},bytes:bytes.length});
  await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-mission`,[.75,2.2,4.8]);
  await page.close();console.log('Mission intro checked',width);
 }
 // English browser and saved English preference still receive Mandarin and Chinese subtitles.
 const english=await setup(350,'en-US');
 await english.page.getByRole('button',{name:'Start game with audio'}).tap();
 for(const [at,text] of [[.6,'這裡是觀測官。'],[2.1,'敵軍正朝港口逼近！'],[4.2,'請守住防線。完畢！']]){
  await english.page.waitForFunction(t=>window.__testApp.simulation.getState().elapsedSeconds>=t,at);
  assert.equal(await english.page.locator('.field-observer p').textContent(),text);
 }
 assert.equal(english.requests.filter(url=>url.includes('observer_mission_intro_zh-TW.mp3')).length,1);
 assert.equal(new Set(english.requests).size,english.requests.length);assert(english.requests.length<=2);
 assert.equal(await english.page.locator('.observer-languages').count(),0);
 const englishStarts=await english.page.evaluate(()=>window.__voiceEvents.filter(e=>e.kind==='start'));
 assert.equal(englishStarts.length,1);assert.equal(englishStarts[0].locale,'zh-TW');assert.deepEqual(english.errors,[]);
 await english.page.screenshot({path:`${out}/350-english.png`});await english.page.close();
 results.push({browserLocale:'en-US',savedLocale:'en',observerLocale:'zh-TW',requests:english.requests,errors:english.errors});
 // A deliberately delayed decode cannot hold up enemies or leave stale speech after the window.
 let release;
 const gate=new Promise(r=>release=r);
 const delayed=await setup(350,'zh-TW',async page=>{
  await page.route('**/audio/observer_mission_intro_zh-TW.mp3',async route=>{await gate;await route.continue();});
 });
 await delayed.page.getByRole('button',{name:'Start game with audio'}).tap();
 await delayed.page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=9.2);
 assert(await delayed.page.locator('.field-observer').isHidden());release();await delayed.page.waitForTimeout(300);
 assert.deepEqual(await delayed.page.evaluate(()=>window.__voiceEvents),[]);
 assert((await delayed.page.evaluate(()=>window.__testApp.simulation.getState().enemies.length))>0);
 assert.deepEqual(delayed.errors,[]);results.push({delayedAudio:true,errors:delayed.errors});await delayed.page.close();
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}

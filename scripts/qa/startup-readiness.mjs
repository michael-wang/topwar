import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const phase=process.argv[2]??'after',out=`artifacts/p3b3/${phase}-readiness`;mkdirSync(out,{recursive:true});
const server=await preview({build:{outDir:phase==='before'?'artifacts/p3b3/before/dist':'dist'},preview:{host:'127.0.0.1',port:5184,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const scenario of [{width:350,kind:'normal'},{width:390,kind:'normal'},...(phase==='before'?[]:[
   {width:390,kind:'decode-delay',delay:1800},{width:350,kind:'decode-late',delay:5000},
   {width:350,kind:'both-fail'},{width:390,kind:'neutral-fail'},{width:350,kind:'decode-hung'}])]) {
  const {width,kind}=scenario,page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  if(phase!=='before')await page.route(/\/topwar\/assets\/index-.*\.js$/,async route=>{
   const response=await route.fetch(),body=await response.text();
   const pattern=/new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)\.start\(\)/g;
   assert.equal([...body.matchAll(pattern)].length,1);await route.fulfill({response,body:body.replace(pattern,m=>`(window.__testApp=${m.slice(0,-8)}).start()`)});
  });
  await page.addInitScript(({kind,delay})=>{
   const q=window.__readiness={speech:[],blankFrames:0,decodes:[],frames:0};
   const decode=HTMLImageElement.prototype.decode;
   HTMLImageElement.prototype.decode=function(){
    if(!this.src.includes('/observer/'))return decode.call(this);
    q.decodes.push(this.src);
    if(kind==='decode-hung')return new Promise(()=>{});
    return decode.call(this).then(()=>delay?new Promise(r=>setTimeout(r,delay)):undefined);
   };
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){if(window.__testApp?.audio.voice?.source===this){
    const img=document.querySelector('.field-observer img');q.speech.push({offset:args[1]??0,at:performance.now(),portraitReady:img.complete&&img.naturalWidth>0});
   }return start.apply(this,args);};
   const poll=()=>{const p=document.querySelector('.field-observer');if(p&&!p.hidden){q.frames++;const img=p.querySelector('img');if(!img.complete||!img.naturalWidth)q.blankFrames++;}requestAnimationFrame(poll);};requestAnimationFrame(poll);
  },scenario);
  if(kind.endsWith('fail'))await page.route(/\/art\/observer\/.*\.webp/,route=>kind==='both-fail'||route.request().url().includes('neutral')?route.fulfill({status:404,body:''}):route.continue());
  await page.goto('http://127.0.0.1:5184/topwar/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.game-start-overlay');
  assert.equal(await page.evaluate(()=>window.__testApp.audio.context),null);
  await page.getByRole('button',{name:'Start game with audio'}).tap();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  const stop=kind==='normal'?await startGameRecording(page,width):null;
  if(kind==='normal'||kind==='decode-delay'||kind==='neutral-fail') {
   await page.waitForFunction(()=>window.__readiness.speech.length>0);
   const box=await page.locator('.field-observer img').boundingBox();assert(Math.abs(box.width-110)<.01);assert(Math.abs(box.height-110)<.01);
   await page.screenshot({path:`${out}/${width}-${kind}-intro.png`});
   await page.getByRole('button',{name:'Pause game',exact:true}).tap();
   const frozen=await page.evaluate(()=>window.__testApp.simulation.getState());await page.waitForTimeout(250);
   assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),frozen);
   assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);
   await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  }
  await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=9.3);
  const beforeRetry=await page.evaluate(()=>window.__readiness);
  if(phase!=='before'){
   assert.equal(beforeRetry.blankFrames,0);
   if(['decode-late','both-fail','decode-hung'].includes(kind)){assert.equal(beforeRetry.speech.length,0);assert.equal(beforeRetry.frames,0);}
   else {assert.equal(beforeRetry.speech[0].offset,0);assert(beforeRetry.speech.every(s=>s.portraitReady));}
  }
  if(stop){const bytes=await stop();writeFileSync(`${out}/${width}-intro-pause.webm`,bytes);await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-intro`,[.5,2,4]);await page.evaluate(()=>window.__testApp.renderFrame(performance.now()));}
  const assetRequests=requests.filter(u=>/\.(webp|mp3|glb)(\?|$)/.test(u)).length;
  await page.evaluate(()=>window.__testApp.retry());await page.waitForTimeout(1000);
  assert.equal(requests.filter(u=>/\.(webp|mp3|glb)(\?|$)/.test(u)).length,assetRequests);
  assert.deepEqual(errors,[]);results.push({...scenario,beforeRetry,afterRetry:await page.evaluate(()=>window.__readiness),assetRequests,errors});
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log('Production readiness',phase,width,kind);await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

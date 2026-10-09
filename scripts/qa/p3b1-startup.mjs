import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const phase=process.argv[2]??'after',out=`artifacts/p3b1/${phase}`;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const cases=[{kind:'cold',delay:0},{kind:'warm',delay:0},...['fetch','decode','resume'].flatMap(kind=>[500,1000,2000].map(delay=>({kind,delay}))),{kind:'fetch',delay:4000},{kind:'timeout',delay:0}];
const results=[];
try{for(const scenario of cases){
 const width=scenario.kind==='fetch'?390:350;
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,locale:'zh-TW'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({kind,delay})=>{
  const q=window.__qa={tap:null,requests:[],decode:[],resume:[],speech:[],gameplay:null,firstSound:null};
  document.addEventListener('pointerdown',()=>q.tap??=performance.now(),{capture:true});
  const Native=AudioContext;
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);q.context=performance.now();if(kind==='resume'||kind==='timeout')void this.suspend();}
   resume(){q.resume.push({called:performance.now()});if(kind==='timeout')return new Promise(()=>{});
    const run=()=>super.resume().then(()=>q.resume.at(-1).resolved=performance.now());
    return kind==='resume'?new Promise(resolve=>setTimeout(resolve,delay)).then(run):run();
   }
   decodeAudioData(bytes,...rest){const mission=bytes.byteLength===107217;
    if(mission)q.decode.push({called:performance.now()});
    const run=()=>super.decodeAudioData(bytes,...rest).then(b=>{if(mission)q.decode.at(-1).resolved=performance.now();return b;});
    return mission&&kind==='decode'?new Promise(resolve=>setTimeout(resolve,delay)).then(run):run();
   }
  };
  const start=AudioBufferSourceNode.prototype.start,osc=OscillatorNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){const a=window.__testApp;
   if(a?.audio.voice?.source===this)q.speech.push({at:performance.now(),offset:args[1]??0,sim:a.simulation.getState().elapsedSeconds,message:a.audio.voice.message});
   return start.apply(this,args);
  };
  OscillatorNode.prototype.start=function(...args){q.firstSound??=performance.now();return osc.apply(this,args);};
  const poll=()=>{if(window.__testApp?.startup==='started')q.gameplay??=performance.now();requestAnimationFrame(poll);};requestAnimationFrame(poll);
 },scenario);
 await page.route('**/audio/observer_mission_intro_zh-TW.mp3',async route=>{
  await page.evaluate(()=>window.__qa.requests.push(performance.now()));
  if(scenario.kind==='fetch')await new Promise(r=>setTimeout(r,scenario.delay));await route.continue();
 });
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('.game-start-overlay');
 const before=await page.evaluate(()=>({context:window.__qa.context??null,speech:window.__qa.speech.length}));
 assert.equal(before.context,null);assert.equal(before.speech,0);
 await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.startup==='started');
 if(scenario.kind==='warm'){
  await page.waitForFunction(()=>window.__qa.speech.length>0);await page.evaluate(()=>{window.__testApp.retry();window.__qa.speech=[];window.__qa.tap=performance.now();window.__qa.gameplay=performance.now();});
 }
 const record=phase==='after'&&((scenario.kind==='fetch'&&scenario.delay===1000)||(scenario.kind==='resume'&&scenario.delay===2000));
 const stop=record?await startGameRecording(page,width):null;
 await page.waitForFunction(()=>window.__qa.speech.length>0||window.__testApp.simulation.getState().elapsedSeconds>=3.3);
 if(record||scenario.delay===4000||scenario.kind==='timeout')await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=9.2);
 const q=await page.evaluate(()=>window.__qa),state=await page.evaluate(()=>window.__testApp.simulation.getState());
 const metrics={...scenario,width,gameplayMs:q.gameplay-q.tap,voiceMs:q.speech[0]?q.speech[0].at-q.tap:null,voiceOffset:q.speech[0]?.offset??null,
  firstSoundMs:q.firstSound===null?null:q.firstSound-q.tap,fetchAt:q.requests.map(t=>t-q.tap),decode:q.decode.map(d=>({called:d.called-q.tap,resolved:d.resolved-q.tap})),resume:q.resume.map(d=>({called:d.called-q.tap,resolved:d.resolved?d.resolved-q.tap:null})),speech:q.speech,errors};
 if(phase==='after'){
  assert.deepEqual(errors,[]);assert(state.elapsedSeconds>0);
  if(scenario.delay===4000||scenario.kind==='timeout')assert.equal(q.speech.length,0);
  else {assert.equal(q.speech.length,1);assert.equal(q.speech[0].offset,0);}
  assert(metrics.gameplayMs<1400); // The existing activation deadline remains 1s.
 }
 if(stop){const bytes=await stop(),name=`${width}-${scenario.kind}-${scenario.delay}`;writeFileSync(`${out}/${name}.webm`,bytes);
  await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  await inspectRecordingFrames(browser,bytes,width,`${out}/${name}`,[1.8,3.5,6.5]);
 }
 results.push(metrics);writeFileSync(`${out}/startup.json`,JSON.stringify(results,null,2));console.log(metrics.kind,metrics.delay,{gameplayMs:metrics.gameplayMs,voiceMs:metrics.voiceMs,voiceOffset:metrics.voiceOffset});await page.close();
}}finally{await browser.close();}

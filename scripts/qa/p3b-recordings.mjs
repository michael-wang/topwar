import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b/recordings';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const [width,savedLocale] of [[390,'en'],[350,'zh-TW']]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});page.on('request',r=>requests.push(r.url()));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();',`window.__testApp=app;window.__events=[];window.__radio=[];
 const present=app.renderer.presentArtillery.bind(app.renderer);app.renderer.presentArtillery=(events,ms)=>{window.__events.push(...events.map(e=>({...e,ms,wall:performance.now()})));return present(events,ms)};
 const play=app.audio.play.bind(app.audio);app.audio.play=(cue,...args)=>{if(cue.startsWith('radio'))window.__radio.push({cue,wall:performance.now()});return play(cue,...args)};app.start();`)});});
 await page.addInitScript(locale=>localStorage.setItem('topwar.observer.locale',locale),savedLocale);
 await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.startup==='started');await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'naval');
 if(width===350)await page.locator('.beachhead-defense').evaluate(e=>{e.style.setProperty('--hud-inset-bottom','34px');e.style.setProperty('--hud-inset-top','20px');});
 const shot=name=>page.screenshot({path:`${out}/${width}-${name}.png`});
 // The closed playtest ignores saved locale preferences.
 await page.evaluate(()=>{const a=window.__testApp;let now=performance.now();for(let i=0;i<135;i++){a.renderFrame(now+=1000/60);cancelAnimationFrame(a.frameId);}});
 assert(await page.locator('.field-observer').isVisible());await shot('radio-initial');
 const before=await page.evaluate(()=>window.__testApp.simulation.getState());
 assert.equal(await page.locator('.observer-languages').count(),0);
 assert.equal(await page.locator('.field-observer p').getAttribute('lang'),'zh-TW');await shot('radio-zh-TW');
 assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),before);
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();
 await page.evaluate(()=>{const a=window.__testApp;a.renderFrame(performance.now()+3000);cancelAnimationFrame(a.frameId);});
 assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),before);await shot('radio-paused');
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await page.evaluate(s=>{const a=window.__testApp;a.fieldObserver.reset();a.simulation.restoreState(s);a.previousFrameTimestampMs=null;a.renderFrame(performance.now());cancelAnimationFrame(a.frameId);},before);
 assert.equal(await page.evaluate(()=>window.__radio.length),1);assert(await page.locator('.field-observer').isVisible());
 await page.evaluate(()=>{const a=window.__testApp;a.retry();window.__events=[];window.__radio=[];a.previousFrameTimestampMs=null;});
 const stop=await startGameRecording(page,width);await page.evaluate(()=>window.__testApp.renderFrame(performance.now()));
 await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=1.8);await shot('entrance-radio');
 await page.waitForFunction(()=>window.__events.some(e=>e.kind==='artilleryLaunch'));await shot('launch-alert');
 await page.waitForTimeout(500);await page.getByRole('button',{name:'Pause game',exact:true}).tap();
 const flight=await page.evaluate(()=>window.__testApp.simulation.getState());await page.waitForTimeout(550);
 assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),flight);await shot('flight-paused');
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await page.waitForFunction(()=>window.__testApp.simulation.getState().squad.count===2);await shot('direct-hit');
 for(let id=2;id<=5;id++){
  await page.waitForFunction(id=>window.__events.some(e=>e.kind==='artilleryLaunch'&&e.shell.id===id),id);
  if(id===4){assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().artillery.shells.length),2);await shot('overlap');}
  await page.waitForTimeout(300);
  const direction=await page.evaluate(()=>{const s=window.__testApp.simulation.getState(),lane=s.player.selectedLane,targets=new Set(s.artillery.shells.map(s=>s.targetLane));return[-1,1].sort((a,b)=>Math.abs(lane+a-2)-Math.abs(lane+b-2)).find(d=>lane+d>=0&&lane+d<5&&!targets.has(lane+d));});
  assert(direction);await page.getByRole('button',{name:direction<0?'Move left':'Move right',exact:true}).tap();
 }
 await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=24.5);await shot('exit');
 await page.waitForFunction(()=>window.__testApp.simulation.getState().destroyer.status==='complete');await page.waitForTimeout(400);await shot('complete');
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().squad.count),2);
 const events=await page.evaluate(()=>window.__events.map(e=>({...e,time:(e.wall-window.__capture.startedAt)/1000})));
 const radio=await page.evaluate(()=>window.__radio);assert.deepEqual(radio.map(e=>e.cue),['radioOpen','radioClose']);
 const bytes=await stop();writeFileSync(`${out}/${width}-zh-TW-naval.webm`,bytes);
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 const launch=events.find(e=>e.kind==='artilleryLaunch'),hit=events.find(e=>e.kind==='artilleryImpact');
 const overlap=events.find(e=>e.kind==='artilleryLaunch'&&e.shell.id===4);
 await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-naval`,[1.9,3.5,launch.time+.12,launch.time+.5,hit.time-.15,hit.time+.15,overlap.time+.15,25.5]);
 const audio=await page.evaluate(async bytes=>{const c=new AudioContext(),b=await c.decodeAudioData(new Uint8Array(bytes).buffer);let peak=0,squares=0,clipped=0,n=0;for(let channel=0;channel<b.numberOfChannels;channel++)for(const s of b.getChannelData(channel)){peak=Math.max(peak,Math.abs(s));squares+=s*s;n++;if(Math.abs(s)>=.999)clipped++;}await c.close();return{duration:b.duration,peak,rms:Math.sqrt(squares/n),clipped};},Array.from(bytes));
 assert.equal(audio.clipped,0);assert(audio.rms>.0001);
 const audioRequests=requests.filter(u=>new URL(u).pathname.startsWith('/audio/'));
 assert.equal(new Set(audioRequests).size,audioRequests.length);assert(audioRequests.length<=2);assert.deepEqual(errors,[]);
 results.push({width,savedLocale,locale:'zh-TW',events,radio,audio,errors,bytes:bytes.length});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log('Recorded NAVAL',width,'zh-TW',audio);await page.close();
}}finally{await browser.close();}

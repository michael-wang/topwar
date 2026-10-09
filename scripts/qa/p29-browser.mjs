import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p29/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={runs:[],errors:[]};
try{for(const width of [390,350])for(const role of ['crate3','crate8']){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();',`window.__testApp=app;window.__events=[];
  const present=app.renderer.presentGrenade.bind(app.renderer);app.renderer.presentGrenade=(events,ms)=>{window.__events.push(...events.map(e=>({...e,ms,wall:performance.now()})));return present(events,ms)};app.start();`)});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,role);
 const state=()=>page.evaluate(()=>window.__testApp.simulation.getState()),initial=await state();
 if(width===350)await page.locator('.beachhead-defense').evaluate(v=>v.style.setProperty('--hud-inset-bottom','34px'));
 await page.evaluate(()=>{const a=window.__testApp;window.__clock=0;window.__advance=n=>{for(let i=0;i<n;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};});
 const advance=n=>page.evaluate(n=>window.__advance(n),n);
 await advance(1);await page.screenshot({path:`${out}/${width}-${role}-start.png`});
 let previous=0;
 for(let i=0;i<240;i++){await advance(1);const s=await state(),stage=s.grenade.supply?.destruction.stage??3;
  if(stage>previous){previous=stage;if(stage<3)await advance(10);await page.screenshot({path:`${out}/${width}-${role}-stage${stage}.png`});
   if(stage===1){
    const partial=await state();await page.evaluate(s=>window.__testApp.simulation.restoreState(s),partial);assert.deepEqual(await state(),partial);
    await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(30);assert.deepEqual(await state(),partial);await page.getByRole('button',{name:'Resume game',exact:true}).tap();
   }
  }if(stage===3)break;
 }
 assert.equal(previous,3);await advance(role==='crate3'?25:12);
 assert.equal(await page.locator('.supply-reward-item:visible').count(),role==='crate3'?3:1);
 await page.screenshot({path:`${out}/${width}-${role}-transfer.png`});await advance(80);
 assert(await page.locator('.grenade-button').isEnabled());const before=await state();
 assert.equal(before.grenade.inventory,role==='crate3'?3:2);
 if(role==='crate8'){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('KeyQ');}else await page.locator('.grenade-button').tap();
 await advance(1);const flight=await state();assert.equal(flight.grenade.inventory,before.grenade.inventory-1);assert(flight.grenade.flight.targetX>0);
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(30);assert.deepEqual(await state(),flight);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();await page.evaluate(s=>window.__testApp.simulation.restoreState(s),flight);
 await advance(40);await page.screenshot({path:`${out}/${width}-${role}-blast.png`});await advance(12);
 await page.screenshot({path:`${out}/${width}-${role}-debris.png`});
 const reaction=await page.evaluate(()=>window.__testApp.renderer.getDebugStats());
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(60);assert.deepEqual(await state(),frozen);
 assert.deepEqual(await page.evaluate(()=>window.__testApp.renderer.getDebugStats()),reaction);await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await advance(100);await page.screenshot({path:`${out}/${width}-${role}-scorch.png`});
 const events=await page.evaluate(()=>window.__events),blast=events.find(e=>e.kind==='grenadeDetonated'),after=await state();
 assert.equal(events.filter(e=>e.kind==='grenadeDetonated').length,1);assert.equal(blast.victims.filter(v=>v.killed).length,12);
 assert.deepEqual(after.enemies.map(e=>e.hp),[6,163]);assert.equal(reaction.enemies.blastReactions,2);assert.equal(reaction.grenade.activeScorches,1);
 assert.equal(after.progression.xp,role==='crate3'?12:0);
 // An empty-field QA continuation exposes the ground stamp without surviving bodies occluding it.
 await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.enemies=[];a.simulation.restoreState(s);});
 await advance(1);await page.locator('.grenade-button').tap();await advance(150);
 await page.screenshot({path:`${out}/${width}-${role}-scorch-clear.png`});
 await page.evaluate(()=>window.__testApp.retry());assert.deepEqual(await state(),initial);
 assert.equal(await page.evaluate(()=>window.__testApp.renderer.getDebugStats().grenade.activeScorches),0);
 // Record the unmodified fixture with native RAF and its real procedural audio.
 await page.evaluate(()=>{const a=window.__testApp;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();window.__events=[];});
 const stop=await startGameRecording(page,width);await page.evaluate(()=>window.__testApp.renderFrame(performance.now()));
 await page.waitForFunction(()=>!window.__testApp.simulation.getState().grenade.supply);
 await page.waitForFunction(()=>!window.__testApp.supplyTransfer.transfer);
 await page.locator('.movement-button').last().tap();await page.locator('.grenade-button').tap();
 await page.waitForFunction(()=>window.__events.some(e=>e.kind==='grenadeDetonated'));
 await page.waitForFunction(()=>{const e=window.__events.find(e=>e.kind==='grenadeDetonated');return e&&window.__testApp.presentationMs-e.ms>1800;});
 const recorded=await page.evaluate(()=>window.__events),video=await stop();writeFileSync(`${out}/${width}-${role}.webm`,video);
 const blastAt=(recorded.find(e=>e.kind==='grenadeDetonated').wall-await page.evaluate(()=>window.__capture.startedAt))/1000;
 await inspectRecordingFrames(browser,video,width,`${out}/${width}-${role}`,[.15,.95,blastAt+.06,blastAt+.3,blastAt+.7,blastAt+1.5]);
 results.runs.push({width,role,victims:blast.victims,reaction,videoBlastSeconds:blastAt});
 if(role==='crate3'){
  await page.evaluate(s=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.retry();
   s.enemies=Array.from({length:40},(_,i)=>({id:i+1,tier:1,archetype:'grunt',lane:i%5,x:(i%5-2)*1.4,z:15+Math.floor(i/5)*.7,hp:1}));
   s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;a.simulation.restoreState(s);a.previousFrameTimestampMs=null;window.__clock=performance.now();window.__advance(70);
  },initial);
  await page.screenshot({path:`${out}/${width}-crate-crowd.png`});
 }
 console.log('P2.9 checked',width,role);await page.close();
}assert.deepEqual(results.errors,[]);}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

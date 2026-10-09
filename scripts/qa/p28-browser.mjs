import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p28/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={runs:[],errors:[]};
try{for(const width of [390,350])for(const role of ['crate3','crate8','grenade','giant']){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();',`window.__testApp=app;window.__events=[];window.__cues=[];
  const present=app.renderer.presentGrenade.bind(app.renderer);app.renderer.presentGrenade=(events,ms)=>{window.__events.push(...events.map(e=>({...e,ms,wall:performance.now()})));return present(events,ms)};
  const play=app.audio.play.bind(app.audio);app.audio.play=(cue,...args)=>{window.__cues.push(cue);return play(cue,...args)};app.start();`)});});
 await page.goto((process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/')+(role==='giant'?'?review=threats':''));
 await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 if(role!=='giant')await selectDevFixture(page,role);
 if(role==='giant')await page.evaluate(async()=>{
  const a=window.__testApp,s=a.simulation.getState(),{emptyGrenade}=await import('/src/simulation/grenade.ts');
  // Existing threat review models/HP, placed together for one deterministic blast.
  s.enemies=s.enemies.filter(e=>e.archetype==='heavy'||e.archetype==='giant');s.enemies.forEach(e=>e.z=e.archetype==='heavy'?18:20);
  s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:3};
  s.defenseWaves.nextAtSeconds=1000;s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000,1000,1000];a.simulation.restoreState(s);
 });
 if(role==='grenade')await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000];a.simulation.restoreState(s);});
 const initial=await page.evaluate(()=>window.__testApp.simulation.getState());
 if(width===350)await page.locator('.beachhead-defense').evaluate(v=>v.style.setProperty('--hud-inset-bottom','34px'));
 await page.evaluate(()=>{const a=window.__testApp;window.__clock=0;window.__advance=n=>{for(let i=0;i<n;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};});
 const advance=n=>page.evaluate(n=>window.__advance(n),n),state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
 await advance(1);await page.screenshot({path:`${out}/${width}-${role}-start.png`});
 if(role.startsWith('crate')){
  let previous=0;
  for(let i=0;i<240;i++){await advance(1);const s=await state(),stage=s.grenade.supply?.destruction.stage??3;
   if(stage>previous){previous=stage;if(stage<3)await advance(10);await page.screenshot({path:`${out}/${width}-${role}-stage${stage}.png`});
    if(stage===1){await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(30);assert.deepEqual(await state(),frozen);await page.getByRole('button',{name:'Resume game',exact:true}).tap();}
   }if(stage===3)break;
  }
  await advance(role==='crate3'?25:12);assert.equal(await page.locator('.supply-reward-item:visible').count(),role==='crate3'?3:1);
  await page.screenshot({path:`${out}/${width}-${role}-transfer.png`});await advance(80);
 }else await advance(120);
 assert(await page.locator('.grenade-button').isEnabled());const before=await state();
 if(role==='crate8'||role==='giant'){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('KeyQ');}else await page.locator('.grenade-button').tap();
 await advance(1);assert.equal((await state()).grenade.inventory,before.grenade.inventory-1);
 const airborne=await state();assert(airborne.grenade.flight);if(role.startsWith('crate'))assert.equal(airborne.grenade.flight.targetZ,14);
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(30);assert.deepEqual(await state(),airborne);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await page.evaluate(s=>window.__testApp.simulation.restoreState(s),airborne);
 await advance(38);await advance(2);await page.screenshot({path:`${out}/${width}-${role}-blast.png`});
 const frozenFx=await page.evaluate(()=>window.__testApp.renderer.getDebugStats());
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(15);assert.deepEqual(await page.evaluate(()=>window.__testApp.renderer.getDebugStats()),frozenFx);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await advance(12);await page.screenshot({path:`${out}/${width}-${role}-shock.png`});
 const reaction=await page.evaluate(()=>window.__testApp.renderer.getDebugStats());
 await advance(27);await page.screenshot({path:`${out}/${width}-${role}-smoke.png`});await advance(40);
 const events=await page.evaluate(()=>window.__events),blast=events.find(e=>e.kind==='grenadeDetonated'),after=await state();
 assert.equal(events.filter(e=>e.kind==='grenadeDetonated').length,1);assert(blast);
 if(role.startsWith('crate')){assert.equal(blast.victims.length,0);assert.deepEqual(after.progression,before.progression);}
 if(role==='grenade'){assert(blast.victims.filter(v=>v.killed).length>5);assert(reaction.enemies.airborneDeaths>0&&reaction.enemies.airborneDeaths<=8);}
 if(role==='giant'){assert.deepEqual(after.enemies.map(e=>e.hp),[6,163]);assert.equal(reaction.enemies.blastReactions,2);}
 assert((await page.evaluate(()=>window.__cues)).includes('grenadeExplosion'));
 await page.evaluate(()=>window.__testApp.retry());assert.equal(await page.evaluate(()=>window.__testApp.renderer.getDebugStats().grenade.activeExplosions),0);
 // Record an uninterrupted real-time repeat, from the identical authoritative state.
 await page.evaluate(s=>{const a=window.__testApp;a.simulation.restoreState(s);a.fixedStepLoop.reset();a.renderFrame(performance.now());cancelAnimationFrame(a.frameId);a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();window.__events=[];},initial);
 const stop=await startGameRecording(page,width);await page.evaluate(()=>window.__testApp.renderFrame(performance.now()));
 if(role.startsWith('crate')){
  await page.waitForFunction(()=>!window.__testApp.simulation.getState().grenade.supply);
  await page.waitForFunction(()=>!window.__testApp.supplyTransfer.transfer);
 }else await page.waitForFunction(()=>window.__testApp.presentationMs>=1800);
 await page.locator('.grenade-button').tap();
 await page.waitForFunction(()=>window.__events.some(e=>e.kind==='grenadeDetonated'));
 await page.waitForFunction(()=>{const e=window.__events.find(e=>e.kind==='grenadeDetonated');return e&&window.__testApp.presentationMs-e.ms>1250;});
 const recorded=await page.evaluate(()=>window.__events),video=await stop();writeFileSync(`${out}/${width}-${role}.webm`,video);
 const blastAt=(recorded.find(e=>e.kind==='grenadeDetonated').wall-await page.evaluate(()=>window.__capture.startedAt))/1000;
 await inspectRecordingFrames(browser,video,width,`${out}/${width}-${role}`,[.15,.95,blastAt+.06,blastAt+.25,blastAt+.7,blastAt+1.1]);
 results.runs.push({width,role,victims:blast.victims,grenade:after.grenade,progression:after.progression,reaction,videoBlastSeconds:blastAt});
 console.log('P2.8 checked',width,role);await page.close();
}assert.deepEqual(results.errors,[]);}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

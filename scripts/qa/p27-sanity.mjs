import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p27/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={portraits:{},errors:[]};
try {
 for(const width of [390,350]) {
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();',`window.__testApp=app;window.__cues=[];
   const play=app.audio.play.bind(app.audio);app.audio.play=(...args)=>{window.__cues.push({cue:args[0],at:app.presentationMs});return play(...args)};app.start();`)});});
  await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/?perf=1');await page.getByRole('button',{name:'Start game with audio'}).tap();
  await page.waitForFunction(()=>window.__testApp.startup==='started');await page.addStyleTag({content:'.perf-hud{display:none!important}'});
  await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
   const gpu=a.renderer.renderer,draw=gpu.render.bind(gpu);gpu.render=(...args)=>{if(!window.__skipDraw)draw(...args);};
   window.__advance=(ticks,draw=true)=>{window.__skipDraw=!draw;try{for(let i=0;i<ticks;i++){
    window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}}finally{window.__skipDraw=false;}};
  });
  const advance=(ticks,draw=true)=>page.evaluate(({ticks,draw})=>window.__advance(ticks,draw),{ticks,draw});
  const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
  const screenshot=name=>page.screenshot({path:`${out}/${width}-${name}.png`});
  const runs=[];
  for(const [role,level,members]of [['rifle',3,1],['late',6,1],['mg8',8,3]]) {
   if(role!=='rifle')await selectDevFixture(page,role);else await page.evaluate(()=>window.__testApp.retry());
   const retryInitial=await state();
   await page.locator('.beachhead-defense').evaluate((v,inset)=>{v.style.setProperty('--hud-inset-bottom',`${inset}px`);},role==='mg8'?34:0);
   await page.evaluate(async({level,members})=>{
    const a=window.__testApp,{emptyGrenade}=await import('/src/simulation/grenade.ts'),s=a.simulation.getState();
    s.progression={level,xp:0};s.enemies=[{id:1,tier:1,archetype:'heavy',lane:4,x:2.8,z:40,hp:15}];
    s.enemyStream.nextEnemyId=2;s.defenseWaves.nextAtSeconds=1000;
    s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0};s.projectiles=[];
    s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=Array(members).fill(1000);
    a.simulation.restoreState(s);a.fixedStepLoop.reset();window.__cues=[];
   },{level,members});
   await advance(485,false);await advance(1);
   assert.equal((await state()).grenade.supply.destruction.stage,0);await screenshot(`${role}-stage0`);
   await page.evaluate(({members,level})=>{const a=window.__testApp,s=a.simulation.getState();
    s.weapons.rifleCooldownRemainingSeconds=0;s.weapons.rifleMemberCooldowns=Array.from({length:members},(_,i)=>i/(level===3?4.5:18)/members);a.simulation.restoreState(s);
   },{members,level});
   const times=[];let prior=0;
   for(let ticks=0;ticks<220;ticks++) {
    await advance(1);const s=await state(),stage=s.grenade.supply?.destruction.stage??3;
    if(stage>prior){times.push(s.elapsedSeconds);prior=stage;await screenshot(`${role}-stage${stage}`);
     if(stage===1){await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(45);
      assert.deepEqual(await state(),frozen);await page.getByRole('button',{name:'Resume game',exact:true}).tap();}
    }
    if(stage===3)break;
   }
   assert.equal(times.length,3);assert(times[2]-times[0]>=1.4-1e-7&&times[2]-times[0]<=2);
   assert.equal((await state()).grenade.inventory,3);assert(await page.locator('.grenade-button').isEnabled());
   await page.locator('.grenade-button').tap();await advance(2);assert.equal((await state()).grenade.inventory,2);
   assert((await state()).grenade.flight);assert.equal(await page.locator('.grenade-button strong').textContent(),'2');
   await advance(24);assert.equal(await page.locator('.supply-reward-item:visible').count(),3);await screenshot(`${role}-three-rewards`);
   const bounds=await page.locator('.supply-reward-item:visible').evaluateAll(items=>items.map(e=>e.getBoundingClientRect().toJSON()));
   assert(bounds.every(b=>b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=844));
   const transforms=()=>page.locator('.supply-reward-item').evaluateAll(items=>items.map(e=>e.style.transform));
   await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state(),paused=await transforms();
   await advance(45);assert.deepEqual(await state(),frozen);assert.deepEqual(await transforms(),paused);
   await page.getByRole('button',{name:'Resume game',exact:true}).tap();
   const arrivals=[];
   for(let t=0;t<55;t++){await advance(1);const n=await page.evaluate(()=>window.__testApp.supplyTransfer.transfer?.arrived??3);if(!arrivals.includes(n))arrivals.push(n);}
   assert(arrivals.includes(1)&&arrivals.includes(2)&&arrivals.includes(3));assert.equal(await page.locator('.supply-reward-item:visible').count(),0);
   assert.equal(await page.locator('.grenade-button strong').textContent(),'2');await screenshot(`${role}-arrived`);
   const cues=await page.evaluate(()=>window.__cues.filter(e=>['supplyImpact','supplyCrack','supplyOpen','reward'].includes(e.cue)));
   assert.deepEqual(cues.map(e=>e.cue),['supplyImpact','supplyCrack','supplyOpen','reward']);assert(cues[3].at-cues[2].at>=210);
   // Restore already-awarded state: no opening event / second transfer.
   await page.evaluate(()=>{const a=window.__testApp;a.simulation.restoreState(JSON.parse(JSON.stringify(a.simulation.getState())));});
   await advance(2);assert.equal(await page.locator('.supply-reward-item:visible').count(),0);
   // Open one recurring crate using the ordinary staged path, then Retry mid-flight.
   await page.evaluate(async()=>{const a=window.__testApp,{placeGrenadeSupply}=await import('/src/simulation/grenade.ts'),s=a.simulation.getState();
    s.grenade.inventory=1;s.grenade.flight=null;s.grenade.supply={...placeGrenadeSupply(s,s.catharsis.balance.grenade),rewardAmount:1};
    s.player.selectedLane=s.grenade.supply.lane;s.player.x=s.grenade.supply.x;a.simulation.restoreState(s);});
   for(let t=0;t<220&&(await state()).grenade.supply;t++)await advance(1);
   assert.equal((await state()).grenade.inventory,2);await advance(10);assert.equal(await page.locator('.supply-reward-item:visible').count(),1);
   await screenshot(`${role}-recurring-reward`);
   await page.evaluate(()=>window.__testApp.retry());
   if(role==='rifle'){assert.equal((await state()).progression.level,1);assert.equal((await state()).grenade.supply,null);assert.equal((await state()).grenade.inventory,0);}
   else assert.deepEqual(await state(),retryInitial);
   assert.equal(await page.locator('.supply-reward-item:visible').count(),0);assert.equal(await page.locator('.grenade-transferring').count(),0);
   runs.push({role,level,members,openingSeconds:times[2]-times[0],times,cues,bounds,arrivals,pauseRecovery:true,pauseFlight:true,retryFlight:true,immediateUse:true});
  }
  results.portraits[width]=runs;console.log('P2.7 passed',width);await page.close();
 }
 assert.deepEqual(results.errors,[]);
}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p27/fixtures';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={runs:[],errors:[]};
try {for(const width of [390,350]) {
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();',`window.__testApp=app;window.__cues=[];const play=app.audio.play.bind(app.audio);app.audio.play=(cue,...args)=>{window.__cues.push(cue);return play(cue,...args)};app.start();`)});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Start game with audio'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().tick),0);
 await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
  window.__advance=ticks=>{for(let i=0;i<ticks;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
 });
 if(width===350)await page.locator('.beachhead-defense').evaluate(v=>v.style.setProperty('--hud-inset-bottom','34px'));
 await page.locator('.tuning-panel > summary').click();
 const menu=await page.locator('.dev-review-controls button').allTextContents();
 assert.deepEqual(menu,['GRENADE','CURVE','EVOLVE','MG','LATE','MG7','MG8','CARNIVAL','CRATE3','CRATE8']);
 for(const role of ['crate3','crate8']) {
  const rect=await page.locator(`[data-role="${role}"]`).boundingBox();assert(rect&&rect.x>=0&&rect.x+rect.width<=width&&rect.y+rect.height<844);
 }
 await page.screenshot({path:`${out}/${width}-dev-menu.png`});
 for(const role of ['crate3','crate8']) {
  await selectDevFixture(page,role);
  const advance=ticks=>page.evaluate(n=>window.__advance(n),ticks);
  const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
  const initial=await state(),expected=role==='crate3'?3:2,count=role==='crate3'?3:1;
  assert.equal(initial.grenade.supply.destruction.stage,0);assert.equal(initial.enemies.length,0);
  await page.evaluate(()=>window.__cues=[]);await advance(1);
  await page.screenshot({path:`${out}/${width}-${role}-intact.png`});
  const times=[];let stage=0;
  for(let tick=0;tick<240;tick++) {
   await advance(1);const s=await state(),next=s.grenade.supply?.destruction.stage??3;
   if(next>stage) {
    times.push(s.elapsedSeconds);stage=next;
    if(stage<3)assert(Math.abs(s.grenade.supply.destruction.recoverAtSeconds-s.elapsedSeconds-.7)<1e-8);
    if(stage===1) {
     await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(30);assert.deepEqual(await state(),frozen);
     await page.getByRole('button',{name:'Resume game',exact:true}).tap();await advance(10);
     const saved=await state();await advance(6);await page.evaluate(saved=>window.__testApp.simulation.restoreState(saved),saved);assert.deepEqual(await state(),saved);
    }
    if(stage===2)await advance(10);
    await page.screenshot({path:`${out}/${width}-${role}-stage${stage}.png`});
   }
   if(stage===3)break;
  }
  assert.equal(times.length,3);assert(times[1]-times[0]>=.7-1e-8&&times[2]-times[1]>=.7-1e-8);
  assert.equal((await state()).grenade.inventory,expected);await advance(count===3?25:12);
  assert.equal(await page.locator('.supply-reward-item:visible').count(),count);
  await page.screenshot({path:`${out}/${width}-${role}-transfer.png`});
  const transforms=()=>page.locator('.supply-reward-item').evaluateAll(items=>items.map(e=>e.style.transform));
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();const paused=await transforms();await advance(30);assert.deepEqual(await transforms(),paused);
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  const arrivals=new Set(),lastPositions=new Map();
  for(let tick=0;tick<90;tick++) {
   await advance(1);
   const frame=await page.evaluate(()=>{const button=document.querySelector('.grenade-button').getBoundingClientRect();return {
    arrived:window.__testApp.supplyTransfer.transfer?.arrived??null,target:{x:button.x+button.width/2,y:button.y+button.height/2},
    items:[...document.querySelectorAll('.supply-reward-item')].map(e=>{const b=e.getBoundingClientRect();return{hidden:e.hidden,x:b.x+b.width/2,y:b.y+b.height/2};})};});
   if(frame.arrived!==null)arrivals.add(frame.arrived);
   for(let i=0;i<count;i++)if(!frame.items[i].hidden)lastPositions.set(i,{...frame.items[i],target:frame.target});
  }
  for(let i=1;i<=count;i++)assert(arrivals.has(i));
  for(const p of lastPositions.values())assert(Math.hypot(p.x-p.target.x,p.y-p.target.y)<12);
  assert.equal(lastPositions.size,count);assert.equal(await page.locator('.supply-reward-item:visible').count(),0);
  const cues=await page.evaluate(()=>window.__cues.filter(c=>['supplyImpact','supplyCrack','supplyOpen','reward'].includes(c)));
  assert.deepEqual(cues,['supplyImpact','supplyCrack','supplyOpen','reward']);
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  await page.evaluate(()=>window.__testApp.retry());
  assert.deepEqual(await state(),initial);assert.equal(await page.locator('.supply-reward-item:visible').count(),0);
  results.runs.push({width,role,openingSeconds:times[2]-times[0],effectiveHits:times.length,cues,transfers:count,inventory:expected,partialRestore:true,pauseRecovery:true,pauseTransfer:true,retry:true});
 }
 await page.close();
}assert.deepEqual(results.errors,[]);
}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

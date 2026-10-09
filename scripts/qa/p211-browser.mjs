import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p211/after';mkdirSync(out,{recursive:true});
const barsOnly=process.argv[3]==='bars';
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={runs:[],errors:[]};
try{for(const [width,inset,mobile] of [[390,0,true],[350,0,true],[390,34,true],[350,34,true],[1280,0,false]]){
 const name=`${width}-${inset}`,page=await browser.newPage({viewport:{width,height:mobile?844:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Start game with audio'}).waitFor();
 await page.locator('.beachhead-defense').evaluate((v,n)=>v.style.setProperty('--hud-inset-bottom',`${n}px`),inset);
 const shot=async label=>{await page.screenshot({path:`${out}/${name}-${label}.png`});};
 await shot('start');await page.getByRole('button',{name:'Start game with audio'}).click();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=performance.now();window.__advance=n=>{for(let i=0;i<n;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};});
 const advance=n=>page.evaluate(n=>window.__advance(n),n),state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
 let boxes=[],heldBox=null,reduced=[],initialProgression=null;
 if(!barsOnly){
 await selectDevFixture(page,'crate3');await advance(1);
 const initial=await state();await shot('lv3');
 initialProgression=initial.progression;
 await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.progression.xp=55;a.simulation.restoreState(s);});await advance(1);await page.waitForTimeout(300);await shot('xp-half');
 assert.equal(await page.locator('.xp-fill').evaluate(e=>e.style.clipPath),'inset(0px 50% 0px 0px round 0.45rem)');
 await page.evaluate(s=>window.__testApp.simulation.restoreState(s),initial);await advance(1);await page.waitForTimeout(300);
 boxes=await page.locator('.movement-button,.xp-track,.grenade-button,.build-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{class:e.className,x:r.x,y:r.y,w:r.width,h:r.height};}));
 for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=(mobile?844:900));if(b.class.includes('movement'))assert(b.w>=44&&b.h>=44);}
 await page.getByRole('button',{name:'Pause game',exact:true}).click();const frozen=await state();await advance(60);assert.deepEqual(await state(),frozen);await shot('paused');
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 for(let i=0;i<30&&(await state()).grenade.supply;i++)await advance(10);
 await advance(125);assert.equal((await state()).grenade.inventory,3);assert(await page.locator('.grenade-button').isEnabled());await shot('acquired');
 await page.keyboard.press('Tab');await page.locator('.movement-right').focus();await shot('focused');
 const right=await page.locator('.movement-right').boundingBox();await page.mouse.move(right.x+right.width/2,right.y+right.height/2);await page.mouse.down();await advance(3);await shot('held');
 heldBox=await page.locator('.movement-right').boundingBox();
 // The pre-P2.11 button translated on press; the new face should move within a fixed hit area.
 if(out.includes('after'))assert.deepEqual(heldBox,right);await page.mouse.up();
 // The zero-squad state follows the normal Game Over/Retry path.
 await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);});await advance(3);await shot('game-over');
 await page.getByRole('button',{name:'Retry',exact:true}).click();await advance(1);assert.equal((await state()).grenade.inventory,0);assert.equal((await state()).grenade.supply.destruction.stage,0);
 await selectDevFixture(page,'evolve');
 for(let i=0;i<150&&(await state()).progression.level<6;i++)await advance(10);
 assert.equal((await state()).progression.level,6);await advance(10);await page.waitForTimeout(120);await shot('lv6-evolution');
 const announcement=await page.locator('.level-up-message strong').boundingBox(),weapon=await page.locator('.battle-weapon-icon').boundingBox();
 if(out.includes('after'))assert(announcement.x+announcement.width<weapon.x-3||announcement.y+announcement.height<weapon.y,'Level-up plaque overlaps loadout');
 await selectDevFixture(page,'mg8');await advance(60);assert.equal((await state()).progression.level,8);assert.equal((await state()).squad.count,3);await shot('lv8');
 await page.locator('.xp-level-number').evaluate(e=>e.textContent='10');await shot('double-digit');await advance(1);
 await page.locator('.tuning-panel > summary').click();await shot('dev');await page.locator('.tuning-panel > summary').click();
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Pause game',exact:true}).click();await shot('reduced-motion');
 reduced=await page.locator('.xp-fill,.xp-level,.grenade-button').evaluateAll(es=>es.map(e=>({class:e.className,animation:getComputedStyle(e).animationName})));
 }
 // Existing deterministic art-review state supplies the Lv5 Heavy/Giant bars.
 await page.goto((process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/')+'?review=threats');await page.getByRole('button',{name:'Start game with audio'}).click();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(n=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);document.querySelector('.beachhead-defense').style.setProperty('--hud-inset-bottom',`${n}px`);
  window.__clock=performance.now();window.__advance=ticks=>{for(let i=0;i<ticks;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
 },inset);
 for(let i=0;i<15;i++)await advance(10);
 assert.equal((await state()).progression.level,5);await shot('lv5-bars');
 // Exercise damaged and overlapping frames without altering HP calculations.
 await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.enemies.filter(e=>e.archetype==='heavy'||e.archetype==='giant').forEach(e=>{e.hp=Math.ceil(e.hp*.45);e.z=13;e.x=.7;});a.simulation.restoreState(s);});await advance(1);await shot('bars-overlap');
 if(mobile){
  await page.reload();await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'crate3');
  await page.evaluate(n=>{const a=window.__testApp;a.renderFrame(performance.now());cancelAnimationFrame(a.frameId);document.querySelector('.beachhead-defense').style.setProperty('--hud-inset-bottom',`${n}px`);},inset);
  assert.equal(await page.locator('.beachhead-defense').getAttribute('data-input-presentation'),'touch');await shot('touch-full-hud');
  const cdp=await page.context().newCDPSession(page),r=await page.locator('.movement-right').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await shot('touch-held');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }
 results.runs.push({width,inset,mobile,boxes,heldBox,reduced,initialProgression,renderer:await page.evaluate(()=>window.__testApp.renderer.getDebugStats())});
 console.log('P2.11 screenshots checked',name);await page.close();
}assert.deepEqual(results.errors,[]);}finally{writeFileSync(`${out}/${barsOnly?'bars-results':'results'}.json`,JSON.stringify(results,null,2));await browser.close();}

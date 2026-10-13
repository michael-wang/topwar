// Retained MG regression presets, real simulation firing and Retry. Test-side exposure only.
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const out=process.argv[2]??'artifacts/p3b6a/mg-quick-test';mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [350,390]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5175/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 if(width===350)await page.locator('.beachhead-defense').evaluate(e=>e.style.setProperty('--hud-inset-bottom','34px'));
 const open=async()=>{if(!await page.locator('.tuning-panel').evaluate(e=>e.open))await page.locator('.tuning-panel > summary').tap();};
 await open();assert.deepEqual(await page.locator('.dev-review-controls button[data-role]').allTextContents(),['🚢 驅逐艦進場','🚨 BOSS 進場','🏆 勝利結算']);
 const bounds=await page.locator('.dev-review-controls button[data-role]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
 for(const b of bounds)assert(b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=844&&b.width>=44&&b.height>=48,JSON.stringify(b));
 await page.screenshot({path:`${out}/${width}-dev-menu.png`});
 const rows=[];let reference;const stop=await startGameRecording(page,width);
 for(const [level,count,rate,stage]of [[6,1,18,1],[7,1,22.5,2],[8,1,27,3],[9,2,27,3],[10,3,27,3]]){
  await selectDevFixture(page,`mg${level}`);
  assert.equal(await page.locator('.tuning-panel').evaluate(e=>e.open),false);
  const initial=await page.evaluate(()=>window.__testApp.simulation.getState());
  reference??=initial;assert.equal(initial.seed,reference.seed);assert.deepEqual(initial.rngState,reference.rngState);assert.deepEqual(initial.enemies,reference.enemies);
  assert.equal(initial.progression.level,level);assert.equal(initial.squad.count,count);assert.equal(initial.enemies.length,65);
  assert.equal(await page.locator('.battle-weapon-pips .is-filled').count(),stage);
  assert.equal(await page.locator('.xp-level-number').innerText(),String(level));
  const row=await page.evaluate(({count})=>{
   const a=window.__testApp,c=a.config,t={...c.player,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
   for(let i=0;i<60;i++)a.simulation.step(1/60,{targetX:0},t);
   let next=a.simulation.getState().weapons.nextProjectileId;const shots=Array(count).fill(0);
   for(let i=0;i<600;i++){if(i===150)a.simulation.stepLane(1);a.simulation.step(1/60,{targetX:0},t);const s=a.simulation.getFrameState();for(const p of s.projectiles.filter(p=>p.id>=next)){if(p.kind!=='machineGun'||p.lane!==s.player.selectedLane||p.damage!==c.tiers.tier1Power)throw Error('Non-authoritative MG shot');shots[p.memberIndex]++;}next=s.weapons.nextProjectileId;}
   const after=a.simulation.getState();
   // Ordinary ignored-lane contacts reach Game Over, then exercise the real Retry button.
   for(let i=0;i<2400&&a.simulation.getFrameState().squad.count;i++)a.simulation.step(1/60,{targetX:0},t);
   if(a.simulation.getState().squad.count)throw Error('Expected real contact Game Over');
   const now=performance.now();a.previousFrameTimestampMs=null;for(let i=0;i<20;i++){a.renderFrame(now+i*100);cancelAnimationFrame(a.frameId);}
   return{shots,remaining:after.enemies.length,level:after.progression.level};
  },{count});
  assert.deepEqual(row.shots,Array(count).fill(rate*10));assert.equal(row.level,level);assert(row.remaining<65);
  await page.getByRole('button',{name:'Retry',exact:true}).tap();assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),initial);
  assert.equal(await page.evaluate(()=>window.__testApp.devReviewFixture),`mg${level}`);
  await page.evaluate(async()=>{const a=window.__testApp;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();let start;await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;a.renderFrame(ts);cancelAnimationFrame(a.frameId);if(ts-start<3000)requestAnimationFrame(frame);else resolve();}));});
  await page.screenshot({path:`${out}/${width}-mg${level}.png`});rows.push({level,count,perMemberHz:rate,totalHz:rate*count,shots:row.shots,retry:true});
 }
 const recording=await stop();writeFileSync(`${out}/${width}-mg-test.webm`,recording);await inspectRecordingFrames(browser,recording,width,`${out}/${width}-mg-test`,[2,10,20]);
 await selectDevFixture(page,'late');assert.equal(await page.locator('.dev-review-controls button[aria-pressed="true"]').count(),0);
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().enemies.length),42);
 assert.deepEqual(errors,[]);results.push({width,bounds,rows,mainMenu:true,errors});await page.close();console.log(`Mobile MG TEST passed ${width}`);
}}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

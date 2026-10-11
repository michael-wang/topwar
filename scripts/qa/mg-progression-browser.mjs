import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
import {startGameRecording,inspectRecordingFrames} from './browser-recording.mjs';
const out=process.argv[2]??'artifacts/p3b6a/loadouts';mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const old=JSON.parse(readFileSync('artifacts/p3b6a/baseline/metrics.json')).runs.find(r=>r.scenario==='lv10'&&r.seed===17&&r.policy==='competent').entry;
const results=[];
try{for(const width of [350,390]) {
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5175/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 const stop=await startGameRecording(page,width),rows=[];
 for(const [level,role,rate,count,weaponPips]of [[6,'late6',18,1,1],[7,'mg7',22.5,1,2],[8,'mg8',27,1,3],[9,'mg9',27,2,3],[10,'mg10',27,3,3]]) {
  await selectDevFixture(page,role);await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  const row=await page.evaluate(({level,rate,count,weaponPips})=>{
   const a=window.__testApp,c=a.config,s=a.simulation.getState();
   const filled=selector=>document.querySelectorAll(selector+' .is-filled').length;
   const hud={weapon:filled('.battle-weapon-pips'),squad:filled('.battle-squad-pips'),squadHidden:document.querySelector('.battle-squad-pips').hidden};
   const tuning={...c.player,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
   for(let i=0;i<60;i++)a.simulation.step(1/60,{targetX:0},tuning);
   let next=a.simulation.getFrameState().weapons.nextProjectileId;const shots=Array(count).fill(0);
   for(let i=0;i<600;i++){a.simulation.step(1/60,{targetX:0},tuning);const f=a.simulation.getFrameState();for(const p of f.projectiles.filter(p=>p.id>=next))shots[p.memberIndex]++;next=f.weapons.nextProjectileId;}
   const after=a.simulation.getState();return{level:s.progression.level,count:s.squad.count,hud,shots,afterLevel:after.progression.level,rate};
  },{level,rate,count,weaponPips});
  assert.equal(row.level,level);assert.equal(row.count,count);assert.equal(row.afterLevel,level);assert.deepEqual(row.shots,Array(count).fill(rate*10));
  assert.equal(row.hud.weapon,weaponPips);assert.equal(row.hud.squadHidden,count===1);if(count>1)assert.equal(row.hud.squad,count);rows.push(row);
  await selectDevFixture(page,role);
  await page.evaluate(async()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();let start;await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;a.renderFrame(ts);cancelAnimationFrame(a.frameId);if(ts-start<3000)requestAnimationFrame(frame);else resolve();}));});
  await page.screenshot({path:`${out}/${width}-lv${level}.png`});
 }
 const recording=await stop();writeFileSync(`${out}/${width}-mg-stages.webm`,recording);await inspectRecordingFrames(browser,recording,width,`${out}/${width}-mg-stages`,[2,8,14]);
 // Old eight-level three-MG saves render their own cartridge/squad stages.
 await page.evaluate(s=>{const a=window.__testApp;a.simulation.restoreState(s);a.battleInfo.reset();a.xpHud.reset();a.progressionObserver.reset();a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();const now=performance.now();a.renderFrame(now);cancelAnimationFrame(a.frameId);a.renderFrame(now+200);cancelAnimationFrame(a.frameId);},old);
 assert.equal(await page.locator('.battle-weapon-pips .is-filled').count(),1);assert.equal(await page.locator('.battle-squad-pips .is-filled').count(),3);
 assert.equal(await page.locator('.xp-level-number').innerText(),'8');assert(await page.locator('.xp-hud').evaluate(e=>e.classList.contains('xp-complete')));
 await page.screenshot({path:`${out}/${width}-historical-lv8.png`});
 await selectDevFixture(page,'crate8');assert.deepEqual(await page.evaluate(()=>{const s=window.__testApp.simulation.getState();return[s.progression.level,s.squad.count]}),[8,1]);
 await selectDevFixture(page,'crate10');assert.deepEqual(await page.evaluate(()=>{const s=window.__testApp.simulation.getState();return[s.progression.level,s.squad.count]}),[10,3]);
 assert.deepEqual(errors,[]);results.push({width,rows,historical:true,crate8:true,crate10:true});await page.close();console.log(`MG stage/HUD/history checks passed ${width}`);
}}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

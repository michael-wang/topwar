import assert from 'node:assert/strict';
import { exposeProductionApp } from './production-app-hook.mjs';
// Run from the repository root. Generated output is ignored by Git.
import { preview } from 'vite';
// Uses the existing QA browser runtime; no shipping dependency.
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { publicAssets } from '../public-assets.mjs';
const { manifest } = publicAssets('public');
const out = process.argv[2] ?? 'artifacts/sanity';
mkdirSync(out, { recursive: true });
const shippingJs = readdirSync('dist/assets').filter(name => name.endsWith('.js'))
  .map(name => readFileSync('dist/assets/' + name, 'utf8')).join('\n');
if (['giant-review', 'GIANT 特效測試', '重測 GIANT', 'GIANT review requires'].some(marker => shippingJs.includes(marker)))
  throw Error('DEV GIANT review survived production tree-shaking');
if (['dev-fullscreen-trial', '進入全螢幕（DEV）', '離開全螢幕（DEV）'].some(marker => shippingJs.includes(marker)))
  throw Error('DEV fullscreen trial survived production tree-shaking');
if (['explosion-lab', 'Explosion Lab', 'Flash inside black core', 'Billowing layered cloud',
  'Dirty bombardment bank', 'Invalid explosion comparison', 'B-fast', 'Hybrid D'].some(marker => shippingJs.includes(marker)))
  throw Error('DEV explosion experiments survived production tree-shaking');
if (shippingJs.includes('__testApp') || shippingJs.includes('qa:scene-start')) throw Error('QA instrumentation leaked into production');
if (['dev-fps', 'dev-wake-status', 'vite:beforeFullReload', 'checkpoint-write', '__qaHpMode'].some(marker => shippingJs.includes(marker)))
  throw Error('DEV FPS/lifecycle diagnostics or HP audit controls survived production tree-shaking');
if(['15 秒熄屏 / Resume 測試','開發測試工具','確認開始測試','Bounded QA preparation','QA preparation lost',
  'QA requires authored Defense naval Survival','QA requires authored Lv10 three MGs',
  'BOSS TEST requires'].some(marker=>shippingJs.includes(marker)))
  throw Error('Engineering sleep fixture survived production tree-shaking');
if (['SURVIVAL TEST', 'dev-survival-test', 'survival7-baseline', 'survival10-experimental', 'survival10-staged', 'survival10-ahead', 'Invalid SURVIVAL TEST preset', 'ordinarySpeedMultiplier:1.4', 'ordinarySpeedMultiplier:1.6', 'heavyCount:11', 'heavyCount:15', 'heavyCount:19', 'minimumXp:245'].some(marker => shippingJs.includes(marker)))
  throw Error('Survival comparison controls or fixtures survived production tree-shaking');
if (['NAVAL BARRAGE', 'dev-naval-barrage', 'Invalid NAVAL BARRAGE review', 'BARRAGE ON', 'BARRAGE OFF', 'BOSS TEST', 'dev-boss-test', 'BOSS TEST requires', 'boss-phase1', 'boss-phase2', 'boss-phase3', 'boss-finish', 'MG TEST', 'dev-mg-test', 'MG6', 'MG9', 'MG10', 'MG TEST requires', 'MG TEST preset must'].some(marker => shippingJs.includes(marker)))
  throw Error('Development combat test controls or fixtures survived production tree-shaking');
if (['TRACER:', 'dev-projectile-controls', 'Ivory dart', 'Red tracer', 'Ink spear', 'LV1 RIFLE', 'EnemyVfxLab', 'ENEMY_VFX_LAB', 'enemy-vfx-lab', 'DEV Review', 'DEV TOOLS', 'BALANCE & AUDIO', 'Reset Defaults', 'CURVE', 'Digit4', 'EVOLVE', 'Digit5', 'Digit6', 'MG7', 'MG8', 'CRATE3', 'CRATE8', 'SHELL review requires', 'shell-review-muzzle', 'artillery dodge test', 'Supply DEV review requires', 'Late DEV entry requires', 'Restart Lv6 before the Machine Gun release and full Carnival'].some(marker => shippingJs.includes(marker)))
  throw Error('Development review controls/factory survived production tree-shaking');
const server=await preview({preview:{host:'127.0.0.1',port:5181,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
const authoredConfig=JSON.parse(readFileSync('public/game-data/game.json','utf8'));
const authoredLevel=JSON.parse(readFileSync('public/game-data/levels/level-001.json','utf8'));
async function controlledFrames(page) {
 await page.evaluate(()=>{
  const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__stamp=performance.now();
  window.__draw=()=>{a.renderFrame(window.__stamp);cancelAnimationFrame(a.frameId);};
  window.__advance=seconds=>{const gpu=a.renderer.renderer,render=gpu.render;gpu.render=()=>{};
   for(let i=0;i<Math.ceil(seconds*60);i++){window.__stamp+=1000/60;window.__draw();}
   gpu.render=render;window.__draw();};window.__draw();
 });
}
async function checkAirSupport(page,width,out) {
 await page.locator('.tuning-panel > summary').tap();await page.locator('[data-role="air-support"]').tap();
 // Isolate raid damage from MG accounting; dodge using ordinary lane input.
 await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.projectiles=[];s.weapons.rifleMemberCooldowns.fill(100);s.weapons.rifleCooldownRemainingSeconds=100;a.simulation.restoreState(s);});
 const advance=seconds=>page.evaluate(seconds=>{const a=window.__testApp,gpu=a.renderer.renderer,render=gpu.render;gpu.render=()=>{};
  try{for(let i=0;i<Math.ceil(seconds*60);i++){const s=a.simulation.getFrameState();if(!a.paused){const danger=(s.artillery?.shells??[]).filter(p=>p.impactAtSeconds-s.elapsedSeconds<.65),lane=[0,1,2,3,4].filter(l=>!danger.some(p=>p.targetLane===l)).sort((x,y)=>Math.abs(x-2)-Math.abs(y-2))[0];if(lane!==undefined&&s.player.selectedLane!==lane)a.simulation.stepLane(lane<s.player.selectedLane?-1:1);}window.__advance(1/60);}}
  finally{gpu.render=render;}window.__draw();},seconds);
 await advance(.1);await page.waitForFunction(()=>window.__testApp.audio.voice?.message==='airSupportReady'&&window.__testApp.audio.voice.source!==null);
 const duration=await page.evaluate(()=>window.__testApp.audio.voice.source.buffer.duration);assert(Math.abs(duration-6.765708)<.002);
 assert.equal(await page.locator('.field-observer p').textContent(),'各位！我剛爭取到空中轟炸支援！');
 await advance(3.3);assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().commanderSupport.airstrike.triggeredAtSeconds),null);
 assert(await page.getByRole('button',{name:'呼叫空襲',exact:true}).isEnabled());
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();
 const saved=await page.evaluate(()=>window.__testApp.simulation.getState());await advance(.5);assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved);
 assert.equal(await page.evaluate(()=>window.__testApp.audio.supportSources.size),0);
 await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
 await controlledFrames(page);assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved);
 assert.equal(await page.locator('.manual-air-support i').evaluate(e=>e.style.opacity),'0');
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();await page.evaluate(()=>window.__draw());
 await page.getByRole('button',{name:'呼叫空襲',exact:true}).tap();await advance(.1);
 await page.waitForFunction(()=>window.__testApp.audio.voice?.message==='airSupportCalled'&&window.__testApp.audio.voice.source!==null);
 assert.equal(await page.locator('.field-observer p').textContent(),'轟炸機馬上抵達現場！注意！轟炸即將開始！！');
 const trigger=await page.evaluate(()=>window.__testApp.simulation.getState().commanderSupport.airstrike.triggeredAtSeconds);assert(trigger!==null);
 await page.screenshot({path:out+'/air-entry-'+width+'.png',scale:'css'});
 await page.evaluate(()=>{const a=window.__testApp,consume=a.simulation.consumeSupportEvents.bind(a.simulation);window.__raidDamage=[];a.simulation.consumeSupportEvents=()=>{const events=consume();for(const e of events)if(e.kind==='supportBomb')window.__raidDamage.push(e.tankDamage);return events;};});
 for(const [target,name]of [[6.5,'arrival'],[7.65,'near'],[8.30,'middle'],[8.95,'far'],[9.6,'tank'],[10.9,'final'],[16,'departure']]){
  const elapsed=await page.evaluate(()=>{const s=window.__testApp.simulation.getState();return s.elapsedSeconds-s.commanderSupport.airstrike.triggeredAtSeconds;});await advance(Math.max(0,target-elapsed));await page.screenshot({path:out+'/air-'+name+'-'+width+'.png',scale:'css'});
 }
 const state=await page.evaluate(()=>window.__testApp.simulation.getState());assert.equal(state.commanderSupport.airstrike.status,'completed');assert.deepEqual(await page.evaluate(()=>window.__raidDamage),[0,0,0,500,0,0]);assert.equal(state.defenseTank.hp,1600);assert.equal(state.combatStats.gruntKills+state.combatStats.heavyKills+state.combatStats.giantKills,0);assert(state.squad.count>0);assert.equal(state.commanderSupport.airstrike.impacts.length,12);
 await page.locator('.tuning-panel > summary').tap();await page.locator('[data-role="air-support"]').tap();await page.evaluate(()=>window.__draw());
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().commanderSupport.airstrike.triggeredAtSeconds),null);
 return {role:'air-support',policy:'manualPlayerCall',voice:duration,damage:[500],bossHp:1600,restored:true,retry:true};
}
async function checkPlaytestScenes(page,width,out) {
 await page.waitForFunction(()=>['destroyer','tankBoss','victory'].every(m=>window.__testApp.audio.radioDurationSeconds('zh-TW',m)>0));
 await controlledFrames(page);
 const scenes=[];
 for(const [role,message,entrySeconds] of [['naval','destroyer',1.5],['boss-intro','tankBoss',.8],['victory','victory',4.3]]) {
  if(!await page.locator('.tuning-panel').evaluate(e=>e.open))await page.locator('.tuning-panel > summary').tap();
  assert(await page.getByText('切換場景或返回一般遊戲會取代目前進度。',{exact:true}).isVisible());
  if(role==='naval') {
   const bounds=await page.locator('.dev-review-controls button[data-role]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};}));
   bounds.forEach(b=>assert(b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=844&&b.height>=52));
   await page.screenshot({path:`${out}/playtest-menu-${width}.png`});
  }
  await page.locator(`[data-role="${role}"]`).tap();
  assert.equal(await page.locator('.tuning-panel').evaluate(e=>e.open),false);
  await page.evaluate(seconds=>{cancelAnimationFrame(window.__testApp.frameId);window.__draw();window.__advance(seconds);},entrySeconds);
  await page.waitForFunction(message=>window.__testApp.audio.voice?.message===message&&window.__testApp.audio.voice.source!==null,message);
  assert(await page.locator('.field-observer').isVisible());
  await page.screenshot({path:`${out}/playtest-${role}-${width}.png`});
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  const saved=await page.evaluate(()=>({state:window.__testApp.simulation.getState(),cp:JSON.parse(localStorage.getItem('topwar:session:v1:release'))}));
  assert.equal(saved.cp.fixture,role);assert(saved.cp.state);
  await page.evaluate(()=>window.__advance(.5));assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved.state);
  await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  await controlledFrames(page);assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved.state);
  assert(await page.evaluate(()=>window.__testApp.paused));
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();await page.evaluate(()=>{cancelAnimationFrame(window.__testApp.frameId);window.__draw();window.__advance(.2);});
  if(role==='victory') {
   await page.waitForFunction(()=>window.__testApp.audio.radioDurationSeconds('zh-TW','victory')>0);
   await page.evaluate(()=>window.__draw());
   await page.waitForFunction(()=>window.__testApp.audio.voice?.message==='victory'&&window.__testApp.audio.voice.source!==null);
   assert(await page.evaluate(offset=>window.__testApp.audio.voice.offset>=offset,saved.cp.playtestVictory.communication.offsetSeconds));
   await page.evaluate(()=>window.__advance(9));await page.waitForTimeout(2500);
   assert(await page.locator('.stage-clear-overlay:not(.defeat-results-overlay)').isVisible());assert(await page.getByText('DEV 範例戰績',{exact:true}).isVisible());
   assert.equal(await page.evaluate(()=>window.__testApp.audio.music.lastState),'VICTORY');
   assert(await page.evaluate(()=>window.__testApp.renderer.tankRenderer.smoke.visible&&window.__testApp.renderer.tankRenderer.flames.visible));
   await page.screenshot({path:`${out}/playtest-victory-results-${width}.png`});
   await page.getByRole('button',{name:'再玩一次',exact:true}).tap();await page.evaluate(()=>{cancelAnimationFrame(window.__testApp.frameId);window.__draw();});
   assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().defenseTank.hp),0);
  } else {
   assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);
   await page.evaluate(role=>{const s=window.__testApp.simulation.getState();
    const at=role==='naval'?s.destroyer.startedAtSeconds+s.catharsis.balance.destroyer.shotTimes[0]:s.defenseTank.activeAtSeconds;
    window.__advance(Math.max(0,at+.3-s.elapsedSeconds));},role);
   assert((await page.evaluate(()=>window.__testApp.simulation.getState().artillery.shells.length))>0);
   if(role==='boss-intro') {
    assert.equal(await page.evaluate(()=>window.__testApp.audio.music.lastState),'BOSS_1');
    await page.waitForFunction(()=>window.__testApp.audio.bossTheme?.playing);
    await page.evaluate(()=>window.__draw());
    assert(await page.evaluate(()=>window.__testApp.audio.bossTheme.media.duration>135&&window.__testApp.audio.bossTheme.media.loop));
    // The AudioParam value reflects the next audio render quantum, not the JS call stack.
    await page.waitForFunction(()=>window.__testApp.audio.music.bus.gain.value===0);
   }
   await page.screenshot({path:`${out}/playtest-${role}-combat-${width}.png`});
  }
  scenes.push({role,restored:true,voice:message});
 }
 scenes.push(await checkAirSupport(page,width,out));
 await page.locator('.tuning-panel > summary').tap();await page.locator('[data-action="normal"]').tap();
 await page.evaluate(()=>{cancelAnimationFrame(window.__testApp.frameId);window.__draw();});
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().progression.level),1);
 assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().catharsis.balance.commanderSupport.heavyRaid.lastStand.triggerPolicy),'manualPlayerCall');
 results[`${width}:playtest`]=scenes;
}
try {
for(const width of [390,350]){
for(const [query,level]of [['',1],['?review=threats',1]]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-US'});const errors=[];
 const runtimeRequests=[];let configResponse,levelResponse;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>errors.push(`Request failed: ${r.url()}`));
 page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/topwar/game-data/')||u.pathname.startsWith('/topwar/models/'))runtimeRequests.push(r.url());});
 page.on('response',r=>{const path=new URL(r.url()).pathname;if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);if(path===`/topwar/${manifest['game-data/game.json']}`)configResponse=r;if(path===`/topwar/${manifest['game-data/levels/level-001.json']}`)levelResponse=r;});
 await page.addInitScript(()=>{
   localStorage.setItem('topwar.observer.locale','en');
   window.__qaJsonFetches=[];window.__qaUnhandled=[];
   window.addEventListener('unhandledrejection',e=>window.__qaUnhandled.push(String(e.reason)));
   const nativeFetch=window.fetch.bind(window);
   window.fetch=(input,options)=>{const url=input instanceof Request?input.url:String(input);if(url.includes('/game-data/'))window.__qaJsonFetches.push({url,cache:options?.cache});return nativeFetch(input,options);};
 });
 await exposeProductionApp(page);
 await page.goto(`http://127.0.0.1:5181/topwar/${query}`);await page.waitForSelector('canvas');
 await page.waitForSelector('.game-start-overlay');
 const sha=(await page.locator('.build-label').textContent()).split(' · ').at(-1);
 if(!/^[0-9a-f]{7,40}$/.test(sha))throw Error('Missing build SHA');
 for(const expression of ['neutral','alert']){
  const asset=await page.request.get(`http://127.0.0.1:5181/topwar/${manifest[`art/observer/${expression}.webp`]}`);
  if(!asset.ok()||!asset.headers()['content-type']?.includes('image/webp'))throw Error('Missing local observer portrait under Pages base path');
 }
 for(const name of ['observer_destroyer_zh-TW.mp3','observer_stage1_boss_intro_zh-TW.mp3','commander_stage1_intro_zh-TW.mp3','commander_stage1_victory_zh-TW.mp3','commander_air_support_zh-TW.mp3','boss-theme.mp3']){
  const voice=await page.request.get(`http://127.0.0.1:5181/topwar/${manifest[`audio/${name}`]}`);
  if(!voice.ok()||!voice.headers()['content-type']?.includes('audio/mpeg')
    ||!(await voice.body()).equals(readFileSync(`public/audio/${name}`)))
    throw Error('Approved audio missing or altered under Pages base path');
 }
 const config=await configResponse?.json(),levelData=await levelResponse?.json();
 if(JSON.stringify(config)!==JSON.stringify(authoredConfig)||JSON.stringify(levelData)!==JSON.stringify(authoredLevel))throw Error('Production runtime data differs from authored data');
 if(!config.catharsis.defenseMode||config.catharsis.grenade.teachingGrantAmount!==3)throw Error('Stale defense/Grenade config');
 assert.equal(config.catharsis.commanderSupport.heavyRaid.lastStand.triggerPolicy,'manualPlayerCall');
 assert.equal(config.catharsis.commanderSupport.heavyRaid.lastStand.livingMgHpThresholds,undefined);
 if(JSON.stringify(config.catharsis.navalBarrage.postImpactCooldown)!=='{"initialDelaySeconds":2,"minimumGapSeconds":2,"maximumGapSeconds":5}')throw Error('Stale Stage 1 continuous naval cooldown');
 if(!await page.locator('#game-viewport.beachhead-defense').count()||await page.getByText(/ENEMY LV/).isVisible())throw Error('Production loaded legacy bridge/HUD');
 for(const url of runtimeRequests){const u=new URL(url);if(u.search||!Object.values(manifest).some(path=>u.pathname===`/topwar/${path}`))throw Error(`Unversioned or mismatched runtime asset: ${url}`);}
 if(runtimeRequests.filter(url=>new URL(url).pathname.endsWith('.glb')).length!==0)throw Error('Defense must not download retired GLBs');
 if(new Set(runtimeRequests).size!==runtimeRequests.length)throw Error('Duplicate runtime resource request');
 const jsonFetches=await page.evaluate(()=>window.__qaJsonFetches);
 for(const path of ['game-data/game.json','game-data/levels/level-001.json'])if(!jsonFetches.some(r=>r.url===`/topwar/${manifest[path]}`&&r.cache===undefined))throw Error(`Missing content-addressed fetch: ${path}`);
 await page.screenshot({path:`${out}/production-start-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 await page.getByRole('button',{name:'Start game with audio'}).tap();
 // Production ignores DEV review queries; wait for the normal post-start HUD.
 await page.waitForFunction(level=>{
   const valid=!document.querySelector('.game-start-overlay')
     && document.querySelector('.xp-level-number')?.textContent===String(level)
     && !document.querySelector('.xp-hud')?.classList.contains('level-up');
   if(!valid){window.__qaHudStableAt=null;return false;}
   window.__qaHudStableAt??=performance.now();return performance.now()-window.__qaHudStableAt>=500;
 },level);
 const actual=await page.locator('.xp-level-number').textContent();
 if(await page.locator('.observer-languages').count())throw Error('Language selector survived closed-playtest policy');
 if(await page.locator('.field-observer p').getAttribute('lang')!=='zh-TW')throw Error('Observer did not ignore English browser and saved preference');
 if(await page.locator('#game-viewport').getAttribute('data-input-presentation')!=='touch'||await page.locator('.combat-keycue:visible').count())throw Error('Production touch Start exposed keyboard hints');
 await page.screenshot({path:`${out}/production-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 const labControls=await page.locator('.dev-review-controls').count();
 const devMenu=await page.locator('.tuning-panel').count();
 if(await page.locator('[data-role="late"],[data-role="mg7"],[data-role="mg8"],[data-role="carnival"]').count())throw Error('Production contains late DEV entries');
 const hiddenMovement=await page.locator('.touch-steering-band,.touch-steering-zone').count();
 if(hiddenMovement!==0||await page.locator('.movement-button:visible').count()!==2)throw Error('Production movement controls are not exclusively visible buttons');
 const mgLabControls=await page.locator('[data-role="machineGun"]').count();
 const evolveLabControls=await page.locator('[data-role="evolve"]').count();
 const grenadeLabControls=await page.locator('[data-role="grenade"]').count();
 await page.keyboard.press('Escape'); await page.keyboard.press('4'); await page.keyboard.press('5'); await page.keyboard.press('6');
 if(await page.locator('.qa-panel,.dev-advanced,.dev-fps,.dev-wake-status').count())throw Error('Production exposed engineering QA controls');
 assert.deepEqual(await page.locator('.dev-review-controls button[data-role]').allTextContents(), ['🚢 驅逐艦進場','🚨 BOSS 進場','🏆 勝利結算','✈️ 空中支援']);
 if(!query) await checkPlaytestScenes(page,width,out);
 errors.push(...await page.evaluate(()=>window.__qaUnhandled));
 results[`${width}:${query||'default'}`]={level:Number(actual),expected:level,sha,defenseMode:config.catharsis.defenseMode,teachingGrantAmount:config.catharsis.grenade.teachingGrantAmount,xpRequirements:config.catharsis.progression.xpRequirements,runtimeRequests,jsonFetches,devMenu,labControls,grenadeLabControls,mgLabControls,evolveLabControls,errors};if(Number(actual)!==level||devMenu!==1||labControls!==1||grenadeLabControls!==0||mgLabControls!==0||evolveLabControls!==0||errors.length)throw Error(JSON.stringify(results));await page.close();
}
}
writeFileSync(`${out}/production-sanity.json`,JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

import assert from 'node:assert/strict';
import { preview } from 'vite';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p3b6b4/production-naval';mkdirSync(out,{recursive:true});
const state=JSON.parse(readFileSync('artifacts/p3b6b4/performance/natural-production-state.json','utf8'));
assert.equal(state.destroyer.status,'complete');assert.equal(state.navalPresence.status,'stationed');assert(state.navalBarrage.enabled);
const server=await preview({preview:{host:'127.0.0.1',port:5193,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const width of [350,390]) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/topwar\/assets\/index-.*\.js$/,async route=>{const r=await route.fetch(),body=await r.text(),pattern=/new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)/g;
    assert.equal([...body.matchAll(pattern)].length,1);await route.fulfill({response:r,body:body.replace(pattern,m=>`(window.__testApp=${m})`)});});
  await page.goto('http://127.0.0.1:5193/topwar/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(state=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.simulation.restoreState(state);a.restored=true;
    a.fieldObserver?.reset();a.presentationMs=state.elapsedSeconds*1000;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();a.renderFrame(0);cancelAnimationFrame(a.frameId);
  },state);
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.__testApp.renderer.destroyerRenderer.group.visible),true);
  assert.equal(await page.locator('.dev-naval-barrage,.dev-fps,.tuning-panel,.dev-review-controls').count(),0);
  const bytes=await page.evaluate(()=>localStorage.getItem('topwar:session:v1:release'));assert(bytes);
  await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  const restored=await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);return {state:a.simulation.getState(),paused:a.paused,fixture:a.devReviewFixture};});
  assert.deepEqual(restored.state,state);assert(restored.paused);assert.equal(restored.fixture,null);
  await page.evaluate(()=>{const a=window.__testApp;a.renderFrame(0);cancelAnimationFrame(a.frameId);});
  assert.equal(await page.locator('.xp-level-number').textContent(),String(state.progression.level));
  await page.screenshot({path:`${out}/${width}-offshore-production.png`});
  const replay=await page.evaluate(()=>{const a=window.__testApp,c=a.config,r=a.runtimeTuning,tuning={...c.player,moveSpeed:r.moveSpeed,forwardSpeed:r.forwardSpeed,
    trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,
    rifle:{...c.weapon.rifle,fireRate:r.fireRate},rocket:c.weapon.rocket};
    const snapshot=a.simulation.getState();for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},tuning);
    const first=JSON.stringify(a.simulation.getState()),events=a.simulation.consumeArtilleryEvents();a.simulation.restoreState(snapshot);
    if(a.simulation.consumeArtilleryEvents().length)throw Error('Restore replayed artillery cues');
    for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},tuning);
    return {same:first===JSON.stringify(a.simulation.getState()),events:JSON.stringify(events)===JSON.stringify(a.simulation.consumeArtilleryEvents())};
  });assert(replay.same&&replay.events);assert.deepEqual(errors,[]);
  results.push({width,devicePixelRatio:2,shippingPolicy:true,shipVisible:true,checkpointIdentical:true,paused:true,replay,
    level:state.progression.level,enemies:state.enemies.length,shells:state.artillery.shells.length,checkpointCharacters:bytes.length,errors});await page.close();
}}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}

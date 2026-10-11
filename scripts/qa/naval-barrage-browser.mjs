import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p3b6b4/mobile';mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const width of [350,390]) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
  await page.goto('http://127.0.0.1:5175/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  for(const level of [8,9,10])for(const choice of ['on','off']) {
    await page.locator('.tuning-panel > summary').tap();
    if(!await page.locator('.dev-naval-barrage').evaluate(e=>e.open))await page.locator('.dev-naval-barrage > summary').tap();
    await page.locator(`[data-barrage="${level}"]`).tap();await page.locator('.tuning-panel > summary').tap();
    await page.locator(`[data-barrage="${choice}"]`).tap();
    const setup=await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);const s=a.simulation.getState();return {fixture:a.devReviewFixture,
      level:s.progression.level,soldiers:s.squad.count,barrage:s.navalBarrage.enabled,enemies:s.enemies.length,heavies:s.enemies.filter(e=>e.archetype==='heavy').length,panelOpen:a.tuningPanel.element.open};});
    assert.equal(setup.fixture,`barrage${level}-${choice}`);assert.equal(setup.level,level);assert.equal(setup.soldiers,level-7);assert.equal(setup.barrage,choice==='on');assert.equal(setup.panelOpen,false);
    const geometry=await page.evaluate(()=>{const e=document.querySelector('.dev-naval-barrage');e.open=true;document.querySelector('.tuning-panel').open=true;
      return [...e.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent,height:r.height,width:r.width,left:r.left,right:r.right};});});
    assert(geometry.every(b=>b.height>=44&&b.left>=0&&b.right<=width));
    await page.screenshot({path:`${out}/${width}-controls-${level}-${choice}.png`});
    await page.evaluate(()=>{const a=window.__testApp;a.tuningPanel.close();a.retry();cancelAnimationFrame(a.frameId);let stamp=0;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);
      const gpu=a.renderer.renderer,render=gpu.render;gpu.render=()=>{};for(let i=0;i<300;i++){stamp+=1000/60;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);}gpu.render=render;a.renderFrame(stamp+1000/60);cancelAnimationFrame(a.frameId);});
    const saved=await page.evaluate(()=>{const a=window.__testApp;return {state:a.simulation.getState(),fixture:a.devReviewFixture,ship:a.renderer.destroyerRenderer.group.visible,
      fps:document.querySelector('.dev-fps')?.textContent,wake:document.querySelector('.dev-wake-status')?.textContent};});assert.equal(saved.ship,true);
    await page.screenshot({path:`${out}/${width}-combat-${level}-${choice}.png`});
    await page.getByRole('button',{name:'Pause game',exact:true}).tap();
    const bytes=await page.evaluate(()=>localStorage.getItem('topwar:session:v1:dev'));assert(bytes);
    await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
    const restored=await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);return {state:a.simulation.getState(),paused:a.paused,fixture:a.devReviewFixture};});
    assert.deepEqual(restored.state,saved.state);assert(restored.paused);assert.equal(restored.fixture,saved.fixture);
    await page.getByRole('button',{name:'Resume game',exact:true}).tap();
    await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.retry();cancelAnimationFrame(a.frameId);});
    assert.equal(await page.evaluate(()=>window.__testApp.devReviewFixture),saved.fixture);
    results.push({width,level,choice,setup,geometry,checkpointCharacters:bytes.length,restoreIdentical:true,retrySelected:true});
  }
  assert.deepEqual(errors,[]);await page.close();
}}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

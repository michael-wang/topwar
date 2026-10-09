import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b/lifecycle';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const denied of [false,true]){
 const page=await browser.newPage({viewport:{width:350,height:844},isMobile:true,hasTouch:true,locale:'en-US'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 if(denied)await page.addInitScript(()=>{
  Object.defineProperty(window,'AudioContext',{value:undefined});
  Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});
 });
 await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.startup==='started');await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'naval');
 await page.evaluate(()=>{window.__clock=performance.now();window.__advance=n=>{for(let i=0;i<n;i++){const a=window.__testApp;a.renderFrame(window.__clock+=1000/60);cancelAnimationFrame(a.frameId);}};});
 await page.evaluate(()=>window.__advance(130));assert(await page.locator('.field-observer').isVisible());
 assert.equal(await page.locator('.observer-languages').count(),0);assert.equal(await page.locator('.field-observer p').getAttribute('lang'),'zh-TW');
 await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().player.selectedLane),3);
 await page.evaluate(()=>window.__advance(1000));assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().squad.count),0);
 assert(await page.getByRole('button',{name:'Retry',exact:true}).isVisible());await page.screenshot({path:`${out}/${denied?'denied':'enabled'}-game-over.png`});
 await page.getByRole('button',{name:'Retry',exact:true}).tap();await page.evaluate(()=>window.__advance(1));
 const state=await page.evaluate(()=>window.__testApp.simulation.getState());assert.equal(state.squad.count,3);assert.equal(state.elapsedSeconds,0);assert.equal(state.destroyer.nextShotIndex,0);assert.equal(state.artillery.shells.length,0);
 await page.evaluate(()=>window.__advance(120));assert(await page.locator('.field-observer').isVisible());await page.screenshot({path:`${out}/${denied?'denied':'enabled'}-retry.png`});
 assert.deepEqual(errors,[]);results.push({denied,errors,retry:state.destroyer});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));}finally{await browser.close();}

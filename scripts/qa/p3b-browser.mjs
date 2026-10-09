import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={runs:[],errors:[]};
try{for(const width of [390,350,1100]){
 const page=await browser.newPage({viewport:{width,height:width<500?844:900},deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).click();
 await page.waitForFunction(()=>window.__testApp.startup==='started');await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'naval');
 if(width===350)await page.locator('.beachhead-defense').evaluate(e=>e.style.setProperty('--hud-inset-bottom','34px'));
 await page.evaluate(()=>{window.__clock=performance.now();window.__events=[];const a=window.__testApp,present=a.renderer.presentArtillery.bind(a.renderer);
  a.renderer.presentArtillery=(e,ms)=>{window.__events.push(...e);return present(e,ms)};
  window.__advance=n=>{for(let i=0;i<n;i++){
   const s=a.simulation.getState(),lane=s.player.selectedLane,targets=new Set(s.artillery.shells.map(s=>s.targetLane));
   if(targets.has(lane)){const d=[-1,1].sort((a,b)=>Math.abs(lane+a-2)-Math.abs(lane+b-2)).find(d=>lane+d>=0&&lane+d<5&&!targets.has(lane+d));if(d)a.simulation.stepLane(d);}
   window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);
  }};});
 const advance=n=>page.evaluate(n=>window.__advance(n),n),shot=name=>page.screenshot({path:`${out}/${width}-${name}.png`});
 await advance(1);await shot('entry-start');await advance(60);await shot('entry');await advance(150);await shot('station');
 await advance(318);await shot('first-launch');await advance(60);await shot('flight');
 const partial=await page.evaluate(()=>window.__testApp.simulation.getState());
 await page.getByRole('button',{name:'Pause game',exact:true}).click();await advance(60);
 assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),partial);await shot('paused');
 await page.getByRole('button',{name:'Resume game',exact:true}).click();await page.evaluate(s=>window.__testApp.simulation.restoreState(s),partial);
 await advance(470);await shot('overlap');await advance(395);await shot('exit');await advance(200);await shot('complete');
 const state=await page.evaluate(()=>window.__testApp.simulation.getState());assert.equal(state.destroyer.status,'complete');assert.equal(state.squad.count,3);assert.equal(state.artillery.shells.length,0);
 const events=await page.evaluate(()=>window.__events);assert.equal(events.filter(e=>e.kind==='artilleryLaunch').length,5);
 await page.locator('.tuning-panel summary').click();
 assert(await page.locator('[data-role="naval"]').isVisible());await shot('dev-menu');
 results.runs.push({width,events,stats:await page.evaluate(()=>window.__testApp.renderer.getDebugStats())});await page.close();console.log('NAVAL checked',width);
}assert.deepEqual(results.errors,[]);}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

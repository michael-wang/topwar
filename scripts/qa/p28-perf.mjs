// Identical seeded GRENADE scene and inputs for before/after presentation costs.
import {mkdirSync,writeFileSync} from 'node:fs';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p28/perf';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [390,350]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'grenade');
 const result=await page.evaluate(()=>{
  const a=window.__testApp,initial=a.simulation.getState(),costs=[],resources=[],peaks={drawCalls:0,triangles:0};let clock=0;
  initial.weapons.rifleCooldownRemainingSeconds=1000;initial.weapons.rifleMemberCooldowns=[1000];
  const advance=()=>{clock+=1000/60;const t=performance.now();a.renderFrame(clock);cancelAnimationFrame(a.frameId);return performance.now()-t;};
  for(let cycle=0;cycle<12;cycle++){
   a.retry();a.simulation.restoreState(initial);advance();advance();a.grenadeRequested=true;
   for(let tick=0;tick<150;tick++){const cost=advance(),stats=a.renderer.getDebugStats();if(cycle>=2)costs.push(cost);peaks.drawCalls=Math.max(peaks.drawCalls,stats.drawCalls);peaks.triangles=Math.max(peaks.triangles,stats.triangles);}
   const stats=a.renderer.getDebugStats();resources.push({geometries:stats.geometries,textures:stats.textures,grenade:stats.grenade,enemies:stats.enemies});
  }
  costs.sort((a,b)=>a-b);
  return{seed:initial.seed,enemies:initial.enemies.length,samples:costs.length,meanCpuMs:costs.reduce((a,b)=>a+b,0)/costs.length,p95CpuMs:costs[Math.floor(costs.length*.95)],peaks,resources,final:a.simulation.getState()};
 });results.push({width,...result});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results.map(({width,meanCpuMs,p95CpuMs,peaks,resources})=>({width,meanCpuMs,p95CpuMs,peaks,first:resources[2],last:resources.at(-1)})));}finally{await browser.close();}

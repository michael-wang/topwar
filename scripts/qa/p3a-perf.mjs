// Same seeded three-MG scene; no automatic fixture schedule during this pool stress probe.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3a/artillery-perf';mkdirSync(out,{recursive:true});
const framesOnly=process.argv.includes('--frames-only');
const previousResults=framesOnly?JSON.parse(readFileSync(`${out}/results.json`,'utf8')):[];
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [390,350])for(const count of [0,2,8]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));await selectDevFixture(page,'shell');
 const result=await page.evaluate(({count,framesOnly})=>{
  const a=window.__testApp,initial=a.simulation.getState(),costs=[],resources=[],peaks={drawCalls:0,triangles:0,shells:0,impacts:0};let clock=0;
  initial.player={x:2.8,z:0,selectedLane:4};delete initial.artillery;window.__perfInitial=initial;
  const advance=()=>{clock+=1000/60;const t=performance.now();a.renderFrame(clock);cancelAnimationFrame(a.frameId);return performance.now()-t;};
  for(let cycle=0;cycle<(framesOnly?0:12);cycle++){
   a.devReviewFixture='shell';a.retry();a.devReviewFixture=null;a.simulation.restoreState(initial);advance();advance();
   for(let i=0;i<count;i++)a.simulation.launchArtillery({source:{id:'qa-muzzle',type:'qa',position:{x:-3,y:1.2,z:52}},targetLane:i%2});
   for(let tick=0;tick<210;tick++){const cost=advance(),s=a.renderer.getDebugStats();if(cycle>=2)costs.push(cost);
    peaks.drawCalls=Math.max(peaks.drawCalls,s.drawCalls);peaks.triangles=Math.max(peaks.triangles,s.triangles);
    peaks.shells=Math.max(peaks.shells,s.artillery.shells);peaks.impacts=Math.max(peaks.impacts,s.artillery.impacts);}
   const s=a.renderer.getDebugStats();resources.push({geometries:s.geometries,textures:s.textures,artillery:s.artillery});
  }
  costs.sort((a,b)=>a-b);return{count,samples:costs.length,meanCpuMs:costs.reduce((a,b)=>a+b,0)/costs.length,p95CpuMs:costs[Math.floor(costs.length*.95)],peaks,resources};
 },{count,framesOnly});
 result.frameIntervals=await page.evaluate(count=>new Promise(resolve=>{
  const a=window.__testApp;a.devReviewFixture='shell';a.retry();a.devReviewFixture=null;a.simulation.restoreState(window.__perfInitial);
  a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();
  for(let i=0;i<count;i++)a.simulation.launchArtillery({source:{id:'qa-muzzle',type:'qa',position:{x:-3,y:1.2,z:52}},targetLane:i%2});
  // Drain the synchronous submission benchmark before measuring actual RAF cadence.
  a.renderer.renderer.getContext().finish();
  const intervals=[];let previous,warmup=30;
  const frame=time=>{if(warmup>0)warmup--;else if(previous!==undefined)intervals.push(time-previous);previous=time;
   a.renderFrame(time);cancelAnimationFrame(a.frameId);
   if(intervals.length<180)requestAnimationFrame(frame);else{
    intervals.sort((a,b)=>a-b);resolve({samples:intervals.length,meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95Ms:intervals[Math.floor(intervals.length*.95)]});
   }
  };requestAnimationFrame(frame);
 }),count);
 results.push(framesOnly?{...previousResults.find(r=>r.width===width&&r.count===count),frameIntervals:result.frameIntervals}:{width,...result});const measured=results.at(-1);console.log(width,count,measured.meanCpuMs,measured.p95CpuMs,measured.peaks,measured.frameIntervals);await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));}finally{await browser.close();}

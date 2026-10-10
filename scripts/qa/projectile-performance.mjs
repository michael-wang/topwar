import { mkdirSync,writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { installProjectileBaseline } from './projectile-baseline.mjs';
import { installReviewBaseline } from './projectile-review-baseline.mjs';
const phase=process.argv[2]??'after',review=process.env.TOPWAR_TRACER,out=process.env.TOPWAR_PROJECTILE_OUT??`artifacts/p3b32/${phase}`;mkdirSync(out,{recursive:true});
const levels=(process.argv[3]??'8').split(',').map(Number),suffix=levels.length===1&&levels[0]===8?'':`-${levels.join('-')}`;
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of (process.env.TOPWAR_PERFORMANCE_WIDTHS??'350,390').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 if(review==='baseline')await installReviewBaseline(page);
 else if(phase==='before')await installProjectileBaseline(page);
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();',`window.__testApp=app;window.__firstDraws=[];
  for(const batch of [app.renderer.projectileRenderer.body,app.renderer.projectileRenderer.glow]) {
   let first=true,start=0,programs=0;
   batch.onBeforeRender=renderer=>{if(first){start=performance.now();programs=renderer.info.programs.length;}};
   batch.onAfterRender=renderer=>{if(first){window.__firstDraws.push({name:batch.name,ms:performance.now()-start,programs:renderer.info.programs.length-programs});first=false;}};
  }app.start();`)});});
 await page.addInitScript(()=>{const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>a instanceof Uint32Array&&a.length===1?(a[0]=17,a):native(a);});
 await page.goto('http://127.0.0.1:5173/?perf=1');await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.addStyleTag({content:'.perf-hud{display:none}'});
 if(review&&review!=='baseline'){
  await page.locator('.tuning-panel > summary').click();
  await page.locator(`[data-tracer="${review}"]`).click();
 }
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.evaluate(()=>{const a=window.__testApp,p=a.renderer.projectileRenderer,native=p.update.bind(p);window.__measure=false;
  p.update=(...args)=>{const at=performance.now();native(...args);if(window.__measure)window.__cpu.push(performance.now()-at);};
  const sample=stamp=>{if(window.__measure)window.__stamps.push(stamp);window.__qaFrame=requestAnimationFrame(sample);};window.__qaFrame=requestAnimationFrame(sample);
 });
 for(const level of levels)for(let repeat=0;repeat<(level===8?3:1);repeat++){
  await selectDevFixture(page,({6:'machineGun',7:'mg7',8:'mg8'})[level]);await page.locator('.tuning-panel').evaluate(p=>p.open=false);
  // Real RAF warm-up; never enqueue dozens of synthetic render frames before timing GPU work.
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{const a=window.__testApp;window.__cpu=[];window.__stamps=[];window.__measure=true;a.perf.reset();const s=a.simulation.getState();window.__start={seconds:s.elapsedSeconds,id:s.weapons.nextProjectileId,programs:a.renderer.renderer.info.programs.length};});
  await page.waitForTimeout(6000);
  const data=await page.evaluate(()=>{window.__measure=false;const a=window.__testApp,s=a.simulation.getState(),summary=values=>{const v=[...values].sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1),count:v.length,over50:v.filter(n=>n>50).length,over100:v.filter(n=>n>100).length,over200:v.filter(n=>n>200).length};};return{frame:summary(window.__stamps.slice(1).map((v,i)=>v-window.__stamps[i])),projectileJs:summary(window.__cpu),render:a.perf.render.average(),sim:s.elapsedSeconds-window.__start.seconds,shots:s.weapons.nextProjectileId-window.__start.id,newPrograms:a.renderer.renderer.info.programs.length-window.__start.programs,stats:a.renderer.getDebugStats()};});
  results.push({width,level,repeat,firstDraws:await page.evaluate(()=>window.__firstDraws),...data});writeFileSync(`${out}/performance${suffix}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({width,level,repeat,...data,stats:undefined}));
 }
 await page.close();
}}finally{await browser.close();}

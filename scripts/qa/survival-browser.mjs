import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const phase=process.argv[2]??'final',url=process.argv[3]??'http://127.0.0.1:5173/';
const fixed=process.argv.includes('--fixed');
const durationSeconds=fixed?45:90;
const out=`artifacts/p3b5/${phase}${fixed?'-fixed':''}-browser`;mkdirSync(out,{recursive:true});
const evidenceOnly=process.argv.includes('--evidence-only');
const saved=JSON.parse(readFileSync(`artifacts/p3b5/${phase}/metrics.json`)).runs.find(r=>r.seed===17&&r.scenario==='lv8'&&r.policy==='competent').entry;
const {chromium}=await import('file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const onlyWidth=process.argv.find(a=>a.startsWith('--width='))?.split('=')[1];
const results=onlyWidth&&!evidenceOnly?JSON.parse(readFileSync(out+'/results.json','utf8')).filter(r=>r.width!==Number(onlyWidth)):[];
try {
 for(const width of (onlyWidth?[Number(onlyWidth)]:[350,390])) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
  await page.goto(`${url}?perf=1`);await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.waitForTimeout(3000);await page.addStyleTag({content:'.perf-hud{display:none!important}'});
  await page.evaluate(async saved=>{
   const a=window.__testApp;cancelAnimationFrame(a.frameId);a.retry();cancelAnimationFrame(a.frameId);
   a.simulation.restoreState(saved);a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;a.perf.reset();a.progressionObserver.observe(8);
   const {grenadeTarget,enemiesInBlast}=await import('/src/simulation/grenade.ts');
   let next=0,lastTick=0;window.__pilot=()=>{
    if(window.__fixed)return;
    const s=a.simulation.getFrameState();if(s.tick<lastTick)next=0;lastTick=s.tick;
    if(s.tick>=next){next=s.tick+12;const nearest=s.enemies.reduce((a,e)=>!a||e.z<a.z?e:a,undefined),giant=s.enemies.find(e=>e.archetype==='giant');
     const preferred=s.grenade.supply?.lane??(giant&&(!nearest||nearest.z>10)?giant:nearest)?.lane??s.player.selectedLane;
     if(preferred!==s.player.selectedLane)a.simulation.stepLane(preferred<s.player.selectedLane?-1:1);
    }
    const g=s.catharsis.balance.grenade,target=s.grenade.inventory&&!s.grenade.flight?grenadeTarget(s,g):undefined;
    const victims=target?enemiesInBlast(s.enemies,target.x,target.z,g.blastRadius):[];
    if(target&&(victims.length>=6&&target.z<=14||target.z<=10&&victims.reduce((n,e)=>n+e.hp,0)>=12))a.requestGrenade();
   };
  },saved);
  await page.evaluate(fixed=>window.__fixed=fixed,fixed);
  const requestStart=requests.length;
  if(!evidenceOnly){
   const sample=await page.evaluate(async durationSeconds=>{
    const a=window.__testApp,rows=[],resources=[],startAge=a.simulation.getFrameState().elapsedSeconds;let start,previous,resourceAt=0;
    await new Promise(resolve=>requestAnimationFrame(function frame(ts){
     start??=ts;window.__pilot();const cpu=performance.now();a.renderFrame(ts);cancelAnimationFrame(a.frameId);
     const s=a.simulation.getFrameState();rows.push({ms:previous==null?0:ts-previous,cpuMs:performance.now()-cpu,age:s.elapsedSeconds-startAge});previous=ts;
     if(s.elapsedSeconds-startAge>=resourceAt){resources.push({age:s.elapsedSeconds-startAge,stats:a.renderer.getDebugStats()});resourceAt+=6;}
     if(ts-start<durationSeconds*1000&&s.squad.count)requestAnimationFrame(frame);else resolve();
    }));
    const samples=Array.from({length:Math.ceil(durationSeconds/30)},(_,index)=>{
     const r=rows.slice(1).filter(r=>r.age>=index*30&&r.age<(index+1)*30),sorted=r.map(r=>r.ms).sort((a,b)=>a-b);
     return {frames:r.length,mean:sorted.reduce((a,b)=>a+b,0)/Math.max(1,sorted.length),p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),
      over100:r.filter(r=>r.ms>100).length,over200:r.filter(r=>r.ms>200).length};
    });
    return {samples,rows,resources,highWater:{...a.perf.highWater},stepP95:a.perf.stepCpu.p95(),renderP95:a.perf.render.p95(),
     elapsed:a.simulation.getFrameState().elapsedSeconds-startAge,soldiers:a.simulation.getFrameState().squad.count};
   },durationSeconds);
   sample.requests=requests.slice(requestStart);assert.equal(sample.soldiers,3);assert(sample.elapsed>=durationSeconds-5,'Sustained simulation advances normally');
   results.push({phase,width,...sample,errors});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({phase,width,...sample,rows:undefined,resources:undefined}));
  }
  if(phase==='final'&&!fixed) {
   // Human menu and review behavior are checked separately from timing samples.
   await page.locator('.tuning-panel > summary').click();
   assert.deepEqual(await page.locator('.dev-review-controls button').allTextContents(),['LATE','CRATE3','CRATE8','NAVAL']);
   await page.locator('.dev-review-controls [data-role="late"]').click();
   await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);const s=a.simulation.getState();if(s.progression.level!==8||s.squad.count!==3||s.enemies.length!==42)throw Error('LATE must be immediate mixed Lv8');});
   const stop=await startGameRecording(page,width);
   await page.evaluate(async()=>{const a=window.__testApp;let start;await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;window.__pilot();a.renderFrame(ts);cancelAnimationFrame(a.frameId);if(ts-start<30000)requestAnimationFrame(frame);else resolve();}));});
   const recording=await stop();writeFileSync(`${out}/${width}-survival.webm`,recording);
   await inspectRecordingFrames(browser,recording,width,`${out}/${width}-survival`,[6.5,24.5]);
   // Freeze, resume, snapshot continuation and Retry use the real app lifecycle.
   await page.evaluate(()=>window.__testApp.togglePaused());const frozen=await page.evaluate(()=>JSON.stringify(window.__testApp.simulation.getState()));
   await page.evaluate(async()=>{const a=window.__testApp;let start;await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;a.renderFrame(ts);cancelAnimationFrame(a.frameId);if(ts-start<200)requestAnimationFrame(frame);else resolve();}));});assert.equal(await page.evaluate(()=>JSON.stringify(window.__testApp.simulation.getState())),frozen);
   const replay=await page.evaluate(()=>{const a=window.__testApp;a.togglePaused();cancelAnimationFrame(a.frameId);const saved=a.simulation.getState(),c=a.config;
    const tuning={...c.player,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
    const advance=()=>{for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},tuning);return JSON.stringify(a.simulation.getState());};
    const expected=advance();a.simulation.restoreState(JSON.parse(JSON.stringify(saved)));const actual=advance();a.retry();cancelAnimationFrame(a.frameId);if(a.simulation.getState().progression.level!==8||a.simulation.getState().enemies.length!==42)throw Error('LATE Retry changed');return {expected:JSON.parse(expected),actual:JSON.parse(actual)};});
   assert.deepEqual(replay.actual,replay.expected,'Survival snapshot continuation diverged');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}

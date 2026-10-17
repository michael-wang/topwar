import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { startGameRecording, inspectRecordingFrames } from './browser-recording.mjs';
const out = process.argv[2] ?? 'artifacts/p3b6b2/browser';mkdirSync(out,{recursive:true});
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const results=[],checks=[];
const uiOnly=process.argv.includes('--ui-only');
const profileOnly=process.argv.find(a=>a.startsWith('--profile='))?.slice(10);
const measureOnly=process.argv.includes('--measure-only');
const recordOnly=process.argv.includes('--record-only');
const trace=process.argv.includes('--trace');
const duration=Number(process.argv.find(a=>a.startsWith('--seconds='))?.slice(10)??90);
try { for (const width of [350,390]) for(const selectedProfile of profileOnly?[profileOnly]:uiOnly?['baseline']:['experimental','staged','ahead']) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),errors=[],requests=[];
  if(trace)await page.addInitScript(()=>{
    window.__glCalls=[];
    for(const name of ['compileShader','linkProgram','getProgramParameter','getProgramInfoLog','getShaderInfoLog','getActiveUniform','getUniformLocation','texImage2D','bufferData']){
      const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){
        const at=performance.now(),result=original.apply(this,args),ms=performance.now()-at;
        if(ms>1||name==='compileShader'||name==='linkProgram')window.__glCalls.push({name,at,ms});return result;
      };
    }
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
  await page.goto(`${process.env.TOPWAR_QA_URL??'http://127.0.0.1:5175/'}?perf=1`);
  await page.getByRole('button',{name:'開始遊戲'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  if(width===350)await page.locator('.beachhead-defense').evaluate(e=>e.style.setProperty('--hud-inset-bottom','34px'));
  const open=async()=>{if(!await page.locator('.tuning-panel').evaluate(e=>e.open))await page.locator('.tuning-panel > summary').tap();};
  await open();assert.deepEqual(await page.locator('.dev-review-controls button[data-role]').allTextContents(),['🚢 驅逐艦進場','🚨 BOSS 進場','🏆 勝利結算']);
  const bounds=await page.locator('.dev-review-controls button[data-role]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,x:r.x,width:r.width,height:r.height,right:r.right};}));
  for(const b of bounds)assert(b.x>=0&&b.right<=width&&b.width>=44&&b.height>=48,JSON.stringify(b));
  await page.screenshot({path:`${out}/${width}-dev-menu.png`});
  for(const mode of measureOnly||recordOnly?[]:['baseline','experimental','staged','ahead']) for(const level of [7,8,9,10]) {
    await selectDevFixture(page,`survival${level}-${mode}`);
    assert.equal(await page.locator('.tuning-panel').evaluate(e=>e.open),false);
    assert.equal(await page.evaluate(()=>window.__testApp.devReviewFixture),`survival${level}-${mode}`);
    const row=await page.evaluate(({mode,level})=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);const s=a.simulation.getState(),c=a.config;
      if(s.progression.level!==level||s.squad.count!==(level<9?1:level-7))throw Error('Wrong Survival loadout');
      const late=mode==='staged'||mode==='ahead';
      const h=level===7?4:mode==='baseline'?6:late&&level>=9?level===9?15:19:level===10?15:11;
      if(s.enemies.filter(e=>e.archetype==='heavy').length!==h||s.seed!==17)throw Error('Wrong deterministic group');
      const tuning={...c.player,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,
        normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
      const advance=()=>{for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},tuning);return JSON.stringify(a.simulation.getState());};
      const expected=advance();a.simulation.restoreState(JSON.parse(JSON.stringify(s)));const actual=advance();
      if(actual!==expected)throw Error('Snapshot continuation changed');
      a.togglePaused();const frozen=JSON.stringify(a.simulation.getState());a.renderFrame(performance.now());cancelAnimationFrame(a.frameId);
      if(JSON.stringify(a.simulation.getState())!==frozen)throw Error('Pause advanced Simulation');a.togglePaused();cancelAnimationFrame(a.frameId);
      a.retry();cancelAnimationFrame(a.frameId);if(JSON.stringify(a.simulation.getState())!==JSON.stringify(s))throw Error('Retry lost selected Survival preset');
      return {mode,level,count:s.squad.count,heavy:h,interval:s.defenseWaves.nextAtSeconds,snapshot:true,pause:true,retry:true};
    },{mode,level});checks.push({width,...row});
  }
  if(uiOnly){assert.deepEqual(errors,[]);await page.close();console.log(`Survival touch presets passed ${width}`);continue;}
  // Same real adjacent-lane pilot in both profiles; XP growth remains enabled.
  await page.evaluate(async()=>{
    const a=window.__testApp,{grenadeTarget,enemiesInBlast}=await import('/src/simulation/grenade.ts');
    let next=0,last=0;window.__pilot=()=>{
      const s=a.simulation.getFrameState();if(s.tick<last)next=0;last=s.tick;
      if(s.tick>=next){next=s.tick+12;const nearest=s.enemies.reduce((n,e)=>!n||e.z<n.z?e:n,undefined),giant=s.enemies.find(e=>e.archetype==='giant');
        const lane=s.grenade.supply?.lane??(giant&&(!nearest||nearest.z>10)?giant:nearest)?.lane??s.player.selectedLane;
        if(lane!==s.player.selectedLane)a.simulation.stepLane(lane<s.player.selectedLane?-1:1);}
      const g=s.catharsis.balance.grenade,target=s.grenade.inventory&&!s.grenade.flight?grenadeTarget(s,g):undefined,
        victims=target?enemiesInBlast(s.enemies,target.x,target.z,g.blastRadius):[];
      if(target&&(victims.length>=6&&target.z<=14||target.z<=10&&victims.reduce((n,e)=>n+e.hp,0)>=12))a.requestGrenade();
    };
  });
  await page.addStyleTag({content:'.perf-hud{display:none!important}'});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const mode=selectedProfile;
  for(const temperature of recordOnly?['recording']:process.argv.includes('--fresh-only')?['fresh']:['fresh','warm']) {
    await selectDevFixture(page,`survival8-${mode}`);
    await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;a.perf.reset();if(window.__glCalls)window.__glCalls=[];});
    const requestStart=requests.length;
    const traceDone=trace?new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve)):null;
    if(trace){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
      await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});}
    if(!recordOnly){
    const sample=await page.evaluate(async(duration)=>{
      const a=window.__testApp,rows=[],resources=[];let start,prev,due=0;
      const longTasks=[];const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration}))));
      observer.observe({type:'longtask',buffered:false});
      await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;window.__pilot();const cpu=performance.now();
        a.renderFrame(ts);cancelAnimationFrame(a.frameId);const s=a.simulation.getFrameState();
        rows.push({ms:prev==null?0:ts-prev,cpuMs:performance.now()-cpu,age:s.elapsedSeconds,level:s.progression.level,
          enemies:s.enemies.length,heavies:s.enemies.filter(e=>e.archetype==='heavy').length,projectiles:s.projectiles.length});prev=ts;
        if(s.elapsedSeconds>=due){resources.push({age:s.elapsedSeconds,level:s.progression.level,stats:a.renderer.getDebugStats()});due+=6;}
        if(ts-start<duration*1000&&s.squad.count)requestAnimationFrame(frame);else resolve();
      }));
      const summarize=r=>{const sorted=r.map(r=>r.ms).sort((a,b)=>a-b);return{frames:r.length,mean:sorted.reduce((n,v)=>n+v,0)/sorted.length,
        p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),over100:r.filter(r=>r.ms>100).length,over200:r.filter(r=>r.ms>200).length};};
      observer.disconnect();
      return{overall:summarize(rows.slice(1)),windows:[0,30,60].map(t=>({start:t,...summarize(rows.slice(1).filter(r=>r.age>=t&&r.age<t+30))})),
        rows,resources,longTasks,glCalls:window.__glCalls??[],highWater:{...a.perf.highWater},stepP95:a.perf.stepCpu.p95(),renderP95:a.perf.render.p95(),final:a.simulation.getState()};
    },duration);
    const network=requests.slice(requestStart).filter(u=>/\.(glb|webp|mp3|png|json)(\?|$)/.test(u));assert.deepEqual(network,[]);
    results.push({width,mode,temperature,...sample,network,errors});writeFileSync(`${out}/results.json`,JSON.stringify({results,checks,bounds},null,2));
    console.log(JSON.stringify({width,mode,temperature,overall:sample.overall,highWater:sample.highWater,resources:sample.resources.at(-1),soldiers:sample.final.squad.count}));
    await page.screenshot({path:`${out}/${width}-${mode}-${temperature}.png`});
    }
    if(trace){const profile=await cdp.send('Profiler.stop');writeFileSync(`${out}/${width}-${mode}-${temperature}-cpu.json`,JSON.stringify(profile));
      await cdp.send('Tracing.end');const{stream}=await traceDone;let content='';
      while(true){const row=await cdp.send('IO.read',{handle:stream});content+=row.data;if(row.eof)break;}
      await cdp.send('IO.close',{handle:stream});writeFileSync(`${out}/${width}-${mode}-${temperature}-trace.json`,content);}
    if(measureOnly)continue;
    // Record separately, so capture overhead is excluded from timings.
    await selectDevFixture(page,`survival8-${mode}`);
    await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;});
    const stop=await startGameRecording(page,width);
    await page.evaluate(async()=>{const a=window.__testApp;let start;await new Promise(resolve=>requestAnimationFrame(function frame(ts){start??=ts;window.__pilot();a.renderFrame(ts);cancelAnimationFrame(a.frameId);if(ts-start<45000)requestAnimationFrame(frame);else resolve();}));});
    const recording=await stop();writeFileSync(`${out}/${width}-${mode}.webm`,recording);
    await inspectRecordingFrames(browser,recording,width,`${out}/${width}-${mode}`,[3,25,40]);
    await page.screenshot({path:`${out}/${width}-${mode}.png`});
    const evidence=await page.evaluate(()=>{const s=window.__testApp.simulation.getState();return{level:s.progression.level,soldiers:s.squad.count,simulationSeconds:s.elapsedSeconds,seed:s.seed};});
    if(recordOnly)results.push({width,mode,recordingSeconds:45,...evidence,errors});
    console.log(JSON.stringify({recording:`${out}/${width}-${mode}.webm`,...evidence}));
  }
  assert.deepEqual(errors,[]);await page.close();
} } finally {writeFileSync(`${out}/results.json`,JSON.stringify({results,checks},null,2));await browser.close();}

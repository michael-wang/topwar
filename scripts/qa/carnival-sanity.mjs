import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium }=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/stage1-p2/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const result={portraits:{},errors:[]},assert=(ok,msg)=>{if(!ok)throw Error(msg);};
try {
  for(const width of [390,350]) {
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
    await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/?perf=1');
    await page.getByRole('button',{name:'Start game with audio'}).tap();
    await page.waitForFunction(()=>window.__testApp.startup==='started');
    await page.addStyleTag({content:'.perf-hud { display:none !important; }'});
    await page.evaluate(async()=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
      const {carnivalPilotLane}=await import('/scripts/qa/carnivalPilot.ts');
      window.__nextDecision=0;
      window.__pilot=()=>{const s=a.simulation.getFrameState();if(s.tick<window.__nextDecision)return;
        window.__nextDecision=s.tick+12;let lane=carnivalPilotLane(s);
        const danger=new Set(s.artillery?.shells.map(shell=>shell.targetLane));
        if(danger.has(lane)||danger.has(s.player.selectedLane))lane=[0,1,2,3,4].filter(l=>!danger.has(l)).sort((a,b)=>Math.abs(a-s.player.selectedLane)-Math.abs(b-s.player.selectedLane))[0]??lane;if(lane!==s.player.selectedLane){
          const key=lane<s.player.selectedLane?'a':'d',code=lane<s.player.selectedLane?'KeyA':'KeyD';
          window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}));}};
      window.__advance=(ms,pilot=true)=>{for(let t=0;t<ms;t+=100){if(pilot)window.__pilot();
        window.__clock+=Math.min(100,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
    });
    const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
    const advance=(ms,pilot=true)=>page.evaluate(({ms,pilot})=>window.__advance(ms,pilot),{ms,pilot});
    await page.locator('.tuning-panel > summary').tap();
    const menu=await page.locator('.dev-review-controls button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,x:r.x,right:r.right,bottom:r.bottom,height:r.height};}));
    assert(menu.map(b=>b.label).join(',')==='LATE,CRATE3,CRATE8,NAVAL','Four retained menu entries');
    assert(menu.every(b=>b.x>=0&&b.right<=width&&b.bottom<=844&&b.height>=44),'Menu fits portrait');
    await page.screenshot({path:`${out}/${width}-menu.png`});
    await selectDevFixture(page,'carnival');const initial=await state();
    assert(initial.progression.level===6 && initial.squad.count===1 && initial.machineGunReleaseAtSeconds===null,'Before release');
    await advance(120);assert((await state()).enemies.length===60,'Exact opening crowd');
    const captures=[];
    const capture=async name=>{
      const s=await state();const visual=await page.evaluate(()=>{
        const a=window.__testApp,members=a.renderer.squadRenderer.members.filter(m=>m.group.visible);
        const boxes=['.grenade-button','.battle-info','.xp-hud','.movement-left','.movement-right'].map(selector=>{
          const r=document.querySelector(selector).getBoundingClientRect();return{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
        return{members:members.length,models:members.map(m=>m.rifle.name),fired:members.map(m=>m.lastFiredAtMs),
          pips:document.querySelectorAll('.battle-squad-pips .is-filled').length,boxes,stats:a.renderer.getDebugStats()};
      });
      assert(visual.members===s.squad.count && visual.models.every(m=>m==='toy-machine-gun') && visual.fired.every(Number.isFinite),'MG crowd presentation');
      if(s.squad.count>1)assert(visual.pips===s.progression.level-5,'Squad HUD');
      for(const b of visual.boxes)assert(b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=844,'HUD bounds');
      for(const [i,a]of visual.boxes.entries())for(const b of visual.boxes.slice(i+1))assert(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'HUD overlap');
      await page.screenshot({path:`${out}/${width}-${name}.png`});captures.push({name,elapsed:s.carnival.elapsedSeconds,level:s.progression.level,enemies:s.enemies.length,visual});
    };
    await capture('release');await advance(6000);await capture('crowd');
    await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(500,false);
    assert(JSON.stringify(await state())===JSON.stringify(frozen),'Phase Pause');
    await page.getByRole('button',{name:'Resume game',exact:true}).tap();await advance(2000);
    const replay=await page.evaluate(async()=>{
      const a=window.__testApp,{pilotTuning}=await import('/scripts/qa/p15Pilot.ts'),saved=a.simulation.getState();
      // Validation reconstructs plain objects; key insertion order is not state.
      const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
        ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
      const run=()=>{for(let i=0;i<240;i++)a.simulation.step(1/60,{targetX:0},pilotTuning);return JSON.stringify(canonical(a.simulation.getState()));};
      const expected=run();a.simulation.restoreState(JSON.parse(JSON.stringify(saved)));const equal=run()===expected;
      a.simulation.restoreState(saved);a.fixedStepLoop.reset();return equal;
    });assert(replay,'Active phase snapshot replay');
    // Real requestAnimationFrame sample with actual GPU draws and normal clock.
    // Software WebGL on desktop is an observation, never phone certification.
    const measure=()=>page.evaluate(async()=>{
      const a=window.__testApp;a.perf.reset();a.previousFrameTimestampMs=null;
      window.__nextDecision=a.simulation.getFrameState().tick;
      const intervals=[];let first=null,previous=null;
      await new Promise(resolve=>{const frame=ts=>{first??=ts;if(previous!==null)intervals.push(ts-previous);previous=ts;
        window.__pilot();a.renderFrame(ts);cancelAnimationFrame(a.frameId);window.__clock=ts;
        if(ts-first<5000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
      const sorted=[...intervals].sort((a,b)=>a-b),p=a.perf;
      return{frames:intervals.length,frameMeanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,
        frameP95Ms:sorted[Math.ceil(sorted.length*.95)-1],simulationP95Ms:p.stepCpu.p95(),renderSubmissionP95Ms:p.render.p95(),
        highWater:{...p.highWater},stats:a.renderer.getDebugStats()};
    });const performanceSample=await measure();await capture('sustained');
    while((await state()).carnival.elapsedSeconds<18)await advance(500);
    await capture('lv7');while((await state()).carnival.status!=='complete')await advance(100);
    const end=await state();assert(end.carnival.elapsedSeconds===24 && end.destroyer.status==='active' && end.postCapSurvival.startedAtSeconds===null,'24-second Carnival completes during Destroyer');
    assert(end.progression.level>=7 && end.machineGunReleaseAtSeconds===frozen.machineGunReleaseAtSeconds,'Natural progression, single release');
    assert(Math.abs(end.destroyer.startedAtSeconds-end.machineGunReleaseAtSeconds)<1e-8,'Concurrent entrance');
    await capture('handoff');await advance(3500);
    const navalEnd=await state();assert(navalEnd.destroyer.status==='complete' && navalEnd.postCapSurvival.startedAtSeconds!==null && navalEnd.squad.count>0,'Destroyer completes before Survival');
    await advance(7000);const fallback=await state();
    // The three MGs can kill a resumed group before the seven-second sample.
    assert(fallback.enemyStream.nextEnemyId>=end.enemyStream.nextEnemyId+3,'Fallback ordinary groups resume');
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rifleCounts:[],rocketCount:0,rifleRemainder:0};
      s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);window.__advance(100,false);});
    await page.getByRole('button',{name:'Retry',exact:true}).tap();assert(JSON.stringify(await state())===JSON.stringify(initial),'Exact CARNIVAL Retry');
    await advance(200);assert((await state()).enemies.length===60,'Replay one release');
    await selectDevFixture(page,'machineGun');assert((await state()).enemies.length===65 && !(await state()).catharsis.balance.carnival.enabled,'Isolated MG unchanged');
    await selectDevFixture(page,'late');const baselinePerformance=await measure();
    result.portraits[width]={menu,captures,performanceSample,baselinePerformance,replay,pause:true,retry:true,endLevel:end.progression.level};
    console.log(JSON.stringify({width,performanceSample,baselinePerformance}));await page.close();
  }
  assert(!result.errors.length,result.errors.join('\n'));
} finally {writeFileSync(`${out}/results.json`,JSON.stringify(result,null,2));await browser.close();}

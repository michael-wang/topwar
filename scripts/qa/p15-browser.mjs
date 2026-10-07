import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p15';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],report={widths:{},cycles:[],livePerformance:[]};
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const assert=(ok,message)=>{if(!ok)throw Error(message);};
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});
  });
  await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173');
  await page.waitForSelector('.game-start-overlay');
  assert(await page.locator('.grenade-button').isHidden(),'Grenade hidden before Start');
  await page.getByRole('button',{name:'Start game with audio'}).click();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(()=>{
    const a=window.__testApp;cancelAnimationFrame(a.frameId);a.retry();window.__clock=0;
    window.__advance=milliseconds=>{
      const start=performance.now();let frames=0;
      for(let t=0;t<milliseconds;t+=20) {window.__clock+=Math.min(20,milliseconds-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);frames++;}
      return {cpuWallMs:performance.now()-start,frames};
    };
    a.renderFrame(0);cancelAnimationFrame(a.frameId);
    window.__fixture=kind=>{
      a.retry();const s=a.simulation.getState();s.elapsedSeconds=8;s.tick=480;s.progression={level:3,xp:0};
      s.enemyStream.nextRowIndex=10000;s.enemies=[];s.projectiles=[];
      s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns=[100];
      s.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:null,acquiredAtSeconds:null,inventory:0,supply:null,flight:null};
      if(kind==='held') {
        s.grenade={...s.grenade,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:1};
        s.enemies=Array.from({length:10},(_,i)=>({id:i+1,tier:1,archetype:'grunt',lane:2,x:(i%3-1)*.35,z:10+Math.floor(i/3)*.18,hp:1}));
        s.enemies.push({id:11,tier:1,archetype:'heavy',lane:3,x:1.4,z:10.3,hp:15},{id:12,tier:1,archetype:'giant',lane:1,x:-1.4,z:10.3,hp:172});
        s.giantEncounter={scheduledAtSeconds:0,spawned:true};
      }
      s.enemyStream.nextEnemyId=13;a.simulation.restoreState(s);a.progressionObserver.observe(3);window.__advance(40);
    };
  });
  const sample=()=>page.evaluate(()=>{const a=window.__testApp;return {state:a.simulation.getState(),stats:a.renderer.getDebugStats(),paused:a.paused};});
  await page.evaluate(()=>window.__fixture('supply'));report.supply=await sample();
  assert(report.supply.state.grenade.supply!==null,'Pending supply spawns');
  await page.screenshot({path:`${out}/supply-390.png`});
  await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.weapons.rifleCooldownRemainingSeconds=0;s.weapons.rifleMemberCooldowns=[0];a.simulation.restoreState(s);window.__advance(400);});
  report.acquired=await sample();assert(report.acquired.state.grenade.inventory===3,'One-hit supply acquisition');
  assert(await page.locator('.grenade-button').isVisible(),'Acquired button visible');
  assert(await page.locator('.grenade-button').isDisabled(),'No living defense enemies disables activation');
  await page.evaluate(()=>document.querySelector('.grenade-button').click());
  assert((await sample()).state.grenade.inventory===3,'No living defense enemies preserves charge');
  for(const width of [350,390]) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>{window.__fixture('held');const v=document.querySelector('#game-viewport');v.style.setProperty('--hud-inset-left','18px');v.style.setProperty('--hud-inset-bottom','24px');window.__testApp.renderer.resize();window.__advance(40);});
    const bounds=await page.locator('.grenade-button').boundingBox();
    assert(bounds.x>=18 && bounds.y+bounds.height<844-24 && bounds.width>=44 && bounds.height>=44,'Safe area and touch target');
    await page.screenshot({path:`${out}/ready-${width}.png`});
    await page.keyboard.press('p');await page.evaluate(()=>window.__advance(200));const paused=await sample();
    assert(paused.paused && await page.locator('.grenade-button').isDisabled(),'Pause disables button');
    await page.evaluate(()=>{document.querySelector('.grenade-button').click();window.__advance(800);});
    assert((await sample()).state.elapsedSeconds===paused.state.elapsedSeconds,'Pause freezes flight/supply clocks');
    await page.keyboard.press('p');await page.evaluate(()=>window.__advance(40));
    const lane=(await sample()).state.player.selectedLane;
    await page.locator('.grenade-button').tap();await page.evaluate(()=>window.__advance(200));
    const flight=await sample();assert(flight.state.grenade.flight && flight.state.grenade.inventory===0,'One tap creates flight');
    assert(flight.state.player.selectedLane===lane,'Button isolated from lane input');
    await page.screenshot({path:`${out}/flight-${width}.png`});
    // Stop one render just after authoritative 0.65s detonation.
    await page.evaluate(()=>window.__advance(460));const detonation=await sample();
    assert(detonation.state.enemies.length===2 && detonation.state.enemies[0].hp===6 && detonation.state.enemies[1].hp===163,'Blast preserves Heavy/Giant intent');
    assert(detonation.state.progression.xp===10,'Ten victims award ten XP');
    await page.evaluate(()=>window.__advance(80));
    await page.screenshot({path:`${out}/burst-${width}.png`});
    await page.evaluate(()=>window.__advance(3000));const settled=await sample();
    assert(settled.state.progression.xp===10 && !settled.stats.grenade.burst,'No duplicate XP; burst retires');
    report.widths[width]={bounds,flight,detonation,settled};
  }
  for(let cycle=0;cycle<5;cycle++) {
    await page.evaluate(()=>window.__fixture('held'));
    await page.locator('.grenade-button').tap();
    const timing=await page.evaluate(()=>window.__advance(3500));const s=await sample();
    report.cycles.push({cycle,...timing,geometries:s.stats.geometries,textures:s.stats.textures,grenade:s.stats.grenade,enemies:s.stats.enemies});
  }
  assert(report.cycles.every(s=>s.geometries===report.cycles[0].geometries && s.textures===report.cycles[0].textures),'Repeated burst GPU resources stable');
  for(const explode of [false,true]) {
    await page.evaluate(()=>{
      window.__fixture('held');const a=window.__testApp,s=a.simulation.getState();
      for(let i=0;i<188;i++)s.enemies.push({id:13+i,tier:1,archetype:'grunt',lane:i%5,x:(i%5-2)*1.4,z:25+Math.floor(i/5)*.35,hp:1});
      s.enemyStream.nextEnemyId=201;a.simulation.restoreState(s);window.__advance(40);
    });
    const performanceSample=await page.evaluate(async explode=>{
      const a=window.__testApp,frames=[],samples=[];let last=null;
      a.previousFrameTimestampMs=null;
      let started=null,warmStarted=null,warmFrames=0;
      await new Promise(resolve=>{
        const frame=now=>{warmStarted??=now;
          if(started===null && now-warmStarted>=2000 && warmFrames>=12){started=now;last=null;if(explode)document.querySelector('.grenade-button').click();}
          if(started!==null && last!==null)frames.push(now-last);last=now;
          const cpu=performance.now();a.renderFrame(now);cancelAnimationFrame(a.frameId);
          if(started!==null)samples.push(performance.now()-cpu);else warmFrames++;
          if(started===null || now-started<4000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);
      });
      const summarize=values=>{const ordered=[...values].sort((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p95:ordered[Math.ceil(ordered.length*.95)-1],max:ordered.at(-1)};};
      return {explode,frames:frames.length,frameMs:summarize(frames),appCpuMs:summarize(samples),stats:a.renderer.getDebugStats()};
    },explode);
    report.livePerformance.push(performanceSample);
  }
  await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);window.__advance(400);});
  assert(await page.locator('.grenade-button').isDisabled(),'Dead button disabled');
  await page.getByRole('button',{name:'Retry',exact:true}).click();await page.evaluate(()=>window.__advance(40));report.retry=await sample();
  assert(report.retry.state.progression.level===1 && report.retry.state.grenade.inventory===0 && report.retry.state.grenade.lv3EnteredAtSeconds===null,'Retry resets first supply');
  assert(await page.locator('.grenade-button').isHidden(),'Retry hides item UI');
  report.errors=errors;assert(!errors.length,errors.join('\n'));
  writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));console.log('P1.5 mobile checks passed');
} finally {await browser.close();}

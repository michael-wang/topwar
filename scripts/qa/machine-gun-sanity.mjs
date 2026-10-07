import { mkdirSync, writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p2a';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const result={portraits:{},cycles:[],performance:{},errors:[]};
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
try {
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{
    const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();',`window.__testApp=app;
      window.__cues=[];const play=app.audio.play.bind(app.audio);app.audio.play=(...args)=>{window.__cues.push({cue:args[0],at:performance.now()});return play(...args)};app.start();`)});
  });
  await page.goto((process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173')+'/?perf=1');
  await page.waitForSelector('.game-start-overlay');
  assert(await page.locator('.enemy-vfx-lab [data-role="machineGun"]').count()===1,'DEV MG control');
  await page.getByRole('button',{name:'Start game with audio'}).click();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.addStyleTag({content:'.perf-hud{display:none}'});
  await page.evaluate(()=>{
    const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
    window.__advance=ms=>{for(let t=0;t<ms;t+=20){window.__clock+=Math.min(20,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
  });
  const sample=()=>page.evaluate(()=>({state:window.__testApp.simulation.getState(),stats:window.__testApp.renderer.getDebugStats(),
    audio:window.__testApp.audio.getDebugStats(),weapon:document.querySelector('.xp-loadout')?.dataset.weaponFamily,
    damageFlash:document.querySelector('.damage-flash')?.className}));
  const reset=async()=>{
    await page.locator('.enemy-vfx-lab [data-role="machineGun"]').click();const s=await sample();
    assert(s.state.progression.level===6&&s.state.squad.count===1&&s.state.player.selectedLane===2,'Lv6 specialist');
    assert(s.state.enemies.filter(e=>e.archetype==='grunt').length===60&&s.state.enemies.filter(e=>e.archetype==='heavy').length===5,'60/5 crowd');
    assert(!s.state.boss&&!s.state.enemies.some(e=>e.archetype==='giant'),'No Giant or Boss');return s;
  };
  const initial=(await reset()).state;
  for(const width of [390,350]){
    await page.setViewportSize({width,height:844});assert(JSON.stringify((await reset()).state)===JSON.stringify(initial),'Deterministic reset');
    await page.evaluate(()=>{window.__testApp.renderer.resize();window.__advance(200);});
    assert((await sample()).weapon==='machineGun','MG HUD icon');
    await page.screenshot({path:`${out}/mg-firing-${width}.png`});
    await page.keyboard.press('p');const frozen=(await sample()).state;await page.evaluate(()=>window.__advance(1000));
    assert(JSON.stringify((await sample()).state)===JSON.stringify(frozen),'Pause freezes MG');await page.keyboard.press('p');
    await page.evaluate(()=>window.__advance(3000));const center=await sample();
    assert(center.state.enemies.filter(e=>e.lane===2).length===0,'Center Grunts and Heavy cleared');
    await page.keyboard.press('ArrowLeft');await page.evaluate(()=>window.__advance(2200));
    assert((await sample()).state.player.selectedLane===1,'Lane key preserved');
    await page.screenshot({path:`${out}/mg-after-${width}.png`});
    await page.evaluate(()=>window.__testApp.retry());assert(JSON.stringify((await sample()).state)===JSON.stringify(initial),'Retry restarts selected MG fixture');
    result.portraits[width]={centerKills:initial.enemies.length-center.state.enemies.length,centerHeavySurvived:center.state.enemies.some(e=>e.id===61),stats:center.stats};
  }
  // Browser render of a real natural-pilot Lv5->Lv6 boundary, including actual
  // casualty-state and ordinary burst-XP variants. No production balance edits.
  result.evolutions=await page.evaluate(async()=>{
    const a=window.__testApp,{runPilot,pilotTuning}=await import('/scripts/qa/p15Pilot.ts');
    const base=runPilot(17,false,true,false,5,true).finalState;
    const records=[];
    for(const count of [3,2,1]){
      a.vfxLabRole=null;a.retry();const s=structuredClone(base);s.progression.xp=219;
      s.squad={count,rocketCount:0,rifleCounts:[count],rifleRemainder:0};s.weapons.rifleMemberCooldowns=Array(count).fill(.1);
      s.enemies=[{id:1,tier:1,archetype:'grunt',lane:2,x:0,z:s.player.z+3,hp:1}];s.player.x=0;s.player.selectedLane=2;
      s.projectiles=[{id:s.weapons.nextProjectileId++,kind:'rifle',tier:1,lane:2,memberIndex:0,slopeX:0,x:0,z:s.player.z+2.5,
        speed:60,damage:3,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
      a.simulation.restoreState(s);a.previousDefenseValue=BigInt(count);a.previousWeaponFamily='rifle';a.progressionObserver.observe(5);
      window.__cues=[];window.__advance(100);const after=a.simulation.getState();
      if(after.progression.level!==6||after.squad.count!==1||window.__cues.some(e=>e.cue==='damage'||e.cue==='fatal'))throw Error('Evolution presentation regression');
      const snapshot=JSON.parse(JSON.stringify(after));window.__advance(400);const continued=a.simulation.getState();
      a.simulation.restoreState(snapshot);for(let i=0;i<24;i++)a.simulation.step(1/60,{targetX:0},pilotTuning);
      // Unit tests verify exact continuation; browser checks authoritative family/clock restore.
      records.push({before:count,after:after.squad.count,level:after.progression.level,weapon:document.querySelector('.xp-loadout')?.dataset.weaponFamily,
        restoredFamily:continued.projectiles.every(p=>p.kind==='machineGun'),damageCues:window.__cues.filter(e=>e.cue==='damage'||e.cue==='fatal').length});
    }
    a.vfxLabRole=null;a.retry();window.__advance(80);
    if(a.simulation.getState().progression.level!==1||a.simulation.getState().squad.count!==1)throw Error('Normal Retry');
    return records;
  });
  // Warm real-time rendering/audio. Use the same deterministic crowd for Lv5
  // and Lv6. Real RAF avoids artificial accumulation of native audio voices.
  for(const level of [5,6]){
    await reset();
    await page.evaluate(level=>{
      const a=window.__testApp;
      if(level===5){const s=a.simulation.getState();s.progression.level=5;s.machineGunReleaseAtSeconds=null;s.squad={count:3,rocketCount:0,rifleCounts:[3],rifleRemainder:0};
        s.weapons.rifleMemberCooldowns=[0,1/13.5,2/13.5];a.simulation.restoreState(s);a.previousWeaponFamily='rifle';a.previousDefenseValue=3n;}
      a.previousFrameTimestampMs=null;a.frameId=requestAnimationFrame(a.renderFrame);
    },level);
    await page.waitForTimeout(2200);
    await page.evaluate(()=>{window.__testApp.perf.reset();window.__cues=[];window.__samples=[];window.__timer=setInterval(()=>{
      const a=window.__testApp;window.__samples.push({seconds:a.simulation.getFrameState().elapsedSeconds,...a.renderer.getDebugStats(),...a.audio.getDebugStats()});},100);});
    await page.waitForTimeout(6000);
    result.performance[level]=await page.evaluate(()=>{
      const a=window.__testApp;clearInterval(window.__timer);cancelAnimationFrame(a.frameId);
      const p=a.perf;return{samples:window.__samples,frameAverage:p.frame.average(),frameP95:p.frame.p95(),frameCount:p.frame.count,
        simAverage:p.sim.average(),renderAverage:p.render.average(),audioAverage:p.audio.average(),highWater:p.highWater,cues:window.__cues,
        audioState:a.audio.context?.state};
    });
  }
  for(let i=0;i<5;i++){
    await reset();await page.evaluate(()=>window.__advance(3200));const s=await sample();
    result.cycles.push({geometries:s.stats.geometries,textures:s.stats.textures,projectilePool:s.stats.projectiles.pool});
  }
  assert(result.cycles.every(c=>JSON.stringify(c)===JSON.stringify(result.cycles[0])),'Bounded reset resources');
  assert(result.performance[6].audioState==='running','Native audio running');
  assert(result.performance[6].cues.some(c=>c.cue==='machineGun'),'Sustained MG cues');
  assert(Math.max(...result.performance[6].samples.map(s=>s.projectiles.pool))<=32,'Bounded MG tracer pool');
  assert(!result.errors.length,result.errors.join('\n'));
  writeFileSync(`${out}/browser.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({portraits:Object.keys(result.portraits),evolutions:result.evolutions,
    cycles:result.cycles,performance:Object.fromEntries(Object.entries(result.performance).map(([l,r])=>[l,{frameAverage:r.frameAverage,frameP95:r.frameP95,
      frames:r.frameCount,sim:r.simAverage,render:r.renderAverage,audio:r.audioAverage,maxSfx:Math.max(...r.samples.map(s=>s.sfxSources)),
      audioState:r.audioState,mgCues:r.cues.filter(c=>c.cue==='machineGun').length}]))}));
} finally {await browser.close();}

// Real DEV CURVE input, fixed-step gameplay and disposable renderer. No scripted XP/levels.
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p2c/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const result={portraits:{},resources:[],errors:[]},assert=(ok,msg)=>{if(!ok)throw Error(msg);};
page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
try{
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto((process.env.TOPWAR_QA_URL??'http://127.0.0.1:5175')+'/?perf=1');await page.waitForSelector('.game-start-overlay');
 await page.keyboard.press('4');assert(await page.evaluate(()=>window.__testApp.vfxLabRole===null),'Pre-start 4 ignored');
 await page.getByRole('button',{name:'Start game with audio'}).click();await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.addStyleTag({content:'.perf-hud{display:none}'});
 await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
  window.__advance=(ms,pilot=false)=>{for(let t=0;t<ms;t+=100){const s=a.simulation.getState();
    if(pilot){const nearest=[...s.enemies].sort((a,b)=>a.z-b.z||a.id-b.id)[0],giant=s.enemies.find(e=>e.archetype==='giant');
      const threat=giant&&(!nearest||nearest.z-s.player.z>10)?giant:nearest;
      if(threat&&s.tick%12===0)while(a.simulation.getFrameState().player.selectedLane!==threat.lane)
        a.simulation.stepLane(threat.lane>a.simulation.getFrameState().player.selectedLane?1:-1);}
    window.__clock+=Math.min(100,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};});
 const sample=()=>page.evaluate(()=>{const a=window.__testApp;return{state:a.simulation.getState(),role:a.vfxLabRole,stats:a.renderer.getDebugStats(),audio:a.audio.getDebugStats(),weapon:document.querySelector('.xp-loadout')?.dataset.weaponFamily};});
 const advance=(ms,pilot=false)=>page.evaluate(({ms,pilot})=>window.__advance(ms,pilot),{ms,pilot});
 let initial;
 for(const width of [390,350]){
  await page.setViewportSize({width,height:844});await page.locator('[data-role="curve"]').click();const start=await sample();initial??=start.state;
  assert(JSON.stringify(start.state)===JSON.stringify(initial),'Exact CURVE reset');
  assert(start.state.progression.level===4&&start.state.progression.xp===150&&start.state.squad.count===2,'Lv4 / 150 XP / two Rifles');
  assert(start.state.enemies.length===48&&start.state.enemies.filter(e=>e.archetype==='heavy').length===2,'Representative 46/2 crowd');
  await advance(100);await page.screenshot({path:`${out}/curve-lv4-${width}.png`});
  await page.keyboard.press('p');const frozen=(await sample()).state;await advance(500);assert(JSON.stringify((await sample()).state)===JSON.stringify(frozen),'Pause freezes CURVE');await page.keyboard.press('p');
  await advance(100);await page.keyboard.press('4');assert(JSON.stringify((await sample()).state)===JSON.stringify(initial),'Physical 4 reset');
  await page.evaluate(()=>window.__testApp.retry());assert(JSON.stringify((await sample()).state)===JSON.stringify(initial),'Retry CURVE reset');
  const records=[],captured=new Set();let evolvedAt=null,giantAt=null;
  for(let tick=0;tick<1000;tick++){
   await advance(100,true);const current=await sample(),s=current.state;
   const key=s.progression.level===4?'lv4':s.progression.level===5?(s.enemies.some(e=>e.archetype==='giant')?'giant':'lv5'):'lv6';
   if(!captured.has(key)){captured.add(key);records.push({key,seconds:s.elapsedSeconds,level:s.progression,xp:s.progression.xp,squad:s.squad.count,active:s.enemies.length,giant:s.giantEncounter,stats:current.stats});
     await page.screenshot({path:`${out}/curve-${key}-${width}.png`});}
   if(key==='giant')giantAt??=s.elapsedSeconds;
   if(giantAt!==null&&s.elapsedSeconds>=giantAt+2&&!captured.has('giant-visible')){captured.add('giant-visible');await page.screenshot({path:`${out}/curve-giant-visible-${width}.png`});}
   if(s.progression.level===6){if(evolvedAt===null)await page.evaluate(s=>{window.__releaseReview=s;},s);evolvedAt??=s.elapsedSeconds;
    for(const seconds of [2,5])if(s.elapsedSeconds>=evolvedAt+seconds&&!captured.has(`mg-plus${seconds}`)){captured.add(`mg-plus${seconds}`);await page.screenshot({path:`${out}/curve-mg-plus${seconds}-${width}.png`});}
    if(s.elapsedSeconds>=evolvedAt+10)break;}
   assert(s.squad.count>0,'CURVE pilot remains alive');
  }
  const end=await sample();assert(captured.has('giant')&&captured.has('lv6'),'Natural Giant and XP evolution');
  assert(end.weapon==='machineGun'&&end.state.machineGunReleaseAtSeconds!==null,'MG HUD and release');
  assert(end.state.giantEncounter.spawned,'One-shot encounter remains consumed');
  await page.screenshot({path:`${out}/curve-mg-plus10-${width}.png`});
  result.portraits[width]={records,end:{seconds:end.state.elapsedSeconds,active:end.state.enemies.length,stats:end.stats}};
 }
 // Snapshot both pending and admitted release states, then compare continuation byte-for-byte.
 result.snapshots=await page.evaluate(async()=>{const a=window.__testApp,{pilotTuning}=await import('/scripts/qa/p15Pilot.ts');const records=[];
  for(const role of ['curve','evolve']){a.vfxLabRole=role;a.retry();const before=a.simulation.getState();
   const run=()=>{for(let i=0;i<480;i++)a.simulation.step(1/60,{targetX:0},pilotTuning);return a.simulation.getState();};
   const first=run();a.simulation.restoreState(JSON.parse(JSON.stringify(before)));const second=run();
   if(JSON.stringify(first)!==JSON.stringify(second))throw Error('Snapshot continuation '+role);
   a.simulation.restoreState(JSON.parse(JSON.stringify(first)));const third=run();a.simulation.restoreState(JSON.parse(JSON.stringify(first)));const fourth=run();
   if(JSON.stringify(third)!==JSON.stringify(fourth))throw Error('Post-transition snapshot '+role);
   records.push({role,level:second.progression.level,release:second.machineGunReleaseAtSeconds});}return records;});
 for(let cycle=0;cycle<6;cycle++){
  await page.keyboard.press('5');await advance(1700);const released=await sample();
  assert(released.state.enemies.length>=60,'Visible release crowd');
  await advance(3000,true);const after=await sample();
  result.resources.push({geometries:after.stats.geometries,textures:after.stats.textures,projectilePool:after.stats.projectiles.pool});
 }
 assert(result.resources.slice(1).every(r=>JSON.stringify(r)===JSON.stringify(result.resources[1])),'Stable repeated release resources');
 await page.evaluate(()=>{const a=window.__testApp;a.simulation.restoreState(window.__releaseReview);
  a.previousWeaponFamily='machineGun';a.previousDefenseValue=1n;a.previousFrameTimestampMs=null;a.frameId=requestAnimationFrame(a.renderFrame);});
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const a=window.__testApp;a.perf.reset();window.__samples=[];window.__timer=setInterval(()=>window.__samples.push({active:a.simulation.getFrameState().enemies.length,...a.renderer.getDebugStats(),...a.audio.getDebugStats()}),100);});
 await page.waitForTimeout(6000);
 result.performance=await page.evaluate(()=>{const a=window.__testApp;clearInterval(window.__timer);cancelAnimationFrame(a.frameId);const p=a.perf;
  return{frameAverage:p.frame.average(),frameP95:p.frame.p95(),frames:p.frame.count,simAverage:p.sim.average(),renderAverage:p.render.average(),audioAverage:p.audio.average(),samples:window.__samples};});
 assert(result.errors.length===0,result.errors.join('\n'));
 writeFileSync(`${out}/browser.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({portraits:Object.keys(result.portraits),resources:result.resources,performance:{...result.performance,samples:undefined},errors:result.errors}));
}finally{await browser.close();}

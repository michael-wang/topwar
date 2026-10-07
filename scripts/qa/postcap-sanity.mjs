// Production /topwar/ browser review. Observation hook is test-side only.
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??
 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/postcap/browser';mkdirSync(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5182,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??
 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const result={runs:[],errors:[]},assert=(ok,message)=>{if(!ok)throw Error(message);};
try {
 for(const [width,seed] of [[390,1],[350,17]]) {
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true});
  page.on('pageerror',e=>result.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  page.on('requestfailed',r=>result.errors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)result.errors.push(`HTTP ${r.status()} ${r.url()}`);});
  await page.addInitScript(seed=>{
   const native=crypto.getRandomValues.bind(crypto);
   crypto.getRandomValues=a=>a instanceof Uint32Array&&a.length===1?(a[0]=seed,a):native(a);
   window.__unhandled=[];window.addEventListener('unhandledrejection',e=>window.__unhandled.push(String(e.reason)));
  },seed);
  await page.route(/\/topwar\/assets\/index-.*\.js$/,async route=>{
   const response=await route.fetch(),body=await response.text();
   const pattern=/new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)\)\.start\(\)/g;
   assert([...body.matchAll(pattern)].length===1,'Exactly one production app observation hook');
   await route.fulfill({response,body:body.replace(pattern,match=>`(window.__testApp=${match.slice(0,-8)}).start()`)});
  });
  await page.goto('http://127.0.0.1:5182/topwar/?perf=1');await page.waitForSelector('.game-start-overlay');
  await page.getByRole('button',{name:'Start game with audio'}).tap();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  // Normal player-facing captures omit the optional diagnostic overlay.
  await page.addStyleTag({content:'.perf-hud { display: none !important; }'});
  await page.evaluate(()=>{
   const a=window.__testApp,sim=a.simulation;cancelAnimationFrame(a.frameId);a.previousFrameTimestampMs=null;
   document.activeElement?.blur();window.__clock=0;
   window.__qa={milestones:{},groups:[],giantSlots:[],supplySlots:[],acquisitions:[],throws:[],casualties:0,releaseCount:0,resources:[]};
   window.__snapshots={};const q=window.__qa;
   const step=sim.step.bind(sim);window.__step=step;
   sim.step=(dt,input,tuning)=>{
    window.__tuning=tuning;const b=sim.getState();step(dt,input,tuning);const s=sim.getState();
    if(s.progression.level>b.progression.level)q.milestones[s.progression.level]=s.elapsedSeconds;
    if(b.machineGunReleaseAtSeconds===null&&s.machineGunReleaseAtSeconds!==null){q.releaseCount++;window.__snapshots.release=s;}
    if(b.postCapSurvival.startedAtSeconds===null&&s.postCapSurvival.startedAtSeconds!==null)q.activation=s.postCapSurvival.startedAtSeconds;
    const added=s.enemies.filter(e=>e.id>=b.enemyStream.nextEnemyId),ordinary=added.filter(e=>e.archetype!=='giant');
    if(b.postCapSurvival.startedAtSeconds!==null&&ordinary.length)q.groups.push({seconds:s.elapsedSeconds,
     count:s.enemyStream.nextEnemyId-b.enemyStream.nextEnemyId-added.filter(e=>e.archetype==='giant').length,
     heavy:ordinary.filter(e=>e.archetype==='heavy').length,grunt:ordinary.filter(e=>e.archetype==='grunt').length,
     fronts:new Set(ordinary.map(e=>e.lane)).size});
    if(b.postCapSurvival.startedAtSeconds!==null&&b.postCapSurvival.nextGiantAtSeconds!==s.postCapSurvival.nextGiantAtSeconds)
     q.giantSlots.push({seconds:s.elapsedSeconds,due:b.postCapSurvival.nextGiantAtSeconds,spawned:added.some(e=>e.archetype==='giant')});
    if(b.postCapSurvival.startedAtSeconds!==null&&b.postCapSurvival.nextGrenadeSupplyAtSeconds!==s.postCapSurvival.nextGrenadeSupplyAtSeconds)
     q.supplySlots.push({seconds:s.elapsedSeconds,due:b.postCapSurvival.nextGrenadeSupplyAtSeconds,
      result:!b.grenade.supply&&s.grenade.supply?.rewardAmount!==undefined?'spawn':b.grenade.supply?'existing'
        :s.grenade.inventory===3?'full':'teaching-pending'});
    if(!b.grenade.supply&&s.grenade.supply?.rewardAmount!==undefined)window.__snapshots.supply=s;
    if(!b.grenade.flight&&s.grenade.flight)window.__snapshots.flight=s;
   };
   const consume=sim.consumeGrenadeEvents.bind(sim);sim.consumeGrenadeEvents=()=>{
    const events=consume();for(const e of events)if(e.kind==='grenadeAcquired')q.acquisitions.push({seconds:sim.getState().elapsedSeconds,inventory:sim.getState().grenade.inventory});
    else q.throws.push({seconds:sim.getState().elapsedSeconds,kills:e.victims.filter(v=>v.killed).length});return events;
   };
   const contacts=sim.consumePresentationEvents.bind(sim);sim.consumePresentationEvents=()=>{
    const events=contacts();q.casualties+=events.reduce((n,e)=>n+Math.max(0,e.before.count-e.after.count),0);return events;
   };
   window.__key=(key,code)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}));};
   const gpu=a.renderer.renderer,draw=gpu.render.bind(gpu),observedObjects=new WeakSet(),seenGeometries=new Set();
   q.firstRenderedGeometry=[];
   gpu.render=(...args)=>{if(!window.__skipDraw){
    args[0].traverse(object=>{if(!object.geometry||observedObjects.has(object))return;observedObjects.add(object);
     const before=object.onBeforeRender;object.onBeforeRender=function(...params){
      if(!seenGeometries.has(this.geometry.uuid)){seenGeometries.add(this.geometry.uuid);
       if(window.__resourceCycle!==undefined)q.firstRenderedGeometry.push({cycle:window.__resourceCycle,
        name:this.name||this.parent?.name||this.type,type:this.geometry.type});}
      before.apply(this,params);
     };
    });draw(...args);
   }};
   let nextLaneDecisionTick=sim.getState().tick;
   window.__advance=(ms,pilot=true)=>{
    window.__skipDraw=true;
    try {for(let t=0;t<ms;t+=100){const s=sim.getState();
     if(pilot&&s.squad.count&&s.tick>=nextLaneDecisionTick){
      nextLaneDecisionTick=s.tick+12;
      const nearest=[...s.enemies].sort((a,b)=>a.z-b.z||a.id-b.id)[0],giant=s.enemies.find(e=>e.archetype==='giant');
      const threat=giant&&(!nearest||nearest.z-s.player.z>10)?giant:nearest;
      const lane=s.grenade.supply?.lane??threat?.lane??s.player.selectedLane;
      if(lane!==s.player.selectedLane)window.__key(lane<s.player.selectedLane?'a':'d',lane<s.player.selectedLane?'KeyA':'KeyD');
     }
     if(pilot&&s.grenade.inventory&&!s.grenade.flight){
      const anchor=[...s.enemies].sort((a,b)=>a.z-b.z||a.id-b.id)[0];
      if(anchor){const radius=s.catharsis.balance.grenade.blastRadius,
       local=s.enemies.filter(e=>(e.x-anchor.x)**2+(e.z-anchor.z)**2<=radius**2),
       x=local.reduce((n,e)=>n+e.x,0)/local.length,z=local.reduce((n,e)=>n+e.z,0)/local.length,
       victims=s.enemies.filter(e=>(e.x-x)**2+(e.z-z)**2<=radius**2),depth=z-s.player.z;
       if((victims.length>=6&&depth<=14)||(depth<=10&&victims.reduce((n,e)=>n+e.hp,0)>=12))window.__key('q','KeyQ');
      }
     }
     window.__clock+=Math.min(100,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);
    }}finally{window.__skipDraw=false;}
    a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);
   };
  });
  const advance=(ms,pilot=true)=>page.evaluate(({ms,pilot})=>window.__advance(ms,pilot),{ms,pilot});
  const sample=()=>page.evaluate(()=>({state:window.__testApp.simulation.getState(),stats:window.__testApp.renderer.getDebugStats(),qa:window.__qa,errors:window.__unhandled}));
  const captured=new Set();
  for(let n=0;n<320;n++) {
   await advance(1000);const v=await sample(),s=v.state;
   assert(s.squad.count>0,'Natural/post-cap pilot survived');
   const post=s.postCapSurvival.startedAtSeconds===null?-1:s.elapsedSeconds-s.postCapSurvival.startedAtSeconds;
   for(const [name,condition] of [['release',post>=0],['giant',post>=25],['supply',s.grenade.supply?.rewardAmount===1],['plus120',post>=120]])
    if(condition&&!captured.has(name)){captured.add(name);await page.screenshot({path:`${out}/${width}-${name}.png`});
     await page.evaluate(name=>window.__qa.resources.push({name,...window.__testApp.renderer.getDebugStats()}),name);}
   if(n%60===0)console.log('Production survival',width,s.elapsedSeconds,s.progression.level,post);
   if(post>=150)break;
  }
  let v=await sample();assert(v.state.elapsedSeconds-v.qa.activation>=150,'150 seconds post-cap');
  const layout=await page.evaluate(()=>{
   const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
   const grenade=rect('.grenade-button'),weapon=rect('.battle-info'),xp=rect('.xp-hud'),moves=[...document.querySelectorAll('.movement-button')].map(e=>{
    const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
   if(overlaps(grenade,moves[0])||overlaps(weapon,moves[1])||overlaps(grenade,xp)||overlaps(weapon,xp))throw Error('Combat HUD overlap');
   const all=[grenade,weapon,xp,...moves,rect('.build-label')];
   if(all.some(r=>r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5))throw Error('HUD clips viewport');
   return{grenade,weapon,xp,moves};
  });
  assert(v.qa.releaseCount===1&&v.qa.groups.length>=24,'One release and recurring ordinary groups');
  assert(v.qa.groups.every(g=>g.count===3&&g.heavy===3&&!g.grunt&&g.fronts===3),'Production Heavy-only composition');
  assert(v.qa.giantSlots.length>=6&&v.qa.supplySlots.length>=5,'Fixed recurring opportunities continue');
  assert(v.state.progression.level===6&&v.state.progression.xp===0,'Progression remains capped');
  // Shared Q/touch path, flight freeze, then consume a reserve and collect +1 at a future slot.
  assert(v.state.grenade.inventory===3,'Recurring pickups filled reserves');
  await page.keyboard.press('q');await advance(100,false);v=await sample();assert(v.state.grenade.inventory===2&&v.state.grenade.flight,'Q consumes one reserve');
  await page.getByRole('button',{name:'Pause game'}).tap();const frozen=(await sample()).state;await advance(500,false);
  assert(JSON.stringify((await sample()).state)===JSON.stringify(frozen),'Pause freezes schedules and flight');
  await page.getByRole('button',{name:'Resume game'}).tap();await advance(1000,false);
  assert((await sample()).state.grenade.flight===null,'Flight resumes and detonates');
  const previousSlotCount=v.qa.supplySlots.length;
  for(let n=0;n<40&&(await sample()).qa.supplySlots.length===previousSlotCount;n++)await advance(1000);
  v=await sample();assert(v.qa.supplySlots.at(-1).result==='spawn','Next fixed Supply slot spawns +1');
  // MG may collect within the sampling second. Review the actual recorded spawn
  // snapshot, then acquire it again through ordinary fire rather than miss it.
  await page.evaluate(()=>{const a=window.__testApp,s=window.__snapshots.supply;
   if(s.grenade.supply?.rewardAmount!==1||s.grenade.inventory!==2)throw Error('Supply spawn changed inventory');
   a.simulation.restoreState(s);a.fixedStepLoop.reset();a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);});
  await page.screenshot({path:`${out}/${width}-recurring-supply.png`});
  await advance(3000);v=await sample();assert(v.state.grenade.inventory===3&&!v.state.grenade.supply,'MG collects +1 Supply');
  for(let n=0;n<12&&!(await page.locator('.grenade-button').isEnabled());n++)await advance(500);
  await page.locator('.grenade-button').tap();await advance(1000,false);
  assert((await sample()).state.grenade.inventory===2,'Touch consumes exactly one');
  const replay=await page.evaluate(()=>{
   const a=window.__testApp,sim=a.simulation,saved=sim.getState(),records=[];
   for(const key of ['release','supply','flight']){
    const initial=window.__snapshots[key];if(!initial)throw Error('Missing snapshot '+key);
    const run=()=>{for(let i=0;i<120;i++)window.__step(1/60,{targetX:0},window.__tuning);return JSON.stringify(sim.getState());};
    sim.restoreState(initial);const first=run();sim.restoreState(initial);if(first!==run())throw Error('Snapshot mismatch '+key);records.push(key);
   }
   sim.restoreState(saved);a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;return records;
  });
  const resources=[];
  for(let cycle=0;cycle<10;cycle++) {
   await page.evaluate(cycle=>{window.__resourceCycle=cycle;const a=window.__testApp;a.simulation.restoreState(window.__snapshots.flight);a.renderer.resetFeedback();a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;},cycle);
   await advance(1500,false);resources.push((await sample()).stats);
  }
  result.resourceDiagnostics??=[];result.resourceDiagnostics.push({width,resources,firstRenderedGeometry:(await sample()).qa.firstRenderedGeometry});
  console.log('Repeated resource counts',width,JSON.stringify(resources.map(r=>({geometries:r.geometries,textures:r.textures,projectilePool:r.projectiles.pool}))));
  const warm=resources.slice(-4);
  assert(warm.every(r=>r.geometries===warm[0].geometries&&r.textures===warm[0].textures&&r.projectiles.pool===warm[0].projectiles.pool),'Warmed repeated flight/effect resources bounded');
  let performanceSample;
  if(width===390){
   await page.evaluate(()=>{const a=window.__testApp;a.simulation.restoreState(window.__snapshots.release);a.fixedStepLoop.reset();a.previousFrameTimestampMs=null;a.perf.reset();a.frameId=requestAnimationFrame(a.renderFrame);});
   await page.waitForTimeout(1500);await page.evaluate(()=>window.__testApp.perf.reset());await page.waitForTimeout(5000);
   performanceSample=await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);return{frames:a.perf.frame.count,averageMs:a.perf.frame.average(),p95Ms:a.perf.frame.p95(),stats:a.renderer.getDebugStats()};});
  }
  const final=await sample();result.errors.push(...final.errors);
  result.runs.push({width,seed,sha:await page.locator('.build-label').textContent(),layout,qa:v.qa,replay,resources,performanceSample,final:{seconds:v.state.elapsedSeconds,postCap:v.state.postCapSurvival,inventory:v.state.grenade.inventory}});
  await page.evaluate(()=>window.__testApp.retry());await advance(100,false);v=await sample();
  assert(v.state.progression.level===1&&v.state.grenade.inventory===0&&v.state.postCapSurvival.startedAtSeconds===null
   &&v.state.postCapSurvival.nextGiantAtSeconds===null&&v.state.postCapSurvival.nextGrenadeSupplyAtSeconds===null,'Retry resets temporary layer and inventory');
  await page.getByRole('button',{name:'Move left'}).tap();assert((await sample()).state.player.selectedLane===1,'Movement after Retry');
  await page.close();
 }
 assert(!result.errors.length,result.errors.join('\n'));result.success=true;
}finally{writeFileSync(`${out}/postcap-sanity.json`,JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));}
console.log(JSON.stringify({success:result.success,runs:result.runs.map(r=>({width:r.width,activation:r.qa.activation,groups:r.qa.groups.length,giants:r.qa.giantSlots.length,supplies:r.qa.supplySlots.length,resources:r.resources.at(-1),performance:r.performanceSample})),errors:result.errors},null,2));

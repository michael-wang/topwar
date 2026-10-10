// Shipping build + test-side observation/config responses only; no shipping DEV hook.
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='artifacts/p3b3/modes';mkdirSync(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5185,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [350,390])for(const legacy of [false,true]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[],models=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.glb'))models.push(r.url());});
 await page.addInitScript(()=>{const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>a instanceof Uint32Array&&a.length===1?(a[0]=17,a):native(a);});
 await page.route(/\/topwar\/assets\/index-.*\.js$/,async route=>{
  const response=await route.fetch(),body=await response.text(),pattern=/new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)\.start\(\)/g;
  assert.equal([...body.matchAll(pattern)].length,1);await route.fulfill({response,body:body.replace(pattern,m=>`(window.__testApp=${m.slice(0,-8)}).start()`)});
 });
 if(legacy)await page.route(/\/game-data\/game\.[a-f0-9]+\.json$/,async route=>{const response=await route.fetch(),data=await response.json();delete data.catharsis;await route.fulfill({response,json:data});});
 await page.goto('http://127.0.0.1:5185/topwar/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
 assert.equal(models.length,legacy?13:1);assert.equal(new Set(models).size,models.length);
 await page.evaluate(()=>{
  const a=window.__testApp;cancelAnimationFrame(a.frameId);a.retry();let clock=performance.now();a.renderFrame(clock);cancelAnimationFrame(a.frameId);
  const draw=a.renderer.renderer.render.bind(a.renderer.renderer);let skip=false;a.renderer.renderer.render=(...args)=>{if(!skip)draw(...args);};
  window.__milestones={1:0};let nextDecision=0;
  window.__advance=seconds=>{skip=true;try{for(let tick=0;tick<seconds*60;tick++){
   const s=a.simulation.getState();
   if(s.catharsis&&s.tick>=nextDecision){nextDecision=s.tick+12;
    const nearest=[...s.enemies].sort((a,b)=>a.z-b.z||a.id-b.id)[0],giant=s.enemies.find(e=>e.archetype==='giant');
    let lane=s.grenade.supply?.lane??(giant&&(!nearest||nearest.z>10)?giant:nearest)?.lane??s.player.selectedLane;
    const targets=new Set(s.artillery?.shells.map(shell=>shell.targetLane));
    if(targets.has(s.player.selectedLane))lane=[0,1,2,3,4].filter(l=>!targets.has(l)).sort((a,b)=>Math.abs(a-s.player.selectedLane)-Math.abs(b-s.player.selectedLane))[0]??lane;
    if(lane!==s.player.selectedLane)a.simulation.stepLane(lane<s.player.selectedLane?-1:1);
    if(s.grenade.inventory&&!s.grenade.flight&&nearest&&nearest.z<14){window.dispatchEvent(new KeyboardEvent('keydown',{key:'q',code:'KeyQ'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'q',code:'KeyQ'}));}
   }
   a.renderFrame(clock+=1000/60);cancelAnimationFrame(a.frameId);
   const now=a.simulation.getState();if(now.progression)window.__milestones[now.progression.level]??=now.elapsedSeconds;
  }}finally{skip=false;}a.renderFrame(clock);cancelAnimationFrame(a.frameId);};
 });
 if(legacy){
  // Use the existing snapshot path to bring the first Boss row into lookahead.
  await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.player.z=20;a.simulation.restoreState(s);window.__advance(1);});
  assert(await page.evaluate(()=>!!window.__testApp.simulation.getState().boss));
 }
 else{for(let i=0;i<32;i++){await page.evaluate(()=>window.__advance(5));const s=await page.evaluate(()=>window.__testApp.simulation.getState());assert(s.squad.count>0);if(s.progression.level===8)break;}
  assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().progression.level),8);
  assert.deepEqual(Object.keys(await page.evaluate(()=>window.__milestones)),['1','2','3','4','5','6','7','8']);
 }
 await page.screenshot({path:`${out}/${width}-${legacy?'legacy-boss':'lv8'}.png`});
 const snapshot=await page.evaluate(()=>window.__testApp.simulation.getState());
 await page.getByRole('button',{name:'Pause game',exact:true}).tap();await page.evaluate(()=>window.__advance(1));assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),snapshot);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 const replay=await page.evaluate(()=>{
  const a=window.__testApp,sim=a.simulation,saved=sim.getState(),c=a.config;
  const tuning={...c.player,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:c.weapon.rifle,rocket:c.weapon.rocket};
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const run=()=>{for(let i=0;i<120;i++)sim.step(1/60,{targetX:0},tuning);return JSON.stringify(canonical(sim.getState()));};
  const expected=run();sim.restoreState(JSON.parse(JSON.stringify(saved)));const same=run()===expected;sim.restoreState(saved);return same;
 });assert(replay);
 await page.evaluate(()=>window.__testApp.retry());const reset=await page.evaluate(()=>window.__testApp.simulation.getState());assert.equal(reset.elapsedSeconds,0);if(!legacy)assert.equal(reset.progression.level,1);
 assert.equal(models.length,legacy?13:1);assert.deepEqual(errors,[]);
 results.push({width,legacy,models,milestones:await page.evaluate(()=>window.__milestones),replay,pause:true,retry:true,errors});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log('Production mode',width,legacy?'legacy':'Defense');await page.close();
}}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

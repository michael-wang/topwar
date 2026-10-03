// QA-only fixtures through the shipping app renderer; no runtime hook is shipped.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase=process.argv[2]??'polish', out='artifacts/coastal-r3';
const server=phase==='baseline'?await baselineServer():null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=threats`);
async function prepare(){
await page.waitForSelector('canvas'); await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.build-label{visibility:hidden}'});
await page.evaluate(async()=>{
 const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
 window.__fixture=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
 window.__draw=(f,t)=>{a.xpHud.reset();a.xpHud.update({level:7,xp:0},s.catharsis.balance.progression,t,{baseFireRate:a.runtimeTuning.fireRate,squadCount:f.squad.count,initialSquadCount:1,reinforcementArrived:true});a.renderer.render(f,t);};
 a.xpHud.update({level:7,xp:0},s.catharsis.balance.progression,0,{baseFireRate:a.runtimeTuning.fireRate,squadCount:2,initialSquadCount:1,reinforcementArrived:true});
});
}
await prepare();
const stats={},keys=['opening','empty-beach','outer-lanes','normal-crowd','dense-mixed','death-peak','warship-defense','warship-legacy','right-house','left-cluster','right-cluster','player-guard','boss-guard'];
for(const key of keys){
 stats[key]=await page.evaluate(key=>{
  const r=window.__testApp.renderer,f=structuredClone(window.__fixture),draw=window.__draw;r.resetFeedback();r.resize();
  const g={...f.enemies[0],id:100,x:0,z:9},h={...f.enemies[1],id:101,x:1.4,z:12};
  const crowd=n=>Array.from({length:n},(_,i)=>({...((i%5===0)?h:g),id:200+i,x:(i%5-2)*1.4+Math.sin(i*2.4)*.15,z:7+Math.floor(i/5)*.7}));
  if(key==='normal-crowd')f.enemies=Array.from({length:100},(_,i)=>({...g,id:200+i,x:(i%5-2)*1.4,z:7+Math.floor(i/5)*.7}));
  if(key==='dense-mixed'||key==='death-peak')f.enemies=crowd(100);
  if(key==='outer-lanes')f.enemies=[{...g,x:-2.8,z:6},{...h,x:2.8,z:8},{...g,id:103,x:-2.8,z:15}];
  if(['empty-beach','right-house','left-cluster','right-cluster','warship-defense','warship-legacy','player-guard','boss-guard'].includes(key))f.enemies=[];
  draw(f,0);draw(f,2000);
  let peak;
  if(key==='death-peak'){
   f.enemies=f.enemies.slice(24);const samples=[];
   for(const age of [0,60,100,110,150,220,300,390,480]){draw(f,2010+age);samples.push({ageMs:age,...r.getDebugStats()});}
   peak={samples,maximumDraws:Math.max(...samples.map(s=>s.drawCalls)),maximumTriangles:Math.max(...samples.map(s=>s.triangles))};
   window.__peak=peak;
  }
  if(key.startsWith('warship')){if(key==='warship-legacy'){f.defenseMode=false;draw(f,0);}for(let t=100;t<=14000;t+=100){r.environment.update(0,3.2,t,key!=='warship-legacy');}draw(f,14000);}
  if(['right-house','left-cluster','right-cluster'].includes(key)){
   // Screen-right foreground house is the negative-X, Z=24 building.
   const target=key==='right-house'?[-6.6,1.3,21.7]:key==='left-cluster'?[5.2,.35,9]:[-5.4,.35,13];
   r.camera.position.set(target[0]+(key==='left-cluster'?-3:3),target[1]+3,target[2]-7);r.camera.lookAt(...target);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);
  }
  if(key==='player-guard'||key==='boss-guard'){
   f.squad.count=key==='player-guard'?1:0;f.squad.rifleCounts=key==='player-guard'?[1]:[];f.reinforcement=undefined;
   if(key==='boss-guard')f.boss={id:777,tier:1,x:0,z:15,hp:100,maxHp:100,visualScale:7,engaged:false,slamCooldownRemainingSeconds:0,slamCount:0};
   draw(f,2000);for(const c of r.scene.children)if(c!==r.skyFill&&c!==r.sunlight&&!c.getObjectByName('toy-soldier-body')&&!c.name.includes('boss'))c.visible=false;
   r.scene.background.set('white');r.scene.fog=null;r.renderer.render(r.scene,r.camera);
  }
  return {...r.getDebugStats(),...(peak?{deathPeak:peak}:{})};
 },key);
 await page.screenshot({path:`${out}/${phase}-${key}.png`});
 // Rebuild app for isolated fixture state; environment clocks and inspection camera cannot leak.
 if(key!==keys.at(-1)){await page.reload();await prepare();}
}
for(const role of ['grunt','heavy','giant']){
 await page.reload();await prepare();
 await page.evaluate(async role=>{
  const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
  const f=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
  f.enemies=[{...f.enemies.find(e=>e.archetype===role),id:100,x:0,z:role==='giant'?22:8}];
  window.__deathFrame=f;a.renderer.render(f,0);a.renderer.render(f,2000);
 },role);
 await page.screenshot({path:`${out}/${phase}-${role}-alive.png`});
 await page.evaluate(()=>{window.__deathFrame.enemies=[];window.__testApp.renderer.render(window.__deathFrame,2010);});
 const ages=role==='giant'?[0,100,250,450,520,580,750,1200,1800,2400]:[0,60,100,110,150,220,300,400];
 for(const age of ages){await page.evaluate(age=>window.__testApp.renderer.render(window.__deathFrame,2010+age),age);await page.screenshot({path:`${out}/${phase}-${role}-death-${age}.png`});}
}
writeFileSync(`${out}/${phase}-stats.json`,JSON.stringify({stats,errors},null,2));
await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

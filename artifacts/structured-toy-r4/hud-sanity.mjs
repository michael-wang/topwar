import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={},errors=[];
for(const width of [390,350]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
 await page.goto('http://127.0.0.1:5173/?review=threats');await page.waitForSelector('canvas');
 for(const inset of [0,20])for(const kind of ['fireRate','squad']){
  const key=`${width}-${inset}-${kind}`;
  results[key]=await page.evaluate(({inset,kind})=>{
   const app=window.__testApp,state=app.simulation.getState(),viewport=document.querySelector('#game-viewport');
   for(const side of ['left','right','bottom'])viewport.style.setProperty(`--hud-inset-${side}`,`${inset}px`);
   app.xpHud.update({level:6,xp:200},state.catharsis.balance.progression,2000,{baseFireRate:app.runtimeTuning.fireRate,squadCount:kind==='squad'?2:1,initialSquadCount:1,reinforcementArrived:kind==='squad'});
   const box=q=>{const b=document.querySelector(q).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
   const track=box('.xp-track'),weapon=box('.xp-weapon-slot'),enhancement=box('.xp-enhancement-slot'),value=box('.xp-enhancement-slot strong'),badge=box('.xp-level'),label=box('.build-label'),root=box('#game-viewport');
   const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
   return {track,weapon,enhancement,value,badge,label,root,text:document.querySelector('.xp-enhancement-slot strong').textContent,
    checks:{separate:track.right<weapon.x&&weapon.right<enhancement.x,trackDominant:track.width>Math.max(weapon.width,enhancement.width),
     usableTrack:track.width>=105,noWrap:value.right<=enhancement.right&&value.height<=18,
     inSafeArea:enhancement.right<=root.right-inset&&badge.x>=root.x+inset&&badge.bottom<=root.bottom-inset,
     clearBuild:!overlap(label,weapon)&&!overlap(label,enhancement)}};
  },{inset,kind});
  await page.screenshot({path:`artifacts/structured-toy-r4/hud-safe-${key}.png`});
  if(!Object.values(results[key].checks).every(Boolean))throw Error(JSON.stringify(results[key]));
 }
 await page.close();
}
await browser.close();writeFileSync('artifacts/structured-toy-r4/hud-sanity.json',JSON.stringify({results,errors},null,2));if(errors.length)throw Error(errors.join('\n'));

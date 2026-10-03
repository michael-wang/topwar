import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase=process.argv[2]??'polish',out='artifacts/coastal-r3',server=phase==='baseline'?await baselineServer():null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
for(const role of ['grunt','heavy','giant']){
 await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=threats`);await page.waitForSelector('canvas');
 await page.addStyleTag({content:'.build-label{visibility:hidden}'});
 await page.evaluate(async role=>{
  const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
  const f=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
  f.enemies=[{...f.enemies.find(e=>e.archetype===role),id:100,x:0,z:role==='giant'?22:8}];
  window.__deathFrame=f;a.renderer.render(f,0);a.renderer.render(f,2000);
 },role);
 const folder=`${out}/${phase}-${role}-death-frames`;mkdirSync(folder,{recursive:true});
 await page.locator('canvas').screenshot({path:`${folder}/alive.png`});
 await page.evaluate(()=>{window.__deathFrame.enemies=[];});
 const step=role==='giant'?60:30,duration=role==='giant'?2400:480;
 for(let age=0;age<=duration;age+=step){await page.evaluate(age=>window.__testApp.renderer.render(window.__deathFrame,2010+age),age);await page.locator('canvas').screenshot({path:`${folder}/${age}.png`});}
}
writeFileSync(`${out}/${phase}-temporal.json`,JSON.stringify({errors,normalStepMs:30,giantStepMs:60},null,2));
await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

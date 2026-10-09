import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b1/panel';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [390,350]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,locale:'zh-TW'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.route('**/audio/observer_mission_intro_zh-TW.mp3',async route=>{await new Promise(r=>setTimeout(r,2000));await route.continue();});
 await page.addInitScript(()=>{window.__sources=[];const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){const a=window.__testApp;if(a?.audio.voice?.source===this)window.__sources.push({offset:args[1]??0,time:a.simulation.getState().elapsedSeconds});return start.apply(this,args);};
 });
 await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=.25);
 assert.equal(await page.evaluate(()=>window.__sources.length),0);
 await page.evaluate(()=>window.__testApp.retry());
 await page.waitForFunction(()=>window.__sources.length===1);assert.equal(await page.evaluate(()=>window.__sources[0].offset),0);
 await page.waitForTimeout(500);await page.getByRole('button',{name:'Pause game',exact:true}).tap();
 const paused=await page.evaluate(()=>({time:window.__testApp.simulation.getState().elapsedSeconds,offset:window.__testApp.audio.voice.offset}));
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().elapsedSeconds),paused.time);
 assert.equal(await page.evaluate(()=>window.__testApp.audio.voice.source),null);
 assert.equal(await page.locator('.observer-languages').count(),0);
 assert.equal(await page.locator('.field-observer p').getAttribute('lang'),'zh-TW');
 assert.equal(await page.evaluate(()=>window.__sources.length),1);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await page.waitForFunction(()=>window.__sources.length===2);
 const resume=await page.evaluate(()=>window.__sources[1]);assert(Math.abs(resume.offset-paused.offset)<.06);
 await page.evaluate(()=>window.__testApp.retry());
 await page.waitForFunction(()=>window.__sources.length===3);assert.equal(await page.evaluate(()=>window.__sources[2].offset),0);
 await page.waitForFunction(()=>window.__testApp.simulation.getState().elapsedSeconds>=1);
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 if(width===350)await page.locator('.beachhead-defense').evaluate(e=>e.style.setProperty('--hud-inset-bottom','34px'));
 const panel=page.locator('.field-observer');
 const style=await panel.evaluate(e=>{const s=getComputedStyle(e);return{background:s.backgroundColor,opacity:s.opacity,blur:s.backdropFilter,pointer:s.pointerEvents,children:[...e.children].map(n=>getComputedStyle(n).opacity)};});
 assert.equal(style.background,'rgba(24, 43, 59, 0.83)');assert.equal(style.opacity,'1');assert.equal(style.blur,'none');assert.equal(style.pointer,'none');assert(style.children.every(a=>a==='1'));
 for(const background of ['sky','crowd']){
  // Stress-only placement over the actual crowd; shipping panel coordinates remain untouched.
  if(background==='crowd')await panel.evaluate(e=>e.style.top='295px');
  await page.screenshot({path:`${out}/${width}-${background}-after.png`});
  await panel.evaluate(e=>e.style.background='#182b3bf2');
  await page.screenshot({path:`${out}/${width}-${background}-before.png`});
  await panel.evaluate(e=>e.style.removeProperty('background'));
 }
 assert.deepEqual(errors,[]);results.push({width,style,paused,resume,errors});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));}finally{await browser.close();}

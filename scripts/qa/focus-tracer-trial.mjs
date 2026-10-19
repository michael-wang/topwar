import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const {chromium}=await import('file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='artifacts/p4.45';mkdirSync(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5188,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[], errors=[], focusImages=[], tracerImages=[];
async function init(width,dpr,query=""){
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route(/\/src\/main\.ts(?:\?.*)?$/,async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('app = new GameApp(','app = window.__testApp = new GameApp(')});});
 await p.goto('http://127.0.0.1:5188/'+query);await p.getByRole('button',{name:query?'Start game with audio':'開始遊戲',exact:true}).tap();await p.waitForFunction(()=>window.__testApp.startup==='started');
 await p.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.stamp=a.previousFrameTimestampMs??performance.now();window.draw=()=>{a.renderFrame(window.stamp);cancelAnimationFrame(a.frameId)};window.advance=seconds=>{const gpu=a.renderer.renderer,draw=gpu.render;gpu.render=()=>{};try{for(let i=0;i<Math.ceil(seconds*60);i++){window.stamp+=1000/60;window.draw();}}finally{gpu.render=draw;}window.draw();};});
 await p.waitForFunction(()=>['missionIntro','giant','destroyer','tankBoss','airSupport'].every(m=>window.__testApp.audio.radioDurationSeconds('zh-TW',m)>0));
 return p;
}
async function area(p){return p.evaluate(()=>{const a=window.__testApp,e=document.querySelector('.commander-focus'),r=e.getBoundingClientRect();return {cue:a.fieldObserver.visibleCue,hidden:e.hidden,rect:{x:r.x,y:r.y,width:r.width,height:r.height},paused:e.getAttribute('data-paused'),count:document.querySelectorAll('.commander-focus:not([hidden])').length};});}
async function snap(p,name,list,label){const file=`${name}.png`;await p.screenshot({path:`${out}/${file}`,scale:'css'});list.push({file,label});}
async function fixture(p,role,seconds){await p.evaluate(({role,seconds})=>{const a=window.__testApp;a.devReviewFixture=role;a.retry();window.draw();window.advance(seconds);},{role,seconds});}
try{
 for(const [width,dpr] of [[350,2],[390,3]]){
  const p=await init(width,dpr), row={width,dpr};
  await p.evaluate(()=>window.advance(4.5));assert((await area(p)).hidden,'no empty-beach focus');
  await p.evaluate(()=>window.advance(.8));let f=await area(p);assert.equal(f.cue.message,'missionIntro');assert(!f.hidden);assert.equal(f.count,1);row.opening=f;
  await snap(p,`focus-opening-${width}`,focusImages,`${width} / 登陸`);
  await p.evaluate(()=>window.advance(.2));assert.deepEqual((await area(p)).rect,f.rect,'stationary area');
  await p.getByRole('button',{name:'跳過開場簡報，開始遊戲'}).tap();assert((await area(p)).hidden,'skip clears immediately');await p.evaluate(()=>window.advance(.3));
  assert.equal(await p.locator('.dev-tracer-controls button').count(),3);assert(await p.locator('.dev-tracer-controls').isVisible());
  for(const [role,t] of [['giant',1.5],['naval',3.4],['boss-intro',.8]]){
   if(role==='naval'){await fixture(p,role,1.5);assert((await area(p)).hidden,'offscreen ship is not highlighted');await p.evaluate(()=>window.advance(1.9));}else await fixture(p,role,t);f=await area(p);assert(!f.hidden,role+' focus');assert.equal(f.count,1);row[role]=f;
   await snap(p,`focus-${role}-${width}`,focusImages,`${width} / ${role}`);
  }
  await fixture(p,'air-support',.15);f=await area(p);assert.equal(f.cue.message,'airSupportReady');assert(!f.hidden);
  const button=p.getByRole('button',{name:'呼叫空襲',exact:true});assert(await button.isVisible());assert(await button.isDisabled());
  await p.evaluate(()=>window.airButton=document.querySelector('.manual-air-support'));
  await snap(p,`focus-air-${width}`,focusImages,`${width} / 空襲預告（鎖定）`);
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.commander-focus i').first().evaluate(e=>getComputedStyle(e).animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});
  await p.evaluate(()=>{window.__testApp.togglePaused();window.draw();});assert.equal((await area(p)).paused,'true');const paused=await area(p);await p.evaluate(()=>window.advance(1));assert.deepEqual((await area(p)).rect,paused.rect);
  await p.evaluate(()=>{window.__testApp.togglePaused();window.advance(3.3);});assert(await button.isEnabled());assert(await p.getByText('新功能：呼叫空襲',{exact:true}).isVisible());assert((await area(p)).hidden);
  assert(await p.evaluate(()=>window.airButton===document.querySelector('.manual-air-support')));
  await button.tap();await p.evaluate(()=>window.advance(.1));f=await area(p);assert.equal(f.cue.message,'airSupportCalled');assert(!f.hidden);assert.equal(f.count,1);assert(!(await button.isVisible()));
  row.air={previewDisabled:true,sameButton:true,originalUnlock:true,hintUntilUse:true,called:f};
  await fixture(p,'victory',5);assert((await area(p)).hidden);
  const role=width===350?'mg9':'boss-intro';await fixture(p,role,width===350?1.3:2.5);
  const before=await p.evaluate(()=>JSON.stringify(window.__testApp.simulation.getState()));const profiles=[];
  for(const style of ['A','B','C']){
   await p.locator(`[data-tracer="${style}"]`).tap();await p.evaluate(()=>window.draw());
   assert.equal(await p.evaluate(()=>JSON.stringify(window.__testApp.simulation.getState())),before,'visual switch mutates gameplay');
   assert.equal(await p.locator(`[data-tracer="${style}"]`).getAttribute('aria-pressed'),'true');
   profiles.push(await p.evaluate(()=>{const r=window.__testApp.renderer,pr=r.projectileRenderer;const coverage=[0,Math.floor(pr.body.count/2),pr.body.count-1].filter(i=>i>=0).map(i=>{pr.body.getMatrixAt(i,pr.transform.matrix);const v=r.supplyProjection,positions=pr.defenseGeometry.attributes.position;let l=Infinity,t=Infinity,rr=-Infinity,b=-Infinity;for(let j=0;j<positions.count;j++){v.fromBufferAttribute(positions,j).applyMatrix4(pr.transform.matrix).project(r.camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;l=Math.min(l,x);rr=Math.max(rr,x);t=Math.min(t,y);b=Math.max(b,y);}return {cssWidth:rr-l,cssHeight:b-t,bufferWidth:(rr-l)*r.renderer.getPixelRatio(),bufferHeight:(b-t)*r.renderer.getPixelRatio()};});return {stats:r.getDebugStats(),coverage,matrix:Array.from(pr.body.instanceMatrix.array.slice(0,16)),style:pr.style};}));
   await snap(p,`tracer-${width}-${style}`,tracerImages,`${style} / ${width} / ${role}`);
  }
  assert.equal(new Set(profiles.map(p=>p.stats.drawCalls)).size,1);assert.equal(new Set(profiles.map(p=>p.stats.geometries)).size,1);assert.equal(new Set(profiles.map(p=>p.stats.projectiles.live)).size,1);
  await p.evaluate(()=>{const a=window.__testApp;window.sameSim=a.simulation;window.liveTick=a.simulation.getState().tick;a.previousFrameTimestampMs=null;a.frameId=requestAnimationFrame(a.renderFrame);});
  for(const style of ['A','B','C'])await p.locator('[data-tracer="'+style+'"]').tap();
  await p.waitForFunction(()=>window.__testApp.simulation===window.sameSim&&window.__testApp.simulation.getState().tick>window.liveTick);
  assert(await p.evaluate(()=>!window.__testApp.paused));
  row.tracers={identicalSimulation:true,realtimeSwitching:true,profiles};results.push(row);await p.context().close();
 }
 const giant=await init(350,2,'?giant-review');await giant.evaluate(()=>window.advance(1.5));
 assert(await giant.locator('.dev-tracer-controls').isVisible());
 const controls=await giant.locator('.dev-tracer-controls').boundingBox(), repeat=await giant.locator('.dev-giant-review').boundingBox();
 assert(controls.y>=repeat.y+repeat.height,'preserve isolated GIANT retry controls');await giant.context().close();
 assert.deepEqual(errors,[]);
 async function sheet(name,images,columns){const p=await browser.newPage({viewport:{width:columns*282,height:1200},deviceScaleFactor:1});await p.setContent(`<html><meta charset="utf-8"><style>body{margin:0;padding:10px;background:#14232e;color:#fff;font:14px sans-serif}.grid{display:grid;grid-template-columns:repeat(${columns},262px);gap:10px}img{width:262px;display:block}figure{margin:0}figcaption{padding:8px 0}</style><div class="grid">${images.map(i=>`<figure><figcaption>${i.label}</figcaption><img src="data:image/png;base64,${readFileSync(out+'/'+i.file).toString('base64')}"></figure>`).join('')}</div>`);await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await p.screenshot({path:`${out}/${name}.png`,fullPage:true});await p.close();}
 await sheet('focus-comparison',focusImages,5);await sheet('tracer-comparison',tracerImages,3);
 writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));
 writeFileSync(`${out}/index.html`,'<!doctype html><meta charset="utf-8"><title>P4.45 review</title><style>body{background:#14232e;color:white;font:18px sans-serif}img{max-width:100%}</style><h1>P4.45 — Focus + Tracer A/B/C</h1><p>Visual trial — awaiting Pixel 8 / Julia / Owner acceptance.</p><h2>Focus</h2><img src="focus-comparison.png"><h2>Tracer A / B / C — live state unchanged</h2><img src="tracer-comparison.png">');
 console.log(JSON.stringify(results.map(({width,dpr,tracers})=>({width,dpr,identicalSimulation:tracers.identicalSimulation,drawCalls:tracers.profiles.map(p=>p.stats.drawCalls)}))));
}finally{await browser.close();await server.close();}

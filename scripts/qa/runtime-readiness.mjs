import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p3b31/extra';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [350,390]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
  await page.route(/\/art\/observer\/.*\.webp/,r=>r.fulfill({status:404,body:''}));
  await page.addInitScript(()=>{
    window.__speech=[];const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){if(window.__testApp?.audio.voice?.source===this)window.__speech.push({offset:args[1]??0,emblem:!!document.querySelector('.field-observer .observer-fallback svg')});return start.apply(this,args);};
  });
  await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();
  await page.waitForFunction(()=>window.__speech.length>0);assert.deepEqual(await page.evaluate(()=>window.__speech[0]),{offset:0,emblem:true});
  await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=performance.now();window.__advance=n=>{for(let i=0;i<n;i++){a.renderFrame(window.__clock+=1000/60);cancelAnimationFrame(a.frameId);}};});
  await selectDevFixture(page,'naval');
  await page.waitForFunction(()=>window.__testApp.audio.prepareRadio('zh-TW','destroyer')==='ready');
  await page.evaluate(()=>window.__advance(130));assert(await page.locator('.field-observer').isVisible());
  assert(await page.locator('.observer-fallback svg').isVisible());assert.match(await page.locator('.field-observer p').textContent(),/驅逐艦/);
  await page.screenshot({path:`${out}/${width}-naval-fallback.png`});
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await page.evaluate(()=>window.__testApp.simulation.getState());
  await page.evaluate(()=>window.__advance(40));assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),frozen);
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  await selectDevFixture(page,'crate3');await page.evaluate(()=>window.__advance(160));
  assert(await page.locator('.supply-reward-item:visible').count()>0);
  await page.locator('.beachhead-defense').evaluate(v=>v.style.setProperty('--hud-inset-bottom','34px'));
  await page.setViewportSize({width:width===350?390:350,height:844});
  await page.evaluate(()=>window.__advance(1));
  const points=[];
  for(let i=0;i<90;i++){
    await page.evaluate(()=>window.__advance(1));
    const frame=await page.evaluate(()=>{const icon=document.querySelector('.grenade-button svg').getBoundingClientRect();return[...document.querySelectorAll('.supply-reward-item')].map(e=>{const b=e.getBoundingClientRect();return{hidden:e.hidden,x:b.x+b.width/2,y:b.y+b.height/2,tx:icon.x+icon.width/2,ty:icon.y+icon.height/2};});});
    frame.forEach((p,i)=>{if(!p.hidden)points[i]=p;});
  }
  assert(points.length>0);for(const p of points)assert(Math.hypot(p.x-p.tx,p.y-p.ty)<14);
  // Exact pixel comparison of the aircraft's former fog:false material and its
  // shared shader with zero fog weight, at the same frozen presentation time.
  await page.evaluate(()=>{const a=window.__testApp;a.renderer.preparation?.dispose();window.__planeMaterials=[];
    a.renderer.scene.traverse(o=>{if(o.name==='aircraft-fuselage'||o.name==='aircraft-wings'||o.name==='aircraft-tail')window.__planeMaterials.push({o,material:o.material});});
    for(let i=0;i<1200&&!window.__planeMaterials.some(({o})=>o.parent.visible&&o.material.opacity>.2&&Math.abs(o.parent.position.x)<10);i++)window.__advance(1);
    const draw=a.renderer.renderer.render.bind(a.renderer.renderer);window.__draw=()=>draw(a.renderer.scene,a.renderer.camera);window.__draw();
  });
  const shared=await page.locator('canvas').screenshot();
  const visible=await page.evaluate(()=>{
    const visible=window.__planeMaterials.some(({o})=>o.parent.visible&&o.material.opacity>0);
    for(const p of window.__planeMaterials){p.original=p.material.clone();p.original.fog=false;p.o.material=p.original;}window.__draw();return visible;
  });
  assert(visible,'comparison must contain a visible aircraft');
  const original=await page.locator('canvas').screenshot();
  writeFileSync(`${out}/${width}-aircraft-shared.png`,shared);writeFileSync(`${out}/${width}-aircraft-original.png`,original);
  assert(shared.equals(original),'aircraft colors/composition must be pixel-identical');
  await page.evaluate(()=>{for(const p of window.__planeMaterials){p.o.material=p.material;p.original.dispose();}});
  // Context loss/restoration cancels/restarts preparation; final disposal owns it.
  await page.evaluate(()=>window.__testApp.renderer.renderer.forceContextLoss());
  await page.waitForTimeout(100);
  await page.evaluate(()=>window.__testApp.renderer.renderer.forceContextRestore());
  await page.waitForTimeout(400);
  await page.evaluate(()=>{window.__testApp.retry();window.__advance(2);});
  assert.equal(await page.locator('.runtime-error-overlay').count(),0);
  const speech=await page.evaluate(()=>window.__speech);assert(speech.length>=2&&speech.every(s=>s.emblem));
  await page.evaluate(()=>window.__testApp.dispose());await page.waitForTimeout(150);assert.deepEqual(errors,[]);
  results.push({width,navalFallback:true,voice:true,pause:true,resizeAndSafeArea:true,aircraftPixelIdentical:true,contextRestore:true,dispose:true,errors});
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await page.close();
}}finally{await browser.close();}

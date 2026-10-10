// Test-side observation only. Capture before/after with the same browser, seed and scenes.
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import { startGameRecording } from './browser-recording.mjs';
import { installProjectileBaseline } from './projectile-baseline.mjs';
const phase=process.argv[2]??'after',out=`artifacts/p3b32/${phase}`;
mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const width of [350,390,1280]) {
  const height=width===1280?900:844,errors=[];
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:width===1280?1:2,isMobile:width!==1280,hasTouch:true});
  if(phase==='before')await installProjectileBaseline(page);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
  await page.addInitScript(()=>{const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>a instanceof Uint32Array&&a.length===1?(a[0]=17,a):native(a);});
  await page.goto((process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173')+'/?perf=1');
  await page.getByRole('button',{name:'Start game with audio'}).tap();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.addStyleTag({content:'.perf-hud{display:none}'});
  await page.waitForTimeout(1800);
  await page.evaluate(async()=>{
   const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=performance.now();
   window.__THREE=await import('/node_modules/.vite/deps/three.js');
   window.__advance=frames=>{for(let i=0;i<frames;i++){a.renderFrame(window.__clock+=1000/60);cancelAnimationFrame(a.frameId);}};
   window.__draw=()=>{const r=a.renderer;r.renderer.render(r.scene,r.camera);};
   window.__sizes=()=>{const T=window.__THREE,r=a.renderer,p=r.projectileRenderer,v=new T.Vector3(),m=new T.Matrix4();
    return [p.body,p.glow].map(mesh=>{const vertices=mesh.geometry.getAttribute('position');mesh.getMatrixAt(0,m);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
     for(let i=0;i<vertices.count;i++){v.fromBufferAttribute(vertices,i).applyMatrix4(m).project(r.camera);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
     return {width:(maxX-minX)*r.viewport.clientWidth/2,length:(maxY-minY)*r.viewport.clientHeight/2};});};
  });
  const fixture=async level=>{
   await selectDevFixture(page,level>=6?({6:'machineGun',7:'mg7',8:'mg8'})[level]:level===5?'evolve':'grenade');
   await page.locator('.tuning-panel').evaluate(p=>p.open=false);
   await page.evaluate(level=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);
    if(level===1){a.devReviewFixture=null;a.retry();cancelAnimationFrame(a.frameId);}
    const state=a.simulation.getState();state.progression.xp=0;a.simulation.restoreState(state);
    a.renderer.projectileRenderer.reset();a.previousFrameTimestampMs=null;window.__clock=performance.now();window.__advance(50);
   },level);
  };
  const row={width,height,measurements:[],errors};
  await fixture(1);
  row.geometry=await page.evaluate(()=>{const p=window.__testApp.renderer.projectileRenderer,b=p.bullet.geometry;b.computeBoundingBox();return {min:b.boundingBox.min,max:b.boundingBox.max,origin:p.rifleOrigin,camera:window.__testApp.renderer.camera.toJSON(),viewport:{width:window.__testApp.renderer.viewport.clientWidth,height:window.__testApp.renderer.viewport.clientHeight}};});
  for(const afterglow of [false,true])for(const z of [5,10,20,30,40,60,100]) {
   row.measurements.push(await page.evaluate(({z,afterglow})=>{const r=window.__testApp.renderer,p=r.projectileRenderer,shot={id:900,kind:'rifle',tier:1,x:0,z,hitRadiusBonus:0};p.reset();if(afterglow)p.presentLevelUp(0);p.update([shot],0,r.camera,r.viewport.clientHeight);p.update([shot],100,r.camera,r.viewport.clientHeight);window.__draw();return {z,afterglow,sizes:window.__sizes()};},{z,afterglow}));
  }
  row.coreSamples=await page.evaluate(()=>{
   const T=window.__THREE,r=window.__testApp.renderer,p=r.projectileRenderer,visible=r.scene.children.map(o=>[o,o.visible]),background=r.scene.background;
   for(const [o] of visible)o.visible=false;
   const shot={id:900,kind:'rifle',tier:1,x:0,z:20,hitRadiusBonus:0};p.reset();p.update([shot],0,r.camera,r.viewport.clientHeight);p.update([shot],100,r.camera,r.viewport.clientHeight);
   const matrix=new T.Matrix4();p.body.getMatrixAt(0,matrix);const point=new T.Vector3(0,0,p.body.geometry===p.bullet.geometry?0:-.35).applyMatrix4(matrix).project(r.camera);
   const gl=r.renderer.getContext(),pixel=new Uint8Array(4),read=()=>{r.renderer.render(r.scene,r.camera);gl.readPixels(Math.floor((point.x+1)*gl.drawingBufferWidth/2),Math.floor((point.y+1)*gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];};
   const colors={sand:'#d8c49b',sea:'#247e9c',plaster:'#f1efe6',shadow:'#2c4158',helmet:'#507455'},samples={};
   for(const [name,color] of Object.entries(colors)){r.scene.background=new T.Color(color);p.glow.visible=true;const both=read();p.glow.visible=false;const coreOnly=read();samples[name]={both,coreOnly};}
   r.scene.background=background;for(const [o,v] of visible)o.visible=v;return samples;
  });
  // Controlled depth/background inspection; these shots are presentation probes, not simulation edits.
  await page.evaluate(()=>{const r=window.__testApp.renderer,p=r.projectileRenderer;p.reset();window.__probes=[];for(const x of [-9,-4,0,4,9])for(const z of [10,20,30,40,60])window.__probes.push({id:1000+window.__probes.length,kind:'rifle',tier:1,x,z,hitRadiusBonus:0});p.update(window.__probes,0,r.camera,r.viewport.clientHeight);p.update(window.__probes,100,r.camera,r.viewport.clientHeight);window.__draw();});
  await page.screenshot({path:`${out}/depths-${width}.png`});
  if(phase==='experiments') {
   for(const [name,color,opacity] of [['navy','#24465a',1],['ink','#162f42',1],['red','#d84c4b',.6]]) {
    await page.evaluate(({color,opacity})=>{const p=window.__testApp.renderer.projectileRenderer;p.glowMaterial.color.set(color);p.glowMaterial.opacity=opacity;window.__draw();},{color,opacity});
    await page.screenshot({path:`${out}/outline-${name}-${width}.png`});
   }
   for(const [name,corePixels,lengthPixels] of [['small',1.5,5.5],['selected',2,7],['large',2.5,9]]) {
    await page.evaluate(async({corePixels,lengthPixels})=>{const source=await(await fetch('/src/rendering/projectiles/DefenseTracer.ts')).text();const path=source.match(/from\s+["']([^"']*ArtDirection[^"']*)/)[1];const {ART}=await import(path);Object.assign(ART.defenseTracer,{corePixels,lengthPixels});const r=window.__testApp.renderer;r.projectileRenderer.update(window.__probes,100,r.camera,r.viewport.clientHeight);window.__draw();},{corePixels,lengthPixels});
    await page.screenshot({path:`${out}/size-${name}-${width}.png`});
   }
   results.push(row);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await page.close();continue;
  }
  // Live movement montage includes each required level, normal fire and its stronger afterglow.
  const stop=await startGameRecording(page,width,height);
  for(const level of [1,3,5,6,7,8]) {
   await fixture(level);
   await page.evaluate(()=>{const a=window.__testApp;a.previousFrameTimestampMs=null;a.frameId=requestAnimationFrame(a.renderFrame);});
   await page.waitForTimeout(350);
   for(const glow of [false,true]) {
    await page.evaluate(glow=>{const a=window.__testApp;if(glow)a.renderer.projectileRenderer.presentLevelUp(a.presentationMs);},glow);
    await page.waitForTimeout(150);
    await page.screenshot({path:`${out}/lv${level}-${glow?'glow':'normal'}-${width}.png`});
    assert.equal(await page.evaluate(()=>window.__testApp.simulation.getState().progression.level),level,'Capture must remain at its named level');
    await page.waitForTimeout(950);
   }
   await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  }
  writeFileSync(`${out}/combat-${width}.webm`,await stop());
  assert.deepEqual(errors,[]);results.push(row);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await page.close();
 }
}finally{await browser.close();}

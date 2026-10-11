import assert from 'node:assert/strict';
import { createServer,preview } from 'vite';
import { mkdirSync,writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p3b6b4/matched-render';mkdirSync(out,{recursive:true});
const loader=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const qa=await loader.ssrLoadModule('/scripts/qa/navalBarrageRun.ts'),sim=qa.makeNavalRun(42,'lv10',true);let saved;
for(let i=0;i<70*60&&sim.getFrameState().squad.count;i++) {
  sim.step(1/60,{...qa.survivalDecision(sim,i,'competent'),throwGrenade:false},qa.pilotTuning);
  const s=sim.getFrameState();if(s.squad.count===3&&(s.artillery?.shells.length??0)>=3&&(!saved||s.enemies.length>saved.enemies.length))saved=sim.getState();
}
assert(saved);await loader.close();const off=structuredClone(saved);off.artillery.shells=[];off.navalBarrage.enabled=false;off.navalBarrage.nextAtSeconds=null;
writeFileSync(`${out}/real-combat-state.json`,JSON.stringify(saved));
const server=await preview({preview:{host:'127.0.0.1',port:5192,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
try{for(const width of [350,390])for(const mode of ['off','on']) {
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/topwar\/assets\/index-.*\.js$/,async route=>{const r=await route.fetch(),body=await r.text(),pattern=/new [\w$]+\([\w$]+,[\w$]+,[\w$]+,[\w$]+,[\w$]+\(window\.location\.search\),[\w$]+\(window\.location\.search\)(?:,[\w$]+)*\)/g;
    assert.equal([...body.matchAll(pattern)].length,1);await route.fulfill({response:r,body:body.replace(pattern,m=>`(window.__testApp=${m})`)});});
  await page.goto('http://127.0.0.1:5192/topwar/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(state=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.simulation.restoreState(state);a.simulation.step=()=>{};
    a.renderer.resetFeedback();a.presentationMs=state.elapsedSeconds*1000;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();
    window.__qa={measure:false,stamps:[],cpu:[]};const native=a.renderFrame;a.renderFrame=stamp=>{const start=performance.now();native(stamp);
      if(window.__qa.measure){window.__qa.stamps.push(stamp);window.__qa.cpu.push(performance.now()-start);}};a.frameId=requestAnimationFrame(a.renderFrame);
  },mode==='on'?saved:off);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>new Promise(resolve=>{let n=0;requestAnimationFrame(function warm(){if(++n<100)requestAnimationFrame(warm);else resolve();});}));
  for(let repeat=0;repeat<3;repeat++) {
    await page.evaluate(()=>{window.__qa.stamps=[];window.__qa.cpu=[];window.__qa.measure=true;});await page.waitForTimeout(5000);
    const result=await page.evaluate(()=>{const q=window.__qa,a=window.__testApp;q.measure=false;
      const stats=arr=>{const v=[...arr].sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1),over100:v.filter(x=>x>100).length,over200:v.filter(x=>x>200).length};};
      return {frameMs:stats(q.stamps.slice(1).map((v,i)=>v-q.stamps[i])),cpu:stats(q.cpu),stats:a.renderer.getDebugStats()};});
    rows.push({width,mode,repeat,policy:'QA-only fixed real crowd; simulation deliberately held to isolate shell/warning rendering, not a gameplay result.',enemies:saved.enemies.length,
      heavies:saved.enemies.filter(e=>e.archetype==='heavy').length,projectiles:saved.projectiles.length,shells:mode==='on'?saved.artillery.shells.length:0,...result});
    writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.at(-1)));
  }
  await page.screenshot({path:`${out}/${width}-${mode}.png`});assert.deepEqual(errors,[]);await page.close();
}}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

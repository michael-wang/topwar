import { exposeProductionApp } from './production-app-hook.mjs';
import assert from 'node:assert/strict';
import { createServer,preview } from 'vite';
import { mkdirSync,writeFileSync } from 'node:fs';
const out=process.argv[2]??'artifacts/p3b6b4/performance';mkdirSync(out,{recursive:true});
const loader=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:{ignored:['**/artifacts/**']}},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const qa=await loader.ssrLoadModule('/scripts/qa/navalBarrageRun.ts');
const states={off:qa.makeNavalRun(42,'lv10',false).getState(),on:qa.makeNavalRun(42,'lv10',true).getState()};
// Also capture a natural, shipping-policy handoff with surviving real enemies.
const natural=qa.makeNavalRun(1,'natural',true);for(let i=0;i<600*60&&natural.getFrameState().squad.count;i++) {
  natural.step(1/60,qa.survivalDecision(natural,i,'competent'),qa.pilotTuning);
  if(natural.getFrameState().postCapSurvival.startedAtSeconds!==null && natural.getFrameState().elapsedSeconds-natural.getFrameState().postCapSurvival.startedAtSeconds>2)break;
}
writeFileSync(`${out}/natural-production-state.json`,JSON.stringify(natural.getState()));await loader.close();
const server=await preview({preview:{host:'127.0.0.1',port:5191,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const width of [350,390])for(const mode of ['off','on'])for(const phase of ['fresh','warm']) {
  const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
  if(only&&only!==`${width}-${mode}-${phase}`)continue;
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await exposeProductionApp(page);
  const start=performance.now();await page.goto('http://127.0.0.1:5191/topwar/');await page.getByRole('button',{name:'開始遊戲'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');const startupMs=performance.now()-start;
  assert.equal(await page.locator('.dev-naval-barrage,.dev-fps,.dev-advanced').count(),0);
  if(phase==='warm')await page.waitForTimeout(3500);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(state=>{
    const a=window.__testApp;cancelAnimationFrame(a.frameId);a.simulation.restoreState(state);a.simulation.consumePresentationEvents();a.simulation.consumeGrenadeEvents();a.simulation.consumeArtilleryEvents();
    a.renderer.resetFeedback();a.presentationMs=state.elapsedSeconds*1000;a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();
    a.audio.restoreObservation(a.previousDefenseValue,state.enemies,state.projectiles);
    window.__bench={stamps:[],cpu:[],samples:[],shader:[],slowFrames:[],start:performance.now(),lastSample:-Infinity,peakEnemies:0,peakProjectiles:0,peakShells:0};
    const gl=a.renderer.renderer.getContext();for(const method of ['compileShader','linkProgram']){const native=gl[method].bind(gl);gl[method]=(...args)=>{const at=performance.now(),value=native(...args);window.__bench.shader.push({method,at:at-window.__bench.start,ms:performance.now()-at});return value;};}
    const step=a.simulation.step.bind(a.simulation);a.simulation.step=(dt,input,tuning)=>{
      const s=a.simulation.getFrameState(),tick=s.tick;
      if(tick%12===0){const current=s.player.selectedLane,danger=new Set(s.artillery?.shells.map(s=>s.targetLane));
        const nearest=s.enemies.reduce((a,e)=>!a||e.z<a.z?e:a,undefined),giant=s.enemies.find(e=>e.archetype==='giant');
        const preferred=s.grenade?.supply?.lane??(giant&&(!nearest||nearest.z>10)?giant:nearest)?.lane??current;
        const lane=[current-1,current,current+1].filter(l=>l>=0&&l<5&&!danger.has(l)).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b)[0]??current;
        if(lane!==current)a.simulation.stepLane(lane<current?-1:1);}
      step(dt,{...input,throwGrenade:false},tuning);
    };
    const native=a.renderFrame;a.renderFrame=stamp=>{const at=performance.now();native(stamp);const b=window.__bench,s=a.simulation.getFrameState();
      const cpu=performance.now()-at,previous=b.stamps.at(-1);
      if(cpu>100 || previous!==undefined&&stamp-previous>100)b.slowFrames.push({wall:at-b.start,seconds:s.elapsedSeconds,cpu,
        interval:previous===undefined?null:stamp-previous,enemies:s.enemies.length,shells:s.artillery?.shells.length??0,
        warnings:a.renderer.scene.getObjectByName('artillery-lane-danger')?.count??0});
      b.stamps.push(stamp);b.cpu.push(cpu);b.peakEnemies=Math.max(b.peakEnemies,s.enemies.length);
      b.peakProjectiles=Math.max(b.peakProjectiles,s.projectiles.length);b.peakShells=Math.max(b.peakShells,s.artillery?.shells.length??0);
      if(s.elapsedSeconds-b.lastSample>=5){b.lastSample=s.elapsedSeconds;b.samples.push({wall:performance.now()-b.start,seconds:s.elapsedSeconds,soldiers:s.squad.count,
        enemies:s.enemies.length,shells:s.artillery?.shells.length??0,...a.renderer.getDebugStats()});}
    };a.frameId=requestAnimationFrame(a.renderFrame);
  },states[mode]);
  const limit=process.argv.includes('--quick')?4:phase==='fresh'?10:90;
  await page.waitForFunction(limit=>{const a=window.__testApp,b=window.__bench;return a.simulation.getFrameState().elapsedSeconds>=limit-1e-8
    ||!a.simulation.getFrameState().squad.count||performance.now()-b.start>180000;},limit,{timeout:190000});
  const data=await page.evaluate(()=>{const a=window.__testApp,b=window.__bench;cancelAnimationFrame(a.frameId);
    const stats=arr=>{const v=[...arr].sort((a,b)=>a-b);return {mean:v.reduce((a,b)=>a+b,0)/v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1),frames:v.length,over100:v.filter(x=>x>100).length,over200:v.filter(x=>x>200).length};};
    return {frameMs:stats(b.stamps.slice(1).map((v,i)=>v-b.stamps[i])),submissionMs:stats(b.cpu),wallMs:performance.now()-b.start,
      seconds:a.simulation.getFrameState().elapsedSeconds,soldiers:a.simulation.getFrameState().squad.count,
      peakEnemies:b.peakEnemies,peakProjectiles:b.peakProjectiles,peakShells:b.peakShells,shader:b.shader,slowFrames:b.slowFrames,samples:b.samples,final:a.renderer.getDebugStats(),barrage:a.simulation.getState().navalBarrage};});
  const boundary=requests.length;await page.screenshot({path:`${out}/${width}-${mode}-${phase}.png`});
  assert.deepEqual(errors,[]);const result={width,mode,phase,cpuThrottle:4,policy:'Adjacent every 200ms; pending artillery lanes excluded; nearest enemy/Supply/Giant preference; no Grenades, invulnerability or render-quality changes.',startupMs,...data,errors,requests};
  results.push(result);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({...result,samples:undefined,requests:undefined,shader:data.shader.length,final:undefined}));await page.close();
}}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

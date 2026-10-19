// Production viewport evidence; all instrumentation stays in intercepted QA responses.
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {exposeProductionApp} from './production-app-hook.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p4.45c';mkdirSync(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5188,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],images=[];
try{
 for(const width of [350,390]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});await exposeProductionApp(page);
  await page.goto('http://127.0.0.1:5188/topwar/');await page.getByRole('button',{name:'開始遊戲',exact:true}).tap();
  await page.waitForFunction(()=>window.__testApp?.startup==='started');
  assert.equal(await page.locator('.dev-tracer-controls').count(),0);
  for(const lv of [1,6,9,12]){
   const result=await page.evaluate(lv=>{
    const a=window.__testApp;a.devReviewFixture='naval';a.retry();cancelAnimationFrame(a.frameId);
    const s=a.simulation.getState(),count=a.config.catharsis.progression.levelPlan[lv-1].squadStage;
    s.progression={level:lv,xp:0};s.machineGunReleaseAtSeconds=lv<6?null:0;s.squad={count,rifleCounts:[count],rocketCount:0,rifleRemainder:0};
    s.player={x:2.8,z:0,selectedLane:4};s.enemies=[];s.projectiles=[];
    s.weapons.rifleMemberCooldowns=Array(count).fill(0);s.weapons.rifleCooldownRemainingSeconds=0;
    if(s.defenseWaves)s.defenseWaves.nextAtSeconds=s.elapsedSeconds+100;
    // A short empty outer corridor exposes every tracer endpoint; ships remain the real naval scene.
    a.simulation.restoreState(s);let stamp=a.previousFrameTimestampMs??performance.now();
    const gpu=a.renderer.renderer,draw=gpu.render;gpu.render=()=>{};let maximum=0,endpoint=0;
    try{for(let i=0;i<96;i++){stamp+=1000/60;a.renderFrame(stamp);cancelAnimationFrame(a.frameId);
      for(const p of a.simulation.getFrameState().projectiles){maximum=Math.max(maximum,p.z);endpoint=Math.max(endpoint,p.z+p.remainingRange);}}}
    finally{gpu.render=draw;}a.renderFrame(stamp);cancelAnimationFrame(a.frameId);
    return{lv,count,maximum,endpoint,range:a.runtimeTuning.bulletRange,stats:a.renderer.getDebugStats()};
   },lv);
   assert(result.maximum<=45.50001);assert(result.endpoint<=45.50001);assert.equal(result.range,44.25);
   results.push({width,...result});const file=`shoreline-${width}-lv${lv}.png`;await page.screenshot({path:`${out}/${file}`});images.push({file,width,lv});
  }
  await page.close();
 }
 const sheet=await browser.newPage({viewport:{width:1440,height:1900}});
 await sheet.setContent(`<style>body{margin:20px;background:#132630;color:#fff;font:20px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}img{width:100%}h1{font-size:28px}p{margin:6px}</style><h1>P4.45c — 正式 Orange Tracer B / 海岸射程 44.25</h1><p>實際 production build；空曠外側射道診斷，船隻保留。上排 350×844、下排 390×844。</p><main>${images.map(({file,width,lv})=>`<div><p>Lv${lv} · ${width}×844</p><img src="data:image/png;base64,${readFileSync(`${out}/${file}`).toString('base64')}"></div>`).join('')}</main>`);
 await sheet.screenshot({path:`${out}/shoreline-comparison.png`,fullPage:true});
 writeFileSync(`${out}/shoreline-results.json`,JSON.stringify(results,null,2));
 console.log(`Shoreline production evidence passed: ${results.length} mobile scenes.`);
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

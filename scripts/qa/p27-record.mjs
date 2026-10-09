// Record the composited browser (including HUD) using CDP frames + MediaRecorder.
// No production capture/debug endpoint or external video encoder is required.
import {mkdirSync,writeFileSync} from 'node:fs';
import {selectDevFixture} from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p27/recording';mkdirSync(out,{recursive:true});
const role=process.argv[3],width=Number(process.argv[4]??390);
if(role&&!['crate3','crate8'].includes(role))throw Error('Expected crate3 or crate8');
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
 await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('app.start();','window.__testApp=app;app.start();')});});
 await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173/');await page.getByRole('button',{name:'Start game with audio'}).tap();
 await page.waitForFunction(()=>window.__testApp.startup==='started');
 await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
 if(role)await selectDevFixture(page,role);
 await page.evaluate(async({role,width})=>{
  const a=window.__testApp;
  if(!role){const {emptyGrenade,placeGrenadeSupply}=await import('/src/simulation/grenade.ts'),s=a.simulation.getState();
  s.progression={level:3,xp:0};s.enemies=[];s.defenseWaves.nextAtSeconds=1000;s.projectiles=[];
  s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,supply:placeGrenadeSupply(s,s.catharsis.balance.grenade)};
  s.player.selectedLane=s.grenade.supply.lane;s.player.x=s.grenade.supply.x;
  s.weapons.rifleCooldownRemainingSeconds=1;s.weapons.rifleMemberCooldowns=[1];a.simulation.restoreState(s);a.fixedStepLoop.reset();}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=844;
  const stream=canvas.captureStream(0),audio=a.audio.context.createMediaStreamDestination();a.audio.master.connect(audio);
  stream.addTrack(audio.stream.getAudioTracks()[0]);
  window.__capture={canvas,ctx:canvas.getContext('2d'),track:stream.getVideoTracks()[0],chunks:[],recorder:new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:1200000})};
  window.__capture.recorder.ondataavailable=e=>window.__capture.chunks.push(e.data);window.__capture.recorder.start();
  window.__perf=[];const frame=a.renderFrame.bind(a);a.renderFrame=t=>{const start=performance.now();frame(t);window.__perf.push({cpu:performance.now()-start,t,transfer:!!a.supplyTransfer.transfer});};
 },{role,width});
 const cdp=await page.context().newCDPSession(page);let pending=Promise.resolve(),frames=0;
 const onFrame=event=>{
  pending=pending.then(async()=>{await page.evaluate(async data=>{const c=window.__capture,img=new Image();img.src='data:image/jpeg;base64,'+data;await img.decode();c.ctx.drawImage(img,0,0,c.canvas.width,c.canvas.height);c.track.requestFrame();},event.data);frames++;await cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});});
 };
 cdp.on('Page.screencastFrame',onFrame);
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:width,maxHeight:844,everyNthFrame:1});
 await page.evaluate(()=>window.__testApp.renderFrame(performance.now()));
 await page.waitForFunction(expected=>window.__testApp.simulation.getState().grenade.inventory===expected,role==='crate8'?2:3);
 await page.waitForFunction(()=>!window.__testApp.supplyTransfer.transfer);
 cdp.off('Page.screencastFrame',onFrame);await cdp.send('Page.stopScreencast');await pending;
 const result=await page.evaluate(async()=>{
  const c=window.__capture;await new Promise(resolve=>{c.recorder.onstop=resolve;c.recorder.stop();});
  const b=new Blob(c.chunks,{type:'video/webm'}),bytes=new Uint8Array(await b.arrayBuffer());
  const samples=window.__perf.slice(10),gaps=samples.slice(1).map((s,i)=>s.t-samples[i].t).sort((a,b)=>a-b);
  const summarize=rows=>{const v=rows.map(s=>s.cpu).sort((a,b)=>a-b);return{frames:v.length,meanMs:v.reduce((a,b)=>a+b,0)/v.length,p95Ms:v[Math.floor(v.length*.95)]};};
  return{bytes:Array.from(bytes),metrics:{idle:summarize(samples.filter(s=>!s.transfer)),transfer:summarize(samples.filter(s=>s.transfer)),frameGapP95Ms:gaps[Math.floor(gaps.length*.95)],renderer:window.__testApp.renderer.getDebugStats?.()}};
 });
 const name=role?`${role}-${width}`:`rifle-supply-${width}`;
 writeFileSync(`${out}/${name}.webm`,Buffer.from(result.bytes));writeFileSync(`${out}/${role?name+'-':''}performance.json`,JSON.stringify({...result.metrics,capturedFrames:frames},null,2));console.log(result.metrics,frames);
}finally{await browser.close();}

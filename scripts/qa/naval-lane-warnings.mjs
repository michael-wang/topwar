import { exposeProductionApp } from './production-app-hook.mjs';
// Production browser QA. App access and recording instrumentation are injected
// only into the browser response; none is bundled into the game.
import assert from 'node:assert/strict';
import { createServer,preview } from 'vite';
import { mkdirSync,writeFileSync } from 'node:fs';
import { startGameRecording,inspectRecordingFrames } from './browser-recording.mjs';
const out=process.argv[2]??'artifacts/p3b6b5/mobile';mkdirSync(out,{recursive:true});
const loader=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const qa=await loader.ssrLoadModule('/scripts/qa/navalBarrageRun.ts');
// Seed 17's first real salvo has two lanes; seed 42 validly begins with seven singles.
const states=Object.fromEntries([8,9,10].map(level=>[level,qa.makeNavalRun(17,`lv${level}`,true).getState()]));await loader.close();
const server=await preview({preview:{host:'127.0.0.1',port:5194,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
const installPilot=()=>{
  const a=window.__testApp,step=a.simulation.step.bind(a.simulation);
  a.simulation.step=(dt,input,tuning)=>{const s=a.simulation.getFrameState();
    if(s.tick%12===0){const current=s.player.selectedLane,danger=new Set(s.artillery?.shells.map(s=>s.targetLane)),
      nearest=s.enemies.reduce((a,e)=>!a||e.z<a.z?e:a,undefined),preferred=nearest?.lane??current,
      lane=[current-1,current,current+1].filter(l=>l>=0&&l<5&&!danger.has(l)).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b)[0]??current;
      if(lane!==current)a.simulation.stepLane(lane<current?-1:1);}
    step(dt,input,tuning);
  };
};
try{for(const width of [350,390])for(const level of [8,9,10]) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await exposeProductionApp(page);
  await page.goto('http://127.0.0.1:5194/topwar/');await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
  await page.evaluate(state=>{
    const a=window.__testApp;cancelAnimationFrame(a.frameId);a.simulation.restoreState(state);a.restored=true;a.fieldObserver?.reset();a.progressionObserver.reset();a.progressionObserver.observe(state.progression.level);
    a.renderer.resetFeedback();
    a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();a.presentationMs=0;
    window.__checks=[];window.__stamps=[];
    const native=a.renderFrame;a.renderFrame=stamp=>{native(stamp);const s=a.simulation.getFrameState(),scene=a.renderer.scene,
      mesh=scene.getObjectByName('artillery-lane-danger'),targets=[...new Set(s.artillery?.shells.map(e=>e.targetLane)??[])].sort((a,b)=>a-b);
      if(!mesh)return;
      const m=mesh.matrixWorld.clone(),centers=[];
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);const p=mesh.position.clone().setFromMatrixPosition(m).project(a.renderer.camera);
        const tip=mesh.position.clone().set(0,-.42,0).applyMatrix4(m).project(a.renderer.camera),locked=s.artillery.shells.find(shell=>shell.targetLane===targets[i]);
        const target=mesh.position.clone().set(-locked.target.x,locked.target.y,locked.target.z).project(a.renderer.camera);
        centers.push({x:(p.x*.5+.5)*innerWidth,y:(.5-p.y*.5)*innerHeight,tipX:(tip.x*.5+.5)*innerWidth,tipY:(.5-tip.y*.5)*innerHeight,targetX:(target.x*.5+.5)*innerWidth,targetY:(.5-target.y*.5)*innerHeight});}
      window.__checks.push({at:s.elapsedSeconds,targets,count:mesh.count,visible:mesh.visible,opacity:mesh.material.opacity,fills:Array.from(mesh.geometry.getAttribute('warningFillProgress').array.slice(0,mesh.count)),
        selected:s.player.selectedLane,centers,ground:scene.children.filter(e=>e.name.startsWith('enemy-shell-warning-')&&e.visible).length,
        global:scene.getObjectByName('artillery-lock-on').visible,shells:(s.artillery?.shells??[]).map(e=>({id:e.id,lane:e.targetLane,launched:e.launchedAtSeconds,impact:e.impactAtSeconds}))});
      window.__stamps.push(stamp);
    };a.frameId=requestAnimationFrame(a.renderFrame);
  },states[level]);
  await page.evaluate(installPilot);
  // Real adjacent steering and damage. No fake shots, invulnerability or time scaling.
  await page.waitForFunction(()=>window.__testApp.simulation.getFrameState().artillery?.shells.length===2,{},{timeout:20000}).catch(async error=>{
    console.log(JSON.stringify(await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();return {startup:a.startup,running:a.running,paused:a.paused,tick:s.tick,soldiers:s.squad.count,barrage:s.navalBarrage};})));console.log(errors);throw error;
  });
  await page.getByRole('button',{name:'Pause game',exact:true}).tap();
  const before=await page.evaluate(()=>{const a=window.__testApp;return {state:a.simulation.getState(),warning:window.__checks.at(-1)};});
  assert.equal(before.warning.count,2);assert(before.warning.centers.every(p=>Math.abs(p.tipX-p.targetX)<.1&&Math.abs(p.tipY-p.targetY)<.1));
  await page.screenshot({path:`${out}/${width}-lv${level}-two-lanes.png`});
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),before.state);
  await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  await page.waitForFunction(()=>window.__testApp.renderer.artilleryRenderer?.getDebugStats().warnings===2);
  const restored=await page.evaluate(()=>{const a=window.__testApp,scene=a.renderer.scene;return {state:a.simulation.getState(),paused:a.paused,
    warnings:a.renderer.artilleryRenderer.getDebugStats().warnings,flashes:scene.children.filter(e=>e.name.startsWith('enemy-cannon-flash-')&&e.visible).length};});
  assert.deepEqual(restored.state,before.state);assert(restored.paused);assert.equal(restored.flashes,0);
  await page.screenshot({path:`${out}/${width}-lv${level}-restored.png`});
  await page.getByRole('button',{name:'Resume game',exact:true}).tap();
  const hidden=await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));const a=window.__testApp;return {state:a.simulation.getState(),paused:a.paused};});
  assert(hidden.paused);await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),hidden.state);
  assert(await page.evaluate(()=>!!localStorage.getItem('topwar:session:v1:release')));
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
    document.dispatchEvent(new Event('visibilitychange'));});assert(await page.evaluate(()=>window.__testApp.paused));
  // Compare fixed world X before/after an authoritative adjacent steering step.
  const stable=await page.evaluate(()=>{const a=window.__testApp,mesh=a.renderer.scene.getObjectByName('artillery-lane-danger'),m=mesh.matrixWorld.clone(),xs=[];
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);xs.push(m.elements[12]);}
    a.simulation.stepLane(a.simulation.getFrameState().player.selectedLane===4?-1:1);a.renderFrame(0);cancelAnimationFrame(a.frameId);
    const after=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);after.push(m.elements[12]);}return {xs,after};});assert.deepEqual(stable.xs,stable.after);
  // Independent cancellation removes only the corresponding authoritative lane.
  const cancelled=await page.evaluate(()=>{const a=window.__testApp,id=a.simulation.getState().artillery.shells[0].id;a.simulation.cancelArtillery(id);a.renderFrame(0);cancelAnimationFrame(a.frameId);return a.renderer.artilleryRenderer.getDebugStats().warnings;});assert.equal(cancelled,1);
  if(level===10){
    await page.evaluate(state=>{const a=window.__testApp;a.simulation.restoreState(state);a.renderer.resetFeedback();a.progressionObserver.reset();a.progressionObserver.observe(state.progression.level);
      a.previousFrameTimestampMs=null;a.fixedStepLoop.reset();a.presentationMs=0;a.renderFrame(0);cancelAnimationFrame(a.frameId);
      window.__lifetime=[];const native=a.renderFrame;a.renderFrame=stamp=>{native(stamp);const s=a.simulation.getFrameState(),scene=a.renderer.scene,mesh=scene.getObjectByName('artillery-lane-danger');
        window.__lifetime.push({at:s.elapsedSeconds,ids:(s.artillery?.shells??[]).map(e=>e.id),lanes:(s.artillery?.shells??[]).map(e=>e.targetLane),
          count:mesh.count,visible:mesh.visible,opacity:mesh.material.opacity,fills:Array.from(mesh.geometry.getAttribute('warningFillProgress').array.slice(0,mesh.count)),ground:scene.children.filter(e=>e.name.startsWith('enemy-shell-warning-')&&e.visible).length,
          x:Array.from({length:mesh.count},(_,i)=>{const m=mesh.matrixWorld.clone();mesh.getMatrixAt(i,m);return m.elements[12];})});};
      a.frameId=requestAnimationFrame(a.renderFrame);
    },states[level]);
    await page.evaluate(installPilot);
    await page.getByRole('button',{name:'Resume game',exact:true}).tap();const stop=await startGameRecording(page,width);
    await page.waitForFunction(()=>window.__testApp.simulation.getFrameState().artillery?.shells.length===2,{},{timeout:20000});
    const ids=await page.evaluate(()=>window.__testApp.simulation.getState().artillery.shells.map(s=>s.id));
    await page.getByRole('button',{name:'Move left',exact:true}).tap();
    await page.waitForFunction(ids=>ids.every(id=>!window.__testApp.simulation.getFrameState().artillery.shells.some(s=>s.id===id)),ids,{timeout:15000});
    const bytes=await stop();writeFileSync(`${out}/${width}-warning-lifetime.webm`,bytes);
    await inspectRecordingFrames(browser,bytes,width,`${out}/${width}-warning-lifetime`,[1,2.8,4.2]);
    const lifetime=await page.evaluate(()=>window.__lifetime);for(const frame of lifetime){assert.equal(frame.count,new Set(frame.lanes).size);assert.equal(frame.ground,0);if(frame.count){assert(frame.visible);assert.equal(frame.opacity,1);assert(frame.fills.every(a=>a>=0&&a<=1));}}
    writeFileSync(`${out}/${width}-warning-lifetime.json`,JSON.stringify(lifetime,null,2));
    // Independent authoritative launches are a QA-only future-component scenario,
    // not extra Stage 1 salvos. Exercise materially different lane deadlines.
    const independent=await page.evaluate(state=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);a.setPaused(true);a.pauseOverlay.setVisible(false);
      a.simulation.restoreState(state);a.simulation.commandEncounter('barrageOff');
      const source={id:'qa-deadlines',type:'destroyer',position:{x:0,y:2.43,z:50.8}};
      a.simulation.launchArtillery({source,targetLane:0});
      const c=a.config,tuning={...c.player,forwardSpeed:0,trackHalfWidth:c.track.halfWidth,
        defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,
        rifle:c.weapon.rifle};
      for(let i=0;i<30;i++)a.simulation.step(1/60,{targetX:0},tuning);
      a.simulation.launchArtillery({source,targetLane:4});
      const sampleAt=a.simulation.getFrameState().artillery.shells[0].impactAtSeconds-.04;
      while(a.simulation.getFrameState().elapsedSeconds<sampleAt-1/60)
        a.simulation.step(1/60,{targetX:0},tuning);
      a.simulation.consumeArtilleryEvents();a.simulation.consumeGrenadeEvents();a.simulation.consumePresentationEvents();
      const saved=a.simulation.getState();a.simulation.restoreState(JSON.parse(JSON.stringify(saved)));
      const seconds=saved.elapsedSeconds;a.renderer.resetFeedback();
      a.renderFrame(0);cancelAnimationFrame(a.frameId);
      const mesh=a.renderer.scene.getObjectByName('artillery-lane-danger');
      return {seconds,shells:saved.artillery.shells,color:mesh.material.color.getHexString(),
        fills:Array.from(mesh.geometry.getAttribute('warningFillProgress').array.slice(0,2))};
    },states[level]);assert(independent.fills[0]>independent.fills[1]);assert(independent.fills[0]<1);
    await page.screenshot({path:`${out}/${width}-independent-deadlines.png`});
    writeFileSync(`${out}/${width}-independent-deadlines.json`,JSON.stringify(independent,null,2));
  }
  assert.deepEqual(errors,[]);rows.push({width,level,targets:before.warning.targets,screenCenters:before.warning.centers,restoreIdentical:true,
    restoredPaused:true,restoredFlashCount:restored.flashes,hiddenFrozen:true,visibleStillPaused:true,laneAnchorsStable:stable,cancelledWarnings:cancelled});
  writeFileSync(`${out}/results.json`,JSON.stringify(rows,null,2));await page.close();
}}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}

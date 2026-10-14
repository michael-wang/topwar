// P4.3 production visual/lifecycle diagnostics; app references are test-response-only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createServer,preview} from 'vite';
import {exposeProductionApp} from './production-app-hook.mjs';
const out=process.argv[2]??'artifacts/p4.3-highlights';mkdirSync(out,{recursive:true});
const loader=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const {GameConfigSchema}=await loader.ssrLoadModule('/src/config/configSchema.ts');
const {LevelDefinitionSchema}=await loader.ssrLoadModule('/src/level/LevelDefinition.ts');
const {createDevReviewFixture}=await loader.ssrLoadModule('/src/app/DevReviewFixtures.ts');
const {attackLanePositions}=await loader.ssrLoadModule('/src/simulation/enemies/laneComposition.ts');
const c=GameConfigSchema.parse(JSON.parse(readFileSync('public/game-data/game.json','utf8'))),level=LevelDefinitionSchema.parse(JSON.parse(readFileSync('public/game-data/levels/level-001.json','utf8')));
const lanePositions=attackLanePositions(c.catharsis.laneCount,c.track.halfWidth,c.catharsis.edgeInset);
const roles=['survival8-ahead','barrage8-on','boss-phase1','boss-phase2','boss-phase3'];
const states=Object.fromEntries(roles.map(role=>[role,createDevReviewFixture({seed:17,level,startSquad:1,startRocketCount:0,tiers:c.tiers,catharsis:{balance:c.catharsis,trackHalfWidth:c.track.halfWidth}},c.weapon.rifle.fireRate,role).getState()]));await loader.close();
const server=await preview({preview:{host:'127.0.0.1',port:5196,strictPort:true}});
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [350,390]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await exposeProductionApp(page);await page.goto('http://127.0.0.1:5196/topwar/');
  await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp?.startup==='started');
  await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
  const draw=async()=>page.evaluate(()=>{const a=window.__testApp;a.renderFrame(0);cancelAnimationFrame(a.frameId);const m=a.renderer.scene.getObjectByName('battlefield-lane-highlights'),u=m.material.uniforms,s=a.simulation.getState();return{state:s,playerX:u.playerX.value,count:u.dangerCount.value,centers:Array.from(u.dangerCenters.value).slice(0,u.dangerCount.value),visible:m.visible,playerActive:u.playerActive.value,camera:a.renderer.camera.projectionMatrix.elements};});
  const shot=async label=>{await page.waitForTimeout(250);await page.screenshot({path:`${out}/${width}-${label}.png`});};
  for(const [role,label]of [[null,'lv1'],['survival8-ahead','lv8'],['barrage8-on','destroyer'],['boss-phase1','boss-phase1'],['boss-phase2','tank'],['boss-phase3','boss-phase3']]){
    await page.evaluate(({state,role})=>{
      const a=window.__testApp;a.devReviewFixture=null;a.retry();if(state)a.simulation.restoreState(state);
      const s=a.simulation.getFrameState();a.progressionObserver.reset();a.progressionObserver.observe(s.progression.level);a.xpHud.reset();a.battleInfo.reset();a.fieldObserver.reset();
      const c=a.config,t=a.runtimeTuning;window.__highlightTuning={...c.player,moveSpeed:t.moveSpeed,forwardSpeed:t.forwardSpeed,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:{...c.weapon.rifle,fireRate:t.fireRate,projectileSpeed:t.bulletSpeed,range:t.bulletRange},rocket:c.weapon.rocket};
      const minimumTicks=role==='survival8-ahead'?390:30; // Include the next naturally admitted Lv8 wave.
      let tick=0;while(tick<minimumTicks||((role==='barrage8-on'||role?.startsWith('boss-phase'))&&!a.simulation.getFrameState().artillery?.shells.length&&tick<900)){a.simulation.step(1/60,{targetX:0},window.__highlightTuning);tick++;}
      a.presentationMs=a.simulation.getFrameState().elapsedSeconds*1000;a.setPaused(true);a.pauseOverlay.setVisible(false);
    },{state:states[role]??null,role});
    const r=await draw();assert.equal(r.playerX,-r.state.player.x);assert(r.visible);assert.equal(r.count,new Set(r.state.artillery?.shells.map(s=>s.targetLane)??[]).size);
    if(label==='destroyer')assert.equal(r.count,2);
    if(label==='lv8'){assert.equal(r.state.progression.level,8);assert(r.state.enemies.length>=40);}
    if(role?.startsWith('boss-phase'))assert.equal(r.count,Number(role.at(-1)));
    await shot(label);
    const cost=await page.evaluate(()=>{const r=window.__testApp.renderer,m=r.scene.getObjectByName('battlefield-lane-highlights');r.renderer.render(r.scene,r.camera);const withOverlay=r.renderer.info.render.calls;m.visible=false;r.renderer.render(r.scene,r.camera);const withoutOverlay=r.renderer.info.render.calls;m.visible=true;return withOverlay-withoutOverlay;});
    assert.equal(cost,1);results.push({width,label,count:r.count,extraDrawCalls:cost});
    const frozen=await draw();assert.deepEqual(frozen.state,r.state);assert.deepEqual(frozen.centers,r.centers);
    if(label==='lv1'){
      for(const lane of [0,1,2,3,4]){
        await page.evaluate(lane=>{const a=window.__testApp;
          while(a.simulation.getFrameState().player.selectedLane!==lane)a.simulation.stepLane(lane<a.simulation.getFrameState().player.selectedLane?-1:1);
          for(let i=0;i<60;i++)a.simulation.step(1/60,{targetX:0},window.__highlightTuning);
          a.presentationMs=a.simulation.getFrameState().elapsedSeconds*1000;
        },lane);
        const selected=await draw();assert.equal(selected.state.player.selectedLane,lane);assert.equal(selected.state.squad.count,1);
        assert.equal(selected.playerX,-selected.state.player.x);assert.equal(selected.count,0);
        assert.equal(selected.state.player.x,lanePositions[lane]);await shot(`lv1-lane${lane}`);
      }
    }
    if(label==='destroyer'){
      const lane=r.state.artillery.shells[0].targetLane;
      await page.evaluate(lane=>{const a=window.__testApp;for(const s of a.simulation.getState().artillery.shells)if(s.targetLane===lane)a.simulation.cancelArtillery(s.id);},lane);
      assert.equal((await draw()).count,1);await shot('destroyer-one-lane');
    }
    if(label==='lv8'){
      await page.evaluate(()=>{const a=window.__testApp;a.simulation.stepLane(1);for(let i=0;i<3;i++)a.simulation.step(1/60,{targetX:0},window.__highlightTuning);});
      const moving=await draw();assert.equal(moving.playerX,-moving.state.player.x);assert(moving.state.player.x>0&&moving.state.player.x<1.4);await shot('lane-transition');
    }
    if(label==='tank'){
      await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getFrameState(),source=s.artillery.shells[0].source;a.simulation.launchArtillery({source,targetLane:2});a.simulation.launchArtillery({source,targetLane:2});a.simulation.launchArtillery({source,targetLane:0});});
      const overlap=await draw();assert(overlap.count>=2);assert(overlap.centers.includes(0));await shot('overlap-multiple');
      const ids=overlap.state.artillery.shells.filter(s=>s.targetLane===2).map(s=>s.id);assert(ids.length>=2);
      await page.evaluate(id=>window.__testApp.simulation.cancelArtillery(id),ids[0]);assert((await draw()).centers.includes(0));
      await page.evaluate(ids=>{for(const id of ids)window.__testApp.simulation.cancelArtillery(id);},ids.slice(1));assert(!(await draw()).centers.includes(0));
      const still=await draw();assert(still.count>0);await shot('center-cancelled');
      await page.evaluate(()=>window.__testApp.saveCheckpoint('pause'));const saved=(await draw()).state;
      await page.reload();await page.getByRole('button',{name:'繼續上次遊戲',exact:true}).tap();await page.waitForFunction(()=>window.__testApp?.startup==='started');
      await page.evaluate(()=>{const a=window.__testApp;cancelAnimationFrame(a.frameId);a.pauseOverlay.setVisible(false);});
      const restored=await draw();assert.deepEqual(restored.state,saved);assert.deepEqual(restored.centers,still.centers);assert.deepEqual(restored.camera,still.camera);await shot('restored');
      await page.evaluate(()=>{const a=window.__testApp;for(const s of a.simulation.getState().artillery.shells)a.simulation.cancelArtillery(s.id);});assert.equal((await draw()).count,0);await shot('all-cancelled');
      await page.evaluate(()=>window.__testApp.retry());const retry=await draw();assert.equal(retry.count,0);assert.equal(retry.state.progression.level,1);
      await page.evaluate(()=>{const a=window.__testApp;a.simulation.launchArtillery({source:{id:'qa-resolve',type:'destroyer',position:{x:0,y:2.43,z:50.8}},targetLane:2});window.__resolvedShell=a.simulation.getState().artillery.shells.at(-1).id;});assert.equal((await draw()).count,1);
      await page.evaluate(()=>{const a=window.__testApp,c=a.config,t=a.runtimeTuning;
        const tuning={...c.player,moveSpeed:t.moveSpeed,forwardSpeed:t.forwardSpeed,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:{...c.weapon.rifle,fireRate:t.fireRate,projectileSpeed:t.bulletSpeed,range:t.bulletRange},rocket:c.weapon.rocket};
        for(let n=0;n<600&&a.simulation.getFrameState().artillery.shells.some(s=>s.id===window.__resolvedShell);n++)a.simulation.step(1/60,{targetX:0},tuning);
      });const dead=await draw();assert.equal(dead.state.squad.count,0);assert.equal(dead.count,0);assert.equal(dead.visible,false);await shot('game-over');
    }
  }
  await page.locator('.tuning-panel > summary').tap();await page.locator('[data-role="victory"]').tap();
  await page.evaluate(()=>window.__testApp.setPaused(true));assert.equal((await draw()).visible,false);
  assert.deepEqual(errors,[]);await page.close();
}console.log('Both sizes: all five Lv1 lanes/Lv8, physical-X transition, Destroyer one/two lanes, Boss one/two/three lanes, overlap, same-lane lifetime, multi-lane cancellation, Pause/Continue and Retry passed.');}
finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

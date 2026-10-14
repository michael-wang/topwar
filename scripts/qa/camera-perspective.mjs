// Default-camera regression against the exact accepted P4.2 B implementation in Git.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer, preview } from 'vite';
import ts from 'typescript';
import { exposeProductionApp } from './production-app-hook.mjs';
const out = process.argv[2] ?? 'artifacts/p4.2b-camera'; mkdirSync(out, { recursive: true });
const baseline = '3a814f990d6bdf4345fddcc76860fc002bcb677d';
const historical = path => ts.transpileModule(execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }),
  { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
const reference = `const ART={coastalDefense:{camera:{verticalFov:48,referenceAspect:9/16}}};\n`
  + historical('src/rendering/renderSize.ts') + historical('src/rendering/DevCameraPerspective.ts')
  + `\napplyDevCameraPerspective(camera,'B');`;
const dev = await createServer({ server: { host: '127.0.0.1', port: 5175, strictPort: true } }); await dev.listen();
const production = await preview({ preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
const { GameConfigSchema } = await dev.ssrLoadModule('/src/config/configSchema.ts');
const { LevelDefinitionSchema } = await dev.ssrLoadModule('/src/level/LevelDefinition.ts');
const { createDevReviewFixture } = await dev.ssrLoadModule('/src/app/DevReviewFixtures.ts');
const { default: data } = await dev.ssrLoadModule('/public/game-data/game.json');
const { default: levelData } = await dev.ssrLoadModule('/public/game-data/levels/level-001.json');
const c = GameConfigSchema.parse(data), level = LevelDefinitionSchema.parse(levelData);
const roles = [['survival8-ahead',30,'lv8'],['boss-intro',75,'boss-entrance'],['boss-phase2',120,'boss-combat'],['barrage8-on',0,'artillery']];
const states = Object.fromEntries(roles.map(([role]) => [role, createDevReviewFixture({ seed:17, level, startSquad:1, startRocketCount:0,
  tiers:c.tiers, catharsis:{balance:c.catharsis,trackHalfWidth:c.track.halfWidth} },c.weapon.rifle.fireRate,role).getState()]));
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({headless:true, executablePath:process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
  for(const build of ['dev','production']) for(const width of [350,390]) {
    const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(build==='production') await exposeProductionApp(page);
    else await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
    await page.goto(build==='dev'?'http://127.0.0.1:5175/':'http://127.0.0.1:5196/topwar/');
    await page.getByRole('button',{name:'Start game with audio'}).tap();
    await page.waitForFunction(()=>window.__testApp?.startup==='started');
    await page.evaluate(()=>cancelAnimationFrame(window.__testApp.frameId));
    await page.locator('.tuning-panel > summary').tap();
    assert.deepEqual(await page.locator('.dev-review-controls [data-role]').allTextContents(),['🚢 驅逐艦進場','🚨 BOSS 進場','🏆 勝利結算','✈️ 空中支援']);
    assert.equal(await page.locator('.dev-camera-switch').count(),0);
    await page.waitForTimeout(250); await page.screenshot({path:`${out}/${build}-${width}-menu.png`});
    // Every approved quick-test, including Victory/Air Support, keeps the same camera.
    for(const role of ['naval','boss-intro','victory','air-support']) {
      if(!await page.locator('.tuning-panel').evaluate(e=>e.open)) await page.locator('.tuning-panel > summary').tap();
      await page.locator(`[data-role="${role}"]`).tap();
      assert(await page.evaluate(reference=>{const a=window.__testApp,c=a.renderer.camera,expected=c.clone();new Function('camera',reference)(expected);return JSON.stringify(c.projectionMatrix.elements)===JSON.stringify(expected.projectionMatrix.elements)&&c.position.distanceTo(expected.position)<1e-12;},reference));
    }
    for(const [role,ticks,label] of roles) {
      await page.evaluate(({state,ticks,role})=>{
        const a=window.__testApp;a.devReviewFixture=null;a.retry();a.simulation.restoreState(state);a.progressionObserver.reset();a.progressionObserver.observe(state.progression.level);a.xpHud.reset();a.battleInfo.reset();
        const c=a.config,t=a.runtimeTuning,tuning={...c.player,moveSpeed:t.moveSpeed,forwardSpeed:t.forwardSpeed,trackHalfWidth:c.track.halfWidth,defenseLineOffset:c.track.defenseLineOffset,normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,rifle:{...c.weapon.rifle,fireRate:t.fireRate,projectileSpeed:t.bulletSpeed,range:t.bulletRange},rocket:c.weapon.rocket};
        let tick=0;while(tick<ticks||(role==='barrage8-on'&&!a.simulation.getFrameState().artillery?.shells.length&&tick<900)){a.simulation.step(1/60,{targetX:0},tuning);tick++;}
        a.presentationMs=a.simulation.getFrameState().elapsedSeconds*1000;a.fieldObserver.reset();a.setPaused(true);a.pauseOverlay.setVisible(false);a.renderFrame(0);cancelAnimationFrame(a.frameId);
      },{state:states[role],ticks,role});
      const before=await page.evaluate(()=>window.__testApp.simulation.getState());
      const check=await page.evaluate(reference=>{
        const a=window.__testApp,c=a.renderer.camera,before=c.projectionMatrix.elements.slice();
        a.renderFrame(0);cancelAnimationFrame(a.frameId);const pixels=a.renderer.renderer.domElement.toDataURL();
        new Function('camera',reference)(c);a.renderFrame(0);cancelAnimationFrame(a.frameId);
        const samePixels=pixels===a.renderer.renderer.domElement.toDataURL();
        const mesh=a.renderer.scene.getObjectByName('artillery-lane-danger'),shells=a.simulation.getFrameState().artillery?.shells??[],lanes=[...new Set(shells.map(s=>s.targetLane))].sort((x,y)=>x-y);
        const m=c.matrixWorld.clone(),v=c.position.clone();
        const warnings=!mesh?lanes.length===0:mesh.count===lanes.length&&lanes.every((lane,i)=>{mesh.getMatrixAt(i,m);const actual=v.setFromMatrixPosition(m).project(c).clone();const shell=shells.filter(s=>s.targetLane===lane).sort((x,y)=>x.impactAtSeconds-y.impactAtSeconds)[0];return actual.distanceTo(v.set(-shell.target.x,2.05,shell.target.z+1.2).project(c))<1e-6;});
        return{samePixels,sameProjection:JSON.stringify(before)===JSON.stringify(c.projectionMatrix.elements),warnings,fov:c.fov,tankHealth:a.renderer.projectTankHealthPosition()};
      },reference);
      assert(check.samePixels);assert(check.sameProjection);assert(check.warnings);
      assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),before);
      await page.waitForTimeout(250); await page.screenshot({path:`${out}/${build}-${width}-${label}.png`});results.push({build,width,label,...check});
    }
    await page.setViewportSize({width:width===350?390:350,height:844});
    await page.waitForFunction(()=>window.__testApp.renderer.camera.aspect===innerWidth/innerHeight);
    assert(await page.evaluate(reference=>{const c=window.__testApp.renderer.camera,e=c.clone();new Function('camera',reference)(e);return JSON.stringify(c.projectionMatrix.elements)===JSON.stringify(e.projectionMatrix.elements);},reference));
    const saved=await page.evaluate(()=>{const a=window.__testApp;a.saveCheckpoint('pause');return a.simulation.getState();});
    await page.reload();await page.getByRole('button',{name:'繼續上次遊戲',exact:true}).tap();await page.waitForFunction(()=>window.__testApp?.startup==='started');
    assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved);
    assert(await page.evaluate(reference=>{const c=window.__testApp.renderer.camera,e=c.clone();new Function('camera',reference)(e);return JSON.stringify(c.projectionMatrix.elements)===JSON.stringify(e.projectionMatrix.elements)&&c.position.distanceTo(e.position)<1e-12;},reference));
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Default matches historical B pixels/projection in DEV and production; scenarios, warnings, resize, Continue and four entries passed.');
} finally {writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();await dev.close();await new Promise(resolve=>production.httpServer.close(resolve));}

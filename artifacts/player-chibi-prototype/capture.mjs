// Deterministic portrait fixtures, with the actual game camera/lighting/formation.
// QA only: stop the app clock and freeze UI animations, never change shipping UI.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const phase = process.argv[2] ?? 'prototype';
const out = 'artifacts/player-chibi-prototype';
let baselineServer;
if (phase === 'baseline') {
  const baseline = 'd219cbfab4c6a13f5fafebebbb8754ea903f8643';
  const files = ['CharacterAssets.ts', 'CharacterVisualFamilies.ts', 'GameRenderer.ts', 'ContactShadowRenderer.ts',
    'squad/SquadRenderer.ts', 'squad/PlayerLevelUpEffect.ts', 'projectiles/ProjectileRenderer.ts'];
  const sources = new Map(files.map(file => {
    const path = `src/rendering/${file}`;
    return [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })];
  }));
  baselineServer = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true },
    plugins: [{ name: 'phase-one-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); } }] });
  await baselineServer.listen();
}
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
  const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;') });
});
await page.goto(process.env.QA_URL ?? (baselineServer ? 'http://127.0.0.1:5180/' : 'http://127.0.0.1:5173/'));
await page.waitForSelector('canvas');
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
await page.evaluate(async () => {
  const a = window.__testApp, { projectRenderState } = await import('/src/app/projectRenderState.ts');
  const s = a.simulation.getState();
  s.player.x = 0; s.player.selectedLane = 2; s.elapsedSeconds = 4; s.progression = { level: 1, xp: 0 };
  s.enemies = Array.from({length:36}, (_, i) => ({ id:100+i,tier:1,archetype:i===0?'heavy':'grunt',
    hp:i===0?15:1,lane:i%5,x:i===0?0:(i%5-2)*1.4+Math.sin(i*2.4)*.35,z:s.player.z+(i===0?10:16+(i*1.618%22)) }));
  s.projectiles = []; s.boss = null; s.reinforcement = { startedAtSeconds: null, arrived: false };
  s.squad = { ...s.squad, count:1, rocketCount:0, rifleCounts:[1] };
  window.__playerFixture = projectRenderState(s, { catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7 });
  window.__drawPlayer = (frame, now) => {
    a.xpHud.reset(); a.xpHud.update({level:1,xp:0},s.catharsis.balance.progression,now,
      {baseFireRate:a.runtimeTuning.fireRate,squadCount:1,initialSquadCount:1,reinforcementArrived:false});
    a.renderer.render(frame,now);
  };
});
const stats = {};
for (const key of ['idle','firing','lane','reinforcement','level-up','tier-upgrade','hit','casualty','two-defenders','world-only','giant-guard','boss-guard']) {
  stats[key] = await page.evaluate(key => {
    const a=window.__testApp, frame=structuredClone(window.__playerFixture), draw=window.__drawPlayer;
    a.renderer.resetFeedback(); a.renderer.resize();
    if(key==='two-defenders')frame.squad={...frame.squad,count:2,rifleCounts:[2],reinforcement:{progress:1,reinforcementSpacing:.72,reinforcementStagger:.18}};
    if(key==='reinforcement')frame.squad.reinforcement={progress:.58,reinforcementSpacing:.72,reinforcementStagger:.18};
    if(key==='world-only'||key.endsWith('guard')){frame.squad.count=0;frame.squad.rifleCounts=[];}
    if(key==='giant-guard')frame.enemies.unshift({id:999,tier:1,archetype:'giant',hp:124,maxHp:124,x:0,z:23,visualScaleX:3.4272,visualScaleY:5.04,visualScaleZ:5.04,gaitCycleMs:850});
    if(key==='boss-guard'){frame.enemies=[];frame.boss={id:777,tier:1,x:0,z:15,hp:100,maxHp:100,visualScale:7,engaged:false,slamCooldownRemainingSeconds:0,slamCount:0};}
    draw(frame,1000); draw(frame,2000);
    if(key==='firing'){frame.projectiles=[{id:1,kind:'rifle',tier:1,memberIndex:0,x:0,z:.7,hitRadiusBonus:0}];draw(frame,2010);}
    if(key==='lane'){frame.player.x=1.4;frame.player.selectedLane=3;draw(frame,2010);draw(frame,2090);}
    if(key==='level-up'){a.renderer.presentLevelUp({kind:'progressionLevelUp',fromLevel:1,toLevel:2},2000);draw(frame,2240);}
    if(key==='tier-upgrade'){frame.squad.rifleCounts=[0,1];draw(frame,2010);draw(frame,2080);}
    if(key==='hit'||key==='casualty'){
      const before={count:1,rocketCount:0,rifleCounts:[1],rifleRemainder:0};
      const after=key==='hit'?{...before,rifleRemainder:.1}:{count:0,rocketCount:0,rifleCounts:[],rifleRemainder:0};
      a.renderer.present([{kind:'normalEnemyContact',enemyId:100,enemyTier:1,attackerX:0,attackerZ:2,playerX:0,playerZ:0,before,after}],2010,3.2,.45);
      if(key==='casualty'){frame.squad.count=0;frame.squad.rifleCounts=[];}
      draw(frame,key==='casualty'?2180:2040);
    }
    if(key==='giant-guard')draw(frame,2600);
    const r=a.renderer,member=r.scene.children.find(c=>c.getObjectByName('toy-soldier-body'));
    const point=(y)=>{const p=r.camera.position.clone().set(0,y,0).project(r.camera);return{ x:(p.x+1)*195,y:(1-p.y)*422 };};
    const crown=member?member.getObjectByName('toy-soldier-helmet').geometry.attributes.position.array:[];
    let top=0;for(let i=1;i<crown.length;i+=3)top=Math.max(top,crown[i]);
    window.__lastPlayerFrame=frame;
    return {...r.getDebugStats(), projectedHeight:member?point(0).y-point(top*member.scale.y).y:null};
  },key);
  await page.screenshot({path:`${out}/${phase}-${key}.png`});
}
// Isolated rear silhouette uses the same gameplay camera and actual Player scale.
await page.evaluate(async()=>{
 const a=window.__testApp,r=a.renderer,frame=structuredClone(window.__playerFixture);
 r.resetFeedback();window.__drawPlayer(frame,1000);window.__drawPlayer(frame,2000);
 const THREE=await import('/node_modules/.vite/deps/three.js');
 for(const child of r.scene.children)child.visible=child.visible&&!!child.getObjectByName('toy-soldier-body');
 r.scene.background=new THREE.Color('white');r.scene.fog=null;
 r.scene.overrideMaterial=new THREE.MeshBasicMaterial({color:'black'});r.renderer.render(r.scene,r.camera);
});
await page.locator('canvas').screenshot({path:`${out}/${phase}-silhouette.png`});
// Close inspection at unchanged lighting, with a QA-only zoom and three-quarter front view.
await page.evaluate(async()=>{
 const a=window.__testApp,r=a.renderer;r.scene.overrideMaterial=null;
 const THREE=await import('/node_modules/.vite/deps/three.js');r.scene.background=new THREE.Color('#d8c49b');
 r.skyFill.visible=true;r.sunlight.visible=true;
 r.camera.position.set(2.2,1.8,3.1);r.camera.lookAt(0,.48,0);r.camera.zoom=2.1;r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);
});
await page.locator('canvas').screenshot({path:`${out}/${phase}-isolated.png`});
writeFileSync(`${out}/${phase}-stats.json`,JSON.stringify({errors,viewport:{width:390,height:844},stats},null,2));
await browser.close();
await baselineServer?.close();

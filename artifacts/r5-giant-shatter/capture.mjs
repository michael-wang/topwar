// QA-only deterministic portraits, role projections, gait and lethal fixtures.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { baselineServer, baselineGameData } from './baseline-server.mjs';
const phase=process.argv[2]??'final',out='artifacts/r5-giant-shatter',server=phase==='baseline'?await baselineServer():null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(server)await page.route('**/game-data/game.json',route=>route.fulfill({status:200,contentType:'application/json',body:baselineGameData()}));
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
async function prepare(){
 await page.goto(`http://127.0.0.1:${server?5180:5173}/?review=threats`);await page.waitForSelector('canvas');
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.build-label{visibility:hidden}'});
 await page.evaluate(async()=>{
  const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
  window.__fixture=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
  window.__draw=(f,t)=>{a.xpHud.reset();a.xpHud.update({level:7,xp:0},s.catharsis.balance.progression,t,{baseFireRate:a.runtimeTuning.fireRate,squadCount:f.squad.count,initialSquadCount:1,reinforcementArrived:true});a.renderer.render(f,t);};
  const THREE=await import('/node_modules/.vite/deps/three.js');window.__THREE=THREE;
  window.__metrics=()=>{const r=a.renderer,p=r.scene.getObjectByName('enemy-pale-shatter');return {...r.getDebugStats(),shatterInstances:p?.count??0};};
  window.__measure=()=>{
   const r=a.renderer,families=r.assets.families,helmet=r.scene.children.find(m=>m.isInstancedMesh&&m.geometry===families.heavy.helmet.geometry&&m.count>0),matrix=new THREE.Matrix4();helmet.getMatrixAt(0,matrix);
   r.scene.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);const group=r.scene.getObjectByName('giant-assault-soldier');
   const measure=(role,transform)=>{
    const crown=families[role].helmet.geometry.boundingBox.max.y,p=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(transform).project(r.camera);
    const top=p(0,crown,0),ground=p(0,0,0),width=role==='heavy'?.68:.84;
    return {crownHeight:(top.y-ground.y)*422,bodyWidth:Math.abs((p(width/2,.4,0).x-p(-width/2,.4,0).x)*195)};
   };
   const heavy=measure('heavy',matrix),giant=measure('giant',group.matrixWorld);return {heavy,giant,heightRatio:giant.crownHeight/heavy.crownHeight,widthRatio:giant.bodyWidth/heavy.bodyWidth};
  };
 });
}
const stats={},measurements={},forms={},deaths={},gait=[];
for(const key of phase==='grip'?['opening']:['opening','same-depth','review-depth','normal-crowd','mixed-threats','giants-two','player-guard','grunt-guard','heavy-guard','world-hud-guard']){
 await prepare();stats[key]=await page.evaluate(key=>{
  const r=window.__testApp.renderer,f=structuredClone(window.__fixture),g=f.enemies[0],h=f.enemies[1],giant=f.enemies[2];
  const crowd=n=>Array.from({length:n},(_,i)=>({...((key==='mixed-threats'&&i%5===0)?h:g),id:200+i,x:(i%5-2)*1.4,z:7+Math.floor(i/5)*.7}));
  if(key==='normal-crowd')f.enemies=crowd(100);
  if(key==='mixed-threats')f.enemies=[...crowd(35),giant];
  if(key==='giants-two')f.enemies=[{...giant,x:-1.4,z:24},{...giant,id:103,x:1.4,z:32}];
  if(key==='same-depth'){giant.z=h.z=16;f.enemies=[h,giant];}
  if(key==='review-depth')f.enemies=[h,giant];
  if(key.endsWith('guard')){
   f.enemies=key==='grunt-guard'?[g]:key==='heavy-guard'?[h]:[];
   if(key==='world-hud-guard'){f.squad.count=0;f.squad.rifleCounts=[];}else if(key!=='player-guard'){f.squad.count=0;f.squad.rifleCounts=[];}
  }
  window.__draw(f,0);window.__draw(f,2000);
  if(key.endsWith('guard')&&key!=='world-hud-guard'){
   const keep=r.scene.children.filter(c=>c===r.skyFill||c===r.sunlight||c.getObjectByName('toy-soldier-body')||c.name.startsWith('toy-soldier-')||c.isInstancedMesh&&c.count>0&&c.geometry===r.assets.families[key.split('-')[0]]?.helmet.geometry);
   for(const c of r.scene.children)c.visible=keep.includes(c);r.scene.background.set('white');r.scene.fog=null;r.renderer.render(r.scene,r.camera);
  }
  if(['same-depth','review-depth'].includes(key))window.__lastMeasurement=window.__measure();return window.__metrics();
 },key);if(['same-depth','review-depth'].includes(key))measurements[key]=await page.evaluate(()=>window.__lastMeasurement);
 await page.screenshot({path:`${out}/${phase}-${key}.png`});
}
await prepare();
forms.giant=await page.evaluate(async()=>{
 const r=window.__testApp.renderer,f=structuredClone(window.__fixture);f.enemies=[{...f.enemies[2],id:0,x:0,z:16}];window.__gait=f;
 window.__draw(f,0);window.__draw(f,1700);
 const group=r.scene.getObjectByName('giant-assault-soldier'),family=r.assets.families.giant,THREE=window.__THREE;
 const p=family.body.geometry.getAttribute('position'),c=family.body.geometry.getAttribute('color'),{ART}=await import('/src/art/ArtDirection.ts'),skin=new THREE.Color(ART.faction.skin),head=new THREE.Box3();
 for(let i=0;i<p.count;i++)if(p.getY(i)>.8&&Math.abs(c.getX(i)-skin.r)+Math.abs(c.getY(i)-skin.g)+Math.abs(c.getZ(i)-skin.b)<.00001)head.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
 const crown=family.helmet.geometry.boundingBox.max.y,guide=y=>{const v=new THREE.Vector3(0,y,0).applyMatrix4(group.matrixWorld).project(r.camera);return {x:(v.x+1)*195,y:(1-v.y)*422};};
 window.__guide={crown:guide(crown),headBottom:guide(head.min.y),torsoTop:guide(.895),ground:guide(0)};
 return {crown,headBottom:head.min.y,headSize:head.getSize(new THREE.Vector3()).toArray(),headZones:crown/(crown-head.min.y),guides:window.__guide,
  primaryTriangles:[family.body,family.helmet,family.weapon].reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0)};
});
await page.screenshot({path:`${out}/${phase}-giant-proportions.png`});
await page.evaluate(()=>{const r=window.__testApp.renderer;for(const c of r.scene.children)c.visible=c.name==='giant-assault-soldier';r.scene.overrideMaterial=new window.__THREE.MeshBasicMaterial({color:'black'});r.scene.background.set('white');r.scene.fog=null;r.renderer.render(r.scene,r.camera);});
await page.locator('canvas').screenshot({path:`${out}/${phase}-giant-silhouette.png`});
await prepare();await page.evaluate(()=>{const f=structuredClone(window.__fixture);f.enemies=[{...f.enemies[2],id:0,x:0,z:16}];window.__gait=f;window.__draw(f,0);window.__draw(f,1700);});
for(let sample=0;sample<=8;sample++){
 gait.push(await page.evaluate(sample=>{const r=window.__testApp.renderer,t=1700+sample*850/8;window.__draw(window.__gait,t);const group=r.scene.getObjectByName('giant-assault-soldier'),weapon=group.getObjectByName('giant-maul');
  const result={sample,ms:sample*850/8,position:weapon.position.toArray(),rotation:weapon.rotation.toArray()};
  r.camera.position.set(3.5,4,6);r.camera.lookAt(0,1.5,16);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);return result;},sample));
 await page.screenshot({path:`${out}/${phase}-gait-${sample}.png`});
}
for(const fraction of phase==='grip'?[]:[1,.5,.1,0]){
 await prepare();await page.evaluate(fraction=>{const f=structuredClone(window.__fixture);f.enemies=[{...f.enemies[2],hp:f.enemies[2].maxHp*fraction}];window.__draw(f,0);window.__draw(f,2000);},fraction);
 await page.screenshot({path:`${out}/${phase}-hp-${fraction}.png`});
}
for(const role of phase==='grip'?['giant']:['grunt','heavy','giant']){
 await prepare();await page.evaluate(role=>{const f=structuredClone(window.__fixture);f.enemies=[{...f.enemies.find(e=>e.archetype===role),id:100,x:0,z:role==='giant'?16:8}];window.__death=f;window.__draw(f,0);window.__draw(f,2000);},role);
 await page.screenshot({path:`${out}/${phase}-${role}-alive.png`});
 await page.evaluate(()=>{window.__death.enemies=[];window.__draw(window.__death,2010);});deaths[role]=[];
 for(const age of role==='giant'?[0,100,250,450,520,750,1000,1400,1800,2400]:[0,60,110,260,440,560,710,850,1010]){
  deaths[role].push(await page.evaluate(age=>{window.__draw(window.__death,2010+age);return {ageMs:age,...window.__metrics()};},age));
  await page.screenshot({path:`${out}/${phase}-${role}-death-${age}.png`});
 }
 await page.evaluate(role=>{const r=window.__testApp.renderer;window.__draw(window.__death,2010+(role==='giant'?1000:650));r.camera.position.set(2.5,4,role==='giant'?11:3);r.camera.lookAt(0,0,role==='giant'?14.5:8);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);},role);
 await page.screenshot({path:`${out}/${phase}-${role}-resting-close.png`});
}
for(const count of phase==='grip'?[]:[24,48]){
 await prepare();await page.evaluate(count=>{const f=structuredClone(window.__fixture),h=f.enemies[1];f.enemies=Array.from({length:count},(_,i)=>({...h,id:200+i,x:(i%5-2)*1.4,z:8+Math.floor(i/5)*.6}));window.__dense=f;window.__draw(f,0);window.__draw(f,2000);f.enemies=[];window.__draw(f,2010);},count);
 const samples=[];
 for(const age of [0,60,110,260,440,560,710,850,1010]){samples.push(await page.evaluate(age=>{window.__draw(window.__dense,2010+age);return {ageMs:age,...window.__metrics()};},age));
  await page.screenshot({path:`${out}/${phase}-deaths-${count}-${age}.png`});}
 stats[`deaths-${count}`]={samples,peakDraws:Math.max(...samples.map(s=>s.drawCalls)),peakTriangles:Math.max(...samples.map(s=>s.triangles)),peakShatter:Math.max(...samples.map(s=>s.shatterInstances))};
}
writeFileSync(`${out}/${phase}-stats.json`,JSON.stringify({stats,measurements,forms,gait,deaths,errors},null,2));await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

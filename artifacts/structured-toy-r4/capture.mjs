// QA-only fixtures through the actual app/renderer; no shipping hooks.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase=process.argv[2]??'final', out='artifacts/structured-toy-r4';
const server=phase==='baseline'?await baselineServer():null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
async function prepare(){
 await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=threats`);await page.waitForSelector('canvas');
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.build-label{visibility:hidden}'});
 await page.evaluate(async()=>{
  const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
  window.__fixture=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
  window.__draw=(f,t)=>{a.xpHud.reset();a.xpHud.update({level:7,xp:0},s.catharsis.balance.progression,t,{baseFireRate:a.runtimeTuning.fireRate,squadCount:f.squad.count,initialSquadCount:1,reinforcementArrived:true});a.renderer.render(f,t);};
 });
}
const stats={},occupancy={},forms={};
for(const key of ['opening','empty','outer-lanes','left-house','right-house','normal-crowd','mixed-threats','mixed-100','mixed-200','giants-two','player-guard','grunt-guard','boss-guard']){
 await prepare();stats[key]=await page.evaluate(key=>{
  const r=window.__testApp.renderer,f=structuredClone(window.__fixture),draw=window.__draw;
  const g={...f.enemies[0],id:100,x:0,z:9},h={...f.enemies[1],id:101,x:1.4,z:12},giant={...f.enemies[2],id:102,x:0,z:22};
  const crowd=(n,heavy=false)=>Array.from({length:n},(_,i)=>({...((heavy&&i%5===0)?h:g),id:200+i,x:(i%5-2)*1.4,z:7+Math.floor(i/5)*.7}));
  if(key==='normal-crowd')f.enemies=crowd(100);
  if(key==='mixed-threats')f.enemies=[...crowd(35,true),giant];
  if(/^mixed-\d+$/.test(key))f.enemies=crowd(Number(key.split('-')[1]),true);
  if(key==='giants-two')f.enemies=[{...giant,x:-1.4,z:24},{...giant,id:103,x:1.4,z:32}];
  if(key==='outer-lanes')f.enemies=[{...g,x:-2.8,z:6},{...h,x:2.8,z:8},{...g,id:103,x:-2.8,z:15}];
  if(['empty','left-house','right-house'].includes(key))f.enemies=[];
  if(key.endsWith('guard')){
   f.enemies=key==='grunt-guard'?[g]:[];f.squad.count=key==='player-guard'?1:0;f.squad.rifleCounts=key==='player-guard'?[1]:[];f.reinforcement=undefined;
   if(key==='boss-guard')f.boss={id:777,tier:1,x:0,z:15,hp:100,maxHp:100,visualScale:7,engaged:false,slamCooldownRemainingSeconds:0,slamCount:0};
  }
  draw(f,0);draw(f,2000);
  if(key.endsWith('house')){const x=key==='left-house'?5.5:-5.5,z=key==='left-house'?8:13;
   r.camera.position.set(x+(x>0?-3:3),3.5,z-7);r.camera.lookAt(x,.85,z);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);}
  if(key.endsWith('guard')){
   for(const c of r.scene.children)if(c!==r.skyFill&&c!==r.sunlight&&!c.getObjectByName('toy-soldier-body')&&!c.name.includes('boss')&&!c.name.startsWith('toy-soldier-'))c.visible=false;
   r.scene.background.set('white');r.scene.fog=null;r.renderer.render(r.scene,r.camera);
  }
  return r.getDebugStats();
 },key);await page.screenshot({path:`${out}/${phase}-${key}.png`});
}
for(const role of ['grunt','heavy','giant']){
 await prepare();occupancy[role]=await page.evaluate(async role=>{
  const r=window.__testApp.renderer,THREE=await import('/node_modules/.vite/deps/three.js'),f=structuredClone(window.__fixture);
  f.enemies=[];f.squad.count=0;f.squad.rifleCounts=[];window.__draw(f,2000);
  for(const c of r.scene.children)c.visible=false;
  const family=r.assets.families[role],group=new THREE.Group();
  for(const part of [family.body,family.helmet,family.vest,family.weapon].filter(Boolean)){
   const mesh=new THREE.Mesh(part.geometry,part.material.clone());mesh.visible=part.visible;group.add(mesh);
  }
  const e=window.__fixture.enemies.find(e=>e.archetype===role),scale=e.visualScale;
  group.scale.set(e.visualScaleX??scale,(e.visualScaleY??scale)*(role==='heavy'?family.presentation.scaleY:1),e.visualScaleZ??scale);
  group.position.z=role==='giant'?22:7;group.rotation.set(role==='giant'?-.12:-.15,Math.PI,0);
  r.scene.add(group);r.skyFill.visible=r.sunlight.visible=true;r.scene.background.set('white');r.scene.fog=null;
  r.camera.position.set(0,6.5,-10);r.camera.lookAt(0,0,12.5);r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld(true);group.updateMatrixWorld(true);
  const b=new THREE.Box2();for(const mesh of group.children)if(mesh.visible){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
   const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(r.camera);b.expandByPoint(new THREE.Vector2((v.x+1)*195,(1-v.y)*422));}}
  window.__inspection={group,family,role,THREE};r.scene.overrideMaterial=new THREE.MeshBasicMaterial({color:'black'});r.renderer.render(r.scene,r.camera);
  return {width:b.max.x-b.min.x,height:b.max.y-b.min.y,bounds:{min:b.min.toArray(),max:b.max.toArray()}};
 },role);await page.locator('canvas').screenshot({path:`${out}/${phase}-${role}-silhouette.png`});
 for(const view of ['front','three-quarter','side','equipment']){
  const form=await page.evaluate(view=>{
   const r=window.__testApp.renderer,{group,role,THREE,family}=window.__inspection;group.scale.setScalar(1);r.scene.overrideMaterial=null;r.scene.background.set('#d8c49b');
   const z=group.position.z,dist=role==='giant'?2.8:2.4;
   const y=view==='equipment'?.32:role==='giant'?.67:.50;
   r.camera.position.set(view==='side'?dist:view==='three-quarter'?1.5:0,view==='equipment'?.7:1.2,z+(view==='side'?0:-dist));
   r.camera.lookAt(0,y,z);r.camera.zoom=view==='equipment'?1.7:1;r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);
   group.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);
   const p=family.body.geometry.getAttribute('position'),c=family.body.geometry.getAttribute('color'),skin=new THREE.Color('#cda17c');
   // Use the actual shared art skin swatch, rather than a QA-selected face tint.
   return import('/src/art/ArtDirection.ts').then(({ART})=>{
    skin.set(ART.faction.skin);const head=new THREE.Box3();
    for(let i=0;i<p.count;i++)if(p.getY(i)>(role==='giant'?.65:.43)&&Math.abs(p.getX(i))<(role==='heavy'?.33:role==='grunt'?.24:1)&&Math.abs(c.getX(i)-skin.r)+Math.abs(c.getY(i)-skin.g)+Math.abs(c.getZ(i)-skin.b)<.00001)
     head.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
    const crown=family.helmet.geometry.boundingBox.max.y;
    const guide=h=>{const v=new THREE.Vector3(0,h,0).applyMatrix4(group.matrixWorld).project(r.camera);return {x:(v.x+1)*195,y:(1-v.y)*422};};
    return {crown,headBottom:head.min.y,headSize:head.getSize(new THREE.Vector3()).toArray(),ratio:crown/(crown-head.min.y),
     guides:{crown:guide(crown),headBottom:guide(head.min.y),ground:guide(0)},
     primaryTriangles:[family.body,family.helmet,family.vest,family.weapon].filter(m=>m?.visible).reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0)};
   });
  },view);if(view==='front')forms[role]=form;
  await page.locator('canvas').screenshot({path:`${out}/${phase}-${role}-${view}.png`});
 }
}
const hud={};
for(const width of [390,350])for(const kind of ['fireRate','squad']){
 await page.setViewportSize({width,height:844});await prepare();hud[`${width}-${kind}`]=await page.evaluate(kind=>{
  const a=window.__testApp,s=a.simulation.getState(),f=structuredClone(window.__fixture);a.renderer.render(f,0);a.renderer.render(f,2000);a.xpHud.reset();
  a.xpHud.update({level:kind==='squad'?7:3,xp:kind==='squad'?0:45},s.catharsis.balance.progression,2000,
   {baseFireRate:a.runtimeTuning.fireRate,squadCount:kind==='squad'?2:1,initialSquadCount:1,reinforcementArrived:kind==='squad'});
  const box=q=>{const r=document.querySelector(q)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};
  return {track:box('.xp-track'),level:box('.xp-level'),loadout:box('.xp-loadout'),weapon:box('.xp-weapon-slot .game-icon')??box('.xp-loadout > .game-icon'),enhancement:box('.xp-enhancement-slot')??box('.xp-power'),value:document.querySelector('.xp-power strong')?.textContent};
 },kind);await page.screenshot({path:`${out}/${phase}-hud-${width}-${kind}.png`});
}
writeFileSync(`${out}/${phase}-stats.json`,JSON.stringify({stats,occupancy,forms,hud,errors},null,2));
await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

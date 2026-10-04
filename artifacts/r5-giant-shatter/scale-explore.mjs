// QA-only projection measurements through the shipping renderer, before edits.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
await page.goto('http://127.0.0.1:5173/?review=threats');await page.waitForSelector('canvas');
await page.addStyleTag({content:'.build-label{visibility:hidden}'});
const results=[];
for(const scale of [3.6,2.8,2.6,2.4,2.2,2.0,1.9])for(const mode of ['same-depth','review-depth']){
 const measurement=await page.evaluate(async({scale,mode})=>{
  const a=window.__testApp,r=a.renderer,{projectRenderState}=await import('/src/app/projectRenderState.ts'),THREE=await import('/node_modules/.vite/deps/three.js');
  const s=a.simulation.getState(),f=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
  const h=f.enemies.find(e=>e.archetype==='heavy'),g=f.enemies.find(e=>e.archetype==='giant');
  const widthMultiplier=scale===1.9?.94:.68;
  g.visualScale=g.visualScaleY=g.visualScaleZ=1.4*scale;g.visualScaleX=g.visualScale*widthMultiplier;
  if(mode==='same-depth')g.z=h.z=16;
  f.enemies=[h,g];a.xpHud.reset();a.xpHud.update({level:7,xp:0},s.catharsis.balance.progression,2000,{baseFireRate:a.runtimeTuning.fireRate,squadCount:2,initialSquadCount:1,reinforcementArrived:true});
  r.resetFeedback();r.render(f,0);r.render(f,2000);r.scene.updateMatrixWorld(true);r.camera.updateMatrixWorld(true);
  const family=r.assets.families,helmet=r.scene.children.find(m=>m.isInstancedMesh&&m.geometry===family.heavy.helmet.geometry&&m.count>0),matrix=new THREE.Matrix4();helmet.getMatrixAt(0,matrix);
  const giant=r.scene.getObjectByName('giant-assault-soldier');
  const measure=(role,transform)=>{
   const crown=family[role].helmet.geometry.boundingBox.max.y;
   const project=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(transform).project(r.camera);
   const top=project(0,crown,0),ground=project(0,0,0),width=role==='heavy'?.68:.84;
   return {crownHeight:(top.y-ground.y)*422,bodyWidth:Math.abs((project(width/2,.4,0).x-project(-width/2,.4,0).x)*195)};
  };
  const heavy=measure('heavy',matrix),colossus=measure('giant',giant.matrixWorld);
  return {scale,widthMultiplier,mode,heavy,giant:colossus,heightRatio:colossus.crownHeight/heavy.crownHeight,widthRatio:colossus.bodyWidth/heavy.bodyWidth};
 },{scale,mode});results.push(measurement);
 await page.screenshot({path:`artifacts/r5-giant-shatter/explore-${scale}-${mode}.png`});
}
writeFileSync('artifacts/r5-giant-shatter/scale-exploration.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();

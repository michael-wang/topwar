import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase=process.argv[2]??'final',out='artifacts/threat-chibi-polish';
const server=phase==='baseline'?await baselineServer():null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;')});});
await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=threats`);await page.waitForFunction(()=>!!window.__testApp);await page.addStyleTag({content:'#game-viewport > :not(canvas){visibility:hidden}'});
await page.evaluate(async()=>{
 const a=window.__testApp,{projectRenderState}=await import('/src/app/projectRenderState.ts'),s=a.simulation.getState();
 const f=projectRenderState(s,{catharsis:s.catharsis,trackHalfWidth:3.2,formationSpacing:.45,defenseLineOffset:1.5,bossVisualScale:7});
 f.enemies=[];f.squad.count=0;f.squad.rifleCounts=[];f.reinforcement=undefined;a.renderer.render(f,2000);
 const r=a.renderer,boats=r.scene.getObjectByName('offshore-troop-transports');
 // Supplemental close inspection only. Shipping camera remains unchanged.
 const THREE=await import('/node_modules/.vite/deps/three.js');const craft=boats.children.at(-1),center=new THREE.Vector3();craft.getWorldPosition(center);
 const inspection=new THREE.Scene();inspection.background=r.scene.background.clone();inspection.fog=r.scene.fog.clone();inspection.add(r.skyFill.clone(),r.sunlight.clone(),r.scene.getObjectByName('coastal-water-and-sky').clone(),craft.clone());
 r.camera.position.set(center.x+6,center.y+6,center.z-12);r.camera.lookAt(center.x,center.y+.6,center.z);r.camera.zoom=1.4;r.camera.updateProjectionMatrix();r.renderer.render(inspection,r.camera);
});
await page.screenshot({path:`${out}/${phase}-landing-craft.png`});
await page.setViewportSize({width:844,height:390});
await page.evaluate(()=>{const viewport=document.querySelector('#game-viewport');Object.assign(viewport.style,{position:'fixed',left:'0',top:'0',width:'844px',height:'390px',maxWidth:'none',maxHeight:'none',aspectRatio:'auto',transform:'none'});const r=window.__testApp.renderer;r.renderer.setSize(844,390);Object.assign(r.renderer.domElement.style,{width:'844px',height:'390px'});r.camera.aspect=844/390;r.camera.fov=48;r.camera.zoom=1;r.camera.position.set(0,18,5);r.camera.lookAt(0,0,80);r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);});
await page.screenshot({path:`${out}/${phase}-wide-naval.png`});
writeFileSync(`${out}/${phase}-naval.json`,JSON.stringify({errors,closeViewport:[390,844],wideViewport:[844,390],supplementalCamera:true},null,2));
await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

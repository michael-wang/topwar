import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase=process.argv[2] ?? 'polish', out='artifacts/threat-chibi-correction';
const server=phase==='baseline' ? await baselineServer() : null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;window.requestAnimationFrame=()=>0;app.start();')});});
await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=threats`);
await page.waitForFunction(()=>window.__testApp?.running);
await page.addStyleTag({content:'.build-label{visibility:hidden}'});
// Real app frame path, ordinary fixed-step combat, deterministic timestamps.
// Only the browser RAF scheduler is replaced; geometry and simulation are shipping code.
for(let t=0;t<1500;t+=50)await page.evaluate(t=>window.__testApp.renderFrame(t),t);
const samples=[];mkdirSync(`${out}/${phase}-sequence`,{recursive:true});
for(let i=0;i<=50;i++){
 const t=1500+i*50;
 samples.push(await page.evaluate(t=>{const a=window.__testApp;a.renderFrame(t);const s=a.simulation.getState();return {timestampMs:t,tick:s.tick,elapsed:s.elapsedSeconds,enemies:s.enemies.map(e=>({id:e.id,role:e.archetype,z:e.z}))};},t));
 await page.locator('canvas').screenshot({path:`${out}/${phase}-sequence/${String(i).padStart(2,'0')}.png`});
}
writeFileSync(`${out}/${phase}-temporal.json`,JSON.stringify({durationMs:2500,frameMs:50,errors,samples},null,2));
await browser.close();await server?.close();if(errors.length)throw Error(errors.join('\n'));

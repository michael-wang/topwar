import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase='normal-live', out='artifacts/rounded-toy-r1';
const server=null;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;window.requestAnimationFrame=()=>0;app.start();')});});
await page.goto(`${server?'http://127.0.0.1:5180':'http://127.0.0.1:5173'}/?review=normal`);
await page.waitForFunction(()=>window.__testApp?.running);
await page.addStyleTag({content:'.build-label{visibility:hidden}'});

const openingLevel=await page.evaluate(()=>window.__testApp.simulation.getState().progression.level);
let state;
for(let t=0;t<=30000;t+=50){
 state=await page.evaluate(t=>{const a=window.__testApp;a.renderFrame(t);const s=a.simulation.getState();return {time:s.elapsedSeconds,level:s.progression.level,count:s.squad.count,enemies:s.enemies.length};},t);
 if(state.time>=12&&state.enemies>0&&state.count>0)break;
}
await page.screenshot({path:`${out}/normal-live-battlefield.png`});
writeFileSync(`${out}/normal-live.json`,JSON.stringify({openingLevel,state,errors},null,2));
await browser.close();if(errors.length||openingLevel!==1||state.count<1||state.enemies<1)throw Error(JSON.stringify({state,errors}));

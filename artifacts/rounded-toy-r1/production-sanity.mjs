import { preview } from 'vite';
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const server=await preview({preview:{host:'127.0.0.1',port:5181,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
for(const [query,level]of [['',1],['?review=threats',7],['?review=normal',1]]){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
 await page.goto(`http://127.0.0.1:5181/topwar/${query}`);await page.waitForSelector('canvas');
 await page.waitForFunction(level=>document.querySelector('.xp-level-number')?.textContent===String(level),level);
 await page.waitForTimeout(250);
 const actual=await page.locator('.xp-level-number').textContent();
 await page.screenshot({path:`artifacts/rounded-toy-r1/production-${query.includes('threats')?'threats':query?'normal':'default'}.png`});
 results[query||'default']={level:Number(actual),expected:level,errors};if(Number(actual)!==level||errors.length)throw Error(JSON.stringify(results));await page.close();
}
writeFileSync('artifacts/rounded-toy-r1/production-sanity.json',JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

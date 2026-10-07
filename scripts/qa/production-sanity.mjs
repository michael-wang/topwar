// Run from the repository root. Generated output is ignored by Git.
import { preview } from 'vite';
// Uses the existing QA browser runtime; no shipping dependency.
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
const out = process.argv[2] ?? 'artifacts/sanity';
mkdirSync(out, { recursive: true });
const shippingJs = readdirSync('dist/assets').filter(name => name.endsWith('.js'))
  .map(name => readFileSync('dist/assets/' + name, 'utf8')).join('\n');
if (['EnemyVfxLab', 'ENEMY_VFX_LAB', 'enemy-vfx-lab', 'DEV Review', 'dev-review-controls', 'DEV TOOLS', 'BALANCE & AUDIO', 'Reset Defaults', 'CURVE', 'Digit4', 'EVOLVE', 'Digit5', 'Digit6'].some(marker => shippingJs.includes(marker)))
  throw Error('Development review controls/factory survived production tree-shaking');
const server=await preview({preview:{host:'127.0.0.1',port:5181,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
for(const width of [390,350]){
for(const [query,level]of [['',1],['?review=threats',5],['?review=normal',1]]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
 await page.goto(`http://127.0.0.1:5181/topwar/${query}`);await page.waitForSelector('canvas');
 await page.waitForSelector('.game-start-overlay');
 await page.screenshot({path:`${out}/production-start-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 await page.getByRole('button',{name:'Start game with audio'}).click();
 // Review's frozen pre-start badge is already Lv5. Wait for a stable post-start
 // HUD, not that transient match before the first level-up presentation frame.
 await page.waitForFunction(level=>{
   const valid=!document.querySelector('.game-start-overlay')
     && document.querySelector('.xp-level-number')?.textContent===String(level)
     && !document.querySelector('.xp-hud')?.classList.contains('level-up');
   if(!valid){window.__qaHudStableAt=null;return false;}
   window.__qaHudStableAt??=performance.now();return performance.now()-window.__qaHudStableAt>=500;
 },level);
 const actual=await page.locator('.xp-level-number').textContent();
 await page.screenshot({path:`${out}/production-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 const labControls=await page.locator('.dev-review-controls').count();
 const devMenu=await page.locator('.tuning-panel').count();
 const hiddenMovement=await page.locator('.touch-steering-band,.touch-steering-zone').count();
 if(hiddenMovement!==0||await page.locator('.movement-button:visible').count()!==2)throw Error('Production movement controls are not exclusively visible buttons');
 const mgLabControls=await page.locator('[data-role="machineGun"]').count();
 const evolveLabControls=await page.locator('[data-role="evolve"]').count();
 const grenadeLabControls=await page.locator('[data-role="grenade"]').count();
 await page.keyboard.press('Escape'); await page.keyboard.press('4'); await page.keyboard.press('5'); await page.keyboard.press('6');
 if(await page.locator('.tuning-panel,.dev-review-controls').count())throw Error('Production shortcuts exposed DEV controls');
 results[`${width}:${query||'default'}`]={level:Number(actual),expected:level,devMenu,labControls,grenadeLabControls,mgLabControls,evolveLabControls,errors};if(Number(actual)!==level||devMenu!==0||labControls!==0||grenadeLabControls!==0||mgLabControls!==0||evolveLabControls!==0||errors.length)throw Error(JSON.stringify(results));await page.close();
}
}
writeFileSync(`${out}/production-sanity.json`,JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

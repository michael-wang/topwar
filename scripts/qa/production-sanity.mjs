// Run from the repository root. Generated output is ignored by Git.
import { preview } from 'vite';
// Uses the existing QA browser runtime; no shipping dependency.
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { publicAssets } from '../public-assets.mjs';
const { manifest } = publicAssets('public');
const out = process.argv[2] ?? 'artifacts/sanity';
mkdirSync(out, { recursive: true });
const shippingJs = readdirSync('dist/assets').filter(name => name.endsWith('.js'))
  .map(name => readFileSync('dist/assets/' + name, 'utf8')).join('\n');
if (shippingJs.includes('__testApp') || shippingJs.includes('qa:scene-start')) throw Error('QA instrumentation leaked into production');
if (['EnemyVfxLab', 'ENEMY_VFX_LAB', 'enemy-vfx-lab', 'DEV Review', 'dev-review-controls', 'DEV TOOLS', 'BALANCE & AUDIO', 'Reset Defaults', 'CURVE', 'Digit4', 'EVOLVE', 'Digit5', 'Digit6', 'MG7', 'MG8', 'CRATE3', 'CRATE8', 'NAVAL', 'createNavalReview', 'SHELL review requires', 'shell-review-muzzle', 'artillery dodge test', 'Supply DEV review requires', 'Late DEV entry requires', 'Restart Lv6 before the Machine Gun release and full Carnival'].some(marker => shippingJs.includes(marker)))
  throw Error('Development review controls/factory survived production tree-shaking');
const server=await preview({preview:{host:'127.0.0.1',port:5181,strictPort:true}});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
const authoredConfig=JSON.parse(readFileSync('public/game-data/game.json','utf8'));
const authoredLevel=JSON.parse(readFileSync('public/game-data/levels/level-001.json','utf8'));
try {
for(const width of [390,350]){
for(const [query,level]of [['',1],['?review=threats',5],['?review=normal',1]]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-US'});const errors=[];
 const runtimeRequests=[];let configResponse,levelResponse;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>errors.push(`Request failed: ${r.url()}`));
 page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/topwar/game-data/')||u.pathname.startsWith('/topwar/models/'))runtimeRequests.push(r.url());});
 page.on('response',r=>{const path=new URL(r.url()).pathname;if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);if(path===`/topwar/${manifest['game-data/game.json']}`)configResponse=r;if(path===`/topwar/${manifest['game-data/levels/level-001.json']}`)levelResponse=r;});
 await page.addInitScript(()=>{
   localStorage.setItem('topwar.observer.locale','en');
   window.__qaJsonFetches=[];window.__qaUnhandled=[];
   window.addEventListener('unhandledrejection',e=>window.__qaUnhandled.push(String(e.reason)));
   const nativeFetch=window.fetch.bind(window);
   window.fetch=(input,options)=>{const url=input instanceof Request?input.url:String(input);if(url.includes('/game-data/'))window.__qaJsonFetches.push({url,cache:options?.cache});return nativeFetch(input,options);};
 });
 await page.goto(`http://127.0.0.1:5181/topwar/${query}`);await page.waitForSelector('canvas');
 await page.waitForSelector('.game-start-overlay');
 const sha=(await page.locator('.build-label').textContent()).split(' · ').at(-1);
 if(!/^[0-9a-f]{7,40}$/.test(sha))throw Error('Missing build SHA');
 for(const expression of ['neutral','alert']){
  const asset=await page.request.get(`http://127.0.0.1:5181/topwar/${manifest[`art/observer/${expression}.webp`]}`);
  if(!asset.ok()||!asset.headers()['content-type']?.includes('image/webp'))throw Error('Missing local observer portrait under Pages base path');
 }
 for(const name of ['observer_destroyer_zh-TW.mp3','observer_mission_intro_zh-TW.mp3']){
  const voice=await page.request.get(`http://127.0.0.1:5181/topwar/${manifest[`audio/${name}`]}`);
  if(!voice.ok()||!voice.headers()['content-type']?.includes('audio/mpeg')
    ||!(await voice.body()).equals(readFileSync(`public/audio/${name}`)))
    throw Error('Approved observer voice missing or altered under Pages base path');
 }
 const config=await configResponse?.json(),levelData=await levelResponse?.json();
 if(JSON.stringify(config)!==JSON.stringify(authoredConfig)||JSON.stringify(levelData)!==JSON.stringify(authoredLevel))throw Error('Production runtime data differs from authored data');
 if(!config.catharsis.defenseMode||config.catharsis.grenade.capacity!==3||JSON.stringify(config.catharsis.progression.xpRequirements)!=='[28,60,110,180,220,200,300]')throw Error('Stale defense/progression/Grenade config');
 if(!await page.locator('#game-viewport.beachhead-defense').count()||await page.getByText(/ENEMY LV/).isVisible())throw Error('Production loaded legacy bridge/HUD');
 for(const url of runtimeRequests){const u=new URL(url);if(u.search||!Object.values(manifest).some(path=>u.pathname===`/topwar/${path}`))throw Error(`Unversioned or mismatched runtime asset: ${url}`);}
 if(runtimeRequests.filter(url=>new URL(url).pathname.endsWith('.glb')).length!==1)throw Error('Defense must request exactly the bullet');
 if(new Set(runtimeRequests).size!==runtimeRequests.length)throw Error('Duplicate runtime resource request');
 const jsonFetches=await page.evaluate(()=>window.__qaJsonFetches);
 for(const path of ['game-data/game.json','game-data/levels/level-001.json'])if(!jsonFetches.some(r=>r.url===`/topwar/${manifest[path]}`&&r.cache===undefined))throw Error(`Missing content-addressed fetch: ${path}`);
 await page.screenshot({path:`${out}/production-start-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 await page.getByRole('button',{name:'Start game with audio'}).tap();
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
 if(await page.locator('.observer-languages').count())throw Error('Language selector survived closed-playtest policy');
 if(await page.locator('.field-observer p').getAttribute('lang')!=='zh-TW')throw Error('Observer did not ignore English browser and saved preference');
 if(await page.locator('#game-viewport').getAttribute('data-input-presentation')!=='touch'||await page.locator('.combat-keycue:visible').count())throw Error('Production touch Start exposed keyboard hints');
 await page.screenshot({path:`${out}/production-${query.includes('threats')?'threats':query?'normal':'default'}-${width}.png`});
 const labControls=await page.locator('.dev-review-controls').count();
 const devMenu=await page.locator('.tuning-panel').count();
 if(await page.locator('[data-role="late"],[data-role="mg7"],[data-role="mg8"],[data-role="carnival"]').count())throw Error('Production contains late DEV entries');
 const hiddenMovement=await page.locator('.touch-steering-band,.touch-steering-zone').count();
 if(hiddenMovement!==0||await page.locator('.movement-button:visible').count()!==2)throw Error('Production movement controls are not exclusively visible buttons');
 const mgLabControls=await page.locator('[data-role="machineGun"]').count();
 const evolveLabControls=await page.locator('[data-role="evolve"]').count();
 const grenadeLabControls=await page.locator('[data-role="grenade"]').count();
 await page.keyboard.press('Escape'); await page.keyboard.press('4'); await page.keyboard.press('5'); await page.keyboard.press('6');
 if(await page.locator('.tuning-panel,.dev-review-controls').count())throw Error('Production shortcuts exposed DEV controls');
 errors.push(...await page.evaluate(()=>window.__qaUnhandled));
 results[`${width}:${query||'default'}`]={level:Number(actual),expected:level,sha,defenseMode:config.catharsis.defenseMode,grenadeCapacity:config.catharsis.grenade.capacity,xpRequirements:config.catharsis.progression.xpRequirements,runtimeRequests,jsonFetches,devMenu,labControls,grenadeLabControls,mgLabControls,evolveLabControls,errors};if(Number(actual)!==level||devMenu!==0||labControls!==0||grenadeLabControls!==0||mgLabControls!==0||evolveLabControls!==0||errors.length)throw Error(JSON.stringify(results));await page.close();
}
}
writeFileSync(`${out}/production-sanity.json`,JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}

import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/start-glyph';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const assert=(v,m)=>{if(!v)throw Error(m);},report=[];
const cases=[
  {name:'mouse-desktop',width:1100,touch:false,start:'mouse',mode:'desktop'},
  {name:'touch-390',width:390,touch:true,start:'touch',mode:'touch'},
  {name:'touch-350',width:350,touch:true,start:'touch',mode:'touch'},
  {name:'mouse-coarse',width:390,touch:true,start:'mouse',mode:'desktop'},
  {name:'enter-coarse',width:390,touch:true,start:'Enter',mode:'desktop'},
  {name:'space-coarse',width:390,touch:true,start:'Space',mode:'desktop'},
  {name:'pen',width:390,touch:true,start:'pen',mode:'touch'},
  {name:'unknown',width:390,touch:true,start:'unknown',mode:'touch'},
  {name:'empty',width:390,touch:true,start:'',mode:'touch'},
  {name:'ambiguous-click',width:1100,touch:false,start:'click',mode:'touch'},
];
try {
  for(const c of cases) {
    const page=await browser.newPage({viewport:{width:c.width,height:844},isMobile:c.touch,hasTouch:c.touch}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{
      const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;window.__activationCalls=0;const activate=app.audio.activate.bind(app.audio);app.audio.activate=(...args)=>{window.__activationCalls++;return activate(...args)};app.start();')});
    });
    await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173');
    await page.waitForSelector('.game-start-overlay');
    const mode=()=>page.locator('#game-viewport').getAttribute('data-input-presentation');
    assert(await mode()==='touch',`${c.name}: conservative default`);
    assert(await page.locator('.movement-button .combat-keycue:visible').count()===0,'Default has no movement hints');
    const start=page.getByRole('button',{name:'Start game with audio'});
    if(c.start==='mouse')await start.click();
    else if(c.start==='touch')await start.tap();
    else if(c.start==='Enter'||c.start==='Space')await page.keyboard.press(c.start);
    else if(c.start==='click')await start.evaluate(e=>e.click());
    else {
      await start.dispatchEvent('pointerdown',{pointerType:c.start,pointerId:1,bubbles:true,cancelable:true});
      // Complete the synthetic gesture, including the compatibility click consumed
      // by the existing startup guard. Otherwise the next DEV click is that click.
      await page.locator('#game-viewport').dispatchEvent('pointerup',{pointerType:c.start,pointerId:1,bubbles:true});
      await page.locator('#game-viewport').dispatchEvent('click',{bubbles:true,cancelable:true});
    }
    assert(await mode()===c.mode,`${c.name}: set before activation completion`);
    await page.waitForFunction(()=>window.__testApp.startup==='started');
    await page.evaluate(()=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
      window.__advance=ms=>{for(let t=0;t<ms;t+=20){window.__clock+=Math.min(20,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
    });
    const advance=ms=>page.evaluate(ms=>window.__advance(ms),ms);
    const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
    await selectDevFixture(page,'grenade');await advance(40);await page.waitForTimeout(600);
    const cues=await page.locator('.combat-keycue').evaluateAll(es=>es.map(e=>{
      const s=getComputedStyle(e);return {text:e.textContent,display:s.display,background:s.backgroundColor,border:s.borderTopWidth,opacity:s.opacity,pointer:s.pointerEvents};
    }));
    assert(cues.length===3&&cues.every(e=>c.mode==='desktop'?e.display!=='none':e.display==='none'),`${c.name}: session hint visibility`);
    assert(cues.every(e=>e.background==='rgba(0, 0, 0, 0)'&&e.border==='0px'&&e.pointer==='none'),'No separate keycap surfaces');
    const arrow=await page.locator('.movement-left svg').boundingBox(),button=await page.locator('.movement-left').boundingBox();
    assert(arrow.width>=button.width*.75&&arrow.height>=button.height*.8,'Arrow dominates button interior');
    await page.screenshot({path:`${out}/${c.name}.png`});
    // Keys remain active after touch Start. A later touch remains active after mouse Start.
    await page.keyboard.press('a');await advance(40);assert((await state()).player.selectedLane===1,'Later A functional');
    await page.keyboard.press('d');await advance(40);assert((await state()).player.selectedLane===2,'Later D functional');
    if(c.touch){
      await page.locator('.movement-left').tap();await advance(40);assert((await state()).player.selectedLane===1,'Later touch functional');
      await page.locator('.movement-right').tap();await advance(40);assert((await state()).player.selectedLane===2,'Later touch right functional');
      await page.evaluate(()=>document.activeElement.blur());
    }
    await page.keyboard.press('q');await advance(100);assert((await state()).grenade.inventory===2,'Later Q functional');
    await page.keyboard.press('p');const paused=await state();await advance(800);
    assert((await state()).elapsedSeconds===paused.elapsedSeconds,'Pause freezes flight');
    await page.keyboard.press('p');await advance(800);
    assert(await mode()===c.mode,'Pause/mixed input preserve initial presentation');
    await page.evaluate(()=>window.__testApp.retry());await advance(40);
    assert(await mode()===c.mode,'Fixture Retry preserves mode');
    await page.evaluate(()=>{const a=window.__testApp;a.devReviewFixture=null;a.retry();});await advance(40);
    assert(await mode()===c.mode&&(await state()).progression.level===1,'Normal Retry preserves mode');
    assert(!errors.length,errors.join('\n'));
    report.push({...c,cues,arrow,button,errors});await page.close();
  }
  writeFileSync(`${out}/start-presentation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({name,mode,errors})=>({name,mode,errors}))));
} finally {await browser.close();}

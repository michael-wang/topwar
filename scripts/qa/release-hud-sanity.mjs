import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ??
  'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/pre-release/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[],assert=(ok,m)=>{if(!ok)throw Error(m);};
try {
  for(const [width,touch] of [[390,true],[350,true],[1100,false]]) {
    const page=await browser.newPage({viewport:{width,height:844},isMobile:touch,hasTouch:touch}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{
      const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});
    });
    await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173');
    if(touch)await page.getByRole('button',{name:'Start game with audio'}).tap();
    else await page.getByRole('button',{name:'Start game with audio'}).click();
    await page.waitForFunction(()=>window.__testApp.startup==='started');
    await page.evaluate(()=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;window.__blasts=[];
      window.__advance=ms=>{for(let t=0;t<ms;t+=20){window.__clock+=Math.min(20,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}};
    });
    const advance=ms=>page.evaluate(ms=>window.__advance(ms),ms);
    const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
    const capture=name=>page.screenshot({path:`${out}/${name}-${width}.png`});
    await selectDevFixture(page,'grenade');await advance(40);
    await page.evaluate(()=>{
      const s=window.__testApp.simulation,consume=s.consumeGrenadeEvents.bind(s);
      s.consumeGrenadeEvents=()=>{const es=consume();window.__blasts.push(...es);return es;};
    });
    assert(await page.locator('.control-hint').count()===0,'No defense movement hint');
    const cues=await page.locator('.combat-keycue').evaluateAll(es=>es.map(e=>({text:e.textContent,display:getComputedStyle(e).display})));
    assert(cues.length===3&&cues.every(c=>touch?c.display==='none':c.display!=='none'),'Start-derived A/D/Q overlays');
    assert(new Set(cues.map(c=>c.text)).size===3,'All three keyboard overlays');
    await page.waitForTimeout(600);
    assert(await page.locator('.grenade-button').evaluate(e=>e.getAnimations().every(a=>a.playState==='finished')),'Ready settles after one pulse');
    await capture('charge-3');
    if(!touch){
      await page.keyboard.press('a');await advance(40);assert((await state()).player.selectedLane===1,'A lane');
      await page.keyboard.press('d');await advance(40);assert((await state()).player.selectedLane===2,'D lane');
      await page.keyboard.press('ArrowLeft');await advance(40);await page.keyboard.press('ArrowRight');await advance(40);
      assert((await state()).player.selectedLane===2,'Arrow controls unchanged');
    }
    await page.keyboard.press('q');await advance(100);
    const flight=await state();assert(flight.grenade.inventory===2&&flight.grenade.flight,'First charge consumed, reserve two');
    await page.keyboard.press('q');await advance(40);
    assert((await state()).grenade.inventory===2,'Q during flight preserves reserve');
    assert(await page.locator('.grenade-button').isDisabled(),'Button blocks concurrent flight');
    await page.evaluate(()=>{
      const a=window.__testApp,s=JSON.parse(JSON.stringify(a.simulation.getState()));a.simulation.restoreState(s);
      const restored=a.simulation.getState().grenade;
      if(restored.inventory!==2 || JSON.stringify(restored.flight)!==JSON.stringify(s.grenade.flight) || restored.acquiredAtSeconds!==s.grenade.acquiredAtSeconds)throw Error('Snapshot reserves/flight did not round-trip');
    });
    await capture('charge-2-flight');
    await page.keyboard.press('p');const paused=await state();await advance(1000);
    assert(JSON.stringify((await state()).grenade)===JSON.stringify(paused.grenade),'Pause freezes reserve and flight');
    await page.keyboard.press('p');await advance(800);await capture('charge-2');
    await page.locator('.grenade-button').click();await advance(800);
    assert((await state()).grenade.inventory===1,'Button consumes next reserve');await capture('charge-1');
    await page.evaluate(()=>document.activeElement.blur());
    await page.keyboard.press('q');await advance(800);
    assert((await state()).grenade.inventory===0,'Third Q consumes last charge');await capture('charge-0');
    const blasts=await page.evaluate(()=>window.__blasts.filter(e=>e.kind==='grenadeDetonated').map(e=>({kills:e.victims.filter(v=>v.killed).length,xp:e.victims.reduce((s,v)=>s+v.killXp,0)})));
    assert(blasts.length===3,'Exactly three detonations');
    await selectDevFixture(page,'grenade');
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.enemies=[];a.simulation.restoreState(s);});
    await advance(40);await page.keyboard.press('q');await advance(100);
    assert((await state()).grenade.inventory===3&&!(await state()).grenade.flight,'Invalid target preserves all three');
    await page.locator('.tuning-panel > summary').click();
    const labels=await page.locator('.dev-review-controls button').allTextContents();
    assert(labels.join(',')==='GRENADE,CURVE,EVOLVE,MG,LATE,MG7,MG8,CARNIVAL','Eight DEV review actions');await capture('dev-menu');
    await page.keyboard.press('Escape');await page.evaluate(()=>document.activeElement.blur());
    for(const [key,level] of [['4',4],['5',5],['6',6]]) {
      await page.keyboard.press(key);await advance(40);assert((await state()).progression.level===level,`DEV ${key}`);
      await capture(`lv${level}`);
    }
    await page.evaluate(()=>{const a=window.__testApp;a.devReviewFixture=null;a.retry();});await advance(40);
    assert((await state()).progression.level===1&&(await state()).grenade.inventory===0,'Retry unacquired');await capture('lv1');
    assert(!errors.length,errors.join('\n'));report.push({width,touch,cues,blasts,labels,errors});await page.close();
  }
  writeFileSync(`${out}/release-hud.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}

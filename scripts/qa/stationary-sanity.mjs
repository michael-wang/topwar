import { mkdirSync, writeFileSync } from 'node:fs';
import { selectDevFixture } from './dev-fixture-controls.mjs';
import assert from 'node:assert/strict';
const { chromium }=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/stage1-p25/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={portraits:{},errors:[]};
try {
  for(const width of [390,350]) {
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
    await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
    await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173');
    await page.getByRole('button',{name:'Start game with audio'}).tap();
    await page.waitForFunction(()=>window.__testApp.startup==='started');
    await page.evaluate(async()=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
      const {carnivalPilotLane,carnivalPilotGrenade}=await import('/scripts/qa/carnivalPilot.ts');
      const gpu=a.renderer.renderer,draw=gpu.render.bind(gpu);gpu.render=(...args)=>{if(!window.__skipDraw)draw(...args);};
      window.__advance=(ms,pilot=false)=>{
        window.__skipDraw=true;
        try {for(let t=0;t<ms;t+=100){const s=a.simulation.getFrameState();
          if(pilot){const lane=carnivalPilotLane(s);if(lane!==s.player.selectedLane)a.simulation.stepLane(lane<s.player.selectedLane?-1:1);
            if(carnivalPilotGrenade(s)) {window.dispatchEvent(new KeyboardEvent('keydown',{key:'q',code:'KeyQ'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'q',code:'KeyQ'}));}}
          window.__clock+=Math.min(100,ms-t);a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);
          if(a.simulation.getFrameState().player.z!==0)throw Error('Defense Z moved');
        }}finally{window.__skipDraw=false;}
        a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);
      };
    });
    const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
    const advance=(ms,pilot=false)=>page.evaluate(({ms,pilot})=>window.__advance(ms,pilot),{ms,pilot});
    const runs=[];
    for(const role of ['curve','evolve','carnival','late','mg7','mg8']) {
      await selectDevFixture(page,role);const initial=await state();
      await page.locator('.movement-right').tap();await advance(500);
      assert.equal((await state()).player.selectedLane,3);assert((await state()).player.x>0);
      await page.locator('.movement-left').tap();await advance(500);assert.equal((await state()).player.selectedLane,2);
      await page.getByRole('button',{name:'Pause game',exact:true}).tap();const frozen=await state();await advance(500);
      assert.deepEqual(await state(),frozen);await page.getByRole('button',{name:'Resume game',exact:true}).tap();await advance(100);
      if(['carnival','late','mg7','mg8'].includes(role)) {
        const inventory=(await state()).grenade.inventory;await page.locator('.grenade-button').tap();await advance(100);
        assert.equal((await state()).grenade.inventory,inventory-1);assert((await state()).grenade.flight);
      }
      const replay=await page.evaluate(async()=>{
        const a=window.__testApp,{pilotTuning}=await import('/scripts/qa/p15Pilot.ts'),saved=a.simulation.getState();
        const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
        const run=()=>{for(let i=0;i<120;i++)a.simulation.step(1/60,{targetX:0},pilotTuning);return JSON.stringify(canonical(a.simulation.getState()));};
        const expected=run();a.simulation.restoreState(JSON.parse(JSON.stringify(saved)));const match=run()===expected;
        a.simulation.restoreState(saved);a.fixedStepLoop.reset();return match;
      });assert(replay);
      await advance(role==='evolve'?2000:role==='curve'?45000:30000,true);const end=await state();
      assert(end.squad.count>0);assert.equal(end.player.z,0);
      if(role==='evolve'||role==='curve')assert(end.progression.level>=6);
      if(role==='carnival')assert.equal(end.carnival.status,'complete');
      await page.screenshot({path:`${out}/${width}-${role}.png`});
      await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rifleCounts:[],rocketCount:0,rifleRemainder:0};s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);window.__advance(100);});
      await page.getByRole('button',{name:'Retry',exact:true}).tap();assert.deepEqual(await state(),initial);
      runs.push({role,level:end.progression.level,elapsed:end.elapsedSeconds,z:end.player.z,enemies:end.enemies.length,pause:true,retry:true,replay});
    }
    results.portraits[width]=runs;console.log('Stationary checks passed',width);await page.close();
  }
  assert.deepEqual(results.errors,[]);
}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { selectDevFixture } from './dev-fixture-controls.mjs';
const {chromium}=await import(process.env.TOPWAR_PLAYWRIGHT_MODULE??'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.argv[2]??'artifacts/p26/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOPWAR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={portraits:{},errors:[]};
try {
  for(const width of [390,350]) {
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
    await page.route(/\/src\/main\.ts(\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('app.start();','window.__testApp=app;app.start();')});});
    // Explicit historical hit-count path; normal play keeps staged destruction.
    await page.route(/\/game-data\/game(?:\.[a-f0-9]+)?\.json(?:\?.*)?$/,async route=>{
      const response=await route.fetch(),data=await response.json();delete data.catharsis.grenade.supplyDestruction;
      await route.fulfill({response,body:JSON.stringify(data)});
    });
    await page.goto(process.env.TOPWAR_QA_URL??'http://127.0.0.1:5173');
    await page.getByRole('button',{name:'Start game with audio'}).tap();await page.waitForFunction(()=>window.__testApp.startup==='started');
    await page.evaluate(()=>{
      const a=window.__testApp;cancelAnimationFrame(a.frameId);window.__clock=0;
      const gpu=a.renderer.renderer,draw=gpu.render.bind(gpu);gpu.render=(...args)=>{if(!window.__skipDraw)draw(...args);};
      window.__advance=(ticks,draw=true)=>{
        window.__skipDraw=!draw;try{for(let i=0;i<ticks;i++){window.__clock+=1000/60;a.renderFrame(window.__clock);cancelAnimationFrame(a.frameId);}}
        finally{window.__skipDraw=false;}
      };
    });
    const advance=(ticks,draw=true)=>page.evaluate(({ticks,draw})=>window.__advance(ticks,draw),{ticks,draw});
    const state=()=>page.evaluate(()=>window.__testApp.simulation.getState());
    const edges=async name=>{
      const r=await page.locator('.combat-control-strip').boundingBox();
      await page.screenshot({path:`${out}/${width}-${name}-edges.png`,clip:{x:0,y:Math.floor(r.y)-7,width,height:Math.ceil(r.height)+16}});
    };
    const controls=[];
    for(const inset of [0,20,34]) {
      await page.locator('.beachhead-defense').evaluate((v,inset)=>{
        v.style.setProperty('--hud-inset-bottom',`${inset}px`);
        v.style.setProperty('--hud-inset-top',inset===34?'44px':'0px');
        for(const side of ['left','right'])v.style.setProperty(`--hud-inset-${side}`,inset===34?'8px':'0px');
      },inset);
      await page.evaluate(()=>document.activeElement?.blur());await advance(1);
      const boxes=await page.locator('.movement-button,.xp-hud').evaluateAll(bs=>bs.map(b=>({class:b.className,rect:b.getBoundingClientRect().toJSON()})));
      for(const {rect:r}of boxes)assert(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<844-inset);
      for(const [i,{rect:a}]of boxes.entries())for(const {rect:b}of boxes.slice(i+1))assert(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y);
      await edges(`${inset}-normal`);
      for(const side of ['left','right']) {
        const b=page.locator(`.movement-${side}`),r=await b.boundingBox();
        await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await advance(1);
        assert(await b.evaluate(b=>b.classList.contains('is-held')));await edges(`${inset}-held-${side}`);await page.mouse.up();
      }
      await page.keyboard.press('Tab');
      for(const side of ['left','right']) {
        await page.locator(`.movement-${side}`).focus();
        assert(await page.locator(`.movement-${side}`).evaluate(b=>b.matches(':focus-visible')));await edges(`${inset}-focus-${side}`);
      }
      await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(1);const frozen=await state();await advance(30);
      assert.deepEqual(await state(),frozen);assert(await page.locator('.movement-left').isDisabled());await edges(`${inset}-disabled`);
      await page.getByRole('button',{name:'Resume game',exact:true}).tap();await advance(1);controls.push({inset,boxes,pause:true});
    }
    await page.locator('.beachhead-defense').evaluate(v=>{for(const side of ['top','bottom','left','right'])v.style.setProperty(`--hud-inset-${side}`,'0px');});
    // Authoritative QA setup, then ordinary scheduler and automatic weapon hits.
    await page.evaluate(()=>{
      const a=window.__testApp;a.retry();const s=a.simulation.getState();s.progression={level:3,xp:0};s.enemies=[];
      s.defenseWaves.nextAtSeconds=1000;s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=[1000];
      s.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:null,acquiredAtSeconds:null,inventory:0,supply:null,flight:null};
      a.simulation.restoreState(s);a.fixedStepLoop.reset();
    });
    await advance(490,false);await advance(1);
    const spawned=await state();assert.equal(spawned.grenade.supply.hitsRequired,10);assert.equal(spawned.grenade.supply.hitProgress,0);
    assert(Math.abs(spawned.grenade.supplySpawnedAtSeconds-8)<.02);
    await page.screenshot({path:`${out}/${width}-supply-before.png`});
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.weapons.rifleCooldownRemainingSeconds=0;s.weapons.rifleMemberCooldowns=[0];a.simulation.restoreState(s);});
    let partial,hitVisual;const hits=[];
    for(let tick=0;tick<220;tick++) {
      await advance(1);const s=await state(),progress=s.grenade.supply?.hitProgress??10;
      if(progress&&!hits.includes(progress)) {
        hits.push(progress);assert.equal(s.progression.xp,0);assert.equal(s.enemies.length,0);
        if(progress<10)assert.equal(s.grenade.inventory,0);
        if(progress===1) {
          hitVisual=await page.evaluate(()=>{const a=window.__testApp,crate=a.renderer.grenadeRenderer.crate;return{visible:crate.group.visible,pulseAge:a.presentationMs-crate.hitAtMs,emissive:crate.wood.emissiveIntensity};});
          assert(hitVisual.visible&&hitVisual.pulseAge>=0&&hitVisual.pulseAge<160&&hitVisual.emissive>.08);await page.screenshot({path:`${out}/${width}-supply-hit.png`});
        }
        if(progress===4) {
          partial=s;await page.getByRole('button',{name:'Pause game',exact:true}).tap();await advance(20);assert.deepEqual(await state(),partial);
          await page.getByRole('button',{name:'Resume game',exact:true}).tap();
          await page.evaluate(()=>window.__testApp.retry());assert.equal((await state()).grenade.supply,null);assert.equal((await state()).progression.level,1);
          await page.evaluate(saved=>{window.__testApp.simulation.restoreState(JSON.parse(JSON.stringify(saved)));window.__testApp.fixedStepLoop.reset();},partial);
          assert.deepEqual(await state(),partial);
        }
        if(progress===9)await page.screenshot({path:`${out}/${width}-supply-nine.png`});
      }
      if(!s.grenade.supply){assert.equal(s.grenade.inventory,3);break;}
    }
    assert.deepEqual(hits,[1,2,3,4,5,6,7,8,9,10]);await page.screenshot({path:`${out}/${width}-supply-acquired.png`});
    await selectDevFixture(page,'late6');const initial=await state();
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.grenade.inventory=2;s.enemies=[];s.defenseWaves.nextAtSeconds=1000;
      s.weapons.rifleMemberCooldowns=[1000];s.weapons.rifleCooldownRemainingSeconds=1000;a.simulation.restoreState(s);});
    await advance(1810,false);await advance(1);assert.equal((await state()).grenade.supply.rewardAmount,1);
    assert.equal((await state()).grenade.supply.hitsRequired,10);
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.player.selectedLane=s.grenade.supply.lane;s.player.x=s.grenade.supply.x;
      s.weapons.rifleMemberCooldowns=[0];s.weapons.rifleCooldownRemainingSeconds=0;a.simulation.restoreState(s);});
    for(let tick=0;tick<180&&(await state()).grenade.supply;tick++)await advance(1);
    assert.equal((await state()).grenade.inventory,3);assert.equal((await state()).grenade.supply,null);
    await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState();s.squad={count:0,rifleCounts:[],rocketCount:0,rifleRemainder:0};s.weapons.rifleMemberCooldowns=[];a.simulation.restoreState(s);});
    await advance(60,false);await page.getByRole('button',{name:'Retry',exact:true}).tap();assert.deepEqual(await state(),initial);
    results.portraits[width]={controls,hits,hitVisual,partialRestore:true,recurringMg:true,retry:true};console.log('P2.6 passed',width);await page.close();
  }
  assert.deepEqual(results.errors,[]);
}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}

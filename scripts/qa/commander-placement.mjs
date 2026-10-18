// Actual GameApp/Simulation frames; QA hooks exist only in intercepted browser responses.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.TOPWAR_PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'artifacts/p4.44a';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5177, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.TOPWAR_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
async function frames(page) {
  await page.evaluate(() => {
    const a = window.__testApp; cancelAnimationFrame(a.frameId);
    window.__stamp = a.previousFrameTimestampMs ?? performance.now();
    window.__draw = () => { a.renderFrame(window.__stamp); cancelAnimationFrame(a.frameId); };
    window.__advance = seconds => {
      const gpu = a.renderer.renderer, render = gpu.render; gpu.render = () => {};
      try { for (let i = 0; i < Math.ceil(seconds * 60); i++) { window.__stamp += 1000 / 60; window.__draw(); } }
      finally { gpu.render = render; } window.__draw();
    }; window.__draw();
  });
}
async function capture(page, width, variant, placement, name) {
  const data = await page.evaluate(() => {
    const a = window.__testApp, s = a.simulation.getState(), panel = document.querySelector('.field-observer');
    const box = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom }; };
    const visible = e => !!e && e.checkVisibility() && !e.closest('[hidden]');
    const union = rs => ({ x:Math.min(...rs.map(r=>r.x)), y:Math.min(...rs.map(r=>r.y)), right:Math.max(...rs.map(r=>r.right)), bottom:Math.max(...rs.map(r=>r.bottom)) });
    const projected = group => {
      const points=[]; group.updateWorldMatrix(true,true);
      group.traverse(o=>{ if(!o.isMesh || !o.visible) return; let p=o; while(p && p!==group){if(!p.visible)return;p=p.parent;}
        o.geometry.computeBoundingBox(); const b=o.geometry.boundingBox;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
          const v=a.renderer.camera.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(a.renderer.camera);
          points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});
        }
      });
      return points.length ? {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))}:null;
    };
    let commander = null, commanderParts = [];
    if (visible(panel)) { const r=box(panel); r.right+=3;r.bottom+=3; commanderParts=[r,...[...panel.querySelectorAll('img,.observer-fallback,.commander-skip')].filter(visible).map(box)]; commander=union(commanderParts); }
    const targets={};
    for(const selector of ['.xp-hud','.xp-loadout','.grenade-button','.manual-air-support','.tank-entrance-warning span','.artillery-emergency span','.commander-skip'])
      for(const [i,e]of [...document.querySelectorAll(selector)].entries())if(visible(e)){const r=box(e);if(selector.includes('artillery-emergency')){r.x-=2;r.right+=2;r.y-=2;r.bottom+=5;}targets[selector+':'+i]=r;}
    for(const [i,e]of [...document.querySelectorAll('button')].entries())if(visible(e)&& /左|右/.test(e.getAttribute('aria-label')??''))targets['arrow:'+i]=box(e);
    for(const [i,m]of a.renderer.squadRenderer.members.entries())if(m.group.visible)targets['soldier:'+i]=projected(m.group);
    for(const [i,g]of a.renderer.enemyRenderer.giantRenderers.entries())if(g.group.visible)targets['giant:'+i]=projected(g.group);
    const intersections={};
    if(commander)for(const [key,r]of Object.entries(targets)){if(!r||key.startsWith('.commander-skip'))continue;const hits=commanderParts.map(part=>({width:Math.max(0,Math.min(r.right,part.right)-Math.max(r.x,part.x)),height:Math.max(0,Math.min(r.bottom,part.bottom)-Math.max(r.y,part.y))})).filter(hit=>hit.width*hit.height);if(hits.length)intersections[key]=hits;}
    return {state:JSON.stringify(s),commander,commanderParts,panel:visible(panel)?box(panel):null,subtitle:visible(panel)?panel.querySelector('p').textContent:null,targets,intersections,lane:s.player.selectedLane,elapsed:s.elapsedSeconds,giants:s.enemies.filter(e=>e.archetype==='giant'&&e.hp>0).length,paused:a.paused,fullscreen:!!document.fullscreenElement,font:getComputedStyle(panel.querySelector('p')).font,voice:a.audio.voice?.message};
  });
  data.stateHash=createHash('sha256').update(data.state).digest('hex');delete data.state;
  if(name!=='continue-paused')assert(data.commander,`Missing real Commander: ${name}`);
  if(name==='giant'){assert(data.giants>0);assert(data.targets['giant:0']);assert(data.subtitle.includes('巨型'));}
  if(data.panel){assert.equal(data.panel.right-data.panel.x,310);assert.equal(data.panel.bottom-data.panel.y,88);assert.equal(data.font,'600 13px / 17.94px system-ui, sans-serif');}
  if(data.panel && placement==='a'){
    assert.equal(data.panel.x,(width-310)/2);
    assert(Math.abs(data.panel.y-(844*.64+(variant==='safe-fullscreen'?24*.36-20*.64:0)))<.02);
  }
  const file = `${width}-${variant}-${placement}-${name}.png`;
  await page.screenshot({ path:`${out}/${file}`, scale:'css' });
  results.push({width,variant,placement,name,file,...data});
  if(placement==='a'){
    const original=results.find(r=>r.width===width&&r.variant===variant&&r.name===name&&r.placement==='original');
    assert.equal(data.stateHash,original.stateHash,`Placement changed authoritative state: ${file}`);
  }
  if(data.commander) for(const key of Object.keys(data.intersections)) assert(!/^\.xp-|^arrow:|^\.grenade|^\.manual/.test(key), `Protected control overlap: ${file} ${key}`);
  writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  console.log(file,JSON.stringify(data.intersections));
}
async function scene(page,role,seconds){
  if(!await page.locator('.tuning-panel').evaluate(e=>e.open))await page.locator('.tuning-panel > summary').tap();
  await page.locator(role===null?'[data-action="normal"]':`[data-role="${role}"]`).tap();
  await page.evaluate(seconds=>{cancelAnimationFrame(window.__testApp.frameId);window.__draw();window.__advance(seconds);},seconds);
}
try {
 for(const width of [350,390])for(const variant of ['normal','safe-fullscreen'])for(const placement of ['original','a']) {
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:variant==='safe-fullscreen'?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch(),body=await response.text();assert(body.includes('app = new GameApp('));await route.fulfill({response,body:body.replace('app = new GameApp(','app = window.__testApp = new GameApp(')});});
  // Pin only the new-run seed source in the test response so paired normal runs are comparable.
  // The original Simulation, RNG, input, encounters and checkpoint code execute unchanged.
  await page.route(/\/src\/app\/GameApp\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch(),body=await response.text();assert(body.includes('crypto.getRandomValues(randomWord);'));await route.fulfill({response,body:body.replace('crypto.getRandomValues(randomWord);','randomWord[0] = 17476;')});});
  await page.goto(`http://127.0.0.1:5177/topwar/${placement==='a'?'?commander-placement=a':''}`);
  await page.getByRole('button',{name:'開始遊戲',exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'開始遊戲',exact:true}).tap();
  await page.waitForFunction(()=>window.__testApp.startup==='started');
  if(variant==='normal')await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await frames(page);
  await page.waitForFunction(()=>['missionIntro','tankBoss','victory','destroyer'].every(m=>window.__testApp.audio.radioDurationSeconds('zh-TW',m)>0));
  if(variant==='safe-fullscreen')await page.evaluate(()=>{const host=document.querySelector('.beachhead-defense');host.style.setProperty('--hud-inset-top','24px');host.style.setProperty('--hud-inset-bottom','20px');});
  await scene(page,null,.8);
  const snap=name=>capture(page,width,variant,placement,name);
  await snap('first');await page.evaluate(()=>window.__advance(2.4));await snap('long');
  for(const lane of [0,1,2,3,4]){
    await page.evaluate(lane=>{const a=window.__testApp;while(a.simulation.getState().player.selectedLane!==lane)a.simulation.stepLane(lane<a.simulation.getState().player.selectedLane?-1:1);window.__advance(.12);},lane);
    await snap(`lane-${lane+1}`);
  }
  await scene(page,'naval',1.5);await snap('naval');
  await scene(page,'boss-intro',.8);await snap('boss-warning');
  await page.getByRole('button',{name:'暫停遊戲',exact:true}).tap();
  const saved=await page.evaluate(()=>window.__testApp.simulation.getState());
  await page.reload();await page.getByRole('button',{name:'繼續上次遊戲'}).tap();await page.locator('.session-recovery').waitFor({state:'detached'});
  await frames(page);assert.deepEqual(await page.evaluate(()=>window.__testApp.simulation.getState()),saved);assert(await page.evaluate(()=>window.__testApp.paused));
  if(variant==='safe-fullscreen')await page.evaluate(()=>{const host=document.querySelector('.beachhead-defense');host.style.setProperty('--hud-inset-top','24px');host.style.setProperty('--hud-inset-bottom','20px');});
  await snap('continue-paused');await page.locator('.hud-actions').getByRole('button',{name:'繼續遊戲',exact:true}).tap();
  await page.evaluate(()=>{window.__draw();const s=window.__testApp.simulation.getState();window.__advance(Math.max(0,s.defenseTank.activeAtSeconds+.3-s.elapsedSeconds));});await snap('boss-active');
  let emergency=false;
  for(let i=0;i<120;i++){
    emergency=await page.evaluate(()=>{const a=window.__testApp,s=a.simulation.getState(),shell=s.artillery.shells[0];if(shell)while(a.simulation.getState().player.selectedLane!==shell.targetLane)a.simulation.stepLane(shell.targetLane<a.simulation.getState().player.selectedLane?-1:1);window.__advance(.05);return !document.querySelector('.artillery-emergency').hidden;});
    if(emergency)break;
  }
  if(emergency)await snap('emergency');else console.log('Emergency not reproduced',width,placement);
  for(const lane of [0,4]){
    await scene(page,'boss-intro',.8);
    await page.evaluate(lane=>{const a=window.__testApp;while(a.simulation.getState().player.selectedLane!==lane)a.simulation.stepLane(lane<a.simulation.getState().player.selectedLane?-1:1);},lane);
    let shown=false;
    for(let i=0;i<120;i++){shown=await page.evaluate(()=>{window.__advance(.05);return !document.querySelector('.artillery-emergency').hidden;});if(shown)break;}
    assert(shown,`Outer-lane emergency not reproduced: ${lane}`);await snap(`emergency-lane-${lane+1}`);
  }
  // Reuse the existing DEV GIANT fixture through its normal retry lifecycle, no fabricated UI or altered snapshot.
  await page.evaluate(()=>{const a=window.__testApp;a.devReviewFixture='giant';a.retry();cancelAnimationFrame(a.frameId);window.__draw();window.__advance(.3);});await snap('giant');
  await scene(page,'air-support',.2);await snap('support');
  await scene(page,'victory',4.3);await snap('victory');
  assert(await page.getByRole('button',{name:'略過',exact:true}).isVisible());await page.getByRole('button',{name:'略過',exact:true}).tap();await page.evaluate(()=>window.__advance(.2));
  assert(!await page.locator('.field-observer').isVisible());assert.deepEqual(errors,[]);await page.close();
 }
 const keys=[...new Set(results.map(r=>`${r.width}|${r.variant}|${r.name}`))];
 writeFileSync(`${out}/index.html`,`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>P4.44a Commander A</title><style>body{background:#15222d;color:#eee;font:16px system-ui;margin:24px}section{margin-bottom:40px}.pair{display:flex;gap:16px;align-items:start}figure{margin:0}img{display:block;max-width:none}pre{white-space:pre-wrap}</style><h1>P4.44a — 原版 / A 真實遊戲對照</h1><p>DEV placement trial; desktop diagnostics, not Pixel 8 acceptance. Safe-fullscreen uses simulated 24px/20px insets and reduced motion. Soldier/alert intersections are recorded below, including 110px portrait and 3px shadow.</p>${keys.map(key=>{const rows=results.filter(r=>`${r.width}|${r.variant}|${r.name}`===key);return `<section><h2>${key}</h2><div class="pair">${rows.map(r=>`<figure><figcaption>${r.placement}</figcaption><img width="${r.width}" height="844" src="${r.file}"><pre>${JSON.stringify({commander:r.commander,intersections:r.intersections,subtitle:r.subtitle},null,2)}</pre></figure>`).join('')}</div></section>`;}).join('')}</html>`);
} finally {await browser.close();await server.close();}

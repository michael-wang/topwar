// QA-only deterministic portraits; shipping camera, lighting and projection.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { baselineServer } from './baseline-server.mjs';
const phase = process.argv[2] ?? 'polish', out = 'artifacts/rounded-toy-r1';
const server = phase === 'baseline' ? await baselineServer() : null;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = [], requests = new Map();
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', async r => { if (r.url().endsWith('.glb')) requests.set(r.url(), (await r.body()).length); });
await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
  const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;') });
});
await page.goto(`${server ? 'http://127.0.0.1:5180' : 'http://127.0.0.1:5173'}/?review=threats`);
await page.waitForSelector('canvas'); await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
await page.evaluate(async () => {
  const a = window.__testApp, { projectRenderState } = await import('/src/app/projectRenderState.ts');
  const state = a.simulation.getState();
  window.__reviewState = state;
  window.__fixture = projectRenderState(state, { catharsis: state.catharsis, trackHalfWidth: 3.2, formationSpacing: .45, defenseLineOffset: 1.5, bossVisualScale: 7 });
  window.__draw = (frame, now, review = false) => {
    a.xpHud.reset(); a.xpHud.update({ level: review ? 7 : 1, xp: 0 }, state.catharsis.balance.progression, now,
      { baseFireRate: a.runtimeTuning.fireRate, squadCount: frame.squad.count, initialSquadCount: 1, reinforcementArrived: review });
    a.renderer.render(frame, now);
  };
});
const stats = {};
const cases = ['normal', 'review-opening', 'mixed-threats', 'one-heavy-crowd', 'heavy-hit', 'heavy-death', 'heavy-contact',
  'giant-reveal', 'giant-hit', 'giant-fall', 'giant-crash', 'giant-debris', 'giant-hp', 'giant-hp-100', 'giant-hp-50', 'giant-hp-10', 'giant-hp-0',
  'player-guard', 'grunt-guard', 'grunt-hit-guard', 'grunt-death-guard', 'grunt-contact-guard', 'world-guard', 'boss-guard', 'boss-death-guard',
  'mixed-50', 'mixed-100', 'mixed-150', 'mixed-200', 'giants-two'];
for (const key of cases) {
  stats[key] = await page.evaluate(key => {
    const a = window.__testApp, r = a.renderer, f = structuredClone(window.__fixture), draw = window.__draw;
    r.resetFeedback(); r.resize();
    const g = { ...f.enemies[0], id: 100, x: 0, z: 7 }, h = { ...f.enemies[1], id: 101, x: 0, z: 10 }, giant = { ...f.enemies[2], id: 102, x: 0, z: 22 };
    const crowd = (count, heavyRatio = 0) => Array.from({ length: count }, (_, i) => ({ ...(i % 5 === 0 && heavyRatio ? h : g), id: 200 + i,
      lane: i % 5, x: (i % 5 - 2) * 1.4 + Math.sin(i * 2.4) * .18, z: 7 + Math.floor(i / 5) * .8 }));
    if (key === 'normal') { f.enemies = crowd(35); f.squad.count = 1; f.squad.rifleCounts = [1]; f.reinforcement = undefined; }
    if (key === 'mixed-threats') f.enemies = [...crowd(35), h, giant];
    if (key === 'one-heavy-crowd') f.enemies = [...crowd(20), { ...h, x: 1.4, z: 7 }];
    if (key.startsWith('heavy-')) f.enemies = [h];
    if (key.startsWith('giant-')) f.enemies = [giant];
    if (key.startsWith('giant-hp-')) f.enemies[0].hp = f.enemies[0].maxHp * Number(key.split('-')[2]) / 100;
    if (key === 'giants-two') f.enemies = [giant, { ...giant, id: 103, x: 1.4, z: 32 }];
    if (key.includes('guard')) {
      f.enemies = []; f.squad.count = key === 'player-guard' ? 1 : 0; f.squad.rifleCounts = key === 'player-guard' ? [1] : [];
      f.reinforcement = undefined;
      if (key.startsWith('grunt')) f.enemies = [g];
      if (key.startsWith('boss')) f.boss = { id: 777, tier: 1, x: 0, z: 15, hp: 100, maxHp: 100, visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    }
    if (/^mixed-\d+$/.test(key)) f.enemies = crowd(Number(key.split('-')[1]), .2);
    draw(f, 0, key === 'review-opening'); draw(f, key === 'giant-reveal' ? 500 : 2000, key === 'review-opening');
    if (key.includes('-hit')) { f.enemies[0].hp -= .5; draw(f, 2010); draw(f, 2040); }
    if (key === 'heavy-death' || key === 'grunt-death-guard') { f.enemies = []; draw(f, 2010); draw(f, 2180); }
    if (key === 'boss-death-guard') { f.boss = null; draw(f, 2010); draw(f, 2180); }
    if (['giant-fall', 'giant-crash', 'giant-debris'].includes(key)) {
      f.enemies = []; draw(f, 2010); draw(f, 2010 + ({ 'giant-fall': 350, 'giant-crash': 580, 'giant-debris': 900 }[key]));
    }
    if (key.includes('-contact')) {
      const e = f.enemies[0], before = { count: f.squad.count, rocketCount: 0, rifleCounts: [...f.squad.rifleCounts], rifleRemainder: 0 };
      r.present([{ kind: 'normalEnemyContact', enemyId: e.id, enemyTier: e.tier, attackerX: e.x, attackerZ: e.z, playerX: 0, playerZ: 0, before, after: before }], 2010, 3.2, .45);
      f.enemies = []; draw(f, 2010); draw(f, 2190);
    }
    window.__lastFrame = f;
    const result = r.getDebugStats();
    result.gpu = { geometries: r.renderer.info.memory.geometries, textures: r.renderer.info.memory.textures };
    return result;
  }, key);
  await page.screenshot({ path: `${out}/${phase}-${key}.png` });
}
// Whole gait periods through the real bounded renderer (no alternate animation).
for (const role of (phase === 'final' ? [] : ['grunt', 'heavy', 'giant'])) for (const percent of [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100]) {
  await page.evaluate(({ role, percent }) => {
    const a = window.__testApp, f = structuredClone(window.__fixture), e = f.enemies.find(e => e.archetype === role);
    f.enemies = [{ ...e, id: 0, x: 0, z: role === 'giant' ? 22 : 8 }];
    f.squad.count = 0; f.squad.rifleCounts = []; a.renderer.resetFeedback();
    window.__draw(f, 0); window.__draw(f, 2 * (role === 'grunt' ? 360 : role === 'heavy' ? 650 : 850) + percent / 100 * (role === 'grunt' ? 360 : role === 'heavy' ? 650 : 850));
    const r = a.renderer;
    for (const child of r.scene.children) if (child !== r.skyFill && child !== r.sunlight
      && !child.name.includes('toy-soldier') && !child.name.includes('heavy-hp')
      && child.name !== 'giant-assault-soldier' && child.name !== 'contact-shadow-enemy') child.visible = false;
    r.scene.background.set('white'); r.scene.fog = null; r.renderer.render(r.scene, r.camera);
  }, { role, percent });
  await page.screenshot({ path: `${out}/${phase}-${role}-gait-${percent}.png` });
}
// Actual Player lane motion, through the existing renderer/factory.
for (const age of [0,44,88,132,176,220]) {
  await page.evaluate(age => {
    const a=window.__testApp, f=structuredClone(window.__fixture), r=a.renderer;
    f.enemies=[]; f.squad.count=1; f.squad.rifleCounts=[1]; f.squad.reinforcement=undefined;
    r.resetFeedback(); window.__draw(f,2000);
    f.player.x=1.4; f.player.selectedLane=3; window.__draw(f,2010); window.__draw(f,2010+age);
    for(const c of r.scene.children) if(c!==r.skyFill&&c!==r.sunlight&&!c.getObjectByName('toy-soldier-body'))c.visible=false;
    r.scene.background.set('white');r.scene.fog=null;r.renderer.render(r.scene,r.camera);
  },age);
  await page.locator('canvas').screenshot({path:`${out}/${phase}-player-gait-${age}.png`});
}
const occupancy = {};
for (const role of (phase === 'final' ? [] : ['player', 'grunt', 'heavy', 'giant'])) {
  occupancy[role] = await page.evaluate(async role => {
    const r = window.__testApp.renderer, THREE = await import('/node_modules/.vite/deps/three.js');
    const f = structuredClone(window.__fixture); f.enemies = []; f.squad.count = 0; f.squad.rifleCounts = [];
    r.resetFeedback(); window.__draw(f, 2000);
    for (const child of r.scene.children) child.visible = false;
    const family = r.assets.families[role], group = new THREE.Group();
    const parts = [family.body, family.helmet, family.vest, family.weapon].filter(Boolean);
    for (const [i, part] of parts.entries()) {
      const material = part.material.clone();
      if (role === 'grunt' && i > 0) material.color.set((await import('/src/rendering/tierPalettes.ts')).ENEMY_PALETTE[0].body);
      if (role === 'player' && (i === 1 || i === 2)) material.color.set('#287fc6');
      const mesh = new THREE.Mesh(part.geometry, material); mesh.visible = part.visible;
      if (role === 'player' && part === family.weapon) { mesh.position.fromArray(family.presentation.weaponPosition); mesh.rotation.set(...family.presentation.weaponRotation); }
      group.add(mesh);
    }
    const enemy = window.__fixture.enemies.find(e => e.archetype === role);
    const scale = role === 'player' ? family.presentation.rootScale : enemy.visualScale;
    group.scale.set(enemy?.visualScaleX ?? scale, (enemy?.visualScaleY ?? scale) * (role === 'heavy' ? family.presentation.scaleY ?? 1 : 1), enemy?.visualScaleZ ?? scale);
    group.position.set(0, 0, role === 'giant' ? 22 : 7); group.rotation.set(role === 'giant' ? -.12 : -.15, Math.PI, 0);
    r.scene.add(group); r.skyFill.visible = r.sunlight.visible = true; r.scene.background = new THREE.Color('white'); r.scene.fog = null;
    r.camera.zoom = 1; r.camera.position.set(0, 6.5, -10); r.camera.lookAt(0, 0, 12.5); r.camera.updateProjectionMatrix();
    r.camera.updateMatrixWorld(true);
    const projected = new THREE.Box2(); group.updateMatrixWorld(true);
    for (const mesh of group.children) if (mesh.visible) {
      const p = mesh.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).project(r.camera);
        projected.expandByPoint(new THREE.Vector2((v.x + 1) * 195, (1 - v.y) * 422));
      }
    }
    window.__inspection = { group, family, role, THREE };
    r.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 'black' }); r.renderer.render(r.scene, r.camera);
    return { width: projected.max.x - projected.min.x, height: projected.max.y - projected.min.y,
      bounds: { min: projected.min.toArray(), max: projected.max.toArray() }, authoredCrown: family.helmet.geometry.boundingBox?.max.y };
  }, role);
  await page.locator('canvas').screenshot({ path: `${out}/${phase}-${role}-silhouette.png` });
  await page.evaluate(() => {
    const r = window.__testApp.renderer, { group } = window.__inspection;
    group.children.forEach((mesh, i) => mesh.visible = i === 1); r.renderer.render(r.scene, r.camera);
  });
  await page.locator('canvas').screenshot({ path: `${out}/${phase}-${role}-helmet.png` });
  await page.evaluate(() => {
    const r = window.__testApp.renderer; r.scene.overrideMaterial = null; r.renderer.render(r.scene, r.camera);
  });
  await page.locator('canvas').screenshot({ path: `${out}/${phase}-${role}-helmet-color.png` });
  if (['player', 'grunt', 'heavy', 'giant'].includes(role)) {
    for (const view of ['front', 'rear', 'side']) {
      await page.evaluate(view => {
        const r = window.__testApp.renderer, { group, THREE, family } = window.__inspection;
        group.children.forEach((mesh, i) => mesh.visible = [family.body, family.helmet, family.vest, family.weapon][i]?.visible ?? true);
        group.scale.setScalar(1); r.scene.overrideMaterial = null; r.scene.background = new THREE.Color('#d8c49b');
        const distance = window.__inspection.role === 'giant' ? 3.6 : 2.8;
        r.camera.position.set(view === 'side' ? distance : view === 'front' ? 1.4 : -1.4, 1.3, group.position.z + (view === 'side' ? 0 : view === 'front' ? -distance : distance));
        r.camera.lookAt(-.15, .60, group.position.z); r.camera.zoom = window.__inspection.role === 'giant' ? 1 : 1.1;
        r.camera.updateProjectionMatrix(); r.renderer.render(r.scene, r.camera);
      }, view);
      await page.locator('canvas').screenshot({ path: `${out}/${phase}-${role}-isolated-${view}.png` });
    }
  }
  await page.evaluate(() => { const r = window.__testApp.renderer; r.scene.remove(window.__inspection.group); r.scene.overrideMaterial = null; });
}
writeFileSync(`${out}/${phase}-stats.json`, JSON.stringify({ errors, viewport: { width: 390, height: 844, dpr: 2 },
  characterDownloads: { requests: requests.size, bytes: [...requests.values()].reduce((a, b) => a + b, 0) }, occupancy, stats }, null, 2));
await browser.close(); await server?.close(); if (errors.length) throw new Error(errors.join('\n'));

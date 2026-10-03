// QA-only deterministic scenes. Shipping camera, lighting and state projection.
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const phase = process.argv[2] ?? 'prototype', out = 'artifacts/grunt-chibi-prototype';
const baseline = '69768dc8b7a1dacfcee9d3fafe45972933977f3e';
let server;
if (phase === 'baseline') {
  const sources = new Map(['CharacterAssets.ts', 'CharacterVisualFamilies.ts', 'enemies/EnemyRenderer.ts'].map(file => {
    const path = `src/rendering/${file}`;
    return [resolve(path).replaceAll('\\', '/'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })];
  }));
  server = await createServer({ server: { host: '127.0.0.1', port: 5180, strictPort: true }, plugins: [{
    name: 'phase2b-baseline', enforce: 'pre', load(id) { return sources.get(id.split('?')[0]); },
  }] });
  await server.listen();
}
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = [], requests = new Map();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', async r => { if (r.url().endsWith('.glb')) requests.set(r.url().split('/').pop(), (await r.body()).length); });
await page.route(/\/src\/main\.ts(\?.*)?$/, async route => {
  const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace('app.start();', 'window.__testApp=app;') });
});
await page.goto(server ? 'http://127.0.0.1:5180/' : 'http://127.0.0.1:5173/');
await page.waitForSelector('canvas');
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
await page.evaluate(async () => {
  const a = window.__testApp, { projectRenderState } = await import('/src/app/projectRenderState.ts');
  const s = a.simulation.getState();
  s.player.x = 0; s.player.selectedLane = 2; s.elapsedSeconds = 4; s.progression = { level: 1, xp: 0 };
  s.enemies = Array.from({ length: 36 }, (_, i) => ({ id: 100 + i, tier: 1, archetype: i === 0 ? 'heavy' : 'grunt',
    hp: i === 0 ? 15 : 1, lane: i % 5, x: i === 0 ? 0 : (i % 5 - 2) * 1.4 + Math.sin(i * 2.4) * .35,
    z: s.player.z + (i === 0 ? 10 : 16 + (i * 1.618 % 22)) }));
  s.projectiles = []; s.boss = null; s.reinforcement = { startedAtSeconds: null, arrived: false };
  s.squad = { ...s.squad, count: 1, rocketCount: 0, rifleCounts: [1] };
  window.__fixture = projectRenderState(s, { catharsis: s.catharsis, trackHalfWidth: 3.2, formationSpacing: .45, defenseLineOffset: 1.5, bossVisualScale: 7 });
  window.__draw = (frame, now) => {
    a.xpHud.reset(); a.xpHud.update({ level: 1, xp: 0 }, s.catharsis.balance.progression, now,
      { baseFireRate: a.runtimeTuning.fireRate, squadCount: 1, initialSquadCount: 1, reinforcementArrived: false });
    a.renderer.render(frame, now);
  };
});
const stats = {};
const cases = ['normal', 'mixed-heavy', 'outer-lane', 'near-contact', 'hit', 'death', 'contact', 'asynchronous',
  'player-guard', 'heavy-guard', 'heavy-hit-guard', 'heavy-death-guard', 'heavy-contact-guard',
  'giant-guard', 'giant-contact-guard', 'boss-guard', 'boss-death-guard', 'world-guard', 'giants-two-guard', 'giants-collapse-guard',
  'crowd-50', 'crowd-100', 'crowd-150', 'crowd-200'];
for (const key of cases) {
  stats[key] = await page.evaluate(key => {
    const a = window.__testApp, r = a.renderer, frame = structuredClone(window.__fixture), draw = window.__draw;
    r.resetFeedback(); r.resize();
    const base = frame.enemies.find(e => e.archetype === 'grunt');
    const solo = { ...base, id: 0, x: 0, z: frame.player.z + 7, hp: 2, maxHp: 2 };
    if (key === 'normal') frame.enemies = frame.enemies.filter(e => e.archetype === 'grunt');
    if (['outer-lane', 'near-contact', 'hit', 'death', 'contact'].includes(key)) frame.enemies = [{ ...solo, x: key === 'outer-lane' ? 2.8 : 0, z: frame.player.z + (key === 'near-contact' || key === 'contact' ? 1.1 : 7) }];
    if (key === 'asynchronous') frame.enemies = Array.from({ length: 8 }, (_, i) => ({ ...solo, id: i, x: (i % 4 - 1.5) * 1.1, z: frame.player.z + 8 + Math.floor(i / 4) * 2 }));
    if (key.includes('guard')) {
      frame.enemies = []; if (key !== 'player-guard') { frame.squad.count = 0; frame.squad.rifleCounts = []; }
      if (key.startsWith('heavy')) frame.enemies = [{ ...window.__fixture.enemies[0], x: 0, z: frame.player.z + 7 }];
      if (key.startsWith('giant')) frame.enemies = [{ ...solo, id: 999, archetype: 'giant', hp: 124, maxHp: 124,
        z: frame.player.z + 23, visualScaleX: 3.4272, visualScaleY: 5.04, visualScaleZ: 5.04, gaitCycleMs: 850 }];
      if (key === 'giants-collapse-guard' || key === 'giants-two-guard') frame.enemies.push({ ...frame.enemies[0], id: 1001, x: 2, z: frame.player.z + 32 });
      if (key.startsWith('boss')) frame.boss = { id: 777, tier: 1, x: 0, z: frame.player.z + 15, hp: 100, maxHp: 100, visualScale: 7, engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    }
    if (key.startsWith('crowd-')) frame.enemies = Array.from({ length: Number(key.split('-')[1]) }, (_, i) => ({
      ...base, id: i, x: (i % 5 - 2) * 1.4 + Math.sin(i * 2.4) * .18, z: frame.player.z + 5 + Math.floor(i / 5) * .8,
    }));
    draw(frame, 1000); draw(frame, 2000);
    if (key === 'hit' || key === 'heavy-hit-guard') { frame.enemies[0].hp--; draw(frame, 2010); draw(frame, 2040); }
    if (key === 'death' || key === 'heavy-death-guard') { frame.enemies = []; draw(frame, 2010); draw(frame, 2180); }
    if (key === 'boss-death-guard') { frame.boss = null; draw(frame, 2010); draw(frame, 2180); }
    if (key === 'giants-collapse-guard') { frame.enemies.pop(); draw(frame, 2010); draw(frame, 2560); }
    if (key.includes('contact')) {
      if (key !== 'near-contact') {
        const e = frame.enemies[0], before = { count: frame.squad.count, rocketCount: 0, rifleCounts: [...frame.squad.rifleCounts], rifleRemainder: 0 };
        r.present([{ kind: 'normalEnemyContact', enemyId: e.id, enemyTier: e.tier, attackerX: e.x, attackerZ: e.z,
          playerX: 0, playerZ: frame.player.z, before, after: before }], 2010, 3.2, .45);
        frame.enemies = []; draw(frame, 2010); draw(frame, 2190);
      }
    }
    window.__lastFrame = frame;
    const result = r.getDebugStats();
    if (key.startsWith('crowd-')) {
      // Browser CPU diagnostic: renderer update only, after capacity warmup. Not phone FPS.
      const samples = [];
      for (let trial = 0; trial < 7; trial++) { const start = performance.now();
        for (let i = 0; i < 100; i++) r.enemyRenderer.update(frame.enemies, 4000 + i * 16);
        samples.push((performance.now() - start) / 100); }
      result.cpuUpdateMedianMs = samples.sort((a, b) => a - b)[3];
    }
    return result;
  }, key);
  await page.screenshot({ path: `${out}/${phase}-${key}.png` });
}
// Dedicated source inspection uses the shipping camera for actual-scale evidence.
await page.evaluate(async () => {
  const a = window.__testApp, r = a.renderer, THREE = await import('/node_modules/.vite/deps/three.js');
  const { enemyWalkPose, enemyRunFrame } = await import('/src/rendering/enemies/EnemyRenderer.ts');
  const frame = structuredClone(window.__fixture); frame.enemies = []; r.resetFeedback(); window.__draw(frame, 2000);
  for (const child of r.scene.children) child.visible = false;
  const family = r.assets.families.grunt, group = new THREE.Group();
  for (const [index, part] of [family.body, family.helmet, family.vest].entries()) {
    const material = part.material.clone(); if (index > 0) material.color.set('#b4443d');
    group.add(new THREE.Mesh(part.geometry, material));
  }
  group.position.set(0, 0, frame.player.z + 7); group.rotation.set(-.15, Math.PI, 0); group.scale.setScalar(.82);
  r.scene.add(group); window.__inspect = { THREE, group, family, enemyWalkPose, enemyRunFrame, cameraPosition: r.camera.position.clone(), cameraQuaternion: r.camera.quaternion.clone() };
  r.skyFill.visible = true; r.sunlight.visible = true; r.scene.background = new THREE.Color('white'); r.scene.fog = null;
  const projected = new THREE.Box2();
  for (const mesh of group.children) { mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).project(r.camera);
      projected.expandByPoint(new THREE.Vector2((point.x + 1) * 195, (1 - point.y) * 422)); }
  }
  window.__occupancy = { height: projected.max.y - projected.min.y, width: projected.max.x - projected.min.x,
    crown: family.helmet.geometry.boundingBox?.max.y, idleWidth: family.body.geometry.boundingBox?.max.x - family.body.geometry.boundingBox?.min.x };
  r.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 'black' }); r.renderer.render(r.scene, r.camera);
});
await page.locator('canvas').screenshot({ path: `${out}/${phase}-silhouette.png` });
for (const view of ['rear', 'front']) {
  await page.evaluate(view => {
    const r = window.__testApp.renderer, { group, THREE } = window.__inspect;
    r.scene.overrideMaterial = null; r.scene.background = new THREE.Color('#d8c49b');
    r.camera.position.set(view === 'front' ? -1.4 : 1.4, 1.3, group.position.z + (view === 'front' ? -2.4 : 2.4));
    r.camera.lookAt(0, .50, group.position.z); r.camera.zoom = 1.7; r.camera.updateProjectionMatrix(); r.renderer.render(r.scene, r.camera);
  }, view);
  await page.locator('canvas').screenshot({ path: `${out}/${phase}-isolated-${view}.png` });
}
// Run strip at actual projection, including all detached parts and constant helmet.
for (const age of [0, 60, 120, 180, 240, 300, 360]) {
  await page.evaluate(age => {
    const r = window.__testApp.renderer, { group, family, enemyWalkPose, enemyRunFrame, cameraPosition, cameraQuaternion } = window.__inspect;
    r.camera.position.copy(cameraPosition); r.camera.quaternion.copy(cameraQuaternion); r.camera.zoom = 1; r.camera.updateProjectionMatrix();
    group.children[0].geometry = family.runFrames[enemyRunFrame(0, age, 360)].geometry;
    const pose = enemyWalkPose(0, age, 360), sway = pose.leftArm * .075;
    group.rotation.set(0, 0, 0); group.position.y = pose.bob * .80;
    group.children.forEach((mesh, index) => mesh.rotation.set(-.15 + pose.leftLeg * .035, Math.PI, sway * [1, .82, .92][index]));
    r.renderer.render(r.scene, r.camera);
  }, age);
  await page.locator('canvas').screenshot({ path: `${out}/${phase}-gait-${age}ms.png` });
}
// Faction comparison: normalize ground-to-crown height, retaining each source silhouette.
await page.evaluate(() => {
  const r = window.__testApp.renderer, { group, THREE, cameraPosition, cameraQuaternion, family } = window.__inspect;
  group.children[0].geometry = family.body.geometry;
  group.rotation.set(-.15, Math.PI, 0); group.position.y = 0;
  group.children.forEach(mesh => mesh.rotation.set(0, 0, 0));
  r.camera.position.copy(cameraPosition); r.camera.quaternion.copy(cameraQuaternion); r.camera.zoom = 1; r.camera.updateProjectionMatrix();
  group.position.x = .55;
  const player = r.assets.families.player, defender = new THREE.Group();
  for (const part of [player.body, player.helmet, player.vest, player.weapon]) { const mesh = new THREE.Mesh(part.geometry, part.material);
    if (part === player.weapon) { mesh.position.fromArray(player.presentation.weaponPosition); mesh.rotation.set(...player.presentation.weaponRotation); } defender.add(mesh); }
  defender.position.set(-.55, 0, group.position.z); defender.rotation.set(-.15, Math.PI, 0); defender.scale.setScalar(.82);
  r.scene.add(defender); window.__inspect.defender = defender;
  r.scene.background = new THREE.Color('white'); r.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 'black' }); r.renderer.render(r.scene, r.camera);
});
await page.locator('canvas').screenshot({ path: `${out}/${phase}-player-grunt-silhouettes.png` });
await page.evaluate(() => {
  const r = window.__testApp.renderer, { group, defender } = window.__inspect;
  for (const g of [group, defender]) for (let i = 0; i < g.children.length; i++) g.children[i].visible = i === 1;
  r.renderer.render(r.scene, r.camera);
});
await page.locator('canvas').screenshot({ path: `${out}/${phase}-helmet-only.png` });
const occupancy = await page.evaluate(() => window.__occupancy);
writeFileSync(`${out}/${phase}-stats.json`, JSON.stringify({ baseline, errors, viewport: { width: 390, height: 844, dpr: 2 },
  characterDownloads: { requests: requests.size, bytes: [...requests.values()].reduce((a, b) => a + b, 0) }, occupancy, stats }, null, 2));
await browser.close(); await server?.close();
if (errors.length) throw new Error(errors.join('\n'));

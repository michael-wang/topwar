import * as THREE from 'three';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadCharacterAssets } from '../src/rendering/CharacterAssets';
import { canShareCrowdBatch, createLegacyCharacterVisualFamilies,
  type CharacterVisualFamilies, type LegacyCharacterResources } from '../src/rendering/CharacterVisualFamilies';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { BossRenderer } from '../src/rendering/boss/BossRenderer';
import type { EnemyRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';
import { characterFamilies } from './characterModel';

const enemy = (id: number, archetype: 'grunt' | 'heavy' | 'giant'): EnemyRenderState =>
  ({ id, archetype, tier: 1, hp: 15, maxHp: 15, x: id, z: 10, visualScale: 1 });
const contact = (id: number): PresentationEvent => ({ kind: 'normalEnemyContact', enemyId: id,
  enemyTier: 1, attackerX: id, attackerZ: 10, playerX: 0, playerZ: 0,
  before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
  after: { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 } });

describe('named character visual families', () => {
  it('loads each named resource once and preserves explicit sharing and disposal ownership', async () => {
    const models = new Map<string, THREE.Mesh>();
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => {
      // Resource completion order must not define semantic ownership.
      if (url.includes('run')) await new Promise(resolve => setTimeout(resolve, 1));
      const model = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
      models.set(url, model);
      return { scene: new THREE.Group().add(model) } as Awaited<ReturnType<GLTFLoader['loadAsync']>>;
    });
    try {
      const assets = await loadCharacterAssets();
      const model = (name: string) => models.get(`/models/toy-soldier-${name}.glb`)!;
      const { player, grunt, heavy, giant, boss } = assets.families;
      expect(load).toHaveBeenCalledTimes(13);
      expect(models.size).toBe(13);
      for (const name of ['body', 'vest', 'run-0', 'run-1', 'run-2', 'run-3'])
        expect(models.has(`/models/toy-soldier-${name}.glb`)).toBe(false);
      expect([player.role, grunt.role, heavy.role, giant.role, boss.role])
        .toEqual(['player', 'grunt', 'heavy', 'giant', 'boss']);
      expect(player.body.geometry.getAttribute('playerPart')).toBeDefined();
      expect(player.body).not.toBe(model('body'));
      expect(player.weapon).not.toBe(model('rifle'));
      expect(player.helmet).not.toBe(model('helmet'));
      expect(models.has('/models/toy-soldier-player-body.glb')).toBe(false);
      expect(models.has('/models/toy-soldier-rifle.glb')).toBe(false);
      expect(grunt.body).not.toBe(model('body'));
      expect(grunt.presentation.bodyTint).toBe('authored');
      expect(grunt.runFrames).toHaveLength(4);
      expect(grunt.runFrames.every(frame => ![...models.values()].includes(frame))).toBe(true);
      expect(grunt.death.body).not.toBe(model('gray-body'));
      expect(heavy).not.toBe(grunt);
      expect(heavy.body).not.toBe(model('body'));
      expect(heavy.body).not.toBe(grunt.body);
      expect(heavy.runFrames.every(frame => ![...models.values()].includes(frame))).toBe(true);
      expect(heavy.runFrames).not.toBe(grunt.runFrames);
      expect(heavy.contact).not.toBe(grunt.contact);
      expect(giant.body).not.toBe(model('body'));
      expect(giant.contact.body).not.toBe(model('body'));
      expect(giant.weapon).toBeDefined();
      expect(boss.body).toBe(model('boss-body'));
      expect(boss.vest).toBe(model('boss-vest'));
      expect(boss.runFrames).toEqual([0, 1, 2, 3].map(i => model(`boss-run-${i}`)));
      expect(boss.slamFrames).toEqual([0, 1, 2, 3].map(i => model(`boss-slam-${i}`)));
      expect(boss.grayBody).toBe(model('gray-body'));
      expect(assets.rewardHelmet).toBe(model('helmet'));
      expect(assets.bullet).toBe(model('bullet'));
      const disposals = [...models.values()].flatMap(mesh => [vi.spyOn(mesh.geometry, 'dispose'),
        vi.spyOn(mesh.material as THREE.Material, 'dispose'),
        vi.spyOn((mesh.material as THREE.MeshStandardMaterial).map!, 'dispose')]);
      disposals.push(...[player.body, player.helmet, player.vest, player.weapon].map(mesh => vi.spyOn(mesh.geometry, 'dispose')));
      disposals.push(...[...new Set([player.body, player.helmet, player.vest, player.weapon].map(mesh => mesh.material))]
        .map(material => vi.spyOn(material, 'dispose')));
      const gruntModels = [grunt.body, ...grunt.runFrames, grunt.helmet, grunt.vest, grunt.death.body];
      disposals.push(...gruntModels.map(mesh => vi.spyOn(mesh.geometry, 'dispose')));
      disposals.push(...[...new Set(gruntModels.map(mesh => mesh.material))].map(material => vi.spyOn(material, 'dispose')));
      const threatModels = [heavy.body, ...heavy.runFrames, heavy.helmet, heavy.vest, heavy.death.body,
        giant.body, ...giant.runFrames, giant.grayBody, giant.helmet, giant.vest, giant.weapon!, giant.contact.body];
      disposals.push(...[...new Set(threatModels.map(mesh => mesh.geometry))].map(g => vi.spyOn(g, 'dispose')));
      disposals.push(...[...new Set(threatModels.map(mesh => mesh.material))].map(m => vi.spyOn(m, 'dispose')));
      assets.dispose();
      for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    } finally { load.mockRestore(); }
  });

  it.each(['normalIdle', 'grayIdle', 'playerBody', 'helmet', 'vest', 'rifle', 'bossIdle', 'bossVest'] as const)
  ('rejects missing required %s by name', name => {
    const f = characterFamilies();
    const resources: LegacyCharacterResources = { normalIdle: f.grunt.body, normalRuns: f.grunt.runFrames,
      grayIdle: f.grunt.death.body, playerBody: f.player.body, helmet: f.player.helmet,
      vest: f.player.vest, rifle: f.player.weapon, bossIdle: f.boss.body,
      bossRuns: f.boss.runFrames, bossSlams: f.boss.slamFrames, bossVest: f.boss.vest };
    expect(() => createLegacyCharacterVisualFamilies({ ...resources, [name]: undefined } as unknown as LegacyCharacterResources))
      .toThrow(`Missing character resource: ${name}`);
  });

  it.each(['normalRuns', 'bossRuns', 'bossSlams'] as const)('rejects incomplete %s pose families', name => {
    expect(() => characterFamilies({ [name]: [] })).toThrow(`Character resource ${name} requires four baked poses`);
  });

  it('keeps the contract free of combat fields', () => {
    type Family = CharacterVisualFamilies[keyof CharacterVisualFamilies];
    expectTypeOf<Family>().not.toHaveProperty('hp');
    expectTypeOf<Family>().not.toHaveProperty('damage');
    expectTypeOf<Family>().not.toHaveProperty('speed');
    expectTypeOf<Family>().not.toHaveProperty('fireRate');
    expectTypeOf<Family>().not.toHaveProperty('xp');
    expectTypeOf<Family>().not.toHaveProperty('lane');
  });

  it('retains one live batch for matching legacy Grunt/Heavy resources', () => {
    const families = characterFamilies(), scene = new THREE.Scene();
    expect(canShareCrowdBatch(families.grunt, families.heavy)).toBe(true);
    const renderer = new EnemyRenderer(scene, families);
    renderer.update([enemy(1, 'grunt'), enemy(2, 'heavy')], 1000);
    const runs = scene.children.filter(c => c.name.startsWith('toy-soldier-run-')) as THREE.InstancedMesh[];
    expect(runs).toHaveLength(4);
    expect(runs.reduce((count, mesh) => count + mesh.count, 0)).toBe(2);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('splits a batch when otherwise shared secondary geometry has different visibility', () => {
    const families = characterFamilies();
    const hidden = families.grunt.vest.clone(); hidden.visible = false;
    expect(canShareCrowdBatch({ ...families.grunt, vest: hidden }, families.heavy)).toBe(false);
  });

  it('isolates live geometry, hit overlays, HP bounds and pooled feedback when only Grunt changes', () => {
    const legacy = characterFamilies(), replacement = characterFamilies();
    replacement.grunt.helmet.geometry.scale(1, 8, 1);
    const families = { ...legacy, grunt: replacement.grunt }, scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, families);
    const grunt = enemy(1, 'grunt'), heavy = enemy(2, 'heavy'), giant = enemy(3, 'giant');
    renderer.update([grunt, heavy, giant], 1000);
    const runs = scene.children.filter(c => c.name.startsWith('toy-soldier-run-')) as THREE.InstancedMesh[];
    expect(runs).toHaveLength(8);
    expect(runs.filter(mesh => mesh.count > 0).map(mesh => mesh.geometry)).toEqual([
      replacement.grunt.runFrames[enemyRunFrame(1, 1000, 360)].geometry,
      legacy.heavy.runFrames[enemyRunFrame(2, 1000, 650)].geometry]);
    const bar = scene.getObjectByName('heavy-hp-backing')!;
    expect(bar.position.y).toBeCloseTo(.8); // Legacy box top .5 + existing .3 offset.
    const giantGroup = scene.getObjectByName('giant-assault-soldier')!;
    expect(legacy.giant.runFrames.map(model => model.geometry)).toContain((giantGroup.children[0] as THREE.Mesh).geometry);
    expect((giantGroup.children[1] as THREE.Mesh).geometry).toBe(legacy.giant.helmet.geometry);
    renderer.update([grunt, { ...heavy, hp: 14 }, giant], 1050);
    const wash = scene.getObjectByName('heavy-hit-body') as THREE.Mesh;
    expect(wash.geometry).toBe(legacy.heavy.runFrames[enemyRunFrame(2, 1050, 650)].geometry);

    renderer.present([contact(grunt.id)], 1100);
    renderer.update([heavy, giant], 1100);
    const exchange = scene.getObjectByName('enemy-contact-exchange')!;
    expect((exchange.children[0] as THREE.Mesh).geometry).toBe(replacement.grunt.contact.body.geometry);
    renderer.update([heavy, giant], 1400);
    renderer.present([contact(heavy.id)], 1450);
    renderer.update([giant], 1450);
    expect((exchange.children[0] as THREE.Mesh).geometry).toBe(legacy.heavy.contact.body.geometry);
    expect((exchange.children[0] as THREE.Mesh).material).not.toBe(replacement.grunt.body.material);
    renderer.update([giant], 1800);
    renderer.present([contact(giant.id)], 1850);
    renderer.update([], 1850);
    expect((exchange.children[0] as THREE.Mesh).geometry).toBe(legacy.giant.contact.body.geometry);
    expect(renderer.getDebugStats().contactVisuals).toBe(1);

    renderer.update([grunt], 2200); renderer.update([], 2250);
    const corpse = scene.children.find(c => c instanceof THREE.Group
      && (c.children[0] as THREE.Mesh)?.geometry === replacement.grunt.death.body.geometry)!;
    expect(corpse).toBeDefined();
    renderer.update([], 2800); renderer.update([heavy], 2850); renderer.update([], 2900);
    expect((corpse.children[0] as THREE.Mesh).geometry).toBe(legacy.heavy.death.body.geometry);
    expect((corpse.children[1] as THREE.Mesh).geometry).toBe(legacy.heavy.death.helmet.geometry);
    expect(renderer.getDebugStats().deathVisuals).toBe(1);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps Player and Boss selection independent of a Grunt replacement', () => {
    const legacy = characterFamilies(), families = { ...legacy, grunt: characterFamilies().grunt };
    const playerScene = new THREE.Scene(), bossScene = new THREE.Scene();
    const player = new SquadRenderer(playerScene, families.player);
    player.update({ player: { x: 0, z: 0 }, squad: { count: 1, rocketCount: 0, rifleCounts: [1], formationSpacing: .45 },
      track: { halfWidth: 2.5, defenseLineZ: -1.5 }, enemies: [], boss: null,
      streamRewards: [], gates: [], pickups: [], projectiles: [] }, 1000);
    expect((playerScene.getObjectByName('toy-soldier-body') as THREE.Mesh).material).toBe(legacy.player.body.material);
    expect((playerScene.getObjectByName('toy-rifle') as THREE.Mesh).geometry).toBe(legacy.player.weapon.geometry);
    const boss = new BossRenderer(bossScene, families.boss);
    const state = { id: 1, tier: 1, x: 0, z: 10, hp: 100, maxHp: 100, visualScale: 7,
      engaged: false, slamCooldownRemainingSeconds: 0, slamCount: 0 };
    boss.update(state, 1000);
    const body = (bossScene.children[0].children[0].children[0] as THREE.Mesh);
    expect(legacy.boss.runFrames.map(model => model.geometry)).toContain(body.geometry);
    const activeGeometry = body.geometry;
    boss.update(null, 1100);
    const gray = bossScene.getObjectByName('boss-death-body-gray') as THREE.Mesh;
    expect(gray.geometry).toBe(activeGeometry);
    player.dispose(); boss.dispose();
  });
});

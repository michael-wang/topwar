import * as THREE from 'three';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { loadCharacterAssets } from '../src/rendering/CharacterAssets';
import { canShareCrowdBatch,
  type CharacterVisualFamilies } from '../src/rendering/CharacterVisualFamilies';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
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
  it('creates the four active authored families without downloads and disposes owned resources once', async () => {
    const assets = await loadCharacterAssets();
    expect(Object.keys(assets.families)).toEqual(['player','grunt','heavy','giant']);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    for (const family of Object.values(assets.families)) {
      expect(family.body.geometry.getAttribute('position').count).toBeGreaterThan(0);
      for (const value of Object.values(family)) {
        for (const mesh of Array.isArray(value) ? value : [value]) if (mesh instanceof THREE.Mesh) {
          geometries.add(mesh.geometry); for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) materials.add(material);
        }
      }
    }
    const spies = [...geometries].map(g=>vi.spyOn(g,'dispose')).concat([...materials].map(m=>vi.spyOn(m,'dispose')));
    assets.dispose(); assets.dispose();
    for(const spy of spies) expect(spy).toHaveBeenCalledOnce();
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
      && replacement.grunt.runFrames.some(frame=>frame.geometry === (c.children[0] as THREE.Mesh)?.geometry))!;
    expect(corpse).toBeDefined();
    renderer.update([], 2800); renderer.update([heavy], 2850); renderer.update([], 2900);
    expect(legacy.heavy.runFrames.map(frame=>frame.geometry)).toContain((corpse.children[0] as THREE.Mesh).geometry);
    expect((corpse.children[1] as THREE.Mesh).geometry).toBe(legacy.heavy.death.helmet.geometry);
    expect(renderer.getDebugStats().deathVisuals).toBe(1);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

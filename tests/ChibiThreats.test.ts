import * as THREE from 'three';
import { expect, expectTypeOf, it, vi } from 'vitest';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { prepareCrowdMaterial, type CrowdPresentation } from '../src/rendering/enemies/CrowdPresentation';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';
import { ContactShadowRenderer } from '../src/rendering/ContactShadowRenderer';
import { canShareCrowdBatch } from '../src/rendering/CharacterVisualFamilies';
import { characterFamilies } from './characterModel';
import type { EnemyRenderState } from '../src/rendering/RenderState';
const enemy = (id: number, archetype: 'heavy' | 'giant'): EnemyRenderState =>
  ({ id, archetype, tier: 1, x: 0, z: 10, hp: 15, maxHp: 15, visualScale: 1 });
it('keeps role presentation scale independent even when legacy resources share an instanced batch', () => {
  const legacy = characterFamilies(), heavy = { ...legacy.heavy, presentation: { ...legacy.heavy.presentation, scaleY: .8 } };
  expect(canShareCrowdBatch(legacy.grunt, heavy)).toBe(true);
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, { ...legacy, heavy });
  renderer.update([enemy(0, 'heavy')], 0);
  const body = scene.getObjectByName('toy-soldier-run-0') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(); body.getMatrixAt(0, matrix);
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  expect(scale.y).toBeCloseTo(.8);
  renderer.dispose();
});
it('owns deterministic independent static threat meshes with four poses and matte authored colors', () => {
  for (const create of [createChibiHeavyFamily, createChibiGiantFamily]) {
    const a = create(), b = create();
    const models = [a.body, ...a.runFrames, a.helmet, a.vest];
    const other = [b.body, ...b.runFrames, b.helmet, b.vest];
    expect(a.runFrames).toHaveLength(4);
    expect(new Set(a.runFrames.map(m => JSON.stringify(Array.from(m.geometry.getAttribute('position').array)))).size).toBe(4);
    for (const [index, model] of models.entries()) {
      expect(model).not.toBe(other[index]);
      expect(Array.from(model.geometry.getAttribute('position').array)).toEqual(Array.from(other[index].geometry.getAttribute('position').array));
      expect(Array.from(model.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(model.geometry.getAttribute('uv')).toBeUndefined();
      expect(model.geometry.getAttribute('skinIndex')).toBeUndefined();
      const material = model.material as THREE.MeshStandardMaterial, hook = material.onBeforeCompile;
      expect(material.map).toBeNull(); expect(material.vertexColors).toBe(true);
      expect(material.roughness).toBe(1); expect(material.metalness).toBe(0);
      const policy = 'contactPresentation' in a ? a.contactPresentation : a.presentation;
      expect(prepareCrowdMaterial(material, policy, 'body').onBeforeCompile).toBe(hook);
    }
    a.dispose(); b.dispose();
  }
});
it('keeps Heavy independent of Grunt and legacy normal resources at 650 ms with moderate height and strong width', () => {
  const heavy = createChibiHeavyFamily(), grunt = createChibiGruntFamily(), legacy = characterFamilies();
  expect(heavy.body.geometry).not.toBe(grunt.body.geometry);
  expect(heavy.body.geometry).not.toBe(legacy.heavy.body.geometry);
  expect(heavy.helmet.geometry).not.toBe(grunt.helmet.geometry);
  expect(heavy.gaitCycleMs).toBe(650);
  expect([0, 162.5, 325, 487.5, 650].map(t => enemyRunFrame(0, t, 650))).toEqual([0, 1, 2, 3, 0]);
  const height = heavy.helmet.geometry.boundingBox!.max.y * heavy.presentation.scaleY! * 1.35 * 1.15 / 1.025;
  const width = heavy.helmet.geometry.boundingBox!.getSize(new THREE.Vector3()).x * 1.35 * 1.05 / .74;
  expect(height).toBeGreaterThan(1.15); expect(height).toBeLessThan(1.30);
  expect(width).toBeGreaterThan(1.55); expect(width).toBeLessThan(1.81);
  expect(heavy).not.toHaveProperty('weapon'); heavy.dispose(); grunt.dispose();
});
it('uses dedicated Giant body, rounded crest and maul rather than another role family', () => {
  const giant = createChibiGiantFamily(), heavy = createChibiHeavyFamily(), grunt = createChibiGruntFamily(), legacy = characterFamilies();
  for (const other of [heavy, grunt, legacy.giant]) {
    expect(giant.body.geometry).not.toBe(other.body.geometry);
    expect(giant.runFrames.some(frame => other.runFrames.some(otherFrame => otherFrame.geometry === frame.geometry))).toBe(false);
  }
  expect(giant.weapon!.geometry.getAttribute('uv')).toBeUndefined();
  expect(giant.contact.body.geometry.getAttribute('position').count).toBe(
    giant.body.geometry.getAttribute('position').count + giant.weapon!.geometry.getAttribute('position').count);
  giant.dispose(); heavy.dispose(); grunt.dispose();
});
it('registers Heavy hit geometry, anchors its HP bar, and reuses dedicated contact/death parts', () => {
  const heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily(), scene = new THREE.Scene();
  const renderer = new EnemyRenderer(scene, { ...characterFamilies(), heavy, giant });
  const e = enemy(1, 'heavy'); renderer.update([e], 1000); renderer.update([{ ...e, hp: 14 }], 1010);
  expect((scene.getObjectByName('heavy-hit-body') as THREE.Mesh).geometry).toBe(heavy.runFrames[enemyRunFrame(1, 1010, 650)].geometry);
  const bar = scene.getObjectByName('heavy-hp-backing')!;
  expect(bar.position.y).toBeCloseTo(heavy.presentation.hpAnchor!.top * heavy.presentation.scaleY! + .3);
  expect(bar.scale.x).toBeCloseTo(heavy.presentation.hpAnchor!.width + .1);
  const before = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
  renderer.present([{ kind: 'normalEnemyContact', enemyId: 1, enemyTier: 1, attackerX: 0, attackerZ: 10, playerX: 0, playerZ: 0, before, after: before }], 1100);
  renderer.update([], 1100);
  const contact = scene.getObjectByName('enemy-contact-exchange')!;
  expect((contact.children[0] as THREE.Mesh).geometry).toBe(heavy.contact.body.geometry);
  expect(contact.scale.y).toBeCloseTo(heavy.presentation.scaleY! * 1.12);
  renderer.update([e], 1500); renderer.update([], 1510);
  const death = scene.getObjectByName('enemy-pale-death-body')!;
  expect((death.children[0] as THREE.Mesh).geometry).toBe(heavy.runFrames[enemyRunFrame(e.id,1500,650)].geometry);
  expect(death).toBeDefined(); expect((death.children[1] as THREE.Mesh).geometry).toBe(heavy.helmet.geometry);
  renderer.dispose(); heavy.dispose(); giant.dispose(); expect(scene.children).toHaveLength(0);
});
it('uses a full Giant motion envelope for the HP bar, delayed weapon, reveal, hit and shared intact death', () => {
  const family = createChibiGiantFamily(), scene = new THREE.Scene(), hits = new HeavyHitFeedback(scene);
  const renderer = new GiantRenderer(scene, family), e = enemy(1, 'giant');
  renderer.update(e, 0, hits); expect(renderer.barVisible(0)).toBe(false); expect(renderer.barVisible(1500)).toBe(true);
  const haze = scene.getObjectByName('giant-emergence-haze')!;
  expect(Math.max(...haze.children.map(cloud => cloud.position.y + cloud.scale.y / 2)))
    .toBeLessThan(family.helmet.geometry.boundingBox!.max.y);
  const group = scene.getObjectByName('giant-assault-soldier')!;
  for (let t = 0; t <= 850; t += 25) {
    renderer.update(e, 1700 + t, hits); group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.max.y).toBeLessThan(family.presentation!.height);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(family.presentation!.width);
    expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(family.presentation!.depth);
  }
  const bar = renderer.healthBarLayout(e); expect(bar.y).toBeCloseTo(family.presentation!.height + .35);
  expect(hits.observe(e, 2600)).toBe(true); renderer.update(e, 2600, hits);
  expect((scene.getObjectByName('heavy-hit-body') as THREE.Mesh).geometry).toBe((group.children[0] as THREE.Mesh).geometry);
  renderer.die(e, 2700); renderer.update(undefined, 3300, hits);
  expect(scene.getObjectByName('giant-death-impact')).toBeUndefined();
  renderer.update(undefined, 3400, hits);
  expect(scene.getObjectByName('giant-armor-wreckage')).toBeUndefined();
  expect(group.visible).toBe(true);
  renderer.update(undefined, 4150, hits);expect(group.visible).toBe(false);
  renderer.dispose(); hits.dispose(); family.dispose(); expect(scene.children).toHaveLength(0);
});
it('borrows threat geometry while each family disposes all its resources exactly once', () => {
  const heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily();
  const models = [heavy.body, ...heavy.runFrames, heavy.death.body, heavy.helmet, heavy.vest,
    giant.body, ...giant.runFrames, giant.helmet, giant.vest, giant.weapon!, giant.contact.body];
  const disposals = [...new Set(models.map(m => m.geometry))].map(g => vi.spyOn(g, 'dispose'));
  const materials = [...new Set(models.map(m => m.material))].map(m => vi.spyOn(m, 'dispose'));
  const scene = new THREE.Scene(), renderer = new EnemyRenderer(scene, { ...characterFamilies(), heavy, giant });
  renderer.update([enemy(1, 'heavy'), enemy(2, 'giant')], 1500); renderer.dispose();
  for (const dispose of [...disposals, ...materials]) expect(dispose).not.toHaveBeenCalled();
  heavy.dispose(); giant.dispose(); for (const dispose of [...disposals, ...materials]) expect(dispose).toHaveBeenCalledTimes(1);
});
it('keeps presentation metadata free of combat truth', () => {
  expectTypeOf<CrowdPresentation>().not.toHaveProperty('hp');
  expectTypeOf<CrowdPresentation>().not.toHaveProperty('damage');
  expectTypeOf<CrowdPresentation>().not.toHaveProperty('speed');
  const family = createChibiGiantFamily();
  expectTypeOf<typeof family.presentation>().not.toHaveProperty('xp');
  family.dispose();
});
it('keeps two Giant slots and their hit registration independent, including the full contact silhouette', () => {
  const giant = createChibiGiantFamily(), heavy = createChibiHeavyFamily(), scene = new THREE.Scene();
  const renderer = new EnemyRenderer(scene, { ...characterFamilies(), heavy, giant });
  const a = enemy(1, 'giant'), b = { ...enemy(2, 'giant'), x: 1.4, z: 20 };
  renderer.update([a, b], 0); renderer.update([a, b], 1500); renderer.update([{ ...a, hp: 14 }, b], 1510);
  const groups = scene.children.filter(c => c.name === 'giant-assault-soldier');
  expect(groups.filter(g => g.visible)).toHaveLength(2);
  const overlay = scene.getObjectByName('heavy-hit-body') as THREE.Mesh;
  expect(overlay.geometry).toBe((groups[0].children[0] as THREE.Mesh).geometry);
  expect(overlay.matrix.elements[14]).toBeCloseTo(a.z + .11);
  const before = { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 };
  renderer.present([{ kind: 'normalEnemyContact', enemyId: 1, enemyTier: 1, attackerX: 0, attackerZ: 10, playerX: 0, playerZ: 0, before, after: before }], 1600);
  renderer.update([b], 1600);
  const contact = scene.getObjectByName('enemy-contact-exchange')!;
  expect((contact.children[0] as THREE.Mesh).geometry).toBe(giant.contact.body.geometry);
  expect(groups.filter(g => g.visible)).toHaveLength(1);
  renderer.dispose(); giant.dispose(); heavy.dispose();
});
it('grounds threat feet with family footprints while keeping the existing Grunt stamp', () => {
  const heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily(), scene = new THREE.Scene();
  const shadows = new ContactShadowRenderer(scene, { heavy, giant });
  const frame = { player: { x: 0, z: 0 }, squad: { count: 0, rocketCount: 0, rifleCounts: [], formationSpacing: .45 },
    track: { halfWidth: 3.2, defenseLineZ: -1.5 }, enemies: [enemy(1, 'heavy'), enemy(2, 'giant'), { ...enemy(3, 'heavy'), archetype: 'grunt' as const }],
    boss: null, streamRewards: [], gates: [], pickups: [], projectiles: [] };
  const squad = { forEachVisibleMemberPosition() {}, presentation: { shadow: { width: .64, depth: .46 } } };
  shadows.update(frame, squad as unknown as Parameters<ContactShadowRenderer['update']>[1], 0);
  const mesh = scene.getObjectByName('contact-shadow-enemy') as THREE.InstancedMesh, matrix = new THREE.Matrix4();
  for (const [index, footprint] of [heavy.presentation.shadow!, giant.presentation!.shadow, { width: .68 / .82, depth: .42 / .82 }].entries()) {
    mesh.getMatrixAt(index, matrix); expect(matrix.elements[0]).toBeCloseTo(footprint.width);
    expect(matrix.elements[10]).toBeCloseTo(footprint.depth);
  }
  shadows.dispose(); heavy.dispose(); giant.dispose();
});

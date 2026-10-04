import * as THREE from 'three';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createChibiGruntFamily, GRUNT_CLOTHING } from '../src/rendering/enemies/ChibiGruntFamily';
import { prepareCrowdMaterial, type CrowdPresentation } from '../src/rendering/enemies/CrowdPresentation';
import { canShareCrowdBatch } from '../src/rendering/CharacterVisualFamilies';
import { EnemyRenderer, enemyRunFrame } from '../src/rendering/enemies/EnemyRenderer';
import { ART } from '../src/art/ArtDirection';
import { COMBAT_COLORS } from '../src/rendering/characters/ToyCombatGear';
import { ENEMY_PALETTE } from '../src/rendering/tierPalettes';
import { characterFamilies } from './characterModel';
import type { EnemyRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';

const enemy = (id: number, archetype: 'grunt' | 'heavy' | 'giant', tier = 1): EnemyRenderState =>
  ({ id, archetype, tier, hp: 2, maxHp: 2, x: 0, z: 10, visualScale: .82 });
const contact = (id: number): PresentationEvent => ({ kind: 'normalEnemyContact', enemyId: id,
  enemyTier: 1, attackerX: 0, attackerZ: 10, playerX: 0, playerZ: 0,
  before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
  after: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 } });

describe('original amphibious Grunt prototype', () => {
  it('authors deterministic static, texture-free resources at the retained crown and bounded width', () => {
    const a = createChibiGruntFamily(), b = createChibiGruntFamily();
    const models = [a.body, ...a.runFrames, a.helmet, a.vest, a.death.body];
    const other = [b.body, ...b.runFrames, b.helmet, b.vest, b.death.body];
    for (const [index, model] of models.entries()) {
      const material = model.material as THREE.MeshStandardMaterial;
      expect(material.vertexColors).toBe(true); expect(material.map).toBeNull();
      expect(material.roughness).toBe(1); expect(material.metalness).toBe(0);
      expect(model.geometry.getAttribute('uv')).toBeUndefined();
      expect(model.geometry.getAttribute('skinIndex')).toBeUndefined();
      expect(Array.from(model.geometry.getAttribute('position').array))
        .toEqual(Array.from(other[index].geometry.getAttribute('position').array));
      expect(Array.from(model.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    }
    expect(a.helmet.geometry.boundingBox!.max.y).toBeCloseTo(1.025);
    const bounds = a.body.geometry.boundingBox!;
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(.907635 * 1.1);
    expect(a).not.toHaveProperty('weapon');
    // The compatibility secondary slot stays empty; belt/canteen live in body.
    expect(a.vest.geometry.getAttribute('position').count).toBe(0);
    expect(a.vest.visible).toBe(false);
    a.dispose(); b.dispose();
  });

  it('retains warm human skin and two plain clothing blocks as authored vertex colors', () => {
    const family = createChibiGruntFamily(), colors = family.body.geometry.getAttribute('color');
    for (const value of [ART.faction.skin, ART.footwear.enemyUpper, ART.footwear.enemySole, ...Object.values(GRUNT_CLOTHING)]) {
      const target = new THREE.Color(value);
      expect(Array.from({ length: colors.count }, (_, i) => new THREE.Color().fromBufferAttribute(colors, i))
        .some(color => Math.abs(color.r - target.r) + Math.abs(color.g - target.g) + Math.abs(color.b - target.b) < .00001)).toBe(true);
    }
    const positions = family.body.geometry.getAttribute('position');
    const clothingColors = new Set<string>();
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) > .16 && positions.getY(i) < .46 && Math.abs(positions.getX(i)) <= .251) {
        clothingColors.add(new THREE.Color().fromBufferAttribute(colors, i).getHexString());
      }
    }
    expect(clothingColors).toEqual(new Set([...Object.values(GRUNT_CLOTHING), ...Object.values(COMBAT_COLORS.grunt)]
      .map(color => new THREE.Color(color).getHexString())));
    expect(family.death.body.geometry).toBe(family.lethalReaction!.final.geometry);
    expect(family.death.body.geometry.getAttribute('color').count).toBe(colors.count);
    family.dispose();
  });

  it('uses detached spherical hands with no thumb or connecting arm mass', () => {
    const family = createChibiGruntFamily(), positions = family.body.geometry.getAttribute('position');
    const colors = family.body.geometry.getAttribute('color'), skin = new THREE.Color(ART.faction.skin);
    let handVertices = 0;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      if (Math.abs(x) <= .27 || y <= .30 || y >= .43) continue;
      if (Math.abs(colors.getX(i)-skin.r)+Math.abs(colors.getY(i)-skin.g)+Math.abs(colors.getZ(i)-skin.b) > .00001) continue;
      expect(Math.hypot(Math.abs(x) - .335, y - .365, z)).toBeCloseTo(.057, 5);
      handVertices++;
    }
    expect(handVertices).toBeGreaterThan(0);
    family.dispose();
  });

  it('uses four distinct poses, one shared body material, and the unchanged asynchronous 360 ms clock', () => {
    const family = createChibiGruntFamily();
    expect(family.gaitCycleMs).toBe(360); expect(family.runFrames).toHaveLength(4);
    const positions = family.runFrames.map(frame => Array.from(frame.geometry.getAttribute('position').array));
    expect(new Set(positions.map(p => JSON.stringify(p))).size).toBe(4);
    expect(family.runFrames.every(frame => frame.material === family.body.material)).toBe(true);
    expect([0, 90, 180, 270, 360].map(t => enemyRunFrame(0, t, family.gaitCycleMs))).toEqual([0, 1, 2, 3, 0]);
    expect(new Set([0, 1, 2, 3, 4].map(id => enemyRunFrame(id, 0, family.gaitCycleMs))).size).toBeGreaterThan(1);
    family.dispose();
  });

  it('bypasses legacy UV hooks and keeps all authored body instance colors white while helmet tiers still vary', () => {
    const grunt = createChibiGruntFamily(), families = { ...characterFamilies(), grunt }, scene = new THREE.Scene();
    const material = grunt.body.material as THREE.MeshStandardMaterial, hook = material.onBeforeCompile;
    expect(prepareCrowdMaterial(material, grunt.presentation, 'body')).toBe(material);
    expect(material.onBeforeCompile).toBe(hook);
    const renderer = new EnemyRenderer(scene, families);
    const enemies = Array.from({ length: 200 }, (_, i) => enemy(i, 'grunt', i % 2 + 1));
    renderer.update(enemies, 1000);
    const bodies = scene.children.filter(c => c instanceof THREE.InstancedMesh && c.material === material) as THREE.InstancedMesh[];
    expect(bodies).toHaveLength(4);
    expect(bodies.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(200);
    const color = new THREE.Color();
    for (const mesh of bodies) for (let i = 0; i < mesh.count; i++) { mesh.getColorAt(i, color); expect(color.getHexString()).toBe('ffffff'); }
    for (const [tier, palette] of ENEMY_PALETTE.slice(0, 2).entries()) {
      const helmet = scene.children.find(c => c.name === `${tier}-toy-soldier-helmet`
        && (c as THREE.InstancedMesh).geometry === grunt.helmet.geometry) as THREE.InstancedMesh;
      helmet.getColorAt(0, color); expect(color.getHexString()).toBe(new THREE.Color(palette.body).getHexString());
    }
    expect(canShareCrowdBatch(grunt, families.heavy)).toBe(false);
    const secondary = scene.children.filter(c => c.name.endsWith('toy-soldier-vest')
      && (c as THREE.InstancedMesh).geometry === grunt.vest.geometry);
    expect(secondary.every(mesh => !mesh.visible)).toBe(true);
    expect(material.onBeforeCompile).toBe(hook);
    renderer.dispose(); grunt.dispose();
  });

  it('retains the 80 ms helmet hit flash without tinting skin or allocating per-instance materials', () => {
    const grunt = createChibiGruntFamily(), scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, { ...characterFamilies(), grunt });
    const e = enemy(0, 'grunt'); renderer.update([e], 1000); renderer.update([{ ...e, hp: 1 }], 1010);
    const helmet = scene.children.find(c => c.name === '0-toy-soldier-helmet'
      && (c as THREE.InstancedMesh).geometry === grunt.helmet.geometry) as THREE.InstancedMesh;
    const color = new THREE.Color(); helmet.getColorAt(0, color); expect(color.getHexString()).toBe(new THREE.Color(ART.fx.core).getHexString());
    renderer.update([{ ...e, hp: 1 }], 1089); helmet.getColorAt(0, color); expect(color.getHexString()).toBe(new THREE.Color(ART.fx.core).getHexString());
    renderer.update([{ ...e, hp: 1 }], 1090); helmet.getColorAt(0, color); expect(color.getHexString()).toBe(new THREE.Color(ENEMY_PALETTE[0].body).getHexString());
    renderer.dispose(); grunt.dispose();
  });

  it('rebinds pooled contact and death parts between procedural Grunt and explicit legacy Heavy/Giant dependencies', () => {
    const legacy = characterFamilies(), grunt = createChibiGruntFamily(), scene = new THREE.Scene();
    const renderer = new EnemyRenderer(scene, { ...legacy, grunt });
    const g = enemy(0, 'grunt'), h = enemy(1, 'heavy'), giant = enemy(2, 'giant');
    renderer.update([g], 1000); renderer.present([contact(0)], 1010); renderer.update([], 1010); renderer.update([], 1170);
    const exchange = scene.getObjectByName('enemy-contact-exchange')!;
    expect((exchange.children[0] as THREE.Mesh).geometry).toBe(grunt.contact.body.geometry);
    expect((exchange.children[0] as THREE.Mesh).material).not.toBe(grunt.body.material);
    expect(exchange.children[2].visible).toBe(false);
    for (const [e, parts, now] of [[h, legacy.heavy.contact, 1400], [giant, legacy.giant.contact, 1800], [g, grunt.contact, 2200]] as const) {
      renderer.update([], now - 10); renderer.update([e], now); renderer.present([contact(e.id)], now + 10); renderer.update([], now + 10);
      expect((exchange.children[0] as THREE.Mesh).geometry).toBe(parts.body.geometry);
      expect(exchange.children[2].visible).toBe(parts.vest.visible);
    }
    renderer.update([], 2500); renderer.update([g], 2600); renderer.update([], 2610);
    const corpse = scene.getObjectByName('enemy-pale-death-body')!;
    expect(corpse).toBeDefined();
    expect(corpse.children[2].visible).toBe(false);
    renderer.update([], 3200); renderer.update([h], 3300); renderer.update([], 3310);
    expect(legacy.heavy.runFrames.map(frame=>frame.geometry)).toContain((corpse.children[0] as THREE.Mesh).geometry);
    expect(corpse.children[2].visible).toBe(true);
    renderer.update([], 4090); renderer.update([g], 4200); renderer.update([], 4210);
    expect(grunt.runFrames.map(frame=>frame.geometry)).toContain((corpse.children[0] as THREE.Mesh).geometry);
    expect(corpse.children[2].visible).toBe(false);
    expect(renderer.getDebugStats().contactVisuals).toBe(1); expect(renderer.getDebugStats().deathVisuals).toBe(1);
    renderer.dispose(); grunt.dispose();
  });

  it('owns its eight geometries and three materials; renderer disposal never disposes borrowed sources', () => {
    const grunt = createChibiGruntFamily(), scene = new THREE.Scene();
    const models = [grunt.body, ...grunt.runFrames, grunt.death.body, grunt.helmet, grunt.vest];
    const geometries = models.map(model => vi.spyOn(model.geometry, 'dispose'));
    const materials = [...new Set(models.map(model => model.material))].map(material => vi.spyOn(material, 'dispose'));
    const renderer = new EnemyRenderer(scene, { ...characterFamilies(), grunt });
    renderer.update([enemy(0, 'grunt')], 1000); renderer.update([], 1100); renderer.dispose();
    [...geometries, ...materials].forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(geometries).toHaveLength(8); expect(materials).toHaveLength(3);
    grunt.dispose(); [...geometries, ...materials].forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(scene.children).toHaveLength(0);
  });

  it('keeps the crowd presentation contract free of combat/simulation data', () => {
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('hp');
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('damage');
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('speed');
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('xp');
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('lane');
    expectTypeOf<CrowdPresentation>().not.toHaveProperty('collision');
  });
});

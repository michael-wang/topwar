import * as THREE from 'three';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { ChibiPlayerMotion } from '../src/rendering/squad/ChibiPlayerMotion';
import type { PlayerPresentation } from '../src/rendering/squad/PlayerPresentation';
import { SquadRenderer, PLAYER_HIT_FLASH_MS, PLAYER_KNOCKOUT_MS } from '../src/rendering/squad/SquadRenderer';
import { ContactShadowRenderer } from '../src/rendering/ContactShadowRenderer';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import type { GameRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';
import { createCharacterVisualFamilies, type PlayerVisualFamily } from '../src/rendering/CharacterVisualFamilies';
import { bulletModel, characterFamilies } from './characterModel';

const frame = (): GameRenderState => ({ defenseMode: true, player: { x: 0, z: 0, selectedLane: 2 },
  squad: { count: 1, rocketCount: 0, rifleCounts: [1], formationSpacing: .45 },
  track: { halfWidth: 3.2, defenseLineZ: -1.5 }, enemies: [], boss: null,
  streamRewards: [], gates: [], pickups: [], projectiles: [] });
const contact = (removed: boolean): PresentationEvent => ({ kind: 'normalEnemyContact', enemyId: 1, enemyTier: 1,
  attackerX: 0, attackerZ: 1, playerX: 0, playerZ: 0,
  before: { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: 0 },
  after: removed ? { count: 0, rocketCount: 0, rifleCounts: [], rifleRemainder: 0 }
    : { count: 1, rocketCount: 0, rifleCounts: [1], rifleRemainder: .1 } });

describe('original two-head Player prototype', () => {
  it('requires explicit Player parts and motion when assembling role families', () => {
    const legacy = characterFamilies(), player = createChibiPlayerFamily();
    const resources = { normalIdle: legacy.grunt.body, normalRuns: legacy.grunt.runFrames,
      grayIdle: legacy.grunt.death.body, helmet: legacy.grunt.helmet, vest: legacy.grunt.vest,
      bossIdle: legacy.boss.body, bossRuns: legacy.boss.runFrames, bossSlams: legacy.boss.slamFrames, bossVest: legacy.boss.vest };
    expect(createCharacterVisualFamilies(resources, player).player).toBe(player);
    expect(() => createCharacterVisualFamilies(resources, { ...player, weapon: undefined } as unknown as PlayerVisualFamily))
      .toThrow('Missing Player family resource: weapon');
    expect(() => createCharacterVisualFamilies(resources, { ...player, presentation: undefined } as unknown as PlayerVisualFamily))
      .toThrow('Player family requires a motion factory');
    player.dispose();
  });
  it('authors deterministic disconnected parts in one texture-free body mesh at retained total height', () => {
    const a = createChibiPlayerFamily(), b = createChibiPlayerFamily();
    for (const part of ['body', 'helmet', 'vest', 'weapon'] as const) {
      expect(Array.from(a[part].geometry.getAttribute('position').array))
        .toEqual(Array.from(b[part].geometry.getAttribute('position').array));
      const material = a[part].material as THREE.MeshStandardMaterial;
      expect(material.map).toBeNull(); expect(material.roughness).toBe(1); expect(material.metalness).toBe(0);
      expect(material.vertexColors).toBe(true);
    }
    expect(a.body.geometry.getAttribute('_motion')).toBeUndefined();
    expect(a.body.geometry.getAttribute('uv')).toBeUndefined();
    const regions = a.body.geometry.getAttribute('playerPart');
    expect(new Set(regions.array)).toEqual(new Set([0, 1, 2, 3, 4]));
    // Triangles belong to entire disconnected parts, never skin strips linking shoes or mittens.
    for (let i = 0; i < regions.count; i += 3) {
      expect(regions.getX(i + 1)).toBe(regions.getX(i)); expect(regions.getX(i + 2)).toBe(regions.getX(i));
    }
    expect(a.body.geometry.boundingBox!.min.y).toBeCloseTo(0);
    expect(a.helmet.geometry.boundingBox!.max.y).toBeCloseTo(1.025);
    expect((1.025 - .51) / 1.025).toBeGreaterThan(.46);
    expect((1.025 - .51) / 1.025).toBeLessThan(.52);
    expect(a.helmet.geometry.boundingBox!.getSize(new THREE.Vector3()).x / .51).toBeCloseTo(.65 / .51);
    a.dispose(); b.dispose();
  });

  it('selects motion through the explicit factory, with independent stride, recoil and readiness uniforms', () => {
    const family = createChibiPlayerFamily();
    const first = family.presentation.createMotion(family.body.material as THREE.MeshStandardMaterial,
      family.body.material as THREE.MeshStandardMaterial);
    const second = family.presentation.createMotion(family.body.material as THREE.MeshStandardMaterial,
      family.body.material as THREE.MeshStandardMaterial);
    expect(first).toBeInstanceOf(ChibiPlayerMotion);
    const shader = () => ({ uniforms: {} as Record<string, { value: number }>,
      vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '' });
    const a = shader(), b = shader();
    first.normal.onBeforeCompile(a as unknown as Parameters<typeof first.normal.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    second.normal.onBeforeCompile(b as unknown as Parameters<typeof second.normal.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    first.update(-.9, .8, 1.2, .7);
    expect(a.uniforms.playerStride.value).toBe(-.9);
    expect(a.uniforms.playerRecoil.value).toBe(.8);
    expect(a.uniforms.playerReady.value).toBe(.7);
    expect(b.uniforms.playerStride.value).toBe(0);
    expect(a.vertexShader).toContain('attribute float playerPart');
    expect(a.vertexShader).not.toContain('_motion');
    expect(a.vertexShader).not.toContain('limbPoint');
    expect(a.vertexShader).not.toContain('vMapUv');
    first.dispose(); second.dispose(); family.dispose();
  });

  it('keeps four primary draws per member and attaches the muzzle to the actual weapon through recoil and lowering', () => {
    const family = createChibiPlayerFamily(), scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, { ...family, id: 'id-does-not-select-motion' });
    const state = frame(); renderer.update(state, 0); renderer.update(state, 500);
    const member = scene.children.find(c => c.getObjectByName('toy-soldier-body'))!;
    expect(member.children).toHaveLength(4);
    const rifle = member.getObjectByName('toy-rifle') as THREE.Mesh;
    const muzzle = member.getObjectByName('muzzle-flash')!;
    expect(muzzle.parent).toBe(rifle);
    const resting = muzzle.getWorldPosition(new THREE.Vector3());
    renderer.update({ ...state, projectiles: [{ id: 1, kind: 'rifle', tier: 1, x: 0, z: .7, hitRadiusBonus: 0 }] }, 510);
    const expected = rifle.localToWorld(new THREE.Vector3().fromArray(family.presentation.muzzleAnchor));
    expect(muzzle.getWorldPosition(new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-7);
    expect(expected.distanceTo(resting)).toBeGreaterThan(.02);
    expect(muzzle.visible).toBe(true);
    renderer.update({ ...state, squad: { ...state.squad,
      reinforcement: { progress: .5, reinforcementSpacing: .72, reinforcementStagger: .18 } } }, 700);
    const recruit = scene.children.filter(c => c.getObjectByName('toy-soldier-body'))[1];
    const lowered = recruit.getObjectByName('toy-rifle')!;
    const flash = recruit.getObjectByName('muzzle-flash')!;
    expect(lowered.rotation.x).toBeGreaterThan(.5);
    expect(flash.getWorldPosition(new THREE.Vector3()).distanceTo(
      lowered.localToWorld(new THREE.Vector3().fromArray(family.presentation.muzzleAnchor)))).toBeLessThan(1e-7);
    renderer.dispose(); family.dispose();
  });

  it('takes shadow dimensions from Player metadata and tracer height/offset from its muzzle without changing shots', () => {
    const family = createChibiPlayerFamily(), scene = new THREE.Scene();
    const renderer = new SquadRenderer(scene, family), shadows = new ContactShadowRenderer(scene);
    const state = frame(); renderer.update(state, 0); shadows.update(state, renderer, 0);
    const shadow = scene.getObjectByName('contact-shadow-player') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4(); shadow.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(family.presentation.shadow.width);
    expect(scale.z).toBeCloseTo(family.presentation.shadow.depth);
    const projectiles = new ProjectileRenderer(scene, bulletModel(), family.presentation.tracer);
    const shots = [{ id: 1, kind: 'rifle' as const, tier: 1, x: 0, z: .7, hitRadiusBonus: 0 },
      { id: 2, kind: 'rocket' as const, tier: 0, x: 0, z: .7, hitRadiusBonus: 0 }];
    const before = JSON.stringify(shots); projectiles.update(shots, 0);
    const tracer = scene.getObjectByName('rifle-tracers') as THREE.InstancedMesh;
    tracer.getMatrixAt(0, matrix); const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
    const { muzzleAnchor: m, weaponPosition: w, rootScale } = family.presentation;
    expect(origin.y).toBeCloseTo((w[1] + m[1]) * rootScale);
    expect(origin.x).toBeCloseTo((w[0] + m[0]) * rootScale);
    expect(origin.z).toBeCloseTo(shots[0].z);
    tracer.getMatrixAt(1, matrix); expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(.66);
    expect(JSON.stringify(shots)).toBe(before);
    projectiles.dispose(); shadows.dispose(); renderer.dispose(); family.dispose();
  });

  it('uses the new silhouette for hit and bounded casualty presentation with original timing', () => {
    const family = createChibiPlayerFamily(), scene = new THREE.Scene(), renderer = new SquadRenderer(scene, family);
    const state = frame(); renderer.update(state, 0); renderer.update(state, 500);
    renderer.present([contact(false)], 510, 3.2, .45); renderer.update(state, 520);
    const body = scene.getObjectByName('toy-soldier-body') as THREE.Mesh;
    expect(body.geometry).toBe(family.body.geometry);
    expect(body.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    renderer.update(state, 510 + PLAYER_HIT_FLASH_MS);
    expect(body.material).toBe(family.body.material);
    renderer.present([contact(true)], 700, 3.2, .45);
    const empty = { ...state, squad: { ...state.squad, count: 0, rifleCounts: [] } };
    renderer.update(empty, 700 + PLAYER_HIT_FLASH_MS + 10);
    const corpse = scene.getObjectByName('player-casualty')!;
    expect(corpse.children.map(c => (c as THREE.Mesh).geometry))
      .toEqual([family.body.geometry, family.helmet.geometry, family.vest.geometry, family.weapon.geometry]);
    expect((corpse.children[0] as THREE.Mesh).geometry.getAttribute('playerPart')).toBeDefined();
    expect((corpse.children[0] as THREE.Mesh).material).toHaveProperty('opacity', expect.any(Number));
    expect(corpse.children[3].position.toArray()).toEqual([...family.presentation.weaponPosition]);
    renderer.update(empty, 700 + PLAYER_KNOCKOUT_MS); expect(corpse.visible).toBe(false);
    renderer.dispose(); family.dispose();
  });

  it('envelops the new crown in Level-Up and retains timing, tier color and dormant rocket fallback', () => {
    const family = createChibiPlayerFamily(), scene = new THREE.Scene(), renderer = new SquadRenderer(scene, family);
    const state = frame(); renderer.update(state, 0); renderer.update(state, 500);
    renderer.presentLevelUp({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 }, 600);
    renderer.update(state, 1200);
    const burst = scene.getObjectByName('player-level-up-burst')!;
    expect(burst.children.slice(1).some(c => c.position.y > 1.025 * family.presentation.rootScale)).toBe(true);
    renderer.update(state, 1400); expect(burst.visible).toBe(false);
    const tier = { ...state, squad: { ...state.squad, rifleCounts: [0, 1] } };
    renderer.update(tier, 1500); renderer.update(tier, 1900);
    expect((scene.getObjectByName('toy-soldier-helmet') as THREE.Mesh).material).toHaveProperty('color', new THREE.Color('#10429b'));
    renderer.update({ ...state, squad: { ...state.squad, rocketCount: 1, rifleCounts: [] } }, 2000);
    expect(scene.getObjectByName('toy-rifle')!.scale.x).toBe(1.15);
    expect(scene.getObjectByName('muzzle-flash')!.visible).toBe(false);
    renderer.dispose(); family.dispose();
  });

  it('keeps source geometry/material ownership in the family and disposes renderer variants separately', () => {
    const family = createChibiPlayerFamily();
    const parts = [family.body, family.helmet, family.vest, family.weapon];
    const geometryDisposals = parts.map(part => vi.spyOn(part.geometry, 'dispose'));
    const materialDisposals = [...new Set(parts.map(part => part.material))].map(material => vi.spyOn(material, 'dispose'));
    const scene = new THREE.Scene(), renderer = new SquadRenderer(scene, family);
    renderer.update(frame(), 0);
    const motion = family.presentation.createMotion(family.body.material as THREE.MeshStandardMaterial,
      family.body.material as THREE.MeshStandardMaterial);
    const normalDisposal = vi.spyOn(motion.normal, 'dispose'), levelDisposal = vi.spyOn(motion.level, 'dispose');
    motion.dispose(); expect(normalDisposal).toHaveBeenCalledOnce(); expect(levelDisposal).toHaveBeenCalledOnce();
    renderer.dispose(); expect(scene.children).toHaveLength(0);
    for (const dispose of [...geometryDisposals, ...materialDisposals]) expect(dispose).not.toHaveBeenCalled();
    family.dispose();
    for (const dispose of [...geometryDisposals, ...materialDisposals]) expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps Player presentation metadata free of simulation fields', () => {
    expectTypeOf<PlayerPresentation>().not.toHaveProperty('hp');
    expectTypeOf<PlayerPresentation>().not.toHaveProperty('damage');
    expectTypeOf<PlayerPresentation>().not.toHaveProperty('fireRate');
    expectTypeOf<PlayerPresentation>().not.toHaveProperty('lane');
    expectTypeOf<PlayerPresentation>().not.toHaveProperty('reinforcementRules');
  });
});

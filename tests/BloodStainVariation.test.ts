import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { bloodStainVariation, STAIN_COLORS } from '../src/rendering/enemies/BloodStainVariation';
import { GroundBloodStains, lethalBloodAtlas, BLOOD_STAIN_CAPACITY } from '../src/rendering/enemies/BloodSplat';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';

it('varies dried blood deterministically inside small casualty footprints with distinct role areas', () => {
  const roles = ['grunt', 'heavy', 'giant'] as const;
  for (const role of roles) {
    const masks = new Set<number>(), tones = new Set<number>();
    for (let id = 0; id < 100; id++) {
      const v = bloodStainVariation(id, role);
      expect(v).toEqual(bloodStainVariation(id, role)); masks.add(v.variant); tones.add(v.color);
      expect(v.variant).toBeGreaterThanOrEqual(0); expect(v.variant).toBeLessThan(4);
      expect(v.scale).toBeGreaterThanOrEqual(.88); expect(v.scale).toBeLessThan(1.12);
      expect(v.aspect).toBeGreaterThanOrEqual(.85); expect(v.aspect).toBeLessThan(1.20);
      expect(v.opacity).toBeGreaterThanOrEqual(.50); expect(v.opacity).toBeLessThan(.66);
      expect(Math.abs(v.offsetX)).toBeLessThanOrEqual(.08); expect(Math.abs(v.offsetZ)).toBeLessThanOrEqual(.08);
    }
    expect(masks.size).toBe(4); expect(tones.size).toBe(STAIN_COLORS.length);
  }
  expect(ENEMY_DEATH_TIMING.heavy.stainDiameter / ENEMY_DEATH_TIMING.grunt.stainDiameter).toBeCloseTo(1.882);
  expect(ENEMY_DEATH_TIMING.giant.stainDiameter / ENEMY_DEATH_TIMING.grunt.stainDiameter).toBeCloseTo(2.794);
  expect(ENEMY_DEATH_TIMING.grunt.stainDiameter * 1.12).toBeLessThan(ENEMY_DEATH_TIMING.heavy.stainDiameter * .88);
  expect(ENEMY_DEATH_TIMING.heavy.stainDiameter * 1.12).toBeLessThan(ENEMY_DEATH_TIMING.giant.stainDiameter * .88);
});

it('shares one atlas draw, varies footprint/tint/opacity, persists and clears without owning the texture', () => {
  const scene = new THREE.Scene(), texture = lethalBloodAtlas(), stains = new GroundBloodStains(scene, texture);
  const mesh = scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh;
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    stains.reset(); stains.spawn(17, role, .4, 8);
    const v = bloodStainVariation(17, role), matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBeCloseTo(.4 + v.offsetX); expect(matrix.elements[14]).toBeCloseTo(8 + v.offsetZ);
    expect(matrix.elements[13]).toBeCloseTo(.032);
    const width = Math.hypot(...matrix.elements.slice(0, 3)), height = Math.hypot(...matrix.elements.slice(4, 7));
    expect(Math.sqrt(width * height)).toBeCloseTo(ENEMY_DEATH_TIMING[role].stainDiameter * v.scale);
    expect(mesh.geometry.getAttribute('stainVariant').getX(0)).toBe(v.variant);
    expect(mesh.geometry.getAttribute('stainOpacity').getX(0)).toBeCloseTo(v.opacity);
    const color = new THREE.Color(); mesh.getColorAt(0, color); expect(color.getHexString()).toBe(STAIN_COLORS[v.color].slice(1));
  }
  stains.reset(); for (let id = 0; id < BLOOD_STAIN_CAPACITY + 1; id++) stains.spawn(id, 'grunt', id, 8);
  expect(mesh.count).toBe(BLOOD_STAIN_CAPACITY); expect(scene.children).toHaveLength(1);
  const first = new THREE.Matrix4(); mesh.getMatrixAt(0, first);
  expect(first.elements[12]).toBeCloseTo(BLOOD_STAIN_CAPACITY + bloodStainVariation(BLOOD_STAIN_CAPACITY, 'grunt').offsetX, 3);
  const material = mesh.material as THREE.MeshBasicMaterial;
  const shader = { vertexShader: '#include <uv_vertex>', fragmentShader: '#include <map_fragment>', uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain('mod(stainVariant, 2.)'); expect(shader.fragmentShader).toContain('vStainOpacity');
  const owned = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(material, 'dispose')], borrowed = vi.spyOn(texture, 'dispose');
  stains.reset(); expect(mesh.count).toBe(0); expect(mesh.visible).toBe(false);
  stains.dispose(); owned.forEach(spy => expect(spy).toHaveBeenCalledOnce()); expect(borrowed).not.toHaveBeenCalled(); texture.dispose();
});

import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { ProjectileRenderer, projectilePulseScale } from '../src/rendering/projectiles/ProjectileRenderer';
import { bulletModel } from './characterModel';

it('uses an ivory core and non-additive red edge in the existing two pooled draws', () => {
  const scene = new THREE.Scene(), bullet = bulletModel(), renderer = new ProjectileRenderer(scene, bullet);
  const shot = { id: 1, kind: 'rifle' as const, tier: 1, x: 0, z: 5, hitRadiusBonus: 0 };
  renderer.update([shot], 0);
  const core = scene.getObjectByName('rifle-tracers') as THREE.InstancedMesh;
  const edge = scene.getObjectByName('tracer-glows') as THREE.InstancedMesh;
  const material = edge.material as THREE.MeshBasicMaterial;
  expect(scene.children).toHaveLength(2);
  expect(core.geometry).toBe(bullet.geometry); expect(edge.geometry).toBe(bullet.geometry);
  expect((core.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('fff4e5');
  expect(material.color.getHexString()).toBe('d84c4b');
  expect(material.blending).toBe(THREE.NormalBlending);
  expect(material.opacity).toBe(ART.projectile.accentOpacity);
  expect(projectilePulseScale(0)).toBe(1.35); expect(projectilePulseScale(65)).toBe(1);
  renderer.update([shot], 200);
  expect(material.color.getHexString()).toBe('d84c4b');
  expect(material.blending).toBe(THREE.NormalBlending);
  renderer.reset(); renderer.update([shot], 250);
  expect(material.color.getHexString()).toBe('d84c4b');
  renderer.dispose(); expect(scene.children).toHaveLength(0);
  bullet.geometry.dispose(); (bullet.material as THREE.Material).dispose();
});

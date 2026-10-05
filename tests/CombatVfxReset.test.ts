import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';

it('clears every feedback owner on role restarts and reuses warmed death/dust resources', () => {
  const scene = new THREE.Scene();
  const families = { grunt: createChibiGruntFamily(), heavy: createChibiHeavyFamily(), giant: createChibiGiantFamily() };
  const renderer = new EnemyRenderer(scene, families);
  const resources = () => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
      if ('geometry' in object) geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    });
    return { geometries, materials, objects: scene.children.length };
  };
  let warmed: ReturnType<typeof resources> | undefined;
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const role of ['grunt', 'heavy', 'giant'] as const) {
      renderer.reset(cycle);
      const enemy = { id: 1, archetype: role, tier: 1, hp: 10, maxHp: 10, x: 0, z: 10 };
      renderer.update([enemy], 0, true); renderer.update([enemy], 2000, true);
      renderer.update([{ ...enemy, hp: 9 }], 2010, true);
      expect((scene.getObjectByName('enemy-hit-blood') as THREE.InstancedMesh).count).toBe(1);
      renderer.update([], 2020, true);
      renderer.update([], 2820, true); // Giant impact dust is active.
      if (role === 'giant') expect(scene.getObjectByName('giant-death-impact-dust')!.visible).toBe(true);
      renderer.update([], 4800, true);
      expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(1);
      renderer.reset(cycle);
      for (const name of ['enemy-hit-blood', 'enemy-ground-blood-stains',
        ...['grunt', 'heavy', 'giant'].flatMap(r => [`enemy-3d-blood-${r}`, `enemy-blood-ribbons-${r}`])]) {
        expect((scene.getObjectByName(name) as THREE.InstancedMesh).count).toBe(0);
      }
      expect(scene.getObjectByName('giant-death-impact-dust')!.visible).toBe(false);
      expect(renderer.getDebugStats().deathVisuals).toBe(0);
    }
    if (warmed) expect(resources()).toEqual(warmed);
    else warmed = resources();
  }
  renderer.dispose(); Object.values(families).forEach(f => f.dispose());
  expect(scene.children).toHaveLength(0);
});

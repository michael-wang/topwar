import { expect, it } from 'vitest';
import * as THREE from 'three';
import { EnemyArtilleryRenderer } from '../src/rendering/EnemyArtilleryRenderer';
import { makeArtilleryShell, sampleArtillery } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';

const shell = makeArtilleryShell(1, { source: { id: 'test', type: 'offshore', position: { x: -3, y: 1.2, z: 52 } } },
  2, [-2.8, -1.4, 0, 1.4, 2.8], 0, 0, artilleryDefaults, .588);
it('keeps shell/warning positions tied to authoritative flight and exact collision radius', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1000);
  const model = scene.getObjectByName('enemy-shell-0')!, warning = scene.getObjectByName('enemy-shell-warning-0')!;
  const p = sampleArtillery(shell, 1);
  expect(model.position.toArray()).toEqual([-p.x, p.y, p.z]);
  expect(warning.position.toArray()).toEqual([-shell.target.x, .035, shell.target.z]);
  expect(warning.scale.x).toBe(shell.radius);
  const pose = model.matrix.toArray(), direction = model.quaternion.toArray();
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1000);
  expect(model.matrix.toArray()).toEqual(pose); expect(model.quaternion.toArray()).toEqual(direction);
  r.update({ shells: [], elapsedSeconds: shell.impactAtSeconds }, 2200);
  expect(model.visible).toBe(false); expect(warning.visible).toBe(false);
  r.dispose(); expect(scene.children).toHaveLength(0);
});

it('keeps all resources bounded across repeated overlapping impacts, rewinds and resets', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  const resources = () => { const geometries = new Set(), materials = new Set(); let objects = 0;
    scene.traverse(o => { objects++; if (o instanceof THREE.Mesh) { geometries.add(o.geometry); materials.add(o.material); } });
    return { objects, geometries: geometries.size, materials: materials.size }; };
  const initial = resources();
  for (let cycle = 0; cycle < 40; cycle++) {
    const shells = Array.from({ length: 8 }, (_, i) => ({ ...shell, id: i + 1, launchedAtSeconds: cycle * 4,
      impactAtSeconds: cycle * 4 + shell.flightSeconds }));
    r.update({ shells, elapsedSeconds: cycle * 4 + 1 }, cycle * 4000 + 1000);
    expect(r.getDebugStats()).toMatchObject({ capacity: 8, shells: 8, warnings: 8 });
    r.present(shells.map(s => ({ kind: 'artilleryImpact', id: s.id, x: s.target.x, z: s.target.z,
      radius: s.radius, atSeconds: s.impactAtSeconds, hit: false })), cycle * 4000 + 2200);
    r.update({ shells: [], elapsedSeconds: cycle * 4 + 2.2 }, cycle * 4000 + 2250);
    expect(r.getDebugStats().impacts).toBe(8); expect(resources()).toEqual(initial);
    r.reset(); expect(r.getDebugStats()).toEqual({ capacity: 8, shells: 0, warnings: 0, impacts: 0 });
  }
  r.dispose(); expect(scene.children).toHaveLength(0);
});

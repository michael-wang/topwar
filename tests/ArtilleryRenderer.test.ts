import { expect, it } from 'vitest';
import * as THREE from 'three';
import { EnemyArtilleryRenderer } from '../src/rendering/EnemyArtilleryRenderer';
import { makeArtilleryShell, sampleArtillery } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
import { warningInnerRadius } from '../src/presentation/ArtilleryWarning';
import { GrenadeExplosion } from '../src/rendering/GrenadeExplosion';

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

it('fills the true elapsed proportion inward while retaining the collision boundary', () => {
  for (const progress of [0, .25, .5, .9, 1]) expect(1 - warningInnerRadius(progress) ** 2).toBeCloseTo(progress);
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.update({ shells: [shell], elapsedSeconds: shell.flightSeconds / 2 }, 500);
  const warning = scene.getObjectByName('enemy-shell-warning-0')!;
  const fill = warning.children[1] as THREE.Mesh;
  expect(fill.geometry.attributes.position.getX(0)).toBeCloseTo(Math.sqrt(.5));
  expect(warning.scale.x).toBe(shell.radius); expect(fill.material).toMatchObject({ depthTest: true });
  r.dispose();
});

it('refreshes one 450ms alert that follows the actual player and freezes with presentation time', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.present([{ kind: 'artilleryLaunch', shell }], 1000);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1200, { x: 1.2, z: 0 });
  const alert = scene.getObjectByName('artillery-lock-on')!;
  expect(alert.visible).toBe(true); expect(alert.position.x).toBe(-1.2);
  const scale = alert.scale.x; r.update({ shells: [shell], elapsedSeconds: 1 }, 1200); expect(alert.scale.x).toBe(scale);
  r.present([{ kind: 'artilleryLaunch', shell }], 1300);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1700); expect(alert.visible).toBe(true);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1750); expect(alert.visible).toBe(false);
  r.reset(); expect(alert.visible).toBe(false); r.dispose();
});

it('omits persistent enemy-shell stains while preserving player Grenade stains', () => {
  const a = new GrenadeExplosion(new THREE.Scene(), 8, false), b = new GrenadeExplosion(new THREE.Scene());
  for (const r of [a, b]) { r.present(0, 0, .588, 0); r.update(1300, 0); }
  expect(a.activeScorches).toBe(0); expect(b.activeScorches).toBe(1); a.dispose(); b.dispose();
});

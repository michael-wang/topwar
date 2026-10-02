import { expect, it } from 'vitest';
import * as THREE from 'three';
import { xpEdgeColor, XP_FILL_GRADIENT } from '../src/ui/xpPalette';
import { ART } from '../src/art/ArtDirection';
import { defenseSideDebris } from '../src/rendering/environment/DefenseDebrisLayout';
import { AttackLaneRenderer } from '../src/rendering/AttackLaneRenderer';

it('matches the XP edge to fixed blue/white/ivory/gold stops without a green middle', () => {
  expect(xpEdgeColor(0)).toBe(ART.xp[0].color);
  expect(xpEdgeColor(1)).toBe(ART.xp.at(-1)!.color);
  expect(XP_FILL_GRADIENT).toContain('#f1f8fa 70%');
  for (let percent = 0; percent <= 100; percent++) {
    const color = new THREE.Color(xpEdgeColor(percent / 100));
    const hex = color.getHexString();
    const [r, g, b] = [0, 2, 4].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
    expect(g - Math.max(r, b)).toBeLessThan(8);
    if (percent <= 60) expect(b).toBeGreaterThan(r);
    if (percent >= 90) expect(r).toBeGreaterThan(b + 70);
  }
  expect(xpEdgeColor(-1)).toBe(xpEdgeColor(0));
  expect(xpEdgeColor(2)).toBe(xpEdgeColor(1));
});

it('keeps stable asymmetric debris with unequal gaps, sizes, rotations and cluster density', () => {
  const left = defenseSideDebris(-1), right = defenseSideDebris(1);
  expect(left).toEqual(defenseSideDebris(-1));
  expect(right).toEqual(defenseSideDebris(1));
  expect(left).toHaveLength(18); expect(right).toHaveLength(18);
  expect(left.map(p => p.z)).not.toEqual(right.map(p => p.z));
  expect(left.map(p => p.yaw)).not.toEqual(right.map(p => -p.yaw));
  expect(new Set(left.map(p => p.width)).size).toBeGreaterThan(12);
  const depths = left.map(p => p.z).sort((a, b) => a - b);
  const gaps = depths.slice(1).map((z, index) => z - depths[index]);
  expect(Math.max(...gaps)).toBeGreaterThan(7);
  expect(Math.min(...gaps)).toBeLessThan(.2);
});

it('staggered broken corridor barricades remain stable and anchored to lane boundaries', () => {
  const positions = [-2.8, -1.4, 0, 1.4, 2.8], scene = new THREE.Scene();
  const renderer = new AttackLaneRenderer(scene);
  renderer.update(positions, 0, 0, true);
  const objects = scene.getObjectByName('beach-corridor-openings')!.children.filter(p => p.name === 'beach-obstacle');
  expect(objects.length).toBeLessThan(36);
  const before = objects.map(p => ({ position: p.position.toArray(), rotation: p.rotation.toArray(), scale: p.scale.toArray() }));
  expect(new Set(objects.map(p => p.position.z.toFixed(2))).size).toBeGreaterThan(20);
  const boundaries = [-3.5, -2.1, -.7, .7, 2.1, 3.5];
  for (const object of objects) expect(Math.min(...boundaries.map(x => Math.abs(x - object.position.x)))).toBeLessThan(.05);
  renderer.update(positions, 0, 2.8, true);
  expect(objects.map(p => ({ position: p.position.toArray(), rotation: p.rotation.toArray(), scale: p.scale.toArray() }))).toEqual(before);
  renderer.dispose();
});

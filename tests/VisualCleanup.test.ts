import { expect, it } from 'vitest';
import * as THREE from 'three';
import { xpEdgeColor, XP_FILL_GRADIENT } from '../src/ui/xpPalette';
import { ART } from '../src/art/ArtDirection';
import { defenseSideDebris } from '../src/rendering/environment/DefenseDebrisLayout';
import { AttackLaneRenderer } from '../src/rendering/AttackLaneRenderer';

it('reveals a fixed ocean-to-foam palette with steadily increasing edge brightness', () => {
  expect(xpEdgeColor(0)).toBe(ART.coastalUi.sea);
  expect(xpEdgeColor(.7)).toBe(ART.coastalUi.aqua);
  expect(xpEdgeColor(1)).toBe(ART.coastalUi.foam);
  expect(XP_FILL_GRADIENT).toContain(`${ART.coastalUi.aqua} 70%`);
  let previousBrightness = 0;
  for (let percent = 0; percent <= 100; percent++) {
    const hex = xpEdgeColor(percent / 100);
    const [r, g, b] = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
    const brightness = .2126*r + .7152*g + .0722*b;
    expect(brightness).toBeGreaterThanOrEqual(previousBrightness);
    previousBrightness = brightness;
    if (percent <= 40) expect(b).toBeGreaterThan(r + 80);
    if (percent >= 90) expect(r).toBeGreaterThanOrEqual(186);
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

it('keeps civilian beach sand free of prepared defenses with stable faint scuffs', () => {
  const positions = [-2.8, -1.4, 0, 1.4, 2.8], scene = new THREE.Scene();
  const renderer = new AttackLaneRenderer(scene);
  renderer.update(positions, 0, 0, true);
  expect(scene.getObjectByName('beach-obstacle')).toBeUndefined();
  const objects = scene.getObjectByName('beach-corridor-openings')!.children;
  expect(objects).toHaveLength(45);
  expect(objects.every(object => object.name === 'sand-scuff')).toBe(true);
  const before = objects.map(p => p.position.toArray());
  renderer.update(positions, 0, 2.8, true);
  expect(objects.map(p => p.position.toArray())).toEqual(before);
  renderer.dispose();
});

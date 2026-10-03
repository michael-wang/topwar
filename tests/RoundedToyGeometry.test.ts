import * as THREE from 'three';
import { expect, it } from 'vitest';
import { toyShoe } from '../src/rendering/characters/ToyGeometry';
import { ART } from '../src/art/ArtDirection';

it('builds a short curved shoe with a flattened ground and a quiet sole in one geometry', () => {
  const shoe = toyShoe({ width: .3, height: .14, depth: .24, x: .2, y: .09, z: -.12,
    upper: ART.footwear.enemyUpper, sole: ART.footwear.enemySole });
  const bounds = shoe.boundingBox!, size = bounds.getSize(new THREE.Vector3());
  expect(bounds.min.y).toBeCloseTo(.09); expect(size.y).toBeCloseTo(.14);
  expect(size.x).toBeGreaterThan(size.z); expect(size.z).toBeCloseTo(.24);
  const p = shoe.getAttribute('position'), n = shoe.getAttribute('normal'), colors = shoe.getAttribute('color');
  const top = Array.from({ length: p.count }, (_, i) => i).filter(i => p.getY(i) > .09 + .14 * .98);
  expect(top.every(i => Math.abs(p.getX(i) - .2) < .03)).toBe(true);
  expect(new Set(Array.from({ length: colors.count }, (_, i) => new THREE.Color().fromBufferAttribute(colors, i).getHexString())))
    .toEqual(new Set([ART.footwear.enemyUpper.slice(1), ART.footwear.enemySole.slice(1)]));
  for (let i = 0; i < n.count; i++) expect(new THREE.Vector3().fromBufferAttribute(n, i).length()).toBeCloseTo(1);
  shoe.dispose();
});
it('uses muted mid-value uppers and slightly darker soles rather than white or black dominance', () => {
  for (const [upper, sole] of [[ART.footwear.playerUpper, ART.footwear.playerSole], [ART.footwear.enemyUpper, ART.footwear.enemySole]]) {
    const u = new THREE.Color(upper).convertLinearToSRGB(), s = new THREE.Color(sole).convertLinearToSRGB();
    expect(Math.min(...u.toArray())).toBeGreaterThan(.35); expect(Math.max(...u.toArray())).toBeLessThan(.7);
    expect(Math.min(...s.toArray())).toBeGreaterThan(.3);
    expect(u.g - s.g).toBeGreaterThan(.04); expect(u.g - s.g).toBeLessThan(.15);
  }
});

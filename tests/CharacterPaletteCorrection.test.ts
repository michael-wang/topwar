import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { ENEMY_PALETTE, PLAYER_PALETTE } from '../src/rendering/tierPalettes';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { prepareBossFootwear } from '../src/rendering/boss/BossFootwear';

it('keeps enemy costumes muted olive/slate/stone, Player blue and health independently coral', () => {
  for (const value of [ART.raider.helmet, ART.raider.body, ART.raider.bodyDeep, ...ENEMY_PALETTE.map(p => p.body)]) {
    const color = new THREE.Color(value);
    expect(color.g).toBeGreaterThanOrEqual(color.r * .94);
    expect(value).not.toBe('#c83f5a');
    expect(value).not.toBe(ART.faction.player);
  }
  expect(ART.faction.player).toBe('#287fc6');
  expect(PLAYER_PALETTE[0].body).toBe(ART.faction.player);
  expect(ART.enemyHealth.heavy).toBe('#f2555f'); expect(ART.enemyHealth.giant).toBe('#ef4d59');
});

it('authors role footwear colors on every procedural reference and locomotion body', () => {

  for (const create of [createChibiPlayerFamily, createChibiGruntFamily, createChibiHeavyFamily, createChibiGiantFamily]) {
    const values = create === createChibiPlayerFamily ? [ART.footwear.playerUpper, ART.footwear.playerSole]
      : create === createChibiGruntFamily ? [ART.footwear.enemyUpper, ART.footwear.enemySole] : [ART.faction.shoes];
    const expected = values.map(value => new THREE.Color(value));
    const family = create(), frames = 'runFrames' in family ? [family.body, ...family.runFrames] : [family.body];
    for (const mesh of frames) {
      const p = mesh.geometry.getAttribute('position'), c = mesh.geometry.getAttribute('color');
      const footwear = Array.from({ length: p.count }, (_, i) => i).filter(i => p.getY(i) < .10);
      expect(footwear.length).toBeGreaterThan(0);
      expect(footwear.every(i => expected.some(target => new THREE.Color().fromBufferAttribute(c, i).toArray()
        .every((v, j) => Math.abs(v - target.toArray()[j]) < 1e-6)))).toBe(true);
    }
    family.dispose();
  }
});

it('limits the retained Boss footwear correction to the lower atlas region and composes without extra resources', () => {
  const source = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  expect(prepareBossFootwear(source)).toBe(source);
  const hook = source.onBeforeCompile; prepareBossFootwear(source); expect(source.onBeforeCompile).toBe(hook);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  hook(shader as unknown as Parameters<typeof hook>[0], {} as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain('abs(uv.x - .09375)'); expect(shader.vertexShader).toContain('step(.32, position.y)');
  expect(shader.fragmentShader).toContain(new THREE.Color(ART.faction.shoes).r.toFixed(6));
  expect(source.map).not.toBeNull(); source.map!.dispose(); source.dispose();
});

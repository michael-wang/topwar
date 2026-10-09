import * as THREE from 'three';
import { expect, it } from 'vitest';
import { BAR_TEXTURE_LAYOUT, framedBarTexture } from '../src/rendering/art/FramedBarTextures';
import { giantFillContains, giantFillEnd, prepareGiantBarFill } from '../src/rendering/enemies/GiantHealthBar';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { characterFamilies } from './characterModel';
import type { EnemyRenderState } from '../src/rendering/RenderState';
import { ART } from '../src/art/ArtDirection';

it('changes only the outer armor artwork, preserving every inner-track and fill pixel', () => {
  const rounded = framedBarTexture(false, ART.enemyHealth);
  const armor = framedBarTexture(false, ART.enemyHealth, 'armor');
  const fill = framedBarTexture(true, ART.enemyHealth);
  const armorFill = framedBarTexture(true, ART.enemyHealth, 'armor');
  expect(armorFill.image.data).toEqual(fill.image.data);
  expect(armor.image.data).not.toEqual(rounded.image.data);
  for (let y = 0; y < BAR_TEXTURE_LAYOUT.height; y++) for (let x = 0; x < BAR_TEXTURE_LAYOUT.width; x++) {
    if (!giantFillContains(x, y, 1)) continue;
    const i = (y * BAR_TEXTURE_LAYOUT.width + x) * 4;
    expect(armor.image.data.slice(i, i + 4)).toEqual(rounded.image.data.slice(i, i + 4));
    expect(armor.image.data[i + 3]).toBe(255);
  }
  rounded.dispose(); armor.dispose(); fill.dispose(); armorFill.dispose();
});

it('contains full, half and low HP within the same rounded inner track at any world scale', () => {
  const { width, height, trackInset, radius } = BAR_TEXTURE_LAYOUT;
  const frame = framedBarTexture();
  for (const fraction of [1, .5, .1]) {
    let count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!giantFillContains(x, y, fraction)) continue;
      count++;
      const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
      expect(Math.min(x, width - 1 - x, y, height - 1 - y, radius - Math.hypot(dx, dy))).toBeGreaterThanOrEqual(trackInset);
      expect(x).toBeLessThanOrEqual(giantFillEnd(fraction));
      expect(frame.image.data[(y * width + x) * 4 + 3]).toBe(255);
    }
    expect(count).toBeGreaterThan(0);
    // Left cap is invariant rather than squeezed or moved by fraction.
    expect(giantFillContains(22, 24, fraction)).toBe(true);
    expect(giantFillContains(9, 9, fraction)).toBe(false);
  }
  expect(giantFillEnd(2)).toBe(giantFillEnd(1));
  expect(giantFillEnd(-1)).toBe(giantFillEnd(0));
  expect(giantFillContains(22, 24, 0)).toBe(false);
  frame.dispose();
});

it('clips the Giant fill in frame UV space with reusable uniforms and no additional texture', () => {
  const texture = framedBarTexture(true), material = new THREE.SpriteMaterial({ map: texture });
  const clip = prepareGiantBarFill(material);
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <map_fragment>' };
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  expect(shader.uniforms).toHaveProperty('giantBarFraction', clip.fraction);
  expect(shader.fragmentShader).toContain('vMapUv * vec2(256.0, 48.0)');
  expect(shader.fragmentShader).toContain('smoothstep');
  expect(material.map).toBe(texture);
  material.dispose(); texture.dispose();
});

it('centers the Giant fill on its moving frame and safely reuses the pool for Heavy', () => {
  const scene = new THREE.Scene(), heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily();
  const renderer = new EnemyRenderer(scene, { ...characterFamilies(), heavy, giant });
  const e: EnemyRenderState = { id: 1, archetype: 'giant', tier: 1, x: 1, z: 10, hp: 100, maxHp: 100, visualScale: 3 };
  renderer.update([e], 0);
  for (const [time, fraction] of [[2000, 1], [2100, .5], [2200, .1], [2250, 0]] as const) {
    renderer.update([{ ...e, hp: 100 * fraction }], time);
    const frame = scene.getObjectByName('heavy-hp-backing') as THREE.Sprite;
    const fill = scene.getObjectByName('heavy-hp-fill') as THREE.Sprite;
    const body = scene.getObjectByName('giant-assault-soldier')!;
    expect(frame.position.x).toBeCloseTo(body.position.x);
    expect(fill.position.toArray()).toEqual(frame.position.toArray());
    expect(fill.scale.toArray()).toEqual(frame.scale.toArray());
    expect(frame.scale.x/frame.scale.y).toBeCloseTo(6);
    expect(frame.scale.x).toBeCloseTo(1.20*3);
    expect(frame.scale.y).toBeCloseTo(.20*3);
    expect(frame.visible).toBe(true);
    expect(fill.visible).toBe(fraction > 0);
  }
  renderer.reset();
  renderer.update([{ ...e, archetype: 'heavy', visualScale: 1, hp: 50 }], 2300);
  const frame = scene.getObjectByName('heavy-hp-backing') as THREE.Sprite;
  const fill = scene.getObjectByName('heavy-hp-fill') as THREE.Sprite;
  expect(frame.scale.x).toBeCloseTo(.88);
  expect(fill.scale.x).toBeCloseTo(.78 / 2);
  expect(fill.position.x).toBeCloseTo(-1 + .78 / 4);
  const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '#include <map_fragment>' };
  fill.material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  expect(shader.uniforms.giantBarEnabled.value).toBe(0);
  renderer.dispose(); heavy.dispose(); giant.dispose();
});

it('preserves dedicated Giant bar thickness with two threats and nonuniform character scaling', () => {
  const scene = new THREE.Scene(), heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily();
  const renderer = new EnemyRenderer(scene, { ...characterFamilies(), heavy, giant });
  const enemies: EnemyRenderState[] = [1, 2].map(id => ({ id, archetype: 'giant', tier: 1,
    x: id === 1 ? -1 : 1, z: 10, hp: id === 1 ? 0 : 100, maxHp: 100, visualScaleX: 4, visualScaleY: 3 }));
  renderer.update(enemies, 0); renderer.update(enemies, 2000);
  const frames = scene.children.filter(child => child.name === 'heavy-hp-backing' && child.visible);
  const fills = scene.children.filter(child => child.name === 'heavy-hp-fill');
  expect(frames).toHaveLength(2);
  for (const frame of frames) {
    expect(frame.scale.x).toBeCloseTo(1.20 * 4 * .8);
    expect(frame.scale.y).toBeCloseTo(.20 * 4 * .8);
    expect(frame.scale.x / frame.scale.y).toBeCloseTo(6);
  }
  expect(fills.filter(fill => fill.visible)).toHaveLength(1);
  renderer.dispose(); heavy.dispose(); giant.dispose();
});

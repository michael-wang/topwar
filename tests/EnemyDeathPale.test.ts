import * as THREE from 'three';
import { expect, it } from 'vitest';
import { DEATH_PALE_COMPLETE_MS, DEATH_PALE_COLOR, enemyDeathPale } from '../src/presentation/EnemyDeathPale';
import { BLOOD_RIBBON_START_MS } from '../src/rendering/enemies/IntegratedDeathBlood';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
import { prepareEnemyDeathMaterial } from '../src/rendering/enemies/EnemyDeathMaterial';
import { DEATH_BLOOD_COLORS } from '../src/rendering/enemies/IntegratedDeathBlood';

it('starts in authored colors, drains monotonically with smoothstep and holds pale through breakup/fade', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    expect(enemyDeathPale(0, role)).toBe(0);
    expect(enemyDeathPale(DEATH_PALE_COMPLETE_MS[role] / 2, role)).toBe(.5);
    expect(enemyDeathPale(DEATH_PALE_COMPLETE_MS[role], role)).toBe(1);
    expect(DEATH_PALE_COMPLETE_MS[role]).toBeLessThanOrEqual({ grunt: 140, heavy: 200, giant: 320 }[role]);
    let previous = 0;
    for (let age = 0; age <= ENEMY_DEATH_TIMING[role].totalMs; age += 5) {
      const pale = enemyDeathPale(age, role); expect(pale).toBeGreaterThanOrEqual(previous); previous = pale;
    }
    for (const age of [BLOOD_RIBBON_START_MS[role], ENEMY_DEATH_TIMING[role].totalMs]) expect(enemyDeathPale(age, role)).toBe(1);
  }
});
it('uses a single non-emissive albedo scalar and leaves the crimson blood palette intact', () => {
  expect(DEATH_PALE_COLOR).toBe('#b9beba');
  expect(DEATH_BLOOD_COLORS).toEqual(['#751d27', '#9f2734', '#c93443']);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const tint = prepareEnemyDeathMaterial(material, true);
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  expect(shader.uniforms.deathPale).toBe(tint.pale);
  tint.pale.value = 1; expect(shader.uniforms.deathPale.value).toBe(1);
  expect(material.emissiveIntensity).toBe(0);
  expect(shader.fragmentShader).not.toContain('deathRed');
  material.dispose();
});

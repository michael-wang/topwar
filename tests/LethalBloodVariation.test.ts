import * as THREE from 'three';
import { expect, it } from 'vitest';
import { lethalBloodVariation, LETHAL_BLOOD_ANCHORS } from '../src/rendering/enemies/LethalBloodVariation';
import { hitBloodAtlas, lethalBloodAtlas } from '../src/rendering/enemies/BloodSplat';
import { bloodSplatPose, ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';
import { HIT_BLOOD_TIMING } from '../src/rendering/enemies/EnemyHitImpulse';
it('uses richer connected lethal masks while retaining one atlas-sized texture per burst pool', () => {
  const hit = hitBloodAtlas(), lethal = lethalBloodAtlas(), again = lethalBloodAtlas();
  expect(lethal.image.width).toBe(192); expect(lethal.image.data).toEqual(again.image.data);
  for (let variant = 0; variant < 4; variant++) {
    const alpha = (texture: THREE.DataTexture) => Array.from({ length: 96 * 96 }, (_, i) => texture.image.data[((Math.floor(variant / 2) * 96 + Math.floor(i / 96)) * 192 + variant % 2 * 96 + i % 96) * 4 + 3]);
    const a = alpha(hit), b = alpha(lethal);
    expect(b.filter(v => v > 127).length).toBeGreaterThan(a.filter(v => v > 127).length);
    expect(b).not.toEqual(a);
  }
  hit.dispose(); lethal.dispose(); again.dispose();
});
it('varies lethal body-region, shape and pulse phase without changing death or shared fade clocks', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    const masks = new Set<number>(), anchors = new Set<number>();
    for (let id = 0; id < 100; id++) {
      const v = lethalBloodVariation(id, role), timing = ENEMY_DEATH_TIMING[role];
      expect(v).toEqual(lethalBloodVariation(id, role)); masks.add(v.variant); anchors.add(v.anchor);
      expect(v.localAnchor).toEqual(LETHAL_BLOOD_ANCHORS[role][v.anchor]);
      expect(v.size).toBeGreaterThanOrEqual(.9); expect(v.size).toBeLessThanOrEqual(1.1);
      expect(Math.abs(v.pulseOffset)).toBeLessThanOrEqual(.05);
      expect(timing.bloodScale * v.size).toBeGreaterThan(HIT_BLOOD_TIMING[role].bloodScale * 1.15);
      for (const age of [0, timing.bloodStartMs, timing.fadeStartMs, timing.totalMs - 1, timing.totalMs]) {
        const shifted = bloodSplatPose(age, timing, v.pulseOffset), base = bloodSplatPose(age, timing);
        expect(shifted.visible).toBe(base.visible); expect(shifted.opacity).toBe(base.opacity);
      }
    }
    expect(masks.size).toBe(4); expect(anchors.size).toBe(LETHAL_BLOOD_ANCHORS[role].length);
  }
});

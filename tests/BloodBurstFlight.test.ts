import * as THREE from 'three';
import { expect, it } from 'vitest';
import { BLOOD_PIECE_COUNTS, BLOOD_SIZE_MULTIPLIER, bloodPieceScale, bloodPieceVelocity,
  IntegratedDeathBlood, writeBloodFlight, BLOOD_RELEASE_MS } from '../src/rendering/enemies/IntegratedDeathBlood';

it('launches larger varied masses with true XYZ velocities before gravity takes over', () => {
  for (const role of ['grunt', 'heavy', 'giant'] as const) {
    expect(BLOOD_SIZE_MULTIPLIER[role]).toBeGreaterThanOrEqual(1.8);
    expect(bloodPieceScale(role, 0)).toBeGreaterThan(bloodPieceScale(role, 2));
    for (let variant = 0; variant < 3; variant++) {
      let rising = 0;
      for (let piece = 0; piece < BLOOD_PIECE_COUNTS[role]; piece++) {
        const velocity = bloodPieceVelocity(role, variant, piece);
        expect(velocity).toEqual(bloodPieceVelocity(role, variant, piece));
        expect(Math.abs(velocity[0])).toBeGreaterThan(1.3);
        expect(Math.abs(velocity[2])).toBeGreaterThan(.001);
        if (piece < 2) expect(velocity[2]).toBeGreaterThan(.5);
        if (velocity[1] > 0) rising++;
      }
      expect(rising).toBeGreaterThan(BLOOD_PIECE_COUNTS[role] / 2);
    }
    const blood = new IntegratedDeathBlood(new THREE.Scene());
    const matrix = new THREE.Matrix4().makeScale(role === 'giant' ? 2.66 : 1.4, role === 'giant' ? 2.128 : 1.12, role === 'giant' ? 2.66 : 1.4);
    blood.spawn(3, role, 0, matrix);
    const slot = (blood as unknown as { slots: { gravity: number; expansion: number }[] }).slots[0];
    const flight = new Float64Array(11);
    for (let piece = 0; piece < BLOOD_PIECE_COUNTS[role]; piece++) {
      writeBloodFlight(role, 0, piece, matrix, slot.expansion, slot.gravity, flight);
      const apex = flight[4] / slot.gravity;
      expect(apex).toBeGreaterThan(0);
      expect(apex).toBeLessThan(flight[5]);
      expect(flight[1] + flight[4] * apex - .5 * slot.gravity * apex ** 2).toBeGreaterThan(flight[1]);
      expect(BLOOD_RELEASE_MS[role]).toBeLessThan(({ grunt: 520, heavy: 1100, giant: 2600 })[role] / 3);
    }
    blood.dispose();
  }
});

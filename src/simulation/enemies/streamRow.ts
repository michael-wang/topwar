import { SeededRng } from '../../core/Rng';
import type { EnemyFormationOffset } from './formation';

// Each row derives its own content RNG, independent of gameplay RNG and earlier rows.
export function createEnemyStreamRow(rowIndex: number, columns: number, spacing: number,
  jitter: number, seed: number): EnemyFormationOffset[] {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0) {
    throw new Error('Enemy stream row index must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(columns) || columns <= 0) {
    throw new Error('Enemy stream columns must be a positive safe integer');
  }
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('Enemy stream spacing must be finite and positive');
  }
  if (!Number.isFinite(jitter) || jitter < 0 || jitter >= spacing / 2) {
    throw new Error('Enemy stream jitter must be finite and less than half of spacing');
  }
  const rng = new SeededRng(seed);
  rng.setState((seed ^ Math.imul(rowIndex, 0x9e3779b1)) >>> 0);
  const rowShift = jitter === 0 ? 0 : (rowIndex % 2 === 0 ? -1 : 1) * spacing / 6;
  const offsets: EnemyFormationOffset[] = [];
  for (let column = 0; column < columns; column++) {
    const x = (column - (columns - 1) / 2) * spacing;
    offsets.push(jitter === 0 ? { x, z: 0 } : {
      x: x + rowShift + (rng.nextFloat() * 2 - 1) * jitter,
      z: (rng.nextFloat() * 2 - 1) * jitter,
    });
  }
  return offsets;
}

import { SeededRng } from '../../core/Rng';

export interface EnemyFormationOffset {
  x: number;
  z: number;
}

// Local offsets use +X to the right and +Z forward.
export function createEnemyFormation(count: number, columns: number, spacing: number,
  jitter = 0, seed = 0): EnemyFormationOffset[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error('Enemy count must be a positive safe integer');
  }
  if (!Number.isSafeInteger(columns) || columns <= 0 || columns > count) {
    throw new Error('Enemy formation columns must be a positive safe integer within count');
  }
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('Enemy formation spacing must be finite and greater than zero');
  }
  if (!Number.isFinite(jitter) || jitter < 0 || jitter >= spacing / 2) {
    throw new Error('Enemy formation jitter must be finite, non-negative, and less than half of spacing');
  }
  // This RNG belongs to authored layout only; materialization never consumes the session RNG.
  const rng = new SeededRng(seed);

  const rows = Math.ceil(count / columns);
  const offsets: EnemyFormationOffset[] = [];
  for (let row = 0; row < rows; row++) {
    const membersInRow = Math.min(columns, count - row * columns);
    const z = ((rows - 1) / 2 - row) * spacing;
    // Alternate a small row shift so a jittered stream does not read as straight files.
    const rowShift = jitter === 0 ? 0 : (row % 2 === 0 ? -1 : 1) * spacing / 6;
    for (let column = 0; column < membersInRow; column++) {
      const x = (column - (membersInRow - 1) / 2) * spacing;
      offsets.push(jitter === 0 ? { x, z } : {
        x: x + rowShift + (rng.nextFloat() * 2 - 1) * jitter,
        z: z + (rng.nextFloat() * 2 - 1) * jitter,
      });
    }
  }
  return offsets;
}

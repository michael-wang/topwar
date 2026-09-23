export interface EnemyFormationOffset {
  x: number;
  z: number;
}

// Local offsets use +X to the right and +Z forward.
export function createEnemyFormation(count: number, columns: number, spacing: number): EnemyFormationOffset[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error('Enemy count must be a positive safe integer');
  }
  if (!Number.isSafeInteger(columns) || columns <= 0 || columns > count) {
    throw new Error('Enemy formation columns must be a positive safe integer within count');
  }
  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('Enemy formation spacing must be finite and greater than zero');
  }

  const rows = Math.ceil(count / columns);
  const offsets: EnemyFormationOffset[] = [];
  for (let row = 0; row < rows; row++) {
    const membersInRow = Math.min(columns, count - row * columns);
    const z = ((rows - 1) / 2 - row) * spacing;
    for (let column = 0; column < membersInRow; column++) {
      const x = (column - (membersInRow - 1) / 2) * spacing;
      offsets.push({ x, z });
    }
  }
  return offsets;
}

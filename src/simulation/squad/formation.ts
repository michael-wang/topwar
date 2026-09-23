export interface FormationOffset {
  x: number;
  z: number;
}

// Local offsets use +X to the right and +Z forward.
export function createSquadFormation(count: number, spacing: number): FormationOffset[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Squad count must be a non-negative safe integer');
  }
  if (typeof spacing !== 'number' || !Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('Formation spacing must be finite and greater than zero');
  }
  if (count === 0) return [];

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const offsets: FormationOffset[] = [];

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

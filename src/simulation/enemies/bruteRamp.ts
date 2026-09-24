export interface BruteRamp {
  startRow: number;
  fullRow: number;
  curvePower: number;
}

export function tier2ProbabilityForRow(rowIndex: number, ramp: BruteRamp): number {
  if (rowIndex <= ramp.startRow) return 0;
  if (rowIndex >= ramp.fullRow) return 1;
  const progress = (rowIndex - ramp.startRow) / (ramp.fullRow - ramp.startRow);
  return Math.min(1, Math.max(0, progress ** ramp.curvePower));
}

// A slot's roll depends only on authored content, never on gameplay RNG or prior rows.
export function tier2RollForSlot(seed: number, rowIndex: number, column: number): number {
  let bits = (seed ^ Math.imul(rowIndex + 1, 0x9e3779b1)
    ^ Math.imul(column + 1, 0x85ebca6b)) >>> 0;
  bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
  bits = Math.imul(bits ^ (bits >>> 15), 0x846ca68b);
  return ((bits ^ (bits >>> 16)) >>> 0) / 0x100000000;
}

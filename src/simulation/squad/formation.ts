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
  if (count === 1) return [{ x: 0, z: 0 }];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const offsets: FormationOffset[] = [];
  let sumX = 0;
  let sumZ = 0;
  for (let index = 0; index < count; index++) {
    const radius = spacing * 0.6 * Math.sqrt(index + 0.5);
    const angle = index * goldenAngle;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    offsets.push({ x, z });
    sumX += x;
    sumZ += z;
  }
  return offsets.map(({ x, z }) => ({ x: x - sumX / count, z: z - sumZ / count }));
}

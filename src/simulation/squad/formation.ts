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


// The first three Rifle members remain within the same corridor; no independent lane targets.
export function createDefenseSquadFormation(count: number, spacing: number,
  pair?: { reinforcementSpacing: number; reinforcementStagger: number }): FormationOffset[] {
  if (count === 3 && pair) return [
    { x: -pair.reinforcementSpacing / 2, z: pair.reinforcementStagger * 2 },
    { x: 0, z: -pair.reinforcementStagger * 4 },
    { x: pair.reinforcementSpacing / 2, z: pair.reinforcementStagger * 2 },
  ];
  return count === 2 && pair ? [
    { x: -pair.reinforcementSpacing / 2, z: pair.reinforcementStagger / 2 },
    { x: pair.reinforcementSpacing / 2, z: -pair.reinforcementStagger / 2 },
  ] : createSquadFormation(count, spacing);
}

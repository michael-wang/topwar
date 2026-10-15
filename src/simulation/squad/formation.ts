export interface FormationOffset {
  x: number;
  z: number;
}

type DefenseFormation = { reinforcementSpacing: number; reinforcementStagger: number };

// Compact asymmetric edge poses retain a soldier at physical X, rather than
// moving the squad into the neighboring lane. Cropping outranks false safety.
const EDGE_FOUR = [[-.45,.35],[-.15,-.35],[0,.6],[.18,1.2]];
const EDGE_FIVE = [[-.5,.6],[-.25,-.15],[0,.5],[.18,1.25],[.3,-.65]];
/** Rewrites the existing pool too (Victory), with no accumulated deformation. */
export function adjustDefenseSquadEdges(offsets: FormationOffset[], formation: DefenseFormation | undefined,
  playerX: number, laneEdgeX = Infinity): void {
  const count = offsets.length;
  if (!formation || (count !== 4 && count !== 5)) return;
  const t = Number.isFinite(laneEdgeX) ? Math.max(0, Math.min(1, (Math.abs(playerX) / laneEdgeX - .5) * 2)) : 0;
  const blend = t * t * (3 - 2 * t), side = Math.sign(playerX);
  const edge = count === 4 ? EDGE_FOUR : EDGE_FIVE;
  for (let i = 0; i < count; i++) {
    const baseX = formation.reinforcementSpacing * (count === 4 ? (i - 1.5) * .5 : (i - 2) * .45);
    const baseZ = formation.reinforcementStagger * (count === 4 ? (i === 0 || i === 3 ? 3 : -1.5) : (i === 0 || i === 4 ? 4 : i === 2 ? -4 : 0));
    const pose = edge[side < 0 ? count - 1 - i : i];
    offsets[i].x = baseX + (side * pose[0] - baseX) * blend;
    offsets[i].z = baseZ + (pose[1] - baseZ) * blend;
  }
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


// Defense permits four/five members only for MG. All consumers share these
// physical anchors; extra width never grants independent lane targets.
export function createDefenseSquadFormation(count: number, spacing: number,
  pair?: DefenseFormation, playerX = 0, laneEdgeX = Infinity): FormationOffset[] {
  if ((count === 4 || count === 5) && pair) {
    const offsets = Array.from({length: count}, () => ({x: 0, z: 0}));
    adjustDefenseSquadEdges(offsets, pair, playerX, laneEdgeX);
    return offsets;
  }
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

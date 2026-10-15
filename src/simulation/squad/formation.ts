export interface FormationOffset {
  x: number;
  z: number;
}

type DefenseFormation = { reinforcementSpacing: number; reinforcementStagger: number };

// Camera B's portrait horizontal coverage is constant. Leave room for the toy
// silhouette/weapon (including spawn scale), without moving the physical player.
const MG_VISIBLE_EDGE_X = 2.15, MG_EDGE_BODY_MARGIN = .35, MG_EDGE_BLEND = .1;
export function defenseSquadInwardShift(count: number, formation: DefenseFormation | undefined,
  playerX: number, laneEdgeX = Infinity): number {
  if (!formation || (count !== 4 && count !== 5)) return 0;
  const radius = formation.reinforcementSpacing * (count === 4 ? .75 : .9);
  const edge = Math.min(MG_VISIBLE_EDGE_X, laneEdgeX - MG_EDGE_BODY_MARGIN);
  const overrun = Math.abs(playerX) + radius - edge;
  // A short C1 blend eases into the bound; outside it, shift only the overrun.
  const shift = overrun <= -MG_EDGE_BLEND ? 0 : overrun >= MG_EDGE_BLEND ? overrun
    : (overrun + MG_EDGE_BLEND) ** 2 / (4 * MG_EDGE_BLEND);
  return shift === 0 ? 0 : -Math.sign(playerX) * shift;
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
  const shift = defenseSquadInwardShift(count, pair, playerX, laneEdgeX);
  if (count === 4 && pair) return [
    { x: shift - pair.reinforcementSpacing * .75, z: pair.reinforcementStagger * 3 },
    { x: shift - pair.reinforcementSpacing * .25, z: -pair.reinforcementStagger * 1.5 },
    { x: shift + pair.reinforcementSpacing * .25, z: -pair.reinforcementStagger * 1.5 },
    { x: shift + pair.reinforcementSpacing * .75, z: pair.reinforcementStagger * 3 },
  ];
  if (count === 5 && pair) return [
    { x: shift - pair.reinforcementSpacing * .9, z: pair.reinforcementStagger * 4 },
    { x: shift - pair.reinforcementSpacing * .45, z: 0 },
    { x: shift, z: -pair.reinforcementStagger * 4 },
    { x: shift + pair.reinforcementSpacing * .45, z: 0 },
    { x: shift + pair.reinforcementSpacing * .9, z: pair.reinforcementStagger * 4 },
  ];
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

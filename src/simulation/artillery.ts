import { z } from 'zod';
import { ARTILLERY_CAPACITY, ArtilleryFlightSchema, type ArtilleryFlightParameters } from '../config/artilleryConfig';

const point = z.strictObject({ x: z.number().finite().min(-200).max(200),
  y: z.number().finite().min(0).max(100), z: z.number().finite().min(-200).max(200) });
const sourceSchema = z.strictObject({ id: z.string().min(1).max(80),
  type: z.string().min(1).max(40), position: point });
const shellSchema = z.strictObject({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1), source: sourceSchema,
  launchedAtSeconds: z.number().finite().nonnegative(), impactAtSeconds: z.number().finite().nonnegative(),
  targetLane: z.number().int().nonnegative(), target: point,
  flight: ArtilleryFlightSchema, flightSeconds: z.number().finite().positive(),
  radius: z.number().finite().positive(),
});
export const ArtilleryStateSchema = z.strictObject({
  version: z.literal(1), nextId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  shells: z.array(shellSchema).max(ARTILLERY_CAPACITY),
});
export type ArtilleryShell = z.infer<typeof shellSchema>;
export type ArtilleryState = z.infer<typeof ArtilleryStateSchema>;
export type ArtillerySource = z.infer<typeof sourceSchema>;
export interface ArtilleryLaunch { source: ArtillerySource; targetLane?: number; flight?: ArtilleryFlightParameters }
export type ArtilleryEvent = { kind: 'artilleryLaunch'; shell: ArtilleryShell }
  | { kind: 'artilleryImpact'; id: number; x: number; z: number; radius: number; atSeconds: number; hit: boolean };

export function effectiveArtilleryLane(x: number, lanes: readonly number[]): number {
  let lane = 0;
  for (let i = 1; i < lanes.length; i++) if (Math.abs(lanes[i] - x) < Math.abs(lanes[lane] - x)) lane = i;
  return lane; // Exact midpoint ties go to the lower index, independently of selectedLane.
}

export function artilleryFlightSeconds(source: ArtillerySource['position'], target: ArtilleryShell['target'],
  flight: ArtilleryFlightParameters): number {
  return Math.max(flight.minimumFlightSeconds, Math.hypot(target.x - source.x, target.z - source.z) / flight.horizontalSpeed);
}

// Constant horizontal velocity + constant gravity. The solved vertical velocity
// reaches the locked ground point at exactly the authoritative deadline.
export function sampleArtillery(shell: Readonly<ArtilleryShell>, atSeconds: number,
  out = { x: 0, y: 0, z: 0 }): typeof out {
  const t = Math.max(0, Math.min(shell.flightSeconds, atSeconds - shell.launchedAtSeconds));
  const source = shell.source.position, f = t / shell.flightSeconds;
  const vy = (shell.target.y - source.y) / shell.flightSeconds + .5 * shell.flight.gravity * shell.flightSeconds;
  out.x = source.x + (shell.target.x - source.x) * f;
  out.y = source.y + vy * t - .5 * shell.flight.gravity * t * t;
  out.z = source.z + (shell.target.z - source.z) * f;
  return out;
}

export function makeArtilleryShell(id: number, launch: ArtilleryLaunch, lane: number,
  lanes: readonly number[], targetZ: number, now: number, flight: ArtilleryFlightParameters, radius: number): ArtilleryShell {
  const source = sourceSchema.parse(launch.source);
  if (!Number.isInteger(lane) || lane < 0 || lane >= lanes.length) throw Error('Invalid artillery target lane');
  const parameters = ArtilleryFlightSchema.parse(launch.flight ?? { horizontalSpeed: flight.horizontalSpeed,
    gravity: flight.gravity, minimumFlightSeconds: flight.minimumFlightSeconds });
  const target = { x: lanes[lane], y: 0, z: targetZ };
  const duration = artilleryFlightSeconds(source.position, target, parameters);
  return shellSchema.parse({ id, source, targetLane: lane, target, flight: parameters,
    launchedAtSeconds: now, impactAtSeconds: now + duration, flightSeconds: duration, radius });
}

export function artilleryHits(shell: Readonly<ArtilleryShell>, playerX: number, playerZ: number): boolean {
  return (playerX - shell.target.x) ** 2 + (playerZ - shell.target.z) ** 2 <= shell.radius ** 2;
}

export function validateArtillery(value: unknown, now: number, lanes: readonly number[], targetZ: number,
  alive: boolean): ArtilleryState {
  const state = ArtilleryStateSchema.parse(value), ids = new Set<number>();
  for (const shell of state.shells) {
    const duration = artilleryFlightSeconds(shell.source.position, shell.target, shell.flight);
    if (!alive || ids.has(shell.id) || shell.id >= state.nextId || shell.targetLane >= lanes.length
      || shell.launchedAtSeconds > now || shell.impactAtSeconds <= now
      || shell.target.y !== 0 || shell.target.z !== targetZ
      || shell.target.x !== lanes[shell.targetLane]
      || shell.radius >= (lanes[1] - lanes[0]) / 2
      || Math.abs(duration - shell.flightSeconds) > 1e-9
      || Math.abs(shell.impactAtSeconds - shell.launchedAtSeconds - duration) > 1e-9)
      throw Error('Invalid artillery snapshot');
    ids.add(shell.id);
  }
  return state;
}

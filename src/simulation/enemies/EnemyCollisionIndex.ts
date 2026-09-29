import type { EnemySimulationState } from '../SimulationState';

// One world unit per cell keeps the projectile query local to nearby stream rows.
const CELL_SIZE = 1;

export interface EnemyCandidateSource {
  forEachCandidate(minX: number, maxX: number, minZ: number, maxZ: number,
    visit: (enemy: EnemySimulationState) => void): void;
}

// Step-local index. Enemies occupy one center cell; the query expands by the exact
// hit radius and one cell of conservative padding at floating-point boundaries.
export class EnemyCollisionIndex implements EnemyCandidateSource {
  private readonly columns = new Map<number, Map<number, EnemySimulationState[]>>();
  private readonly removed = new Set<EnemySimulationState>();

  constructor(enemies: readonly EnemySimulationState[]) {
    for (const enemy of enemies) {
      const xCell = Math.floor(enemy.x / CELL_SIZE);
      const zCell = Math.floor(enemy.z / CELL_SIZE);
      let rows = this.columns.get(xCell);
      if (!rows) { rows = new Map(); this.columns.set(xCell, rows); }
      let bucket = rows.get(zCell);
      if (!bucket) { bucket = []; rows.set(zCell, bucket); }
      bucket.push(enemy);
    }
  }

  remove(enemy: EnemySimulationState): void { this.removed.add(enemy); }

  forEachCandidate(minX: number, maxX: number, minZ: number, maxZ: number,
    visit: (enemy: EnemySimulationState) => void): void {
    const firstX = Math.floor(minX / CELL_SIZE) - 1;
    const lastX = Math.floor(maxX / CELL_SIZE) + 1;
    const firstZ = Math.floor(minZ / CELL_SIZE) - 1;
    const lastZ = Math.floor(maxZ / CELL_SIZE) + 1;
    for (const [xCell, rows] of this.columns) {
      if (xCell < firstX || xCell > lastX) continue;
      // A long direct step can cross many empty cells; visit occupied rows instead.
      if (lastZ - firstZ > rows.size * 2) {
        for (const [zCell, bucket] of rows) {
          if (zCell < firstZ || zCell > lastZ) continue;
          for (const enemy of bucket) if (!this.removed.has(enemy)) visit(enemy);
        }
      } else {
        for (let zCell = firstZ; zCell <= lastZ; zCell++) {
          const bucket = rows.get(zCell);
          if (bucket) for (const enemy of bucket) if (!this.removed.has(enemy)) visit(enemy);
        }
      }
    }
  }
}

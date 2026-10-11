import type { EnemySimulationState, SimulationState } from '../../src/simulation/SimulationState';
import type { ProgressionState } from '../../src/simulation/progression';

export interface DiagnosticObserver {
  admitted(enemies: EnemySimulationState[], metadata: { row?: number; cursor?: number }): void;
  positions(enemies: EnemySimulationState[]): void;
  hit(enemy: EnemySimulationState, damage: number, cause: string): void;
  removed(enemy: EnemySimulationState, cause: string): void;
  reward(enemy: EnemySimulationState, amount: number, before: ProgressionState, after: ProgressionState): void;
  phase(name: string): void;
  frame(progression: ProgressionState | undefined, squad: SimulationState['squad'], playerZ: number): void;
}
// This module is referenced exclusively by the private QA source transform.
// Observation is synchronous and read-only; one run binds one collector.
let observer: DiagnosticObserver | undefined;
export function bindObserver(next?: DiagnosticObserver): void { observer = next; }
export function admitted(...args: Parameters<DiagnosticObserver['admitted']>): void { observer?.admitted(...args); }
export function positions(...args: Parameters<DiagnosticObserver['positions']>): void { observer?.positions(...args); }
export function hit(...args: Parameters<DiagnosticObserver['hit']>): void { observer?.hit(...args); }
export function removed(...args: Parameters<DiagnosticObserver['removed']>): void { observer?.removed(...args); }
export function reward(...args: Parameters<DiagnosticObserver['reward']>): void { observer?.reward(...args); }
export function phase(...args: Parameters<DiagnosticObserver['phase']>): void { observer?.phase(...args); }
export function frame(...args: Parameters<DiagnosticObserver['frame']>): void { observer?.frame(...args); }

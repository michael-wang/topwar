import type { SquadSimulationState } from './SimulationState';

export type PresentationEvent = {
  kind: 'normalEnemyContact';
  enemyId: number;
  enemyTier: number;
  attackerX: number;
  attackerZ: number;
  playerX: number;
  playerZ: number;
  before: SquadSimulationState;
  after: SquadSimulationState;
} | {
  kind: 'bossSlam';
  bossId: number;
  bossTier: number;
  slamCount: number;
  attackerX: number;
  attackerZ: number;
  playerX: number;
  playerZ: number;
  before: SquadSimulationState;
  after: SquadSimulationState;
};

export function copySquadForPresentation(squad: SquadSimulationState): SquadSimulationState {
  return { count: squad.count, rocketCount: squad.rocketCount,
    rifleCounts: [...squad.rifleCounts], rifleRemainder: squad.rifleRemainder };
}

import { effectiveRifleFireRate, type ProgressionBalance, type ProgressionState } from '../simulation/progression';
export interface LoadoutContext {
  baseFireRate: number;
  squadCount: number;
  initialSquadCount: number;
  reinforcementArrived: boolean;
}
export function loadoutPresentation(state: Readonly<ProgressionState>, balance: ProgressionBalance, context: LoadoutContext): {
  weapon: 'rifle'; trait: 'fireRate' | 'squad'; value: string;
} {
  const reinforced = context.reinforcementArrived && context.squadCount > context.initialSquadCount;
  return { weapon: 'rifle', trait: reinforced ? 'squad' : 'fireRate', value: reinforced
    ? `×${Number((context.squadCount / context.initialSquadCount).toFixed(2))}`
    : `+${Math.round((effectiveRifleFireRate(context.baseFireRate, state.level, balance) / context.baseFireRate - 1) * 100)}%` };
}

import { progressionStage, type ProgressionState, type ProgressionBalance } from '../simulation/progression';

// Unlock stages describe progression; living squad count deliberately has no input here.
export function loadoutPresentation(state: Readonly<ProgressionState>, balance: ProgressionBalance) {
  const plan = progressionStage(state.level, balance);
  return { weapon: plan.weaponFamily, weaponStage: plan.fireRateStage,
    squadStage: plan.squadStage > 1 ? plan.squadStage : null };
}

import { progressionStage, type ProgressionState, type ProgressionBalance } from '../simulation/progression';

// Unlock stages describe progression; living squad count deliberately has no input here.
export function loadoutPresentation(state: Readonly<ProgressionState>, balance: ProgressionBalance): {
  weapon: 'rifle' | 'machineGun'; enhancement: { kind: 'cartridge' | 'soldier'; stage: number; slots: 3 };
} {
  const plan = progressionStage(state.level, balance);
  return { weapon: plan.weaponFamily, enhancement: {
    kind: plan.squadStage > 1 ? 'soldier' : 'cartridge',
    stage: plan.squadStage > 1 ? plan.squadStage : plan.fireRateStage,
    slots: 3,
  } };
}

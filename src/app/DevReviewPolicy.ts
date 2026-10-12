import type { SimulationOptions } from '../simulation/Simulation';
import { destroyerDefaults } from '../config/destroyerConfig';

// Isolated historical comparisons opt out of shipping level triggers. Their
// complete saved configuration remains authoritative through Retry/recovery.
export function isolatedReviewOptions(options: SimulationOptions): SimulationOptions {
  if (!options.catharsis) return options;
  const { levelEncounters: _encounters, navalBarrage: _barrage, defenseTank: _tank, ...balance } = options.catharsis.balance;
  if (balance.destroyer?.attackPolicy === 'barrage') {
    const {attackPolicy: _policy, ...destroyer}=balance.destroyer;
    balance.destroyer={...destroyer,shotTimes:[...destroyerDefaults.shotTimes]};
  }
  return { ...options, catharsis: { ...options.catharsis, balance } };
}

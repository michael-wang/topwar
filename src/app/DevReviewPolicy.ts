import type { SimulationOptions } from '../simulation/Simulation';

// Isolated historical comparisons opt out of shipping level triggers. Their
// complete saved configuration remains authoritative through Retry/recovery.
export function isolatedReviewOptions(options: SimulationOptions): SimulationOptions {
  if (!options.catharsis) return options;
  const { levelEncounters: _encounters, ...balance } = options.catharsis.balance;
  return { ...options, catharsis: { ...options.catharsis, balance } };
}

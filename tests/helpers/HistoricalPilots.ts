// Existing accepted-balance regressions must not inherit future shipping encounters/profiles.
import data from '../fixtures/pre-b6b4-game.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { carnivalOptionsFor, carnivalEntry as currentEntry, runCarnivalPilot as currentPilot } from '../../scripts/qa/carnivalPilot';
export { carnivalPilotLane, carnivalPilotGrenade } from '../../scripts/qa/carnivalPilot';
export const carnivalConfig = GameConfigSchema.parse(data);
export const carnivalOptions = carnivalOptionsFor(carnivalConfig);
export const carnivalEntry = (seed = 17) => currentEntry(seed, carnivalConfig);
export const runCarnivalPilot = (seed: number, natural = false, grenades = false, activeLimit?: number) =>
  currentPilot(seed, natural, grenades, activeLimit, carnivalConfig);

import { createSurvivalReview } from './DevSurvivalReview';
import type { SimulationOptions } from '../simulation/Simulation';
import { emptyLevelEncounters } from '../simulation/levelEncounters';
import { emptyNavalPresence } from '../simulation/navalPresence';
import { emptyNavalBarrage } from '../simulation/navalBarrage';
import { emptyDestroyer } from '../simulation/destroyer';
export type NavalBarrageReviewLevel = 8 | 9 | 10;
export type NavalBarrageReviewFixture = `barrage${NavalBarrageReviewLevel}-${'on' | 'off'}`;

// DEV only. Both choices have identical AHEAD enemies, placement, seed and
// weapons. A reusable presence/barrage starts without replaying the intro.
export function createNavalBarrageReview(options: SimulationOptions, rate: number, role: NavalBarrageReviewFixture, seed=17) {
  const [levelText, choice]=role.split('-'), level=Number(levelText.slice(7)) as NavalBarrageReviewLevel;
  if(![8,9,10].includes(level) || !['on','off'].includes(choice) || !options.catharsis?.balance.navalBarrage)
    throw Error('Invalid NAVAL BARRAGE review');
  const sim=createSurvivalReview(options,rate,`survival${level}-ahead`,seed), state=sim.getState(), balance=state.catharsis!.balance;
  balance.levelEncounters={version:1,initialOrdinaryEnabled:true,triggers:[]};
  balance.navalBarrage=structuredClone(options.catharsis.balance.navalBarrage); balance.navalBarrage.enabled=true;
  balance.destroyer=structuredClone(options.catharsis.balance.destroyer!);balance.destroyer.enabled=true; state.destroyer=emptyDestroyer(true);
  state.levelEncounters=emptyLevelEncounters(balance.levelEncounters);state.levelEncounters.survivalEnabled=true;
  state.navalPresence=emptyNavalPresence();state.navalBarrage=emptyNavalBarrage(seed,balance.navalBarrage);
  sim.restoreState(state);sim.commandEncounter('destroyerEnter');if(choice==='on')sim.commandEncounter('barrageOn');
  return sim;
}

import { carnivalEntry } from '../../scripts/qa/carnivalPilot';
import { emptyLevelEncounters } from '../../src/simulation/levelEncounters';
import { enterNavalPresence, emptyNavalPresence } from '../../src/simulation/navalPresence';
import { pilotTuning } from '../../scripts/qa/p15Pilot';
import { emptyNavalBarrage } from '../../src/simulation/navalBarrage';
import historicalData from '../fixtures/pre-b6b5-game.json';
import { GameConfigSchema } from '../../src/config/configSchema';

export function modularIntro(seed = 17, config = GameConfigSchema.parse(historicalData)) {
  const sim = carnivalEntry(seed,config); sim.step(1/60,{targetX:0},pilotTuning);
  const s = sim.getState(), start = s.machineGunReleaseAtSeconds!;
  s.catharsis!.balance.levelEncounters = structuredClone(config.catharsis!.levelEncounters!);
  s.catharsis!.balance.destroyer=structuredClone(config.catharsis!.destroyer!);
  s.catharsis!.balance.navalBarrage=structuredClone(config.catharsis!.navalBarrage!);
  s.navalBarrage=emptyNavalBarrage(seed,s.catharsis!.balance.navalBarrage);
  s.levelEncounters = emptyLevelEncounters(s.catharsis!.balance.levelEncounters);
  s.levelEncounters.ordinaryEnabled = false;
  s.levelEncounters.triggers = s.levelEncounters.triggers.map(t => ({ ...t, anchorAtSeconds: start,
    consumedAtSeconds: t.id === 'naval-intro' ? start : null }));
  s.navalPresence = enterNavalPresence(emptyNavalPresence(), start);
  sim.restoreState(s); return sim;
}

import { carnivalEntry, carnivalConfig } from '../../scripts/qa/carnivalPilot';
import { emptyLevelEncounters } from '../../src/simulation/levelEncounters';
import { enterNavalPresence, emptyNavalPresence } from '../../src/simulation/navalPresence';
import { pilotTuning } from '../../scripts/qa/p15Pilot';

export function modularIntro(seed = 17) {
  const sim = carnivalEntry(seed); sim.step(1/60,{targetX:0},pilotTuning);
  const s = sim.getState(), start = s.machineGunReleaseAtSeconds!;
  s.catharsis!.balance.levelEncounters = structuredClone(carnivalConfig.catharsis!.levelEncounters!);
  s.levelEncounters = emptyLevelEncounters(s.catharsis!.balance.levelEncounters);
  s.levelEncounters.ordinaryEnabled = false;
  s.levelEncounters.triggers = s.levelEncounters.triggers.map(t => ({ ...t, anchorAtSeconds: start,
    consumedAtSeconds: t.id === 'naval-intro' ? start : null }));
  s.navalPresence = enterNavalPresence(emptyNavalPresence(), start);
  sim.restoreState(s); return sim;
}

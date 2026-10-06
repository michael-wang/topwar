import data from '../../public/game-data/game.json';
import { GameConfigSchema } from '../../src/config/configSchema';
import { Simulation } from '../../src/simulation/Simulation';
import { pilotTuning } from './p15Pilot';

const c = GameConfigSchema.parse(data);
export function controlledSimulation(level: 5 | 6) {
  const sim = new Simulation({ seed: 17, level: { id: 'p2a-controlled', length: 1000, enemyGroups: [], upgradeGates: [] },
    startSquad: 1, startRocketCount: 0, tiers: c.tiers,
    catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } });
  const state = sim.getState(), count = level === 5 ? 3 : 1, rate = level === 5 ? 4.5 : 18;
  state.progression = { level, xp: 0 };
  state.squad = { count, rocketCount: 0, rifleCounts: [count], rifleRemainder: 0 };
  state.weapons.rifleMemberCooldowns = Array.from({ length: count }, (_, i) => i / (count * rate));
  sim.restoreState(state); return sim;
}
export function comparePrimary(level: 5 | 6) {
  const cadence = controlledSimulation(level);
  const step = (sim: Simulation) => sim.step(1/60, { targetX: 0 }, pilotTuning);
  for (let i=0;i<60;i++) step(cadence);
  const before = cadence.getState().weapons.nextProjectileId;
  for (let i=0;i<600;i++) step(cadence);
  const shotsPerSecond = (cadence.getState().weapons.nextProjectileId-before)/10;
  function encounter(heavy: boolean) {
    const sim = controlledSimulation(level), state = sim.getState();
    const count = heavy ? 1 : 30;
    state.enemies = Array.from({length:count}, (_,i)=>({ id:i+1, tier:1, lane:2, x:0,
      z:12+i*.02, hp:heavy?15:1, archetype:heavy?'heavy' as const:'grunt' as const }));
    sim.restoreState(state);
    let firstHit: number | null = null;
    while (sim.getFrameState().enemies.length && sim.getFrameState().elapsedSeconds<10) {
      step(sim); const frame = sim.getFrameState();
      if (firstHit===null && (heavy ? frame.enemies[0]?.hp!==15 : frame.enemies.length<count)) firstHit=frame.elapsedSeconds;
    }
    const end = sim.getState();
    return { seconds:end.elapsedSeconds, firstHit, focusedSeconds:end.elapsedSeconds-firstHit!,
      kills:count-end.enemies.length, killsPerSecond:(count-end.enemies.length)/end.elapsedSeconds,
      remainingHp:end.enemies[0]?.hp??0, squadCount:end.squad.count };
  }
  return { level, squad:level===5?3:1, shotsPerSecond, grunts:encounter(false), heavy:encounter(true) };
}

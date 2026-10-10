import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { pressureGroupSize, pressureWaveSettings } from '../src/simulation/enemies/latePressure';
import { laneCompositionForRow, laneWave } from '../src/simulation/enemies/laneComposition';
import { Simulation } from '../src/simulation/Simulation';
import { pilotTuning } from '../scripts/qa/p15Pilot';
const config=GameConfigSchema.parse(data), balance=config.catharsis!;
const level=LevelDefinitionSchema.parse(levelData);

it.each([[1,27,3,.25],[2,59,3,.25],[3,109,3,.25],[4,0,3,.25],[4,62,3,.25],
  [4,63,4,.25],[4,179,4,.25],[5,0,3,.25],[5,54,3,.25],[5,55,3,.25],[5,219,3,.25],[6,0,3,.25]])
  ('authors future fronts/chance for Lv%s XP%s as %s / %s', (level,xp,fronts,chance) => {
    expect(pressureWaveSettings(balance,{level,xp})).toEqual({pressureLaneCount:fronts,heavyChance:chance, ...((level===6 || (level===4&&xp>=63) || (level===5&&xp>=55)) ? {heavyCount:level===4?2:level===5?3:1} : {})});
  });

it('uses the current authored XP requirement and leaves old snapshot balances on their original path', () => {
  const edited={...balance,progression:{...balance.progression,xpRequirements:[28,60,110,200,300]}};
  expect(pressureWaveSettings(edited,{level:4,xp:69}).pressureLaneCount).toBe(3);
  expect(pressureWaveSettings(edited,{level:4,xp:70}).pressureLaneCount).toBe(4);
  expect(pressureWaveSettings(edited,{level:5,xp:74}).heavyChance).toBe(.25);
  expect(pressureWaveSettings(edited,{level:5,xp:75}).heavyCount).toBe(3);
  const old=structuredClone(balance);delete old.pressureRamp;
  expect(pressureWaveSettings(old,{level:5,xp:219})).toEqual({pressureLaneCount:3,heavyChance:.25});
});

it('keeps group populations, HP and speeds fixed while authoring late fronts and exact Heavy counts', () => {
  for (const [level,xp] of [[4,63],[5,55]]) {
    const late={...balance,...pressureWaveSettings(balance,{level,xp}),groupSize:pressureGroupSize(balance,level)};
    const early={...balance,...pressureWaveSettings(balance,{level,xp:0})};
    let earlyHeavies=0,lateHeavies=0;
    for(let group=0;group<1000;group++) {
      const earlyWave=laneWave(group,17,early),lateWave=laneWave(group,17,late);
      earlyHeavies+=Number(earlyWave.heavy);lateHeavies+=laneCompositionForRow(group*balance.waveRows,17,late,3.2).filter(e=>e.archetype==='heavy').length;
      expect(lateWave.lanes).toHaveLength(level===4?4:3);expect(new Set(lateWave.lanes).size).toBe(level===4?4:3);
    }
    expect(lateHeavies).toBeGreaterThan(earlyHeavies);expect(lateHeavies).toBe(level===4?2000:3000);
    const members=laneCompositionForRow(120,17,late,3.2);
    expect(members).toHaveLength(level===4?24:30);expect(new Set(members.map(e=>e.lane)).size).toBe(level===4?4:3);
    expect(members).toEqual(laneCompositionForRow(120,17,late,3.2));
    expect([late.heavyHp,late.gruntSpeed,late.heavySpeed]).toEqual([15,.85,.72]);
  }
});

it.each([4,5])('admits only future Lv%s groups using saved XP, with identical JSON continuation', levelNumber => {
  const make=()=>new Simulation({seed:17,level,startSquad:1,startRocketCount:0,tiers:config.tiers,
    catharsis:{balance,trackHalfWidth:3.2}});
  const sim=make(),s=sim.getState();
  const threshold=levelNumber===4?63:55;
  s.progression={level:levelNumber,xp:threshold-1};
  s.giantEncounter={scheduledAtSeconds:0,spawned:true};
  s.weapons.rifleCooldownRemainingSeconds=100;s.weapons.rifleMemberCooldowns=[100];
  s.enemyStream!.nextRowIndex=120; s.defenseWaves={nextAtSeconds:2/60};
  s.player.z=level.enemyStream!.startZ+120*level.enemyStream!.spacing-balance.defenseSpawnAheadDistance-.02;
  s.enemies=[{id:1,tier:1,archetype:'heavy',lane:2,x:0,z:s.player.z+20,hp:7}];
  s.enemyStream!.nextEnemyId=2;sim.restoreState(s);
  // Cross one ordinary kill boundary just before admission, using the real XP path.
  const pending=sim.getState();pending.enemies.push({id:2,tier:1,archetype:'grunt',lane:2,x:0,z:pending.player.z+3,hp:1});
  pending.enemyStream!.nextEnemyId=3;
  pending.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,x:0,z:pending.player.z+2.5,slopeX:0,
    speed:60,damage:config.tiers.tier1Power,remainingRange:80,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  pending.weapons.nextProjectileId=2;sim.restoreState(pending);
  sim.step(1/60,{targetX:0},pilotTuning);
  expect(sim.getState().progression!.xp).toBe(threshold);
  const snapshot=JSON.parse(JSON.stringify(sim.getState())),restored=make();restored.restoreState(snapshot);
  for(let i=0;i<6;i++) {sim.step(1/60,{targetX:0},pilotTuning);restored.step(1/60,{targetX:0},pilotTuning);}
  const after=sim.getState();expect(after).toEqual(restored.getState());
  expect(after.enemies[0]).toMatchObject({id:1,hp:7,lane:2,x:0});
  const admitted=after.enemies.filter(e=>e.id>=3);
  expect(admitted).toHaveLength(levelNumber===4?24:30);
  expect(admitted.filter(e=>e.archetype==='heavy')).toHaveLength(levelNumber===4?2:3);
  expect(new Set(admitted.map(e=>e.lane)).size).toBe(levelNumber===4?4:3);
  expect(after.catharsis!.balance).toEqual(balance);
});

it('rejects invalid thresholds, chances and out-of-bounds ramp fronts', () => {
  for(const patch of [{xpFraction:0},{xpFraction:1},{xpFraction:NaN},{heavyChance:1.01},{pressureLaneCount:6}]) {
    const bad=structuredClone(data);Object.assign(bad.catharsis.pressureRamp.lv4,patch);
    expect(()=>GameConfigSchema.parse(bad)).toThrow();
  }
});

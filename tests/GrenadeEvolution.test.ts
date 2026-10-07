import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { emptyGrenade, grenadeTarget } from '../src/simulation/grenade';

const config=GameConfigSchema.parse(data),balance=config.catharsis!;
const make=()=>new Simulation({seed:17,level:LevelDefinitionSchema.parse(levelData),
  startSquad:1,startRocketCount:0,tiers:config.tiers,catharsis:{balance,trackHalfWidth:3.2}});
const tuning={...config.player,trackHalfWidth:3.2,defenseLineOffset:1.5,normalEnemyRadius:.3,
  bossRadius:2,rifle:config.weapon.rifle,rocket:config.weapon.rocket};

it('keeps the last Grenade usable after an ordinary Giant kill evolves Lv5 into a distant Lv6 release crowd', () => {
  const sim=make(),state=sim.getState();
  state.progression={level:5,xp:100};
  state.squad={count:3,rocketCount:0,rifleCounts:[3],rifleRemainder:0};
  state.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,inventory:1};
  state.giantEncounter={scheduledAtSeconds:0,spawned:true};
  state.enemies=[{id:1,tier:1,archetype:'giant',lane:2,x:0,z:3,hp:1}];
  state.enemyStream!.nextRowIndex=10000;state.enemyStream!.nextEnemyId=2;
  state.weapons.rifleCooldownRemainingSeconds=100;state.weapons.rifleMemberCooldowns=[100,100,100];
  state.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,slopeX:0,x:0,z:2.5,speed:60,
    damage:config.tiers.tier1Power,remainingRange:20,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  state.weapons.nextProjectileId=2;
  sim.restoreState(state);sim.step(1/60,{targetX:0},tuning);
  const evolved=sim.getState();
  expect(evolved.progression).toEqual({level:6,xp:0});expect(evolved.squad.count).toBe(1);
  expect(evolved.giantEncounter!.spawned).toBe(true);
  expect(evolved.enemies.filter(e=>e.archetype==='grunt')).toHaveLength(59);
  expect(evolved.enemies.filter(e=>e.archetype==='heavy')).toHaveLength(1);
  expect(evolved.enemies.every(e=>e.z-evolved.player.z>24)).toBe(true);
  expect(evolved.grenade!.inventory).toBe(1);
  const target=grenadeTarget(evolved,balance.grenade)!;expect(target).toBeDefined();
  const clone=make();clone.restoreState(JSON.parse(JSON.stringify(evolved)));
  for(const run of [sim,clone]) {
    run.step(1/60,{targetX:0,throwGrenade:true},tuning);
    expect(run.getState().grenade!.inventory).toBe(0);
    expect(run.getState().grenade!.flight).toMatchObject({targetX:target.x,targetZ:target.z,
      flightSeconds:.65,damageEnemyHp:9,blastRadius:4});
    for(let tick=0;tick<38;tick++)run.step(1/60,{targetX:0,throwGrenade:true},tuning);
    expect(run.getState().grenade!.flight).toBeNull();
    const blasts=run.consumeGrenadeEvents().filter(e=>e.kind==='grenadeDetonated');
    expect(blasts).toHaveLength(1);
    expect(blasts[0].kind==='grenadeDetonated'&&blasts[0].victims.some(v=>v.killed)).toBe(true);
  }
  expect(clone.getState()).toEqual(sim.getState());
  expect(sim.getState().machineGunReleaseAtSeconds).toBe(evolved.machineGunReleaseAtSeconds);
});

import { teachingGrenadeGrant } from '../config/grenadeConfig';
import { Simulation, type SimulationOptions, type SimulationTuning } from '../simulation/Simulation';
import { progressionStage, effectivePrimaryFireRate } from '../simulation/progression';
import { emptyCarnival } from '../simulation/carnival';
import { emptyDestroyer } from '../simulation/destroyer';
import { emptyLevelEncounters } from '../simulation/levelEncounters';
import { advancePostCapSurvival } from '../simulation/postCapSurvival';
import type { GameConfig } from '../config/configSchema';
export function qaSimulationTuning(c:Readonly<GameConfig>):SimulationTuning {
  return {moveSpeed:c.player.moveSpeed,forwardSpeed:0,trackHalfWidth:c.track.halfWidth,
    defenseLineOffset:c.track.defenseLineOffset,formationSpacing:c.player.formationSpacing,memberRadius:c.player.memberRadius,
    normalEnemyRadius:c.tiers.normalEnemyRadius,bossRadius:c.bosses.basic.radius,
    rifle:{fireRate:c.weapon.rifle.fireRate,projectileSpeed:c.weapon.rifle.projectileSpeed,range:c.weapon.rifle.range,
      tierHitRadiusStep:c.weapon.rifle.tierHitRadiusStep,maxHitRadiusBonus:c.weapon.rifle.maxHitRadiusBonus},rocket:{...c.weapon.rocket}};
}

// DEV-only sleep/recovery QA, never bundled in the public game. Preparation runs
// ordinary fixed-tick combat with the shipping config, then freezes a real frame.
export function createQaStressFixture(options:SimulationOptions,tuning:SimulationTuning):Simulation {
  const sim=new Simulation({...options,seed:42,startSquad:1,startRocketCount:0});
  const s=sim.getState(),balance=s.catharsis?.balance;
  if(!balance?.defenseMode||!s.enemyStream||!balance.navalBarrage)throw Error('QA requires authored Defense naval Survival');
  delete balance.defenseTank; // Existing sleep/recovery fixture remains an isolated naval stress scene.
  const stage=progressionStage(10,balance.progression);
  if(stage.weaponFamily!=='machineGun'||stage.squadStage!==3)throw Error('QA requires authored Lv10 three MGs');
  balance.levelEncounters={version:1,initialOrdinaryEnabled:true,triggers:[]};
  s.levelEncounters=emptyLevelEncounters(balance.levelEncounters);s.levelEncounters.survivalEnabled=true;
  s.progression={level:10,xp:0};s.machineGunReleaseAtSeconds=0;
  s.squad={count:3,rifleCounts:[3],rifleRemainder:0,rocketCount:0};
  s.carnival=emptyCarnival(true);s.destroyer=emptyDestroyer(true);
  s.giantEncounter={scheduledAtSeconds:0,spawned:true};
  s.grenade={lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:0,
    inventory:teachingGrenadeGrant(balance.grenade),supply:null,flight:null};
  s.postCapSurvival=advancePostCapSurvival(s.postCapSurvival,s);
  s.enemies=[];s.projectiles=[];s.streamRewards=[];s.pickups=[];s.gates=[];
  const interval=1/effectivePrimaryFireRate(tuning.rifle.fireRate,10,balance);
  s.weapons.rifleMemberCooldowns=[0,interval/3,interval*2/3];s.defenseWaves!.nextAtSeconds=1;
  sim.restoreState(s);sim.commandEncounter('destroyerEnter');sim.commandEncounter('barrageOn');
  return sim;
}
export function advanceQaPreparation(sim:Simulation,tuning:SimulationTuning,tick:number):boolean {
  const s=sim.getFrameState();
  if(tick%12===0){
    const current=s.player.selectedLane!,danger=new Set(s.artillery?.shells.map(shell=>shell.targetLane));
    const nearest=s.enemies.reduce<typeof s.enemies[number]|undefined>((a,e)=>!a||e.z<a.z?e:a,undefined);
    const preferred=nearest?.lane??current;
    const lane=[current-1,current,current+1].filter(l=>l>=0&&l<5&&!danger.has(l))
      .sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b)[0]??current;
    if(lane!==current)sim.stepLane(lane<current?-1:1);
  }
  sim.step(1/60,{targetX:0},tuning);
  sim.consumeArtilleryEvents();sim.consumeGrenadeEvents();sim.consumePresentationEvents();
  const after=sim.getFrameState();
  return after.squad.count>0 && after.enemies.length>=100 && after.projectiles.length>=20
    && (after.artillery?.shells.length??0)>0;
}

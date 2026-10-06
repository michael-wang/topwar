import * as THREE from 'three';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { createDefenseSquadFormation } from '../src/simulation/squad/formation';
import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { Simulation } from '../src/simulation/Simulation';
import { requiredXp, grantXp, effectiveRifleFireRate, progressionStage, maxProgressionLevel } from '../src/simulation/progression';
import { laneCompositionForRow, attackLanePositions } from '../src/simulation/enemies/laneComposition';
import { projectRenderState } from '../src/app/projectRenderState';
import { enemyRunFrame, enemyWalkPose } from '../src/rendering/enemies/EnemyRenderer';
const config = GameConfigSchema.parse(data);
const balance = config.catharsis!;
const curve = balance.progression;
const make = () => new Simulation({ seed: 17, level: { id: 'xp-test', length: 1000, enemyGroups: [], upgradeGates: [] },
  startSquad: 1, startRocketCount: 0, tiers: config.tiers, catharsis: { balance, trackHalfWidth: 3.2 } });
const tuning = { moveSpeed: 5, forwardSpeed: 0, trackHalfWidth: 3.2, defenseLineOffset: 1.5,
  formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
  rifle: config.weapon.rifle, rocket: config.weapon.rocket };
it('starts at level one and uses the authored increasing XP curve with repeated overflow', () => {
  expect(make().getState().progression).toEqual({ level: 1, xp: 0 });
  expect([1, 2, 3, 4].map(level => requiredXp(level, curve))).toEqual([28, 60, 110, 180]);
  expect(grantXp({ level: 1, xp: 27 }, 10, curve)).toEqual({ level: 2, xp: 9 });
  expect(grantXp({ level: 1, xp: 0 }, 205, curve)).toEqual({ level: 4, xp: 7 });
});
it.each([['grunt', 1, 1], ['heavy', 15, 10]] as const)('awards %s XP only on its lethal hit, once', (archetype, hp, xp) => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype, lane: 2, x: .4, z: 3, hp }]; sim.restoreState(state);
  for (let hit = 1; hit <= hp; hit++) {
    const current = sim.getState(); current.weapons.rifleCooldownRemainingSeconds = 0; sim.restoreState(current);
    sim.step(.06, { targetX: 0 }, tuning);
    expect(sim.getState().progression!.xp).toBe(hit === hp ? xp : 0);
  }
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().progression).toEqual({ level: 1, xp });
});
it('does not award XP for an enemy leaking through the defense line', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 0, x: -2.8, z: -2, hp: 1 }];
  sim.restoreState(state); sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().progression).toEqual({ level: 1, xp: 0 });
});
it('does not award XP for direct contact casualties', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: .1, hp: 1 }];
  state.weapons.rifleCooldownRemainingSeconds = 10;
  sim.restoreState(state); sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().enemies).toHaveLength(0);
  expect(sim.getState().progression).toEqual({ level: 1, xp: 0 });
});
it.each([1, 2, 3])('schedules effective Rifle fire at level %i without mutating base tuning', level => {
  expect(effectiveRifleFireRate(3, level, curve)).toBe([3, 3.75, 4.5][level - 1]);
  expect(effectiveRifleFireRate(2.5, level, curve)).toBe(2.5 * [1, 1.25, 1.5][level - 1]);
  const sim = make(); const state = sim.getState(); state.progression = { level, xp: 0 }; sim.restoreState(state);
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, tuning);
  expect(sim.getState().weapons.nextProjectileId - 1).toBeGreaterThanOrEqual(2 * [3, 3.75, 4.5][level - 1]);
  expect(sim.getState().weapons.nextProjectileId - 1).toBeLessThanOrEqual(2 * [3, 3.75, 4.5][level - 1] + 1);
  expect(tuning.rifle.fireRate).toBe(3);
  expect(sim.getState().catharsis!.balance.heavyHp).toBe(15);
});
it('shortens the pending shot promptly when a kill levels up', () => {
  const sim = make(); const state = sim.getState(); state.progression!.xp = 27;
  state.enemies = [{ id: 1, tier: 1, archetype: 'grunt', lane: 2, x: 0, z: 3, hp: 1 }];
  sim.restoreState(state); sim.step(.06, { targetX: 0 }, tuning);
  expect(sim.getState().progression).toEqual({ level: 2, xp: 0 });
  expect(sim.getState().weapons.rifleCooldownRemainingSeconds).toBeLessThanOrEqual(1 / 3.75);
});
it('restores progression deterministically, validates it, and new runs reset it', () => {
  const sim = make(); const state = sim.getState(); state.progression = { level: 3, xp: 11 }; sim.restoreState(state);
  const clone = make(); clone.restoreState(JSON.parse(JSON.stringify(sim.getState())));
  state.progression.xp = 0;
  for (let tick = 0; tick < 90; tick++) { sim.step(1 / 60, { targetX: 0 }, tuning); clone.step(1 / 60, { targetX: 0 }, tuning); }
  expect(clone.getState()).toEqual(sim.getState());
  const bad = sim.getState(); bad.progression!.xp = 110; expect(() => clone.restoreState(bad)).toThrow(/progression/);
  expect(make().getState().progression).toEqual({ level: 1, xp: 0 });
});
it('stages a Heavy deterministically in front of its own lane without changing population or bounds', () => {
  const lanes = attackLanePositions(5, 3.2, balance.edgeInset);
  for (let row = 0; row < 180; row += 6) {
    const group = laneCompositionForRow(row, 17, { ...balance, heavyChance: 1 }, 3.2);
    expect(group).toEqual(laneCompositionForRow(row, 17, { ...balance, heavyChance: 1 }, 3.2));
    expect(group).toHaveLength(24);
    const heavy = group.find(enemy => enemy.archetype === 'heavy')!;
    expect(heavy.x).toBe(lanes[heavy.lane!]); expect(heavy.z).toBe(-9);
    for (const enemy of group) {
      expect(enemy.z).toBeGreaterThanOrEqual(-9); expect(enemy.z).toBeLessThanOrEqual(0);
      if (enemy !== heavy && enemy.lane === heavy.lane) expect(enemy.z - heavy.z).toBeGreaterThanOrEqual(2.5);
    }
  }
});
it('projects current Heavy max HP and keeps slower gait entirely outside gameplay', () => {
  const sim = make(); const state = sim.getState();
  state.enemies = [{ id: 1, tier: 1, archetype: 'heavy', lane: 2, x: 0, z: 20, hp: 15 }]; sim.restoreState(state);
  sim.setCatharsisBalance({ ...balance, heavyHp: 30 });
  const view = projectRenderState(sim.getFrameState(), { catharsis: sim.getFrameState().catharsis,
    trackHalfWidth: 3.2, defenseLineOffset: 1.5, formationSpacing: .45, bossVisualScale: 7 });
  expect(view.enemies[0].maxHp).toBe(30);
  expect(enemyRunFrame(1, 0, 650)).toBe(enemyRunFrame(1, 650, 650));
  expect(enemyWalkPose(1, 0, 650).leftArm).toBeCloseTo(enemyWalkPose(1, 650, 650).leftArm);
  for (let tick = 0; tick < 60; tick++) { enemyRunFrame(1, tick * 16, 650); sim.step(1 / 60, { targetX: 0 }, tuning); }
  expect(sim.getState().enemies[0].z).toBeCloseTo(19.88);
});

it('awards each penetrating kill and retained rocket kill through the same kill boundary', () => {
  for (const kind of ['rifle', 'rocket'] as const) {
    const sim = make(); const state = sim.getState();
    state.enemies = [1, 2].map(id => ({ id, tier: 1, archetype: 'grunt' as const, lane: 2, x: 0, z: 3 + id * .2, hp: 1 }));
    state.weapons.rifleCooldownRemainingSeconds = 10;
    state.projectiles = [{ id: 1, tier: kind === 'rifle' ? 2 : 0, kind, ...(kind === 'rifle' ? { lane: 2, slopeX: 0 } : {}), x: 0, z: 2, speed: 60,
      damage: 100, remainingRange: 30, blastRadius: kind === 'rocket' ? 2 : 0,
      hitRadiusBonus: 0, penetrationRemaining: kind === 'rifle' ? config.tiers.mergeCount : 0 }];
    state.weapons.nextProjectileId = 2;
    sim.restoreState(state); sim.step(.06, { targetX: 0 }, tuning);
    expect(sim.getState().enemies).toHaveLength(0);
    expect(sim.getState().progression!.xp).toBe(2);
  }
});
it('uses the tuned base rate in actual level-three scheduling', () => {
  const sim = make(); const state = sim.getState(); state.progression = { level: 3, xp: 0 }; sim.restoreState(state);
  const live = { ...tuning, rifle: { ...tuning.rifle, fireRate: 2.5 } };
  for (let tick = 0; tick < 120; tick++) sim.step(1 / 60, { targetX: 0 }, live);
  expect(sim.getState().weapons.nextProjectileId - 1).toBe(8);
  expect(live.rifle.fireRate).toBe(2.5);
});

it('caps natural XP at six, including large grants, while debug levels clamp to Stage III', () => {
  expect(maxProgressionLevel(curve)).toBe(6);
  expect(curve.levelPlan).toEqual([
    {weaponFamily:'rifle',fireRateStage:1,squadStage:1}, {weaponFamily:'rifle',fireRateStage:2,squadStage:1},
    {weaponFamily:'rifle',fireRateStage:3,squadStage:1}, {weaponFamily:'rifle',fireRateStage:3,squadStage:2}, {weaponFamily:'rifle',fireRateStage:3,squadStage:3},
    {weaponFamily:'machineGun',fireRateStage:1,squadStage:1},
  ]);
  expect(grantXp({level:1,xp:0},100000,curve)).toEqual({level:6,xp:0});
  expect(grantXp({level:5,xp:0},100000,curve)).toEqual({level:6,xp:0});
  expect([1,2,3,4,5,7,100].map(level=>effectiveRifleFireRate(3,level,curve)))
    .toEqual([3,3.75,4.5,4.5,4.5,4.5,4.5]);
});
it('restores explicit stages and rejects obsolete formula snapshots or invalid stages', () => {
  const sim=make(), state=sim.getState();
  state.catharsis!.balance.progression.fireRateMultipliers=[1,1.2,1.4];
  state.progression={level:4,xp:100}; sim.restoreState(JSON.parse(JSON.stringify(state)));
  expect(effectiveRifleFireRate(3,4,sim.getState().catharsis!.balance.progression)).toBeCloseTo(4.2);
  const bad=sim.getState(); bad.catharsis!.balance.progression.levelPlan[2].fireRateStage=1;
  expect(()=>sim.restoreState(bad)).toThrow();
  const old=sim.getState() as any; old.catharsis.balance.progression.fireRatePerLevel=1;
  expect(()=>sim.restoreState(old)).toThrow();
  const max=sim.getState();max.progression={level:6,xp:1};expect(()=>sim.restoreState(max)).toThrow(/progression/);
});
function killForXp(level:number,xp:number,count:number, reward:number) {
  const sim=make(), state=sim.getState(); state.progression={level,xp};
  state.squad={count,rocketCount:0,rifleCounts:[count],rifleRemainder:0};
  state.weapons.rifleCooldownRemainingSeconds=.12;
  state.weapons.rifleMemberCooldowns=Array.from({length:count},(_,i)=>.12+i*.07);
  state.enemies=[{id:1,tier:1,archetype:'heavy',lane:2,x:0,z:3,hp:1}];
  state.catharsis!.balance.progression.heavyKillXp=reward;
  state.projectiles=[{id:1,kind:'rifle',tier:1,lane:2,slopeX:0,x:0,z:2,speed:60,damage:config.tiers.tier1Power,
    remainingRange:30,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}];
  state.weapons.nextProjectileId=2;sim.restoreState(state);sim.step(.02,{targetX:0},tuning);return sim;
}
it.each([[3,109,1,4,2],[4,179,2,5,3],[4,179,1,5,2]])(
  'rewards one new Rifle for %i (XP %i, living %i), without healing to stage target', (level,xp,count,nextLevel,nextCount)=>{
    const sim=killForXp(level,xp,count,1),s=sim.getState();
    expect(s.progression).toEqual({level:nextLevel,xp:0});expect(s.squad.rifleCounts).toEqual([nextCount]);
    expect(progressionStage(s.progression!.level,curve).squadStage).toBe(nextLevel-2);
    expect(s.weapons.rifleMemberCooldowns![0]).toBeCloseTo(.10);
    expect(new Set(s.weapons.rifleMemberCooldowns).size).toBe(nextCount);
    expect(s.reinforcement).toEqual({startedAtSeconds:null,arrived:false});
    expect(s.landingAssault!.reinforcementActiveAtSeconds).toBeNull();
  });
it('applies both crossed squad rewards in one XP event and gives independent clocks',()=>{
  const sim=killForXp(3,0,1,290),s=sim.getState();
  expect(s.progression).toEqual({level:5,xp:0});expect(s.squad.rifleCounts).toEqual([3]);
  expect(s.weapons.rifleMemberCooldowns).toHaveLength(3);
  expect(new Set(s.weapons.rifleMemberCooldowns).size).toBe(3);
  const fired:number[][]=[[],[],[]];let id=s.weapons.nextProjectileId;
  for(let tick=0;tick<60;tick++) {
    sim.step(1/60,{targetX:0},tuning);
    const frame=sim.getState();for(const shot of frame.projectiles.filter(p=>p.id>=id)) fired[shot.memberIndex!].push(frame.tick);
    id=frame.weapons.nextProjectileId;
  }
  expect(fired.every(shots=>shots.length>=4)).toBe(true);expect(fired[0]).not.toEqual(fired[1]);expect(fired[1]).not.toEqual(fired[2]);
});

it('validates plan shape, monotonic stages and snapshot defaults without serialized derived stages',()=>{
  for(const patch of [
    {levelPlan:curve.levelPlan.slice(0,4)}, {xpRequirements:[28,60,110]},
    {fireRateMultipliers:[1,.9,1.5]}, {levelPlan:curve.levelPlan.map((p,i)=>({...p,squadStage:i===2?0:p.squadStage}))},
  ]) expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,progression:{...data.catharsis.progression,...patch}}})).toThrow();
  const source=structuredClone(data) as any;delete source.catharsis.progression.levelPlan;delete source.catharsis.progression.fireRateMultipliers;
  expect(GameConfigSchema.parse(source).catharsis!.progression.levelPlan).toEqual(curve.levelPlan);
  expect(Object.keys(make().getState().progression!)).toEqual(['level','xp']);
});

it.each([1,2,3])('keeps %i rendered defense anchors consistent with authoritative Rifle origins',count=>{
  const sim=make(),s=sim.getState();s.squad={count,rocketCount:0,rifleCounts:[count],rifleRemainder:0};
  sim.restoreState(s);sim.step(1/60,{targetX:0},tuning);
  const state=sim.getFrameState(),frame=projectRenderState(state,{catharsis:state.catharsis,formationSpacing:.45,trackHalfWidth:3.2,defenseLineOffset:1.5,bossVisualScale:7});
  const family=createChibiPlayerFamily(),scene=new THREE.Scene(),renderer=new SquadRenderer(scene,family),positions:THREE.Vector3[]=[];
  renderer.update(frame,0);renderer.update(frame,3000);renderer.forEachVisibleMemberPosition(p=>positions.push(p.clone()));
  const offsets=createDefenseSquadFormation(count,.45,curve);
  expect(positions).toHaveLength(count);
  positions.forEach((p,i)=>{expect(p.x).toBeCloseTo(-(state.player.x+offsets[i].x));expect(p.z).toBeCloseTo(offsets[i].z);});
  state.projectiles.forEach(shot=>{expect(shot.x).toBeCloseTo(state.player.x+offsets[shot.memberIndex!].x);});
  renderer.dispose();family.dispose();
});

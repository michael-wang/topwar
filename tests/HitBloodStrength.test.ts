import * as THREE from 'three';
import { expect,it,vi } from 'vitest';
import { hitBloodRelativeScale,hitBloodScale,HIT_BLOOD_TIMING } from '../src/rendering/enemies/HitBloodStrength';
import { ENEMY_HIT_STYLE,ENEMY_HIT_IMPULSE_MS } from '../src/rendering/enemies/EnemyHitImpulse';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { BloodSplat } from '../src/rendering/enemies/BloodSplat';
import { hitBloodVariation } from '../src/rendering/enemies/HitBloodVariation';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily,createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import bloodSource from '../src/rendering/enemies/IntegratedDeathBlood.ts?raw';
import { riflePowerForTier } from '../src/simulation/tiers/tierRules';
import gameData from '../public/game-data/game.json';

it('maps actual damage fraction perceptually, with bounded chip and major-hit sizes',()=>{
 const heavy=gameData.catharsis.heavyHp,giant=gameData.catharsis.giant.hp,damage=riflePowerForTier(1,gameData.tiers)/gameData.tiers.tier1Power;
 expect(hitBloodScale('giant',damage,giant)).toBeLessThan(hitBloodScale('heavy',damage,heavy));
 expect(hitBloodRelativeScale(damage,heavy)).toBeGreaterThan(.16);expect(hitBloodRelativeScale(damage,heavy)).toBeLessThan(.26);
 expect(hitBloodRelativeScale(damage,giant)).toBeGreaterThan(.07);expect(hitBloodRelativeScale(damage,giant)).toBeLessThan(.13);
 expect(hitBloodScale('giant',20,giant)).toBeGreaterThan(hitBloodScale('giant',1,giant));
 expect(hitBloodRelativeScale(100,10)).toBe(.4);expect(hitBloodRelativeScale(0,10)).toBe(0);
 expect(HIT_BLOOD_TIMING.giant.bloodEndMs).toBe(135);expect(bloodSource).not.toContain('hitBloodRelativeScale');
});
it('feeds the real observed HP delta into the varied attached hit card, never on lethal removal',()=>{
 const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()},scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
 const spawn=vi.spyOn(BloodSplat.prototype,'spawnStyled');
 const e={id:8,tier:1,archetype:'giant' as const,x:0,z:14,hp:172,maxHp:172};
 r.update([e],0);r.update([e],2000);r.update([{...e,hp:169}],2010);
 expect(spawn).toHaveBeenCalledOnce();
 const variation=spawn.mock.lastCall![6]!;
 expect(variation.size).toBeCloseTo(hitBloodVariation(e.id,1,'giant').size*hitBloodRelativeScale(3,172));
 expect((scene.getObjectByName('enemy-ground-blood-stains') as THREE.InstancedMesh).count).toBe(0);
 r.update([],2030);expect(spawn).toHaveBeenCalledOnce();expect(e.hp).toBe(172);expect(e.z).toBe(14);
 spawn.mockRestore();r.dispose();Object.values(families).forEach(f=>f.dispose());
});
it('preserves every accepted knockback number independently of hit blood strength',()=>{
 expect(ENEMY_HIT_IMPULSE_MS).toBe(250);
 expect(ENEMY_HIT_STYLE).toEqual({grunt:{distance:.27,cap:.36,lean:.09,compression:.02},heavy:{distance:.25,cap:.33,lean:.075,compression:.024},giant:{distance:.17,cap:.20,lean:.045,compression:.012}});
});

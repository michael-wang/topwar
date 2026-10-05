import * as THREE from 'three';
import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createEnemyVfxLab } from '../src/app/EnemyVfxLab';
import { projectRenderState } from '../src/app/projectRenderState';
import { coastalCameraFov } from '../src/rendering/renderSize';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { THREAT_DEATH_COLLAPSE } from '../src/presentation/ThreatDeathCollapse';
import { ENEMY_DEATH_TIMING, enemyBodyOpening, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
import { GiantImpactDust, GIANT_IMPACT_DUST } from '../src/rendering/enemies/GiantImpactDust';

const c=GameConfigSchema.parse(gameData);
const options={seed:19,level:LevelDefinitionSchema.parse(levelData),startSquad:c.player.startSquad,
  startRocketCount:c.player.startRocketCount,tiers:c.tiers,catharsis:{trackHalfWidth:c.track.halfWidth,balance:c.catharsis!}};
function crown(mesh:THREE.Mesh,camera:THREE.Camera):number {
  const p=mesh.geometry.getAttribute('position'),v=new THREE.Vector3(); let y=Infinity;
  for(let i=0;i<p.count;i++)y=Math.min(y,(1-v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(camera).y)*422);
  return y;
}
it.each(['heavy','giant'] as const)('makes %s collapse clear in the real 390×844 Lab camera/loadout fixture',role=>{
  const state=createEnemyVfxLab(options,c.weapon.rifle.fireRate,role).getState();
  const f=projectRenderState(state,{catharsis:state.catharsis,trackHalfWidth:c.track.halfWidth,
    defenseLineOffset:c.track.defenseLineOffset,formationSpacing:c.player.formationSpacing,bossVisualScale:c.bosses.basic.visualScale});
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()},scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
  const camera=new THREE.PerspectiveCamera(coastalCameraFov(390/844),390/844,.1,180);
  camera.position.set(0,6.5,-10);camera.lookAt(0,0,12.5);camera.updateMatrixWorld(true);
  const enemy=f.enemies[0],unchanged=JSON.stringify(enemy),t=THREAT_DEATH_COLLAPSE[role];
  r.update([enemy],0,true);r.update([enemy],2000,true);r.update([],2010,true);
  const holder=scene.children.find(o=>o.visible&&o.name===(role==='heavy'?'enemy-pale-death-body':'giant-assault-soldier'))as THREE.Group;
  holder.updateMatrixWorld(true); const aliveCrown=crown(holder.children[1]as THREE.Mesh,camera);
  let aliveHeadY=0;
  const weapon=holder.getObjectByName('giant-maul');
  if(weapon)aliveHeadY=new THREE.Vector3(.6,.77,.08).applyMatrix4(weapon.children[0].matrixWorld).y;
  r.update([],2010+t.peakMs,true);holder.updateMatrixWorld(true);
  const drop=crown(holder.children[1]as THREE.Mesh,camera)-aliveCrown;
  expect(drop).toBeGreaterThanOrEqual(role==='heavy'?16:24);
  expect(t.compression).toBeGreaterThanOrEqual(role==='heavy'?.08:.06);expect(t.compression).toBeLessThanOrEqual(role==='heavy'?.12:.09);
  expect(families[role].lethalReaction!.compression).toBe(t.compression);
  expect(t.holdEndMs-t.peakMs).toBe(role==='heavy'?165:300);
  const peakRoot=holder.matrix.clone(),peakWeapon=weapon?.matrix.clone();
  for(let age=t.peakMs;age<=t.holdEndMs;age+=25){
    r.update([],2010+age,true);expect(holder.matrix.elements).toEqual(peakRoot.elements);
    if(weapon)expect(weapon.matrix.elements).toEqual(peakWeapon!.elements);
    const clock=ENEMY_DEATH_TIMING[role];expect(enemyBodyOpening(age,role,enemyDeathPose(age,clock).breakup)).toBe(0);
  }
  if(weapon){
    const mesh=weapon.children[0]as THREE.Mesh;holder.updateMatrixWorld(true);
    const p=mesh.geometry.getAttribute('position'),v=new THREE.Vector3();let minY=Infinity;
    for(let i=0;i<p.count;i++)if(p.getY(i)>.6)minY=Math.min(minY,v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y);
    expect(minY).toBeGreaterThanOrEqual(0);expect(minY).toBeLessThan(.10);
    expect(aliveHeadY-new THREE.Vector3(.6,.77,.08).applyMatrix4(mesh.matrixWorld).y).toBeGreaterThan(1);
    expect(weapon.children).toHaveLength(1);expect(weapon.parent).toBe(holder);
  }
  expect(JSON.stringify(enemy)).toBe(unchanged);r.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
});
it('bounds, fades, rewinds and disposes a single twelve-point sand-impact pool without textures',()=>{
  const scene=new THREE.Scene(),r=new GiantImpactDust(scene),mesh=scene.children[0]as THREE.Points;
  expect(GIANT_IMPACT_DUST).toMatchObject({slots:3,puffsPerImpact:4,durationMs:400});
  expect(mesh.geometry.getAttribute('position').count).toBe(12);expect((mesh.material as THREE.PointsMaterial).map).toBeNull();
  for(let i=0;i<10;i++)r.spawn(i,8,1000);r.update(1200);
  const alpha=mesh.geometry.getAttribute('puffAlpha'),p=mesh.geometry.getAttribute('position');
  expect(mesh.visible).toBe(true);expect(Array.from(alpha.array).filter(a=>a>0)).toHaveLength(12);
  for(let i=0;i<12;i++){expect(alpha.getX(i)).toBeLessThanOrEqual(.32);expect(p.getY(i)).toBeLessThan(.19);}
  const positions=Array.from(p.array);r.update(1250);r.update(1200);expect(Array.from(p.array)).toEqual(positions);
  r.update(1400);expect(mesh.visible).toBe(false);r.reset();r.update(1200);expect(mesh.visible).toBe(false);
  r.dispose();expect(scene.children).toHaveLength(0);
});

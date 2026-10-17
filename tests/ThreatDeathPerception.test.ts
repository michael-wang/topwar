import * as THREE from 'three';
import { expect, it } from 'vitest';
import gameData from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
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
  const material=mesh.material as THREE.MeshStandardMaterial,shader={uniforms:{},vertexShader:'',fragmentShader:''} as Parameters<typeof material.onBeforeCompile>[0];material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  const matrices=shader.uniforms.giantDebrisMatrices?.value,ids=mesh.geometry.getAttribute('deathPieceId');
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(matrices)v.applyMatrix4(matrices[ids.getX(i)]);y=Math.min(y,(1-v.project(camera).y)*422);}
  return y;
}
it.each(['heavy','giant'] as const)('keeps %s grenade collapse clear in the 390×844 defense camera',role=>{
  const state=new Simulation(options).getState();
  state.enemies=[{id:1,tier:1,archetype:role,lane:2,x:0,z:role==='giant'?14:10,hp:role==='giant'?c.catharsis!.giant.hp:c.catharsis!.heavyHp}];
  const f=projectRenderState(state,{catharsis:state.catharsis,trackHalfWidth:c.track.halfWidth,
    defenseLineOffset:c.track.defenseLineOffset,formationSpacing:c.player.formationSpacing,});
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()},scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
  const camera=new THREE.PerspectiveCamera(coastalCameraFov(390/844),390/844,.1,180);
  camera.position.set(0,6.5,-10);camera.lookAt(0,0,12.5);camera.updateMatrixWorld(true);
  const enemy=f.enemies[0],unchanged=JSON.stringify(enemy),t=THREAT_DEATH_COLLAPSE[role];
  r.update([enemy],0,true);r.update([enemy],2000,true);
  r.presentGrenade([{kind:'grenadeDetonated',x:0,z:enemy.z,radius:4,victims:[{...enemy,archetype:role,damage:enemy.hp,killXp:10,killed:true}]}],2010);
  r.update([],2010,true);
  const holder=scene.children.find(o=>o.visible&&o.name===(role==='heavy'?'enemy-pale-death-body':'giant-assault-soldier'))as THREE.Group;
  holder.updateMatrixWorld(true); const aliveCrown=crown(holder.children[1]as THREE.Mesh,camera);
  if(role==='giant'){
    r.update([],3510,true);holder.updateMatrixWorld(true);
    expect(crown(holder.children[1] as THREE.Mesh,camera)-aliveCrown).toBeGreaterThan(24);
    expect((holder.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.opacity).toBe(1);
    expect(JSON.stringify(enemy)).toBe(unchanged);
    r.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);return;
  }
  r.update([],2010+t.peakMs,true);holder.updateMatrixWorld(true);
  const drop=crown(holder.children[1]as THREE.Mesh,camera)-aliveCrown;
  expect(drop).toBeGreaterThanOrEqual(role==='heavy'?16:24);
  expect(t.compression).toBeGreaterThanOrEqual(role==='heavy'?.08:.06);expect(t.compression).toBeLessThanOrEqual(role==='heavy'?.12:.09);
  expect(families[role].lethalReaction!.compression).toBe(t.compression);
  expect(t.holdEndMs-t.peakMs).toBe(role==='heavy'?165:300);
  const peakRoot=holder.matrix.clone();
  for(let age=t.peakMs;age<=t.holdEndMs;age+=25){
    r.update([],2010+age,true);expect(holder.matrix.elements).toEqual(peakRoot.elements);
    const clock=ENEMY_DEATH_TIMING[role];expect(enemyBodyOpening(age,role,enemyDeathPose(age,clock).breakup)).toBe(0);
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

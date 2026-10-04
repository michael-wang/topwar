import * as THREE from 'three';
import { expect, it } from 'vitest';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { createThreatReview } from '../src/app/ThreatReview';
import { projectRenderState } from '../src/app/projectRenderState';
import { createChibiGiantFamily, createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { characterFamilies } from './characterModel';

const config=GameConfigSchema.parse(data),balance=config.catharsis!;
const options={seed:17,level:LevelDefinitionSchema.parse(levelData),startSquad:config.player.startSquad,
  startRocketCount:config.player.startRocketCount,tiers:config.tiers,catharsis:{balance,trackHalfWidth:config.track.halfWidth}};
const review=()=>createThreatReview(options,config.weapon.rifle.fireRate);

it('uses a visual-only 1.9 scale and broader 0.94 width without weakening combat validation',()=>{
  expect(balance.giant.visualScale).toBe(1.9);expect(balance.giant.widthMultiplier).toBe(.94);
  const withoutScale=structuredClone(data);delete (withoutScale.catharsis.giant as Partial<typeof data.catharsis.giant>).visualScale;
  expect(GameConfigSchema.parse(withoutScale).catharsis!.giant.visualScale).toBe(1.9);
  expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,giant:{...data.catharsis.giant,visualScale:1.7}}})).toThrow();
  expect(()=>GameConfigSchema.parse({...data,catharsis:{...data.catharsis,giant:{...data.catharsis.giant,hp:0}}})).toThrow();
});

it.each(['same-depth','review-depth'])('meets projected Heavy/Giant crown and body width targets in %s',mode=>{
  const sim=review(),state=sim.getFrameState(),frame=projectRenderState(state,{catharsis:state.catharsis,
    formationSpacing:.45,trackHalfWidth:3.2,defenseLineOffset:1.5,bossVisualScale:7});
  const heavy=createChibiHeavyFamily(),giant=createChibiGiantFamily(),scene=new THREE.Scene();
  const renderer=new EnemyRenderer(scene,{...characterFamilies(),heavy,giant});
  const enemies=frame.enemies.filter(e=>e.archetype!=='grunt').map(e=>({...e,...(mode==='same-depth'?{z:16}:{})}));
  renderer.update(enemies,0);renderer.update(enemies,2000);scene.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(48,390/844,.1,180);camera.position.set(0,6.5,-10);camera.lookAt(0,0,12.5);camera.updateMatrixWorld(true);
  const helmet=scene.children.find(m=>m instanceof THREE.InstancedMesh&&m.geometry===heavy.helmet.geometry&&m.count>0) as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4();helmet.getMatrixAt(0,matrix);
  const group=scene.getObjectByName('giant-assault-soldier')!;
  const height=(transform:THREE.Matrix4,crown:number)=>{
    const project=(y:number)=>new THREE.Vector3(0,y,0).applyMatrix4(transform).project(camera).y;
    return project(crown)-project(0);
  };
  const ratio=height(group.matrixWorld,giant.helmet.geometry.boundingBox!.max.y)/height(matrix,heavy.helmet.geometry.boundingBox!.max.y);
  expect(ratio).toBeGreaterThan(mode==='same-depth'?2.0:1.55);expect(ratio).toBeLessThan(mode==='same-depth'?2.2:1.8);
  if(mode==='same-depth'){
    const width=(transform:THREE.Matrix4,w:number)=>Math.abs(new THREE.Vector3(w/2,.4,0).applyMatrix4(transform).project(camera).x
      -new THREE.Vector3(-w/2,.4,0).applyMatrix4(transform).project(camera).x);
    const widthRatio=width(group.matrixWorld,.84)/width(matrix,.68);
    expect(widthRatio).toBeGreaterThan(1.45);expect(widthRatio).toBeLessThan(1.65);
  }
  const bar=scene.getObjectByName('heavy-hp-backing')!; // Separate accepted billboard dimensions survive rescale.
  const bars=scene.children.filter(c=>c.name==='heavy-hp-backing');
  expect(bars[1].scale.x/bars[1].scale.y).toBeCloseTo(6);expect(bars[1].scale.y).toBeGreaterThan(.49);
  expect(bar).toBeDefined();renderer.dispose();heavy.dispose();giant.dispose();
});

it('keeps movement, targeting, damage, HP, XP, RNG and encounter behavior identical when only visual values change',()=>{
  const current=review(),old=createThreatReview({...options,catharsis:{...options.catharsis,
    balance:{...balance,giant:{...balance.giant,visualScale:3.6,widthMultiplier:.68}}}},config.weapon.rifle.fireRate);
  const tuning={moveSpeed:config.player.moveSpeed,forwardSpeed:config.player.forwardSpeed,trackHalfWidth:config.track.halfWidth,
    defenseLineOffset:config.track.defenseLineOffset,formationSpacing:config.player.formationSpacing,memberRadius:config.player.memberRadius,
    normalEnemyRadius:config.tiers.normalEnemyRadius,bossRadius:config.bosses.basic.radius,rifle:config.weapon.rifle,rocket:config.weapon.rocket};
  current.stepLane(-1);old.stepLane(-1);
  for(let i=0;i<600;i++){current.step(1/60,{targetX:0},tuning);old.step(1/60,{targetX:0},tuning);}
  const a=current.getState(),b=old.getState();
  b.catharsis!.balance.giant.visualScale=a.catharsis!.balance.giant.visualScale;
  b.catharsis!.balance.giant.widthMultiplier=a.catharsis!.balance.giant.widthMultiplier;
  expect(a).toEqual(b);expect(a.enemies.find(e=>e.id===3)!.hp).toBeLessThan(balance.giant.hp);
});

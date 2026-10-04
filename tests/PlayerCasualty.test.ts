import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createChibiPlayerFamily } from '../src/rendering/squad/ChibiPlayerFamily';
import { SquadRenderer } from '../src/rendering/squad/SquadRenderer';
import { playerCasualtyPose, PLAYER_CASUALTY_MS, PLAYER_STAIN_DIAMETER } from '../src/rendering/squad/PlayerCasualty';
import type { GameRenderState } from '../src/rendering/RenderState';
import type { PresentationEvent } from '../src/simulation/PresentationEvent';
const squad={count:2,rocketCount:0,rifleCounts:[2],rifleRemainder:0};
const frame:GameRenderState={defenseMode:true,player:{x:0,z:0},squad:{...squad,formationSpacing:.45},track:{halfWidth:3.2,defenseLineZ:-1.5},enemies:[],projectiles:[],boss:null,streamRewards:[],gates:[],pickups:[]};
const event=(removed:boolean):PresentationEvent=>({kind:'normalEnemyContact',enemyId:1,enemyTier:1,attackerX:0,attackerZ:0,playerX:0,playerZ:0,before:squad,after:removed?{...squad,count:1,rifleCounts:[1]}:{...squad,rifleRemainder:1}});
it('keeps Player deaths grounded, with modest bias, a hold and bounded late fade',()=>{
 const family=createChibiPlayerFamily(),scene=new THREE.Scene(),renderer=new SquadRenderer(scene,family);
 renderer.update(frame,0);renderer.update(frame,500);const before=JSON.stringify(frame);
 renderer.present([event(false)],510,3.2,.45);renderer.update(frame,520);
 const stains=scene.getObjectByName('player-ground-blood-stains') as THREE.InstancedMesh,blood=scene.getObjectByName('player-blood-splats') as THREE.InstancedMesh;
 expect(stains.count).toBe(0);expect(blood.count).toBe(0);
 renderer.present([event(true)],600,3.2,.45);
 const after={...frame,squad:{...frame.squad,count:1,rifleCounts:[1]}},group=scene.getObjectByName('player-casualty')!;
 for(const age of [0,50,150,250,350,450,550,699]){
  renderer.update(after,600+age);group.updateMatrixWorld(true);expect(group.visible).toBe(true);
  // Actual surface vertices, including rifle, touch but do not penetrate the beach.
  let floor=Infinity;const v=new THREE.Vector3();
  for(const part of group.children as THREE.Mesh[]){const p=part.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);floor=Math.min(floor,v.y);}}
  expect(floor).toBeGreaterThan(.015);expect(floor).toBeLessThan(.03);
  expect(group.rotation.x).toBeGreaterThanOrEqual(0);expect(group.rotation.x).toBeLessThanOrEqual(1.35);
  expect((group.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.opacity).toBe(playerCasualtyPose(age,1).opacity);
 }
 expect(stains.count).toBe(1);const m=new THREE.Matrix4();stains.getMatrixAt(0,m);expect(Math.hypot(...m.elements.slice(0,3))).toBeGreaterThan(PLAYER_STAIN_DIAMETER*.89);
 renderer.update(after,600+PLAYER_CASUALTY_MS);expect(group.visible).toBe(false);expect(stains.count).toBe(1);expect(blood.count).toBe(0);
 expect(JSON.stringify(frame)).toBe(before);renderer.reset();expect(stains.count).toBe(0);
 renderer.update(frame,2000);renderer.present([event(true)],2100,3.2,.45);renderer.update(after,2110);expect(stains.count).toBe(1);
 renderer.update({...after,defenseMode:false},2200);expect(stains.count).toBe(0);
 const tex=(blood.material as THREE.MeshBasicMaterial).map!,dispose=vi.spyOn(tex,'dispose');renderer.dispose();expect(dispose).toHaveBeenCalledOnce();family.dispose();expect(scene.children).toHaveLength(0);
});
it('uses a backward 77-degree fall instead of an upward/backward arc and never throws the soldier across a lane',()=>{
 expect(PLAYER_CASUALTY_MS).toBe(700);
 for(const side of [-1,1]){const final=playerCasualtyPose(350,side);expect(final.pitch).toBe(1.35);expect(final.z).toBe(-.18);expect(Math.abs(final.x)).toBe(.10);expect(final.opacity).toBe(1);expect(playerCasualtyPose(700,side)).toMatchObject({opacity:0,visible:false});}
});

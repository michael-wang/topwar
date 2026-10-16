import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SupportAirstrikeRenderer } from '../src/rendering/SupportAirstrikeRenderer';
import { HeavyAirstrikeExplosion } from '../src/rendering/HeavyAirstrikeExplosion';
import type { GameRenderState } from '../src/rendering/RenderState';
import { emptyCommanderSupport } from '../src/simulation/commanderSupport';
import config from './helpers/ShippingConfig';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';


it('reconstructs persistent impact scorches once, beneath lane paint, without replaying expired explosions',()=>{
  const scene=new THREE.Scene(),r=new SupportAirstrikeRenderer(scene),support=emptyCommanderSupport(true,true);
  Object.assign(support.airstrike!,{status:'completed',triggeredAtSeconds:60,bombAtSeconds:67.5,strikesCompleted:6,tankZAtWarning:38,
    impacts:Array.from({length:12},(_,i)=>({x:i%3-1,z:7+(i%4)*14,atSeconds:67.5+Math.floor(i/3)*.65}))});
  // Include repeated coordinates: they must not stack a second decal.
  support.airstrike!.impacts![11]={...support.airstrike!.impacts![0],atSeconds:70.75};
  const state:GameRenderState={commanderSupport:{state:support,config:config.catharsis!.commanderSupport!,elapsedSeconds:100},
    player:{x:0,z:0},squad:{count:2,rocketCount:0,rifleCounts:[2],formationSpacing:1},track:{halfWidth:3.2,defenseLineZ:0},enemies:[],projectiles:[]};
  const saved=structuredClone(state);r.update(0,state);
  const marks=scene.getObjectByName('airstrike-ground-scorch') as THREE.InstancedMesh;
  expect(marks.count).toBe(11);expect(marks.instanceMatrix.count).toBe(12);expect(marks.renderOrder).toBeLessThan(0);
  expect(scene.getObjectByName('airstrike-flash')!.visible).toBe(false);
  const pose=Array.from(marks.instanceMatrix.array);r.update(0,state);expect(marks.count).toBe(11);expect(Array.from(marks.instanceMatrix.array)).toEqual(pose);
  r.update(120000,state);expect(marks.count).toBe(11);expect(state).toEqual(saved);
  r.reset();expect(marks.count).toBe(0);r.update(120000,state);expect(marks.count).toBe(11);expect(Array.from(marks.instanceMatrix.array)).toEqual(pose);
  r.dispose();expect(scene.children).toHaveLength(0);
});

it.each([350,390])('hands a strong early blast to layered smoke drifting screen-right at %ipx',width=>{
 const scene=new THREE.Scene(),fx=new HeavyAirstrikeExplosion(scene),camera=new THREE.PerspectiveCamera(48,width/844,.1,180);
 applyCoastalCamera(camera);fx.present(0,0,14,0);fx.update(30,0);
 expect(scene.getObjectByName('airstrike-flash')!.visible).toBe(true);expect(scene.getObjectByName('airstrike-fire')!.visible).toBe(false);fx.update(180,0);expect(scene.getObjectByName('airstrike-fire')!.visible).toBe(true);
 fx.update(700,0);expect(scene.getObjectByName('airstrike-flash')!.visible).toBe(false);expect(scene.getObjectByName('airstrike-fire')!.visible).toBe(false);
 const smoke=scene.getObjectByName('airstrike-smoke') as THREE.InstancedMesh,matrix=new THREE.Matrix4(),objects=scene.children.slice();
 const xs=()=>Array.from({length:smoke.count},(_,i)=>{smoke.getMatrixAt(i,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix).project(camera).x;});
 const before=xs();expect(smoke.visible).toBe(true);fx.update(1700,0);xs().forEach((x,i)=>expect(x).toBeGreaterThan(before[i]));
 const frozen=Array.from(smoke.instanceMatrix.array);fx.update(1700,0);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);expect(scene.children).toEqual(objects);
 // Reconstruct the same age on a different presentation clock, as Continue does.
 fx.reset();fx.present(0,0,14,5000);fx.update(6700,0);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);
 fx.dispose();expect(scene.children).toHaveLength(0);
});

it('rebuilds three heavy bombers and remaining smoke from saved clocks, freezes, resets and disposes its fixed resources once', () => {
  const scene = new THREE.Scene(), r = new SupportAirstrikeRenderer(scene), support = emptyCommanderSupport(true, true);
  Object.assign(support.airstrike!, { status: 'waiting', triggeredAtSeconds: 60, bombAtSeconds: 67.5, strikesCompleted: 1,
    tankZAtWarning: 38, impacts: [-4, 0, 4].map(x => ({ x, z: 7, atSeconds: 67.5 })) });
  const state: GameRenderState = { commanderSupport: { state: support, config: config.catharsis!.commanderSupport!, elapsedSeconds: 67.8 },
    player: { x: 0, z: 0 }, squad: { count: 2, rocketCount: 0, rifleCounts: [2], formationSpacing: 1 },
    track: { halfWidth: 5, defenseLineZ: 0, lanePositions: [-4, -2, 0, 2, 4] }, enemies: [], projectiles: [] };
  const objects = [...scene.children]; r.update(1000, state);
  expect(r.planes.map(p => p.visible)).toEqual([true, true, true]);
  expect(r.planes[0].position.x).toBeCloseTo(3.45*1.1);expect(r.planes[1].position.x).toBe(0);expect(r.planes[2].position.x).toBeCloseTo(-3.45*1.1);
  expect(r.planes[0].children[0]).toBeInstanceOf(THREE.Mesh);
  expect((r.planes[0].children[0] as THREE.Mesh).geometry).toBe((r.planes[2].children[0] as THREE.Mesh).geometry);
  expect(scene.getObjectByName('airstrike-smoke')!.visible).toBe(true);
  let previous = [-Infinity, -Infinity, -Infinity];
  for (const age of [1, 3.4, 6.5, 7.5, 8.15, 8.8, 9.45, 10.75, 16, 20]) {
    r.update(age * 1000, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 60 + age } });
    r.planes.forEach((p, i) => { if(p.visible) { expect(p.position.z).toBeGreaterThan(previous[i]); previous[i] = p.position.z; } expect(Math.abs(p.rotation.y - Math.PI)).toBeLessThan(.06); });
  }
  r.reset(); r.update(1000, state);
  const pose = r.planes.map(p => [p.position.toArray(), p.rotation.toArray()]); for (let i = 0; i < 20; i++) r.update(1000, state);
  expect(r.planes.map(p => [p.position.toArray(), p.rotation.toArray()])).toEqual(pose); expect(scene.children).toEqual(objects);
  r.reset(); expect(r.planes.every(p => !p.visible)).toBe(true); r.update(1000, state);
  expect(scene.getObjectByName('airstrike-smoke')!.visible).toBe(true);
  r.update(7200, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 74 } });
  expect(scene.getObjectByName('airstrike-smoke')!.visible).toBe(false);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  const releases = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
  r.dispose(); expect(scene.children).toEqual([]); releases.forEach(release => expect(release).toHaveBeenCalledOnce());
});

it.each([350,390])('keeps a constant-altitude/speed flight, aligned shadows and real release anchors at %ipx',width=>{
  const scene=new THREE.Scene(),r=new SupportAirstrikeRenderer(scene),support=emptyCommanderSupport(true,true);
  Object.assign(support.airstrike!,{status:'waiting',triggeredAtSeconds:60,bombAtSeconds:67.5,tankZAtWarning:38});
  let state:GameRenderState={commanderSupport:{state:support,config:config.catharsis!.commanderSupport!,elapsedSeconds:60},
    player:{x:0,z:0},squad:{count:2,rocketCount:0,rifleCounts:[2],formationSpacing:1},
    track:{halfWidth:3.2,defenseLineZ:0,lanePositions:[-2.8,-1.4,0,1.4,2.8]},enemies:[],projectiles:[]};
  const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
  const shadows=[0,1,2].map(i=>scene.getObjectByName('support-bomber-shadow-'+i) as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>);
  const shadow=shadows[0],uv=shadow.geometry.getAttribute('uv'),position=shadow.geometry.getAttribute('position');
  expect(shadow.material.vertexShader).toContain('vec2(7.,-6.)');
  for(let i=0;i<uv.count;i++)expect((uv.getY(i)-.5)*-6).toBeCloseTo(position.getZ(i));
  // The shader's tail at local +Z shares the real aircraft's aft direction.
  const at=(age:number)=>{state={...state,commanderSupport:{...state.commanderSupport!,elapsedSeconds:60+age}};const saved=structuredClone(state);r.update(age*1000,state);expect(state).toEqual(saved);};
  for(const age of [0,3,5.5,6.5,6.8999,6.9,6.9001,7.5,8.8,9.45,10.75,13.5,16]){
    at(age);
    r.planes.forEach((plane,i)=>{
      expect(plane.position.y).toBe(8.5);expect(plane.position.z).toBeCloseTo(11+(age-7.5)*18);
      expect(plane.scale.toArray()).toEqual([.5,.5,.5]);expect(plane.rotation.toArray()).toEqual([0,Math.PI,0,'XYZ']);
      expect(shadows[i].position.x).toBe(plane.position.x);expect(shadows[i].position.z).toBe(plane.position.z);
      expect(shadows[i].position.y).toBe(.018);expect(shadows[i].rotation.y).toBe(plane.rotation.y);expect(shadows[i].renderOrder).toBeLessThan(0);
      expect(shadows[i].material.uniforms.opacity.value).toBe(.2);
      expect((plane.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.opacity).toBe(1);
      if(age>=6.5){const bounds=new THREE.Box3().setFromObject(plane);
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])
          expect(new THREE.Vector3(x,y,z).project(camera).y).toBeGreaterThan(0);
      }
    });
  }
  for(let index=0;index<12;index++){
    const round=index<9?Math.floor(index/3):index-6,lane=index<9?[0,2,4][index%3]:2;
    const impact=7.5+round*.65;at(impact-.6+1e-10);
    const bomb=scene.getObjectByName('support-falling-bomb-'+index)!,plane=r.planes[lane/2];
    expect(bomb.visible).toBe(true);expect(bomb.position.x).toBeCloseTo(plane.position.x);expect(bomb.position.z).toBeCloseTo(plane.position.z);
    expect(bomb.position.y).toBeCloseTo(plane.position.y-.15);
    at(impact-1e-7);expect(bomb.visible).toBe(true);expect(bomb.position.x).toBeCloseTo(-state.track.lanePositions![lane]);
    const z=round<3?(round+.5)*(lane===2?38/3:14):38+(round-3)*14;
    expect(bomb.position.z).toBeCloseTo(z,4);expect(bomb.position.y).toBeCloseTo(0,4);
  }
  at(8.65);const saved=r.planes.map(p=>p.position.toArray());r.reset();at(8.65);expect(r.planes.map(p=>p.position.toArray())).toEqual(saved);
  at(8.65);expect(r.planes.map(p=>p.position.toArray())).toEqual(saved);
  support.airstrike!.status='cancelled';at(8.65);const prior=r.plane.position.z;
  r.update(9150,state);expect(r.plane.position.z-prior).toBeCloseTo(9); // pause-aware departure continues at 18 units/s
  r.update(9150,state);expect(r.plane.position.z-prior).toBeCloseTo(9);
  state={...state,squad:{...state.squad,count:0}};r.update(9150,state);expect(r.planes.every(p=>!p.visible)).toBe(true);expect(shadows.every(p=>!p.visible)).toBe(true);
  r.reset();r.dispose();expect(scene.children).toHaveLength(0);
});

import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SupportAirstrikeRenderer } from '../src/rendering/SupportAirstrikeRenderer';
import { HeavyAirstrikeExplosion } from '../src/rendering/HeavyAirstrikeExplosion';
import type { GameRenderState } from '../src/rendering/RenderState';
import { emptyCommanderSupport } from '../src/simulation/commanderSupport';
import config from './helpers/ShippingConfig';
import {applyCoastalCamera} from '../src/rendering/CoastalCamera';

it('layers compact dark smoke inside airy gray puffs in the same bounded draw and 5.6-second lifetime', () => {
  const scene = new THREE.Scene(), fx = new HeavyAirstrikeExplosion(scene);
  for (let i = 0; i < 9; i++) fx.present(i, (i % 3 - 1) * 2.8, 7 + Math.floor(i / 3) * 14, 0);
  const meshes = [...scene.children]; fx.update(150, 0);
  for (const name of ['core', 'fire', 'dust', 'shockwave']) expect(scene.getObjectByName(`airstrike-0-${name}`)!.visible).toBe(true);
  fx.update(600, 0);
  const smoke = scene.getObjectByName('airstrike-0-smoke') as THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  expect(smoke.count).toBe(8); expect(smoke.material.depthWrite).toBe(false);
  const weights=smoke.geometry.getAttribute('smokeWeight');
  expect(Array.from(weights.array)).toEqual([1,1,1,...Array(5).fill(Math.fround(.28))]);
  expect(1-(1-smoke.material.opacity*.28)**5).toBeLessThan(.27);
  expect(1-(1-smoke.material.opacity)**3).toBeGreaterThan(.45);
  const inner=new THREE.Color(),outer=new THREE.Color();smoke.getColorAt(0,inner);smoke.getColorAt(3,outer);
  expect(inner.r).toBeLessThan(outer.r*.3);expect(Math.max(outer.r,outer.g,outer.b)-Math.min(outer.r,outer.g,outer.b)).toBeLessThan(.025);
  const innerPose=new THREE.Matrix4(),outerPose=new THREE.Matrix4();smoke.getMatrixAt(0,innerPose);smoke.getMatrixAt(3,outerPose);
  expect(new THREE.Vector3().setFromMatrixScale(innerPose).x).toBeLessThan(new THREE.Vector3().setFromMatrixScale(outerPose).x*.6);
  const pose = Array.from(smoke.instanceMatrix.array); fx.update(600, 0);
  expect(Array.from(smoke.instanceMatrix.array)).toEqual(pose); expect(scene.children).toEqual(meshes);
  fx.update(5599, 0); expect(smoke.visible).toBe(true); fx.update(5600, 0); expect(smoke.visible).toBe(false);
  fx.reset(); expect(scene.children.every(m => !m.visible)).toBe(true); fx.dispose(); expect(scene.children).toHaveLength(0);
});

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
  expect(scene.getObjectByName('airstrike-0-core')!.visible).toBe(false);
  const pose=Array.from(marks.instanceMatrix.array);r.update(0,state);expect(marks.count).toBe(11);expect(Array.from(marks.instanceMatrix.array)).toEqual(pose);
  r.update(120000,state);expect(marks.count).toBe(11);expect(state).toEqual(saved);
  r.reset();expect(marks.count).toBe(0);r.update(120000,state);expect(marks.count).toBe(11);expect(Array.from(marks.instanceMatrix.array)).toEqual(pose);
  r.dispose();expect(scene.children).toHaveLength(0);
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
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(true);
  let previous = [-Infinity, -Infinity, -Infinity];
  for (const age of [1, 3.4, 6.5, 7.5, 8.15, 8.8, 9.45, 10.75, 16, 20]) {
    r.update(age * 1000, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 60 + age } });
    r.planes.forEach((p, i) => { if(p.visible) { expect(p.position.z).toBeGreaterThan(previous[i]); previous[i] = p.position.z; } expect(Math.abs(p.rotation.y - Math.PI)).toBeLessThan(.06); });
  }
  r.reset(); r.update(1000, state);
  const pose = r.planes.map(p => [p.position.toArray(), p.rotation.toArray()]); for (let i = 0; i < 20; i++) r.update(1000, state);
  expect(r.planes.map(p => [p.position.toArray(), p.rotation.toArray()])).toEqual(pose); expect(scene.children).toEqual(objects);
  r.reset(); expect(r.planes.every(p => !p.visible)).toBe(true); r.update(1000, state);
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(true);
  r.update(7200, { ...state, commanderSupport: { ...state.commanderSupport!, elapsedSeconds: 74 } });
  expect(scene.getObjectByName('airstrike-0-smoke')!.visible).toBe(false);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  const releases = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
  r.dispose(); expect(scene.children).toEqual([]); releases.forEach(release => expect(release).toHaveBeenCalledOnce());
});

it.each([350,390])('keeps approach above view, readable shadows beneath danger paint, and first bombing at mid-height at %ipx',width=>{
  const scene=new THREE.Scene(),r=new SupportAirstrikeRenderer(scene),support=emptyCommanderSupport(true,true);
  Object.assign(support.airstrike!,{status:'waiting',triggeredAtSeconds:60,bombAtSeconds:67.5,tankZAtWarning:38});
  let state:GameRenderState={commanderSupport:{state:support,config:config.catharsis!.commanderSupport!,elapsedSeconds:64},
    player:{x:0,z:0},squad:{count:2,rocketCount:0,rifleCounts:[2],formationSpacing:1},
    track:{halfWidth:3.2,defenseLineZ:0,lanePositions:[-2.8,-1.4,0,1.4,2.8]},enemies:[],projectiles:[]};
  const snapshot=structuredClone(state);r.update(1000,state);expect(state).toEqual(snapshot);
  expect(r.planes.every(p=>!p.visible&&p.position.y>=23.9)).toBe(true);
  const shadows=[0,1,2].map(i=>scene.getObjectByName(`support-bomber-shadow-${i}`) as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>);
  expect(shadows.every(s=>s.visible&&s.renderOrder<0&&s.position.y<.03)).toBe(true);
  expect(shadows[0].material.uniforms.opacity.value).toBeCloseTo(.2);expect(shadows[0].material.depthWrite).toBe(false);
  expect(shadows[0].scale.x).toBe(.5);
  const previous=shadows.map(s=>s.position.z);state={...state,commanderSupport:{...state.commanderSupport!,elapsedSeconds:65}};r.update(2000,state);
  expect(shadows.every((s,i)=>s.position.z>previous[i])).toBe(true);
  state={...state,commanderSupport:{...state.commanderSupport!,elapsedSeconds:67.5}};r.update(3000,state);
  const camera=new THREE.PerspectiveCamera(48,width/844,.1,180);applyCoastalCamera(camera);
  for(const p of r.planes){expect(p.visible).toBe(true);const point=p.position.clone().project(camera);
    expect(p.children[0].renderOrder).toBeGreaterThan(3);
    expect((p.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.depthTest).toBe(false);
    expect((1-point.y)/2).toBeGreaterThan(.45);expect((1-point.y)/2).toBeLessThan(.55);expect(Math.abs(point.x)).toBeLessThan(.7);
    // Even the tail/wing envelope stays well above the squad and bottom controls.
    const bounds=new THREE.Box3().setFromObject(p);
    for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]){
      const corner=new THREE.Vector3(x,y,z).project(camera);expect(corner.y).toBeGreaterThan(-.28);
    }}
  state={...state,commanderSupport:{...state.commanderSupport!,elapsedSeconds:66.9}};r.update(3000,state);
  for(const [i,index] of [0,1,2].entries()){
    const bomb=scene.getObjectByName(`support-falling-bomb-${index}`)!;
    expect(bomb.visible).toBe(true);expect(bomb.position.x).toBeCloseTo(r.planes[i].position.x);
    expect(bomb.position.z).toBeCloseTo(r.planes[i].position.z);
    expect(Math.abs(bomb.position.y-r.planes[i].position.y)).toBeLessThan(.2);
  }
  state={...state,commanderSupport:{...state.commanderSupport!,elapsedSeconds:71}};r.update(4000,state);expect(shadows.every(s=>!s.visible)).toBe(true);
  state={...state,squad:{...state.squad,count:0}};r.update(4000,state);expect(r.planes.every(p=>!p.visible)).toBe(true);
  r.dispose();expect(scene.children).toHaveLength(0);
});
